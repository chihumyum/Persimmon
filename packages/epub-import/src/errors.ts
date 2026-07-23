export type EpubImportErrorCode =
  | "invalid-input"
  | "invalid-archive"
  | "archive-limit-exceeded"
  | "unsafe-archive-path"
  | "unsupported-external-resource"
  | "invalid-mimetype"
  | "missing-container"
  | "malformed-xml"
  | "invalid-container"
  | "missing-package"
  | "invalid-package"
  | "unsupported-fixed-layout"
  | "unsupported-spine-resource"
  | "missing-spine-resource"
  | "empty-publication";

export class EpubImportError extends Error {
  readonly code: EpubImportErrorCode;
  readonly context?: string;

  constructor(
    code: EpubImportErrorCode,
    message: string,
    context?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EpubImportError";
    this.code = code;
    this.context = context;
  }
}

