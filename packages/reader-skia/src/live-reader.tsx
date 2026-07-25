import type { BookIR, BookLocator, BookPosition } from "@persimmon/book-core";
import { paginateBook, type PaginationResult } from "@persimmon/layout";
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
import { GestureDetector } from "react-native-gesture-handler";
import {
  PanResponder,
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
  type CapturedPage,
} from "./page-capture";
import { pageCaptureEntryBudget } from "./page-capture-budget";
import {
  PageTurnMesh,
  preparePageTurnRenderer,
  type PageTurnMeshHandle,
} from "./page-turn-mesh";
import {
  packPageTurnProfile,
  summarizePageTurnShadow,
} from "./page-turn-shader";
import { pageTurnCameraBookXForLayout } from "./page-turn-perspective";
import { bookXForGestureTravel } from "./page-turn-gesture-direction";
import {
  PAGE_TURN_LANE_HARD_LIMIT,
  calculatePageTurnConcurrency,
} from "./page-turn-concurrency";
import { ReaderPageLayer } from "./reader-page-layer";
import {
  bookForSection,
  createReaderLayoutSpec,
  disposePaginationAfterPaint,
} from "./reader-pagination";
import { createSkiaParagraphBackend } from "./skia-paragraph-backend";
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
  type PageTurnScheduler,
  type PageTurnSchedulerState,
  type ScheduledPageTurn,
} from "./page-turn-scheduler";

export interface ReaderProgress {
  locator: BookLocator;
  sectionIndex: number;
  pageIndex: number;
  pageCount: number;
  publicationProgress: number;
}

export type ReaderLayoutMode = "single" | "spread";

export interface LiveReaderProps {
  book: BookIR;
  fontProvider: SkTypefaceFontProvider;
  width: number;
  height: number;
  fontSize?: number;
  layout?: ReaderLayoutMode;
  initialPosition?: BookPosition;
  loadResource?: ResourceLoader;
  automaticPageTurnTuning?: AutomaticPageTurnTuning;
  gesturePageTurnTuning?: GesturePageTurnTuning;
  onCenterPress?: () => void;
  onProgress?: (progress: ReaderProgress) => void;
  onTurningChange?: (turning: boolean) => void;
}

interface TurnTexture {
  readonly frontImage: CapturedPage["image"] | null;
  readonly backImage: CapturedPage["image"] | null;
}

interface TurnCaptureAddresses {
  readonly front?: PageAddress;
  readonly back?: PageAddress;
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

interface LazyReaderEngineProps extends LiveReaderProps {
  readonly fontSize: number;
}

function LazyReaderEngine({
  book,
  fontProvider,
  width,
  height,
  fontSize,
  layout = "single",
  initialPosition,
  loadResource,
  automaticPageTurnTuning = DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  gesturePageTurnTuning = DEFAULT_GESTURE_PAGE_TURN_TUNING,
  onCenterPress,
  onProgress,
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
  const captureByteBudget = pageCaptureEntryBudget(
    (1 + turnConcurrency.maximumConcurrentTurns * 2) * pagesPerView,
  );
  const backend = useMemo(
    () => createSkiaParagraphBackend(fontProvider),
    [fontProvider],
  );
  const spec = useMemo(
    () => createReaderLayoutSpec(physicalPageWidth, height, fontSize),
    [fontSize, height, physicalPageWidth],
  );
  const paginationCache = useMemo(
    () => new Map<number, PaginationResult<SkParagraph>>(),
    [],
  );
  const imageCache = useMemo(
    () =>
      new DecodedImageCache(
        Platform.OS === "web" ? 64 * 1024 * 1024 : 32 * 1024 * 1024,
      ),
    [],
  );
  const pageCaptureCache = useRef(new Map<string, CapturedPage>());
  const [pageCaptureVersion, setPageCaptureVersion] = useState(0);
  const [, setImageVersion] = useState(0);
  const ensurePagination = useCallback(
    (sectionIndex: number): PaginationResult<SkParagraph> => {
      const cached = paginationCache.get(sectionIndex);
      if (cached) {
        return cached;
      }
      const pagination = paginateBook(
        bookForSection(book, sectionIndex),
        spec,
        backend,
      );
      paginationCache.set(sectionIndex, pagination);
      return pagination;
    },
    [backend, book, paginationCache, spec],
  );
  const pageCountForSection = useCallback(
    (sectionIndex: number) => ensurePagination(sectionIndex).pages.length,
    [ensurePagination],
  );
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
      minimumTurnIntervalMs: PAGE_TURN_START_INTERVAL_MS,
    }),
    [
      adjacent,
      createTurnId,
      turnConcurrency.maximumConcurrentTapTurns,
      turnConcurrency.maximumConcurrentTurns,
    ],
  );
  const [readerState, setReaderState] = useState(() =>
    createPageTurnSchedulerState(initialAddress),
  );
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

  useEffect(() => {
    if (Platform.OS === "web") {
      preparePageTurnRenderer(width, layout === "spread");
    }
  }, [layout, width]);

  useEffect(
    () => () => {
      for (const capture of pageCaptureCache.current.values()) {
        capture.dispose();
      }
      pageCaptureCache.current.clear();
      for (const pagination of paginationCache.values()) {
        disposePaginationAfterPaint(pagination);
      }
      paginationCache.clear();
      imageCache.dispose();
    },
    [imageCache, paginationCache],
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
    onTurningChange?.(hasRunningPageTurns(readerState));
  }, [onTurningChange, readerState]);
  useEffect(
    () => () => {
      onTurningChange?.(false);
    },
    [onTurningChange],
  );
  const runningTurnRef = useRef<RunningPageTurn | undefined>(undefined);
  const pendingGestureRef = useRef<PendingPageGesture | undefined>(undefined);
  const queuedGestureMoveRef = useRef<QueuedPageGestureMove | undefined>(
    undefined,
  );
  const gestureMoveFrameRef = useRef(0);
  const pageTurnMeshRef = useRef<PageTurnMeshHandle>(null);
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
      handedOffTurnIdsRef.current.delete(turnId);
      mutateReaderState((current) =>
        markScheduledPageTurnLaneReady(current, turnId),
      );
    },
    [mutateReaderState],
  );
  const publishTurnFrame = useCallback(
    (
      controller: NaturalPageTurnController,
      turnDirection: 1 | -1,
      _settlingIncomingPage = false,
    ) => {
      const xScale = turnDirection === -1 ? -1 : 1;
      const packed = packPageTurnProfile(controller.getPoints(), xScale);
      const summary = summarizePageTurnShadow(
        controller.getPoints(),
        controller.getMetrics(),
        xScale,
        pageTurnCameraBookXForLayout(layout === "spread"),
      );
      pageTurnMeshRef.current?.updateFrame(packed, [
        summary.center,
        summary.width,
        summary.strength,
        summary.direction,
      ]);
    },
    [layout],
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
      mutateReaderState((current) =>
        requestScheduledPageTurn(current, requestedDirection, turnScheduler),
      );
    },
    [mutateReaderState, turnScheduler],
  );
  const requestGestureTurn = useCallback(
    (input: PageGestureReleaseInput) => {
      const coreTuning = gestureTuningForCore(gesturePageTurnTuning);
      if (pageGestureModeForStart(input.startBookX) !== "full") {
        return;
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
        return;
      }
      const release = {
        pressedEdgeX: Math.max(MIN_PRESSED_EDGE_X, fingerX),
        heldRollTilt: gestureLiftRotationForFingerX(fingerX),
        speedScale: gestureTurnSpeedScale(input.throwVelocity, coreTuning),
        turnProgress: postHingeTurnProgressForFingerX(
          fingerX,
          input.startBookX,
        ),
        settlingProgress: input.turnProgress,
      };
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
    [gesturePageTurnTuning, mutateReaderState, stopRunningTurn, turnScheduler],
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
        currentReaderState.turns.filter((turn) => !turn.completed).length >=
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
      publishTurnFrame(controller, requestedDirection, settlingIncomingPage);
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
  const settledPagination = ensurePagination(readerState.settled.sectionIndex);
  const pageCaptureKey = useCallback(
    (address: PageAddress) =>
      `${captureByteBudget}:${address.sectionIndex}:${address.pageIndex}`,
    [captureByteBudget],
  );
  const ensurePageCapture = useCallback(
    (address: PageAddress): CapturedPage | null => {
      const key = pageCaptureKey(address);
      const cached = pageCaptureCache.current.get(key);
      if (cached) {
        return cached;
      }
      const pagination = ensurePagination(address.sectionIndex);
      const page = pagination.pages[address.pageIndex];
      if (!page) {
        return null;
      }
      const capture = capturePage(
        page,
        pagination,
        imageCache,
        physicalPageWidth,
        height,
        captureByteBudget,
      );
      if (capture) {
        pageCaptureCache.current.set(key, capture);
      }
      return capture;
    },
    [
      captureByteBudget,
      ensurePagination,
      height,
      imageCache,
      pageCaptureKey,
      physicalPageWidth,
    ],
  );

  const captureAddressesForTurn = useCallback(
    (turn: ScheduledPageTurn): TurnCaptureAddresses => {
      const current = addressesForView(turn.from);
      const target = addressesForView(turn.to);
      return {
        front:
          layout === "spread"
            ? turn.direction === 1
              ? current[1]
              : current[0]
            : turn.direction === 1
              ? current[0]
              : target[0],
        back:
          layout === "spread"
            ? turn.direction === 1
              ? target[0]
              : target[1]
            : undefined,
      };
    },
    [addressesForView, layout],
  );

  const captureAddresses = useMemo(() => {
    const viewStarts: PageAddress[] = [readerState.settled];
    let backward = readerState.settled;
    let forward = readerState.settled;
    for (
      let depth = 0;
      depth < turnConcurrency.maximumConcurrentTurns;
      depth += 1
    ) {
      backward = adjacent(backward, -1);
      forward = adjacent(forward, 1);
      viewStarts.push(backward, forward);
    }
    for (const turn of activeTurns) {
      viewStarts.push(turn.from, turn.to);
    }
    const unique = new Map<string, PageAddress>();
    for (const address of viewStarts.flatMap(addressesForView)) {
      unique.set(pageCaptureKey(address), address);
    }
    return [...unique.values()];
  }, [
    activeTurns,
    adjacent,
    addressesForView,
    pageCaptureKey,
    readerState.settled,
    turnConcurrency.maximumConcurrentTurns,
  ]);

  // Keep enough already-rasterized paper for the currently permitted overlap.
  // Captures are created outside the animation frame path and retained while a
  // sheet references them, so rapid successive taps do no texture work on the
  // React or UI runtime.
  useEffect(() => {
    const keepKeys = new Set(captureAddresses.map(pageCaptureKey));
    let addedCapture = false;
    for (const address of captureAddresses) {
      const key = pageCaptureKey(address);
      if (!pageCaptureCache.current.has(key) && ensurePageCapture(address)) {
        addedCapture = true;
      }
    }
    for (const [key, capture] of pageCaptureCache.current) {
      if (!keepKeys.has(key)) {
        pageCaptureCache.current.delete(key);
        disposeCapturedPageAfterPaint(capture);
      }
    }
    if (addedCapture) {
      setPageCaptureVersion((version) => version + 1);
    }
  }, [captureAddresses, ensurePageCapture, pageCaptureKey]);

  const turnTextures = useMemo(() => {
    void pageCaptureVersion;
    const textures = new Map<string, TurnTexture>();
    for (const turn of activeTurns) {
      const addresses = captureAddressesForTurn(turn);
      const frontCapture = addresses.front
        ? pageCaptureCache.current.get(pageCaptureKey(addresses.front))
        : null;
      const backCapture = addresses.back
        ? pageCaptureCache.current.get(pageCaptureKey(addresses.back))
        : null;
      textures.set(turn.id, {
        frontImage: frontCapture?.image ?? null,
        backImage: backCapture?.image ?? null,
      });
    }
    return textures;
  }, [
    activeTurns,
    captureAddressesForTurn,
    pageCaptureKey,
    pageCaptureVersion,
  ]);

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
  const renderableTurns = useMemo(() => {
    const prefix: ScheduledPageTurn[] = [];
    for (const turn of activeTurns) {
      if (!turn.completed && !textureReadyForTurn(turn)) {
        break;
      }
      prefix.push(turn);
    }
    return prefix;
  }, [activeTurns, textureReadyForTurn]);
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
    width,
    height,
    physicalPageWidth,
    spread: layout === "spread",
    canTurnBackward: !previousDisabled,
    canTurnForward: !nextDisabled,
    canStartInteractive:
      driverTurn === undefined &&
      activeTurns.filter((turn) => !turn.completed).length <
        turnConcurrency.maximumConcurrentTurns,
    tuning: gesturePageTurnTuning,
    command: nativeCommand,
    onCenterTap: onCenterPress ?? noop,
    onGestureBegin: beginNativeInteractiveTurn,
    onGestureRelease: requestGestureTurn,
    onTapTurn: requestTurn,
    onOutcome: completeNativeTurn,
  });
  const nativePoolCommands = useMemo(() => {
    const commands: (NativeProgrammaticPageTurnCommand | undefined)[] =
      new Array(PAGE_TURN_LANE_HARD_LIMIT).fill(undefined);
    for (const turn of renderableTurns) {
      if (turn.completed || turn.interactive || !textureReadyForTurn(turn)) {
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
  }, [layout, renderableTurns, textureReadyForTurn]);
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
    const publicationProgress =
      (readerState.settled.sectionIndex +
        (readerState.settled.pageIndex + 1) / localPageCount) /
      book.sections.length;
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
    book.sections.length,
    ensurePagination,
    onProgress,
    pageCountForSection,
    readerState.turns.length,
    readerState.settled.pageIndex,
    readerState.settled.sectionIndex,
  ]);

  const localPageCount = settledPagination.pages.length;
  const publicationPercentage = Math.round(
    ((readerState.settled.sectionIndex +
      (readerState.settled.pageIndex + 1) / localPageCount) /
      book.sections.length) *
      100,
  );
  const settledLastAddress = settledAddresses.at(-1)!;
  const settledPageLabel =
    layout === "spread" &&
    settledLastAddress.sectionIndex === readerState.settled.sectionIndex &&
    settledLastAddress.pageIndex !== readerState.settled.pageIndex
      ? `${readerState.settled.pageIndex + 1}–${settledLastAddress.pageIndex + 1}`
      : `${readerState.settled.pageIndex + 1}`;
  const oldestRenderableTurn = renderableTurns[0];
  const newestRenderableTurn = renderableTurns.at(-1);
  const turnBackgroundSlots: readonly (PageAddress | undefined)[] = (() => {
    if (!oldestRenderableTurn || !newestRenderableTurn) {
      return settledAddresses;
    }
    const oldestFrom = addressesForView(oldestRenderableTurn.from);
    const newestTarget = addressesForView(newestRenderableTurn.to);
    if (layout === "single") {
      return [
        oldestRenderableTurn.direction === 1 ? newestTarget[0] : oldestFrom[0],
      ];
    }
    return oldestRenderableTurn.direction === 1
      ? [oldestFrom[0], newestTarget[1]]
      : [newestTarget[0], oldestFrom[1]];
  })();
  const visiblePaperTurns = renderableTurns.filter((turn) => !turn.completed);
  const stackedPaperTurns =
    oldestRenderableTurn?.direction === 1
      ? [...visiblePaperTurns].reverse()
      : visiblePaperTurns;
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
        />
      );
    });

  const readerContent = (
    <View
      {...(Platform.OS === "web" ? pagePanResponder.panHandlers : {})}
      ref={readerViewRef}
      onLayout={measureReaderOrigin}
      style={styles.container}
    >
      <Canvas style={styles.canvas}>
        <Fill color="#fbf7f0" />
        {layout === "spread" ? (
          <Rect
            x={physicalPageWidth - 0.5}
            y={0}
            width={1}
            height={height}
            color="#ded5ca"
          />
        ) : null}
        {!transitionReady ? (
          renderPageSlots(settledAddresses, "settled")
        ) : (
          <>
            {renderPageSlots(turnBackgroundSlots, "background")}
            {stackedPaperTurns.map((turn) => {
              const texture = turnTextures.get(turn.id);
              if (!texture?.frontImage) {
                return null;
              }
              if (Platform.OS === "web" && !turn.interactive) {
                return (
                  <AutomaticWebPageTurnMesh
                    key={turn.id}
                    automaticPageTurnTuning={automaticPageTurnTuning}
                    backImage={texture.backImage ?? undefined}
                    height={height}
                    onComplete={settleTurn}
                    paperImage={texture.frontImage}
                    spread={layout === "spread"}
                    gesturePageTurnTuning={gesturePageTurnTuning}
                    turn={turn}
                    width={width}
                  />
                );
              }
              return (
                <PageTurnMesh
                  key={turn.id}
                  ref={
                    turn.interactive || turn.handoffPending
                      ? pageTurnMeshRef
                      : undefined
                  }
                  backImage={texture.backImage ?? undefined}
                  paperImage={texture.frontImage}
                  initialProfile={
                    Platform.OS === "web"
                      ? initialPageTurnProfile(
                          turn,
                          layout,
                          DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
                        )
                      : undefined
                  }
                  nativeFrame={
                    Platform.OS === "web"
                      ? undefined
                      : turn.interactive || turn.handoffPending
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

      <View
        accessibilityLabel={`本章第 ${settledPageLabel} 页，共 ${localPageCount} 页，全书 ${publicationPercentage}%`}
        accessibilityLiveRegion="polite"
        style={styles.pageBadge}
      >
        <Text style={styles.pageText}>
          {settledPageLabel} / {localPageCount} · {publicationPercentage}%
        </Text>
      </View>
    </View>
  );
  return Platform.OS === "web" ? (
    readerContent
  ) : (
    <GestureDetector gesture={nativePageTurn.gesture}>
      {readerContent}
    </GestureDetector>
  );
}

interface AutomaticWebPageTurnMeshProps {
  readonly turn: ScheduledPageTurn;
  readonly automaticPageTurnTuning: AutomaticPageTurnTuning;
  readonly gesturePageTurnTuning: GesturePageTurnTuning;
  readonly paperImage: SkImage;
  readonly backImage?: SkImage;
  readonly width: number;
  readonly height: number;
  readonly spread: boolean;
  readonly onComplete: (turnId: string) => void;
}

/**
 * Web keeps one controller per visible paper so repeated edge clicks can
 * overlap just like the hard-capped native lane pool. This reference renderer is
 * intentionally isolated from the native gesture/physics hot path.
 */
function AutomaticWebPageTurnMesh({
  turn,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  paperImage,
  backImage,
  width,
  height,
  spread,
  onComplete,
}: AutomaticWebPageTurnMeshProps) {
  const meshRef = useRef<PageTurnMeshHandle>(null);
  const initialProfile = useMemo(() => {
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
  }, [automaticPageTurnTuning, gesturePageTurnTuning, spread, turn]);

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
    const publish = () => {
      const xScale = turn.direction === -1 ? -1 : 1;
      const packed = packPageTurnProfile(controller.getPoints(), xScale);
      const summary = summarizePageTurnShadow(
        controller.getPoints(),
        controller.getMetrics(),
        xScale,
        pageTurnCameraBookXForLayout(spread),
      );
      meshRef.current?.updateFrame(packed, [
        summary.center,
        summary.width,
        summary.strength,
        summary.direction,
      ]);
    };
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
    spread,
    turn.direction,
    turn.gestureRelease,
    turn.id,
    turn.motion,
  ]);

  return (
    <PageTurnMesh
      ref={meshRef}
      backImage={backImage}
      height={height}
      initialProfile={initialProfile}
      paperImage={paperImage}
      spread={spread}
      width={width}
    />
  );
}

export function LiveReader({
  book,
  fontProvider,
  width,
  height,
  fontSize = 20,
  layout = "single",
  initialPosition,
  loadResource,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  onCenterPress,
  onProgress,
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
  const layoutKey = JSON.stringify([
    book.revisionId,
    width,
    height,
    fontSize,
    layout,
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
      fontSize={fontSize}
      layout={layout}
      initialPosition={anchorRef.current}
      loadResource={loadResource}
      automaticPageTurnTuning={normalizedAutomaticPageTurnTuning}
      gesturePageTurnTuning={normalizedGesturePageTurnTuning}
      onCenterPress={onCenterPress}
      onProgress={handleProgress}
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

function noop(): void {}

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
    backgroundColor: "#fbf7f0",
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
  leftEdge: {
    left: 0,
  },
  pageBadge: {
    alignItems: "center",
    bottom: 14,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
  },
  pageText: {
    color: "#8b8177",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  rightEdge: {
    right: 0,
  },
});
