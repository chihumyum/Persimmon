import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryBookSummary } from "./library/repository";

const mocks = vi.hoisted(() => ({
  deleted: false,
  exportName: "",
  getOriginalEpub: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
  writtenBytes: undefined as Uint8Array | undefined,
}));

vi.mock("expo-file-system", () => ({
  Directory: class {
    create() {}
  },
  File: class {
    exists = false;
    readonly uri: string;

    constructor(_directory: unknown, name: string) {
      mocks.exportName = name;
      this.uri = `file:///cache/${name}`;
    }

    delete() {
      mocks.deleted = true;
      this.exists = false;
    }

    write(bytes: Uint8Array) {
      mocks.writtenBytes = bytes;
      this.exists = true;
    }
  },
  Paths: { cache: "file:///cache" },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

vi.mock("./i18n", () => ({
  translate: (key: string) => key,
}));

vi.mock("./library/repository", () => ({
  libraryRepository: { getOriginalEpub: mocks.getOriginalEpub },
}));

import { exportEpub } from "./export-epub";

const entry = {
  id: "epub:abc",
  sourceName: "Cloud Book.epub",
  title: "Cloud Book",
} as LibraryBookSummary;

describe("exportEpub", () => {
  beforeEach(() => {
    mocks.deleted = false;
    mocks.exportName = "";
    mocks.writtenBytes = undefined;
    mocks.getOriginalEpub.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.shareAsync.mockReset();
    mocks.isAvailableAsync.mockResolvedValue(true);
  });

  it("shares the original EPUB and removes the temporary file", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mocks.getOriginalEpub.mockResolvedValue(bytes);
    mocks.shareAsync.mockResolvedValue(undefined);

    await exportEpub(entry);

    expect(mocks.exportName).toBe("Cloud Book.epub");
    expect(mocks.writtenBytes).toBe(bytes);
    expect(mocks.shareAsync).toHaveBeenCalledWith(
      "file:///cache/Cloud Book.epub",
      {
        dialogTitle: "library.details.exportEpub",
        mimeType: "application/epub+zip",
        UTI: "org.idpf.epub-container",
      },
    );
    expect(mocks.deleted).toBe(true);
  });

  it("does not create an export when the original EPUB is missing", async () => {
    mocks.getOriginalEpub.mockResolvedValue(undefined);

    await expect(exportEpub(entry)).rejects.toMatchObject({
      code: "needs-reimport",
    });
    expect(mocks.shareAsync).not.toHaveBeenCalled();
    expect(mocks.writtenBytes).toBeUndefined();
  });

  it("reports unavailable platform sharing before loading the book", async () => {
    mocks.isAvailableAsync.mockResolvedValue(false);

    await expect(exportEpub(entry)).rejects.toThrow(
      "errors.library.exportUnavailable",
    );
    expect(mocks.getOriginalEpub).not.toHaveBeenCalled();
  });
});
