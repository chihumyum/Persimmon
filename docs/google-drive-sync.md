# Google Drive 云同步

Persimmon 使用 Google Drive 隐藏的 `appDataFolder`
同步原始 EPUB 和稳定阅读位置。它只申请
`https://www.googleapis.com/auth/drive.appdata`，不会读取或修改用户在普通 Drive 界面中看到的其他文件。

## 同步边界

会同步：

- 原始 EPUB，不上传本地重新编译出的章节、图片资源和 BookIR；
- 书架元数据：`bookId`、`revisionId`、原文件名、标题、作者、导入时间和字节数；
- 阅读进度：稳定 locator（`bookId + revisionId + sectionId + blockId + UTF-16 offset`）、0 到 1 的显示百分比和更新时间；
- 删除墓碑，用于让另一台设备删除同一本书。

不会同步：

- 字号、单/双页布局；
- 翻页曲线和手势参数；
- EPUB 解析后的缓存与渲染产物。

每个 EPUB 以 SHA-256 `revisionId`
保存为不可变 blob。每台设备只更新自己的状态文件，设备之间通过 HLC（混合逻辑时钟）合并书籍墓碑和阅读进度，因此并发同步不会让两台设备覆盖同一个清单文件。发布设备状态前会先确认对应 EPUB 已上传；下载后会重新计算 SHA-256，再交给安全 EPUB 导入器。

## 创建 Google Cloud 凭证

不需要 Client Secret，也不要把 Client
Secret 放进 App 或发给其他人。Persimmon 使用公开的 OAuth Client
ID；iOS 和 Android Client ID 已配置，Web Client ID 可以等部署域名确定后再添加。

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建或选择项目。
2. 在 API Library 中启用
   [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)。
3. 打开 Google Auth Platform，配置 Branding、Audience 和 Data Access：
   - 开发期可选择 External + Testing，并把测试 Google 账号加入 Test users；
   - 添加 scope `https://www.googleapis.com/auth/drive.appdata`；
   - Testing 状态下，非基础身份 scope 的 refresh
     token 通常会在 7 天后失效；正式长期使用前应发布到 Production，并按控制台要求完成验证。
4. 需要启用 Web 同步时，在 Clients 中创建 Web application：
   - Authorized JavaScript origins 添加实际 Web 地址；
   - 本地 Expo Web 默认可添加 `http://localhost:8081`；
   - 生产地址按实际域名添加，例如 `https://reader.example.com`；
   - 记录生成的 Web Client ID。
5. iOS application 已创建并接入：
   - Bundle ID：`dev.chihum.persimmon`；
   - Client ID：
     `51752452441-gueqiurk1lrkeamljiqntn28ed6n5gg7.apps.googleusercontent.com`。
6. Android application 已创建并接入：
   - Package name：`dev.chihum.persimmon`；
   - 填写开发或发布签名证书的 SHA-1；
   - 本地生成过 Android 工程后可在 `apps/persimmon/android` 运行
     `./gradlew signingReport` 查看 debug SHA-1；
   - EAS 构建应从对应 Android keystore 取得 SHA-1，并为该签名另建或更新 Client；
   - Client ID：
     `51752452441-8q55ns0e3k8h47q9h5uqa3487rui5639.apps.googleusercontent.com`。

Google 官方入口：

- [appDataFolder 说明](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Android AuthorizationClient 授权](https://developer.android.com/identity/authorization)
- [Google Identity Services Web token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [OAuth 2.0 for iOS and installed apps](https://developers.google.com/identity/protocols/oauth2/native-app)

## 填入 Client ID

Native Client ID 已作为 `app.config.js` 中的公开默认值提交，不依赖本地
`.env.local`，因此本地和 EAS 构建都会生效。需要覆盖 Client
ID 或以后启用 Web 时，可以复制占位文件：

```bash
cp apps/persimmon/.env.example apps/persimmon/.env.local
```

按需覆盖对应 Client ID：

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456-web.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=51752452441-gueqiurk1lrkeamljiqntn28ed6n5gg7.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=51752452441-8q55ns0e3k8h47q9h5uqa3487rui5639.apps.googleusercontent.com
```

Client ID 是公开标识，`EXPO_PUBLIC_` 前缀是有意的。`.env.local` 已被 Git 忽略。

Web 重新启动 Metro 即可：

```bash
pnpm dev:web
```

iOS Client ID 会改变原生 URL scheme，因此填写凭证后需要重建 development build：

```bash
pnpm --filter @persimmon/app exec expo prebuild --clean
pnpm native:ios:device
pnpm native:android:device
```

不要提交生成的 `ios/`、`android/` 目录；项目使用 Expo CNG，由
`app.json`、`app.config.js` 和依赖重新生成它们。

## 运行时序

连接 Google Drive 不是只完成授权。授权成功后，Persimmon 会立即执行完整同步：

1. 读取所有设备状态并用 HLC 合并；
2. 下载本机缺少且未被墓碑删除的 EPUB；
3. 校验 byte length 与 SHA-256，再通过 Repository 原子导入；
4. 应用胜出的稳定 locator 和显示百分比；
5. 把本机采用后的书籍与进度重新发布到自己的设备状态文件。

因此新设备连接同一账号后无需逐本点“下载”，也不依赖手动“立即同步”才能出现书籍。应用冷启动恢复已有授权、回到前台，以及前台每 60秒都会再次拉取；导入、删除和进度变化会在 1.5秒合并窗口后主动推送。设置中的“立即同步”和书卡菜单中的“从云端下载”是恢复 / 重试入口，不是正常同步的必要步骤。

同一设备上的同步状态操作串行执行，多个 `syncNow`
只共享一个进行中的任务。Reader 的高频进度回调也先折叠成最新快照，再按“本地进度 → 本机设备状态”的顺序持久化。应用退到后台或退出 Reader 时会强制 flush；失败快照保留并短延时重试，不让较慢的旧写入覆盖新位置。

冲突仍以稳定 locator 的 HLC 为准，百分比只跟随同一条进度 mutation 用于显示，不作为定位依据。远端进度只在
`revisionId` 与本机书籍一致时应用。

## 验收

1. 在第一台设备连接同一个 Google 账号，导入 EPUB，等待显示“已同步”。
2. 清空第二台设备的 Persimmon 本地数据后连接同一账号；不点“立即同步”，确认书籍自动出现、状态为已下载且能完整打开。
3. 第一台设备阅读几页并停留至少 1.5 秒；第二台设备回到前台，确认续读 locator 和书架显示百分比一起更新。
4. 删除书籍并同步，确认另一台设备同步后也删除。
5. 修改字号、单双页或翻页参数，确认另一台设备的样式没有改变。
6. 同时在两台设备移动同一本书的进度，分别同步并重启两端，确认 HLC 胜出的最新位置不会在第二次同步后回退。
7. 中断一次上传 / 下载后重试，确认没有半本书，且书卡可通过“从云端下载”修复
   `needs-reimport` 状态。

Native Google SDK 会安全维护授权状态并刷新 access token。Web 使用 Google
Identity Services 短期 access
token，只保存在当前浏览器会话中；浏览器会话过期后，界面会要求重新连接，不会把长期 refresh
token 放进前端存储。

Android 将“账号身份”和“Drive 数据权限”分开：Google Sign-In 只选择并恢复账号，
`AuthorizationClient` 为同一账号申请 `drive.appdata` 并签发 access
token。应用启动时只做静默检查，不会自行弹出授权页；用户点连接后才允许打开权限页。Drive 返回 401 时会通过
`AuthorizationClient.clearToken`
清除旧 token，再静默获取新 token。这个授权桥接是原生 Expo 模块，修改后必须重建 Android
development build，单独刷新 Metro bundle 不会生效。
