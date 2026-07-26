import type { PageAddress } from "./section-navigation";
import {
  createPageTurnSchedulerState,
  type PageTurnSchedulerState,
} from "./page-turn-scheduler";

export interface ReaderEngineGeneration {
  readonly key: string;
  readonly scheduler: PageTurnSchedulerState;
}

export function createReaderEngineGeneration(
  key: string,
  initialAddress: PageAddress,
): ReaderEngineGeneration {
  return {
    key,
    scheduler: createPageTurnSchedulerState(initialAddress),
  };
}

export function reconcileReaderEngineGeneration(
  current: ReaderEngineGeneration,
  key: string,
  initialAddress: PageAddress,
): ReaderEngineGeneration {
  return current.key === key
    ? current
    : createReaderEngineGeneration(key, initialAddress);
}
