# Persimmon 设计系统

Persimmon 的设计系统是代码优先、阅读器专用的产品基础层。它统一应用界面的语义颜色、排版、间距、圆角、控件尺寸、阴影和交互状态，但不进入 EPUB 编译、分页、BookIR、Repository 或同步逻辑。

## Source of truth

- `packages/reader-skia/src/reader-theme.ts`：跨 Reader 与应用 UI 共用的语义颜色。组件只能使用
  `paper`、`panel`、`text`、`secondaryText`、`accent`
  等角色，不能根据某个页面复制颜色值。
- `apps/persimmon/src/components/ui-tokens.ts`：间距、圆角、控件尺寸、动效时间和排版角色。
- `apps/persimmon/src/components/ui-text.tsx`：非原生应用文字的排版角色入口。
- `apps/persimmon/src/components/app-round-button.*`：书架、Reader 与 Sheet 共用的原生圆形按钮入口；外层统一 50，iOS 使用 SwiftUI
  glass，Android 使用 Compose tonal surface。
- `apps/persimmon/src/components/ui-button.tsx`：primary、secondary、ghost文字按钮，支持前后图标。
- `apps/persimmon/src/components/ui-icon.tsx`：跨平台图标语义入口；iOS 使用 SF
  Symbols，Android 使用 Material Symbols。
- `library-native-*` 与 `reader-*`：iOS SwiftUI/UIKit、Android
  Compose/View适配层。原生控件的尺寸与文字角色必须从 `ui-tokens.ts`
  传入；无法直接导入 TypeScript 的独立原生页面使用同名常量，并由数值审计保持一致。
- `apps/persimmon/src/components/ui-modal-surface.tsx`：居中 Modal 的表面、边框与 elevation。
- `apps/persimmon/src/components/reader-floating-panel.tsx`：Reader 目录和设置浮层及其标题栏。

Figma 可以镜像这些 token 和组件，但代码是当前行为与尺寸的权威来源。

## Rules

1. 新界面先选语义颜色和既有 token；只有真实的新视觉角色才新增 token。
2. 同一种交互出现两次时优先复用 primitive，不在 screen 内复制完整 Pressable /
   panel 样式。
3. 所有圆形主控件使用唯一的 `uiSize.control = 50`
   pt/dp；书架筛选和 Reader 分段控件的高度也必须等于 50。禁止在页面内以 46、48、54 等局部数值做视觉补偿。
4. Sheet
   header 固定为 66（顶部 8 + 控件 50 + 底部 8）；返回和关闭都使用 50 的原生圆形按钮。Reader
   chrome 也使用同一 50 直径，并且不通过显隐工具栏改变正文分页或稳定 locator。
5. 原生菜单、系统 Switch 和系统授权界面保留平台行为；设计系统不仿制系统控件。
6. light / dark、iOS / Android 必须消费相同语义角色，不以平台分支复制一套颜色。
7. 搜索、设置、关闭、更多、排序、增减等通用动作必须使用 `UiIcon`
   的语义名称，不以 `＋`、`×`、`•••`、`⌄`
   等文本字符伪装图标；图标按钮必须保留完整的 `accessibilityLabel`。
8. Sheet 选项的共同几何为：左右各 16、普通行高 60、带描述行高 76、section 圆角 14、分隔线左右各缩进 16。开关、chevron 和右侧值必须共享同一右边界。
9. Sheet 文字角色固定为：header 20/600、segment 17/600、label
   17/500、右侧值 17/400、右侧动作 17/500、description
   14/400。iOS 与 Android 使用各自系统字体，不允许某一个条目单独切换字体或字重。
10. iOS Sheet 不显示 drag indicator；系统 Sheet、Switch、Wheel
    Picker 和菜单保留原生行为与材质，只由设计 token 约束外部几何和语义颜色。
11. Reader 设置复用同一个原生 Sheet 外壳：根页、字体页、排版页分别以 58%、76%、40% 作为进入时的默认 detent，同时保留原生手势在三档高度间切换。页面切换不得关闭、重挂或重新弹出 Sheet。
12. 书架设置 section 与 Reader 设置使用相同的 60/76 行高、16 左右 inset、内缩分隔线、14 圆角和语义 panel 色；不得再套用独立的 Form/FieldGroup 白色宽 Cell。

## Reader responsive policy

Reader 的单页与双栏是持久化阅读设置。当前开发阶段需要在窄屏模拟器和设备上直接测试双栏分页、翻页纹理和 locator 保持，因此**不按屏幕宽度禁用双栏，也不自动降级为单页**。

未来若为正式产品增加有效页宽门禁，必须同时保留显式的开发覆盖开关，并验证切换布局后：

- Reader 不卸载；
- 当前稳定文本位置不丢失；
- 横竖屏与字号变化不会保存页码作为锚点；
- 开发覆盖仍能在手机宽度进入双栏。

## Migration boundary

Reader 的分页、页面纹理和输入调度不因 UI
primitive 迁移而改动。每轮迁移至少运行格式、lint、类型检查、设计 token 单测和两端 Release 编译；视觉验收按任务要求选择真机或模拟器，并明确区分数值/编译验证与视觉验收。
