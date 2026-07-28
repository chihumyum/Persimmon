import { NotoSansMath_400Regular } from "@expo-google-fonts/noto-sans-math/400Regular";
import { NotoSansSC_400Regular } from "@expo-google-fonts/noto-sans-sc/400Regular";
import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import {
  BUILTIN_READER_SANS_ID,
  resolveAvailableFontId,
  type FontFamilyRecord,
} from "@persimmon/font-core";
import type { BookIR } from "@persimmon/book-core";
import {
  FontSlant,
  FontWeight,
  FontWidth,
  Skia,
  useFonts,
  type DataModule,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

const READER_SERIF_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSerifSC_400Regular as unknown as string,
      }
    : NotoSerifSC_400Regular;
const READER_SANS_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSansSC_400Regular as unknown as string,
      }
    : NotoSansSC_400Regular;
const READER_SYMBOL_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSansMath_400Regular as unknown as string,
      }
    : NotoSansMath_400Regular;

export const READER_SERIF_FAMILY_NAME = "Noto Serif SC";
export const READER_SANS_FAMILY_NAME = "Noto Sans SC";
export const READER_MATH_FAMILY_NAME = "Noto Sans Math";

interface LoadedFace {
  readonly faceId: string;
  readonly bytes: Uint8Array;
}

interface LoadedFamily {
  readonly familyId: string;
  readonly familyKey: string;
  readonly faces: readonly LoadedFace[];
}

export interface ReaderFontProviderResult {
  readonly fontProvider: SkTypefaceFontProvider | null;
  readonly fontFamily: string;
  readonly loading: boolean;
  readonly providerKey: string;
  readonly bookFontFamilyNames?: Readonly<Record<string, string>>;
  readonly error?: string;
}

function runtimeFamilyName(familyId: string): string {
  return `Persimmon ${familyId}`;
}

function runtimeBookFamilyName(revisionId: string, familyId: string): string {
  return `Persimmon Book ${revisionId} ${familyId}`;
}

interface LoadedBookFonts {
  readonly revisionId: string;
  readonly faces: readonly {
    readonly familyId: string;
    readonly faceId: string;
    readonly bytes: Uint8Array;
  }[];
}

function builtInFamilyName(familyId: string): string {
  return familyId === BUILTIN_READER_SANS_ID
    ? READER_SANS_FAMILY_NAME
    : READER_SERIF_FAMILY_NAME;
}

export function useReaderFontProvider(
  requestedFontId: string,
  families: readonly FontFamilyRecord[],
  loadFontFace: (faceId: string) => Promise<Uint8Array | undefined>,
  book: BookIR,
  useBookEmbeddedFonts: boolean,
  loadBookResource: (resourceId: string) => Promise<Uint8Array | undefined>,
): ReaderFontProviderResult {
  const builtInProvider = useFonts({
    [READER_SERIF_FAMILY_NAME]: [READER_SERIF_FONT],
    [READER_SANS_FAMILY_NAME]: [READER_SANS_FONT],
    [READER_MATH_FAMILY_NAME]: [READER_SYMBOL_FONT],
  });
  const resolvedFontId = resolveAvailableFontId(requestedFontId, families);
  const selectedFamily = families.find(
    (family) => family.id === resolvedFontId,
  );
  const selectedFamilyKey = JSON.stringify(
    selectedFamily?.faces.map((face) => [
      face.id,
      face.sha256,
      face.byteLength,
    ]) ?? [],
  );
  const [loaded, setLoaded] = useState<LoadedFamily | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loadedBookFonts, setLoadedBookFonts] = useState<
    LoadedBookFonts | undefined
  >(undefined);

  useEffect(() => {
    if (!selectedFamily || selectedFamily.source === "bundled") {
      setLoaded(undefined);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setLoaded(undefined);
    setError(undefined);
    void Promise.all(
      selectedFamily.faces.map(async (face) => ({
        faceId: face.id,
        bytes: await loadFontFace(face.id),
      })),
    )
      .then((faces) => {
        if (cancelled) {
          return;
        }
        if (faces.some((face) => !face.bytes || face.bytes.byteLength === 0)) {
          setError("字体文件缺失，已回退到内置衬线字体。");
          return;
        }
        setLoaded({
          familyId: selectedFamily.id,
          familyKey: selectedFamilyKey,
          faces: faces.map((face) => ({
            faceId: face.faceId,
            bytes: face.bytes!,
          })),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("字体文件读取失败，已回退到内置衬线字体。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadFontFace, selectedFamily, selectedFamilyKey]);

  useEffect(() => {
    const bookFamilies = Object.values(book.fontFamilies ?? {});
    if (!useBookEmbeddedFonts || bookFamilies.length === 0) {
      setLoadedBookFonts(undefined);
      return;
    }
    let cancelled = false;
    setLoadedBookFonts(undefined);
    void Promise.all(
      bookFamilies.flatMap((family) =>
        family.faces.map(async (face) => ({
          familyId: family.id,
          faceId: face.id,
          bytes: await loadBookResource(face.resourceId),
        })),
      ),
    )
      .then((faces) => {
        if (!cancelled) {
          setLoadedBookFonts({
            revisionId: book.revisionId,
            faces: faces.flatMap((face) =>
              face.bytes && face.bytes.byteLength > 0
                ? [
                    {
                      familyId: face.familyId,
                      faceId: face.faceId,
                      bytes: face.bytes,
                    },
                  ]
                : [],
            ),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedBookFonts({
            revisionId: book.revisionId,
            faces: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    book.fontFamilies,
    book.revisionId,
    loadBookResource,
    useBookEmbeddedFonts,
  ]);

  const selectedExternalLoaded =
    !!loaded &&
    loaded.familyId === selectedFamily?.id &&
    loaded.familyKey === selectedFamilyKey;
  const externalReady =
    selectedFamily?.source === "bundled" ||
    selectedExternalLoaded ||
    error !== undefined;
  const bookFontsReady =
    !useBookEmbeddedFonts ||
    Object.keys(book.fontFamilies ?? {}).length === 0 ||
    loadedBookFonts?.revisionId === book.revisionId;
  const builtProvider = useMemo(() => {
    if (
      !builtInProvider ||
      !selectedFamily ||
      !externalReady ||
      !bookFontsReady
    ) {
      return {
        fontProvider: null,
        bookFontFamilyNames: undefined,
        selectedExternalValid: false,
      };
    }
    // Do not dispose providers during a font switch. Paragraphs and captured
    // page textures can outlive the React render that created them, so Skia
    // must release the provider only after those native references drain.
    const provider = Skia.TypefaceFontProvider.Make();
    const normalStyle = {
      weight: FontWeight.Normal,
      width: FontWidth.Normal,
      slant: FontSlant.Upright,
    };
    for (const familyName of [
      READER_SERIF_FAMILY_NAME,
      READER_SANS_FAMILY_NAME,
      READER_MATH_FAMILY_NAME,
    ]) {
      const typeface = builtInProvider.matchFamilyStyle(
        familyName,
        normalStyle,
      );
      provider.registerFont(typeface, familyName);
    }
    let selectedExternalValid = selectedFamily.source === "bundled";
    if (selectedFamily.source !== "bundled") {
      const runtimeName = runtimeFamilyName(selectedFamily.id);
      for (const face of loaded?.faces ?? []) {
        const data = Skia.Data.fromBytes(face.bytes);
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) {
          continue;
        }
        provider.registerFont(typeface, runtimeName);
        selectedExternalValid = true;
      }
    }
    const registeredBookFamilies = new Set<string>();
    for (const face of loadedBookFonts?.faces ?? []) {
      const data = Skia.Data.fromBytes(face.bytes);
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) {
        continue;
      }
      provider.registerFont(
        typeface,
        runtimeBookFamilyName(book.revisionId, face.familyId),
      );
      registeredBookFamilies.add(face.familyId);
    }
    const bookFontFamilyNames = Object.fromEntries(
      [...registeredBookFamilies].map((familyId) => [
        familyId,
        runtimeBookFamilyName(book.revisionId, familyId),
      ]),
    );
    return {
      fontProvider: provider,
      bookFontFamilyNames:
        Object.keys(bookFontFamilyNames).length > 0
          ? bookFontFamilyNames
          : undefined,
      selectedExternalValid,
    };
  }, [
    book.revisionId,
    bookFontsReady,
    builtInProvider,
    externalReady,
    loaded,
    loadedBookFonts,
    selectedFamily,
  ]);

  const fontFamily =
    selectedFamily?.source === "bundled"
      ? builtInFamilyName(selectedFamily.id)
      : selectedFamily &&
          selectedExternalLoaded &&
          builtProvider.selectedExternalValid
        ? runtimeFamilyName(selectedFamily.id)
        : READER_SERIF_FAMILY_NAME;
  const providerKey = JSON.stringify([
    resolvedFontId,
    selectedFamilyKey,
    useBookEmbeddedFonts ? book.revisionId : undefined,
    useBookEmbeddedFonts
      ? Object.values(book.fontFamilies ?? {}).flatMap((family) =>
          family.faces.map((face) => [family.id, face.id, face.resourceId]),
        )
      : undefined,
  ]);

  return {
    fontProvider: builtProvider.fontProvider,
    fontFamily,
    providerKey,
    ...(builtProvider.bookFontFamilyNames
      ? { bookFontFamilyNames: builtProvider.bookFontFamilyNames }
      : {}),
    loading:
      !builtInProvider ||
      (!!selectedFamily &&
        selectedFamily.source !== "bundled" &&
        !externalReady &&
        !error) ||
      !bookFontsReady,
    ...(error || !builtProvider.selectedExternalValid
      ? {
          error:
            error ??
            (selectedFamily?.source !== "bundled"
              ? "字体无法载入，已回退到内置衬线字体。"
              : undefined),
        }
      : {}),
  };
}
