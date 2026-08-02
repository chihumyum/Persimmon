import type { GoogleDriveSyncStatus } from "../sync/types";

export type LibrarySyncBannerPlacement = "hidden" | "top" | "floating";

export const SYNC_COMPLETION_VISIBLE_MS = 2_000;

export interface LibrarySyncBannerContext {
  readonly connectionPromptDismissed: boolean | undefined;
  readonly syncCompletionVisible: boolean;
}

export function librarySyncBannerPlacement(
  status: GoogleDriveSyncStatus,
  context: LibrarySyncBannerContext,
): LibrarySyncBannerPlacement {
  switch (status.phase) {
    case "loading":
    case "unconfigured":
    case "authorizing":
      return "hidden";
    case "disconnected":
    case "reauthorization-required":
      return context.connectionPromptDismissed === false ? "top" : "hidden";
    case "syncing":
    case "error":
      return "floating";
    case "idle":
      return context.syncCompletionVisible ? "floating" : "hidden";
  }
}

export function shouldAnnounceSyncCompletion(
  previousPhase: GoogleDriveSyncStatus["phase"],
  currentPhase: GoogleDriveSyncStatus["phase"],
): boolean {
  return previousPhase === "syncing" && currentPhase === "idle";
}
