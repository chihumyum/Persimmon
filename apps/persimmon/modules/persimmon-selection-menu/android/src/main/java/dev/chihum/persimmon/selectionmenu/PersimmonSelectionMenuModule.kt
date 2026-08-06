package dev.chihum.persimmon.selectionmenu

import android.app.PendingIntent
import android.app.RemoteAction
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.util.TypedValue
import android.view.ActionMode
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.Menu
import android.view.MenuItem
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.textclassifier.TextClassification
import android.view.textclassifier.TextClassificationManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSnapHelper
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import expo.modules.kotlin.Promise
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private const val MENU_ITEM_SHARE = 0x10001
private const val MENU_ITEM_WEB_SEARCH = 0x10002
private const val MENU_ITEM_PROCESS_TEXT_START = 0x20000
private const val MENU_GROUP_SMART_ACTIONS = 0x30000
private const val MENU_ITEM_SMART_ACTION_START = 0x30000
private const val MENU_ITEM_BOOK_DETAILS = 0x40001
private const val MENU_ITEM_BOOK_SYNC = 0x40002
private const val MENU_ITEM_BOOK_DELETE = 0x40003
private const val APP_CONTROL_DIAMETER_DP = 50f
private const val APP_CONTROL_ICON_DP = 22f
private const val APP_SHEET_HEADER_HEIGHT_DP = 66f
private const val APP_SHEET_HEADER_FONT_SP = 20f
private const val TABLE_OF_CONTENTS_ROW_HEIGHT_DP = 50f

class PersimmonReaderChromeTouchView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  private val onPress by EventDispatcher<Map<String, Boolean>>()
  private var pressEnabled = true

  override val shouldUseAndroidLayout = true

  init {
    isClickable = true
    isFocusable = true
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    setOnClickListener {
      if (pressEnabled) {
        onPress(emptyMap())
      }
    }
    updateRippleColor(ColorUtils.setAlphaComponent(Color.BLACK, 24))
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> parent?.requestDisallowInterceptTouchEvent(true)
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> post {
        parent?.requestDisallowInterceptTouchEvent(false)
      }
    }
    super.onTouchEvent(event)
    // This native surface owns the complete gesture. In particular, ACTION_DOWN
    // must never reach the full-page Reader turn recognizer underneath it.
    return true
  }

  fun updatePressEnabled(enabled: Boolean) {
    pressEnabled = enabled
    alpha = if (enabled) 1f else 0.46f
  }

  fun updateRippleColor(color: Int) {
    val mask = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.WHITE)
    }
    foreground = RippleDrawable(ColorStateList.valueOf(color), null, mask)
  }
}

private class PersimmonWheelPicker(context: Context) : RecyclerView(context) {
  private companion object {
    const val ITEM_HEIGHT_DP = 36f
    const val CENTER_TEXT_SIZE_SP = 20f
    const val DISTANT_SCALE = 0.72f
    const val DISTANT_ALPHA = 0.24f
    const val TRANSFORM_DISTANCE_IN_ROWS = 2.25f
    const val SETTLE_DELAY_MS = 180L
  }

  private inner class WheelViewHolder(val label: TextView) : ViewHolder(label)

  private val itemHeight = dp(ITEM_HEIGHT_DP)
  private val wheelLayoutManager = LinearLayoutManager(context, VERTICAL, false)
  private val snapHelper = LinearSnapHelper()
  private var values = emptyList<String>()
  private var selectedIndex = 0
  private var textColor = Color.BLACK
  private var touchActive = false
  private var userInteractionPending = false
  private var lastHapticIndex = RecyclerView.NO_POSITION
  private var settleRunnable: Runnable? = null

  var onSettledSelection: ((Int) -> Unit)? = null

  private val wheelAdapter = object : Adapter<WheelViewHolder>() {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): WheelViewHolder {
      val label = TextView(parent.context).apply {
        gravity = Gravity.CENTER
        includeFontPadding = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, CENTER_TEXT_SIZE_SP)
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, itemHeight)
      }
      return WheelViewHolder(label)
    }

    override fun onBindViewHolder(holder: WheelViewHolder, position: Int) {
      holder.label.apply {
        text = values[position]
        setTextColor(textColor)
        isSelected = position == selectedIndex
        setOnClickListener {
          scrollToIndex(position, animated = true, userInitiated = true)
        }
      }
    }

    override fun getItemCount(): Int = values.size
  }

  init {
    layoutManager = wheelLayoutManager
    adapter = wheelAdapter
    itemAnimator = null
    clipToPadding = false
    isVerticalScrollBarEnabled = false
    isNestedScrollingEnabled = false
    overScrollMode = View.OVER_SCROLL_NEVER
    isHapticFeedbackEnabled = true
    snapHelper.attachToRecyclerView(this)

    addOnScrollListener(object : OnScrollListener() {
      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        updateChildTransforms()
        if (userInteractionPending) {
          performSelectionHapticIfNeeded()
        }
      }

      override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
        updateChildTransforms()
        if (newState == SCROLL_STATE_IDLE) {
          post(::scheduleSettledSelection)
        } else {
          cancelSettledSelection()
        }
      }
    })
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    // Claim the gesture before RecyclerView dispatches ACTION_DOWN to its
    // clickable row TextView. An OnTouchListener on RecyclerView is too late
    // for that path, which lets the surrounding BottomSheet steal long drags.
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        parent?.requestDisallowInterceptTouchEvent(true)
        touchActive = true
        userInteractionPending = true
        lastHapticIndex = nearestIndex()
        cancelSettledSelection()
      }
      MotionEvent.ACTION_MOVE -> {
        parent?.requestDisallowInterceptTouchEvent(true)
      }
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> {
        touchActive = false
        post {
          parent?.requestDisallowInterceptTouchEvent(false)
          scheduleSettledSelection()
        }
      }
    }
    return super.dispatchTouchEvent(event)
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    val verticalPadding = max(0, (height - itemHeight) / 2)
    if (paddingTop != verticalPadding || paddingBottom != verticalPadding) {
      setPadding(paddingLeft, verticalPadding, paddingRight, verticalPadding)
    }
    post {
      centerSelectedIndex()
      updateChildTransforms()
    }
  }

  override fun onDetachedFromWindow() {
    cancelSettledSelection()
    super.onDetachedFromWindow()
  }

  fun updateValues(nextValues: List<String>, requestedIndex: Int) {
    if (values == nextValues) {
      setSelectedIndex(requestedIndex)
      return
    }
    values = nextValues
    selectedIndex = boundedIndex(requestedIndex)
    isEnabled = values.isNotEmpty()
    wheelAdapter.notifyDataSetChanged()
    post {
      centerSelectedIndex()
      updateChildTransforms()
    }
  }

  fun setSelectedIndex(nextIndex: Int) {
    val boundedIndex = boundedIndex(nextIndex)
    if (selectedIndex == boundedIndex && nearestIndex() == boundedIndex) {
      return
    }
    val previousIndex = selectedIndex
    selectedIndex = boundedIndex
    notifySelectionChanged(previousIndex, selectedIndex)
    post {
      centerSelectedIndex()
      updateChildTransforms()
    }
  }

  fun updateTextColor(color: Int) {
    if (textColor == color) {
      return
    }
    textColor = color
    wheelAdapter.notifyDataSetChanged()
    post(::updateChildTransforms)
  }

  private fun scrollToIndex(index: Int, animated: Boolean, userInitiated: Boolean) {
    if (values.isEmpty()) {
      return
    }
    val boundedIndex = boundedIndex(index)
    if (userInitiated) {
      userInteractionPending = true
      lastHapticIndex = nearestIndex()
      cancelSettledSelection()
    }
    if (!animated || height == 0) {
      selectedIndex = boundedIndex
      centerSelectedIndex()
      updateChildTransforms()
      if (userInitiated) {
        scheduleSettledSelection()
      }
      return
    }

    val target = wheelLayoutManager.findViewByPosition(boundedIndex)
    if (target != null) {
      val distance = childCenter(target) - height / 2f
      smoothScrollBy(0, distance.roundToInt())
    } else {
      smoothScrollToPosition(boundedIndex)
    }
  }

  private fun centerSelectedIndex() {
    if (values.isEmpty() || height == 0) {
      return
    }
    wheelLayoutManager.scrollToPositionWithOffset(
      selectedIndex,
      0
    )
  }

  private fun updateChildTransforms() {
    if (height == 0 || childCount == 0) {
      return
    }
    val pickerCenter = height / 2f
    val maximumDistance = itemHeight * TRANSFORM_DISTANCE_IN_ROWS
    for (childIndex in 0 until childCount) {
      val child = getChildAt(childIndex)
      val distance = abs(childCenter(child) - pickerCenter)
      val progress = min(1f, distance / maximumDistance)
      val scale = 1f - ((1f - DISTANT_SCALE) * progress)
      child.scaleX = scale
      child.scaleY = scale
      child.alpha = 1f - ((1f - DISTANT_ALPHA) * progress)
    }
  }

  private fun performSelectionHapticIfNeeded() {
    val nearestIndex = nearestIndex()
    if (nearestIndex == RecyclerView.NO_POSITION || nearestIndex == lastHapticIndex) {
      return
    }
    lastHapticIndex = nearestIndex
    performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
  }

  private fun scheduleSettledSelection() {
    cancelSettledSelection()
    if (
      !userInteractionPending ||
      touchActive ||
      scrollState != SCROLL_STATE_IDLE
    ) {
      return
    }
    val runnable = Runnable {
      settleRunnable = null
      if (touchActive || scrollState != SCROLL_STATE_IDLE) {
        scheduleSettledSelection()
        return@Runnable
      }
      val settledIndex = nearestIndex()
      if (settledIndex == RecyclerView.NO_POSITION) {
        return@Runnable
      }
      userInteractionPending = false
      val previousIndex = selectedIndex
      selectedIndex = settledIndex
      notifySelectionChanged(previousIndex, selectedIndex)
      updateChildTransforms()
      if (previousIndex != settledIndex) {
        onSettledSelection?.invoke(settledIndex)
      }
    }
    settleRunnable = runnable
    postDelayed(runnable, SETTLE_DELAY_MS)
  }

  private fun cancelSettledSelection() {
    settleRunnable?.let(::removeCallbacks)
    settleRunnable = null
  }

  private fun nearestIndex(): Int {
    val snapView = snapHelper.findSnapView(wheelLayoutManager) ?: return RecyclerView.NO_POSITION
    return getChildAdapterPosition(snapView)
  }

  private fun notifySelectionChanged(previousIndex: Int, nextIndex: Int) {
    if (previousIndex in values.indices) {
      wheelAdapter.notifyItemChanged(previousIndex)
    }
    if (nextIndex in values.indices) {
      wheelAdapter.notifyItemChanged(nextIndex)
    }
  }

  private fun boundedIndex(index: Int): Int =
    if (values.isEmpty()) 0 else index.coerceIn(values.indices)

  private fun childCenter(child: View): Float = (child.top + child.bottom) / 2f

  private fun dp(value: Float): Int =
    (value * resources.displayMetrics.density).roundToInt()
}

class PersimmonReaderTypographyPickerView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  private val componentCount = 4
  private val onValueChange by EventDispatcher<Map<String, Int>>()
  private val values = MutableList<List<String>>(componentCount) { emptyList() }
  private val requestedIndices = MutableList(componentCount) { 0 }
  private var updatingFromProps = false
  private val labelViews = List(componentCount) {
    TextView(context).apply {
      gravity = Gravity.CENTER
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
      includeFontPadding = false
      isSingleLine = false
      maxLines = 2
      setHorizontallyScrolling(false)
    }
  }
  private val wheelPickers = List(componentCount) { component ->
    PersimmonWheelPicker(context).apply {
      onSettledSelection = { nextIndex ->
        requestedIndices[component] = nextIndex
        if (!updatingFromProps) {
          onValueChange(mapOf("component" to component, "index" to nextIndex))
        }
      }
    }
  }
  private val labelRow = LinearLayout(context)
  private val pickerRow = LinearLayout(context)

  override val shouldUseAndroidLayout = true

  init {
    orientation = VERTICAL
    gravity = Gravity.CENTER
    labelRow.orientation = HORIZONTAL
    pickerRow.orientation = HORIZONTAL
    labelViews.forEach { label ->
      labelRow.addView(
        label,
        LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
      )
    }
    wheelPickers.forEach { picker ->
      pickerRow.addView(
        picker,
        LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f)
      )
    }
    addView(
      pickerRow,
      LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f)
    )
    addView(
      labelRow,
      LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(48f))
    )
  }

  private fun dp(value: Float): Int =
    (value * resources.displayMetrics.density).roundToInt()

  fun updateLabels(nextLabels: List<String>) {
    labelViews.indices.forEach { component ->
      labelViews[component].text = nextLabels.getOrElse(component) { "" }
    }
  }

  fun updateLabelColor(color: Int) {
    labelViews.forEach { it.setTextColor(color) }
  }

  fun updateLabelFontSize(size: Double) {
    labelViews.forEach {
      it.setTextSize(TypedValue.COMPLEX_UNIT_SP, size.toFloat())
    }
    requestLayout()
  }

  fun updateValues(nextValues: List<String>, component: Int) {
    if (component !in values.indices || values[component] == nextValues) {
      return
    }
    values[component] = nextValues
    updatingFromProps = true
    wheelPickers[component].updateValues(nextValues, requestedIndices[component])
    updatingFromProps = false
  }

  fun updateSelectedIndices(nextIndices: List<Int>) {
    requestedIndices.indices.forEach { component ->
      val nextIndex = nextIndices.getOrElse(component) { 0 }
      requestedIndices[component] = nextIndex
      if (values[component].isEmpty()) {
        return@forEach
      }
      val boundedIndex = nextIndex.coerceIn(0, values[component].lastIndex)
      updatingFromProps = true
      wheelPickers[component].setSelectedIndex(boundedIndex)
      updatingFromProps = false
    }
  }

  fun updateTextColor(color: Int) {
    wheelPickers.forEach { it.updateTextColor(color) }
  }

}

class PersimmonSelectionMenuModule : Module() {
  private var actionMode: ActionMode? = null
  private var bookPopupMenu: PopupMenu? = null
  private var bookMenuAnchor: View? = null
  private var bookMenuPromise: Promise? = null
  private var tableOfContentsDialog: BottomSheetDialog? = null
  private var tableOfContentsPromise: Promise? = null
  private var tableOfContentsResult: Int? = null
  private var presentationGeneration = 0
  private val classificationExecutor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("PersimmonSelectionMenu")

    View(PersimmonReaderChromeTouchView::class) {
      Events("onPress")

      Prop("pressEnabled") { view: PersimmonReaderChromeTouchView, enabled: Boolean ->
        view.updatePressEnabled(enabled)
      }

      Prop("rippleColor") { view: PersimmonReaderChromeTouchView, color: Int ->
        view.updateRippleColor(color)
      }
    }

    View(PersimmonReaderTypographyPickerView::class) {
      Events("onValueChange")

      Prop("fontSizeValues") { view: PersimmonReaderTypographyPickerView, values: List<String> ->
        view.updateValues(values, 0)
      }

      Prop("lineHeightValues") { view: PersimmonReaderTypographyPickerView, values: List<String> ->
        view.updateValues(values, 1)
      }

      Prop("paragraphSpacingValues") { view: PersimmonReaderTypographyPickerView, values: List<String> ->
        view.updateValues(values, 2)
      }

      Prop("horizontalMarginValues") { view: PersimmonReaderTypographyPickerView, values: List<String> ->
        view.updateValues(values, 3)
      }

      Prop("selectedIndices") { view: PersimmonReaderTypographyPickerView, indices: List<Int> ->
        view.updateSelectedIndices(indices)
      }

      Prop("labels") { view: PersimmonReaderTypographyPickerView, labels: List<String> ->
        view.updateLabels(labels)
      }

      Prop("labelColor") { view: PersimmonReaderTypographyPickerView, color: Int ->
        view.updateLabelColor(color)
      }

      Prop("labelFontSize") { view: PersimmonReaderTypographyPickerView, size: Double ->
        view.updateLabelFontSize(size)
      }

      Prop("textColor") { view: PersimmonReaderTypographyPickerView, color: Int ->
        view.updateTextColor(color)
      }

    }

    AsyncFunction("show") {
      text: String,
      x: Double,
      y: Double,
      width: Double,
      height: Double ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      val decorView = activity.window.decorView
      val generation = ++presentationGeneration
      decorView.post {
        if (generation != presentationGeneration) {
          return@post
        }
        actionMode?.finish()
        dismissBookMenu()

        val density = decorView.resources.displayMetrics.density.toDouble()
        val anchorInWindow = Rect(
          (x * density).roundToInt(),
          (y * density).roundToInt(),
          ((x + max(1.0, width)) * density).roundToInt(),
          ((y + max(1.0, height)) * density).roundToInt()
        )
        var smartActions = emptyList<RemoteAction>()
        val callback = object : ActionMode.Callback2() {
          override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            menu
              .add(Menu.NONE, android.R.id.copy, Menu.NONE, android.R.string.copy)
              .setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS)
            addShareAction(activity, menu, text)
            addWebSearchAction(activity, menu, text)
            addProcessTextActions(activity, menu, text)
            return true
          }

          override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
            menu.removeGroup(MENU_GROUP_SMART_ACTIONS)
            addSmartActions(activity, menu, smartActions)
            return true
          }

          override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
            if (item.itemId == android.R.id.copy) {
              val clipboard =
                activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
              clipboard.setPrimaryClip(ClipData.newPlainText(null, text))
              mode.finish()
              return true
            }

            if (item.groupId == MENU_GROUP_SMART_ACTIONS) {
              val actionIndex = item.itemId - MENU_ITEM_SMART_ACTION_START
              val action = smartActions.getOrNull(actionIndex) ?: return false
              return try {
                action.actionIntent.send()
                mode.finish()
                true
              } catch (_: PendingIntent.CanceledException) {
                false
              }
            }

            val intent = item.intent ?: return false
            return try {
              activity.startActivity(intent)
              mode.finish()
              true
            } catch (_: ActivityNotFoundException) {
              false
            } catch (_: SecurityException) {
              false
            }
          }

          override fun onDestroyActionMode(mode: ActionMode) {
            if (actionMode === mode) {
              actionMode = null
            }
          }

          override fun onGetContentRect(mode: ActionMode, view: View, outRect: Rect) {
            val viewLocation = IntArray(2)
            view.getLocationInWindow(viewLocation)
            outRect.set(
              anchorInWindow.left - viewLocation[0],
              anchorInWindow.top - viewLocation[1],
              anchorInWindow.right - viewLocation[0],
              anchorInWindow.bottom - viewLocation[1]
            )
          }
        }
        actionMode = decorView.startActionMode(callback, ActionMode.TYPE_FLOATING)
        loadSmartActions(activity, decorView, text) { actions ->
          if (generation == presentationGeneration && actionMode != null) {
            smartActions = actions
            actionMode?.invalidate()
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showBookMenu") {
      labels: List<String>,
      canDelete: Boolean,
      x: Double,
      y: Double,
      width: Double,
      height: Double,
      promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val detailsLabel = labels.getOrElse(0) { "Details" }
      val syncLabel = labels.getOrElse(1) { "Sync" }
      val deleteLabel = labels.getOrElse(2) { "Delete" }
      val decorView = activity.window.decorView
      val generation = ++presentationGeneration
      decorView.post {
        if (generation != presentationGeneration) {
          promise.resolve(null)
          return@post
        }
        actionMode?.finish()
        dismissBookMenu()
        bookMenuPromise = promise

        val density = decorView.resources.displayMetrics.density.toDouble()
        val anchorInWindow = Rect(
          (x * density).roundToInt(),
          (y * density).roundToInt(),
          ((x + max(1.0, width)) * density).roundToInt(),
          ((y + max(1.0, height)) * density).roundToInt()
        )
        val contentView = activity.findViewById<FrameLayout>(android.R.id.content)
        val contentLocation = IntArray(2)
        contentView.getLocationInWindow(contentLocation)
        val anchorWidth = max(1, anchorInWindow.width())
          .coerceAtMost(max(1, contentView.width))
        val anchorHeight = max(1, anchorInWindow.height())
          .coerceAtMost(max(1, contentView.height))
        val anchor = View(activity).apply {
          alpha = 0f
          importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }
        val anchorLayout = FrameLayout.LayoutParams(anchorWidth, anchorHeight).apply {
          gravity = Gravity.TOP or Gravity.START
          leftMargin = (anchorInWindow.left - contentLocation[0])
            .coerceIn(0, max(0, contentView.width - anchorWidth))
          topMargin = (anchorInWindow.top - contentLocation[1])
            .coerceIn(0, max(0, contentView.height - anchorHeight))
        }
        contentView.addView(anchor, anchorLayout)
        bookMenuAnchor = anchor

        var selectedAction: String? = null
        val popupGravity = if (
          anchorInWindow.centerX() < contentLocation[0] + contentView.width / 2
        ) {
          Gravity.START
        } else {
          Gravity.END
        }
        val popup = PopupMenu(activity, anchor, popupGravity).apply {
          menu.add(Menu.NONE, MENU_ITEM_BOOK_DETAILS, Menu.NONE, detailsLabel)
          if (syncLabel.isNotBlank()) {
            menu.add(Menu.NONE, MENU_ITEM_BOOK_SYNC, Menu.NONE, syncLabel)
          }
          if (canDelete) {
            menu.add(Menu.NONE, MENU_ITEM_BOOK_DELETE, Menu.NONE, deleteLabel)
          }
          setOnMenuItemClickListener { item ->
            selectedAction = when (item.itemId) {
              MENU_ITEM_BOOK_DETAILS -> "details"
              MENU_ITEM_BOOK_SYNC -> "sync"
              MENU_ITEM_BOOK_DELETE -> "delete"
              else -> return@setOnMenuItemClickListener false
            }
            true
          }
        }
        popup.setOnDismissListener {
          if (bookPopupMenu === popup) {
            completeBookMenu(selectedAction)
          }
        }
        bookPopupMenu = popup
        anchor.post showPopup@{
          if (generation != presentationGeneration || bookPopupMenu !== popup) {
            return@showPopup
          }
          runCatching { popup.show() }.onFailure {
            if (bookPopupMenu === popup) {
              completeBookMenu(null)
            }
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showTableOfContents") {
      title: String,
      closeLabel: String,
      labels: List<String>,
      depths: List<Int>,
      selectedIndex: Int,
      colors: List<Int>,
      bottomInset: Double,
      promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      presentationGeneration += 1
      actionMode?.finish()
      actionMode = null
      dismissBookMenu()
      discardTableOfContents()

      val backgroundColor = colors.getOrElse(0) { Color.WHITE }
      val raisedColor = colors.getOrElse(1) { backgroundColor }
      val textColor = colors.getOrElse(2) { Color.BLACK }
      val secondaryTextColor = colors.getOrElse(3) { textColor }
      val accentColor = colors.getOrElse(4) { textColor }
      val selectedColor = colors.getOrElse(5) {
        ColorUtils.setAlphaComponent(accentColor, 20)
      }
      val density = activity.resources.displayMetrics.density
      fun dp(value: Float): Int = (value * density).roundToInt()

      val root = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        isClickable = true
        isFocusable = true
        background = roundedBackground(backgroundColor, dp(28f).toFloat())
        clipToOutline = true
      }
      val header = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(APP_SHEET_HEADER_HEIGHT_DP)
        setPadding(dp(16f), dp(8f), dp(16f), dp(8f))
      }
      val titleView = TextView(activity).apply {
        text = title
        setTextColor(textColor)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, APP_SHEET_HEADER_FONT_SP)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        includeFontPadding = false
        gravity = Gravity.CENTER
      }
      header.addView(
        View(activity).apply {
          importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        },
        LinearLayout.LayoutParams(
          dp(APP_CONTROL_DIAMETER_DP),
          dp(APP_CONTROL_DIAMETER_DP)
        )
      )
      header.addView(
        titleView,
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
      )
      val closeButton = ImageButton(activity).apply {
        contentDescription = closeLabel
        setImageResource(R.drawable.persimmon_close)
        setColorFilter(secondaryTextColor)
        val iconInset = dp((APP_CONTROL_DIAMETER_DP - APP_CONTROL_ICON_DP) / 2f)
        setPadding(iconInset, iconInset, iconInset, iconInset)
        background = circularRippleBackground(
          raisedColor,
          ColorUtils.setAlphaComponent(secondaryTextColor, 30)
        )
        elevation = 0f
        stateListAnimator = null
      }
      header.addView(
        closeButton,
        LinearLayout.LayoutParams(
          dp(APP_CONTROL_DIAMETER_DP),
          dp(APP_CONTROL_DIAMETER_DP)
        )
      )
      root.addView(
        header,
        LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT
        )
      )

      val layoutManager = LinearLayoutManager(activity)
      val rows = RecyclerView(activity).apply {
        clipToPadding = false
        this.layoutManager = layoutManager
        isNestedScrollingEnabled = true
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        setHasFixedSize(false)
        setPadding(dp(12f), dp(4f), dp(12f), dp(20f))
      }
      rows.adapter = object : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
        override fun onCreateViewHolder(
          parent: ViewGroup,
          viewType: Int
        ): RecyclerView.ViewHolder {
          val row = TextView(parent.context).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            includeFontPadding = false
            gravity = Gravity.CENTER_VERTICAL
            maxLines = 2
            minimumHeight = dp(TABLE_OF_CONTENTS_ROW_HEIGHT_DP)
            isClickable = true
            isFocusable = true
            layoutParams = RecyclerView.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.WRAP_CONTENT
            )
          }
          return object : RecyclerView.ViewHolder(row) {}
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, index: Int) {
          val selected = index == selectedIndex
          val depth = depths.getOrElse(index) { 0 }.coerceIn(0, 6)
          (holder.itemView as TextView).apply {
            text = labels[index]
            setTextColor(if (selected) accentColor else textColor)
            typeface = Typeface.create(
              "sans-serif",
              if (selected) Typeface.BOLD else Typeface.NORMAL
            )
            setPadding(dp(16f + depth * 19f), dp(4f), dp(10f), dp(4f))
            background = roundedRippleBackground(
              if (selected) selectedColor else Color.TRANSPARENT,
              ColorUtils.setAlphaComponent(textColor, 24),
              dp(14f).toFloat()
            )
            isSelected = selected
            setOnClickListener {
              if (tableOfContentsDialog != null) {
                tableOfContentsResult = index
              }
              tableOfContentsDialog?.cancel()
            }
          }
        }

        override fun getItemCount(): Int = labels.size
      }
      root.addView(
        rows,
        LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          0,
          1f
        )
      )

      val baseHorizontalPadding = dp(12f)
      val requestedBottomInset = dp(bottomInset.toFloat())
      ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
        val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
        header.setPadding(
          dp(16f),
          systemBars.top + dp(8f),
          dp(16f),
          dp(8f)
        )
        rows.setPadding(
          baseHorizontalPadding,
          dp(4f),
          baseHorizontalPadding,
          max(requestedBottomInset, systemBars.bottom) + dp(20f)
        )
        insets
      }

      val dialog = BottomSheetDialog(activity).apply {
        setCancelable(true)
        setCanceledOnTouchOutside(true)
        setDismissWithAnimation(true)
        setContentView(root)
      }
      tableOfContentsDialog = dialog
      tableOfContentsPromise = promise
      tableOfContentsResult = null
      closeButton.setOnClickListener {
        if (tableOfContentsDialog === dialog) {
          dialog.cancel()
        }
      }
      dialog.setOnDismissListener {
        completeTableOfContents(dialog)
      }
      dialog.setOnShowListener {
        val window = dialog.window
        if (window != null) {
          WindowCompat.setDecorFitsSystemWindows(window, false)
          window.statusBarColor = Color.TRANSPARENT
          window.navigationBarColor = backgroundColor
          WindowInsetsControllerCompat(window, window.decorView).apply {
            val lightBackground = ColorUtils.calculateLuminance(backgroundColor) > 0.5
            isAppearanceLightStatusBars = lightBackground
            isAppearanceLightNavigationBars = lightBackground
          }
        }
        dialog.findViewById<FrameLayout>(
          com.google.android.material.R.id.design_bottom_sheet
        )?.apply {
          layoutParams = layoutParams.apply {
            height = ViewGroup.LayoutParams.MATCH_PARENT
          }
          setBackgroundColor(Color.TRANSPARENT)
        }
        dialog.behavior.apply {
          isFitToContents = false
          expandedOffset = 0
          skipCollapsed = true
          isHideable = true
          isDraggable = true
          state = BottomSheetBehavior.STATE_EXPANDED
        }
        root.requestApplyInsets()
        if (selectedIndex in labels.indices) {
          rows.post {
            layoutManager.scrollToPositionWithOffset(
              selectedIndex,
              max(0, (rows.height - dp(TABLE_OF_CONTENTS_ROW_HEIGHT_DP)) / 2)
            )
          }
        }
      }
      dialog.show()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hideTableOfContents") {
      dismissTableOfContents()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hide") {
      presentationGeneration += 1
      actionMode?.finish()
      actionMode = null
      dismissBookMenu()
      dismissTableOfContents()
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      presentationGeneration += 1
      classificationExecutor.shutdownNow()
      appContext.currentActivity?.runOnUiThread {
        actionMode?.finish()
        actionMode = null
        dismissBookMenu()
        discardTableOfContents()
      }
    }
  }

  private fun roundedBackground(color: Int, radius: Float): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadii = floatArrayOf(radius, radius, radius, radius, 0f, 0f, 0f, 0f)
    }

  private fun circularRippleBackground(
    color: Int,
    rippleColor: Int
  ): RippleDrawable {
    val content = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(color)
    }
    val mask = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.WHITE)
    }
    return RippleDrawable(ColorStateList.valueOf(rippleColor), content, mask)
  }

  private fun roundedRippleBackground(
    color: Int,
    rippleColor: Int,
    radius: Float
  ): RippleDrawable {
    val content = GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }
    val mask = GradientDrawable().apply {
      setColor(Color.WHITE)
      cornerRadius = radius
    }
    return RippleDrawable(ColorStateList.valueOf(rippleColor), content, mask)
  }

  private fun completeTableOfContents(dialog: BottomSheetDialog) {
    if (tableOfContentsDialog !== dialog) {
      return
    }
    tableOfContentsDialog = null
    val result = tableOfContentsResult
    tableOfContentsResult = null
    val promise = tableOfContentsPromise
    tableOfContentsPromise = null
    promise?.resolve(result)
  }

  private fun dismissTableOfContents() {
    val dialog = tableOfContentsDialog
    if (dialog == null) {
      val promise = tableOfContentsPromise
      tableOfContentsPromise = null
      tableOfContentsResult = null
      promise?.resolve(null)
      return
    }
    if (dialog.isShowing) {
      dialog.cancel()
    } else {
      completeTableOfContents(dialog)
    }
  }

  private fun discardTableOfContents() {
    val dialog = tableOfContentsDialog
    tableOfContentsDialog = null
    tableOfContentsResult = null
    val promise = tableOfContentsPromise
    tableOfContentsPromise = null
    dialog?.setOnDismissListener(null)
    dialog?.dismiss()
    promise?.resolve(null)
  }

  private fun completeBookMenu(result: String?) {
    bookPopupMenu = null
    val anchor = bookMenuAnchor
    bookMenuAnchor = null
    (anchor?.parent as? ViewGroup)?.removeView(anchor)
    val promise = bookMenuPromise
    bookMenuPromise = null
    promise?.resolve(result)
  }

  private fun dismissBookMenu() {
    val popup = bookPopupMenu
    bookPopupMenu = null
    popup?.dismiss()
    completeBookMenu(null)
  }

  private fun addShareAction(context: Context, menu: Menu, text: String) {
    val sendIntent = Intent(Intent.ACTION_SEND).apply {
      type = "text/plain"
      putExtra(Intent.EXTRA_TEXT, text)
    }
    if (sendIntent.resolveActivity(context.packageManager) == null) {
      return
    }

    menu
      .add(
        Menu.NONE,
        MENU_ITEM_SHARE,
        Menu.NONE,
        context.getString(R.string.persimmon_selection_share)
      )
      .setIntent(
        Intent.createChooser(
          sendIntent,
          context.getString(R.string.persimmon_selection_share)
        )
      )
      .setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM)
  }

  private fun addWebSearchAction(context: Context, menu: Menu, text: String) {
    val searchIntent = Intent(Intent.ACTION_WEB_SEARCH).apply {
      putExtra(SearchManager.QUERY, text)
    }
    if (searchIntent.resolveActivity(context.packageManager) == null) {
      return
    }

    menu
      .add(
        Menu.NONE,
        MENU_ITEM_WEB_SEARCH,
        Menu.NONE,
        context.getString(R.string.persimmon_selection_web_search)
      )
      .setIntent(searchIntent)
      .setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM)
  }

  private fun addProcessTextActions(context: Context, menu: Menu, text: String) {
    queryProcessTextActivities(context).forEachIndexed { index, resolveInfo ->
      val activityInfo = resolveInfo.activityInfo ?: return@forEachIndexed
      val intent = Intent(Intent.ACTION_PROCESS_TEXT).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_PROCESS_TEXT, text)
        putExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, true)
        component = ComponentName(activityInfo.packageName, activityInfo.name)
      }
      menu
        .add(
          Menu.NONE,
          MENU_ITEM_PROCESS_TEXT_START + index,
          Menu.NONE,
          resolveInfo.loadLabel(context.packageManager)
        )
        .setIntent(intent)
        .setShowAsAction(MenuItem.SHOW_AS_ACTION_NEVER)
    }
  }

  private fun queryProcessTextActivities(context: Context): List<ResolveInfo> {
    val intent = Intent(Intent.ACTION_PROCESS_TEXT).setType("text/plain")
    val packageManager = context.packageManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.queryIntentActivities(
        intent,
        PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
      )
    } else {
      @Suppress("DEPRECATION")
      packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
    }
  }

  private fun loadSmartActions(
    context: Context,
    anchorView: View,
    text: String,
    onLoaded: (List<RemoteAction>) -> Unit
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return
    }

    classificationExecutor.execute {
      val actions = try {
        val manager = context.getSystemService(TextClassificationManager::class.java)
        val request = TextClassification.Request.Builder(text, 0, text.length)
          .setDefaultLocales(context.resources.configuration.locales)
          .build()
        manager?.textClassifier?.classifyText(request)?.actions.orEmpty()
      } catch (_: IllegalArgumentException) {
        emptyList()
      } catch (_: IllegalStateException) {
        emptyList()
      }
      anchorView.post {
        onLoaded(actions)
      }
    }
  }

  private fun addSmartActions(
    context: Context,
    menu: Menu,
    actions: List<RemoteAction>
  ) {
    val existingTitles = buildSet {
      for (index in 0 until menu.size()) {
        add(menu.getItem(index).title.toString().trim().lowercase())
      }
    }.toMutableSet()

    actions.forEachIndexed { index, action ->
      val normalizedTitle = action.title.toString().trim().lowercase()
      if (normalizedTitle.isEmpty() || !existingTitles.add(normalizedTitle)) {
        return@forEachIndexed
      }
      menu
        .add(
          MENU_GROUP_SMART_ACTIONS,
          MENU_ITEM_SMART_ACTION_START + index,
          Menu.NONE,
          action.title
        )
        .apply {
          if (action.shouldShowIcon()) {
            icon = action.icon.loadDrawable(context)
          }
          setShowAsAction(MenuItem.SHOW_AS_ACTION_NEVER)
        }
    }
  }
}
