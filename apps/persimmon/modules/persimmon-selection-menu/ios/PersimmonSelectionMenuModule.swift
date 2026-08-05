import ExpoModulesCore
import SwiftUI
import UIKit

final class PersimmonReaderTypographyPickerView: ExpoView, UIPickerViewDataSource, UIPickerViewDelegate {
  private static let componentCount = 4
  let onValueChange = EventDispatcher()
  private let labels = (0..<componentCount).map { _ in UILabel() }
  private let labelStack = UIStackView()
  private let picker = UIPickerView()
  private var values = Array(repeating: [String](), count: componentCount)
  private var requestedIndices = Array(repeating: 0, count: componentCount)
  private var updatingFromProps = false
  private var textColor = UIColor.label

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    labelStack.axis = .horizontal
    labelStack.alignment = .fill
    labelStack.distribution = .fillEqually
    labelStack.spacing = 0

    for label in labels {
      label.adjustsFontForContentSizeCategory = true
      label.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
      label.textAlignment = .center
      label.numberOfLines = 0
      label.lineBreakMode = .byWordWrapping
      label.adjustsFontSizeToFitWidth = false
      labelStack.addArrangedSubview(label)
    }

    picker.dataSource = self
    picker.delegate = self
    addSubview(labelStack)
    addSubview(picker)
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    let labelHeight = min(48, bounds.height)
    picker.frame = CGRect(
      x: 0,
      y: 0,
      width: bounds.width,
      height: max(0, bounds.height - labelHeight)
    )
    labelStack.frame = CGRect(
      x: 0,
      y: max(0, bounds.height - labelHeight),
      width: bounds.width,
      height: labelHeight
    )
  }

  func updateLabels(_ nextLabels: [String]) {
    for component in labels.indices {
      labels[component].text = nextLabels.indices.contains(component)
        ? nextLabels[component]
        : nil
    }
  }

  func updateLabelColor(_ color: UIColor) {
    labels.forEach { $0.textColor = color }
  }

  func updateLabelFontSize(_ size: Double) {
    labels.forEach {
      $0.font = UIFont.systemFont(ofSize: CGFloat(size), weight: .medium)
    }
    setNeedsLayout()
  }

  func updateValues(_ nextValues: [String], component: Int) {
    guard values.indices.contains(component), values[component] != nextValues else {
      return
    }
    values[component] = nextValues
    picker.reloadComponent(component)
    applyRequestedIndices(animated: false)
  }

  func updateSelectedIndices(_ nextIndices: [Int]) {
    for component in requestedIndices.indices {
      requestedIndices[component] = nextIndices.indices.contains(component)
        ? nextIndices[component]
        : 0
    }
    applyRequestedIndices(animated: false)
  }

  func updateTextColor(_ color: UIColor) {
    textColor = color
    picker.reloadAllComponents()
    applyRequestedIndices(animated: false)
  }

  private func applyRequestedIndices(animated: Bool) {
    updatingFromProps = true
    for component in values.indices where !values[component].isEmpty {
      let boundedIndex = min(
        max(requestedIndices[component], 0),
        values[component].count - 1
      )
      if picker.selectedRow(inComponent: component) != boundedIndex {
        picker.selectRow(boundedIndex, inComponent: component, animated: animated)
      }
    }
    updatingFromProps = false
  }

  func numberOfComponents(in pickerView: UIPickerView) -> Int {
    Self.componentCount
  }

  func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
    values.indices.contains(component) ? values[component].count : 0
  }

  func pickerView(
    _ pickerView: UIPickerView,
    attributedTitleForRow row: Int,
    forComponent component: Int
  ) -> NSAttributedString? {
    guard
      values.indices.contains(component),
      values[component].indices.contains(row)
    else {
      return nil
    }
    return NSAttributedString(
      string: values[component][row],
      attributes: [.foregroundColor: textColor]
    )
  }

  func pickerView(_ pickerView: UIPickerView, widthForComponent component: Int) -> CGFloat {
    max(1, pickerView.bounds.width / CGFloat(Self.componentCount))
  }

  func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
    guard requestedIndices.indices.contains(component) else {
      return
    }
    requestedIndices[component] = row
    guard !updatingFromProps else {
      return
    }
    onValueChange(["component": component, "index": row])
  }
}

@MainActor
private final class PersimmonSegmentedControlModel: ObservableObject {
  @Published var options = [String]()
  @Published var selectedIndex = 0
  @Published var normalTextColor = UIColor.label
  @Published var selectedTextColor = UIColor.label
  @Published var unselectedBackgroundColor = UIColor.clear
  @Published var selectedBackgroundColor = UIColor.secondarySystemBackground
  @Published var fontSize: CGFloat = 17
  var onSelect: ((Int) -> Void)?

  func select(_ index: Int) {
    guard options.indices.contains(index) else {
      return
    }
    selectedIndex = index
    onSelect?(index)
  }
}

@MainActor
private struct PersimmonNativeSegmentedControl: View {
  @ObservedObject var model: PersimmonSegmentedControlModel

  var body: some View {
    Group {
      if #available(iOS 26.0, *) {
        liquidGlassControl
      } else {
        fallbackControl
      }
    }
    .background(Color(uiColor: model.unselectedBackgroundColor))
    .clipShape(Capsule())
  }

  @available(iOS 26.0, *)
  private var liquidGlassControl: some View {
    GeometryReader { geometry in
      let segmentWidth = geometry.size.width / CGFloat(max(model.options.count, 1))

      ZStack(alignment: .leading) {
        GlassEffectContainer(spacing: 0) {
          Capsule()
            .fill(.clear)
            .frame(
              width: max(0, segmentWidth),
              height: max(0, geometry.size.height)
            )
            .glassEffect(
              .regular.interactive(),
              in: Capsule()
            )
            .offset(
              x: CGFloat(max(model.selectedIndex, 0)) * segmentWidth,
              y: 0
            )
            .animation(.snappy(duration: 0.3, extraBounce: 0), value: model.selectedIndex)
            .allowsHitTesting(false)
        }

        optionButtons
          .zIndex(1)
      }
    }
  }

  private var fallbackControl: some View {
    GeometryReader { geometry in
      let segmentWidth = geometry.size.width / CGFloat(max(model.options.count, 1))

      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color(uiColor: model.selectedBackgroundColor))
          .frame(
            width: max(0, segmentWidth),
            height: max(0, geometry.size.height)
          )
          .offset(
            x: CGFloat(max(model.selectedIndex, 0)) * segmentWidth,
            y: 0
          )
          .shadow(color: .black.opacity(0.08), radius: 1.5, y: 1)
          .animation(.easeInOut(duration: 0.22), value: model.selectedIndex)
          .allowsHitTesting(false)

        optionButtons
      }
    }
  }

  private var optionButtons: some View {
    HStack(spacing: 0) {
      ForEach(Array(model.options.enumerated()), id: \.offset) { index, title in
        Button {
          model.select(index)
        } label: {
          Text(title)
            .font(.system(size: model.fontSize, weight: index == model.selectedIndex ? .semibold : .medium))
            .foregroundStyle(
              Color(
                uiColor: index == model.selectedIndex
                  ? model.selectedTextColor
                  : model.normalTextColor
              )
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(index == model.selectedIndex ? .isSelected : [])
      }
    }
  }
}

final class PersimmonReaderSegmentedControlView: ExpoView {
  let onValueChange = EventDispatcher()
  private let model: PersimmonSegmentedControlModel
  private let hostingController: UIHostingController<PersimmonNativeSegmentedControl>

  required init(appContext: AppContext? = nil) {
    let model = PersimmonSegmentedControlModel()
    self.model = model
    hostingController = UIHostingController(
      rootView: PersimmonNativeSegmentedControl(model: model)
    )
    super.init(appContext: appContext)

    backgroundColor = .clear
    hostingController.view.backgroundColor = .clear
    addSubview(hostingController.view)
    model.onSelect = { [weak self] index in
      self?.onValueChange(["index": index])
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController.view.frame = bounds
  }

  func updateOptions(_ options: [String]) {
    guard model.options != options else {
      return
    }
    model.options = options
    if !options.indices.contains(model.selectedIndex) {
      model.selectedIndex = 0
    }
  }

  func updateSelectedIndex(_ index: Int) {
    guard model.selectedIndex != index else {
      return
    }
    model.selectedIndex = index
  }

  func updateUnselectedBackgroundColor(_ color: UIColor) {
    model.unselectedBackgroundColor = color
  }

  func updateSelectedBackgroundColor(_ color: UIColor) {
    model.selectedBackgroundColor = color
  }

  func updateNormalTextColor(_ color: UIColor) {
    model.normalTextColor = color
  }

  func updateSelectedTextColor(_ color: UIColor) {
    model.selectedTextColor = color
  }

  func updateFontSize(_ size: Double) {
    model.fontSize = CGFloat(size)
  }
}

final class PersimmonReaderSwitchRowView: ExpoView {
  let onValueChange = EventDispatcher()
  private let titleLabel = UILabel()
  private let descriptionLabel = UILabel()
  private let switchControl = UISwitch()
  private var offTrackColor = UIColor.secondarySystemFill
  private var horizontalInset: CGFloat = 16

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.font = UIFont.systemFont(ofSize: 17, weight: .medium)
    titleLabel.numberOfLines = 1
    descriptionLabel.adjustsFontForContentSizeCategory = true
    descriptionLabel.font = UIFont.systemFont(ofSize: 13, weight: .regular)
    descriptionLabel.numberOfLines = 1
    switchControl.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    addSubview(titleLabel)
    addSubview(descriptionLabel)
    addSubview(switchControl)
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    switchControl.sizeToFit()
    let switchSize = switchControl.bounds.size
    let switchX = max(horizontalInset, bounds.width - horizontalInset - switchSize.width)
    switchControl.frame = CGRect(
      x: switchX,
      y: (bounds.height - switchSize.height) / 2,
      width: switchSize.width,
      height: switchSize.height
    )
    let copyWidth = max(0, switchX - horizontalInset - 12)
    if descriptionLabel.isHidden {
      titleLabel.frame = CGRect(
        x: horizontalInset,
        y: 0,
        width: copyWidth,
        height: bounds.height
      )
      descriptionLabel.frame = .zero
    } else {
      let titleHeight: CGFloat = 23
      let descriptionHeight: CGFloat = 19
      let gap: CGFloat = 2
      let copyHeight = titleHeight + gap + descriptionHeight
      let copyY = max(0, (bounds.height - copyHeight) / 2)
      titleLabel.frame = CGRect(
        x: horizontalInset,
        y: copyY,
        width: copyWidth,
        height: titleHeight
      )
      descriptionLabel.frame = CGRect(
        x: horizontalInset,
        y: copyY + titleHeight + gap,
        width: copyWidth,
        height: descriptionHeight
      )
    }
    applyOffTrackColor()
  }

  func updateLabel(_ label: String) {
    titleLabel.text = label
  }

  func updateDescription(_ description: String) {
    descriptionLabel.text = description
    descriptionLabel.isHidden = description.isEmpty
    setNeedsLayout()
  }

  func updateHorizontalInset(_ inset: Double) {
    horizontalInset = CGFloat(inset)
    setNeedsLayout()
  }

  func updateLabelFontSize(_ size: Double) {
    titleLabel.font = UIFont.systemFont(ofSize: CGFloat(size), weight: .medium)
    setNeedsLayout()
  }

  func updateDescriptionFontSize(_ size: Double) {
    descriptionLabel.font = UIFont.systemFont(ofSize: CGFloat(size), weight: .regular)
    setNeedsLayout()
  }

  func updateValue(_ value: Bool) {
    if switchControl.isOn != value {
      switchControl.setOn(value, animated: false)
    }
    applyOffTrackColor()
  }

  func updateEnabled(_ enabled: Bool) {
    switchControl.isEnabled = enabled
    // Keep the row typography aligned with the other switch rows. UIKit
    // already communicates the disabled state through the switch itself;
    // dimming the labels made this one row look like a different text style.
    titleLabel.alpha = 1
    descriptionLabel.alpha = 1
  }

  func updateTextColor(_ color: UIColor) {
    titleLabel.textColor = color
  }

  func updateSecondaryTextColor(_ color: UIColor) {
    descriptionLabel.textColor = color
  }

  func updateAccentColor(_ color: UIColor) {
    switchControl.onTintColor = color
  }

  func updateOffTrackColor(_ color: UIColor) {
    offTrackColor = color
    applyOffTrackColor()
  }

  func updateThumbColor(_ color: UIColor) {
    switchControl.thumbTintColor = color
  }

  private func applyOffTrackColor() {
    switchControl.tintColor = offTrackColor
    switchControl.backgroundColor = switchControl.isOn ? .clear : offTrackColor
    switchControl.layer.cornerRadius = switchControl.bounds.height / 2
    switchControl.clipsToBounds = true
  }

  @objc private func valueChanged() {
    applyOffTrackColor()
    onValueChange(["value": switchControl.isOn])
  }
}

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

    View(PersimmonReaderTypographyPickerView.self) {
      Events("onValueChange")

      Prop("fontSizeValues") { (view: PersimmonReaderTypographyPickerView, values: [String]) in
        view.updateValues(values, component: 0)
      }

      Prop("lineHeightValues") { (view: PersimmonReaderTypographyPickerView, values: [String]) in
        view.updateValues(values, component: 1)
      }

      Prop("paragraphSpacingValues") { (view: PersimmonReaderTypographyPickerView, values: [String]) in
        view.updateValues(values, component: 2)
      }

      Prop("horizontalMarginValues") { (view: PersimmonReaderTypographyPickerView, values: [String]) in
        view.updateValues(values, component: 3)
      }

      Prop("selectedIndices") { (view: PersimmonReaderTypographyPickerView, indices: [Int]) in
        view.updateSelectedIndices(indices)
      }

      Prop("labels") { (view: PersimmonReaderTypographyPickerView, labels: [String]) in
        view.updateLabels(labels)
      }

      Prop("labelColor") { (view: PersimmonReaderTypographyPickerView, color: UIColor) in
        view.updateLabelColor(color)
      }

      Prop("labelFontSize") { (view: PersimmonReaderTypographyPickerView, size: Double) in
        view.updateLabelFontSize(size)
      }

      Prop("textColor") { (view: PersimmonReaderTypographyPickerView, color: UIColor) in
        view.updateTextColor(color)
      }

    }

    View(PersimmonReaderSegmentedControlView.self) {
      Events("onValueChange")

      Prop("options") { (view: PersimmonReaderSegmentedControlView, options: [String]) in
        view.updateOptions(options)
      }

      Prop("selectedIndex") { (view: PersimmonReaderSegmentedControlView, index: Int) in
        view.updateSelectedIndex(index)
      }

      Prop("unselectedBackgroundColor") { (view: PersimmonReaderSegmentedControlView, color: UIColor) in
        view.updateUnselectedBackgroundColor(color)
      }

      Prop("selectedBackgroundColor") { (view: PersimmonReaderSegmentedControlView, color: UIColor) in
        view.updateSelectedBackgroundColor(color)
      }

      Prop("textColor") { (view: PersimmonReaderSegmentedControlView, color: UIColor) in
        view.updateNormalTextColor(color)
      }

      Prop("selectedTextColor") { (view: PersimmonReaderSegmentedControlView, color: UIColor) in
        view.updateSelectedTextColor(color)
      }

      Prop("fontSize") { (view: PersimmonReaderSegmentedControlView, size: Double) in
        view.updateFontSize(size)
      }
    }

    View(PersimmonReaderSwitchRowView.self) {
      Events("onValueChange")

      Prop("label") { (view: PersimmonReaderSwitchRowView, label: String) in
        view.updateLabel(label)
      }

      Prop("descriptionText") { (view: PersimmonReaderSwitchRowView, description: String) in
        view.updateDescription(description)
      }

      Prop("horizontalInset") { (view: PersimmonReaderSwitchRowView, inset: Double) in
        view.updateHorizontalInset(inset)
      }

      Prop("labelFontSize") { (view: PersimmonReaderSwitchRowView, size: Double) in
        view.updateLabelFontSize(size)
      }

      Prop("descriptionFontSize") { (view: PersimmonReaderSwitchRowView, size: Double) in
        view.updateDescriptionFontSize(size)
      }

      Prop("value") { (view: PersimmonReaderSwitchRowView, value: Bool) in
        view.updateValue(value)
      }

      Prop("enabled") { (view: PersimmonReaderSwitchRowView, enabled: Bool) in
        view.updateEnabled(enabled)
      }

      Prop("textColor") { (view: PersimmonReaderSwitchRowView, color: UIColor) in
        view.updateTextColor(color)
      }

      Prop("secondaryTextColor") { (view: PersimmonReaderSwitchRowView, color: UIColor) in
        view.updateSecondaryTextColor(color)
      }

      Prop("accentColor") { (view: PersimmonReaderSwitchRowView, color: UIColor) in
        view.updateAccentColor(color)
      }

      Prop("offTrackColor") { (view: PersimmonReaderSwitchRowView, color: UIColor) in
        view.updateOffTrackColor(color)
      }

      Prop("thumbColor") { (view: PersimmonReaderSwitchRowView, color: UIColor) in
        view.updateThumbColor(color)
      }
    }

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
