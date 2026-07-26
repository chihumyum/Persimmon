import { describe, expect, it } from "vitest";

import { reduceNoteReturnAnchor } from "./note-return";

const firstReference = {
  sectionId: "chapter-1",
  blockId: "paragraph-4",
  offset: 12,
};

describe("note return navigation", () => {
  it("opens an expanded return control for a note reference", () => {
    expect(
      reduceNoteReturnAnchor(undefined, {
        type: "note-opened",
        position: firstReference,
        label: "1",
        noteKind: "footnote",
      }),
    ).toEqual({
      position: firstReference,
      label: "1",
      noteKind: "footnote",
      presentation: "expanded",
    });
  });

  it("compacts the control after a successful page turn without losing its anchor", () => {
    const opened = reduceNoteReturnAnchor(undefined, {
      type: "note-opened",
      position: firstReference,
      label: "1",
      noteKind: "endnote",
    });

    expect(reduceNoteReturnAnchor(opened, { type: "page-turned" })).toEqual({
      position: firstReference,
      label: "1",
      noteKind: "endnote",
      presentation: "compact",
    });
  });

  it("keeps a compact control stable across further page turns", () => {
    const compact = {
      position: firstReference,
      label: "1",
      noteKind: "footnote" as const,
      presentation: "compact" as const,
    };

    expect(reduceNoteReturnAnchor(compact, { type: "page-turned" })).toBe(
      compact,
    );
  });

  it("replaces the previous return location when another note opens", () => {
    const opened = reduceNoteReturnAnchor(undefined, {
      type: "note-opened",
      position: firstReference,
      label: "1",
    });
    const nextReference = {
      sectionId: "chapter-2",
      blockId: "paragraph-2",
      offset: 8,
    };

    expect(
      reduceNoteReturnAnchor(opened, {
        type: "note-opened",
        position: nextReference,
        label: "2",
      }),
    ).toEqual({
      position: nextReference,
      label: "2",
      presentation: "expanded",
    });
  });

  it("clears the return location for dismissals and explicit navigation", () => {
    const opened = reduceNoteReturnAnchor(undefined, {
      type: "note-opened",
      position: firstReference,
      label: "1",
    });

    expect(reduceNoteReturnAnchor(opened, { type: "cleared" })).toBeUndefined();
  });

  it("does not create a return control from an unrelated page turn", () => {
    expect(
      reduceNoteReturnAnchor(undefined, { type: "page-turned" }),
    ).toBeUndefined();
  });
});
