/* ==========================================================================
   app.js — Estado, navegación, flujo de trabajo, persistencia local,
   trazabilidad (RUN-AAAA-NNN) y acciones de los botones principales.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, Store = SEDA.Store, C = SEDA.Charts, M = SEDA.Mapping, I = SEDA.Import, Q = SEDA.Quality, ML = SEDA.ML, D = SEDA.Decision;
  var App = SEDA.App = {};
  var V = SEDA.Views = SEDA.Views || {};

  App.VERSION = '2.0.0';
  App.STEPS = [
    { n: 1, label: 'Cargar datos', page: 'importar' }, { n: 2, label: 'Mapear variables', page: 'mapeo' }, { n: 3, label: 'Validar datos', page: 'validacion' },
    { n: 4, label: 'Limpiar datos', page: 'limpieza' }, { n: 5, label: 'Explorar', page: 'exploracion' }, { n: 6, label: 'Configurar ML', page: 'modelo' },
    { n: 7, label: 'Entrenar', page: 'modelo' }, { n: 8, label: 'Validar modelo', page: 'modelo' }, { n: 9, label: 'Evaluar', page: 'evaluacion' },
    { n: 10, label: 'Predicción', page: 'prediccion' }, { n: 11, label: 'Decisión energética', page: 'decision' }, { n: 12, label: 'Recomendaciones', page: 'decision' },
    { n: 13, label: 'Escenarios', page: 'escenarios' }, { n: 14, label: 'Informe', page: 'informe' }, { n: 15, label: 'Descarga', page: 'informe' }
  ];
  App.DEFAULT_SYSTEM = { name: 'Sistema Solar Fotovoltaico', place: 'La Guajira, Colombia', lat: 11.54, lon: -72.91, kwp: '', inverterKw: '', batteryKwh: 80, operator: '', tz: 'UTC−5 (hora de Colombia)' };

  var S = SEDA.state = freshState();
  function freshState() {
    return {
      runId: null, runCreatedAt: null, source: null, pending: null, raw: null, rawDesc: null, mapping: null, mappingConfirmed: false,
      parsed: null, validation: null, cleanOpts: Object.assign({}, Q.DEFAULT_OPTS), clean: null, processed: null,
      mlParams: Object.assign({}, ML.DEFAULT_PARAMS), features: null, model: null, evaluation: null, tuning: null,
      prediction: null, decisionInputs: Object.assign({}, D.DEFAULT_INPUTS), decision: null, scenarios: null, report: null,
      simParams: null, simulation: null, steps: {}, cache: {}, currentPage: 'dashboard'
    };
  }
  App.system = function () { return Object.assign({}, App.DEFAULT_SYSTEM, Store.lsGet('seda-system', {})); };
  App.saveSystem = function (sys) { Store.lsSet('seda-system', sys); };

  /* ---------------- Pasos y trazabilidad ---------------- */
  App.done = function (n) { S.steps[n] = true; App.refreshChrome(); App.persist(); };
  App.isDone = function (n) { return !!S.steps[n]; };
  App.invalidateFrom = function (step) {
    var clear = {
      3: ['validation', 'clean', 'processed', 'model', 'evaluation', 'tuning', 'prediction', 'decision', 'scenarios', 'report', 'simulation'],
      4: ['clean', 'processed', 'model', 'evaluation', 'tuning', 'prediction', 'decision', 'scenarios', 'report', 'simulation'],
      7: ['model', 'evaluation', 'tuning', 'prediction', 'decision', 'scenarios', 'report', 'simulation'],
      10: ['prediction', 'decision', 'scenarios', 'report'],
      11: ['decision', 'scenarios', 'report'],
      13: ['scenarios', 'report']
    };
    var keys = clear[step] || [];
    keys.forEach(function (k) { S[k] = null; });
    if (step <= 4) S.cache = {};
    Object.keys(S.steps).forEach(function (k) { if (+k >= step) delete S.steps[k]; });
  };
  App.newRunId = async function () {
    var year = new Date().getFullYear();
    var runs = await Store.runsAll();
    var max = Store.lsGet('seda-run-counter-' + year, 0);
    runs.forEach(function (r) { var m = /^RUN-(\d{4})-(\d+)$/.exec(r.id); if (m && +m[1] === year) max = Math.max(max, +m[2]); });
    var next = max + 1;
    Store.lsSet('seda-run-counter-' + year, next);
    return 'RUN-' + year + '-' + ('00' + next).slice(-3);
  };
  App.ensureRun = async function () {
    if (!S.runId) { S.runId = await App.newRunId(); S.runCreatedAt = Date.now(); App.refreshChrome(); }
    return S.runId;
  };

  /* ---------------- Persistencia de la sesión ---------------- */
  var PERSIST_KEYS = ['runId', 'runCreatedAt', 'source', 'raw', 'rawDesc', 'mapping', 'mappingConfirmed', 'validation', 'cleanOpts', 'clean', 'processed', 'mlParams', 'features', 'model', 'evaluation', 'tuning', 'prediction', 'decisionInputs', 'decision', 'scenarios', 'report', 'steps', 'simParams', 'simulation'];
  var doPersist = U.debounce(async function () {
    var snap = { savedAt: Date.now(), version: App.VERSION };
    PERSIST_KEYS.forEach(function (k) { snap[k] = S[k]; });
    var ok = await Store.set('session', snap);
    if (!ok && Store.mode === 'IndexedDB') U.toast('No se pudo guardar la sesión localmente (espacio insuficiente).', 'warn');
  }, 600);
  App.persist = function () { doPersist(); };
  App.restore = async function () {
    var snap = await Store.get('session');
    if (!snap || !snap.raw) return false;
    PERSIST_KEYS.forEach(function (k) { if (snap[k] !== undefined) S[k] = snap[k]; });
    S.cleanOpts = Object.assign({}, Q.DEFAULT_OPTS, S.cleanOpts || {});
    S.mlParams = Object.assign({}, ML.DEFAULT_PARAMS, S.mlParams || {});
    S.decisionInputs = Object.assign({}, D.DEFAULT_INPUTS, S.decisionInputs || {});
    S.steps = S.steps || {};
    return true;
  };

  /* ---------------- Cachés derivadas ---------------- */
  App.daily = function () { if (!S.processed) return []; if (!S.cache.daily) S.cache.daily = Q.daily(S.processed); return S.cache.daily; };
  App.clim = function () { if (!S.processed) return null; if (!S.cache.clim) S.cache.clim = ML.climatology(S.processed); return S.cache.clim; };
  App.ensureParsed = function () { if (!S.parsed && S.raw && S.mapping) S.parsed = Q.parse(S.raw, S.mapping); return S.parsed; };
  App.quality = function () { return S.validation ? S.validation.quality.score : null; };
  App.errRel = function () {
    if (!S.evaluation) return 0;
    var w = S.evaluation.daily.rf.wape;
    if (!isFinite(w)) w = S.evaluation.metrics.test.rf.wape;
    return isFinite(w) ? w / 100 : 0;
  };
  App.reliability = function (similarity) {
    return D.reliability({ evaluation: S.evaluation, pr: S.processed, quality: App.quality(), similarity: similarity != null ? similarity : (S.prediction ? S.prediction.similarity.score : null) });
  };

  /* ---------------- Carga de datos ---------------- */
  App.loadFile = async function (file, kind) {
    if (!file) return;
    var name = file.name, ext = (name.split('.').pop() || '').toLowerCase();
    try {
      await U.withBusy('Leyendo "' + name + '" localmente…', async function () {
        var sheets, meta = {};
        if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || kind === 'excel' && ext !== 'csv') {
          var buf = await I.readAsArrayBuffer(file);
          sheets = I.parseExcel(buf);
          meta.fileType = ext;
        } else {
          var text = await I.readAsText(file, 'UTF-8');
          if (/\uFFFD/.test(text.slice(0, 20000))) { text = await I.readAsText(file, 'windows-1252'); meta.encoding = 'Windows-1252'; }
          var p = I.parseCSV(text);
          sheets = [{ name: name.replace(/\.[^.]+$/, ''), aoa: p.aoa, cellErrors: 0 }];
          meta = Object.assign(meta, p.meta, { fileType: ext || 'csv' });
        }
        var infos = sheets.map(function (s) { return I.sheetInfo(s); });
        S.pending = { fileName: name, sizeBytes: file.size, meta: meta, infos: infos };
      });
    } catch (e) {
      console.error(e);
      U.modal({ title: 'No se pudo leer el archivo', icon: '⛔', html: '<p>' + U.esc(e.message || String(e)) + '</p><p class="muted">Verifique que el archivo no esté protegido con contraseña ni dañado. Formatos admitidos: .xlsx, .xls, .csv, .txt.</p>' });
      return;
    }
    var infos = S.pending.infos, dataSheets = infos.filter(function (s) { return s.looksData; });
    if (infos.length === 1 || dataSheets.length === 1) {
      await App.selectSheets([(dataSheets[0] || infos[0]).name]);
    } else {
      U.toast('El archivo contiene ' + infos.length + ' hojas. Seleccione la(s) hoja(s) a analizar.', 'info');
      App.go('importar');
    }
  };
  App.selectSheets = async function (names) {
    var P = S.pending; if (!P) return;
    var sel = P.infos.filter(function (s) { return names.indexOf(s.name) >= 0; });
    if (!sel.length) { U.toast('Seleccione al menos una hoja.', 'warn'); return; }
    var comb;
    try { comb = I.combine(sel); } catch (e) { U.modal({ title: 'No se pudieron unir las hojas', icon: '⛔', html: '<p>' + U.esc(e.message) + '</p>' }); return; }
    if (!comb.table.rows.length) { U.modal({ title: 'Sin registros', icon: '⛔', html: '<p>La(s) hoja(s) seleccionada(s) no contienen filas de datos.</p>' }); return; }
    var source = {
      fileName: P.fileName, fileType: P.meta.fileType, sizeBytes: P.sizeBytes, sheetNames: P.infos.map(function (s) { return s.name; }),
      sheetStats: P.infos.map(function (s) { return { name: s.name, rows: s.rows, cols: s.cols, looksData: s.looksData }; }),
      selectedSheets: names.slice(), mergeMode: comb.mode, mergeLog: comb.log, nasa: !!P.meta.nasa, delimiter: P.meta.delimiter, encoding: P.meta.encoding || 'UTF-8',
      synthetic: I.isSyntheticName(P.fileName), loadedAt: Date.now()
    };
    await App.setRaw(comb.table, source);
    S.pending = null;
  };
  App.setRaw = async function (table, source) {
    var keepSteps = {};
    S.raw = { headers: table.headers, rows: table.rows };
    S.source = source;
    S.rawDesc = I.describe(S.raw);
    S.mapping = M.autoMap(S.raw.headers, S.raw.rows);
    S.mappingConfirmed = false;
    S.parsed = null;
    S.features = null;
    delete S.decisionInputs._nightFromData;
    App.invalidateFrom(3);
    S.steps = keepSteps;
    S.runId = null;
    await App.ensureRun();
    /* rango de fechas preliminar */
    var ts = I.timestamps(S.raw, S.mapping), mm = U.minmax(ts.t);
    S.source.start = mm[0]; S.source.end = mm[1];
    App.done(1);
    U.toast('Datos cargados: <b>' + U.esc(source.fileName) + '</b> · ' + U.fmtInt(table.rows.length) + ' registros · ' + table.headers.length + ' columnas.', 'good');
    App.go('importar');
  };
  App.loadDemo = async function () {
    await U.withBusy('Generando datos sintéticos de demostración (1 año horario)…', async function () {
      var tb = SEDA.Demo.table({});
      await App.setRaw(tb, {
        fileName: 'DEMO_La_Guajira_sintetico_2025.csv (generado en el navegador)', fileType: 'demo', sizeBytes: 0, sheetNames: ['Demo La Guajira'],
        sheetStats: [{ name: 'Demo La Guajira', rows: tb.rows.length, cols: tb.headers.length, looksData: true }], selectedSheets: ['Demo La Guajira'],
        mergeMode: 'única', mergeLog: [], synthetic: true, demoIssues: tb.issues, loadedAt: Date.now()
      });
      var sys = App.system();
      if (!Store.lsGet('seda-system', null)) App.saveSystem(Object.assign(sys, { kwp: 20, inverterKw: 17, batteryKwh: 80 }));
      S.decisionInputs = Object.assign({}, D.DEFAULT_INPUTS, { capKWh: 80 });
    });
  };

  /* ---------------- Mapeo, validación, limpieza ---------------- */
  App.applyMapping = function () {
    var chk = M.check(S.mapping);
    if (!chk.ok) { U.modal({ title: 'Mapeo incompleto', icon: '⚠\uFE0F', html: '<ul>' + chk.msgs.map(function (m) { return '<li>' + U.esc(m) + '</li>'; }).join('') + '</ul>' }); return false; }
    S.mappingConfirmed = true;
    S.parsed = Q.parse(S.raw, S.mapping);
    var ts = S.parsed.t, mm = U.minmax(ts);
    S.source.start = mm[0]; S.source.end = mm[1];
    App.invalidateFrom(3);
    App.done(2);
    return true;
  };
  App.runValidation = function () {
    if (!S.raw) { U.toast('Primero cargue datos.', 'warn'); App.go('importar'); return false; }
    if (!S.mappingConfirmed && !App.applyMapping()) { App.go('mapeo'); return false; }
    App.ensureParsed();
    var sys = App.system();
    S.validation = Q.validate(S.parsed, { kwp: +sys.kwp || 0 });
    App.invalidateFrom(4);
    App.done(3);
    return true;
  };
  App.runCleaning = function () {
    if (!S.validation && !App.runValidation()) return false;
    App.ensureParsed();
    var res = Q.clean(S.parsed, S.validation, S.cleanOpts);
    S.clean = { log: res.log, summary: res.summary, opts: res.opts, at: Date.now() };
    S.processed = res.processed;
    S.cache = {};
    App.invalidateFrom(7);
    var av = ML.available(S.processed);
    var keepF = (S.features || []).filter(function (f) { return av.indexOf(f) >= 0; });
    S.features = keepF.length ? keepF : av;
    var nl = Q.nightLoad(S.processed);
    if (nl && !S.decisionInputs._nightFromData) { S.decisionInputs.nightLoad = Math.round(nl.mean * 10) / 10; S.decisionInputs._nightFromData = true; }
    App.done(4);
    return true;
  };

  /* ---------------- Machine Learning ---------------- */
  App.train = async function (onProgress) {
    if (!S.processed && !App.runCleaning()) return false;
    if (!S.features || !S.features.length) S.features = ML.available(S.processed);
    if (!S.features.length) { U.modal({ title: 'Sin variables de entrada', icon: '⛔', html: '<p>No hay variables de entrada con al menos 80 % de datos válidos.</p>' }); return false; }
    App.done(6);
    try {
      var r = await ML.run(S.processed, S.features, S.mlParams, onProgress);
      S.model = r.model; S.evaluation = r.evaluation;
      App.invalidateFrom(10);
      S.steps[7] = true; S.steps[8] = true;
      App.done(7);
      await App.saveRun('Modelo entrenado');
      return true;
    } catch (e) {
      console.error(e);
      U.modal({ title: 'No se pudo entrenar', icon: '⛔', html: '<p>' + U.esc(e.message || String(e)) + '</p>' });
      return false;
    }
  };

  /* ---------------- Predicción, decisión, escenarios ---------------- */
  App.defaultPredictionInputs = function (dateMs, hour) {
    var clim = App.clim(), cl = clim[U.monthOf(dateMs)][hour] || {}, out = {};
    M.METEO.forEach(function (k) { if (S.processed.vars[k]) out[k] = isFinite(cl[k]) ? Math.round(cl[k] * 10) / 10 : ''; });
    return out;
  };
  App.predict = function (form) {
    if (!S.model) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return false; }
    form = form || {};
    var date = isFinite(form.date) ? form.date : U.dayStart(U.nowLocalNaive());
    var hour = isFinite(form.hour) ? form.hour : 9;
    var inputs = form.inputs || App.defaultPredictionInputs(date, hour);
    var ctx = { pr: S.processed, model: S.model, clim: App.clim() };
    var prof = D.profile(ctx, { date: date, hour: hour, inputs: inputs });
    var hlAuto = D.autoHoursLeft(prof);
    var hl = S.decisionInputs.hoursLeft != null && S.decisionInputs.hoursLeft !== '' ? +S.decisionInputs.hoursLeft : hlAuto;
    var sim = prof.rowH0 ? ML.similarity(S.model, prof.rowH0) : { score: 1, outside: [], total: 0, inRange: 0 };
    var comp = S.processed.dtH < 24 ? ML.comparable(S.processed, S.model, date + hour * U.HOUR, prof.valsH0 || inputs, 5) : [];
    var ev = S.evaluation, hErr = ev.byHour[hour] ? ev.byHour[hour].rf : NaN;
    S.prediction = {
      date: date, hour: hour, inputs: inputs, profile: prof, hoursLeftAuto: hlAuto, hoursLeft: hl,
      kwH0: prof.kwH0, kwhH0: prof.kwH0 * 1, remainingKWh: D.remaining(prof, hl), dayKWh: prof.dayKWh,
      comparable: comp, errHour: ML.toKW(hErr, ev.targetKey, ev.dtH), errGlobal: ML.toKW(ev.metrics.test.rf.mae, ev.targetKey, ev.dtH), errDaily: ev.daily.rf.mae, errRel: App.errRel(),
      similarity: sim, quality: App.quality(), at: Date.now()
    };
    App.invalidateFrom(11);
    App.done(10);
    return true;
  };
  App.decide = async function (inputs) {
    if (!S.prediction && !App.predict()) return false;
    if (inputs) S.decisionInputs = Object.assign({}, S.decisionInputs, inputs);
    var di = S.decisionInputs;
    var hl = di.hoursLeft != null && di.hoursLeft !== '' ? +di.hoursLeft : S.prediction.hoursLeftAuto;
    S.prediction.hoursLeft = hl;
    S.prediction.remainingKWh = D.remaining(S.prediction.profile, hl);
    var rel = App.reliability();
    var calcInputs = Object.assign({}, di, { hoursLeft: hl });
    delete calcInputs._nightFromData;
    var res = D.compute(calcInputs, S.prediction.remainingKWh, { errRel: App.errRel(), reliability: rel.score });
    var mt = S.evaluation.metrics.test;
    var recos = D.recommend(res, { hour: S.prediction.hour, quality: App.quality(), similarity: S.prediction.similarity, rfWorse: mt.rf.rmse >= mt.pers.rmse, reliability: rel.score });
    var win = S.prediction.profile.daily ? 'para el día' : 'durante las próximas ' + hl + ' h de generación solar (desde las ' + U.p2(S.prediction.hour) + ':00 del ' + U.fmtDate(S.prediction.date) + ')';
    S.decision = { inputs: calcInputs, result: res, recos: recos, narrative: D.narrative(res, { window: win }), reliability: rel, at: Date.now() };
    App.invalidateFrom(13);
    S.steps[12] = true;
    App.done(11);
    await App.saveRun('Decisión calculada');
    return true;
  };
  /* Backtest de la decisión en los días de prueba (valor en COP) */
  App.backtest = function () {
    if (!S.evaluation) return null;
    var inp = Object.assign({}, D.DEFAULT_INPUTS, S.decision ? S.decision.inputs : S.decisionInputs);
    try { return D.backtest(S.evaluation, inp); } catch (e) { console.warn(e); return null; }
  };
  App.simulate = function (custom) {
    if (!S.decision) { U.toast('Primero calcule la decisión energética.', 'warn'); App.go('decision'); return false; }
    var ctx = { pr: S.processed, model: S.model, clim: App.clim() };
    var base = { date: S.prediction.date, hour: S.prediction.hour, inputs: S.prediction.inputs, decisionInputs: S.decision.inputs, errRel: App.errRel(), reliability: S.decision.reliability.score };
    var list = D.SCENARIOS.map(function (sc) { return D.runScenario(ctx, base, sc); });
    if (custom && Object.keys(custom).some(function (k) { return custom[k] !== 0 && custom[k] != null && custom[k] !== ''; })) {
      list.push(D.runScenario(ctx, base, { id: 'custom', name: 'Personalizado', mods: custom }));
    }
    var b = list[0];
    list.forEach(function (s) { s.dGen = s.gen - b.gen; s.dRes = s.reserve - b.reserve; s.dSoc = s.socSun - b.socSun; });
    S.scenarios = { list: list, custom: custom || {}, at: Date.now() };
    App.done(13);
    return true;
  };

  /* ---------------- Historial ---------------- */
  App.saveRun = async function (status) {
    if (!S.runId) return;
    var ev = S.evaluation, d = S.decision, sys = App.system();
    var rec = (await Store.runGet(S.runId)) || { id: S.runId, createdAt: S.runCreatedAt || Date.now() };
    Object.assign(rec, {
      updatedAt: Date.now(), status: status || rec.status, fecha: U.nowHuman().slice(0, 10), hora: U.nowHuman().slice(11),
      archivo: S.source ? S.source.fileName : '', hojas: S.source ? S.source.selectedSheets : [], sintetico: S.source ? !!S.source.synthetic : false,
      registros: S.processed ? S.processed.n : (S.raw ? S.raw.rows.length : 0), periodo: S.source ? [S.source.start, S.source.end] : null,
      huella: S.processed ? U.hashArrays([S.processed.t, S.processed.vars[S.processed.targetKey]]) : null,
      calidad: App.quality(), sistema: sys.name, ubicacion: sys.place,
      modelo: S.model ? 'Random Forest Regressor' : null,
      parametros: S.model ? { arboles: S.model.params.nTrees, profundidad: S.model.params.maxDepth, minHoja: S.model.params.minLeaf, maxFeatures: S.model.params.maxFeatures, semilla: S.model.params.seed } : null,
      variables: S.model ? S.model.features.slice() : null, objetivo: S.model ? S.model.targetKey : null,
      mae: ev ? ML.toKW(ev.metrics.test.rf.mae, ev.targetKey, ev.dtH) : null, rmse: ev ? ML.toKW(ev.metrics.test.rf.rmse, ev.targetKey, ev.dtH) : null,
      mape: ev ? ev.metrics.test.rf.mape : null, maePers: ev ? ML.toKW(ev.metrics.test.pers.mae, ev.targetKey, ev.dtH) : null, rmsePers: ev ? ML.toKW(ev.metrics.test.pers.rmse, ev.targetKey, ev.dtH) : null,
      generacion: d ? d.result.gen : null, reserva: d ? d.result.Eres : null, soc: d ? d.result.socObj : null, riesgo: d ? d.result.risk : null,
      recomendacion: d && d.recos.length ? d.recos[0].title : null, narrativa: d ? d.narrative : null, confiabilidad: d ? d.reliability.score : null,
      entradasDecision: d ? d.inputs : null, prediccion: S.prediction ? { fecha: U.fmtDate(S.prediction.date), hora: S.prediction.hour, entradas: S.prediction.inputs, kwH0: S.prediction.kwH0, restanteKWh: S.prediction.remainingKWh } : null,
      escenarios: S.scenarios ? S.scenarios.list.map(function (s) { return { nombre: s.name, gen: s.gen, reserva: s.reserve, soc: s.socObj, riesgo: s.risk }; }) : null,
      limpieza: S.clean ? S.clean.summary : null, informe: S.report ? { modo: S.report.mode, generado: S.report.at } : rec.informe || null
    });
    await Store.runPut(rec);
  };

  /* ---------------- Operaciones generales ---------------- */
  App.newOperation = async function () {
    var keep = await U.modal({
      title: 'Nueva operación', icon: '➕',
      html: '<p>Se iniciará una nueva ejecución con un nuevo identificador RUN. La operación actual permanece en el historial.</p><label class="check"><input type="checkbox" id="keep-data" checked> <span>Conservar los datos cargados, el mapeo y la limpieza<span class="cdesc">Se reinician el modelo, la predicción, la decisión, los escenarios y el informe.</span></span></label>',
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Iniciar nueva operación', value: function (el) { return el.querySelector('#keep-data').checked ? 'keep' : 'reset'; }, cls: 'btn-primary' }],
      cancelValue: null
    });
    if (!keep) return;
    if (keep === 'keep' && S.raw) {
      App.invalidateFrom(7);
      S.runId = null; await App.ensureRun();
      App.persist();
      U.toast('Nueva operación ' + S.runId + ' (datos conservados).', 'good');
      App.go(S.processed ? 'modelo' : 'importar');
    } else {
      var theme = document.documentElement.getAttribute('data-theme');
      SEDA.state = S = freshState();
      await Store.del('session');
      document.documentElement.setAttribute('data-theme', theme);
      App.refreshChrome();
      U.toast('Nueva operación iniciada. Cargue datos para comenzar.', 'good');
      App.go('importar');
    }
  };
  App.discardData = async function () {
    if (!S.raw && !S.pending) { U.toast('No hay datos cargados.', 'info'); return; }
    var ok = await U.confirm('Limpiar datos cargados', '<p>Se quitarán de esta sesión los datos cargados y todos los resultados derivados (mapeo, limpieza, modelo, decisión). El historial de operaciones <b>no</b> se borra.</p>', 'Quitar datos', true);
    if (!ok) return;
    SEDA.state = S = freshState();
    await Store.del('session');
    App.refreshChrome();
    U.toast('Datos quitados de la sesión.', 'good');
    App.go('importar');
  };
  App.deleteDB = async function () {
    var ok = await U.confirm('Eliminar base actual', '<p>Se eliminará <b>toda</b> la base de datos local de esta aplicación en este navegador: sesión, datos, modelos e <b>historial de operaciones</b>. Esta acción no se puede deshacer.</p><p class="muted">Sugerencia: descargue antes el historial o los resultados si los necesita.</p>', 'Eliminar todo', true);
    if (!ok) return;
    await Store.clearAll();
    if (SEDA.Design) SEDA.Design.reset();
    SEDA.state = S = freshState();
    App.refreshChrome();
    U.toast('Base de datos local eliminada.', 'good');
    App.go('importar');
  };

  /* Ejecuta automáticamente todos los pasos pendientes con los valores por defecto */
  App.autopilot = async function () {
    if (!S.raw) { await App.loadDemo(); }
    U.busy('Aplicando mapeo y validando…'); await U.sleep(20);
    if (!S.mappingConfirmed && !App.applyMapping()) { U.idle(); App.go('mapeo'); return; }
    if (!S.validation) App.runValidation();
    U.busy('Limpiando datos…'); await U.sleep(20);
    if (!S.processed) App.runCleaning();
    S.steps[5] = true;
    if (!S.model) {
      U.busy('Entrenando Random Forest (0 %)…');
      var ok = await App.train(function (a, b) { U.busy('Entrenando Random Forest (' + Math.round(a / b * 100) + ' %)…'); });
      if (!ok) { U.idle(); return; }
    }
    S.steps[9] = true;
    U.busy('Calculando predicción y decisión…'); await U.sleep(20);
    if (!S.prediction) App.predict();
    if (!S.decision) await App.decide();
    if (!S.scenarios) App.simulate();
    U.idle();
    App.refreshChrome(); App.persist();
    U.toast('Flujo completo ejecutado. Revise el dashboard y genere el informe.', 'good', 5000);
    App.go('dashboard');
  };

  /* ---------------- Navegación y marco ---------------- */
  var PAGE_TITLES = {
    dashboard: 'Dashboard para toma de decisiones', metodologia: 'Metodología académica', importar: 'Importar datos', mapeo: 'Mapeo inteligente de variables',
    validacion: 'Validación de datos', limpieza: 'Limpieza y preprocesamiento', datos: 'Datos brutos vs datos procesados', exploracion: 'Exploración de datos',
    historico: 'Análisis histórico', modelo: 'Machine Learning — configurar y entrenar', evaluacion: 'Evaluación del modelo', prediccion: 'Predicción solar',
    decision: 'Decisión energética', sitio: 'Sitio y recurso solar — NASA POWER', diseno: 'Diseño del sistema fotovoltaico', costos: 'Costos y presupuesto', manual: 'Manual de instalación', escenarios: '¿Qué pasaría si? — Simulador de escenarios', simulacion: 'Simulación interactiva — gemelo digital', informe: 'Informe completo de operación', historial: 'Historial de operaciones', sistema: 'Sistema, privacidad y configuración'
  };
  App.go = function (page, opts) {
    if (!V[page]) page = 'dashboard';
    S.currentPage = page;
    U.$$('.page').forEach(function (p) { p.classList.remove('active'); });
    var el = U.$('#page-' + page);
    U.$$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === page); });
    U.$('#page-title').innerHTML = '<span class="crumb">SEGAR SOLAR ENERGY DECISIÓN IA</span>' + U.esc(PAGE_TITLES[page] || page);
    el.classList.add('active');
    try { V[page].render(el, opts || {}); }
    catch (e) { console.error(e); el.innerHTML = '<div class="alert crit"><span class="ai">⛔</span><div>Error al mostrar la sección: ' + U.esc(e.message) + '</div></div>'; }
    U.$('#sidebar').classList.remove('open');
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    if (page === 'exploracion' && S.processed) { if (!S.steps[5]) App.done(5); }
    if (page === 'modelo' && S.processed) { if (!S.steps[6]) App.done(6); }
    if (page === 'evaluacion' && S.evaluation) { if (!S.steps[9]) App.done(9); }
    App.refreshChrome();
    try { if (history.replaceState) history.replaceState(null, '', '#' + page); } catch (e) { /* file:// puede restringirlo */ }
  };
  App.refresh = function () { App.go(S.currentPage, { keepScroll: true }); };

  App.refreshChrome = function () {
    U.$('#chip-run').textContent = S.runId || 'RUN —';
    var syn = S.source && S.source.synthetic;
    U.$('#chip-synthetic').classList.toggle('hidden', !syn);
    U.$('#synthetic-banner').classList.toggle('hidden', !syn);
    var cur = App.STEPS.find(function (s) { return !S.steps[s.n]; });
    U.$('#stepper').innerHTML = App.STEPS.map(function (s, i) {
      return (i ? '<span class="step-arrow">›</span>' : '') + '<button class="step ' + (S.steps[s.n] ? 'done' : '') + (cur && cur.n === s.n ? ' current' : '') + '" data-go="' + s.page + '" title="Paso ' + s.n + ': ' + s.label + '"><span class="n">' + (S.steps[s.n] ? '✓' : s.n) + '</span>' + s.label + '</button>';
    }).join('');
    U.$$('.nav-item[data-step]').forEach(function (b) { var d = b.querySelector('.step-dot'); if (d) d.classList.toggle('done', !!S.steps[b.getAttribute('data-step')]); });
  };

  /* ---------------- Acciones (botones) ---------------- */
  var A = SEDA.Actions = {
    'load-excel': function () { U.$('#file-excel').click(); },
    'load-csv': function () { U.$('#file-csv').click(); },
    'load-demo': async function () {
      if (S.raw) { var ok = await U.confirm('Cargar datos de demostración', '<p>Se reemplazarán los datos actuales de la sesión por <b>datos sintéticos</b> de La Guajira (no son datos reales).</p>', 'Cargar demo'); if (!ok) return; }
      await App.loadDemo();
    },
    'discard-data': function () { return App.discardData(); },
    'delete-db': function () { return App.deleteDB(); },
    'validate': function () { if (App.runValidation()) { U.toast('Validación completada.', 'good'); App.go('validacion'); } },
    'clean': function () { if (App.runCleaning()) { U.toast('Limpieza completada. Revise el registro de limpieza.', 'good'); App.go('limpieza'); } },
    'explore': function () { if (!S.processed && !App.runCleaning()) return; App.go('exploracion'); },
    'train': function () { if (!S.processed && !App.runCleaning()) return; App.go('modelo', { autoTrain: true }); },
    'evaluate': function () { if (!S.evaluation) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return; } App.go('evaluacion'); },
    'predict': function () { if (!S.model) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return; } if (!S.prediction) App.predict(); App.go('prediccion'); },
    'decide': async function () { if (!S.model) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return; } if (!S.decision) await App.decide(); App.go('decision'); },
    'recommend': async function () { if (!S.model) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return; } if (!S.decision) await App.decide(); App.go('decision', { anchor: 'recomendaciones' }); },
    'simulate': async function () { if (!S.model) { U.toast('Primero entrene el modelo.', 'warn'); App.go('modelo'); return; } if (!S.decision) await App.decide(); if (!S.scenarios) App.simulate(); App.go('escenarios'); },
    'report': async function () { if (!S.model) { U.toast('Primero entrene el modelo para generar el informe.', 'warn'); App.go('modelo'); return; } if (!S.decision) await App.decide(); if (!S.scenarios) App.simulate(); App.go('informe', { build: true }); },
    'print-pdf': async function () { if (!S.model) { U.toast('Primero entrene el modelo para generar el informe.', 'warn'); App.go('modelo'); return; } if (!S.decision) await App.decide(); if (!S.scenarios) App.simulate(); App.go('informe', { build: true, print: true }); },
    'dl-html': function () { return SEDA.Exports.reportHTML(); },
    'dl-excel': function () { return SEDA.Exports.excel(); },
    'dl-csv': function () { return SEDA.Exports.resultsCSV(); },
    'dl-processed': function () { return SEDA.Exports.processedCSV(); },
    'dl-config': function () { return SEDA.Exports.config(); },
    'load-config': function () { U.$('#file-config').click(); },
    'new-op': function () { return App.newOperation(); },
    'open-sim': function () { App.go('simulacion'); },
    'open-site': function () { App.go('sitio'); },
    'open-design': function () { App.go('diseno'); },
    'open-costs': function () { App.go('costos'); },
    'open-manual': function () { App.go('manual'); },
    'open-chat': function () { if (SEDA.Assistant) SEDA.Assistant.toggle(true); },
    'ai-settings': function () { if (SEDA.Assistant) { SEDA.Assistant.toggle(true); SEDA.Assistant.showSettings(true); } },
    'autopilot': async function () {
      var ok = await U.confirm('Ejecutar flujo completo', '<p>Se ejecutarán automáticamente, con los parámetros actuales, todos los pasos pendientes: ' + (S.raw ? '' : 'carga de <b>datos sintéticos</b> de demostración, ') + 'mapeo, validación, limpieza, entrenamiento, evaluación, predicción, decisión y escenarios.</p><p class="muted">Cada paso queda documentado y puede revisarse o repetirse después.</p>', 'Ejecutar');
      if (ok) await App.autopilot();
    }
  };

  function bindGlobal() {
    document.addEventListener('click', async function (e) {
      var nav = e.target.closest('.nav-item[data-page]');
      if (nav) { App.go(nav.getAttribute('data-page')); return; }
      var go = e.target.closest('[data-go]');
      if (go) { e.preventDefault(); App.go(go.getAttribute('data-go'), go.getAttribute('data-anchor') ? { anchor: go.getAttribute('data-anchor') } : undefined); return; }
      var csv = e.target.closest('[data-chart-csv]');
      if (csv) { var id = csv.getAttribute('data-chart-csv'), sp = C.specById(id); if (sp) U.download(id + '_' + (S.runId || 'datos') + '.csv', C.specToCSV(sp), 'text/csv;charset=utf-8'); return; }
      var act = e.target.closest('[data-action]');
      if (act && !act.disabled) {
        var fn = A[act.getAttribute('data-action')];
        if (fn) { e.preventDefault(); try { await fn(act); } catch (err) { console.error(err); U.idle(); U.modal({ title: 'Error', icon: '⛔', html: '<p>' + U.esc(err.message || String(err)) + '</p>' }); } }
      }
    });
    U.$('#file-excel').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; App.loadFile(f, 'excel'); });
    U.$('#file-csv').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; App.loadFile(f, 'csv'); });
    U.$('#file-config').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; SEDA.Exports.importConfig(f); });
    U.$('#menu-btn').addEventListener('click', function () { U.$('#sidebar').classList.toggle('open'); });
    U.$('#theme-btn').addEventListener('click', function () {
      var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('seda-theme', t); } catch (err) { /* sin acción */ }
      C.redrawAll();
    });
    window.addEventListener('beforeprint', function () { if (document.documentElement.getAttribute('data-theme') === 'dark') { document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.setAttribute('data-was-dark', '1'); } });
    window.addEventListener('afterprint', function () { if (document.documentElement.getAttribute('data-was-dark')) { document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.removeAttribute('data-was-dark'); C.redrawAll(); } });
    /* arrastrar y soltar archivos en cualquier parte */
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) App.loadFile(f, /\.(xlsx|xls|xlsm)$/i.test(f.name) ? 'excel' : 'csv');
    });
  }

  App.init = async function () {
    bindGlobal();
    var ok = await Store.init();
    U.$('#storage-status').innerHTML = ok ? 'Almacenamiento: <strong>IndexedDB local</strong>' : 'Almacenamiento: <strong>memoria</strong> (IndexedDB no disponible; los datos se perderán al cerrar)';
    var restored = false;
    try { restored = await App.restore(); } catch (e) { console.warn('Restauración', e); }
    if (SEDA.Report && SEDA.Report.injectStyles) SEDA.Report.injectStyles();
    App.refreshChrome();
    var hash = (location.hash || '').replace('#', '');
    App.go(V[hash] ? hash : 'dashboard');
    if (restored) U.toast('Sesión restaurada desde el almacenamiento local: <b>' + U.esc(S.runId || '') + '</b> · ' + U.esc(S.source ? S.source.fileName : ''), 'good', 5000);
    if (!window.XLSX) U.toast('Advertencia: no se cargó la librería local de Excel (js/lib/xlsx.full.min.js). La carga de CSV sigue disponible.', 'warn', 8000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init);
  else App.init();
})();
