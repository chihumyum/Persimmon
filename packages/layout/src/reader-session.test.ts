import { describe, expect, it } from "vitest";

import { ReaderSession } from "./reader-session";

describe("ReaderSession", () => {
  it("coalesces twenty next intents without a FIFO queue", () => {
    const session = new ReaderSession(100);

    session.next();
    const first = session.beginTransition();
    expect(first).toMatchObject({ fromPage: 0, toPage: 1 });

    for (let index = 0; index < 19; index += 1) {
      session.next();
    }

    expect(session.getSnapshot()).toMatchObject({
      settledPage: 0,
      desiredPage: 20,
      activeTransition: { fromPage: 0, toPage: 1 },
    });

    expect(session.settleTransition(first!.id)).toBe(true);
    const coalesced = session.beginTransition();
    expect(coalesced).toMatchObject({
      fromPage: 1,
      toPage: 20,
      direction: 1,
      coalesced: true,
    });

    expect(session.settleTransition(coalesced!.id)).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      settledPage: 20,
      desiredPage: 20,
      activeTransition: null,
    });
  });

  it("ignores a stale transition after pagination is replaced", () => {
    const session = new ReaderSession(20, 4);
    session.next();
    const stale = session.beginTransition();

    session.replacePagination(8, 3);

    expect(session.getSnapshot()).toMatchObject({
      pageCount: 8,
      settledPage: 3,
      desiredPage: 3,
      activeTransition: null,
      generation: 1,
    });
    expect(session.settleTransition(stale!.id)).toBe(false);
    expect(session.getSnapshot().settledPage).toBe(3);
  });
});
