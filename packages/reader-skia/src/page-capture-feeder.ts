import type {
  PageCaptureIdentity,
  PageCaptureTier,
} from "./page-capture-cache";
import type { CapturedPage, RecordedPageCapture } from "./page-capture";

export interface PageCaptureFeedRequest<Metadata = unknown> {
  readonly identity: PageCaptureIdentity<Metadata>;
  readonly scale: number;
  readonly tier: PageCaptureTier;
  /**
   * Larger values start first. Active turn faces should outrank directional
   * inventory, and inventory nearest the reading head should outrank depth.
   */
  readonly priority: number;
}

export interface PageCaptureFeederStats {
  readonly queued: number;
  readonly inFlight: number;
  readonly completed: number;
  readonly failed: number;
  readonly averageJobMs: number;
  readonly p95JobMs: number;
}

interface PageCaptureFeederOptions<Metadata> {
  readonly maximumConcurrentJobs: number;
  readonly hasResidentCapture: (
    identity: PageCaptureIdentity<Metadata>,
    minimumScale: number,
  ) => boolean;
  readonly record: (
    identity: PageCaptureIdentity<Metadata>,
    scale: number,
  ) => RecordedPageCapture | null;
  readonly rasterize: (
    recording: RecordedPageCapture,
  ) => Promise<CapturedPage | null>;
  /**
   * Ownership of capture transfers to install, including when admission fails.
   */
  readonly install: (
    request: PageCaptureFeedRequest<Metadata>,
    capture: CapturedPage,
  ) => void;
  readonly onChange?: () => void;
}

interface QueuedJob<Metadata> {
  readonly key: string;
  request: PageCaptureFeedRequest<Metadata>;
  readonly sequence: number;
}

const JOB_SAMPLE_LIMIT = 64;

/**
 * Priority, deduplication, and back-pressure for the native raster workers.
 *
 * synchronize() is intentionally declarative: callers publish the complete
 * wanted inventory on each reader update. Queued work that fell behind a
 * direction change disappears immediately; in-flight work is discarded when
 * it finishes, so an old burst can never refill the cache behind the reader.
 */
export class PageCaptureFeeder<Metadata = unknown> {
  private readonly maximumConcurrentJobs: number;
  private readonly hasResidentCapture: PageCaptureFeederOptions<Metadata>["hasResidentCapture"];
  private readonly record: PageCaptureFeederOptions<Metadata>["record"];
  private readonly rasterize: PageCaptureFeederOptions<Metadata>["rasterize"];
  private readonly install: PageCaptureFeederOptions<Metadata>["install"];
  private readonly onChange: () => void;
  private readonly wanted = new Map<string, PageCaptureFeedRequest<Metadata>>();
  private readonly queued = new Map<string, QueuedJob<Metadata>>();
  private readonly inFlight = new Map<string, QueuedJob<Metadata>>();
  private readonly jobSamples: number[] = [];
  private sequence = 0;
  private completed = 0;
  private failed = 0;
  private disposed = false;

  constructor(options: PageCaptureFeederOptions<Metadata>) {
    this.maximumConcurrentJobs = Math.max(
      1,
      Math.floor(options.maximumConcurrentJobs),
    );
    this.hasResidentCapture = options.hasResidentCapture;
    this.record = options.record;
    this.rasterize = options.rasterize;
    this.install = options.install;
    this.onChange = options.onChange ?? (() => undefined);
  }

  synchronize(requests: readonly PageCaptureFeedRequest<Metadata>[]): void {
    if (this.disposed) {
      return;
    }
    this.wanted.clear();
    for (const request of requests) {
      const key = pageCaptureFeedRequestKey(request);
      const existing = this.wanted.get(key);
      if (!existing || request.priority > existing.priority) {
        this.wanted.set(key, request);
      }
    }

    for (const key of this.queued.keys()) {
      if (!this.wanted.has(key)) {
        this.queued.delete(key);
      }
    }
    for (const [key, request] of this.wanted) {
      if (this.hasResidentCapture(request.identity, request.scale)) {
        this.queued.delete(key);
        continue;
      }
      const queued = this.queued.get(key);
      if (queued) {
        queued.request = request;
        continue;
      }
      const running = this.inFlight.get(key);
      if (running) {
        running.request = request;
        continue;
      }
      this.queued.set(key, {
        key,
        request,
        sequence: this.sequence++,
      });
    }
    this.pump();
  }

  getStats(): PageCaptureFeederStats {
    const samples = [...this.jobSamples].sort((left, right) => left - right);
    const total = samples.reduce((sum, value) => sum + value, 0);
    const p95Index =
      samples.length > 0 ? Math.ceil(samples.length * 0.95) - 1 : -1;
    return {
      queued: this.queued.size,
      inFlight: this.inFlight.size,
      completed: this.completed,
      failed: this.failed,
      averageJobMs: samples.length > 0 ? total / samples.length : 0,
      p95JobMs: p95Index >= 0 ? samples[p95Index]! : 0,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.wanted.clear();
    this.queued.clear();
  }

  private pump(): void {
    if (this.disposed) {
      return;
    }
    while (
      this.inFlight.size < this.maximumConcurrentJobs &&
      this.queued.size > 0
    ) {
      const job = this.nextJob();
      if (!job) {
        return;
      }
      this.queued.delete(job.key);
      const currentRequest = this.wanted.get(job.key);
      if (
        !currentRequest ||
        this.hasResidentCapture(currentRequest.identity, currentRequest.scale)
      ) {
        continue;
      }
      job.request = currentRequest;
      const startedAt = monotonicNow();
      const recording = this.record(
        currentRequest.identity,
        currentRequest.scale,
      );
      if (!recording) {
        continue;
      }
      this.inFlight.set(job.key, job);
      void this.rasterize(recording)
        .then((capture) => {
          if (!capture) {
            this.failed += 1;
            return;
          }
          const wanted = this.wanted.get(job.key);
          if (
            this.disposed ||
            !wanted ||
            this.hasResidentCapture(wanted.identity, wanted.scale)
          ) {
            capture.dispose();
            return;
          }
          try {
            this.install(wanted, capture);
            this.completed += 1;
          } catch (error) {
            capture.dispose();
            this.failed += 1;
            console.warn(
              "[Persimmon] Failed to install a fed page texture.",
              error,
            );
          }
        })
        .catch((error: unknown) => {
          this.failed += 1;
          console.warn("[Persimmon] Page raster worker failed.", error);
        })
        .finally(() => {
          recording.dispose();
          this.inFlight.delete(job.key);
          this.recordSample(monotonicNow() - startedAt);
          this.onChange();
          this.pump();
        });
    }
  }

  private nextJob(): QueuedJob<Metadata> | undefined {
    let best: QueuedJob<Metadata> | undefined;
    for (const job of this.queued.values()) {
      if (
        !best ||
        job.request.priority > best.request.priority ||
        (job.request.priority === best.request.priority &&
          job.sequence < best.sequence)
      ) {
        best = job;
      }
    }
    return best;
  }

  private recordSample(durationMs: number): void {
    this.jobSamples.push(Math.max(0, durationMs));
    if (this.jobSamples.length > JOB_SAMPLE_LIMIT) {
      this.jobSamples.shift();
    }
  }
}

export function pageCaptureFeedRequestKey<Metadata>(
  request: Pick<PageCaptureFeedRequest<Metadata>, "identity" | "scale">,
): string {
  const { identity, scale } = request;
  return `${identity.key.length}:${identity.key}:${identity.width}x${identity.height}@${scale}`;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}
