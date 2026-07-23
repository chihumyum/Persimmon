import {
  BOOK_IR_VERSION,
  isTextBlock,
  logicalLength,
  type BlockIR,
  type BookIR,
  type ExternalSourceRef,
  type Size,
} from "./model";

export type BookValidationIssueCode =
  | "invalid-schema-version"
  | "missing-id"
  | "duplicate-section-id"
  | "duplicate-block-id"
  | "empty-book"
  | "empty-section"
  | "empty-text-block"
  | "empty-text-run"
  | "invalid-heading-level"
  | "missing-image-asset"
  | "invalid-image-size"
  | "invalid-asset"
  | "invalid-source";

export interface BookValidationIssue {
  code: BookValidationIssueCode;
  path: string;
  message: string;
}

export class BookValidationError extends Error {
  readonly issues: readonly BookValidationIssue[];

  constructor(issues: readonly BookValidationIssue[]) {
    super(
      `Invalid BookIR:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "BookValidationError";
    this.issues = issues;
  }
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function validateSource(
  source: ExternalSourceRef | undefined,
  path: string,
  issues: BookValidationIssue[],
): void {
  if (
    source &&
    (!hasText(source.documentId) || !hasText(source.elementId))
  ) {
    issues.push({
      code: "invalid-source",
      path,
      message: "source documentId and elementId must be non-empty",
    });
  }
}

function isPositiveSize(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

function validateBlock(
  block: BlockIR,
  path: string,
  book: BookIR,
  issues: BookValidationIssue[],
): void {
  if (!hasText(block.id)) {
    issues.push({
      code: "missing-id",
      path: `${path}.id`,
      message: "block id must be non-empty",
    });
  }

  validateSource(block.source, `${path}.source`, issues);

  if (isTextBlock(block)) {
    if (logicalLength(block) === 0) {
      issues.push({
        code: "empty-text-block",
        path,
        message: "text blocks must contain at least one UTF-16 code unit",
      });
    }

    block.runs.forEach((run, runIndex) => {
      if (run.text.length === 0) {
        issues.push({
          code: "empty-text-run",
          path: `${path}.runs[${runIndex}]`,
          message: "text runs must not be empty",
        });
      }
    });

    if (
      block.kind === "heading" &&
      (block.level < 1 || block.level > 3 || !Number.isInteger(block.level))
    ) {
      issues.push({
        code: "invalid-heading-level",
        path: `${path}.level`,
        message: "heading level must be 1, 2, or 3",
      });
    }
    return;
  }

  if (!book.assets[block.assetId]) {
    issues.push({
      code: "missing-image-asset",
      path: `${path}.assetId`,
      message: `image asset "${block.assetId}" does not exist`,
    });
  }

  if (block.intrinsicSize && !isPositiveSize(block.intrinsicSize)) {
    issues.push({
      code: "invalid-image-size",
      path: `${path}.intrinsicSize`,
      message: "image dimensions must be finite positive numbers",
    });
  }
}

export function validateBookIR(book: BookIR): readonly BookValidationIssue[] {
  const issues: BookValidationIssue[] = [];

  if (book.schemaVersion !== BOOK_IR_VERSION) {
    issues.push({
      code: "invalid-schema-version",
      path: "schemaVersion",
      message: `expected schema version ${BOOK_IR_VERSION}`,
    });
  }

  for (const [field, value] of [
    ["id", book.id],
    ["revisionId", book.revisionId],
    ["title", book.title],
  ] as const) {
    if (!hasText(value)) {
      issues.push({
        code: "missing-id",
        path: field,
        message: `${field} must be non-empty`,
      });
    }
  }

  if (book.sections.length === 0) {
    issues.push({
      code: "empty-book",
      path: "sections",
      message: "a book must contain at least one section",
    });
  }

  const sectionIds = new Set<string>();
  const blockIds = new Set<string>();

  book.sections.forEach((section, sectionIndex) => {
    const sectionPath = `sections[${sectionIndex}]`;

    if (!hasText(section.id)) {
      issues.push({
        code: "missing-id",
        path: `${sectionPath}.id`,
        message: "section id must be non-empty",
      });
    } else if (sectionIds.has(section.id)) {
      issues.push({
        code: "duplicate-section-id",
        path: `${sectionPath}.id`,
        message: `duplicate section id "${section.id}"`,
      });
    }
    sectionIds.add(section.id);

    if (section.blocks.length === 0) {
      issues.push({
        code: "empty-section",
        path: `${sectionPath}.blocks`,
        message: "sections must contain at least one block",
      });
    }

    section.blocks.forEach((block, blockIndex) => {
      const blockPath = `${sectionPath}.blocks[${blockIndex}]`;
      if (blockIds.has(block.id)) {
        issues.push({
          code: "duplicate-block-id",
          path: `${blockPath}.id`,
          message: `duplicate block id "${block.id}"`,
        });
      }
      blockIds.add(block.id);
      validateBlock(block, blockPath, book, issues);
    });
  });

  for (const [assetKey, asset] of Object.entries(book.assets)) {
    if (
      assetKey !== asset.id ||
      !hasText(asset.id) ||
      !hasText(asset.mediaType) ||
      (asset.byteLength !== undefined &&
        (!Number.isInteger(asset.byteLength) || asset.byteLength < 0))
    ) {
      issues.push({
        code: "invalid-asset",
        path: `assets.${assetKey}`,
        message:
          "asset key must match a non-empty id, mediaType must be non-empty, and byteLength must be a non-negative integer",
      });
    }
  }

  return issues;
}

export function assertValidBookIR(book: BookIR): void {
  const issues = validateBookIR(book);
  if (issues.length > 0) {
    throw new BookValidationError(issues);
  }
}
