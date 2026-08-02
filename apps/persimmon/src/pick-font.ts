import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { MAX_USER_FONT_BYTES } from "@persimmon/font-core";

import { translate } from "./i18n";

export interface PickedFont {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

async function bytesOf(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<Uint8Array> {
  if (asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }
  return new ExpoFile(asset.uri).bytes();
}

export async function pickLocalFont(): Promise<PickedFont | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) {
    return null;
  }
  if (asset.size !== undefined && asset.size > MAX_USER_FONT_BYTES) {
    throw new Error(
      translate("errors.fonts.fileTooLarge", {
        maximumMb: MAX_USER_FONT_BYTES / 1024 / 1024,
      }),
    );
  }
  return {
    fileName: asset.name,
    bytes: await bytesOf(asset),
  };
}
