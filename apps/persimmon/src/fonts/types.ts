import type {
  FontFamilyRecord,
  FontLicense,
  FontSource,
} from "@persimmon/font-core";

export interface InstallFontInput {
  readonly bytes: Uint8Array;
  readonly source: Exclude<FontSource, "bundled">;
  readonly familyId?: string;
  readonly faceId?: string;
  readonly displayName?: string;
  readonly license?: FontLicense;
  readonly expectedSha256?: string;
  readonly expectedByteLength?: number;
}

export type FontRepositoryErrorCode =
  | "font-not-found"
  | "invalid-font"
  | "integrity-mismatch"
  | "storage-full";

export class FontRepositoryError extends Error {
  constructor(
    readonly code: FontRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FontRepositoryError";
  }
}

export interface FontRepository {
  initialize(): Promise<void>;
  listFamilies(): Promise<readonly FontFamilyRecord[]>;
  installFont(input: InstallFontInput): Promise<FontFamilyRecord>;
  readFace(faceId: string): Promise<Uint8Array | undefined>;
  removeFamily(familyId: string): Promise<void>;
}
