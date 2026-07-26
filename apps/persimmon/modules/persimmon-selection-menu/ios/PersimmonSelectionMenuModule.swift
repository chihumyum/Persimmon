import ExpoModulesCore
import UIKit

private final class SelectionMenuAnchorView: UIView, UIEditMenuInteractionDelegate {
  private var selectedText = ""
  private lazy var editMenuInteraction = UIEditMenuInteraction(delegate: self)

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

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    action == #selector(copy(_:))
  }

  override func copy(_ sender: Any?) {
    UIPasteboard.general.string = selectedText
  }

  func present(text: String, rectInWindow: CGRect, from viewController: UIViewController) {
    dismiss()
    selectedText = text

    let container = viewController.view!
    let localOrigin = container.convert(rectInWindow.origin, from: nil)
    frame = CGRect(
      origin: localOrigin,
      size: CGSize(
        width: max(1, rectInWindow.width),
        height: max(1, rectInWindow.height)
      )
    )
    container.addSubview(self)
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
    selectedText = ""
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
    animator.addCompletion { [weak self] in
      self?.resignFirstResponder()
      self?.removeFromSuperview()
    }
  }
}

public final class PersimmonSelectionMenuModule: Module {
  private let anchorView = SelectionMenuAnchorView(frame: .zero)

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
      self.anchorView.present(
        text: text,
        rectInWindow: CGRect(x: x, y: y, width: width, height: height),
        from: viewController
      )
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
