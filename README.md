# Persimmon

Persimmon（柿子）是一个 Expo + React Native Skia
EPUB 阅读器。它不使用 WebView：EPUB 会先被编译成版本化、平台无关的
`BookIR`，再经过共享分页器生成
`PageScene`，最后由原生 Skia 绘制。产品只面向 iOS 和 Android，不再发布 Web 版本。

当前 MVP 已具备：

- EPUB 2/3 可重排书籍解析、HTML5 容错、NCX / nav 目录、封面与图片；
- 安全 CSS 白名单（对齐、粗斜体、段间距、隐藏内容），不执行书内脚本；
- Native 文件系统本地书库，原 EPUB、章节、资源和进度分开存储；
- 极简书架、按书名或作者搜索、保留原始比例的混排封面、筛选与排序；
- 统一设置页，包含隐私政策、邮件 / 系统分享反馈、版本、开放源代码许可，以及分离的本机 /
  Google Drive 数据清理；
- 书卡长按原生菜单中的详情、下载 / 同步和删除操作；
- Google Drive `appDataFolder` 在 iOS /
  Android 自动拉取原 EPUB、删除状态、稳定阅读位置和显示进度；
- 支持跟随系统、简体中文或 English 的 App 内语言覆盖；系统“按 App 语言”在重新构建原生客户端后同样可用；EPUB 的排版 locale 独立跟随书籍语言元数据；
- 章节级懒分页、浮层目录跳转、字号重排、稳定位置续读和图片 LRU；
- 从 `play-books-page-turning` 移植的连续曲率翻页，支持点按、拖拽、完成与回弹；
- Android 系统返回键先关闭 Reader 浮层，再返回书架；
- iOS / Android 无 UI bundle 门禁。

架构说明见 [docs/architecture.md](docs/architecture.md)，应用 UI
token 与组件规范见
[docs/design-system.md](docs/design-system.md)，当前验收证据与真机清单见
[docs/mvp-acceptance.md](docs/mvp-acceptance.md)，Google
Cloud 凭证创建和双设备验收见
[docs/google-drive-sync.md](docs/google-drive-sync.md)，发布前剩余事项见
[docs/release-checklist.md](docs/release-checklist.md)。

## Workspace

- `apps/persimmon`：Expo 应用、书架、平台存储与文件选择；
- `packages/book-core`：BookIR、稳定 locator 与数据校验；
- `packages/epub-import`：受限 ZIP / OPF / XHTML / CSS 编译；
- `packages/layout`：平台无关的段落测量接口、分页与位置索引；
- `packages/page-turn-core`：连续曲率几何、手势判定与回弹运动学；
- `packages/reader-skia`：SkParagraph、Skia 页面、图片缓存与原生翻页 shader。

## Development

使用 Node 22 和 pnpm 10：

```bash
corepack enable
pnpm install
pnpm dev:native
```

核心验证：

```bash
pnpm verify
pnpm test:epubs
```

- `pnpm verify`：格式、lint、全量类型、单测、Expo Doctor，以及 iOS / Android
  bundle；
- `pnpm test:epubs`：解析本地忽略目录 `epubs-for-test/` 中的私有测试书。

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

修改 Native 依赖、Expo 配置或 SDK 后需要重建客户端。2026-08-03，维护者已确认 iOS
/ Android 真机功能与性能验收通过；自动门禁和签字边界记录在
[真机验收清单](docs/mvp-acceptance.md#native-真机签字清单)。商店签名、元数据和审核仍按
[发布清单](docs/release-checklist.md)单独完成。

## MVP scope

目标是普通小说类、可重排、无 DRM 的 EPUB。当前不支持 fixed-layout、DRM、脚本、MathML、复杂 SVG
/ 表格、选择与批注。书内 CSS 只进入显式安全白名单，不追求浏览器级 CSS 兼容。
