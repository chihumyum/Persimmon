import type { en } from "./en";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const de = {
  common: {
    cancel: "Abbrechen",
    close: "Schließen",
    delete: "Löschen",
    done: "Fertig",
    download: "Herunterladen",
    new: "Neu",
    processing: "Wird verarbeitet…",
    search: "Suchen",
    settings: "Einstellungen",
    unknownAuthor: "Unbekannter Autor",
  },
  accessibility: {
    decrease: "{{label}} verringern",
    increase: "{{label}} erhöhen",
  },
  appearance: {
    section: "Erscheinungsbild",
    colorMode: "Farbmodus",
    colorModeGroup: "Farbmodus der App",
    readerColorModeGroup: "Farbmodus des Lesers",
    theme: "Papierthema",
    libraryThemeGroup: "Papierthema der Bibliothek",
    readerThemeGroup: "Papierthema des Lesers",
    colorModes: {
      system: "Automatisch",
      systemAccessibility: "Automatischer Farbmodus",
      light: "Hell",
      lightAccessibility: "Heller Modus",
      dark: "Dunkel",
      darkAccessibility: "Dunkler Modus",
    },
    themes: {
      warm: "Warmes Papier",
      warmDescription: "Sanftes Elfenbein",
      warmAccessibility: "Thema für warmes Papier",
      cool: "Kühles Papier",
      coolDescription: "Klares Blaugrau",
      coolAccessibility: "Thema für kühles Papier",
    },
  },
  language: {
    label: "App-Sprache",
    groupAccessibility: "Sprache der Persimmon-Oberfläche",
    options: {
      system: "System",
      systemAccessibility: "Der Systemsprache folgen",
      zhHans: "简体中文",
      zhHansAccessibility: "Vereinfachtes Chinesisch verwenden",
      zhHant: "繁體中文",
      zhHantAccessibility: "Traditionelles Chinesisch verwenden",
      english: "English",
      englishAccessibility: "Englisch verwenden",
      japanese: "日本語",
      japaneseAccessibility: "Japanisch verwenden",
      korean: "한국어",
      koreanAccessibility: "Koreanisch verwenden",
      spanish: "Español",
      spanishAccessibility: "Spanisch verwenden",
      french: "Français",
      frenchAccessibility: "Französisch verwenden",
      german: "Deutsch",
      germanAccessibility: "Deutsch verwenden",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "Brasilianisches Portugiesisch verwenden",
    },
    systemDescription:
      "Verwendet die Gerätesprache und wird aktualisiert, wenn die App wieder in den Vordergrund kommt.",
    overrideDescription:
      "Überschreibt die Sprache der Oberfläche nur für Persimmon.",
  },
  library: {
    title: "Alle Bücher",
    filters: {
      all: "Alle",
      reading: "Lesend",
      unread: "Ungelesen",
      finished: "Fertig",
    },
    sort: {
      default: "Sortieren",
      recent: "Zuletzt gelesen",
      added: "Hinzugefügt am",
      title: "Titel",
      currentAccessibility: "Sortieren, aktuell {{label}}",
      closeAccessibility: "Sortieroptionen schließen",
      heading: "Sortieren nach",
    },
    actions: {
      searchAccessibility: "Titel oder Autoren suchen",
      openSettingsAccessibility: "Einstellungen öffnen",
      importAccessibility: "Eine oder mehrere EPUB-Dateien importieren",
      importLabel: "EPUB-Dateien importieren",
      closeError: "Schließen",
      syncNow: "Jetzt synchronisieren",
      downloadFromCloud: "Aus der Cloud herunterladen",
    },
    empty: {
      title: "Hier sind noch keine Bücher",
      body: "Wähle eine andere Kategorie oder importiere ein EPUB.",
    },
    error: { title: "Etwas ist schiefgelaufen" },
    importBanner: {
      accessibility: "Fortschritt des Buchimports",
      complete: "Import abgeschlossen",
      importing: "Bücher werden importiert",
      importingBook:
        "Buch {{current}} von {{total}} wird importiert · {{title}}",
      processing: "{{completed}} von {{total}} Büchern verarbeitet…",
      result: "{{imported}} Bücher importiert",
      resultWithFailures: "{{imported}} importiert · {{failed}} fehlgeschlagen",
    },
    search: {
      placeholder: "Titel oder Autoren suchen",
      clearAccessibility: "Suche löschen",
      emptyTitle: "Keine passenden Bücher",
      emptyBody: "Die Suche berücksichtigt nur Titel und Autoren.",
      openAccessibility: "{{title}} öffnen",
    },
    card: {
      coverAccessibility: "Cover von {{title}}",
      openAccessibility: "{{title}} öffnen",
      longPressHint: "Für Buchaktionen gedrückt halten",
      moreAccessibility: "Weitere Aktionen für {{title}}",
      needsDownload: "Download erforderlich",
      finished: "Gelesen",
      unread: "Ungelesen",
      new: "NEU",
    },
    details: {
      closeAccessibility: "Buchdetails schließen",
      title: "Buchdetails",
      progress: "Lesefortschritt",
      notStarted: "Nicht begonnen",
      localStatus: "Auf diesem Gerät",
      downloaded: "Heruntergeladen",
      needsDownload: "Muss erneut heruntergeladen werden",
      file: "Datei",
      legacyImport: "Älterer Import",
      size: "Größe",
      builtIn: "Integrierter Inhalt",
      added: "Zur Bibliothek hinzugefügt",
      continueReading: "Weiterlesen",
      exportEpub: "EPUB exportieren",
      deleteEverywhere: "Aus Bibliothek und Cloud löschen",
    },
    settings: {
      closeAccessibility: "Einstellungen schließen",
      showMetadata: "Titel und Autoren anzeigen",
      showMetadataDescription:
        "Wenn deaktiviert, werden nur Cover, Lesefortschritt und Aktionsschaltflächen angezeigt",
      showMetadataAccessibility: "Titel und Autoren anzeigen",
    },
    nativeMenu: { details: "Details", delete: "Löschen" },
  },
  sync: {
    banner: {
      complete: "Synchronisierung abgeschlossen",
      setup: "Cloud-Synchronisierung einrichten",
      syncing: "Google-Drive-Synchronisierung",
      openSettingsAccessibility:
        "Einstellungen für Cloud-Synchronisierung öffnen",
      syncingAccessibility: "Google Drive wird synchronisiert",
      progressAccessibility:
        "Fortschritt der Google-Drive-Buchsynchronisierung",
      closeAccessibility: "Google-Drive-Hinweis schließen",
    },
    description: {
      loading: "Synchronisierungsstatus wird geladen…",
      disconnected:
        "Verbinde dich, um EPUB-Dateien automatisch hoch- und herunterzuladen und den Lesefortschritt über stabile Textpositionen zu synchronisieren.",
      authorizing: "Warte auf Google-Autorisierung…",
      syncingAccount:
        "Deine Bibliothek wird mit {{accountEmail}} synchronisiert…",
      syncing:
        "Deine Bibliothek und dein Lesefortschritt werden synchronisiert…",
      syncingBook:
        "Buch {{current}} von {{total}} wird synchronisiert · {{title}}",
      syncingBooks: "Buch {{current}} von {{total}} wird synchronisiert…",
      finalizingBooks:
        "{{completed}} von {{total}} Büchern synchronisiert · Wird abgeschlossen…",
      idle: "{{account}} · Synchronisiert um {{time}}",
    },
    actions: {
      connect: "Google Drive verbinden",
      reconnect: "Erneut verbinden",
      syncNow: "Jetzt synchronisieren",
      disconnect: "Trennen",
    },
    errors: {
      unconfiguredIos:
        "Die OAuth-Client-ID von Google Drive für iOS ist nicht konfiguriert.",
      unconfiguredAndroid:
        "Die OAuth-Client-ID von Google Drive für Android ist nicht konfiguriert.",
      unsupportedPlatform:
        "Google-Drive-Synchronisierung wird auf dieser Plattform nicht unterstützt.",
      authorizationRequired:
        "Die Google-Drive-Autorisierung ist abgelaufen. Verbinde dich erneut, um fortzufahren.",
      authorizationCancelled:
        "Die Google-Drive-Autorisierung wurde abgebrochen.",
      authorizationFailed:
        "Die Google-Drive-Autorisierung konnte nicht abgeschlossen werden. Versuche es erneut.",
      connectFirst: "Verbinde zuerst Google Drive.",
      network:
        "Google Drive konnte nicht erreicht werden. Prüfe dein Netzwerk und versuche es erneut.",
      failed:
        "Die Google-Drive-Synchronisierung ist fehlgeschlagen. Versuche es später erneut.",
    },
  },
  settings: {
    data: {
      section: "Datenverwaltung",
      sectionDescription:
        "Lokale Daten und Cloud-Daten werden getrennt gelöscht, um versehentliches Löschen oder eine sofortige Wiederherstellung durch Synchronisierung zu verhindern.",
      clearLocalTitle: "Lokale Daten löschen",
      clearLocalDescription:
        "Entfernt die lokale Bibliothek, Fortschritte, Leseeinstellungen und installierte Schriftarten. Drive wird getrennt; Cloud-Kopien und die gewählte App-Sprache bleiben erhalten.",
      clearLocalConfirmation:
        "Dadurch werden alle Bücher, Lesefortschritte, Leseeinstellungen und installierten Schriftarten auf diesem Gerät dauerhaft gelöscht und Google Drive wird getrennt. Cloud-Kopien werden nicht gelöscht. Dies kann nicht rückgängig gemacht werden.",
      clearLocalAction: "Lokale Daten löschen",
      clearLocalCompleteTitle: "Lokale Daten gelöscht",
      clearLocalCompleteMessage:
        "Lokale Lesedaten wurden entfernt und Google Drive wurde getrennt. Cloud-Kopien bleiben erhalten.",
      clearLocalFailedTitle: "Lokale Daten konnten nicht gelöscht werden",
      clearLocalFailedMessage:
        "Einige Daten können erhalten geblieben sein. Starte die App neu und versuche es erneut.",
      clearCloudTitle: "Google-Drive-Daten löschen",
      clearCloudDescription:
        "Entfernt EPUBs und Synchronisierungsdaten aus Persimmons verborgenem Ordner. Drive wird getrennt; lokale Kopien bleiben erhalten.",
      clearCloudDisconnectedDescription:
        "Verbinde Google Drive, um jede Cloud-Kopie in Persimmons verborgenem Ordner zu entfernen.",
      clearCloudConfirmation:
        "Dadurch werden jedes EPUB, jeder Lesefortschrittsdatensatz und jeder Gerätesynchronisierungsdatensatz in Persimmons verborgenem Ordner für das aktuelle Google-Drive-Konto dauerhaft gelöscht und das Konto wird getrennt. Lokale Kopien werden nicht gelöscht. Dies kann nicht rückgängig gemacht werden.",
      clearCloudAction: "Cloud löschen",
      clearCloudCompleteTitle: "Cloud-Daten gelöscht",
      clearCloudCompleteMessage:
        "Persimmons verborgene Google-Drive-Daten wurden entfernt und das Konto wurde getrennt. Lokale Kopien bleiben erhalten.",
      clearCloudFailedTitle: "Cloud-Daten wurden nicht vollständig gelöscht",
      clearCloudFailedMessage:
        "Google Drive wurde getrennt, damit verbleibende Daten nicht erneut hochgeladen werden. Prüfe das Netzwerk, verbinde dich erneut und versuche es wieder.",
    },
    about: {
      section: "Über",
      privacy: "Datenschutzrichtlinie",
      feedback: "Feedback senden",
      feedbackDescription:
        "Verwendet das Systemfreigabeblatt und enthält Angaben zur App und zum Gerät",
      feedbackEmailDescription: "Öffnet einen E-Mail-Entwurf an {{email}}",
      feedbackSubject: "Feedback zu Persimmon {{version}}",
      feedbackTemplate:
        "Persimmon-Feedback\n\nBeschreibe das Problem oder den Vorschlag:\n\n\nApp-Version: {{version}}\nPlattform: {{platform}}",
      feedbackFailedTitle: "Freigabeblatt konnte nicht geöffnet werden",
      feedbackFailedMessage:
        "Versuche es später erneut oder prüfe, ob auf dem Gerät ein Freigabeziel verfügbar ist.",
      licenses: "Open-Source-Lizenzen",
      version: "Version",
      copyright: "© 2026 Persimmon. Alle Rechte vorbehalten.",
    },
    sourceCode: {
      label: "Repository besuchen",
      description: "Forke das Projekt, melde Probleme oder trage Code bei",
      accessibility: "Persimmon-Quellcode auf GitHub öffnen",
      failedTitle: "Quellcode konnte nicht geöffnet werden",
      failedMessage:
        "Versuche es später erneut oder besuche github.com/chihumyum/Persimmon in deinem Browser.",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "Zur Bibliothek zurückkehren",
      library: "Bibliothek",
      tocAccessibility: "Inhaltsverzeichnis öffnen",
      toc: "Inhalt",
      settingsAccessibility: "Leseeinstellungen öffnen",
      settings: "Einstellungen",
      tuningAccessibility: "Konstanten für den Seitenwechsel anpassen",
      tuning: "Kurve",
      breadcrumbAccessibility: "Pfad im Inhaltsverzeichnis: {{label}}",
    },
    toc: {
      closeAccessibility: "Inhaltsverzeichnis schließen",
      title: "Inhalt",
      jumpAccessibility: "Zu {{label}} gehen",
    },
    layout: { spreadToggle: "Zweiseitiges Layout" },
    animation: { natural: "Natürlicher Seitenwechsel" },
    rapidPageTurn: { title: "Am Rand wischen zum Blättern" },
    settings: {
      groupAccessibility: "Kategorien der Leseeinstellungen",
      closeAccessibility: "Leseeinstellungen schließen",
      closeTypographyAccessibility:
        "Typografie speichern und Anpassung schließen",
      typographyTab: "Stil",
      readingTab: "Lesen",
      progress: "Lesefortschritt",
      progressFooter: "Fußzeile",
      progressHeader: "Kopfzeile",
      progressBoth: "Beide",
      progressHidden: "Ausgeblendet",
      fontPickerTitle: "Schriftart auswählen",
      backToSettingsAccessibility: "Zu den Stileinstellungen zurückkehren",
      adjustTypography: "Typografie anpassen",
      typographyPreviewTitle: "Typografievorschau",
      resetTypography: "Zurücksetzen",
      resetReading: "Zurücksetzen",
      resetReadingAccessibility: "Standard-Leseeinstellungen wiederherstellen",
      progressValueAccessibility: "Lesefortschrittsposition, derzeit {{value}}",
      textAlignment: "Textausrichtung",
      textAlignmentBook: "Wie im Buch",
      textAlignmentStart: "Am Anfang",
      textAlignmentJustify: "Blocksatz",
      textAlignmentEnd: "Am Ende",
      textAlignmentValueAccessibility: "Textausrichtung, derzeit {{value}}",
    },
    fonts: {
      section: "Schriftart",
      unavailable:
        "Diese Schriftart fehlt auf diesem Gerät. Das Buch verwendet vorübergehend Noto Serif SC; deine Schrifteinstellung bleibt erhalten.",
      chooseAccessibility: "Schriftart auswählen, derzeit {{font}}",
      fallback: "Ersatzschriftart",
      fallbackName: "Noto Serif SC (Ersatz)",
      bundled: "Integriert",
      downloaded: "Heruntergeladen",
      imported: "Importiert",
      fontAccessibility: "Schriftart {{font}}",
      deleteAccessibility: "Schriftart {{font}} löschen",
      downloadAccessibility: "Schriftart {{font}} herunterladen",
      available: "Verfügbar",
      importAccessibility:
        "Eine Schriftart aus einer lokalen Datei importieren",
      importAction: "Lokale TTF-/OTF-Datei importieren",
      useBookFonts: "Eingebettete Buchschriftarten verwenden",
      useBookFontsDescription:
        "Nur wenn das EPUB ausdrücklich eine Schriftart angibt",
      noBookFonts: "Dieses Buch hat keine nutzbaren eingebetteten Schriftarten",
      fontSize: "Schriftgröße",
      lineHeight: "Zeilenhöhe",
      paragraphSpacing: "Absatzabstand",
      horizontalMargin: "Seitenränder",
      deleteTitle: "Schriftart löschen",
      deleteConfirmation: "„{{font}}“ löschen?",
    },
    tuning: {
      closeAccessibility: "Einstellungen für die Seitenwechselkurve schließen",
      title: "Kurvenabstimmung für den Seitenwechsel",
      clickMode: "Tippen",
      gestureMode: "Geste",
      forwardMode: "Vorwärts",
      backwardMode: "Rückwärts",
      reverseReleaseX: "Rückwärts-Landepunkt · releaseX",
      reverseCurvatureRelaxation: "Rückwärts-Krümmung · curvatureRelaxation",
      incomingLandingStartProgress: "Anfangskrümmung · landingStart",
      incomingRevealStartProgress: "Papierrückseite erscheint · revealStart",
      incomingRevealEndProgress: "Papierrückseite sichtbar · revealEnd",
      incomingDragProgressScale: "Handführung · dragScale",
      incomingDragProgressExponent: "Reaktionskurve · dragExponent",
      incomingSettleDurationSeconds: "Landungsdauer · settleDuration",
      incomingSettleEasingPower: "Landungs-Easing · settleEasing",
      incomingRevertDurationSeconds: "Rückkehrdauer · revertDuration",
      clickReleaseX: "Start der Anhebung · releaseX",
      clickLiftVelocity: "Anhebungsgeschwindigkeit · liftVelocity",
      clickLiftToLeft: "Horizontale Ausdehnung · liftToLeft",
      releaseX: "Start der umgekehrten Landung · releaseX",
      liftVelocity: "Aufwärtsgerichtete Loslassgeschwindigkeit · liftVelocity",
      liftToLeft: "Horizontale Ausdehnung beim Loslassen · liftToLeft",
      curvatureRelaxation: "Krümmungsabbau · curvatureRelaxation",
      pageWeight: "Seitengewicht · pageWeight",
      commitThreshold: "Bestätigungsschwelle · commitThreshold",
      minimumSpeedScale: "Minimale Einregelgeschwindigkeit · minimumSpeedScale",
      maximumSpeedScale: "Maximale Einregelgeschwindigkeit · maximumSpeedScale",
      velocityGain: "Wischgeschwindigkeitsverstärkung · velocityGain",
      idleDecaySeconds: "Abklingsekunden beim Loslassen · idleDecaySeconds",
      playbackSpeed: "Wiedergabegeschwindigkeit · playbackSpeed",
      propagationSpeed: "Ausbreitungsgeschwindigkeit {{value}}",
      reverseHint: "Parameter für Rückwärtsseite und Papierrückseite",
      resetAccessibility:
        "Standardwerte für den gewählten Modus wiederherstellen",
      reset: "Aktuellen Modus zurücksetzen",
    },
    loading: { preparingTypography: "Typografie wird vorbereitet…" },
    accessibility: {
      previousPage: "Vorherige Seite",
      nextPage: "Nächste Seite",
      toggleTools: "Lesewerkzeuge ein- oder ausblenden",
      selectionStart: "Den Anfang der Textauswahl ziehen",
      selectionEnd: "Das Ende der Textauswahl ziehen",
      header: "Kopfzeile: {{title}}",
      publicationPercentage: "Buchfortschritt {{percentage}}",
      publicationPage: "Buchseite {{page}}",
      noteKindEndnote: "Endnote",
      noteKindFootnote: "Fußnote",
      noteKindAnnotation: "Anmerkung",
      openNote: "{{noteKind}} {{label}} öffnen",
      returnToText: "Zum Text {{label}} zurückkehren",
      jumpTo: "Zu {{label}} gehen",
      noteHint:
        "Öffnet die Anmerkung und bietet eine Schaltfläche zur Rückkehr zum Text",
      returnToReference: "Zur Referenz der {{noteKind}} {{label}} zurückkehren",
      returnToTextButton: "↩ Zum Text zurückkehren",
      dismissReturnButton:
        "Schaltfläche zur Rückkehr zur {{noteKind}}-Referenz ausblenden",
    },
  },
  errors: {
    unknown: "Ein unbekannter Fehler ist aufgetreten.",
    languagePreferenceSaveFailed:
      "Die App-Sprache konnte nicht gespeichert werden. Die vorherige Sprache bleibt aktiv.",
    epub: {
      fixedLayout:
        "EPUB-Dateien mit festem Layout werden noch nicht unterstützt; diese Version konzentriert sich auf umfließende Bücher.",
      archiveLimit: "Dieses Buch überschreitet die sicheren Importgrenzen.",
      unsafePath:
        "Das EPUB enthält einen unsicheren Pfad und wurde nicht importiert.",
      unreadable: "Dieses EPUB konnte nicht gelesen werden: {{message}}",
    },
    library: {
      bookNotFound: "Dieses Buch existiert nicht oder wurde gelöscht.",
      needsReimport:
        "Dieses Buch muss erneut aus seinem ursprünglichen EPUB importiert werden.",
      corruptStorage:
        "Die Daten dieses Buchs sind unvollständig. Lösche es und importiere es erneut.",
      storageFull:
        "Es gibt nicht genügend freien Speicherplatz, um dieses Buch sicher zu speichern.",
      loadFailed: "Lokale Bibliothek konnte nicht geladen werden: {{message}}",
      progressSaveFailed:
        "Der Lesefortschritt konnte nicht gespeichert werden. Persimmon versucht es automatisch erneut.",
      settingsSaveFailed:
        "Die Leseeinstellungen konnten nicht gespeichert werden.",
      exportUnavailable:
        "Auf diesem Gerät kann der Dateiexport nicht geöffnet werden.",
      exportFailed:
        "Das EPUB konnte nicht exportiert werden. Versuche es erneut.",
      cloudRepairUnavailable:
        "Die Cloud hat kein EPUB, das dieses Buch reparieren kann. Importiere die Originaldatei erneut.",
      deleteTitle: "Buch löschen",
      deleteConfirmation: "„{{title}}“ und seine lokalen Ressourcen löschen?",
    },
    fonts: {
      notFound: "Diese Schriftart wurde nicht gefunden.",
      invalid: "Die Schriftdatei ist ungültig oder wird nicht unterstützt.",
      integrity:
        "Die Schriftdatei hat die Überprüfung nicht bestanden. Lade sie erneut herunter oder importiere sie erneut.",
      storageFull:
        "Es gibt nicht genügend freien Speicherplatz, um diese Schriftart sicher zu speichern.",
      loadFailed:
        "Lokale Schriftarten konnten nicht geladen werden: {{message}}",
      importFailed: "Die Schriftart konnte nicht importiert werden.",
      downloadFailed: "Die Schriftart konnte nicht heruntergeladen werden.",
      deleteFailed: "Die Schriftart konnte nicht gelöscht werden.",
      downloadTimeout:
        "Der Download der Schriftart hat zu lange gedauert. Prüfe dein Netzwerk und versuche es erneut.",
      downloadNetwork:
        "Der Download der Schriftart ist fehlgeschlagen. Prüfe dein Netzwerk und versuche es erneut.",
      downloadHttp:
        "Der Download der Schriftart ist fehlgeschlagen (HTTP {{status}}).",
      downloadTooLarge:
        "Der Download der Schriftart ist größer als der Katalogeintrag.",
      catalogMissing:
        "Der Schriftartenkatalog enthält keine herunterladbare Datei für diese Schriftart.",
      catalogNotFound:
        "Diese Schriftart ist nicht im herunterladbaren Schriftartenkatalog enthalten.",
      missingFallback:
        "Die Schriftdatei fehlt. Die integrierte Serifenschriftart wird verwendet.",
      readFallback:
        "Die Schriftdatei konnte nicht gelesen werden. Die integrierte Serifenschriftart wird verwendet.",
      loadFallback:
        "Die Schriftart konnte nicht geladen werden. Die integrierte Serifenschriftart wird verwendet.",
      fileTooLarge:
        "Schriftdateien dürfen nicht größer als {{maximumMb}} MB sein.",
    },
    import: {
      withImported:
        "{{importedCount}} Bücher importiert; {{count}} fehlgeschlagen:",
      withImported_one:
        "{{importedCount}} Bücher importiert; {{count}} fehlgeschlagen:",
      withImported_other:
        "{{importedCount}} Bücher importiert; {{count}} fehlgeschlagen:",
      failed: "{{count}} Bücher konnten nicht importiert werden:",
      failed_one: "{{count}} Buch konnte nicht importiert werden:",
      failed_other: "{{count}} Bücher konnten nicht importiert werden:",
      detail: "{{fileName}}: {{message}}",
      syncRecordFailed:
        "„{{fileName}}“ wurde importiert, aber sein Synchronisierungsdatensatz konnte nicht gespeichert werden: {{message}}",
    },
  },
} as const satisfies TranslationSchema<typeof en>;
