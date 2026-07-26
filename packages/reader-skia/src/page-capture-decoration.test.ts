import type { PageScene, PaginationResult } from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DecodedImageCache } from "./image-cache";
import { capturePage } from "./page-capture";
import type { SkiaPageDecoration } from "./skia-page-decoration";

const mocks = vi.hoisted(() => {
  const canvas = {
    clear: vi.fn(),
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
  return { canvas, drawSkiaPageDecoration, image, surface };
});

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("@shopify/react-native-skia", () => ({
  ClipOp: { Intersect: 0 },
  Skia: {
    Color: (color: string) => color,
    Paint: () => ({
      dispose: vi.fn(),
      setColor: vi.fn(),
    }),
    Surface: {
      Make: () => mocks.surface,
      MakeOffscreen: () => mocks.surface,
    },
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
    );

    expect(capture).not.toBeNull();
    expect(mocks.canvas.scale).toHaveBeenCalledWith(2, 2);
    expect(mocks.drawSkiaPageDecoration).toHaveBeenCalledWith(
      mocks.canvas,
      decoration,
      "both",
    );
    capture?.dispose();
  });
});
