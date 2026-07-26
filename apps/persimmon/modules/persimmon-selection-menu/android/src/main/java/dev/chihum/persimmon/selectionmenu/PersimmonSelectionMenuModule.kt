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
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Rect
import android.os.Build
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.textclassifier.TextClassification
import android.view.textclassifier.TextClassificationManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.roundToInt

private const val MENU_ITEM_SHARE = 0x10001
private const val MENU_ITEM_WEB_SEARCH = 0x10002
private const val MENU_ITEM_PROCESS_TEXT_START = 0x20000
private const val MENU_GROUP_SMART_ACTIONS = 0x30000
private const val MENU_ITEM_SMART_ACTION_START = 0x30000

class PersimmonSelectionMenuModule : Module() {
  private var actionMode: ActionMode? = null
  private var presentationGeneration = 0
  private val classificationExecutor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("PersimmonSelectionMenu")

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

    AsyncFunction("hide") {
      presentationGeneration += 1
      actionMode?.finish()
      actionMode = null
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      presentationGeneration += 1
      classificationExecutor.shutdownNow()
      appContext.currentActivity?.runOnUiThread {
        actionMode?.finish()
        actionMode = null
      }
    }
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
