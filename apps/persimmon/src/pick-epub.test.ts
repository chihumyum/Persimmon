import { beforeEach, describe, expect, it, vi } from "vitest";

const documentPicker = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
}));
const fileBytes = vi.hoisted(
  () =>
    new Map<string, Uint8Array>([
      ["first.epub", new Uint8Array([1, 2])],
      ["second.epub", new Uint8Array([3, 4])],
    ]),
);

vi.mock("expo-document-picker", () => documentPicker);
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(private readonly uri: string) {}

    async bytes() {
      return fileBytes.get(this.uri);
    }
  },
}));

import { pickEpubs } from "./pick-epub";

describe("pickEpubs", () => {
  beforeEach(() => {
    documentPicker.getDocumentAsync.mockReset();
  });

  it("enables multiple selection and exposes every selected EPUB", async () => {
    documentPicker.getDocumentAsync.mockResolvedValue({
      assets: [
        {
          name: "first.epub",
          uri: "first.epub",
        },
        {
          name: "second.epub",
          uri: "second.epub",
        },
      ],
      canceled: false,
    });

    const picked = await pickEpubs();

    expect(documentPicker.getDocumentAsync).toHaveBeenCalledWith({
      base64: false,
      copyToCacheDirectory: true,
      multiple: true,
      type: "application/epub+zip",
    });
    expect(picked.map(({ fileName }) => fileName)).toEqual([
      "first.epub",
      "second.epub",
    ]);
    await expect(picked[0]?.readBytes()).resolves.toEqual(
      fileBytes.get("first.epub"),
    );
    await expect(picked[1]?.readBytes()).resolves.toEqual(
      fileBytes.get("second.epub"),
    );
  });

  it("returns an empty selection when the picker is cancelled", async () => {
    documentPicker.getDocumentAsync.mockResolvedValue({
      assets: null,
      canceled: true,
    });

    await expect(pickEpubs()).resolves.toEqual([]);
  });
});
