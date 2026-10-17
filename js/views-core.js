/* ==========================================================================
   views-core.js — Dashboard ejecutivo, Metodología, Sistema/Privacidad e
   Historial de operaciones.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, SP = SEDA.Specs, Store = SEDA.Store, ML = SEDA.ML, D = SEDA.Decision;
  var V = SEDA.Views = SEDA.Views || {};
  var st = function () { return SEDA.state; };

  V.riskPill = function (risk) {
    if (!risk) return '<span class="muted">—</span>';
    var ico = { BAJO: '✔', MODERADO: '▲', ALTO: '✖' }[risk];
    return '<span class="risk-pill risk-' + risk + '"><span class="ri">' + ico + '</span>' + risk + '</span>';
  };
  V.kpi = function (label, value, unit, sub, cls, ico) {
    return '<div class="kpi ' + (cls || '') + '"><div class="k-label">' + (ico ? '<span>' + ico + '</span>' : '') + label + '</div><div class="k-value">' + value + (unit ? '<span class="u">' + unit + '</span>' : '') + '</div>' + (sub ? '<div class="k-sub">' + sub + '</div>' : '') + '</div>';
  };
  V.meter = function (pct, color) {
    return '<div class="meter"><div style="width:' + U.clamp(pct || 0, 0, 100) + '%;background:' + color + '"></div></div>';
  };
  V.qualityColor = function (v) { return v >= 90 ? 'var(--good)' : v >= 75 ? 'var(--warn)' : 'var(--crit)'; };
  V.empty = function (ico, title, text, btns) {
    return '<div class="card empty"><span class="e-ico">' + ico + '</span><h3>' + title + '</h3><p>' + text + '</p><div class="btn-row" style="justify-content:center">' + (btns || '') + '</div></div>';
  };
  V.head = function (title, text, actions) {
    return '<div class="page-head"><div class="ph-text"><h1>' + title + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (actions ? '<div class="ph-actions">' + actions + '</div>' : '') + '</div>';
  };
  V.MAIN_ACTIONS = [
    ['load-excel', '📗', 'CARGAR EXCEL'], ['load-csv', '📄', 'CARGAR CSV'], ['validate', '✔\uFE0F', 'VALIDAR DATOS'], ['clean', '🧹', 'LIMPIAR DATOS'],
    ['explore', '🔎', 'EXPLORAR DATOS'], ['train', '🤖', 'ENTRENAR MODELO'], ['evaluate', '📈', 'EVALUAR MODELO'], ['predict', '☀\uFE0F', 'EJECUTAR PREDICCIÓN'],
    ['decide', '🔋', 'CALCULAR DECISIÓN'], ['simulate', '🧪', 'SIMULAR ESCENARIO'], ['recommend', '💡', 'GENERAR RECOMENDACIONES'], ['report', '📄', 'GENERAR INFORME'],
    ['print-pdf', '🖨\uFE0F', 'DESCARGAR PDF'], ['dl-excel', '📊', 'DESCARGAR EXCEL'], ['dl-csv', '⬇\uFE0F', 'DESCARGAR CSV'], ['new-op', '➕', 'NUEVA OPERACIÓN'],
    ['open-sim', '🛰\uFE0F', 'SIMULACIÓN INTERACTIVA'], ['open-chat', '✦', 'ASISTENTE IA'],
    ['open-site', '🌍', 'SITIO Y NASA POWER'], ['open-design', '🧩', 'DISEÑAR SISTEMA'], ['open-costs', '💲', 'COSTOS'], ['open-manual', '📘', 'MANUAL DE INSTALACIÓN']
  ];
  V.actionGrid = function () {
    return '<div class="action-grid">' + V.MAIN_ACTIONS.map(function (a) { return '<button class="btn" data-action="' + a[0] + '"><span class="ai">' + a[1] + '</span>' + a[2] + '</button>'; }).join('') + '</div>';
  };

  /* ================= DASHBOARD ================= */
  V.dashboard = {
    render: function (el) {
      var S = st(), d = S.decision, ev = S.evaluation;
      var h = '<div class="hero"><div class="hero-icons">☀ ⚡ 📊 🌎 🌬</div><h1><span class="segar">SEGAR</span> SOLAR ENERGY DECISIÓN IA</h1>' +
        '<div class="tagline">Transformando datos meteorológicos en decisiones energéticas.</div>' +
        '<p>La plataforma utiliza Machine Learning para estimar la generación fotovoltaica y convertir los resultados en recomendaciones cuantitativas para la gestión energética.</p></div>';
      h += '<div class="card" style="margin-top:16px"><div class="card-head"><h3>¿Cuánta energía solar puedo esperar y cuánta energía debo reservar para garantizar la operación nocturna?</h3>' +
        '<div class="ch-actions"><span class="chip run">' + U.esc(S.runId || 'Sin operación') + '</span></div></div>';
      if (!d) {
        h += '<div class="alert info"><span class="ai">ℹ\uFE0F</span><div>' + (S.raw ? 'Datos cargados: <b>' + U.esc(S.source.fileName) + '</b>. Continúe el flujo de trabajo (paso ' + (SEDA.App.STEPS.find(function (s) { return !S.steps[s.n]; }) || { n: 15 }).n + ') o ejecute todos los pasos pendientes automáticamente.' : 'Aún no hay datos. Cargue un Excel o CSV con datos históricos (NASA POWER, IDEAM, UPME, XM/SIEM o mediciones propias), o use los datos sintéticos de demostración.') + '</div></div>' +
          '<div class="btn-row" style="margin-top:12px">' + (S.raw ? '' : '<button class="btn btn-primary btn-lg" data-action="load-excel">+ CARGAR EXCEL</button><button class="btn btn-lg" data-action="load-csv">+ CARGAR CSV</button><button class="btn btn-lg" data-action="load-demo">CARGAR DEMO LA GUAJIRA</button>') +
          '<button class="btn btn-accent btn-lg" data-action="autopilot">▶ EJECUTAR FLUJO COMPLETO</button></div>';
      }
      h += '</div>';
      /* KPI principales */
      var r = d ? d.result : null;
      var riskCls = r ? { BAJO: 'good', MODERADO: 'warn', ALTO: 'crit' }[r.risk] : '';
      h += '<div class="grid g4">' +
        V.kpi('Generación esperada', r ? U.fmt(r.gen, 1) : '—', 'kWh', S.prediction ? (S.prediction.profile.daily ? 'Día ' + U.fmtDate(S.prediction.date) : 'Próximas ' + S.prediction.hoursLeft + ' h desde las ' + U.p2(S.prediction.hour) + ':00 · día completo ' + U.fmt(S.prediction.dayKWh, 1) + ' kWh') : 'Requiere modelo y predicción', 'big', '☀') +
        V.kpi('Reserva recomendada', r ? U.fmt(r.Eres, 1) : '—', 'kWh', r ? 'Consumo nocturno ' + U.fmt(+r.inputs.nightLoad, 1) + ' kWh · margen ' + r.inputs.margin + ' %' : 'Energía a reservar para la noche', 'big accent', '🔋') +
        V.kpi('SOC objetivo', r ? U.fmt(r.socObj, 0) : '—', '%', r ? 'SOC proyectado al anochecer: ' + U.fmt(r.nom.socSun, 0) + ' %' : 'Estado de carga al inicio de la noche', 'big accent', '⚡') +
        '<div class="kpi big ' + riskCls + '"><div class="k-label">⚠ Riesgo</div>' + (r ? V.riskPill(r.risk) : '<div class="k-value">—</div>') + '<div class="k-sub">' + (r ? 'Cobertura de la reserva: ' + U.fmtCover(r.nom.cover) + ' % (conservadora ' + U.fmtCover(r.cons.cover) + ' %)' : 'Riesgo de insuficiencia energética') + '</div></div>' +
        '</div>';
      /* conclusión ejecutiva */
      if (d) {
        h += '<div class="card"><div class="card-head"><h3>Conclusión ejecutiva (generada automáticamente)</h3><div class="ch-actions"><button class="btn btn-sm" data-go="decision">Ver cálculo detallado</button></div></div>' +
          '<div class="narrative">' + U.esc(d.narrative) + '</div>' +
          (d.recos.length ? '<div style="margin-top:12px">' + V.recoHTML(d.recos.slice(0, 2)) + '</div>' : '') + '</div>';
      }
      /* valor de la decisión en pesos (backtest en los días de prueba) */
      var bt = d ? SEDA.App.backtest() : null;
      if (bt && bt.by.rf) {
        var bp = bt.by.pe, bf = bt.by.fixed, brf = bt.by.rf;
        h += '<div class="card"><div class="card-head"><h3>💲 Valor de la decisión — ' + bt.n + ' días de prueba</h3><div class="ch-actions"><button class="btn btn-sm" data-go="decision" data-anchor="backtest">Ver backtest</button></div></div><div class="grid g3">' +
          V.kpi('Ahorro anual frente a la persistencia', isFinite(bt.savingVsPe) ? U.fmt(bt.savingVsPe / 1e6, 2) : '—', 'M COP/año', 'Costo anual estimado: modelo ' + V.cop(brf.costYear) + (bp ? ' · persistencia ' + V.cop(bp.costYear) : ''), 'big accent', '💲') +
          V.kpi('Noches con déficit (modelo)', U.fmtInt(brf.nightsShort), 'de ' + bt.n, (bp ? 'Persistencia: ' + bp.nightsShort : '') + (bf ? ' · regla fija: ' + bf.nightsShort : ''), 'big ' + (brf.nightsShort ? 'warn' : 'good'), '🌙') +
          V.kpi('Respaldo programado (modelo)', U.fmt(brf.backupKWh, 0), 'kWh', brf.daysBackup + ' días con respaldo · energía no servida ' + U.fmt(brf.shortKWh, 1) + ' kWh', 'big', '⛽') +
          '</div><p class="small muted" style="margin-top:8px">Costos supuestos y editables en Decisión energética: respaldo programado ' + V.cop(bt.costBackup) + '/kWh · kWh no servido o de emergencia ' + V.cop(bt.costUnserved) + '/kWh. Datos de prueba que el modelo nunca vio.</p></div>';
      }
      /* indicadores secundarios */
      var q = SEDA.App.quality(), rel = d ? d.reliability : (ev ? SEDA.App.reliability(null) : null);
      h += '<div class="grid g4">' +
        V.kpi('Calidad de los datos', q != null ? U.fmt(q, 1) : '—', '%', q != null ? V.meter(q, V.qualityColor(q)) + 'Completitud, consistencia, continuidad, atípicos y validez' : 'Se calcula al validar', '', '🧪') +
        V.kpi('Índice de confiabilidad', rel ? U.fmt(rel.score, 0) : '—', '/100', rel ? V.meter(rel.score, V.qualityColor(rel.score)) + 'Nivel ' + rel.level + ' · no es una probabilidad' : 'Se calcula con el modelo', '', '🛡') +
        V.kpi('RMSE Random Forest', ev ? U.fmt(ML.toKW(ev.metrics.test.rf.rmse, ev.targetKey, ev.dtH), 3) : '—', 'kW', ev ? 'Persistencia: ' + U.fmt(ML.toKW(ev.metrics.test.pers.rmse, ev.targetKey, ev.dtH), 3) + ' kW · datos de prueba' : 'Evaluación sobre datos de prueba', 'accent', '🤖') +
        V.kpi('Datos', S.processed ? U.fmtInt(S.processed.n) : (S.raw ? U.fmtInt(S.raw.rows.length) : '—'), 'registros', S.source ? U.esc(S.source.fileName) + '<br>' + U.fmtDate(S.source.start) + ' → ' + U.fmtDate(S.source.end) : 'Sin datos cargados', '', '📂') +
        '</div>';
      if (d) {
        h += '<div class="grid g2">' + C.card('dash-balance', 'Energía necesaria vs energía disponible', 'Energía disponible para la noche (sobre el SOC mínimo) frente a la reserva recomendada', 280) +
          C.card('dash-soc', 'SOC actual vs SOC recomendado', 'Estado de carga de la batería [%]', 280) + '</div>';
      }
      h += '<div class="sim-teaser"><span class="st-ico">🛰\uFE0F</span><div style="flex:1;min-width:220px"><h3>Simulación interactiva — gemelo digital</h3><p>Vea en movimiento un día completo del sistema: sol, flujos de potencia, SOC de la batería, respaldo y cumplimiento de la reserva nocturna recomendada.</p></div>' +
        '<button class="btn btn-primary" data-go="simulacion">Abrir simulación →</button><button class="btn" data-action="open-chat">✦ Preguntar al asistente</button></div>';
      if (SEDA.Design) {
        var pj = SEDA.Design.project(), sm = pj.summary;
        h += '<div class="sim-teaser proj-teaser"><span class="st-ico">🌍</span><div style="flex:1;min-width:220px"><h3>Proyecto FV — sitio, diseño, costos y manual</h3><p>' +
          '<b>' + U.esc(pj.site.place || '') + '</b> (' + SEDA.WorldMap.fmtLat(pj.site.lat) + ', ' + SEDA.WorldMap.fmtLon(pj.site.lon) + ')' +
          (sm ? ' · ' + U.fmt(sm.kwp, 2) + ' kWp · ' + U.esc(sm.layout) + (sm.bat ? ' · ' + U.fmt(sm.bat, 1) + ' kWh' : '') + ' · ' + SEDA.Costs.money(sm.total) + ' · LCOE ' + SEDA.Costs.money(sm.lcoe) + '/kWh' : ' · Elija el punto en el mapa, consulte NASA POWER y diseñe el arreglo más eficiente.') + '</p></div>' +
          '<button class="btn btn-primary" data-go="sitio">🌍 Sitio</button><button class="btn" data-go="diseno">🧩 Diseño</button><button class="btn" data-go="costos">💲 Costos</button><button class="btn" data-go="manual">📘 Manual</button></div>';
      }
      h += '<div class="card"><div class="card-head"><h3>Acciones principales</h3><div class="ch-actions"><button class="btn btn-sm btn-accent" data-action="autopilot">▶ Ejecutar flujo completo</button></div></div>' + V.actionGrid() + '</div>';
      el.innerHTML = h;
      if (d) { C.mount(U.$('#dash-balance'), SP.energyBalance(d)); C.mount(U.$('#dash-soc'), SP.soc(d)); }
    }
  };
  V.recoHTML = function (recos) {
    var ico = { crit: '✖', warn: '▲', good: '✔', info: 'ℹ' };
    return recos.map(function (r) { return '<div class="reco ' + r.level + '"><div class="rt"><span>' + ico[r.level] + '</span>' + U.esc(r.title) + '</div><p>' + U.esc(r.text) + '</p><div class="why">' + U.esc(r.why) + '</div></div>'; }).join('');
  };

  /* ================= METODOLOGÍA ================= */
  V.metodologia = {
    render: function (el) {
      var S = st();
      var steps = [
        ['Elegir el sistema', 'Sistema solar fotovoltaico con almacenamiento en baterías (' + U.esc(SEDA.App.system().place) + ').', true, 'sistema'],
        ['Formular la decisión', '¿Cuánta energía reservar para la operación nocturna? Se traduce en energía a reservar [kWh] y SOC objetivo [%]; su valor se mide en pesos (respaldo programado y energía no servida).', true, 'decision'],
        ['Conseguir los datos', 'Datos meteorológicos y energéticos históricos (NASA POWER, IDEAM, UPME, XM/SIEM, mediciones propias).', !!S.raw, 'importar'],
        ['Explorar y limpiar', 'Detección y tratamiento documentado de faltantes, duplicados, negativos, imposibles, atípicos, sensores congelados y discontinuidades.', !!S.processed, 'limpieza'],
        ['Línea base y modelo', 'Persistencia (misma hora del día anterior) y regresión lineal sobre la irradiancia frente a Random Forest Regressor.', !!S.model, 'modelo'],
        ['Evaluar', 'División cronológica 60 % entrenamiento / 20 % validación / 20 % prueba; MAE, RMSE y MAPE, y backtest de la decisión en los días de prueba (noches con déficit, kWh y COP).', !!S.evaluation, 'evaluacion'],
        ['Comunicar la decisión', 'Recomendaciones cuantitativas, informe técnico e informe ejecutivo descargables.', !!S.report, 'informe']
      ];
      var h = V.head('Metodología académica', 'Los siete pasos exigidos por el curso y su estado en la operación actual. Haga clic en un paso para ir a la sección correspondiente.');
      h += '<div class="method">' + steps.map(function (s, i) {
        return '<div class="mstep" style="cursor:pointer" data-go="' + s[3] + '"><div class="mn">' + (i + 1) + '</div><h4>' + s[0] + '</h4><p>' + s[1] + '</p><div style="margin-top:8px" class="small ' + (s[2] ? 'status-ok' : 'status-off') + '">' + (s[2] ? '✔ completado' : '○ pendiente') + '</div></div>';
      }).join('') + '</div>';
      h += '<div class="card" style="margin-top:16px"><h3>Transformación de datos en decisión</h3><div class="flow">' +
        ['DATOS', 'INFORMACIÓN', 'MODELO ML', 'PREDICCIÓN', 'ANÁLISIS', 'RECOMENDACIÓN', 'DECISIÓN ENERGÉTICA', 'INFORME'].map(function (x, i) { return (i ? '<span class="fa">→</span>' : '') + '<span class="fs">' + x + '</span>'; }).join('') + '</div></div>';
      h += '<div class="grid g2"><div class="card"><h3>Objetivo general</h3><p>Desarrollar una aplicación web Offline-First basada en Machine Learning que utilice datos meteorológicos y energéticos históricos para estimar la generación solar fotovoltaica y apoyar la toma de decisiones relacionada con la reserva energética para la operación nocturna.</p></div>' +
        '<div class="card"><h3>Objetivos específicos</h3><ol style="margin:0;padding-left:20px">' +
        ['Procesar y depurar datos históricos meteorológicos y energéticos.', 'Desarrollar un modelo Random Forest para estimar generación fotovoltaica.', 'Comparar el modelo con una línea base de persistencia.', 'Evaluar el desempeño utilizando una división cronológica 60/20/20.', 'Transformar las predicciones en recomendaciones energéticas.', 'Desarrollar herramientas gráficas para apoyar la toma de decisiones.', 'Generar automáticamente informes técnicos y ejecutivos.'].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol></div></div>';
      h += '<div class="card"><h3>Flujo de trabajo de la aplicación (15 pasos)</h3><div class="flow">' + SEDA.App.STEPS.map(function (s, i) {
        return (i ? '<span class="fa">↓</span>' : '') + '<span class="fs" style="' + (S.steps[s.n] ? 'background:var(--good-soft);color:var(--good-ink)' : '') + '">PASO ' + s.n + ' · ' + s.label.toUpperCase() + '</span>';
      }).join('') + '</div></div>';
      h += '<div class="card"><h3>Ecuaciones de la decisión</h3><div class="eq">' +
        'η<sub>global</sub> = η<sub>batería</sub> × η<sub>inversor</sub><br>' +
        'Energía nocturna requerida = Consumo nocturno / η<sub>global</sub><br>' +
        'Reserva recomendada = Energía nocturna requerida × (1 + margen de seguridad)<br>' +
        'SOC objetivo = SOC<sub>mín</sub> + Reserva recomendada / Capacidad × 100 (máx. 100 %)<br>' +
        'Energía al anochecer = E<sub>actual</sub> + mín[(E<sub>FV</sub> − C<sub>diurno</sub>)·η<sub>batería</sub>, capacidad libre] (si el balance diurno es negativo: E<sub>actual</sub> − (C<sub>diurno</sub> − E<sub>FV</sub>)/η<sub>global</sub>)<br>' +
        'Energía disponible para la noche = Energía al anochecer − Capacidad × SOC<sub>mín</sub><br>' +
        'Cobertura = Energía disponible / Reserva recomendada (nominal con E<sub>FV</sub>; conservadora con E<sub>FV</sub>·(1 − error relativo histórico))</div></div>';
      el.innerHTML = h;
    }
  };

  /* ================= SISTEMA Y PRIVACIDAD ================= */
  V.sistema = {
    render: function (el) {
      var sys = SEDA.App.system();
      var f = function (id, label, val, type, hint) { return '<label class="f">' + label + '<input type="' + (type || 'text') + '" id="sys-' + id + '" value="' + U.esc(val) + '"' + (type === 'number' ? ' step="any"' : '') + '>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>'; };
      var h = V.head('Sistema, privacidad y configuración', 'Datos descriptivos del sistema fotovoltaico (se usan en el informe y en la validación física), almacenamiento local y configuración.');
      h += '<div class="card"><div class="card-head"><h3>☀ Descripción del sistema</h3></div><div class="form-grid">' +
        f('name', 'Nombre del sistema', sys.name) + f('place', 'Ubicación', sys.place) + f('lat', 'Latitud [°]', sys.lat, 'number') + f('lon', 'Longitud [°]', sys.lon, 'number') +
        f('kwp', 'Potencia FV instalada [kWp]', sys.kwp, 'number', 'Si se indica, P > 1.3 × kWp se considera físicamente imposible') + f('inverterKw', 'Potencia del inversor [kW AC]', sys.inverterKw, 'number') +
        f('batteryKwh', 'Capacidad nominal de batería [kWh]', sys.batteryKwh, 'number', 'Valor por defecto en la decisión energética') + f('operator', 'Responsable / operador', sys.operator) + f('tz', 'Zona horaria de los datos', sys.tz) +
        '</div><div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="sys-save">Guardar descripción</button></div></div>';
      h += '<div class="grid g2"><div class="card"><h3>🔒 Privacidad y seguridad de los datos</h3>' +
        '<div class="alert good"><span class="ai">✔</span><div><b>Privacidad:</b> los datos son procesados localmente y no son enviados a servidores externos.</div></div>' +
        '<ul class="small ink2"><li>Todo el procesamiento (lectura de Excel/CSV, limpieza, Random Forest, informes) se ejecuta en este navegador.</li>' +
        '<li>La política de seguridad de la página (<code>connect-src</code>) solo permite conectarse a los proveedores del Asistente IA (DeepSeek, OpenAI) cuando usted usa el modo en línea, y a la API pública de NASA POWER cuando usted pulsa «Consultar NASA POWER».</li>' +
        '<li>La consulta a NASA POWER envía únicamente latitud, longitud, fechas y nombres de parámetros; las respuestas se guardan en la caché local y quedan disponibles sin conexión. El mapa mundial está incluido en la aplicación (Natural Earth, dominio público): no se descargan mosaicos.</li>' +
        '<li>El Asistente IA en línea envía su pregunta y un resumen agregado de resultados (métricas, decisión, escenarios); nunca el archivo ni los datos brutos. En modo local no sale nada del equipo.</li>' +
        '<li>No se usan CDN: la librería de Excel (SheetJS, Apache-2.0) está incluida en <code>js/lib/</code>.</li>' +
        '<li>Los datos se guardan en IndexedDB/localStorage del navegador de este equipo y pueden eliminarse con «Eliminar base actual».</li></ul></div>' +
        '<div class="card"><h3>💾 Almacenamiento local</h3><div id="sys-storage" class="small ink2">Consultando…</div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn" data-action="dl-config">⬇ DESCARGAR CONFIGURACIÓN</button><button class="btn" data-action="load-config">⬆ Cargar configuración</button>' +
        '<button class="btn btn-danger" data-action="delete-db">🗑 ELIMINAR BASE ACTUAL</button></div>' +
        '<div class="btn-row" style="margin-top:8px"><button class="btn btn-sm" id="sys-nasa-clear">🛰 Vaciar caché NASA POWER</button><button class="btn btn-sm" id="sys-proj-reset">🧩 Restablecer proyecto FV (sitio, diseño, catálogo y costos)</button></div></div></div>';
      var AIc = SEDA.Assistant ? SEDA.Assistant.cfg : {};
      h += '<div class="card"><div class="card-head"><h3>✦ Asistente SEGAR IA</h3><div class="ch-actions"><button class="btn btn-sm btn-primary" data-action="ai-settings">⚙ Configurar clave API</button><button class="btn btn-sm" data-action="open-chat">Abrir chat</button></div></div>' +
        '<p class="small ink2">Chat integrado que explica los resultados y opera la aplicación (entrenar, recalcular la decisión, simular escenarios, abrir la simulación, generar informes y descargas). Cada acción propuesta por la IA requiere su confirmación.</p>' +
        '<ul class="small ink2"><li><b>Modo local</b> (sin conexión): responde con los resultados calculados y ejecuta comandos.</li><li><b>Modo en línea</b> (opcional): API compatible con OpenAI — DeepSeek (<code>deepseek-flash</code>, <code>deepseek-v4-pro</code>) u OpenAI. La clave se ingresa en ⚙ y se guarda solo en este navegador; no está escrita en el código ni en los archivos exportados.</li></ul>' +
        '<p class="small">Estado: <b>' + U.esc(SEDA.Assistant ? SEDA.Assistant.modeLabel() : '—') + '</b>' + (AIc.apiKey ? ' · clave configurada (' + U.esc(String(AIc.apiKey).slice(0, 5)) + '…' + U.esc(String(AIc.apiKey).slice(-4)) + ')' : ' · sin clave') + '</p></div>';
      h += '<div class="card"><h3>📐 Metodologías de los indicadores</h3>' +
        '<h4>Calidad de los datos [%]</h4><div class="eq">Calidad = 100 × (C + K + T + O + V) / 5<br>' +
        'C (completitud) = 1 − celdas faltantes / celdas totales de las variables mapeadas<br>' +
        'K (consistencia) = 1 − registros con valores físicamente imposibles, negativos, sensor congelado o inconsistencia irradiancia–potencia / registros con fecha válida<br>' +
        'T (continuidad temporal) = marcas de tiempo únicas / marcas esperadas según el paso temporal detectado<br>' +
        'O (atípicos) = 1 − registros con valores atípicos / registros con fecha válida<br>' +
        'V (validez) = registros sin ningún problema / registros totales</div>' +
        '<h4 style="margin-top:12px">Índice de confiabilidad [0–100]</h4><div class="eq">Índice = 100 × Σ w<sub>i</sub>·c<sub>i</sub> / Σ w<sub>i</sub> (se omiten componentes no evaluados)<br>' +
        'A — precisión: 1 − WAPE del Random Forest en prueba (w = 0.30)<br>D — cantidad de datos: mín(1, días con generación / 365) (w = 0.15)<br>Q — calidad de datos / 100 (w = 0.20)<br>' +
        'S — similitud: fracción de entradas meteorológicas dentro del rango P1–P99 del entrenamiento (w = 0.20)<br>T — cobertura temporal: meses calendario con datos / 12 (w = 0.15)<br>' +
        'Niveles: ≥ 80 ALTA · 60–79 MEDIA · &lt; 60 BAJA. <b>No es una probabilidad estadística.</b></div>' +
        '<h4 style="margin-top:12px">Riesgo de insuficiencia energética (reglas)</h4><div class="eq">R1 ALTO si Reserva recomendada &gt; Capacidad útil (entre SOC mínimo y 100 %)<br>R2 ALTO si Cobertura nominal &lt; 100 %<br>' +
        'R3 MODERADO si Cobertura nominal ≥ 100 % y Cobertura conservadora &lt; 100 %<br>R4 BAJO si Cobertura conservadora ≥ 100 %<br>R5 BAJO → MODERADO si Índice de confiabilidad &lt; 50<br>' +
        'Error relativo usado en el escenario conservador = WAPE diario del Random Forest en prueba. <b>El riesgo no es una probabilidad.</b></div></div>';
      h += '<div class="card"><h3>ℹ Acerca de</h3><p class="small ink2">SEGAR SOLAR ENERGY DECISIÓN IA v' + SEDA.App.VERSION + ' · Aplicación Offline-First (HTML5, CSS3, JavaScript, Canvas, IndexedDB). Random Forest, persistencia, métricas, gráficos e informes implementados localmente sin dependencias. ' +
        'Lectura/escritura de Excel: SheetJS Community Edition ' + (window.XLSX ? window.XLSX.version : '(no cargada)') + ' (Apache License 2.0, copia local en <code>js/lib/</code>). ' +
        'Mapa mundial: Natural Earth 1:50m (dominio público) empaquetado por world-atlas (licencia ISC) con nombres de países de i18n-iso-countries (MIT), convertido a <code>js/data/world.js</code>. Datos meteorológicos: NASA LaRC POWER Project.</p></div>';
      el.innerHTML = h;
      U.$('#sys-save').onclick = function () {
        var o = {};
        ['name', 'place', 'lat', 'lon', 'kwp', 'inverterKw', 'batteryKwh', 'operator', 'tz'].forEach(function (k) { o[k] = U.$('#sys-' + k).value; });
        SEDA.App.saveSystem(Object.assign(SEDA.App.system(), o));
        U.toast('Descripción del sistema guardada.', 'good');
      };
      U.$('#sys-nasa-clear').onclick = async function () {
        if (!(await U.confirm('Vaciar caché NASA POWER', '<p>Se eliminan las consultas NASA POWER guardadas en este navegador. El diseño usará la estimación de cielo claro hasta que vuelva a consultar.</p>', 'Vaciar', true))) return;
        var idx = await SEDA.Nasa.index();
        for (var i = 0; i < idx.length; i++) await SEDA.Nasa.deleteCached(idx[i].key);
        var pj = SEDA.Design.project(); pj.nasa.key = null; SEDA.Design._ds = null; SEDA.Design._dsKey = null; SEDA.Design.invalidate(); SEDA.Design.saveNow();
        U.toast('Caché NASA POWER vaciada (' + idx.length + ' consultas).', 'good');
      };
      U.$('#sys-proj-reset').onclick = async function () {
        if (!(await U.confirm('Restablecer proyecto FV', '<p>Se restablecen el sitio, los requerimientos de diseño, los ajustes del catálogo y las ediciones del presupuesto. La caché NASA POWER y los datos del análisis se conservan.</p>', 'Restablecer', true))) return;
        SEDA.Design.reset();
        U.toast('Proyecto FV restablecido.', 'good');
      };
      Store.estimate().then(function (e) {
        var box = U.$('#sys-storage'); if (!box) return;
        box.innerHTML = 'Modo: <b>' + Store.mode + '</b>' + (e ? '<br>Uso estimado del origen: <b>' + U.fmt(e.usage / 1048576, 1) + ' MB</b> de ' + U.fmt(e.quota / 1048576, 0) + ' MB disponibles.' : '') +
          '<br>Sesión actual: ' + (st().runId ? '<b>' + st().runId + '</b>' : 'sin operación');
      });
    }
  };

  /* ================= HISTORIAL ================= */
  V.historial = {
    render: async function (el) {
      el.innerHTML = V.head('Historial de operaciones', 'Cada ejecución tiene un identificador RUN-AAAA-NNN y se guarda localmente con los datos utilizados (archivo, período, huella), parámetros, métricas, resultados y decisión, para reproducir y documentar cada análisis.',
        '<button class="btn" id="hist-export">⬇ Exportar historial (CSV)</button>') + '<div id="hist-body" class="card">Cargando…</div>';
      var runs = await Store.runsAll();
      var body = U.$('#hist-body');
      if (!runs.length) { body.outerHTML = V.empty('🗃\uFE0F', 'Sin operaciones registradas', 'Las operaciones se registran al entrenar el modelo y al calcular la decisión energética.', '<button class="btn btn-primary" data-action="autopilot">▶ Ejecutar flujo completo</button>'); return; }
      var rows = runs.map(function (r) {
        return ['<b class="mono">' + U.esc(r.id) + '</b>' + (r.id === st().runId ? ' <span class="chip">actual</span>' : ''), U.esc(r.fecha) + ' ' + U.esc(r.hora), U.esc(r.archivo || '') + (r.sintetico ? ' <span class="chip synthetic">sintético</span>' : ''),
          U.fmtInt(r.registros), U.esc(r.modelo || '—'), r.parametros ? r.parametros.arboles + ' árb. · prof. ' + r.parametros.profundidad : '—',
          U.fmt(r.mae, 3), U.fmt(r.rmse, 3), U.fmt(r.generacion, 1), U.fmt(r.reserva, 1), U.fmt(r.soc, 0), r.riesgo ? V.riskPill(r.riesgo) : '—', U.esc(r.recomendacion || '—'),
          '<button class="btn btn-sm" data-run="' + U.esc(r.id) + '">Ver</button> <button class="btn btn-sm btn-danger" data-del="' + U.esc(r.id) + '">✕</button>'];
      });
      body.innerHTML = U.table(['ID', 'Fecha y hora', 'Archivo', 'Registros', 'Modelo', 'Parámetros', 'MAE [kW]', 'RMSE [kW]', 'Generación [kWh]', 'Reserva [kWh]', 'SOC [%]', 'Riesgo', 'Recomendación', ''], rows, { numCols: [3, 6, 7, 8, 9, 10], tall: true });
      body.onclick = async function (e) {
        var b = e.target.closest('[data-run]');
        if (b) { var r = runs.find(function (x) { return x.id === b.getAttribute('data-run'); }); V.showRun(r); return; }
        var dl = e.target.closest('[data-del]');
        if (dl) {
          var id = dl.getAttribute('data-del');
          if (await U.confirm('Eliminar registro', '<p>¿Eliminar la operación <b>' + U.esc(id) + '</b> del historial?</p>', 'Eliminar', true)) { await Store.runDel(id); V.historial.render(el); }
        }
      };
      U.$('#hist-export').onclick = function () {
        var hdr = ['ID', 'Fecha', 'Hora', 'Archivo', 'Hojas', 'Sintetico', 'Registros', 'Periodo_inicio', 'Periodo_fin', 'Huella_datos', 'Calidad_%', 'Modelo', 'Arboles', 'Profundidad', 'Min_hoja', 'Semilla', 'MAE_kW', 'RMSE_kW', 'MAPE_%', 'MAE_persistencia_kW', 'RMSE_persistencia_kW', 'Generacion_kWh', 'Reserva_kWh', 'SOC_objetivo_%', 'Riesgo', 'Confiabilidad', 'Recomendacion', 'Estado'];
        var rr = runs.map(function (r) {
          var p = r.parametros || {};
          return [r.id, r.fecha, r.hora, r.archivo, (r.hojas || []).join(' | '), r.sintetico ? 'SI' : 'NO', r.registros, r.periodo ? U.fmtDate(r.periodo[0]) : '', r.periodo ? U.fmtDate(r.periodo[1]) : '', r.huella, r.calidad, r.modelo, p.arboles, p.profundidad, p.minHoja, p.semilla, r.mae, r.rmse, r.mape, r.maePers, r.rmsePers, r.generacion, r.reserva, r.soc, r.riesgo, r.confiabilidad, r.recomendacion, r.status];
        });
        U.download('historial_operaciones_SEGAR.csv', U.toCSV(hdr, rr), 'text/csv;charset=utf-8');
      };
    }
  };
  V.showRun = function (r) {
    var kv = function (k, v) { return '<tr><th style="width:38%">' + k + '</th><td>' + v + '</td></tr>'; };
    var p = r.parametros || {};
    var html = '<div class="table-wrap"><table class="t compact"><tbody>' +
      kv('ID', '<b class="mono">' + U.esc(r.id) + '</b>') + kv('Estado', U.esc(r.status || '')) + kv('Fecha / hora', U.esc(r.fecha + ' ' + r.hora)) +
      kv('Archivo', U.esc(r.archivo) + (r.sintetico ? ' — DATOS SINTÉTICOS' : '')) + kv('Hojas', U.esc((r.hojas || []).join(', '))) + kv('Registros procesados', U.fmtInt(r.registros)) +
      kv('Período', r.periodo ? U.fmtDateTime(r.periodo[0]) + ' → ' + U.fmtDateTime(r.periodo[1]) : '—') + kv('Huella de datos (FNV-1a)', '<span class="mono">' + U.esc(r.huella || '—') + '</span>') +
      kv('Calidad de datos', U.fmtPct(r.calidad)) + kv('Modelo', U.esc(r.modelo || '—')) +
      kv('Parámetros', r.parametros ? 'Árboles ' + p.arboles + ', profundidad ' + p.profundidad + ', min. hoja ' + p.minHoja + ', max_features ' + p.maxFeatures + ', semilla ' + p.semilla : '—') +
      kv('Variables', U.esc((r.variables || []).map(ML.flabel).join(', '))) + kv('Objetivo', U.esc(r.objetivo || '—')) +
      kv('MAE / RMSE / MAPE (RF, prueba)', U.fmt(r.mae, 3) + ' kW / ' + U.fmt(r.rmse, 3) + ' kW / ' + U.fmtPct(r.mape)) + kv('MAE / RMSE (persistencia)', U.fmt(r.maePers, 3) + ' kW / ' + U.fmt(r.rmsePers, 3) + ' kW') +
      kv('Predicción', r.prediccion ? U.esc(r.prediccion.fecha) + ' ' + U.p2(r.prediccion.hora) + ':00 → ' + U.fmt(r.prediccion.kwH0, 2) + ' kW; restante ' + U.fmt(r.prediccion.restanteKWh, 1) + ' kWh' : '—') +
      kv('Generación esperada', U.fmt(r.generacion, 1) + ' kWh') + kv('Reserva recomendada', U.fmt(r.reserva, 1) + ' kWh') + kv('SOC objetivo', U.fmt(r.soc, 0) + ' %') +
      kv('Riesgo', r.riesgo ? V.riskPill(r.riesgo) : '—') + kv('Confiabilidad', U.fmt(r.confiabilidad, 0)) + kv('Recomendación', U.esc(r.recomendacion || '—')) +
      kv('Conclusión', U.esc(r.narrativa || '—')) +
      kv('Escenarios', r.escenarios ? r.escenarios.map(function (s) { return U.esc(s.nombre) + ': ' + U.fmt(s.gen, 1) + ' kWh, reserva ' + U.fmt(s.reserva, 1) + ', riesgo ' + s.riesgo; }).join('<br>') : '—') +
      '</tbody></table></div>';
    U.modal({ title: 'Operación ' + r.id, icon: '🗃\uFE0F', html: html, wide: true, buttons: [{ label: 'Descargar JSON', value: 'json' }, { label: 'Cerrar', value: true, cls: 'btn-primary' }] }).then(function (v) {
      if (v === 'json') U.download(r.id + '.json', JSON.stringify(r, null, 2), 'application/json');
    });
  };
})();
