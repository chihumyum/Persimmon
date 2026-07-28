import { describe, expect, it } from "vitest";

import {
  parseNativeSectionSnapshot,
  serializeNativeSectionSnapshot,
} from "./native-section-snapshot";

const sections = [
  {
    id: "section-1",
    blocks: [
      {
        kind: "paragraph" as const,
        id: "block-1",
        runs: [{ text: "Persimmon" }],
      },
    ],
  },
  {
    id: "section-2",
    blocks: [],
  },
];

describe("native section snapshot", () => {
  it("round-trips sections in manifest order", () => {
    expect(
      parseNativeSectionSnapshot(
        serializeNativeSectionSnapshot(sections),
        sections.map((section) => section.id),
      ),
    ).toEqual(sections);
  });

  it("rejects corrupt or mismatched snapshots", () => {
    expect(parseNativeSectionSnapshot("{", ["section-1"])).toBeUndefined();
    expect(
      parseNativeSectionSnapshot(serializeNativeSectionSnapshot(sections), [
        "section-2",
        "section-1",
      ]),
    ).toBeUndefined();
  });
});
