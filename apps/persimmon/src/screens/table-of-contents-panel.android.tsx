import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useRef } from "react";
import { processColor } from "react-native";
import { useTranslation } from "react-i18next";

import {
  hideTableOfContents,
  showTableOfContents,
  type TableOfContentsPresentation,
} from "../../modules/persimmon-selection-menu";

export interface NavigationRow {
  readonly item: BookNavigationItem;
  readonly depth: number;
}

export function flattenNavigation(
  items: readonly BookNavigationItem[],
  depth = 0,
): NavigationRow[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flattenNavigation(item.children ?? [], depth + 1),
  ]);
}

export interface TableOfContentsPanelProps {
  readonly currentItemId?: string;
  readonly bottomInset: number;
  readonly rows: readonly NavigationRow[];
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (position: BookPosition) => void;
}

function resolvedColor(color: string, fallback: number): number {
  const nativeColor = processColor(color);
  return typeof nativeColor === "number" ? nativeColor : fallback;
}

export function TableOfContentsPanel({
  currentItemId,
  bottomInset,
  rows,
  theme,
  visible,
  onClose,
  onSelect,
}: TableOfContentsPanelProps) {
  const { t } = useTranslation();
  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);
  const presentationRef = useRef<
    | {
        readonly native: TableOfContentsPresentation;
        readonly rows: readonly NavigationRow[];
      }
    | undefined
  >(undefined);

  onCloseRef.current = onClose;
  onSelectRef.current = onSelect;
  const background = resolvedColor(theme.panel, -1);
  const text = resolvedColor(theme.controlText, -16777216);
  presentationRef.current = {
    native: {
      title: t("reader.toc.title"),
      closeLabel: t("reader.toc.closeAccessibility"),
      labels: rows.map(({ item }) => item.label),
      depths: rows.map(({ depth }) => depth),
      selectedIndex: rows.findIndex(({ item }) => item.id === currentItemId),
      colors: [
        background,
        resolvedColor(theme.panelRaised, background),
        text,
        resolvedColor(theme.secondaryText, text),
        resolvedColor(theme.accentStrong, text),
        resolvedColor(`${theme.accent}14`, background),
      ],
      bottomInset,
    },
    rows,
  };

  useEffect(() => {
    if (!visible) {
      void hideTableOfContents();
      return;
    }

    let active = true;
    const presentation = presentationRef.current;
    if (!presentation) {
      return;
    }
    void showTableOfContents(presentation.native)
      .then((selectedIndex) => {
        if (!active) {
          return;
        }
        const selectedRow =
          selectedIndex === undefined
            ? undefined
            : presentation.rows[selectedIndex];
        if (selectedRow) {
          onSelectRef.current(selectedRow.item.target);
        } else {
          onCloseRef.current();
        }
      })
      .catch(() => {
        if (active) {
          onCloseRef.current();
        }
      });

    return () => {
      active = false;
      void hideTableOfContents();
    };
  }, [visible]);

  return null;
}
