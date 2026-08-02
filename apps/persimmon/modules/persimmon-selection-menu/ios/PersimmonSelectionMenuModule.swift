import ExpoModulesCore
import UIKit

private final class SelectionMenuAnchorView: UITextView, UIEditMenuInteractionDelegate {
  private lazy var editMenuInteraction = UIEditMenuInteraction(delegate: self)

  init() {
    super.init(frame: .zero, textContainer: nil)
    backgroundColor = .clear
    textColor = .clear
    tintColor = .clear
    isEditable = false
    isSelectable = true
    isScrollEnabled = false
    textContainerInset = .zero
    textContainer.lineFragmentPadding = 0
    accessibilityElementsHidden = true
    addInteraction(editMenuInteraction)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var canBecomeFirstResponder: Bool {
    true
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    false
  }

  override func selectionRects(for range: UITextRange) -> [UITextSelectionRect] {
    []
  }

  override func caretRect(for position: UITextPosition) -> CGRect {
    .zero
  }

  func present(text: String, rectInWindow: CGRect, from viewController: UIViewController) {
    self.text = text
    selectedRange = NSRange(location: 0, length: (text as NSString).length)

    let container = viewController.view!
    let localOrigin = container.convert(rectInWindow.origin, from: nil)
    frame = CGRect(
      origin: localOrigin,
      size: CGSize(
        width: max(1, rectInWindow.width),
        height: max(1, rectInWindow.height)
      )
    )
    if superview !== container {
      removeFromSuperview()
      container.addSubview(self)
    }
    guard becomeFirstResponder() else {
      removeFromSuperview()
      return
    }

    let configuration = UIEditMenuConfiguration(
      identifier: nil,
      sourcePoint: CGPoint(x: bounds.midX, y: bounds.minY)
    )
    editMenuInteraction.presentEditMenu(with: configuration)
  }

  func dismiss() {
    editMenuInteraction.dismissMenu()
    resignFirstResponder()
    removeFromSuperview()
    text = ""
    selectedRange = NSRange(location: 0, length: 0)
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    targetRectFor configuration: UIEditMenuConfiguration
  ) -> CGRect {
    bounds
  }
}

private final class BookMenuAnchorView: UIView, UIEditMenuInteractionDelegate {
  private lazy var editMenuInteraction = UIEditMenuInteraction(delegate: self)
  private var menuActions: [(id: String, title: String, destructive: Bool)] = []
  private var onSelection: ((String?) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    accessibilityElementsHidden = true
    addInteraction(editMenuInteraction)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var canBecomeFirstResponder: Bool {
    true
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    false
  }

  func present(
    detailsLabel: String,
    syncLabel: String,
    deleteLabel: String,
    canDelete: Bool,
    rectInWindow: CGRect,
    from viewController: UIViewController,
    onSelection: @escaping (String?) -> Void
  ) {
    self.onSelection = onSelection
    menuActions = [
      (id: "details", title: detailsLabel, destructive: false),
      (id: "sync", title: syncLabel, destructive: false)
    ]
    if canDelete {
      menuActions.append((id: "delete", title: deleteLabel, destructive: true))
    }

    let container = viewController.view!
    let localOrigin = container.convert(rectInWindow.origin, from: nil)
    frame = CGRect(
      origin: localOrigin,
      size: CGSize(
        width: max(1, rectInWindow.width),
        height: max(1, rectInWindow.height)
      )
    )
    if superview !== container {
      removeFromSuperview()
      container.addSubview(self)
    }
    _ = becomeFirstResponder()
    let configuration = UIEditMenuConfiguration(
      identifier: nil,
      sourcePoint: CGPoint(x: bounds.midX, y: bounds.midY)
    )
    editMenuInteraction.presentEditMenu(with: configuration)
  }

  func dismiss() {
    editMenuInteraction.dismissMenu()
    finish(with: nil)
  }

  private func finish(with action: String?) {
    let completion = onSelection
    onSelection = nil
    menuActions = []
    resignFirstResponder()
    removeFromSuperview()
    completion?(action)
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    menuFor configuration: UIEditMenuConfiguration,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    UIMenu(
      children: menuActions.map { item in
        UIAction(
          title: item.title,
          attributes: item.destructive ? .destructive : []
        ) { [weak self] _ in
          self?.finish(with: item.id)
        }
      }
    )
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    targetRectFor configuration: UIEditMenuConfiguration
  ) -> CGRect {
    bounds
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    willDismissMenuFor configuration: UIEditMenuConfiguration,
    animator: any UIEditMenuInteractionAnimating
  ) {
    finish(with: nil)
  }
}

public final class PersimmonSelectionMenuModule: Module {
  private var anchorView: SelectionMenuAnchorView?
  private var bookMenuAnchorView: BookMenuAnchorView?
  private var bookMenuPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("PersimmonSelectionMenu")

    AsyncFunction("show") {
      (text: String, x: Double, y: Double, width: Double, height: Double) in
      guard
        !text.isEmpty,
        let viewController = self.appContext?.utilities?.currentViewController()
      else {
        return
      }
      self.bookMenuAnchorView?.dismiss()
      let anchorView = self.anchorView ?? SelectionMenuAnchorView()
      self.anchorView = anchorView
      anchorView.present(
        text: text,
        rectInWindow: CGRect(x: x, y: y, width: width, height: height),
        from: viewController
      )
    }.runOnQueue(.main)

    AsyncFunction("showBookMenu") {
      (
        labels: [String],
        canDelete: Bool,
        x: Double,
        y: Double,
        width: Double,
        height: Double,
        promise: Promise
      ) in
      guard let viewController = self.appContext?.utilities?.currentViewController() else {
        promise.resolve(NSNull())
        return
      }
      self.anchorView?.dismiss()
      self.bookMenuAnchorView?.dismiss()
      self.resolveBookMenu(nil)
      self.bookMenuPromise = promise

      let detailsLabel = labels.indices.contains(0) ? labels[0] : "Details"
      let syncLabel = labels.indices.contains(1) ? labels[1] : "Sync"
      let deleteLabel = labels.indices.contains(2) ? labels[2] : "Delete"

      let anchorView = BookMenuAnchorView()
      self.bookMenuAnchorView = anchorView
      anchorView.present(
        detailsLabel: detailsLabel,
        syncLabel: syncLabel,
        deleteLabel: deleteLabel,
        canDelete: canDelete,
        rectInWindow: CGRect(x: x, y: y, width: width, height: height),
        from: viewController
      ) { [weak self] action in
        self?.resolveBookMenu(action)
      }
    }.runOnQueue(.main)

    AsyncFunction("hide") {
      self.anchorView?.dismiss()
      self.bookMenuAnchorView?.dismiss()
      self.resolveBookMenu(nil)
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.anchorView?.dismiss()
        self.anchorView = nil
        self.bookMenuAnchorView?.dismiss()
        self.bookMenuAnchorView = nil
        self.resolveBookMenu(nil)
      }
    }
  }

  private func resolveBookMenu(_ action: String?) {
    guard let promise = bookMenuPromise else {
      return
    }
    bookMenuPromise = nil
    if let action {
      promise.resolve(action)
    } else {
      promise.resolve(NSNull())
    }
  }
}
