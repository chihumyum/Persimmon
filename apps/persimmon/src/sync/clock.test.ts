import { describe, expect, it } from "vitest";

import { compareClocks, observeClock, tickClock } from "./clock";

describe("hybrid clock", () => {
  it("keeps monotonic order when the wall clock moves backwards", () => {
    const first = tickClock(
      { wallTime: 1_000, counter: 2, deviceId: "device-a" },
      "device-a",
      900,
    );
    expect(first).toEqual({
      wallTime: 1_000,
      counter: 3,
      deviceId: "device-a",
    });
  });

  it("orders concurrent device events deterministically", () => {
    expect(
      compareClocks(
        { wallTime: 1_000, counter: 0, deviceId: "device-a" },
        { wallTime: 1_000, counter: 0, deviceId: "device-b" },
      ),
    ).toBeLessThan(0);
  });

  it("observes a remote future clock before creating more events", () => {
    expect(
      observeClock(
        { wallTime: 1_000, counter: 0, deviceId: "device-a" },
        { wallTime: 2_000, counter: 4, deviceId: "device-b" },
        "device-a",
        1_500,
      ),
    ).toEqual({
      wallTime: 2_000,
      counter: 5,
      deviceId: "device-a",
    });
  });
});
