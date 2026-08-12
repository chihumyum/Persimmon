import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { epubExportFileName } from "./export-epub-file-name";
import { translate } from "./i18n";
import {
  libraryRepository,
  type LibraryBookSummary,
} from "./library/repository";
import { LibraryError } from "./library/types";

const EPUB_MIME_TYPE = "application/epub+zip";
const EPUB_UTI = "org.idpf.epub-container";

export async function exportEpub(entry: LibraryBookSummary): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(translate("errors.library.exportUnavailable"));
  }

  const bytes = await libraryRepository.getOriginalEpub(entry.id);
  if (!bytes?.byteLength) {
    throw new LibraryError(
      "needs-reimport",
      translate("errors.library.needsReimport"),
    );
  }

  const exportDirectory = new Directory(Paths.cache, "persimmon-exports");
  let exportFile: File | undefined;
  try {
    exportDirectory.create({ idempotent: true, intermediates: true });
    exportFile = new File(exportDirectory, epubExportFileName(entry));
    if (exportFile.exists) exportFile.delete();
    exportFile.write(bytes);
    await Sharing.shareAsync(exportFile.uri, {
      dialogTitle: translate("library.details.exportEpub"),
      mimeType: EPUB_MIME_TYPE,
      UTI: EPUB_UTI,
    });
  } catch (error) {
    throw new Error(translate("errors.library.exportFailed"), {
      cause: error,
    });
  } finally {
    try {
      if (exportFile?.exists) exportFile.delete();
    } catch {
      // A disposable cache file must not turn a completed export into an error.
    }
  }
}
