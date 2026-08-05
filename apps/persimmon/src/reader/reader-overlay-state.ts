export type ReaderSettingsTab = "typography" | "reading";

export type ReaderSettingsPage = "root" | "fonts" | "typographyPreview";

export type ReaderOverlayState =
  | { readonly kind: "none" }
  | { readonly kind: "toc" }
  | {
      readonly kind: "settings";
      readonly page: ReaderSettingsPage;
      readonly tab: ReaderSettingsTab;
    };
