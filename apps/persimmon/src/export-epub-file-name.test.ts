import { describe, expect, it } from "vitest";

import { epubExportFileName } from "./export-epub-file-name";

describe("epubExportFileName", () => {
  it("preserves the original EPUB name", () => {
    expect(
      epubExportFileName({
        sourceName: "The Left Hand of Darkness.EPUB",
        title: "Left Hand",
      }),
    ).toBe("The Left Hand of Darkness.epub");
  });

  it("sanitizes path separators and reserved filename characters", () => {
    expect(
      epubExportFileName({
        sourceName: "folder/Book: Part 1?*.epub",
        title: "Book",
      }),
    ).toBe("folder_Book_ Part 1__.epub");
  });

  it("falls back to the title for legacy source labels", () => {
    expect(
      epubExportFileName({ sourceName: "旧版导入", title: "红楼梦" }),
    ).toBe("红楼梦.epub");
  });
});
