export interface PendingNativePagerPresentation {
  readonly turnId: string;
  readonly settledEpoch: string;
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
