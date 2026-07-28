import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { MAX_USER_FONT_BYTES } from "@persimmon/font-core";
import { Platform } from "react-native";

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
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    return new Uint8Array(await response.arrayBuffer());
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
      `字体文件不能超过 ${MAX_USER_FONT_BYTES / 1024 / 1024} MB。`,
    );
  }
  return {
    fileName: asset.name,
    bytes: await bytesOf(asset),
  };
}
