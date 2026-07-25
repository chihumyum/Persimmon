import { describe, expect, it } from "vitest";

import { pageTurnCaptureAddresses } from "./page-turn-textures";
import type { PageAddress } from "./section-navigation";

function page(pageIndex: number): PageAddress {
  return { sectionIndex: 0, pageIndex };
}

describe("page-turn texture faces", () => {
  it("captures the current page for a forward single-page turn", () => {
    expect(pageTurnCaptureAddresses("single", 1, [page(2)], [page(3)])).toEqual(
      {
        front: page(2),
      },
    );
  });

  it("captures the incoming page for a backward single-page turn", () => {
    expect(
      pageTurnCaptureAddresses("single", -1, [page(3)], [page(2)]),
    ).toEqual({
      front: page(2),
    });
  });

  it("maps a forward spread turn from the current right page to the target left page", () => {
    expect(
      pageTurnCaptureAddresses(
        "spread",
        1,
        [page(2), page(3)],
        [page(4), page(5)],
      ),
    ).toEqual({
      front: page(3),
      back: page(4),
    });
  });

  it("maps a backward spread turn from the current left page to the target right page", () => {
    expect(
      pageTurnCaptureAddresses(
        "spread",
        -1,
        [page(4), page(5)],
        [page(2), page(3)],
      ),
    ).toEqual({
      front: page(3),
      back: page(4),
    });
  });
});
