import { describe, expect, it } from "vitest";

import type { GoogleDriveSyncStatus } from "../sync/types";
import {
  librarySyncBannerPlacement,
  shouldAnnounceSyncCompletion,
  syncProgressFraction,
} from "./library-sync-banner";

const readyContext = {
  connectionPromptDismissed: false,
  syncCompletionVisible: false,
} as const;

describe("librarySyncBannerPlacement", () => {
  it("hides startup and authorization states while the account is resolved", () => {
    const statuses: readonly GoogleDriveSyncStatus[] = [
      { phase: "loading" },
      { phase: "authorizing" },
      { phase: "unconfigured", message: "尚未配置" },
    ];

    for (const status of statuses) {
      expect(librarySyncBannerPlacement(status, readyContext)).toBe("hidden");
    }
  });

  it("always floats an active sync above the shelf", () => {
    const syncing: GoogleDriveSyncStatus = { phase: "syncing" };

    expect(
      librarySyncBannerPlacement(syncing, {
        connectionPromptDismissed: true,
        syncCompletionVisible: false,
      }),
    ).toBe("floating");
  });

  it("shows connection notices only after preferences load and until dismissed", () => {
    const statuses: readonly GoogleDriveSyncStatus[] = [
      { phase: "disconnected" },
      { phase: "reauthorization-required", message: "需要重新授权" },
    ];

    for (const status of statuses) {
      expect(librarySyncBannerPlacement(status, readyContext)).toBe("top");
      expect(
        librarySyncBannerPlacement(status, {
          ...readyContext,
          connectionPromptDismissed: undefined,
        }),
      ).toBe("hidden");
      expect(
        librarySyncBannerPlacement(status, {
          ...readyContext,
          connectionPromptDismissed: true,
        }),
      ).toBe("hidden");
    }
  });

  it("shows idle only for the short completion acknowledgement", () => {
    const idle: GoogleDriveSyncStatus = {
      phase: "idle",
      lastSyncedAt: "2026-08-02T00:00:00.000Z",
    };

    expect(librarySyncBannerPlacement(idle, readyContext)).toBe("hidden");
    expect(
      librarySyncBannerPlacement(idle, {
        ...readyContext,
        syncCompletionVisible: true,
      }),
    ).toBe("floating");
  });

  it("keeps a sync failure visible independently of the connection prompt", () => {
    expect(
      librarySyncBannerPlacement(
        { phase: "error", message: "同步失败" },
        {
          connectionPromptDismissed: true,
          syncCompletionVisible: false,
        },
      ),
    ).toBe("floating");
  });

  it("lets an import notice replace every Google Drive notice", () => {
    const context = {
      connectionPromptDismissed: false,
      importNoticeVisible: true,
      syncCompletionVisible: true,
    } as const;

    expect(librarySyncBannerPlacement({ phase: "syncing" }, context)).toBe(
      "hidden",
    );
    expect(librarySyncBannerPlacement({ phase: "disconnected" }, context)).toBe(
      "hidden",
    );
    expect(
      librarySyncBannerPlacement(
        {
          phase: "idle",
          lastSyncedAt: "2026-08-02T00:00:00.000Z",
        },
        context,
      ),
    ).toBe("hidden");
  });
});

describe("shouldAnnounceSyncCompletion", () => {
  it("only announces a completed sync that was observed in progress", () => {
    expect(shouldAnnounceSyncCompletion("syncing", "idle")).toBe(true);
    expect(shouldAnnounceSyncCompletion("loading", "idle")).toBe(false);
    expect(shouldAnnounceSyncCompletion("idle", "idle")).toBe(false);
  });
});

describe("syncProgressFraction", () => {
  it("converts completed books into a clamped determinate fraction", () => {
    expect(
      syncProgressFraction({
        stage: "downloading",
        completedBooks: 3,
        totalBooks: 12,
      }),
    ).toBe(0.25);
    expect(
      syncProgressFraction({
        stage: "finalizing",
        completedBooks: 13,
        totalBooks: 12,
      }),
    ).toBe(1);
    expect(
      syncProgressFraction({
        stage: "downloading",
        completedBooks: 0,
        totalBooks: 0,
      }),
    ).toBe(0);
  });
});
