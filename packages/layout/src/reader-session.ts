export interface TurnTransition {
  id: string;
  generation: number;
  fromPage: number;
  toPage: number;
  direction: -1 | 1;
  coalesced: boolean;
}

export interface ReaderSnapshot {
  pageCount: number;
  settledPage: number;
  desiredPage: number;
  activeTransition: TurnTransition | null;
  generation: number;
}

export interface BeginTransitionOptions {
  maxStep?: number;
}

export type ReaderSnapshotListener = (snapshot: ReaderSnapshot) => void;

function assertPageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError("pageCount must be a positive integer");
  }
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("count must be a positive integer");
  }
}

function clampPage(pageIndex: number, pageCount: number): number {
  if (!Number.isFinite(pageIndex)) {
    throw new RangeError("page index must be finite");
  }
  return Math.min(pageCount - 1, Math.max(0, Math.trunc(pageIndex)));
}

function copyTransition(
  transition: TurnTransition | null,
): TurnTransition | null {
  return transition ? { ...transition } : null;
}

/**
 * Navigation state with one desired target and at most one active animation.
 * Repeated inputs update desiredPage instead of allocating a FIFO queue.
 */
export class ReaderSession {
  private pageCount: number;
  private settledPage: number;
  private desiredPage: number;
  private activeTransition: TurnTransition | null = null;
  private generation = 0;
  private transitionSequence = 0;
  private readonly listeners = new Set<ReaderSnapshotListener>();

  constructor(pageCount: number, initialPage = 0) {
    assertPageCount(pageCount);
    this.pageCount = pageCount;
    this.settledPage = clampPage(initialPage, pageCount);
    this.desiredPage = this.settledPage;
  }

  getSnapshot(): ReaderSnapshot {
    return {
      pageCount: this.pageCount,
      settledPage: this.settledPage,
      desiredPage: this.desiredPage,
      activeTransition: copyTransition(this.activeTransition),
      generation: this.generation,
    };
  }

  subscribe(listener: ReaderSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  next(count = 1): void {
    assertCount(count);
    this.goTo(this.desiredPage + count);
  }

  previous(count = 1): void {
    assertCount(count);
    this.goTo(this.desiredPage - count);
  }

  goTo(pageIndex: number): void {
    const nextDesiredPage = clampPage(pageIndex, this.pageCount);
    if (nextDesiredPage === this.desiredPage) {
      return;
    }
    this.desiredPage = nextDesiredPage;
    this.emit();
  }

  beginTransition(options: BeginTransitionOptions = {}): TurnTransition | null {
    if (this.activeTransition || this.desiredPage === this.settledPage) {
      return null;
    }

    const maxStep = options.maxStep ?? Number.POSITIVE_INFINITY;
    if (
      maxStep !== Number.POSITIVE_INFINITY &&
      (!Number.isInteger(maxStep) || maxStep < 1)
    ) {
      throw new RangeError(
        "maxStep must be a positive integer or positive infinity",
      );
    }

    const distance = this.desiredPage - this.settledPage;
    const direction: -1 | 1 = distance < 0 ? -1 : 1;
    const step = Math.min(Math.abs(distance), maxStep);
    const toPage = clampPage(
      this.settledPage + direction * step,
      this.pageCount,
    );
    const transition: TurnTransition = {
      id: `${this.generation}:${++this.transitionSequence}`,
      generation: this.generation,
      fromPage: this.settledPage,
      toPage,
      direction,
      coalesced: Math.abs(toPage - this.settledPage) > 1,
    };

    this.activeTransition = transition;
    this.emit();
    return { ...transition };
  }

  settleTransition(id: string): boolean {
    if (!this.activeTransition || this.activeTransition.id !== id) {
      return false;
    }

    this.settledPage = this.activeTransition.toPage;
    this.activeTransition = null;
    this.emit();
    return true;
  }

  cancelTransition(id: string): boolean {
    if (!this.activeTransition || this.activeTransition.id !== id) {
      return false;
    }

    this.activeTransition = null;
    this.emit();
    return true;
  }

  replacePagination(pageCount: number, anchorPage: number): void {
    assertPageCount(pageCount);
    this.pageCount = pageCount;
    this.generation += 1;
    this.activeTransition = null;
    this.settledPage = clampPage(anchorPage, pageCount);
    this.desiredPage = this.settledPage;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
