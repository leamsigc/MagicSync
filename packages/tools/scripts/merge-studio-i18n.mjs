/**
 * Merge the design-studio i18n additions (common, studio, rail, panel,
 * menu.main.bulk, Shape.*) into ImageEditor.json for all 4 locales.
 * Run: node packages/tools/scripts/merge-studio-i18n.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'

const FILE = new URL('../../site/app/pages/tools/image-editor/ImageEditor.json', import.meta.url)

const en = {
  common: {
    search: 'Search', stop: 'Stop', close: 'Close', reset: 'Reset', refresh: 'Refresh',
  },
  studio: {
    auth: { title: 'Sign in to use designs', desc: 'Free templates can be edited and exported. Sign in to save designs, versions, brand kits and batches.', action: 'Sign in', bulkTitle: 'Sign in to generate', bulkDesc: 'Save the design to your account first, then batch renders use the stored document.' },
    color: { pick: 'Pick color', presets: 'Brand presets', hex: 'Hex value' },
    variables: {
      refresh: 'Sync fields', count: '{count} variables', apply: 'Apply to canvas',
      valuePlaceholder: 'Value', selectLayer: 'Select bound layer',
      targets: 'Bound to {count} layer(s)', applied: 'Applied to {count} layer(s)',
      createTitle: 'Create from selected layer', namePlaceholder: 'Variable name, e.g. headline', create: 'Create variable',
      created: 'Variable {name} created', noSelection: 'Select a layer on the canvas first',
      bindProperty: 'Bind as', bind: 'Bind variable', bound: 'Layer bound to {name}',
      unbound: 'No bound layer found on the canvas', noLayer: 'Bound layer not on canvas',
      empty: { title: 'No variables yet', desc: 'Name a layer such as "headline" or bind linkData to create one.' },
    },
    fieldProp: { text: 'Text', image_url: 'Image', color: 'Color', font: 'Font', visible: 'Visibility' },
    shapes: {
      primitives: 'Basic layers', svgImport: 'Import SVG', svgHint: 'Upload an .svg file to add it as a grouped layer.', svgAdded: 'SVG added', svgFailed: 'Could not read that SVG',
      primitive: { textbox: 'Text', rect: 'Rect', circle: 'Circle', ellipse: 'Ellipse', triangle: 'Triangle', line: 'Line', polygon: 'Polygon', polyline: 'Polyline' },
      icons: 'Icons (Iconify)', iconPlaceholder: 'Search icons, e.g. star, arrow',
      qr: 'QR code', qrPlaceholder: 'URL or text for the QR code', qrAdd: 'Add QR', qrAdded: 'QR code added', qrFailed: 'Could not add the QR code',
      iconSearchFailed: 'Icon search failed', iconAddFailed: 'Could not add icon',
    },
    stock: {
      pexels: 'Pexels photos', unsplash: 'Unsplash', videos: 'Pexels videos',
      placeholder: 'Search stock…', empty: 'No results', failed: 'Stock search failed', photoBy: 'Photo by', on: 'on',
      insert: 'Add layer', background: 'Set as background', replace: 'Replace selected',
      more: 'Load more', videoCopied: 'Video URL copied', videoBgUnsupported: 'Video cannot be a canvas background',
      replaceMissing: 'Select an image layer to replace',
    },
    fonts: {
      cat: { all: 'All', local: 'Local', sans: 'Sans', serif: 'Serif', display: 'Display', handwriting: 'Handwriting', mono: 'Mono' },
      pairs: 'Font pairs', pairsHint: 'Click to add heading + body layers', pairHeading: 'Heading', pairBody: 'Body text',
      pairAdded: 'Heading and body layers added', sample: 'Design faster with paired fonts',
      search: 'Search 1,900+ Google fonts', loadingCatalog: 'Loading Google Fonts…', loadMore: 'Load {count} more',
      noResults: 'No fonts match your search', addedLayer: 'Added a {family} text layer',
      applied: 'Font applied to {count} layer(s)', pairApplied: 'Font pair applied',
      noText: 'Add a text layer first',
    },
    timeline: {
      preview: 'Preview', openBar: 'Timeline strip', editAsVideo: 'Edit as video', animatedCount: '{count} animated', page: 'Page', animate: 'Animate layer', mp4: 'Export MP4', mp4Ready: 'MP4 exported', mp4Failed: 'MP4 export failed', mp4Unavailable: 'Editor is still loading',
      pageDuration: 'Page duration', transitionLabel: 'Page transition',
      transitionMs: 'ms', layers: 'Layers', refresh: 'Reload layers', edit: 'Edit animation',
      noLayers: 'No layers to animate', enterAnim: 'Enter animation', enterMs: 'Duration ms',
      delayMs: 'Delay ms', loopAnim: 'Loop animation',
      transition: {
        none: 'None', fade: 'Fade', slideLeft: 'Slide left', slideRight: 'Slide right',
        wipeUp: 'Wipe up', zoomIn: 'Zoom in',
      },
      enter: {
        fadeIn: 'Fade in', riseUp: 'Rise up', dropDown: 'Drop down', slideLeft: 'Slide in left',
        slideRight: 'Slide in right', zoomIn: 'Zoom in', zoomOut: 'Zoom out', wipeUp: 'Wipe up',
        pop: 'Pop', none: 'None',
      },
      loop: { none: 'None', pulse: 'Pulse', spin: 'Spin', bob: 'Bob', swing: 'Swing', blink: 'Blink' },
    },
    templates: {
      import: 'Import JSON template', importHint: 'Fabric v5/v7 JSON is normalized and stored as a design.',
      library: 'Template library', meta: '{pages} page(s) · {fields} variable(s)',
      empty: 'No templates yet', imported: 'Template imported', importFailed: 'Import failed', opened: 'Template opened in your designs',
      openedGuest: 'Template opened', openedGuestDesc: 'Sign in to save a copy of this design.',
    },
    resize: {
      modeLabel: 'Resize mode', mode: { pad: 'Pad (recenter)', scale: 'Scale content', reflow: 'Reflow' },
      width: 'Width', height: 'Height', apply: 'Resize', fit: 'Fit content', center: 'Center content',
      applied: 'Applied: {size}', appliedTitle: '{name} applied',
      g: { social: 'Social', print: 'Print', web: 'Web', video: 'Video' },
    },
    design: {
      title: 'Design title', titlePlaceholder: 'Untitled design', save: 'Save design',
      saveAsNew: 'Save as new', savedAs: 'Saved as “{title}”', notSaved: 'Not saved yet',
      publish: 'Toggle publish', published: 'Published', versions: 'Version history',
      noVersions: 'No versions yet', restore: 'Restore this version', myDesigns: 'My designs',
      delete: 'Delete', more: 'Load more', kits: 'Brand kits', applyKit: 'Apply kit',
      kitName: 'Kit name', kitNameNeeded: 'Give the kit a name first', kitCreate: 'Create kit',
      kitHeading: 'Heading font', kitBody: 'Body font', kitApplied: 'Brand kit applied',
      loading: 'Editor is still loading', saved: 'Design saved', saveFailed: 'Save failed — check size or fields',
      noDocument: 'This design has no editor document', openFailed: 'Failed to open design',
      restored: 'Version restored', restoreFailed: 'Restore failed',
      duplicated: 'Duplicated into My Designs', duplicateFailed: 'Duplicate failed',
      publishedOn: 'Published to templates', publishedOff: 'Unpublished', publishFailed: 'Publish toggle failed',
      deleted: 'Design deleted', deleteFailed: 'Delete failed',
      kitCreated: 'Brand kit created', kitCreateFailed: 'Brand kit creation failed', kitDeleteFailed: 'Brand kit delete failed',
      watermark: 'Watermark', watermarkPlaceholder: 'Watermark text', watermarkAdd: 'Apply', watermarkRemove: 'Remove',
      watermarkAdded: 'Watermark applied', watermarkRemoved: 'Watermark removed', watermarkEmpty: 'Enter watermark text', watermarkFailed: 'Apply a watermark on the canvas first',
    },
    bulk: {
      title: 'Bulk generate', subtitle: 'One render per row or value combination.',
      source: 'Design source', chooseSource: 'Choose a saved design', saveFirst: 'Save the design first — bulk renders use the stored document.',
      rowsTab: 'Rows (CSV/table)', valuesTab: 'Value arrays', previewTab: 'Preview',
      importCsv: 'Import CSV', addRow: 'Add row', addColumn: 'Add column',
      columnName: 'Column name', pickVariable: 'Match a template variable', clientTitle: 'Client-only generation', clientDesc: 'Guests generate in this browser; each row downloads as a PNG. No account needed.', useCurrentDesign: 'Use current design', importTemplate: 'Import template JSON', templateLoaded: 'Template loaded', templateWarnings: '{count} import warning(s)', templateInvalid: 'That file is not a valid template JSON', serverLoginHint: 'Sign in to generate on the server and get a ZIP.', downloadedRows: '{count} file(s) downloaded', noDocument: 'Open a design or import a template first', noVariables: 'Open a design to load its variables', customColumn: 'Custom column name', createColumn: 'Add column', renameHint: 'Click a column name to edit it — use the template variable names.', columnMismatch: 'This column does not match a template variable', duplicateColumn: 'A column with that name already exists',
      removeRow: 'Remove row', removeColumn: 'Remove column',
      csvHint: 'Columns named like headline or fields__headline__text feed the variables. First row = headers.',
      csvLoaded: '{count} rows imported',
      noRows: { title: 'No table yet', desc: 'Import a CSV or add rows to start.' },
      addValueColumn: 'Add value column', valuesHint: 'List values separated by “|” — every combination is rendered.',
      valuesPlaceholder: 'value 1 | value 2 | value 3', valueCount: '{count} value(s)',
      noValues: { title: 'No value arrays yet', desc: 'Add a column per variable with its values.' },
      refreshPreviews: 'Refresh previews', previewLimit: 'First {count} rows previewed',
      noPreviews: 'No previews yet', results: '{ok} of {total} rendered', downloadZip: 'Download ZIP',
      failures: '{count} row(s) failed', rowCount: '{count} image(s) will be generated',
      generate: 'Generate batch', done: '{ok} of {total} images rendered',
      csvEmpty: 'No data rows found in the CSV', requestFailed: 'Batch request failed',
    },
  },
  Shape: {
    basic: {
      rect: 'Rectangle', circle: 'Circle', triangle: 'Triangle', quarter: 'Quarter circle',
      arch: 'Arch', blob: 'Blob', wave: 'Wave', waveDouble: 'Double wave',
      lightning: 'Lightning', plus: 'Plus',
    },
    arrows: { right: 'Arrow right', left: 'Arrow left', up: 'Arrow up', down: 'Arrow down', curve: 'Curved arrow' },
    lines: { straight: 'Straight line', dashed: 'Dashed line', squiggle: 'Squiggle', zigzag: 'Zigzag' },
    frames: { rect: 'Frame', corners: 'Corner frame', scrap: 'Scrapbook frame', film: 'Film frame' },
    badge: { star5: 'Star', heart: 'Heart', tag: 'Tag', burst: 'Burst', scroll: 'Scroll', speech: 'Speech bubble' },
  },
}

const es = {
  common: { search: 'Buscar', stop: 'Detener', close: 'Cerrar', reset: 'Restablecer', refresh: 'Actualizar' },
  studio: {
    auth: { title: 'Inicia sesión para usar diseños', desc: 'Las plantillas gratis se pueden editar y exportar. Inicia sesión para guardar, versiones, kits y lotes.', action: 'Iniciar sesión', bulkTitle: 'Inicia sesión para generar', bulkDesc: 'Guarda primero el diseño en tu cuenta; el lote usa el documento guardado.' },
    color: { pick: 'Elegir color', presets: 'Preajustes de marca', hex: 'Valor hex' },
    variables: {
      refresh: 'Sincronizar campos', count: '{count} variables', apply: 'Aplicar al lienzo',
      valuePlaceholder: 'Valor', selectLayer: 'Seleccionar capa vinculada',
      targets: 'Vinculada a {count} capa(s)', applied: 'Aplicado a {count} capa(s)',
      createTitle: 'Crear desde la capa seleccionada', namePlaceholder: 'Nombre de variable, p. ej. titular', create: 'Crear variable',
      created: 'Variable {name} creada', noSelection: 'Selecciona primero una capa',
      bindProperty: 'Vincular como', bind: 'Vincular variable', bound: 'Capa vinculada a {name}',
      unbound: 'No hay capa vinculada en el lienzo', noLayer: 'La capa vinculada no está en el lienzo',
      empty: { title: 'Aún no hay variables', desc: 'Nombra una capa como "titular" o enlaza linkData para crear una.' },
    },
    fieldProp: { text: 'Texto', image_url: 'Imagen', color: 'Color', font: 'Fuente', visible: 'Visibilidad' },
    shapes: {
      primitives: 'Capas básicas', svgImport: 'Importar SVG', svgHint: 'Sube un archivo .svg para añadirlo como capa agrupada.', svgAdded: 'SVG añadido', svgFailed: 'No se pudo leer el SVG',
      primitive: { textbox: 'Texto', rect: 'Rect', circle: 'Círculo', ellipse: 'Elipse', triangle: 'Triángulo', line: 'Línea', polygon: 'Polígono', polyline: 'Polilínea' },
      icons: 'Iconos (Iconify)', iconPlaceholder: 'Buscar iconos, p. ej. star',
      qr: 'Código QR', qrPlaceholder: 'URL o texto del QR', qrAdd: 'Añadir QR', qrAdded: 'Código QR añadido', qrFailed: 'No se pudo añadir el QR',
      iconSearchFailed: 'La búsqueda de iconos falló', iconAddFailed: 'No se pudo añadir el icono',
    },
    stock: {
      pexels: 'Fotos Pexels', unsplash: 'Unsplash', videos: 'Vídeos Pexels',
      placeholder: 'Buscar stock…', empty: 'Sin resultados', failed: 'La búsqueda falló', photoBy: 'Foto de', on: 'en',
      insert: 'Añadir capa', background: 'Usar como fondo', replace: 'Reemplazar selección',
      more: 'Cargar más', videoCopied: 'URL del vídeo copiada', videoBgUnsupported: 'El vídeo no puede ser fondo del lienzo',
      replaceMissing: 'Selecciona una capa de imagen para reemplazar',
    },
    fonts: {
      cat: { all: 'Todas', local: 'Locales', sans: 'Sans', serif: 'Serif', display: 'Display', handwriting: 'Manuscritas', mono: 'Mono' },
      pairs: 'Pares tipográficos', pairsHint: 'Haz clic para añadir título y cuerpo', pairHeading: 'Título', pairBody: 'Texto de cuerpo',
      pairAdded: 'Capas de título y cuerpo añadidas', sample: 'Diseña más rápido con fuentes combinadas',
      search: 'Busca entre más de 1.900 fuentes de Google', loadingCatalog: 'Cargando Google Fonts…', loadMore: 'Cargar {count} más',
      noResults: 'Ninguna fuente coincide', addedLayer: 'Capa de texto {family} añadida',
      applied: 'Fuente aplicada a {count} capa(s)', pairApplied: 'Par tipográfico aplicado',
      noText: 'Añade primero una capa de texto',
    },
    timeline: {
      preview: 'Previsualizar', openBar: 'Tira de tiempo', editAsVideo: 'Editar como vídeo', animatedCount: '{count} animadas', page: 'Página', animate: 'Animar capa', mp4: 'Exportar MP4', mp4Ready: 'MP4 exportado', mp4Failed: 'Error al exportar MP4', mp4Unavailable: 'El editor aún se está cargando',
      pageDuration: 'Duración de página', transitionLabel: 'Transición de página',
      transitionMs: 'ms', layers: 'Capas', refresh: 'Recargar capas', edit: 'Editar animación',
      noLayers: 'No hay capas para animar', enterAnim: 'Animación de entrada', enterMs: 'Duración ms',
      delayMs: 'Retardo ms', loopAnim: 'Animación en bucle',
      transition: {
        none: 'Ninguna', fade: 'Fundido', slideLeft: 'Desliz. izquierda', slideRight: 'Desliz. derecha',
        wipeUp: 'Barrido arriba', zoomIn: 'Zoom in',
      },
      enter: {
        fadeIn: 'Aparecer', riseUp: 'Ascender', dropDown: 'Caer', slideLeft: 'Entrar izquierda',
        slideRight: 'Entrar derecha', zoomIn: 'Zoom in', zoomOut: 'Zoom out', wipeUp: 'Barrido',
        pop: 'Pop', none: 'Ninguna',
      },
      loop: { none: 'Ninguna', pulse: 'Pulso', spin: 'Girar', bob: 'Flotar', swing: 'Balanceo', blink: 'Parpadeo' },
    },
    templates: {
      import: 'Importar plantilla JSON', importHint: 'El JSON Fabric v5/v7 se normaliza y se guarda como diseño.',
      library: 'Biblioteca de plantillas', meta: '{pages} página(s) · {fields} variable(s)',
      empty: 'Aún no hay plantillas', imported: 'Plantilla importada', importFailed: 'Error al importar', opened: 'Plantilla abierta en tus diseños',
      openedGuest: 'Plantilla abierta', openedGuestDesc: 'Inicia sesión para guardar una copia.',
    },
    resize: {
      modeLabel: 'Modo de redimensionado', mode: { pad: 'Rellenar (recentrar)', scale: 'Escalar contenido', reflow: 'Refluir' },
      width: 'Ancho', height: 'Alto', apply: 'Redimensionar', fit: 'Ajustar contenido', center: 'Centrar contenido',
      applied: 'Aplicado: {size}', appliedTitle: '{name} aplicado',
      g: { social: 'Social', print: 'Impresión', web: 'Web', video: 'Vídeo' },
    },
    design: {
      title: 'Título del diseño', titlePlaceholder: 'Diseño sin título', save: 'Guardar diseño',
      saveAsNew: 'Guardar como nuevo', savedAs: 'Guardado como “{title}”', notSaved: 'Aún sin guardar',
      publish: 'Alternar publicación', published: 'Publicado', versions: 'Historial de versiones',
      noVersions: 'Aún no hay versiones', restore: 'Restaurar esta versión', myDesigns: 'Mis diseños',
      delete: 'Eliminar', more: 'Cargar más', kits: 'Kits de marca', applyKit: 'Aplicar kit',
      kitName: 'Nombre del kit', kitNameNeeded: 'Ponle nombre al kit primero', kitCreate: 'Crear kit',
      kitHeading: 'Fuente de título', kitBody: 'Fuente de cuerpo', kitApplied: 'Kit de marca aplicado',
      loading: 'El editor aún se está cargando', saved: 'Diseño guardado', saveFailed: 'Error al guardar: revisa el tamaño o los campos',
      noDocument: 'Este diseño no tiene documento de editor', openFailed: 'No se pudo abrir el diseño',
      restored: 'Versión restaurada', restoreFailed: 'Error al restaurar',
      duplicated: 'Duplicado en Mis diseños', duplicateFailed: 'Error al duplicar',
      publishedOn: 'Publicado en plantillas', publishedOff: 'Sin publicar', publishFailed: 'Error al cambiar la publicación',
      deleted: 'Diseño eliminado', deleteFailed: 'Error al eliminar',
      kitCreated: 'Kit de marca creado', kitCreateFailed: 'Error al crear el kit', kitDeleteFailed: 'Error al eliminar el kit',
      watermark: 'Marca de agua', watermarkPlaceholder: 'Texto de la marca de agua', watermarkAdd: 'Aplicar', watermarkRemove: 'Quitar',
      watermarkAdded: 'Marca de agua aplicada', watermarkRemoved: 'Marca de agua eliminada', watermarkEmpty: 'Escribe el texto', watermarkFailed: 'No se pudo aplicar en el lienzo',
    },
    bulk: {
      title: 'Generación masiva', subtitle: 'Una generación por fila o combinación de valores.',
      source: 'Origen del diseño', chooseSource: 'Elige un diseño guardado', saveFirst: 'Guarda primero el diseño — el lote usa el documento guardado.',
      rowsTab: 'Filas (CSV/tabla)', valuesTab: 'Listas de valores', previewTab: 'Previsualización',
      importCsv: 'Importar CSV', addRow: 'Añadir fila', addColumn: 'Añadir columna',
      columnName: 'Nombre de columna', pickVariable: 'Coincide con una variable', clientTitle: 'Generación en el cliente', clientDesc: 'Los invitados generan en este navegador; cada fila se descarga como PNG. Sin cuenta.', useCurrentDesign: 'Usar diseño actual', importTemplate: 'Importar plantilla JSON', templateLoaded: 'Plantilla cargada', templateWarnings: '{count} advertencia(s) de importación', templateInvalid: 'El archivo no es un JSON de plantilla válido', serverLoginHint: 'Inicia sesión para generar en el servidor y obtener un ZIP.', downloadedRows: '{count} archivo(s) descargados', noDocument: 'Abre un diseño o importa una plantilla', noVariables: 'Abre un diseño para cargar sus variables', customColumn: 'Nombre personalizado', createColumn: 'Añadir columna', renameHint: 'Haz clic en el nombre de la columna para editarlo; usa los nombres de las variables.', columnMismatch: 'Esta columna no coincide con una variable', duplicateColumn: 'Ya existe una columna con ese nombre',
      removeRow: 'Quitar fila', removeColumn: 'Quitar columna',
      csvHint: 'Las columnas como titular o fields__titular__text alimentan las variables. Primera fila = cabeceras.',
      csvLoaded: '{count} filas importadas',
      noRows: { title: 'Aún no hay tabla', desc: 'Importa un CSV o añade filas para empezar.' },
      addValueColumn: 'Añadir columna de valores', valuesHint: 'Lista valores separados por “|” — se genera cada combinación.',
      valuesPlaceholder: 'valor 1 | valor 2 | valor 3', valueCount: '{count} valor(es)',
      noValues: { title: 'Aún no hay listas', desc: 'Añade una columna por variable con sus valores.' },
      refreshPreviews: 'Actualizar vistas previas', previewLimit: 'Se previsualizan las primeras {count} filas',
      noPreviews: 'Aún no hay vistas previas', results: '{ok} de {total} generadas', downloadZip: 'Descargar ZIP',
      failures: '{count} fila(s) fallaron', rowCount: 'Se generarán {count} imagen(es)',
      generate: 'Generar lote', done: '{ok} de {total} imágenes generadas',
      csvEmpty: 'No se encontraron filas en el CSV', requestFailed: 'La solicitud por lotes falló',
    },
  },
  Shape: {
    basic: { rect: 'Rectángulo', circle: 'Círculo', triangle: 'Triángulo', quarter: 'Cuarto de círculo', arch: 'Arco', blob: 'Mancha', wave: 'Onda', waveDouble: 'Doble onda', lightning: 'Rayo', plus: 'Cruz' },
    arrows: { right: 'Flecha derecha', left: 'Flecha izquierda', up: 'Flecha arriba', down: 'Flecha abajo', curve: 'Flecha curva' },
    lines: { straight: 'Línea recta', dashed: 'Línea discontinua', squiggle: 'Línea ondulada', zigzag: 'Zigzag' },
    frames: { rect: 'Marco', corners: 'Marco de esquinas', scrap: 'Marco de álbum', film: 'Marco de película' },
    badge: { star5: 'Estrella', heart: 'Corazón', tag: 'Etiqueta', burst: 'Estallido', scroll: 'Pergamino', speech: 'Globa de diálogo' },
  },
}

const de = {
  common: { search: 'Suchen', stop: 'Stopp', close: 'Schließen', reset: 'Zurücksetzen', refresh: 'Aktualisieren' },
  studio: {
    auth: { title: 'Anmelden, um Designs zu nutzen', desc: 'Kostenlose Vorlagen lassen sich bearbeiten und exportieren. Anmelden zum Speichern, Versionen, Kits und Stapeln.', action: 'Anmelden', bulkTitle: 'Zum Generieren anmelden', bulkDesc: 'Speichere das Design zuerst im Konto; der Stapel nutzt das gespeicherte Dokument.' },
    color: { pick: 'Farbe wählen', presets: 'Marken-Presets', hex: 'Hex-Wert' },
    variables: {
      refresh: 'Felder synchronisieren', count: '{count} Variablen', apply: 'Auf Leinwand anwenden',
      valuePlaceholder: 'Wert', selectLayer: 'Verbundene Ebene wählen',
      targets: 'Mit {count} Ebene(n) verbunden', applied: 'Auf {count} Ebene(n) angewendet',
      createTitle: 'Aus ausgewählter Ebene erstellen', namePlaceholder: 'Variablenname, z. B. headline', create: 'Variable erstellen',
      created: 'Variable {name} erstellt', noSelection: 'Wähle zuerst eine Ebene',
      bindProperty: 'Binden als', bind: 'Variable binden', bound: 'Ebene an {name} gebunden',
      unbound: 'Keine verbundene Ebene auf der Leinwand', noLayer: 'Verbundene Ebene nicht auf der Leinwand',
      empty: { title: 'Noch keine Variablen', desc: 'Benenne eine Ebene wie "headline" oder verbinde linkData.' },
    },
    fieldProp: { text: 'Text', image_url: 'Bild', color: 'Farbe', font: 'Schrift', visible: 'Sichtbarkeit' },
    shapes: {
      primitives: 'Basisebenen', svgImport: 'SVG importieren', svgHint: 'Lade eine .svg-Datei hoch, um sie als Gruppe hinzuzufügen.', svgAdded: 'SVG hinzugefügt', svgFailed: 'SVG konnte nicht gelesen werden',
      primitive: { textbox: 'Text', rect: 'Rechteck', circle: 'Kreis', ellipse: 'Ellipse', triangle: 'Dreieck', line: 'Linie', polygon: 'Polygon', polyline: 'Polylinie' },
      icons: 'Icons (Iconify)', iconPlaceholder: 'Icons suchen, z. B. star',
      qr: 'QR-Code', qrPlaceholder: 'URL oder Text für den QR-Code', qrAdd: 'QR hinzufügen', qrAdded: 'QR-Code hinzugefügt', qrFailed: 'QR-Code konnte nicht hinzugefügt werden',
      iconSearchFailed: 'Icon-Suche fehlgeschlagen', iconAddFailed: 'Icon konnte nicht hinzugefügt werden',
    },
    stock: {
      pexels: 'Pexels-Fotos', unsplash: 'Unsplash', videos: 'Pexels-Videos',
      placeholder: 'Stock suchen…', empty: 'Keine Ergebnisse', failed: 'Suche fehlgeschlagen', photoBy: 'Foto von', on: 'auf',
      insert: 'Ebene hinzufügen', background: 'Als Hintergrund', replace: 'Auswahl ersetzen',
      more: 'Mehr laden', videoCopied: 'Video-URL kopiert', videoBgUnsupported: 'Video kann nicht Hintergrund sein',
      replaceMissing: 'Wähle eine Bildebene zum Ersetzen',
    },
    fonts: {
      cat: { all: 'Alle', local: 'Lokal', sans: 'Sans', serif: 'Serif', display: 'Display', handwriting: 'Handschrift', mono: 'Mono' },
      pairs: 'Schrift-Paare', pairsHint: 'Klicken fügt Titel- und Text-Ebene hinzu', pairHeading: 'Titel', pairBody: 'Fließtext',
      pairAdded: 'Titel- und Text-Ebene hinzugefügt', sample: 'Gestalte schneller mit Paar-Schriften',
      search: 'Über 1.900 Google-Schriften durchsuchen', loadingCatalog: 'Google Fonts werden geladen…', loadMore: '{count} weitere laden',
      noResults: 'Keine Schrift passt', addedLayer: 'Textebene in {family} hinzugefügt',
      applied: 'Schrift auf {count} Ebene(n) angewendet', pairApplied: 'Schrift-Paar angewendet',
      noText: 'Füge zuerst eine Textebene hinzu',
    },
    timeline: {
      preview: 'Vorschau', openBar: 'Zeitleiste', editAsVideo: 'Als Video bearbeiten', animatedCount: '{count} animiert', page: 'Seite', animate: 'Ebene animieren', mp4: 'MP4 exportieren', mp4Ready: 'MP4 exportiert', mp4Failed: 'MP4-Export fehlgeschlagen', mp4Unavailable: 'Editor lädt noch',
      pageDuration: 'Seiten-Dauer', transitionLabel: 'Seiten-Übergang',
      transitionMs: 'ms', layers: 'Ebenen', refresh: 'Ebenen neu laden', edit: 'Animation bearbeiten',
      noLayers: 'Keine Ebenen für Animationen', enterAnim: 'Einblend-Animation', enterMs: 'Dauer ms',
      delayMs: 'Verzögerung ms', loopAnim: 'Loop-Animation',
      transition: {
        none: 'Kein', fade: 'Überblenden', slideLeft: 'Nach links', slideRight: 'Nach rechts',
        wipeUp: 'Nach oben wischen', zoomIn: 'Zoom in',
      },
      enter: {
        fadeIn: 'Einblenden', riseUp: 'Aufsteigen', dropDown: 'Herabfallen', slideLeft: 'Von links',
        slideRight: 'Von rechts', zoomIn: 'Zoom in', zoomOut: 'Zoom out', wipeUp: 'Wischen',
        pop: 'Pop', none: 'Keine',
      },
      loop: { none: 'Keine', pulse: 'Puls', spin: 'Drehen', bob: 'Schweben', swing: 'Schwingen', blink: 'Blinken' },
    },
    templates: {
      import: 'JSON-Vorlage importieren', importHint: 'Fabric v5/v7 JSON wird normalisiert und als Design gespeichert.',
      library: 'Vorlagen-Bibliothek', meta: '{pages} Seite(n) · {fields} Variable(n)',
      empty: 'Noch keine Vorlagen', imported: 'Vorlage importiert', importFailed: 'Import fehlgeschlagen', opened: 'Vorlage in deinen Designs geöffnet',
      openedGuest: 'Vorlage geöffnet', openedGuestDesc: 'Melde dich an, um eine Kopie zu speichern.',
    },
    resize: {
      modeLabel: 'Größenmodus', mode: { pad: 'Auffüllen (zentrieren)', scale: 'Inhalt skalieren', reflow: 'Umf Titel' },
      width: 'Breite', height: 'Höhe', apply: 'Größe ändern', fit: 'Inhalt einpassen', center: 'Inhalt zentrieren',
      applied: 'Angewendet: {size}', appliedTitle: '{name} angewendet',
      g: { social: 'Social', print: 'Druck', web: 'Web', video: 'Video' },
    },
    design: {
      title: 'Design-Titel', titlePlaceholder: 'Design ohne Titel', save: 'Design speichern',
      saveAsNew: 'Als neu speichern', savedAs: 'Gespeichert als „{title}“', notSaved: 'Noch nicht gespeichert',
      publish: 'Veröffentlichung umschalten', published: 'Veröffentlicht', versions: 'Versionsverlauf',
      noVersions: 'Noch keine Versionen', restore: 'Diese Version wiederherstellen', myDesigns: 'Meine Designs',
      delete: 'Löschen', more: 'Mehr laden', kits: 'Brand-Kits', applyKit: 'Kit anwenden',
      kitName: 'Kit-Name', kitNameNeeded: 'Gib dem Kit zuerst einen Namen', kitCreate: 'Kit erstellen',
      kitHeading: 'Titelschrift', kitBody: 'Fließtextschrift', kitApplied: 'Brand-Kit angewendet',
      loading: 'Editor lädt noch', saved: 'Design gespeichert', saveFailed: 'Speichern fehlgeschlagen — Größe oder Felder prüfen',
      noDocument: 'Dieses Design hat kein Editor-Dokument', openFailed: 'Design konnte nicht geöffnet werden',
      restored: 'Version wiederhergestellt', restoreFailed: 'Wiederherstellung fehlgeschlagen',
      duplicated: 'In „Meine Designs“ dupliziert', duplicateFailed: 'Duplizieren fehlgeschlagen',
      publishedOn: 'In Vorlagen veröffentlicht', publishedOff: 'Nicht veröffentlicht', publishFailed: 'Veröffentlichung umschalten fehlgeschlagen',
      deleted: 'Design gelöscht', deleteFailed: 'Löschen fehlgeschlagen',
      kitCreated: 'Brand-Kit erstellt', kitCreateFailed: 'Brand-Kit konnte nicht erstellt werden', kitDeleteFailed: 'Brand-Kit konnte nicht gelöscht werden',
      watermark: 'Wasserzeichen', watermarkPlaceholder: 'Wasserzeichen-Text', watermarkAdd: 'Anwenden', watermarkRemove: 'Entfernen',
      watermarkAdded: 'Wasserzeichen angewendet', watermarkRemoved: 'Wasserzeichen entfernt', watermarkEmpty: 'Text eingeben', watermarkFailed: 'Zuerst auf der Leinwand anwenden',
    },
    bulk: {
      title: 'Stapelgenerierung', subtitle: 'Ein Render pro Zeile oder Wertkombination.',
      source: 'Design-Quelle', chooseSource: 'Gespeichertes Design wählen', saveFirst: 'Speichere zuerst das Design — der Stapel nutzt das gespeicherte Dokument.',
      rowsTab: 'Zeilen (CSV/Tabelle)', valuesTab: 'Wert-Arrays', previewTab: 'Vorschau',
      importCsv: 'CSV importieren', addRow: 'Zeile hinzufügen', addColumn: 'Spalte hinzufügen',
      columnName: 'Spaltenname', pickVariable: 'Variablenname übernehmen', clientTitle: 'Generierung im Browser', clientDesc: 'Gäste rendern lokal; jede Zeile wird als PNG heruntergeladen. Kein Konto nötig.', useCurrentDesign: 'Aktuelles Design nutzen', importTemplate: 'Vorlagen-JSON importieren', templateLoaded: 'Vorlage geladen', templateWarnings: '{count} Importwarnung(en)', templateInvalid: 'Die Datei ist kein gültiges Vorlagen-JSON', serverLoginHint: 'Anmelden, um auf dem Server zu rendern und ein ZIP zu erhalten.', downloadedRows: '{count} Datei(en) heruntergeladen', noDocument: 'Öffne ein Design oder importiere eine Vorlage', noVariables: 'Öffne ein Design, um Variablen zu laden', customColumn: 'Eigener Spaltenname', createColumn: 'Spalte hinzufügen', renameHint: 'Klicke auf den Spaltennamen, um ihn zu bearbeiten – nutze die Variablennamen.', columnMismatch: 'Diese Spalte passt zu keiner Variablen', duplicateColumn: 'Eine Spalte mit diesem Namen existiert bereits',
      removeRow: 'Zeile entfernen', removeColumn: 'Spalte entfernen',
      csvHint: 'Spalten wie headline oder fields__headline__text füllen die Variablen. Erste Zeile = Kopfzeile.',
      csvLoaded: '{count} Zeilen importiert',
      noRows: { title: 'Noch keine Tabelle', desc: 'Importiere ein CSV oder füge Zeilen hinzu.' },
      addValueColumn: 'Wertspalte hinzufügen', valuesHint: 'Werte mit „|“ trennen — jede Kombination wird gerendert.',
      valuesPlaceholder: 'Wert 1 | Wert 2 | Wert 3', valueCount: '{count} Wert(e)',
      noValues: { title: 'Noch keine Wert-Arrays', desc: 'Füge pro Variable eine Spalte mit Werten hinzu.' },
      refreshPreviews: 'Vorschauen aktualisieren', previewLimit: 'Erste {count} Zeilen in der Vorschau',
      noPreviews: 'Noch keine Vorschauen', results: '{ok} von {total} gerendert', downloadZip: 'ZIP herunterladen',
      failures: '{count} Zeile(n) fehlgeschlagen', rowCount: '{count} Bild(er) werden generiert',
      generate: 'Stapel generieren', done: '{ok} von {total} Bildern gerendert',
      csvEmpty: 'Keine Datenzeilen in der CSV gefunden', requestFailed: 'Stapel-Anfrage fehlgeschlagen',
    },
  },
  Shape: {
    basic: { rect: 'Rechteck', circle: 'Kreis', triangle: 'Dreieck', quarter: 'Viertelkreis', arch: 'Bogen', blob: 'Kleckse', wave: 'Welle', waveDouble: 'Doppelwelle', lightning: 'Blitz', plus: 'Plus' },
    arrows: { right: 'Pfeil rechts', left: 'Pfeil links', up: 'Pfeil hoch', down: 'Pfeil runter', curve: 'Krummer Pfeil' },
    lines: { straight: 'Gerade Linie', dashed: 'Gestrichelte Linie', squiggle: 'Schnörkel', zigzag: 'Zickzack' },
    frames: { rect: 'Rahmen', corners: 'Eckenrahmen', scrap: 'Albumrahmen', film: 'Filmrahmen' },
    badge: { star5: 'Stern', heart: 'Herz', tag: 'Etikett', burst: 'Explosionsform', scroll: 'Schriftrolle', speech: 'Sprechblase' },
  },
}

const fr = {
  common: { search: 'Rechercher', stop: 'Arrêter', close: 'Fermer', reset: 'Réinitialiser', refresh: 'Actualiser' },
  studio: {
    auth: { title: 'Connectez-vous pour utiliser les designs', desc: 'Les modèles gratuits se modifient et s’exportent. Connectez-vous pour enregistrer, versions, kits et lots.', action: 'Se connecter', bulkTitle: 'Connectez-vous pour générer', bulkDesc: 'Enregistrez d’abord le design sur votre compte ; le lot utilise le document enregistré.' },
    color: { pick: 'Choisir une couleur', presets: 'Préréglages de marque', hex: 'Valeur hex' },
    variables: {
      refresh: 'Synchroniser les champs', count: '{count} variables', apply: 'Appliquer au canevas',
      valuePlaceholder: 'Valeur', selectLayer: 'Sélectionner le calque lié',
      targets: 'Lié à {count} calque(s)', applied: 'Appliqué à {count} calque(s)',
      createTitle: 'Créer depuis le calque sélectionné', namePlaceholder: 'Nom de variable, ex. titre', create: 'Créer la variable',
      created: 'Variable {name} créée', noSelection: 'Sélectionne d’abord un calque',
      bindProperty: 'Lier comme', bind: 'Lier la variable', bound: 'Calque lié à {name}',
      unbound: 'Aucun calque lié sur le canevas', noLayer: 'Calque lié absent du canevas',
      empty: { title: 'Pas encore de variables', desc: 'Nomme un calque comme « titre » ou lie linkData pour en créer une.' },
    },
    fieldProp: { text: 'Texte', image_url: 'Image', color: 'Couleur', font: 'Police', visible: 'Visibilité' },
    shapes: {
      primitives: 'Calques de base', svgImport: 'Importer un SVG', svgHint: 'Téléversez un fichier .svg pour l’ajouter comme calque groupé.', svgAdded: 'SVG ajouté', svgFailed: 'Impossible de lire ce SVG',
      primitive: { textbox: 'Texte', rect: 'Rect', circle: 'Cercle', ellipse: 'Ellipse', triangle: 'Triangle', line: 'Ligne', polygon: 'Polygone', polyline: 'Polyligne' },
      icons: 'Icônes (Iconify)', iconPlaceholder: 'Chercher des icônes, ex. star',
      qr: 'Code QR', qrPlaceholder: 'URL ou texte du code QR', qrAdd: 'Ajouter le QR', qrAdded: 'Code QR ajouté', qrFailed: 'Impossible d’ajouter le code QR',
      iconSearchFailed: 'Échec de la recherche d’icônes', iconAddFailed: 'Impossible d’ajouter l’icône',
    },
    stock: {
      pexels: 'Photos Pexels', unsplash: 'Unsplash', videos: 'Vidéos Pexels',
      placeholder: 'Rechercher…', empty: 'Aucun résultat', failed: 'La recherche a échoué', photoBy: 'Photo de', on: 'sur',
      insert: 'Ajouter un calque', background: 'Définir comme fond', replace: 'Remplacer la sélection',
      more: 'Charger plus', videoCopied: 'URL de la vidéo copiée', videoBgUnsupported: 'Une vidéo ne peut pas être le fond',
      replaceMissing: 'Sélectionne un calque image à remplacer',
    },
    fonts: {
      cat: { all: 'Toutes', local: 'Locales', sans: 'Sans', serif: 'Serif', display: 'Display', handwriting: 'Manuscrite', mono: 'Mono' },
      pairs: 'Paires de polices', pairsHint: 'Cliquez pour ajouter titre et corps', pairHeading: 'Titre', pairBody: 'Texte courant',
      pairAdded: 'Calques titre et corps ajoutés', sample: 'Créez plus vite avec des polices appariées',
      search: 'Rechercher parmi 1 900+ polices Google', loadingCatalog: 'Chargement de Google Fonts…', loadMore: 'Charger {count} de plus',
      noResults: 'Aucune police ne correspond', addedLayer: 'Calque texte en {family} ajouté',
      applied: 'Police appliquée à {count} calque(s)', pairApplied: 'Paire de polices appliquée',
      noText: 'Ajoute d’abord un calque de texte',
    },
    timeline: {
      preview: 'Aperçu', openBar: 'Piste de temps', editAsVideo: 'Modifier comme vidéo', animatedCount: '{count} animé(s)', page: 'Page', animate: 'Animer le calque', mp4: 'Exporter en MP4', mp4Ready: 'MP4 exporté', mp4Failed: 'Échec de l’export MP4', mp4Unavailable: 'L’éditeur charge encore',
      pageDuration: 'Durée de page', transitionLabel: 'Transition de page',
      transitionMs: 'ms', layers: 'Calques', refresh: 'Recharger les calques', edit: 'Modifier l’animation',
      noLayers: 'Aucun calque à animer', enterAnim: 'Animation d’entrée', enterMs: 'Durée ms',
      delayMs: 'Délai ms', loopAnim: 'Animation en boucle',
      transition: {
        none: 'Aucune', fade: 'Fondu', slideLeft: 'Gliss. gauche', slideRight: 'Gliss. droite',
        wipeUp: 'Balayage haut', zoomIn: 'Zoom in',
      },
      enter: {
        fadeIn: 'Apparaître', riseUp: 'Monter', dropDown: 'Tomber', slideLeft: 'Entrer à gauche',
        slideRight: 'Entrer à droite', zoomIn: 'Zoom in', zoomOut: 'Zoom out', wipeUp: 'Balayage',
        pop: 'Pop', none: 'Aucune',
      },
      loop: { none: 'Aucune', pulse: 'Pulsation', spin: 'Rotation', bob: 'Flotter', swing: 'Osciller', blink: 'Clignoter' },
    },
    templates: {
      import: 'Importer un modèle JSON', importHint: 'Le JSON Fabric v5/v7 est normalisé et enregistré comme design.',
      library: 'Bibliothèque de modèles', meta: '{pages} page(s) · {fields} variable(s)',
      empty: 'Pas encore de modèles', imported: 'Modèle importé', importFailed: 'Échec de l’import', opened: 'Modèle ouvert dans vos designs',
      openedGuest: 'Modèle ouvert', openedGuestDesc: 'Connectez-vous pour enregistrer une copie.',
    },
    resize: {
      modeLabel: 'Mode de redimensionnement', mode: { pad: 'Remplir (recentrer)', scale: 'Mettre à l’échelle', reflow: 'Refluer' },
      width: 'Largeur', height: 'Hauteur', apply: 'Redimensionner', fit: 'Ajuster le contenu', center: 'Centrer le contenu',
      applied: 'Appliqué : {size}', appliedTitle: '{name} appliqué',
      g: { social: 'Réseaux', print: 'Impression', web: 'Web', video: 'Vidéo' },
    },
    design: {
      title: 'Titre du design', titlePlaceholder: 'Design sans titre', save: 'Enregistrer le design',
      saveAsNew: 'Enregistrer comme nouveau', savedAs: 'Enregistré sous « {title} »', notSaved: 'Pas encore enregistré',
      publish: 'Basculer la publication', published: 'Publié', versions: 'Historique des versions',
      noVersions: 'Pas encore de versions', restore: 'Restaurer cette version', myDesigns: 'Mes designs',
      delete: 'Supprimer', more: 'Charger plus', kits: 'Kits de marque', applyKit: 'Appliquer le kit',
      kitName: 'Nom du kit', kitNameNeeded: 'Nomme d’abord le kit', kitCreate: 'Créer le kit',
      kitHeading: 'Police des titres', kitBody: 'Police du corps', kitApplied: 'Kit de marque appliqué',
      loading: 'L’éditeur charge encore', saved: 'Design enregistré', saveFailed: 'Échec de l’enregistrement — vérifiez la taille ou les champs',
      noDocument: 'Ce design n’a pas de document d’éditeur', openFailed: 'Impossible d’ouvrir le design',
      restored: 'Version restaurée', restoreFailed: 'Échec de la restauration',
      duplicated: 'Dupliqué dans Mes designs', duplicateFailed: 'Échec de la duplication',
      publishedOn: 'Publié dans les modèles', publishedOff: 'Non publié', publishFailed: 'Échec du changement de publication',
      deleted: 'Design supprimé', deleteFailed: 'Échec de la suppression',
      kitCreated: 'Kit de marque créé', kitCreateFailed: 'Échec de la création du kit', kitDeleteFailed: 'Échec de la suppression du kit',
      watermark: 'Filigrane', watermarkPlaceholder: 'Texte du filigrane', watermarkAdd: 'Appliquer', watermarkRemove: 'Retirer',
      watermarkAdded: 'Filigrane appliqué', watermarkRemoved: 'Filigrane retiré', watermarkEmpty: 'Saisis un texte', watermarkFailed: 'Applique d’abord sur le canevas',
    },
    bulk: {
      title: 'Génération en série', subtitle: 'Un rendu par ligne ou combinaison de valeurs.',
      source: 'Source du design', chooseSource: 'Choisir un design enregistré', saveFirst: 'Enregistre d’abord le design — la série utilise le document enregistré.',
      rowsTab: 'Lignes (CSV/tableau)', valuesTab: 'Listes de valeurs', previewTab: 'Aperçu',
      importCsv: 'Importer un CSV', addRow: 'Ajouter une ligne', addColumn: 'Ajouter une colonne',
      columnName: 'Nom de colonne', pickVariable: 'Reprendre une variable', clientTitle: 'Génération locale', clientDesc: 'Les invités génèrent dans ce navigateur ; chaque ligne se télécharge en PNG. Sans compte.', useCurrentDesign: 'Utiliser le design actuel', importTemplate: 'Importer un modèle JSON', templateLoaded: 'Modèle chargé', templateWarnings: '{count} avertissement(s) d’import', templateInvalid: 'Ce fichier n’est pas un JSON de modèle valide', serverLoginHint: 'Connectez-vous pour générer sur le serveur et obtenir un ZIP.', downloadedRows: '{count} fichier(s) téléchargé(s)', noDocument: 'Ouvrez un design ou importez un modèle', noVariables: 'Ouvrez un design pour charger ses variables', customColumn: 'Nom personnalisé', createColumn: 'Ajouter la colonne', renameHint: 'Cliquez sur le nom d’une colonne pour le modifier — utilisez les noms de variables.', columnMismatch: 'Cette colonne ne correspond à aucune variable', duplicateColumn: 'Une colonne de ce nom existe déjà',
      removeRow: 'Retirer la ligne', removeColumn: 'Retirer la colonne',
      csvHint: 'Les colonnes comme titre ou fields__titre__text alimentent les variables. Première ligne = en-têtes.',
      csvLoaded: '{count} lignes importées',
      noRows: { title: 'Pas encore de tableau', desc: 'Importe un CSV ou ajoute des lignes.' },
      addValueColumn: 'Ajouter une colonne de valeurs', valuesHint: 'Valeurs séparées par « | » — chaque combinaison est générée.',
      valuesPlaceholder: 'valeur 1 | valeur 2 | valeur 3', valueCount: '{count} valeur(s)',
      noValues: { title: 'Pas encore de listes', desc: 'Ajoute une colonne par variable avec ses valeurs.' },
      refreshPreviews: 'Actualiser les aperçus', previewLimit: '{count} premières lignes en aperçu',
      noPreviews: 'Pas encore d’aperçus', results: '{ok} sur {total} générés', downloadZip: 'Télécharger le ZIP',
      failures: '{count} ligne(s) en échec', rowCount: '{count} image(s) seront générées',
      generate: 'Générer la série', done: '{ok} sur {total} images générées',
      csvEmpty: 'Aucune ligne de données dans le CSV', requestFailed: 'Échec de la requête par lots',
    },
  },
  Shape: {
    basic: { rect: 'Rectangle', circle: 'Cercle', triangle: 'Triangle', quarter: 'Quart de cercle', arch: 'Arche', blob: 'Tache', wave: 'Vague', waveDouble: 'Double vague', lightning: 'Éclair', plus: 'Plus' },
    arrows: { right: 'Flèche droite', left: 'Flèche gauche', up: 'Flèche haut', down: 'Flèche bas', curve: 'Flèche courbée' },
    lines: { straight: 'Ligne droite', dashed: 'Ligne pointillée', squiggle: 'Gribouille', zigzag: 'Zigzag' },
    frames: { rect: 'Cadre', corners: 'Cadre à coins', scrap: 'Cadre d’album', film: 'Cadre de film' },
    badge: { star5: 'Étoile', heart: 'Cœur', tag: 'Étiquette', burst: 'Burst', scroll: 'Parchemin', speech: 'Bulle de dialogue' },
  },
}

const RAIL = {
  en: { variables: 'Variables', stock: 'Stock', fonts: 'Fonts', timeline: 'Timeline', resize: 'Resize', designs: 'Designs', background: 'Background',
    label: 'Tools', collapse: 'Collapse panel' },
  es: { variables: 'Variables', stock: 'Stock', fonts: 'Fuentes', timeline: 'Cronología', resize: 'Redimensionar', designs: 'Diseños', background: 'Fondo',
    label: 'Herramientas', collapse: 'Contraer panel' },
  de: { variables: 'Variablen', stock: 'Stock', fonts: 'Schriften', timeline: 'Zeitleiste', resize: 'Größe', designs: 'Designs', background: 'Hintergrund',
    label: 'Werkzeuge', collapse: 'Panel einklappen' },
  fr: { variables: 'Variables', stock: 'Stock', fonts: 'Polices', timeline: 'Chronologie', resize: 'Redimensionner', designs: 'Designs', background: 'Arrière-plan',
    label: 'Outils', collapse: 'Réduire le panneau' },
}

const SHAPE_CATS = {
  en: { basic: 'Basic', arrows: 'Arrows', lines: 'Lines', frames: 'Frames', badges: 'Badges' },
  es: { basic: 'Básicas', arrows: 'Flechas', lines: 'Líneas', frames: 'Marcos', badges: 'Insignias' },
  de: { basic: 'Basis', arrows: 'Pfeile', lines: 'Linien', frames: 'Rahmen', badges: 'Abzeichen' },
  fr: { basic: 'Basiques', arrows: 'Flèches', lines: 'Lignes', frames: 'Cadres', badges: 'Badges' },
}

const PANEL_TITLES = {
  en: { backgroundTitle: 'Background', variablesTitle: 'Variables', stockTitle: 'Stock library', fontsTitle: 'Fonts', timelineTitle: 'Animations', resizeTitle: 'Resize', designsTitle: 'My designs & brand kits' },
  es: { backgroundTitle: 'Fondo', variablesTitle: 'Variables', stockTitle: 'Biblioteca de stock', fontsTitle: 'Fuentes', timelineTitle: 'Animaciones', resizeTitle: 'Redimensionar', designsTitle: 'Mis diseños y kits' },
  de: { backgroundTitle: 'Hintergrund', variablesTitle: 'Variablen', stockTitle: 'Stock-Mediathek', fontsTitle: 'Schriften', timelineTitle: 'Animationen', resizeTitle: 'Größe ändern', designsTitle: 'Meine Designs & Brand-Kits' },
  fr: { backgroundTitle: 'Arrière-plan', variablesTitle: 'Variables', stockTitle: 'Bibliothèque de stock', fontsTitle: 'Polices', timelineTitle: 'Animations', resizeTitle: 'Redimensionner', designsTitle: 'Mes designs & kits' },
}

const SECTIONS = {
  en: { clip: 'Image clip', clipRounded: 'Clip rounded', removeClip: 'Remove clip', clipApplied: 'Image clipped', clipRemoved: 'Clip removed', clipFailed: 'Select an image layer first', fillSolid: 'Solid', fillGradient: 'Gradient', gradientStart: 'Start color', gradientEnd: 'End color', gradientAngle: 'Angle', applyGradient: 'Apply gradient' },
  es: { clip: 'Recorte de imagen', clipRounded: 'Recortar redondeado', removeClip: 'Quitar recorte', clipApplied: 'Imagen recortada', clipRemoved: 'Recorte eliminado', clipFailed: 'Selecciona una capa de imagen', fillSolid: 'Sólido', fillGradient: 'Degradado', gradientStart: 'Color inicial', gradientEnd: 'Color final', gradientAngle: 'Ángulo', applyGradient: 'Aplicar degradado' },
  de: { clip: 'Bildausschnitt', clipRounded: 'Abgerundet zuschneiden', removeClip: 'Zuschnitt entfernen', clipApplied: 'Bild zugeschnitten', clipRemoved: 'Zuschnitt entfernt', clipFailed: 'Wähle zuerst eine Bildebene', fillSolid: 'Einfarbig', fillGradient: 'Verlauf', gradientStart: 'Startfarbe', gradientEnd: 'Endfarbe', gradientAngle: 'Winkel', applyGradient: 'Verlauf anwenden' },
  fr: { clip: 'Découpe d’image', clipRounded: 'Découpe arrondie', removeClip: 'Retirer la découpe', clipApplied: 'Image découpée', clipRemoved: 'Découpe retirée', clipFailed: 'Sélectionne une image d’abord', fillSolid: 'Uni', fillGradient: 'Dégradé', gradientStart: 'Couleur de départ', gradientEnd: 'Couleur de fin', gradientAngle: 'Angle', applyGradient: 'Appliquer le dégradé' },
}

const BACKGROUNDS = {
  en: { colors: 'Colors', clear: 'Clear background', gradient: 'Gradient', searchPlaceholder: 'Search backgrounds…', loading: 'Loading Unsplash backgrounds…', empty: 'No backgrounds found', failed: 'Could not load backgrounds', applied: 'Background applied', cleared: 'Background cleared', setBackground: 'Set as background', photo: 'Unsplash photo', cat: { background: 'Background', design: 'Design', patterns: 'Patterns', wallpaper: 'Wallpaper', gradients: 'Gradients' } },
  es: { colors: 'Colores', clear: 'Quitar fondo', gradient: 'Degradado', searchPlaceholder: 'Buscar fondos…', loading: 'Cargando fondos de Unsplash…', empty: 'No se encontraron fondos', failed: 'No se pudieron cargar los fondos', applied: 'Fondo aplicado', cleared: 'Fondo quitado', setBackground: 'Usar como fondo', photo: 'Foto de Unsplash', cat: { background: 'Fondo', design: 'Diseño', patterns: 'Patrones', wallpaper: 'Fondos de pantalla', gradients: 'Degradados' } },
  de: { colors: 'Farben', clear: 'Hintergrund entfernen', gradient: 'Verlauf', searchPlaceholder: 'Hintergründe suchen…', loading: 'Unsplash-Hintergründe werden geladen…', empty: 'Keine Hintergründe gefunden', failed: 'Hintergründe konnten nicht geladen werden', applied: 'Hintergrund angewendet', cleared: 'Hintergrund entfernt', setBackground: 'Als Hintergrund', photo: 'Unsplash-Foto', cat: { background: 'Hintergrund', design: 'Design', patterns: 'Muster', wallpaper: 'Wallpaper', gradients: 'Verläufe' } },
  fr: { colors: 'Couleurs', clear: 'Retirer le fond', gradient: 'Dégradé', searchPlaceholder: 'Rechercher des fonds…', loading: 'Chargement des fonds Unsplash…', empty: 'Aucun fond trouvé', failed: 'Impossible de charger les fonds', applied: 'Fond appliqué', cleared: 'Fond retiré', setBackground: 'Définir comme fond', photo: 'Photo Unsplash', cat: { background: 'Arrière-plan', design: 'Design', patterns: 'Motifs', wallpaper: 'Fonds d’écran', gradients: 'Dégradés' } },
}

const LOCALES = { en, es, de, fr }

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = { ...(target[key] ?? {}), ...merge(target[key] ?? {}, value) }
    } else {
      target[key] = value
    }
  }
  return target
}

const json = JSON.parse(await readFile(FILE, 'utf8'))
for (const [locale, additions] of Object.entries(LOCALES)) {
  const target = json[locale]
  if (!target) throw new Error(`missing locale ${locale}`)
  merge(target.common ??= {}, additions.common)
  merge(target.studio ??= {}, additions.studio)
  merge(target.studio.background ??= {}, BACKGROUNDS[locale])
  merge(target.Shape ??= {}, additions.Shape)
  merge(target.rail ??= {}, RAIL[locale])
  target.studio.shapes ??= {}
  target.studio.shapes.cat = { ...(target.studio.shapes.cat ?? {}), ...SHAPE_CATS[locale] }
  merge(target.panel ??= {}, PANEL_TITLES[locale])
  merge(target.section ??= {}, SECTIONS[locale])
  target.menu ??= {}
  target.menu.main ??= {}
  target.menu.main.bulk = { en: 'Bulk generate', es: 'Generación masiva', de: 'Stapelgenerierung', fr: 'Génération en série' }[locale]
  target.menu.vertical ??= {}
  target.menu.vertical.resetZoom = { en: 'Reset zoom', es: 'Restablecer zoom', de: 'Zoom zurücksetzen', fr: 'Réinitialiser le zoom' }[locale]
}
await writeFile(FILE, `${JSON.stringify(json, null, 2)}\n`)
console.log('i18n merged for', Object.keys(LOCALES).join(', '))
