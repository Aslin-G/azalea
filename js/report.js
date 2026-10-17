/* ==========================================================================
   report.js — INFORME COMPLETO DE OPERACIÓN (técnico y ejecutivo),
   generado exclusivamente a partir de los resultados calculados.
   Preparado para A4 (impresión / Guardar como PDF sin internet) y para
   descarga como HTML autónomo (estilos e imágenes embebidos).
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, SP = SEDA.Specs, M = SEDA.Mapping, ML = SEDA.ML, D = SEDA.Decision;
  var R = SEDA.Report = {};

  R.CSS = [
    '.report-doc{background:#fff;color:#16202a;max-width:210mm;margin:0 auto;padding:16mm 15mm;box-shadow:0 4px 24px rgba(0,0,0,.15);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:10.5pt;line-height:1.5}',
    '.report-doc *{box-sizing:border-box}',
    '.report-doc h1{font-size:22pt;margin:0 0 4px;letter-spacing:.02em;color:#0b1928}',
    '.report-doc h2{font-size:13.5pt;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #f29d0b;color:#0b1928;break-after:avoid;page-break-after:avoid}',
    '.report-doc h3{font-size:11pt;margin:14px 0 6px;color:#0b1928;break-after:avoid;page-break-after:avoid}',
    '.report-doc p{margin:0 0 8px}',
    '.report-doc .rep-cover{min-height:245mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page;page-break-after:always;border-left:8px solid #f29d0b;padding:10mm 0 0 10mm}',
    '.report-doc .rep-cover .rc-top{font-size:10pt;letter-spacing:.2em;text-transform:uppercase;color:#6b7885}',
    '.report-doc .rep-cover .rc-title{font-size:30pt;font-weight:800;color:#0b1928;line-height:1.05;margin:18mm 0 4mm}',
    '.report-doc .rep-cover .rc-sub{font-size:13pt;color:#44525f;max-width:150mm}',
    '.report-doc .rep-cover .rc-kind{display:inline-block;margin-top:10mm;padding:6px 14px;border-radius:6px;background:#0b1928;color:#ffd48a;font-weight:700;letter-spacing:.08em}',
    '.report-doc .rep-cover table{margin-top:12mm;width:100%;border-collapse:collapse;font-size:11pt}',
    '.report-doc .rep-cover td{padding:6px 8px;border-bottom:1px solid #dfe4ea}',
    '.report-doc .rep-cover td:first-child{color:#6b7885;width:45%}',
    '.report-doc .rep-cover .rc-foot{font-size:9pt;color:#6b7885;border-top:1px solid #dfe4ea;padding-top:8px}',
    '.report-doc .syn{background:#fff3d3;border:1px solid #fab219;color:#6b4500;font-weight:800;text-align:center;padding:8px;border-radius:6px;letter-spacing:.04em;margin:10px 0}',
    '.report-doc table.rt{width:100%;border-collapse:collapse;font-size:9.2pt;margin:6px 0 10px}',
    '.report-doc table.rt th{background:#eef2f6;text-align:left;padding:5px 7px;border-bottom:1px solid #c9d2db;font-weight:700}',
    '.report-doc table.rt td{padding:4px 7px;border-bottom:1px solid #e6eaee;vertical-align:top}',
    '.report-doc table.rt td.n,.report-doc table.rt th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.report-doc table.rt tr{break-inside:avoid;page-break-inside:avoid}',
    '.report-doc figure{margin:8px 0 12px;break-inside:avoid;page-break-inside:avoid}',
    '.report-doc figure img{width:100%;height:auto;border:1px solid #e6eaee;border-radius:4px;display:block}',
    '.report-doc figcaption{font-size:8.6pt;color:#5a6773;margin-top:3px}',
    '.report-doc .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 12px;break-inside:avoid}',
    '.report-doc .kpis div{border:1px solid #dfe4ea;border-left:4px solid #f29d0b;border-radius:6px;padding:7px 9px}',
    '.report-doc .kpis b{display:block;font-size:15pt;line-height:1.2}',
    '.report-doc .kpis span{font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:#6b7885}',
    '.report-doc .risk{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:800;letter-spacing:.05em;white-space:nowrap}',
    '.report-doc .risk-BAJO{background:#e3f4e3;color:#0a6a0a;border:1px solid #0ca30c}',
    '.report-doc .risk-MODERADO{background:#fff3d3;color:#7f5200;border:1px solid #fab219}',
    '.report-doc .risk-ALTO{background:#fbe5e5;color:#a02525;border:1px solid #d03b3b}',
    '.report-doc .eq{font-family:ui-monospace,Consolas,monospace;font-size:8.8pt;background:#f6f8fa;border:1px solid #e1e6eb;border-radius:6px;padding:8px 10px;line-height:1.65;break-inside:avoid}',
    '.report-doc .box{background:#f6f8fa;border:1px solid #e1e6eb;border-radius:6px;padding:9px 11px;margin:6px 0 10px;break-inside:avoid}',
    '.report-doc .reco{border-left:4px solid #0b6e8a;background:#f6f8fa;padding:6px 10px;margin:6px 0;break-inside:avoid}',
    '.report-doc .reco.crit{border-left-color:#d03b3b}.report-doc .reco.warn{border-left-color:#fab219}.report-doc .reco.good{border-left-color:#0ca30c}',
    '.report-doc .reco b{display:block;font-size:9pt;text-transform:uppercase;letter-spacing:.05em}',
    '.report-doc .reco small{color:#6b7885;font-family:ui-monospace,Consolas,monospace}',
    '.report-doc .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.report-doc .rlog{font-family:ui-monospace,Consolas,monospace;font-size:8.2pt;color:#16202a;background:#f6f8fa;border:1px solid #e1e6eb;border-radius:6px;padding:8px 10px}',
    '.report-doc .rlog div{padding:1px 0;break-inside:avoid}',
    '.report-doc .muted{color:#6b7885}',
    '.report-doc .foot{margin-top:18px;border-top:1px solid #dfe4ea;padding-top:6px;font-size:8.2pt;color:#6b7885}',
    '@media print{.report-doc{box-shadow:none;max-width:none;padding:0;margin:0}.report-doc .rep-cover{min-height:260mm}}',
    '@media (max-width:700px){.report-doc{padding:18px}.report-doc .kpis{grid-template-columns:1fr 1fr}.report-doc .two{grid-template-columns:1fr}}'
  ].join('\n');

  R.injectStyles = function () {
    if (document.getElementById('report-css')) return;
    var s = document.createElement('style'); s.id = 'report-css'; s.textContent = R.CSS; document.head.appendChild(s);
  };

  var esc = U.esc;
  function tbl(head, rows, num) {
    num = num || [];
    return '<table class="rt"><thead><tr>' + head.map(function (h, i) { return '<th class="' + (num.indexOf(i) >= 0 ? 'n' : '') + '">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td class="' + (num.indexOf(i) >= 0 ? 'n' : '') + '">' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function kv(rows) { return tbl(['Concepto', 'Valor'], rows); }
  function fig(spec, caption, h) {
    var src = C.toImage(spec, 900, h || 330);
    return src ? '<figure><img alt="' + esc(caption) + '" src="' + src + '"><figcaption>' + caption + '</figcaption></figure>' : '';
  }
  function risk(r) { return '<span class="risk risk-' + r + '">' + ({ BAJO: '✔ ', MODERADO: '▲ ', ALTO: '✖ ' }[r] || '') + r + '</span>'; }
  function recos(list) { return list.map(function (r) { return '<div class="reco ' + r.level + '"><b>' + esc(r.title) + '</b>' + esc(r.text) + '<br><small>' + esc(r.why) + '</small></div>'; }).join(''); }

  R.cop = function (v) { return isFinite(v) ? (v < 0 ? '−' : '') + 'COP ' + U.fmtInt(Math.abs(Math.round(v))) : '—'; };
  R.limitations = function (S) {
    var L = [
      'El Random Forest estima la generación a partir de condiciones meteorológicas de la misma hora. Para decidir con anticipación en operación real, esas entradas deben provenir de un pronóstico meteorológico, cuyo error se sumaría al error del modelo aquí reportado.',
      'La comparación con la persistencia favorece al Random Forest, que dispone de variables meteorológicas observadas; la persistencia solo usa la generación del día anterior. Por eso se incluye una regresión lineal sobre la irradiancia como línea base intermedia con la misma información.',
      'El valor en pesos proviene de un backtest simplificado (cada día inicia con el mismo SOC, consumos y eficiencias constantes) y de costos por kWh supuestos y editables; debe recalcularse con los costos reales del sitio.',
      'El perfil horario del resto del día se construye con la climatología del mes ajustada a las condiciones ingresadas; no captura la variabilidad intradiaria real de la nubosidad.',
      'La predicción es una estimación puntual: no se reportan intervalos de confianza porque no se implementó un método estadístico calibrado para ello.',
      'Un Random Forest no extrapola fuera del rango de los datos de entrenamiento; condiciones nunca observadas producen predicciones acotadas a lo ya visto.',
      'El balance de la batería es simplificado: eficiencias constantes, sin límites de potencia de carga o descarga, sin autodescarga ni degradación.',
      'La importancia de variables (MDI) describe el uso que hace el modelo de cada variable; se reparte entre variables correlacionadas y no implica causalidad.',
      'El nivel de riesgo y el índice de confiabilidad son clasificaciones por reglas explícitas, no probabilidades estadísticas.'
    ];
    if (S.source && S.source.pvEstimated) L.unshift('La generación usada como variable objetivo fue ESTIMADA con el modelo físico del arreglo diseñado a partir de datos NASA POWER (' + (S.source.pvModel || '') + '); no es una medición. El modelo aprende esa relación física: úselo para prefactibilidad y reemplace la columna por mediciones reales en operación.');
    if (S.source && S.source.nasa && !S.source.pvEstimated) L.push('Los datos meteorológicos de NASA POWER provienen de satélite y reanálisis (resolución de ½° a 1°): representan la celda, no el sitio exacto.');
    if (S.source && S.source.synthetic) L.unshift('LOS DATOS UTILIZADOS SON SINTÉTICOS DE DEMOSTRACIÓN (no son datos reales). Los resultados solo ilustran el funcionamiento de la aplicación y no deben usarse para operar un sistema real.');
    var rel = S.decision ? S.decision.reliability : null;
    if (rel && rel.days < 365) L.push('Se dispone de ' + rel.days + ' días de datos (< 1 año): la estacionalidad no está completamente representada.');
    if (S.validation && S.validation.gaps) L.push('Existen ' + S.validation.gaps + ' discontinuidades temporales (' + S.validation.missingTimestamps + ' marcas de tiempo ausentes) que no fueron rellenadas.');
    if (S.validation && S.validation.quality.score < 90) L.push('La calidad de los datos (' + U.fmt(S.validation.quality.score, 1) + ' %) es inferior a 90 %; los resultados deben interpretarse con cautela.');
    return L;
  };

  R.conclusion = function (S) {
    var ev = S.evaluation, d = S.decision, P = S.prediction, pr = S.processed;
    if (!ev || !d) return 'No se dispone de resultados suficientes para una conclusión.';
    var cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
    var mt = ev.metrics.test, r = d.result, skill = 1 - mt.rf.rmse / mt.pers.rmse;
    var s = 'Con base en ' + U.fmtInt(pr.n) + ' registros procesados (' + U.fmtDate(pr.t[0]) + ' a ' + U.fmtDate(pr.t[pr.n - 1]) + '), el modelo Random Forest obtuvo en los datos de prueba un MAE de ' + U.fmt(cv(mt.rf.mae), 3) + ' kW y un RMSE de ' + U.fmt(cv(mt.rf.rmse), 3) + ' kW, frente a ' + U.fmt(cv(mt.pers.mae), 3) + ' kW y ' + U.fmt(cv(mt.pers.rmse), 3) + ' kW de la persistencia (' + (skill > 0 ? 'reducción del RMSE de ' + U.fmt(skill * 100, 1) + ' %' : 'sin mejora en RMSE') + '). ';
    s += 'Para la operación analizada (' + U.fmtDate(P.date) + ', ' + U.p2(P.hour) + ':00) la generación esperada ' + (P.profile.daily ? 'del día' : 'en las ' + P.hoursLeft + ' horas restantes de generación') + ' es ' + U.fmt(r.gen, 1) + ' kWh; la reserva recomendada para la noche es ' + U.fmt(r.Eres, 1) + ' kWh (SOC objetivo ' + U.fmt(r.socObj, 0) + ' %), y el SOC proyectado al anochecer es ' + U.fmt(r.nom.socSun, 0) + ' %, con una cobertura de la reserva de ' + U.fmtCover(r.nom.cover) + ' % (' + U.fmtCover(r.cons.cover) + ' % en el escenario conservador). ';
    s += 'El riesgo de insuficiencia energética resulta ' + r.risk + ' (' + r.rule + '). ';
    if (d.recos.length) s += 'Recomendación principal: ' + d.recos[0].title.toLowerCase() + '. ';
    s += 'Índice de confiabilidad del análisis: ' + U.fmt(d.reliability.score, 0) + '/100 (' + d.reliability.level + ').';
    if (S.source && S.source.synthetic) s += ' Estos resultados provienen de datos sintéticos de demostración.';
    return s;
  };

  function cover(S, mode) {
    var sys = SEDA.App.system(), now = U.nowHuman();
    return '<section class="rep-cover"><div><div class="rc-top">Informe de operación · ' + esc(S.runId || '') + '</div>' +
      '<div class="rc-title"><span style="color:#f29d0b">SEGAR</span><br>SOLAR ENERGY<br>DECISIÓN IA</div><div class="rc-sub">Plataforma Offline-First de Machine Learning para análisis, predicción y toma de decisiones en sistemas solares fotovoltaicos</div>' +
      '<div class="rc-kind">' + (mode === 'exec' ? 'INFORME EJECUTIVO' : 'INFORME TÉCNICO') + '</div>' +
      (S.source && S.source.synthetic ? '<div class="syn" style="margin-top:8mm">⚠ DATOS SINTÉTICOS DE DEMOSTRACIÓN — NO SON DATOS REALES</div>' : '') +
      '<table><tbody><tr><td>Nombre</td><td><b>SEGAR SOLAR ENERGY DECISIÓN IA</b></td></tr><tr><td>Sistema</td><td>' + esc(sys.name || 'Sistema Solar Fotovoltaico') + '</td></tr>' +
      '<tr><td>Ubicación</td><td>' + esc(sys.place || 'La Guajira, Colombia') + (sys.lat !== '' ? ' (' + esc(sys.lat) + '°, ' + esc(sys.lon) + '°)' : '') + '</td></tr>' +
      '<tr><td>Fecha y hora del análisis</td><td>' + esc(now) + '</td></tr><tr><td>Identificador de la operación</td><td><b>' + esc(S.runId || '—') + '</b></td></tr>' +
      '<tr><td>Archivo de datos</td><td>' + esc(S.source ? S.source.fileName : '—') + '</td></tr>' + (sys.operator ? '<tr><td>Responsable</td><td>' + esc(sys.operator) + '</td></tr>' : '') + '</tbody></table></div>' +
      '<div class="rc-foot">Generado localmente sin conexión a internet. Los datos fueron procesados en el equipo del usuario y no se enviaron a servidores externos.</div></section>';
  }

  R.build = function (mode) {
    var S = SEDA.state;
    if (!S.decision || !S.evaluation) throw new Error('Faltan resultados: entrene el modelo y calcule la decisión antes de generar el informe.');
    mode = mode === 'exec' ? 'exec' : 'tech';
    var ev = S.evaluation, d = S.decision, r = d.result, P = S.prediction, pr = S.processed, sys = SEDA.App.system(), mdl = S.model;
    var cv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
    var mt = ev.metrics.test;
    var h = '<article class="report-doc">' + cover(S, mode);
    var kpis = '<div class="kpis"><div><span>Generación esperada</span><b>' + U.fmt(r.gen, 1) + ' kWh</b></div><div><span>Reserva recomendada</span><b>' + U.fmt(r.Eres, 1) + ' kWh</b></div>' +
      '<div><span>SOC objetivo</span><b>' + U.fmt(r.socObj, 0) + ' %</b></div><div><span>Riesgo</span><b>' + risk(r.risk) + '</b></div></div>';
    if (S.source && S.source.synthetic) h += '<div class="syn">⚠ DATOS SINTÉTICOS DE DEMOSTRACIÓN — NO SON DATOS REALES</div>';

    if (mode === 'exec') {
      h += '<h2>1. Problema</h2><p>El sistema fotovoltaico debe garantizar la operación nocturna con la energía almacenada en la batería. La pregunta de operación es: <b>¿cuánta energía solar puede esperarse hoy y cuánta energía debe reservarse para la noche?</b></p>';
      h += '<h2>2. Resultado</h2>' + kpis + '<div class="box">' + esc(d.narrative) + '</div>';
      h += '<h2>3. Riesgo</h2><p>Nivel de riesgo de insuficiencia energética: ' + risk(r.risk) + '. La energía disponible para la noche es ' + U.fmt(r.nom.Eavail, 1) + ' kWh frente a una reserva recomendada de ' + U.fmt(r.Eres, 1) + ' kWh (cobertura ' + U.fmtCover(r.nom.cover) + ' %; con un escenario conservador que descuenta el error histórico del modelo, ' + U.fmtCover(r.cons.cover) + ' %). El nivel de riesgo es una clasificación por reglas, no una probabilidad.</p>' +
        fig(SP.risk(d), 'Cobertura de la reserva recomendada (100 % = reserva cubierta).', 200);
      h += '<h2>4. Decisión</h2><p><b>ENERGÍA A RESERVAR: ' + U.fmt(r.Eres, 1) + ' kWh · SOC OBJETIVO: ' + U.fmt(r.socObj, 0) + ' %</b> al inicio de la noche. SOC proyectado al anochecer con la generación esperada: ' + U.fmt(r.nom.socSun, 0) + ' %.</p>' +
        '<div class="two">' + fig(SP.energyBalance(d), 'Energía necesaria vs energía disponible [kWh].', 300) + fig(SP.soc(d), 'SOC actual, proyectado y objetivo [%].', 300) + '</div>';
      h += '<h2>5. Recomendación</h2>' + recos(d.recos);
      if (S.scenarios) h += '<h3>Sensibilidad (escenarios)</h3>' + tbl(['Escenario', 'Generación [kWh]', 'Reserva [kWh]', 'SOC al anochecer [%]', 'Riesgo'], S.scenarios.list.map(function (s) { return [esc(s.name), U.fmt(s.gen, 1), U.fmt(s.reserve, 1), U.fmt(s.socSun, 0), risk(s.risk)]; }), [1, 2, 3]);
      var btE = SEDA.App.backtest();
      if (btE && btE.by.rf && btE.by.pe) h += '<h3>Valor de la decisión</h3><p>En ' + btE.n + ' días de prueba que el modelo nunca vio, decidir la reserva con el modelo dejó <b>' + btE.by.rf.nightsShort + ' noches con déficit</b>, frente a ' + btE.by.pe.nightsShort + ' con la regla «mañana igual que hoy»' + (btE.by.fixed ? ' y ' + btE.by.fixed.nightsShort + ' con una reserva fija' : '') + '. Costo anual estimado: <b>' + R.cop(btE.by.rf.costYear) + '</b> con el modelo frente a ' + R.cop(btE.by.pe.costYear) + ' con la persistencia (' + (btE.savingVsPe >= 0 ? 'ahorro de ' : 'sobrecosto de ') + R.cop(Math.abs(btE.savingVsPe)) + ' al año). Costos por kWh supuestos: respaldo ' + R.cop(btE.costBackup) + ', no servido ' + R.cop(btE.costUnserved) + '.</p>';
      h += '<h3>Solidez del análisis</h3><p>Modelo Random Forest evaluado en datos de prueba no vistos: error diario de energía ' + U.fmt(ev.daily.rf.mae, 1) + ' kWh/día (' + U.fmt(ev.daily.rf.wape, 1) + ' %), frente a ' + U.fmt(ev.daily.pe.mae, 1) + ' kWh/día de la persistencia. Calidad de datos ' + U.fmt(SEDA.App.quality(), 1) + ' %; índice de confiabilidad ' + U.fmt(d.reliability.score, 0) + '/100 (' + d.reliability.level + ').</p>';
      h += '<h3>Limitaciones principales</h3><ul>' + R.limitations(S).slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      h += '<div class="foot">SEGAR SOLAR ENERGY DECISIÓN IA · ' + esc(S.runId || '') + ' · Informe ejecutivo generado el ' + esc(U.nowHuman()) + ' · Procesamiento local sin conexión.</div></article>';
      return h;
    }

    /* ---------------- INFORME TÉCNICO ---------------- */
    var keysMapped = M.VARS.filter(function (v) { return S.mapping[v.key] && S.mapping[v.key].col >= 0; });
    var meteoAvail = pr.keys.filter(function (k) { return M.METEO.indexOf(k) >= 0; }).map(M.label);
    var skill = 1 - mt.rf.rmse / mt.pers.rmse;
    /* 1 */
    h += '<h2>1. Resumen ejecutivo</h2>' + kpis + '<ul>' +
      '<li><b>Datos utilizados:</b> ' + esc(S.source.fileName) + ' (' + esc(S.source.selectedSheets.join(', ')) + '), ' + U.fmtInt(S.raw.rows.length) + ' registros brutos y ' + U.fmtInt(pr.n) + ' procesados entre ' + U.fmtDate(pr.t[0]) + ' y ' + U.fmtDate(pr.t[pr.n - 1]) + '; calidad de datos ' + U.fmt(SEDA.App.quality(), 1) + ' %.</li>' +
      '<li><b>Modelo:</b> Random Forest Regressor (' + mdl.params.nTrees + ' árboles, profundidad ' + mdl.params.maxDepth + ') comparado con persistencia de 24 h; división cronológica 60/20/20.</li>' +
      '<li><b>Desempeño (prueba):</b> RF MAE ' + U.fmt(cv(mt.rf.mae), 3) + ' kW · RMSE ' + U.fmt(cv(mt.rf.rmse), 3) + ' kW · MAPE ' + U.fmt(mt.rf.mape, 1) + ' %; persistencia RMSE ' + U.fmt(cv(mt.pers.rmse), 3) + ' kW (' + (skill > 0 ? 'mejora ' : 'variación ') + U.fmt(skill * 100, 1) + ' %).</li>' +
      '<li><b>Generación estimada:</b> ' + U.fmt(r.gen, 1) + ' kWh ' + (P.profile.daily ? 'en el día' : 'en las ' + P.hoursLeft + ' h restantes desde las ' + U.p2(P.hour) + ':00 del ' + U.fmtDate(P.date)) + ' (día completo: ' + U.fmt(P.dayKWh, 1) + ' kWh).</li>' +
      '<li><b>Reserva recomendada:</b> ' + U.fmt(r.Eres, 1) + ' kWh · <b>SOC objetivo:</b> ' + U.fmt(r.socObj, 0) + ' %.</li>' +
      '<li><b>Nivel de riesgo:</b> ' + risk(r.risk) + ' — ' + esc(r.rule) + '.</li>' +
      '<li><b>Recomendación:</b> ' + esc(d.recos.length ? d.recos[0].title + '. ' + d.recos[0].text : '—') + '</li></ul>';
    /* 2 */
    var nl = SEDA.Quality.nightLoad(pr);
    h += '<h2>2. Descripción del sistema</h2>' + kv([
      ['Sistema', esc(sys.name)], ['Ubicación', esc(sys.place) + (sys.lat !== '' ? ' (lat ' + esc(sys.lat) + '°, lon ' + esc(sys.lon) + '°)' : '')],
      ['Potencia FV instalada', sys.kwp ? esc(sys.kwp) + ' kWp' : 'No declarada; potencia máxima observada (P99.9): ' + U.fmt(U.quantile(Array.from(pr.vars[pr.targetKey]).map(function (v) { return cv(v); }), 0.999), 2) + ' kW'],
      ['Inversor', sys.inverterKw ? esc(sys.inverterKw) + ' kW AC' : 'No declarado'],
      ['Capacidad de batería (decisión)', U.fmt(+r.inputs.capKWh, 1) + ' kWh · SOC mínimo ' + r.inputs.socMin + ' %'],
      ['Consumo nocturno (decisión)', U.fmt(+r.inputs.nightLoad, 1) + ' kWh' + (nl ? ' (histórico medio ' + U.fmt(nl.mean, 1) + ' kWh, P90 ' + U.fmt(nl.p90, 1) + ' kWh)' : '')],
      ['Consumo diurno restante', U.fmt(+(r.inputs.dayLoad || 0), 1) + ' kWh'],
      ['Eficiencias', 'Batería ' + r.inputs.effBat + ' % · Inversor ' + r.inputs.effInv + ' % · Global ' + U.fmt(r.eta * 100, 1) + ' %'],
      ['Variables meteorológicas', esc(meteoAvail.join(', '))], ['Paso temporal', esc(S.validation.stepLabel)]
    ]);
    /* 3 */
    var V = S.validation;
    h += '<h2>3. Datos utilizados</h2>' + kv([
      ['Archivo de origen', esc(S.source.fileName) + (S.source.synthetic ? ' — <b>DATOS SINTÉTICOS</b>' : '')], ['Hojas encontradas', esc(S.source.sheetNames.join(', '))], ['Hojas utilizadas', esc(S.source.selectedSheets.join(', ')) + ' (' + esc(S.source.mergeMode) + ')'],
      ['Número de registros', U.fmtInt(V.total) + ' brutos · ' + U.fmtInt(pr.n) + ' procesados'], ['Período', U.fmtDateTime(V.start) + ' → ' + U.fmtDateTime(V.end)],
      ['Datos faltantes', U.fmtInt(V.missingCells) + ' celdas'], ['Duplicados', U.fmtInt(V.duplicates)], ['Discontinuidades', V.gaps + ' huecos · ' + V.missingTimestamps + ' marcas ausentes'],
      ['Huella de datos procesados (FNV-1a)', U.hashArrays([pr.t, pr.vars[pr.targetKey]])]
    ]);
    h += '<h3>Variables mapeadas</h3>' + tbl(['Variable', 'Columna de origen', 'Unidad de origen'], keysMapped.map(function (v) { return [esc(v.label), esc(S.raw.headers[S.mapping[v.key].col]), esc(S.mapping[v.key].unit || '—')]; }));
    /* 4 */
    var cs = S.clean.summary;
    h += '<h2>4. Limpieza</h2><h3>Problemas detectados</h3>' + tbl(['Variable', 'Faltantes', 'Negativos', 'Imposibles', 'Atípicos', 'Sensor congelado'], V.keys.map(function (k) { var s = V.perVar[k]; return [esc(s.label), s.missing, s.negatives, s.impossible, s.outliers, s.frozen]; }), [1, 2, 3, 4, 5]) +
      '<p>Inconsistencias irradiancia–potencia: ' + V.inconsistent + '. Calidad de datos: <b>' + U.fmt(V.quality.score, 1) + ' %</b> (C ' + U.fmt(V.quality.C * 100, 1) + ' · K ' + U.fmt(V.quality.K * 100, 1) + ' · T ' + U.fmt(V.quality.T * 100, 1) + ' · O ' + U.fmt(V.quality.O * 100, 1) + ' · V ' + U.fmt(V.quality.V * 100, 1) + ').</p>' +
      '<h3>Acciones realizadas</h3>' + kv([['Registros eliminados', U.fmtInt(cs.removedDup + cs.removedInvalidDate) + ' (' + cs.removedDup + ' duplicados, ' + cs.removedInvalidDate + ' sin fecha)'], ['Valores corregidos', U.fmtInt(cs.corrected)], ['Valores interpolados', U.fmtInt(cs.interpolated)], ['Valores invalidados (→ faltante)', U.fmtInt(cs.invalidated)], ['Registros completos resultantes', U.fmtInt(cs.completeRows)]]) +
      '<h3>Registro de limpieza</h3><div class="rlog">' + S.clean.log.map(function (l) { return '<div>' + l.time + '  ' + esc(l.msg) + '</div>'; }).join('') + '</div>';
    /* 5 */
    var daily = SEDA.App.daily();
    h += '<h2>5. Exploración</h2>' + fig(SP.dailyEnergy(daily), 'Generación solar histórica: energía FV diaria [kWh].') +
      '<div class="two">' + fig(SP.hourlyProfile(pr), 'Perfil horario medio de potencia [kW].', 320) + fig(SP.monthlyEnergy(daily), 'Energía media diaria por mes [kWh/día].', 320) + '</div>' +
      '<div class="two">' + fig(SP.scatterVs(pr, pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : 'IRR_POA', 2500), 'Irradiancia vs generación.', 320) + fig(SP.scatterVs(pr, 'TEMPERATURA', 2500), 'Temperatura vs generación (horas diurnas).', 320) + '</div>' +
      fig(SP.corr(pr), 'Matriz de correlación de Pearson. La correlación no implica causalidad.', 420);
    /* 6 */
    h += '<h2>6. Machine Learning</h2><p><b>Algoritmo:</b> Random Forest Regressor implementado localmente: ensamble de ' + mdl.params.nTrees + ' árboles de regresión CART entrenados sobre muestras bootstrap, con criterio de reducción del error cuadrático y búsqueda de cortes por histogramas (hasta ' + mdl.params.bins + ' umbrales por variable). La predicción es el promedio de los árboles.</p>' +
      kv([['Variable objetivo', esc(M.label(mdl.targetKey)) + ' [' + SP.tUnit(mdl.targetKey) + ']'], ['Variables de entrada (' + mdl.features.length + ')', esc(mdl.features.map(ML.flabel).join(', '))],
        ['Número de árboles', mdl.params.nTrees], ['Profundidad máxima', mdl.params.maxDepth], ['Min samples leaf', mdl.params.minLeaf], ['max_features', esc(String(mdl.params.maxFeatures)) + ' (' + mdl.params.mtry + ' variables por nodo)'],
        ['Bootstrap', mdl.params.bootstrap ? 'Sí' : 'No'], ['Semilla', mdl.params.seed], ['Tiempo de entrenamiento', U.fmt(mdl.trainMs / 1000, 2) + ' s · ' + U.fmtInt(mdl.nodes) + ' nodos']]) +
      '<div class="eq">hora_seno = sen(2π·h/24) · hora_coseno = cos(2π·h/24)<br>dia_año_seno = sen(2π·(d−1)/365.25) · dia_año_coseno = cos(2π·(d−1)/365.25)<br>Dirección del viento → sen(θ), cos(θ)</div>' +
      fig(SP.importance(mdl), 'Importancia de variables (reducción media de impureza, %). La importancia de una variable no implica causalidad.', Math.max(260, 24 * mdl.features.length + 50));
    /* 7 */
    var sp = ev.split;
    h += '<h2>7. División de datos</h2><p>Registros ordenados por fecha + hora y divididos cronológicamente (sin aleatoriedad): 60 % entrenamiento, 20 % validación, 20 % prueba. ' + U.fmtInt(sp.excluded) + ' registros procesados se excluyeron por faltantes en la variable objetivo o en las variables de entrada.</p>' +
      tbl(['Conjunto', 'Proporción', 'Registros', 'Desde', 'Hasta'], [['Entrenamiento', '60 %', U.fmtInt(sp.train.n), U.fmtDateTime(sp.train.start), U.fmtDateTime(sp.train.end)], ['Validación', '20 %', U.fmtInt(sp.val.n), U.fmtDateTime(sp.val.start), U.fmtDateTime(sp.val.end)], ['Prueba', '20 %', U.fmtInt(sp.test.n), U.fmtDateTime(sp.test.start), U.fmtDateTime(sp.test.end)]], [2]);
    /* 8 */
    var mrow = function (lab, m) { return [lab, U.fmtInt(m.n), U.fmt(cv(m.mae), 3), U.fmt(cv(m.rmse), 3), U.fmt(m.mape, 1), U.fmt(m.r2, 4), U.fmt(ML.toKWh(m.mae, ev.targetKey, ev.dtH), 3)]; };
    h += '<h2>8. Evaluación</h2><p>Evaluación realizada sobre datos de prueba. Persistencia: ŷ(t) = y(t − ' + ev.persLagH + ' h). Ambos modelos se comparan en el mismo subconjunto. MAPE calculado solo con |real| &gt; 5 % del máximo (evita la división por cero nocturna).</p>' +
      tbl(['Modelo (conjunto)', 'N', 'MAE [kW]', 'RMSE [kW]', 'MAPE [%]', 'R²', 'Error prom. [kWh]'], [mrow('<b>Random Forest (prueba)</b>', mt.rf), mrow('<b>Persistencia (prueba)</b>', mt.pers)].concat(mt.lin ? [mrow('<b>Regresión lineal (prueba)</b>', mt.lin)] : []).concat([mrow('Random Forest (validación)', ev.metrics.val.rf), mrow('Persistencia (validación)', ev.metrics.val.pers)]), [1, 2, 3, 4, 5, 6]) +
      tbl(['Energía diaria (prueba, ' + ev.daily.rf.n + ' días)', 'MAE [kWh/día]', 'RMSE [kWh/día]', 'WAPE [%]'], [['Random Forest', U.fmt(ev.daily.rf.mae, 2), U.fmt(ev.daily.rf.rmse, 2), U.fmt(ev.daily.rf.wape, 2)], ['Persistencia', U.fmt(ev.daily.pe.mae, 2), U.fmt(ev.daily.pe.rmse, 2), U.fmt(ev.daily.pe.wape, 2)]].concat(ev.daily.li ? [['Regresión lineal sobre irradiancia', U.fmt(ev.daily.li.mae, 2), U.fmt(ev.daily.li.rmse, 2), U.fmt(ev.daily.li.wape, 2)]] : []), [1, 2, 3]) +
      (ev.linear && mt.lin ? '<p>Línea base intermedia: regresión lineal ŷ = ' + U.fmt(ev.linear.b, 5) + ' × irradiancia, ajustada solo con entrenamiento. Usa la misma información meteorológica que el Random Forest con un modelo simple; el Random Forest reduce su RMSE en ' + U.fmt((1 - mt.rf.rmse / mt.lin.rmse) * 100, 1) + ' %, mejora atribuible al algoritmo.</p>' : '') +
      '<div class="two">' + fig(SP.realVsPred(ev, 2500), 'Real vs predicho (prueba).', 340) + fig(SP.residuals(ev), 'Residuos frente al valor predicho.', 340) + '</div>' +
      fig(SP.testSeries(ev, 7), 'Serie de prueba: real, Random Forest y persistencia (primeros 7 días).') +
      '<div class="two">' + fig(SP.errorHist(ev), 'Distribución de errores [kW].', 320) + fig(SP.errBy(ev, 'hour'), 'Error (MAE) por hora del día.', 320) + '</div>' +
      '<div class="two">' + fig(SP.errBy(ev, 'month'), 'Error (MAE) por mes.', 320) + fig(SP.errBy(ev, 'cond'), 'Error (MAE) por condición meteorológica.', 320) + '</div>';
    var bt = SEDA.App.backtest();
    if (bt && bt.methods.length) {
      h += '<h3>8b. Evaluación de la decisión en datos de prueba (backtest, unidades del negocio)</h3><p>Se repitió la decisión de la mañana en los ' + bt.n + ' días de prueba (' + U.fmtDate(bt.start) + ' → ' + U.fmtDate(bt.end) + ') con la energía diaria prevista por cada regla y se comparó con la generación real. Costos supuestos: respaldo programado ' + R.cop(bt.costBackup) + '/kWh; kWh no servido ' + R.cop(bt.costUnserved) + '/kWh.</p>' +
        tbl(['Regla de previsión', 'Noches con déficit', 'No servida [kWh]', 'Respaldo [kWh]', 'Costo anual estimado'], bt.methods.map(function (m) { return [esc(m.label), m.nightsShort, U.fmt(m.shortKWh, 1), U.fmt(m.backupKWh, 1), R.cop(m.costYear)]; }), [1, 2, 3, 4]) +
        (isFinite(bt.savingVsPe) ? '<p><b>Valor de la decisión:</b> decidir con el modelo ' + (bt.savingVsPe > 0 ? 'ahorra ' : 'cuesta ') + R.cop(Math.abs(bt.savingVsPe)) + ' al año frente a la persistencia' + (isFinite(bt.savingVsFixed) ? ' y ' + R.cop(bt.savingVsFixed) + ' frente a la regla fija' : '') + '.</p>' : '');
    }
    /* 9 */
    h += '<h2>9. Predicción</h2>' + kv([['Fecha y hora', U.fmtDate(P.date) + ' ' + U.p2(P.hour) + ':00'],
      ['Entradas', esc(Object.keys(P.inputs).filter(function (k) { return P.inputs[k] !== '' && P.inputs[k] != null; }).map(function (k) { return M.label(k) + ' = ' + P.inputs[k] + ' ' + (pr.units[k] || ''); }).join(' · '))],
      ['Generación estimada a esa hora', U.fmt(P.kwH0, 2) + ' kW · ' + U.fmt(P.kwH0, 2) + ' kWh en la hora'], ['Generación restante', U.fmt(P.remainingKWh, 1) + ' kWh (' + P.hoursLeft + ' h)'], ['Generación del día (perfil)', U.fmt(P.dayKWh, 1) + ' kWh'],
      ['Error histórico a esa hora (MAE prueba)', U.fmt(P.errHour, 3) + ' kW'], ['Similitud con el entrenamiento', P.similarity.inRange + ' de ' + P.similarity.total + ' entradas en rango P1–P99'], ['Calidad de datos', U.fmt(P.quality, 1) + ' %']]) +
      '<p><i>El modelo proporciona una estimación puntual.</i></p>' + (P.profile.daily ? '' : fig(SP.profile(P), 'Perfil horario previsto (Random Forest) y media histórica real del mes.')) +
      (P.comparable.length ? '<h3>Predicción histórica comparable</h3>' + tbl(['Fecha y hora', 'Irradiancia [W/m²]', 'Real [kW]', 'RF [kW]'], P.comparable.map(function (c) { return [U.fmtDateTime(c.t), U.fmt(c.irr, 0), U.fmt(cv(c.y), 2), U.fmt(cv(c.pred), 2)]; }), [1, 2, 3]) : '');
    /* 10 */
    var i = r.inputs;
    h += '<h2>10. Decisión energética</h2>' + tbl(['Magnitud', 'Valor'], [['Generación estimada', U.fmt(r.gen, 1) + ' kWh'], ['Consumo nocturno', U.fmt(+i.nightLoad, 1) + ' kWh'], ['Energía nocturna requerida', U.fmt(r.Ereq, 1) + ' kWh'],
      ['Reserva recomendada', '<b>' + U.fmt(r.Eres, 1) + ' kWh</b>'], ['SOC objetivo', '<b>' + U.fmt(r.socObj, 1) + ' %</b>'], ['SOC actual → proyectado al anochecer', i.socNow + ' % → ' + U.fmt(r.nom.socSun, 1) + ' %'],
      ['Energía disponible para la noche', U.fmt(r.nom.Eavail, 1) + ' kWh (conservadora ' + U.fmt(r.cons.Eavail, 1) + ' kWh)'], ['Margen disponible', U.fmt(r.nom.margin, 1) + ' kWh'], ['Riesgo', risk(r.risk) + ' · ' + esc(r.rule)]]) +
      '<div class="eq">Energía nocturna requerida = Consumo nocturno / eficiencia global = ' + U.fmt(+i.nightLoad, 2) + ' / ' + U.fmt(r.eta, 4) + ' = ' + U.fmt(r.Ereq, 2) + ' kWh<br>' +
      'Reserva recomendada = Energía nocturna requerida × (1 + margen) = ' + U.fmt(r.Ereq, 2) + ' × ' + U.fmt(1 + i.margin / 100, 2) + ' = ' + U.fmt(r.Eres, 2) + ' kWh<br>' +
      'SOC objetivo = ' + i.socMin + ' % + ' + U.fmt(r.Eres, 2) + ' / ' + U.fmt(+i.capKWh, 1) + ' × 100 = ' + U.fmt(r.socObjRaw, 1) + ' %<br>' +
      'Cobertura = ' + U.fmt(r.nom.Eavail, 2) + ' / ' + U.fmt(r.Eres, 2) + ' = ' + U.fmtCover(r.nom.cover) + ' % · conservadora = ' + U.fmtCover(r.cons.cover) + ' %</div>' +
      '<div class="two">' + fig(SP.energyBalance(d), 'Energía necesaria vs energía disponible [kWh].', 300) + fig(SP.soc(d), 'SOC actual vs SOC recomendado [%].', 300) + '</div>' +
      '<div class="two">' + fig(SP.reserve(d), 'Composición de la reserva recomendada [kWh].', 200) + fig(SP.risk(d), 'Riesgo energético: cobertura de la reserva.', 200) + '</div>' +
      '<h3>Índice de confiabilidad: ' + U.fmt(d.reliability.score, 0) + '/100 (' + d.reliability.level + ')</h3>' + tbl(['Componente', 'Peso', 'Valor'], [['A — Error histórico (1 − WAPE)', '0.30', U.fmt(d.reliability.comp.A, 3)], ['D — Cantidad de datos', '0.15', U.fmt(d.reliability.comp.D, 3)], ['Q — Calidad de datos', '0.20', U.fmt(d.reliability.comp.Q, 3)], ['S — Similitud', '0.20', d.reliability.comp.S == null ? '—' : U.fmt(d.reliability.comp.S, 3)], ['T — Cobertura temporal', '0.15', U.fmt(d.reliability.comp.T, 3)]], [1, 2]) + '<p class="muted">No es una probabilidad estadística.</p>';
    /* 11 */
    h += '<h2>11. Recomendaciones</h2><div class="box">' + esc(d.narrative) + '</div>' + recos(d.recos);
    /* 12 */
    if (S.scenarios) {
      var L = S.scenarios.list;
      h += '<h2>12. Escenarios</h2>' + tbl(['Escenario', 'Generación [kWh]', 'Δ gen.', 'Reserva [kWh]', 'SOC obj. [%]', 'SOC anochecer [%]', 'Cobertura', 'Riesgo'], L.map(function (s) {
        return [esc(s.name), U.fmt(s.gen, 1), (s.dGen > 0 ? '+' : '') + U.fmt(s.dGen, 1), U.fmt(s.reserve, 1), U.fmt(s.socObj, 0), U.fmt(s.socSun, 0), U.fmtCover(s.cover) + ' %', risk(s.risk)];
      }), [1, 2, 3, 4, 5, 6]) + '<div class="two">' + fig(SP.scenGen(L), 'Generación esperada y reserva por escenario [kWh].', 320) + fig(SP.scenSOC(L), 'SOC al anochecer vs objetivo por escenario [%].', 320) + '</div>';
    } else h += '<h2>12. Escenarios</h2><p class="muted">No se ejecutó el simulador de escenarios en esta operación.</p>';
    /* 12b — simulación del sistema (gemelo digital) */
    if (SEDA.Sim) {
      var sr = SEDA.Sim.ensure(), sk = sr.kpi, spp = sr.params;
      h += '<h3>12b. Simulación del sistema — gemelo digital (24 h, paso 5 min)</h3><p>' + esc(sr.note) + ' Estrategia: <b>' + SEDA.Sim.stratName(spp.strategy) + '</b>; FV ' + spp.kwp + ' kWp, inversor ' + spp.invKw + ' kW, batería ' + spp.batKwh + ' kWh (' + spp.pBatKw + ' kW), SOC inicial ' + spp.socInit + ' %, consumo ' + spp.loadKwh + ' kWh/día, respaldo: ' + (spp.backup === 'ninguno' ? 'no' : 'sí') + '.</p>' +
        tbl(['Indicador', 'Valor'], [['Energía FV disponible', U.fmt(sk.pvAvail, 1) + ' kWh'], ['Consumo', U.fmt(sk.load, 1) + ' kWh (nocturno ' + U.fmt(sk.nightLoad, 1) + ' kWh)'], ['Autosuficiencia', U.fmt(sk.selfSuff, 1) + ' %'],
          ['Energía de respaldo / no servida', U.fmt(sk.backup, 1) + ' kWh / ' + U.fmt(sk.unserved, 1) + ' kWh'], ['Recorte FV', U.fmt(sk.curtail, 1) + ' kWh'],
          ['SOC al anochecer vs reserva', U.fmt(sk.socSunset, 0) + ' % vs ' + Math.round(sk.reserveSoc) + ' % → ' + (sk.reserveMet ? '✔ cumplida' : '✖ no cumplida')], ['SOC al amanecer / mínimo', U.fmt(sk.socEnd, 0) + ' % / ' + U.fmt(sk.socMin, 0) + ' %'], ['Ciclos equivalentes', U.fmt(sk.cycles, 2)]]) +
        '<div class="two">' + fig(SEDA.Sim.powerSpec(sr, null), 'Flujos de potencia simulados [kW] (06:00 → 06:00).', 320) + fig(SEDA.Sim.socSpec(sr, null), 'SOC simulado con SOC de reserva y SOC mínimo [%].', 320) + '</div>' +
        '<figure>' + SEDA.Sim.sankey(sk, { idp: 'rep', w: 760, h: 280 }) + '<figcaption>Balance energético diario simulado (Sankey).</figcaption></figure>';
    }
    /* 12c — proyecto FV (sitio, diseño y presupuesto) */
    if (SEDA.Design && SEDA.Design.project().summary) {
      try {
        var pc = SEDA.Design.final();
        if (pc && pc.ok) {
          var pj = SEDA.Design.project(), rs = pc.ctx.res, CO = SEDA.Costs;
          h += '<h3>12c. Proyecto FV — sitio, diseño y presupuesto</h3><p>Sitio <b>' + esc(pj.site.place || '') + '</b> (' + SEDA.WorldMap.fmtLat(pj.site.lat) + ', ' + SEDA.WorldMap.fmtLon(pj.site.lon) + '). Recurso: ' + esc(rs.label) + ' · GHI ' + U.fmt(rs.ghiYear, 0) + ' kWh/m²·año.</p>' +
            tbl(['Concepto', 'Valor'], [['Arreglo', esc(pc.layout)], ['Módulo', esc(pc.panel.name)], ['Inversor', pc.nInv + ' × ' + esc(pc.inv.name)], ['Batería', pc.bank ? pc.bank.units + ' × ' + esc(pc.bat.name) + ' (' + U.fmt(pc.bank.kwh, 1) + ' kWh)' : '—'],
              ['Potencia DC / AC', U.fmt(pc.kwp, 2) + ' kWp / ' + U.fmt(pc.pacTot, 1) + ' kW'], ['Energía anual · rendimiento · PR', U.fmt(pc.sim.ac, 0) + ' kWh · ' + U.fmt(pc.sim.specYield, 0) + ' kWh/kWp · ' + U.fmt(pc.sim.pr * 100, 1) + ' %'],
              ['Fracción solar', U.fmt(pc.sim.solarFrac * 100, 1) + ' %'], ['Inversión total', CO.money(pc.bom.total) + ' (' + CO.moneyAlt(pc.bom.total) + ')'], ['LCOE · recuperación', CO.money(pc.econ.lcoe) + '/kWh · ' + (isFinite(pc.econ.payback) ? U.fmt(pc.econ.payback, 1) + ' años' : '—')]]) +
            '<figure>' + SEDA.Design.diagram(pc) + '<figcaption>Diagrama unifilar del diseño (conductores y protecciones calculados).</figcaption></figure>';
        }
      } catch (e) { console.warn('Proyecto FV en informe', e); }
    }
    /* 13 */
    h += '<h2>13. Limitaciones</h2><ul>' + R.limitations(S).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    /* 14 */
    h += '<h2>14. Conclusión</h2><div class="box">' + esc(R.conclusion(S)) + '</div>';
    h += '<h3>Anexo · Metodología de los indicadores</h3><div class="eq">Calidad de datos = 100 × (C + K + T + O + V)/5 (completitud, consistencia, continuidad, atípicos, validez)<br>Índice de confiabilidad = 100 × Σ w·c / Σ w con A 0.30, D 0.15, Q 0.20, S 0.20, T 0.15<br>Riesgo: R1 reserva &gt; capacidad útil → ALTO; R2 cobertura &lt; 100 % → ALTO; R3 cobertura conservadora &lt; 100 % → MODERADO; R4 → BAJO; R5 confiabilidad &lt; 50 eleva BAJO a MODERADO</div>';
    h += '<div class="foot">SEGAR SOLAR ENERGY DECISIÓN IA v' + SEDA.App.VERSION + ' · ' + esc(S.runId || '') + ' · Informe técnico generado el ' + esc(U.nowHuman()) + ' · Procesamiento local, sin conexión a servidores externos.</div></article>';
    return h;
  };

  /* Documento HTML autónomo */
  R.standalone = function (mode) {
    var S = SEDA.state, body = R.build(mode);
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Informe ' + (mode === 'exec' ? 'ejecutivo' : 'técnico') + ' ' + esc(S.runId || '') + ' — SEGAR SOLAR ENERGY DECISIÓN IA</title>' +
      '<style>@page{size:A4;margin:14mm 12mm}body{margin:0;background:#e6e9ed;padding:20px}.pbar{max-width:210mm;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}.pbar button{font:600 13px system-ui,sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #c9d2db;background:#f29d0b;cursor:pointer}@media print{body{background:#fff;padding:0}.pbar{display:none}}\n' + R.CSS + '</style></head><body>' +
      '<div class="pbar"><button onclick="window.print()">🖨 Imprimir / Guardar como PDF</button></div>' + body + '</body></html>';
  };
})();
