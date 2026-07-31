export interface SectionPageCountCacheOptions {
  readonly retainedPageCountFor: (sectionIndex: number) => number | undefined;
  readonly countUnretainedSection: (sectionIndex: number) => number;
}

/**
 * Keeps exact publication page counts without retaining a second copy of each
 * section's SkParagraph graph.
 *
 * Visible pagination remains owned by the reader cache. Sections that are not
 * visible are counted through the layout engine's count-only path, which
 * releases native paragraph handles as soon as each block has been measured.
 */
export class SectionPageCountCache {
  readonly #counts = new Map<number, number>();
  readonly #options: SectionPageCountCacheOptions;

  constructor(options: SectionPageCountCacheOptions) {
    this.#options = options;
  }

  resolvedCountFor(sectionIndex: number): number | undefined {
    const retainedPageCount = this.#options.retainedPageCountFor(sectionIndex);
    if (retainedPageCount !== undefined) {
      const count = normalizedPageCount(retainedPageCount);
      this.#counts.set(sectionIndex, count);
      return count;
    }
    return this.#counts.get(sectionIndex);
  }

  countFor(sectionIndex: number): number {
    const cached = this.resolvedCountFor(sectionIndex);
    if (cached !== undefined) {
      return cached;
    }

    const count = normalizedPageCount(
      this.#options.countUnretainedSection(sectionIndex),
    );
    this.#counts.set(sectionIndex, count);
    return count;
  }
}

function normalizedPageCount(pageCount: number): number {
  return Math.max(1, Math.floor(pageCount));
}
