import type { PageScene, PaginationResult } from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DecodedImageCache } from "./image-cache";
import { capturePage } from "./page-capture";
import type { SkiaPageDecoration } from "./skia-page-decoration";

const mocks = vi.hoisted(() => {
  const canvas = {
    clear: vi.fn(),
    drawPicture: vi.fn(),
    scale: vi.fn(),
  };
  const image = {
    dispose: vi.fn(),
    makeNonTextureImage: vi.fn(() => null),
  };
  const surface = {
    dispose: vi.fn(),
    flush: vi.fn(),
    getCanvas: vi.fn(() => canvas),
    makeImageSnapshot: vi.fn(() => image),
  };
  const drawSkiaPageDecoration = vi.fn();
  const picture = { dispose: vi.fn() };
  const recorder = {
    beginRecording: vi.fn(() => canvas),
    dispose: vi.fn(),
    finishRecordingAsPicture: vi.fn(() => picture),
  };
  return {
    canvas,
    drawSkiaPageDecoration,
    image,
    picture,
    recorder,
    surface,
  };
});

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@shopify/react-native-skia", () => ({
  ClipOp: { Intersect: 0 },
  Skia: {
    Color: (color: string) => color,
    Paint: () => ({
      dispose: vi.fn(),
      setColor: vi.fn(),
    }),
    PictureRecorder: () => mocks.recorder,
    Surface: {
      Make: () => mocks.surface,
      MakeOffscreen: () => mocks.surface,
    },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
  },
}));
vi.mock("./skia-page-decoration", () => ({
  drawSkiaPageDecoration: mocks.drawSkiaPageDecoration,
}));

describe("transition page decoration capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bakes the requested header and footer into the page texture", () => {
    const page = {
      items: [],
    } as unknown as PageScene;
    const pagination = {
      paragraphs: new Map(),
    } as unknown as PaginationResult<SkParagraph>;
    const imageCache = {
      getStatus: vi.fn(),
    } as unknown as DecodedImageCache;
    const decoration = {} as SkiaPageDecoration;

    const capture = capturePage(
      page,
      pagination,
      imageCache,
      400,
      800,
      2,
      false,
      decoration,
      "both",
      "toolbar",
      undefined,
      -400,
    );

    expect(capture).not.toBeNull();
    expect(mocks.canvas.scale).toHaveBeenCalledWith(2, 2);
    expect(mocks.drawSkiaPageDecoration).toHaveBeenCalledWith(
      mocks.canvas,
      decoration,
      "both",
      "toolbar",
      -400,
    );
    capture?.dispose();
  });
});
