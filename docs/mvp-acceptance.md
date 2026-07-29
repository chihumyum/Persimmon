# MVP 验收

本文把“代码可编译”和“用户实际可读”分开记录，避免把未执行的 Native 真机测试写成已通过。

## 自动门禁

```bash
pnpm verify
pnpm test:e2e
pnpm test:epubs
```

2026-07-30 当前基线：

| 门禁                           | 当前结果                                                            |
| ------------------------------ | ------------------------------------------------------------------- |
| Prettier / ESLint / TypeScript | 本次通过                                                            |
| Unit tests                     | 70 files，325 tests 本次通过                                        |
| Android Kotlin native module   | 本次编译通过                                                        |
| iOS Swift native module        | 本次 simulator SDK 编译通过                                         |
| Expo Doctor                    | 20 / 20 本次通过                                                    |
| iOS / Android JS bundle        | 两端本次通过                                                        |
| Web production export / budget | 本次通过，36.74 MiB / 42 MiB raw                                    |
| Chromium shelf E2E             | 搜索（仅书名 + 作者）与设置入口本次通过                             |
| Chromium / WebKit Reader E2E   | 当前 `main` 的 CanvasKit 字体 provider 基线问题阻塞，见下方已知边界 |

E2E 用动态生成的 EPUB 与内置长文书覆盖：

1. 文件选择与 Worker 导入；
2. 封面 / 图片资源落库和读取；
3. CSS 白名单与两章目录；
4. 连续翻页和章节跨越；
5. 目录跳转；
6. 进度防抖保存；
7. 页面刷新、重新打开和断点续读；
8. 删除书籍及关联本地数据；
9. 字体、字号、行距、段距、页边距与页眉进度的修改和持久化；
10. 书架按书名 / 作者搜索、设置入口和主题切换；
11. 浮层目录跳转，以及书籍详情中的同步 / 下载 / 删除入口。

同步引擎单测另外覆盖：

- 新设备采用远端书籍后，会把采用结果持久化到自己的设备文档；
- 远端 locator 与 `publicationProgress` 一起落本地；
- `needs-reimport` 不会被误判成用户删除并产生墓碑；
- 高频进度写入始终串行，并把突发回调折叠到最新位置。

### Web Reader 已知边界

当前 checkout 和未包含本轮书架改动的干净 `main` 基线，都能在 CanvasKit Web 复现
`JsiSkTypefaceFontProvider.matchFamilyStyle` 的“Not implemented on React Native
Web”。绕过该调用后，基线仍会在进入 `LiveReader`
分页时长时间占用主线程。因此本轮不把书架 E2E 通过扩写成“完整 Web
Reader 通过”，也不提交试验性字体绕过。Native
Reader 不走这个 CanvasKit 实现；该问题应作为独立 Web renderer 修复。

## 私有 EPUB 验收

`pnpm test:epubs` 会扫描被 Git 忽略的 `epubs-for-test/`。当前 5 本全部通过：

| 书籍              | sections |  blocks | resources |
| ----------------- | -------: | ------: | --------: |
| Project Hail Mary |       42 |   6,318 |        36 |
| 七王国的骑士      |       20 |   2,576 |         7 |
| 国家为什么会失败  |       86 |   1,877 |       147 |
| 28 册科幻合集     |      833 | 101,772 |       150 |
| 红楼梦            |      137 |   8,554 |       165 |

警告是显式、可统计的恢复结果，不等于静默失败。主要剩余警告为目录 fragment 找不到时回退到 section
start、空 section 跳过和未 manifest 图片跳过。

## Web 人工检查

本轮用三本真实、封面比例不同的 EPUB 检查了桌面和窄屏书架：

- 封面完整显示且没有白色补边；
- 不同比例共用稳定的卡片舞台和底部基线；
- 书名、作者、进度与操作入口不挤占封面；
- 搜索和设置弹层可由键盘 / accessibility role 定位。

旧版本曾完成真实书 Reader、目录、快速点击和续读的人工检查，但当前 CanvasKit 基线问题已经让那份结果失效；恢复完整 Reader
E2E 前，不继续沿用旧的“约 1.1 秒可交互”数据。

## Native 真机签字清单

原生菜单已经分别通过 Android Kotlin 与 iOS
Swift 编译，但“能编译”不等于系统菜单外观和长按手感已经在目标设备签字。发布 Native
MVP 前，iOS 与 Android 各自必须在至少一台物理设备完成：

- [ ] 首次启动、权限与文件选择正常；
- [ ] 导入一本文字书和一本含图片书；
- [ ] 导入 100 MiB 级大书时 UI 有明确忙碌状态且不被系统杀死；
- [ ] 不同比例封面保持完整内容、共享基线且没有白色补边；
- [ ] 搜索只命中书名或作者，设置中可切换主题并管理 Google Drive；
- [ ] 长按书卡出现平台原生菜单，详情、下载 / 同步和删除均执行正确；
- [ ] Reader 目录作为浮层出现，不挤压或重排正文；
- [ ] Android 系统返回先关闭浮层，再从 Reader 返回书架而不是桌面；
- [ ] 书籍、封面、图片、目录可读；
- [ ] 连续 20 次点按翻页，最终位置正确；
- [ ] 右侧拖拽完成与短拖回弹；
- [ ] 字号调整后位置基本不跳；
- [ ] 锁屏 / 后台 / 前台后继续阅读；
- [ ] 强制退出后书架与进度恢复；
- [ ] 旋转与安全区无裁切（iPad / Android tablet 也检查）；
- [ ] 删除书籍后原 EPUB、section、resource 和进度一并消失；
- [ ] 存储空间不足显示可理解错误，旧书不损坏；
- [ ] 新设备连接同一 Drive 后无需手动同步即可拉回书籍和阅读百分比；
- [ ] 两端并发阅读、后台 / 前台与强退重启后，进度不回退；
- [ ] Xcode Instruments / Android Studio 中无持续内存增长；
- [ ] 典型设备翻页无明显长帧；记录 P50 / P95 frame time 与峰值内存。

只有两端清单都签字，才能把“Native 实测通过”从 pending 改为 passed。

## MVP 明确不验收

- fixed-layout、DRM；
- MathML、复杂 SVG / table、完整 CSS；
- 持久化高亮、批注与同步；
- App Store / Play 签名、上架和发布监控。
