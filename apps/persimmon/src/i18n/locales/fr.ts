import type { en } from "./en";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const fr = {
  common: {
    cancel: "Annuler",
    close: "Fermer",
    delete: "Supprimer",
    done: "Terminé",
    download: "Télécharger",
    new: "Nouveau",
    processing: "Traitement en cours…",
    search: "Rechercher",
    settings: "Réglages",
    unknownAuthor: "Auteur inconnu",
  },
  accessibility: {
    decrease: "Diminuer {{label}}",
    increase: "Augmenter {{label}}",
  },
  appearance: {
    section: "Apparence",
    colorMode: "Mode de couleur",
    colorModeGroup: "Mode de couleur de l’app",
    readerColorModeGroup: "Mode de couleur du lecteur",
    theme: "Thème papier",
    libraryThemeGroup: "Thème papier de la bibliothèque",
    readerThemeGroup: "Thème papier du lecteur",
    colorModes: {
      system: "Automatique",
      systemAccessibility: "Mode de couleur automatique",
      light: "Clair",
      lightAccessibility: "Mode clair",
      dark: "Sombre",
      darkAccessibility: "Mode sombre",
    },
    themes: {
      warm: "Papier chaud",
      warmDescription: "Ivoire doux",
      warmAccessibility: "Thème papier chaud",
      cool: "Papier froid",
      coolDescription: "Bleu-gris net",
      coolAccessibility: "Thème papier froid",
    },
  },
  language: {
    label: "Langue de l’app",
    groupAccessibility: "Langue de l’interface Persimmon",
    options: {
      system: "Système",
      systemAccessibility: "Suivre la langue du système",
      zhHans: "简体中文",
      zhHansAccessibility: "Utiliser le chinois simplifié",
      zhHant: "繁體中文",
      zhHantAccessibility: "Utiliser le chinois traditionnel",
      english: "English",
      englishAccessibility: "Utiliser l’anglais",
      japanese: "日本語",
      japaneseAccessibility: "Utiliser le japonais",
      korean: "한국어",
      koreanAccessibility: "Utiliser le coréen",
      spanish: "Español",
      spanishAccessibility: "Utiliser l’espagnol",
      french: "Français",
      frenchAccessibility: "Utiliser le français",
      german: "Deutsch",
      germanAccessibility: "Utiliser l’allemand",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "Utiliser le portugais brésilien",
    },
    systemDescription:
      "Utilise la langue de l’appareil et s’actualise lorsque l’app revient au premier plan.",
    overrideDescription:
      "Remplace la langue de l’interface uniquement pour Persimmon.",
  },
  library: {
    title: "Tous les livres",
    filters: {
      all: "Tous",
      reading: "En cours",
      unread: "Non lus",
      finished: "Terminés",
      withCount: "{{label}} {{count}}",
    },
    sort: {
      default: "Trier",
      recent: "Lus récemment",
      added: "Date d’ajout",
      title: "Titre",
      currentAccessibility: "Trier, actuellement {{label}}",
      closeAccessibility: "Fermer les options de tri",
      heading: "Trier par",
    },
    actions: {
      searchAccessibility: "Rechercher des titres ou des auteurs",
      openSettingsAccessibility: "Ouvrir les réglages",
      importAccessibility: "Importer un ou plusieurs fichiers EPUB",
      importLabel: "Importer des fichiers EPUB",
      closeError: "Fermer",
      syncNow: "Synchroniser",
      downloadFromCloud: "Télécharger depuis le cloud",
    },
    empty: {
      title: "Aucun livre pour l’instant",
      body: "Choisissez une autre catégorie ou importez un EPUB.",
    },
    error: { title: "Un problème est survenu" },
    importBanner: {
      accessibility: "Progression de l’importation des livres",
      complete: "Importation terminée",
      importing: "Importation des livres",
      importingBook:
        "Importation du livre {{current}} sur {{total}} · {{title}}",
      processing: "{{completed}} livres sur {{total}} traités…",
      result: "{{imported}} livres importés",
      resultWithFailures: "{{imported}} importés · {{failed}} en échec",
    },
    search: {
      placeholder: "Rechercher des titres ou des auteurs",
      clearAccessibility: "Effacer la recherche",
      emptyTitle: "Aucun livre correspondant",
      emptyBody: "La recherche porte uniquement sur les titres et les auteurs.",
      openAccessibility: "Ouvrir {{title}}",
    },
    card: {
      coverAccessibility: "Couverture de {{title}}",
      openAccessibility: "Ouvrir {{title}}",
      longPressHint: "Maintenez appuyé pour les actions du livre",
      moreAccessibility: "Autres actions pour {{title}}",
      needsDownload: "Téléchargement requis",
      finished: "Lu",
      unread: "Non lu",
      new: "NOUVEAU",
    },
    details: {
      closeAccessibility: "Fermer les détails du livre",
      title: "Détails du livre",
      progress: "Progression de lecture",
      notStarted: "Non commencé",
      localStatus: "Sur cet appareil",
      downloaded: "Téléchargé",
      needsDownload: "Doit être téléchargé à nouveau",
      file: "Fichier",
      legacyImport: "Importation héritée",
      size: "Taille",
      builtIn: "Contenu intégré",
      added: "Ajouté à la bibliothèque",
      continueReading: "Continuer la lecture",
      deleteEverywhere: "Supprimer de la bibliothèque et du cloud",
    },
    settings: {
      closeAccessibility: "Fermer les réglages",
      showMetadata: "Afficher les titres et auteurs",
      showMetadataDescription:
        "Lorsque désactivé, seules les couvertures, la progression de lecture et les boutons d’action sont affichés",
      showMetadataAccessibility: "Afficher les titres et auteurs",
    },
    nativeMenu: { details: "Détails", delete: "Supprimer" },
  },
  sync: {
    banner: {
      complete: "Synchronisation terminée",
      setup: "Configurer la synchronisation cloud",
      syncing: "Synchronisation Google Drive",
      openSettingsAccessibility: "Ouvrir les réglages de synchronisation cloud",
      syncingAccessibility: "Google Drive est en cours de synchronisation",
      progressAccessibility:
        "Progression de la synchronisation des livres Google Drive",
      closeAccessibility: "Fermer l’avis Google Drive",
    },
    description: {
      loading: "Chargement de l’état de synchronisation…",
      disconnected:
        "Connectez-vous pour importer et télécharger automatiquement des fichiers EPUB et synchroniser la progression de lecture grâce à des positions de texte stables.",
      authorizing: "En attente de l’autorisation Google…",
      syncingAccount:
        "Synchronisation de votre bibliothèque avec {{accountEmail}}…",
      syncing:
        "Synchronisation de votre bibliothèque et de votre progression de lecture…",
      syncingBook:
        "Synchronisation du livre {{current}} sur {{total}} · {{title}}",
      syncingBooks: "Synchronisation du livre {{current}} sur {{total}}…",
      finalizingBooks:
        "{{completed}} livres sur {{total}} synchronisés · Finalisation…",
      idle: "{{account}} · Synchronisé à {{time}}",
    },
    actions: {
      connect: "Connecter Google Drive",
      reconnect: "Reconnecter",
      syncNow: "Synchroniser",
      disconnect: "Déconnecter",
    },
    errors: {
      unconfiguredIos:
        "L’identifiant client OAuth Google Drive pour iOS n’est pas configuré.",
      unconfiguredAndroid:
        "L’identifiant client OAuth Google Drive pour Android n’est pas configuré.",
      unsupportedPlatform:
        "La synchronisation Google Drive n’est pas prise en charge sur cette plateforme.",
      authorizationRequired:
        "L’autorisation Google Drive a expiré. Reconnectez-vous pour continuer.",
      authorizationCancelled: "L’autorisation Google Drive a été annulée.",
      authorizationFailed:
        "L’autorisation Google Drive n’a pas pu être terminée. Réessayez.",
      connectFirst: "Connectez d’abord Google Drive.",
      network:
        "Impossible de se connecter à Google Drive. Vérifiez votre réseau et réessayez.",
      failed: "La synchronisation Google Drive a échoué. Réessayez plus tard.",
    },
  },
  settings: {
    data: {
      section: "Gestion des données",
      sectionDescription:
        "Les données locales et cloud sont effacées séparément afin d’éviter une suppression accidentelle ou une restauration immédiate par synchronisation.",
      clearLocalTitle: "Effacer les données locales",
      clearLocalDescription:
        "Supprime la bibliothèque locale, la progression, les réglages de lecture et les polices installées. Drive est déconnecté ; les copies cloud et le choix de langue de l’app sont conservés.",
      clearLocalConfirmation:
        "Cette action supprime définitivement tous les livres, la progression de lecture, les réglages de lecture et les polices installées sur cet appareil, puis déconnecte Google Drive. Les copies cloud ne sont pas supprimées. Cette action est irréversible.",
      clearLocalAction: "Effacer les données locales",
      clearLocalCompleteTitle: "Données locales effacées",
      clearLocalCompleteMessage:
        "Les données de lecture locales ont été supprimées et Google Drive a été déconnecté. Les copies cloud sont conservées.",
      clearLocalFailedTitle: "Impossible d’effacer les données locales",
      clearLocalFailedMessage:
        "Certaines données peuvent subsister. Redémarrez l’app et réessayez.",
      clearCloudTitle: "Effacer les données Google Drive",
      clearCloudDescription:
        "Supprime les EPUB et les enregistrements de synchronisation du dossier caché de Persimmon. Drive est déconnecté ; les copies locales sont conservées.",
      clearCloudDisconnectedDescription:
        "Connectez Google Drive pour supprimer toutes les copies cloud du dossier caché de Persimmon.",
      clearCloudConfirmation:
        "Cette action supprime définitivement tous les EPUB, enregistrements de progression et enregistrements de synchronisation d’appareil du dossier caché de Persimmon pour le compte Google Drive actuel, puis déconnecte le compte. Les copies locales ne sont pas supprimées. Cette action est irréversible.",
      clearCloudAction: "Effacer le cloud",
      clearCloudCompleteTitle: "Données cloud effacées",
      clearCloudCompleteMessage:
        "Les données Google Drive cachées de Persimmon ont été supprimées et le compte a été déconnecté. Les copies locales sont conservées.",
      clearCloudFailedTitle:
        "Les données cloud n’ont pas été complètement effacées",
      clearCloudFailedMessage:
        "Google Drive a été déconnecté pour empêcher le téléversement à nouveau des données restantes. Vérifiez le réseau, reconnectez-vous et réessayez.",
    },
    about: {
      section: "À propos",
      privacy: "Politique de confidentialité",
      feedback: "Envoyer des commentaires",
      feedbackDescription:
        "Utilise la feuille de partage système et inclut les détails de l’app et de l’appareil",
      feedbackEmailDescription:
        "Ouvre un brouillon d’e-mail adressé à {{email}}",
      feedbackSubject: "Commentaires sur Persimmon {{version}}",
      feedbackTemplate:
        "Commentaires sur Persimmon\n\nDécrivez le problème ou la suggestion :\n\n\nVersion de l’app : {{version}}\nPlateforme : {{platform}}",
      feedbackFailedTitle: "Impossible d’ouvrir la feuille de partage",
      feedbackFailedMessage:
        "Réessayez plus tard ou vérifiez que l’appareil possède une destination de partage disponible.",
      licenses: "Licences open source",
      version: "Version",
      copyright: "© 2026 Persimmon. Tous droits réservés.",
    },
    developer: {
      label: "Rencontrer le développeur",
      websiteAccessibility: "Ouvrir le site de Qihang Yang, chihum.dev",
      websiteFailedTitle: "Impossible d’ouvrir le site du développeur",
      websiteFailedMessage:
        "Réessayez plus tard ou consultez chihum.dev dans votre navigateur.",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "Retourner à la bibliothèque",
      library: "Bibliothèque",
      tocAccessibility: "Ouvrir la table des matières",
      toc: "Sommaire",
      settingsAccessibility: "Ouvrir les réglages de lecture",
      settings: "Réglages",
      tuningAccessibility: "Ajuster les constantes de changement de page",
      tuning: "Courbe",
      breadcrumbAccessibility: "Chemin de la table des matières : {{label}}",
    },
    toc: {
      closeAccessibility: "Fermer la table des matières",
      title: "Sommaire",
      jumpAccessibility: "Aller à {{label}}",
    },
    layout: { spreadToggle: "Disposition sur deux pages" },
    animation: { natural: "Tour de page naturel" },
    rapidPageTurn: { title: "Balayage du bord pour feuilleter" },
    settings: {
      groupAccessibility: "Catégories des réglages de lecture",
      closeAccessibility: "Fermer les réglages de lecture",
      closeTypographyAccessibility:
        "Enregistrer la typographie et fermer l’ajustement",
      typographyTab: "Style",
      readingTab: "Lecture",
      progress: "Progression de lecture",
      progressFooter: "Pied de page",
      progressHeader: "En-tête",
      progressBoth: "Les deux",
      progressHidden: "Masqué",
      fontPickerTitle: "Choisir une police",
      backToSettingsAccessibility: "Retourner aux réglages de style",
      adjustTypography: "Ajuster la typographie",
      typographyPreviewTitle: "Aperçu typographique",
      resetTypography: "Réinitialiser",
      resetReading: "Réinitialiser",
      resetReadingAccessibility: "Rétablir les réglages de lecture par défaut",
      progressValueAccessibility:
        "Position de progression de lecture, actuellement {{value}}",
    },
    fonts: {
      section: "Police",
      unavailable:
        "Cette police est absente de cet appareil. Le livre utilise temporairement Noto Serif SC ; votre réglage de police est conservé.",
      chooseAccessibility: "Choisir une police, actuellement {{font}}",
      fallback: "police de remplacement",
      fallbackName: "Noto Serif SC (remplacement)",
      bundled: "Intégrée",
      downloaded: "Téléchargée",
      imported: "Importée",
      fontAccessibility: "Police {{font}}",
      deleteAccessibility: "Supprimer la police {{font}}",
      downloadAccessibility: "Télécharger la police {{font}}",
      available: "Disponible",
      importAccessibility: "Importer une police depuis un fichier local",
      importAction: "Importer un fichier TTF / OTF local",
      useBookFonts: "Utiliser les polices intégrées au livre",
      useBookFontsDescription:
        "Uniquement lorsque l’EPUB indique explicitement une police",
      noBookFonts: "Ce livre ne contient aucune police intégrée utilisable",
      fontSize: "Taille de police",
      lineHeight: "Hauteur de ligne",
      paragraphSpacing: "Espacement des paragraphes",
      horizontalMargin: "Marges latérales",
      deleteTitle: "Supprimer la police",
      deleteConfirmation: "Supprimer « {{font}} » ?",
    },
    tuning: {
      closeAccessibility: "Fermer les réglages de courbe de changement de page",
      title: "Constantes gestuelles de changement de page",
      releaseX: "Début de l’atterrissage inverse · releaseX",
      liftVelocity: "Vitesse de relâchement vers le haut · liftVelocity",
      liftToLeft: "Étendue horizontale du relâchement · liftToLeft",
      curvatureRelaxation: "Décroissance de la courbure · curvatureRelaxation",
      pageWeight: "Poids de la page · pageWeight",
      commitThreshold: "Seuil de validation · commitThreshold",
      minimumSpeedScale:
        "Vitesse minimale de stabilisation · minimumSpeedScale",
      maximumSpeedScale:
        "Vitesse maximale de stabilisation · maximumSpeedScale",
      velocityGain: "Gain de vitesse du balayage · velocityGain",
      idleDecaySeconds:
        "Secondes de décroissance au relâchement · idleDecaySeconds",
      propagationSpeed: "Vitesse de propagation {{value}}",
      resetAccessibility: "Rétablir les constantes gestuelles par défaut",
      reset: "Réinitialiser le geste",
    },
    loading: { preparingTypography: "Préparation de la typographie…" },
    accessibility: {
      previousPage: "Page précédente",
      nextPage: "Page suivante",
      toggleTools: "Afficher ou masquer les outils de lecture",
      selectionStart: "Faire glisser le début de la sélection de texte",
      selectionEnd: "Faire glisser la fin de la sélection de texte",
      header: "En-tête : {{title}}",
      publicationPercentage: "Progression du livre {{percentage}}",
      publicationPage: "Page {{page}} du livre",
      noteKindEndnote: "note de fin",
      noteKindFootnote: "note de bas de page",
      noteKindAnnotation: "note",
      openNote: "Ouvrir la {{noteKind}} {{label}}",
      returnToText: "Retourner au texte {{label}}",
      jumpTo: "Aller à {{label}}",
      noteHint: "Ouvre la note et fournit un bouton pour retourner au texte",
      returnToReference: "Retourner à la référence de {{noteKind}} {{label}}",
      returnToTextButton: "↩ Retourner au texte",
      dismissReturnButton:
        "Masquer le bouton de retour à la référence de {{noteKind}}",
    },
  },
  errors: {
    unknown: "Une erreur inconnue s’est produite.",
    languagePreferenceSaveFailed:
      "La langue de l’app n’a pas pu être enregistrée. La langue précédente reste active.",
    epub: {
      fixedLayout:
        "Les fichiers EPUB à mise en page fixe ne sont pas encore pris en charge ; cette version se concentre sur les livres à mise en page fluide.",
      archiveLimit: "Ce livre dépasse les limites d’importation sécurisées.",
      unsafePath:
        "L’EPUB contient un chemin non sécurisé et n’a pas été importé.",
      unreadable: "Impossible de lire cet EPUB : {{message}}",
    },
    library: {
      bookNotFound: "Ce livre n’existe pas ou a été supprimé.",
      needsReimport:
        "Ce livre doit être importé à nouveau depuis son EPUB d’origine.",
      corruptStorage:
        "Les données de ce livre sont incomplètes. Supprimez-le et importez-le à nouveau.",
      storageFull:
        "L’espace disponible est insuffisant pour enregistrer ce livre en toute sécurité.",
      loadFailed: "Impossible de charger la bibliothèque locale : {{message}}",
      progressSaveFailed:
        "La progression de lecture n’a pas pu être enregistrée. Persimmon réessaiera automatiquement.",
      settingsSaveFailed:
        "Les réglages de lecture n’ont pas pu être enregistrés.",
      cloudRepairUnavailable:
        "Le cloud ne possède pas d’EPUB pouvant réparer ce livre. Importez à nouveau le fichier d’origine.",
      deleteTitle: "Supprimer le livre",
      deleteConfirmation: "Supprimer « {{title}} » et ses ressources locales ?",
    },
    fonts: {
      notFound: "Cette police est introuvable.",
      invalid: "Le fichier de police est invalide ou non pris en charge.",
      integrity:
        "Le fichier de police n’a pas passé la vérification. Téléchargez-le ou importez-le à nouveau.",
      storageFull:
        "L’espace disponible est insuffisant pour enregistrer cette police en toute sécurité.",
      loadFailed: "Impossible de charger les polices locales : {{message}}",
      importFailed: "La police n’a pas pu être importée.",
      downloadFailed: "La police n’a pas pu être téléchargée.",
      deleteFailed: "La police n’a pas pu être supprimée.",
      downloadTimeout:
        "Le téléchargement de la police a expiré. Vérifiez votre réseau et réessayez.",
      downloadNetwork:
        "Le téléchargement de la police a échoué. Vérifiez votre réseau et réessayez.",
      downloadHttp:
        "Le téléchargement de la police a échoué (HTTP {{status}}).",
      downloadTooLarge:
        "Le téléchargement de la police est plus volumineux que l’entrée du catalogue.",
      catalogMissing:
        "Le catalogue de polices ne contient aucun fichier téléchargeable pour cette police.",
      catalogNotFound:
        "Cette police ne figure pas dans le catalogue de polices téléchargeables.",
      missingFallback:
        "Le fichier de police est absent. La police avec empattements intégrée est utilisée.",
      readFallback:
        "Le fichier de police n’a pas pu être lu. La police avec empattements intégrée est utilisée.",
      loadFallback:
        "La police n’a pas pu être chargée. La police avec empattements intégrée est utilisée.",
      fileTooLarge:
        "Les fichiers de police ne peuvent pas dépasser {{maximumMb}} Mo.",
    },
    import: {
      withImported: "{{importedCount}} livres importés ; {{count}} échecs :",
      withImported_one: "{{importedCount}} livre importé ; {{count}} échec :",
      withImported_other:
        "{{importedCount}} livres importés ; {{count}} échecs :",
      failed: "{{count}} livres n’ont pas pu être importés :",
      failed_one: "{{count}} livre n’a pas pu être importé :",
      failed_other: "{{count}} livres n’ont pas pu être importés :",
      detail: "{{fileName}} : {{message}}",
      syncRecordFailed:
        "« {{fileName}} » a été importé, mais son enregistrement de synchronisation n’a pas pu être enregistré : {{message}}",
    },
  },
} as const satisfies TranslationSchema<typeof en>;
