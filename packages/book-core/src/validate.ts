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
  | "invalid-block-style"
  | "invalid-inline-run"
  | "invalid-link-target"
  | "invalid-note-kind"
  | "missing-image-asset"
  | "missing-cover-asset"
  | "invalid-image-size"
  | "invalid-asset"
  | "invalid-source"
  | "invalid-navigation-item"
  | "invalid-navigation-target";

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
  if (source && (!hasText(source.documentId) || !hasText(source.elementId))) {
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
  blocksBySection: ReadonlyMap<string, ReadonlyMap<string, BlockIR>>,
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
  if (
    block.style &&
    ((block.style.textAlign !== undefined &&
      !["start", "center", "justify"].includes(block.style.textAlign)) ||
      (block.style.fontWeight !== undefined &&
        block.style.fontWeight !== 400 &&
        block.style.fontWeight !== 700) ||
      (block.style.fontStyle !== undefined &&
        block.style.fontStyle !== "normal" &&
        block.style.fontStyle !== "italic") ||
      (block.style.marginBeforeEm !== undefined &&
        (!Number.isFinite(block.style.marginBeforeEm) ||
          block.style.marginBeforeEm < 0 ||
          block.style.marginBeforeEm > 6)) ||
      (block.style.marginAfterEm !== undefined &&
        (!Number.isFinite(block.style.marginAfterEm) ||
          block.style.marginAfterEm < 0 ||
          block.style.marginAfterEm > 6)))
  ) {
    issues.push({
      code: "invalid-block-style",
      path: `${path}.style`,
      message: "block style contains a value outside the safe whitelist",
    });
  }

  if (isTextBlock(block)) {
    if (
      block.noteKind !== undefined &&
      block.noteKind !== "footnote" &&
      block.noteKind !== "endnote"
    ) {
      issues.push({
        code: "invalid-note-kind",
        path: `${path}.noteKind`,
        message: 'noteKind must be "footnote" or "endnote"',
      });
    }

    if (logicalLength(block) === 0) {
      issues.push({
        code: "empty-text-block",
        path,
        message: "text blocks must contain at least one UTF-16 code unit",
      });
    }

    block.runs.forEach((run, runIndex) => {
      const runPath = `${path}.runs[${runIndex}]`;
      if (run.text.length === 0) {
        issues.push({
          code: "empty-text-run",
          path: runPath,
          message: "text runs must not be empty",
        });
      }
      if (
        run.marks?.some((mark) => mark !== "strong" && mark !== "emphasis") ||
        (run.verticalAlign !== undefined &&
          run.verticalAlign !== "superscript" &&
          run.verticalAlign !== "subscript")
      ) {
        issues.push({
          code: "invalid-inline-run",
          path: runPath,
          message: "inline run contains an unsupported mark or alignment",
        });
      }

      if (run.link) {
        const targetBlock = blocksBySection
          .get(run.link.target.sectionId)
          ?.get(run.link.target.blockId);
        if (
          !["internal", "note-reference", "note-backlink"].includes(
            run.link.kind,
          ) ||
          !hasText(run.link.label) ||
          (run.link.noteKind !== undefined &&
            run.link.noteKind !== "footnote" &&
            run.link.noteKind !== "endnote") ||
          !targetBlock ||
          !Number.isInteger(run.link.target.offset) ||
          run.link.target.offset < 0 ||
          run.link.target.offset >
            (targetBlock ? logicalLength(targetBlock) : 0)
        ) {
          issues.push({
            code: "invalid-link-target",
            path: `${runPath}.link`,
            message:
              "internal links must have a label and target an existing block position",
          });
        }
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
  const blocksBySection = new Map(
    book.sections.map((section) => [
      section.id,
      new Map(section.blocks.map((block) => [block.id, block])),
    ]),
  );

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
      validateBlock(block, blockPath, book, blocksBySection, issues);
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

  if (book.coverAssetId && !book.assets[book.coverAssetId]) {
    issues.push({
      code: "missing-cover-asset",
      path: "coverAssetId",
      message: `cover asset "${book.coverAssetId}" does not exist`,
    });
  }

  const navigationIds = new Set<string>();
  const validateNavigation = (
    items: NonNullable<BookIR["navigation"]>,
    path: string,
  ): void => {
    items.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (
        !hasText(item.id) ||
        !hasText(item.label) ||
        navigationIds.has(item.id)
      ) {
        issues.push({
          code: "invalid-navigation-item",
          path: itemPath,
          message:
            "navigation id and label must be non-empty, and ids must be unique",
        });
      }
      navigationIds.add(item.id);

      const block = blocksBySection
        .get(item.target.sectionId)
        ?.get(item.target.blockId);
      if (
        !block ||
        !Number.isInteger(item.target.offset) ||
        item.target.offset < 0 ||
        item.target.offset > (block ? logicalLength(block) : 0)
      ) {
        issues.push({
          code: "invalid-navigation-target",
          path: `${itemPath}.target`,
          message: "navigation target must point inside an existing block",
        });
      }
      if (item.children) {
        validateNavigation(item.children, `${itemPath}.children`);
      }
    });
  };
  if (book.navigation) {
    validateNavigation(book.navigation, "navigation");
  }

  return issues;
}

export function assertValidBookIR(book: BookIR): void {
  const issues = validateBookIR(book);
  if (issues.length > 0) {
    throw new BookValidationError(issues);
  }
}
