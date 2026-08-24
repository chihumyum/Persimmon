import type { zhHans } from "./zh-Hans";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const en = {
  common: {
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    done: "Done",
    download: "Download",
    new: "New",
    processing: "Working…",
    search: "Search",
    settings: "Settings",
    unknownAuthor: "Unknown author",
  },
  accessibility: {
    decrease: "Decrease {{label}}",
    increase: "Increase {{label}}",
  },
  appearance: {
    section: "Appearance",
    colorMode: "Color mode",
    colorModeGroup: "App color mode",
    readerColorModeGroup: "Reader color mode",
    theme: "Paper theme",
    libraryThemeGroup: "Library paper theme",
    readerThemeGroup: "Reader paper theme",
    colorModes: {
      system: "Automatic",
      systemAccessibility: "Automatic color mode",
      light: "Light",
      lightAccessibility: "Light mode",
      dark: "Dark",
      darkAccessibility: "Dark mode",
    },
    themes: {
      warm: "Warm paper",
      warmDescription: "Soft ivory",
      warmAccessibility: "Warm paper theme",
      cool: "Cool paper",
      coolDescription: "Clear blue-gray",
      coolAccessibility: "Cool paper theme",
    },
  },
  language: {
    label: "App language",
    groupAccessibility: "Persimmon interface language",
    options: {
      system: "System",
      systemAccessibility: "Follow the system language",
      zhHans: "简体中文",
      zhHansAccessibility: "Use Simplified Chinese",
      zhHant: "繁體中文",
      zhHantAccessibility: "Use Traditional Chinese",
      english: "English",
      englishAccessibility: "Use English",
      japanese: "日本語",
      japaneseAccessibility: "Use Japanese",
      korean: "한국어",
      koreanAccessibility: "Use Korean",
      spanish: "Español",
      spanishAccessibility: "Use Spanish",
      french: "Français",
      frenchAccessibility: "Use French",
      german: "Deutsch",
      germanAccessibility: "Use German",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "Use Brazilian Portuguese",
    },
    systemDescription:
      "Uses the device language and refreshes when the app returns to the foreground.",
    overrideDescription: "Overrides the interface language for Persimmon only.",
  },
  library: {
    title: "All Books",
    filters: {
      all: "All",
      reading: "Reading",
      unread: "Unread",
      finished: "Finished",
    },
    sort: {
      default: "Sort",
      recent: "Recently Read",
      added: "Date Added",
      title: "Title",
      currentAccessibility: "Sort, currently {{label}}",
      closeAccessibility: "Close sort options",
      heading: "Sort By",
    },
    actions: {
      searchAccessibility: "Search titles or authors",
      openSettingsAccessibility: "Open settings",
      importAccessibility: "Import one or more EPUB files",
      importLabel: "Import EPUB files",
      closeError: "Close",
      syncNow: "Sync Now",
      downloadFromCloud: "Download from Cloud",
    },
    empty: {
      title: "No books here yet",
      body: "Choose another category or import an EPUB.",
    },
    error: {
      title: "Something Went Wrong",
    },
    importBanner: {
      accessibility: "Book import progress",
      complete: "Import Complete",
      importing: "Importing Books",
      importingBook: "Importing book {{current}} of {{total}} · {{title}}",
      processing: "Processed {{completed}} of {{total}} books…",
      result: "Imported {{imported}} books",
      resultWithFailures: "Imported {{imported}} · {{failed}} failed",
    },
    search: {
      placeholder: "Search titles or authors",
      clearAccessibility: "Clear search",
      emptyTitle: "No matching books",
      emptyBody: "Search checks titles and authors only.",
      openAccessibility: "Open {{title}}",
    },
    card: {
      coverAccessibility: "Cover of {{title}}",
      openAccessibility: "Open {{title}}",
      longPressHint: "Touch and hold for book actions",
      moreAccessibility: "More actions for {{title}}",
      needsDownload: "Download needed",
      finished: "Read",
      unread: "Unread",
      new: "NEW",
    },
    details: {
      closeAccessibility: "Close book details",
      title: "Book Details",
      progress: "Reading Progress",
      notStarted: "Not started",
      localStatus: "On This Device",
      downloaded: "Downloaded",
      needsDownload: "Needs to be downloaded again",
      file: "File",
      legacyImport: "Legacy import",
      size: "Size",
      builtIn: "Built-in content",
      added: "Added to Library",
      continueReading: "Continue Reading",
      exportEpub: "Export EPUB",
      deleteEverywhere: "Delete from Library and Cloud",
    },
    settings: {
      closeAccessibility: "Close settings",
      showMetadata: "Show titles and authors",
      showMetadataDescription:
        "When off, only covers, reading progress, and action buttons are shown",
      showMetadataAccessibility: "Show titles and authors",
    },
    nativeMenu: {
      details: "Details",
      delete: "Delete",
    },
  },
  sync: {
    banner: {
      complete: "Sync Complete",
      setup: "Set Up Cloud Sync",
      syncing: "Google Drive Sync",
      openSettingsAccessibility: "Open cloud sync settings",
      syncingAccessibility: "Google Drive is syncing",
      progressAccessibility: "Google Drive book sync progress",
      closeAccessibility: "Close Google Drive notice",
    },
    description: {
      loading: "Loading sync status…",
      disconnected:
        "Connect to automatically upload and download EPUB files and sync reading progress using stable text positions.",
      authorizing: "Waiting for Google authorization…",
      syncingAccount: "Syncing your library with {{accountEmail}}…",
      syncing: "Syncing your library and reading progress…",
      syncingBook: "Syncing book {{current}} of {{total}} · {{title}}",
      syncingBooks: "Syncing book {{current}} of {{total}}…",
      finalizingBooks: "{{completed}} of {{total}} books synced · Finishing…",
      idle: "{{account}} · Synced at {{time}}",
    },
    actions: {
      connect: "Connect Google Drive",
      reconnect: "Reconnect",
      syncNow: "Sync Now",
      disconnect: "Disconnect",
    },
    errors: {
      unconfiguredIos:
        "The Google Drive iOS OAuth client ID is not configured.",
      unconfiguredAndroid:
        "The Google Drive Android OAuth client ID is not configured.",
      unsupportedPlatform:
        "Google Drive sync is not supported on this platform.",
      authorizationRequired:
        "Google Drive authorization expired. Reconnect to continue.",
      authorizationCancelled: "Google Drive authorization was cancelled.",
      authorizationFailed:
        "Google Drive authorization could not be completed. Try again.",
      connectFirst: "Connect Google Drive first.",
      network:
        "Could not connect to Google Drive. Check your network and try again.",
      failed: "Google Drive sync failed. Try again later.",
    },
  },
  settings: {
    data: {
      section: "Data Management",
      sectionDescription:
        "Local and cloud data are cleared separately to prevent accidental deletion or an immediate sync restore.",
      clearLocalTitle: "Clear Local Data",
      clearLocalDescription:
        "Removes the local library, progress, reading settings, and installed fonts. Drive is disconnected; cloud copies and the app-language choice remain.",
      clearLocalConfirmation:
        "This permanently removes every book, reading progress, reading setting, and installed font on this device, then disconnects Google Drive. Cloud copies are not deleted. This cannot be undone.",
      clearLocalAction: "Clear Local",
      clearLocalCompleteTitle: "Local Data Cleared",
      clearLocalCompleteMessage:
        "Local reading data was removed and Google Drive was disconnected. Cloud copies remain.",
      clearLocalFailedTitle: "Could Not Clear Local Data",
      clearLocalFailedMessage:
        "Some data may remain. Restart the app and try again.",
      clearCloudTitle: "Clear Google Drive Data",
      clearCloudDescription:
        "Removes EPUB and sync records from Persimmon's hidden folder. Drive is disconnected; local copies remain.",
      clearCloudDisconnectedDescription:
        "Connect Google Drive to remove every cloud copy in Persimmon's hidden folder.",
      clearCloudConfirmation:
        "This permanently removes every EPUB, reading-progress record, and device-sync record in Persimmon's hidden folder for the current Google Drive account, then disconnects. Local copies are not deleted. This cannot be undone.",
      clearCloudAction: "Clear Cloud",
      clearCloudCompleteTitle: "Cloud Data Cleared",
      clearCloudCompleteMessage:
        "Persimmon's hidden Google Drive data was removed and the account was disconnected. Local copies remain.",
      clearCloudFailedTitle: "Cloud Data Was Not Fully Cleared",
      clearCloudFailedMessage:
        "Google Drive was disconnected to prevent remaining data from being uploaded again. Check the network, reconnect, and retry.",
    },
    about: {
      section: "About",
      privacy: "Privacy Policy",
      feedback: "Send Feedback",
      feedbackDescription:
        "Uses the system share sheet and includes app and device details",
      feedbackEmailDescription: "Opens an email draft addressed to {{email}}",
      feedbackSubject: "Persimmon {{version}} Feedback",
      feedbackTemplate:
        "Persimmon Feedback\n\nDescribe the issue or suggestion:\n\n\nApp version: {{version}}\nPlatform: {{platform}}",
      feedbackFailedTitle: "Could Not Open Share Sheet",
      feedbackFailedMessage:
        "Try again later or check that the device has an available share destination.",
      licenses: "Open-Source Licenses",
      version: "Version",
      copyright: "© 2026 Persimmon. All rights reserved.",
    },
    sourceCode: {
      label: "Visit Repository",
      description: "Fork the project, report issues, or contribute code",
      accessibility: "Open the Persimmon source code on GitHub",
      failedTitle: "Could Not Open Source Code",
      failedMessage:
        "Try again later or visit github.com/chihumyum/Persimmon in your browser.",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "Return to library",
      library: "Library",
      tocAccessibility: "Open table of contents",
      toc: "Contents",
      settingsAccessibility: "Open reading settings",
      settings: "Settings",
      tuningAccessibility: "Adjust page-turn constants",
      tuning: "Curve",
      breadcrumbAccessibility: "Table of contents path: {{label}}",
    },
    toc: {
      closeAccessibility: "Close table of contents",
      title: "Contents",
      jumpAccessibility: "Go to {{label}}",
    },
    layout: {
      spreadToggle: "Two-Page Layout",
    },
    animation: {
      natural: "Natural Page Turn",
    },
    rapidPageTurn: {
      title: "Edge Swipe to Riffle",
    },
    settings: {
      groupAccessibility: "Reading settings categories",
      closeAccessibility: "Close reading settings",
      closeTypographyAccessibility: "Save typography and close adjustment",
      typographyTab: "Style",
      readingTab: "Reading",
      progress: "Reading Progress",
      progressFooter: "Footer",
      progressHeader: "Header",
      progressBoth: "Both",
      progressHidden: "Hidden",
      fontPickerTitle: "Choose Font",
      backToSettingsAccessibility: "Return to style settings",
      adjustTypography: "Adjust Typography",
      typographyPreviewTitle: "Typography Preview",
      resetTypography: "Reset",
      resetReading: "Reset",
      resetReadingAccessibility: "Restore default reading settings",
      progressValueAccessibility:
        "Reading progress position, currently {{value}}",
      textAlignment: "Text Alignment",
      textAlignmentBook: "Follow Book",
      textAlignmentStart: "Start",
      textAlignmentJustify: "Justified",
      textAlignmentEnd: "End",
      textAlignmentValueAccessibility: "Text alignment, currently {{value}}",
    },
    fonts: {
      section: "Font",
      unavailable:
        "This font is missing on this device. The book is temporarily using Noto Serif SC; your font setting is preserved.",
      chooseAccessibility: "Choose font, currently {{font}}",
      fallback: "fallback font",
      fallbackName: "Noto Serif SC (fallback)",
      bundled: "Built in",
      downloaded: "Downloaded",
      imported: "Imported",
      fontAccessibility: "{{font}} font",
      deleteAccessibility: "Delete {{font}} font",
      downloadAccessibility: "Download {{font}} font",
      available: "Available",
      importAccessibility: "Import a font from a local file",
      importAction: "Import local TTF / OTF",
      useBookFonts: "Use embedded book fonts",
      useBookFontsDescription:
        "Only where the EPUB explicitly specifies a font",
      noBookFonts: "This book has no usable embedded fonts",
      fontSize: "Font Size",
      lineHeight: "Line Height",
      paragraphSpacing: "Paragraph Gap",
      horizontalMargin: "Side Margins",
      deleteTitle: "Delete Font",
      deleteConfirmation: "Delete “{{font}}”?",
    },
    tuning: {
      closeAccessibility: "Close page-turn curve settings",
      title: "Page-Turn Curve Tuning",
      clickMode: "Tap",
      gestureMode: "Gesture",
      forwardMode: "Forward",
      backwardMode: "Backward",
      reverseReleaseX: "Reverse curl landing · releaseX",
      reverseCurvatureRelaxation:
        "Reverse curvature decay · curvatureRelaxation",
      incomingLandingStartProgress: "Initial curl · landingStart",
      incomingRevealStartProgress: "Paper back appears · revealStart",
      incomingRevealEndProgress: "Paper back fully visible · revealEnd",
      incomingDragProgressScale: "Hand tracking strength · dragScale",
      incomingDragProgressExponent: "Hand response curve · dragExponent",
      incomingSettleDurationSeconds: "Release settle duration · settleDuration",
      incomingSettleEasingPower: "Settle easing strength · settleEasing",
      incomingRevertDurationSeconds: "Cancel return duration · revertDuration",
      clickReleaseX: "Raised start · releaseX",
      clickLiftVelocity: "Lift velocity · liftVelocity",
      clickLiftToLeft: "Horizontal spread · liftToLeft",
      releaseX: "Reverse landing start · releaseX",
      liftVelocity: "Upward release velocity · liftVelocity",
      liftToLeft: "Horizontal release spread · liftToLeft",
      curvatureRelaxation: "Curvature decay · curvatureRelaxation",
      pageWeight: "Page weight · pageWeight",
      commitThreshold: "Commit threshold · commitThreshold",
      minimumSpeedScale: "Minimum settle speed · minimumSpeedScale",
      maximumSpeedScale: "Maximum settle speed · maximumSpeedScale",
      velocityGain: "Flick velocity gain · velocityGain",
      idleDecaySeconds: "Release decay seconds · idleDecaySeconds",
      playbackSpeed: "Playback speed · playbackSpeed",
      propagationSpeed: "Propagation speed {{value}}",
      reverseHint: "Incoming-page and paper-back controls",
      resetAccessibility: "Restore defaults for the selected mode",
      reset: "Reset Current",
    },
    loading: {
      preparingTypography: "Preparing typography…",
    },
    accessibility: {
      previousPage: "Previous page",
      nextPage: "Next page",
      toggleTools: "Toggle reading tools",
      selectionStart: "Drag the start of the text selection",
      selectionEnd: "Drag the end of the text selection",
      header: "Header: {{title}}",
      publicationPercentage: "Book progress {{percentage}}",
      publicationPage: "Book page {{page}}",
      noteKindEndnote: "endnote",
      noteKindFootnote: "footnote",
      noteKindAnnotation: "note",
      openNote: "Open {{noteKind}} {{label}}",
      returnToText: "Return to text {{label}}",
      jumpTo: "Go to {{label}}",
      noteHint: "Opens the note and provides a button to return to the text",
      returnToReference: "Return to the {{noteKind}} reference {{label}}",
      returnToTextButton: "↩ Return to Text",
      dismissReturnButton:
        "Dismiss the return-to-{{noteKind}}-reference button",
    },
  },
  errors: {
    unknown: "An unknown error occurred.",
    languagePreferenceSaveFailed:
      "The app language could not be saved. The previous language is still active.",
    epub: {
      fixedLayout:
        "Fixed-layout EPUB files are not supported yet; this version focuses on reflowable books.",
      archiveLimit: "This book exceeds the safe import limits.",
      unsafePath: "The EPUB contains an unsafe path and was not imported.",
      unreadable: "Could not read this EPUB: {{message}}",
    },
    library: {
      bookNotFound: "This book does not exist or has been deleted.",
      needsReimport:
        "This book needs to be imported again from its original EPUB.",
      corruptStorage:
        "This book's data is incomplete. Delete it and import it again.",
      storageFull:
        "There is not enough available space to save this book safely.",
      loadFailed: "Could not load the local library: {{message}}",
      progressSaveFailed:
        "Reading progress could not be saved. Persimmon will retry automatically.",
      settingsSaveFailed: "Reading settings could not be saved.",
      exportUnavailable: "This device cannot open the file export sheet.",
      exportFailed: "The EPUB could not be exported. Try again.",
      cloudRepairUnavailable:
        "The cloud does not have an EPUB that can repair this book. Import the original file again.",
      deleteTitle: "Delete Book",
      deleteConfirmation: "Delete “{{title}}” and its local resources?",
    },
    fonts: {
      notFound: "This font could not be found.",
      invalid: "The font file is invalid or unsupported.",
      integrity:
        "The font file failed verification. Download or import it again.",
      storageFull:
        "There is not enough available space to save this font safely.",
      loadFailed: "Could not load local fonts: {{message}}",
      importFailed: "The font could not be imported.",
      downloadFailed: "The font could not be downloaded.",
      deleteFailed: "The font could not be deleted.",
      downloadTimeout:
        "The font download timed out. Check your network and try again.",
      downloadNetwork:
        "The font download failed. Check your network and try again.",
      downloadHttp: "The font download failed (HTTP {{status}}).",
      downloadTooLarge: "The font download is larger than the catalog entry.",
      catalogMissing:
        "The font catalog has no downloadable file for this font.",
      catalogNotFound: "This font is not in the downloadable font catalog.",
      missingFallback:
        "The font file is missing. The built-in serif font is being used.",
      readFallback:
        "The font file could not be read. The built-in serif font is being used.",
      loadFallback:
        "The font could not be loaded. The built-in serif font is being used.",
      fileTooLarge: "Font files cannot be larger than {{maximumMb}} MB.",
    },
    import: {
      withImported: "Imported {{importedCount}} books; {{count}} failed:",
      withImported_one: "Imported {{importedCount}} books; {{count}} failed:",
      withImported_other: "Imported {{importedCount}} books; {{count}} failed:",
      failed: "{{count}} books failed to import:",
      failed_one: "{{count}} book failed to import:",
      failed_other: "{{count}} books failed to import:",
      detail: "{{fileName}}: {{message}}",
      syncRecordFailed:
        "“{{fileName}}” was imported, but its sync record could not be saved: {{message}}",
    },
  },
} as const satisfies TranslationSchema<typeof zhHans>;
