/* ==========================================================================
   specs.js — Definición de gráficos (compartidos por la interfaz y el
   informe). Identidad de color fija en toda la aplicación:
     serie 0 (azul)    = valor real / histórico
     serie 1 (naranja) = Random Forest (predicción)
     serie 2 (aqua)    = Persistencia (línea base)
   Los colores de estado (bueno / advertencia / crítico) se reservan para
   el riesgo y siempre van acompañados de texto.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U, ML = SEDA.ML, M = SEDA.Mapping, Q = SEDA.Quality;
  var SP = SEDA.Specs = {};
  var RISK_COLOR = { BAJO: 'status:good', MODERADO: 'status:warning', ALTO: 'status:critical' };
  SP.RISK_COLOR = RISK_COLOR;

  function tUnit(tk) { return tk === 'ENERGIA_FV' ? 'kWh' : 'kW'; }
  SP.tUnit = tUnit;
  function kwUnit() { return 'kW'; }

  /* ---------- Exploración ---------- */
  SP.dailyEnergy = function (daily) {
    var d = daily.filter(function (r) { return isFinite(r.energy) && r.coverage >= 0.5; });
    return { type: 'line', xType: 'time', yLabel: 'Energía diaria [kWh]', unit: 'kWh', series: [{ name: 'Generación FV diaria', x: d.map(function (r) { return r.day; }), y: d.map(function (r) { return r.energy; }), color: 0, fill: true }], xFmt: U.fmtDate, aria: 'Serie de generación fotovoltaica diaria' };
  };
  SP.hourlyProfile = function (pr) {
    var tk = pr.targetKey, s = new Array(24).fill(0), n = new Array(24).fill(0);
    for (var i = 0; i < pr.n; i++) { var v = pr.vars[tk][i]; if (!isFinite(v)) continue; var h = Math.floor(U.hourOf(pr.t[i])); s[h] += ML.toKW(v, tk, pr.dtH); n[h]++; }
    return { type: 'line', categories: s.map(function (_, h) { return U.p2(h) + 'h'; }), xLabel: 'Hora del día', yLabel: 'Potencia media [kW]', unit: 'kW', series: [{ name: 'Potencia media', y: s.map(function (v, h) { return n[h] ? v / n[h] : NaN; }), color: 0, markers: true }] };
  };
  SP.monthlyEnergy = function (daily) {
    var s = new Array(12).fill(0), n = new Array(12).fill(0);
    daily.forEach(function (r) { if (!isFinite(r.energy) || r.coverage < 0.8) return; var m = U.monthOf(r.day) - 1; s[m] += r.energy; n[m]++; });
    return { type: 'bar', categories: U.MESES, catLabel: 'Mes', yLabel: 'Energía media diaria [kWh/día]', unit: 'kWh/día', series: [{ name: 'Energía media diaria', values: s.map(function (v, m) { return n[m] ? v / n[m] : NaN; }), color: 0 }] };
  };
  SP.scatterVs = function (pr, key, maxPts) {
    var tk = pr.targetKey, xs = [], ys = [], lab = [];
    if (!pr.vars[key]) return { type: 'scatter', empty: true, emptyText: 'Variable "' + M.label(key) + '" no disponible en los datos' };
    var irr = pr.vars.IRRADIANCIA || pr.vars.IRR_POA;
    var idx = [];
    for (var i = 0; i < pr.n; i++) {
      var x = pr.vars[key][i], y = pr.vars[tk][i];
      if (!isFinite(x) || !isFinite(y)) continue;
      if (key !== 'IRRADIANCIA' && key !== 'IRR_POA' && irr && !(irr[i] > 10)) continue; /* solo horas diurnas */
      idx.push(i);
    }
    var step = Math.max(1, Math.ceil(idx.length / (maxPts || 4000)));
    for (var k = 0; k < idx.length; k += step) { var j = idx[k]; xs.push(pr.vars[key][j]); ys.push(ML.toKW(pr.vars[tk][j], tk, pr.dtH)); lab.push(U.fmtDateTime(pr.t[j])); }
    return { type: 'scatter', xLabel: M.label(key) + ' [' + (pr.units[key] || '') + ']', yLabel: 'Potencia FV [kW]', zeroX: key === 'IRRADIANCIA' || key === 'IRR_POA', series: [{ name: 'Registros' + (step > 1 ? ' (muestra 1 de ' + step + ')' : ''), x: xs, y: ys, labels: lab, color: 0 }] };
  };
  SP.corr = function (pr) {
    var keys = [pr.targetKey].concat(pr.keys.filter(function (k) { return M.METEO.indexOf(k) >= 0; }));
    var L = keys.map(function (k) { return M.label(k).replace(' (GHI)', '').replace('Irradiancia global', 'Irradiancia'); });
    var Mx = keys.map(function (a) { return keys.map(function (b) { return a === b ? 1 : U.pearson(pr.vars[a], pr.vars[b]); }); });
    return { type: 'heatmap', labels: L, matrix: Mx };
  };
  SP.histTarget = function (pr) {
    var tk = pr.targetKey, v = [];
    for (var i = 0; i < pr.n; i++) { var y = pr.vars[tk][i]; if (isFinite(y) && y > 0) v.push(ML.toKW(y, tk, pr.dtH)); }
    return SP.histogram(v, 20, 'Potencia FV (solo valores > 0) [kW]', 0);
  };
  SP.histogram = function (vals, bins, xl, color) {
    var mm = U.minmax(vals);
    if (!isFinite(mm[0])) return { type: 'bar', categories: [] };
    var sc = SEDA.Charts.niceScale(mm[0], mm[1], bins);
    var w = sc.step, start = sc.min, nb = Math.max(1, Math.round((sc.max - sc.min) / w));
    var cnt = new Array(nb).fill(0);
    vals.forEach(function (v) { var b = Math.min(nb - 1, Math.max(0, Math.floor((v - start) / w))); cnt[b]++; });
    var cats = cnt.map(function (_, i) { return U.fmtAuto(start + i * w); });
    return { type: 'bar', categories: cats, catLabel: 'Desde', xLabel: xl, yLabel: 'Frecuencia (registros)', series: [{ name: 'Registros', values: cnt, color: color || 0 }], tipTitle: function (i) { return U.fmtAuto(start + i * w) + ' a ' + U.fmtAuto(start + (i + 1) * w); } };
  };

  /* ---------- Histórico ---------- */
  SP.series = function (pr, key, from, to, color) {
    var xs = [], ys = [], tk = pr.targetKey;
    var src = pr.vars[key];
    if (!src) return { type: 'line', empty: true };
    for (var i = 0; i < pr.n; i++) {
      if (pr.t[i] < from || pr.t[i] >= to) continue;
      xs.push(pr.t[i]); ys.push(key === tk ? ML.toKW(src[i], tk, pr.dtH) : src[i]);
    }
    var unit = key === tk ? 'kW' : pr.units[key];
    return { type: 'line', xType: 'time', yLabel: (key === tk ? 'Potencia FV' : M.label(key)) + ' [' + unit + ']', unit: unit, series: [{ name: M.label(key), x: xs, y: ys, color: color == null ? 0 : color, fill: key === tk }], zero: key !== 'TEMPERATURA' && key !== 'PRESION' && key !== 'HUMEDAD' };
  };
  SP.dailyBars = function (daily, from, to) {
    var d = daily.filter(function (r) { return r.day >= from && r.day < to; });
    var many = d.length > 62;
    return { type: many ? 'line' : 'bar', xType: 'time', categories: many ? undefined : d.map(function (r) { return U.p2(new Date(r.day).getUTCDate()) + ' ' + U.MESES[new Date(r.day).getUTCMonth()]; }), catLabel: 'Día', yLabel: 'Energía [kWh/día]', unit: 'kWh',
      series: many ? [{ name: 'Energía diaria', x: d.map(function (r) { return r.day; }), y: d.map(function (r) { return r.energy; }), color: 0, fill: true }] : [{ name: 'Energía diaria', values: d.map(function (r) { return r.energy; }), color: 0 }], xFmt: U.fmtDate };
  };
  SP.monthlyBars = function (daily, from, to) {
    var map = new Map();
    daily.forEach(function (r) { if (r.day < from || r.day >= to || !isFinite(r.energy)) return; var d = new Date(r.day), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); var e = map.get(k) || { e: 0, n: 0 }; e.e += r.energy; e.n++; map.set(k, e); });
    var keys = Array.from(map.keys()).sort(function (a, b) { return a - b; });
    return { type: 'bar', categories: keys.map(function (k) { return U.MESES[k % 100] + ' ' + String(Math.floor(k / 100)).slice(2); }), catLabel: 'Mes', yLabel: 'Energía mensual [kWh]', unit: 'kWh', series: [{ name: 'Energía mensual (días con datos)', values: keys.map(function (k) { return map.get(k).e; }), color: 0 }] };
  };

  /* ---------- Modelo ---------- */
  SP.importance = function (model) {
    var arr = model.features.map(function (f, i) { return { f: ML.flabel(f), v: model.importance[i] * 100 }; }).sort(function (a, b) { return b.v - a.v; });
    return { type: 'bar', horizontal: true, showValues: true, categories: arr.map(function (a) { return a.f; }), catLabel: 'Variable', unit: '%', valueFmt: function (v) { return U.fmt(v, 1); }, series: [{ name: 'Importancia (MDI)', values: arr.map(function (a) { return a.v; }), color: 0 }] };
  };
  SP.realVsPred = function (ev, maxPts) {
    var T = ev.test, xs = [], ys = [], lab = [];
    var step = Math.max(1, Math.ceil(T.y.length / (maxPts || 4000)));
    for (var i = 0; i < T.y.length; i += step) { xs.push(ML.toKW(T.y[i], ev.targetKey, ev.dtH)); ys.push(ML.toKW(T.rf[i], ev.targetKey, ev.dtH)); lab.push(U.fmtDateTime(T.t[i])); }
    return { type: 'scatter', diag: true, xLabel: 'Real [kW]', yLabel: 'Predicho RF [kW]', series: [{ name: 'Datos de prueba', x: xs, y: ys, labels: lab, color: 1 }] };
  };
  SP.testSeries = function (ev, days, offsetDays) {
    var T = ev.test; if (!T.t.length) return { type: 'line', empty: true };
    var start = U.dayStart(T.t[0]) + (offsetDays || 0) * U.DAY, end = start + (days || 7) * U.DAY;
    var x = [], y = [], rf = [], pe = [];
    for (var i = 0; i < T.t.length; i++) {
      if (T.t[i] < start || T.t[i] >= end) continue;
      x.push(T.t[i]); y.push(ML.toKW(T.y[i], ev.targetKey, ev.dtH)); rf.push(ML.toKW(T.rf[i], ev.targetKey, ev.dtH)); pe.push(ML.toKW(T.pe[i], ev.targetKey, ev.dtH));
    }
    return { type: 'line', xType: 'time', yLabel: 'Potencia FV [kW]', unit: 'kW', series: [{ name: 'Real', x: x, y: y, color: 0 }, { name: 'Random Forest', x: x, y: rf, color: 1 }, { name: 'Persistencia 24 h', x: x, y: pe, color: 2, dash: [5, 4] }] };
  };
  SP.residuals = function (ev) {
    var T = ev.test, xs = [], ys = [], lab = [];
    var step = Math.max(1, Math.ceil(T.y.length / 4000));
    for (var i = 0; i < T.y.length; i += step) { xs.push(ML.toKW(T.rf[i], ev.targetKey, ev.dtH)); ys.push(ML.toKW(T.rf[i] - T.y[i], ev.targetKey, ev.dtH)); lab.push(U.fmtDateTime(T.t[i])); }
    return { type: 'scatter', zero: false, xLabel: 'Predicho RF [kW]', yLabel: 'Residuo (predicho − real) [kW]', refLines: [{ value: 0, label: 'residuo 0', color: 'muted' }], series: [{ name: 'Residuos (prueba)', x: xs, y: ys, labels: lab, color: 1 }] };
  };
  SP.errorHist = function (ev) {
    var T = ev.test, v = [];
    for (var i = 0; i < T.y.length; i++) { var y = T.y[i]; if (!(y > 0) && !(T.rf[i] > 0)) continue; v.push(ML.toKW(T.rf[i] - y, ev.targetKey, ev.dtH)); }
    return SP.histogram(v, 24, 'Error (predicho − real) [kW], horas con generación', 1);
  };
  SP.errBy = function (ev, what) {
    var cats, rows;
    if (what === 'hour') { rows = ev.byHour; cats = rows.map(function (_, h) { return U.p2(h); }); }
    else if (what === 'month') { rows = ev.byMonth; cats = U.MESES.slice(); }
    else { cats = Object.keys(ev.byCond).filter(function (c) { return ev.byCond[c].n > 0; }); rows = cats.map(function (c) { return ev.byCond[c]; }); cats = cats.map(function (c, i) { return c + ' (n=' + rows[i].n + ')'; }); }
    var keep = rows.map(function (r) { return r.n > 0; });
    if (what === 'month') { cats = cats.filter(function (_, i) { return keep[i]; }); rows = rows.filter(function (_, i) { return keep[i]; }); }
    var conv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
    return { type: 'bar', categories: cats, catLabel: what === 'hour' ? 'Hora' : what === 'month' ? 'Mes' : 'Condición', xLabel: what === 'hour' ? 'Hora del día' : undefined, yLabel: 'MAE [kW]', unit: 'kW', valueFmt: function (v) { return U.fmt(v, 3); },
      series: [{ name: 'Random Forest', values: rows.map(function (r) { return conv(r.rf); }), color: 1 }, { name: 'Persistencia 24 h', values: rows.map(function (r) { return conv(r.pe); }), color: 2 }] };
  };
  SP.dailyTest = function (ev) {
    var R = ev.daily.rows;
    return { type: 'line', xType: 'time', yLabel: 'Energía diaria [kWh]', unit: 'kWh', xFmt: U.fmtDate, series: [{ name: 'Real', x: R.map(function (r) { return r.day; }), y: R.map(function (r) { return r.y; }), color: 0, markers: R.length < 60 }, { name: 'Random Forest', x: R.map(function (r) { return r.day; }), y: R.map(function (r) { return r.rf; }), color: 1 }, { name: 'Persistencia', x: R.map(function (r) { return r.day; }), y: R.map(function (r) { return r.pe; }), color: 2, dash: [5, 4] }] };
  };

  /* ---------- Predicción ---------- */
  SP.profile = function (pred) {
    var p = pred.profile, cats = p.hours.map(function (h) { return U.p2(h) + 'h'; });
    var refs = [{ axis: 'x', value: p.H0, label: 'Hora de análisis ' + U.p2(p.H0) + ':00', color: 'muted' }];
    if (pred.hoursLeft > 0 && p.H0 + pred.hoursLeft <= 24) refs.push({ axis: 'x', value: Math.min(23, p.H0 + pred.hoursLeft - 1), label: 'Fin de generación', color: 'muted' });
    return { type: 'line', categories: cats, xLabel: 'Hora del día (' + U.fmtDate(pred.date) + ')', yLabel: 'Potencia FV [kW]', unit: 'kW', refLines: refs,
      series: [{ name: 'Predicción Random Forest', y: p.kw, color: 1, fill: true }, { name: 'Media histórica del mes (real)', y: p.kwClim, color: 0, dash: [5, 4] }] };
  };

  /* ---------- Decisión ---------- */
  SP.energyBalance = function (dec) {
    var r = dec.result;
    return { type: 'bar', categories: ['Escenario esperado', 'Escenario conservador'], catLabel: 'Escenario', yLabel: 'Energía [kWh]', unit: 'kWh', showValues: true, valueFmt: function (v) { return U.fmt(v, 1); },
      series: [{ name: 'Energía disponible para la noche', values: [r.nom.Eavail, r.cons.Eavail], color: 0 }, { name: 'Energía necesaria (reserva recomendada)', values: [r.Eres, r.Eres], color: 1 }] };
  };
  SP.soc = function (dec) {
    var r = dec.result, i = r.inputs;
    return { type: 'bar', categories: ['SOC mínimo', 'SOC actual', 'SOC proyectado al anochecer', 'SOC objetivo'], catLabel: 'Indicador', yLabel: 'SOC [%]', unit: '%', yMax: 100, showValues: true, valueFmt: function (v) { return U.fmt(v, 0); },
      series: [{ name: 'SOC', values: [+i.socMin, +i.socNow, r.nom.socSun, r.socObj], color: 0 }] };
  };
  SP.reserve = function (dec) {
    var r = dec.result, night = +r.inputs.nightLoad;
    return { type: 'bar', horizontal: true, stacked: true, showValues: true, categories: ['Reserva recomendada'], catLabel: 'Componente', unit: 'kWh', valueFmt: function (v) { return U.fmt(v, 1); },
      series: [{ name: 'Consumo nocturno', values: [night], color: 0 }, { name: 'Pérdidas batería + inversor', values: [r.Ereq - night], color: 1 }, { name: 'Margen de seguridad', values: [r.Eres - r.Ereq], color: 2 }] };
  };
  SP.risk = function (dec) {
    var r = dec.result;
    var c1 = r.nom.cover >= 1 ? 'status:good' : 'status:critical', c2 = r.cons.cover >= 1 ? 'status:good' : 'status:warning';
    if (r.capInsufficient) { c1 = c2 = 'status:critical'; }
    return { type: 'risk', rows: [{ label: 'Cobertura con generación esperada', value: r.nom.cover, color: c1 }, { label: 'Cobertura conservadora (−' + U.fmt(r.errRel * 100, 1) + ' %)', value: r.cons.cover, color: c2 }] };
  };

  /* ---------- Escenarios ---------- */
  SP.scenGen = function (list) {
    return { type: 'bar', categories: list.map(function (s) { return s.name; }), catLabel: 'Escenario', yLabel: 'Energía [kWh]', unit: 'kWh', valueFmt: function (v) { return U.fmt(v, 1); },
      series: [{ name: 'Generación esperada', values: list.map(function (s) { return s.gen; }), color: 0 }, { name: 'Reserva recomendada', values: list.map(function (s) { return s.reserve; }), color: 1 }] };
  };
  SP.scenSOC = function (list) {
    return { type: 'bar', categories: list.map(function (s) { return s.name; }), catLabel: 'Escenario', yLabel: 'SOC [%]', unit: '%', yMax: 100, valueFmt: function (v) { return U.fmt(v, 0); },
      series: [{ name: 'SOC proyectado al anochecer', values: list.map(function (s) { return s.socSun; }), color: 0 }, { name: 'SOC objetivo', values: list.map(function (s) { return s.socObj; }), color: 1 }] };
  };
  SP.scenRisk = function (list) {
    return { type: 'risk', rows: list.map(function (s) { return { label: s.name + ' — ' + s.risk, value: s.cover, color: RISK_COLOR[s.risk] }; }) };
  };
})();
