import {
  parseDownloadableFontCatalog,
  type DownloadableFontCatalog,
} from "@persimmon/font-core";

const GOOGLE_FONTS_COMMIT = "7ff85c87f93ea6cca5f41c69f2e4edcb90240f26";
const GOOGLE_FONTS_ROOT = `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/ofl`;
const NOTO_CJK_COMMIT = "f8d157532fbfaeda587e826d4cd5b21a49186f7c";
const NOTO_CJK_SANS_ROOT = `https://raw.githubusercontent.com/notofonts/noto-cjk/${NOTO_CJK_COMMIT}/Sans`;

export const DOWNLOADABLE_FONT_CATALOG: DownloadableFontCatalog =
  parseDownloadableFontCatalog({
    schemaVersion: 1,
    families: [
      {
        id: "download:lxgw-wenkai-screen",
        displayName: "霞鹜文楷屏幕阅读版",
        category: "serif",
        description: "针对屏幕阅读优化的开源楷体，文件约 24.5 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: "https://github.com/lxgw/LxgwWenKai/blob/v1.522/OFL.txt",
          redistributable: true,
        },
        faces: [
          {
            id: "download:lxgw-wenkai-screen:400",
            weight: 400,
            style: "normal",
            format: "ttf",
            url: "https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.522/LXGWWenKaiScreen.ttf",
            sha256:
              "cd1a6fa39c4ea42fd8f4e289945789b0e510cf7016435640f8893cdad9b220f3",
            byteLength: 25_673_994,
          },
        ],
      },
      {
        id: "download:literata",
        displayName: "Literata",
        category: "serif",
        description: "为长篇数字阅读设计的英文字体，常规与斜体共约 1.8 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: `${GOOGLE_FONTS_ROOT}/literata/OFL.txt`,
          redistributable: true,
        },
        faces: [
          {
            id: "download:literata:400:normal",
            weight: 400,
            style: "normal",
            format: "ttf",
            url: `${GOOGLE_FONTS_ROOT}/literata/Literata%5Bopsz%2Cwght%5D.ttf`,
            sha256:
              "b41138c9373112f32abb589cc22e8674b06ed4048b0c513be922bdd26f274440",
            byteLength: 955_132,
          },
          {
            id: "download:literata:400:italic",
            weight: 400,
            style: "italic",
            format: "ttf",
            url: `${GOOGLE_FONTS_ROOT}/literata/Literata-Italic%5Bopsz%2Cwght%5D.ttf`,
            sha256:
              "d483dfaeba9cbf4ce71d32a52ee65df82f7e35b15fff8d1011cdb242d1fcd465",
            byteLength: 902_728,
          },
        ],
      },
      {
        id: "download:noto-sans-mono-cjk-sc",
        displayName: "Noto Sans Mono CJK SC",
        category: "mono",
        description: "覆盖简体中文与拉丁字符的开源等宽黑体，文件约 15.6 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: `${NOTO_CJK_SANS_ROOT}/LICENSE`,
          redistributable: true,
        },
        faces: [
          {
            id: "download:noto-sans-mono-cjk-sc:400",
            weight: 400,
            style: "normal",
            format: "otf",
            url: `${NOTO_CJK_SANS_ROOT}/Mono/NotoSansMonoCJKsc-Regular.otf`,
            sha256:
              "ec04cc376b34887cedbdf84074e2e226ed2761eeabdcb9173fc1dd7bfd153ef7",
            byteLength: 16_393_784,
          },
        ],
      },
    ],
  });
