import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSkiaPageDecoration } from "./skia-page-decoration";

const mocks = vi.hoisted(() => {
  const paragraphs: Array<{
    dispose: ReturnType<typeof vi.fn>;
    getHeight: ReturnType<typeof vi.fn>;
    layout: ReturnType<typeof vi.fn>;
  }> = [];
  const makeBuilder = () => {
    const paragraph = {
      dispose: vi.fn(),
      getHeight: vi.fn(() => 16),
      layout: vi.fn(),
    };
    paragraphs.push(paragraph);
    return {
      addText: vi.fn(),
      build: vi.fn(() => paragraph),
      dispose: vi.fn(),
    };
  };
  return { makeBuilder, paragraphs };
});

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@shopify/react-native-skia", () => ({
  FontWeight: { Normal: 400 },
  Paragraph: () => null,
  Skia: {
    Color: (color: string) => color,
    ParagraphBuilder: {
      Make: () => mocks.makeBuilder(),
    },
  },
  TextAlign: {
    Center: "center",
    Start: "start",
  },
}));

describe("native page-decoration ownership", () => {
  beforeEach(() => {
    mocks.paragraphs.length = 0;
  });

  it("does not explicitly dispose paragraphs still referenced by Skia", () => {
    const decoration = createSkiaPageDecoration({
      model: {
        sectionTitle: "章节",
        pageLabel: "5 / 12",
        percentageLabel: "42%",
        pageNumber: 5,
        pageCount: 12,
        percentage: 42,
      },
      fontProvider: {} as SkTypefaceFontProvider,
      fontFamily: "Noto Serif SC",
      width: 400,
      height: 800,
      horizontalMargin: 24,
      topInset: 0,
      bottomInset: 0,
    });

    decoration.dispose();
    decoration.dispose();

    expect(mocks.paragraphs).toHaveLength(3);
    for (const paragraph of mocks.paragraphs) {
      expect(paragraph.dispose).not.toHaveBeenCalled();
    }
  });
});
