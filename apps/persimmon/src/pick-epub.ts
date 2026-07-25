import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";

export interface PickedEpub {
  fileName: string;
  bytes: Uint8Array;
}

async function bytesOf(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<Uint8Array> {
  if (asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    return new Uint8Array(await response.arrayBuffer());
  }

  return new ExpoFile(asset.uri).bytes();
}

export async function pickAndImportEpub(): Promise<PickedEpub | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "application/epub+zip",
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (picked.canceled) {
    return null;
  }

  const asset = picked.assets[0];
  if (!asset) {
    return null;
  }
  return {
    fileName: asset.name,
    bytes: await bytesOf(asset),
  };
}
