import type { en } from "./en";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const es = {
  common: {
    cancel: "Cancelar",
    close: "Cerrar",
    delete: "Eliminar",
    done: "Listo",
    download: "Descargar",
    new: "Nuevo",
    processing: "Procesando…",
    search: "Buscar",
    settings: "Ajustes",
    unknownAuthor: "Autor desconocido",
  },
  accessibility: {
    decrease: "Disminuir {{label}}",
    increase: "Aumentar {{label}}",
  },
  appearance: {
    section: "Apariencia",
    colorMode: "Modo de color",
    colorModeGroup: "Modo de color de la aplicación",
    readerColorModeGroup: "Modo de color del lector",
    theme: "Tema de papel",
    libraryThemeGroup: "Tema de papel de biblioteca",
    readerThemeGroup: "Tema de papel del lector",
    colorModes: {
      system: "Automático",
      systemAccessibility: "Modo de color automático",
      light: "Claro",
      lightAccessibility: "Modo claro",
      dark: "Oscuro",
      darkAccessibility: "Modo oscuro",
    },
    themes: {
      warm: "Papel cálido",
      warmDescription: "Marfil suave",
      warmAccessibility: "Tema de papel cálido",
      cool: "Papel frío",
      coolDescription: "Azul grisáceo claro",
      coolAccessibility: "Tema de papel frío",
    },
  },
  language: {
    label: "Idioma de la aplicación",
    groupAccessibility: "Idioma de la interfaz de Persimmon",
    options: {
      system: "Sistema",
      systemAccessibility: "Usar el idioma del sistema",
      zhHans: "简体中文",
      zhHansAccessibility: "Usar chino simplificado",
      zhHant: "繁體中文",
      zhHantAccessibility: "Usar chino tradicional",
      english: "English",
      englishAccessibility: "Usar inglés",
      japanese: "日本語",
      japaneseAccessibility: "Usar japonés",
      korean: "한국어",
      koreanAccessibility: "Usar coreano",
      spanish: "Español",
      spanishAccessibility: "Usar español",
      french: "Français",
      frenchAccessibility: "Usar francés",
      german: "Deutsch",
      germanAccessibility: "Usar alemán",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "Usar portugués de Brasil",
    },
    systemDescription:
      "Utiliza el idioma del dispositivo y se actualiza cuando la aplicación vuelve a estar en primer plano.",
    overrideDescription:
      "Cambia únicamente el idioma de la interfaz de Persimmon.",
  },
  library: {
    title: "Todos los libros",
    filters: {
      all: "Todos",
      reading: "Leyendo",
      unread: "No leídos",
      finished: "Terminados",
      withCount: "{{label}} {{count}}",
    },
    sort: {
      default: "Ordenar",
      recent: "Lectura reciente",
      added: "Fecha de incorporación",
      title: "Título",
      currentAccessibility: "Ordenar; opción actual: {{label}}",
      closeAccessibility: "Cerrar opciones de ordenación",
      heading: "Ordenar por",
    },
    actions: {
      searchAccessibility: "Buscar títulos o autores",
      openSettingsAccessibility: "Abrir ajustes",
      importAccessibility: "Importar uno o más archivos EPUB",
      importLabel: "Importar archivos EPUB",
      closeError: "Cerrar",
      syncNow: "Sincronizar ahora",
      downloadFromCloud: "Descargar desde la nube",
    },
    empty: {
      title: "Todavía no hay libros aquí",
      body: "Elige otra categoría o importa un EPUB.",
    },
    error: {
      title: "Algo salió mal",
    },
    importBanner: {
      accessibility: "Progreso de importación de libros",
      complete: "Importación completada",
      importing: "Importando libros",
      importingBook: "Importando libro {{current}} de {{total}} · {{title}}",
      processing: "{{completed}} de {{total}} libros procesados…",
      result: "{{imported}} libros importados",
      resultWithFailures: "{{imported}} importados · {{failed}} con error",
    },
    search: {
      placeholder: "Buscar títulos o autores",
      clearAccessibility: "Borrar búsqueda",
      emptyTitle: "Sin libros coincidentes",
      emptyBody: "La búsqueda solo comprueba los títulos y los autores.",
      openAccessibility: "Abrir {{title}}",
    },
    card: {
      coverAccessibility: "Portada de {{title}}",
      openAccessibility: "Abrir {{title}}",
      longPressHint: "Toca y mantén pulsado para realizar acciones del libro",
      moreAccessibility: "Más acciones para {{title}}",
      needsDownload: "Requiere descarga",
      finished: "Leído",
      unread: "No leído",
      new: "NUEVO",
    },
    details: {
      closeAccessibility: "Cerrar detalles del libro",
      title: "Detalles del libro",
      progress: "Progreso de lectura",
      notStarted: "Sin empezar",
      localStatus: "En este dispositivo",
      downloaded: "Descargado",
      needsDownload: "Debe descargarse de nuevo",
      file: "Archivo",
      legacyImport: "Importación heredada",
      size: "Tamaño",
      builtIn: "Contenido incorporado",
      added: "Añadido a la biblioteca",
      continueReading: "Continuar leyendo",
      deleteEverywhere: "Eliminar de la biblioteca y la nube",
    },
    settings: {
      closeAccessibility: "Cerrar ajustes",
      showMetadata: "Mostrar títulos y autores",
      showMetadataDescription:
        "Cuando está apagado, solo se muestran las portadas, el progreso de lectura y los botones de acción.",
      showMetadataAccessibility: "Mostrar títulos y autores",
    },
    nativeMenu: {
      details: "Detalles",
      delete: "Eliminar",
    },
  },
  sync: {
    banner: {
      complete: "Sincronización completada",
      setup: "Configurar la sincronización en la nube",
      syncing: "Sincronización de Google Drive",
      openSettingsAccessibility:
        "Abrir la configuración de sincronización en la nube",
      syncingAccessibility: "Google Drive está sincronizando",
      progressAccessibility:
        "Progreso de sincronización de libros de Google Drive",
      closeAccessibility: "Cerrar la notificación de Google Drive",
    },
    description: {
      loading: "Cargando el estado de sincronización…",
      disconnected:
        "Conecta Google Drive para subir y descargar archivos EPUB automáticamente y sincronizar el progreso mediante posiciones estables en el texto.",
      authorizing: "Esperando la autorización de Google…",
      syncingAccount: "Sincronizando tu biblioteca con {{accountEmail}}…",
      syncing: "Sincronizando tu biblioteca y el progreso de lectura…",
      syncingBook:
        "Sincronizando el libro {{current}} de {{total}} · {{title}}",
      syncingBooks: "Sincronizando el libro {{current}} de {{total}}...",
      finalizingBooks:
        "{{completed}} de {{total}} libros sincronizados · Finalizando…",
      idle: "{{account}} · Sincronizado a las {{time}}",
    },
    actions: {
      connect: "Conectar Google Drive",
      reconnect: "Volver a conectar",
      syncNow: "Sincronizar ahora",
      disconnect: "Desconectar",
    },
    errors: {
      unconfiguredIos:
        "El ID de cliente OAuth de Google Drive para iOS no está configurado.",
      unconfiguredAndroid:
        "El ID de cliente OAuth de Google Drive para Android no está configurado.",
      unsupportedPlatform:
        "La sincronización de Google Drive no es compatible con esta plataforma.",
      authorizationRequired:
        "La autorización de Google Drive ha caducado. Vuelve a conectar para continuar.",
      authorizationCancelled: "Se canceló la autorización de Google Drive.",
      authorizationFailed:
        "No se pudo completar la autorización de Google Drive. Inténtalo de nuevo.",
      connectFirst: "Conecta Google Drive primero.",
      network:
        "No se pudo conectar a Google Drive. Comprueba la conexión e inténtalo de nuevo.",
      failed:
        "La sincronización de Google Drive falló. Inténtalo de nuevo más tarde.",
    },
  },
  settings: {
    data: {
      section: "Gestión de datos",
      sectionDescription:
        "Los datos locales y en la nube se eliminan por separado para evitar la eliminación accidental o una restauración de sincronización inmediata.",
      clearLocalTitle: "Borrar datos locales",
      clearLocalDescription:
        "Elimina la biblioteca local, el progreso, los ajustes de lectura y las fuentes instaladas. Google Drive se desconecta; las copias en la nube y el idioma de la aplicación se conservan.",
      clearLocalConfirmation:
        "Esto elimina permanentemente todos los libros, el progreso de lectura, los ajustes de lectura y las fuentes instaladas en este dispositivo; después desconecta Google Drive. Las copias en la nube no se eliminan. Esta acción no se puede deshacer.",
      clearLocalAction: "Borrar local",
      clearLocalCompleteTitle: "Datos locales eliminados",
      clearLocalCompleteMessage:
        "Se eliminaron los datos de lectura locales y Google Drive se desconectó. Las copias en la nube permanecen.",
      clearLocalFailedTitle: "No se pudieron borrar los datos locales",
      clearLocalFailedMessage:
        "Es posible que queden algunos datos. Reinicia la aplicación e inténtalo de nuevo.",
      clearCloudTitle: "Borrar datos de Google Drive",
      clearCloudDescription:
        "Elimina los EPUB y los registros de sincronización de la carpeta oculta de Persimmon. Google Drive se desconecta; las copias locales permanecen.",
      clearCloudDisconnectedDescription:
        "Conecta Google Drive para eliminar todas las copias en la nube de la carpeta oculta de Persimmon.",
      clearCloudConfirmation:
        "Esto elimina permanentemente todos los EPUB, registros de progreso de lectura y registros de sincronización de dispositivos de la carpeta oculta de Persimmon en la cuenta actual de Google Drive; después desconecta la cuenta. Las copias locales no se eliminan. Esta acción no se puede deshacer.",
      clearCloudAction: "Borrar nube",
      clearCloudCompleteTitle: "Datos de la nube eliminados",
      clearCloudCompleteMessage:
        "Los datos ocultos de Persimmon de Google Drive fueron eliminados y la cuenta se desconectó. Las copias locales permanecen.",
      clearCloudFailedTitle:
        "Los datos de la nube no se limpiaron por completo",
      clearCloudFailedMessage:
        "Google Drive se desconectó para evitar que los datos restantes se carguen de nuevo. Comprueba la red, vuelve a conectarte e inténtalo de nuevo.",
    },
    about: {
      section: "Acerca de",
      privacy: "Política de privacidad",
      feedback: "Enviar comentarios",
      feedbackDescription:
        "Usa la hoja para compartir del sistema e incluye detalles de la aplicación y el dispositivo",
      feedbackEmailDescription:
        "Abre un borrador de correo electrónico dirigido a {{email}}",
      feedbackSubject: "Comentarios sobre Persimmon {{version}}",
      feedbackTemplate:
        "Comentarios sobre Persimmon\n\nDescribe el problema o la sugerencia:\n\n\nVersión de la aplicación: {{version}}\nPlataforma: {{platform}}",
      feedbackFailedTitle: "No se pudo abrir la hoja de compartir",
      feedbackFailedMessage:
        "Inténtalo de nuevo más tarde o comprueba que el dispositivo tenga un destino disponible para compartir.",
      licenses: "Licencias de código abierto",
      version: "Versión",
      copyright: "© 2026 Persimmon. Todos los derechos reservados.",
    },
    developer: {
      label: "Conoce al desarrollador",
      websiteAccessibility: "Abrir el sitio web de Qihang Yang, chihum.dev",
      websiteFailedTitle: "No se pudo abrir el sitio web del desarrollador",
      websiteFailedMessage:
        "Inténtalo de nuevo más tarde o visita chihum.dev en tu navegador.",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "Volver a la biblioteca",
      library: "Biblioteca",
      tocAccessibility: "Abrir el índice",
      toc: "Índice",
      settingsAccessibility: "Abrir ajustes de lectura",
      settings: "Ajustes",
      tuningAccessibility: "Ajustar las constantes de giro de página",
      tuning: "Curva",
      breadcrumbAccessibility: "Ruta de la tabla de contenidos: {{label}}",
    },
    toc: {
      closeAccessibility: "Cerrar el índice",
      title: "Índice",
      jumpAccessibility: "Ir a {{label}}",
    },
    layout: {
      spreadToggle: "Diseño de dos páginas",
    },
    animation: {
      natural: "Paso de página natural",
    },
    rapidPageTurn: {
      title: "Deslizar por el borde para hojear",
    },
    settings: {
      groupAccessibility: "Categorías de configuración de lectura",
      closeAccessibility: "Cerrar ajustes de lectura",
      closeTypographyAccessibility: "Guardar la tipografía y cerrar el ajuste",
      typographyTab: "Estilo",
      readingTab: "Lectura",
      progress: "Progreso de lectura",
      progressFooter: "Pie de página",
      progressHeader: "Encabezado",
      progressBoth: "Ambos",
      progressHidden: "Oculto",
      fontPickerTitle: "Elegir fuente",
      backToSettingsAccessibility: "Volver a la configuración de estilo",
      adjustTypography: "Ajustar tipografía",
      typographyPreviewTitle: "Vista previa de tipografía",
      resetTypography: "Restablecer",
      resetReading: "Restablecer",
      resetReadingAccessibility:
        "Restaurar la configuración predeterminada de lectura",
      progressValueAccessibility:
        "Posición de progreso de lectura, actualmente {{value}}",
    },
    fonts: {
      section: "Fuente",
      unavailable:
        "Esta fuente no está disponible en este dispositivo. El libro usa temporalmente Noto Serif SC; el ajuste de fuente se conserva.",
      chooseAccessibility: "Elegir fuente; actual: {{font}}",
      fallback: "Fuente de sustitución",
      fallbackName: "Noto Serif SC (sustitución)",
      bundled: "Incluida",
      downloaded: "Descargado",
      imported: "Importado",
      fontAccessibility: "Fuente {{font}}",
      deleteAccessibility: "Eliminar la fuente {{font}}",
      downloadAccessibility: "Descargar la fuente {{font}}",
      available: "Disponible",
      importAccessibility: "Importar una fuente desde un archivo local",
      importAction: "Importar TTF / OTF local",
      useBookFonts: "Usar las fuentes incrustadas del libro",
      useBookFontsDescription:
        "Solo cuando el EPUB especifique explícitamente una fuente",
      noBookFonts: "Este libro no contiene fuentes incrustadas utilizables",
      fontSize: "Tamaño de la fuente",
      lineHeight: "Altura de línea",
      paragraphSpacing: "Espacio entre párrafos",
      horizontalMargin: "Márgenes laterales",
      deleteTitle: "Eliminar fuente",
      deleteConfirmation: '¿Eliminar "{{font}}"?',
    },
    tuning: {
      closeAccessibility:
        "Cerrar la configuración de la curva de giro de página",
      title: "Constantes de giro de página del gesto",
      releaseX: "Inicio de aterrizaje en reversa · releaseX",
      liftVelocity: "Velocidad de liberación ascendente · liftVelocity",
      liftToLeft: "Ampliación de la liberación horizontal · liftToLeft",
      curvatureRelaxation: "Decaimiento de la curvatura · curvatureRelaxation",
      pageWeight: "Peso de la página · pageWeight",
      commitThreshold: "Umbral de confirmación · commitThreshold",
      minimumSpeedScale: "Velocidad mínima de asentamiento · minimumSpeedScale",
      maximumSpeedScale: "Velocidad máxima de asentamiento · maximumSpeedScale",
      velocityGain: "Ganancia de velocidad del gesto · velocityGain",
      idleDecaySeconds: "Segundos de atenuación tras soltar · idleDecaySeconds",
      propagationSpeed: "Velocidad de propagación {{value}}",
      resetAccessibility: "Restaurar las constantes de gestos predeterminados",
      reset: "Restablecer gesto",
    },
    loading: {
      preparingTypography: "Preparando tipografía...",
    },
    accessibility: {
      previousPage: "Página anterior",
      nextPage: "Página siguiente",
      toggleTools: "Mostrar u ocultar las herramientas de lectura",
      selectionStart: "Arrastra el inicio de la selección de texto",
      selectionEnd: "Arrastra el final de la selección de texto",
      header: "Cabecera: {{title}}",
      publicationPercentage: "Progreso del libro {{percentage}}",
      publicationPage: "Página del libro {{page}}",
      noteKindEndnote: "nota al final",
      noteKindFootnote: "nota a pie de página",
      noteKindAnnotation: "nota",
      openNote: "Abrir {{noteKind}} {{label}}",
      returnToText: "Volver al texto {{label}}",
      jumpTo: "Ir a {{label}}",
      noteHint: "Abre la nota y proporciona un botón para volver al texto",
      returnToReference: "Volver a la referencia {{noteKind}} {{label}}",
      returnToTextButton: "↩ Volver al texto",
      dismissReturnButton:
        "Desechar el botón de referencia de regreso a {{noteKind}}",
    },
  },
  errors: {
    unknown: "Se ha producido un error desconocido.",
    languagePreferenceSaveFailed:
      "No se pudo guardar el idioma de la aplicación. El idioma anterior sigue activo.",
    epub: {
      fixedLayout:
        "Los EPUB de diseño fijo todavía no son compatibles; esta versión se centra en libros de texto redistribuible.",
      archiveLimit: "Este libro supera los límites de importación seguros.",
      unsafePath: "El EPUB contiene una ruta no segura y no se importó.",
      unreadable: "No se pudo leer este EPUB: {{message}}",
    },
    library: {
      bookNotFound: "Este libro no existe o ha sido eliminado.",
      needsReimport:
        "Este libro necesita ser importado de nuevo desde su EPUB original.",
      corruptStorage:
        "Los datos de este libro están incompletos. Elimina el libro e impórtalo de nuevo.",
      storageFull:
        "No hay espacio disponible suficiente para guardar este libro de forma segura.",
      loadFailed: "No se pudo cargar la biblioteca local: {{message}}",
      progressSaveFailed:
        "No se pudo guardar el progreso de la lectura. Persimmon lo intentará de nuevo automáticamente.",
      settingsSaveFailed: "No se pudo guardar la configuración de lectura.",
      cloudRepairUnavailable:
        "La nube no tiene un EPUB que pueda reparar este libro. Importa el archivo original de nuevo.",
      deleteTitle: "Eliminar libro",
      deleteConfirmation: '¿Eliminar "{{title}}" y sus recursos locales?',
    },
    fonts: {
      notFound: "No se pudo encontrar esta fuente.",
      invalid: "El archivo de fuente no es válido o no es compatible.",
      integrity:
        "La verificación del archivo de fuente falló. Descarga o importa de nuevo.",
      storageFull:
        "No hay espacio disponible suficiente para guardar esta fuente de forma segura.",
      loadFailed: "No se pudieron cargar las fuentes locales: {{message}}",
      importFailed: "No se pudo importar la fuente.",
      downloadFailed: "No se pudo descargar la fuente.",
      deleteFailed: "No se pudo eliminar la fuente.",
      downloadTimeout:
        "El tiempo de espera para descargar la fuente ha expirado. Comprueba tu red e inténtalo de nuevo.",
      downloadNetwork:
        "La descarga de la fuente falló. Comprueba tu red e inténtalo de nuevo.",
      downloadHttp: "La descarga de la fuente falló (HTTP {{status}}).",
      downloadTooLarge:
        "La descarga de la fuente supera el tamaño indicado en el catálogo.",
      catalogMissing:
        "El catálogo de fuentes no tiene ningún archivo descargable para esta fuente.",
      catalogNotFound:
        "Esta fuente no está en el catálogo de fuentes descargables.",
      missingFallback:
        "El archivo de fuente no se encuentra. Se está utilizando la fuente serif incorporada.",
      readFallback:
        "No se pudo leer el archivo de fuente. Se está utilizando la fuente serif incorporada.",
      loadFallback:
        "No se pudo cargar la fuente. Se está utilizando la fuente serif incorporada.",
      fileTooLarge:
        "Los archivos de fuentes no pueden superar los {{maximumMb}} MB.",
    },
    import: {
      withImported:
        "Se importaron {{importedCount}} libros; fallaron {{count}}:",
      withImported_one:
        "Se importaron {{importedCount}} libros; falló {{count}}:",
      withImported_other:
        "Se importaron {{importedCount}} libros; fallaron {{count}}:",
      failed: "No se pudieron importar {{count}} libros:",
      failed_one: "No se pudo importar {{count}} libro:",
      failed_other: "No se pudieron importar {{count}} libros:",
      detail: "{{fileName}}: {{message}}",
      syncRecordFailed:
        '"{{fileName}}" se importó, pero no se pudo guardar su registro de sincronización: {{message}}',
    },
  },
} as const satisfies TranslationSchema<typeof en>;
