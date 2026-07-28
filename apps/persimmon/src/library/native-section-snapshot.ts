import type { SectionIR } from "@persimmon/book-core";

export const NATIVE_SECTION_SNAPSHOT_FILE = "sections.json";

export function serializeNativeSectionSnapshot(
  sections: readonly SectionIR[],
): string {
  return JSON.stringify(sections);
}

export function parseNativeSectionSnapshot(
  serialized: string,
  expectedSectionIds: readonly string[],
): readonly SectionIR[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed) || parsed.length !== expectedSectionIds.length) {
    return undefined;
  }
  const sections = parsed as Partial<SectionIR>[];
  return sections.every(
    (section, index) => section.id === expectedSectionIds[index],
  )
    ? (sections as SectionIR[])
    : undefined;
}
