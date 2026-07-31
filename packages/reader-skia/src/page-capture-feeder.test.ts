import { describe, expect, it, vi } from "vitest";

import type { CapturedPage, RecordedPageCapture } from "./page-capture";
import {
  PageCaptureFeeder,
  pageCaptureFeedRequestKey,
  type PageCaptureFeedRequest,
} from "./page-capture-feeder";

interface Metadata {
  readonly id: string;
}

function request(
  id: string,
  priority: number,
): PageCaptureFeedRequest<Metadata> {
  return {
    identity: {
      key: id,
      width: 10,
      height: 20,
      metadata: { id },
    },
    scale: 2,
    tier: "prefetch",
    priority,
  };
}

function recording(): RecordedPageCapture {
  return {
    picture: {} as RecordedPageCapture["picture"],
    scale: 2,
    pixelWidth: 20,
    pixelHeight: 40,
    byteSize: 3_200,
    dispose: vi.fn(),
  };
}

function capture(): CapturedPage {
  return {
    image: {} as CapturedPage["image"],
    scale: 2,
    pixelWidth: 20,
    pixelHeight: 40,
    byteSize: 3_200,
    dispose: vi.fn(),
    retire: vi.fn(),
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("page capture feeder", () => {
  it("starts the highest-priority capture first", async () => {
    const recordedIds: string[] = [];
    const installedIds: string[] = [];
    const feeder = new PageCaptureFeeder<Metadata>({
      maximumConcurrentJobs: 1,
      hasResidentCapture: () => false,
      record: (identity) => {
        recordedIds.push(identity.metadata!.id);
        return recording();
      },
      rasterize: async () => capture(),
      install: (feedRequest) => {
        installedIds.push(feedRequest.identity.metadata!.id);
      },
    });

    feeder.synchronize([request("far", 1), request("active", 100)]);
    await vi.waitFor(() => expect(installedIds).toHaveLength(2));

    expect(recordedIds).toEqual(["active", "far"]);
    expect(feeder.getStats()).toMatchObject({
      completed: 2,
      failed: 0,
      inFlight: 0,
      queued: 0,
    });
  });

  it("drops stale queued and in-flight work after direction changes", async () => {
    const firstRaster = deferred<CapturedPage | null>();
    const recordedIds: string[] = [];
    const installedIds: string[] = [];
    const staleCapture = capture();
    const feeder = new PageCaptureFeeder<Metadata>({
      maximumConcurrentJobs: 1,
      hasResidentCapture: () => false,
      record: (identity) => {
        recordedIds.push(identity.metadata!.id);
        return recording();
      },
      rasterize: vi
        .fn()
        .mockImplementationOnce(() => firstRaster.promise)
        .mockImplementation(async () => capture()),
      install: (feedRequest) => {
        installedIds.push(feedRequest.identity.metadata!.id);
      },
    });

    feeder.synchronize([request("forward-1", 10), request("forward-2", 9)]);
    feeder.synchronize([request("backward-1", 10)]);
    firstRaster.resolve(staleCapture);

    await vi.waitFor(() => expect(installedIds).toEqual(["backward-1"]));
    expect(recordedIds).toEqual(["forward-1", "backward-1"]);
    expect(staleCapture.dispose).toHaveBeenCalledOnce();
  });

  it("uses content identity and scale as the deduplication key", () => {
    expect(pageCaptureFeedRequestKey(request("a", 1))).toBe(
      pageCaptureFeedRequestKey(request("a", 100)),
    );
    expect(pageCaptureFeedRequestKey(request("a", 1))).not.toBe(
      pageCaptureFeedRequestKey(request("b", 1)),
    );
  });
});
