# iOS / Android 发布清单

更新日期：2026-08-03

## 当前已经完成

- [x] 设置页包含隐私政策、邮件 / 系统分享反馈、App 版本、开放源代码许可；
- [x] “清空本机数据”和“清空 Google
      Drive 数据”分离，均有 destructive 二次确认和忙碌态；
- [x] 营销版本显式固定为 `0.1.0`；EAS production profile 使用 remote app version
      source 与 build auto-increment；
- [x] Android 生产配置禁用系统备份，并阻止旧外部存储、悬浮窗和未使用的振动权限；
- [x] iOS `ITSAppUsesNonExemptEncryption=false` 已声明；
- [x] 无广告、分析、跟踪和第一方账号；Google Drive 只使用 `drive.appdata`；
- [x] 维护者确认 iOS / Android 真机功能与性能验收通过；详见
      [mvp-acceptance.md](mvp-acceptance.md)。

## 提交商店前必须完成

- [ ] 把 [privacy-policy.md](privacy-policy.md)
      发布到无需登录的公共 HTTPS 地址，并分别填入 App Store Connect 与 Play
      Console；
- [ ] 配置公开支持邮箱 `EXPO_PUBLIC_SUPPORT_EMAIL`（本地与 EAS
      production 环境一致），并从商店分发包验证反馈邮件的收件地址；未配置时 App 会安全回退到系统分享面板；
- [ ] 确认 App Store Connect 的 App
      Privacy、年龄分级、内容版权、出口合规、支持 URL、截图与审核说明；
- [ ] 确认 Play Console 的 Data safety、内容分级、目标受众、广告声明、App
      access、商店图文与支持联系方式；
- [ ] 把 Google OAuth consent screen 发布到 Production，并确认 `drive.appdata`
      的审核 / 验证状态；
- [ ] 把 Android 发布 keystore 的 SHA-1 加入正确的 Google OAuth Android Client；
- [ ] 生成签名 IPA 与 AAB，上传 TestFlight / Play internal
      testing，并在商店分发包上做一次冷启动、登录、导入、同步、清理数据与崩溃回归；
- [ ] 检查最终 AAB 中所有 `arm64-v8a` ELF 的 LOAD segment 与 ZIP page
      alignment，而不只检查 Gradle 中间产物；
- [ ] 确认开发者协议、税务、收款、地区可用性与定价均已在两个后台生效。

## 版本与构建号

- 用户可见版本来自 `apps/persimmon/app.json` 的 `expo.version`，当前为 `0.1.0`；
- workspace 与 App package version 也保持 `0.1.0`，避免设置页、Metro
  bundle 和商店元数据不一致；
- iOS build number / Android versionCode 由 EAS production profile 自动递增；
- 不在没有明确产品决定时擅自把首发版本改成 `1.0.0`。

## 生产配置复核

配置变化后重新生成 CNG 原生工程并检查合并结果：

```bash
pnpm --filter @persimmon/app exec expo prebuild --clean
pnpm --filter @persimmon/app exec expo config --type public
```

Android release manifest 应满足：

- `android:allowBackup="false"`；
- 不含 `READ_EXTERNAL_STORAGE`、`WRITE_EXTERNAL_STORAGE`、`SYSTEM_ALERT_WINDOW`
  或 `VIBRATE`；
- 文件导入继续通过系统 Document Picker，不依赖广泛存储权限；
- 只保留运行所需的网络权限。

2026-08-03 已执行 `processReleaseMainManifest`：合并结果为版本 `0.1.0`、
`allowBackup=false`，权限只剩 `INTERNET`
与 Android 为本 App 生成的内部动态接收器权限。iOS 生成工程包含 Expo Dev
Launcher 的官方 Release build phase，会在非 Debug 产物中移除 `_expo._tcp`
与对应本地网络说明，同时保留开发客户端所需的 Debug 配置。

`apps/persimmon/ios` 与 `apps/persimmon/android` 是 Expo
CNG 生成目录，不提交；生产修复必须落在 `app.json`、`app.config.js`、config
plugin 或源码中。

## 上线后

- [ ] 选择并接入不采集阅读内容的崩溃监控，或明确记录第一版不接入监控的决定；
- [ ] 为隐私政策与支持入口建立稳定公共域名，避免使用私有仓库或临时链接；
- [ ] 每次依赖升级复跑 license inventory、Expo Doctor、双端 bundle、真机 smoke
      test 和数据删除回归。
