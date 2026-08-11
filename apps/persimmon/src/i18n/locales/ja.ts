import type { en } from "./en";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const ja = {
  common: {
    cancel: "キャンセル",
    close: "閉じる",
    delete: "削除",
    done: "完了",
    download: "ダウンロード",
    new: "新規",
    processing: "処理中…",
    search: "検索",
    settings: "設定",
    unknownAuthor: "不明な著者",
  },
  accessibility: {
    decrease: "{{label}}を減らす",
    increase: "{{label}}を増やす",
  },
  appearance: {
    section: "外観",
    colorMode: "カラーモード",
    colorModeGroup: "アプリのカラーモード",
    readerColorModeGroup: "リーダーのカラーモード",
    theme: "紙のテーマ",
    libraryThemeGroup: "ライブラリの紙テーマ",
    readerThemeGroup: "リーダーの紙テーマ",
    colorModes: {
      system: "自動",
      systemAccessibility: "自動カラーモード",
      light: "ライト",
      lightAccessibility: "ライトモード",
      dark: "ダーク",
      darkAccessibility: "ダークモード",
    },
    themes: {
      warm: "暖色の紙",
      warmDescription: "柔らかい象牙色",
      warmAccessibility: "暖かい紙のテーマ",
      cool: "クールな紙",
      coolDescription: "クリアブルーグレー",
      coolAccessibility: "クールな紙のテーマ",
    },
  },
  language: {
    label: "アプリ言語",
    groupAccessibility: "Persimmon の表示言語",
    options: {
      system: "システム",
      systemAccessibility: "システム言語に合わせる",
      zhHans: "简体中文",
      zhHansAccessibility: "簡体字中国語を使用",
      zhHant: "繁體中文",
      zhHantAccessibility: "繁体字中国語を使用",
      english: "English",
      englishAccessibility: "英語を使用する",
      japanese: "日本語",
      japaneseAccessibility: "日本語を使用する",
      korean: "한국어",
      koreanAccessibility: "韓国語を使用する",
      spanish: "Español",
      spanishAccessibility: "スペイン語を使用する",
      french: "Français",
      frenchAccessibility: "フランス語を使用する",
      german: "Deutsch",
      germanAccessibility: "ドイツ語を使用する",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "ブラジルポルトガル語を使用する",
    },
    systemDescription:
      "端末の言語を使用し、アプリがフォアグラウンドに戻るたびに更新します。",
    overrideDescription: "Persimmon の表示言語のみを変更します。",
  },
  library: {
    title: "すべての本",
    filters: {
      all: "すべて",
      reading: "読書中",
      unread: "未読",
      finished: "読了",
    },
    sort: {
      default: "並べ替え",
      recent: "最近読んだ順",
      added: "追加日",
      title: "タイトル",
      currentAccessibility: "並べ替え、現在は{{label}}",
      closeAccessibility: "並び替えオプションを閉じる",
      heading: "並び替え",
    },
    actions: {
      searchAccessibility: "タイトルまたは著者を検索",
      openSettingsAccessibility: "設定を開く",
      importAccessibility: "EPUBファイルを1つ以上インポートする",
      importLabel: "EPUBファイルをインポートする",
      closeError: "閉じる",
      syncNow: "今すぐ同期する",
      downloadFromCloud: "クラウドからダウンロードする",
    },
    empty: {
      title: "まだ本はありません",
      body: "別のカテゴリを選択するか、EPUBをインポートしてください。",
    },
    error: {
      title: "問題が発生しました",
    },
    importBanner: {
      accessibility: "書籍のインポート進捗",
      complete: "インポート完了",
      importing: "書籍をインポート中",
      importingBook:
        "{{total}} 冊中 {{current}} 冊目をインポート中 · {{title}}",
      processing: "{{total}} 冊中 {{completed}} 冊を処理済み…",
      result: "{{imported}} 冊をインポートしました",
      resultWithFailures: "{{imported}} 冊をインポート · {{failed}} 冊失敗",
    },
    search: {
      placeholder: "タイトルまたは著者を検索",
      clearAccessibility: "検索をクリアする",
      emptyTitle: "一致する本はありません",
      emptyBody: "検索はタイトルと著者のみを検索します。",
      openAccessibility: "{{title}}を開く",
    },
    card: {
      coverAccessibility: "{{title}}のカバー",
      openAccessibility: "{{title}}を開く",
      longPressHint: "長押しすると本の操作を表示します",
      moreAccessibility: "{{title}}に関するその他のアクション",
      needsDownload: "ダウンロードが必要です",
      finished: "読了",
      unread: "未読",
      new: "新着",
    },
    details: {
      closeAccessibility: "本の詳細を閉じる",
      title: "本の詳細",
      progress: "読書の進捗",
      notStarted: "未開始",
      localStatus: "このデバイス上",
      downloaded: "ダウンロード済み",
      needsDownload: "もう一度ダウンロードする必要があります",
      file: "ファイル",
      legacyImport: "レガシーインポート",
      size: "サイズ",
      builtIn: "組み込みコンテンツ",
      added: "ライブラリに追加されました",
      continueReading: "読み続ける",
      deleteEverywhere: "ライブラリとクラウドから削除する",
    },
    settings: {
      closeAccessibility: "設定を閉じる",
      showMetadata: "タイトルと著者を表示する",
      showMetadataDescription:
        "オフの場合は、表紙、読書の進捗、操作ボタンのみが表示されます。",
      showMetadataAccessibility: "タイトルと著者を表示する",
    },
    nativeMenu: {
      details: "詳細",
      delete: "削除",
    },
  },
  sync: {
    banner: {
      complete: "同期完了",
      setup: "クラウド同期を設定する",
      syncing: "Google Drive の同期",
      openSettingsAccessibility: "クラウド同期設定を開く",
      syncingAccessibility: "Google Driveが同期中です",
      progressAccessibility: "Google Drive の書籍同期の進捗",
      closeAccessibility: "Google Drive通知を閉じる",
    },
    description: {
      loading: "同期の状態を読み込み中…",
      disconnected:
        "接続すると EPUB ファイルを自動でアップロード・ダウンロードし、安定したテキスト位置で読書の進捗を同期します。",
      authorizing: "Google の認証を待機中…",
      syncingAccount: "ライブラリを {{accountEmail}} と同期中…",
      syncing: "ライブラリと読書の進捗を同期中…",
      syncingBook: "{{total}}冊中{{current}}冊目を同期中 · {{title}}",
      syncingBooks: "{{total}}冊中{{current}}冊目を同期中…",
      finalizingBooks: "{{total}}冊中{{completed}}冊を同期済み · 完了処理中…",
      idle: "{{account}} · {{time}} に同期済み",
    },
    actions: {
      connect: "Google Driveに接続する",
      reconnect: "再接続する",
      syncNow: "今すぐ同期する",
      disconnect: "接続を解除する",
    },
    errors: {
      unconfiguredIos:
        "Google Drive iOS OAuth クライアント ID が構成されていません。",
      unconfiguredAndroid:
        "Google Drive Android OAuth クライアント ID が構成されていません。",
      unsupportedPlatform:
        "Google Drive同期は、このプラットフォームではサポートされていません。",
      authorizationRequired:
        "Google Drive認証が期限切れになりました。再接続して続行してください。",
      authorizationCancelled: "Google Driveの認証がキャンセルされました。",
      authorizationFailed:
        "Google Drive認証が完了できませんでした。もう一度お試しください。",
      connectFirst: "まずGoogle Driveに接続してください。",
      network:
        "Google Driveに接続できませんでした。ネットワークを確認し、もう一度お試しください。",
      failed: "Google Drive 同期に失敗しました。後でもう一度お試しください。",
    },
  },
  settings: {
    data: {
      section: "データ管理",
      sectionDescription:
        "ローカルとクラウドのデータは個別に消去されます。誤削除や、同期による即時の復元を防ぐためです。",
      clearLocalTitle: "ローカルデータをクリアする",
      clearLocalDescription:
        "ローカルのライブラリ、読書の進捗、読書設定、インストール済みフォントを削除します。Drive の接続は解除されますが、クラウド上のコピーとアプリ言語の選択は保持されます。",
      clearLocalConfirmation:
        "このデバイス上のすべての書籍、読書の進捗、読書設定、インストール済みフォントを完全に削除し、Google Drive の接続を解除します。クラウド上のコピーは削除されません。この操作は元に戻せません。",
      clearLocalAction: "ローカルを消去",
      clearLocalCompleteTitle: "ローカルデータを消去しました",
      clearLocalCompleteMessage:
        "ローカルの読書データを削除し、Google Drive の接続を解除しました。クラウド上のコピーは保持されています。",
      clearLocalFailedTitle: "ローカルデータを消去できませんでした",
      clearLocalFailedMessage:
        "一部のデータが残っている場合があります。アプリを再起動してもう一度お試しください。",
      clearCloudTitle: "Google Driveデータをクリアする",
      clearCloudDescription:
        "Persimmon の隠しフォルダから EPUB と同期記録を削除します。Drive の接続は解除されますが、ローカルのコピーは保持されます。",
      clearCloudDisconnectedDescription:
        "Persimmon の隠しフォルダにあるすべてのクラウド上のコピーを削除するには、Google Drive に接続してください。",
      clearCloudConfirmation:
        "現在の Google Drive アカウントの Persimmon 隠しフォルダから、すべての EPUB、読書の進捗記録、デバイス同期記録を完全に削除して接続を解除します。ローカルのコピーは削除されません。この操作は元に戻せません。",
      clearCloudAction: "クラウドを消去する",
      clearCloudCompleteTitle: "クラウドデータを消去しました",
      clearCloudCompleteMessage:
        "Persimmon の Google Drive 隠しデータを削除し、アカウントの接続を解除しました。ローカルのコピーは保持されています。",
      clearCloudFailedTitle: "クラウドデータを完全に消去できませんでした",
      clearCloudFailedMessage:
        "残っているデータが再度アップロードされないよう、Google Drive の接続を解除しました。ネットワークを確認し、再接続して再試行してください。",
    },
    about: {
      section: "このアプリについて",
      privacy: "プライバシーポリシー",
      feedback: "フィードバックを送信する",
      feedbackDescription:
        "システムの共有シートを使用し、アプリとデバイスの詳細を含めます。",
      feedbackEmailDescription: "{{email}}宛てのメール草案を開きます。",
      feedbackSubject: "Persimmon {{version}} フィードバック",
      feedbackTemplate:
        "Persimmonフィードバック\n\n問題または提案を説明してください：\n\n\nアプリバージョン：{{version}}\nプラットフォーム：{{platform}}",
      feedbackFailedTitle: "共有シートを開けませんでした",
      feedbackFailedMessage:
        "後でもう一度お試しください。または、デバイスが使用可能な共有先があることを確認してください。",
      licenses: "オープンソースライセンス",
      version: "バージョン",
      copyright: "© 2026 Persimmon. All rights reserved.",
    },
    developer: {
      label: "開発者について",
      websiteAccessibility: "Qihang Yang のウェブサイト chihum.dev を開く",
      websiteFailedTitle: "開発者ウェブサイトを開けませんでした",
      websiteFailedMessage:
        "後でもう一度お試しいただくか、ブラウザで chihum.dev を開いてください。",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "ライブラリに戻る",
      library: "ライブラリ",
      tocAccessibility: "目次を開く",
      toc: "目次",
      settingsAccessibility: "読書設定を開く",
      settings: "設定",
      tuningAccessibility: "ページめくりの定数を調整する",
      tuning: "カーブ",
      breadcrumbAccessibility: "目次パス：{{label}}",
    },
    toc: {
      closeAccessibility: "目次を閉じる",
      title: "目次",
      jumpAccessibility: "{{label}}へ移動",
    },
    layout: {
      spreadToggle: "2ページレイアウト",
    },
    animation: {
      natural: "自然なページめくり",
    },
    rapidPageTurn: {
      title: "端からのスワイプで高速ページめくり",
    },
    settings: {
      groupAccessibility: "読書設定のカテゴリ",
      closeAccessibility: "読書設定を閉じる",
      closeTypographyAccessibility: "文字組みを保存して調整画面を閉じる",
      typographyTab: "スタイル",
      readingTab: "読書",
      progress: "読書の進捗",
      progressFooter: "フッター",
      progressHeader: "ヘッダー",
      progressBoth: "両方",
      progressHidden: "非表示",
      fontPickerTitle: "フォントを選択する",
      backToSettingsAccessibility: "スタイル設定に戻る",
      adjustTypography: "タイポグラフィを調整する",
      typographyPreviewTitle: "タイポグラフィプレビュー",
      resetTypography: "リセット",
      resetReading: "リセット",
      resetReadingAccessibility: "デフォルトの読書設定を復元する",
      progressValueAccessibility: "読書の進捗位置、現在{{value}}",
      textAlignment: "本文の配置",
      textAlignmentBook: "書籍に従う",
      textAlignmentStart: "行頭揃え",
      textAlignmentJustify: "両端揃え",
      textAlignmentEnd: "行末揃え",
      textAlignmentValueAccessibility: "本文の配置、現在は{{value}}です",
    },
    fonts: {
      section: "フォント",
      unavailable:
        "このデバイスにはこのフォントがありません。書籍では一時的に Noto Serif SC を使用しますが、フォント設定は保持されます。",
      chooseAccessibility: "フォントを選択。現在は {{font}}",
      fallback: "代替フォント",
      fallbackName: "Noto Serif SC（フォールバック）",
      bundled: "内蔵",
      downloaded: "ダウンロード済み",
      imported: "インポート済み",
      fontAccessibility: "{{font}}フォント",
      deleteAccessibility: "{{font}}フォントを削除する",
      downloadAccessibility: "{{font}}フォントをダウンロードする",
      available: "利用可能",
      importAccessibility: "ローカルファイルからフォントをインポートする",
      importAction: "ローカルTTF / OTFをインポートする",
      useBookFonts: "書籍に埋め込まれたフォントを使用する",
      useBookFontsDescription: "EPUBがフォントを明示的に指定している場合のみ",
      noBookFonts: "この本には使用可能な埋め込みフォントがありません",
      fontSize: "フォントサイズ",
      lineHeight: "行間",
      paragraphSpacing: "段落間隔",
      horizontalMargin: "左右余白",
      deleteTitle: "フォントを削除",
      deleteConfirmation: "「{{font}}」を削除しますか？",
    },
    tuning: {
      closeAccessibility: "ページめくりカーブ設定を閉じる",
      title: "ページめくりカーブ調整",
      clickMode: "タップ",
      gestureMode: "ジェスチャー",
      forwardMode: "次へ",
      backwardMode: "前へ",
      reverseReleaseX: "逆方向の着地点 · releaseX",
      reverseCurvatureRelaxation: "逆方向の曲率減衰 · curvatureRelaxation",
      incomingLandingStartProgress: "初期カール · landingStart",
      incomingRevealStartProgress: "紙の裏が現れる · revealStart",
      incomingRevealEndProgress: "紙の裏が完全表示 · revealEnd",
      incomingDragProgressScale: "追従強度 · dragScale",
      incomingDragProgressExponent: "追従カーブ · dragExponent",
      incomingSettleDurationSeconds: "着地時間 · settleDuration",
      incomingSettleEasingPower: "着地イージング · settleEasing",
      incomingRevertDurationSeconds: "キャンセル復帰時間 · revertDuration",
      clickReleaseX: "持ち上がり開始 · releaseX",
      clickLiftVelocity: "持ち上がり速度 · liftVelocity",
      clickLiftToLeft: "水平方向の広がり · liftToLeft",
      releaseX: "逆向きの着地点開始 · releaseX",
      liftVelocity: "上向きに離したときの速度 · liftVelocity",
      liftToLeft: "横方向に離したときの広がり · liftToLeft",
      curvatureRelaxation: "曲率の減衰 · curvatureRelaxation",
      pageWeight: "ページ重量 · pageWeight",
      commitThreshold: "コミットしきい値 · commitThreshold",
      minimumSpeedScale: "最小収束速度 · minimumSpeedScale",
      maximumSpeedScale: "最大収束速度 · maximumSpeedScale",
      velocityGain: "フリック速度増幅 · velocityGain",
      idleDecaySeconds: "離した後の減衰秒数 · idleDecaySeconds",
      playbackSpeed: "再生速度 · playbackSpeed",
      propagationSpeed: "伝播速度 {{value}}",
      reverseHint: "逆方向の来頁と紙裏パラメータ",
      resetAccessibility: "選択中のモードを既定値に戻す",
      reset: "現在のモードをリセット",
    },
    loading: {
      preparingTypography: "タイポグラフィの準備中…",
    },
    accessibility: {
      previousPage: "前のページ",
      nextPage: "次のページ",
      toggleTools: "読書ツールの表示を切り替える",
      selectionStart: "テキスト選択範囲の開始位置をドラッグする",
      selectionEnd: "テキスト選択範囲の終了位置をドラッグする",
      header: "ヘッダー：{{title}}",
      publicationPercentage: "読書進捗 {{percentage}}",
      publicationPage: "本のページ {{page}}",
      noteKindEndnote: "後注",
      noteKindFootnote: "脚注",
      noteKindAnnotation: "注釈",
      openNote: "{{noteKind}} {{label}}を開く",
      returnToText: "本文の {{label}} に戻る",
      jumpTo: "{{label}}へ移動",
      noteHint: "注を開き、本文に戻るためのボタンを表示します。",
      returnToReference: "{{noteKind}}の参照 {{label}} に戻る",
      returnToTextButton: "↩ 本文に戻る",
      dismissReturnButton: "{{noteKind}}の参照に戻るボタンを閉じる",
    },
  },
  errors: {
    unknown: "不明なエラーが発生しました。",
    languagePreferenceSaveFailed:
      "アプリの言語を保存できませんでした。前の言語はまだ有効です。",
    epub: {
      fixedLayout:
        "固定レイアウト EPUB にはまだ対応していません。このバージョンはリフロー型の書籍に対応しています。",
      archiveLimit: "この本は安全なインポート上限を超えています。",
      unsafePath:
        "EPUB に安全でないパスが含まれているため、インポートされませんでした。",
      unreadable: "このEPUBを読み込めませんでした: {{message}}",
    },
    library: {
      bookNotFound: "この本は存在しないか、削除されています。",
      needsReimport:
        "この本は元のEPUBからもう一度インポートする必要があります。",
      corruptStorage:
        "この本のデータが不完全です。それを削除して、もう一度インポートしてください。",
      storageFull: "この本を安全に保存するには十分な空きスペースがありません。",
      loadFailed: "ローカルライブラリを読み込めませんでした：{{message}}",
      progressSaveFailed:
        "読書の進捗を保存できませんでした。Persimmonが自動的に再試行します。",
      settingsSaveFailed: "読書設定を保存できませんでした。",
      cloudRepairUnavailable:
        "クラウドには、この本を修復できるEPUBがありません。元のファイルをもう一度インポートしてください。",
      deleteTitle: "本を削除する",
      deleteConfirmation: "「{{title}}」とそのローカルリソースを削除しますか？",
    },
    fonts: {
      notFound: "このフォントが見つかりませんでした。",
      invalid: "フォントファイルが無効またはサポートされていません。",
      integrity:
        "フォントファイルが検証に失敗しました。再度ダウンロードまたはインポートしてください。",
      storageFull:
        "このフォントを安全に保存するには十分な空きスペースがありません。",
      loadFailed: "ローカルフォントを読み込めませんでした：{{message}}",
      importFailed: "フォントをインポートできませんでした。",
      downloadFailed: "フォントをダウンロードできませんでした。",
      deleteFailed: "フォントを削除できませんでした。",
      downloadTimeout:
        "フォントのダウンロードにタイムアウトが発生しました。ネットワークを確認してからもう一度お試しください。",
      downloadNetwork:
        "フォントのダウンロードに失敗しました。ネットワークを確認してからもう一度お試しください。",
      downloadHttp: "フォントのダウンロードに失敗しました（HTTP {{status}}）。",
      downloadTooLarge:
        "フォントのダウンロードサイズがカタログエントリよりも大きい。",
      catalogMissing:
        "フォントカタログには、このフォントのダウンロード可能なファイルはありません。",
      catalogNotFound:
        "このフォントはダウンロード可能なフォントカタログにはありません。",
      missingFallback:
        "フォントファイルがありません。内蔵のセリフフォントが使用されています。",
      readFallback:
        "フォントファイルを読み込めませんでした。内蔵のセリフフォントが使用されています。",
      loadFallback:
        "フォントを読み込めませんでした。内蔵のセリフフォントが使用されています。",
      fileTooLarge:
        "フォントファイルは{{maximumMb}} MBを超えることはできません。",
    },
    import: {
      withImported:
        "{{importedCount}} 書籍がインポートされました。{{count}} が失敗しました。",
      withImported_one:
        "{{importedCount}} 書籍がインポートされました。{{count}} が失敗しました。",
      withImported_other:
        "{{importedCount}} 書籍がインポートされました。{{count}} が失敗しました。",
      failed: "{{count}} 冊の書籍をインポートできませんでした：",
      failed_one: "{{count}} 冊の書籍をインポートできませんでした：",
      failed_other: "{{count}} 冊の書籍をインポートできませんでした：",
      detail: "{{fileName}}: {{message}}",
      syncRecordFailed:
        "「{{fileName}}」がインポートされましたが、同期レコードを保存できませんでした：{{message}}",
    },
  },
} as const satisfies TranslationSchema<typeof en>;
