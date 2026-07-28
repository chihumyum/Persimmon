import {
  BUILTIN_READER_MATH_ID,
  BUILTIN_READER_SANS_ID,
  BUILTIN_READER_SERIF_ID,
  type FontFamilyRecord,
} from "@persimmon/font-core";

export const BUILTIN_FONT_FAMILIES: readonly FontFamilyRecord[] = [
  {
    id: BUILTIN_READER_SERIF_ID,
    displayName: "Noto Serif SC",
    source: "bundled",
    category: "serif",
    faces: [
      {
        id: `${BUILTIN_READER_SERIF_ID}:400`,
        familyId: BUILTIN_READER_SERIF_ID,
        weight: 400,
        style: "normal",
        format: "ttf",
        byteLength: 0,
        coverage: {
          latin: true,
          cjk: true,
          math: false,
          emoji: false,
        },
        variable: false,
      },
    ],
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://openfontlicense.org",
      redistributable: true,
    },
  },
  {
    id: BUILTIN_READER_SANS_ID,
    displayName: "Noto Sans SC",
    source: "bundled",
    category: "sans",
    faces: [
      {
        id: `${BUILTIN_READER_SANS_ID}:400`,
        familyId: BUILTIN_READER_SANS_ID,
        weight: 400,
        style: "normal",
        format: "ttf",
        byteLength: 0,
        coverage: {
          latin: true,
          cjk: true,
          math: false,
          emoji: false,
        },
        variable: false,
      },
    ],
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://openfontlicense.org",
      redistributable: true,
    },
  },
  {
    id: BUILTIN_READER_MATH_ID,
    displayName: "Noto Sans Math",
    source: "bundled",
    category: "sans",
    faces: [
      {
        id: `${BUILTIN_READER_MATH_ID}:400`,
        familyId: BUILTIN_READER_MATH_ID,
        weight: 400,
        style: "normal",
        format: "ttf",
        byteLength: 0,
        coverage: {
          latin: true,
          cjk: false,
          math: true,
          emoji: false,
        },
        variable: false,
      },
    ],
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://openfontlicense.org",
      redistributable: true,
    },
  },
];

export function selectableFontFamilies(
  families: readonly FontFamilyRecord[],
): readonly FontFamilyRecord[] {
  return families.filter((family) => family.id !== BUILTIN_READER_MATH_ID);
}
