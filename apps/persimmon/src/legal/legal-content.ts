export interface LegalSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly items?: readonly string[];
}

export interface LegalDocument {
  readonly title: string;
  readonly updatedAt?: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

export const PRIVACY_POLICY_URL = "https://persimmon.cc/privacy";

const privacyZhHans: LegalDocument = {
  title: "隐私政策",
  updatedAt: "更新日期：2026 年 8 月 12 日",
  intro:
    "Persimmon（柿子阅读）是一款本地优先的 EPUB 阅读器。除非你主动启用 Google Drive 同步或发送支持邮件，Persimmon 开发者不会从 App 接收你的个人数据。完整且最新的政策以 persimmon.cc/privacy 为准。",
  sections: [
    {
      heading: "我们不做什么",
      items: [
        "不提供 Persimmon 自有账号。",
        "不运营广告或第一方行为分析服务，也不进行跨 App 跟踪。",
        "不出售个人信息，也不把阅读内容用于广告、画像或训练模型。",
      ],
    },
    {
      heading: "本机数据",
      paragraphs: [
        "你选择导入的 EPUB、由 EPUB 生成的章节与图片资源、封面、阅读进度、阅读设置，以及你下载或导入的字体，都会保存在设备的 App 私有目录中。Persimmon 只会读取你通过系统文件选择器明确选择的文件。",
        "这些数据默认只在本机处理，不会由此自动发送给 Persimmon 开发者。App 语言和部分书架显示偏好也保存在本机。",
      ],
    },
    {
      heading: "可选的 Google Drive 同步",
      paragraphs: [
        "只有在你主动连接 Google Drive 后，Persimmon 才会申请 drive.appdata 权限。该权限仅能访问 Google Drive 为 Persimmon 提供的隐藏 appDataFolder，不能读取或修改你在普通 Drive 中看到的文件。",
        "同步内容包括原始 EPUB、书籍元数据、稳定阅读位置、显示进度、删除状态、随机生成的 App 专属设备标识，以及同步所需的 Google 账户标识。App 会请求账户标识，并在 Google 返回时使用邮箱和显示名称来确认当前连接账户。",
        "同步数据通过 Google API 直接写入你自己的 Google Drive 隐藏目录，不经过也不存储在 Persimmon 开发者控制的服务器中。开发者不会接收、托管、查看或将你的书籍与阅读记录用于其他目的。",
        "Google 及其 SDK 可能按 Google 政策处理授权信息、账户和设备标识、网络元数据及 SDK 使用数据。Persimmon 对从 Google API 获得的用户数据的使用遵守 Google API Services User Data Policy，包括 Limited Use 要求，并且仅用于用户主动启用的同步功能。",
      ],
    },
    {
      heading: "网络请求与反馈",
      paragraphs: [
        "Google Drive 同步会连接 Google API。下载可选字体时会连接该字体目录中固定的 GitHub 下载地址；这些服务可能按各自政策处理 IP 地址、请求时间和常规网络日志。",
        "Google 授权状态和访问令牌由 Google SDK 与平台安全机制管理，不会发送到 Persimmon 开发者控制的服务器。",
        "“发送反馈”会打开邮件编辑器或系统分享面板，并预填版本与设备信息。Persimmon 不会自动发送内容；如果你把邮件发送至支持邮箱，开发者会收到你主动提供的发件地址、正文和附件，并仅用于处理支持请求。",
      ],
    },
    {
      heading: "保留与删除",
      items: [
        "删除单本书：删除本机书籍资源；连接同步时，删除状态会同步到其他设备。",
        "断开连接：撤销或清理本机 Google 授权，但不删除 Drive 中已有的同步数据。",
        "清空本机数据：删除本机书库、进度、阅读设置和已安装字体，并断开 Drive；云端副本保留。",
        "清空 Google Drive 数据：删除 Persimmon 隐藏目录中的 EPUB 与同步记录，并断开 Drive；本机副本保留。",
        "卸载 App：由操作系统删除本机 App 数据；Google Drive 隐藏目录中的副本需要在卸载前通过 App 清除。",
      ],
    },
    {
      heading: "联系与变更",
      paragraphs: [
        "如需反馈隐私问题，请在设置中选择“发送反馈”。政策发生实质变化时，更新后的版本会随 App 发布并修改本页日期。",
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: "Privacy Policy",
  updatedAt: "Last updated: August 12, 2026",
  intro:
    "Persimmon is a local-first EPUB reader. Unless you enable Google Drive sync or send a support request, the Persimmon developer does not receive personal data from the app. The complete and current policy is available at persimmon.cc/privacy.",
  sections: [
    {
      heading: "What we do not do",
      items: [
        "Persimmon does not provide its own user account.",
        "Persimmon operates no advertising or first-party behavioral analytics service and does not track users across apps.",
        "We do not sell personal information or use reading content for advertising, profiling, or model training.",
      ],
    },
    {
      heading: "Data on your device",
      paragraphs: [
        "EPUB files you choose, generated sections and image resources, covers, reading progress, reading settings, and fonts you download or import are stored in the app's private storage. Persimmon reads only files you explicitly select through the system file picker.",
        "This data is processed on device by default and is not automatically sent to the Persimmon developer. The app language and some library display preferences are also stored locally.",
      ],
    },
    {
      heading: "Optional Google Drive sync",
      paragraphs: [
        "Persimmon requests the drive.appdata scope only after you choose to connect Google Drive. It can access only Persimmon's hidden appDataFolder and cannot read or modify files visible in your regular Drive.",
        "Synced data includes original EPUB files, book metadata, stable reading locations, display progress, deletion records, a random app-specific device identifier, and the Google account identifier needed for sync. The app requests an account identifier and, when Google returns them, uses the email address and display name to identify the connected account.",
        "Sync data travels directly through Google APIs to your own hidden Google Drive folder without passing through or residing on a server controlled by the Persimmon developer. The developer does not receive, host, inspect, or repurpose your books or reading records.",
        "Google and its SDKs may process authorization information, account and device identifiers, network metadata, and SDK usage data under Google's policies. Persimmon's use of data received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements, and is limited to the sync feature you enable.",
      ],
    },
    {
      heading: "Network requests and feedback",
      paragraphs: [
        "Drive sync connects to Google APIs. Optional font downloads connect to fixed GitHub download URLs in the font catalog. Those providers may process IP addresses, request times, and ordinary network logs under their own policies.",
        "Google's SDK and platform security facilities manage authorization state and access tokens without sending them to a Persimmon-controlled server.",
        "Send Feedback opens an email composer or the system share sheet with app and device details prefilled. Persimmon sends nothing automatically. If you email the support address, the developer receives the sender address, message, and attachments you choose to provide and uses them only to handle the support request.",
      ],
    },
    {
      heading: "Retention and deletion",
      items: [
        "Delete one book: removes its local resources; while sync is connected, the deletion record propagates to other devices.",
        "Disconnect: clears or revokes local Google authorization without deleting existing Drive data.",
        "Clear Local Data: removes the local library, progress, reading settings, and installed fonts, then disconnects Drive; cloud copies remain.",
        "Clear Google Drive Data: removes EPUB and sync records from Persimmon's hidden Drive folder, then disconnects Drive; local copies remain.",
        "Uninstall: the operating system removes local app data. Clear the hidden Drive data in the app before uninstalling if you also want the cloud copy removed.",
      ],
    },
    {
      heading: "Contact and changes",
      paragraphs: [
        "Use Send Feedback in Settings for privacy questions. Material changes will be shipped with an updated app and reflected by the date on this page.",
      ],
    },
  ],
};

const licensesZhHans: LegalDocument = {
  title: "开放源代码许可",
  intro:
    "Persimmon 使用开源软件与字体。下列项目保留各自作者的版权，具体许可文本和随包版权声明优先于本页摘要。",
  sections: [
    {
      heading: "MIT 许可组件",
      items: [
        "React、React Native、Expo 及 Expo 模块",
        "React Native Skia、Gesture Handler、Reanimated、Screens、Safe Area Context 与 AsyncStorage",
        "i18next、react-i18next、Google Sign-In for React Native",
        "fflate、parse5 与 @xmldom/xmldom",
      ],
      paragraphs: [
        "MIT License 允许使用、复制、修改、合并、发布、分发、再许可及销售软件副本，但必须保留原版权声明与许可声明。软件按原样提供，不附带任何明示或默示担保。",
      ],
    },
    {
      heading: "Skia 与平台组件",
      paragraphs: [
        "React Native Skia 的 JavaScript 与桥接代码采用 MIT License；其底层 Skia 及相关第三方组件保留 BSD 或各自许可。Google Play services 与 Google API 客户端还受 Google 的适用条款约束。",
        "Apache License 2.0：https://www.apache.org/licenses/LICENSE-2.0\nBSD 3-Clause：https://opensource.org/license/bsd-3-clause",
      ],
    },
    {
      heading: "字体",
      items: [
        "Noto Serif SC、Noto Sans SC、Noto Sans Math：SIL Open Font License 1.1",
        "霞鹜文楷屏幕阅读版：SIL Open Font License 1.1",
        "Literata：SIL Open Font License 1.1",
        "Noto Sans Mono CJK SC：SIL Open Font License 1.1",
      ],
      paragraphs: ["SIL Open Font License 1.1：https://openfontlicense.org"],
    },
    {
      heading: "完整清单",
      paragraphs: [
        "仓库中的 docs/open-source-notices.md 记录直接运行时依赖、字体来源和发布前生成完整传递依赖清单的命令。",
      ],
    },
  ],
};

const licensesEn: LegalDocument = {
  title: "Open-Source Licenses",
  intro:
    "Persimmon uses open-source software and fonts. Their authors retain copyright, and the license text and notices distributed with each package control over this summary.",
  sections: [
    {
      heading: "MIT-licensed components",
      items: [
        "React, React Native, Expo, and Expo modules",
        "React Native Skia, Gesture Handler, Reanimated, Screens, Safe Area Context, and AsyncStorage",
        "i18next, react-i18next, and Google Sign-In for React Native",
        "fflate, parse5, and @xmldom/xmldom",
      ],
      paragraphs: [
        "The MIT License permits use, copying, modification, merging, publication, distribution, sublicensing, and sale, provided that the original copyright and permission notices are retained. The software is provided as-is without warranty.",
      ],
    },
    {
      heading: "Skia and platform components",
      paragraphs: [
        "React Native Skia's JavaScript and bridge code use the MIT License. The underlying Skia project and related third-party components retain BSD or their respective licenses. Google Play services and Google API clients are also subject to applicable Google terms.",
        "Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0\nBSD 3-Clause: https://opensource.org/license/bsd-3-clause",
      ],
    },
    {
      heading: "Fonts",
      items: [
        "Noto Serif SC, Noto Sans SC, and Noto Sans Math: SIL Open Font License 1.1",
        "LXGW WenKai Screen: SIL Open Font License 1.1",
        "Literata: SIL Open Font License 1.1",
        "Noto Sans Mono CJK SC: SIL Open Font License 1.1",
      ],
      paragraphs: ["SIL Open Font License 1.1: https://openfontlicense.org"],
    },
    {
      heading: "Complete inventory",
      paragraphs: [
        "docs/open-source-notices.md records direct runtime dependencies, font sources, and the command used to generate a complete transitive inventory before release.",
      ],
    },
  ],
};

function isChinese(language: string | undefined): boolean {
  return language?.toLowerCase().startsWith("zh") ?? false;
}

export function privacyDocument(language?: string): LegalDocument {
  return isChinese(language) ? privacyZhHans : privacyEn;
}

export function licensesDocument(language?: string): LegalDocument {
  return isChinese(language) ? licensesZhHans : licensesEn;
}
