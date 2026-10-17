/* ==========================================================================
   assistant.js — ASISTENTE SEGAR IA (chatbot integrado).

   Dos modos:
   • EN LÍNEA (opcional): API compatible con OpenAI (DeepSeek por defecto,
     OpenAI opcional). Envía la pregunta y un RESUMEN AGREGADO de resultados
     (nunca los datos brutos). La clave API la ingresa el usuario en ⚙ y se
     guarda solo en este navegador; no está escrita en el código.
   • LOCAL (sin conexión): responde con los resultados calculados por la
     aplicación y ejecuta comandos («entrena el modelo», «simula irradiancia
     −30 %», «abre la simulación»…).

   El asistente puede operar la aplicación proponiendo acciones
   <accion>{…}</accion>; el usuario confirma cada acción antes de ejecutarla.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, Store = SEDA.Store, ML = SEDA.ML, M = SEDA.Mapping, D = SEDA.Decision;
  var A = SEDA.Assistant = {};
  var st = function () { return SEDA.state; };

  A.PROVIDERS = {
    deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com', path: '/chat/completions', models: ['deepseek-flash', 'deepseek-v4-pro'], def: 'deepseek-flash' },
    openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', path: '/chat/completions', models: ['gpt-4o-mini'], def: 'gpt-4o-mini' }
  };
  var CFG_KEY = 'seda-ai', HIST_KEY = 'seda-chat';
  A.cfg = Object.assign({ provider: 'deepseek', model: 'deepseek-flash', apiKey: '', remember: true, sendContext: true, mode: 'auto', consent: false }, Store.lsGet(CFG_KEY, {}));
  try { if (!A.cfg.apiKey) A.cfg.apiKey = sessionStorage.getItem('seda-ai-key') || ''; } catch (e) { /* sin acción */ }
  A.history = Store.lsGet(HIST_KEY, []) || [];
  var busy = false, ctrl = null;

  A.saveCfg = function () {
    var c = Object.assign({}, A.cfg);
    try { sessionStorage.removeItem('seda-ai-key'); } catch (e) { /* sin acción */ }
    if (!c.remember) { try { sessionStorage.setItem('seda-ai-key', c.apiKey || ''); } catch (e2) { /* sin acción */ } c.apiKey = ''; }
    Store.lsSet(CFG_KEY, c);
  };
  A.saveHist = function () { Store.lsSet(HIST_KEY, A.history.slice(-40)); };
  A.detectProvider = function (key) {
    key = String(key || '').trim();
    if (/^sk-[a-f0-9]{32}$/i.test(key)) return 'deepseek';
    if (/^sk-(proj-|svcacct-)?[A-Za-z0-9_\-]{30,}$/.test(key)) return 'openai';
    return null;
  };
  A.online = function () { return A.cfg.mode !== 'local' && !!A.cfg.apiKey && navigator.onLine !== false; };
  A.modeLabel = function () {
    if (A.online()) return '● En línea · ' + A.PROVIDERS[A.cfg.provider].name + ' (' + A.cfg.model + ')';
    if (A.cfg.mode === 'local') return '○ Modo local (solo resultados de la app)';
    return A.cfg.apiKey ? '○ Sin conexión · modo local' : '○ Modo local · configure la clave API para IA en línea';
  };

  /* ---------------- Contexto agregado para la IA ---------------- */
  var f1 = function (v, d) { return U.fmt(v, d == null ? 1 : d); };
  A.context = function () {
    var S = st(), sys = SEDA.App.system(), L = [];
    L.push('Página actual: ' + (S.currentPage || 'dashboard') + '. Operación: ' + (S.runId || 'sin operación') + '. Pasos completados: ' + Object.keys(S.steps || {}).sort(function (a, b) { return a - b; }).join(',') + ' de 15.');
    L.push('Sistema: ' + sys.name + ', ' + sys.place + ' (lat ' + sys.lat + ', lon ' + sys.lon + '), FV ' + (sys.kwp || '?') + ' kWp, inversor ' + (sys.inverterKw || '?') + ' kW, batería nominal ' + (sys.batteryKwh || '?') + ' kWh.');
    if (S.source) L.push('Datos: archivo "' + S.source.fileName + '"' + (S.source.synthetic ? ' — DATOS SINTÉTICOS DE DEMOSTRACIÓN, NO REALES' : '') + '; ' + (S.raw ? S.raw.rows.length : 0) + ' registros brutos; período ' + U.fmtDate(S.source.start) + ' a ' + U.fmtDate(S.source.end) + '.');
    else L.push('Datos: aún no se han cargado datos.');
    if (S.validation) { var V = S.validation; L.push('Validación: calidad de datos ' + f1(V.quality.score) + ' % (C ' + f1(V.quality.C * 100) + ', K ' + f1(V.quality.K * 100) + ', T ' + f1(V.quality.T * 100) + ', O ' + f1(V.quality.O * 100) + ', V ' + f1(V.quality.V * 100) + '); válidos ' + V.valid + '/' + V.total + '; faltantes ' + V.missingCells + '; duplicados ' + V.duplicates + '; atípicos ' + V.outlierCells + '; huecos ' + V.gaps + '; paso ' + V.stepLabel + '.'); }
    if (S.clean) { var c = S.clean.summary; L.push('Limpieza: ' + c.finalRows + ' registros procesados; corregidos ' + c.corrected + ', interpolados ' + c.interpolated + ', invalidados ' + c.invalidated + ', eliminados ' + (c.removedDup + c.removedInvalidDate) + '.'); }
    if (S.model && S.evaluation) {
      var m = S.model, ev = S.evaluation, t = ev.metrics.test, cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
      var imp = m.features.map(function (f, i) { return [ML.flabel(f), m.importance[i] * 100]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6).map(function (x) { return x[0] + ' ' + f1(x[1]) + '%'; }).join(', ');
      L.push('Modelo: Random Forest (' + m.params.nTrees + ' árboles, profundidad ' + m.params.maxDepth + ', min hoja ' + m.params.minLeaf + ', ' + m.features.length + ' variables), objetivo ' + M.label(m.targetKey) + '. División cronológica 60/20/20: entrenamiento ' + ev.split.train.n + ', validación ' + ev.split.val.n + ', prueba ' + ev.split.test.n + ' (' + U.fmtDate(ev.split.test.start) + '–' + U.fmtDate(ev.split.test.end) + ').');
      L.push('Métricas en prueba: RF MAE ' + f1(cv(t.rf.mae), 3) + ' kW, RMSE ' + f1(cv(t.rf.rmse), 3) + ' kW, MAPE ' + f1(t.rf.mape) + ' %, R² ' + f1(t.rf.r2, 3) + '; Persistencia 24 h MAE ' + f1(cv(t.pers.mae), 3) + ' kW, RMSE ' + f1(cv(t.pers.rmse), 3) + ' kW, MAPE ' + f1(t.pers.mape) + ' %. Error energía diaria RF ' + f1(ev.daily.rf.mae, 2) + ' kWh/día (WAPE ' + f1(ev.daily.rf.wape, 2) + ' %), persistencia ' + f1(ev.daily.pe.mae, 2) + ' kWh/día.');
      L.push('Importancia de variables (MDI, no causal): ' + imp + '.');
    } else L.push('Modelo: no entrenado.');
    if (S.prediction) { var P = S.prediction; L.push('Predicción: ' + U.fmtDate(P.date) + ' ' + U.p2(P.hour) + ':00 → ' + f1(P.kwH0, 2) + ' kW; generación restante ' + f1(P.remainingKWh) + ' kWh en ' + P.hoursLeft + ' h; día completo ' + f1(P.dayKWh) + ' kWh; similitud ' + P.similarity.inRange + '/' + P.similarity.total + ' entradas en rango.'); }
    if (S.decision) {
      var d = S.decision, r = d.result, i = r.inputs;
      L.push('Entradas de la decisión: capacidad ' + i.capKWh + ' kWh, SOC actual ' + i.socNow + ' %, consumo nocturno ' + i.nightLoad + ' kWh, SOC mínimo ' + i.socMin + ' %, η batería ' + i.effBat + ' %, η inversor ' + i.effInv + ' %, horas restantes ' + i.hoursLeft + ', margen ' + i.margin + ' %, consumo diurno ' + (i.dayLoad || 0) + ' kWh.');
      L.push('Resultado de la decisión: generación esperada ' + f1(r.gen) + ' kWh; energía nocturna requerida ' + f1(r.Ereq) + ' kWh; RESERVA RECOMENDADA ' + f1(r.Eres) + ' kWh; SOC OBJETIVO ' + f1(r.socObj, 0) + ' %; SOC proyectado al anochecer ' + f1(r.nom.socSun, 0) + ' %; energía disponible para la noche ' + f1(r.nom.Eavail) + ' kWh; cobertura ' + U.fmtCover(r.nom.cover) + ' % (conservadora ' + U.fmtCover(r.cons.cover) + ' %, error relativo ' + f1(r.errRel * 100) + ' %); RIESGO ' + r.risk + ' (' + r.rule + '); confiabilidad ' + f1(d.reliability.score, 0) + '/100 (' + d.reliability.level + ').');
      L.push('Recomendaciones: ' + d.recos.map(function (x) { return x.title + ' — ' + x.text; }).join(' | '));
    } else L.push('Decisión: no calculada.');
    if (S.scenarios) L.push('Escenarios: ' + S.scenarios.list.map(function (s) { return s.name + ': gen ' + f1(s.gen) + ' kWh, reserva ' + f1(s.reserve) + ' kWh, SOC anochecer ' + f1(s.socSun, 0) + ' %, cobertura ' + U.fmtCover(s.cover) + ' %, riesgo ' + s.risk; }).join(' | '));
    if (SEDA.Design) {
      var pj = SEDA.Design.project(), q = pj.nasa.query, ds = SEDA.Design.dataset(), ps = pj.summary, I = pj.inputs;
      L.push('Proyecto FV — sitio: ' + (pj.site.place || '') + ' (lat ' + pj.site.lat + ', lon ' + pj.site.lon + ', ' + (pj.site.country || '') + ', UTC' + (pj.site.utcOffset >= 0 ? '+' : '') + pj.site.utcOffset + '). NASA POWER: ' + (ds ? 'datos ' + SEDA.Nasa.LEVELS[ds.level].label.toLowerCase() + ' cargados (' + ds.t.length + ' registros; GHI ' + f1(SEDA.Nasa.summary(ds).ghiYear, 0) + ' kWh/m²·año)' : 'sin consultar') + '; consulta configurada: comunidad ' + q.community + ', nivel ' + q.level + ', ' + q.start + ' a ' + q.end + ', parámetros ' + q.params.join(',') + '.');
      L.push('Requerimientos de diseño: sistema ' + I.sysType + ', consumo ' + I.dailyKwh + ' kWh/día (noche ' + I.nightKwh + ' kWh), pico ' + I.peakKw + ' kW, cobertura ' + I.coverage + ' %, criterio ' + I.criterion + ', autonomía ' + I.autonomyDays + ' noches, montaje ' + I.mount + ', objetivo del optimizador ' + I.objective + '; componentes: panel ' + I.panel + ', inversor ' + I.inverter + ', batería ' + I.battery + '.');
      if (ps) L.push('Diseño actual: ' + f1(ps.kwp, 2) + ' kWp · ' + ps.layout + (ps.bat ? ' · batería ' + f1(ps.bat, 1) + ' kWh' : '') + ' · energía ' + f1(ps.energy, 0) + ' kWh/año · inversión total ' + SEDA.Costs.money(ps.total) + ' · LCOE ' + SEDA.Costs.money(ps.lcoe) + '/kWh.');
    }
    if (S.simulation) { var k = S.simulation.kpi, sp = S.simulation.params; L.push('Simulación interactiva (' + S.simulation.source + ', ' + U.fmtDate(sp.date) + ', estrategia ' + SEDA.Sim.stratName(sp.strategy) + '): FV ' + f1(k.pvAvail) + ' kWh, consumo ' + f1(k.load) + ' kWh, autosuficiencia ' + f1(k.selfSuff, 0) + ' %, respaldo ' + f1(k.backup) + ' kWh, no servida ' + f1(k.unserved) + ' kWh, recorte ' + f1(k.curtail) + ' kWh, SOC al anochecer ' + f1(k.socSunset, 0) + ' % (reserva ' + Math.round(k.reserveSoc) + ' %: ' + (k.reserveMet ? 'cumplida' : 'no cumplida') + '), SOC al amanecer ' + f1(k.socEnd, 0) + ' %.'); }
    return L.join('\n');
  };
  A.SYSTEM = [
    'Eres «Asistente SEGAR», el asistente técnico integrado en la aplicación SEGAR SOLAR ENERGY DECISIÓN IA: plataforma offline-first de Machine Learning (Random Forest vs persistencia) para sistemas solares fotovoltaicos con batería, que responde «¿cuánta energía solar puedo esperar y cuánta debo reservar para la operación nocturna?».',
    'Tu usuario es un ingeniero de energía o estudiante. Responde SIEMPRE en español, con precisión técnica y de forma concisa (≤ 180 palabras salvo que pidan detalle), con unidades (kW, kWh, %, W/m²) y listas cortas cuando ayuden.',
    'Reglas: (1) Usa solo los números del CONTEXTO DE LA APLICACIÓN; si falta un dato dilo y sugiere el paso de la app que lo produce. Nunca inventes datos, métricas ni probabilidades. (2) El riesgo y el índice de confiabilidad son clasificaciones por reglas, no probabilidades; la predicción es puntual, sin intervalos de confianza. (3) Si los datos son sintéticos, recuérdalo al concluir. (4) La importancia de variables no implica causalidad. (5) Explica fórmulas cuando sirva: reserva = consumo nocturno / (η_bat·η_inv) × (1 + margen); SOC objetivo = SOC_mín + reserva/capacidad×100.',
    'Puedes operar la aplicación. Si el usuario pide hacer algo (o conviene), añade AL FINAL como máximo 2 bloques exactamente así: <accion>{"tipo":"..."}</accion>. Tipos: ' +
    '{"tipo":"navegar","pagina":"dashboard|metodologia|sitio|diseno|costos|manual|importar|mapeo|validacion|limpieza|datos|exploracion|historico|modelo|evaluacion|prediccion|decision|escenarios|simulacion|informe|historial|sistema"}; ' +
    '{"tipo":"sitio","lat":11.54,"lon":-72.91,"nombre":"Riohacha"}; {"tipo":"nasa","nivel":"hourly|daily|monthly|climatology","inicio":"AAAA-MM-DD","fin":"AAAA-MM-DD","preset":"fv|rad|met"} (consulta la API NASA POWER para el sitio); ' +
    '{"tipo":"diseno","sistema":"ongrid|hibrido|aislado","consumo_kwh":65,"noche_kwh":35,"pico_kw":8,"autonomia":1,"atajo":"res-on|hyb|off|com|micro","objetivo":"lcoe|yield|fraction|capex|area","optimizar":true}; ' +
    '{"tipo":"costos","moneda":"COP|USD","ley1715":true,"contingencia":5,"tarifa":950}; {"tipo":"manual","descargar":false}; ' +
    '{"tipo":"flujo_completo"}; {"tipo":"cargar_demo"}; {"tipo":"entrenar","arboles":100,"profundidad":10,"min_hoja":2}; {"tipo":"predecir","fecha":"AAAA-MM-DD","hora":9}; ' +
    '{"tipo":"decidir","capacidad":80,"soc_actual":35,"consumo_nocturno":35,"soc_minimo":20,"margen":15,"consumo_diurno":30,"eficiencia_bateria":95,"eficiencia_inversor":96} (solo los campos a cambiar); ' +
    '{"tipo":"escenario","irradiancia_pct":-30,"temperatura_delta":0,"viento_pct":0,"humedad_delta":0,"consumo_pct":0}; ' +
    '{"tipo":"simulacion","fuente":"rf|hist|fisico","fecha":"AAAA-MM-DD","irradiancia_pct":0,"variabilidad":35,"kwp":20,"bateria_kwh":80,"soc_inicial":40,"consumo_kwh":80,"estrategia":"predictiva|reserva|autoconsumo","soc_reserva":70,"respaldo":"generador|ninguno","reproducir":true}; ' +
    '{"tipo":"informe","modo":"tecnico|ejecutivo"}; {"tipo":"descargar","formato":"excel|csv|procesados|html|pdf|config"}. ' +
    'El módulo «Proyecto FV» permite elegir un punto en el mapa mundial, consultar NASA POWER (como el Data Access Viewer), diseñar el arreglo (paneles, inversores, baterías, cadenas dentro de la ventana MPPT), estimar costos editables en COP/USD con cableado y protecciones (NTC 2050/RETIE) y generar un manual de instalación. Los precios son referenciales y editables.',
    'El usuario confirma cada acción; en el texto explica en una frase qué hará, sin mostrar el JSON.'
  ].join('\n');

  /* ---------------- Acciones ---------------- */
  var PAGES = ['dashboard', 'metodologia', 'sitio', 'diseno', 'costos', 'manual', 'importar', 'mapeo', 'validacion', 'limpieza', 'datos', 'exploracion', 'historico', 'modelo', 'evaluacion', 'prediccion', 'decision', 'escenarios', 'simulacion', 'informe', 'historial', 'sistema'];
  var PAGE_NAMES = { dashboard: 'Dashboard', metodologia: 'Metodología', sitio: 'Sitio y NASA POWER', diseno: 'Diseño del sistema', costos: 'Costos y presupuesto', manual: 'Manual de instalación', importar: 'Importar datos', mapeo: 'Mapeo de variables', validacion: 'Validación', limpieza: 'Limpieza', datos: 'Brutos vs procesados', exploracion: 'Exploración', historico: 'Análisis histórico', modelo: 'Configurar y entrenar', evaluacion: 'Evaluación', prediccion: 'Predicción solar', decision: 'Decisión energética', escenarios: '¿Qué pasaría si?', simulacion: 'Simulación interactiva', informe: 'Informe', historial: 'Historial', sistema: 'Sistema y privacidad' };
  var nz = function (v) { return v !== undefined && v !== null && v !== '' && isFinite(+v); };
  var LBL = { irradiancia_pct: ['irradiancia', '%', 1], temperatura_delta: ['temperatura', '°C', 1], viento_pct: ['viento', '%', 1], humedad_delta: ['humedad', 'pp', 1], consumo_pct: ['consumo nocturno', '%', 1],
    capacidad: ['capacidad', 'kWh'], margen: ['margen', '%'], soc_actual: ['SOC actual', '%'], consumo_nocturno: ['consumo nocturno', 'kWh'], soc_minimo: ['SOC mínimo', '%'], consumo_diurno: ['consumo diurno', 'kWh'],
    eficiencia_bateria: ['η batería', '%'], eficiencia_inversor: ['η inversor', '%'], horas_restantes: ['horas restantes', 'h'], variabilidad: ['variabilidad', '%'], kwp: ['FV', 'kWp'], inversor_kw: ['inversor', 'kW'],
    bateria_kwh: ['batería', 'kWh'], soc_inicial: ['SOC inicial', '%'], consumo_kwh: ['consumo', 'kWh/día'], soc_reserva: ['SOC de reserva', '%'], estrategia: ['estrategia', ''], respaldo: ['respaldo', ''], fuente: ['fuente', ''], fecha: ['fecha', ''] };
  var params = function (a, skipZero) {
    return Object.keys(a).filter(function (k) { return k !== 'tipo' && k !== 'reproducir' && a[k] != null && a[k] !== '' && !(skipZero && +a[k] === 0); }).map(function (k) {
      var l = LBL[k] || [k.replace(/_/g, ' '), ''], v = a[k];
      if (l[2] && isFinite(+v) && +v > 0) v = '+' + v;
      return ' · ' + l[0] + ' ' + v + (l[1] ? ' ' + l[1] : '');
    }).join('');
  };
  A.describe = function (a) {
    switch (a.tipo) {
      case 'navegar': return 'Ir a «' + (PAGE_NAMES[a.pagina] || a.pagina) + '»';
      case 'flujo_completo': return 'Ejecutar el flujo completo (15 pasos)';
      case 'cargar_demo': return 'Cargar los datos sintéticos de La Guajira';
      case 'entrenar': return 'Entrenar el Random Forest' + (nz(a.arboles) ? ' · ' + a.arboles + ' árboles' : '') + (nz(a.profundidad) ? ' · profundidad ' + a.profundidad : '') + (nz(a.min_hoja) ? ' · min hoja ' + a.min_hoja : '');
      case 'predecir': return 'Calcular la predicción' + (a.fecha ? ' del ' + a.fecha : '') + (nz(a.hora) ? ' a las ' + U.p2(+a.hora) + ':00' : '');
      case 'decidir': return 'Recalcular la decisión energética' + params(a);
      case 'escenario': return 'Simular escenario' + params(a, true);
      case 'simulacion': return 'Abrir la simulación interactiva' + params(a) + (a.reproducir ? ' · reproducir' : '');
      case 'informe': return 'Generar el informe ' + (a.modo === 'ejecutivo' ? 'ejecutivo' : 'técnico');
      case 'sitio': return 'Elegir el punto ' + (nz(a.lat) ? (+a.lat).toFixed(4) + ', ' + (+a.lon).toFixed(4) : '') + (a.nombre ? ' (' + a.nombre + ')' : '') + ' en el mapa';
      case 'nasa': return 'Consultar NASA POWER' + (a.nivel ? ' · ' + ((SEDA.Nasa.LEVELS[a.nivel] || {}).label || a.nivel) : '') + (a.inicio ? ' · ' + a.inicio + ' → ' + (a.fin || '') : '') + ' (envía solo coordenadas y parámetros)';
      case 'diseno': return 'Diseñar el sistema' + (a.atajo ? ' · atajo ' + a.atajo : '') + (a.sistema ? ' · ' + a.sistema : '') + (nz(a.consumo_kwh) ? ' · ' + a.consumo_kwh + ' kWh/día' : '') + (nz(a.noche_kwh) ? ' · noche ' + a.noche_kwh + ' kWh' : '') + (a.optimizar ? ' · optimizar (' + (a.objetivo || 'lcoe') + ')' : '');
      case 'costos': return 'Abrir el presupuesto' + (a.moneda ? ' en ' + a.moneda : '') + (a.ley1715 != null ? (a.ley1715 ? ' · con exclusión de IVA (Ley 1715)' : ' · con IVA') : '') + (nz(a.contingencia) ? ' · contingencia ' + a.contingencia + ' %' : '') + (nz(a.tarifa) ? ' · tarifa ' + a.tarifa + ' COP/kWh' : '');
      case 'manual': return a.descargar ? 'Descargar el manual de instalación (HTML)' : 'Abrir el manual de instalación';
      case 'descargar': return 'Descargar ' + ({ excel: 'resultados Excel', csv: 'resultados CSV', procesados: 'datos procesados', html: 'informe HTML', pdf: 'informe PDF (imprimir)', config: 'configuración' }[a.formato] || a.formato);
      default: return 'Acción desconocida';
    }
  };
  A.valid = function (a) { return a && typeof a === 'object' && ['navegar', 'flujo_completo', 'cargar_demo', 'entrenar', 'predecir', 'decidir', 'escenario', 'simulacion', 'informe', 'descargar', 'sitio', 'nasa', 'diseno', 'costos', 'manual'].indexOf(a.tipo) >= 0 && (a.tipo !== 'sitio' || (nz(a.lat) && nz(a.lon) && Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180)) && (a.tipo !== 'navegar' || PAGES.indexOf(a.pagina) >= 0); };

  A.exec = async function (a) {
    var S = st(), App = SEDA.App, Act = SEDA.Actions;
    var needModel = async function () {
      if (S.model) return true;
      if (!S.raw) await App.loadDemo();
      if (!S.mappingConfirmed && !App.applyMapping()) return false;
      if (!S.validation) App.runValidation();
      if (!S.processed) App.runCleaning();
      U.busy('Entrenando Random Forest…');
      var ok = await App.train(function (x, n) { U.busy('Entrenando Random Forest (' + Math.round(x / n * 100) + ' %)…'); });
      U.idle(); return ok;
    };
    switch (a.tipo) {
      case 'navegar': App.go(a.pagina); return 'Listo: se abrió «' + PAGE_NAMES[a.pagina] + '».';
      case 'flujo_completo': await App.autopilot(); return A.summaryDecision('Flujo completo ejecutado.');
      case 'cargar_demo': await App.loadDemo(); return 'Datos sintéticos de La Guajira cargados (' + S.raw.rows.length + ' registros). Siguiente paso: mapeo y validación.';
      case 'entrenar': {
        if (!S.raw) await App.loadDemo();
        if (nz(a.arboles)) S.mlParams.nTrees = U.clamp(Math.round(+a.arboles), 1, 500);
        if (nz(a.profundidad)) S.mlParams.maxDepth = U.clamp(Math.round(+a.profundidad), 1, 30);
        if (nz(a.min_hoja)) S.mlParams.minLeaf = U.clamp(Math.round(+a.min_hoja), 1, 200);
        if (!S.mappingConfirmed && !App.applyMapping()) return 'No se pudo aplicar el mapeo automáticamente; revíselo en «Mapeo de variables».';
        if (!S.validation) App.runValidation();
        if (!S.processed) App.runCleaning();
        U.busy('Entrenando Random Forest…');
        var ok = await App.train(function (x, n) { U.busy('Entrenando Random Forest (' + Math.round(x / n * 100) + ' %)…'); });
        U.idle();
        if (!ok) return 'El entrenamiento no se completó.';
        App.go('evaluacion');
        var ev = S.evaluation, t = ev.metrics.test, cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
        return 'Modelo entrenado en ' + f1(S.model.trainMs / 1000, 2) + ' s (' + S.model.params.nTrees + ' árboles, profundidad ' + S.model.params.maxDepth + '). En prueba: **RMSE ' + f1(cv(t.rf.rmse), 3) + ' kW** vs persistencia ' + f1(cv(t.pers.rmse), 3) + ' kW; MAPE ' + f1(t.rf.mape) + ' %.';
      }
      case 'predecir': {
        if (!(await needModel())) return 'No fue posible preparar el modelo.';
        var dt = a.fecha ? U.parseDateInput(a.fecha) : (S.prediction ? S.prediction.date : U.dayStart(U.nowLocalNaive()));
        var hr = nz(a.hora) ? U.clamp(Math.round(+a.hora), 0, 23) : (S.prediction ? S.prediction.hour : 9);
        App.predict({ date: isFinite(dt) ? dt : U.dayStart(U.nowLocalNaive()), hour: hr });
        App.go('prediccion');
        var P = S.prediction;
        return 'Predicción para el ' + U.fmtDate(P.date) + ' a las ' + U.p2(P.hour) + ':00: **' + f1(P.kwH0, 2) + ' kW**; generación restante ' + f1(P.remainingKWh) + ' kWh en ' + P.hoursLeft + ' h (día completo ' + f1(P.dayKWh) + ' kWh). Estimación puntual.';
      }
      case 'decidir': {
        if (!(await needModel())) return 'No fue posible preparar el modelo.';
        var map = { capacidad: 'capKWh', soc_actual: 'socNow', consumo_nocturno: 'nightLoad', soc_minimo: 'socMin', margen: 'margin', consumo_diurno: 'dayLoad', eficiencia_bateria: 'effBat', eficiencia_inversor: 'effInv', horas_restantes: 'hoursLeft' };
        var inp = {};
        Object.keys(map).forEach(function (k) { if (nz(a[k])) inp[map[k]] = +a[k]; });
        await App.decide(inp);
        App.go('decision');
        return A.summaryDecision('Decisión recalculada.');
      }
      case 'escenario': {
        if (!S.decision) { if (!(await needModel())) return 'No fue posible preparar el modelo.'; await App.decide(); }
        var mods = {};
        if (nz(a.irradiancia_pct)) mods.irrPct = +a.irradiancia_pct;
        if (nz(a.temperatura_delta)) mods.tempDelta = +a.temperatura_delta;
        if (nz(a.viento_pct)) mods.windPct = +a.viento_pct;
        if (nz(a.humedad_delta)) mods.humDelta = +a.humedad_delta;
        if (nz(a.consumo_pct)) mods.loadPct = +a.consumo_pct;
        if (nz(a.capacidad)) mods.cap = +a.capacidad;
        if (nz(a.margen)) mods.margin = +a.margen;
        App.simulate(mods);
        App.go('escenarios');
        var L = S.scenarios.list, c = L[L.length - 1], b = L[0];
        if (c.id !== 'custom') c = b;
        return 'Escenario simulado: generación **' + f1(c.gen) + ' kWh** (' + (c.gen - b.gen >= 0 ? '+' : '') + f1(c.gen - b.gen) + ' vs base), reserva ' + f1(c.reserve) + ' kWh, SOC al anochecer ' + f1(c.socSun, 0) + ' %, cobertura ' + U.fmtCover(c.cover) + ' % → riesgo **' + c.risk + '**.';
      }
      case 'simulacion': {
        var Sim = SEDA.Sim;
        if (!S.simParams) S.simParams = Sim.defaults();
        var sm = { fuente: 'source', irradiancia_pct: 'irrPct', variabilidad: 'variability', temperatura_delta: 'tempDelta', kwp: 'kwp', inversor_kw: 'invKw', bateria_kwh: 'batKwh', soc_inicial: 'socInit', soc_minimo: 'socMin', consumo_kwh: 'loadKwh', estrategia: 'strategy', soc_reserva: 'reserveSoc', respaldo: 'backup' };
        var mm = {};
        Object.keys(sm).forEach(function (k) { if (a[k] != null && a[k] !== '') mm[sm[k]] = a[k]; });
        if (a.fecha) { var dd = U.parseDateInput(a.fecha); if (isFinite(dd)) mm.date = dd; }
        Sim.apply(mm);
        App.go('simulacion');
        if (a.reproducir) setTimeout(function () { Sim.play(); var b2 = U.$('#ck-play'); if (b2) b2.textContent = '⏸'; }, 250);
        var k = S.simulation ? S.simulation.kpi : null;
        return k ? 'Simulación actualizada: autosuficiencia **' + f1(k.selfSuff, 0) + ' %**, respaldo ' + f1(k.backup) + ' kWh, SOC al anochecer ' + f1(k.socSunset, 0) + ' % (reserva ' + Math.round(k.reserveSoc) + ' % ' + (k.reserveMet ? 'cumplida' : 'no cumplida') + ').' : 'Simulación abierta.';
      }
      case 'informe': {
        if (!(await needModel())) return 'No fue posible preparar el modelo.';
        S.report = Object.assign({}, S.report || {}, { mode: a.modo === 'ejecutivo' ? 'exec' : 'tech' });
        await Act.report();
        return 'Informe ' + (a.modo === 'ejecutivo' ? 'ejecutivo' : 'técnico') + ' generado. Puede descargarlo en HTML o guardarlo como PDF desde la página «Informe».';
      }
      case 'sitio': {
        var WMp = SEDA.WorldMap, Dzp = SEDA.Design, pj = Dzp.project(), la = +a.lat, lo = +a.lon, ct = WMp.countryAt(la, lo);
        var nc = WMp.nearestCity(la, lo, 45);
        pj.site = { lat: la, lon: lo, place: a.nombre || (nc ? nc.city.name + ', ' + nc.city.region : ct ? 'Punto en ' + ct.name : 'Punto en el océano'), country: ct ? ct.name : 'Océano', a2: ct ? ct.a2 : '', elev: NaN, utcOffset: ct && ct.a2 === 'CO' ? -5 : Math.round(lo / 15), source: 'asistente' };
        Dzp.invalidate(); Dzp.saveNow();
        App.go('sitio');
        return 'Punto de análisis: **' + U.esc(pj.site.place) + '** (' + WMp.fmtLat(la) + ', ' + WMp.fmtLon(lo) + (ct ? ', ' + U.esc(ct.name) : '') + '). Ahora puede consultar NASA POWER para este sitio.';
      }
      case 'nasa': {
        var Dn = SEDA.Design, Nn = SEDA.Nasa, pn = Dn.project(), qn = pn.nasa.query;
        if (a.nivel && Nn.LEVELS[a.nivel]) { qn.level = a.nivel; qn.params = Nn.presetFor(a.preset || 'fv', a.nivel); }
        else if (a.preset) qn.params = Nn.presetFor(a.preset, qn.level);
        if (a.inicio) qn.start = a.inicio; if (a.fin) qn.end = a.fin;
        var errs = Nn.validate(qn, pn.site.lat, pn.site.lon);
        if (errs.length) { App.go('sitio'); return 'No se pudo consultar: ' + errs.join(' '); }
        Dn.saveNow();
        U.busy('Consultando NASA POWER…');
        try {
          var rn = await Nn.fetch(qn, pn.site.lat, pn.site.lon, { utcOffset: pn.site.utcOffset, site: pn.site });
          Dn.setDataset(rn.ds, rn.key); pn.site.elev = rn.ds.elev; Dn.saveNow();
        } catch (e) { U.idle(); App.go('sitio'); return 'NASA POWER no respondió: ' + (e.message || e) + ' Puede importar el CSV oficial desde «Sitio y NASA POWER».'; }
        U.idle();
        App.go('sitio');
        var smn = Nn.summary(Dn.dataset());
        return 'Datos NASA POWER ' + Nn.LEVELS[qn.level].label.toLowerCase() + ' recibidos (' + Dn.dataset().t.length + ' registros). ' + (smn.ghiYear ? 'GHI anual **' + f1(smn.ghiYear, 0) + ' kWh/m²** (' + f1(smn.psh, 2) + ' HSP), mes crítico ' + U.MESES_L[smn.worstMonth] + ', inclinación óptima **' + smn.opt.tilt + '°**.' : '');
      }
      case 'diseno': {
        var Dd = SEDA.Design; await Dd.ready();
        var pd = Dd.project(), I = pd.inputs;
        if (a.atajo) Dd.applyPreset(a.atajo);
        if (a.sistema && Dd.SYS[a.sistema]) { I.sysType = a.sistema; if (a.sistema === 'aislado') I.criterion = 'critico'; }
        if (nz(a.consumo_kwh)) I.dailyKwh = +a.consumo_kwh;
        if (nz(a.noche_kwh)) I.nightKwh = +a.noche_kwh;
        if (nz(a.pico_kw)) I.peakKw = +a.pico_kw;
        if (nz(a.autonomia)) I.autonomyDays = +a.autonomia;
        if (a.objetivo && Dd.OBJECTIVES[a.objetivo]) I.objective = a.objetivo;
        if (I.nightKwh > I.dailyKwh) I.nightKwh = I.dailyKwh;
        Dd.invalidate();
        var cd = Dd.current();
        if (a.optimizar || !cd.ok) { Dd.applyBest(); Dd.invalidate(); cd = Dd.current(); }
        Dd.saveNow();
        App.go('diseno');
        if (!cd.ok) return 'No se encontró un diseño compatible: ' + cd.reason;
        return 'Diseño: **' + f1(cd.kwp, 2) + ' kWp** — ' + cd.layout + ' con ' + U.esc(cd.panel.name) + ' y ' + cd.nInv + ' × ' + U.esc(cd.inv.name) + (cd.bank ? '; batería **' + f1(cd.bank.kwh, 1) + ' kWh** (' + cd.bank.series + 's×' + cd.bank.par + 'p)' : '') + '. Producción ' + f1(cd.sim.ac, 0) + ' kWh/año (' + f1(cd.sim.specYield, 0) + ' kWh/kWp, PR ' + f1(cd.sim.pr * 100, 1) + ' %), fracción solar ' + f1(cd.sim.solarFrac * 100, 0) + ' %, inversión **' + SEDA.Costs.money(cd.bom.total) + '**, LCOE ' + SEDA.Costs.money(cd.econ.lcoe) + '/kWh.';
      }
      case 'costos': {
        var Dc = SEDA.Design; await Dc.ready();
        var pc = Dc.project(); pc.costs.params = Object.assign({}, pc.costs.params);
        if (a.moneda === 'USD' || a.moneda === 'COP') pc.costs.params.currency = a.moneda;
        if (a.ley1715 != null) pc.costs.params.ley1715 = !!a.ley1715;
        if (nz(a.contingencia)) pc.costs.params.contPct = +a.contingencia;
        if (nz(a.tarifa)) pc.econ.tariff = +a.tarifa;
        Dc.invalidate(); Dc.saveNow();
        App.go('costos');
        var fc = Dc.final();
        if (!fc || !fc.ok) return 'Primero diseñe el sistema para obtener el presupuesto.';
        var gr = Object.keys(fc.bom.groups).map(function (k) { return [k, fc.bom.groups[k].total]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4);
        return 'Presupuesto: **' + SEDA.Costs.money(fc.bom.total) + '** (' + SEDA.Costs.moneyAlt(fc.bom.total) + ', ' + SEDA.Costs.money(fc.econ.perWp) + '/Wp). Mayores rubros: ' + gr.map(function (g) { return g[0] + ' ' + SEDA.Costs.money(g[1]); }).join(', ') + '. LCOE ' + SEDA.Costs.money(fc.econ.lcoe) + '/kWh, recuperación ' + (isFinite(fc.econ.payback) ? f1(fc.econ.payback, 1) + ' años' : '—') + '. Precios referenciales editables.';
      }
      case 'manual': {
        var Dm = SEDA.Design; await Dm.ready();
        App.go('manual');
        var fm2 = Dm.final();
        if (!fm2 || !fm2.ok) return 'Primero diseñe el sistema para generar el manual.';
        if (a.descargar) U.download('SEGAR_manual_instalacion_' + U.fmt(fm2.kwp, 1) + 'kWp.html', SEDA.Manual.standalone(fm2), 'text/html;charset=utf-8');
        return 'Manual de instalación del sistema de ' + f1(fm2.kwp, 2) + ' kWp ' + (a.descargar ? 'descargado (HTML autónomo).' : 'abierto: puede imprimirlo o guardarlo como PDF.');
      }
      case 'descargar': {
        var fm = { excel: 'dl-excel', csv: 'dl-csv', procesados: 'dl-processed', html: 'dl-html', pdf: 'print-pdf', config: 'dl-config' }[a.formato];
        if (!fm) return 'Formato no reconocido.';
        await Act[fm]();
        return 'Descarga iniciada: ' + A.describe(a).replace('Descargar ', '') + '.';
      }
    }
    return 'Acción no reconocida.';
  };
  A.summaryDecision = function (prefix) {
    var S = st(); if (!S.decision) return prefix;
    var r = S.decision.result;
    return prefix + ' Reserva recomendada **' + f1(r.Eres) + ' kWh**, SOC objetivo **' + f1(r.socObj, 0) + ' %**, generación esperada ' + f1(r.gen) + ' kWh, SOC proyectado al anochecer ' + f1(r.nom.socSun, 0) + ' % → riesgo **' + r.risk + '**.';
  };

  /* ---------------- Asistente local (sin conexión) ---------------- */
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase(); }
  var PAGE_SYN = [
    ['sitio', ['sitio', 'mapa', 'nasa', 'ubicacion', 'recurso solar']], ['diseno', ['diseno', 'disenar', 'arreglo', 'paneles', 'inversores', 'componentes']], ['costos', ['costo', 'presupuesto', 'precio', 'cotizacion']], ['manual', ['manual', 'instalacion']],
    ['simulacion', ['simulacion', 'gemelo', 'simulador visual', 'animacion', 'animada']], ['escenarios', ['escenario', 'que pasaria']], ['dashboard', ['dashboard', 'tablero', 'panel', 'inicio']],
    ['metodologia', ['metodologia', 'siete pasos', '7 pasos']], ['importar', ['importar', 'cargar archivo', 'importacion']], ['mapeo', ['mapeo', 'mapear']],
    ['validacion', ['validacion', 'validar']], ['limpieza', ['limpieza', 'registro de limpieza']], ['datos', ['brutos', 'procesados', 'comparar datos']],
    ['exploracion', ['exploracion', 'explorar', 'correlacion']], ['historico', ['historico', 'analisis historico']], ['evaluacion', ['evaluacion', 'metricas']],
    ['modelo', ['modelo', 'entrenamiento', 'importancia']], ['prediccion', ['prediccion', 'pronostico']], ['decision', ['decision', 'reserva', 'recomendacion']],
    ['informe', ['informe', 'reporte']], ['historial', ['historial', 'operaciones']], ['sistema', ['sistema', 'privacidad', 'configuracion']]
  ];
  function findPage(n) { for (var i = 0; i < PAGE_SYN.length; i++) for (var j = 0; j < PAGE_SYN[i][1].length; j++) if (n.indexOf(PAGE_SYN[i][1][j]) >= 0) return PAGE_SYN[i][0]; return null; }
  function numAfter(n, re) { var m = new RegExp('(?:' + re + ')\\s*(?:de|del|a|en|=|:|al)?\\s*([+\\-−]?\\s*\\d+(?:[.,]\\d+)?)').exec(n); return m ? parseFloat(m[1].replace(/\s/g, '').replace('−', '-').replace(',', '.')) : null; }
  function needData(what) { return 'Aún no hay ' + what + '. Puede pedirme «ejecuta el flujo completo» o seguir los pasos desde «Importar datos».'; }

  A.local = function (text) {
    var S = st(), n = norm(text), ev = S.evaluation, d = S.decision;
    var cv = ev ? function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); } : null;
    var act = function (a, msg) { return { text: msg || '', actions: [a], run: true }; };
    /* comandos */
    if (/(ejecuta|corre|correr|haz|realiza|lanza).*(flujo|todo|todos los pasos|completo)|flujo completo/.test(n)) return act({ tipo: 'flujo_completo' });
    if (/(carga|cargar|usa|usar).*(demo|ejemplo|sintetic)/.test(n)) return act({ tipo: 'cargar_demo' });
    if (/(entrena|entrenar|reentrena|reentrenar)\b/.test(n)) return act({ tipo: 'entrenar', arboles: numAfter(n, 'arboles|arbol'), profundidad: numAfter(n, 'profundidad'), min_hoja: numAfter(n, 'hoja') });
    if (/(simula|simular|simulacion|escenario|que pasa|que pasaria).*(irradiancia|nub|consumo|carga|bateria|temperatura|viento|humedad)/.test(n) && !/simulacion interactiva|gemelo|abre|abrir|reproduc/.test(n)) {
      var sign = /(baja|reduc|dismin|menos|cae|caida)/.test(n) ? -1 : 1;
      var ip = numAfter(n, 'irradiancia|radiacion|nubes|nubosidad'), cp = numAfter(n, 'consumo|carga'), tp = numAfter(n, 'temperatura'), cap = numAfter(n, 'bateria|capacidad');
      var fix = function (v) { return v == null ? null : (v > 0 && sign < 0 ? -v : v); };
      return act({ tipo: 'escenario', irradiancia_pct: fix(ip), consumo_pct: fix(cp), temperatura_delta: tp, capacidad: cap });
    }
    if (/(simulacion|gemelo|simulador visual|animacion)/.test(n)) {
      var sa = { tipo: 'simulacion', reproducir: /(reproduc|play|inicia|anima|arranca|corre)/.test(n) };
      var sv = numAfter(n, 'irradiancia'); if (sv != null) sa.irradiancia_pct = sv;
      var so = numAfter(n, 'soc inicial|soc'); if (so != null) sa.soc_inicial = so;
      var sb = numAfter(n, 'bateria'); if (sb != null) sa.bateria_kwh = sb;
      if (/autoconsumo/.test(n)) sa.estrategia = 'autoconsumo'; else if (/predictiv/.test(n)) sa.estrategia = 'predictiva'; else if (/reserva fija/.test(n)) sa.estrategia = 'reserva';
      if (/sin respaldo|aislad/.test(n)) sa.respaldo = 'ninguno';
      return act(sa);
    }
    if (/(calcula|recalcula|calcular|recalcular|actualiza).*(decision|reserva|soc)/.test(n) || /(con|si) (el )?soc (actual )?(de |es |en )?\d/.test(n)) {
      return act({ tipo: 'decidir', soc_actual: numAfter(n, 'soc actual|soc'), consumo_nocturno: numAfter(n, 'consumo nocturno|consumo'), margen: numAfter(n, 'margen'), capacidad: numAfter(n, 'capacidad|bateria de'), soc_minimo: numAfter(n, 'soc minimo') });
    }
    if (/(predice|predecir|calcula la prediccion|pronostica)/.test(n)) {
      var fm = /(\d{4}-\d{2}-\d{2})/.exec(text); return act({ tipo: 'predecir', fecha: fm ? fm[1] : null, hora: numAfter(n, 'a las|hora') });
    }
    /* proyecto FV */
    var WMl = SEDA.WorldMap;
    var ll = /(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/.exec(text);
    if (/(punto|ubica|ubicacion|coordenad|sitio|lugar|mapa)/.test(n) && /(elige|elegir|selecciona|seleccionar|ubica|usa|usar|cambia|pon|marca|define)/.test(n)) {
      if (ll) return act({ tipo: 'sitio', lat: +ll[1].replace(',', '.'), lon: +ll[2].replace(',', '.') });
      var cty = WMl.CITIES.find(function (c) { return n.indexOf(norm(c.name)) >= 0; });
      if (cty) return act({ tipo: 'sitio', lat: cty.lat, lon: cty.lon, nombre: cty.name + ', ' + cty.region });
    }
    if (/(consulta|consultar|descarga|descargar|obten|trae|traer|busca).*(nasa|power)/.test(n)) {
      var lv = /horari/.test(n) ? 'hourly' : /diari/.test(n) ? 'daily' : /climatolog|largo plazo/.test(n) ? 'climatology' : /mensual/.test(n) ? 'monthly' : null;
      return act({ tipo: 'nasa', nivel: lv, preset: /radiacion/.test(n) ? 'rad' : /meteorolog/.test(n) ? 'met' : 'fv' });
    }
    if (/(disena|disenar|dimensiona|dimensionar|optimiza|optimizar|arma|armar).*(sistema|arreglo|planta|instalacion|paneles|fotovoltaic)|optimiza el arreglo|mejor combinacion/.test(n)) {
      var dz = { tipo: 'diseno', optimizar: true };
      if (/aislad|off.?grid|autonom/.test(n)) dz.sistema = 'aislado'; else if (/hibrid|bateri/.test(n)) dz.sistema = 'hibrido'; else if (/on.?grid|conectad|a la red|sin bateri/.test(n)) dz.sistema = 'ongrid';
      var ck = numAfter(n, 'consumo de|consumo|de'), ck2 = /(\d+(?:[.,]\d+)?)\s*kwh(?:\s*(?:al|por|\/)\s*dia|\/d)?(?!\s*(?:de|en la|por la|durante la)?\s*noche)/.exec(n);
      if (ck2) ck = parseFloat(ck2[1].replace(',', '.'));
      if (ck != null && /kwh/.test(n)) dz.consumo_kwh = ck;
      var nk = numAfter(n, 'noche|nocturno'), nk2 = /(\d+(?:[.,]\d+)?)\s*kwh\s*(?:de|en la|por la|durante la)?\s*noche/.exec(n);
      if (nk2) nk = parseFloat(nk2[1].replace(',', '.'));
      if (nk != null) dz.noche_kwh = nk;
      if (/lcoe|economic|barat/.test(n)) dz.objetivo = /barat|inversion/.test(n) ? 'capex' : 'lcoe'; else if (/eficien|rendimiento|energia especifica/.test(n)) dz.objetivo = 'yield'; else if (/area|espacio/.test(n)) dz.objetivo = 'area';
      return act(dz);
    }
    if (/(cuanto cuesta|costo|presupuesto|precio|inversion)/.test(n) && !/(tarifa de energia)/.test(n)) {
      var cz = { tipo: 'costos' };
      if (/dolar|usd/.test(n)) cz.moneda = 'USD'; else if (/pesos|cop/.test(n)) cz.moneda = 'COP';
      if (/1715|sin iva|exclusion/.test(n)) cz.ley1715 = true;
      return act(cz);
    }
    if (/manual/.test(n)) return act({ tipo: 'manual', descargar: /(descarga|descargar|guarda|exporta)/.test(n) });
    if (/(genera|generar|crea|crear|haz|hacer).*(informe|reporte)/.test(n)) return act({ tipo: 'informe', modo: /ejecutiv/.test(n) ? 'ejecutivo' : 'tecnico' });
    if (/(descarga|descargar|exporta|exportar|guarda|imprime|imprimir)/.test(n)) {
      var fmt = /excel|xlsx/.test(n) ? 'excel' : /procesad/.test(n) ? 'procesados' : /csv/.test(n) ? 'csv' : /pdf|imprim/.test(n) ? 'pdf' : /html/.test(n) ? 'html' : /config/.test(n) ? 'config' : null;
      if (fmt) return act({ tipo: 'descargar', formato: fmt });
    }
    if (/^(ir|ve|vamos|abre|abrir|muestra|muestrame|mostrar|lleva|llevame|navega|pasa)\b|\bir a\b/.test(n)) { var pg = findPage(n); if (pg) return act({ tipo: 'navegar', pagina: pg }); }
    /* preguntas */
    if (/^(hola|buenas|buenos|hey|saludos)/.test(n)) return { text: '¡Hola! Soy el **Asistente SEGAR**. ' + A.capabilities() };
    if (/(que puedes|ayuda|como funciona el asistente|que sabes|comandos)/.test(n)) return { text: A.capabilities() };
    if (/(cuanta|cuanto|que).*(reserv)|reserva recomendada|energia a reservar/.test(n)) {
      if (!d) return { text: needData('una decisión calculada') };
      var r = d.result, i = r.inputs;
      return { text: '**Energía a reservar: ' + f1(r.Eres) + ' kWh** · **SOC objetivo: ' + f1(r.socObj, 0) + ' %** al inicio de la noche.\n\n' +
        '- Energía nocturna requerida = ' + f1(+i.nightLoad) + ' kWh / (' + f1(i.effBat / 100, 2) + ' × ' + f1(i.effInv / 100, 2) + ') = ' + f1(r.Ereq) + ' kWh\n- Reserva = ' + f1(r.Ereq) + ' × (1 + ' + f1(i.margin / 100, 2) + ') = ' + f1(r.Eres) + ' kWh\n' +
        '- SOC proyectado al anochecer: ' + f1(r.nom.socSun, 0) + ' % → cobertura ' + U.fmtCover(r.nom.cover) + ' %, riesgo **' + r.risk + '**.' + (S.source && S.source.synthetic ? '\n\n_Resultados con datos sintéticos de demostración._' : '') };
    }
    if (/riesgo/.test(n)) {
      if (!d) return { text: needData('una decisión calculada') };
      var rr = d.result;
      return { text: 'Riesgo de insuficiencia energética: **' + rr.risk + '**.\n\n- Regla aplicada: ' + rr.rule + '\n- Energía disponible para la noche: ' + f1(rr.nom.Eavail) + ' kWh (conservadora ' + f1(rr.cons.Eavail) + ' kWh)\n- Reserva recomendada: ' + f1(rr.Eres) + ' kWh\n- Error relativo histórico usado: ' + f1(rr.errRel * 100) + ' %\n\nEs una clasificación por reglas (R1–R5), no una probabilidad estadística.' };
    }
    if (/\bsoc\b/.test(n)) {
      if (!d) return { text: needData('una decisión calculada') };
      return { text: 'SOC objetivo al anochecer: **' + f1(d.result.socObj, 0) + ' %**. SOC actual ' + d.result.inputs.socNow + ' %, proyectado al anochecer ' + f1(d.result.nom.socSun, 0) + ' %, mínimo ' + d.result.inputs.socMin + ' %.' };
    }
    if (/(generacion|cuanta energia solar|energia solar|produccion|kwh espera)/.test(n)) {
      if (!S.prediction) return { text: needData('una predicción') };
      var P = S.prediction;
      return { text: 'Generación esperada: **' + f1(P.remainingKWh) + ' kWh** en las próximas ' + P.hoursLeft + ' h desde las ' + U.p2(P.hour) + ':00 del ' + U.fmtDate(P.date) + ' (día completo ' + f1(P.dayKWh) + ' kWh; ' + f1(P.kwH0, 2) + ' kW a esa hora). Error histórico a esa hora: ' + f1(P.errHour, 3) + ' kW. Es una estimación puntual.' };
    }
    if (/(importan|influye|variable mas|variables mas)/.test(n)) {
      if (!S.model) return { text: needData('un modelo entrenado') };
      var imp = S.model.features.map(function (ff, ii) { return [ML.flabel(ff), S.model.importance[ii] * 100]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 5);
      return { text: 'Importancia de variables (reducción media de impureza):\n\n' + imp.map(function (x, ii) { return (ii + 1) + '. ' + x[0] + ': ' + f1(x[1]) + ' %'; }).join('\n') + '\n\nLa importancia describe el uso que hace el modelo de cada variable; **no implica causalidad**.' };
    }
    if (/(metric|error|mae|rmse|mape|persistencia|compar|precision|desempeno)/.test(n)) {
      if (!ev) return { text: needData('un modelo entrenado') };
      var t = ev.metrics.test, sk = 1 - t.rf.rmse / t.pers.rmse;
      return { text: 'Evaluación sobre datos de prueba (' + t.rf.n + ' registros):\n\n| Modelo | MAE [kW] | RMSE [kW] | MAPE [%] |\n|---|---|---|---|\n| Random Forest | ' + f1(cv(t.rf.mae), 3) + ' | ' + f1(cv(t.rf.rmse), 3) + ' | ' + f1(t.rf.mape) + ' |\n| Persistencia 24 h | ' + f1(cv(t.pers.mae), 3) + ' | ' + f1(cv(t.pers.rmse), 3) + ' | ' + f1(t.pers.mape) + ' |\n\n' +
        (sk > 0 ? 'El RF reduce el RMSE en **' + f1(sk * 100) + ' %**.' : 'El RF no supera a la persistencia en RMSE.') + ' Error de energía diaria: ' + f1(ev.daily.rf.mae, 2) + ' kWh/día (' + f1(ev.daily.rf.wape, 1) + ' %).' };
    }
    if (/calidad/.test(n)) {
      if (!S.validation) return { text: needData('una validación de datos') };
      var q = S.validation.quality;
      return { text: '**Calidad de datos: ' + f1(q.score) + ' %** = promedio de 5 componentes:\n\n- Completitud ' + f1(q.C * 100) + ' %\n- Consistencia ' + f1(q.K * 100) + ' %\n- Continuidad temporal ' + f1(q.T * 100) + ' %\n- Sin atípicos ' + f1(q.O * 100) + ' %\n- Validez ' + f1(q.V * 100) + ' %' };
    }
    if (/confiab/.test(n)) {
      if (!d) return { text: needData('una decisión calculada') };
      var rl = d.reliability;
      return { text: '**Índice de confiabilidad: ' + f1(rl.score, 0) + '/100 (' + rl.level + ')** — A error histórico ' + f1(rl.comp.A, 3) + ' (0.30), D cantidad de datos ' + f1(rl.comp.D, 3) + ' (0.15), Q calidad ' + f1(rl.comp.Q, 3) + ' (0.20), S similitud ' + (rl.comp.S == null ? '—' : f1(rl.comp.S, 3)) + ' (0.20), T cobertura temporal ' + f1(rl.comp.T, 3) + ' (0.15). No es una probabilidad.' };
    }
    if (/(limpi|faltant|duplicad|atipic|outlier|problemas)/.test(n)) {
      if (!S.clean) return { text: needData('una limpieza de datos') };
      var cs = S.clean.summary;
      return { text: 'Limpieza: ' + cs.rawRows + ' registros brutos → ' + cs.finalRows + ' procesados. Corregidos ' + cs.corrected + ', interpolados ' + cs.interpolated + ', invalidados ' + cs.invalidated + ', eliminados ' + (cs.removedDup + cs.removedInvalidDate) + '. Cada operación está en el **Registro de limpieza**.' };
    }
    if (/escenario/.test(n)) {
      if (!S.scenarios) return { text: needData('escenarios simulados') };
      return { text: 'Escenarios:\n\n' + S.scenarios.list.map(function (s) { return '- ' + s.name + ': ' + f1(s.gen) + ' kWh, SOC anochecer ' + f1(s.socSun, 0) + ' %, riesgo **' + s.risk + '**'; }).join('\n') };
    }
    if (/recomend/.test(n)) {
      if (!d) return { text: needData('una decisión calculada') };
      return { text: d.narrative + '\n\n' + d.recos.map(function (x) { return '- **' + x.title + '**: ' + x.text; }).join('\n') };
    }
    if (/(random forest|bosque aleatorio|como funciona el modelo)/.test(n)) return { text: 'El **Random Forest** promedia ' + (S.model ? S.model.params.nTrees : 100) + ' árboles de regresión, cada uno entrenado con una muestra bootstrap y un subconjunto de variables por nodo; cada árbol divide los datos para reducir el error cuadrático. Aquí se entrena en su navegador con división cronológica 60/20/20 y se compara con la persistencia (misma hora del día anterior).' };
    if (/persistencia/.test(n)) return { text: 'La **persistencia** es la línea base: supone que la generación de cada hora será igual a la de la misma hora del día anterior, ŷ(t) = y(t − 24 h). Un modelo útil debe superarla.' };
    if (/(simulacion|gemelo)/.test(n)) return act({ tipo: 'navegar', pagina: 'simulacion' });
    var pg2 = findPage(n); if (pg2 && n.split(' ').length <= 4) return act({ tipo: 'navegar', pagina: pg2 });
    return { text: 'No tengo una respuesta local para eso. ' + (A.cfg.apiKey ? 'El asistente en línea no está disponible ahora mismo.' : 'Configure la **clave API** en ⚙ para respuestas abiertas con IA.') + '\n\nPruebe, por ejemplo: «¿cuánta energía debo reservar?», «explica el riesgo», «simula irradiancia −30 %», «abre la simulación y reprodúcela», «entrena con 200 árboles».' };
  };
  A.capabilities = function () {
    return 'Puedo **explicar los resultados** (reserva, SOC, riesgo, métricas, importancia, calidad, confiabilidad, limpieza, escenarios) y **operar la aplicación**:\n\n- «Ejecuta el flujo completo»\n- «Entrena con 200 árboles y profundidad 12»\n- «Recalcula la decisión con SOC 40 y margen 20»\n- «Simula irradiancia −30 %» · «¿Qué pasa si el consumo sube 20 %?»\n- «Abre la simulación interactiva y reprodúcela»\n- «Genera el informe ejecutivo» · «Descarga el Excel»\n- «Elige el punto 11.54, -72.91» · «Consulta NASA POWER horario»\n- «Diseña un sistema aislado de 12 kWh» · «¿Cuánto cuesta el sistema en dólares?» · «Descarga el manual»\n\n' + (A.online() ? 'Modo **en línea** activo: también respondo preguntas abiertas de ingeniería con IA.' : 'Estoy en **modo local**. Con una clave API (⚙) respondo además preguntas abiertas con IA.');
  };

  /* ---------------- Cliente en línea (compatible con OpenAI, streaming) ---------------- */
  A.messagesFor = function () {
    var msgs = [{ role: 'system', content: A.SYSTEM }];
    if (A.cfg.sendContext) msgs.push({ role: 'system', content: 'CONTEXTO DE LA APLICACIÓN (resumen agregado; no incluye datos brutos):\n' + A.context() });
    A.history.filter(function (m) { return (m.role === 'user' || m.role === 'assistant') && !m.error && !m.streaming && (m.raw || m.content); }).slice(-12).forEach(function (m) { msgs.push({ role: m.role, content: m.raw || m.content }); });
    return msgs;
  };
  A.errorText = function (status, body) {
    var msg = '';
    try { var j = JSON.parse(body); msg = (j.error && (j.error.message || j.error)) || j.message || ''; } catch (e) { msg = String(body || '').slice(0, 200); }
    var base = { 400: 'Solicitud no válida (revise el modelo configurado).', 401: 'La clave API no es válida o fue revocada.', 402: 'Saldo insuficiente en la cuenta del proveedor.', 403: 'Acceso denegado por el proveedor.', 404: 'Modelo o dirección no encontrados (revise el modelo).', 422: 'Parámetros no válidos para el modelo.', 429: 'Límite de solicitudes alcanzado; espere unos segundos.' }[status] || (status >= 500 ? 'El servicio del proveedor no está disponible en este momento.' : 'Error ' + status + '.');
    return base + (msg ? ' (' + msg + ')' : '');
  };
  A.callOnline = async function (messages, onDelta, signal, opts) {
    opts = opts || {};
    var pv = A.PROVIDERS[A.cfg.provider] || A.PROVIDERS.deepseek;
    var body = { model: A.cfg.model || pv.def, messages: messages, stream: !opts.noStream, temperature: 0.3, max_tokens: opts.maxTokens || 1200 };
    var res = await fetch(pv.base + pv.path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + A.cfg.apiKey }, body: JSON.stringify(body), signal: signal });
    if (!res.ok) { var t = await res.text(); var err = new Error(A.errorText(res.status, t)); err.status = res.status; throw err; }
    if (opts.noStream || !res.body || !res.body.getReader) {
      var raw = await res.text(), c = '';
      try { var j = JSON.parse(raw); c = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : ''; }
      catch (e) { raw.split('\n').forEach(function (ln) { ln = ln.trim(); if (ln.indexOf('data:') === 0 && ln.indexOf('[DONE]') < 0) { try { var dj = JSON.parse(ln.slice(5)); var dd = dj.choices[0].delta || dj.choices[0].message || {}; c += dd.content || ''; } catch (e2) { /* sin acción */ } } }); }
      if (onDelta) onDelta(c, c); return c;
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '', full = '';
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var lines = buf.split('\n'); buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln || ln.indexOf('data:') !== 0) continue;
        var data = ln.slice(5).trim();
        if (data === '[DONE]') { return full; }
        try { var js = JSON.parse(data), dl = js.choices && js.choices[0] && js.choices[0].delta; if (dl && dl.content) { full += dl.content; if (onDelta) onDelta(dl.content, full); } } catch (e) { /* fragmento incompleto */ }
      }
    }
    return full;
  };
  A.parseActions = function (txt) {
    var acts = [], clean = String(txt || '').replace(/<accion>([\s\S]*?)<\/accion>/gi, function (_, js) {
      try { var o = JSON.parse(js.trim()); if (A.valid(o)) acts.push(o); } catch (e) { /* ignorar */ }
      return '';
    });
    var cut = clean.search(/<accion/i); if (cut >= 0) clean = clean.slice(0, cut);
    return { text: clean.trim(), actions: acts.slice(0, 2) };
  };

  /* ---------------- Render (markdown ligero) ---------------- */
  A.md = function (s) {
    var e = U.esc(s || '');
    e = e.replace(/```[a-z]*\n?([\s\S]*?)```/gi, function (_, c) { return '\u0001' + c.replace(/\n/g, '\u0002') + '\u0003'; });
    var lines = e.split('\n'), out = [], list = null, tbl = null;
    var inl = function (x) { return x.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>'); };
    var close = function () { if (list) { out.push('</' + list + '>'); list = null; } if (tbl) { out.push('</tbody></table></div>'); tbl = null; } };
    lines.forEach(function (ln) {
      var t = ln.trim(), m;
      if (/^\|.*\|$/.test(t)) {
        if (/^\|?[\s:\-|]+\|?$/.test(t)) return;
        var cells = t.slice(1, -1).split('|').map(function (c) { return inl(c.trim()); });
        if (!tbl) { close(); out.push('<div class="ai-tbl"><table><thead><tr>' + cells.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>'); tbl = true; }
        else out.push('<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>');
        return;
      }
      if ((m = /^#{1,4}\s+(.*)$/.exec(t))) { close(); out.push('<h5>' + inl(m[1]) + '</h5>'); return; }
      if ((m = /^[-*•]\s+(.*)$/.exec(t))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inl(m[1]) + '</li>'); return; }
      if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inl(m[1]) + '</li>'); return; }
      if (!t) { close(); out.push('<div class="ai-gap"></div>'); return; }
      close(); out.push('<p>' + inl(t) + '</p>');
    });
    close();
    return out.join('').replace(/\u0001([\s\S]*?)\u0003/g, function (_, c) { return '<pre>' + c.replace(/\u0002/g, '\n') + '</pre>'; });
  };

  /* ---------------- Interfaz ---------------- */
  var el = {};
  A.mount = function () {
    var fab = document.createElement('button');
    fab.id = 'ai-fab'; fab.className = 'no-print'; fab.setAttribute('aria-label', 'Abrir el Asistente SEGAR IA');
    fab.innerHTML = '<span class="fab-ico">✦</span><span class="fab-txt">Asistente SEGAR</span><span class="fab-dot" id="ai-fab-dot"></span>';
    var panel = document.createElement('section');
    panel.id = 'ai-panel'; panel.className = 'no-print'; panel.setAttribute('aria-label', 'Asistente SEGAR IA');
    panel.innerHTML = '<header class="ai-head"><img src="assets/logo.svg" alt=""><div class="ai-ttl"><b>Asistente SEGAR IA</b><span id="ai-mode"></span></div>' +
      '<button class="ai-ib" id="ai-set" title="Configurar clave API y modo">⚙</button><button class="ai-ib" id="ai-clear" title="Borrar conversación">🗑</button><button class="ai-ib" id="ai-close" title="Cerrar">✕</button></header>' +
      '<div class="ai-body" id="ai-body"></div><div class="ai-settings hidden" id="ai-settings"></div>' +
      '<div class="ai-chips" id="ai-chips"></div>' +
      '<footer class="ai-foot"><textarea id="ai-in" rows="1" placeholder="Pregunte o pida una acción…"></textarea><button id="ai-send" class="ai-send" title="Enviar">➤</button></footer>' +
      '<div class="ai-priv" id="ai-priv"></div>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    el = { fab: fab, panel: panel, body: panel.querySelector('#ai-body'), input: panel.querySelector('#ai-in'), send: panel.querySelector('#ai-send'), chips: panel.querySelector('#ai-chips'), settings: panel.querySelector('#ai-settings') };
    fab.onclick = function () { A.toggle(); };
    panel.querySelector('#ai-close').onclick = function () { A.toggle(false); };
    panel.querySelector('#ai-set').onclick = function () { A.showSettings(el.settings.classList.contains('hidden')); };
    panel.querySelector('#ai-clear').onclick = function () { A.history = []; A.saveHist(); A.renderAll(); };
    el.send.onclick = function () { if (busy) A.stop(); else A.sendText(el.input.value); };
    el.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) A.sendText(el.input.value); } });
    el.input.addEventListener('input', function () { el.input.style.height = 'auto'; el.input.style.height = Math.min(120, el.input.scrollHeight) + 'px'; });
    el.chips.onclick = function (e) { var b = e.target.closest('[data-q]'); if (b) A.sendText(b.getAttribute('data-q')); };
    el.body.addEventListener('click', A.onBodyClick);
    window.addEventListener('online', A.updateMode); window.addEventListener('offline', A.updateMode);
    A.updateMode(); A.renderAll();
  };
  A.toggle = function (open) {
    if (open === undefined) open = !el.panel.classList.contains('open');
    el.panel.classList.toggle('open', open); el.fab.classList.toggle('active', open);
    if (open) { A.renderChips(); setTimeout(function () { el.input.focus(); el.body.scrollTop = el.body.scrollHeight; }, 60); }
  };
  A.updateMode = function () {
    var m = document.getElementById('ai-mode'); if (m) m.textContent = A.modeLabel();
    var dot = document.getElementById('ai-fab-dot'); if (dot) dot.className = 'fab-dot ' + (A.online() ? 'on' : 'off');
    var pv = document.getElementById('ai-priv');
    if (pv) pv.innerHTML = A.online() ? '🔒 En línea: se envían su pregunta y ' + (A.cfg.sendContext ? 'un resumen agregado de resultados' : 'el historial del chat') + ' a ' + A.PROVIDERS[A.cfg.provider].name + '. Los datos brutos no salen del equipo.' : '🔒 Modo local: nada sale de este equipo.';
  };
  A.renderChips = function () {
    var S = st(), q;
    if (!S.raw) q = ['Ejecuta el flujo completo con la demo', '¿Qué puedes hacer?', 'Abre la simulación interactiva y reprodúcela'];
    else if (!S.decision) q = ['Ejecuta el flujo completo', 'Entrena el modelo', '¿Cuál es la calidad de los datos?', 'Abre la simulación interactiva'];
    else q = ['¿Cuánta energía debo reservar esta noche?', 'Explica el riesgo calculado', '¿Qué variable influye más?', 'Compara Random Forest vs persistencia', 'Simula irradiancia −30 %', 'Abre la simulación y reprodúcela', 'Genera el informe ejecutivo'];
    el.chips.innerHTML = q.map(function (x) { return '<button data-q="' + U.esc(x) + '">' + U.esc(x) + '</button>'; }).join('');
  };
  function bubble(m, idx) {
    if (m.role === 'user') return '<div class="msg user">' + U.esc(m.content).replace(/\n/g, '<br>') + '</div>';
    var h = '<div class="msg bot' + (m.error ? ' err' : '') + '" data-i="' + idx + '"><div class="mb">' + A.md(m.content) + '</div>';
    (m.actions || []).forEach(function (a, j) {
      var state = m.done && m.done[j];
      h += '<div class="ai-act"><div><span class="aa-k">Acción propuesta</span><b>' + U.esc(A.describe(a)) + '</b></div>' +
        (state ? '<span class="aa-st">' + U.esc(state) + '</span>' : '<div class="aa-b"><button class="btn btn-sm btn-primary" data-run="' + idx + ':' + j + '">Ejecutar</button><button class="btn btn-sm" data-skip="' + idx + ':' + j + '">Descartar</button></div>') + '</div>';
    });
    if (m.meta) h += '<div class="meta">' + U.esc(m.meta) + '</div>';
    return h + '</div>';
  }
  A.renderAll = function () {
    if (!el.body) return;
    var h = '';
    if (!A.history.length) {
      h += '<div class="msg bot welcome"><div class="mb">' + A.md('**¡Hola! Soy el Asistente SEGAR IA.**\n\n' + A.capabilities()) + '</div>' +
        (A.cfg.apiKey ? '' : '<div class="ai-act"><div><span class="aa-k">Opcional</span><b>Conectar la IA en línea con su clave API</b></div><div class="aa-b"><button class="btn btn-sm btn-primary" data-open-set="1">Configurar</button></div></div>') + '</div>';
    }
    A.history.forEach(function (m, i) { h += bubble(m, i); });
    el.body.innerHTML = h;
    el.body.scrollTop = el.body.scrollHeight;
  };
  A.onBodyClick = async function (e) {
    if (e.target.closest('[data-open-set]')) { A.showSettings(true); return; }
    var run = e.target.closest('[data-run]'), skip = e.target.closest('[data-skip]');
    var ref = run || skip; if (!ref) return;
    var parts = (run ? run.getAttribute('data-run') : skip.getAttribute('data-skip')).split(':'), m = A.history[+parts[0]], j = +parts[1];
    if (!m) return;
    m.done = m.done || {};
    if (skip) { m.done[j] = 'Descartada'; A.saveHist(); A.renderAll(); return; }
    m.done[j] = 'Ejecutando…'; A.renderAll();
    try { var res = await A.exec(m.actions[j]); m.done[j] = '✔ Ejecutada'; A.push({ role: 'assistant', content: res, meta: 'Resultado de la acción · asistente local' }); }
    catch (err) { m.done[j] = '✖ Error'; U.idle(); A.push({ role: 'assistant', content: 'No se pudo ejecutar la acción: ' + (err.message || err), error: true }); }
    A.saveHist(); A.renderAll();
  };
  A.push = function (m) { A.history.push(m); A.saveHist(); A.renderAll(); };
  A.stop = function () { if (ctrl) ctrl.abort(); };
  function setBusy(b) { busy = b; el.send.textContent = b ? '■' : '➤'; el.send.title = b ? 'Detener' : 'Enviar'; el.send.classList.toggle('stop', b); }

  A.sendText = async function (text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    el.input.value = ''; el.input.style.height = 'auto';
    A.push({ role: 'user', content: text });
    A.showSettings(false);
    var loc = A.local(text);
    /* comandos explícitos: se ejecutan de inmediato (el usuario los pidió) */
    if (loc.run && loc.actions.length) {
      setBusy(true);
      A.push({ role: 'assistant', content: '⏳ ' + A.describe(loc.actions[0]) + '…', meta: 'Asistente local' });
      try { var res = await A.exec(loc.actions[0]); A.history[A.history.length - 1] = { role: 'assistant', content: res, meta: 'Asistente local · acción ejecutada' }; }
      catch (err) { U.idle(); A.history[A.history.length - 1] = { role: 'assistant', content: 'No se pudo ejecutar: ' + (err.message || err), error: true }; }
      setBusy(false); A.saveHist(); A.renderAll(); A.renderChips(); return;
    }
    if (!A.online()) { A.push({ role: 'assistant', content: loc.text, meta: 'Asistente local (sin conexión)' }); return; }
    if (!A.cfg.consent) {
      var ok = await U.modal({ title: 'Asistente en línea', icon: '🔒', html: '<p>Para responder con IA se enviará su pregunta y ' + (A.cfg.sendContext ? '<b>un resumen agregado de resultados</b> (métricas, decisión, escenarios)' : 'el historial del chat') + ' a <b>' + A.PROVIDERS[A.cfg.provider].name + '</b>.</p><p class="muted">Los datos brutos (su archivo) nunca se envían. Puede cambiar a modo local en ⚙.</p>', buttons: [{ label: 'Usar solo modo local', value: false }, { label: 'Aceptar y continuar', value: true, cls: 'btn-primary' }] });
      if (!ok) { A.cfg.mode = 'local'; A.saveCfg(); A.updateMode(); A.push({ role: 'assistant', content: loc.text, meta: 'Asistente local' }); return; }
      A.cfg.consent = true; A.saveCfg();
    }
    var outMsgs = A.messagesFor();
    var msg = { role: 'assistant', content: '', raw: '', meta: 'En línea · ' + A.PROVIDERS[A.cfg.provider].name + ' · ' + A.cfg.model, streaming: true };
    A.history.push(msg); A.renderAll();
    var node = el.body.querySelector('.msg.bot[data-i="' + (A.history.length - 1) + '"] .mb');
    if (node) node.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    setBusy(true); ctrl = new AbortController();
    try {
      var full = await A.callOnline(outMsgs, function (_, acc) {
        var pa = A.parseActions(acc);
        if (node) { node.innerHTML = A.md(pa.text) + '<span class="caret"></span>'; el.body.scrollTop = el.body.scrollHeight; }
      }, ctrl.signal);
      var pa = A.parseActions(full);
      msg.raw = full; msg.content = pa.text || '(sin texto)'; msg.actions = pa.actions; delete msg.streaming;
    } catch (err) {
      delete msg.streaming;
      if (err.name === 'AbortError') { msg.content = (msg.content || '') + '\n\n_(respuesta detenida)_'; }
      else {
        var why = err.status ? err.message : 'No fue posible conectar con ' + A.PROVIDERS[A.cfg.provider].name + ' (sin internet, o la solicitud fue bloqueada por el navegador/CORS o la política de seguridad).';
        msg.content = '⚠ ' + why + '\n\nRespuesta del asistente local:\n\n' + loc.text; msg.error = false; msg.meta = 'Asistente local (respaldo)';
        msg.actions = loc.actions && !loc.run ? loc.actions : [];
      }
    }
    setBusy(false); ctrl = null; A.saveHist(); A.renderAll();
  };

  /* ---------------- Configuración ---------------- */
  A.showSettings = function (show) {
    var box = el.settings; if (!box) return;
    if (!show) { box.classList.add('hidden'); el.body.classList.remove('hidden'); return; }
    var c = A.cfg, pv = A.PROVIDERS[c.provider] || A.PROVIDERS.deepseek;
    box.innerHTML = '<h4>⚙ Asistente en línea</h4>' +
      '<label class="f">Proveedor (compatible con OpenAI)<select id="ais-prov">' + Object.keys(A.PROVIDERS).map(function (k) { return '<option value="' + k + '"' + (k === c.provider ? ' selected' : '') + '>' + A.PROVIDERS[k].name + ' — ' + A.PROVIDERS[k].base + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Clave API<div class="ai-key"><input type="password" id="ais-key" autocomplete="off" spellcheck="false" placeholder="sk-…" value="' + U.esc(c.apiKey || '') + '"><button class="btn btn-sm" id="ais-eye" type="button">👁</button></div><span class="hint" id="ais-det"></span></label>' +
      '<label class="f">Modelo<input type="text" id="ais-model" list="ais-models" value="' + U.esc(c.model || pv.def) + '"><datalist id="ais-models">' + pv.models.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist><span class="hint">DeepSeek: deepseek-flash (rápido) o deepseek-v4-pro</span></label>' +
      '<label class="f">Modo<select id="ais-mode"><option value="auto"' + (c.mode !== 'local' ? ' selected' : '') + '>Automático: en línea si hay clave y conexión</option><option value="local"' + (c.mode === 'local' ? ' selected' : '') + '>Solo local (sin conexión)</option></select></label>' +
      '<label class="check"><input type="checkbox" id="ais-ctx"' + (c.sendContext ? ' checked' : '') + '><span>Enviar resumen agregado de resultados como contexto<span class="cdesc">Métricas, decisión, escenarios y simulación. Nunca los datos brutos.</span></span></label>' +
      '<label class="check"><input type="checkbox" id="ais-rem"' + (c.remember ? ' checked' : '') + '><span>Recordar la clave en este navegador<span class="cdesc">Se guarda solo aquí (localStorage). Si se desmarca, se borra al cerrar la pestaña.</span></span></label>' +
      '<div class="btn-row" style="margin-top:8px"><button class="btn btn-primary btn-sm" id="ais-save">Guardar</button><button class="btn btn-sm" id="ais-test">Probar conexión</button><button class="btn btn-sm btn-danger" id="ais-del">Borrar clave</button><button class="btn btn-sm btn-ghost" id="ais-back">Volver al chat</button></div>' +
      '<div id="ais-res" class="small" style="margin-top:8px"></div>' +
      '<p class="small muted" style="margin-top:10px">La clave no se escribe en el código ni en los archivos exportados. No la comparta en documentos o capturas; si se expuso, revóquela en el panel del proveedor y genere una nueva.</p>';
    box.classList.remove('hidden'); el.body.classList.add('hidden');
    var key = box.querySelector('#ais-key'), det = box.querySelector('#ais-det'), prov = box.querySelector('#ais-prov'), model = box.querySelector('#ais-model');
    var detect = function () {
      var d = A.detectProvider(key.value);
      det.textContent = !key.value ? 'Sin clave: el asistente funciona en modo local.' : d ? 'Formato reconocido: ' + A.PROVIDERS[d].name + '.' : 'Formato no reconocido; se usará el proveedor seleccionado.';
      if (d && d !== prov.value) { prov.value = d; model.value = A.PROVIDERS[d].def; }
    };
    key.oninput = detect; detect();
    prov.onchange = function () { model.value = A.PROVIDERS[prov.value].def; };
    box.querySelector('#ais-eye').onclick = function () { key.type = key.type === 'password' ? 'text' : 'password'; };
    var read = function () {
      A.cfg.provider = prov.value; A.cfg.apiKey = key.value.trim(); A.cfg.model = model.value.trim() || A.PROVIDERS[prov.value].def;
      A.cfg.mode = box.querySelector('#ais-mode').value; A.cfg.sendContext = box.querySelector('#ais-ctx').checked; A.cfg.remember = box.querySelector('#ais-rem').checked;
      A.saveCfg(); A.updateMode();
    };
    box.querySelector('#ais-save').onclick = function () { read(); U.toast('Configuración del asistente guardada.', 'good'); A.showSettings(false); A.renderAll(); };
    box.querySelector('#ais-back').onclick = function () { A.showSettings(false); };
    box.querySelector('#ais-del').onclick = function () { key.value = ''; read(); detect(); U.toast('Clave eliminada de este navegador.', 'good'); };
    box.querySelector('#ais-test').onclick = async function () {
      read();
      var out = box.querySelector('#ais-res');
      if (!A.cfg.apiKey) { out.innerHTML = '<span class="status-warn">Ingrese una clave.</span>'; return; }
      out.textContent = 'Probando…';
      try {
        var r = await A.callOnline([{ role: 'user', content: 'Responde únicamente: OK' }], null, undefined, { noStream: true, maxTokens: 5 });
        out.innerHTML = '<span class="status-ok">✔ Conexión correcta con ' + A.PROVIDERS[A.cfg.provider].name + ' (' + U.esc(A.cfg.model) + '): «' + U.esc(String(r).slice(0, 30)) + '»</span>';
      } catch (err) {
        out.innerHTML = '<span class="status-bad">✖ ' + U.esc(err.status ? err.message : 'No fue posible conectar (sin internet o solicitud bloqueada por el navegador/CORS).') + '</span>';
      }
    };
  };

  A.open = function (q) { A.toggle(true); if (q) A.sendText(q); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.mount); else A.mount();
})();
