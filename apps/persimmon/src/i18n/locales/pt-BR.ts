import type { en } from "./en";

type TranslationSchema<Value> = Value extends string
  ? string
  : { readonly [Key in keyof Value]: TranslationSchema<Value[Key]> };

export const ptBR = {
  common: {
    cancel: "Cancelar",
    close: "Fechar",
    delete: "Excluir",
    done: "Concluído",
    download: "Baixar",
    new: "Novo",
    processing: "Processando…",
    search: "Buscar",
    settings: "Ajustes",
    unknownAuthor: "Autor desconhecido",
  },
  accessibility: {
    decrease: "Diminuir {{label}}",
    increase: "Aumentar {{label}}",
  },
  appearance: {
    section: "Aparência",
    colorMode: "Modo de cor",
    colorModeGroup: "Modo de cor do app",
    readerColorModeGroup: "Modo de cor do leitor",
    theme: "Tema do papel",
    libraryThemeGroup: "Tema de papel da biblioteca",
    readerThemeGroup: "Tema de papel do leitor",
    colorModes: {
      system: "Automático",
      systemAccessibility: "Modo de cor automático",
      light: "Claro",
      lightAccessibility: "Modo claro",
      dark: "Escuro",
      darkAccessibility: "Modo escuro",
    },
    themes: {
      warm: "Papel quente",
      warmDescription: "Marfim suave",
      warmAccessibility: "Tema de papel quente",
      cool: "Papel frio",
      coolDescription: "Azul-cinza claro",
      coolAccessibility: "Tema de papel frio",
    },
  },
  language: {
    label: "Idioma do app",
    groupAccessibility: "Idioma da interface do Persimmon",
    options: {
      system: "Sistema",
      systemAccessibility: "Seguir o idioma do sistema",
      zhHans: "简体中文",
      zhHansAccessibility: "Usar chinês simplificado",
      zhHant: "繁體中文",
      zhHantAccessibility: "Usar chinês tradicional",
      english: "English",
      englishAccessibility: "Usar inglês",
      japanese: "日本語",
      japaneseAccessibility: "Usar japonês",
      korean: "한국어",
      koreanAccessibility: "Usar coreano",
      spanish: "Español",
      spanishAccessibility: "Usar espanhol",
      french: "Français",
      frenchAccessibility: "Usar francês",
      german: "Deutsch",
      germanAccessibility: "Usar alemão",
      portugueseBrazil: "Português (Brasil)",
      portugueseBrazilAccessibility: "Usar português do Brasil",
    },
    systemDescription:
      "Usa o idioma do dispositivo e atualiza quando o app volta ao primeiro plano.",
    overrideDescription: "Substitui o idioma da interface apenas do Persimmon.",
  },
  library: {
    title: "Todos os livros",
    filters: {
      all: "Todos",
      reading: "Lendo",
      unread: "Não lidos",
      finished: "Concluídos",
      withCount: "{{label}} {{count}}",
    },
    sort: {
      default: "Ordenar",
      recent: "Lidos recentemente",
      added: "Data de adição",
      title: "Título",
      currentAccessibility: "Ordenar, atualmente {{label}}",
      closeAccessibility: "Fechar opções de ordenação",
      heading: "Ordenar por",
    },
    actions: {
      searchAccessibility: "Buscar títulos ou autores",
      openSettingsAccessibility: "Abrir ajustes",
      importAccessibility: "Importar um ou mais arquivos EPUB",
      importLabel: "Importar arquivos EPUB",
      closeError: "Fechar",
      syncNow: "Sincronizar agora",
      downloadFromCloud: "Baixar da nuvem",
    },
    empty: {
      title: "Ainda não há livros",
      body: "Escolha outra categoria ou importe um EPUB.",
    },
    error: { title: "Algo deu errado" },
    importBanner: {
      accessibility: "Progresso da importação de livros",
      complete: "Importação concluída",
      importing: "Importando livros",
      importingBook: "Importando livro {{current}} de {{total}} · {{title}}",
      processing: "{{completed}} de {{total}} livros processados…",
      result: "{{imported}} livros importados",
      resultWithFailures: "{{imported}} importados · {{failed}} com falha",
    },
    search: {
      placeholder: "Buscar títulos ou autores",
      clearAccessibility: "Limpar busca",
      emptyTitle: "Nenhum livro encontrado",
      emptyBody: "A busca verifica apenas títulos e autores.",
      openAccessibility: "Abrir {{title}}",
    },
    card: {
      coverAccessibility: "Capa de {{title}}",
      openAccessibility: "Abrir {{title}}",
      longPressHint: "Toque e segure para ações do livro",
      moreAccessibility: "Mais ações para {{title}}",
      needsDownload: "Download necessário",
      finished: "Lido",
      unread: "Não lido",
      new: "NOVO",
    },
    details: {
      closeAccessibility: "Fechar detalhes do livro",
      title: "Detalhes do livro",
      progress: "Progresso de leitura",
      notStarted: "Não iniciado",
      localStatus: "Neste dispositivo",
      downloaded: "Baixado",
      needsDownload: "Precisa ser baixado novamente",
      file: "Arquivo",
      legacyImport: "Importação antiga",
      size: "Tamanho",
      builtIn: "Conteúdo integrado",
      added: "Adicionado à biblioteca",
      continueReading: "Continuar lendo",
      deleteEverywhere: "Excluir da biblioteca e da nuvem",
    },
    settings: {
      closeAccessibility: "Fechar ajustes",
      showMetadata: "Mostrar títulos e autores",
      showMetadataDescription:
        "Quando desativado, apenas capas, progresso de leitura e botões de ação são exibidos",
      showMetadataAccessibility: "Mostrar títulos e autores",
    },
    nativeMenu: { details: "Detalhes", delete: "Excluir" },
  },
  sync: {
    banner: {
      complete: "Sincronização concluída",
      setup: "Configurar sincronização na nuvem",
      syncing: "Sincronização do Google Drive",
      openSettingsAccessibility: "Abrir ajustes de sincronização na nuvem",
      syncingAccessibility: "Google Drive está sincronizando",
      progressAccessibility:
        "Progresso de sincronização de livros no Google Drive",
      closeAccessibility: "Fechar aviso do Google Drive",
    },
    description: {
      loading: "Carregando status da sincronização…",
      disconnected:
        "Conecte para enviar e baixar arquivos EPUB automaticamente e sincronizar o progresso de leitura usando posições de texto estáveis.",
      authorizing: "Aguardando autorização do Google…",
      syncingAccount: "Sincronizando sua biblioteca com {{accountEmail}}…",
      syncing: "Sincronizando sua biblioteca e o progresso de leitura…",
      syncingBook: "Sincronizando livro {{current}} de {{total}} · {{title}}",
      syncingBooks: "Sincronizando livro {{current}} de {{total}}…",
      finalizingBooks:
        "{{completed}} de {{total}} livros sincronizados · Finalizando…",
      idle: "{{account}} · Sincronizado às {{time}}",
    },
    actions: {
      connect: "Conectar ao Google Drive",
      reconnect: "Reconectar",
      syncNow: "Sincronizar agora",
      disconnect: "Desconectar",
    },
    errors: {
      unconfiguredIos:
        "O ID do cliente OAuth do Google Drive para iOS não está configurado.",
      unconfiguredAndroid:
        "O ID do cliente OAuth do Google Drive para Android não está configurado.",
      unsupportedPlatform:
        "A sincronização do Google Drive não é compatível com esta plataforma.",
      authorizationRequired:
        "A autorização do Google Drive expirou. Reconecte para continuar.",
      authorizationCancelled: "A autorização do Google Drive foi cancelada.",
      authorizationFailed:
        "Não foi possível concluir a autorização do Google Drive. Tente novamente.",
      connectFirst: "Conecte o Google Drive primeiro.",
      network:
        "Não foi possível conectar ao Google Drive. Verifique sua rede e tente novamente.",
      failed:
        "A sincronização do Google Drive falhou. Tente novamente mais tarde.",
    },
  },
  settings: {
    data: {
      section: "Gerenciamento de dados",
      sectionDescription:
        "Os dados locais e na nuvem são limpos separadamente para evitar exclusão acidental ou restauração imediata pela sincronização.",
      clearLocalTitle: "Limpar dados locais",
      clearLocalDescription:
        "Remove a biblioteca local, o progresso, os ajustes de leitura e as fontes instaladas. O Drive é desconectado; cópias na nuvem e a escolha de idioma do app permanecem.",
      clearLocalConfirmation:
        "Isto remove permanentemente todos os livros, progresso de leitura, ajustes de leitura e fontes instaladas deste dispositivo e desconecta o Google Drive. As cópias na nuvem não são excluídas. Não é possível desfazer.",
      clearLocalAction: "Limpar local",
      clearLocalCompleteTitle: "Dados locais limpos",
      clearLocalCompleteMessage:
        "Os dados locais de leitura foram removidos e o Google Drive foi desconectado. As cópias na nuvem permanecem.",
      clearLocalFailedTitle: "Não foi possível limpar os dados locais",
      clearLocalFailedMessage:
        "Alguns dados podem permanecer. Reinicie o app e tente novamente.",
      clearCloudTitle: "Limpar dados do Google Drive",
      clearCloudDescription:
        "Remove EPUBs e registros de sincronização da pasta oculta do Persimmon. O Drive é desconectado; cópias locais permanecem.",
      clearCloudDisconnectedDescription:
        "Conecte o Google Drive para remover todas as cópias na nuvem da pasta oculta do Persimmon.",
      clearCloudConfirmation:
        "Isto remove permanentemente todos os EPUBs, registros de progresso de leitura e registros de sincronização de dispositivos da pasta oculta do Persimmon da conta atual do Google Drive e desconecta. As cópias locais não são excluídas. Não é possível desfazer.",
      clearCloudAction: "Limpar nuvem",
      clearCloudCompleteTitle: "Dados na nuvem limpos",
      clearCloudCompleteMessage:
        "Os dados ocultos do Persimmon no Google Drive foram removidos e a conta foi desconectada. As cópias locais permanecem.",
      clearCloudFailedTitle: "Os dados na nuvem não foram totalmente limpos",
      clearCloudFailedMessage:
        "O Google Drive foi desconectado para impedir que dados restantes fossem enviados novamente. Verifique a rede, reconecte e tente outra vez.",
    },
    about: {
      section: "Sobre",
      privacy: "Política de privacidade",
      feedback: "Enviar feedback",
      feedbackDescription:
        "Usa a folha de compartilhamento do sistema e inclui detalhes do app e do dispositivo",
      feedbackEmailDescription: "Abre um rascunho de e-mail para {{email}}",
      feedbackSubject: "Feedback do Persimmon {{version}}",
      feedbackTemplate:
        "Feedback do Persimmon\n\nDescreva o problema ou sugestão:\n\n\nVersão do app: {{version}}\nPlataforma: {{platform}}",
      feedbackFailedTitle: "Não foi possível abrir o compartilhamento",
      feedbackFailedMessage:
        "Tente novamente mais tarde ou verifique se o dispositivo tem um destino de compartilhamento disponível.",
      licenses: "Licenças de código aberto",
      version: "Versão",
      copyright: "© 2026 Persimmon. Todos os direitos reservados.",
    },
    developer: {
      label: "Conheça o desenvolvedor",
      websiteAccessibility: "Abrir o site de Qihang Yang, chihum.dev",
      websiteFailedTitle: "Não foi possível abrir o site do desenvolvedor",
      websiteFailedMessage:
        "Tente novamente mais tarde ou visite chihum.dev no navegador.",
    },
  },
  reader: {
    toolbar: {
      backAccessibility: "Voltar à biblioteca",
      library: "Biblioteca",
      tocAccessibility: "Abrir sumário",
      toc: "Sumário",
      settingsAccessibility: "Abrir ajustes de leitura",
      settings: "Ajustes",
      tuningAccessibility: "Ajustar constantes de virada de página",
      tuning: "Curva",
      breadcrumbAccessibility: "Caminho do sumário: {{label}}",
    },
    toc: {
      closeAccessibility: "Fechar sumário",
      title: "Sumário",
      jumpAccessibility: "Ir para {{label}}",
    },
    layout: { spreadToggle: "Layout de duas páginas" },
    animation: { natural: "Virada de página natural" },
    rapidPageTurn: { title: "Deslize na borda para folhear" },
    settings: {
      groupAccessibility: "Categorias de ajustes de leitura",
      closeAccessibility: "Fechar ajustes de leitura",
      closeTypographyAccessibility: "Salvar tipografia e fechar ajuste",
      typographyTab: "Estilo",
      readingTab: "Leitura",
      progress: "Progresso de leitura",
      progressFooter: "Rodapé",
      progressHeader: "Cabeçalho",
      progressBoth: "Ambos",
      progressHidden: "Oculto",
      fontPickerTitle: "Escolher fonte",
      backToSettingsAccessibility: "Voltar aos ajustes de estilo",
      adjustTypography: "Ajustar tipografia",
      typographyPreviewTitle: "Prévia da tipografia",
      resetTypography: "Redefinir",
      resetReading: "Redefinir",
      resetReadingAccessibility: "Restaurar ajustes de leitura padrão",
      progressValueAccessibility:
        "Posição do progresso de leitura, atualmente {{value}}",
      textAlignment: "Alinhamento do texto",
      textAlignmentBook: "Seguir o livro",
      textAlignmentStart: "Início",
      textAlignmentJustify: "Justificado",
      textAlignmentEnd: "Fim",
      textAlignmentValueAccessibility:
        "Alinhamento do texto, atualmente {{value}}",
    },
    fonts: {
      section: "Fonte",
      unavailable:
        "Esta fonte está ausente neste dispositivo. O livro está usando Noto Serif SC temporariamente; seu ajuste de fonte é preservado.",
      chooseAccessibility: "Escolher fonte, atualmente {{font}}",
      fallback: "fonte de fallback",
      fallbackName: "Noto Serif SC (fallback)",
      bundled: "Integrada",
      downloaded: "Baixada",
      imported: "Importada",
      fontAccessibility: "Fonte {{font}}",
      deleteAccessibility: "Excluir fonte {{font}}",
      downloadAccessibility: "Baixar fonte {{font}}",
      available: "Disponível",
      importAccessibility: "Importar uma fonte de arquivo local",
      importAction: "Importar TTF / OTF local",
      useBookFonts: "Usar fontes incorporadas do livro",
      useBookFontsDescription:
        "Somente quando o EPUB especificar uma fonte explicitamente",
      noBookFonts: "Este livro não tem fontes incorporadas utilizáveis",
      fontSize: "Tamanho da fonte",
      lineHeight: "Altura da linha",
      paragraphSpacing: "Espaço entre parágrafos",
      horizontalMargin: "Margens laterais",
      deleteTitle: "Excluir fonte",
      deleteConfirmation: "Excluir “{{font}}”?",
    },
    tuning: {
      closeAccessibility: "Fechar ajustes da curva de virada",
      title: "Ajuste da curva de virada de página",
      clickMode: "Toque",
      gestureMode: "Gesto",
      forwardMode: "Avançar",
      backwardMode: "Voltar",
      reverseReleaseX: "Pouso reverso · releaseX",
      reverseCurvatureRelaxation: "Curvatura reversa · curvatureRelaxation",
      incomingLandingStartProgress: "Curvatura inicial · landingStart",
      incomingRevealStartProgress: "Verso aparece · revealStart",
      incomingRevealEndProgress: "Verso totalmente visível · revealEnd",
      incomingDragProgressScale: "Acompanhamento da mão · dragScale",
      incomingDragProgressExponent: "Curva de resposta · dragExponent",
      incomingSettleDurationSeconds: "Duração do pouso · settleDuration",
      incomingSettleEasingPower: "Suavização do pouso · settleEasing",
      incomingRevertDurationSeconds: "Duração do retorno · revertDuration",
      clickReleaseX: "Início da elevação · releaseX",
      clickLiftVelocity: "Velocidade de elevação · liftVelocity",
      clickLiftToLeft: "Extensão horizontal · liftToLeft",
      releaseX: "Início do pouso reverso · releaseX",
      liftVelocity: "Velocidade de liberação para cima · liftVelocity",
      liftToLeft: "Alcance horizontal de liberação · liftToLeft",
      curvatureRelaxation: "Decaimento da curvatura · curvatureRelaxation",
      pageWeight: "Peso da página · pageWeight",
      commitThreshold: "Limite de confirmação · commitThreshold",
      minimumSpeedScale:
        "Velocidade mínima de assentamento · minimumSpeedScale",
      maximumSpeedScale:
        "Velocidade máxima de assentamento · maximumSpeedScale",
      velocityGain: "Ganho de velocidade do toque rápido · velocityGain",
      idleDecaySeconds:
        "Segundos de decaimento da liberação · idleDecaySeconds",
      playbackSpeed: "Velocidade de reprodução · playbackSpeed",
      propagationSpeed: "Velocidade de propagação {{value}}",
      reverseHint: "Controles da página recebida e do verso",
      resetAccessibility: "Restaurar os padrões do modo selecionado",
      reset: "Redefinir modo atual",
    },
    loading: { preparingTypography: "Preparando tipografia…" },
    accessibility: {
      previousPage: "Página anterior",
      nextPage: "Próxima página",
      toggleTools: "Alternar ferramentas de leitura",
      selectionStart: "Arrastar o início da seleção de texto",
      selectionEnd: "Arrastar o fim da seleção de texto",
      header: "Cabeçalho: {{title}}",
      publicationPercentage: "Progresso do livro {{percentage}}",
      publicationPage: "Página {{page}} do livro",
      noteKindEndnote: "nota final",
      noteKindFootnote: "nota de rodapé",
      noteKindAnnotation: "nota",
      openNote: "Abrir {{noteKind}} {{label}}",
      returnToText: "Voltar ao texto {{label}}",
      jumpTo: "Ir para {{label}}",
      noteHint: "Abre a nota e oferece um botão para voltar ao texto",
      returnToReference: "Voltar à referência de {{noteKind}} {{label}}",
      returnToTextButton: "↩ Voltar ao texto",
      dismissReturnButton:
        "Dispensar o botão de voltar à referência de {{noteKind}}",
    },
  },
  errors: {
    unknown: "Ocorreu um erro desconhecido.",
    languagePreferenceSaveFailed:
      "Não foi possível salvar o idioma do app. O idioma anterior continua ativo.",
    epub: {
      fixedLayout:
        "Arquivos EPUB de layout fixo ainda não são compatíveis; esta versão se concentra em livros com layout fluido.",
      archiveLimit: "Este livro excede os limites seguros de importação.",
      unsafePath: "O EPUB contém um caminho inseguro e não foi importado.",
      unreadable: "Não foi possível ler este EPUB: {{message}}",
    },
    library: {
      bookNotFound: "Este livro não existe ou foi excluído.",
      needsReimport:
        "Este livro precisa ser importado novamente a partir do EPUB original.",
      corruptStorage:
        "Os dados deste livro estão incompletos. Exclua-o e importe-o novamente.",
      storageFull:
        "Não há espaço disponível suficiente para salvar este livro com segurança.",
      loadFailed: "Não foi possível carregar a biblioteca local: {{message}}",
      progressSaveFailed:
        "Não foi possível salvar o progresso de leitura. O Persimmon tentará novamente automaticamente.",
      settingsSaveFailed: "Não foi possível salvar os ajustes de leitura.",
      cloudRepairUnavailable:
        "A nuvem não tem um EPUB que possa reparar este livro. Importe o arquivo original novamente.",
      deleteTitle: "Excluir livro",
      deleteConfirmation: "Excluir “{{title}}” e seus recursos locais?",
    },
    fonts: {
      notFound: "Esta fonte não foi encontrada.",
      invalid: "O arquivo de fonte é inválido ou não é compatível.",
      integrity:
        "A verificação do arquivo de fonte falhou. Baixe ou importe novamente.",
      storageFull:
        "Não há espaço disponível suficiente para salvar esta fonte com segurança.",
      loadFailed: "Não foi possível carregar fontes locais: {{message}}",
      importFailed: "Não foi possível importar a fonte.",
      downloadFailed: "Não foi possível baixar a fonte.",
      deleteFailed: "Não foi possível excluir a fonte.",
      downloadTimeout:
        "O download da fonte expirou. Verifique sua rede e tente novamente.",
      downloadNetwork:
        "O download da fonte falhou. Verifique sua rede e tente novamente.",
      downloadHttp: "O download da fonte falhou (HTTP {{status}}).",
      downloadTooLarge:
        "O download da fonte é maior que a entrada do catálogo.",
      catalogMissing:
        "O catálogo de fontes não tem um arquivo para download desta fonte.",
      catalogNotFound:
        "Esta fonte não está no catálogo de fontes disponíveis para download.",
      missingFallback:
        "O arquivo de fonte está ausente. A fonte serifada integrada está sendo usada.",
      readFallback:
        "Não foi possível ler o arquivo de fonte. A fonte serifada integrada está sendo usada.",
      loadFallback:
        "Não foi possível carregar a fonte. A fonte serifada integrada está sendo usada.",
      fileTooLarge: "Arquivos de fonte não podem ter mais de {{maximumMb}} MB.",
    },
    import: {
      withImported: "{{importedCount}} livros importados; {{count}} falharam:",
      withImported_one:
        "{{importedCount}} livros importados; {{count}} falhou:",
      withImported_other:
        "{{importedCount}} livros importados; {{count}} falharam:",
      failed: "{{count}} livros não foram importados:",
      failed_one: "{{count}} livro não foi importado:",
      failed_other: "{{count}} livros não foram importados:",
      detail: "{{fileName}}: {{message}}",
      syncRecordFailed:
        "“{{fileName}}” foi importado, mas não foi possível salvar seu registro de sincronização: {{message}}",
    },
  },
} as const satisfies TranslationSchema<typeof en>;
