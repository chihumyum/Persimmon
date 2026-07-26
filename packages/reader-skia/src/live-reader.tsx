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
  capturePage,
  disposeCapturedPageAfterPaint,
  pageImagesSettledForCapture,
  type CapturedPage,
} from "./page-capture";
import {
  CapturedPageCache,
  type PageCaptureIdentity,
  type TurnCaptureLease,
} from "./page-capture-cache";
import {
  PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
  PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET,
} from "./page-capture-budget";
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
  calculatePageTurnConcurrency,
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
  DEFAULT_LIVE_READER_APPEARANCE,
  type ReaderAppearance,
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
} from "./skia-page-decoration";
import {
  useNativePageTurnDriver,
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
  PAGE_TURN_START_INTERVAL_MS,
  beginScheduledInteractivePageTurn,
  createPageTurnSchedulerState,
  handoffScheduledInteractivePageTurn,
  hasRunningPageTurns,
  markScheduledPageTurnLaneReady,
  requestScheduledPageTurn,
  requestScheduledGesturePageTurn,
  resolveScheduledPageTurn,
  scheduledPageAddress,
  turnPageImmediately,
  type PageTurnScheduler,
  type PageTurnSchedulerState,
  type ScheduledPageTurn,
} from "./page-turn-scheduler";
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
    "appearance" | "bottomInset" | "fontSize" | "topInset"
  > {
  readonly appearance: ReaderAppearance;
  readonly topInset: number;
  readonly bottomInset: number;
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
  const pagesPerView = layout === "spread" ? 2 : 1;
  const physicalPageWidth = layout === "spread" ? width * 0.5 : width;
  const progressPresentation: PageProgressPresentation = toolbarVisible
    ? "toolbar"
    : "reading";
  const visibleProgressDisplay = progressDisplayForToolbar(
    appearance.progressDisplay,
    toolbarVisible,
  );
  const backend = useMemo(
    () => createSkiaParagraphBackend(fontProvider, theme),
    [fontProvider, theme],
  );
  const typographyAppearance = useMemo<ReaderAppearance>(
    () => ({
      fontFamily: appearance.fontFamily,
      fontSize: appearance.fontSize,
      lineHeight: appearance.lineHeight,
      paragraphSpacing: appearance.paragraphSpacing,
      horizontalMargin: appearance.horizontalMargin,
      progressDisplay: "hidden",
    }),
    [
      appearance.fontFamily,
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
    [],
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
  const imageCache = useMemo(
    () =>
      new DecodedImageCache(
        Platform.OS === "web" ? 64 * 1024 * 1024 : 32 * 1024 * 1024,
      ),
    [],
  );
  const pageCaptureCache = useMemo(
    () =>
      new CapturedPageCache<CapturedPage, PageAddress>({
        targetByteBudget: PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET,
        hardByteBudget: PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
        disposeValue: disposeCapturedPageAfterPaint,
      }),
    [],
  );
  const turnCaptureLeasesRef = useRef(
    new Map<string, TurnCaptureLease<CapturedPage>>(),
  );
  const captureStartTimesRef = useRef(new Map<string, number>());
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
  const [readerState, setReaderState] = useState(() =>
    createPageTurnSchedulerState(initialAddress),
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
  const [textSelection, setTextSelection] = useState<TextSelection | undefined>(
    undefined,
  );
  const selectingText = textSelection !== undefined;
  const textSelectionRef = useRef(textSelection);
  const commitTextSelection = useCallback((selection: TextSelection) => {
    textSelectionRef.current = selection;
    setTextSelection(selection);
  }, []);
  const clearTextSelection = useCallback(() => {
    textSelectionRef.current = undefined;
    setTextSelection(undefined);
    onSelectionMenuDismiss?.();
  }, [onSelectionMenuDismiss]);
  // Native Gesture Handler can deliver begin and release to the RN thread
  // inside one React render interval. Keep scheduling ownership synchronous
  // so a short flick can release the exact turn it just claimed instead of
  // reading the previous render's driverTurn.
  const readerStateRef = useRef(readerState);
  const mutateReaderState = useCallback(
    (
      update: (current: PageTurnSchedulerState) => PageTurnSchedulerState,
    ): PageTurnSchedulerState => {
      const current = readerStateRef.current;
      const next = update(current);
      if (next !== current) {
        readerStateRef.current = next;
        setReaderState(next);
      }
      return next;
    },
    [],
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
      if (readerStateRef.current.turns.length > 0) {
        return false;
      }
      const target = pageAddressForPosition(position);
      if (!target) {
        return false;
      }
      mutateReaderState(() => createPageTurnSchedulerState(target));
      return true;
    },
    [mutateReaderState, pageAddressForPosition],
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
      preparePageTurnRenderer(width, layout === "spread");
    }
  }, [layout, pageTurnAnimation, width]);

  useEffect(
    () => () => {
      turnCaptureLeasesRef.current.clear();
      captureStartTimesRef.current.clear();
      pageCaptureCache.clear();
      for (const pagination of paginationCache.values()) {
        disposePaginationAfterPaint(pagination);
      }
      paginationCache.clear();
      imageCache.dispose();
    },
    [imageCache, pageCaptureCache, paginationCache],
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
      mutateReaderState((current) =>
        resolveScheduledPageTurn(current, turnId, true),
      );
      setNoteReturnAnchor((current) =>
        reduceNoteReturnAnchor(current, { type: "page-turned" }),
      );
    },
    [mutateReaderState],
  );

  const activeTurns = readerState.turns;
  const driverTurn = activeTurns.find(
    (turn) => turn.interactive || turn.handoffPending,
  );
  const driverTurnRef = useRef(driverTurn);
  driverTurnRef.current = driverTurn;
  const handedOffTurnIdsRef = useRef(new Set<string>());
  const nativeInteractiveTurnIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const retainedTurnIds = new Set(activeTurns.map((turn) => turn.id));
    for (const turnId of handedOffTurnIdsRef.current) {
      if (!retainedTurnIds.has(turnId)) {
        handedOffTurnIdsRef.current.delete(turnId);
      }
    }
  }, [activeTurns]);
  useEffect(() => {
    onTurningChange?.(hasRunningPageTurns(readerState));
  }, [onTurningChange, readerState]);
  useEffect(() => {
    onSelectionChange?.(selectingText);
  }, [onSelectionChange, selectingText]);
  useEffect(() => {
    if (activeTurns.length > 0 && textSelectionRef.current) {
      clearTextSelection();
    }
  }, [activeTurns.length, clearTextSelection]);
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
    [cancelInteractiveTurn, settleTurn],
  );
  const completeScheduledTurn = useCallback(
    (turnId: string, outcome: number) => {
      handedOffTurnIdsRef.current.delete(turnId);
      if (outcome > 0) {
        settleTurn(turnId);
      } else {
        cancelInteractiveTurn(turnId);
      }
    },
    [cancelInteractiveTurn, settleTurn],
  );
  const markScheduledTurnLaneStarted = useCallback(
    (turnId: string) => {
      mutateReaderState((current) =>
        markScheduledPageTurnLaneReady(current, turnId),
      );
    },
    [mutateReaderState],
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
    (requestedDirection: 1 | -1) => {
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
      mutateReaderState((current) =>
        requestScheduledPageTurn(current, requestedDirection, turnScheduler),
      );
    },
    [adjacent, mutateReaderState, pageTurnAnimation, turnScheduler],
  );
  const requestGestureTurn = useCallback(
    (input: PageGestureReleaseInput) => {
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
      requestTurn,
      stopRunningTurn,
      turnScheduler,
    ],
  );
  const beginNativeInteractiveTurn = useCallback(
    (requestedDirection: 1 | -1) => {
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
    },
    [mutateReaderState, turnScheduler],
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
    (address: PageAddress): PageCaptureIdentity<PageAddress> => {
      return {
        key: JSON.stringify([
          book.id,
          book.revisionId,
          typographyAppearance,
          theme.name,
          theme.colorScheme,
          layout,
          address.sectionIndex,
          address.pageIndex,
        ]),
        width: physicalPageWidth,
        height,
        metadata: address,
      };
    },
    [
      book.id,
      book.revisionId,
      height,
      layout,
      physicalPageWidth,
      theme.colorScheme,
      theme.name,
      typographyAppearance,
    ],
  );
  const createPageCapture = useCallback(
    (
      identity: PageCaptureIdentity<PageAddress>,
      scale: number,
    ): CapturedPage | null => {
      const address = identity.metadata;
      if (!address) {
        return null;
      }
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      if (!page) {
        return null;
      }
      return capturePage(
        page,
        pagination,
        imageCache,
        physicalPageWidth,
        height,
        scale,
        loadResource === undefined,
        undefined,
        "hidden",
        "reading",
        theme,
      );
    },
    [
      ensurePagination,
      height,
      imageCache,
      loadResource,
      physicalPageWidth,
      theme,
    ],
  );
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
    (turn: ScheduledPageTurn): PageTurnCaptureAddresses => {
      const current = addressesForView(turn.from);
      const target = addressesForView(turn.to);
      return pageTurnCaptureAddresses(layout, turn.direction, current, target);
    },
    [addressesForView, layout],
  );

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
    for (const turn of activeTurns) {
      if (!captureStartTimesRef.current.has(turn.id)) {
        captureStartTimesRef.current.set(turn.id, now);
      }
    }

    let failedTurnId: string | undefined;
    for (const turn of activeTurns) {
      if (turnCaptureLeasesRef.current.has(turn.id)) {
        continue;
      }
      const addresses = captureAddressesForTurn(turn);
      if (
        (addresses.front && !pageReadyForCapture(addresses.front)) ||
        (addresses.back && !pageReadyForCapture(addresses.back))
      ) {
        break;
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
        createPageCapture,
      );
      if (result.ok) {
        turnCaptureLeasesRef.current.set(turn.id, result.lease);
        leasesChanged = true;
      } else {
        failedTurnId = turn.id;
      }
      // The renderer consumes a strict prefix. Admit at most its first missing
      // lease per commit so a batched burst cannot rasterize many hidden pages
      // synchronously on Android.
      break;
    }
    if (leasesChanged) {
      setPageCaptureVersion((version) => version + 1);
    }
    if (failedTurnId) {
      mutateReaderState((current) =>
        resolveScheduledPageTurn(current, failedTurnId, false),
      );
    }
  }, [
    activeTurns,
    captureAddressesForTurn,
    createPageCapture,
    devicePixelRatio,
    imageVersion,
    mutateReaderState,
    pageCaptureCache,
    pageCaptureIdentity,
    pageCaptureVersion,
    pageReadyForCapture,
  ]);

  const passiveCapturePlan = useMemo(
    () =>
      buildPageCapturePlan({
        settled: readerState.settled,
        adjacent,
        addressesForView,
      }),
    [adjacent, addressesForView, readerState.settled],
  );

  // Passive capture work is shallow, lane-independent, and limited to one page
  // per paint opportunity. A live turn cancels the remaining work immediately
  // so Android never rasterizes a theoretical lane pool during an animation.
  useEffect(() => {
    const retentions = passiveCapturePlan.map(({ address, tier }) => ({
      identity: pageCaptureIdentity(address),
      tier,
    }));
    pageCaptureCache.reconcileUnpinnedTiers(retentions);
    if (pageTurnAnimation === "none" || activeTurns.length > 0) {
      return;
    }
    let cancelled = false;
    let frame = 0;
    let index = 0;
    const captureNext = () => {
      if (
        cancelled ||
        readerStateRef.current.turns.length > 0 ||
        index >= passiveCapturePlan.length
      ) {
        return;
      }
      const candidate = passiveCapturePlan[index++]!;
      if (!pageReadyForCapture(candidate.address)) {
        frame = requestAnimationFrame(captureNext);
        return;
      }
      // Current and adjacent pages are likely to enter the next turn, so build
      // them once at low-frequency tap quality while they are still unpinned.
      // The active path then leases this resident variant without recapturing.
      const quality =
        candidate.tier === "prefetch"
          ? selectPageCaptureQuality({
              tier: "active",
              devicePixelRatio,
              inputKind: "tap",
              maxPerspectiveScale: PAGE_TURN_MAX_PERSPECTIVE_SCALE,
            })
          : selectPageCaptureQuality({
              tier: candidate.tier,
              devicePixelRatio,
              maxPerspectiveScale: PAGE_TURN_MAX_PERSPECTIVE_SCALE,
            });
      const before = pageCaptureCache.getStats();
      pageCaptureCache.prefetch(
        {
          identity: pageCaptureIdentity(candidate.address),
          tier: candidate.tier,
          desiredScale: quality.desiredScale,
          minimumScale: quality.minimumScale,
        },
        createPageCapture,
      );
      const after = pageCaptureCache.getStats();
      if (
        after.residentBytes !== before.residentBytes ||
        after.entryCount !== before.entryCount
      ) {
        setPageCaptureVersion((version) => version + 1);
      }
      frame = requestAnimationFrame(captureNext);
    };
    frame = requestAnimationFrame(captureNext);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    activeTurns.length,
    createPageCapture,
    devicePixelRatio,
    imageVersion,
    pageCaptureCache,
    pageCaptureIdentity,
    pageReadyForCapture,
    pageTurnAnimation,
    passiveCapturePlan,
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
    if (textSelectionRef.current) {
      clearTextSelection();
      return;
    }
    onCenterPress?.();
  }, [clearTextSelection, onCenterPress]);
  const handleNativePageTap = useCallback(
    (direction: 1 | -1) => {
      if (textSelectionRef.current) {
        clearTextSelection();
        return;
      }
      requestTurn(direction);
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
  const nativePageTurn = useNativePageTurnDriver({
    gesturesEnabled: !selectingText,
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
      activeTurns.length < turnConcurrency.maximumConcurrentTurns,
    tuning: gesturePageTurnTuning,
    command: nativeCommand,
    onCenterTap: handleNativeCenterTap,
    onGestureBegin: beginNativeInteractiveTurn,
    onGestureRelease: requestGestureTurn,
    onTapTurn: handleNativePageTap,
    onOutcome: completeNativeTurn,
  });
  const selectionLongPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(Platform.OS !== "web" && !transitionReady)
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
    [selectWordAtPoint, showTextSelectionMenu, transitionReady],
  );
  const selectionTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(Platform.OS !== "web" && selectingText && !transitionReady)
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
    [handleTextSelectionTap, selectingText, transitionReady],
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
  const nativePoolCommands = useMemo(() => {
    const commands: (NativeProgrammaticPageTurnCommand | undefined)[] =
      new Array(PAGE_TURN_LANE_HARD_LIMIT).fill(undefined);
    for (const turn of texturePreparedTurns) {
      if (turn.interactive || !textureReadyForTurn(turn)) {
        continue;
      }
      commands[turn.lane] = {
        id: turn.id,
        direction: turn.direction,
        ready: true,
        settlingIncomingPage: layout === "single" && turn.direction === -1,
        motion: turn.motion,
        gestureRelease: turn.gestureRelease,
      };
    }
    return commands;
  }, [layout, texturePreparedTurns, textureReadyForTurn]);
  const nativePageTurnPool = useNativePageTurnPool({
    width,
    height,
    spread: layout === "spread",
    automaticTuning: automaticPageTurnTuning,
    gestureTuning: gesturePageTurnTuning,
    commands: nativePoolCommands,
    onStarted: markScheduledTurnLaneStarted,
    onOutcome: completeScheduledTurn,
  });
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
    const addresses = viewStarts.flatMap(addressesForView);
    const assetIds = new Set<string>();
    for (const address of addresses) {
      for (const item of pageAt(address)?.items ?? []) {
        if (item.kind === "image") {
          assetIds.add(item.assetId);
        }
      }
    }
    return assetIds;
  }, [activeTurns, adjacent, addressesForView, pageAt, readerState]);

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
  const viewportProgressDecoration = useMemo(
    () =>
      createSkiaPageDecoration({
        model: settledProgressDecoration,
        fontProvider,
        fontFamily: appearance.fontFamily,
        width,
        height,
        horizontalMargin: appearance.horizontalMargin,
        topInset,
        bottomInset,
        theme,
      }),
    [
      appearance.fontFamily,
      appearance.horizontalMargin,
      bottomInset,
      fontProvider,
      height,
      settledProgressDecoration,
      theme,
      topInset,
      width,
    ],
  );
  useEffect(
    () => () => disposeSkiaPageDecorationAfterPaint(viewportProgressDecoration),
    [viewportProgressDecoration],
  );
  const showProgressHeader = progressDisplayHasHeader(visibleProgressDisplay);
  const showProgressFooter = progressDisplayHasFooter(visibleProgressDisplay);
  const oldestRenderableTurn = renderableTurns[0];
  const newestRenderableTurn = renderableTurns.at(-1);
  const turnBackgroundSlots: readonly (PageAddress | undefined)[] = (() => {
    if (!oldestRenderableTurn || !newestRenderableTurn) {
      return settledAddresses;
    }
    return pageTurnBackgroundSlots(
      layout,
      oldestRenderableTurn.direction,
      addressesForView(oldestRenderableTurn.from),
      addressesForView(newestRenderableTurn.to),
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
    addresses: readonly (PageAddress | undefined)[],
    layer: string,
  ) =>
    addresses.map((address, slot) => {
      if (!address) {
        return null;
      }
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      if (!page) {
        return null;
      }
      return (
        <ReaderPageLayer
          key={`${layer}:${address.sectionIndex}:${address.pageIndex}:${slot}`}
          imageCache={imageCache}
          offsetX={slot * physicalPageWidth}
          page={page}
          pagination={pagination}
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
      <Canvas style={styles.canvas}>
        <Fill color={theme.paper} />
        {!transitionReady ? (
          <>
            {renderPageSlots(settledAddresses, "settled")}
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
          </>
        ) : (
          <>
            {renderPageSlots(turnBackgroundSlots, "background")}
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
        <SkiaPageDecorationLayer
          decoration={viewportProgressDecoration}
          display={visibleProgressDisplay}
          presentation={progressPresentation}
        />
      </Canvas>

      <View
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
    readerState.turns.length === 0 && !selectingText ? (
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
  gesturePageTurnTuning,
  spread,
  onComplete,
  onFrame,
}: AutomaticWebPageTurnDriverProps) {
  useEffect(() => {
    const gestureRelease =
      turn.motion === "gesture" ? turn.gestureRelease : undefined;
    const controller = new NaturalPageTurnController(
      gestureRelease
        ? gestureTuningForCore(gesturePageTurnTuning)
        : automaticTuningForCore(automaticPageTurnTuning),
    );
    const settlingIncomingPage = !spread && turn.direction === -1;
    if (gestureRelease) {
      controller.playReleasedGesture(gestureRelease, settlingIncomingPage);
    } else if (settlingIncomingPage) {
      controller.playSettlingPage();
    } else {
      controller.play();
    }
    const publish = () =>
      onFrame(turn.id, controller, turn.direction, settlingIncomingPage);
    publish();

    let previousFrameTime = performanceNow();
    let animationFrame = 0;
    const tick = (now: number) => {
      let remainingTime = Math.min(
        0.25,
        Math.max(0, (now - previousFrameTime) / 1000),
      );
      previousFrameTime = now;
      while (remainingTime > 0) {
        const step = Math.min(0.05, remainingTime);
        controller.advance(
          step * (gestureRelease ? 1 : automaticPageTurnTuning.playbackSpeed),
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
  const layoutKey = JSON.stringify([
    book.revisionId,
    width,
    height,
    resolvedAppearance.fontFamily,
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
      key={layoutKey}
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
