# iOS TestFlight / Android APK 测试清单

更新日期：2026-08-08

当前阶段只面向维护者自用测试：iOS 通过 TestFlight Internal
Testing，Android 通过 EAS Internal Distribution 安装 APK。暂不提交 App
Store 正式审核，也不使用 Google Play。

## 已完成

- [x] 设置页包含隐私政策、反馈、App 版本、开放源代码许可、了解开发者；
- [x] “清空本机数据”和“清空 Google Drive 数据”分离，并有破坏性操作二次确认；
- [x] Bundle ID 与 Android package 均为 `dev.chihum.persimmon`；
- [x] 用户可见版本为 `0.1.0`，EAS preview / production 自动递增构建号；
- [x] 公开支持邮箱固定为 `support@persimmon.cc`，并同步配置到 EAS
      preview 与 production 环境；
- [x] Google Drive iOS / Android OAuth Client ID 已作为公开默认值接入；
- [x] EAS Android keystore 已存在，SHA-1 为
      `0F:04:1A:5A:94:B6:61:24:70:11:19:13:16:6B:5D:AA:C9:3B:E0:62`；
- [x] Android preview profile 使用 internal distribution，生成可直接安装的 APK；
- [x] Android 禁用系统备份和旧外部存储、悬浮窗、未使用振动权限；
- [x] iOS 已声明 `ITSAppUsesNonExemptEncryption=false`；
- [x] 维护者确认双端真机功能与性能验收通过；
- [x] 2026-08-08 完整运行 `pnpm verify`：格式、lint、类型、450 项测试、Expo
      Doctor 与双端生产 bundle 全部通过。
- [x] iOS 开发团队 `9843R35CWM`
      已写入 Expo 配置，真机 Release 脚本允许 Xcode 自动更新签名资料。

## Android APK

- [x] EAS preview / production 环境包含 `EXPO_PUBLIC_SUPPORT_EMAIL`；
- [x] 排除旧 APK、QA 产物、CNG 原生工程和本地缓存，缩小 EAS 上传包；
- [x] 本地 EAS preview 构建已生成正式 keystore 签名 APK：
      `artifacts/Persimmon-0.1.0-preview-build3.apk`；
- [x] 已验证 package `dev.chihum.persimmon`、版本 `0.1.0 (3)`、target SDK
      36、APK Signature Scheme v2 和签名证书；
- [x] APK SHA-256：
      `ece8da2c17cc84f124fa8b519617aad162872e4f1fcae97b78740d8158045f44`；
- [ ] 确认旧 debug 签名版不再需要本地数据，然后卸载旧版并安装当前 APK；
- [ ] 在 Google Cloud 的 Android OAuth Client 中确认 package 与上述 SHA-1；
- [ ] 使用 APK 验证 Google Drive 连接、上传、另一端下载及进度同步；
- [ ] 下一版 APK 覆盖安装，确认书籍、设置和阅读进度保留。

当前真机安装的是 `0.1.0 (1)`，证书为 Android Debug SHA-1
`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`。Android系统不允许不同签名覆盖安装，卸载会删除旧版私有数据，因此未自动执行。

构建命令：

```bash
cd apps/persimmon
fnm exec --using=22.23.1 -- pnpm dlx eas-cli@latest build \
  --platform android --profile preview --local
```

## iOS TestFlight

- [ ] 续费 Apple Developer Program；
- [ ] 在 Xcode Settings > Accounts 登录续费后的 Apple ID，并刷新团队资料；
- [ ] 在 App Store Connect 接受最新协议并创建 Persimmon App 记录；
- [ ] 交互验证 EAS 上已有的 Apple Distribution Certificate；
- [ ] 生成 production IPA；
- [ ] 使用 EAS Submit 上传 App Store Connect；
- [ ] 建立 Internal Testing 分组，只添加维护者本人；
- [ ] 从 TestFlight 安装并验证 Google Drive 双端同步。

构建与上传命令：

```bash
cd apps/persimmon
pnpm dlx eas-cli@latest build --platform ios --profile production
pnpm dlx eas-cli@latest submit --platform ios --profile production
```

2026-08-08 已实际尝试 EAS
production 与本地 Release 真机构建。EAS 因 Distribution
Certificate 尚未交互验证而停止；本地 Xcode 因团队账号无有效凭据、无法取得
`dev.chihum.persimmon` Provisioning
Profile 而停止。两者都需要先续费并登录 Apple，当前没有代码侧构建错误证据。

## Google Drive 自用测试

Google Auth Platform 暂时可以保持 External +
Testing，并把维护者 Google 账号加入 Test users。需要确认：

- [ ] Google Drive API 已启用；
- [ ] Data Access 包含 `https://www.googleapis.com/auth/drive.appdata`；
- [ ] iOS Client 对应 Bundle ID `dev.chihum.persimmon`；
- [ ] Android Client 对应 package `dev.chihum.persimmon` 和当前 EAS SHA-1；
- [ ] 在两台设备连接同一 Google 账号，完成 EPUB 与阅读进度双向同步验收。

Testing 状态只用于当前自用阶段；正式公开发布前再处理 OAuth
Production、公开隐私政策和可能的验证。

## 暂缓到公开发布

- App Store 截图、商店文案、App Privacy、年龄分级与正式 App Review；
- `persimmon.cc` 隐私政策、支持页和 Android APK 公共下载页；
- Android 官网版本检查与更新提示；
- Android Developer Console 身份与 package 注册；
- 不采集阅读内容的崩溃监控方案。

## 发布边界

`apps/persimmon/ios` 与 `apps/persimmon/android` 是 Expo
CNG 生成目录，不提交。配置变化后通过
`expo prebuild --clean`、`expo config --type public`
和最终签名包验证，不能只依据静态检查宣布商店发布完成。
