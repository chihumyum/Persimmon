const EPUB_EXTENSION = /\.epub$/i;
const MAX_BASENAME_CODE_POINTS = 60;

export interface EpubExportNameSource {
  readonly sourceName: string;
  readonly title: string;
}

function invalidFilenameCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    codePoint <= 0x1f || codePoint === 0x7f || '/\\:*?"<>|'.includes(character)
  );
}

function sanitizedBaseName(value: string): string {
  const withoutExtension = value.replace(EPUB_EXTENSION, "");
  const sanitized = Array.from(withoutExtension)
    .map((character) => (invalidFilenameCharacter(character) ? "_" : character))
    .join("")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/g, "")
    .trim();
  return Array.from(sanitized).slice(0, MAX_BASENAME_CODE_POINTS).join("");
}

export function epubExportFileName(source: EpubExportNameSource): string {
  const preferredName = EPUB_EXTENSION.test(source.sourceName)
    ? source.sourceName
    : source.title;
  const baseName =
    sanitizedBaseName(preferredName) ||
    sanitizedBaseName(source.title) ||
    "Persimmon Book";
  return `${baseName}.epub`;
}
