export type ReaderThemeName = "warm";

export type ReaderColorMode = "system" | "light" | "dark";

export type ResolvedReaderColorScheme = "light" | "dark";

export interface ReaderTheme {
  readonly name: ReaderThemeName;
  readonly colorScheme: ResolvedReaderColorScheme;
  readonly paper: string;
  readonly surrounding: string;
  readonly text: string;
  readonly link: string;
  readonly decoration: string;
  readonly divider: string;
  readonly imagePlaceholder: string;
  readonly noteAccent: string;
  readonly panel: string;
  readonly panelRaised: string;
  readonly panelMuted: string;
  readonly border: string;
  readonly controlText: string;
  readonly secondaryText: string;
  readonly accent: string;
  readonly accentStrong: string;
  readonly shadow: string;
}

const WARM_THEME: Readonly<Record<ResolvedReaderColorScheme, ReaderTheme>> = {
  light: {
    name: "warm",
    colorScheme: "light",
    paper: "#fbf7f0",
    surrounding: "#e8e1d8",
    text: "#2f2b26",
    link: "#a64f2d",
    decoration: "#8b8177",
    divider: "#ded5ca",
    imagePlaceholder: "#eed9c8",
    noteAccent: "#c97a52",
    panel: "#fbf7f0",
    panelRaised: "#fffaf4",
    panelMuted: "#eee5dc",
    border: "#d8cdc2",
    controlText: "#5c534b",
    secondaryText: "#81756b",
    accent: "#d95f2b",
    accentStrong: "#a94420",
    shadow: "#3d3026",
  },
  dark: {
    name: "warm",
    colorScheme: "dark",
    paper: "#1f1a17",
    surrounding: "#110e0c",
    text: "#e8ded2",
    link: "#e5a079",
    decoration: "#aa9c90",
    divider: "#40362f",
    imagePlaceholder: "#3a2b24",
    noteAccent: "#d68b63",
    panel: "#26201c",
    panelRaised: "#312823",
    panelMuted: "#3a302a",
    border: "#4b3e36",
    controlText: "#e2d6ca",
    secondaryText: "#b6a79a",
    accent: "#e57949",
    accentStrong: "#f19a70",
    shadow: "#080605",
  },
};

export const DEFAULT_READER_THEME = WARM_THEME.light;

/** Backwards-compatible alias for consumers that only need the default paper. */
export const READER_PAPER_COLOR = DEFAULT_READER_THEME.paper;

export function resolveReaderTheme(
  name: ReaderThemeName,
  colorScheme: ResolvedReaderColorScheme,
): ReaderTheme {
  switch (name) {
    case "warm":
      return WARM_THEME[colorScheme];
  }
}
