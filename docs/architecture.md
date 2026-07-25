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
- `apps/persimmon`：UI、文件选择、Repository、平台生命周期。

ESLint 对这些边界有硬约束：核心包不能引用 Expo / React
Native，渲染器不能引用存储，UI 不能绕过 Repository 直接访问 IndexedDB /
AsyncStorage / FileSystem。

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
bookId + revisionId + sectionId + blockId + UTF-16 offset
```

字号或窗口变化后，根据 `PageLocationIndex`
重新定位；持久化层从不把页码当作稳定锚点。

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
