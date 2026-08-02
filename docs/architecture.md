# Persimmon 架构

Persimmon 把 EPUB 当作输入格式，而不是运行环境。书籍不会进入 WebView；导入器只输出受控的内容、资源和样式数据，阅读端消费同一份
`BookIR`。

```text
EPUB bytes
   │  bounded ZIP + strict OPF/XML + XHTML recovery
   ▼
versioned BookIR ── stable BookPosition / navigation / asset metadata
   │
   ▼
ParagraphLayoutBackend ── SkParagraph on Native and CanvasKit Web
   │
   ▼
PageScene + PageLocationIndex
   │
   ▼
live Skia page ── transition-only captured texture ── curved mesh
```

## 分层与依赖方向

```text
book-core
   ▲
   ├── epub-import
   ├── layout
   │     ▲
   │     └── reader-skia ◄── page-turn-core
   │              ▲
   └──────────── app / platform repositories
```

- `book-core`：平台无关，只描述内容、资源、目录、样式白名单和稳定位置。
- `epub-import`：纯编译器。负责 ZIP 安全限制、OPF/spine、EPUB 2 NCX、EPUB 3
  nav、XHTML 容错、图片尺寸和安全 CSS cascade。
- `layout`：只依赖抽象段落测量后端；页码是当前 layout generation 的派生值。
- `page-turn-core`：从独立 demo 移植的连续曲率模型，无 React /
  Skia 依赖。手指压住纸张时用 Euler-elastica 受压模式；越过书脊后纸卷贴着落纸的那一页往外滚，已经落下的纸平铺，剩下的卷曲率逐渐均匀化、半径不断变大，直到摊平。
- `reader-skia`：章节懒分页、SkParagraph、实时页面、图片 LRU、临时页面纹理与网格动画。
- `apps/persimmon`：书架 / Reader
  UI、文件选择、Repository、同步编排与平台生命周期。

ESLint 对这些边界有硬约束：核心包不能引用 Expo / React
Native，渲染器不能引用存储，UI 不能绕过 Repository 直接访问 IndexedDB /
AsyncStorage / FileSystem。

### 应用设计系统

应用层使用一套代码优先的轻量设计系统。`ReaderTheme`
是 Reader 与应用界面的语义颜色来源； `apps/persimmon/src/components`
内的 token、排版、按钮、分段控件、Modal
surface 和 Reader 浮层负责一致的尺寸与交互状态。它们只依赖主题与 React
Native，不得引用 Repository、同步或分页实现。完整约束与开发期双栏策略见
[design-system.md](design-system.md)。

## EPUB 编译边界

导入分为以下步骤：

1. 校验 mimetype、ZIP 路径、条目数量、单条和总解压大小；
2. 严格解析 `container.xml` 与 OPF，拒绝 fixed-layout；
3. 按 spine 编译内容；严格 XHTML 失败时只对内容文档使用 HTML5 恢复；
4. 解析 EPUB 2 NCX 或 EPUB 3 nav，并把 fragment 映射到稳定 `BookPosition`；
5. 读取 manifest 内图片、探测固有尺寸、识别封面；
6. 将外链和内嵌 CSS 降维到安全白名单后写入 BookIR；
7. 对 BookIR 做完整结构校验，再交给存储边界。

支持的作者样式只有：

- `text-align`；
- `font-weight` / `font-style`；
- 上下 block margin（统一成 `em`，范围受限）；
- `display:none`。

选择器支持常见 tag / class / id / compound selector 的层叠与
`!important`。脚本、事件、定位、网络资源和任意浏览器 CSS 都不会进入渲染器。

## 本地存储

Repository 是唯一存储入口。

### Web

IndexedDB 使用五个 object store：

```text
books       original EPUB + manifest
sections    [bookId, sectionId] → SectionIR
resources   [bookId, assetId]   → bytes
progress    bookId              → BookLocator
settings    key                 → reader settings
```

导入在单个 read-write transaction 中替换书籍、章节与资源；配额错误会转换成稳定的
`LibraryError`。

### Native

Native 目录结构：

```text
persimmon-library-v2/
  books/<book-id>/
    manifest.json
    original.epub
    sections/000000.json
    resources/<asset-id>.bin
  staging/
```

导入先完整写入 staging 并校验，再在同卷内 rename。更新已有书时，旧目录先变为replacement
backup；启动恢复会覆盖“旧目录已备份”和“新目录已落地”两个中断点。因此崩溃后保留旧版或新版完整书籍，不会留下半本书。AsyncStorage 只保存小型索引、进度和设置。

## 书架与平台交互

书架保持一个窄的 UI 边界：卡片只读取
`LibraryBookSummary`，封面 bytes 仍通过 Repository 获取，不直接碰平台存储。所有卡片占用相同的排版舞台，但封面按固有宽高比
`contain`
并靠下对齐；舞台空余区域就是书架背景，不用白色容器补齐。这样横版、方版与常规竖版封面可以共享同一基线，同时阴影仍只包住真实封面。

搜索只匹配规范化后的书名和作者，不把章节正文载入内存。主题、Google
Drive 和可关闭的同步提示统一放在设置弹层；同步提示可见性作为本机 UI 偏好保存，不参与云同步。

Native 书卡长按通过平台 adapter 打开系统菜单：

- iOS：`UIEditMenuInteraction`；
- Android：floating `ActionMode`；
- Web：回退到应用内书籍详情弹层。

菜单只返回 `details` / `sync` / `delete`
意图，实际存储和同步仍由应用层回调执行。Reader 中的目录同样是浮层，不改变页面宽度，也不会触发重排；Android
hardware back 先关闭打开的浮层，没有浮层时再退出 Reader 到书架。

## Google Drive 同步

`SyncEngine` 位于 `LibraryRepository` 之上，UI 不直接操作 Drive。云端使用隐藏
`appDataFolder`，只保存不可变原始 EPUB 和小型逻辑状态，不上传 sections、resources、BookIR 或阅读样式。

```text
LibraryRepository
      │ local books / locators
      ▼
SyncEngine ── per-device mutation document ── Google Drive appDataFolder
      │                                           ├── book SHA-256.epub
      └── HLC merge + tombstones                  └── device state.json
```

每台设备只更新自己的状态文件，避免多个设备并发覆盖同一个全局清单。书籍 upsert /
delete 和进度使用 HLC 排序；同一本 EPUB 由 SHA-256 `bookId` / `revisionId`
确定身份。上传时先完成 resumable EPUB
upload，再发布引用它的设备状态。下载时校验长度和 SHA-256 后才进入 Repository 的原子导入路径。

已授权设备会在冷启动、回到前台和前台每 60 秒同步；导入、删除或阅读位置变化后再以 1.5 秒合并窗口触发同步。首次关联的新设备在连接成功后立即执行同一条 sync 路径：合并远端设备文档、下载缺失 EPUB、原子导入、应用远端进度，然后把采用后的状态写进自己的设备文档。远端状态因此不会只存在于一次运行的内存里。

Android 使用 Google Sign-In 恢复账号身份，再由 Google Identity Services
`AuthorizationClient` 独立申请 Drive scope 和 access token；iOS 继续由 Google
Sign-In SDK 管理原生授权。Web 使用 Google Identity
Services 的短期 token。同步凭证只授予
`drive.appdata`，不需要 Persimmon 自有账号，也不会访问用户普通 Drive 文件。具体配置和验收见
[google-drive-sync.md](google-drive-sync.md)。

## 分页、进度与资源

阅读器只分页当前 section，并预热相邻 section；离开范围后释放 SkParagraph。大书不会在打开时一次性排完整本。

```text
settled PageAddress
desired PageAddress
active turn (at most one)
```

动画期间的新点击只更新
`desired`，不会不断创建 FIFO 动画。每次落页后最多启动下一次合并过渡。

阅读进度保存：

```text
stable locator:
  bookId + revisionId + sectionId + blockId + UTF-16 offset

display metadata:
  publicationProgress (0...1) + updatedAt
```

字号或窗口变化后，根据 `PageLocationIndex`
重新定位；持久化层从不把页码或百分比当作稳定锚点。`publicationProgress`
只负责书架与页眉显示，并和 locator 一起参与“是否有新进度”的判断，避免位置已相同但百分比仍旧。

Reader 的高频进度回调进入单写者
`ProgressWriteQueue`：同一时间最多一个本地 + 同步状态写入，写入期间的新回调折叠成最新快照。失败时只有在没有更新快照的情况下才重试旧值，避免较慢的旧写入晚于新位置完成并把进度倒退。离开 Reader、应用进入后台或组件卸载时会立即 flush；常态下使用短防抖减少 I/O。

图片按需从 Repository 取 bytes，由 Skia 解码。LRU 预算为 Web 64 MiB、Native 32
MiB；当前页、相邻页和目标页资源被 pin，淘汰或卸载时显式 dispose。

## 连续曲率翻页

静止阅读始终是 live SkParagraph /
SkImage。只有一次翻页开始时，移动页会抓取一张临时 Skia texture：

- 最多 2x 像素密度；
- 单次预算 48 MiB；
- 超预算或 offscreen surface 失败时降级为双 live-page 平移；
- 落页、取消、尺寸变化或书籍切换后停止引用，并在 Canvas 后续提交后 dispose，避免上一帧持有已释放的 Skia 指针。

`page-turn-core` 生成 65 点连续曲率 profile；`reader-skia`
不铺三角网格，而是把 profile 作为 uniform 交给 runtime
shader：Native 按屏幕列逐片元求逆，Web 先把可见深度烘成一张屏幕 x
lookup 再采样。自动翻页包含“压入成弧 → 荡过书脊 → 贴着落纸页滚开”；纸卷落到目标页之后书脊端切线钉在该页上，所以纸不可能穿进页面里。右侧拖拽可保持预压形态，松手按距离、速度和 page
weight 决定完成或回弹。49 帧几何测试约束连续性、弧长、穿透和最终位置。

这个例外只服务于过渡形变；正文静态态仍是实时文字，因此不会牺牲清晰度、命中测试或未来选区能力。

### 居中透视相机

翻页不是正交投影，而是一台针孔相机：距离 4 个页宽，水平焦点在双页的书脊（bookX
0）或单页的页心（bookX 0.5），垂直焦点固定在视口中心。`page-turn-perspective.ts`
是这套模型的唯一定义，三条渲染路径（Web lookup、UI runtime
rasterizer、Native逐片元求逆）都从它取值：

- 缩放 `scale(z) = 4 / (4 - z)`，z 为页宽单位的隆起高度。翻页中段峰值 z ≈
  0.97，即约 1.32 倍；`z = 0`
  时恒为 1，所以翻页首尾帧与静态页像素对齐，不会跳变。
- 水平方向把 profile 点按 `scale`
  推离焦点，隆起处因此近大远小；纹理插值走 perspective-correct 参数化，否则一段的两端因深度不同而让字形斜切。
- 垂直方向对纹理坐标取逆投影：视口只显示纸张 `1 / scale`
  的条带，隆起越高，纸张的上下两边越是溢出屏幕之外，字形随之变高。
- 投影会把纸影推到物理落点之外（中段可达 0.14 个页宽），所以投影后的轮廓才是投影阴影的锚点；材料边缘位置与速度仍取物理值，用于判断越脊与展平反馈。
- lookup 路径每格附带一个材料斜率做次像素插值。轮廓处投影段长趋零会让该斜率发散，因此按“每半格最多一个 profile 段”截断，避免单列纹理糊成一条。

## 当前边界

MVP 面向普通 reflowable EPUB。以下能力后置：

- fixed-layout、DRM、脚本；
- ruby 的精细排版、MathML、复杂 SVG / table；
- 选择、高亮、批注和跨 revision anchor rebase；
- 浏览器级完整 CSS；
- Native 真机性能签字（bundle 门禁已通过，需按验收清单实测）。
