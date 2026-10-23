import ExpoModulesCore
import UIKit

public final class PersimmonDuoLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PersimmonDuoLayout")

    View(PersimmonDuoLayoutView.self) {
      Events("onLayoutInfoChange")
    }
  }
}

/// A full-window, non-interactive view that reports the multi-display layout
/// signals UIKit only exposes to native code: the vertical bar edge, reserved
/// regions (camera and status occlusions, the fold) and the hinge status.
/// Everything here is iOS 27.1 API, so older SDKs and OS versions report an
/// empty layout.
final class PersimmonDuoLayoutView: ExpoView {
  let onLayoutInfoChange = EventDispatcher()
  private var lastPayload: NSDictionary?
  private var hingeStatus: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isUserInteractionEnabled = false
    observeSystemLayout()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    publish()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    publish()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    publish()
  }

  private func observeSystemLayout() {
#if compiler(>=6.4)
    if #available(iOS 27.1, *) {
      registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) {
        (view: PersimmonDuoLayoutView, _: UITraitCollection) in
        view.publish()
      }
      addInteraction(UIHingeInteraction { [weak self] _, update in
        guard let self else { return }
        self.hingeStatus = update.hinge.map { Self.statusName($0.status) }
        self.publish()
      })
    }
#endif
  }

  private func publish() {
    guard window != nil else { return }
    let payload = NSDictionary(dictionary: layoutPayload())
    if let lastPayload, lastPayload.isEqual(payload) {
      return
    }
    lastPayload = payload
    onLayoutInfoChange(payload as? [String: Any] ?? [:])
  }

  private func layoutPayload() -> [String: Any] {
    var payload: [String: Any] = ["occlusions": [], "divisions": []]
#if compiler(>=6.4)
    if #available(iOS 27.1, *) {
      switch traitCollection.verticalBarEdge {
      case .leading:
        payload["verticalBarEdge"] = "leading"
      case .trailing:
        payload["verticalBarEdge"] = "trailing"
      default:
        break
      }
      payload["occlusions"] = reservedRegions(kind: .occlusion).map { region in
        Self.rectPayload(region.frame)
      }
      payload["divisions"] = reservedRegions(kind: .division, options: .includeInactive).map { region in
        var division = Self.rectPayload(region.frame)
        division["active"] = region.isActive
        return division
      }
    }
#endif
    if let hingeStatus {
      payload["hingeStatus"] = hingeStatus
    }
    return payload
  }

  private static func rectPayload(_ rect: CGRect) -> [String: Any] {
    [
      "x": Double(rect.minX),
      "y": Double(rect.minY),
      "width": Double(rect.width),
      "height": Double(rect.height),
    ]
  }

#if compiler(>=6.4)
  @available(iOS 27.1, *)
  private static func statusName(_ status: UIHinge.Status) -> String {
    switch status {
    case .closed:
      return "closed"
    case .partiallyOpen:
      return "partiallyOpen"
    case .fullyOpen:
      return "fullyOpen"
    default:
      return "unknown"
    }
  }
#endif
}
