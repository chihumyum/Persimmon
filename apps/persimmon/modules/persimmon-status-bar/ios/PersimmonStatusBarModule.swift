import ExpoModulesCore
import UIKit

/// The app-wide status bar appearance. iOS 27 made the `UIApplication` status
/// bar setters that React Native's `StatusBar` uses no-ops, so the root view
/// controller answers for the whole window instead.
enum PersimmonStatusBarAppearance {
  static var hidden = false
  static var style: UIStatusBarStyle = .default
}

public final class PersimmonRootViewController: UIViewController {
  public override var prefersStatusBarHidden: Bool {
    PersimmonStatusBarAppearance.hidden
  }

  public override var preferredStatusBarStyle: UIStatusBarStyle {
    PersimmonStatusBarAppearance.style
  }

  public override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
    .fade
  }
}

public final class PersimmonStatusBarReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    PersimmonRootViewController()
  }
}

public final class PersimmonStatusBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PersimmonStatusBar")

    AsyncFunction("setAppearance") { (hidden: Bool, style: String) in
      PersimmonStatusBarAppearance.hidden = hidden
      PersimmonStatusBarAppearance.style = Self.statusBarStyle(style)
      let windows = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
      UIView.animate(withDuration: 0.2) {
        for window in windows {
          window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
        }
      }
    }.runOnQueue(.main)
  }

  private static func statusBarStyle(_ style: String) -> UIStatusBarStyle {
    switch style {
    case "light-content":
      return .lightContent
    case "dark-content":
      return .darkContent
    default:
      return .default
    }
  }
}
