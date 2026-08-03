# 开放源代码许可 / Open-Source Notices

Persimmon 使用开源软件与字体。各项目保留各自作者的版权，依赖包随附的版权与许可文本优先于本页摘要。

## 直接运行时组件

| 组件                                                                                     | 主要许可                         |
| ---------------------------------------------------------------------------------------- | -------------------------------- |
| React、React Native、Expo 与 Expo 模块                                                   | MIT                              |
| React Native Skia、Gesture Handler、Reanimated、Screens、Safe Area Context、AsyncStorage | MIT                              |
| i18next、react-i18next                                                                   | MIT                              |
| Google Sign-In for React Native                                                          | MIT；Google SDK 另受适用条款约束 |
| fflate、parse5、@xmldom/xmldom                                                           | MIT                              |
| Skia 及其第三方组件                                                                      | BSD 3-Clause 或组件各自许可      |

主要许可文本：

- MIT License: <https://opensource.org/license/mit>
- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0>
- BSD 3-Clause: <https://opensource.org/license/bsd-3-clause>

MIT 组件允许使用、复制、修改、合并、发布、分发、再许可及销售软件副本，但必须保留原版权声明与许可声明；软件按原样提供，不附带任何明示或默示担保。

## 字体

| 字体               | 许可                      | 来源                                                                  |
| ------------------ | ------------------------- | --------------------------------------------------------------------- |
| Noto Serif SC      | SIL Open Font License 1.1 | `@expo-google-fonts/noto-serif-sc`                                    |
| Noto Sans SC       | SIL Open Font License 1.1 | `@expo-google-fonts/noto-sans-sc`                                     |
| Noto Sans Math     | SIL Open Font License 1.1 | `@expo-google-fonts/noto-sans-math`                                   |
| 霞鹜文楷屏幕阅读版 | SIL Open Font License 1.1 | 固定到 LXGW WenKai Screen v1.522                                      |
| Literata           | SIL Open Font License 1.1 | 固定到 Google Fonts commit `7ff85c87f93ea6cca5f41c69f2e4edcb90240f26` |

SIL Open Font License 1.1: <https://openfontlicense.org>

## 发布清单生成

生产依赖变化后，在 Node 22 下生成完整传递依赖清单并审查未知或强 copyleft 许可：

```bash
pnpm --filter @persimmon/app licenses list --prod --json > third-party-licenses.json
```

生成文件包含本机绝对安装路径，不应原样提交或打包。发布产物只保留 package、version、license、author 与 homepage，并与 App 内“开放源代码许可”页面同步。当前 App 内页列出直接运行时组件和字体；在新增原生 SDK 或付费组件时必须先更新本文件。
