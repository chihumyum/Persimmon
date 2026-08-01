import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

private let canvasSize = 1024
private let safeZoneSize: CGFloat = 620

private struct IconLayer {
  let image: CGImage
  let sourceRect: CGRect
}

private enum IconGenerationError: Error, CustomStringConvertible {
  case invalidIconJSON(String)
  case invalidImage(String)
  case renderingFailed
  case writingFailed(String)

  var description: String {
    switch self {
    case .invalidIconJSON(let detail):
      return "Invalid Icon Composer data: \(detail)"
    case .invalidImage(let path):
      return "Could not load image: \(path)"
    case .renderingFailed:
      return "Could not create a bitmap rendering context"
    case .writingFailed(let path):
      return "Could not write PNG: \(path)"
    }
  }
}

private func dictionary(_ value: Any?, named name: String) throws -> [String: Any] {
  guard let result = value as? [String: Any] else {
    throw IconGenerationError.invalidIconJSON(name)
  }
  return result
}

private func array(_ value: Any?, named name: String) throws -> [Any] {
  guard let result = value as? [Any] else {
    throw IconGenerationError.invalidIconJSON(name)
  }
  return result
}

private func number(_ value: Any?, named name: String) throws -> CGFloat {
  guard let result = value as? NSNumber else {
    throw IconGenerationError.invalidIconJSON(name)
  }
  return CGFloat(truncating: result)
}

private func loadImage(at url: URL) throws -> CGImage {
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw IconGenerationError.invalidImage(url.path)
  }
  return image
}

private func makeContext() throws -> CGContext {
  guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
    throw IconGenerationError.renderingFailed
  }
  guard
    let context = CGContext(
      data: nil,
      width: canvasSize,
      height: canvasSize,
      bitsPerComponent: 8,
      bytesPerRow: canvasSize * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
  else {
    throw IconGenerationError.renderingFailed
  }
  context.interpolationQuality = .high
  return context
}

private func drawTopLeft(_ image: CGImage, in rect: CGRect, context: CGContext) {
  let coreGraphicsRect = CGRect(
    x: rect.minX,
    y: CGFloat(canvasSize) - rect.maxY,
    width: rect.width,
    height: rect.height
  )
  context.draw(image, in: coreGraphicsRect)
}

private func writePNG(_ image: CGImage, to url: URL) throws {
  guard
    let destination = CGImageDestinationCreateWithURL(
      url as CFURL,
      UTType.png.identifier as CFString,
      1,
      nil
    )
  else {
    throw IconGenerationError.writingFailed(url.path)
  }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else {
    throw IconGenerationError.writingFailed(url.path)
  }
}

private func parseBackgroundColor(_ value: String) throws -> CGColor {
  let prefix = "display-p3:"
  guard value.hasPrefix(prefix) else {
    throw IconGenerationError.invalidIconJSON("fill.automatic-gradient")
  }
  let components = value.dropFirst(prefix.count).split(separator: ",").compactMap {
    Double($0.trimmingCharacters(in: .whitespaces))
  }
  guard components.count == 4 else {
    throw IconGenerationError.invalidIconJSON("fill.automatic-gradient components")
  }
  guard
    let displayP3 = CGColorSpace(name: CGColorSpace.displayP3),
    let sRGB = CGColorSpace(name: CGColorSpace.sRGB),
    let color = CGColor(colorSpace: displayP3, components: components.map { CGFloat($0) }),
    let converted = color.converted(to: sRGB, intent: .relativeColorimetric, options: nil)
  else {
    throw IconGenerationError.invalidIconJSON("fill.automatic-gradient color space")
  }
  return converted
}

private func hexColor(_ color: CGColor) -> String {
  guard let components = color.components, components.count >= 3 else {
    return "#FF6910"
  }
  let channels = components.prefix(3).map {
    Int((min(max($0, 0), 1) * 255).rounded())
  }
  return channels.map { String(format: "%02X", $0) }.reduce("#", +)
}

private func run() throws {
  let scriptURL = URL(fileURLWithPath: #filePath)
  let appRoot = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
  let iconRoot = appRoot.appendingPathComponent("assets/icons/persimmon.icon")
  let outputRoot = appRoot.appendingPathComponent("assets/icons/android")
  let jsonURL = iconRoot.appendingPathComponent("icon.json")

  let json = try JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL))
  let root = try dictionary(json, named: "root")
  let fill = try dictionary(root["fill"], named: "fill")
  guard let fillValue = fill["automatic-gradient"] as? String else {
    throw IconGenerationError.invalidIconJSON("fill.automatic-gradient")
  }
  let backgroundColor = try parseBackgroundColor(fillValue)

  let groups = try array(root["groups"], named: "groups")
  guard let firstGroupValue = groups.first else {
    throw IconGenerationError.invalidIconJSON("groups[0]")
  }
  let firstGroup = try dictionary(firstGroupValue, named: "groups[0]")
  let layerValues = try array(firstGroup["layers"], named: "groups[0].layers")

  var layers: [IconLayer] = []
  var groupBounds = CGRect.null
  for (index, layerValue) in layerValues.enumerated() {
    let layer = try dictionary(layerValue, named: "layer[\(index)]")
    guard let imageName = layer["image-name"] as? String else {
      throw IconGenerationError.invalidIconJSON("layer[\(index)].image-name")
    }
    let position = try dictionary(layer["position"], named: "layer[\(index)].position")
    let scale = try number(position["scale"], named: "layer[\(index)].position.scale")
    let translations = try array(
      position["translation-in-points"],
      named: "layer[\(index)].position.translation-in-points"
    )
    guard translations.count == 2 else {
      throw IconGenerationError.invalidIconJSON(
        "layer[\(index)].position.translation-in-points count"
      )
    }
    let translationX = try number(translations[0], named: "layer[\(index)].translation.x")
    let translationY = try number(translations[1], named: "layer[\(index)].translation.y")
    let image = try loadImage(at: iconRoot.appendingPathComponent("Assets/\(imageName)"))
    let width = CGFloat(image.width) * scale
    let height = CGFloat(image.height) * scale
    let centerX = CGFloat(canvasSize) / 2 + translationX
    let centerY = CGFloat(canvasSize) / 2 + translationY
    let rect = CGRect(
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height
    )
    layers.append(IconLayer(image: image, sourceRect: rect))
    groupBounds = groupBounds.union(rect)
  }

  let androidScale = min(safeZoneSize / groupBounds.width, safeZoneSize / groupBounds.height)
  let sourceCenter = CGPoint(x: groupBounds.midX, y: groupBounds.midY)
  let destinationCenter = CGPoint(x: CGFloat(canvasSize) / 2, y: CGFloat(canvasSize) / 2)
  let foregroundContext = try makeContext()
  foregroundContext.clear(CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize))

  for layer in layers {
    let sourceLayerCenter = CGPoint(x: layer.sourceRect.midX, y: layer.sourceRect.midY)
    let destinationLayerCenter = CGPoint(
      x: destinationCenter.x + (sourceLayerCenter.x - sourceCenter.x) * androidScale,
      y: destinationCenter.y + (sourceLayerCenter.y - sourceCenter.y) * androidScale
    )
    let destinationRect = CGRect(
      x: destinationLayerCenter.x - layer.sourceRect.width * androidScale / 2,
      y: destinationLayerCenter.y - layer.sourceRect.height * androidScale / 2,
      width: layer.sourceRect.width * androidScale,
      height: layer.sourceRect.height * androidScale
    )
    drawTopLeft(layer.image, in: destinationRect, context: foregroundContext)
  }

  guard let foregroundImage = foregroundContext.makeImage() else {
    throw IconGenerationError.renderingFailed
  }

  let backgroundContext = try makeContext()
  backgroundContext.setFillColor(backgroundColor)
  backgroundContext.fill(CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize))
  guard let backgroundImage = backgroundContext.makeImage() else {
    throw IconGenerationError.renderingFailed
  }

  try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)
  try writePNG(backgroundImage, to: outputRoot.appendingPathComponent("app-icon-background.png"))
  try writePNG(foregroundImage, to: outputRoot.appendingPathComponent("app-icon-foreground.png"))
  try writePNG(foregroundImage, to: outputRoot.appendingPathComponent("app-icon-monochrome.png"))

  print("Generated Android icons in \(outputRoot.path)")
  print("Background color: \(hexColor(backgroundColor))")
  print("Foreground bounds: \(Int(safeZoneSize))x\(Int(safeZoneSize)) safe zone")
}

do {
  try run()
} catch {
  fputs("error: \(error)\n", stderr)
  exit(1)
}
