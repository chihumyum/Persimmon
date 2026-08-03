export interface PendingNativePagerPresentation {
  readonly turnId: string;
  readonly settledEpoch: string;
}

/**
 * Separates native logical consumption from the first display-backed frame.
 * A consumed turn may advance React state only when native later confirms that
 * its first frame was submitted; cancellation/reset discards the reservation.
 */
export class NativePagerFirstFrameGate {
  private readonly consumed = new Set<string>();

  reserve(turnId: string): void {
    this.consumed.add(turnId);
  }

  confirmPresented(turnId: string): boolean {
    if (!this.consumed.has(turnId)) {
      return false;
    }
    this.consumed.delete(turnId);
    return true;
  }

  discard(turnId: string): void {
    this.consumed.delete(turnId);
  }

  reset(): void {
    this.consumed.clear();
  }
}

/**
 * Tracks the newest direct native turn whose final target must stay above the
 * declarative Canvas until that target has actually had paint opportunities.
 * A newer turn supersedes an older handoff because the native compositor also
 * keeps only the newest complete target spread.
 */
export class NativePagerPresentationGate {
  private pending: PendingNativePagerPresentation | undefined;

  schedule(turnId: string, settledEpoch: string): void {
    this.pending = { turnId, settledEpoch };
  }

  turnIdForSettled(settledEpoch: string): string | undefined {
    return this.pending?.settledEpoch === settledEpoch
      ? this.pending.turnId
      : undefined;
  }

  acknowledge(turnId: string): void {
    if (this.pending?.turnId === turnId) {
      this.pending = undefined;
    }
  }

  reset(): void {
    this.pending = undefined;
  }
}
