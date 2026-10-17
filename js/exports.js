/* ==========================================================================
   exports.js — Descargas: informe HTML, resultados Excel (SheetJS local),
   resultados CSV, datos procesados CSV y configuración JSON (y su carga).
   Todo se genera en el navegador; ninguna descarga requiere internet.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, M = SEDA.Mapping, ML = SEDA.ML, Q = SEDA.Quality, D = SEDA.Decision;
  var E = SEDA.Exports = {};
  var st = function () { return SEDA.state; };
  var base = function () { var S = st(); return 'SEGAR_' + (S.runId || 'sin_run'); };
  function need(what) {
    var S = st();
    if (what === 'model' && !S.evaluation) { U.toast('Primero entrene el modelo.', 'warn'); SEDA.App.go('modelo'); return false; }
    if (what === 'processed' && !S.processed) { U.toast('Primero valide y limpie los datos.', 'warn'); SEDA.App.go('limpieza'); return false; }
    return true;
  }
  function markDownload() { var S = st(); if (!S.steps[15]) SEDA.App.done(15); }

  E.reportHTML = async function (mode) {
    var S = st();
    if (!need('model')) return;
    if (!S.decision) await SEDA.App.decide();
    if (!S.scenarios) SEDA.App.simulate();
    mode = mode || (S.report && S.report.mode) || 'tech';
    var html = await U.withBusy('Generando informe HTML…', function () { return SEDA.Report.standalone(mode); });
    U.download(base() + '_informe_' + (mode === 'exec' ? 'ejecutivo' : 'tecnico') + '.html', html, 'text/html;charset=utf-8');
    S.report = Object.assign({}, S.report || {}, { mode: mode, at: Date.now() });
    if (!S.steps[14]) S.steps[14] = true;
    markDownload(); await SEDA.App.saveRun('Informe generado');
  };

  E.resultsCSV = function () {
    var S = st(); if (!need('model')) return;
    var ev = S.evaluation, T = ev.test, cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
    var rows = T.t.map(function (t, i) {
      var y = cv(T.y[i]), rf = cv(T.rf[i]), pe = cv(T.pe[i]);
      return [U.fmtDateTime(t), y, rf, isFinite(pe) ? pe : '', rf - y, isFinite(pe) ? pe - y : '', T.cond[i] || ''];
    });
    U.download(base() + '_resultados_prueba.csv', U.toCSV(['fecha_hora', 'real_kW', 'random_forest_kW', 'persistencia_kW', 'error_rf_kW', 'error_persistencia_kW', 'condicion'], rows), 'text/csv;charset=utf-8');
    markDownload();
  };

  E.processedCSV = function () {
    var S = st(); if (!need('processed')) return;
    var pr = S.processed, names = ['', 'corregido', 'interpolado', 'invalidado', 'faltante'];
    var hdr = ['fecha_hora'].concat(pr.keys.map(function (k) { return U.slug(M.label(k)) + '_' + U.slug(pr.units[k] || ''); })).concat(['modificaciones']);
    var rows = [];
    for (var i = 0; i < pr.n; i++) {
      var mods = [];
      var r = [U.fmtDateTime(pr.t[i])].concat(pr.keys.map(function (k) { var f = pr.flags[k][i]; if (f && f !== Q.P_MISS) mods.push(k + ':' + names[f]); return isFinite(pr.vars[k][i]) ? pr.vars[k][i] : ''; }));
      r.push(mods.join(' | '));
      rows.push(r);
    }
    U.download(base() + '_datos_procesados.csv', U.toCSV(hdr, rows), 'text/csv;charset=utf-8');
    markDownload();
  };

  E.configObject = function () {
    var S = st();
    var map = {};
    if (S.mapping && S.raw) Object.keys(S.mapping).forEach(function (k) { var m = S.mapping[k]; if (m.col >= 0) map[k] = { columna: S.raw.headers[m.col], unidad: m.unit || null }; });
    return {
      aplicacion: 'SEGAR SOLAR ENERGY DECISIÓN IA', version: SEDA.App.VERSION, exportado: U.nowHuman(), runId: S.runId,
      sistema: SEDA.App.system(), archivo: S.source ? S.source.fileName : null, hojas: S.source ? S.source.selectedSheets : null,
      mapeo: map, limpieza: S.cleanOpts, ml: { parametros: S.mlParams, variables: S.features, division: [0.6, 0.2, 0.2], persistencia: '24 h' },
      decision: Object.keys(S.decisionInputs).reduce(function (o, k) { if (k.charAt(0) !== '_') o[k] = S.decisionInputs[k]; return o; }, {}), prediccion: S.prediction ? { fecha: U.fmtDate(S.prediction.date), hora: S.prediction.hour, entradas: S.prediction.inputs } : null,
      escenarioPersonalizado: S.scenarios ? S.scenarios.custom : null,
      proyectoFV: SEDA.Design ? (function () { var p = SEDA.Design.project(); return { sitio: p.site, consultaNasa: p.nasa.query, diseno: p.inputs, catalogo: p.catalog, costos: p.costs, economia: p.econ }; })() : null
    };
  };
  E.config = function () {
    U.download(base() + '_configuracion.json', JSON.stringify(E.configObject(), null, 2), 'application/json');
    markDownload();
  };
  E.importConfig = function (file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var c = JSON.parse(r.result), S = st(), applied = [];
        if (!/SEGAR SOLAR ENERGY DECISI(ON AI|ÓN IA)$/.test(String(c.aplicacion || ''))) throw new Error('El archivo no es una configuración de SEGAR SOLAR ENERGY DECISIÓN IA.');
        if (c.mapeo && S.raw) {
          var ok = 0;
          Object.keys(c.mapeo).forEach(function (k) {
            var idx = S.raw.headers.indexOf(c.mapeo[k].columna);
            if (idx >= 0 && M.byKey[k]) { S.mapping[k] = { col: idx, score: 100, auto: false, status: 'manual', unit: c.mapeo[k].unidad || M.byKey[k].unit }; ok++; }
          });
          if (ok) { S.mappingConfirmed = false; S.parsed = null; SEDA.App.invalidateFrom(3); applied.push('mapeo (' + ok + ' variables)'); }
        }
        if (c.sistema) { SEDA.App.saveSystem(c.sistema); applied.push('sistema'); }
        if (c.limpieza) { S.cleanOpts = Object.assign({}, Q.DEFAULT_OPTS, c.limpieza); applied.push('limpieza'); }
        if (c.ml && c.ml.parametros) { S.mlParams = Object.assign({}, ML.DEFAULT_PARAMS, c.ml.parametros); applied.push('parámetros ML'); }
        if (c.ml && c.ml.variables) { S.features = c.ml.variables.filter(function (f) { return ML.FEAT[f]; }); applied.push('variables'); }
        if (c.decision) { S.decisionInputs = Object.assign({}, D.DEFAULT_INPUTS, c.decision, { _nightFromData: true }); applied.push('decisión'); }
        if (c.proyectoFV && SEDA.Design) {
          var pj = SEDA.Design.project(), pf = c.proyectoFV;
          if (pf.sitio && isFinite(pf.sitio.lat) && isFinite(pf.sitio.lon)) pj.site = Object.assign({}, pj.site, pf.sitio);
          if (pf.consultaNasa && Array.isArray(pf.consultaNasa.params)) pj.nasa.query = Object.assign({}, pj.nasa.query, pf.consultaNasa);
          if (pf.diseno) { pj.inputs = Object.assign(SEDA.Design.defaultInputs(), pf.diseno); pj.inputs.losses = Object.assign(SEDA.Design.defaultInputs().losses, pf.diseno.losses || {}); }
          if (pf.catalogo && pf.catalogo.custom) pj.catalog = pf.catalogo;
          if (pf.costos) pj.costs = Object.assign({ overrides: {}, custom: [], params: {} }, pf.costos);
          if (pf.economia) pj.econ = Object.assign(SEDA.Design.defaultEcon(), pf.economia);
          SEDA.Design.invalidate(); SEDA.Design.saveNow(); applied.push('proyecto FV');
        }
        SEDA.App.persist(); SEDA.App.refreshChrome(); SEDA.App.refresh();
        U.toast('Configuración cargada: ' + applied.join(', ') + '.', 'good');
      } catch (e) { U.modal({ title: 'Configuración no válida', icon: '⛔', html: '<p>' + U.esc(e.message) + '</p>' }); }
    };
    r.readAsText(file, 'UTF-8');
  };

  E.excel = async function () {
    var S = st();
    if (!window.XLSX) { U.toast('La librería local de Excel no está disponible.', 'crit'); return; }
    if (!need('model')) return;
    if (!S.decision) await SEDA.App.decide();
    if (!S.scenarios) SEDA.App.simulate();
    await U.withBusy('Generando libro Excel…', function () {
      var X = window.XLSX, wb = X.utils.book_new(), ev = S.evaluation, d = S.decision, r = d.result, P = S.prediction, sys = SEDA.App.system();
      var cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
      var add = function (name, aoa, widths) { var ws = X.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; }); X.utils.book_append_sheet(wb, ws, name); };
      var n3 = function (v) { return isFinite(v) ? Math.round(v * 1000) / 1000 : null; };
      var mt = ev.metrics.test;
      add('Resumen', [
        ['SEGAR SOLAR ENERGY DECISIÓN IA — Resultados de la operación'], [],
        ['ID de operación', S.runId], ['Fecha y hora del análisis', U.nowHuman()], ['Sistema', sys.name], ['Ubicación', sys.place],
        ['Archivo de datos', S.source.fileName], ['Datos sintéticos', S.source.synthetic ? 'SÍ — DATOS SINTÉTICOS DE DEMOSTRACIÓN, NO SON DATOS REALES' : 'No'],
        ['Registros procesados', S.processed.n], ['Período', U.fmtDateTime(S.processed.t[0]) + ' → ' + U.fmtDateTime(S.processed.t[S.processed.n - 1])],
        ['Calidad de datos [%]', n3(SEDA.App.quality())], ['Modelo', 'Random Forest Regressor'], ['Árboles / profundidad / min hoja', S.model.params.nTrees + ' / ' + S.model.params.maxDepth + ' / ' + S.model.params.minLeaf],
        ['MAE RF [kW] (prueba)', n3(cv(mt.rf.mae))], ['RMSE RF [kW] (prueba)', n3(cv(mt.rf.rmse))], ['MAPE RF [%] (prueba)', n3(mt.rf.mape)],
        ['MAE persistencia [kW]', n3(cv(mt.pers.mae))], ['RMSE persistencia [kW]', n3(cv(mt.pers.rmse))], ['MAPE persistencia [%]', n3(mt.pers.mape)],
        ['Generación esperada [kWh]', n3(r.gen)], ['Reserva recomendada [kWh]', n3(r.Eres)], ['SOC objetivo [%]', n3(r.socObj)], ['Riesgo', r.risk], ['Regla de riesgo', r.rule],
        ['Índice de confiabilidad', n3(d.reliability.score)], ['Recomendación principal', d.recos.length ? d.recos[0].title + ': ' + d.recos[0].text : ''],
        ['Conclusión', SEDA.Report.conclusion(S)]
      ], [34, 110]);
      var mrow = function (conj, mod, m) { return [conj, mod, m.n, n3(cv(m.mae)), n3(cv(m.rmse)), n3(m.mape), n3(m.wape), n3(m.r2), n3(cv(m.bias)), n3(ML.toKWh(m.mae, ev.targetKey, ev.dtH))]; };
      add('Metricas', [['Conjunto', 'Modelo', 'N', 'MAE_kW', 'RMSE_kW', 'MAPE_%', 'WAPE_%', 'R2', 'Sesgo_kW', 'Error_prom_kWh'],
        mrow('Entrenamiento', 'Random Forest', ev.metrics.train.rf), mrow('Validación', 'Random Forest', ev.metrics.val.rf), mrow('Validación', 'Persistencia', ev.metrics.val.pers),
        mrow('Prueba', 'Random Forest', mt.rf), mrow('Prueba', 'Persistencia', mt.pers), [],
        ['Energía diaria (prueba)', 'Modelo', 'Días', 'MAE_kWh_dia', 'RMSE_kWh_dia', 'WAPE_%'],
        ['Prueba', 'Random Forest', ev.daily.rf.n, n3(ev.daily.rf.mae), n3(ev.daily.rf.rmse), n3(ev.daily.rf.wape)], ['Prueba', 'Persistencia', ev.daily.pe.n, n3(ev.daily.pe.mae), n3(ev.daily.pe.rmse), n3(ev.daily.pe.wape)]
      ], [16, 16, 8, 12, 12, 10, 10, 10, 10, 14]);
      var i = r.inputs;
      add('Decision', [['Entrada / resultado', 'Valor', 'Unidad'],
        ['Capacidad batería', +i.capKWh, 'kWh'], ['SOC actual', +i.socNow, '%'], ['Consumo nocturno', +i.nightLoad, 'kWh'], ['SOC mínimo', +i.socMin, '%'], ['Eficiencia batería', +i.effBat, '%'], ['Eficiencia inversor', +i.effInv, '%'],
        ['Horas restantes de generación', +i.hoursLeft, 'h'], ['Margen de seguridad', +i.margin, '%'], ['Consumo diurno restante', +(i.dayLoad || 0), 'kWh'], [],
        ['Generación esperada', n3(r.gen), 'kWh'], ['Eficiencia global', n3(r.eta * 100), '%'], ['Energía nocturna requerida', n3(r.Ereq), 'kWh'], ['Energía mínima de reserva (SOC mín.)', n3(r.Emin), 'kWh'],
        ['Reserva recomendada', n3(r.Eres), 'kWh'], ['SOC objetivo', n3(r.socObj), '%'], ['Energía al anochecer', n3(r.nom.Esun), 'kWh'], ['SOC proyectado al anochecer', n3(r.nom.socSun), '%'],
        ['Energía disponible para la noche', n3(r.nom.Eavail), 'kWh'], ['Margen disponible', n3(r.nom.margin), 'kWh'], ['Cobertura nominal', n3(r.nom.cover * 100), '%'], ['Cobertura conservadora', n3(r.cons.cover * 100), '%'],
        ['Error relativo usado', n3(r.errRel * 100), '%'], ['Riesgo', r.risk, ''], ['Regla aplicada', r.rule, '']
      ], [40, 16, 8]);
      add('Recomendaciones', [['Nivel', 'Recomendación', 'Detalle', 'Regla']].concat(d.recos.map(function (x) { return [x.level, x.title, x.text, x.why]; })).concat([[], ['Narrativa', d.narrative]]), [8, 40, 110, 40]);
      add('Escenarios', [['Escenario', 'Generacion_kWh', 'Delta_gen_kWh', 'Reserva_kWh', 'SOC_objetivo_%', 'SOC_anochecer_%', 'Cobertura_%', 'Riesgo', 'Capacidad_kWh', 'Consumo_nocturno_kWh', 'Margen_%']].concat(S.scenarios.list.map(function (s) {
        return [s.name, n3(s.gen), n3(s.dGen), n3(s.reserve), n3(s.socObj), n3(s.socSun), n3(s.cover * 100), s.risk, n3(s.cap), n3(s.nightLoad), n3(s.margin)];
      })), [28, 14, 14, 12, 14, 16, 12, 10, 14, 20, 10]);
      add('Importancia', [['Variable', 'Importancia_%']].concat(S.model.features.map(function (f, k) { return [ML.flabel(f), n3(S.model.importance[k] * 100)]; }).sort(function (a, b) { return b[1] - a[1]; })).concat([[], ['Nota', 'La importancia de una variable no implica causalidad (MDI).']]), [30, 16]);
      if (P && !P.profile.daily) add('Perfil_prediccion', [['Fecha', U.fmtDate(P.date)], ['Hora', 'Prediccion_RF_kW', 'Media_historica_mes_kW', 'En_ventana_de_decision']].concat(P.profile.hours.map(function (h) { return [U.p2(h) + ':00', n3(P.profile.kw[h]), n3(P.profile.kwClim[h]), h >= P.hour && h < P.hour + P.hoursLeft ? 'sí' : '']; })), [12, 18, 24, 22]);
      var T = ev.test;
      add('Predicciones_prueba', [['Fecha_hora', 'Real_kW', 'RF_kW', 'Persistencia_kW', 'Error_RF_kW', 'Condicion']].concat(T.t.map(function (t, k) { var y = cv(T.y[k]); return [U.fmtDateTime(t), n3(y), n3(cv(T.rf[k])), n3(cv(T.pe[k])), n3(cv(T.rf[k]) - y), T.cond[k] || '']; })), [18, 10, 10, 16, 12, 22]);
      var V = S.validation;
      add('Validacion', [['Variable', 'Unidad', 'N', 'Faltantes', 'No_numericos', 'Negativos', 'Imposibles', 'Atipicos', 'Congelado', 'Min', 'Max', 'Media']].concat(V.keys.map(function (k) { var s = V.perVar[k]; return [s.label, s.unit, s.n, s.missing, s.nonNumeric, s.negatives, s.impossible, s.outliers, s.frozen, n3(s.min), n3(s.max), n3(s.mean)]; })).concat([[], ['Calidad_%', n3(V.quality.score)], ['Duplicados', V.duplicates], ['Huecos', V.gaps], ['Marcas_ausentes', V.missingTimestamps]]), [26, 8, 8, 10, 12, 10, 10, 10, 10, 10, 10, 10]);
      add('Limpieza', [['Hora', 'Tipo', 'Operación']].concat(S.clean.log.map(function (l) { return [l.time, l.type, l.msg]; })), [10, 8, 160]);
      var cfg = E.configObject();
      add('Parametros', [['Parámetro', 'Valor']].concat([
        ['Variables de entrada', (S.model.features || []).map(ML.flabel).join(', ')], ['Variable objetivo', S.model.targetKey], ['Parámetros RF', JSON.stringify(S.model.params)],
        ['Opciones de limpieza', JSON.stringify(S.cleanOpts)], ['Mapeo', JSON.stringify(cfg.mapeo)], ['Sistema', JSON.stringify(cfg.sistema)]
      ]), [26, 150]);
      X.writeFile(wb, base() + '_resultados.xlsx', { compression: true });
    });
    markDownload();
  };
})();
