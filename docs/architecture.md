# Persimmon 架构

Persimmon 的目标不是在 React Native 里包一层网页阅读器，而是把 EPUB
编译成自己的阅读模型，再由 Skia 直接排版和绘制。Web 使用相同的
BookIR、分页器和渲染器，只把 Skia 后端换成 CanvasKit。

## 决策摘要

```text
Expo + React Native
        ↓
共享 TypeScript BookIR
        ↓
共享 Skia Paragraph 分页器
        ↓
共享 Skia 页面渲染器
        ↓
iOS / Android / Web 薄平台适配
```

- 原生端使用 React Native New Architecture 和 React Native Skia；
  Web 使用 CanvasKit，不使用 WebView。
- 页面始终由 live Paragraph 和 Skia scene 绘制，翻页不依赖页面截图。
- 共享内容模型、分页、位置、阅读会话和渲染语义；文件系统、字体加载、
  持久化、输入和平台生命周期由薄适配层处理。
- 不追求 UI 组件的最大复用。为了手势、交互和平台习惯，三端界面可以
  分别实现，只要它们消费相同的阅读核心。
- 优先保证连续输入、稳定帧时和可中断动画。只有基准测试证明
  TypeScript/Skia 成为瓶颈时，才把明确热点下沉到原生代码。

```text
EPUB / Drifting project
          ↓
      importer adapter
          ↓
   versioned TypeScript BookIR
          ↓
 SkParagraph layout backend
          ↓
  pure-data PageScene pages
          ↓
 live React Native Skia renderer
          ↓
 iOS / Android / CanvasKit Web
```

## 当前包边界

- `book-core`：稳定、平台无关的内容模型。段落位置使用
  `revisionId + sectionId + blockId + UTF-16 offset`，从不保存页码。
- `epub-import`：把受限的 EPUB ZIP、OPF 和 XHTML 编译为 BookIR。
  文件选择和持久化不进入这个包。
- `layout`：接收抽象 `ParagraphLayoutBackend`，把测量后的真实行数据
  切成纯数据 `PageScene`。
- `reader-skia`：实现 SkParagraph backend，并把 PageScene 画成实时
  Skia 场景。
- `apps/persimmon`：书架、文件选择、持久化、工具栏和平台生命周期。

Drifting 以后只需要新增另一个 importer：

```text
Drifting snapshot → BookIR
```

它不应该绕过 BookIR，也不需要复制分页或渲染逻辑。

## 页面不是截图

一个长段落只 shape/layout 一次。跨页时，页面保存的是完整
SkParagraph 的行范围、裁剪框和 `sourceTop`：

```text
page 7: clip paragraph lines 0...8
page 8: clip paragraph lines 9...17
```

翻页时当前页和目标页各自仍是 live Paragraph。slide 动画只改变两个
Skia Group 的 transform；没有 DOM rasterization、ImageBitmap、
SkPicture 截图或 WebView 快照。

## 高频翻页状态

阅读会话只保存：

```text
settledPage
desiredPage
activeTransition
```

每次点击基于 `desiredPage` 继续累加。动画期间的新输入不会重启当前
动画，也不会进入 FIFO；当前动画结束后，下一次动画直接合并到最终
目标。这使内存和动画对象数量与点击次数无关。

## 重分页与批注锚点

字号、窗口或主题变化会使页码失效。因此进度和未来的批注必须锚定
BookIR 文本位置。重新分页后，通过 `PageLocationIndex` 把位置解析到
新页。页码只能作为当前 layout generation 的派生值。

批注第一版可直接扩展为：

```ts
interface Annotation {
  id: string;
  bookId: string;
  revisionId: string;
  start: BookPosition;
  end: BookPosition;
  body: string;
}
```

跨版本迁移则单独做 anchor rebase，不能静默复用旧页码。

## Web 字体取舍

CanvasKit 不能读取浏览器系统字体，必须显式注册 TTF/OTF。当前只懒加载
一个完整的 Noto Serif SC 正文字重（约 15 MB），保证任意简体中文 EPUB
不会出现缺字。以后可以评估：

- 按书籍字符集生成并缓存字体子集；
- 正文和 emoji 分开加载；
- 首屏预热 CanvasKit 与字体；
- 在 CDN 上使用长期 immutable cache。

## 当前 MVP 边界

已支持：

- 可重排 EPUB 的 manifest、spine 和基本 XHTML 文本；
- 标题、段落、粗体、强调、换行和图片占位；
- 中文/英文 live SkParagraph 排版；
- slide 翻页、连续输入合并、字号重排；
- 本地书架和稳定位置进度。

暂不支持：

- EPUB CSS cascade、ruby、脚注、表格、MathML、复杂 SVG；
- fixed-layout EPUB 和 DRM；
- 图片解码与跨页媒体缓存；
- 选区、批注和版本迁移；
- 原生端的大书持久化与真机性能门禁。

## 建议的下一批

1. 图片资源解码、尺寸探测和 LRU 缓存。
2. 选择/命中测试、统一批注锚点与高亮绘制。
3. EPUB 样式白名单，而不是浏览器级 CSS 兼容。
4. Drifting snapshot importer 与版本化 review package。
5. iOS/Android 真机的帧时、输入延迟、内存和大书基准。
6. 当 TypeScript/Skia 路径被数据证明不够快时，再把明确的热点下沉到
   C++/Rust；不要提前重写整个核心。
