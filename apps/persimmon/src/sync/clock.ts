import type { HybridClock } from "./types";

export function compareClocks(left: HybridClock, right: HybridClock): number {
  if (left.wallTime !== right.wallTime) {
    return left.wallTime < right.wallTime ? -1 : 1;
  }
  if (left.counter !== right.counter) {
    return left.counter < right.counter ? -1 : 1;
  }
  return left.deviceId.localeCompare(right.deviceId);
}

export function tickClock(
  previous: HybridClock,
  deviceId: string,
  now: number,
): HybridClock {
  const wallTime = Math.max(previous.wallTime, Math.floor(now));
  return {
    wallTime,
    counter: wallTime === previous.wallTime ? previous.counter + 1 : 0,
    deviceId,
  };
}

export function observeClock(
  previous: HybridClock,
  observed: HybridClock,
  deviceId: string,
  now: number,
): HybridClock {
  const wallTime = Math.max(
    Math.floor(now),
    previous.wallTime,
    observed.wallTime,
  );
  let counter = 0;
  if (wallTime === previous.wallTime && wallTime === observed.wallTime) {
    counter = Math.max(previous.counter, observed.counter) + 1;
  } else if (wallTime === previous.wallTime) {
    counter = previous.counter + 1;
  } else if (wallTime === observed.wallTime) {
    counter = observed.counter + 1;
  }
  return { wallTime, counter, deviceId };
}

export function latestClock(
  clocks: readonly HybridClock[],
): HybridClock | undefined {
  return clocks.reduce<HybridClock | undefined>(
    (latest, clock) =>
      !latest || compareClocks(clock, latest) > 0 ? clock : latest,
    undefined,
  );
}
