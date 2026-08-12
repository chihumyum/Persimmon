import type { BookIR, BookLocator, BookPosition } from "@persimmon/book-core";
import {
  countBookSectionPages,
  paginateBookSection,
  type PageLinkRegion,
  type PaginationResult,
} from "@persimmon/layout";
import {
  MIN_PRESSED_EDGE_X,
  anchoredGestureFingerX,
  gestureLiftRotationForFingerX,
  gestureTurnSpeedScale,
  incomingPageDragProgress,
  pageGestureModeForStart,
  postHingeTurnProgressForFingerX,
  shouldCommitTurn,
} from "@chihumyum/page-turn-core";
import {
  Canvas,
  Fill,
  Rect,
  useCanvasRef,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import {
  PixelRatio,
  Platform,
  Pressable,
  processColor,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  adjacentViewAddress,
  pageAddressesFrom,
  samePageAddress,
  type PageAddress,
} from "./section-navigation";
import { DecodedImageCache, type ResourceLoader } from "./image-cache";
import {
  disposeCapturedPageAfterPaint,
  pageImagesSettledForCapture,
  recordPageCapture,
  retireCapturedPageAfterPaint,
  type CapturedPage,
  type RecordedPageCapture,
} from "./page-capture";
import {
  CapturedPageCache,
  type PageCaptureIdentity,
  type TurnCaptureLease,
} from "./page-capture-cache";
import {
  PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
  PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET,
  pageCapturePixelSize,
} from "./page-capture-budget";
import {
  PageCaptureFeeder,
  type PageCaptureFeedRequest,
} from "./page-capture-feeder";
import {
  PAGE_CAPTURE_RASTER_WORKER_COUNT,
  rasterizePageCaptureOffThread,
} from "./page-capture-rasterizer";
import { selectPageCaptureQuality } from "./page-capture-quality";
import { buildPageCapturePlan } from "./page-capture-plan";
import { PageTurnMesh } from "@chihumyum/react-native-natural-page-turn/advanced";
import { PAGE_TURN_MAX_PERSPECTIVE_SCALE } from "./page-turn-perspective";
import {
  PAGE_TURN_LANE_HARD_LIMIT,
  burstPageTurnPlaybackSpeed,
  calculatePageTurnConcurrency,
  estimateAutomaticPageTurnDurationMs,
} from "./page-turn-concurrency";
import {
  pageTurnBackgroundSlots,
  pageTurnsReadyForPaint,
} from "./page-turn-background";
import {
  pageTurnSolverDirectionForLayout,
  pageTurnTuningForLayoutDirection,
  shouldDrawPageTurnShadow,
} from "./page-turn-direction";
import {
  pageTurnCaptureAddresses,
  type PageTurnCaptureAddresses,
} from "./page-turn-textures";
import { ReaderPageLayer } from "./reader-page-layer";
import {
  createReaderEngineGeneration,
  reconcileReaderEngineGeneration,
} from "./reader-engine-generation";
import {
  DEFAULT_LIVE_READER_APPEARANCE,
  type ReaderAppearance,
  type ReaderProgressDisplay,
} from "./reader-appearance";
import {
  createPageProgressDecoration,
  progressDisplayHasFooter,
  progressDisplayHasHeader,
  progressDisplayForToolbar,
  type PageProgressDecoration,
  type PageProgressPresentation,
} from "./page-progress-decoration";
import { DEFAULT_READER_THEME, type ReaderTheme } from "./reader-theme";
import {
  createReaderLayoutSpec,
  disposePaginationAfterPaint,
  retirePaginationAfterPaint,
} from "./reader-pagination";
import { SectionPageCountCache } from "./section-page-count-cache";
import {
  estimateSectionPageCount,
  shouldResolveExactPublicationPageCounts,
} from "./section-page-count-estimate";
import {
  createSkiaParagraphBackend,
  createTransientSkiaParagraphBackend,
} from "./skia-paragraph-backend";
import { releaseTransientSkiaResources } from "./skia-resource-release";
import {
  createSkiaPageDecoration,
  disposeSkiaPageDecorationAfterPaint,
  retireSkiaPageDecorationAfterPaint,
  SkiaPageDecorationLayer,
  type SkiaPageDecoration,
} from "./skia-page-decoration";
import {
  useNativePageTurnDriver,
  type NativePageTurnBenchmarkCommand,
  type PageGestureReleaseInput,
} from "./native-page-turn-driver";
import {
  AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X,
  automaticTuningForCore,
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeAutomaticPageTurnTuning,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";
import {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  gestureTuningForCore,
  normalizeGesturePageTurnTuningForPlatform,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
import {
  DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeReverseAutomaticPageTurnTuning,
  reverseAutomaticTuningForCore,
  type ReverseAutomaticPageTurnTuning,
} from "./reverse-automatic-page-turn-tuning";
import {
  DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING,
  normalizeReverseGesturePageTurnTuningForPlatform,
  reverseGestureTuningForCore,
  type ReverseGesturePageTurnTuning,
} from "./reverse-gesture-page-turn-tuning";
import {
  useNativePageTurnPool,
  type NativeProgrammaticPageTurnCommand,
} from "./native-page-turn-pool";
import {
  acknowledgeNativePagerPresentation,
  configureNativePagerInput,
  configureNativePagerMotion,
  enqueueNativePagerPictureTurn,
  nativePagerCanvasReady,
  nativePagerCompositorAvailable,
  resetNativePagerCompositor,
  runNativePagerBenchmark,
  setNativePagerAnchor,
  stockNativePagerPicture,
  takeNativePagerEvents,
  type NativePagerEvent,
} from "./native-pager-compositor";
import {
  NativePagerFirstFrameGate,
  NativePagerPresentationGate,
} from "./native-pager-presentation";
import {
  bindNativePagerInput,
  resolveNativePagerGestureInputPolicy,
} from "./native-pager-input";
import {
  buildNativePagerStockPlan,
  nativePagerPageKey,
  nativePagerStockEntryIdFromTurnId,
  nativePagerTransitionPictures,
  trimNativePagerReconciliationEntries,
} from "./native-pager-stock";
import { NativePagerRecordingCache } from "./native-pager-recording-cache";
import {
  PAGE_TURN_START_INTERVAL_MS,
  beginScheduledInteractivePageTurn,
  createPageTurnSchedulerState,
  handoffScheduledInteractivePageTurn,
  hasRunningPageTurns,
  markScheduledPageTurnLaneReady,
  markScheduledPageTurnsPresented,
  isProgrammaticPageTurnMotion,
  requestScheduledPageTurn,
  requestScheduledRapidPageTurn,
  requestScheduledGesturePageTurn,
  resolveScheduledPageTurn,
  scheduledPageAddress,
  turnPageImmediately,
  type PageTurnScheduler,
  type PageTurnSchedulerState,
  type ScheduledPageTurn,
} from "./page-turn-scheduler";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  spreadPageTurnPaintPasses,
  type PageTurnFace,
} from "./page-turn-stack";
import { reduceNoteReturnAnchor, type NoteReturnAnchor } from "./note-return";
import {
  compareTextPositions,
  createTextSelectionDocument,
  hitTestVisibleText,
  selectedText,
  textSelectionContainsPoint,
  textSelectionGeometry,
  wordSelectionAt,
  type TextSelection,
  type TextSelectionGeometry,
  type TextSelectionHandle,
} from "./text-selection";
import { useStableRNDispatcher } from "./use-stable-rn-dispatcher";

export interface ReaderProgress {
  locator: BookLocator;
  sectionIndex: number;
  pageIndex: number;
  pageCount: number;
  publicationProgress: number;
}

export type ReaderLayoutMode = "single" | "spread";

export type ReaderPageTurnAnimation = "natural" | "none";

export interface ReaderSelectionMenuRequest {
  readonly text: string;
  readonly rectInWindow: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface ReaderUiMessages {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly toggleTools: string;
  readonly selectionStart: string;
  readonly selectionEnd: string;
  readonly header: (title: string) => string;
  readonly publicationPercentage: (percentage: string) => string;
  readonly publicationPage: (page: string) => string;
  readonly noteKindEndnote: string;
  readonly noteKindFootnote: string;
  readonly noteKindAnnotation: string;
  readonly openNote: (noteKind: string, label: string) => string;
  readonly returnToText: (label: string) => string;
  readonly jumpTo: (label: string) => string;
  readonly noteHint: string;
  readonly returnToReference: (noteKind: string, label: string) => string;
  readonly returnToTextButton: string;
  readonly dismissReturnButton: (noteKind: string) => string;
}

export const DEFAULT_READER_UI_MESSAGES: ReaderUiMessages = {
  previousPage: "Previous page",
  nextPage: "Next page",
  toggleTools: "Toggle reading tools",
  selectionStart: "Drag the start of the text selection",
  selectionEnd: "Drag the end of the text selection",
  header: (title) => `Header: ${title}`,
  publicationPercentage: (percentage) => `Book progress ${percentage}`,
  publicationPage: (page) => `Book page ${page}`,
  noteKindEndnote: "endnote",
  noteKindFootnote: "footnote",
  noteKindAnnotation: "note",
  openNote: (noteKind, label) => `Open ${noteKind} ${label}`,
  returnToText: (label) => `Return to text ${label}`,
  jumpTo: (label) => `Go to ${label}`,
  noteHint: "Opens the note and provides a button to return to the text",
  returnToReference: (noteKind, label) =>
    `Return to the ${noteKind} reference ${label}`,
  returnToTextButton: "↩ Return to Text",
  dismissReturnButton: (noteKind) =>
    `Dismiss the return-to-${noteKind}-reference button`,
};

export interface LiveReaderProps {
  book: BookIR;
  fontProvider: SkTypefaceFontProvider;
  /**
   * Stable identity of all registered typefaces. A change replaces every
   * paragraph/capture generation while retaining the current BookPosition.
   */
  fontProviderKey?: string;
  width: number;
  height: number;
  appearance?: ReaderAppearance;
  /** @deprecated Pass `appearance.fontSize` instead. */
  fontSize?: number;
  layout?: ReaderLayoutMode;
  pageTurnAnimation?: ReaderPageTurnAnimation;
  rapidPageTurnEnabled?: boolean;
  theme?: ReaderTheme;
  topInset?: number;
  bottomInset?: number;
  toolbarVisible?: boolean;
  uiMessages?: ReaderUiMessages;
  initialPosition?: BookPosition;
  loadResource?: ResourceLoader;
  automaticPageTurnTuning?: AutomaticPageTurnTuning;
  reverseAutomaticPageTurnTuning?: ReverseAutomaticPageTurnTuning;
  gesturePageTurnTuning?: GesturePageTurnTuning;
  reverseGesturePageTurnTuning?: ReverseGesturePageTurnTuning;
  onCenterPress?: () => void;
  onProgress?: (progress: ReaderProgress) => void;
  onSelectionChange?: (selecting: boolean) => void;
  onSelectionMenuDismiss?: () => void;
  onSelectionMenuRequest?: (request: ReaderSelectionMenuRequest) => void;
  onTurningChange?: (turning: boolean) => void;
}

interface TurnTexture {
  readonly frontImage: CapturedPage["image"] | null;
  readonly backImage: CapturedPage["image"] | null;
}

interface PageCaptureMetadata {
  readonly address: PageAddress;
  readonly decorationAddress: PageAddress;
  readonly slot: number;
}

interface CachedPageDecoration {
  readonly decoration: SkiaPageDecoration;
}

interface PersimmonPageTurnBenchmarkGlobal {
  __persimmonRun10Pps?: (
    count?: number,
    intervalMs?: number,
    direction?: 1 | -1,
  ) => boolean;
}

interface PageTurnRejectionCounts {
  capacity: number;
  boundary: number;
  direction: number;
  capture: number;
  other: number;
}

interface NativePagerStockEntryRecord {
  readonly from: PageAddress;
  readonly to: PageAddress;
  readonly direction: 1 | -1;
  readonly playbackSpeed: number;
}

const PAGE_DECORATION_CACHE_LIMIT = 32;
// JS owns recordings only long enough to reuse pages around the moving stock
// edge. Native takes its own sk_sp reference during stocking, so keeping the
// complete graph here merely double-charges Hermes external memory. The raster
// estimate makes large-screen pages hit the byte ceiling before the count cap.
const NATIVE_PAGER_RECORDING_CACHE_LIMIT = 16;
const NATIVE_PAGER_RECORDING_CACHE_BYTE_BUDGET = 192 * 1024 * 1024;
// A cache miss falls back to recording and uploading as many as four full-page
// textures. Keep that expensive path serial; prepared native stock turns still
// bypass the React scheduler and retain their normal burst throughput.
const NATIVE_PAGER_FALLBACK_MAXIMUM_CONCURRENT_TAP_TURNS = 1;
const PAGE_CAPTURE_MAX_DIRECTIONAL_VIEWS = 12;
const PAGE_CAPTURE_MIN_DIRECTIONAL_VIEWS = 3;

type TextSelectionEndpoint = "anchor" | "focus";

interface PendingSelectionHandleDrag {
  readonly endpoint: TextSelectionEndpoint;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface QueuedSelectionHandleMove {
  readonly x: number;
  readonly y: number;
}

interface LazyReaderEngineProps
  extends Omit<
    LiveReaderProps,
    "appearance" | "bottomInset" | "fontProviderKey" | "fontSize" | "topInset"
  > {
  readonly appearance: ReaderAppearance;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly imageCache: DecodedImageCache;
  readonly readerGeneration: string;
}

interface ReaderLinkHit {
  readonly key: string;
  readonly region: PageLinkRegion;
  readonly frame: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

const MINIMUM_LINK_TOUCH_TARGET = 44;

function expandedLinkHitFrame(
  region: PageLinkRegion,
  offsetX: number,
  pageWidth: number,
  pageHeight: number,
) {
  const targetWidth = Math.max(MINIMUM_LINK_TOUCH_TARGET, region.frame.width);
  const targetHeight = Math.max(MINIMUM_LINK_TOUCH_TARGET, region.frame.height);
  const pageLeft = offsetX;
  const pageRight = offsetX + pageWidth;
  const x = Math.min(
    pageRight - targetWidth,
    Math.max(
      pageLeft,
      offsetX + region.frame.x - (targetWidth - region.frame.width) * 0.5,
    ),
  );
  const y = Math.min(
    pageHeight - targetHeight,
    Math.max(0, region.frame.y - (targetHeight - region.frame.height) * 0.5),
  );
  return {
    x,
    y,
    width: targetWidth,
    height: targetHeight,
  };
}

function noteKindLabel(
  messages: ReaderUiMessages,
  noteKind: PageLinkRegion["link"]["noteKind"],
): string {
  return noteKind === "endnote"
    ? messages.noteKindEndnote
    : noteKind === "footnote"
      ? messages.noteKindFootnote
      : messages.noteKindAnnotation;
}

function linkAccessibilityLabel(
  messages: ReaderUiMessages,
  region: PageLinkRegion,
): string {
  if (region.link.kind === "note-reference") {
    return messages.openNote(
      noteKindLabel(messages, region.link.noteKind),
      region.link.label,
    );
  }
  if (region.link.kind === "note-backlink") {
    return messages.returnToText(region.link.label);
  }
  return messages.jumpTo(region.link.label);
}

function LazyReaderEngine({
  book,
  fontProvider,
  width,
  height,
  appearance,
  layout = "single",
  pageTurnAnimation = "natural",
  rapidPageTurnEnabled = true,
  theme = DEFAULT_READER_THEME,
  topInset,
  bottomInset,
  imageCache,
  readerGeneration,
  toolbarVisible = false,
  uiMessages = DEFAULT_READER_UI_MESSAGES,
  initialPosition,
  loadResource,
  automaticPageTurnTuning = DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  reverseAutomaticPageTurnTuning = DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING,
  gesturePageTurnTuning = DEFAULT_GESTURE_PAGE_TURN_TUNING,
  reverseGesturePageTurnTuning = DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING,
  onCenterPress,
  onProgress,
  onSelectionChange,
  onSelectionMenuDismiss,
  onSelectionMenuRequest,
  onTurningChange,
}: LazyReaderEngineProps) {
  const turnConcurrency = useMemo(
    () =>
      calculatePageTurnConcurrency(
        automaticPageTurnTuning,
        PAGE_TURN_START_INTERVAL_MS,
        AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X,
      ),
    [automaticPageTurnTuning],
  );
  const nativePagerCompositorSupported =
    pageTurnAnimation === "natural" && nativePagerCompositorAvailable();
  const pagesPerView = layout === "spread" ? 2 : 1;
  const physicalPageWidth = layout === "spread" ? width * 0.5 : width;
  const progressPresentation: PageProgressPresentation = toolbarVisible
    ? "toolbar"
    : "reading";
  const visibleProgressDisplay = progressDisplayForToolbar(
    appearance.progressDisplay,
    toolbarVisible,
  );
  const decorationFontFamily =
    appearance.decorationFontFamily ?? appearance.fontFamily;
  const backend = useMemo(
    () => createSkiaParagraphBackend(fontProvider, theme, book.language),
    [book.language, fontProvider, theme],
  );
  const transientBackend = useMemo(
    () =>
      createTransientSkiaParagraphBackend(fontProvider, theme, book.language),
    [book.language, fontProvider, theme],
  );
  const typographyAppearance = useMemo<ReaderAppearance>(
    () => ({
      fontFamily: appearance.fontFamily,
      ...(appearance.bookFontFamilyNames
        ? { bookFontFamilyNames: appearance.bookFontFamilyNames }
        : {}),
      fontSize: appearance.fontSize,
      lineHeight: appearance.lineHeight,
      paragraphSpacing: appearance.paragraphSpacing,
      inlineMargin: appearance.inlineMargin,
      textAlignment: appearance.textAlignment,
      progressDisplay: "hidden",
    }),
    [
      appearance.fontFamily,
      appearance.bookFontFamilyNames,
      appearance.fontSize,
      appearance.inlineMargin,
      appearance.lineHeight,
      appearance.paragraphSpacing,
      appearance.textAlignment,
    ],
  );
  const spec = useMemo(
    () =>
      createReaderLayoutSpec(
        physicalPageWidth,
        height,
        typographyAppearance,
        topInset,
        bottomInset,
      ),
    [bottomInset, height, physicalPageWidth, topInset, typographyAppearance],
  );
  const paginationCache = useMemo(
    () => new Map<number, PaginationResult<SkParagraph>>(),
    [readerGeneration],
  );
  const sectionPageCountCache = useMemo(
    () =>
      new SectionPageCountCache({
        retainedPageCountFor: (sectionIndex) =>
          paginationCache.get(sectionIndex)?.pages.length,
        countUnretainedSection: (sectionIndex) =>
          countBookSectionPages(
            book,
            sectionIndex,
            spec,
            transientBackend,
            releaseTransientSkiaResources,
          ),
      }),
    [book, paginationCache, spec, transientBackend],
  );
  const pageDecorationCache = useMemo(
    () => new Map<string, CachedPageDecoration>(),
    [readerGeneration],
  );
  const pageCaptureCache = useMemo(
    () =>
      new CapturedPageCache<CapturedPage, PageCaptureMetadata>({
        targetByteBudget: PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET,
        hardByteBudget: PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
        disposeValue: disposeCapturedPageAfterPaint,
      }),
    [readerGeneration],
  );
  const turnCaptureLeasesRef = useRef(
    new Map<string, TurnCaptureLease<CapturedPage>>(),
  );
  const prepareScheduledTurnCaptureRef = useRef<
    (turn: ScheduledPageTurn) => "acquired" | "waiting" | "hard-capacity"
  >(() => "waiting");
  const authorizeScheduledTurnStartRef = useRef<
    (lane: number, turnId: string, startAtMs: number) => void
  >(() => {});
  const captureStartTimesRef = useRef(new Map<string, number>());
  const captureFeedDirectionRef = useRef<1 | -1 | undefined>(undefined);
  const deliveredTurnStartsRef = useRef<number[]>([]);
  const requestedTurnStartsRef = useRef<number[]>([]);
  const acceptedTurnStartsRef = useRef<number[]>([]);
  const laneTurnStartsRef = useRef<number[]>([]);
  const laneTurnStartedAtRef = useRef(new Map<string, number>());
  const laneTurnDurationsRef = useRef<number[]>([]);
  const lanePlaybackSpeedsRef = useRef<number[]>([]);
  const laneOutcomeDispatchLagsRef = useRef<number[]>([]);
  const pendingPresentationTurnIdsRef = useRef(new Set<string>());
  const presentationRequiredTurnIdsRef = useRef(new Set<string>());
  const presentedTurnIdsRef = useRef(new Set<string>());
  const presentationAckCountRef = useRef(0);
  const prematureLaneStartCountRef = useRef(0);
  const rejectedTurnCountsRef = useRef<PageTurnRejectionCounts>({
    capacity: 0,
    boundary: 0,
    direction: 0,
    capture: 0,
    other: 0,
  });
  const burstCompressedTurnIdsRef = useRef(new Set<string>());
  const nativePagerSubmittedTurnIdsRef = useRef(new Set<string>());
  const nativePagerPlaybackSpeedsRef = useRef(new Map<string, number>());
  const nativePagerStockedEntryIdsRef = useRef(new Set<string>());
  const nativePagerStockEntriesRef = useRef(
    new Map<string, NativePagerStockEntryRecord>(),
  );
  const nativePagerRecordingCache = useMemo(
    // Keep the complete current stock graph recorded. Sliding the graph by one
    // page should create only its new outer page instead of dozens of transient
    // SkPicture HostObjects that outrun Hermes finalization at 10 pps.
    () =>
      new NativePagerRecordingCache<RecordedPageCapture>(
        NATIVE_PAGER_RECORDING_CACHE_LIMIT,
        NATIVE_PAGER_RECORDING_CACHE_BYTE_BUDGET,
      ),
    [readerGeneration],
  );
  const nativePagerDirectTurnIdsRef = useRef(new Set<string>());
  const nativePagerGestureTurnIdsRef = useRef(new Set<string>());
  const nativePagerFirstFrameGateRef = useRef(new NativePagerFirstFrameGate());
  const nativePagerPresentationGateRef = useRef(
    new NativePagerPresentationGate(),
  );
  const nativePagerAcknowledgedPageKeyRef = useRef<string | undefined>(
    undefined,
  );
  const nativePagerReconciliationEpochsRef = useRef(new Set<string>());
  const [nativePagerDirectActiveCount, setNativePagerDirectActiveCount] =
    useState(0);
  const [nativePagerGestureActiveCount, setNativePagerGestureActiveCount] =
    useState(0);
  const nativeBenchmarkRevisionRef = useRef(0);
  const nativeBenchmarkActiveRef = useRef(false);
  const [nativeBenchmarkCommand, setNativeBenchmarkCommand] =
    useState<NativePageTurnBenchmarkCommand>();
  const [pageCaptureVersion, setPageCaptureVersion] = useState(0);
  const [imageVersion, setImageVersion] = useState(0);
  const ensurePagination = useCallback(
    (sectionIndex: number): PaginationResult<SkParagraph> => {
      const cached = paginationCache.get(sectionIndex);
      if (cached) {
        return cached;
      }
      const pagination = paginateBookSection(book, sectionIndex, spec, backend);
      paginationCache.set(sectionIndex, pagination);
      return pagination;
    },
    [backend, book, paginationCache, spec],
  );
  const pageCountForSection = useCallback(
    (sectionIndex: number) => sectionPageCountCache.countFor(sectionIndex),
    [sectionPageCountCache],
  );
  const estimatedSectionPageCounts = useMemo(
    () =>
      book.sections.map((section) => estimateSectionPageCount(section, spec)),
    [book.sections, spec],
  );
  const [resolvedSectionPageCounts, setResolvedSectionPageCounts] = useState<{
    readonly cache: SectionPageCountCache;
    readonly estimates: readonly number[];
    readonly counts: readonly number[];
  }>();
  const sectionPageCounts =
    resolvedSectionPageCounts?.cache === sectionPageCountCache &&
    resolvedSectionPageCounts.estimates === estimatedSectionPageCounts
      ? resolvedSectionPageCounts.counts
      : estimatedSectionPageCounts;
  useEffect(() => {
    if (!shouldResolveExactPublicationPageCounts(book.sections)) {
      return;
    }
    let cancelled = false;
    let frame = 0;
    let sectionIndex = 0;
    const counts = [...estimatedSectionPageCounts];
    const countNextSections = () => {
      if (cancelled) {
        return;
      }
      const startedAt = performanceNow();
      do {
        counts[sectionIndex] = pageCountForSection(sectionIndex);
        sectionIndex += 1;
      } while (
        sectionIndex < counts.length &&
        performanceNow() - startedAt < 4
      );
      if (sectionIndex >= counts.length) {
        setResolvedSectionPageCounts({
          cache: sectionPageCountCache,
          estimates: estimatedSectionPageCounts,
          counts,
        });
        return;
      }
      frame = requestAnimationFrame(countNextSections);
    };
    if (counts.length === 0) {
      setResolvedSectionPageCounts({
        cache: sectionPageCountCache,
        estimates: estimatedSectionPageCounts,
        counts,
      });
    } else {
      frame = requestAnimationFrame(countNextSections);
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    book.sections,
    estimatedSectionPageCounts,
    pageCountForSection,
    sectionPageCountCache,
  ]);
  const adjacent = useCallback(
    (address: PageAddress, direction: 1 | -1) =>
      adjacentViewAddress(
        address,
        direction,
        pagesPerView,
        book.sections.length,
        pageCountForSection,
      ),
    [book.sections.length, pageCountForSection, pagesPerView],
  );
  const addressesForView = useCallback(
    (address: PageAddress) =>
      pageAddressesFrom(
        address,
        pagesPerView,
        book.sections.length,
        pageCountForSection,
      ),
    [book.sections.length, pageCountForSection, pagesPerView],
  );
  const captureSlotsForView = useCallback(
    (viewStart: PageAddress): readonly (PageCaptureMetadata | undefined)[] =>
      addressesForView(viewStart).map((address, slot) => ({
        address,
        decorationAddress: viewStart,
        slot,
      })),
    [addressesForView],
  );
  const progressDecorationForAddress = useCallback(
    (address: PageAddress): PageProgressDecoration => {
      const resolvedOrEstimatedPageCounts = sectionPageCounts.map(
        (estimatedCount, sectionIndex) =>
          sectionPageCountCache.resolvedCountFor(sectionIndex) ??
          estimatedCount,
      );
      return createPageProgressDecoration({
        address,
        bookTitle: book.title,
        sectionTitle: book.title,
        sectionPageCounts: resolvedOrEstimatedPageCounts,
        currentSectionPageCount: pageCountForSection(address.sectionIndex),
        pagesPerView,
      });
    },
    [
      book.title,
      pageCountForSection,
      pagesPerView,
      sectionPageCountCache,
      sectionPageCounts,
    ],
  );
  const pageDecorationForAddress = useCallback(
    (address: PageAddress): SkiaPageDecoration => {
      const model = progressDecorationForAddress(address);
      const key = JSON.stringify([
        address.sectionIndex,
        address.pageIndex,
        model.sectionTitle,
        model.pageNumber,
        model.pageCount,
        decorationFontFamily,
        appearance.inlineMargin,
        pagesPerView,
        width,
        height,
        topInset,
        bottomInset,
        theme.name,
        theme.colorScheme,
        theme.decoration,
        book.language,
      ]);
      const cached = pageDecorationCache.get(key);
      if (cached) {
        pageDecorationCache.delete(key);
        pageDecorationCache.set(key, cached);
        return cached.decoration;
      }
      const decoration = createSkiaPageDecoration({
        model,
        fontProvider,
        fontFamily: decorationFontFamily,
        width,
        height,
        inlineMargin: appearance.inlineMargin,
        pagesPerView,
        topInset,
        bottomInset,
        theme,
        locale: book.language,
      });
      pageDecorationCache.set(key, { decoration });
      while (pageDecorationCache.size > PAGE_DECORATION_CACHE_LIMIT) {
        const oldestKey = pageDecorationCache.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        const oldest = pageDecorationCache.get(oldestKey);
        pageDecorationCache.delete(oldestKey);
        if (oldest) {
          disposeSkiaPageDecorationAfterPaint(oldest.decoration);
        }
      }
      return decoration;
    },
    [
      appearance.inlineMargin,
      book.language,
      bottomInset,
      decorationFontFamily,
      fontProvider,
      height,
      pageDecorationCache,
      pagesPerView,
      progressDecorationForAddress,
      theme,
      topInset,
      width,
    ],
  );

  const initialAddress = useMemo<PageAddress>(() => {
    const sectionIndex = initialPosition
      ? Math.max(
          0,
          book.sections.findIndex(
            (section) => section.id === initialPosition.sectionId,
          ),
        )
      : 0;
    const pagination = ensurePagination(sectionIndex);
    return {
      sectionIndex,
      pageIndex: initialPosition
        ? (pagination.locationIndex.pageFor(initialPosition) ?? 0)
        : 0,
    };
  }, [book.sections, ensurePagination, initialPosition]);
  const transitionCounter = useRef(0);
  const createTurnId = useCallback(() => {
    transitionCounter.current += 1;
    return `section-turn:${transitionCounter.current}`;
  }, []);
  const turnScheduler = useMemo<PageTurnScheduler>(
    () => ({
      adjacent,
      createId: createTurnId,
      maximumConcurrentTurns: turnConcurrency.maximumConcurrentTurns,
      maximumConcurrentTapTurns: turnConcurrency.maximumConcurrentTapTurns,
      minimumTurnIntervalMs: turnConcurrency.minimumTurnIntervalMs,
    }),
    [
      adjacent,
      createTurnId,
      turnConcurrency.maximumConcurrentTapTurns,
      turnConcurrency.maximumConcurrentTurns,
      turnConcurrency.minimumTurnIntervalMs,
    ],
  );
  const [storedReaderGeneration, setStoredReaderGeneration] = useState(() =>
    createReaderEngineGeneration(readerGeneration, initialAddress),
  );
  const activeReaderGeneration = reconcileReaderEngineGeneration(
    storedReaderGeneration,
    readerGeneration,
    initialAddress,
  );
  if (activeReaderGeneration !== storedReaderGeneration) {
    setStoredReaderGeneration(activeReaderGeneration);
  }
  const readerState = activeReaderGeneration.scheduler;
  const readerGenerationRef = useRef(readerGeneration);
  readerGenerationRef.current = readerGeneration;
  const readerGenerationIsCurrent = useCallback(
    () => readerGenerationRef.current === readerGeneration,
    [readerGeneration],
  );
  const [noteReturnAnchor, setNoteReturnAnchor] = useState<
    NoteReturnAnchor | undefined
  >();
  const clearNoteReturnAnchor = useCallback(
    () =>
      setNoteReturnAnchor((current) =>
        reduceNoteReturnAnchor(current, { type: "cleared" }),
      ),
    [],
  );
  const selectionDocument = useMemo(
    () => createTextSelectionDocument(book),
    [book],
  );
  const [storedTextSelection, setStoredTextSelection] = useState<{
    readonly generation: string;
    readonly selection: TextSelection | undefined;
  }>(() => ({
    generation: readerGeneration,
    selection: undefined,
  }));
  const textSelection =
    storedTextSelection.generation === readerGeneration
      ? storedTextSelection.selection
      : undefined;
  if (storedTextSelection.generation !== readerGeneration) {
    setStoredTextSelection({
      generation: readerGeneration,
      selection: undefined,
    });
  }
  const selectingText = textSelection !== undefined;
  const textSelectionRef = useRef(textSelection);
  textSelectionRef.current = textSelection;
  const selectionMenuGenerationRef = useRef(readerGeneration);
  useEffect(() => {
    if (selectionMenuGenerationRef.current === readerGeneration) {
      return;
    }
    selectionMenuGenerationRef.current = readerGeneration;
    onSelectionMenuDismiss?.();
  }, [onSelectionMenuDismiss, readerGeneration]);
  const commitTextSelection = useCallback(
    (selection: TextSelection) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      textSelectionRef.current = selection;
      setStoredTextSelection({
        generation: readerGeneration,
        selection,
      });
    },
    [readerGeneration, readerGenerationIsCurrent],
  );
  const clearTextSelection = useCallback(() => {
    textSelectionRef.current = undefined;
    setStoredTextSelection({
      generation: readerGenerationRef.current,
      selection: undefined,
    });
    onSelectionMenuDismiss?.();
  }, [onSelectionMenuDismiss]);
  // Native Gesture Handler can deliver begin and release to the RN thread
  // inside one React render interval. Keep scheduling ownership synchronous
  // so a short flick can release the exact turn it just claimed instead of
  // reading the previous render's driverTurn.
  const readerStateRef = useRef(readerState);
  readerStateRef.current = readerState;
  const mutateReaderState = useCallback(
    (
      update: (current: PageTurnSchedulerState) => PageTurnSchedulerState,
    ): PageTurnSchedulerState => {
      if (!readerGenerationIsCurrent()) {
        return readerStateRef.current;
      }
      const current = readerStateRef.current;
      const next = update(current);
      if (next !== current) {
        readerStateRef.current = next;
        setStoredReaderGeneration((stored) =>
          stored.key === readerGeneration
            ? {
                key: readerGeneration,
                scheduler: next,
              }
            : stored,
        );
      }
      return next;
    },
    [readerGeneration, readerGenerationIsCurrent],
  );
  const pageAddressForPosition = useCallback(
    (position: BookPosition): PageAddress | undefined => {
      const sectionIndex = book.sections.findIndex(
        (section) => section.id === position.sectionId,
      );
      if (sectionIndex < 0) {
        return undefined;
      }
      const pageIndex =
        ensurePagination(sectionIndex).locationIndex.pageFor(position);
      return pageIndex === undefined ? undefined : { sectionIndex, pageIndex };
    },
    [book.sections, ensurePagination],
  );
  const jumpToPosition = useCallback(
    (position: BookPosition): boolean => {
      if (
        !readerGenerationIsCurrent() ||
        readerStateRef.current.turns.length > 0
      ) {
        return false;
      }
      const target = pageAddressForPosition(position);
      if (!target) {
        return false;
      }
      captureFeedDirectionRef.current = undefined;
      mutateReaderState(() => createPageTurnSchedulerState(target));
      return true;
    },
    [mutateReaderState, pageAddressForPosition, readerGenerationIsCurrent],
  );
  const handleLinkPress = useCallback(
    (region: PageLinkRegion) => {
      if (region.link.kind === "note-backlink" && noteReturnAnchor) {
        if (jumpToPosition(noteReturnAnchor.position)) {
          clearNoteReturnAnchor();
        }
        return;
      }
      if (!jumpToPosition(region.link.target)) {
        return;
      }
      if (region.link.kind === "note-reference") {
        setNoteReturnAnchor((current) =>
          reduceNoteReturnAnchor(current, {
            type: "note-opened",
            position: region.source,
            label: region.link.label,
            ...(region.link.noteKind ? { noteKind: region.link.noteKind } : {}),
          }),
        );
      } else {
        clearNoteReturnAnchor();
      }
    },
    [clearNoteReturnAnchor, jumpToPosition, noteReturnAnchor],
  );
  const returnToNoteReference = useCallback(() => {
    if (noteReturnAnchor && jumpToPosition(noteReturnAnchor.position)) {
      clearNoteReturnAnchor();
    }
  }, [clearNoteReturnAnchor, jumpToPosition, noteReturnAnchor]);

  useEffect(
    () => () => {
      turnCaptureLeasesRef.current.clear();
      captureStartTimesRef.current.clear();
      pageCaptureCache.clear(retireCapturedPageAfterPaint);
      for (const pagination of paginationCache.values()) {
        retirePaginationAfterPaint(pagination);
      }
      paginationCache.clear();
      for (const cached of pageDecorationCache.values()) {
        retireSkiaPageDecorationAfterPaint(cached.decoration);
      }
      pageDecorationCache.clear();
      nativePagerRecordingCache.clear();
    },
    [
      nativePagerRecordingCache,
      pageCaptureCache,
      pageDecorationCache,
      paginationCache,
    ],
  );

  useEffect(() => {
    const center = readerState.settled.sectionIndex;
    for (
      let sectionIndex = Math.max(0, center - 1);
      sectionIndex <= Math.min(book.sections.length - 1, center + 1);
      sectionIndex += 1
    ) {
      ensurePagination(sectionIndex);
    }
    for (const [sectionIndex, pagination] of paginationCache) {
      if (Math.abs(sectionIndex - center) > 1) {
        disposePaginationAfterPaint(pagination);
        paginationCache.delete(sectionIndex);
      }
    }
  }, [
    book.sections.length,
    ensurePagination,
    paginationCache,
    readerState.settled.sectionIndex,
  ]);

  const settleTurn = useCallback(
    (turnId: string) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      mutateReaderState((current) =>
        resolveScheduledPageTurn(current, turnId, true),
      );
      setNoteReturnAnchor((current) =>
        reduceNoteReturnAnchor(current, { type: "page-turned" }),
      );
    },
    [mutateReaderState, readerGenerationIsCurrent],
  );

  const activeTurns = readerState.turns;
  const hasActivePageTurns = hasRunningPageTurns(readerState);
  const driverTurn = activeTurns.find(
    (turn) => turn.interactive || turn.handoffPending,
  );
  const driverTurnRef = useRef(driverTurn);
  driverTurnRef.current = driverTurn;
  const handedOffTurnIdsRef = useRef(new Set<string>());
  const nativeInteractiveTurnIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    handedOffTurnIdsRef.current.clear();
    nativeInteractiveTurnIdRef.current = undefined;
    captureFeedDirectionRef.current = undefined;
    deliveredTurnStartsRef.current = [];
    requestedTurnStartsRef.current = [];
    acceptedTurnStartsRef.current = [];
    laneTurnStartsRef.current = [];
    laneTurnStartedAtRef.current.clear();
    laneTurnDurationsRef.current = [];
    lanePlaybackSpeedsRef.current = [];
    laneOutcomeDispatchLagsRef.current = [];
    pendingPresentationTurnIdsRef.current.clear();
    presentationRequiredTurnIdsRef.current.clear();
    presentedTurnIdsRef.current.clear();
    presentationAckCountRef.current = 0;
    prematureLaneStartCountRef.current = 0;
    rejectedTurnCountsRef.current = {
      capacity: 0,
      boundary: 0,
      direction: 0,
      capture: 0,
      other: 0,
    };
    burstCompressedTurnIdsRef.current.clear();
    nativePagerSubmittedTurnIdsRef.current.clear();
    nativePagerPlaybackSpeedsRef.current.clear();
    nativePagerStockedEntryIdsRef.current.clear();
    nativePagerStockEntriesRef.current.clear();
    nativePagerDirectTurnIdsRef.current.clear();
    nativePagerGestureTurnIdsRef.current.clear();
    nativePagerFirstFrameGateRef.current.reset();
    nativePagerPresentationGateRef.current.reset();
    nativePagerAcknowledgedPageKeyRef.current = undefined;
    nativePagerReconciliationEpochsRef.current.clear();
    setNativePagerDirectActiveCount(0);
    setNativePagerGestureActiveCount(0);
    nativeBenchmarkActiveRef.current = false;
  }, [readerGeneration]);
  useEffect(() => {
    const retainedTurnIds = new Set(activeTurns.map((turn) => turn.id));
    const retainedDiagnosticTurnIds = new Set([
      ...retainedTurnIds,
      ...nativePagerDirectTurnIdsRef.current,
    ]);
    for (const turnId of handedOffTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        handedOffTurnIdsRef.current.delete(turnId);
      }
    }
    for (const turnId of pendingPresentationTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        pendingPresentationTurnIdsRef.current.delete(turnId);
      }
    }
    for (const turnId of presentationRequiredTurnIdsRef.current) {
      if (!retainedDiagnosticTurnIds.has(turnId)) {
        presentationRequiredTurnIdsRef.current.delete(turnId);
      }
    }
    for (const turnId of presentedTurnIdsRef.current) {
      if (!retainedDiagnosticTurnIds.has(turnId)) {
        presentedTurnIdsRef.current.delete(turnId);
      }
    }
    for (const turnId of laneTurnStartedAtRef.current.keys()) {
      if (!retainedDiagnosticTurnIds.has(turnId)) {
        laneTurnStartedAtRef.current.delete(turnId);
      }
    }
    for (const turnId of nativePagerSubmittedTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        nativePagerSubmittedTurnIdsRef.current.delete(turnId);
        nativePagerPlaybackSpeedsRef.current.delete(turnId);
      }
    }
  }, [activeTurns, nativePagerDirectActiveCount]);
  const hasAnyActivePageTurns =
    hasActivePageTurns || nativePagerDirectActiveCount > 0;
  useEffect(() => {
    onTurningChange?.(hasAnyActivePageTurns);
  }, [hasAnyActivePageTurns, onTurningChange]);
  useEffect(() => {
    onSelectionChange?.(selectingText);
  }, [onSelectionChange, selectingText]);
  useEffect(() => {
    if (hasAnyActivePageTurns && textSelectionRef.current) {
      clearTextSelection();
    }
  }, [clearTextSelection, hasAnyActivePageTurns]);
  useEffect(
    () => () => {
      onTurningChange?.(false);
      onSelectionChange?.(false);
      onSelectionMenuDismiss?.();
    },
    [onSelectionChange, onSelectionMenuDismiss, onTurningChange],
  );
  const readerViewRef = useRef<View>(null);
  const readerCanvasRef = useCanvasRef();
  const [nativePagerCanvasId, setNativePagerCanvasId] = useState<number>();
  const [nativePagerReady, setNativePagerReady] = useState(false);
  const nativePagerCompositorEnabled =
    nativePagerCompositorSupported && nativePagerReady;
  const scheduledTurnScheduler = useMemo<PageTurnScheduler>(
    () =>
      nativePagerCompositorEnabled
        ? {
            ...turnScheduler,
            maximumConcurrentTapTurns:
              NATIVE_PAGER_FALLBACK_MAXIMUM_CONCURRENT_TAP_TURNS,
          }
        : turnScheduler,
    [nativePagerCompositorEnabled, turnScheduler],
  );
  const readerOriginRef = useRef({ x: 0, y: 0 });
  const measureReaderOrigin = useCallback(() => {
    readerViewRef.current?.measureInWindow((x, y) => {
      readerOriginRef.current = { x, y };
    });
  }, []);
  const cancelInteractiveTurn = useCallback(
    (turnId: string) => {
      mutateReaderState((current) =>
        resolveScheduledPageTurn(current, turnId, false),
      );
    },
    [mutateReaderState],
  );
  const completeNativeTurn = useCallback(
    (outcome: number) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      const pendingInteractiveTurnId = nativeInteractiveTurnIdRef.current;
      const current =
        driverTurnRef.current ??
        (pendingInteractiveTurnId
          ? readerStateRef.current.turns.find(
              (turn) => turn.id === pendingInteractiveTurnId,
            )
          : undefined);
      if (
        !current ||
        current.handoffPending ||
        handedOffTurnIdsRef.current.has(current.id)
      ) {
        return;
      }
      if (pendingInteractiveTurnId === current.id) {
        nativeInteractiveTurnIdRef.current = undefined;
      }
      if (outcome > 0) {
        settleTurn(current.id);
      } else {
        cancelInteractiveTurn(current.id);
      }
    },
    [cancelInteractiveTurn, readerGenerationIsCurrent, settleTurn],
  );
  const completeScheduledTurn = useCallback(
    (turnId: string, outcome: number, completedAtMs: number) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      const startedAtMs = laneTurnStartedAtRef.current.get(turnId);
      laneTurnStartedAtRef.current.delete(turnId);
      if (startedAtMs !== undefined) {
        laneTurnDurationsRef.current.push(
          Math.max(0, completedAtMs - startedAtMs),
        );
      }
      laneOutcomeDispatchLagsRef.current.push(
        Math.max(0, Date.now() - completedAtMs),
      );
      presentationRequiredTurnIdsRef.current.delete(turnId);
      presentedTurnIdsRef.current.delete(turnId);
      handedOffTurnIdsRef.current.delete(turnId);
      if (outcome > 0) {
        settleTurn(turnId);
      } else {
        cancelInteractiveTurn(turnId);
      }
    },
    [cancelInteractiveTurn, readerGenerationIsCurrent, settleTurn],
  );
  const markScheduledTurnLanePrepared = useCallback(
    (turnId: string) => {
      mutateReaderState((current) =>
        markScheduledPageTurnLaneReady(current, turnId),
      );
    },
    [mutateReaderState],
  );
  const recordScheduledTurnLaneStarted = useCallback(
    (turnId: string, startedAtMs: number, playbackSpeed: number) => {
      if (!presentationRequiredTurnIdsRef.current.has(turnId)) {
        return;
      }
      if (!presentedTurnIdsRef.current.has(turnId)) {
        prematureLaneStartCountRef.current += 1;
      }
      presentedTurnIdsRef.current.delete(turnId);
      laneTurnStartedAtRef.current.set(turnId, startedAtMs);
      laneTurnStartsRef.current.push(startedAtMs);
      lanePlaybackSpeedsRef.current.push(playbackSpeed);
    },
    [],
  );
  const requestProgrammaticTurn = useCallback(
    (
      requestedDirection: 1 | -1,
      requestedAtMs: number,
      motion: "tap" | "rapid",
    ) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      if (pageTurnAnimation === "none") {
        let turned = false;
        mutateReaderState((current) => {
          const next = turnPageImmediately(
            current,
            requestedDirection,
            adjacent,
          );
          turned = next !== current;
          return next;
        });
        if (turned) {
          setNoteReturnAnchor((current) =>
            reduceNoteReturnAnchor(current, { type: "page-turned" }),
          );
        }
        return;
      }
      deliveredTurnStartsRef.current.push(Date.now());
      requestedTurnStartsRef.current.push(requestedAtMs);
      let accepted = false;
      mutateReaderState((current) => {
        const next =
          motion === "rapid"
            ? requestScheduledRapidPageTurn(
                current,
                requestedDirection,
                scheduledTurnScheduler,
                requestedAtMs,
              )
            : requestScheduledPageTurn(
                current,
                requestedDirection,
                scheduledTurnScheduler,
                requestedAtMs,
              );
        if (next.turns.length <= current.turns.length) {
          const lastTurn = current.turns.at(-1);
          const activeTapTurns = current.turns.filter((turn) =>
            isProgrammaticPageTurnMotion(turn.motion),
          ).length;
          if (
            current.turns.length >=
              (scheduledTurnScheduler.maximumConcurrentTurns ??
                PAGE_TURN_LANE_HARD_LIMIT) ||
            activeTapTurns >=
              (scheduledTurnScheduler.maximumConcurrentTapTurns ??
                PAGE_TURN_LANE_HARD_LIMIT)
          ) {
            rejectedTurnCountsRef.current.capacity += 1;
          } else if (
            lastTurn !== undefined &&
            lastTurn.direction !== requestedDirection
          ) {
            rejectedTurnCountsRef.current.direction += 1;
          } else {
            const source = lastTurn?.to ?? current.settled;
            if (samePageAddress(adjacent(source, requestedDirection), source)) {
              rejectedTurnCountsRef.current.boundary += 1;
            } else {
              rejectedTurnCountsRef.current.other += 1;
            }
          }
          return next;
        }
        const addedTurn = next.turns.at(-1)!;
        if (
          !nativePagerCompositorEnabled &&
          prepareScheduledTurnCaptureRef.current(addedTurn) === "hard-capacity"
        ) {
          rejectedTurnCountsRef.current.capture += 1;
          return current;
        }
        accepted = true;
        return next;
      });
      if (accepted) {
        captureFeedDirectionRef.current = requestedDirection;
        acceptedTurnStartsRef.current.push(requestedAtMs);
      }
    },
    [
      adjacent,
      mutateReaderState,
      nativePagerCompositorEnabled,
      pageTurnAnimation,
      readerGenerationIsCurrent,
      scheduledTurnScheduler,
    ],
  );
  const requestTurn = useCallback(
    (direction: 1 | -1, requestedAtMs = Date.now()) =>
      requestProgrammaticTurn(direction, requestedAtMs, "tap"),
    [requestProgrammaticTurn],
  );
  const requestRapidTurn = useCallback(
    (direction: 1 | -1, requestedAtMs = Date.now()) =>
      requestProgrammaticTurn(direction, requestedAtMs, "rapid"),
    [requestProgrammaticTurn],
  );
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    const benchmarkGlobal = globalThis as typeof globalThis &
      PersimmonPageTurnBenchmarkGlobal;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let summaryTimer: ReturnType<typeof setTimeout> | undefined;
    const runBenchmark = (
      count = 50,
      intervalMs = 100,
      direction: 1 | -1 = 1,
    ): boolean => {
      if (readerStateRef.current.turns.length > 0) {
        return false;
      }
      const turnCount = Math.min(200, Math.max(1, Math.floor(count)));
      const cadenceMs = Math.max(1, Math.floor(intervalMs));
      const turnDirection: 1 | -1 = direction < 0 ? -1 : 1;
      const nativeCanvas = readerCanvasRef.current;
      if (nativePagerCompositorEnabled && !nativeCanvas) {
        return false;
      }
      if (nativePagerCompositorEnabled) {
        configureNativePagerInput(nativeCanvas, false);
      }
      nativeBenchmarkActiveRef.current = true;
      requestedTurnStartsRef.current = [];
      acceptedTurnStartsRef.current = [];
      laneTurnStartsRef.current = [];
      laneTurnStartedAtRef.current.clear();
      laneTurnDurationsRef.current = [];
      lanePlaybackSpeedsRef.current = [];
      laneOutcomeDispatchLagsRef.current = [];
      deliveredTurnStartsRef.current = [];
      presentationRequiredTurnIdsRef.current.clear();
      presentedTurnIdsRef.current.clear();
      presentationAckCountRef.current = 0;
      prematureLaneStartCountRef.current = 0;
      rejectedTurnCountsRef.current = {
        capacity: 0,
        boundary: 0,
        direction: 0,
        capture: 0,
        other: 0,
      };
      if (summaryTimer !== undefined) {
        clearTimeout(summaryTimer);
      }
      nativeBenchmarkRevisionRef.current += 1;
      setNativeBenchmarkCommand({
        revision: nativeBenchmarkRevisionRef.current,
        count: turnCount,
        intervalMs: cadenceMs,
        direction: turnDirection,
      });
      if (
        nativePagerCompositorEnabled &&
        !runNativePagerBenchmark(
          nativeCanvas,
          turnCount,
          cadenceMs,
          turnDirection,
        )
      ) {
        nativeBenchmarkActiveRef.current = false;
        setNativeBenchmarkCommand(undefined);
        return false;
      }
      summaryTimer = setTimeout(
        () => {
          summaryTimer = undefined;
          const laneStarts = laneTurnStartsRef.current;
          const laneSpanMs =
            laneStarts.length > 1 ? laneStarts.at(-1)! - laneStarts[0]! : 0;
          const laneGapStats = sampleDurationStats(
            laneStarts
              .slice(1)
              .map((startedAt, index) => startedAt - laneStarts[index]!),
          );
          const laneGaps = laneStarts
            .slice(1)
            .map((startedAt, index) => startedAt - laneStarts[index]!);
          const deliveryGaps = deliveredTurnStartsRef.current
            .slice(1)
            .map(
              (deliveredAt, index) =>
                deliveredAt - deliveredTurnStartsRef.current[index]!,
            );
          const maximumLaneGapMs =
            laneStarts.length > 1
              ? Math.max(
                  ...laneStarts
                    .slice(1)
                    .map((startedAt, index) => startedAt - laneStarts[index]!),
                )
              : 0;
          const durationStats = sampleDurationStats(
            laneTurnDurationsRef.current,
          );
          const outcomeDispatchLagStats = sampleDurationStats(
            laneOutcomeDispatchLagsRef.current,
          );
          const playbackSpeedStats = sampleDurationStats(
            lanePlaybackSpeedsRef.current,
          );
          const minimumPlaybackSpeed =
            lanePlaybackSpeedsRef.current.length > 0
              ? Math.min(...lanePlaybackSpeedsRef.current)
              : 0;
          const rejected = rejectedTurnCountsRef.current;
          console.info(
            `[Persimmon][page-turn-burst-summary] requested=${requestedTurnStartsRef.current.length}/${turnCount} delivered=${deliveredTurnStartsRef.current.length}/${turnCount} accepted=${acceptedTurnStartsRef.current.length}/${turnCount} presented=${presentationAckCountRef.current}/${turnCount} animations=${laneStarts.length}/${turnCount} premature=${prematureLaneStartCountRef.current} rejected=capacity:${rejected.capacity},boundary:${rejected.boundary},direction:${rejected.direction},capture:${rejected.capture},other:${rejected.other} durationAvg=${durationStats.averageMs.toFixed(1)}ms durationP95=${durationStats.p95Ms.toFixed(1)}ms speedMin=${minimumPlaybackSpeed.toFixed(2)}x speedAvg=${playbackSpeedStats.averageMs.toFixed(2)}x rnTailAvg=${outcomeDispatchLagStats.averageMs.toFixed(1)}ms rnTailP95=${outcomeDispatchLagStats.p95Ms.toFixed(1)}ms laneGapP95=${laneGapStats.p95Ms.toFixed(1)}ms laneGapMax=${maximumLaneGapMs.toFixed(1)}ms laneSpan=${laneSpanMs.toFixed(1)}ms`,
          );
          console.info(
            `[Persimmon][page-turn-burst-gaps] delivered=${deliveryGaps.map((gap) => gap.toFixed(1)).join(",")} native=${laneGaps.map((gap) => gap.toFixed(1)).join(",")}`,
          );
          nativeBenchmarkActiveRef.current = false;
          // Keep physical gestures disabled until the measurement snapshot is
          // complete so device taps cannot contaminate benchmark counters.
          setNativeBenchmarkCommand(undefined);
        },
        turnCount * cadenceMs + 2_000,
      );
      return true;
    };
    benchmarkGlobal.__persimmonRun10Pps = runBenchmark;
    const configuredTurnCount = Number(
      process.env.EXPO_PUBLIC_PERSIMMON_10PPS_BENCHMARK_TURNS ?? 0,
    );
    if (Number.isFinite(configuredTurnCount) && configuredTurnCount > 0) {
      const configuredIntervalMs = Number(
        process.env.EXPO_PUBLIC_PERSIMMON_10PPS_BENCHMARK_INTERVAL_MS ?? 100,
      );
      const configuredDirection =
        Number(
          process.env.EXPO_PUBLIC_PERSIMMON_10PPS_BENCHMARK_DIRECTION ?? 1,
        ) < 0
          ? -1
          : 1;
      startupTimer = setTimeout(() => {
        startupTimer = undefined;
        runBenchmark(
          configuredTurnCount,
          configuredIntervalMs,
          configuredDirection,
        );
      }, 2_000);
    }
    return () => {
      if (startupTimer !== undefined) {
        clearTimeout(startupTimer);
      }
      if (summaryTimer !== undefined) {
        clearTimeout(summaryTimer);
      }
      nativeBenchmarkActiveRef.current = false;
      if (benchmarkGlobal.__persimmonRun10Pps === runBenchmark) {
        delete benchmarkGlobal.__persimmonRun10Pps;
      }
    };
  }, []);
  const requestGestureTurn = useCallback(
    (input: PageGestureReleaseInput) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      const settlingIncomingPage =
        layout === "single" && input.direction === -1;
      const coreTuning = pageTurnTuningForLayoutDirection(
        gestureTuningForCore(gesturePageTurnTuning),
        reverseGestureTuningForCore(reverseGesturePageTurnTuning),
        input.direction,
        layout === "spread",
      );
      if (pageGestureModeForStart(input.startBookX) !== "full") {
        return;
      }
      const release = (() => {
        if (input.releasedGesture) {
          return input.releasedGesture;
        }
        const fingerX = anchoredGestureFingerX(
          input.startBookX,
          input.currentBookX,
        );
        if (
          !shouldCommitTurn(
            {
              fingerX,
              throwVelocity: input.throwVelocity,
              throwAcceleration: input.throwAcceleration,
              pageWeight: coreTuning.pageWeight,
            },
            coreTuning,
          )
        ) {
          return undefined;
        }
        return {
          pressedEdgeX: Math.max(MIN_PRESSED_EDGE_X, fingerX),
          heldRollTilt: gestureLiftRotationForFingerX(fingerX),
          speedScale: gestureTurnSpeedScale(input.throwVelocity, coreTuning),
          turnProgress: postHingeTurnProgressForFingerX(
            fingerX,
            input.startBookX,
          ),
          settlingProgress: settlingIncomingPage
            ? incomingPageDragProgress(input.turnProgress, coreTuning)
            : input.turnProgress,
        };
      })();
      if (!release) {
        return;
      }
      captureFeedDirectionRef.current = input.direction;
      if (pageTurnAnimation === "none") {
        requestTurn(input.direction);
        return true;
      }
      if (input.interactive) {
        const interactiveTurnId =
          nativeInteractiveTurnIdRef.current ??
          (driverTurnRef.current?.interactive
            ? driverTurnRef.current.id
            : undefined);
        if (!interactiveTurnId) {
          return false;
        }
        handedOffTurnIdsRef.current.add(interactiveTurnId);
        nativeInteractiveTurnIdRef.current = undefined;
        mutateReaderState((current) =>
          handoffScheduledInteractivePageTurn(
            current,
            interactiveTurnId,
            release,
            true,
          ),
        );
        return true;
      }
      mutateReaderState((current) =>
        requestScheduledGesturePageTurn(
          current,
          input.direction,
          release,
          turnScheduler,
        ),
      );
      return true;
    },
    [
      gesturePageTurnTuning,
      layout,
      reverseGesturePageTurnTuning,
      mutateReaderState,
      pageTurnAnimation,
      readerGenerationIsCurrent,
      requestTurn,
      turnScheduler,
    ],
  );
  const beginNativeInteractiveTurn = useCallback(
    (requestedDirection: 1 | -1) => {
      if (!readerGenerationIsCurrent()) {
        return;
      }
      const scheduled = mutateReaderState((current) =>
        beginScheduledInteractivePageTurn(
          current,
          requestedDirection,
          turnScheduler,
        ),
      );
      const active = scheduled.turns.at(-1);
      nativeInteractiveTurnIdRef.current =
        active?.interactive && active.direction === requestedDirection
          ? active.id
          : undefined;
      if (nativeInteractiveTurnIdRef.current) {
        captureFeedDirectionRef.current = requestedDirection;
      }
    },
    [mutateReaderState, readerGenerationIsCurrent, turnScheduler],
  );
  const settledAddresses = useMemo(
    () => addressesForView(readerState.settled),
    [addressesForView, readerState.settled],
  );
  const settledLinkHits = useMemo<readonly ReaderLinkHit[]>(
    () =>
      settledAddresses.flatMap((address, slot) => {
        const page = ensurePagination(address.sectionIndex).pages[
          address.pageIndex
        ];
        return (page?.links ?? []).map((region, regionIndex) => ({
          key: [
            address.sectionIndex,
            address.pageIndex,
            region.source.blockId,
            region.source.offset,
            regionIndex,
          ].join(":"),
          region,
          frame: expandedLinkHitFrame(
            region,
            slot * physicalPageWidth,
            physicalPageWidth,
            height,
          ),
        }));
      }),
    [ensurePagination, height, physicalPageWidth, settledAddresses],
  );
  const visibleTextPages = useMemo(
    () =>
      settledAddresses.flatMap((address, slot) => {
        const pagination = ensurePagination(address.sectionIndex);
        const page = pagination.pages[address.pageIndex];
        return page
          ? [
              {
                page,
                pagination,
                offsetX: slot * physicalPageWidth,
              },
            ]
          : [];
      }),
    [ensurePagination, physicalPageWidth, settledAddresses],
  );
  const selectionGeometry = useMemo(
    () =>
      textSelection
        ? textSelectionGeometry(
            selectionDocument,
            textSelection,
            visibleTextPages,
          )
        : undefined,
    [selectionDocument, textSelection, visibleTextPages],
  );
  const showTextSelectionMenu = useCallback(
    (selection: TextSelection) => {
      const geometry = textSelectionGeometry(
        selectionDocument,
        selection,
        visibleTextPages,
      );
      const text = selectedText(selectionDocument, selection);
      if (!geometry || text.length === 0) {
        return;
      }
      const origin = readerOriginRef.current;
      onSelectionMenuRequest?.({
        text,
        rectInWindow: {
          x: origin.x + geometry.bounds.x,
          y: origin.y + geometry.bounds.y,
          width: geometry.bounds.width,
          height: geometry.bounds.height,
        },
      });
    },
    [onSelectionMenuRequest, selectionDocument, visibleTextPages],
  );
  const handleTextSelectionTap = useCallback(
    (localX: number, localY: number, absoluteX: number, absoluteY: number) => {
      const current = textSelectionRef.current;
      if (!current) {
        return;
      }
      readerOriginRef.current = {
        x: absoluteX - localX,
        y: absoluteY - localY,
      };
      const geometry = textSelectionGeometry(
        selectionDocument,
        current,
        visibleTextPages,
      );
      if (geometry && textSelectionContainsPoint(geometry, localX, localY, 2)) {
        showTextSelectionMenu(current);
        return;
      }
      clearTextSelection();
    },
    [
      clearTextSelection,
      selectionDocument,
      showTextSelectionMenu,
      visibleTextPages,
    ],
  );
  const selectWordAtPoint = useCallback(
    (localX: number, localY: number, absoluteX: number, absoluteY: number) => {
      readerOriginRef.current = {
        x: absoluteX - localX,
        y: absoluteY - localY,
      };
      const position = hitTestVisibleText(visibleTextPages, localX, localY);
      if (!position) {
        clearTextSelection();
        return;
      }
      const selection = wordSelectionAt(
        selectionDocument,
        position,
        book.language,
      );
      if (!selection) {
        clearTextSelection();
        return;
      }
      commitTextSelection(selection);
    },
    [
      book.language,
      clearTextSelection,
      commitTextSelection,
      selectionDocument,
      visibleTextPages,
    ],
  );
  const handleForSelectionEndpoint = useCallback(
    (
      endpoint: TextSelectionEndpoint,
      selection: TextSelection,
      geometry: TextSelectionGeometry,
    ): TextSelectionHandle => {
      const anchorIsStart =
        compareTextPositions(
          selectionDocument,
          selection.anchor,
          selection.focus,
        ) <= 0;
      if (endpoint === "anchor") {
        return anchorIsStart ? geometry.startHandle : geometry.endHandle;
      }
      return anchorIsStart ? geometry.endHandle : geometry.startHandle;
    },
    [selectionDocument],
  );
  const pendingSelectionHandleDragRef = useRef<
    PendingSelectionHandleDrag | undefined
  >(undefined);
  const queuedSelectionHandleMoveRef = useRef<
    QueuedSelectionHandleMove | undefined
  >(undefined);
  const selectionHandleFrameRef = useRef(0);
  const flushSelectionHandleMove = useCallback(() => {
    if (selectionHandleFrameRef.current) {
      cancelAnimationFrame(selectionHandleFrameRef.current);
      selectionHandleFrameRef.current = 0;
    }
    const move = queuedSelectionHandleMoveRef.current;
    const pending = pendingSelectionHandleDragRef.current;
    const current = textSelectionRef.current;
    queuedSelectionHandleMoveRef.current = undefined;
    if (!move || !pending || !current) {
      return;
    }
    const position = hitTestVisibleText(visibleTextPages, move.x, move.y, true);
    if (!position) {
      return;
    }
    const opposite =
      pending.endpoint === "anchor" ? current.focus : current.anchor;
    if (compareTextPositions(selectionDocument, position, opposite) === 0) {
      return;
    }
    commitTextSelection({
      ...current,
      [pending.endpoint]: position,
    });
  }, [commitTextSelection, selectionDocument, visibleTextPages]);
  const queueSelectionHandleMove = useCallback(
    (absoluteX: number, absoluteY: number) => {
      const pending = pendingSelectionHandleDragRef.current;
      if (!pending) {
        return;
      }
      const origin = readerOriginRef.current;
      queuedSelectionHandleMoveRef.current = {
        x: absoluteX - origin.x + pending.offsetX,
        y: absoluteY - origin.y + pending.offsetY,
      };
      if (!selectionHandleFrameRef.current) {
        selectionHandleFrameRef.current = requestAnimationFrame(
          flushSelectionHandleMove,
        );
      }
    },
    [flushSelectionHandleMove],
  );
  const beginSelectionHandleDrag = useCallback(
    (endpoint: TextSelectionEndpoint, absoluteX: number, absoluteY: number) => {
      const current = textSelectionRef.current;
      if (!current) {
        return;
      }
      const geometry = textSelectionGeometry(
        selectionDocument,
        current,
        visibleTextPages,
      );
      if (!geometry) {
        return;
      }
      const handle = handleForSelectionEndpoint(endpoint, current, geometry);
      const origin = readerOriginRef.current;
      pendingSelectionHandleDragRef.current = {
        endpoint,
        offsetX: handle.x - (absoluteX - origin.x),
        offsetY: (handle.top + handle.bottom) * 0.5 - (absoluteY - origin.y),
      };
      onSelectionMenuDismiss?.();
    },
    [
      handleForSelectionEndpoint,
      onSelectionMenuDismiss,
      selectionDocument,
      visibleTextPages,
    ],
  );
  const finishSelectionHandleDrag = useCallback(() => {
    flushSelectionHandleMove();
    pendingSelectionHandleDragRef.current = undefined;
    const current = textSelectionRef.current;
    if (current) {
      showTextSelectionMenu(current);
    }
  }, [flushSelectionHandleMove, showTextSelectionMenu]);
  const cancelQueuedSelectionHandleMove = useCallback(() => {
    if (selectionHandleFrameRef.current) {
      cancelAnimationFrame(selectionHandleFrameRef.current);
      selectionHandleFrameRef.current = 0;
    }
    pendingSelectionHandleDragRef.current = undefined;
    queuedSelectionHandleMoveRef.current = undefined;
  }, []);
  useEffect(
    () => cancelQueuedSelectionHandleMove,
    [cancelQueuedSelectionHandleMove],
  );

  const devicePixelRatio = Math.max(1, PixelRatio.get());
  const pageCaptureIdentity = useCallback(
    (
      metadata: PageCaptureMetadata,
    ): PageCaptureIdentity<PageCaptureMetadata> => {
      const progress = progressDecorationForAddress(metadata.decorationAddress);
      return {
        key: JSON.stringify([
          book.id,
          book.revisionId,
          typographyAppearance,
          appearance.progressDisplay,
          theme.name,
          theme.colorScheme,
          layout,
          metadata.address.sectionIndex,
          metadata.address.pageIndex,
          metadata.decorationAddress.sectionIndex,
          metadata.decorationAddress.pageIndex,
          metadata.slot,
          progress.pageNumber,
          progress.pageCount,
        ]),
        width: physicalPageWidth,
        height,
        metadata,
      };
    },
    [
      appearance.progressDisplay,
      book.id,
      book.revisionId,
      height,
      layout,
      physicalPageWidth,
      progressDecorationForAddress,
      theme.colorScheme,
      theme.name,
      typographyAppearance,
    ],
  );
  const createRecordedPageCapture = useCallback(
    (identity: PageCaptureIdentity<PageCaptureMetadata>, scale: number) => {
      const metadata = identity.metadata;
      if (!metadata) {
        return null;
      }
      const { address } = metadata;
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      if (!page) {
        return null;
      }
      return recordPageCapture(
        page,
        pagination,
        imageCache,
        physicalPageWidth,
        height,
        scale,
        loadResource === undefined,
        appearance.progressDisplay === "hidden"
          ? undefined
          : pageDecorationForAddress(metadata.decorationAddress),
        appearance.progressDisplay,
        "reading",
        theme,
        -metadata.slot * physicalPageWidth,
      );
    },
    [
      appearance.progressDisplay,
      ensurePagination,
      height,
      imageCache,
      loadResource,
      pageDecorationForAddress,
      physicalPageWidth,
      theme,
    ],
  );
  const pageCaptureFeeder = useMemo(
    () =>
      new PageCaptureFeeder<PageCaptureMetadata>({
        maximumConcurrentJobs: PAGE_CAPTURE_RASTER_WORKER_COUNT,
        hasResidentCapture: (identity, minimumScale) =>
          pageCaptureCache.hasResident(identity, minimumScale),
        record: createRecordedPageCapture,
        rasterize: rasterizePageCaptureOffThread,
        install: (request, capture) => {
          pageCaptureCache.installPrepared(
            request.identity,
            request.tier,
            capture,
          );
          // Directional stock is not visible yet. Publishing every background
          // completion would re-render the entire reader 20-30 times/second
          // while a burst is already animating. Active misses wake React
          // immediately; prefetched pages become visible on the next tap
          // state update.
          if (request.tier === "active") {
            setPageCaptureVersion((version) => version + 1);
          }
        },
      }),
    [createRecordedPageCapture, pageCaptureCache],
  );
  useEffect(() => () => pageCaptureFeeder.dispose(), [pageCaptureFeeder]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled) {
      return;
    }
    pageCaptureFeeder.synchronize([]);
    pageCaptureCache.clear();
    setPageCaptureVersion((version) => version + 1);
  }, [
    nativePagerCompositorEnabled,
    pageCaptureCache,
    pageCaptureFeeder,
    readerGeneration,
  ]);
  const pageReadyForCapture = useCallback(
    (address: PageAddress): boolean => {
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      return Boolean(
        page &&
          pageImagesSettledForCapture(
            page,
            imageCache,
            loadResource === undefined,
          ),
      );
    },
    [ensurePagination, imageCache, loadResource],
  );

  const captureAddressesForTurn = useCallback(
    (
      turn: ScheduledPageTurn,
    ): PageTurnCaptureAddresses<PageCaptureMetadata> => {
      const current = captureSlotsForView(turn.from);
      const target = captureSlotsForView(turn.to);
      return pageTurnCaptureAddresses(layout, turn.direction, current, target);
    },
    [captureSlotsForView, layout],
  );

  const prepareScheduledTurnCapture = useCallback(
    (turn: ScheduledPageTurn): "acquired" | "waiting" | "hard-capacity" => {
      if (turnCaptureLeasesRef.current.has(turn.id)) {
        return "acquired";
      }
      const addresses = captureAddressesForTurn(turn);
      if (
        (addresses.front && !pageReadyForCapture(addresses.front.address)) ||
        (addresses.back && !pageReadyForCapture(addresses.back.address))
      ) {
        return "waiting";
      }
      const now = performanceNow();
      if (!captureStartTimesRef.current.has(turn.id)) {
        captureStartTimesRef.current.set(turn.id, now);
      }
      const recentStartsPerSecond = [
        ...captureStartTimesRef.current.values(),
      ].filter((startedAt) => now - startedAt <= 1000).length;
      const quality = selectPageCaptureQuality({
        tier: "active",
        devicePixelRatio,
        inputKind: turn.motion,
        recentStartsPerSecond,
        activeTurnCount: turnCaptureLeasesRef.current.size,
        maxPerspectiveScale: PAGE_TURN_MAX_PERSPECTIVE_SCALE,
      });
      const result = pageCaptureCache.acquireTurn(
        {
          turnId: turn.id,
          front: addresses.front
            ? {
                identity: pageCaptureIdentity(addresses.front),
                desiredScale: quality.desiredScale,
                minimumScale: quality.minimumScale,
              }
            : undefined,
          back: addresses.back
            ? {
                identity: pageCaptureIdentity(addresses.back),
                desiredScale: quality.desiredScale,
                minimumScale: quality.minimumScale,
              }
            : undefined,
        },
        () => null,
      );
      if (result.ok) {
        turnCaptureLeasesRef.current.set(turn.id, result.lease);
        return "acquired";
      }
      return result.reason === "hard-capacity" ? "hard-capacity" : "waiting";
    },
    [
      captureAddressesForTurn,
      devicePixelRatio,
      pageCaptureCache,
      pageCaptureIdentity,
      pageReadyForCapture,
    ],
  );
  prepareScheduledTurnCaptureRef.current = prepareScheduledTurnCapture;

  useEffect(() => {
    void pageCaptureVersion;
    const retainedTurnIds = new Set(activeTurns.map((turn) => turn.id));
    let leasesChanged = false;
    for (const [turnId, lease] of turnCaptureLeasesRef.current) {
      if (retainedTurnIds.has(turnId)) {
        continue;
      }
      lease.release("prefetch");
      turnCaptureLeasesRef.current.delete(turnId);
      leasesChanged = true;
    }

    const now = performanceNow();
    for (const [turnId, startedAt] of captureStartTimesRef.current) {
      if (now - startedAt > 1000 && !retainedTurnIds.has(turnId)) {
        captureStartTimesRef.current.delete(turnId);
      }
    }
    let capacityFailedTurnId: string | undefined;
    for (const turn of activeTurns) {
      if (
        nativePagerCompositorEnabled &&
        !turn.interactive &&
        turn.motion === "tap"
      ) {
        continue;
      }
      if (turnCaptureLeasesRef.current.has(turn.id)) {
        continue;
      }
      const result = prepareScheduledTurnCapture(turn);
      if (result === "acquired") {
        leasesChanged = true;
        continue;
      }
      if (result === "hard-capacity") {
        capacityFailedTurnId = turn.id;
      }
      // The renderer consumes a strict prefix. Wait for the feeder to install
      // the first missing immutable texture before considering later paper.
      break;
    }
    if (leasesChanged) {
      setPageCaptureVersion((version) => version + 1);
    }
    if (capacityFailedTurnId) {
      mutateReaderState((current) =>
        resolveScheduledPageTurn(current, capacityFailedTurnId, false),
      );
    }
  }, [
    activeTurns,
    imageVersion,
    mutateReaderState,
    nativePagerCompositorEnabled,
    pageCaptureVersion,
    prepareScheduledTurnCapture,
  ]);

  const crispTapCaptureQuality = selectPageCaptureQuality({
    tier: "active",
    devicePixelRatio,
    inputKind: "tap",
    maxPerspectiveScale: PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  });
  const directionalViewDepth = (() => {
    const size = pageCapturePixelSize(
      physicalPageWidth,
      height,
      crispTapCaptureQuality.desiredScale,
    );
    const budgetedViews = size
      ? Math.floor(
          PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET / size.byteSize / pagesPerView,
        )
      : PAGE_CAPTURE_MIN_DIRECTIONAL_VIEWS;
    return Math.max(
      PAGE_CAPTURE_MIN_DIRECTIONAL_VIEWS,
      Math.min(PAGE_CAPTURE_MAX_DIRECTIONAL_VIEWS, budgetedViews),
    );
  })();
  const passiveCaptureRadius = Math.max(
    1,
    Math.floor((directionalViewDepth - 1) / 2),
  );
  const passiveCapturePlan = useMemo(
    () =>
      buildPageCapturePlan({
        settled: readerState.settled,
        adjacent,
        addressesForView,
        radius: passiveCaptureRadius,
      }),
    [adjacent, addressesForView, passiveCaptureRadius, readerState.settled],
  );
  const captureFeedDirection =
    activeTurns.at(-1)?.direction ?? captureFeedDirectionRef.current;
  const directionalCapturePlan = useMemo(() => {
    if (captureFeedDirection === undefined) {
      return [];
    }
    const plan: {
      readonly metadata: PageCaptureMetadata;
      readonly tier: "prefetch" | "background";
      readonly priority: number;
    }[] = [];
    const seen = new Set<string>();
    let viewStart = readerState.desired;
    for (let depth = 0; depth < directionalViewDepth; depth += 1) {
      for (const metadata of captureSlotsForView(viewStart)) {
        if (!metadata) {
          continue;
        }
        const key = `${metadata.address.sectionIndex}:${metadata.address.pageIndex}:${metadata.decorationAddress.sectionIndex}:${metadata.decorationAddress.pageIndex}:${metadata.slot}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        plan.push({
          metadata,
          tier:
            depth <= turnConcurrency.maximumConcurrentTapTurns
              ? "prefetch"
              : "background",
          priority: 5_000 - depth * 10 - metadata.slot,
        });
      }
      const next = adjacent(viewStart, captureFeedDirection);
      if (samePageAddress(next, viewStart)) {
        break;
      }
      viewStart = next;
    }
    return plan;
  }, [
    adjacent,
    captureFeedDirection,
    captureSlotsForView,
    directionalViewDepth,
    readerState.desired,
    turnConcurrency.maximumConcurrentTapTurns,
  ]);
  const captureInventoryPlan = useMemo(
    () =>
      captureFeedDirection === undefined
        ? passiveCapturePlan.map((candidate, index) => ({
            metadata: {
              address: candidate.address,
              decorationAddress: candidate.viewStart,
              slot: candidate.slot,
            },
            tier: candidate.tier,
            priority:
              candidate.role === "current"
                ? 4_000
                : candidate.role === "neighbor"
                  ? 3_000 - index
                  : 2_000 - index,
          }))
        : directionalCapturePlan,
    [captureFeedDirection, directionalCapturePlan, passiveCapturePlan],
  );

  // Publish a continuous wanted inventory. The native raster worker keeps
  // running during animation; active turn faces borrow the hard reserve while
  // directional stock stays inside the normal target budget.
  useEffect(() => {
    const retainedInventory = nativePagerCompositorEnabled
      ? []
      : captureInventoryPlan;
    const retentions = [
      ...retainedInventory.map(({ metadata, tier }) => ({
        identity: pageCaptureIdentity(metadata),
        tier,
      })),
      ...activeTurns.flatMap((turn) => {
        const addresses = captureAddressesForTurn(turn);
        return [addresses.front, addresses.back]
          .filter(
            (metadata): metadata is PageCaptureMetadata =>
              metadata !== undefined,
          )
          .map((metadata) => ({
            identity: pageCaptureIdentity(metadata),
            tier: "active" as const,
          }));
      }),
    ];
    pageCaptureCache.reconcileUnpinnedTiers(retentions);
    const nativePagerOwnsActiveTapPictures =
      nativePagerCompositorEnabled &&
      activeTurns.some(
        (turn) => !turn.completed && !turn.interactive && turn.motion === "tap",
      );
    if (pageTurnAnimation === "none" || nativePagerOwnsActiveTapPictures) {
      pageCaptureFeeder.synchronize([]);
      return;
    }
    const requests: PageCaptureFeedRequest<PageCaptureMetadata>[] = [];
    for (const [index, turn] of activeTurns.entries()) {
      if (nativePagerCompositorEnabled && turn.motion === "tap") {
        continue;
      }
      const addresses = captureAddressesForTurn(turn);
      const quality = selectPageCaptureQuality({
        tier: "active",
        devicePixelRatio,
        inputKind: turn.motion,
        maxPerspectiveScale: PAGE_TURN_MAX_PERSPECTIVE_SCALE,
      });
      for (const metadata of [addresses.front, addresses.back]) {
        if (!metadata || !pageReadyForCapture(metadata.address)) {
          continue;
        }
        requests.push({
          identity: pageCaptureIdentity(metadata),
          scale: quality.desiredScale,
          tier: "active",
          priority: 10_000 - index,
        });
      }
    }
    if (!nativePagerCompositorEnabled) {
      for (const { metadata, tier, priority } of captureInventoryPlan) {
        if (!pageReadyForCapture(metadata.address)) {
          continue;
        }
        requests.push({
          identity: pageCaptureIdentity(metadata),
          scale: crispTapCaptureQuality.desiredScale,
          tier,
          priority,
        });
      }
    }
    pageCaptureFeeder.synchronize(requests);
  }, [
    activeTurns,
    captureAddressesForTurn,
    captureInventoryPlan,
    crispTapCaptureQuality.desiredScale,
    devicePixelRatio,
    imageVersion,
    nativePagerCompositorEnabled,
    pageCaptureCache,
    pageCaptureFeeder,
    pageCaptureIdentity,
    pageCaptureVersion,
    pageReadyForCapture,
    pageTurnAnimation,
  ]);

  useEffect(() => {
    if (!__DEV__ || pageTurnAnimation === "none") {
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      if (!nativeBenchmarkActiveRef.current) {
        acceptedTurnStartsRef.current = acceptedTurnStartsRef.current.filter(
          (startedAt) => now - startedAt <= 10_000,
        );
        requestedTurnStartsRef.current = requestedTurnStartsRef.current.filter(
          (startedAt) => now - startedAt <= 10_000,
        );
        deliveredTurnStartsRef.current = deliveredTurnStartsRef.current.filter(
          (startedAt) => now - startedAt <= 10_000,
        );
        laneTurnStartsRef.current = laneTurnStartsRef.current.filter(
          (startedAt) => now - startedAt <= 10_000,
        );
      }
      const feeder = pageCaptureFeeder.getStats();
      const active = readerStateRef.current.turns.length;
      const lastAccepted = acceptedTurnStartsRef.current.at(-1);
      if (
        active === 0 &&
        feeder.inFlight === 0 &&
        feeder.queued === 0 &&
        (lastAccepted === undefined || now - lastAccepted > 2_000)
      ) {
        return;
      }
      const acceptedRate = eventRatePerSecond(
        acceptedTurnStartsRef.current,
        now,
      );
      const requestedRate = eventRatePerSecond(
        requestedTurnStartsRef.current,
        now,
      );
      const deliveredRate = eventRatePerSecond(
        deliveredTurnStartsRef.current,
        now,
      );
      const laneRate = eventRatePerSecond(laneTurnStartsRef.current, now);
      const cache = pageCaptureCache.getStats();
      console.info(
        `[Persimmon][page-turn-burst] input=${requestedRate.toFixed(1)}/s delivered=${deliveredRate.toFixed(1)}/s accepted=${acceptedRate.toFixed(1)}/s presented=${presentationAckCountRef.current} lanes=${laneRate.toFixed(1)}/s premature=${prematureLaneStartCountRef.current} active=${active} interval=${turnConcurrency.minimumTurnIntervalMs}ms captureP95=${feeder.p95JobMs.toFixed(1)}ms captureAvg=${feeder.averageJobMs.toFixed(1)}ms queue=${feeder.queued} workers=${feeder.inFlight}/${PAGE_CAPTURE_RASTER_WORKER_COUNT} cache=${(cache.residentBytes / 1_048_576).toFixed(1)}MB pinned=${(cache.pinnedBytes / 1_048_576).toFixed(1)}MB`,
      );
    }, 1_000);
    return () => clearInterval(interval);
  }, [
    pageCaptureCache,
    pageCaptureFeeder,
    pageTurnAnimation,
    turnConcurrency.minimumTurnIntervalMs,
  ]);

  const turnTextures = useMemo(() => {
    void pageCaptureVersion;
    const textures = new Map<string, TurnTexture>();
    for (const turn of activeTurns) {
      const lease = turnCaptureLeasesRef.current.get(turn.id);
      textures.set(turn.id, {
        frontImage: lease?.front?.image ?? null,
        backImage: lease?.back?.image ?? null,
      });
    }
    return textures;
  }, [activeTurns, pageCaptureVersion]);

  const textureReadyForTurn = useCallback(
    (turn: ScheduledPageTurn) => {
      const texture = turnTextures.get(turn.id);
      return (
        texture?.frontImage !== null &&
        texture?.frontImage !== undefined &&
        (layout === "single" ||
          (texture.backImage !== null && texture.backImage !== undefined))
      );
    },
    [layout, turnTextures],
  );
  const texturePreparedTurns = useMemo(() => {
    const prefix: ScheduledPageTurn[] = [];
    for (const turn of activeTurns) {
      if (!turn.completed && !textureReadyForTurn(turn)) {
        break;
      }
      prefix.push(turn);
    }
    return prefix;
  }, [activeTurns, textureReadyForTurn]);
  const renderableTurns = useMemo(
    () => pageTurnsReadyForPaint(texturePreparedTurns),
    [texturePreparedTurns],
  );
  useEffect(() => {
    const turnIds = renderableTurns
      .filter(
        (turn) =>
          !turn.completed &&
          !turn.interactive &&
          isProgrammaticPageTurnMotion(turn.motion) &&
          (!nativePagerCompositorEnabled || turn.motion === "rapid") &&
          turn.laneReady &&
          !turn.presentationReady &&
          !pendingPresentationTurnIdsRef.current.has(turn.id),
      )
      .map((turn) => turn.id);
    if (turnIds.length === 0) {
      return;
    }
    for (const turnId of turnIds) {
      pendingPresentationTurnIdsRef.current.add(turnId);
    }
    // The lane's initial native frame is already installed. Wait through two
    // Canvas presentation opportunities before opening its UI-clock gate.
    afterSkiaPaint(() => {
      for (const turnId of turnIds) {
        pendingPresentationTurnIdsRef.current.delete(turnId);
      }
      if (!readerGenerationIsCurrent()) {
        return;
      }
      const activeTurnIds = new Set(
        readerStateRef.current.turns
          .filter(
            (turn) =>
              !turn.completed &&
              isProgrammaticPageTurnMotion(turn.motion) &&
              turn.laneReady &&
              !turn.presentationReady,
          )
          .map((turn) => turn.id),
      );
      const presentedTurnIds = turnIds.filter((turnId) =>
        activeTurnIds.has(turnId),
      );
      if (presentedTurnIds.length === 0) {
        return;
      }
      for (const turnId of presentedTurnIds) {
        presentedTurnIdsRef.current.add(turnId);
      }
      presentationAckCountRef.current += presentedTurnIds.length;
      const nextState = mutateReaderState((current) =>
        markScheduledPageTurnsPresented(current, presentedTurnIds, Date.now()),
      );
      for (const turnId of presentedTurnIds) {
        const turn = nextState.turns.find(
          (candidate) => candidate.id === turnId,
        );
        if (turn) {
          authorizeScheduledTurnStartRef.current(
            turn.lane,
            turn.id,
            turn.startAtMs,
          );
        }
      }
    });
  }, [
    mutateReaderState,
    nativePagerCompositorEnabled,
    readerGenerationIsCurrent,
    renderableTurns,
  ]);
  const transitionReady = renderableTurns.length > 0;
  const driverMeshReady =
    driverTurn !== undefined && textureReadyForTurn(driverTurn);
  const previousDisabled = samePageAddress(
    adjacent(readerState.desired, -1),
    readerState.desired,
  );
  const nextDisabled = samePageAddress(
    adjacent(readerState.desired, 1),
    readerState.desired,
  );
  const handleNativeCenterTap = useCallback(() => {
    if (!readerGenerationIsCurrent()) {
      return;
    }
    if (textSelectionRef.current) {
      clearTextSelection();
      return;
    }
    onCenterPress?.();
  }, [clearTextSelection, onCenterPress, readerGenerationIsCurrent]);
  const handleNativePageTap = useCallback(
    (direction: 1 | -1, requestedAtMs: number) => {
      if (textSelectionRef.current) {
        clearTextSelection();
        return;
      }
      requestTurn(direction, requestedAtMs);
    },
    [clearTextSelection, requestTurn],
  );
  const handleNativeRapidPageTurn = useCallback(
    (direction: 1 | -1, requestedAtMs: number) => {
      if (textSelectionRef.current) {
        clearTextSelection();
        return;
      }
      requestRapidTurn(direction, requestedAtMs);
    },
    [clearTextSelection, requestRapidTurn],
  );
  const nativeCommand = useMemo(
    () =>
      driverTurn
        ? {
            id: driverTurn.id,
            direction: driverTurn.direction,
            // A handoff-pending turn must keep its current driver state until
            // the autonomous lane confirms that the release is installed.
            interactive: true,
            ready: driverMeshReady,
            settlingIncomingPage:
              layout === "single" && driverTurn.direction === -1,
          }
        : undefined,
    [driverMeshReady, driverTurn, layout],
  );
  const nativePagerPhysicalInputEnabled =
    nativePagerCompositorEnabled &&
    !selectingText &&
    nativeBenchmarkCommand === undefined;
  const nativePagerTapInputEnabled =
    nativePagerPhysicalInputEnabled && activeTurns.length === 0;
  const nativePagerGestureInputPolicy = resolveNativePagerGestureInputPolicy({
    selectionActive: selectingText,
    benchmarkActive: nativeBenchmarkCommand !== undefined,
    nativePagerInputReady: nativePagerPhysicalInputEnabled,
    directTapActive:
      nativePagerDirectActiveCount !== nativePagerGestureActiveCount,
  });
  const nativePageTurn = useNativePageTurnDriver({
    gesturesEnabled: nativePagerGestureInputPolicy.recognizerEnabled,
    rapidPageTurnEnabled,
    nativePagerTapInputEnabled,
    nativePagerGestureInputEnabled:
      nativePagerGestureInputPolicy.nativeGestureInputEnabled,
    nativePagerNativeId: nativePagerCanvasId,
    width,
    height,
    physicalPageWidth,
    spread: layout === "spread",
    canTurnBackward: !textSelection && !previousDisabled,
    canTurnForward: !textSelection && !nextDisabled,
    canStartInteractive:
      pageTurnAnimation === "natural" &&
      !textSelection &&
      driverTurn === undefined &&
      nativePagerDirectActiveCount === 0 &&
      activeTurns.length < turnConcurrency.maximumConcurrentTurns,
    tuning: gesturePageTurnTuning,
    reverseTuning: reverseGesturePageTurnTuning,
    command: nativeCommand,
    benchmark: nativePagerCompositorEnabled
      ? undefined
      : nativeBenchmarkCommand,
    onCenterTap: handleNativeCenterTap,
    onGestureBegin: beginNativeInteractiveTurn,
    onGestureRelease: requestGestureTurn,
    onTapTurn: handleNativePageTap,
    onRapidTurn: handleNativeRapidPageTurn,
    onOutcome: completeNativeTurn,
  });
  const selectionLongPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!transitionReady && nativePagerDirectActiveCount === 0)
        .minDuration(420)
        .maxDistance(12)
        .runOnJS(true)
        .onStart((event) => {
          selectWordAtPoint(event.x, event.y, event.absoluteX, event.absoluteY);
        })
        .onEnd((_event, success) => {
          const current = textSelectionRef.current;
          if (success && current) {
            showTextSelectionMenu(current);
          }
        }),
    [
      nativePagerDirectActiveCount,
      selectWordAtPoint,
      showTextSelectionMenu,
      transitionReady,
    ],
  );
  const selectionTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(
          selectingText &&
            !transitionReady &&
            nativePagerDirectActiveCount === 0,
        )
        .maxDistance(8)
        .runOnJS(true)
        .onEnd((event, success) => {
          if (success) {
            handleTextSelectionTap(
              event.x,
              event.y,
              event.absoluteX,
              event.absoluteY,
            );
          }
        }),
    [
      handleTextSelectionTap,
      nativePagerDirectActiveCount,
      selectingText,
      transitionReady,
    ],
  );
  const createSelectionHandleGesture = useCallback(
    (endpoint: TextSelectionEndpoint) =>
      Gesture.Pan()
        .enabled(textSelection !== undefined)
        .minDistance(1)
        .runOnJS(true)
        .onBegin((event) => {
          beginSelectionHandleDrag(endpoint, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          queueSelectionHandleMove(event.absoluteX, event.absoluteY);
        })
        .onEnd(() => {
          finishSelectionHandleDrag();
        })
        .onFinalize((_event, success) => {
          if (!success) {
            finishSelectionHandleDrag();
          }
        }),
    [
      beginSelectionHandleDrag,
      finishSelectionHandleDrag,
      queueSelectionHandleMove,
      textSelection,
    ],
  );
  const anchorSelectionHandleGesture = useMemo(
    () => createSelectionHandleGesture("anchor"),
    [createSelectionHandleGesture],
  );
  const focusSelectionHandleGesture = useMemo(
    () => createSelectionHandleGesture("focus"),
    [createSelectionHandleGesture],
  );
  const nativeReaderGesture = useMemo(
    () =>
      Gesture.Race(
        selectionLongPressGesture,
        selectionTapGesture,
        nativePageTurn.gesture,
      ),
    [nativePageTurn.gesture, selectionLongPressGesture, selectionTapGesture],
  );
  const programmaticPlaybackSpeeds = useMemo(() => {
    const programmaticTurns = activeTurns.filter(
      (turn) => !turn.completed && isProgrammaticPageTurnMotion(turn.motion),
    );
    const retainedTurnIds = new Set(programmaticTurns.map((turn) => turn.id));
    for (const turnId of burstCompressedTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        burstCompressedTurnIdsRef.current.delete(turnId);
      }
    }
    const overlappingTapTurns = programmaticTurns.filter(
      (turn) => turn.motion === "tap",
    );
    if (overlappingTapTurns.length >= 2) {
      for (const turn of overlappingTapTurns) {
        burstCompressedTurnIdsRef.current.add(turn.id);
      }
    }
    return new Map(
      programmaticTurns.map((turn) => {
        const tuning = pageTurnTuningForLayoutDirection(
          automaticPageTurnTuning,
          reverseAutomaticPageTurnTuning,
          turn.direction,
          layout === "spread",
        );
        return [
          turn.id,
          burstCompressedTurnIdsRef.current.has(turn.id)
            ? burstPageTurnPlaybackSpeed(
                tuning,
                0,
                AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X,
              )
            : tuning.playbackSpeed,
        ];
      }),
    );
  }, [
    activeTurns,
    automaticPageTurnTuning,
    layout,
    reverseAutomaticPageTurnTuning,
  ]);
  const nativePagerStockPlan = useMemo(
    () => buildNativePagerStockPlan(readerState.settled, adjacent),
    [adjacent, readerState.settled],
  );
  const handleNativePagerEvent = useStableRNDispatcher(
    (
      turnId: string,
      event: NativePagerEvent,
      eventAtMs: number,
      eventDirection?: 1 | -1,
    ) => {
      if (__DEV__ && nativeBenchmarkActiveRef.current) {
        console.info(
          `[Persimmon][native-pager-event] ${event} id=${turnId} direction=${eventDirection ?? 0} at=${eventAtMs.toFixed(1)}`,
        );
      }
      if (event === "stock-miss") {
        requestedTurnStartsRef.current.push(eventAtMs);
        deliveredTurnStartsRef.current.push(Date.now());
        rejectedTurnCountsRef.current.capture += 1;
        // `pagerConsumeInput` already returned false to the UI-thread tap
        // driver, which owns the single RN fallback. Re-dispatching here would
        // advance two pages for one cold-stock tap.
        return;
      }
      const stockEntryId = nativePagerStockEntryIdFromTurnId(turnId);
      const directEntry = nativePagerStockEntriesRef.current.get(stockEntryId);
      const directPlaybackSpeed = directEntry?.playbackSpeed;
      if (event === "gesture-started") {
        requestedTurnStartsRef.current.push(eventAtMs);
        deliveredTurnStartsRef.current.push(Date.now());
        if (!directEntry || !readerGenerationIsCurrent()) {
          rejectedTurnCountsRef.current.other += 1;
          return;
        }
        acceptedTurnStartsRef.current.push(eventAtMs);
        captureFeedDirectionRef.current = directEntry.direction;
        nativePagerDirectTurnIdsRef.current.add(turnId);
        nativePagerGestureTurnIdsRef.current.add(turnId);
        setNativePagerGestureActiveCount(
          nativePagerGestureTurnIdsRef.current.size,
        );
        setNativePagerDirectActiveCount(
          nativePagerDirectTurnIdsRef.current.size,
        );
        presentationRequiredTurnIdsRef.current.add(turnId);
        presentedTurnIdsRef.current.add(turnId);
        nativePagerPlaybackSpeedsRef.current.set(turnId, directPlaybackSpeed!);
        presentationAckCountRef.current += 1;
        recordScheduledTurnLaneStarted(turnId, eventAtMs, directPlaybackSpeed!);
        return;
      }
      if (event === "gesture-released") {
        return;
      }
      if (event === "consumed") {
        const gestureTurnActive =
          nativePagerGestureTurnIdsRef.current.has(turnId);
        if (!gestureTurnActive) {
          requestedTurnStartsRef.current.push(eventAtMs);
          deliveredTurnStartsRef.current.push(Date.now());
        }
        if (!directEntry || !readerGenerationIsCurrent()) {
          rejectedTurnCountsRef.current.other += 1;
          return;
        }
        if (!gestureTurnActive) {
          acceptedTurnStartsRef.current.push(eventAtMs);
        }
        captureFeedDirectionRef.current = directEntry.direction;
        nativePagerPlaybackSpeedsRef.current.set(turnId, directPlaybackSpeed!);
        if (!gestureTurnActive) {
          // Native has reserved the logical edge, but React must keep the
          // source page underneath it until `started` confirms that the first
          // display-backed frame was actually submitted.
          nativePagerFirstFrameGateRef.current.reserve(turnId);
          return;
        }
        const acknowledgedEpoch = `${readerGeneration}:${nativePagerPageKey(directEntry.to)}`;
        nativePagerPresentationGateRef.current.schedule(
          turnId,
          acknowledgedEpoch,
        );
        nativePagerAcknowledgedPageKeyRef.current = acknowledgedEpoch;
        nativePagerReconciliationEpochsRef.current.add(acknowledgedEpoch);
        nativePagerDirectTurnIdsRef.current.add(turnId);
        setNativePagerDirectActiveCount(
          nativePagerDirectTurnIdsRef.current.size,
        );
        presentationRequiredTurnIdsRef.current.add(turnId);
        presentedTurnIdsRef.current.add(turnId);
        mutateReaderState(() => createPageTurnSchedulerState(directEntry.to));
        setNoteReturnAnchor((current) =>
          reduceNoteReturnAnchor(current, { type: "page-turned" }),
        );
        return;
      }
      if (event === "started") {
        if (nativePagerFirstFrameGateRef.current.confirmPresented(turnId)) {
          if (!directEntry || !readerGenerationIsCurrent()) {
            nativePagerPlaybackSpeedsRef.current.delete(turnId);
            rejectedTurnCountsRef.current.other += 1;
            return;
          }
          const acknowledgedEpoch = `${readerGeneration}:${nativePagerPageKey(directEntry.to)}`;
          nativePagerPresentationGateRef.current.schedule(
            turnId,
            acknowledgedEpoch,
          );
          nativePagerAcknowledgedPageKeyRef.current = acknowledgedEpoch;
          nativePagerReconciliationEpochsRef.current.add(acknowledgedEpoch);
          nativePagerDirectTurnIdsRef.current.add(turnId);
          setNativePagerDirectActiveCount(
            nativePagerDirectTurnIdsRef.current.size,
          );
          presentationRequiredTurnIdsRef.current.add(turnId);
          presentedTurnIdsRef.current.add(turnId);
          mutateReaderState(() => createPageTurnSchedulerState(directEntry.to));
          setNoteReturnAnchor((current) =>
            reduceNoteReturnAnchor(current, { type: "page-turned" }),
          );
        }
        presentationAckCountRef.current += 1;
        recordScheduledTurnLaneStarted(
          turnId,
          eventAtMs,
          nativePagerPlaybackSpeedsRef.current.get(turnId) ??
            pageTurnTuningForLayoutDirection(
              automaticPageTurnTuning,
              reverseAutomaticPageTurnTuning,
              directEntry?.direction ?? eventDirection ?? 1,
              layout === "spread",
            ).playbackSpeed,
        );
        return;
      }
      const directTurnActive = nativePagerDirectTurnIdsRef.current.has(turnId);
      const directTurnReserved = directEntry !== undefined;
      nativePagerFirstFrameGateRef.current.discard(turnId);
      if (directTurnActive || directTurnReserved) {
        const startedAtMs = laneTurnStartedAtRef.current.get(turnId);
        laneTurnStartedAtRef.current.delete(turnId);
        if (startedAtMs !== undefined) {
          laneTurnDurationsRef.current.push(
            Math.max(0, eventAtMs - startedAtMs),
          );
        }
        laneOutcomeDispatchLagsRef.current.push(
          Math.max(0, Date.now() - eventAtMs),
        );
        presentationRequiredTurnIdsRef.current.delete(turnId);
        presentedTurnIdsRef.current.delete(turnId);
        nativePagerPlaybackSpeedsRef.current.delete(turnId);
        if (nativePagerGestureTurnIdsRef.current.delete(turnId)) {
          setNativePagerGestureActiveCount(
            nativePagerGestureTurnIdsRef.current.size,
          );
        }
        nativePagerDirectTurnIdsRef.current.delete(turnId);
        setNativePagerDirectActiveCount(
          nativePagerDirectTurnIdsRef.current.size,
        );
        return;
      }
      // Keep the submission tombstone until React has removed the completed
      // turn from activeTurns. Dropping it before the state update commits
      // opens a render/effect window in which the same retained texture can be
      // enqueued a second time.
      completeScheduledTurn(turnId, event === "completed" ? 1 : 0, eventAtMs);
    },
  );
  useEffect(() => {
    const canvas = nativePagerCompositorSupported
      ? readerCanvasRef.current
      : null;
    setNativePagerCanvasId(canvas?.getNativeId());
  }, [nativePagerCompositorSupported, readerCanvasRef, readerGeneration]);
  useEffect(() => {
    if (!nativePagerCompositorSupported || nativePagerCanvasId === undefined) {
      setNativePagerReady(false);
      return;
    }
    const canvas = readerCanvasRef.current;
    if (!canvas || canvas.getNativeId() !== nativePagerCanvasId) {
      setNativePagerReady(false);
      return;
    }
    let cancelled = false;
    let frame = 0;
    setNativePagerReady(false);
    const probe = () => {
      if (cancelled) {
        return;
      }
      if (
        nativePagerCanvasReady(canvas) &&
        readerStateRef.current.turns.length === 0
      ) {
        setNativePagerReady(true);
        return;
      }
      frame = requestAnimationFrame(probe);
    };
    probe();
    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    nativePagerCanvasId,
    nativePagerCompositorSupported,
    readerCanvasRef,
    readerGeneration,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled) {
      return;
    }
    const canvas = readerCanvasRef.current;
    return () => {
      configureNativePagerInput(canvas, false);
      resetNativePagerCompositor(canvas);
      nativePagerSubmittedTurnIdsRef.current.clear();
      nativePagerPlaybackSpeedsRef.current.clear();
      nativePagerStockedEntryIdsRef.current.clear();
      nativePagerStockEntriesRef.current.clear();
      nativePagerDirectTurnIdsRef.current.clear();
      nativePagerGestureTurnIdsRef.current.clear();
      nativePagerFirstFrameGateRef.current.reset();
      nativePagerPresentationGateRef.current.reset();
      nativePagerAcknowledgedPageKeyRef.current = undefined;
      nativePagerReconciliationEpochsRef.current.clear();
    };
  }, [nativePagerCompositorEnabled, readerCanvasRef, readerGeneration]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    const settledKey = nativePagerPageKey(readerState.settled);
    const settledEpoch = `${readerGeneration}:${settledKey}`;
    if (nativePagerAcknowledgedPageKeyRef.current === settledEpoch) {
      nativePagerReconciliationEpochsRef.current.clear();
      nativePagerReconciliationEpochsRef.current.add(settledEpoch);
      return;
    }
    if (nativePagerReconciliationEpochsRef.current.has(settledEpoch)) {
      return;
    }
    nativePagerStockedEntryIdsRef.current.clear();
    nativePagerStockEntriesRef.current.clear();
    nativePagerDirectTurnIdsRef.current.clear();
    nativePagerGestureTurnIdsRef.current.clear();
    nativePagerFirstFrameGateRef.current.reset();
    nativePagerReconciliationEpochsRef.current.clear();
    setNativePagerDirectActiveCount(0);
    setNativePagerGestureActiveCount(0);
    if (setNativePagerAnchor(readerCanvasRef.current, settledKey)) {
      nativePagerAcknowledgedPageKeyRef.current = settledEpoch;
    } else {
      nativePagerAcknowledgedPageKeyRef.current = undefined;
      resetNativePagerCompositor(readerCanvasRef.current);
    }
  }, [
    nativePagerCompositorEnabled,
    readerCanvasRef,
    readerGeneration,
    readerState.settled,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled) {
      return;
    }
    const canvas = readerCanvasRef.current;
    if (!canvas) {
      return;
    }
    const settledEpoch = `${readerGeneration}:${nativePagerPageKey(readerState.settled)}`;
    const turnId =
      nativePagerPresentationGateRef.current.turnIdForSettled(settledEpoch);
    if (!turnId) {
      return;
    }

    let cancelled = false;
    afterSkiaPaint(() => {
      if (cancelled || !readerGenerationIsCurrent()) {
        return;
      }
      const currentSettledEpoch = `${readerGeneration}:${nativePagerPageKey(readerStateRef.current.settled)}`;
      if (
        nativePagerPresentationGateRef.current.turnIdForSettled(
          currentSettledEpoch,
        ) !== turnId
      ) {
        return;
      }
      if (acknowledgeNativePagerPresentation(canvas, turnId)) {
        nativePagerPresentationGateRef.current.acknowledge(turnId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    nativePagerCompositorEnabled,
    readerCanvasRef,
    readerGeneration,
    readerGenerationIsCurrent,
    readerState.settled,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    const canvas = readerCanvasRef.current;
    const processedPaperColor = processColor(theme.paper);
    const paperColor =
      typeof processedPaperColor === "number"
        ? processedPaperColor >>> 0
        : 0xffffffff;
    const stockTuningKey = [
      automaticPageTurnTuning.releaseX,
      automaticPageTurnTuning.liftVelocity,
      automaticPageTurnTuning.liftToLeft,
      automaticPageTurnTuning.curvatureRelaxation,
      automaticPageTurnTuning.playbackSpeed,
      reverseAutomaticPageTurnTuning.releaseX,
      reverseAutomaticPageTurnTuning.curvatureRelaxation,
      reverseAutomaticPageTurnTuning.incomingLandingStartProgress,
      reverseAutomaticPageTurnTuning.incomingRevealStartProgress,
      reverseAutomaticPageTurnTuning.incomingRevealEndProgress,
      reverseAutomaticPageTurnTuning.incomingSettleDurationSeconds,
      reverseAutomaticPageTurnTuning.incomingSettleEasingPower,
      reverseAutomaticPageTurnTuning.playbackSpeed,
    ].join(",");
    const entryIdFor = (
      from: PageAddress,
      to: PageAddress,
      direction: 1 | -1,
    ) =>
      `native-stock:${readerGeneration}:${imageVersion}:${stockTuningKey}:${nativePagerPageKey(from)}:${direction}:${nativePagerPageKey(to)}`;
    const retainedEntryIds = new Set(
      nativePagerStockPlan.map((edge) =>
        entryIdFor(edge.from, edge.to, edge.direction),
      ),
    );
    for (const entryId of nativePagerStockedEntryIdsRef.current) {
      if (!retainedEntryIds.has(entryId)) {
        // Stop scheduling duplicate recordings, but keep the reconciliation
        // record: native may already have consumed this revision while its
        // event is still waiting for the next 16 ms RN poll.
        nativePagerStockedEntryIdsRef.current.delete(entryId);
      }
    }
    const pendingEdges = nativePagerStockPlan.filter(
      (edge) =>
        !nativePagerStockedEntryIdsRef.current.has(
          entryIdFor(edge.from, edge.to, edge.direction),
        ),
    );
    if (pendingEdges.length === 0) {
      return;
    }

    let cancelled = false;
    let frame = 0;
    let nextEdgeIndex = 0;
    const unavailableRecordingKeys = new Set<string>();
    const recordingFor = (
      metadata: PageCaptureMetadata,
    ): RecordedPageCapture | null => {
      const identity = pageCaptureIdentity(metadata);
      const recordingKey = `${identity.key}:${crispTapCaptureQuality.desiredScale}`;
      if (unavailableRecordingKeys.has(recordingKey)) {
        return null;
      }
      if (!pageReadyForCapture(metadata.address)) {
        unavailableRecordingKeys.add(recordingKey);
        return null;
      }
      const recording = nativePagerRecordingCache.getOrCreate(
        recordingKey,
        () =>
          createRecordedPageCapture(
            identity,
            crispTapCaptureQuality.desiredScale,
          ),
      );
      if (!recording) {
        unavailableRecordingKeys.add(recordingKey);
      }
      return recording;
    };
    const feedStock = () => {
      if (cancelled) {
        return;
      }
      const sliceStartedAt = performanceNow();
      let attempted = false;
      while (
        nextEdgeIndex < pendingEdges.length &&
        (!attempted || performanceNow() - sliceStartedAt < 4)
      ) {
        attempted = true;
        const edge = pendingEdges[nextEdgeIndex]!;
        nextEdgeIndex += 1;
        const currentSlots = captureSlotsForView(edge.from);
        const targetSlots = captureSlotsForView(edge.to);
        const pictures = nativePagerTransitionPictures(
          layout,
          edge.direction,
          currentSlots,
          targetSlots,
        );
        const frontMetadata = pictures.faces.front;
        const backMetadata = pictures.faces.back;
        if (!frontMetadata || (layout === "spread" && !backMetadata)) {
          continue;
        }
        const frontRecording = recordingFor(frontMetadata);
        const backRecording = backMetadata
          ? recordingFor(backMetadata)
          : undefined;
        const backgroundLeftRecording = pictures.backgroundLeft
          ? recordingFor(pictures.backgroundLeft)
          : undefined;
        const backgroundRightRecording = pictures.backgroundRight
          ? recordingFor(pictures.backgroundRight)
          : undefined;
        if (
          !frontRecording ||
          (backMetadata && !backRecording) ||
          (pictures.backgroundLeft && !backgroundLeftRecording) ||
          (pictures.backgroundRight && !backgroundRightRecording)
        ) {
          continue;
        }
        const entryId = entryIdFor(edge.from, edge.to, edge.direction);
        const edgeTuning = pageTurnTuningForLayoutDirection(
          automaticPageTurnTuning,
          reverseAutomaticPageTurnTuning,
          edge.direction,
          layout === "spread",
        );
        const durationMs = estimateAutomaticPageTurnDurationMs(
          edgeTuning,
          pageTurnSolverDirectionForLayout(edge.direction, layout === "spread"),
        );
        const accepted = stockNativePagerPicture(canvas, {
          id: entryId,
          fromPageKey: nativePagerPageKey(edge.from),
          toPageKey: nativePagerPageKey(edge.to),
          frontPageKey: pageCaptureIdentity(frontMetadata).key,
          backPageKey: backMetadata
            ? pageCaptureIdentity(backMetadata).key
            : undefined,
          backgroundLeftPageKey: pictures.backgroundLeft
            ? pageCaptureIdentity(pictures.backgroundLeft).key
            : undefined,
          backgroundRightPageKey: pictures.backgroundRight
            ? pageCaptureIdentity(pictures.backgroundRight).key
            : undefined,
          frontPicture: frontRecording.picture,
          backPicture: backRecording?.picture,
          backgroundLeftPicture: backgroundLeftRecording?.picture,
          backgroundRightPicture: backgroundRightRecording?.picture,
          pixelWidth: frontRecording.pixelWidth,
          pixelHeight: frontRecording.pixelHeight,
          direction: edge.direction,
          spread: layout === "spread",
          contentRevision: imageVersion,
          durationMs,
          rapidDurationMs: durationMs,
          launchIntervalMs: turnConcurrency.minimumTurnIntervalMs,
          paperColor,
        });
        if (!accepted) {
          continue;
        }
        nativePagerStockedEntryIdsRef.current.add(entryId);
        nativePagerStockEntriesRef.current.set(entryId, {
          from: edge.from,
          to: edge.to,
          direction: edge.direction,
          playbackSpeed: edgeTuning.playbackSpeed,
        });
        trimNativePagerReconciliationEntries(
          nativePagerStockEntriesRef.current,
          retainedEntryIds,
          128,
        );
      }
      if (nextEdgeIndex < pendingEdges.length) {
        frame = requestAnimationFrame(feedStock);
      }
    };
    feedStock();
    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    automaticPageTurnTuning,
    reverseAutomaticPageTurnTuning,
    captureSlotsForView,
    createRecordedPageCapture,
    crispTapCaptureQuality.desiredScale,
    imageVersion,
    layout,
    nativePagerCompositorEnabled,
    nativePagerRecordingCache,
    nativePagerStockPlan,
    pageCaptureIdentity,
    pageCaptureVersion,
    pageReadyForCapture,
    readerCanvasRef,
    readerGeneration,
    readerState.settled,
    theme.paper,
    turnConcurrency.minimumTurnIntervalMs,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    const automaticForward = automaticTuningForCore(automaticPageTurnTuning);
    const automaticBackward = pageTurnTuningForLayoutDirection(
      automaticForward,
      reverseAutomaticTuningForCore(reverseAutomaticPageTurnTuning),
      -1,
      layout === "spread",
    );
    const gestureForward = gestureTuningForCore(gesturePageTurnTuning);
    const gestureBackward = pageTurnTuningForLayoutDirection(
      gestureForward,
      reverseGestureTuningForCore(reverseGesturePageTurnTuning),
      -1,
      layout === "spread",
    );
    configureNativePagerMotion(readerCanvasRef.current, {
      automatic: {
        forward: automaticForward,
        backward: automaticBackward,
      },
      rapid: {
        forward: automaticForward,
        backward: automaticBackward,
      },
      gesture: {
        forward: gestureForward,
        backward: gestureBackward,
      },
    });
  }, [
    automaticPageTurnTuning,
    reverseAutomaticPageTurnTuning,
    gesturePageTurnTuning,
    layout,
    reverseGesturePageTurnTuning,
    nativePagerCompositorEnabled,
    readerCanvasRef,
  ]);
  useEffect(() => {
    const canvas = readerCanvasRef.current;
    if (!nativePagerCompositorEnabled || !canvas) {
      return;
    }
    return bindNativePagerInput(
      canvas,
      nativePagerPhysicalInputEnabled,
      configureNativePagerInput,
    );
  }, [
    nativePagerCompositorEnabled,
    nativePagerCanvasId,
    nativePagerPhysicalInputEnabled,
    readerCanvasRef,
    readerGeneration,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    const processedPaperColor = processColor(theme.paper);
    const paperColor =
      typeof processedPaperColor === "number"
        ? processedPaperColor >>> 0
        : 0xffffffff;
    for (const turn of activeTurns) {
      if (
        turn.completed ||
        turn.interactive ||
        turn.handoffPending ||
        turn.motion !== "tap" ||
        nativePagerSubmittedTurnIdsRef.current.has(turn.id)
      ) {
        continue;
      }
      const pictures = nativePagerTransitionPictures(
        layout,
        turn.direction,
        captureSlotsForView(turn.from),
        captureSlotsForView(turn.to),
      );
      const frontMetadata = pictures.faces.front;
      const backMetadata = pictures.faces.back;
      const captureMetadata = [
        frontMetadata,
        backMetadata,
        pictures.backgroundLeft,
        pictures.backgroundRight,
      ];
      if (
        !frontMetadata ||
        (layout === "spread" && !backMetadata) ||
        captureMetadata.some(
          (metadata) =>
            metadata !== undefined && !pageReadyForCapture(metadata.address),
        )
      ) {
        continue;
      }
      const recordings = captureMetadata.map((metadata) =>
        metadata
          ? createRecordedPageCapture(
              pageCaptureIdentity(metadata),
              crispTapCaptureQuality.desiredScale,
            )
          : undefined,
      );
      const [
        frontRecording,
        backRecording,
        backgroundLeftRecording,
        backgroundRightRecording,
      ] = recordings;
      if (
        !frontRecording ||
        captureMetadata.some(
          (metadata, index) => metadata !== undefined && !recordings[index],
        )
      ) {
        for (const recording of recordings) {
          recording?.dispose();
        }
        continue;
      }
      const playbackSpeed =
        programmaticPlaybackSpeeds.get(turn.id) ??
        pageTurnTuningForLayoutDirection(
          automaticPageTurnTuning,
          reverseAutomaticPageTurnTuning,
          turn.direction,
          layout === "spread",
        ).playbackSpeed;
      const turnTuning = pageTurnTuningForLayoutDirection(
        automaticPageTurnTuning,
        reverseAutomaticPageTurnTuning,
        turn.direction,
        layout === "spread",
      );
      const durationMs =
        estimateAutomaticPageTurnDurationMs(
          turnTuning,
          pageTurnSolverDirectionForLayout(turn.direction, layout === "spread"),
        ) *
        (turnTuning.playbackSpeed / Math.max(0.01, playbackSpeed));
      presentationRequiredTurnIdsRef.current.add(turn.id);
      presentedTurnIdsRef.current.add(turn.id);
      nativePagerPlaybackSpeedsRef.current.set(turn.id, playbackSpeed);
      let accepted = false;
      try {
        accepted = enqueueNativePagerPictureTurn(readerCanvasRef.current, {
          id: turn.id,
          frontPicture: frontRecording.picture,
          backPicture: backRecording?.picture,
          backgroundLeftPicture: backgroundLeftRecording?.picture,
          backgroundRightPicture: backgroundRightRecording?.picture,
          pixelWidth: frontRecording.pixelWidth,
          pixelHeight: frontRecording.pixelHeight,
          direction: turn.direction,
          spread: layout === "spread",
          startAtMs: turn.startAtMs,
          durationMs,
          launchIntervalMs: turnConcurrency.minimumTurnIntervalMs,
          paperColor,
        });
      } finally {
        for (const recording of recordings) {
          recording?.dispose();
        }
      }
      if (!accepted) {
        presentationRequiredTurnIdsRef.current.delete(turn.id);
        presentedTurnIdsRef.current.delete(turn.id);
        nativePagerPlaybackSpeedsRef.current.delete(turn.id);
        continue;
      }
      nativePagerSubmittedTurnIdsRef.current.add(turn.id);
      markScheduledTurnLanePrepared(turn.id);
    }
  }, [
    activeTurns,
    automaticPageTurnTuning,
    reverseAutomaticPageTurnTuning,
    programmaticPlaybackSpeeds,
    captureSlotsForView,
    createRecordedPageCapture,
    crispTapCaptureQuality.desiredScale,
    layout,
    markScheduledTurnLanePrepared,
    nativePagerCompositorEnabled,
    pageCaptureIdentity,
    pageReadyForCapture,
    readerCanvasRef,
    theme.paper,
    turnConcurrency.minimumTurnIntervalMs,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled) {
      return;
    }
    const canvas = readerCanvasRef.current;
    if (!canvas) {
      return;
    }
    const drainEvents = () => {
      for (const event of takeNativePagerEvents(canvas)) {
        handleNativePagerEvent(
          event.id,
          event.event,
          event.eventAtMs,
          event.direction,
        );
      }
    };
    drainEvents();
    const timer = setInterval(drainEvents, 16);
    return () => {
      clearInterval(timer);
      drainEvents();
    };
  }, [
    handleNativePagerEvent,
    nativePagerCompositorEnabled,
    readerCanvasRef,
    readerGeneration,
  ]);
  useEffect(() => {
    for (const turn of texturePreparedTurns) {
      if (
        !turn.completed &&
        isProgrammaticPageTurnMotion(turn.motion) &&
        (!nativePagerCompositorEnabled || turn.motion === "rapid")
      ) {
        presentationRequiredTurnIdsRef.current.add(turn.id);
      }
    }
  }, [nativePagerCompositorEnabled, texturePreparedTurns]);
  const nativePoolCommands = useMemo(() => {
    const commands: (NativeProgrammaticPageTurnCommand | undefined)[] =
      new Array(PAGE_TURN_LANE_HARD_LIMIT).fill(undefined);
    for (const turn of texturePreparedTurns) {
      if (
        turn.interactive ||
        !textureReadyForTurn(turn) ||
        (nativePagerCompositorEnabled && turn.motion === "tap")
      ) {
        continue;
      }
      commands[turn.lane] = {
        id: turn.id,
        direction: turn.direction,
        ready: true,
        startAtMs: turn.startAtMs,
        readyToStart: turn.motion === "gesture" || turn.presentationReady,
        settlingIncomingPage: layout === "single" && turn.direction === -1,
        motion: turn.motion,
        playbackSpeed: isProgrammaticPageTurnMotion(turn.motion)
          ? (programmaticPlaybackSpeeds.get(turn.id) ??
            pageTurnTuningForLayoutDirection(
              automaticPageTurnTuning,
              reverseAutomaticPageTurnTuning,
              turn.direction,
              layout === "spread",
            ).playbackSpeed)
          : undefined,
        gestureRelease: turn.gestureRelease,
      };
    }
    return commands;
  }, [
    automaticPageTurnTuning.playbackSpeed,
    reverseAutomaticPageTurnTuning,
    programmaticPlaybackSpeeds,
    layout,
    nativePagerCompositorEnabled,
    texturePreparedTurns,
    textureReadyForTurn,
  ]);
  const nativePageTurnPool = useNativePageTurnPool({
    width,
    height,
    spread: layout === "spread",
    automaticTuning: automaticPageTurnTuning,
    reverseAutomaticTuning: reverseAutomaticPageTurnTuning,
    gestureTuning: gesturePageTurnTuning,
    reverseGestureTuning: reverseGesturePageTurnTuning,
    commands: nativePoolCommands,
    onPrepared: markScheduledTurnLanePrepared,
    onStarted: recordScheduledTurnLaneStarted,
    onOutcome: completeScheduledTurn,
  });
  authorizeScheduledTurnStartRef.current = nativePageTurnPool.authorizeStart;
  const pageAt = useCallback(
    (address: PageAddress) =>
      ensurePagination(address.sectionIndex).pages[address.pageIndex],
    [ensurePagination],
  );
  const pinnedAssetIds = useMemo(() => {
    const viewStarts = [
      readerState.settled,
      adjacent(readerState.settled, -1),
      adjacent(readerState.settled, 1),
      scheduledPageAddress(readerState),
      ...activeTurns.flatMap((turn) => [turn.from, turn.to]),
    ];
    const addresses = [
      ...viewStarts.flatMap(addressesForView),
      ...captureInventoryPlan.map(({ metadata }) => metadata.address),
    ];
    const assetIds = new Set<string>();
    for (const address of addresses) {
      for (const item of pageAt(address)?.items ?? []) {
        if (item.kind === "image") {
          assetIds.add(item.assetId);
        }
      }
    }
    return assetIds;
  }, [
    activeTurns,
    adjacent,
    addressesForView,
    captureInventoryPlan,
    pageAt,
    readerState,
  ]);

  useEffect(() => {
    imageCache.pinOnly(pinnedAssetIds);
    if (!loadResource || pinnedAssetIds.size === 0) {
      return;
    }
    let cancelled = false;
    void Promise.all(
      [...pinnedAssetIds].map((assetId) =>
        imageCache.load(assetId, loadResource),
      ),
    ).then(() => {
      if (!cancelled) {
        // `pinnedAssetIds` changes as the stock runway slides. Cached loads
        // finish immediately, so incrementing here invalidated every native
        // stock edge once per page. Mirror the cache's installation revision
        // instead: duplicate completions become a React no-op.
        setImageVersion(imageCache.revision);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageCache, loadResource, pinnedAssetIds]);

  useEffect(() => {
    if (readerState.turns.length > 0) {
      return;
    }
    const page = ensurePagination(readerState.settled.sectionIndex).pages[
      readerState.settled.pageIndex
    ];
    if (!page) {
      return;
    }
    const localPageCount = pageCountForSection(
      readerState.settled.sectionIndex,
    );
    const publicationDecoration = progressDecorationForAddress(
      readerState.settled,
    );
    const publicationProgress =
      publicationDecoration.pageNumber / publicationDecoration.pageCount;
    const progress: ReaderProgress = {
      locator: {
        bookId: book.id,
        revisionId: book.revisionId,
        position: page.start,
        affinity: "forward",
      },
      sectionIndex: readerState.settled.sectionIndex,
      pageIndex: readerState.settled.pageIndex,
      pageCount: localPageCount,
      publicationProgress,
    };
    // Publishing directly from this passive effect makes the app update its
    // reader screen and library state from inside React's passive-effect
    // flush. Sustained native page turns can repeat that nested update often
    // enough to trip React's maximum-update-depth guard. Cross the frame
    // boundary first; cleanup also coalesces pages that settle in one frame.
    const frame = requestAnimationFrame(() => onProgress?.(progress));
    return () => cancelAnimationFrame(frame);
  }, [
    book.id,
    book.revisionId,
    ensurePagination,
    onProgress,
    pageCountForSection,
    progressDecorationForAddress,
    readerState.turns.length,
    readerState.settled.pageIndex,
    readerState.settled.sectionIndex,
  ]);

  const settledProgressDecoration = useMemo(
    () => progressDecorationForAddress(readerState.settled),
    [progressDecorationForAddress, readerState.settled],
  );
  const viewportProgressDecoration = pageDecorationForAddress(
    readerState.settled,
  );
  const showProgressHeader = progressDisplayHasHeader(visibleProgressDisplay);
  const showProgressFooter = progressDisplayHasFooter(visibleProgressDisplay);
  const oldestRenderableTurn = renderableTurns[0];
  const newestRenderableTurn = renderableTurns.at(-1);
  const settledCaptureSlots = captureSlotsForView(readerState.settled);
  const turnBackgroundSlots: readonly (PageCaptureMetadata | undefined)[] =
    (() => {
      if (!oldestRenderableTurn || !newestRenderableTurn) {
        return settledCaptureSlots;
      }
      return pageTurnBackgroundSlots(
        layout,
        oldestRenderableTurn.direction,
        captureSlotsForView(oldestRenderableTurn.from),
        captureSlotsForView(newestRenderableTurn.to),
      );
    })();
  const retainedPaperTurns = renderableTurns;
  const paperPaintPasses: readonly {
    readonly turn: ScheduledPageTurn;
    readonly face: PageTurnFace | "both";
  }[] =
    layout === "spread" && retainedPaperTurns.length > 1
      ? spreadPageTurnPaintPasses(
          retainedPaperTurns,
          retainedPaperTurns[0]!.direction,
        )
      : (oldestRenderableTurn?.direction === 1
          ? [...retainedPaperTurns].reverse()
          : retainedPaperTurns
        ).map((turn) => ({ turn, face: "both" }));
  const renderPageSlots = (
    slots: readonly (PageCaptureMetadata | undefined)[],
    layer: string,
    progressDisplay: ReaderProgressDisplay = "hidden",
  ) =>
    slots.map((metadata, viewportSlot) => {
      if (!metadata) {
        return null;
      }
      const { address, decorationAddress, slot } = metadata;
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      if (!page) {
        return null;
      }
      return (
        <ReaderPageLayer
          key={`${layer}:${address.sectionIndex}:${address.pageIndex}:${viewportSlot}`}
          decoration={
            progressDisplay === "hidden"
              ? undefined
              : pageDecorationForAddress(decorationAddress)
          }
          decorationClipHeight={height}
          decorationClipWidth={physicalPageWidth}
          decorationOffsetX={-slot * physicalPageWidth}
          imageCache={imageCache}
          offsetX={viewportSlot * physicalPageWidth}
          page={page}
          pagination={pagination}
          progressDisplay={progressDisplay}
          progressPresentation="reading"
          theme={theme}
        />
      );
    });
  const anchorIsSelectionStart =
    textSelection !== undefined &&
    compareTextPositions(
      selectionDocument,
      textSelection.anchor,
      textSelection.focus,
    ) <= 0;
  const anchorSelectionHandle =
    textSelection && selectionGeometry
      ? handleForSelectionEndpoint("anchor", textSelection, selectionGeometry)
      : undefined;
  const focusSelectionHandle =
    textSelection && selectionGeometry
      ? handleForSelectionEndpoint("focus", textSelection, selectionGeometry)
      : undefined;

  const readerContent = (
    <View
      ref={readerViewRef}
      onLayout={measureReaderOrigin}
      style={[styles.container, { backgroundColor: theme.paper }]}
    >
      <Canvas
        ref={readerCanvasRef}
        opaque={Platform.OS === "android"}
        style={styles.canvas}
      >
        <Fill color={theme.paper} />
        {!transitionReady ? (
          <>
            {renderPageSlots(settledCaptureSlots, "settled")}
            {selectionGeometry?.rects.map((rect, index) => (
              <Rect
                key={`selection:${rect.sectionId}:${rect.blockId}:${rect.startOffset}:${rect.endOffset}:${index}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                color="rgba(34, 119, 230, 0.28)"
              />
            ))}
            <SkiaPageDecorationLayer
              decoration={viewportProgressDecoration}
              display={visibleProgressDisplay}
              presentation={progressPresentation}
            />
          </>
        ) : (
          <>
            {renderPageSlots(
              turnBackgroundSlots,
              "background",
              appearance.progressDisplay,
            )}
            {paperPaintPasses.map(({ turn, face }) => {
              const texture = turnTextures.get(turn.id);
              if (!texture?.frontImage) {
                return null;
              }
              if (
                nativePagerCompositorEnabled &&
                turn.motion === "tap" &&
                !turn.interactive &&
                !turn.handoffPending
              ) {
                return null;
              }
              return (
                <PageTurnMesh
                  key={`${turn.id}:${face}`}
                  backImage={texture.backImage ?? undefined}
                  drawShadow={shouldDrawPageTurnShadow(turn.direction, face)}
                  face={face}
                  paperColor={theme.paper}
                  paperImage={texture.frontImage}
                  nativeFrame={
                    turn.interactive || turn.handoffPending
                      ? nativePageTurn.frame
                      : nativePageTurnPool.frames[turn.lane]
                  }
                  spread={layout === "spread"}
                  width={width}
                  height={height}
                />
              );
            })}
          </>
        )}
      </Canvas>

      {!transitionReady && anchorSelectionHandle && focusSelectionHandle ? (
        <>
          <TextSelectionHandleView
            accessibilityLabel={uiMessages.selectionStart}
            gesture={anchorSelectionHandleGesture}
            handle={anchorSelectionHandle}
            start={anchorIsSelectionStart}
          />
          <TextSelectionHandleView
            accessibilityLabel={uiMessages.selectionEnd}
            gesture={focusSelectionHandleGesture}
            handle={focusSelectionHandle}
            start={!anchorIsSelectionStart}
          />
        </>
      ) : null}

      {showProgressHeader ? (
        <View
          accessible
          accessibilityLabel={uiMessages.header(
            settledProgressDecoration.sectionTitle,
          )}
          accessibilityLiveRegion="polite"
          style={[
            styles.accessibilityProgress,
            styles.accessibilityProgressTop,
          ]}
        >
          <Text style={styles.accessibilityProgressText}>
            {settledProgressDecoration.sectionTitle}
          </Text>
        </View>
      ) : null}

      {showProgressFooter ? (
        <View
          accessible
          accessibilityLabel={
            progressPresentation === "toolbar"
              ? uiMessages.publicationPercentage(
                  settledProgressDecoration.percentageLabel,
                )
              : uiMessages.publicationPage(settledProgressDecoration.pageLabel)
          }
          accessibilityLiveRegion="polite"
          style={[
            styles.accessibilityProgress,
            styles.accessibilityProgressBottom,
          ]}
        >
          <Text style={styles.accessibilityProgressText}>
            {progressPresentation === "toolbar"
              ? settledProgressDecoration.percentageLabel
              : settledProgressDecoration.pageLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
  const linkOverlay =
    readerState.turns.length === 0 &&
    nativePagerDirectActiveCount === 0 &&
    !selectingText ? (
      <View pointerEvents="box-none" style={styles.linkOverlay}>
        {settledLinkHits.map(({ frame, key, region }) => (
          <Pressable
            key={key}
            accessibilityHint={
              region.link.kind === "note-reference"
                ? uiMessages.noteHint
                : undefined
            }
            accessibilityLabel={linkAccessibilityLabel(uiMessages, region)}
            accessibilityRole="link"
            onPress={() => handleLinkPress(region)}
            style={({ pressed }) => [
              styles.linkHit,
              {
                height: frame.height,
                left: frame.x,
                top: frame.y,
                width: frame.width,
              },
              pressed && styles.linkHitPressed,
            ]}
          />
        ))}
        {noteReturnAnchor ? (
          <View
            style={[
              styles.noteReturnControls,
              {
                backgroundColor: theme.panel,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
              noteReturnAnchor.presentation === "compact"
                ? styles.noteReturnControlsCompact
                : styles.noteReturnControlsExpanded,
            ]}
          >
            <Pressable
              accessibilityLabel={uiMessages.returnToReference(
                noteKindLabel(uiMessages, noteReturnAnchor.noteKind),
                noteReturnAnchor.label,
              )}
              accessibilityRole="button"
              hitSlop={6}
              onPress={returnToNoteReference}
              style={({ pressed }) => [
                styles.noteReturnButton,
                noteReturnAnchor.presentation === "compact"
                  ? styles.noteReturnButtonCompact
                  : styles.noteReturnButtonExpanded,
                pressed && { backgroundColor: theme.panelRaised },
              ]}
            >
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[styles.noteReturnText, { color: theme.accentStrong }]}
              >
                {noteReturnAnchor.presentation === "compact"
                  ? "↩"
                  : uiMessages.returnToTextButton}
              </Text>
            </Pressable>
            <View
              style={[
                styles.noteReturnDivider,
                { backgroundColor: theme.border },
              ]}
            />
            <Pressable
              accessibilityLabel={uiMessages.dismissReturnButton(
                noteKindLabel(uiMessages, noteReturnAnchor.noteKind),
              )}
              accessibilityRole="button"
              hitSlop={6}
              onPress={clearNoteReturnAnchor}
              style={({ pressed }) => [
                styles.noteReturnDismissButton,
                pressed && { backgroundColor: theme.panelRaised },
              ]}
            >
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[
                  styles.noteReturnDismissText,
                  { color: theme.secondaryText },
                ]}
              >
                ×
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ) : null;
  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <GestureDetector gesture={nativeReaderGesture}>
        {readerContent}
      </GestureDetector>
      {linkOverlay}
    </View>
  );
}

interface TextSelectionHandleViewProps {
  readonly accessibilityLabel: string;
  readonly gesture: GestureType;
  readonly handle: TextSelectionHandle;
  readonly start: boolean;
}

function TextSelectionHandleView({
  accessibilityLabel,
  gesture,
  handle,
  start,
}: TextSelectionHandleViewProps) {
  const lineHeight = Math.max(1, handle.bottom - handle.top);
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        collapsable={false}
        style={[
          styles.selectionHandleTouchTarget,
          {
            height: lineHeight + 24,
            left: handle.x - 22,
            top: handle.top - 12,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.selectionHandleStem, { height: lineHeight }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.selectionHandleKnob,
            { top: start ? 7 : lineHeight + 7 },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

export function LiveReader({
  book,
  fontProvider,
  fontProviderKey,
  width,
  height,
  appearance,
  fontSize,
  layout = "single",
  pageTurnAnimation = "natural",
  rapidPageTurnEnabled = true,
  theme = DEFAULT_READER_THEME,
  topInset = 0,
  bottomInset = 0,
  toolbarVisible = false,
  uiMessages = DEFAULT_READER_UI_MESSAGES,
  initialPosition,
  loadResource,
  automaticPageTurnTuning,
  reverseAutomaticPageTurnTuning,
  gesturePageTurnTuning,
  reverseGesturePageTurnTuning,
  onCenterPress,
  onProgress,
  onSelectionChange,
  onSelectionMenuDismiss,
  onSelectionMenuRequest,
  onTurningChange,
}: LiveReaderProps) {
  // Decoded resources belong to the open book, not to one pagination
  // generation. Retain them while geometry-dependent caches are replaced.
  const imageCache = useMemo(() => new DecodedImageCache(32 * 1024 * 1024), []);
  useEffect(() => () => imageCache.dispose(), [imageCache]);
  const anchorRef = useRef(initialPosition);
  const handleProgress = useCallback(
    (progress: ReaderProgress) => {
      anchorRef.current = progress.locator.position;
      onProgress?.(progress);
    },
    [onProgress],
  );
  const resolvedAppearance = useMemo<ReaderAppearance>(
    () =>
      appearance ?? {
        ...DEFAULT_LIVE_READER_APPEARANCE,
        fontSize: fontSize ?? DEFAULT_LIVE_READER_APPEARANCE.fontSize,
      },
    [appearance, fontSize],
  );
  const readerGeneration = JSON.stringify([
    book.revisionId,
    width,
    height,
    resolvedAppearance.fontFamily,
    resolvedAppearance.decorationFontFamily,
    resolvedAppearance.bookFontFamilyNames,
    fontProviderKey,
    resolvedAppearance.fontSize,
    resolvedAppearance.lineHeight,
    resolvedAppearance.paragraphSpacing,
    resolvedAppearance.inlineMargin,
    resolvedAppearance.textAlignment,
    // Progress decorations are baked into page-turn textures and native Pager
    // stock. Changing their placement must retire the complete render
    // generation so both caches destroy their old styled captures.
    resolvedAppearance.progressDisplay,
    layout,
    theme.name,
    theme.colorScheme,
    topInset,
    bottomInset,
  ]);
  const normalizedAutomaticPageTurnTuning = useMemo(
    () => normalizeAutomaticPageTurnTuning(automaticPageTurnTuning),
    [automaticPageTurnTuning],
  );
  const normalizedReverseAutomaticPageTurnTuning = useMemo(
    () =>
      normalizeReverseAutomaticPageTurnTuning(reverseAutomaticPageTurnTuning),
    [reverseAutomaticPageTurnTuning],
  );
  const normalizedGesturePageTurnTuning = useMemo(
    () =>
      normalizeGesturePageTurnTuningForPlatform(
        gesturePageTurnTuning,
        Platform.OS,
      ),
    [gesturePageTurnTuning],
  );
  const normalizedReverseGesturePageTurnTuning = useMemo(
    () =>
      normalizeReverseGesturePageTurnTuningForPlatform(
        reverseGesturePageTurnTuning,
        Platform.OS,
      ),
    [reverseGesturePageTurnTuning],
  );

  return (
    <StagedLazyReaderEngine
      book={book}
      fontProvider={fontProvider}
      width={width}
      height={height}
      appearance={resolvedAppearance}
      layout={layout}
      pageTurnAnimation={pageTurnAnimation}
      rapidPageTurnEnabled={rapidPageTurnEnabled}
      theme={theme}
      topInset={topInset}
      bottomInset={bottomInset}
      imageCache={imageCache}
      readerGeneration={readerGeneration}
      toolbarVisible={toolbarVisible}
      uiMessages={uiMessages}
      initialPosition={anchorRef.current}
      loadResource={loadResource}
      automaticPageTurnTuning={normalizedAutomaticPageTurnTuning}
      reverseAutomaticPageTurnTuning={normalizedReverseAutomaticPageTurnTuning}
      gesturePageTurnTuning={normalizedGesturePageTurnTuning}
      reverseGesturePageTurnTuning={normalizedReverseGesturePageTurnTuning}
      onCenterPress={onCenterPress}
      onProgress={handleProgress}
      onSelectionChange={onSelectionChange}
      onSelectionMenuDismiss={onSelectionMenuDismiss}
      onSelectionMenuRequest={onSelectionMenuRequest}
      onTurningChange={onTurningChange}
    />
  );
}

/**
 * Pagination, Skia paragraphs, recorded pages, and native Pager stock all
 * belong to one render generation. Rendering the next generation before the
 * previous effects have cleaned up briefly retains both complete working
 * sets. On iOS that peak can exhaust Hermes while it creates the next JSI
 * HostFunction, so appearance, font, and single/spread changes all crash at
 * the same stack.
 *
 * Keep the committed engine visible until React can unmount it as a separate
 * commit. Its cleanups then clear JS caches and reset the native compositor.
 * Wait through the same two-paint grace period used by Skia resources before
 * mounting the latest requested generation. The parent page color remains
 * visible during this short handoff instead of building two readers at once.
 */
function StagedLazyReaderEngine(desired: LazyReaderEngineProps) {
  const desiredRef = useRef(desired);
  desiredRef.current = desired;
  const [active, setActive] = useState(desired);
  const [retiring, setRetiring] = useState(false);

  useEffect(() => {
    if (!retiring && active.readerGeneration !== desired.readerGeneration) {
      setRetiring(true);
    }
  }, [active.readerGeneration, desired.readerGeneration, retiring]);

  useEffect(() => {
    if (!retiring) {
      return;
    }
    let cancelled = false;
    afterSkiaPaint(() => {
      const mountLatest = () => {
        if (cancelled) {
          return;
        }
        setActive(desiredRef.current);
        setRetiring(false);
      };
      // Generation cleanups use the same two-paint grace period. Mount on the
      // following frame so all retirement callbacks deterministically finish
      // before the next paragraph graph starts allocating.
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(mountLatest);
      } else {
        setTimeout(mountLatest, 16);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [retiring]);

  if (retiring) {
    return null;
  }
  const rendered =
    active.readerGeneration === desired.readerGeneration ? desired : active;
  return <LazyReaderEngine key={rendered.readerGeneration} {...rendered} />;
}

function performanceNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function eventRatePerSecond(
  timestamps: readonly number[],
  now: number,
): number {
  const recent = timestamps.filter((timestamp) => now - timestamp <= 2_000);
  const sample = recent.slice(-12);
  if (sample.length < 2 || now - sample.at(-1)! > 1_500) {
    return 0;
  }
  const duration = sample.at(-1)! - sample[0]!;
  return duration > 0 ? ((sample.length - 1) * 1_000) / duration : 0;
}

function sampleDurationStats(samples: readonly number[]): {
  readonly averageMs: number;
  readonly p95Ms: number;
} {
  if (samples.length === 0) {
    return { averageMs: 0, p95Ms: 0 };
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const averageMs =
    sorted.reduce((total, duration) => total + duration, 0) / sorted.length;
  const p95Index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );
  return { averageMs, p95Ms: sorted[p95Index]! };
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    flex: 1,
    overflow: "hidden",
  },
  linkHit: {
    backgroundColor: "transparent",
    borderRadius: 12,
    position: "absolute",
  },
  linkHitPressed: {
    backgroundColor: "rgba(201, 122, 82, 0.16)",
  },
  linkOverlay: {
    bottom: 0,
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 12,
  },
  noteReturnButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  noteReturnButtonCompact: {
    width: 44,
  },
  noteReturnButtonExpanded: {
    flex: 1,
    paddingHorizontal: 14,
  },
  noteReturnControls: {
    alignItems: "stretch",
    backgroundColor: "rgba(251, 247, 240, 0.96)",
    borderColor: "rgba(166, 79, 45, 0.28)",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 52,
    flexDirection: "row",
    overflow: "hidden",
    position: "absolute",
    elevation: 3,
    shadowColor: "#3d3026",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  noteReturnControlsCompact: {
    right: 16,
    width: 88,
  },
  noteReturnControlsExpanded: {
    right: 16,
    width: 180,
  },
  noteReturnDismissButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    width: 44,
  },
  noteReturnDismissText: {
    color: "#8b6f62",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 20,
  },
  noteReturnDivider: {
    alignSelf: "stretch",
    backgroundColor: "rgba(166, 79, 45, 0.18)",
    width: StyleSheet.hairlineWidth,
  },
  noteReturnButtonPressed: {
    backgroundColor: "rgba(244, 229, 216, 0.98)",
  },
  noteReturnText: {
    color: "#9d4728",
    fontSize: 13,
    fontWeight: "600",
  },
  accessibilityProgress: {
    height: 1,
    left: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    width: 1,
  },
  accessibilityProgressBottom: {
    bottom: 0,
  },
  accessibilityProgressText: {
    color: "transparent",
    fontSize: 1,
    lineHeight: 1,
  },
  accessibilityProgressTop: {
    top: 0,
  },
  selectionHandleKnob: {
    backgroundColor: "#2277e6",
    borderRadius: 5,
    height: 10,
    left: 17,
    position: "absolute",
    width: 10,
  },
  selectionHandleStem: {
    backgroundColor: "#2277e6",
    left: 21,
    position: "absolute",
    top: 12,
    width: 2,
  },
  selectionHandleTouchTarget: {
    position: "absolute",
    width: 44,
    zIndex: 10,
  },
});
