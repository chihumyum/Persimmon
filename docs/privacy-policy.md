# Persimmon 隐私政策 / Privacy Policy

> 发布说明：公开且权威的政策地址是
> <https://persimmon.cc/privacy>。App内“隐私政策”优先打开该地址，并保留本文件所对应的离线摘要作为打开失败时的备用内容。

更新日期 / Last updated: 2026-08-12

## 中文

Persimmon（柿子阅读）是一款本地优先的 EPUB 阅读器。除非你主动启用 Google
Drive 同步或发送支持邮件，Persimmon 开发者不会从 App 接收你的个人数据。

### 我们不做什么

- 不提供 Persimmon 自有账号；
- 不运营广告或第一方行为分析服务，也不进行跨 App 跟踪；
- 不出售个人信息，也不把阅读内容用于广告、画像或训练模型。

### 本机数据

你选择导入的 EPUB、由 EPUB 生成的章节与图片资源、封面、阅读进度、阅读设置，以及你下载或导入的字体，默认只保存在设备的 App 私有目录中。Persimmon 只会读取你通过系统文件选择器明确选择的文件；本机处理的数据不会由此自动发送给开发者。

App 语言和部分书架显示偏好保存在本机。清空本机阅读数据时会保留 App 语言选择，避免界面在操作中突然切换。

### 可选的 Google Drive 同步

只有在你主动连接 Google Drive 后，Persimmon 才会申请
`https://www.googleapis.com/auth/drive.appdata`。该权限仅能访问 Google
Drive 为 Persimmon 提供的隐藏
`appDataFolder`，不能读取或修改你在普通 Drive 中看到的文件。

同步内容包括原始 EPUB、书籍元数据、稳定阅读位置、显示进度、删除状态、随机生成的 App 专属设备标识，以及同步所需的 Google 账户标识。App 会请求账户标识，并在 Google 返回时使用邮箱和显示名称来确认当前连接账户。随机设备标识不是广告标识符或硬件序列号。

同步数据通过 Google API 直接写入你自己的 Google
Drive 隐藏目录，不经过也不存储在 Persimmon 开发者控制的服务器中。开发者不会接收、托管、查看或将你的书籍与阅读记录用于其他目的。

Google 及其 SDK 可能按 Google 政策处理授权信息、账户和设备标识、网络元数据及 SDK 使用数据。Google
iOS
SDK 的隐私声明还列出姓名、邮箱、电话号码、粗略位置、用户或设备标识及其他使用数据，可能用于 App 功能或 SDK 分析；Persimmon 自身不会请求设备位置、通讯录、麦克风、照片库或广告标识符。Persimmon 对从 Google
API 获得的用户数据的使用遵守
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)，包括 Limited
Use 要求，并且仅用于用户主动启用的同步功能。

断开连接会撤销或清理本机授权，但不会自动删除已上传内容；请使用“清空 Google
Drive 数据”执行云端删除。

### 网络请求与反馈

Google Drive 同步会连接 Google
API。下载可选字体时会连接字体目录中固定的 GitHub 下载地址；这些服务可能按各自政策处理 IP 地址、请求时间和常规网络日志。

Google 授权状态和访问令牌由 Google
SDK 与平台安全机制管理，不会发送到 Persimmon 开发者控制的服务器。

“发送反馈”会打开邮件编辑器或系统分享面板，并预填版本与设备信息。Persimmon 不会自动发送内容；如果你把邮件发送至
`support@persimmon.cc`，开发者会收到你主动提供的发件地址、正文和附件，并仅用于处理支持请求。你可以通过同一邮箱要求删除支持记录。

### 保留与删除

- 删除单本书：删除本机书籍资源；连接同步时，删除状态会同步到其他设备；
- 断开连接：撤销或清理本机 Google 授权，但不删除 Drive 中已有的同步数据；
- 清空本机数据：删除本机书库、进度、阅读设置和已安装字体，并断开 Drive；云端副本保留；
- 清空 Google
  Drive 数据：删除 Persimmon 隐藏目录中的 EPUB 与同步记录，并断开 Drive；本机副本保留；
- 卸载 App：由操作系统删除本机 App 数据；Google
  Drive 隐藏目录中的副本需要在卸载前通过 App 清除。

如需反馈隐私问题，请在设置中选择“发送反馈”。政策发生实质变化时，更新后的版本会随 App 发布并修改本页日期。

## English

Persimmon is a local-first EPUB reader. Unless you enable Google Drive sync or
send a support request, the Persimmon developer does not receive personal data
from the app.

### What we do not do

- Persimmon does not provide its own user account.
- Persimmon operates no advertising or first-party behavioral analytics service
  and does not track users across apps.
- We do not sell personal information or use reading content for advertising,
  profiling, or model training.

### Data on your device

EPUB files you choose, generated sections and image resources, covers, reading
progress, reading settings, and fonts you download or import remain in the app's
private storage by default. Persimmon reads only files you explicitly select
through the system file picker. On-device processing does not by itself send
that data to the developer.

The app language and some library display preferences are stored locally.
Clearing local reading data keeps the app-language choice so the interface does
not switch during the operation.

### Optional Google Drive sync

Persimmon requests `https://www.googleapis.com/auth/drive.appdata` only after
you choose to connect Google Drive. It can access only Persimmon's hidden
`appDataFolder` and cannot read or modify files visible in your regular Drive.

Synced data includes original EPUB files, book metadata, stable reading
locations, display progress, deletion records, a random app-specific device
identifier, and the Google account identifier needed for sync. The app requests
an account identifier and, when Google returns them, uses the email address and
display name to identify the connected account. The random identifier is not an
advertising identifier or hardware serial number.

Sync data travels directly through Google APIs to your own hidden Google Drive
folder without passing through or residing on a server controlled by the
Persimmon developer. The developer does not receive, host, inspect, or repurpose
your books or reading records.

Google and its SDKs may process authorization information, account and device
identifiers, network metadata, and SDK usage data under Google's policies. The
Google iOS SDK privacy declaration also lists name, email address, phone number,
coarse location, user or device identifiers, and other usage data for app
functionality or SDK analytics. Persimmon itself does not request device
location, contacts, microphone, photo library, or advertising identifier access.
Persimmon's use of data received from Google APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements, and is limited to the sync feature you
enable.

Disconnecting clears or revokes local authorization but does not delete uploaded
data; use “Clear Google Drive Data” for cloud deletion.

### Network requests and feedback

Drive sync connects to Google APIs. Optional font downloads connect to fixed
GitHub download URLs in the font catalog. Those providers may process IP
addresses, request times, and ordinary network logs under their own policies.

Google's SDK and platform security facilities manage authorization state and
access tokens without sending them to a Persimmon-controlled server.

Send Feedback opens an email composer or the system share sheet with app and
device details prefilled. Persimmon sends nothing automatically. If you email
`support@persimmon.cc`, the developer receives the sender address, message, and
attachments you choose to provide and uses them only to handle the support
request. You may use the same address to request deletion of support records.

### Retention and deletion

- Delete one book: removes its local resources; while sync is connected, the
  deletion record propagates to other devices.
- Disconnect: clears or revokes local Google authorization without deleting
  existing Drive data.
- Clear Local Data: removes the local library, progress, reading settings, and
  installed fonts, then disconnects Drive; cloud copies remain.
- Clear Google Drive Data: removes EPUB and sync records from Persimmon's hidden
  Drive folder, then disconnects Drive; local copies remain.
- Uninstall: the operating system removes local app data. Clear the hidden Drive
  data in the app before uninstalling if you also want the cloud copy removed.

Use Send Feedback in Settings for privacy questions. Material changes will be
shipped with an updated app and reflected by the date on this page.
