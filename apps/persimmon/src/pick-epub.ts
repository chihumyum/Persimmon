import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";

export interface PickedEpub {
  fileName: string;
  readBytes: () => Promise<Uint8Array>;
}

async function bytesOf(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<Uint8Array> {
  return new ExpoFile(asset.uri).bytes();
}

export async function pickEpubs(): Promise<readonly PickedEpub[]> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "application/epub+zip",
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (picked.canceled) {
    return [];
  }

  return picked.assets.map((asset) => ({
    fileName: asset.name,
    readBytes: () => bytesOf(asset),
  }));
}
