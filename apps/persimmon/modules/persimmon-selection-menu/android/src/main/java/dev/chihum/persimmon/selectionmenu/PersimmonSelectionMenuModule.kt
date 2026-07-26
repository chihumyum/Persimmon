package dev.chihum.persimmon.selectionmenu

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Rect
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.max
import kotlin.math.roundToInt

class PersimmonSelectionMenuModule : Module() {
  private var actionMode: ActionMode? = null

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
      decorView.post {
        actionMode?.finish()

        val density = decorView.resources.displayMetrics.density.toDouble()
        val anchorInWindow = Rect(
          (x * density).roundToInt(),
          (y * density).roundToInt(),
          ((x + max(1.0, width)) * density).roundToInt(),
          ((y + max(1.0, height)) * density).roundToInt()
        )
        val callback = object : ActionMode.Callback2() {
          override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            menu
              .add(Menu.NONE, android.R.id.copy, Menu.NONE, android.R.string.copy)
              .setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS)
            return true
          }

          override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean = false

          override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
            if (item.itemId != android.R.id.copy) {
              return false
            }
            val clipboard =
              activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText(null, text))
            mode.finish()
            return true
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
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hide") {
      actionMode?.finish()
      actionMode = null
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      appContext.currentActivity?.runOnUiThread {
        actionMode?.finish()
        actionMode = null
      }
    }
  }
}
