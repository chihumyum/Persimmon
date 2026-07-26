# MVP 验收

本文把“代码可编译”和“用户实际可读”分开记录，避免把未执行的 Native 真机测试写成已通过。

## 自动门禁

```bash
pnpm verify
pnpm test:e2e
pnpm test:epubs
```

当前基线：

| 门禁                           | 当前结果                 |
| ------------------------------ | ------------------------ |
| Prettier / ESLint / TypeScript | 通过                     |
| Unit tests                     | 36 files，195 tests 通过 |
| Expo Doctor                    | 20 / 20 通过             |
| iOS JS/Hermes bundle           | 通过（无模拟器）         |
| Android JS/Hermes bundle       | 通过（无模拟器）         |
| Web production export          | 通过                     |
| Web raw export budget          | 35.56 MiB / 42 MiB       |
| Chromium E2E                   | 通过                     |
| WebKit E2E                     | 通过                     |

E2E 通过动态生成的 EPUB 与内置长文书真实验证：

1. 文件选择与 Worker 导入；
2. 封面 / 图片资源落库和读取；
3. CSS 白名单与两章目录；
4. 连续翻页和章节跨越；
5. 目录跳转；
6. 进度防抖保存；
7. 页面刷新、重新打开和断点续读；
8. 删除书籍及关联本地数据。
9. 字体、字号、行距、段距、页边距与页眉进度的修改和持久化。

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

已用真实 `Project Hail Mary` 检查：

- 书架真实封面；
- 封面页与正文内图片；
- 目录打开和跳转；
- 章节级懒分页；
- 快速连续点击合并；
- 刷新后续读；
- 临时纹理翻页成功落页；
- 正常流程无运行时错误。

本机真实书打开到可交互约 1.1 秒；这是人工观测值，不是跨设备性能保证。

## Native 真机签字清单

用户当前要求不启动模拟器，因此本轮只执行 Native 类型、Expo
Doctor 和双平台 bundle。发布 Native
MVP 前，iOS 与 Android 各自必须在至少一台物理设备完成：

- [ ] 首次启动、权限与文件选择正常；
- [ ] 导入一本文字书和一本含图片书；
- [ ] 导入 100 MiB 级大书时 UI 有明确忙碌状态且不被系统杀死；
- [ ] 书籍、封面、图片、目录可读；
- [ ] 连续 20 次点按翻页，最终位置正确；
- [ ] 右侧拖拽完成与短拖回弹；
- [ ] 字号调整后位置基本不跳；
- [ ] 锁屏 / 后台 / 前台后继续阅读；
- [ ] 强制退出后书架与进度恢复；
- [ ] 旋转与安全区无裁切（iPad / Android tablet 也检查）；
- [ ] 删除书籍后原 EPUB、section、resource 和进度一并消失；
- [ ] 存储空间不足显示可理解错误，旧书不损坏；
- [ ] Xcode Instruments / Android Studio 中无持续内存增长；
- [ ] 典型设备翻页无明显长帧；记录 P50 / P95 frame time 与峰值内存。

只有两端清单都签字，才能把“Native 实测通过”从 pending 改为 passed。

## MVP 明确不验收

- fixed-layout、DRM；
- MathML、复杂 SVG / table、完整 CSS；
- 文本选择、批注与同步；
- App Store / Play 签名、上架和发布监控。
