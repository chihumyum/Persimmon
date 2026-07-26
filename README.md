# Persimmon

Persimmon（柿子）是一个 Expo + React Native Skia
EPUB 阅读器。它不使用 WebView：EPUB 会先被编译成版本化、平台无关的
`BookIR`，再经过共享分页器生成 `PageScene`，最后由 Skia / CanvasKit 绘制。

当前 MVP 已具备：

- EPUB 2/3 可重排书籍解析、HTML5 容错、NCX / nav 目录、封面与图片；
- 安全 CSS 白名单（对齐、粗斜体、段间距、隐藏内容），不执行书内脚本；
- Web IndexedDB 与 Native 文件系统本地书库，原 EPUB、章节、资源和进度分开存储；
- 章节级懒分页、目录跳转、字号重排、稳定位置续读和图片 LRU；
- 从 `play-books-page-turning` 移植的连续曲率翻页，支持点按、拖拽、完成与回弹；
- Chromium / WebKit 自动端到端测试，以及 iOS / Android 无 UI bundle 门禁。

架构说明见
[docs/architecture.md](docs/architecture.md)，当前验收证据与真机清单见
[docs/mvp-acceptance.md](docs/mvp-acceptance.md)。

## Workspace

- `apps/persimmon`：Expo 应用、书架、平台存储与文件选择；
- `packages/book-core`：BookIR、稳定 locator 与数据校验；
- `packages/epub-import`：受限 ZIP / OPF / XHTML / CSS 编译；
- `packages/layout`：平台无关的段落测量接口、分页与位置索引；
- `packages/page-turn-core`：连续曲率几何、手势判定与回弹运动学；
- `packages/reader-skia`：SkParagraph、Skia 页面、图片缓存与翻页网格。

## Development

使用 Node 22 和 pnpm 10：

```bash
corepack enable
pnpm install
pnpm dev:web
```

核心验证：

```bash
pnpm verify
pnpm test:e2e
pnpm test:epubs
```

- `pnpm verify`：格式、lint、全量类型、单测、Expo Doctor、iOS / Android
  bundle、Web 生产导出和 42 MiB 体积预算（包含两套离线中文阅读字体）；
- `pnpm test:e2e`：Chromium 与 WebKit 的生成 EPUB 全阅读闭环；
- `pnpm test:epubs`：解析本地忽略目录 `epubs-for-test/` 中的私有测试书。

Playwright 首次运行前：

```bash
pnpm exec playwright install chromium webkit
```

## Native development build

Persimmon 使用项目专用 Expo development build，不依赖 Expo Go。安装开发客户端：

```bash
pnpm native:ios:device
pnpm native:android:device
```

日常 TypeScript 修改只需：

```bash
pnpm dev:native
```

修改 Native 依赖、Expo 配置或 SDK 后需要重建客户端。当前仓库的 iOS / Android
bundle 已通过；正式宣称真机可用前，仍须在目标设备执行
[真机验收清单](docs/mvp-acceptance.md#native-真机签字清单)。

## MVP scope

目标是普通小说类、可重排、无 DRM 的 EPUB。当前不支持 fixed-layout、DRM、脚本、MathML、复杂 SVG
/ 表格、选择与批注。书内 CSS 只进入显式安全白名单，不追求浏览器级 CSS 兼容。
