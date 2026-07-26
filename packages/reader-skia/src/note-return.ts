import type { BookPosition, NoteKind } from "@persimmon/book-core";

export type NoteReturnPresentation = "expanded" | "compact";

export interface NoteReturnAnchor {
  readonly position: BookPosition;
  readonly label: string;
  readonly noteKind?: NoteKind;
  readonly presentation: NoteReturnPresentation;
}

export type NoteReturnAction =
  | {
      readonly type: "note-opened";
      readonly position: BookPosition;
      readonly label: string;
      readonly noteKind?: NoteKind;
    }
  | { readonly type: "page-turned" }
  | { readonly type: "cleared" };

export function reduceNoteReturnAnchor(
  current: NoteReturnAnchor | undefined,
  action: NoteReturnAction,
): NoteReturnAnchor | undefined {
  switch (action.type) {
    case "note-opened":
      return {
        position: action.position,
        label: action.label,
        ...(action.noteKind ? { noteKind: action.noteKind } : {}),
        presentation: "expanded",
      };
    case "page-turned":
      return current?.presentation === "expanded"
        ? { ...current, presentation: "compact" }
        : current;
    case "cleared":
      return undefined;
  }
}
