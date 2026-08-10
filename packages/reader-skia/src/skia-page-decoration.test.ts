import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSkiaPageDecoration } from "./skia-page-decoration";

const mocks = vi.hoisted(() => {
  const paragraphStyles: unknown[] = [];
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
  return { makeBuilder, paragraphStyles, paragraphs };
});

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@shopify/react-native-skia", () => ({
  FontWeight: { Normal: 400 },
  Paragraph: () => null,
  Skia: {
    Color: (color: string) => color,
    ParagraphBuilder: {
      Make: (style: unknown) => {
        mocks.paragraphStyles.push(style);
        return mocks.makeBuilder();
      },
    },
  },
  TextAlign: {
    Center: "center",
    Start: "start",
  },
}));

describe("native page-decoration ownership", () => {
  beforeEach(() => {
    mocks.paragraphStyles.length = 0;
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
      inlineMargin: 24,
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

  it("explicitly disposes paragraphs after the whole Canvas retires", () => {
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
      inlineMargin: 24,
      topInset: 0,
      bottomInset: 0,
    });

    decoration.retire();
    decoration.retire();

    for (const paragraph of mocks.paragraphs) {
      expect(paragraph.dispose).toHaveBeenCalledOnce();
    }
  });

  it("centers the single-page header and footer on the viewport axis", () => {
    const decoration = createSkiaPageDecoration({
      model: {
        sectionTitle: "章节",
        pageLabel: "5",
        percentageLabel: "42%",
        pageNumber: 5,
        pageCount: 12,
        percentage: 42,
      },
      fontProvider: {} as SkTypefaceFontProvider,
      fontFamily: "Noto Serif SC",
      width: 400,
      height: 800,
      inlineMargin: 24,
      topInset: 0,
      bottomInset: 0,
    });

    expect(decoration.headerTitle).toMatchObject({ x: 24, width: 352 });
    expect(decoration.footerPage).toMatchObject({ x: 24, width: 352 });
    expect(decoration.footerPercentage).toMatchObject({ x: 24, width: 352 });
    expect(mocks.paragraphStyles).toEqual([
      expect.objectContaining({ textAlign: "center" }),
      expect.objectContaining({ textAlign: "center" }),
      expect.objectContaining({ textAlign: "center" }),
    ]);
  });

  it("centers one header and footer across the complete spread", () => {
    const decoration = createSkiaPageDecoration({
      model: {
        sectionTitle: "章节",
        pageLabel: "5",
        percentageLabel: "42%",
        pageNumber: 5,
        pageCount: 12,
        percentage: 42,
      },
      fontProvider: {} as SkTypefaceFontProvider,
      fontFamily: "Noto Serif SC",
      width: 800,
      height: 800,
      inlineMargin: 24,
      pagesPerView: 2,
      topInset: 0,
      bottomInset: 0,
    });

    expect(decoration.headerTitle).toMatchObject({ x: 24, width: 752 });
    expect(decoration.footerPage).toMatchObject({ x: 24, width: 752 });
    expect(decoration.footerPercentage).toMatchObject({ x: 24, width: 752 });
    expect(mocks.paragraphStyles).toEqual([
      expect.objectContaining({ textAlign: "center" }),
      expect.objectContaining({ textAlign: "center" }),
      expect.objectContaining({ textAlign: "center" }),
    ]);
  });
});
