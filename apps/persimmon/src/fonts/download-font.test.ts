import type { FontFamilyRecord } from "@persimmon/font-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadFontFamily } from "./download-font";
import { DOWNLOADABLE_FONT_CATALOG } from "./downloadable-font-catalog";
import type { FontRepository, InstallFontInput } from "./types";

class RecordingRepository implements FontRepository {
  readonly installed: InstallFontInput[] = [];

  async initialize(): Promise<void> {}
  async listFamilies(): Promise<readonly FontFamilyRecord[]> {
    return [];
  }
  async installFont(input: InstallFontInput): Promise<FontFamilyRecord> {
    this.installed.push(input);
    return {
      id: input.familyId!,
      displayName: input.displayName!,
      source: input.source,
      category: "serif",
      faces: [],
    };
  }
  async readFace(): Promise<Uint8Array | undefined> {
    return undefined;
  }
  async removeFamily(): Promise<void> {}
  async clearInstalledFonts(): Promise<void> {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("official font download", () => {
  it("offers only the selected reading families", () => {
    expect(
      DOWNLOADABLE_FONT_CATALOG.families.map((family) => ({
        id: family.id,
        displayName: family.displayName,
        category: family.category,
      })),
    ).toEqual([
      {
        id: "download:lxgw-wenkai-screen",
        displayName: "霞鹜文楷屏幕阅读版",
        category: "serif",
      },
      {
        id: "download:literata",
        displayName: "Literata",
        category: "serif",
      },
      {
        id: "download:noto-sans-mono-cjk-sc",
        displayName: "Noto Sans Mono CJK SC",
        category: "mono",
      },
    ]);
  });

  it("passes catalog integrity metadata to the repository", async () => {
    const catalogFamily = DOWNLOADABLE_FONT_CATALOG.families[1]!;
    const face = catalogFamily.faces[0]!;
    const bytes = new Uint8Array(face.byteLength);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes, { status: 200 })),
    );
    const repository = new RecordingRepository();

    await downloadFontFamily(catalogFamily, repository);

    expect(repository.installed).toHaveLength(catalogFamily.faces.length);
    expect(repository.installed[0]).toMatchObject({
      source: "downloaded",
      familyId: catalogFamily.id,
      faceId: face.id,
      displayName: catalogFamily.displayName,
      expectedSha256: face.sha256,
      expectedByteLength: face.byteLength,
    });
    expect(repository.installed.map((input) => input.faceId)).toEqual(
      catalogFamily.faces.map((candidate) => candidate.id),
    );
  });

  it("rejects a response whose declared size exceeds the pinned catalog", async () => {
    const catalogFamily = DOWNLOADABLE_FONT_CATALOG.families[0]!;
    const face = catalogFamily.faces[0]!;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(), {
            status: 200,
            headers: {
              "content-length": String(face.byteLength + 1),
            },
          }),
      ),
    );

    await expect(
      downloadFontFamily(catalogFamily, new RecordingRepository()),
    ).rejects.toMatchObject({ code: "integrity-mismatch" });
  });
});
