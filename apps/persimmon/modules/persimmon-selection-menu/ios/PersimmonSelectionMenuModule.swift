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

public final class PersimmonSelectionMenuModule: Module {
  private let anchorView = SelectionMenuAnchorView()

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
      DispatchQueue.main.async {
        self.anchorView.present(
          text: text,
          rectInWindow: CGRect(x: x, y: y, width: width, height: height),
          from: viewController
        )
      }
    }.runOnQueue(.main)

    AsyncFunction("hide") {
      self.anchorView.dismiss()
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.anchorView.dismiss()
      }
    }
  }
}
