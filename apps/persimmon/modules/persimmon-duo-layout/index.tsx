import { requireNativeView, requireOptionalNativeModule } from "expo";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";

export interface DuoLayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DuoLayoutDivision extends DuoLayoutRect {
  readonly active: boolean;
}

export type DuoVerticalBarEdge = "leading" | "trailing";
export type DuoHingeStatus =
  | "closed"
  | "partiallyOpen"
  | "fullyOpen"
  | "unknown";

/**
 * Window layout signals that only iOS 27.1 native code can read. Every field
 * is empty on other platforms, older OS versions and devices without a
 * vertical bar, so callers can always fall back to safe-area insets.
 */
export interface DuoLayoutInfo {
  /** The system's preferred vertical bar edge; absent when none is used. */
  readonly verticalBarEdge?: DuoVerticalBarEdge;
  /** Active occlusions (camera, system status) in window points. */
  readonly occlusions: readonly DuoLayoutRect[];
  /**
   * The tallest occlusions seen at this window size. The status bar grows the
   * occlusion while it shows, so this still covers it while a screen hides
   * the status bar and a sheet is about to bring it back.
   */
  readonly peakOcclusions: readonly DuoLayoutRect[];
  /** Fold regions in window points; active while the hinge is bent. */
  readonly divisions: readonly DuoLayoutDivision[];
  readonly hingeStatus?: DuoHingeStatus;
}

export const EMPTY_DUO_LAYOUT: DuoLayoutInfo = {
  occlusions: [],
  peakOcclusions: [],
  divisions: [],
};

function occlusionBottom(occlusions: readonly DuoLayoutRect[]): number {
  return occlusions.reduce(
    (bottom, rect) => Math.max(bottom, rect.y + rect.height),
    0,
  );
}

interface NativeDuoLayoutViewProps extends ViewProps {
  readonly onLayoutInfoChange?: (
    event: NativeSyntheticEvent<Partial<DuoLayoutInfo>>,
  ) => void;
}

const NativeDuoLayoutView: ComponentType<NativeDuoLayoutViewProps> | null =
  Platform.OS === "ios" && requireOptionalNativeModule("PersimmonDuoLayout")
    ? requireNativeView<NativeDuoLayoutViewProps>("PersimmonDuoLayout")
    : null;

const DuoLayoutContext = createContext<DuoLayoutInfo>(EMPTY_DUO_LAYOUT);

export function DuoLayoutProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [layout, setLayout] = useState<DuoLayoutInfo>(EMPTY_DUO_LAYOUT);
  const { height, width } = useWindowDimensions();
  const windowKey = `${width}x${height}`;
  const peakRef = useRef<{
    readonly windowKey: string;
    readonly occlusions: readonly DuoLayoutRect[];
  }>({ windowKey, occlusions: [] });
  return (
    <DuoLayoutContext.Provider value={layout}>
      {NativeDuoLayoutView ? (
        <NativeDuoLayoutView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          onLayoutInfoChange={({ nativeEvent }) => {
            const occlusions = nativeEvent.occlusions ?? [];
            const peak = peakRef.current;
            if (
              peak.windowKey !== windowKey ||
              occlusionBottom(occlusions) >= occlusionBottom(peak.occlusions)
            ) {
              peakRef.current = { windowKey, occlusions };
            }
            setLayout({
              verticalBarEdge: nativeEvent.verticalBarEdge,
              occlusions,
              peakOcclusions: peakRef.current.occlusions,
              divisions: nativeEvent.divisions ?? [],
              hingeStatus: nativeEvent.hingeStatus,
            });
          }}
        />
      ) : null}
      {children}
    </DuoLayoutContext.Provider>
  );
}

export function useDuoLayout(): DuoLayoutInfo {
  return useContext(DuoLayoutContext);
}
