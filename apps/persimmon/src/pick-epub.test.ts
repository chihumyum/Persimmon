import { beforeEach, describe, expect, it, vi } from "vitest";

const documentPicker = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock("expo-document-picker", () => documentPicker);
vi.mock("expo-file-system", () => ({
  File: class {},
}));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

import { pickEpubs } from "./pick-epub";

describe("pickEpubs", () => {
  beforeEach(() => {
    documentPicker.getDocumentAsync.mockReset();
  });

  it("enables multiple selection and exposes every selected EPUB", async () => {
    const firstBytes = new Uint8Array([1, 2]);
    const secondBytes = new Uint8Array([3, 4]);
    documentPicker.getDocumentAsync.mockResolvedValue({
      assets: [
        {
          file: { arrayBuffer: async () => firstBytes.buffer },
          name: "first.epub",
          uri: "first.epub",
        },
        {
          file: { arrayBuffer: async () => secondBytes.buffer },
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
    await expect(picked[0]?.readBytes()).resolves.toEqual(firstBytes);
    await expect(picked[1]?.readBytes()).resolves.toEqual(secondBytes);
  });

  it("returns an empty selection when the picker is cancelled", async () => {
    documentPicker.getDocumentAsync.mockResolvedValue({
      assets: null,
      canceled: true,
    });

    await expect(pickEpubs()).resolves.toEqual([]);
  });
});
