/* ==========================================================================
   views-data.js — Importar datos, Mapeo, Validación, Limpieza,
   Datos brutos vs procesados, Exploración y Análisis histórico.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, SP = SEDA.Specs, M = SEDA.Mapping, I = SEDA.Import, Q = SEDA.Quality, ML = SEDA.ML;
  var V = SEDA.Views = SEDA.Views || {};
  var st = function () { return SEDA.state; };
  var App = function () { return SEDA.App; };

  /* ================= IMPORTAR ================= */
  V.importar = {
    render: function (el) {
      var S = st();
      var h = V.head('Importar datos', 'Cargue datos históricos meteorológicos y energéticos. El archivo se lee en este equipo: nada se envía a internet. Formatos: Excel (.xlsx, .xls) y CSV/TXT (delimitador automático, coma o punto decimal, formato NASA POWER).');
      h += '<div class="import-grid">' +
        '<button class="btn btn-primary btn-xl" data-action="load-excel"><span class="bx-ico">📗</span>+ CARGAR EXCEL<span class="bx-sub">.xlsx · .xls</span></button>' +
        '<button class="btn btn-primary btn-xl" data-action="load-csv"><span class="bx-ico">📄</span>+ CARGAR CSV<span class="bx-sub">.csv · .txt · NASA POWER</span></button>' +
        '<button class="btn btn-xl" data-action="load-demo"><span class="bx-ico">🌞</span>CARGAR DATOS DE EJEMPLO<span class="bx-sub">Demo La Guajira (sintético)</span></button>' +
        '<button class="btn btn-xl" data-action="discard-data"><span class="bx-ico">🧽</span>LIMPIAR DATOS<span class="bx-sub">Quitar los datos cargados</span></button>' +
        '<button class="btn btn-xl btn-danger" data-action="delete-db"><span class="bx-ico">🗑</span>ELIMINAR BASE ACTUAL<span class="bx-sub">Borra la base local completa</span></button></div>';
      h += '<p class="small muted" style="margin-top:8px">También puede arrastrar y soltar un archivo sobre esta ventana. Fuentes compatibles: NASA POWER, IDEAM (DHIME), UPME, XM/SIEM, datos del sistema FV (inversor, datalogger) y datos propios. ' +
        'Descargue la <a href="#" id="dl-template">plantilla para datos reales (CSV)</a> o use los ejemplos de la carpeta <code>data/</code>.</p>';
      if (S.pending) h += V.sheetPicker(S.pending);
      if (S.raw && S.source) h += V.rawSummary(S);
      else if (!S.pending) h += V.empty('📂', 'Sin datos cargados', 'Cargue un archivo Excel o CSV, o use los datos sintéticos de demostración.', '<button class="btn btn-primary" data-action="load-excel">+ CARGAR EXCEL</button><button class="btn" data-action="load-csv">+ CARGAR CSV</button><button class="btn" data-action="load-demo">CARGAR DEMO LA GUAJIRA</button>');
      el.innerHTML = h;
      U.$('#dl-template').onclick = function (e) {
        e.preventDefault();
        var hdr = ['Fecha', 'Hora', 'GHI (W/m2)', 'DNI (W/m2)', 'DHI (W/m2)', 'Temperatura (°C)', 'Humedad relativa (%)', 'Velocidad viento (m/s)', 'Direccion viento (°)', 'Presion (hPa)', 'Precipitacion (mm)', 'Potencia FV (kW)', 'Consumo (kW)', 'SOC (%)'];
        U.download('plantilla_datos_reales_SEGAR.csv', U.toCSV(hdr, [['2026-01-01', '00:00', 0, 0, 0, 25.1, 82, 3.2, 70, 1011.2, 0, 0, 2.4, 55], ['2026-01-01', '01:00', 0, 0, 0, 24.8, 84, 3.0, 72, 1010.9, 0, 0, 2.3, 53]]), 'text/csv;charset=utf-8');
      };
      if (S.pending) V.bindSheetPicker(el);
    }
  };
  V.sheetPicker = function (P) {
    var h = '<div class="card" style="margin-top:16px"><div class="card-head"><h2>Seleccione la hoja que desea analizar</h2><div class="ch-actions"><span class="chip">' + U.esc(P.fileName) + '</span></div></div>' +
      '<p class="card-sub">Se encontraron ' + P.infos.length + ' hojas. Puede analizar una o varias: si comparten columnas se apilan; si tienen columnas distintas (p. ej. meteorología y generación) se unen por fecha-hora.</p>';
    h += U.table(['Analizar', 'Hoja', 'Filas', 'Columnas', 'Fecha/hora detectada', 'Columnas numéricas', 'Vista'], P.infos.map(function (s, i) {
      return ['<input type="checkbox" class="sheet-chk" value="' + U.esc(s.name) + '"' + (s.looksData ? ' checked' : '') + '>', '<b>Hoja ' + (i + 1) + ' — ' + U.esc(s.name) + '</b>', U.fmtInt(s.rows), s.cols,
        s.hasTime ? '<span class="status-ok">✓ sí</span>' : '<span class="status-warn">✗ no</span>', s.numericCols, '<button class="btn btn-sm" data-preview="' + i + '">Ver</button>'];
    }), { numCols: [2, 3, 5] });
    h += '<div id="sheet-preview" style="margin-top:12px"></div><div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-lg" id="sheets-go">ANALIZAR HOJAS SELECCIONADAS →</button></div></div>';
    return h;
  };
  V.bindSheetPicker = function (el) {
    var P = st().pending;
    U.$('#sheets-go').onclick = function () { SEDA.App.selectSheets(U.$$('.sheet-chk', el).filter(function (c) { return c.checked; }).map(function (c) { return c.value; })); };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-preview]'); if (!b) return;
      var s = P.infos[+b.getAttribute('data-preview')];
      U.$('#sheet-preview').innerHTML = '<h4>Vista previa — ' + U.esc(s.name) + '</h4>' + U.table(s.table.headers.map(U.esc), s.table.rows.slice(0, 8).map(function (r) { return r.map(function (v) { return U.esc(I.showVal(v)); }); }), { compact: true });
    });
  };
  V.rawSummary = function (S) {
    var src = S.source, raw = S.raw;
    var tile = function (l, v) { return '<div class="kpi accent"><div class="k-label">' + l + '</div><div class="k-value" style="font-size:1.15rem;word-break:break-word">' + v + '</div></div>'; };
    var h = '<div class="card" style="margin-top:16px"><div class="card-head"><h2>Archivo cargado</h2>' + (src.synthetic ? '<span class="chip synthetic">⚠ DATOS SINTÉTICOS DE DEMOSTRACIÓN — NO SON DATOS REALES</span>' : '') + '</div>';
    h += '<div class="grid g6">' + tile('Nombre del archivo', U.esc(src.fileName)) + tile('Hojas encontradas', src.sheetNames.length + ' <span class="small muted">(' + U.esc(src.sheetNames.join(', ')) + ')</span>') +
      tile('Registros', U.fmtInt(raw.rows.length)) + tile('Columnas', raw.headers.length) + tile('Fecha inicial', U.fmtDateTime(src.start)) + tile('Fecha final', U.fmtDateTime(src.end)) + '</div>';
    h += '<p class="small ink2" style="margin-top:10px">Hojas analizadas: <b>' + U.esc(src.selectedSheets.join(', ')) + '</b> · modo: ' + U.esc(src.mergeMode) + (src.nasa ? ' · <b>formato NASA POWER detectado</b>' : '') + (src.delimiter ? ' · delimitador «' + U.esc(src.delimiter) + '»' : '') + (src.encoding ? ' · codificación ' + U.esc(src.encoding) : '') + (src.sizeBytes ? ' · ' + U.fmt(src.sizeBytes / 1024, 0) + ' KB' : '') + '</p>';
    if (src.mergeLog && src.mergeLog.length) h += '<div class="alert info"><span class="ai">🔗</span><div>' + src.mergeLog.map(U.esc).join('<br>') + '</div></div>';
    if (src.demoIssues) h += '<div class="alert warn"><span class="ai">⚠</span><div><b>Datos sintéticos generados en el navegador</b> (modelo físico simplificado, 1 año horario). Para demostrar la validación y la limpieza se inyectaron problemas controlados: ' + src.demoIssues.map(U.esc).join('; ') + '.</div></div>';
    h += '<h3 style="margin-top:14px">Columnas, tipos de datos y valores vacíos</h3>' + U.table(['#', 'Columna', 'Tipo detectado', '% vacíos', '% numérico', 'Muestra'], S.rawDesc.map(function (d, i) {
      return [i + 1, '<b>' + U.esc(d.name) + '</b>', d.type, U.fmt(d.emptyPct, 1), U.fmt(d.numericPct, 1), '<span class="mono small">' + U.esc(d.sample.join(' · ')) + '</span>'];
    }), { numCols: [0, 3, 4], compact: true });
    h += '<h3 style="margin-top:14px">Primeras filas</h3>' + U.table(raw.headers.map(U.esc), raw.rows.slice(0, 8).map(function (r) { return r.map(function (v) { return U.esc(I.showVal(v)); }); }), { compact: true });
    h += '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary btn-lg" data-go="mapeo">Continuar → MAPEAR VARIABLES</button></div></div>';
    return h;
  };

  /* ================= MAPEO ================= */
  V.mapeo = {
    render: function (el) {
      var S = st();
      if (!S.raw) { el.innerHTML = V.head('Mapeo inteligente de variables', '') + V.empty('🔗', 'Primero cargue datos', 'El mapeo identifica automáticamente las columnas del archivo.', '<button class="btn btn-primary" data-go="importar">Ir a importar</button>'); return; }
      var map = S.mapping, hdr = S.raw.headers;
      var chk = M.check(map);
      var h = V.head('Mapeo inteligente de variables', 'La aplicación identifica automáticamente nombres similares (español/inglés, códigos NASA POWER e IDEAM, unidades en el encabezado) y verifica la plausibilidad del contenido. Puede cambiar manualmente cualquier asignación y unidad.',
        '<button class="btn" id="map-reset">↺ Restablecer mapeo automático</button><button class="btn btn-primary" id="map-apply">APLICAR MAPEO Y VALIDAR →</button>');
      h += chk.msgs.length ? '<div class="alert ' + (chk.ok ? 'warn' : 'crit') + '"><span class="ai">' + (chk.ok ? '⚠' : '⛔') + '</span><div>' + chk.msgs.map(U.esc).join('<br>') + '</div></div>' :
        '<div class="alert good"><span class="ai">✔</span><div>Mapeo suficiente: tiempo, variable objetivo (' + M.label(M.targetKey(map)) + ') y ' + chk.nFeatures + ' variables meteorológicas.' + (S.mappingConfirmed ? ' <b>Mapeo aplicado.</b>' : '') + '</div></div>';
      var roleLbl = { time: 'Tiempo', target: 'Objetivo', feature: 'Entrada ML', aux: 'Auxiliar' };
      var opts = function (sel) { return '<option value="-1">— no usar —</option>' + hdr.map(function (x, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + U.esc(x) + '</option>'; }).join(''); };
      var rows = M.VARS.map(function (v) {
        var m = map[v.key] || { col: -1 };
        var altTarget = v.role === 'target' && M.targetKey(map) && M.targetKey(map) !== v.key;
        var status = m.col < 0 ? (altTarget ? '<span class="status-off">— alternativa (no necesaria)</span>' : (v.role === 'time' && v.key !== 'FECHA') || v.role === 'aux' ? '<span class="status-off">— opcional</span>' : v.role === 'feature' ? '<span class="status-off">— no disponible</span>' : '<span class="status-warn">✗ no encontrado</span>') :
          m.status === 'manual' ? '<span class="status-ok">✓ manual</span>' : m.status === 'ok' ? '<span class="status-ok">✓</span>' : '<span class="status-warn">⚠ verificar</span>';
        var sample = '';
        if (m.col >= 0) {
          var smp = [], smp0 = [];
          for (var ri = 0; ri < Math.min(S.raw.rows.length, 2000) && smp.length < 3; ri++) {
            var cv = S.raw.rows[ri][m.col]; if (U.isEmpty(cv)) continue;
            if (smp0.length < 3) smp0.push(I.showVal(cv));
            if (v.role === 'time' || U.parseNumber(cv) !== 0) smp.push(I.showVal(cv));
          }
          sample = (smp.length ? smp : smp0).join(' · ');
        }
        var unit = v.units ? '<select data-unit="' + v.key + '"' + (m.col < 0 ? ' disabled' : '') + '>' + v.units.map(function (u) { return '<option' + (u === m.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>' : '<span class="muted">—</span>';
        return ['<b>' + v.label + '</b><div class="small muted">' + v.desc + '</div>', '<select data-map="' + v.key + '">' + opts(m.col) + '</select>', unit, '<span class="mono small">' + U.esc(sample) + '</span>', status, roleLbl[v.role]];
      });
      h += '<div class="card">' + U.table(['Variable detectada', 'Columna Excel / CSV', 'Unidad', 'Muestra', 'Estado', 'Rol'], rows) +
        '<p class="small muted" style="margin-top:8px">Tiempo: asigne <b>Fecha</b> (fecha o fecha-hora) y opcionalmente <b>Hora</b>; o bien los componentes Año + Mes + Día (+ Hora), como en NASA POWER. Las unidades se convierten a las canónicas: kW, kWh, W/m², °C, %, m/s, °, hPa, mm.</p></div>';
      el.innerHTML = h;
      var changed = function () {
        S.mappingConfirmed = false; S.parsed = null; SEDA.App.invalidateFrom(3); delete S.steps[2];
        SEDA.App.refreshChrome(); SEDA.App.persist();
      };
      U.$$('[data-map]', el).forEach(function (s) {
        s.onchange = function () {
          var k = s.getAttribute('data-map'), col = +s.value, v = M.byKey[k];
          S.mapping[k] = { col: col, score: 100, auto: false, status: col < 0 ? 'none' : 'manual', unit: v.units ? (col >= 0 ? M.detectUnit(k, hdr[col], S.raw.rows.slice(0, 300).map(function (r) { return r[col]; })) : v.unit) : undefined };
          changed(); V.mapeo.render(el);
        };
      });
      U.$$('[data-unit]', el).forEach(function (s) { s.onchange = function () { S.mapping[s.getAttribute('data-unit')].unit = s.value; changed(); }; });
      U.$('#map-reset').onclick = function () { S.mapping = M.autoMap(S.raw.headers, S.raw.rows); changed(); V.mapeo.render(el); U.toast('Mapeo automático restablecido.', 'info'); };
      U.$('#map-apply').onclick = function () { if (SEDA.App.applyMapping() && SEDA.App.runValidation()) { U.toast('Mapeo aplicado y datos validados.', 'good'); SEDA.App.go('validacion'); } };
    }
  };

  /* ================= VALIDACIÓN ================= */
  V.validacion = {
    render: function (el) {
      var S = st(), R = S.validation;
      var h = V.head('Validación de datos', 'Comprobación de fechas, valores numéricos, NaN, vacíos, duplicados, negativos, valores físicamente imposibles, rangos extremos, sensores congelados, coherencia irradiancia–potencia y discontinuidades temporales. La validación no modifica los datos.',
        '<button class="btn btn-primary" data-action="validate">✔ VALIDAR DATOS</button>' + (R ? '<button class="btn btn-accent" data-action="clean">🧹 LIMPIAR DATOS →</button>' : ''));
      if (!R) { el.innerHTML = h + V.empty('✔\uFE0F', 'Datos sin validar', S.raw ? 'Pulse VALIDAR DATOS para analizar la calidad del archivo.' : 'Primero cargue datos.', S.raw ? '<button class="btn btn-primary" data-action="validate">VALIDAR DATOS</button>' : '<button class="btn btn-primary" data-go="importar">Ir a importar</button>'); return; }
      var t6 = function (l, v, cls, sub) { return V.kpi(l, v, '', sub || '', cls); };
      h += '<div class="grid g6">' + t6('Registros totales', U.fmtInt(R.total), 'accent') + t6('Registros válidos', U.fmtInt(R.valid), 'good', U.fmtPct(R.valid / R.total * 100)) +
        t6('Registros con error', U.fmtInt(R.withErrors), R.withErrors ? 'warn' : 'good', U.fmtPct(R.withErrors / R.total * 100)) + t6('Datos faltantes', U.fmtInt(R.missingCells), R.missingCells ? 'warn' : 'good', 'celdas vacías, no numéricas o −999') +
        t6('Duplicados', U.fmtInt(R.duplicates), R.duplicates ? 'warn' : 'good', 'misma fecha-hora') + t6('Valores atípicos', U.fmtInt(R.outlierCells), R.outlierCells ? 'warn' : 'good', 'IQR×3 / P99.5×1.25') + '</div>';
      var q = R.quality;
      h += '<div class="grid g2"><div class="card"><div class="card-head"><h3>🧪 CALIDAD DE DATOS: ' + U.fmt(q.score, 1) + ' %</h3></div>' + V.meter(q.score, V.qualityColor(q.score)) +
        U.table(['Componente', 'Definición', 'Valor'], [
          ['C — Completitud', '1 − celdas faltantes / celdas totales', U.fmtPct(q.C * 100, 2)],
          ['K — Consistencia', '1 − registros con imposibles, negativos, sensor congelado o inconsistencia / registros', U.fmtPct(q.K * 100, 2)],
          ['T — Continuidad temporal', 'marcas únicas / marcas esperadas', U.fmtPct(q.T * 100, 2)],
          ['O — Atípicos', '1 − registros con atípicos / registros', U.fmtPct(q.O * 100, 2)],
          ['V — Validez', 'registros sin problemas / registros totales', U.fmtPct(q.V * 100, 2)]
        ], { numCols: [2], compact: true }) + '<p class="small muted" style="margin-top:8px">Calidad = 100 × (C + K + T + O + V) / 5. Método explícito, sin ponderaciones ocultas.</p></div>';
      h += '<div class="card"><h3>⏱ Continuidad temporal</h3>' + U.table(['Indicador', 'Valor'], [
        ['Paso temporal detectado', R.stepLabel], ['Período', U.fmtDateTime(R.start) + ' → ' + U.fmtDateTime(R.end)], ['Fechas no interpretables', U.fmtInt(R.invalidDates)],
        ['Registros fuera de orden', U.fmtInt(R.outOfOrder)], ['Discontinuidades (huecos)', U.fmtInt(R.gaps)], ['Marcas de tiempo ausentes', U.fmtInt(R.missingTimestamps) + ' de ' + U.fmtInt(R.expectedTs) + ' esperadas'],
        ['Mayor hueco', U.fmt(R.largestGapH, 1) + ' h'], ['Inconsistencias irradiancia–potencia', U.fmtInt(R.inconsistent)]
      ], { compact: true }) + (R.gapList.length ? '<p class="small ink2" style="margin-top:8px"><b>Huecos:</b> ' + R.gapList.slice(0, 8).map(function (g) { return U.fmtDateTime(g.from) + ' → ' + U.fmtDateTime(g.to) + ' (' + g.missing + ' faltantes)'; }).join('; ') + (R.gapList.length > 8 ? '…' : '') + '</p>' : '') + '</div></div>';
      var rows = R.keys.map(function (k) {
        var s = R.perVar[k];
        var cell = function (v) { return v ? '<b class="status-warn">' + U.fmtInt(v) + '</b>' : '0'; };
        return ['<b>' + U.esc(s.label) + '</b>', U.esc(s.unit), U.fmtInt(s.n), cell(s.empty), cell(s.nonNumeric), cell(s.sentinel), cell(s.negatives), cell(s.impossible), cell(s.outliers), cell(s.frozen), U.fmtAuto(s.min), U.fmtAuto(s.max), U.fmtAuto(s.mean), '<span class="small muted">' + U.esc(s.why) + '</span>'];
      });
      h += '<div class="card"><h3>Detalle por variable</h3>' + U.table(['Variable', 'Unidad', 'N', 'Vacíos / NaN', 'No numéricos', 'Código −999', 'Negativos', 'Físicamente imposibles', 'Atípicos', 'Sensor congelado', 'Mín*', 'Máx*', 'Media', 'Criterio físico'], rows, { numCols: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }) +
        '<p class="small muted" style="margin-top:8px">* Mínimo y máximo excluyendo valores físicamente imposibles. Atípicos: fuera de [Q1 − 3·IQR, Q3 + 3·IQR] (temperatura, humedad, viento, presión, consumo) o potencia &gt; 1.25 × P99.5. Sensor congelado: ≥ 6 lecturas idénticas consecutivas (≥ 4 para irradiancia y potencia distintas de cero, excluyendo la meseta de recorte del inversor).</p></div>';
      el.innerHTML = h;
    }
  };

  /* ================= LIMPIEZA ================= */
  V.limpieza = {
    render: function (el) {
      var S = st(), o = S.cleanOpts, c = S.clean;
      var h = V.head('Limpieza y preprocesamiento', 'Cada operación queda registrada con hora, conteo y criterio. No se realizan modificaciones silenciosas.',
        '<button class="btn btn-primary" id="cl-run">🧹 LIMPIAR DATOS</button>' + (c ? '<button class="btn" data-go="datos">Comparar brutos vs procesados →</button>' : ''));
      var ck = function (k, label, desc) { return '<label class="check"><input type="checkbox" data-opt="' + k + '"' + (o[k] ? ' checked' : '') + '><span>' + label + '<span class="cdesc">' + desc + '</span></span></label>'; };
      h += '<div class="card"><div class="card-head"><h3>Opciones de limpieza</h3></div><div class="grid g2"><div>' +
        ck('dropDup', 'Eliminar duplicados', 'Misma fecha-hora; se conserva la primera ocurrencia.') +
        ck('sortTime', 'Ordenar cronológicamente', 'Por fecha + hora (siempre necesario para la división cronológica).') +
        ck('fixSmallNeg', 'Corregir negativos pequeños a 0', 'Irradiancia ≥ −20 W/m² (offset del piranómetro) y potencia ≥ −2 % del máximo (autoconsumo del inversor).') +
        ck('impossibleToNaN', 'Valores físicamente imposibles → faltante', 'Fuera de los rangos físicos documentados en la validación.') +
        ck('outliersToNaN', 'Valores atípicos → faltante', 'Criterio IQR × 3 o potencia > 1.25 × P99.5. Desmarque para solo reportarlos.') + '</div><div>' +
        ck('frozenToNaN', 'Errores de sensor (congelado) → faltante', 'Lecturas idénticas consecutivas.') +
        ck('excludeInconsistent', 'Excluir inconsistencias irradiancia–potencia del entrenamiento', 'Falla de inversor o sensor: la variable objetivo se marca como faltante.') +
        ck('interpolate', 'Interpolar huecos cortos (lineal)', 'Solo variables meteorológicas continuas; nunca dirección del viento ni precipitación.') +
        ck('interpolateTarget', 'Interpolar también la variable objetivo', 'Desactivado por defecto: los huecos de la variable objetivo se excluyen.') +
        '<label class="f" style="max-width:260px;margin-top:6px">Máximo de registros consecutivos a interpolar<input type="number" min="0" max="12" step="1" id="cl-gap" value="' + o.maxGap + '"></label></div></div>' +
        '<p class="small muted" style="margin-top:8px">Siempre se aplican: conversión de fechas y números, tratamiento de códigos −999 y exclusión de registros sin fecha válida. Los registros con variables faltantes que usa el modelo se excluyen del entrenamiento (se informa el conteo).</p></div>';
      if (c) {
        var s = c.summary;
        h += '<div class="grid g6">' + V.kpi('Registros brutos', U.fmtInt(s.rawRows), '', '', 'accent') + V.kpi('Registros procesados', U.fmtInt(s.finalRows), '', U.fmtInt(s.completeRows) + ' completos', 'good') +
          V.kpi('Registros eliminados', U.fmtInt(s.removedInvalidDate + s.removedDup), '', s.removedDup + ' duplicados · ' + s.removedInvalidDate + ' sin fecha', 'warn') +
          V.kpi('Valores corregidos', U.fmtInt(s.corrected), '', 'negativos → 0', 'warn') + V.kpi('Valores interpolados', U.fmtInt(s.interpolated), '', 'huecos ≤ ' + c.opts.maxGap + ' registros', 'accent') +
          V.kpi('Valores invalidados', U.fmtInt(s.invalidated), '', 'convertidos a faltante', 'warn') + '</div>';
        h += '<div class="card"><div class="card-head"><h3>REGISTRO DE LIMPIEZA</h3><div class="ch-actions"><button class="btn btn-sm" id="cl-log">⬇ Descargar registro (TXT)</button></div></div><div class="log">' +
          c.log.map(function (l) { return '<div class="le"><span class="lt">' + l.time + '</span><span class="' + (l.type === 'warn' ? 'warn' : l.type === 'act' ? 'act' : '') + '">' + U.esc(l.msg) + '</span></div>'; }).join('') + '</div></div>';
      } else if (!S.raw) h += V.empty('🧹', 'Primero cargue datos', '', '<button class="btn btn-primary" data-go="importar">Ir a importar</button>');
      el.innerHTML = h;
      U.$$('[data-opt]', el).forEach(function (x) { x.onchange = function () { o[x.getAttribute('data-opt')] = x.checked; SEDA.App.persist(); }; });
      U.$('#cl-gap').onchange = function () { o.maxGap = U.clamp(Math.round(+this.value || 0), 0, 12); SEDA.App.persist(); };
      U.$('#cl-run').onclick = function () { if (SEDA.App.runCleaning()) { U.toast('Limpieza completada.', 'good'); V.limpieza.render(el); } };
      if (c) U.$('#cl-log').onclick = function () {
        U.download('registro_limpieza_' + (S.runId || '') + '.txt', 'REGISTRO DE LIMPIEZA — ' + (S.runId || '') + '\r\nArchivo: ' + (S.source ? S.source.fileName : '') + '\r\n\r\n' + c.log.map(function (l) { return l.time + '  ' + l.msg; }).join('\r\n'), 'text/plain;charset=utf-8');
      };
    }
  };

  /* ================= BRUTOS VS PROCESADOS ================= */
  var dv = { tab: 'raw', page: 0, onlyChanged: false };
  V.datos = {
    render: function (el) {
      var S = st();
      var h = V.head('Datos brutos vs datos procesados', 'Compare el archivo original con el conjunto limpio usado por el modelo. Las celdas modificadas se resaltan.', S.processed ? '<button class="btn" data-action="dl-processed">⬇ DESCARGAR DATOS PROCESADOS</button>' : '');
      if (!S.raw) { el.innerHTML = h + V.empty('🗂\uFE0F', 'Sin datos', 'Cargue datos para comparar.', '<button class="btn btn-primary" data-go="importar">Ir a importar</button>'); return; }
      var pr = S.processed, cs = S.clean ? S.clean.summary : null, R = S.validation;
      var cnt = function (flag) { if (!pr) return NaN; var n = 0; pr.keys.forEach(function (k) { var f = pr.flags[k]; for (var i = 0; i < f.length; i++) if (f[i] === flag) n++; }); return n; };
      h += '<div class="card"><h3>Comparación</h3>' + U.table(['Indicador', 'Datos brutos', 'Datos procesados'], [
        ['Filas', U.fmtInt(S.raw.rows.length), pr ? U.fmtInt(pr.n) : '—'],
        ['Columnas', U.fmtInt(S.raw.headers.length), pr ? (pr.keys.length + 1) + ' (fecha-hora + ' + pr.keys.length + ' variables canónicas)' : '—'],
        ['Valores faltantes', R ? U.fmtInt(R.missingCells) : '—', cs ? U.fmtInt(cs.missingLeftTotal) : '—'],
        ['Valores corregidos', '—', cs ? U.fmtInt(cs.corrected) : '—'],
        ['Valores interpolados', '—', cs ? U.fmtInt(cs.interpolated) : '—'],
        ['Valores invalidados (→ faltante)', '—', cs ? U.fmtInt(cs.invalidated) : '—'],
        ['Registros eliminados', '—', cs ? U.fmtInt(cs.removedDup + cs.removedInvalidDate) + ' (' + cs.removedDup + ' duplicados, ' + cs.removedInvalidDate + ' sin fecha)' : '—']
      ], { numCols: [1] }) + (pr ? '' : '<p class="small muted">Ejecute la limpieza para generar los datos procesados.</p>') + '</div>';
      h += '<div class="card"><div class="tabs"><button class="tab ' + (dv.tab === 'raw' ? 'active' : '') + '" data-tab="raw">Datos brutos</button><button class="tab ' + (dv.tab === 'proc' ? 'active' : '') + '" data-tab="proc"' + (pr ? '' : ' disabled') + '>Datos procesados</button></div><div id="dv-body"></div></div>';
      el.innerHTML = h;
      var body = U.$('#dv-body');
      var draw = function () {
        var PAGE = 100, rows = [], total, html = '';
        if (dv.tab === 'raw' || !pr) {
          total = S.raw.rows.length;
          var from = dv.page * PAGE;
          rows = S.raw.rows.slice(from, from + PAGE).map(function (r, i) { return ['<span class="muted">' + (from + i + 1) + '</span>'].concat(r.map(function (v) { return U.isEmpty(v) ? '<span class="muted">∅</span>' : U.esc(I.showVal(v)); })); });
          html = U.table(['#'].concat(S.raw.headers.map(U.esc)), rows, { compact: true, tall: true });
        } else {
          var idx = [];
          for (var i = 0; i < pr.n; i++) {
            if (dv.onlyChanged) { var ch = pr.keys.some(function (k) { return pr.flags[k][i] !== Q.P_ORIG; }); if (!ch) continue; }
            idx.push(i);
          }
          total = idx.length;
          var slice = idx.slice(dv.page * PAGE, dv.page * PAGE + PAGE);
          var cls = ['', 'c-corr', 'c-interp', 'c-inval', 'c-miss'];
          var tr = slice.map(function (r) {
            return '<tr><td class="muted">' + (r + 1) + '</td><td class="nowrap">' + U.fmtDateTime(pr.t[r]) + '</td>' + pr.keys.map(function (k) {
              var f = pr.flags[k][r], v = pr.vars[k][r];
              var raw = f === Q.P_CORR || f === Q.P_INVAL || f === Q.P_INTERP ? ' title="Valor original: ' + U.esc(I.showVal(S.raw.rows[pr.src[r]][S.mapping[k].col])) + '"' : '';
              return '<td class="n ' + cls[f] + '"' + raw + '>' + (isFinite(v) ? U.fmtAuto(v) : (f === Q.P_INVAL ? U.esc(I.showVal(S.raw.rows[pr.src[r]][S.mapping[k].col])) : '∅')) + '</td>';
            }).join('') + '</tr>';
          }).join('');
          html = '<div class="legend-cells"><span><i style="background:#fff1c2"></i>corregido</span><span><i style="background:#dcefff"></i>interpolado</span><span><i style="background:#ffdcdc"></i>invalidado (→ faltante)</span><span><i class="c-miss" style="background:repeating-linear-gradient(135deg,transparent,transparent 3px,#ccc 3px,#ccc 4px)"></i>faltante</span>' +
            '<label class="check" style="padding:0;margin-left:auto"><input type="checkbox" id="dv-only"' + (dv.onlyChanged ? ' checked' : '') + '> solo filas modificadas</label></div>' +
            '<div class="table-wrap tall"><table class="t compact"><thead><tr><th>#</th><th>Fecha-hora</th>' + pr.keys.map(function (k) { return '<th class="n">' + U.esc(M.label(k)) + ' [' + U.esc(pr.units[k]) + ']</th>'; }).join('') + '</tr></thead><tbody>' + (tr || '<tr><td colspan="99" class="muted">Sin filas</td></tr>') + '</tbody></table></div>';
        }
        var pages = Math.max(1, Math.ceil(total / PAGE));
        if (dv.page >= pages) dv.page = pages - 1;
        html += '<div class="pager"><button class="btn btn-sm" id="pg-prev"' + (dv.page <= 0 ? ' disabled' : '') + '>‹ Anterior</button><span>Página <b>' + (dv.page + 1) + '</b> de ' + pages + ' · ' + U.fmtInt(total) + ' filas</span><button class="btn btn-sm" id="pg-next"' + (dv.page >= pages - 1 ? ' disabled' : '') + '>Siguiente ›</button>' +
          '<label class="small">Ir a página <input type="number" id="pg-go" min="1" max="' + pages + '" value="' + (dv.page + 1) + '" style="width:80px"></label></div>';
        body.innerHTML = html;
        U.$('#pg-prev').onclick = function () { dv.page--; draw(); };
        U.$('#pg-next').onclick = function () { dv.page++; draw(); };
        U.$('#pg-go').onchange = function () { dv.page = U.clamp((+this.value || 1) - 1, 0, pages - 1); draw(); };
        var only = U.$('#dv-only'); if (only) only.onchange = function () { dv.onlyChanged = only.checked; dv.page = 0; draw(); };
      };
      U.$$('[data-tab]', el).forEach(function (b) { b.onclick = function () { if (b.disabled) return; dv.tab = b.getAttribute('data-tab'); dv.page = 0; U.$$('[data-tab]', el).forEach(function (x) { x.classList.toggle('active', x === b); }); draw(); }; });
      draw();
    }
  };

  /* ================= EXPLORACIÓN ================= */
  V.exploracion = {
    render: function (el) {
      var S = st(), pr = S.processed;
      var h = V.head('Exploración de datos', 'Estadística descriptiva y relaciones entre las variables meteorológicas y la generación fotovoltaica (datos procesados).');
      if (!pr) { el.innerHTML = h + V.empty('🔎', 'Datos no procesados', 'Ejecute la validación y la limpieza para explorar los datos.', '<button class="btn btn-primary" data-action="clean">LIMPIAR DATOS</button>'); return; }
      var rows = [pr.targetKey].concat(pr.keys.filter(function (k) { return k !== pr.targetKey; })).map(function (k) {
        var s = U.sortedFinite(pr.vars[k]);
        return ['<b>' + U.esc(M.label(k)) + '</b>', U.esc(pr.units[k]), U.fmtInt(s.length), U.fmtAuto(U.mean(s)), U.fmtAuto(U.std(s)), U.fmtAuto(s[0]), U.fmtAuto(U.quantileSorted(s, 0.25)), U.fmtAuto(U.quantileSorted(s, 0.5)), U.fmtAuto(U.quantileSorted(s, 0.75)), U.fmtAuto(s[s.length - 1])];
      });
      h += '<div class="card"><h3>Estadística descriptiva</h3>' + U.table(['Variable', 'Unidad', 'N', 'Media', 'Desv. est.', 'Mín', 'P25', 'Mediana', 'P75', 'Máx'], rows, { numCols: [2, 3, 4, 5, 6, 7, 8, 9], compact: true }) + '</div>';
      h += '<div class="grid g2">' + C.card('ex-daily', 'Generación solar histórica', 'Energía FV diaria [kWh] (días con ≥ 50 % de registros)', 280) + C.card('ex-hour', 'Perfil horario medio', 'Potencia FV media por hora del día', 280) + '</div>';
      h += '<div class="grid g2">' + C.card('ex-month', 'Estacionalidad', 'Energía media diaria por mes', 280) + C.card('ex-hist', 'Distribución de la potencia', 'Histograma de la potencia FV (valores > 0)', 280) + '</div>';
      h += '<div class="grid g2">' + C.card('ex-irr', 'Irradiancia vs generación', 'Cada punto es un registro', 300) + C.card('ex-temp', 'Temperatura vs generación', 'Horas diurnas (irradiancia > 10 W/m²)', 300) + '</div>';
      h += '<div class="grid g2">' + C.card('ex-wind', 'Velocidad del viento vs generación', 'Horas diurnas', 300) + C.card('ex-hum', 'Humedad vs generación', 'Horas diurnas', 300) + '</div>';
      h += '<div style="margin-top:16px">' + C.card('ex-corr', 'Matriz de correlación (Pearson)', 'Relación lineal entre variables; azul = negativa, rojo = positiva', 440, 'La correlación no implica causalidad: describe asociación lineal en los datos históricos.') + '</div>';
      el.innerHTML = h;
      var daily = SEDA.App.daily();
      C.mount(U.$('#ex-daily'), SP.dailyEnergy(daily));
      C.mount(U.$('#ex-hour'), SP.hourlyProfile(pr));
      C.mount(U.$('#ex-month'), SP.monthlyEnergy(daily));
      C.mount(U.$('#ex-hist'), SP.histTarget(pr));
      C.mount(U.$('#ex-irr'), SP.scatterVs(pr, pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : 'IRR_POA'));
      C.mount(U.$('#ex-temp'), SP.scatterVs(pr, 'TEMPERATURA'));
      C.mount(U.$('#ex-wind'), SP.scatterVs(pr, 'VEL_VIENTO'));
      C.mount(U.$('#ex-hum'), SP.scatterVs(pr, 'HUMEDAD'));
      C.mount(U.$('#ex-corr'), SP.corr(pr));
    }
  };

  /* ================= ANÁLISIS HISTÓRICO ================= */
  var hv = { period: 'semana', anchor: null, from: null, to: null };
  V.historico = {
    render: function (el) {
      var S = st(), pr = S.processed;
      var h = V.head('Análisis histórico', 'Consulte cualquier día, semana, mes, año o rango personalizado de los datos procesados.');
      if (!pr) { el.innerHTML = h + V.empty('📅', 'Datos no procesados', 'Ejecute la limpieza para habilitar el análisis histórico.', '<button class="btn btn-primary" data-action="clean">LIMPIAR DATOS</button>'); return; }
      var t0 = U.dayStart(pr.t[0]), t1 = U.dayStart(pr.t[pr.n - 1]);
      if (hv.anchor == null || hv.anchor < t0 || hv.anchor > t1) hv.anchor = Math.max(t0, t1 - 6 * U.DAY);
      var range = V.historico.range(t0, t1);
      h += '<div class="card"><div class="form-grid" style="align-items:end">' +
        '<label class="f">Período<select id="hv-p">' + [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año'], ['rango', 'Rango personalizado']].map(function (o) { return '<option value="' + o[0] + '"' + (hv.period === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        (hv.period === 'rango' ? '<label class="f">Desde<input type="date" id="hv-from" value="' + U.fmtDate(range[0]) + '" min="' + U.fmtDate(t0) + '" max="' + U.fmtDate(t1) + '"></label><label class="f">Hasta (inclusive)<input type="date" id="hv-to" value="' + U.fmtDate(range[1] - U.DAY) + '" min="' + U.fmtDate(t0) + '" max="' + U.fmtDate(t1) + '"></label>' :
          '<label class="f">Fecha de referencia<input type="date" id="hv-a" value="' + U.fmtDate(hv.anchor) + '" min="' + U.fmtDate(t0) + '" max="' + U.fmtDate(t1) + '"></label>') +
        '<div class="btn-row"><button class="btn" id="hv-prev">‹ Anterior</button><button class="btn" id="hv-next">Siguiente ›</button></div></div>' +
        '<p class="small muted" style="margin-top:8px">Mostrando <b>' + U.fmtDate(range[0]) + '</b> a <b>' + U.fmtDate(range[1] - 1) + '</b>. Datos disponibles: ' + U.fmtDate(t0) + ' → ' + U.fmtDate(t1) + '.</p></div>';
      var daily = SEDA.App.daily().filter(function (d) { return d.day >= range[0] && d.day < range[1]; });
      var E = U.sum(daily.map(function (d) { return d.energy; })), nd = daily.filter(function (d) { return isFinite(d.energy); }).length;
      var pmax = Math.max.apply(null, daily.map(function (d) { return isFinite(d.pmax) ? d.pmax : 0; }).concat([0]));
      h += '<div class="grid g6">' + V.kpi('Energía FV total', U.fmt(E, 1), 'kWh', '', 'accent', '☀') + V.kpi('Media diaria', U.fmt(nd ? E / nd : NaN, 1), 'kWh/día', '', '', '📊') + V.kpi('Potencia máxima', U.fmt(pmax, 2), 'kW', '', '', '⚡') +
        V.kpi('Irradiación total', U.fmt(U.sum(daily.map(function (d) { return d.irr; })), 1), 'kWh/m²', '', '', '🌞') + V.kpi('Temperatura media', U.fmt(U.mean(daily.map(function (d) { return d.tmean; })), 1), '°C', '', '', '🌡') + V.kpi('Días con datos', U.fmtInt(nd), '', '', '', '📅') + '</div>';
      var span = range[1] - range[0];
      h += '<div class="grid g2">' + C.card('hv-power', span <= 31 * U.DAY ? 'Potencia FV' : 'Energía FV diaria', span <= 31 * U.DAY ? 'Serie en resolución original' : 'kWh por día', 280) + C.card('hv-energy', span > 62 * U.DAY ? 'Energía FV mensual' : 'Energía FV diaria', span > 62 * U.DAY ? 'kWh por mes' : 'kWh por día', 280) + '</div>';
      h += '<div class="grid g2">' + C.card('hv-irr', 'Irradiancia', 'Serie en resolución original', 260) + C.card('hv-temp', 'Temperatura ambiente', 'Serie en resolución original', 260) + '</div>';
      h += '<div class="card" style="margin-top:16px"><h3>Resumen diario</h3>' + U.table(['Fecha', 'Energía FV [kWh]', 'Potencia máx. [kW]', 'Irradiación [kWh/m²]', 'T media [°C]', 'HR media [%]', 'Viento medio [m/s]', 'Precipitación [mm]', 'Consumo [kWh]', 'Cobertura'], daily.map(function (d) {
        return ['<span class="nowrap">' + U.fmtDate(d.day) + ' <span class="muted">' + U.DIAS[new Date(d.day).getUTCDay()] + '</span></span>', U.fmt(d.energy, 1), U.fmt(d.pmax, 2), U.fmt(d.irr, 2), U.fmt(d.tmean, 1), U.fmt(d.hmean, 0), U.fmt(d.wmean, 1), U.fmt(d.prec, 1), U.fmt(d.load, 1), U.fmtPct(d.coverage * 100, 0)];
      }), { numCols: [1, 2, 3, 4, 5, 6, 7, 8, 9], compact: true, tall: true }) + '</div>';
      el.innerHTML = h;
      var allDaily = SEDA.App.daily();
      C.mount(U.$('#hv-power'), span <= 31 * U.DAY ? SP.series(pr, pr.targetKey, range[0], range[1], 0) : SP.dailyBars(allDaily, range[0], range[1]));
      C.mount(U.$('#hv-energy'), span > 62 * U.DAY ? SP.monthlyBars(allDaily, range[0], range[1]) : SP.dailyBars(allDaily, range[0], range[1]));
      C.mount(U.$('#hv-irr'), SP.series(pr, pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : 'IRR_POA', range[0], range[1], 3));
      C.mount(U.$('#hv-temp'), SP.series(pr, 'TEMPERATURA', range[0], range[1], 1));
      U.$('#hv-p').onchange = function () { hv.period = this.value; if (hv.period === 'rango') { hv.from = range[0]; hv.to = range[1]; } V.historico.render(el); };
      var a = U.$('#hv-a'); if (a) a.onchange = function () { var v = U.parseDateInput(this.value); if (isFinite(v)) { hv.anchor = v; V.historico.render(el); } };
      var f = U.$('#hv-from'), t = U.$('#hv-to');
      if (f) f.onchange = function () { var v = U.parseDateInput(this.value); if (isFinite(v)) { hv.from = v; if (hv.to <= v) hv.to = v + U.DAY; V.historico.render(el); } };
      if (t) t.onchange = function () { var v = U.parseDateInput(this.value); if (isFinite(v)) { hv.to = v + U.DAY; if (hv.from >= hv.to) hv.from = v; V.historico.render(el); } };
      var shift = function (dir) {
        if (hv.period === 'rango') { var w = hv.to - hv.from; hv.from += dir * w; hv.to += dir * w; }
        else if (hv.period === 'dia') hv.anchor += dir * U.DAY;
        else if (hv.period === 'semana') hv.anchor += dir * 7 * U.DAY;
        else { var d = new Date(hv.anchor); hv.anchor = hv.period === 'mes' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1) : Date.UTC(d.getUTCFullYear() + dir, 0, 1); }
        V.historico.render(el);
      };
      U.$('#hv-prev').onclick = function () { shift(-1); };
      U.$('#hv-next').onclick = function () { shift(1); };
    },
    range: function (t0, t1) {
      var a = hv.anchor, d = new Date(a);
      switch (hv.period) {
        case 'dia': return [a, a + U.DAY];
        case 'semana': return [a, a + 7 * U.DAY];
        case 'mes': return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)];
        case 'anio': return [Date.UTC(d.getUTCFullYear(), 0, 1), Date.UTC(d.getUTCFullYear() + 1, 0, 1)];
        default:
          if (hv.from == null || hv.to == null) { hv.from = t0; hv.to = t1 + U.DAY; }
          return [hv.from, hv.to];
      }
    }
  };
})();
