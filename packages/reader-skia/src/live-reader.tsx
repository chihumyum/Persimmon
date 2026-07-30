import type { BookIR, BookLocator, BookPosition } from "@persimmon/book-core";
import {
  countBookSectionPages,
  paginateBookSection,
  type PageLinkRegion,
  type PaginationResult,
} from "@persimmon/layout";
import {
  MIN_PRESSED_EDGE_X,
  NaturalPageTurnController,
  anchoredGestureFingerX,
  gestureLiftRotationForFingerX,
  gestureTurnSpeedScale,
  pageGestureModeForStart,
  postHingeTurnProgressForFingerX,
  shouldCommitTurn,
} from "@persimmon/page-turn-core";
import {
  Canvas,
  Fill,
  Rect,
  useCanvasRef,
  type SkImage,
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
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  processColor,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
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
import {
  PageTurnMesh,
  buildWebPageTurnRenderFrame,
  preparePageTurnRenderer,
  type PageTurnMeshHandle,
} from "./page-turn-mesh";
import {
  packPageTurnProfile,
  summarizePageTurnShadow,
} from "./page-turn-shader";
import {
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  pageTurnCameraBookXForLayout,
} from "./page-turn-perspective";
import { bookXForGestureTravel } from "./page-turn-gesture-direction";
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
  pageTurnXScale,
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
} from "./reader-pagination";
import { SectionPageCountCache } from "./section-page-count-cache";
import {
  estimateSectionPageCount,
  shouldResolveExactPublicationPageCounts,
} from "./section-page-count-estimate";
import { createSkiaParagraphBackend } from "./skia-paragraph-backend";
import { releaseSkiaResources } from "./skia-resource-release";
import {
  createSkiaPageDecoration,
  disposeSkiaPageDecorationAfterPaint,
  SkiaPageDecorationLayer,
  type SkiaPageDecoration,
} from "./skia-page-decoration";
import {
  useNativePageTurnDriver,
  type NativePageTurnBenchmarkCommand,
  type PageGestureReleaseInput,
} from "./native-page-turn-driver";
import {
  automaticTuningForCore,
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeAutomaticPageTurnTuning,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";
import {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  gestureTuningForCore,
  normalizeGesturePageTurnTuning,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
import {
  useNativePageTurnPool,
  type NativeProgrammaticPageTurnCommand,
} from "./native-page-turn-pool";
import {
  configureNativePagerInput,
  configureNativePagerMotion,
  enqueueNativePagerPictureTurn,
  nativePagerCompositorAvailable,
  resetNativePagerCompositor,
  runNativePagerBenchmark,
  setNativePagerAnchor,
  stockNativePagerPicture,
  takeNativePagerEvents,
  type NativePagerEvent,
} from "./native-pager-compositor";
import {
  bindNativePagerInput,
  resolveNativePagerGestureInputPolicy,
} from "./native-pager-input";
import {
  buildNativePagerStockPlan,
  nativePagerPageKey,
  nativePagerTransitionPictures,
  trimNativePagerReconciliationEntries,
} from "./native-pager-stock";
import {
  PAGE_TURN_START_INTERVAL_MS,
  beginScheduledInteractivePageTurn,
  createPageTurnSchedulerState,
  handoffScheduledInteractivePageTurn,
  hasRunningPageTurns,
  markScheduledPageTurnLaneReady,
  markScheduledPageTurnsPresented,
  requestScheduledPageTurn,
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
  theme?: ReaderTheme;
  topInset?: number;
  bottomInset?: number;
  toolbarVisible?: boolean;
  initialPosition?: BookPosition;
  loadResource?: ResourceLoader;
  automaticPageTurnTuning?: AutomaticPageTurnTuning;
  gesturePageTurnTuning?: GesturePageTurnTuning;
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
const PAGE_CAPTURE_MAX_DIRECTIONAL_VIEWS = 12;
const PAGE_CAPTURE_MIN_DIRECTIONAL_VIEWS = 3;

interface RunningPageTurn {
  readonly turnId: string;
  readonly direction: 1 | -1;
  readonly controller: NaturalPageTurnController;
  readonly settlingIncomingPage: boolean;
  animationFrame: number;
  previousFrameTime: number;
}

interface PendingPageGesture {
  startLocalX: number;
  startLocalY: number;
  startTime: number;
  lastDx: number;
  lastTime: number;
  throwVelocity: number;
  throwAcceleration: number;
}

interface QueuedPageGestureMove {
  readonly localX: number;
  readonly localY: number;
  readonly eventTime: number;
  readonly dx: number;
}

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

function noteKindLabel(noteKind: PageLinkRegion["link"]["noteKind"]): string {
  return noteKind === "endnote"
    ? "尾注"
    : noteKind === "footnote"
      ? "脚注"
      : "注释";
}

function linkAccessibilityLabel(region: PageLinkRegion): string {
  if (region.link.kind === "note-reference") {
    return `打开${noteKindLabel(region.link.noteKind)} ${region.link.label}`;
  }
  if (region.link.kind === "note-backlink") {
    return `返回正文 ${region.link.label}`;
  }
  return `跳转到 ${region.link.label}`;
}

function LazyReaderEngine({
  book,
  fontProvider,
  width,
  height,
  appearance,
  layout = "single",
  pageTurnAnimation = "natural",
  theme = DEFAULT_READER_THEME,
  topInset,
  bottomInset,
  imageCache,
  readerGeneration,
  toolbarVisible = false,
  initialPosition,
  loadResource,
  automaticPageTurnTuning = DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  gesturePageTurnTuning = DEFAULT_GESTURE_PAGE_TURN_TUNING,
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
      ),
    [automaticPageTurnTuning],
  );
  const nativePagerCompositorEnabled =
    (Platform.OS === "android" || Platform.OS === "ios") &&
    pageTurnAnimation === "natural" &&
    nativePagerCompositorAvailable();
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
    () => createSkiaParagraphBackend(fontProvider, theme),
    [fontProvider, theme],
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
      horizontalMargin: appearance.horizontalMargin,
      progressDisplay: "hidden",
    }),
    [
      appearance.fontFamily,
      appearance.bookFontFamilyNames,
      appearance.fontSize,
      appearance.horizontalMargin,
      appearance.lineHeight,
      appearance.paragraphSpacing,
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
            backend,
            (paragraph) => releaseSkiaResources(Platform.OS, paragraph, null),
          ),
      }),
    [backend, book, paginationCache, spec],
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
  const nativePagerDirectTurnIdsRef = useRef(new Set<string>());
  const nativePagerGestureTurnIdsRef = useRef(new Set<string>());
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
    if (!shouldResolveExactPublicationPageCounts(Platform.OS, book.sections)) {
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
      return createPageProgressDecoration({
        address,
        bookTitle: book.title,
        sectionTitle: book.title,
        sectionPageCounts,
        currentSectionPageCount: pageCountForSection(address.sectionIndex),
        pagesPerView,
      });
    },
    [book.title, pageCountForSection, pagesPerView, sectionPageCounts],
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
        appearance.horizontalMargin,
        pagesPerView,
        width,
        height,
        topInset,
        bottomInset,
        theme.name,
        theme.colorScheme,
        theme.decoration,
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
        horizontalMargin: appearance.horizontalMargin,
        pagesPerView,
        topInset,
        bottomInset,
        theme,
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
      appearance.horizontalMargin,
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

  useEffect(() => {
    if (Platform.OS === "web" && pageTurnAnimation === "natural") {
      preparePageTurnRenderer(width, layout === "spread", theme.paper);
    }
  }, [layout, pageTurnAnimation, theme.paper, width]);

  useEffect(
    () => () => {
      turnCaptureLeasesRef.current.clear();
      captureStartTimesRef.current.clear();
      pageCaptureCache.clear();
      for (const pagination of paginationCache.values()) {
        disposePaginationAfterPaint(pagination);
      }
      paginationCache.clear();
      for (const cached of pageDecorationCache.values()) {
        disposeSkiaPageDecorationAfterPaint(cached.decoration);
      }
      pageDecorationCache.clear();
    },
    [pageCaptureCache, pageDecorationCache, paginationCache],
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
  const runningTurnRef = useRef<RunningPageTurn | undefined>(undefined);
  const pendingGestureRef = useRef<PendingPageGesture | undefined>(undefined);
  const queuedGestureMoveRef = useRef<QueuedPageGestureMove | undefined>(
    undefined,
  );
  const gestureMoveFrameRef = useRef(0);
  const webPageTurnMeshRefs = useRef(
    new Map<
      string,
      Partial<Record<PageTurnFace | "both", PageTurnMeshHandle>>
    >(),
  );
  const webPageTurnFrames = useRef(
    new Map<string, ReturnType<typeof buildWebPageTurnRenderFrame>>(),
  );
  useEffect(() => {
    const activeTurnIds = new Set(activeTurns.map((turn) => turn.id));
    for (const turnId of webPageTurnFrames.current.keys()) {
      if (!activeTurnIds.has(turnId)) {
        webPageTurnFrames.current.delete(turnId);
      }
    }
  }, [activeTurns]);
  const registerWebPageTurnMesh = useCallback(
    (
      turnId: string,
      face: PageTurnFace | "both",
      handle: PageTurnMeshHandle | null,
    ) => {
      const current = webPageTurnMeshRefs.current.get(turnId);
      if (handle) {
        const handles = current ?? {};
        handles[face] = handle;
        webPageTurnMeshRefs.current.set(turnId, handles);
        const latestFrame = webPageTurnFrames.current.get(turnId);
        if (latestFrame) {
          handle.updateFrame(latestFrame);
        }
        return;
      }
      if (!current) {
        return;
      }
      delete current[face];
      if (Object.keys(current).length === 0) {
        webPageTurnMeshRefs.current.delete(turnId);
      }
    },
    [],
  );
  const readerViewRef = useRef<View>(null);
  const readerCanvasRef = useCanvasRef();
  const [nativePagerCanvasId, setNativePagerCanvasId] = useState<number>();
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
  const publishTurnFrame = useCallback(
    (
      turnId: string,
      controller: NaturalPageTurnController,
      turnDirection: 1 | -1,
      _settlingIncomingPage = false,
    ) => {
      const xScale = pageTurnXScale(turnDirection);
      const packed = packPageTurnProfile(controller.getPoints(), xScale);
      const summary = summarizePageTurnShadow(
        controller.getPoints(),
        controller.getMetrics(),
        xScale,
        pageTurnCameraBookXForLayout(layout === "spread"),
      );
      const frame = buildWebPageTurnRenderFrame(
        packed,
        [summary.center, summary.width, summary.strength, summary.direction],
        width,
        layout === "spread",
        turnDirection,
      );
      webPageTurnFrames.current.set(turnId, frame);
      const handles = webPageTurnMeshRefs.current.get(turnId);
      handles?.back?.updateFrame(frame);
      handles?.front?.updateFrame(frame);
      handles?.both?.updateFrame(frame);
    },
    [layout, width],
  );
  const stopRunningTurn = useCallback(() => {
    const running = runningTurnRef.current;
    if (running?.animationFrame) {
      cancelAnimationFrame(running.animationFrame);
    }
    runningTurnRef.current = undefined;
  }, []);
  const animateRunningTurn = useCallback(
    (running: RunningPageTurn) => {
      stopRunningTurn();
      runningTurnRef.current = running;

      const tick = (now: number) => {
        if (runningTurnRef.current !== running) {
          return;
        }
        let remainingTime = Math.min(
          0.25,
          Math.max(0, (now - running.previousFrameTime) / 1000),
        );
        running.previousFrameTime = now;
        // Keep the physical solver's stable 50 ms step without stretching a
        // turn when a native or headless frame is late. Rendering skips to the
        // newest solved state while the motion still tracks wall-clock time.
        while (remainingTime > 0) {
          const step = Math.min(0.05, remainingTime);
          running.controller.advance(step);
          remainingTime -= step;
        }
        publishTurnFrame(
          running.turnId,
          running.controller,
          running.direction,
          running.settlingIncomingPage,
        );

        if (running.controller.getPhase() === "completed") {
          runningTurnRef.current = undefined;
          settleTurn(running.turnId);
          return;
        }
        if (!running.controller.needsAnimationFrame()) {
          runningTurnRef.current = undefined;
          cancelInteractiveTurn(running.turnId);
          return;
        }
        running.animationFrame = requestAnimationFrame(tick);
      };

      running.animationFrame = requestAnimationFrame(tick);
    },
    [cancelInteractiveTurn, publishTurnFrame, settleTurn, stopRunningTurn],
  );

  useEffect(() => stopRunningTurn, [stopRunningTurn]);

  const requestTurn = useCallback(
    (requestedDirection: 1 | -1, requestedAtMs = Date.now()) => {
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
        const next = requestScheduledPageTurn(
          current,
          requestedDirection,
          turnScheduler,
          requestedAtMs,
        );
        if (next.turns.length <= current.turns.length) {
          const lastTurn = current.turns.at(-1);
          const activeTapTurns = current.turns.filter(
            (turn) => turn.motion === "tap",
          ).length;
          if (
            current.turns.length >= turnConcurrency.maximumConcurrentTurns ||
            activeTapTurns >= turnConcurrency.maximumConcurrentTapTurns
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
      turnConcurrency.maximumConcurrentTapTurns,
      turnConcurrency.maximumConcurrentTurns,
      turnScheduler,
    ],
  );
  useEffect(() => {
    if (!__DEV__ || Platform.OS === "web") {
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
            `[Persimmon][10pps-summary] requested=${requestedTurnStartsRef.current.length}/${turnCount} delivered=${deliveredTurnStartsRef.current.length}/${turnCount} accepted=${acceptedTurnStartsRef.current.length}/${turnCount} presented=${presentationAckCountRef.current}/${turnCount} animations=${laneStarts.length}/${turnCount} premature=${prematureLaneStartCountRef.current} rejected=capacity:${rejected.capacity},boundary:${rejected.boundary},direction:${rejected.direction},capture:${rejected.capture},other:${rejected.other} durationAvg=${durationStats.averageMs.toFixed(1)}ms durationP95=${durationStats.p95Ms.toFixed(1)}ms speedMin=${minimumPlaybackSpeed.toFixed(2)}x speedAvg=${playbackSpeedStats.averageMs.toFixed(2)}x rnTailAvg=${outcomeDispatchLagStats.averageMs.toFixed(1)}ms rnTailP95=${outcomeDispatchLagStats.p95Ms.toFixed(1)}ms laneGapP95=${laneGapStats.p95Ms.toFixed(1)}ms laneGapMax=${maximumLaneGapMs.toFixed(1)}ms laneSpan=${laneSpanMs.toFixed(1)}ms`,
          );
          console.info(
            `[Persimmon][10pps-gaps] delivered=${deliveryGaps.map((gap) => gap.toFixed(1)).join(",")} native=${laneGaps.map((gap) => gap.toFixed(1)).join(",")}`,
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
      const coreTuning = gestureTuningForCore(gesturePageTurnTuning);
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
          settlingProgress: input.turnProgress,
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
          runningTurnRef.current?.turnId ??
          (driverTurnRef.current?.interactive
            ? driverTurnRef.current.id
            : undefined);
        if (!interactiveTurnId) {
          return false;
        }
        if (Platform.OS === "web") {
          stopRunningTurn();
        } else {
          handedOffTurnIdsRef.current.add(interactiveTurnId);
          nativeInteractiveTurnIdRef.current = undefined;
        }
        mutateReaderState((current) =>
          handoffScheduledInteractivePageTurn(
            current,
            interactiveTurnId,
            release,
            Platform.OS !== "web",
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
      mutateReaderState,
      pageTurnAnimation,
      readerGenerationIsCurrent,
      requestTurn,
      stopRunningTurn,
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
  const beginInteractiveTurn = useCallback(
    (
      requestedDirection: 1 | -1,
      startBookX: number,
      startBookY: number,
      eventTime: number,
    ) => {
      const currentReaderState = readerStateRef.current;
      if (
        currentReaderState.turns.some(
          (turn) => turn.interactive || turn.handoffPending,
        ) ||
        currentReaderState.turns.length >=
          turnConcurrency.maximumConcurrentTurns
      ) {
        return false;
      }
      const scheduled = beginScheduledInteractivePageTurn(
        currentReaderState,
        requestedDirection,
        turnScheduler,
        Date.now(),
      );
      if (scheduled === currentReaderState) {
        return false;
      }
      const active = scheduled.turns.at(-1);
      if (!active?.interactive) {
        return false;
      }
      const controller = new NaturalPageTurnController(
        gestureTuningForCore(gesturePageTurnTuning),
      );
      const settlingIncomingPage =
        layout === "single" && requestedDirection === -1;
      const beganGesture = settlingIncomingPage
        ? controller.beginSettlingPageDrag(eventTime)
        : controller.beginDrag(startBookX, startBookY, eventTime);
      if (!beganGesture) {
        return false;
      }
      stopRunningTurn();
      runningTurnRef.current = {
        turnId: active.id,
        direction: requestedDirection,
        controller,
        settlingIncomingPage,
        animationFrame: 0,
        previousFrameTime: eventTime * 1000,
      };
      publishTurnFrame(
        active.id,
        controller,
        requestedDirection,
        settlingIncomingPage,
      );
      mutateReaderState(() => scheduled);
      return true;
    },
    [
      gesturePageTurnTuning,
      mutateReaderState,
      publishTurnFrame,
      layout,
      stopRunningTurn,
      turnConcurrency.maximumConcurrentTurns,
      turnScheduler,
    ],
  );
  const updateInteractiveTurn = useCallback(
    (localX: number, localY: number, eventTime: number, gestureDx: number) => {
      const running = runningTurnRef.current;
      const pending = pendingGestureRef.current;
      if (!running || !pending) {
        return;
      }
      const startBookX = materialXForTouch(
        pending.startLocalX,
        running.direction,
        layout,
        physicalPageWidth,
      );
      // The reference surface is a two-page spread, so one physical page is
      // half of its interaction width. Preserve that hand travel in this
      // single-page viewport; otherwise the finger can never cross the virtual
      // spine far enough to exercise the roll hinge on a phone.
      const bookX = bookXForGestureTravel(
        startBookX,
        localX - pending.startLocalX,
        running.direction,
        physicalPageWidth,
      );
      const bookY = clampUnit(localY / height);
      const travel = running.direction === 1 ? -gestureDx : gestureDx;
      const turnProgress = clampUnit(
        travel / ((layout === "spread" ? physicalPageWidth : width) * 0.72),
      );
      if (running.settlingIncomingPage) {
        running.controller.moveSettlingPageDrag(turnProgress, eventTime);
      } else {
        running.controller.moveDrag(bookX, bookY, eventTime);
      }
      publishTurnFrame(
        running.turnId,
        running.controller,
        running.direction,
        running.settlingIncomingPage,
      );
    },
    [height, layout, physicalPageWidth, publishTurnFrame, width],
  );
  const applyQueuedGestureMove = useCallback(() => {
    const queued = queuedGestureMoveRef.current;
    queuedGestureMoveRef.current = undefined;
    if (!queued) {
      return;
    }
    updateInteractiveTurn(
      queued.localX,
      queued.localY,
      queued.eventTime,
      queued.dx,
    );
  }, [updateInteractiveTurn]);
  const queueInteractiveTurnMove = useCallback(
    (move: QueuedPageGestureMove) => {
      queuedGestureMoveRef.current = move;
      if (gestureMoveFrameRef.current) {
        return;
      }
      gestureMoveFrameRef.current = requestAnimationFrame(() => {
        gestureMoveFrameRef.current = 0;
        applyQueuedGestureMove();
      });
    },
    [applyQueuedGestureMove],
  );
  const flushInteractiveTurnMove = useCallback(() => {
    if (gestureMoveFrameRef.current) {
      cancelAnimationFrame(gestureMoveFrameRef.current);
      gestureMoveFrameRef.current = 0;
    }
    applyQueuedGestureMove();
  }, [applyQueuedGestureMove]);
  const clearQueuedGestureMove = useCallback(() => {
    if (gestureMoveFrameRef.current) {
      cancelAnimationFrame(gestureMoveFrameRef.current);
      gestureMoveFrameRef.current = 0;
    }
    queuedGestureMoveRef.current = undefined;
  }, []);
  useEffect(() => clearQueuedGestureMove, [clearQueuedGestureMove]);
  const finishInteractiveTurn = useCallback(
    (eventTime: number) => {
      const running = runningTurnRef.current;
      if (!running) {
        return;
      }
      if (running.settlingIncomingPage) {
        running.controller.endSettlingPageDrag();
      } else {
        running.controller.endDrag(eventTime);
      }
      publishTurnFrame(
        running.turnId,
        running.controller,
        running.direction,
        running.settlingIncomingPage,
      );
      running.previousFrameTime = eventTime * 1000;
      animateRunningTurn(running);
    },
    [animateRunningTurn, publishTurnFrame],
  );
  const cancelGestureTurn = useCallback(() => {
    clearQueuedGestureMove();
    const running = runningTurnRef.current;
    if (!running) {
      return;
    }
    running.controller.cancelDrag();
    stopRunningTurn();
    cancelInteractiveTurn(running.turnId);
  }, [cancelInteractiveTurn, clearQueuedGestureMove, stopRunningTurn]);
  const pagePanResponder = useMemo(() => {
    const shouldClaimHorizontalDrag = (
      gesture: PanResponderGestureState,
    ): boolean =>
      Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _event: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => Platform.OS === "web" && shouldClaimHorizontalDrag(gesture),
      onMoveShouldSetPanResponderCapture: (
        _event: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => Platform.OS === "web" && shouldClaimHorizontalDrag(gesture),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (
        event: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        const origin = readerOriginRef.current;
        pendingGestureRef.current = {
          startLocalX: gesture.x0 - origin.x,
          startLocalY: gesture.y0 - origin.y,
          startTime: eventTimeSeconds(event),
          lastDx: 0,
          lastTime: eventTimeSeconds(event),
          throwVelocity: 0,
          throwAcceleration: 0,
        };
      },
      onPanResponderMove: (
        event: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        const pending = pendingGestureRef.current;
        if (pending) {
          updatePendingGestureKinematics(
            pending,
            gesture.dx,
            eventTimeSeconds(event),
            physicalPageWidth,
          );
        }
        if (
          pageTurnAnimation === "natural" &&
          !runningTurnRef.current &&
          pending &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        ) {
          const requestedDirection: 1 | -1 = gesture.dx < 0 ? 1 : -1;
          const startBookX = materialXForTouch(
            pending.startLocalX,
            requestedDirection,
            layout,
            physicalPageWidth,
          );
          beginInteractiveTurn(
            requestedDirection,
            startBookX,
            clampUnit(pending.startLocalY / height),
            pending.startTime,
          );
        }
        queueInteractiveTurnMove({
          localX: gesture.moveX - readerOriginRef.current.x,
          localY: gesture.moveY - readerOriginRef.current.y,
          eventTime: eventTimeSeconds(event),
          dx: gesture.dx,
        });
      },
      onPanResponderRelease: (
        event: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        flushInteractiveTurnMove();
        const running = runningTurnRef.current;
        const pending = pendingGestureRef.current;
        pendingGestureRef.current = undefined;
        if (running?.controller.getPhase() === "drag") {
          const startBookX = pending
            ? materialXForTouch(
                pending.startLocalX,
                running.direction,
                layout,
                physicalPageWidth,
              )
            : undefined;
          const handedOff =
            pending && startBookX !== undefined
              ? requestGestureTurn({
                  direction: running.direction,
                  interactive: true,
                  startBookX,
                  currentBookX: bookXForGestureTravel(
                    startBookX,
                    gesture.dx,
                    running.direction,
                    physicalPageWidth,
                  ),
                  throwVelocity: pending.throwVelocity,
                  throwAcceleration: pending.throwAcceleration,
                  turnProgress: clampUnit(
                    Math.abs(gesture.dx) /
                      Math.max(1, physicalPageWidth * 0.72),
                  ),
                  settlingIncomingPage:
                    layout === "single" && running.direction === -1,
                })
              : false;
          if (!handedOff) {
            finishInteractiveTurn(eventTimeSeconds(event));
          }
        } else if (
          pending &&
          Math.abs(gesture.dx) > 1 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        ) {
          const direction: 1 | -1 = gesture.dx < 0 ? 1 : -1;
          const startBookX = materialXForTouch(
            pending.startLocalX,
            direction,
            layout,
            physicalPageWidth,
          );
          requestGestureTurn({
            direction,
            interactive: false,
            startBookX,
            currentBookX: bookXForGestureTravel(
              startBookX,
              gesture.dx,
              direction,
              physicalPageWidth,
            ),
            throwVelocity: pending.throwVelocity,
            throwAcceleration: pending.throwAcceleration,
            turnProgress: clampUnit(
              Math.abs(gesture.dx) / Math.max(1, physicalPageWidth * 0.72),
            ),
            settlingIncomingPage: layout === "single" && direction === -1,
          });
        } else if (
          Platform.OS !== "web" &&
          pending &&
          Math.abs(gesture.dx) < 8 &&
          Math.abs(gesture.dy) < 8 &&
          pending.startLocalX <= width * 0.24
        ) {
          requestTurn(-1);
        } else if (
          Platform.OS !== "web" &&
          pending &&
          Math.abs(gesture.dx) < 8 &&
          Math.abs(gesture.dy) < 8 &&
          pending.startLocalX >= width * 0.76
        ) {
          requestTurn(1);
        }
      },
      onPanResponderTerminate: () => {
        pendingGestureRef.current = undefined;
        cancelGestureTurn();
      },
    });
  }, [
    beginInteractiveTurn,
    cancelGestureTurn,
    finishInteractiveTurn,
    flushInteractiveTurnMove,
    height,
    layout,
    pageTurnAnimation,
    physicalPageWidth,
    queueInteractiveTurnMove,
    requestGestureTurn,
    requestTurn,
    width,
  ]);

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
    if (!__DEV__ || Platform.OS === "web" || pageTurnAnimation === "none") {
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
        `[Persimmon][10pps] input=${requestedRate.toFixed(1)}/s delivered=${deliveredRate.toFixed(1)}/s accepted=${acceptedRate.toFixed(1)}/s presented=${presentationAckCountRef.current} lanes=${laneRate.toFixed(1)}/s premature=${prematureLaneStartCountRef.current} active=${active} interval=${turnConcurrency.minimumTurnIntervalMs}ms captureP95=${feeder.p95JobMs.toFixed(1)}ms captureAvg=${feeder.averageJobMs.toFixed(1)}ms queue=${feeder.queued} workers=${feeder.inFlight}/${PAGE_CAPTURE_RASTER_WORKER_COUNT} cache=${(cache.residentBytes / 1_048_576).toFixed(1)}MB pinned=${(cache.pinnedBytes / 1_048_576).toFixed(1)}MB`,
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
    () => pageTurnsReadyForPaint(texturePreparedTurns, Platform.OS !== "web"),
    [texturePreparedTurns],
  );
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const turnIds = renderableTurns
      .filter(
        (turn) =>
          !turn.completed &&
          !turn.interactive &&
          turn.motion === "tap" &&
          !nativePagerCompositorEnabled &&
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
              turn.motion === "tap" &&
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
  const nativePagerTapInputEnabled =
    nativePagerCompositorEnabled &&
    !selectingText &&
    nativeBenchmarkCommand === undefined &&
    activeTurns.length === 0;
  const nativePagerGestureInputPolicy = resolveNativePagerGestureInputPolicy({
    selectionActive: selectingText,
    benchmarkActive: nativeBenchmarkCommand !== undefined,
    nativePagerInputReady: nativePagerTapInputEnabled,
    directTapActive:
      nativePagerDirectActiveCount !== nativePagerGestureActiveCount,
  });
  const nativePageTurn = useNativePageTurnDriver({
    gesturesEnabled: nativePagerGestureInputPolicy.recognizerEnabled,
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
    command: nativeCommand,
    benchmark: nativePagerCompositorEnabled
      ? undefined
      : nativeBenchmarkCommand,
    onCenterTap: handleNativeCenterTap,
    onGestureBegin: beginNativeInteractiveTurn,
    onGestureRelease: requestGestureTurn,
    onTapTurn: handleNativePageTap,
    onOutcome: completeNativeTurn,
  });
  const selectionLongPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(
          Platform.OS !== "web" &&
            !transitionReady &&
            nativePagerDirectActiveCount === 0,
        )
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
          Platform.OS !== "web" &&
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
        .enabled(Platform.OS !== "web" && textSelection !== undefined)
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
  const automaticTapPlaybackSpeeds = useMemo(() => {
    const tapTurns = activeTurns.filter(
      (turn) => !turn.completed && turn.motion === "tap",
    );
    const retainedTurnIds = new Set(tapTurns.map((turn) => turn.id));
    for (const turnId of burstCompressedTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        burstCompressedTurnIdsRef.current.delete(turnId);
      }
    }
    if (tapTurns.length >= 2) {
      for (const turn of tapTurns) {
        burstCompressedTurnIdsRef.current.add(turn.id);
      }
    }
    return new Map(
      tapTurns.map((turn) => [
        turn.id,
        burstCompressedTurnIdsRef.current.has(turn.id)
          ? burstPageTurnPlaybackSpeed(automaticPageTurnTuning)
          : automaticPageTurnTuning.playbackSpeed,
      ]),
    );
  }, [activeTurns, automaticPageTurnTuning]);
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
      const directEntry = nativePagerStockEntriesRef.current.get(turnId);
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
        nativePagerPlaybackSpeedsRef.current.set(
          turnId,
          directEntry.playbackSpeed,
        );
        presentationAckCountRef.current += 1;
        recordScheduledTurnLaneStarted(
          turnId,
          eventAtMs,
          directEntry.playbackSpeed,
        );
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
        nativePagerStockedEntryIdsRef.current.delete(turnId);
        nativePagerStockEntriesRef.current.delete(turnId);
        if (!directEntry || !readerGenerationIsCurrent()) {
          rejectedTurnCountsRef.current.other += 1;
          return;
        }
        if (!gestureTurnActive) {
          acceptedTurnStartsRef.current.push(eventAtMs);
        }
        captureFeedDirectionRef.current = directEntry.direction;
        const acknowledgedEpoch = `${readerGeneration}:${nativePagerPageKey(directEntry.to)}`;
        nativePagerAcknowledgedPageKeyRef.current = acknowledgedEpoch;
        nativePagerReconciliationEpochsRef.current.add(acknowledgedEpoch);
        nativePagerDirectTurnIdsRef.current.add(turnId);
        setNativePagerDirectActiveCount(
          nativePagerDirectTurnIdsRef.current.size,
        );
        presentationRequiredTurnIdsRef.current.add(turnId);
        presentedTurnIdsRef.current.add(turnId);
        nativePagerPlaybackSpeedsRef.current.set(
          turnId,
          directEntry.playbackSpeed,
        );
        mutateReaderState(() => createPageTurnSchedulerState(directEntry.to));
        setNoteReturnAnchor((current) =>
          reduceNoteReturnAnchor(current, { type: "page-turned" }),
        );
        return;
      }
      const directTurnActive = nativePagerDirectTurnIdsRef.current.has(turnId);
      if (event === "started") {
        presentationAckCountRef.current += 1;
        recordScheduledTurnLaneStarted(
          turnId,
          eventAtMs,
          nativePagerPlaybackSpeedsRef.current.get(turnId) ??
            automaticPageTurnTuning.playbackSpeed,
        );
        return;
      }
      if (directTurnActive) {
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
      completeScheduledTurn(turnId, 1, eventAtMs);
    },
  );
  useEffect(() => {
    const canvas = nativePagerCompositorEnabled
      ? readerCanvasRef.current
      : null;
    setNativePagerCanvasId(canvas?.getNativeId());
  }, [nativePagerCompositorEnabled, readerCanvasRef, readerGeneration]);
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
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    const canvas = readerCanvasRef.current;
    const processedPaperColor = processColor(theme.paper);
    const paperColor =
      typeof processedPaperColor === "number"
        ? processedPaperColor >>> 0
        : 0xffffffff;
    const playbackSpeed = automaticPageTurnTuning.playbackSpeed;
    const entryIdFor = (
      from: PageAddress,
      to: PageAddress,
      direction: 1 | -1,
    ) =>
      `native-stock:${readerGeneration}:${imageVersion}:${nativePagerPageKey(from)}:${direction}:${nativePagerPageKey(to)}`;
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
    const recordings = new Map<string, RecordedPageCapture | null>();
    const disposeRecordings = () => {
      for (const recording of recordings.values()) {
        recording?.dispose();
      }
      recordings.clear();
    };
    const recordingFor = (
      metadata: PageCaptureMetadata,
    ): RecordedPageCapture | null => {
      const identity = pageCaptureIdentity(metadata);
      if (recordings.has(identity.key)) {
        return recordings.get(identity.key) ?? null;
      }
      if (!pageReadyForCapture(metadata.address)) {
        recordings.set(identity.key, null);
        return null;
      }
      const recording = createRecordedPageCapture(
        identity,
        crispTapCaptureQuality.desiredScale,
      );
      recordings.set(identity.key, recording);
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
          durationMs: estimateAutomaticPageTurnDurationMs(
            automaticPageTurnTuning,
            edge.direction,
          ),
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
          playbackSpeed,
        });
        trimNativePagerReconciliationEntries(
          nativePagerStockEntriesRef.current,
          retainedEntryIds,
          128,
        );
      }
      if (nextEdgeIndex < pendingEdges.length) {
        frame = requestAnimationFrame(feedStock);
      } else {
        disposeRecordings();
      }
    };
    feedStock();
    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      disposeRecordings();
    };
  }, [
    automaticPageTurnTuning,
    captureSlotsForView,
    createRecordedPageCapture,
    crispTapCaptureQuality.desiredScale,
    imageVersion,
    layout,
    nativePagerCompositorEnabled,
    nativePagerStockPlan,
    pageCaptureIdentity,
    pageCaptureVersion,
    pageReadyForCapture,
    readerCanvasRef,
    readerGeneration,
    theme.paper,
    turnConcurrency.minimumTurnIntervalMs,
  ]);
  useEffect(() => {
    if (!nativePagerCompositorEnabled || !readerCanvasRef.current) {
      return;
    }
    configureNativePagerMotion(readerCanvasRef.current, {
      automatic: automaticTuningForCore(automaticPageTurnTuning),
      gesture: gestureTuningForCore(gesturePageTurnTuning),
    });
  }, [
    automaticPageTurnTuning,
    gesturePageTurnTuning,
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
      nativePagerTapInputEnabled,
      configureNativePagerInput,
    );
  }, [
    nativePagerCompositorEnabled,
    nativePagerCanvasId,
    nativePagerTapInputEnabled,
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
        automaticTapPlaybackSpeeds.get(turn.id) ??
        automaticPageTurnTuning.playbackSpeed;
      const durationMs =
        estimateAutomaticPageTurnDurationMs(
          automaticPageTurnTuning,
          turn.direction,
        ) *
        (automaticPageTurnTuning.playbackSpeed / Math.max(0.01, playbackSpeed));
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
    automaticTapPlaybackSpeeds,
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
        turn.motion === "tap" &&
        !nativePagerCompositorEnabled
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
        playbackSpeed:
          turn.motion === "tap"
            ? (automaticTapPlaybackSpeeds.get(turn.id) ??
              automaticPageTurnTuning.playbackSpeed)
            : undefined,
        gestureRelease: turn.gestureRelease,
      };
    }
    return commands;
  }, [
    automaticPageTurnTuning.playbackSpeed,
    automaticTapPlaybackSpeeds,
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
    gestureTuning: gesturePageTurnTuning,
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
        setImageVersion((current) => current + 1);
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
    onProgress?.({
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
    });
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
      {...(Platform.OS === "web" ? pagePanResponder.panHandlers : {})}
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
            {Platform.OS === "web"
              ? retainedPaperTurns
                  .filter((turn) => !turn.completed && !turn.interactive)
                  .map((turn) => (
                    <AutomaticWebPageTurnDriver
                      key={`driver:${turn.id}`}
                      automaticPageTurnTuning={automaticPageTurnTuning}
                      gesturePageTurnTuning={gesturePageTurnTuning}
                      onComplete={settleTurn}
                      onFrame={publishTurnFrame}
                      playbackSpeed={
                        automaticTapPlaybackSpeeds.get(turn.id) ??
                        automaticPageTurnTuning.playbackSpeed
                      }
                      spread={layout === "spread"}
                      turn={turn}
                    />
                  ))
              : null}
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
              if (Platform.OS === "web") {
                return (
                  <WebPageTurnFaceMesh
                    key={`${turn.id}:${face}`}
                    automaticPageTurnTuning={automaticPageTurnTuning}
                    backImage={texture.backImage ?? undefined}
                    drawShadow={shouldDrawPageTurnShadow(turn.direction, face)}
                    face={face}
                    gesturePageTurnTuning={gesturePageTurnTuning}
                    height={height}
                    onRef={(handle) =>
                      registerWebPageTurnMesh(turn.id, face, handle)
                    }
                    paperColor={theme.paper}
                    paperImage={texture.frontImage}
                    spread={layout === "spread"}
                    turn={turn}
                    width={width}
                  />
                );
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

      <View
        pointerEvents={Platform.OS === "web" ? "auto" : "none"}
        style={[
          styles.edge,
          styles.leftEdge,
          previousDisabled && styles.disabledEdge,
        ]}
      >
        <Pressable
          accessibilityLabel="上一页"
          accessibilityRole="button"
          disabled={previousDisabled || Platform.OS !== "web"}
          onPress={() => requestTurn(-1)}
          style={styles.edgePressable}
        />
      </View>
      <View
        pointerEvents={Platform.OS === "web" ? "auto" : "none"}
        style={[
          styles.edge,
          styles.rightEdge,
          nextDisabled && styles.disabledEdge,
        ]}
      >
        <Pressable
          accessibilityLabel="下一页"
          accessibilityRole="button"
          disabled={nextDisabled || Platform.OS !== "web"}
          onPress={() => requestTurn(1)}
          style={styles.edgePressable}
        />
      </View>

      {Platform.OS === "web" ? (
        <View style={styles.centerTapArea}>
          <Pressable
            accessibilityLabel="切换阅读工具"
            accessibilityRole="button"
            onPress={onCenterPress}
            style={styles.edgePressable}
          />
        </View>
      ) : null}

      {!transitionReady && anchorSelectionHandle && focusSelectionHandle ? (
        <>
          <TextSelectionHandleView
            accessibilityLabel="拖动文本选择起点"
            gesture={anchorSelectionHandleGesture}
            handle={anchorSelectionHandle}
            start={anchorIsSelectionStart}
          />
          <TextSelectionHandleView
            accessibilityLabel="拖动文本选择终点"
            gesture={focusSelectionHandleGesture}
            handle={focusSelectionHandle}
            start={!anchorIsSelectionStart}
          />
        </>
      ) : null}

      {showProgressHeader ? (
        <View
          accessible
          accessibilityLabel={`页眉：${settledProgressDecoration.sectionTitle}`}
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
              ? `全书 ${settledProgressDecoration.percentageLabel}`
              : `全书第 ${settledProgressDecoration.pageLabel} 页`
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
                ? "跳到注释内容，并提供返回正文的按钮"
                : undefined
            }
            accessibilityLabel={linkAccessibilityLabel(region)}
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
              accessibilityLabel={`返回${noteKindLabel(noteReturnAnchor.noteKind)}引用位置 ${noteReturnAnchor.label}`}
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
                  : "↩ 返回正文"}
              </Text>
            </Pressable>
            <View
              style={[
                styles.noteReturnDivider,
                { backgroundColor: theme.border },
              ]}
            />
            <Pressable
              accessibilityLabel={`关闭返回${noteKindLabel(noteReturnAnchor.noteKind)}引用位置的按钮`}
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
      {Platform.OS === "web" ? (
        readerContent
      ) : (
        <GestureDetector gesture={nativeReaderGesture}>
          {readerContent}
        </GestureDetector>
      )}
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

interface WebPageTurnFaceMeshProps {
  readonly turn: ScheduledPageTurn;
  readonly automaticPageTurnTuning: AutomaticPageTurnTuning;
  readonly gesturePageTurnTuning: GesturePageTurnTuning;
  readonly paperImage: SkImage;
  readonly backImage?: SkImage;
  readonly paperColor: string;
  readonly width: number;
  readonly height: number;
  readonly spread: boolean;
  readonly face: PageTurnFace | "both";
  readonly drawShadow: boolean;
  readonly onRef: (handle: PageTurnMeshHandle | null) => void;
}

function WebPageTurnFaceMesh({
  turn,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  paperImage,
  backImage,
  paperColor,
  width,
  height,
  spread,
  face,
  drawShadow,
  onRef,
}: WebPageTurnFaceMeshProps) {
  const initialProfile = useMemo(
    () =>
      initialWebPageTurnProfile(
        turn,
        spread,
        automaticPageTurnTuning,
        gesturePageTurnTuning,
      ),
    [automaticPageTurnTuning, gesturePageTurnTuning, spread, turn],
  );

  return (
    <PageTurnMesh
      ref={onRef}
      backImage={backImage}
      drawShadow={drawShadow}
      face={face}
      height={height}
      initialProfile={initialProfile}
      paperColor={paperColor}
      paperImage={paperImage}
      direction={turn.direction}
      spread={spread}
      width={width}
    />
  );
}

interface AutomaticWebPageTurnDriverProps {
  readonly turn: ScheduledPageTurn;
  readonly automaticPageTurnTuning: AutomaticPageTurnTuning;
  readonly playbackSpeed: number;
  readonly gesturePageTurnTuning: GesturePageTurnTuning;
  readonly spread: boolean;
  readonly onComplete: (turnId: string) => void;
  readonly onFrame: (
    turnId: string,
    controller: NaturalPageTurnController,
    direction: 1 | -1,
    settlingIncomingPage?: boolean,
  ) => void;
}

/**
 * Web keeps one controller per visible paper and broadcasts each solved frame
 * to both face passes. The geometry and lookup are therefore computed once,
 * even though concurrent spread pages require interleaved back/front drawing.
 */
function AutomaticWebPageTurnDriver({
  turn,
  automaticPageTurnTuning,
  playbackSpeed,
  gesturePageTurnTuning,
  spread,
  onComplete,
  onFrame,
}: AutomaticWebPageTurnDriverProps) {
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  useEffect(() => {
    const gestureRelease =
      turn.motion === "gesture" ? turn.gestureRelease : undefined;
    const controller = new NaturalPageTurnController(
      gestureRelease
        ? gestureTuningForCore(gesturePageTurnTuning)
        : automaticTuningForCore(automaticPageTurnTuning),
    );
    const settlingIncomingPage = !spread && turn.direction === -1;
    const publish = () =>
      onFrame(turn.id, controller, turn.direction, settlingIncomingPage);
    publish();

    let previousFrameTime = performanceNow();
    let animationFrame = 0;
    let started = false;
    const tick = (now: number) => {
      if (!started) {
        if (Date.now() < turn.startAtMs) {
          previousFrameTime = now;
          animationFrame = requestAnimationFrame(tick);
          return;
        }
        started = true;
        if (gestureRelease) {
          controller.playReleasedGesture(gestureRelease, settlingIncomingPage);
        } else if (settlingIncomingPage) {
          controller.playSettlingPage();
        } else {
          controller.play();
        }
        previousFrameTime = now;
      }
      let remainingTime = Math.min(
        0.25,
        Math.max(0, (now - previousFrameTime) / 1000),
      );
      previousFrameTime = now;
      while (remainingTime > 0) {
        const step = Math.min(0.05, remainingTime);
        controller.advance(
          step * (gestureRelease ? 1 : playbackSpeedRef.current),
        );
        remainingTime -= step;
      }
      publish();
      if (controller.getPhase() === "completed") {
        onComplete(turn.id);
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [
    automaticPageTurnTuning,
    gesturePageTurnTuning,
    onComplete,
    onFrame,
    spread,
    turn.direction,
    turn.gestureRelease,
    turn.id,
    turn.motion,
    turn.startAtMs,
  ]);

  return null;
}

function initialWebPageTurnProfile(
  turn: ScheduledPageTurn,
  spread: boolean,
  automaticPageTurnTuning: AutomaticPageTurnTuning,
  gesturePageTurnTuning: GesturePageTurnTuning,
): number[] {
  if (turn.motion === "gesture" && turn.gestureRelease) {
    const controller = new NaturalPageTurnController(
      gestureTuningForCore(gesturePageTurnTuning),
    );
    controller.playReleasedGesture(
      turn.gestureRelease,
      !spread && turn.direction === -1,
    );
    return packPageTurnProfile(controller.getPoints(), turn.direction);
  }
  return initialPageTurnProfile(
    turn,
    spread ? "spread" : "single",
    automaticPageTurnTuning,
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
  theme = DEFAULT_READER_THEME,
  topInset = 0,
  bottomInset = 0,
  toolbarVisible = false,
  initialPosition,
  loadResource,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  onCenterPress,
  onProgress,
  onSelectionChange,
  onSelectionMenuDismiss,
  onSelectionMenuRequest,
  onTurningChange,
}: LiveReaderProps) {
  // Decoded resources belong to the open book, not to one pagination
  // generation. Retain them while geometry-dependent caches are replaced.
  const imageCache = useMemo(
    () =>
      new DecodedImageCache(
        Platform.OS === "web" ? 64 * 1024 * 1024 : 32 * 1024 * 1024,
      ),
    [],
  );
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
    resolvedAppearance.horizontalMargin,
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
  const normalizedGesturePageTurnTuning = useMemo(
    () => normalizeGesturePageTurnTuning(gesturePageTurnTuning),
    [gesturePageTurnTuning],
  );

  return (
    <LazyReaderEngine
      book={book}
      fontProvider={fontProvider}
      width={width}
      height={height}
      appearance={resolvedAppearance}
      layout={layout}
      pageTurnAnimation={pageTurnAnimation}
      theme={theme}
      topInset={topInset}
      bottomInset={bottomInset}
      imageCache={imageCache}
      readerGeneration={readerGeneration}
      toolbarVisible={toolbarVisible}
      initialPosition={anchorRef.current}
      loadResource={loadResource}
      automaticPageTurnTuning={normalizedAutomaticPageTurnTuning}
      gesturePageTurnTuning={normalizedGesturePageTurnTuning}
      onCenterPress={onCenterPress}
      onProgress={handleProgress}
      onSelectionChange={onSelectionChange}
      onSelectionMenuDismiss={onSelectionMenuDismiss}
      onSelectionMenuRequest={onSelectionMenuRequest}
      onTurningChange={onTurningChange}
    />
  );
}

function eventTimeSeconds(event: GestureResponderEvent): number {
  return event.timeStamp / 1000;
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

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function materialXForTouch(
  localX: number,
  direction: 1 | -1,
  layout: ReaderLayoutMode,
  physicalPageWidth: number,
): number {
  if (layout === "spread") {
    const spineX = physicalPageWidth;
    return direction === 1
      ? clampUnit((localX - spineX) / physicalPageWidth)
      : clampUnit((spineX - localX) / physicalPageWidth);
  }
  return direction === 1
    ? clampUnit(localX / physicalPageWidth)
    : clampUnit(1 - localX / physicalPageWidth);
}

function updatePendingGestureKinematics(
  pending: PendingPageGesture,
  dx: number,
  time: number,
  physicalPageWidth: number,
): void {
  const deltaTime = Math.max(0.001, time - pending.lastTime);
  const direction = dx < 0 ? 1 : -1;
  const deltaX = dx - pending.lastDx;
  const throwVelocity = Math.max(
    0,
    (direction === 1 ? -deltaX : deltaX) /
      deltaTime /
      Math.max(1, physicalPageWidth),
  );
  const instantaneousAcceleration = Math.min(
    20,
    Math.max(-20, (throwVelocity - pending.throwVelocity) / deltaTime),
  );
  const accelerationBlend = 1 - Math.exp(-deltaTime / 0.06);
  pending.throwAcceleration +=
    (instantaneousAcceleration - pending.throwAcceleration) * accelerationBlend;
  pending.throwVelocity = throwVelocity;
  pending.lastDx = dx;
  pending.lastTime = time;
}

function initialPageTurnProfile(
  turn: ScheduledPageTurn,
  layout: ReaderLayoutMode,
  tuning: AutomaticPageTurnTuning,
): number[] {
  return layout === "single" && turn.direction === -1
    ? incomingPageRaisedProfile(tuning)
    : pageTurnProfileAtRest(turn.direction, tuning);
}

function pageTurnProfileAtRest(
  direction: 1 | -1,
  tuning: AutomaticPageTurnTuning,
): number[] {
  const controller = new NaturalPageTurnController(
    automaticTuningForCore(tuning),
  );
  return packPageTurnProfile(controller.getPoints(), direction);
}

function incomingPageRaisedProfile(tuning: AutomaticPageTurnTuning): number[] {
  const controller = new NaturalPageTurnController(
    automaticTuningForCore(tuning),
  );
  controller.playSettlingPage();
  return packPageTurnProfile(controller.getPoints(), -1);
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    flex: 1,
    overflow: "hidden",
  },
  centerTapArea: {
    bottom: 0,
    left: "24%",
    position: "absolute",
    right: "24%",
    top: 0,
  },
  disabledEdge: {
    pointerEvents: "none",
  },
  edge: {
    bottom: 0,
    position: "absolute",
    top: 0,
    width: "24%",
  },
  edgePressable: {
    bottom: 0,
    left: 0,
    ...(Platform.OS === "web"
      ? { outlineColor: "transparent", outlineWidth: 0 }
      : {}),
    position: "absolute",
    right: 0,
    top: 0,
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
  leftEdge: {
    left: 0,
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
    ...(Platform.OS === "web"
      ? { boxShadow: "0 3px 12px rgba(61, 48, 38, 0.14)" }
      : {
          elevation: 3,
          shadowColor: "#3d3026",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.14,
          shadowRadius: 6,
        }),
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
  rightEdge: {
    right: 0,
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
