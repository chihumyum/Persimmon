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

const privacyZhHans: LegalDocument = {
  title: "隐私政策",
  updatedAt: "更新日期：2026 年 8 月 3 日",
  intro:
    "Persimmon（柿子阅读）是一款本地优先的 EPUB 阅读器。本政策说明 App 会处理哪些数据，以及你如何删除这些数据。",
  sections: [
    {
      heading: "我们不做什么",
      items: [
        "不提供 Persimmon 自有账号。",
        "不集成广告、行为分析、跨 App 跟踪或第三方营销 SDK。",
        "不出售个人信息，也不把阅读内容用于广告画像。",
      ],
    },
    {
      heading: "本机数据",
      paragraphs: [
        "你选择导入的 EPUB、由 EPUB 生成的章节与图片资源、封面、阅读进度、阅读设置，以及你下载或导入的字体，都会保存在设备的 App 私有目录中。Persimmon 只会读取你通过系统文件选择器明确选择的文件。",
        "App 语言和部分书架显示偏好保存在本机。清空本机阅读数据时会保留 App 语言选择，避免界面在操作中突然切换。",
      ],
    },
    {
      heading: "可选的 Google Drive 同步",
      paragraphs: [
        "只有在你主动连接 Google Drive 后，Persimmon 才会申请 drive.appdata 权限。该权限仅能访问 Google Drive 为 Persimmon 提供的隐藏 appDataFolder，不能读取或修改你在普通 Drive 中看到的文件。",
        "同步内容包括原始 EPUB、书籍元数据、稳定阅读位置、显示进度、删除状态、随机生成的设备标识，以及同步所需的账户标识。Google SDK 还会向 App 提供账户显示名称或邮箱，用于显示当前连接账户。",
        "Google SDK 负责维护授权状态和访问令牌。断开连接会撤销或清理本机授权，但不会自动删除已上传内容；请使用“清空 Google Drive 数据”执行云端删除。",
      ],
    },
    {
      heading: "网络请求与反馈",
      paragraphs: [
        "Google Drive 同步会连接 Google API。下载可选字体时会连接该字体目录中固定的 GitHub 下载地址；这些服务可能按各自政策处理 IP 地址、请求时间和常规网络日志。",
        "“发送反馈”会打开邮件编辑器或系统分享面板，并预填版本与设备信息。Persimmon 不会自动发送内容；只有你选择目标 App 并确认后，内容才会交给该服务。",
      ],
    },
    {
      heading: "保留与删除",
      items: [
        "删除单本书：删除本机书籍资源；连接同步时，删除状态会同步到其他设备。",
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
  updatedAt: "Last updated: August 3, 2026",
  intro:
    "Persimmon is a local-first EPUB reader. This policy explains what the app processes and how you can delete that data.",
  sections: [
    {
      heading: "What we do not do",
      items: [
        "Persimmon does not provide its own user account.",
        "The app contains no advertising, behavioral analytics, cross-app tracking, or marketing SDKs.",
        "We do not sell personal information or use reading content for advertising profiles.",
      ],
    },
    {
      heading: "Data on your device",
      paragraphs: [
        "EPUB files you choose, generated sections and image resources, covers, reading progress, reading settings, and fonts you download or import are stored in the app's private storage. Persimmon reads only files you explicitly select through the system file picker.",
        "The app language and some library display preferences are stored locally. Clearing local reading data keeps the app-language choice so the interface does not switch during the operation.",
      ],
    },
    {
      heading: "Optional Google Drive sync",
      paragraphs: [
        "Persimmon requests the drive.appdata scope only after you choose to connect Google Drive. It can access only Persimmon's hidden appDataFolder and cannot read or modify files visible in your regular Drive.",
        "Synced data includes original EPUB files, book metadata, stable reading locations, display progress, deletion records, a random device identifier, and the account identifier needed for sync. Google may also provide an account display name or email so the app can show which account is connected.",
        "Google's SDK maintains authorization state and access tokens. Disconnecting clears or revokes local authorization but does not delete uploaded data; use “Clear Google Drive Data” for cloud deletion.",
      ],
    },
    {
      heading: "Network requests and feedback",
      paragraphs: [
        "Drive sync connects to Google APIs. Optional font downloads connect to fixed GitHub download URLs in the font catalog. Those providers may process IP addresses, request times, and ordinary network logs under their own policies.",
        "Send Feedback opens an email composer or the system share sheet with app and device details prefilled. Persimmon sends nothing automatically; data reaches another service only after you choose it and confirm.",
      ],
    },
    {
      heading: "Retention and deletion",
      items: [
        "Delete one book: removes its local resources; while sync is connected, the deletion record propagates to other devices.",
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
