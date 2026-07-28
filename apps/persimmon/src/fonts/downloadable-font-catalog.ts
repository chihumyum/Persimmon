import {
  parseDownloadableFontCatalog,
  type DownloadableFontCatalog,
} from "@persimmon/font-core";

const GOOGLE_FONTS_COMMIT = "7ff85c87f93ea6cca5f41c69f2e4edcb90240f26";
const GOOGLE_FONTS_ROOT = `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/ofl`;

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
        id: "download:zcool-xiaowei",
        displayName: "站酷小薇体",
        category: "serif",
        description: "适合标题和短篇阅读的现代中文衬线字体，约 6.0 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: `${GOOGLE_FONTS_ROOT}/zcoolxiaowei/OFL.txt`,
          redistributable: true,
        },
        faces: [
          {
            id: "download:zcool-xiaowei:400",
            weight: 400,
            style: "normal",
            format: "ttf",
            url: `${GOOGLE_FONTS_ROOT}/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf`,
            sha256:
              "a42b620140f493db42f741351dfbf343c0936d58588ee8004b8b2a218d997ff1",
            byteLength: 6_313_808,
          },
        ],
      },
      {
        id: "download:ma-shan-zheng",
        displayName: "马善政毛笔楷书",
        category: "display",
        description: "开放授权的中文手写字体，约 5.6 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: `${GOOGLE_FONTS_ROOT}/mashanzheng/OFL.txt`,
          redistributable: true,
        },
        faces: [
          {
            id: "download:ma-shan-zheng:400",
            weight: 400,
            style: "normal",
            format: "ttf",
            url: `${GOOGLE_FONTS_ROOT}/mashanzheng/MaShanZheng-Regular.ttf`,
            sha256:
              "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb",
            byteLength: 5_857_936,
          },
        ],
      },
      {
        id: "download:long-cang",
        displayName: "龙藏体",
        category: "display",
        description: "具有书写感的开放中文字体，约 4.9 MB。",
        license: {
          name: "SIL Open Font License 1.1",
          url: `${GOOGLE_FONTS_ROOT}/longcang/OFL.txt`,
          redistributable: true,
        },
        faces: [
          {
            id: "download:long-cang:400",
            weight: 400,
            style: "normal",
            format: "ttf",
            url: `${GOOGLE_FONTS_ROOT}/longcang/LongCang-Regular.ttf`,
            sha256:
              "e5bf2c3f24ef2327c6f136d8f73e2f9dfdf44896fdbeb35a9515f44777bb91bc",
            byteLength: 5_162_508,
          },
        ],
      },
    ],
  });
