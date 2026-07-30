# Persimmon 设计系统

Persimmon 的设计系统是代码优先、阅读器专用的产品基础层。它统一应用界面的语义颜色、排版、间距、圆角、控件尺寸、阴影和交互状态，但不进入 EPUB 编译、分页、BookIR、Repository 或同步逻辑。

## Source of truth

- `packages/reader-skia/src/reader-theme.ts`：跨 Reader 与应用 UI 共用的语义颜色。组件只能使用
  `paper`、`panel`、`text`、`secondaryText`、`accent`
  等角色，不能根据某个页面复制颜色值。
- `apps/persimmon/src/components/ui-tokens.ts`：间距、圆角、控件尺寸、动效时间和排版角色。
- `apps/persimmon/src/components/ui-text.tsx`：应用字体与排版角色入口。
- `apps/persimmon/src/components/ui-button.tsx`：primary、secondary、ghost 与 Reader
  chrome 按钮，支持文字、前后图标与图标按钮。
- `apps/persimmon/src/components/ui-icon.tsx`：跨平台图标语义入口；iOS 使用 SF
  Symbols，Android 与 Web 使用 Material Symbols。
- `apps/persimmon/src/components/ui-segmented-control.tsx`：单选分段控件。
- `apps/persimmon/src/components/ui-modal-surface.tsx`：居中 Modal 的表面、边框与 elevation。
- `apps/persimmon/src/components/reader-floating-panel.tsx`：Reader 目录和设置浮层及其标题栏。

Figma 可以镜像这些 token 和组件，但代码是当前行为与尺寸的权威来源。

## Rules

1. 新界面先选语义颜色和既有 token；只有真实的新视觉角色才新增 token。
2. 同一种交互出现两次时优先复用 primitive，不在 screen 内复制完整 Pressable /
   panel 样式。
3. 可点击区域至少 44pt。Reader chrome 可以保持 34pt 的视觉高度，但必须通过 hit
   slop 达到 44pt。
4. Reader chrome 的视觉区域只占用 safe
   area 后已经为工具栏保留的 34pt，不通过显隐工具栏改变正文分页，也不移动稳定 locator。
5. 原生菜单、系统 Switch 和系统授权界面保留平台行为；设计系统不仿制系统控件。
6. light / dark、Web / iOS /
   Android 必须消费相同语义角色，不以平台分支复制一套颜色。
7. 搜索、设置、关闭、更多、排序、增减等通用动作必须使用 `UiIcon`
   的语义名称，不以 `＋`、`×`、`•••`、`⌄`
   等文本字符伪装图标；图标按钮必须保留完整的 `accessibilityLabel`。

## Reader responsive policy

Reader 的单页与双栏是持久化阅读设置。当前开发阶段需要在窄屏模拟器和设备上直接测试双栏分页、翻页纹理和 locator 保持，因此**不按屏幕宽度禁用双栏，也不自动降级为单页**。

未来若为正式产品增加有效页宽门禁，必须同时保留显式的开发覆盖开关，并验证切换布局后：

- Reader 不卸载；
- 当前稳定文本位置不丢失；
- 横竖屏与字号变化不会保存页码作为锚点；
- 开发覆盖仍能在手机宽度进入双栏。

## Migration boundary

设计系统按触达页面增量迁移，不进行一次性视觉重写。Reader 的分页、页面纹理和输入调度不因 UI
primitive 迁移而改动。每轮迁移至少运行格式、lint、类型检查和相关单测；涉及视觉尺寸时再在 iOS 模拟器及 Android 目标设备复核。
