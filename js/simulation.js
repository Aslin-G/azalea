/* ==========================================================================
   simulation.js — SIMULACIÓN INTERACTIVA (gemelo digital del sistema FV +
   batería + respaldo) para ingenieros de energía.

   Motor de despacho (paso de 5 min, 24 h desde las 06:00 hasta las 06:00 del
   día siguiente, para que la noche quede al final del horizonte):
   - Fuente FV: (a) Random Forest entrenado + climatología del mes,
     (b) día histórico real de los datos procesados, o (c) modelo físico de
     cielo claro (Haurwitz) con la latitud/longitud del sistema.
   - Variabilidad de nubes: máscara estocástica reproducible normalizada para
     conservar la energía diaria (ilustra la intermitencia).
   - Batería: carga con η_bat, descarga con η_bat·η_inv (igual que la decisión),
     límite de potencia, SOC mínimo.
   - Estrategias: «Reserva nocturna» (durante el día no se descarga por debajo
     del SOC de reserva recomendado) o «Autoconsumo máximo».
   - Respaldo: generador / red, o sin respaldo (energía no servida).
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, ML = SEDA.ML, D = SEDA.Decision, M = SEDA.Mapping, Q = SEDA.Quality;
  var Sim = SEDA.Sim = {};
  var V = SEDA.Views = SEDA.Views || {};
  var STEP_MIN = 5, N = 288, START_H = 6, DT = STEP_MIN / 60;
  Sim.N = N; Sim.START_H = START_H;

  var COL = { pv: '#f5b83d', load: '#5aa9ff', chg: '#2ad4b0', dis: '#b69cff', backup: '#ff7a59', curtail: '#8a97a6', unserved: '#ff4d6d' };
  Sim.COL = COL;

  function r1(v) { return Math.round(v * 10) / 10; }
  Sim.hhmm = function (i) { var m = START_H * 60 + i * STEP_MIN; m = ((m % 1440) + 1440) % 1440; return U.p2(Math.floor(m / 60)) + ':' + U.p2(Math.round(m % 60)); };
  Sim.xTicks = function () { var t = []; for (var h = 0; h <= 24; h += 3) t.push({ v: h, l: U.p2((START_H + h) % 24) + ':00' }); return t; };

  /* ---------------- Parámetros por defecto ---------------- */
  Sim.kwpData = function () {
    var S = SEDA.state, sys = SEDA.App.system();
    if (+sys.kwp > 0) return +sys.kwp;
    var pr = S.processed;
    if (pr && pr.targetKey) {
      var v = U.quantile(Array.from(pr.vars[pr.targetKey]).map(function (x) { return ML.toKW(x, pr.targetKey, pr.dtH); }), 0.999);
      if (v > 0) return Math.round(v / 0.8 * 10) / 10;
    }
    return 20;
  };
  Sim.loadShape = function (month) {
    var S = SEDA.state, pr = S.processed;
    if (pr && pr.vars.CARGA) {
      var cl = SEDA.App.clim()[month];
      var sh = cl.map(function (r) { return r.CARGA; });
      if (sh.every(isFinite)) return { shape: sh, fromData: true };
    }
    return { shape: [2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.8, 3.3, 3.3, 3.3, 3.3, 3.3, 3.6, 3.6, 3.6, 3.6, 3.6, 3.4, 3.9, 4.3, 4.3, 4.3, 3.0, 3.0], fromData: false };
  };
  Sim.defaults = function () {
    var S = SEDA.state, sys = SEDA.App.system(), di = S.decisionInputs || D.DEFAULT_INPUTS, dec = S.decision;
    var kwpD = Sim.kwpData();
    var date = S.prediction ? S.prediction.date : U.dayStart(U.nowLocalNaive());
    var ls = Sim.loadShape(U.monthOf(date));
    var cap = +di.capKWh || +sys.batteryKwh || 80;
    return {
      source: S.model ? 'rf' : (S.processed ? 'hist' : 'fisico'), date: date,
      irrPct: 0, variability: 35, tempDelta: 0,
      kwp: kwpD, invKw: +sys.inverterKw || Math.round(kwpD * 0.85 * 10) / 10,
      batKwh: cap, pBatKw: Math.round(cap * 0.5), socInit: 40, socMin: +di.socMin || 20,
      effBat: +di.effBat || 95, effInv: +di.effInv || 96,
      loadKwh: Math.round(U.sum(ls.shape) * 10) / 10,
      strategy: 'predictiva', reserveSoc: dec ? Math.round(dec.result.socObj) : 60, backup: 'generador', seed: 11,
      _touched: false, _decAt: dec ? dec.at : null, _model: !!S.model
    };
  };

  /* ---------------- Perfiles ---------------- */
  function interpHourly(hourly, i) {
    /* valor horario = media de la hora h; se interpola en el centro de cada hora */
    var hAbs = START_H + i * DT + DT / 2;
    var x = hAbs - 0.5, h0 = Math.floor(x), f = x - h0;
    var a = hourly[((h0 % 24) + 24) % 24], b = hourly[(((h0 + 1) % 24) + 24) % 24];
    if (!isFinite(a)) a = 0; if (!isFinite(b)) b = 0;
    return a + (b - a) * f;
  }
  function physicalPV(p, sys) {
    var lat = (+sys.lat || 11.54) * Math.PI / 180, lon = +sys.lon || -72.91;
    /* huso horario del sitio (meridiano estándar = 15° × desfase); por defecto el más cercano a la longitud */
    var off = sys.utcOffset !== undefined && sys.utcOffset !== '' && isFinite(+sys.utcOffset) ? +sys.utcOffset : Math.round(lon / 15);
    var out = new Float64Array(N), clear = new Float64Array(N), irr = new Float64Array(N);
    for (var i = 0; i < N; i++) {
      var t = p.date + (START_H * 60 + i * STEP_MIN + STEP_MIN / 2) * 60000;
      var doy = U.doyOf(t), hr = U.hourOf(t);
      var decl = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * Math.PI / 180;
      var B = 2 * Math.PI * (doy - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      var ts = hr + (4 * (lon - 15 * off) + eot) / 60, w = 15 * (ts - 12) * Math.PI / 180;
      var cz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(w);
      var ghi = cz > 0.01 ? 1098 * cz * Math.exp(-0.057 / cz) : 0;
      var g = ghi * 0.8 * (1 + p.irrPct / 100);
      var tamb = 28 + p.tempDelta + 3 * Math.cos(2 * Math.PI * (hr - 14) / 24);
      var tc = tamb + g / (25 + 6.84 * 5);
      clear[i] = p.kwp * ghi / 1000 * 0.85;
      irr[i] = g;
      out[i] = Math.max(0, p.kwp * g / 1000 * 0.86 * (1 - 0.0037 * (tc - 25)));
    }
    return { pv: out, clear: clear, irr: irr };
  }
  function cloudMask(p, clear) {
    var R = U.rng(p.seed * 7919 + Math.round(p.variability)), m = new Float64Array(N);
    for (var i = 0; i < N; i++) m[i] = 1;
    var v = p.variability / 100;
    if (v <= 0) return m;
    var pk = Math.max.apply(null, Array.from(clear)), first = -1, last = -1;
    for (var k = 0; k < N; k++) if (clear[k] > 0.02 * pk) { if (first < 0) first = k; last = k; }
    if (first < 0) return m;
    var events = Math.round(4 + v * 26);
    for (var e = 0; e < events; e++) {
      var c = first + R() * (last - first), wdt = 1 + R() * (2 + 7 * v), dep = (0.25 + 0.6 * R()) * v;
      for (var j = Math.max(0, Math.floor(c - 3 * wdt)); j <= Math.min(N - 1, Math.ceil(c + 3 * wdt)); j++) m[j] *= 1 - dep * Math.exp(-Math.pow((j - c) / wdt, 2));
    }
    var num = 0, den = 0;
    for (var q = first; q <= last; q++) { num += clear[q]; den += clear[q] * m[q]; }
    var norm = den > 0 ? num / den : 1;
    for (var z = 0; z < N; z++) m[z] = Math.min(1.35, m[z] * norm);
    return m;
  }

  Sim.profiles = function (p) {
    var S = SEDA.state, sys = SEDA.App.system(), pr = S.processed, note = '', src = p.source;
    var pvHourly = null, loadHourly = null, pv = new Float64Array(N), clear = new Float64Array(N), irr = new Float64Array(N), load = new Float64Array(N);
    var kwpD = Sim.kwpData(), scale = p.kwp / kwpD;
    if (src === 'hist') {
      if (!pr) { src = 'fisico'; note = 'Sin datos procesados: se usa el modelo físico.'; }
      else {
        var t0 = p.date + START_H * U.HOUR, t1 = t0 + U.DAY, byH = {}, cnt = 0, tk = pr.targetKey;
        for (var i = 0; i < pr.n; i++) {
          if (pr.t[i] < t0 || pr.t[i] >= t1) continue;
          var hi = Math.floor((pr.t[i] - t0) / U.HOUR);
          var y = pr.vars[tk][i];
          byH[hi] = { pv: isFinite(y) ? ML.toKW(y, tk, pr.dtH) : NaN, load: pr.vars.CARGA ? pr.vars.CARGA[i] : NaN, irr: pr.vars.IRRADIANCIA ? pr.vars.IRRADIANCIA[i] : NaN };
          cnt++;
        }
        if (cnt < 20) { src = S.model ? 'rf' : 'fisico'; note = 'La fecha elegida no está en los datos históricos: se usa ' + (S.model ? 'el Random Forest' : 'el modelo físico') + '.'; }
        else {
          pvHourly = []; loadHourly = []; var irrH = [];
          for (var h = 0; h < 24; h++) { var r = byH[h] || {}; pvHourly.push(isFinite(r.pv) ? r.pv * scale : NaN); loadHourly.push(r.load); irrH.push(r.irr); }
          /* completar huecos por interpolación simple */
          [pvHourly, irrH].forEach(function (arr) { for (var k = 0; k < 24; k++) if (!isFinite(arr[k])) { var a = arr[(k + 23) % 24], b = arr[(k + 1) % 24]; arr[k] = isFinite(a) && isFinite(b) ? (a + b) / 2 : 0; } });
          for (var j = 0; j < N; j++) {
            var hh = Math.min(23, Math.floor(j * DT));
            pv[j] = Math.max(0, pvHourly[hh] * (1 + p.irrPct / 100));
            irr[j] = isFinite(irrH[hh]) ? irrH[hh] * (1 + p.irrPct / 100) : NaN;
            clear[j] = pvHourly[hh];
          }
          if (loadHourly.every(isFinite)) { for (var j2 = 0; j2 < N; j2++) load[j2] = loadHourly[Math.min(23, Math.floor(j2 * DT))]; }
          else loadHourly = null;
          note = 'Reproducción del día histórico real ' + U.fmtDate(p.date) + ' (06:00) al ' + U.fmtDate(p.date + U.DAY) + ' (06:00), en resolución horaria.';
        }
      }
    }
    if (src === 'rf') {
      if (!S.model) { src = 'fisico'; note = 'Modelo no entrenado: se usa el modelo físico.'; }
      else {
        var ctx = { pr: pr, model: S.model, clim: SEDA.App.clim() };
        var prof = D.profile(ctx, { date: p.date, hour: 12, inputs: {}, mods: { irrPct: p.irrPct, tempDelta: p.tempDelta } });
        var base = D.profile(ctx, { date: p.date, hour: 12, inputs: {}, mods: {} });
        if (prof.daily) { src = 'fisico'; note = 'Datos diarios: se usa el modelo físico para el perfil intradiario.'; }
        else {
          for (var s1 = 0; s1 < N; s1++) {
            pv[s1] = Math.max(0, interpHourly(prof.kw, s1) * scale);
            clear[s1] = Math.max(0, interpHourly(base.kw, s1) * scale);
            irr[s1] = interpHourly(prof.vals.map(function (v) { return v.IRRADIANCIA != null ? v.IRRADIANCIA : v.IRR_POA; }), s1);
          }
          note = 'Perfil FV del Random Forest con la climatología de ' + U.MESES_L[prof.climMonth - 1].toLowerCase() + (p.irrPct ? ' (irradiancia ' + (p.irrPct > 0 ? '+' : '') + p.irrPct + ' %)' : '') + (p.tempDelta ? ' y temperatura ' + (p.tempDelta > 0 ? '+' : '') + p.tempDelta + ' °C' : '') + '.';
        }
      }
    }
    if (src === 'fisico') {
      var ph = physicalPV(p, sys);
      pv = ph.pv; clear = ph.clear; irr = ph.irr;
      note = (note ? note + ' ' : '') + 'Modelo físico de cielo claro (Haurwitz) × 0.8, lat ' + (sys.lat || 11.54) + '°.';
    }
    if (src !== 'hist') {
      var mask = cloudMask(p, clear);
      for (var q = 0; q < N; q++) { pv[q] *= mask[q]; if (isFinite(irr[q])) irr[q] *= mask[q]; }
    }
    if (!loadHourly) {
      var ls = Sim.loadShape(U.monthOf(p.date)), tot = U.sum(ls.shape), R = U.rng(p.seed);
      for (var L = 0; L < N; L++) load[L] = interpHourly(ls.shape, L) * p.loadKwh / tot * (1 + 0.04 * R.normal());
    } else {
      var tl = U.sum(Array.from(load)) * DT;
      if (tl > 0) for (var L2 = 0; L2 < N; L2++) load[L2] *= p.loadKwh / tl;
    }
    return { pv: pv, clear: clear, irr: irr, load: load, source: src, note: note };
  };

  /* ---------------- Despacho ---------------- */
  Sim.run = function (p, prof) {
    prof = prof || Sim.profiles(p);
    var cap = Math.max(0.1, +p.batKwh), eB = p.effBat / 100, eI = p.effInv / 100, pMax = Math.max(0.1, +p.pBatKw);
    var Emin = cap * p.socMin / 100, Eres = cap * Math.min(100, Math.max(p.socMin, p.reserveSoc)) / 100;
    var E = cap * U.clamp(p.socInit, 0, 100) / 100, E0 = E;
    var pk = Math.max.apply(null, Array.from(prof.clear).concat([0.001])), thr = 0.01 * pk;
    /* primer bloque diurno del horizonte (el amanecer siguiente queda fuera) */
    var sunrise = -1, sunset = -1;
    for (var k = 0; k < N; k++) if (prof.clear[k] > thr) { sunrise = k; break; }
    if (sunrise >= 0) { sunset = sunrise; while (sunset + 1 < N && prof.clear[sunset + 1] > thr) sunset++; }
    /* estrategia predictiva: excedente almacenable futuro hasta el anochecer (según el perfil previsto) */
    var F = new Float64Array(N + 1);
    for (var q = N - 1; q >= 0; q--) {
      var sur = q <= sunset ? Math.min(Math.max(0, Math.min(prof.pv[q], p.invKw) - prof.load[q]), pMax) * eB * DT : 0;
      F[q] = F[q + 1] + sur;
    }
    var o = { t: [], pvAvail: [], pv: [], load: [], bat: [], backup: [], unserved: [], curtail: [], soc: [], irr: [] };
    var T = { pvAvail: 0, pvDirect: 0, batIn: 0, batOut: 0, backup: 0, unserved: 0, curtail: 0, load: 0, clip: 0, backupSteps: 0 };
    var socMinV = E / cap * 100, socMinAt = 0, socSunset = NaN;
    for (var i = 0; i < N; i++) {
      var avail = prof.pv[i], pv = Math.min(avail, p.invKw), clip = avail - pv, load = prof.load[i];
      var net = pv - load, bat = 0, backup = 0, uns = 0, cur = clip;
      if (net >= 0) {
        var pIn = Math.max(0, Math.min(net, pMax, (cap - E) / (DT * eB)));
        E += pIn * eB * DT; bat = pIn; cur += net - pIn; T.batIn += pIn * DT;
      } else {
        var def = -net;
        var daytime = sunrise >= 0 && i >= sunrise && i <= sunset;
        var floorE = Emin;
        if (daytime && p.strategy === 'reserva') floorE = Eres;
        else if (daytime && p.strategy === 'predictiva') floorE = U.clamp(Eres - F[i + 1], Emin, Eres);
        var pOut = Math.max(0, Math.min(def, pMax, (E - floorE) * eB * eI / DT));
        E -= pOut / (eB * eI) * DT; bat = -pOut; T.batOut += pOut * DT;
        var rem = def - pOut;
        if (p.backup !== 'ninguno') backup = rem; else uns = rem;
      }
      if (E < 0) E = 0;
      T.pvAvail += avail * DT; T.pvDirect += Math.min(pv, load) * DT; T.curtail += cur * DT; T.clip += clip * DT;
      T.backup += backup * DT; T.unserved += uns * DT; T.load += load * DT; if (backup > 1e-3) T.backupSteps++;
      var soc = E / cap * 100;
      if (soc < socMinV - 1e-9) { socMinV = soc; socMinAt = i; }
      if (i === sunset) socSunset = soc;
      o.t.push((i + 1) * DT); o.pvAvail.push(avail); o.pv.push(pv); o.load.push(load); o.bat.push(bat); o.backup.push(backup); o.unserved.push(uns); o.curtail.push(cur); o.soc.push(soc); o.irr.push(prof.irr[i]);
    }
    var nightLoad = 0; for (var n = Math.max(0, sunset + 1); n < N; n++) nightLoad += prof.load[n] * DT;
    var losses = T.batIn - T.batOut - (E - E0);
    var kpi = {
      pvAvail: T.pvAvail, pvUsed: T.pvAvail - T.curtail, pvDirect: T.pvDirect, load: T.load, batIn: T.batIn, batOut: T.batOut, backup: T.backup, unserved: T.unserved,
      curtail: T.curtail, clip: T.clip, losses: losses, selfSuff: T.load > 0 ? 100 * (T.load - T.backup - T.unserved) / T.load : NaN,
      socSunset: socSunset, socEnd: E / cap * 100, socMin: socMinV, socMinAt: socMinAt, reserveSoc: Math.max(p.socMin, p.reserveSoc),
      reserveMet: isFinite(socSunset) ? socSunset >= Math.max(p.socMin, p.reserveSoc) - 0.5 : null,
      cycles: T.batOut / cap, backupHours: T.backupSteps * DT, sunrise: sunrise, sunset: sunset, nightLoad: nightLoad,
      autonomyH: isFinite(socSunset) && nightLoad > 0 ? Math.max(0, (socSunset - p.socMin) / 100 * cap * eB * eI) / (nightLoad / Math.max(1, (N - 1 - sunset) * DT)) : NaN
    };
    return { series: o, kpi: kpi, source: prof.source, note: prof.note, params: Object.assign({}, p) };
  };

  Sim.compare = function (p, prof) {
    prof = prof || Sim.profiles(p);
    return ['predictiva', 'reserva', 'autoconsumo'].map(function (s) { var r = Sim.run(Object.assign({}, p, { strategy: s }), prof); r.strategy = s; return r; });
  };

  /* ---------------- Especificaciones de gráficos ---------------- */
  Sim.powerSpec = function (res, cursor) {
    var s = res.series, x = s.t.map(function (v) { return v - DT / 2; });
    var refs = [];
    if (res.kpi.sunset >= 0) refs.push({ axis: 'x', value: (res.kpi.sunset + 1) * DT, label: 'Anochecer', color: 'muted' });
    if (cursor != null) refs.push({ axis: 'x', value: cursor, color: 'status:serious' });
    var series = [
      { name: 'FV disponible', x: x, y: s.pvAvail, color: 3, fill: true },
      { name: 'Carga', x: x, y: s.load, color: 0 },
      { name: 'Batería (+carga / −descarga)', x: x, y: s.bat, color: 2 },
      { name: 'Respaldo', x: x, y: s.backup, color: 7 }
    ];
    if (res.kpi.unserved > 0.01) series.push({ name: 'No servida', x: x, y: s.unserved, color: 4, dash: [4, 3] });
    return { type: 'line', xMin: 0, xMax: 24, xTicks: Sim.xTicks(), xFmt: function (v) { return Sim.hhmm(Math.round(v / DT)); }, zero: false, yLabel: 'Potencia [kW]', unit: 'kW', refLines: refs, series: series };
  };
  Sim.socSpec = function (res, cursor) {
    var s = res.series, x = s.t.map(function (v) { return v - DT / 2; }), p = res.params;
    var refs = [{ value: res.kpi.reserveSoc, label: 'SOC de reserva ' + Math.round(res.kpi.reserveSoc) + ' %', color: 'status:good' }, { value: p.socMin, label: 'SOC mínimo ' + p.socMin + ' %', color: 'status:critical' }];
    if (res.kpi.sunset >= 0) refs.push({ axis: 'x', value: (res.kpi.sunset + 1) * DT, label: 'Anochecer', color: 'muted' });
    if (cursor != null) refs.push({ axis: 'x', value: cursor, color: 'status:serious' });
    return { type: 'line', xMin: 0, xMax: 24, xTicks: Sim.xTicks(), xFmt: function (v) { return Sim.hhmm(Math.round(v / DT)); }, yMin: 0, yMax: 100, yLabel: 'SOC [%]', unit: '%', refLines: refs, series: [{ name: 'SOC', x: x, y: s.soc, color: 0, fill: true }] };
  };

  /* ---------------- Diagrama de Sankey (energía diaria) ---------------- */
  Sim.sankey = function (k, opts) {
    opts = opts || {};
    var W = opts.w || 620, H = opts.h || 300, pad = 16, nodeW = 14;
    var L = [{ id: 'fv', label: 'Solar FV', v: k.pvAvail, c: COL.pv }, { id: 'bd', label: 'Batería (descarga)', v: k.batOut, c: COL.dis }, { id: 'rs', label: 'Respaldo', v: k.backup, c: COL.backup }];
    if (k.unserved > 0.01) L.push({ id: 'ns', label: 'No servida', v: k.unserved, c: COL.unserved });
    var R = [{ id: 'co', label: 'Consumo', v: k.load, c: COL.load }, { id: 'bc', label: 'Carga de batería', v: k.batIn, c: COL.chg }, { id: 'rc', label: 'Recorte / excedente', v: k.curtail, c: COL.curtail }];
    var links = [['fv', 'co', k.pvDirect], ['fv', 'bc', k.batIn], ['fv', 'rc', k.curtail], ['bd', 'co', k.batOut], ['rs', 'co', k.backup], ['ns', 'co', k.unserved]].filter(function (l) { return l[2] > 0.005; });
    var total = Math.max(U.sum(L.map(function (n) { return n.v; })), U.sum(R.map(function (n) { return n.v; })), 0.001);
    var gap = 14, avail = H - 2 * pad - gap * (Math.max(L.length, R.length) - 1), sc = avail / total;
    var place = function (arr, x) { var y = pad; arr.forEach(function (n) { n.x = x; n.y = y; n.h = Math.max(2, n.v * sc); n.oo = 0; n.io = 0; y += n.h + gap; }); };
    place(L, 158); place(R, W - 178);
    var byId = {}; L.concat(R).forEach(function (n) { byId[n.id] = n; });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sankey" role="img" aria-label="Diagrama de Sankey de la energía diaria"><defs>';
    links.forEach(function (l, i) { svg += '<linearGradient id="sk' + i + (opts.idp || '') + '" x1="0" x2="1"><stop offset="0" stop-color="' + byId[l[0]].c + '" stop-opacity=".75"/><stop offset="1" stop-color="' + byId[l[1]].c + '" stop-opacity=".75"/></linearGradient>'; });
    svg += '</defs>';
    links.forEach(function (l, i) {
      var a = byId[l[0]], b = byId[l[1]], w = l[2] * sc;
      var y0 = a.y + a.oo + w / 2, y1 = b.y + b.io + w / 2; a.oo += w; b.io += w;
      var x0 = a.x + nodeW, x1 = b.x, mx = (x0 + x1) / 2;
      svg += '<path d="M' + x0 + ',' + y0 + ' C' + mx + ',' + y0 + ' ' + mx + ',' + y1 + ' ' + x1 + ',' + y1 + '" stroke="url(#sk' + i + (opts.idp || '') + ')" stroke-width="' + Math.max(1.5, w) + '" fill="none"><title>' + a.label + ' → ' + b.label + ': ' + U.fmt(l[2], 1) + ' kWh</title></path>';
    });
    var txt = opts.dark ? '#e6eef7' : '#16202a', sub = opts.dark ? '#9fb2c6' : '#5a6773';
    L.forEach(function (n) {
      if (n.v <= 0.005) return;
      svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + nodeW + '" height="' + n.h + '" rx="3" fill="' + n.c + '"/>' +
        '<text class="sk-t" x="' + (n.x - 10) + '" y="' + (n.y + n.h / 2 - 4) + '" text-anchor="end" font-size="13" font-weight="700" fill="' + txt + '">' + n.label + '</text>' +
        '<text class="sk-s" x="' + (n.x - 10) + '" y="' + (n.y + n.h / 2 + 12) + '" text-anchor="end" font-size="12" fill="' + sub + '">' + U.fmt(n.v, 1) + ' kWh</text>';
    });
    R.forEach(function (n) {
      if (n.v <= 0.005) return;
      svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + nodeW + '" height="' + n.h + '" rx="3" fill="' + n.c + '"/>' +
        '<text class="sk-t" x="' + (n.x + nodeW + 10) + '" y="' + (n.y + n.h / 2 - 4) + '" font-size="13" font-weight="700" fill="' + txt + '">' + n.label + '</text>' +
        '<text class="sk-s" x="' + (n.x + nodeW + 10) + '" y="' + (n.y + n.h / 2 + 12) + '" font-size="12" fill="' + sub + '">' + U.fmt(n.v, 1) + ' kWh</text>';
    });
    return svg + '</svg>';
  };

  /* ---------------- Esquema animado (SVG unifilar estilizado) ---------------- */
  function panelGrid() {
    var g = '';
    for (var r = 0; r < 2; r++) for (var c = 0; c < 5; c++) {
      var x = 58 + c * 52 + r * 14, y = 330 + r * 38;
      g += '<g transform="translate(' + x + ',' + y + ') skewX(-18)"><rect width="46" height="32" rx="2" fill="url(#pvcell)" stroke="#7fb4e6" stroke-opacity=".55" stroke-width="1"/>' +
        '<path d="M15.3 0V32M30.6 0V32M0 10.6H46M0 21.3H46" stroke="#9cc6ee" stroke-opacity=".28" stroke-width=".8"/></g>';
    }
    return g;
  }
  function cloud(id, x, y, s) {
    return '<g id="' + id + '" transform="translate(' + x + ',' + y + ') scale(' + s + ')" opacity="0"><path d="M10 40 Q0 40 0 30 Q0 18 14 18 Q18 4 34 6 Q46 -4 60 8 Q76 6 78 22 Q92 24 90 36 Q88 44 76 44 L14 44 Q10 44 10 40 Z" fill="#e8eef5"/></g>';
  }
  Sim.cockpitSVG = function () {
    var flow = function (id, d) {
      return '<path d="' + d + '" class="fl-base"/><path id="fl-' + id + '" d="' + d + '" class="fl" stroke-dasharray="1 13"/><g id="pt-' + id + '"></g>';
    };
    return '<svg viewBox="0 0 960 560" class="sim-svg" role="img" aria-label="Esquema animado del sistema fotovoltaico con batería">' +
      '<defs>' +
      '<linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop id="sky0" offset="0" stop-color="#0a1830"/><stop id="sky1" offset="1" stop-color="#1c3558"/></linearGradient>' +
      '<linearGradient id="groundg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1a2b"/><stop offset="1" stop-color="#060e18"/></linearGradient>' +
      '<radialGradient id="sung"><stop offset="0" stop-color="#fff6d8"/><stop offset=".45" stop-color="#ffd166"/><stop offset="1" stop-color="#f29d0b" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="pvcell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d4f86"/><stop offset="1" stop-color="#0e2a4d"/></linearGradient>' +
      '<linearGradient id="batg" x1="0" y1="1" x2="0" y2="0"><stop id="bat0" offset="0" stop-color="#1fb58f"/><stop id="bat1" offset="1" stop-color="#5ff0c8"/></linearGradient>' +
      '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="softglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
      '<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#1a2d44" stroke-width="1"/></pattern>' +
      '</defs>' +
      '<rect width="960" height="300" fill="url(#skyg)"/>' +
      '<g id="stars">' + Array.from({ length: 38 }, function (_, i) { var x = (i * 173) % 950 + 5, y = (i * 97) % 240 + 8; return '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 3 === 0 ? 1.4 : 0.8) + '" fill="#fff"/>'; }).join('') + '</g>' +
      '<path id="sunarc" d="M60,300 Q480,-70 900,300" fill="none" stroke="#ffffff" stroke-opacity=".10" stroke-dasharray="3 7"/>' +
      '<g id="sun"><circle r="46" fill="url(#sung)" opacity=".75"/><circle r="17" fill="#fff1c2" filter="url(#glow)"/></g>' +
      '<g id="moon" opacity="0"><circle cx="860" cy="60" r="16" fill="#e9eef6"/><circle cx="868" cy="54" r="15" fill="#0a1830" id="moonmask"/></g>' +
      cloud('cl1', 140, 70, 1.1) + cloud('cl2', 520, 40, 0.8) + cloud('cl3', 760, 95, 1.25) +
      '<rect y="300" width="960" height="260" fill="url(#groundg)"/><rect y="300" width="960" height="260" fill="url(#grid)" opacity=".55"/>' +
      '<line x1="0" y1="300" x2="960" y2="300" stroke="#2b4a6b" stroke-width="1.5"/>' +
      /* flujos */
      flow('pv', 'M330,368 C380,368 385,356 428,356') + flow('load', 'M542,356 C620,356 640,352 716,352') + flow('bat', 'M485,398 L485,438') + flow('bk', 'M800,446 L800,402') +
      /* arreglo FV */
      '<g id="pv"><path d="M70,408 L64,440 M190,408 L186,440 M300,408 L296,440" stroke="#4c6784" stroke-width="3"/>' + panelGrid() +
      '<rect id="pvglow" x="52" y="326" width="290" height="80" rx="8" fill="#ffd166" opacity="0" filter="url(#softglow)"/>' +
      '<text x="190" y="462" class="lbl" text-anchor="middle">ARREGLO FV</text><text id="t-kwp" x="190" y="480" class="sub" text-anchor="middle">20 kWp</text>' +
      '<g id="clipbadge" opacity="0"><rect x="244" y="302" width="100" height="22" rx="11" fill="#3a2a10" stroke="#f5b83d"/><text x="294" y="317" class="sub" text-anchor="middle" fill="#ffd28a">RECORTE</text></g></g>' +
      /* inversor */
      '<g id="inv"><rect x="428" y="316" width="114" height="82" rx="12" fill="#10263d" stroke="#3b6a97" stroke-width="1.5"/>' +
      '<path id="invwave" d="M446,366 q10,-18 20,0 t20,0 t20,0 t20,0" fill="none" stroke="#5aa9ff" stroke-width="2" stroke-linecap="round"/>' +
      '<circle id="invled" cx="528" cy="330" r="4" fill="#2ad4b0"/><text x="485" y="340" class="lbl" text-anchor="middle">INVERSOR</text>' +
      '<text id="t-inv" x="485" y="390" class="sub" text-anchor="middle">17 kW · η 96 %</text></g>' +
      /* batería */
      '<g id="bat"><rect x="470" y="432" width="30" height="8" rx="2" fill="#6f8aa6"/><rect x="441" y="440" width="88" height="104" rx="10" fill="#0d2135" stroke="#6f8aa6" stroke-width="2"/>' +
      '<clipPath id="batclip"><rect x="445" y="444" width="80" height="96" rx="7"/></clipPath>' +
      '<rect id="batfill" x="445" y="540" width="80" height="0" fill="url(#batg)" clip-path="url(#batclip)"/>' +
      '<line id="batres" x1="438" x2="532" y1="500" y2="500" stroke="#ffd166" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<line id="batmin" x1="438" x2="532" y1="520" y2="520" stroke="#ff4d6d" stroke-width="1.5" stroke-dasharray="2 3"/>' +
      '<text id="t-soc" x="485" y="498" class="big" text-anchor="middle">50 %</text><text x="560" y="470" class="lbl">BATERÍA</text><text id="t-bat" x="560" y="488" class="sub">80 kWh</text>' +
      '<text id="t-batres" x="560" y="506" class="sub" fill="#ffd166">reserva 60 %</text></g>' +
      /* carga */
      '<g id="house"><path d="M716,300 L798,252 L880,300 L880,402 L716,402 Z" fill="#12263c" stroke="#3b6a97" stroke-width="1.5"/>' +
      '<rect class="win" x="736" y="318" width="26" height="22" rx="2" fill="#1b3350"/><rect class="win" x="784" y="318" width="26" height="22" rx="2" fill="#1b3350"/><rect class="win" x="832" y="318" width="26" height="22" rx="2" fill="#1b3350"/>' +
      '<rect class="win" x="736" y="356" width="26" height="22" rx="2" fill="#1b3350"/><rect x="786" y="352" width="24" height="50" rx="2" fill="#0a1a2b" stroke="#3b6a97"/><rect class="win" x="832" y="356" width="26" height="22" rx="2" fill="#1b3350"/>' +
      '<text x="888" y="330" class="lbl">CARGA</text><text id="t-load" x="888" y="348" class="sub">3.2 kW</text></g>' +
      /* respaldo */
      '<g id="gen"><rect x="746" y="446" width="112" height="62" rx="10" fill="#1a1f2b" stroke="#5c6b80" stroke-width="1.5"/>' +
      '<g id="fan" transform="translate(780,477)"><circle r="20" fill="#0d141f" stroke="#5c6b80"/><path d="M0,-16 L4,0 L0,16 L-4,0Z M-16,0 L0,-4 L16,0 L0,4Z" fill="#7d8ca0"/></g>' +
      '<circle id="genled" cx="842" cy="460" r="4" fill="#3b4656"/><text x="826" y="482" class="sub" text-anchor="middle">GEN</text>' +
      '<text x="802" y="530" class="lbl" text-anchor="middle">RESPALDO</text><text id="t-bk" x="802" y="547" class="sub" text-anchor="middle">en espera</text></g>' +
      /* etiquetas de flujo */
      '<text id="v-pv" x="378" y="352" class="flv" text-anchor="middle"></text><text id="v-load" x="630" y="342" class="flv" text-anchor="middle"></text>' +
      '<text id="v-bat" x="400" y="422" class="flv" text-anchor="middle"></text><text id="v-bk" x="742" y="432" class="flv" text-anchor="end"></text>' +
      '</svg>';
  };

  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t));
    var g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t));
    var bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  /* ---------------- Página ---------------- */
  var run = null, cmp = null, anim = { t: 7 * 12, playing: false, speed: 12, last: 0, raf: 0, lastChart: 0, pathLen: {}, off: {} };
  function P() { var S = SEDA.state; if (!S.simParams) S.simParams = Sim.defaults(); return S.simParams; }

  Sim.recompute = function () {
    var S = SEDA.state, p = P();
    var prof = Sim.profiles(p);
    run = Sim.run(p, prof);
    cmp = Sim.compare(p, prof);
    S.simulation = { at: Date.now(), source: run.source, note: run.note, kpi: run.kpi, params: Object.assign({}, p), compare: cmp.map(function (c) { return { strategy: c.strategy, kpi: c.kpi }; }) };
    SEDA.App.persist();
    return run;
  };
  Sim.current = function () { if (!run) Sim.recompute(); return run; };

  function stopAnim() { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = 0; }

  Sim.STRATS = [['predictiva', 'Reserva nocturna predictiva (SEGAR)'], ['reserva', 'Reserva fija durante el día'], ['autoconsumo', 'Autoconsumo máximo']];
  Sim.stratName = function (s) { var f = Sim.STRATS.filter(function (x) { return x[0] === s; })[0]; return f ? f[1] : s; };
  V.simulacion = {
    render: function (el) {
      stopAnim();
      var S = SEDA.state, p = P();
      /* si el usuario no ha tocado los controles, se alinea con el modelo y la decisión más recientes */
      if (!p._touched) {
        if (S.model && !p._model) { p.source = 'rf'; p._model = true; }
        if (S.decision && p._decAt !== S.decision.at) Sim.syncDecision();
      }
      var srcOpts = [['rf', 'Random Forest + climatología del mes' + (S.model ? '' : ' (requiere modelo)')], ['hist', 'Día histórico real (datos procesados)' + (S.processed ? '' : ' (requiere datos)')], ['fisico', 'Modelo físico de cielo claro']];
      var rng = function (k, label, min, max, step, unit, hint) {
        return '<div class="sim-ctl"><label for="sp-' + k + '">' + label + '<output id="so-' + k + '">' + p[k] + ' ' + unit + '</output></label><input type="range" id="sp-' + k + '" data-sp="' + k + '" data-unit="' + unit + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + p[k] + '">' + (hint ? '<small>' + hint + '</small>' : '') + '</div>';
      };
      var h = V.head('Simulación interactiva — gemelo digital', 'Reproduce un día completo (06:00 → 06:00) del sistema fotovoltaico con batería y respaldo, paso de 5 minutos. Mueva los controles y observe en tiempo real los flujos de potencia, el estado de carga y el cumplimiento de la reserva nocturna recomendada por SEGAR.',
        '<button class="btn" id="sim-sync">🔗 Sincronizar con la decisión</button><button class="btn" id="sim-reset">↺ Restablecer</button>');
      h += '<div class="cockpit">' +
        '<div class="ck-main"><div class="ck-svg">' + Sim.cockpitSVG() + '</div>' +
        '<div class="ck-play"><button class="ck-btn" id="ck-play" title="Reproducir / pausar">▶</button><button class="ck-btn" id="ck-rew" title="Volver a las 06:00">⏮</button>' +
        '<input type="range" id="ck-time" min="0" max="' + (N - 1) + '" step="1" value="' + Math.round(anim.t) + '" aria-label="Hora de la simulación">' +
        '<select id="ck-speed" title="Velocidad"><option value="3">15 min/s</option><option value="12" selected>1 h/s</option><option value="36">3 h/s</option><option value="1">5 min/s</option></select></div></div>' +
        '<aside class="ck-hud"><div class="hud-clock"><div id="hud-time">06:00</div><div id="hud-date" class="hud-sub">—</div></div>' +
        '<div class="hud-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="ring-bg"/><circle id="ring" cx="60" cy="60" r="50" class="ring-fg" stroke-dasharray="0 314" transform="rotate(-90 60 60)"/><line id="ring-res" x1="60" y1="4" x2="60" y2="16" stroke="#ffd166" stroke-width="3"/></svg>' +
        '<div class="ring-txt"><b id="hud-soc">—</b><span>SOC batería</span></div></div>' +
        '<div class="hud-meters">' + [['pv', '☀ Solar FV'], ['load', '🏠 Carga'], ['bat', '🔋 Batería'], ['bk', '⛽ Respaldo'], ['cur', '✂ Recorte']].map(function (m) {
          return '<div class="hm"><div class="hm-top"><span>' + m[1] + '</span><b id="hm-' + m[0] + '">—</b></div><div class="hm-bar"><div id="hb-' + m[0] + '"></div></div></div>';
        }).join('') + '</div><div id="hud-status" class="hud-status"></div></aside></div>';
      h += '<div class="card sim-controls"><div class="grid g3">' +
        '<div><h4>🌤 Escenario del día</h4><div class="sim-ctl"><label>Fuente del perfil FV</label><select id="sp-source">' + srcOpts.map(function (o) { return '<option value="' + o[0] + '"' + (p.source === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="sim-ctl"><label>Fecha</label><input type="date" id="sp-date" value="' + U.fmtDate(p.date) + '"></div>' +
        rng('irrPct', 'Irradiancia vs. referencia', -70, 30, 5, '%') + rng('variability', 'Variabilidad de nubes', 0, 100, 5, '%', 'Intermitencia; conserva la energía diaria') + rng('tempDelta', 'Temperatura', -8, 8, 0.5, '°C') + '</div>' +
        '<div><h4>⚡ Sistema</h4>' + rng('kwp', 'Potencia FV instalada', 2, 100, 1, 'kWp') + rng('invKw', 'Inversor (AC)', 2, 100, 1, 'kW') + rng('batKwh', 'Capacidad de batería', 5, 300, 5, 'kWh') +
        rng('pBatKw', 'Potencia máx. batería', 1, 150, 1, 'kW') + rng('effBat', 'Eficiencia batería', 80, 100, 0.5, '%') + rng('effInv', 'Eficiencia inversor', 85, 100, 0.5, '%') + '</div>' +
        '<div><h4>🔋 Operación</h4>' + rng('socInit', 'SOC inicial (06:00)', 0, 100, 1, '%') + rng('socMin', 'SOC mínimo', 0, 60, 1, '%') + rng('loadKwh', 'Consumo diario', 5, 300, 1, 'kWh') +
        '<div class="sim-ctl"><label>Estrategia de despacho</label><select id="sp-strategy">' + Sim.STRATS.map(function (x) { return '<option value="' + x[0] + '"' + (p.strategy === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
        rng('reserveSoc', 'SOC de reserva para la noche', 0, 100, 1, '%') +
        '<div class="sim-ctl"><label>Respaldo</label><select id="sp-backup"><option value="generador"' + (p.backup === 'generador' ? ' selected' : '') + '>Generador / red disponible</option><option value="ninguno"' + (p.backup === 'ninguno' ? ' selected' : '') + '>Sin respaldo (sistema aislado)</option></select></div></div>' +
        '</div><p class="small muted" id="sim-note" style="margin:10px 0 0"></p></div>';
      h += '<div class="grid g6" id="sim-kpis"></div>';
      h += '<div class="grid g2">' + C.card('sim-power', 'Flujos de potencia del día', 'FV disponible, carga, batería (+ carga / − descarga) y respaldo', 300) + C.card('sim-soc', 'Estado de carga de la batería', 'Con SOC de reserva recomendado y SOC mínimo', 300) + '</div>';
      h += '<div class="grid g2"><div class="card"><div class="card-head"><h3>Balance energético del día (Sankey)</h3></div><div id="sim-sankey"></div></div>' +
        '<div class="card"><div class="card-head"><h3>Comparación de estrategias</h3></div><div id="sim-cmp"></div>' +
        '<p class="small muted" style="margin-top:8px"><b>Predictiva (SEGAR)</b>: de día solo descarga la batería si el excedente solar previsto hasta el anochecer permite recuperar el SOC de reserva. <b>Reserva fija</b>: de día nunca baja del SOC de reserva. <b>Autoconsumo</b>: descarga ante cualquier déficit. Mismas condiciones y perfiles en las tres.</p></div></div>';
      h += '<div class="card"><h3>Modelo de simulación</h3><div class="eq">Paso Δt = 5 min · horizonte 06:00 → 06:00 · P<sub>FV</sub> = mín(P<sub>FV,disp</sub>, P<sub>inversor</sub>)<br>' +
        'Excedente: P<sub>carga</sub> = mín(P<sub>FV</sub> − P<sub>carga</sub>, P<sub>bat,máx</sub>, (C − E)/(Δt·η<sub>bat</sub>)) → E += P·η<sub>bat</sub>·Δt; el resto es recorte<br>' +
        'Déficit: P<sub>desc</sub> = mín(déficit, P<sub>bat,máx</sub>, (E − E<sub>piso</sub>)·η<sub>bat</sub>·η<sub>inv</sub>/Δt) → E −= P/(η<sub>bat</sub>·η<sub>inv</sub>)·Δt; el resto lo cubre el respaldo (o queda no servido)<br>' +
        'E<sub>piso</sub> (día): predictiva = clamp(C·SOC<sub>res</sub> − Σ<sub>futuro→anochecer</sub> mín(excedente, P<sub>bat,máx</sub>)·η<sub>bat</sub>·Δt, C·SOC<sub>mín</sub>, C·SOC<sub>res</sub>); reserva fija = C·SOC<sub>res</sub>; autoconsumo = C·SOC<sub>mín</sub>. De noche E<sub>piso</sub> = C·SOC<sub>mín</sub>.<br>Autosuficiencia = (Consumo − Respaldo − No servida)/Consumo</div></div>';
      el.innerHTML = h;
      Sim.bind(el);
      Sim.refresh(true);
      Sim.setTime(anim.t);
    },
    leave: stopAnim
  };

  Sim.bind = function (el) {
    var S = SEDA.state;
    U.$$('[data-sp]', el).forEach(function (x) {
      x.oninput = function () {
        var k = x.getAttribute('data-sp'); P()[k] = +x.value; P()._touched = true;
        U.$('#so-' + k).textContent = x.value + ' ' + x.getAttribute('data-unit');
        Sim.refreshSoon();
      };
    });
    var syncHistLoad = function () {
      var p = P(); if (p.source !== 'hist') return;
      var tot = Sim.histLoadTotal(p.date);
      if (tot) { p.loadKwh = Math.round(tot); var sl = U.$('#sp-loadKwh'); if (sl) { sl.value = p.loadKwh; U.$('#so-loadKwh').textContent = p.loadKwh + ' kWh'; } }
    };
    ['source', 'strategy', 'backup'].forEach(function (k) { U.$('#sp-' + k).onchange = function () { P()[k] = this.value; P()._touched = true; if (k === 'source') syncHistLoad(); Sim.refresh(); }; });
    U.$('#sp-date').onchange = function () { var v = U.parseDateInput(this.value); if (isFinite(v)) { P().date = v; P()._touched = true; syncHistLoad(); Sim.refresh(); } };
    U.$('#ck-play').onclick = function () { if (anim.playing) stopAnim(); else Sim.play(); U.$('#ck-play').textContent = anim.playing ? '⏸' : '▶'; };
    U.$('#ck-rew').onclick = function () { Sim.setTime(0); };
    U.$('#ck-time').oninput = function () { Sim.setTime(+this.value); };
    U.$('#ck-speed').onchange = function () { anim.speed = +this.value; };
    U.$('#ck-speed').value = String(anim.speed);
    U.$('#sim-sync').onclick = function () { Sim.syncDecision(); SEDA.Views.simulacion.render(el); U.toast('Simulación sincronizada con la decisión energética.', 'good'); };
    U.$('#sim-reset').onclick = function () { S.simParams = Sim.defaults(); SEDA.Views.simulacion.render(el); };
  };
  Sim.syncDecision = function () {
    var S = SEDA.state, p = P(), d = S.decision;
    if (!d) { U.toast('Aún no hay decisión calculada: se usan los valores por defecto.', 'warn'); return; }
    var i = d.inputs;
    Object.assign(p, { batKwh: +i.capKWh, socMin: +i.socMin, effBat: +i.effBat, effInv: +i.effInv, reserveSoc: Math.round(d.result.socObj), _decAt: d.at });
    if (p.strategy === 'autoconsumo') p.strategy = 'predictiva';
    if (S.model) { p.source = 'rf'; p._model = true; }
    if (S.prediction) p.date = S.prediction.date;
  };
  Sim.apply = function (mods) {
    var p = P();
    Object.keys(mods || {}).forEach(function (k) { if (k in p && mods[k] != null && mods[k] !== '') p[k] = typeof p[k] === 'number' ? +mods[k] : mods[k]; });
    if (Object.keys(mods || {}).length) p._touched = true;
    run = null;
  };

  var refreshT = 0;
  Sim.refreshSoon = function () { clearTimeout(refreshT); refreshT = setTimeout(function () { Sim.refresh(); }, 60); };
  Sim.refresh = function () {
    if (!U.$('#page-simulacion.active')) return;
    var r = Sim.recompute(), k = r.kpi, p = r.params;
    U.$('#sim-note').innerHTML = '<b>Fuente:</b> ' + U.esc(r.note) + (p.kwp !== Sim.kwpData() && r.source !== 'fisico' ? ' Potencia escalada de ' + U.fmt(Sim.kwpData(), 1) + ' a ' + p.kwp + ' kWp.' : '');
    var tile = function (l, v, u, sub, cls) { return V.kpi(l, v, u, sub, cls); };
    var resCls = k.reserveMet == null ? '' : k.reserveMet ? 'good' : 'crit';
    U.$('#sim-kpis').innerHTML =
      tile('Energía FV', U.fmt(k.pvAvail, 1), 'kWh', 'Aprovechada ' + U.fmt(k.pvUsed, 1) + ' kWh', 'accent') +
      tile('Consumo', U.fmt(k.load, 1), 'kWh', 'Nocturno ' + U.fmt(k.nightLoad, 1) + ' kWh', '') +
      tile('Autosuficiencia', U.fmt(k.selfSuff, 0), '%', 'Sin respaldo ni déficit', k.selfSuff >= 95 ? 'good' : k.selfSuff >= 80 ? 'warn' : 'crit') +
      tile('Respaldo', U.fmt(k.backup, 1), 'kWh', U.fmt(k.backupHours, 1) + ' h de operación' + (k.unserved > 0.01 ? ' · no servida ' + U.fmt(k.unserved, 1) + ' kWh' : ''), k.backup + k.unserved > 0.05 ? 'warn' : 'good') +
      tile('SOC al anochecer', U.fmt(k.socSunset, 0), '%', 'Reserva ' + Math.round(k.reserveSoc) + ' % · ' + (k.reserveMet ? '✔ cumplida' : '✖ no cumplida'), resCls) +
      tile('SOC al amanecer', U.fmt(k.socEnd, 0), '%', 'Mínimo ' + U.fmt(k.socMin, 0) + ' % a las ' + Sim.hhmm(k.socMinAt) + ' · ' + U.fmt(k.cycles, 2) + ' ciclos', k.socEnd > p.socMin + 1 ? 'good' : 'warn');
    U.$('#sim-sankey').innerHTML = Sim.sankey(k, { idp: 'app' });
    U.$('#sim-cmp').innerHTML = U.table(['Indicador', 'Predictiva', 'Reserva fija', 'Autoconsumo'], (function () {
      var ks = cmp.map(function (c) { return c.kpi; });
      var row = function (lab, f, d, better) {
        var vs = ks.map(f), best = better === 'min' ? Math.min.apply(null, vs) : Math.max.apply(null, vs), spread = Math.max.apply(null, vs) - Math.min.apply(null, vs);
        return [lab].concat(vs.map(function (v) { var s = U.fmt(v, d); return Math.abs(v - best) < 1e-6 && spread > 1e-6 ? '<b class="status-ok">' + s + '</b>' : s; }));
      };
      return [row('SOC anochecer %', function (x) { return x.socSunset; }, 0, 'max'), row('SOC amanecer %', function (x) { return x.socEnd; }, 0, 'max'),
        row('Respaldo kWh', function (x) { return x.backup; }, 1, 'min'), row('No servida kWh', function (x) { return x.unserved; }, 1, 'min'),
        row('Recorte kWh', function (x) { return x.curtail; }, 1, 'min'), row('Autosuficiencia %', function (x) { return x.selfSuff; }, 1, 'max'),
        ['Reserva nocturna'].concat(ks.map(function (x) { return x.reserveMet ? '<span class="status-ok">✔ sí</span>' : '<span class="status-bad">✖ no</span>'; }))];
    })(), { numCols: [1, 2, 3], compact: true });
    C.update(U.$('#sim-power'), Sim.powerSpec(r, (anim.t + 0.5) * DT));
    C.update(U.$('#sim-soc'), Sim.socSpec(r, (anim.t + 0.5) * DT));
    U.$('#t-kwp').textContent = p.kwp + ' kWp';
    U.$('#t-inv').textContent = p.invKw + ' kW · η ' + p.effInv + ' %';
    U.$('#t-bat').textContent = p.batKwh + ' kWh · ' + p.pBatKw + ' kW';
    U.$('#t-batres').textContent = 'reserva ' + Math.round(k.reserveSoc) + ' %';
    Sim.draw(anim.t, true);
  };

  Sim.setTime = function (t) {
    anim.t = U.clamp(t, 0, N - 1);
    var s = U.$('#ck-time'); if (s) s.value = Math.round(anim.t);
    Sim.draw(anim.t, true);
  };
  Sim.play = function () {
    if (anim.playing) return;
    anim.playing = true; anim.last = performance.now();
    if (anim.t >= N - 1) anim.t = 0;
    var step = function (now) {
      if (!anim.playing || !U.$('#page-simulacion.active')) { anim.playing = false; var b = U.$('#ck-play'); if (b) b.textContent = '▶'; return; }
      var dt = Math.min(0.1, (now - anim.last) / 1000); anim.last = now;
      anim.t += dt * anim.speed;
      if (anim.t >= N - 1) { anim.t = N - 1; anim.playing = false; var b2 = U.$('#ck-play'); if (b2) b2.textContent = '▶'; }
      var s = U.$('#ck-time'); if (s) s.value = Math.round(anim.t);
      Sim.draw(anim.t, false, dt);
      anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  };

  /* Movimiento de partículas a lo largo de los conductores */
  function flowUpdate(id, power, color, dir, ref, dt) {
    var path = U.$('#fl-' + id), g = U.$('#pt-' + id);
    if (!path || !g) return;
    var mag = Math.abs(power), on = mag > 0.02;
    var w = on ? 1.5 + 4.5 * Math.min(1, mag / Math.max(1, ref)) : 0;
    path.setAttribute('stroke', color); path.setAttribute('stroke-width', w); path.style.opacity = on ? 1 : 0;
    var L = anim.pathLen[id] || (anim.pathLen[id] = path.getTotalLength());
    var sp = (on ? 25 + 90 * Math.min(1, mag / Math.max(1, ref)) : 0) * dir;
    anim.off[id] = ((anim.off[id] || 0) + sp * (dt || 0)) % L;
    path.style.strokeDashoffset = -anim.off[id];
    var nP = on ? 3 : 0, html = '';
    for (var k = 0; k < nP; k++) {
      var pos = ((anim.off[id] + k * L / nP) % L + L) % L, pt = path.getPointAtLength(pos);
      html += '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' + (2.5 + w / 2).toFixed(1) + '" fill="' + color + '" filter="url(#glow)"/>';
    }
    g.innerHTML = html;
  }
  function setTxt(id, t) { var e = U.$('#' + id); if (e) e.textContent = t; }
  function setAttr(id, a, v) { var e = U.$('#' + id); if (e) e.setAttribute(a, v); }

  Sim.draw = function (t, force, dt) {
    if (!run || !U.$('#page-simulacion.active')) return;
    var s = run.series, k = run.kpi, p = run.params, i = Math.min(N - 2, Math.floor(t)), f = Math.min(1, t - i);
    var lerp = function (arr) { return arr[i] + (arr[i + 1] - arr[i]) * f; };
    var pv = lerp(s.pv), pvA = lerp(s.pvAvail), load = lerp(s.load), bat = lerp(s.bat), bk = lerp(s.backup) + lerp(s.unserved), cur = lerp(s.curtail), soc = lerp(s.soc);
    var minute = START_H * 60 + t * STEP_MIN, hourAbs = minute / 60;
    /* reloj */
    setTxt('hud-time', Sim.hhmm(t));
    setTxt('hud-date', U.fmtDate(p.date + (minute >= 1440 ? U.DAY : 0)) + ' · ' + (k.sunrise >= 0 ? 'sol ' + Sim.hhmm(k.sunrise) + '–' + Sim.hhmm(k.sunset + 1) : 'sin sol'));
    /* cielo */
    var sr = k.sunrise, ss = k.sunset + 1, dayFrac = sr >= 0 && t >= sr && t <= ss ? (t - sr) / Math.max(1, ss - sr) : -1;
    var elev = dayFrac >= 0 ? Math.sin(Math.PI * dayFrac) : 0;
    var twilight = sr >= 0 ? Math.max(0, 1 - Math.min(Math.abs(t - sr), Math.abs(t - ss)) / 12) : 0;
    var cloudy = U.clamp((-p.irrPct) / 70 + p.variability / 250, 0, 1);
    var dayTop = mix('#2c78c8', '#5d7187', cloudy), dayBot = mix('#8fcaf2', '#9aa8b6', cloudy);
    var top = mix('#060d1c', dayTop, elev), bot = mix('#0f213a', dayBot, elev);
    if (twilight > 0) bot = mix(bot, '#f08a4b', twilight * 0.6);
    setAttr('sky0', 'stop-color', top); setAttr('sky1', 'stop-color', bot);
    setAttr('moonmask', 'fill', top);
    var st = U.$('#stars'); if (st) st.style.opacity = String(Math.max(0, 1 - elev * 3) * 0.9);
    var mn = U.$('#moon'); if (mn) mn.style.opacity = dayFrac < 0 ? '1' : '0';
    var arc = U.$('#sunarc'), sun = U.$('#sun');
    if (arc && sun) {
      if (dayFrac >= 0) { var L = anim.pathLen.arc || (anim.pathLen.arc = arc.getTotalLength()), pt = arc.getPointAtLength(dayFrac * L); sun.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')'); sun.style.opacity = String(0.35 + 0.65 * Math.min(1, pvA / Math.max(0.1, p.kwp * 0.6) + 0.2)); }
      else sun.style.opacity = '0';
    }
    ['cl1', 'cl2', 'cl3'].forEach(function (id, j) {
      var c = U.$('#' + id); if (!c) return;
      var x = ((j * 330 + hourAbs * (18 + j * 7)) % 1100) - 120, y = [70, 40, 95][j], sc = [1.1, 0.8, 1.25][j];
      c.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y + ') scale(' + sc + ')');
      c.style.opacity = String(Math.min(0.92, 0.12 + cloudy * 0.9) * (0.35 + 0.65 * Math.max(elev, 0.25)));
    });
    /* FV */
    var pvg = U.$('#pvglow'); if (pvg) pvg.style.opacity = String(Math.min(0.55, pvA / Math.max(0.1, p.kwp) * 0.7));
    var cb = U.$('#clipbadge'); if (cb) cb.style.opacity = cur > 0.05 ? '1' : '0';
    /* flujos */
    var ref = Math.max(p.kwp, p.invKw, 1);
    flowUpdate('pv', pv, COL.pv, 1, ref, dt);
    flowUpdate('load', Math.max(0, load - bk), COL.load, 1, ref, dt);
    flowUpdate('bat', bat, bat >= 0 ? COL.chg : COL.dis, bat >= 0 ? 1 : -1, ref, dt);
    flowUpdate('bk', bk, s.unserved[i] > 0.01 ? COL.unserved : COL.backup, 1, ref, dt);
    setTxt('v-pv', pv > 0.02 ? U.fmt(pv, 1) + ' kW' : ''); setTxt('v-load', U.fmt(Math.max(0, load - bk), 1) + ' kW');
    setTxt('v-bat', Math.abs(bat) > 0.02 ? (bat > 0 ? '▼ ' : '▲ ') + U.fmt(Math.abs(bat), 1) + ' kW' : ''); setTxt('v-bk', bk > 0.02 ? U.fmt(bk, 1) + ' kW' : '');
    /* batería */
    var fillH = 96 * U.clamp(soc, 0, 100) / 100;
    setAttr('batfill', 'y', (540 - fillH).toFixed(1)); setAttr('batfill', 'height', fillH.toFixed(1));
    var cA = soc <= p.socMin + 2 ? '#ff4d6d' : soc < k.reserveSoc ? '#f5b83d' : '#1fb58f', cB = soc <= p.socMin + 2 ? '#ff8fa3' : soc < k.reserveSoc ? '#ffd98a' : '#5ff0c8';
    setAttr('bat0', 'stop-color', cA); setAttr('bat1', 'stop-color', cB);
    var yRes = 540 - 96 * k.reserveSoc / 100, yMin = 540 - 96 * p.socMin / 100;
    setAttr('batres', 'y1', yRes); setAttr('batres', 'y2', yRes); setAttr('batmin', 'y1', yMin); setAttr('batmin', 'y2', yMin);
    setTxt('t-soc', U.fmt(soc, 0) + ' %');
    /* inversor, casa, generador */
    setAttr('invled', 'fill', pv > 0.05 || bat < -0.05 ? '#2ad4b0' : '#3b4656');
    var wv = U.$('#invwave'); if (wv) wv.style.opacity = pv > 0.05 || bat < -0.05 ? '1' : '.25';
    var night = dayFrac < 0 || elev < 0.12;
    U.$$('#house .win').forEach(function (w, j) { w.setAttribute('fill', night && (j + Math.floor(t / 6)) % 5 !== 0 ? '#ffd58a' : '#1b3350'); });
    setTxt('t-load', U.fmt(load, 1) + ' kW');
    var fan = U.$('#fan');
    if (fan) { anim.fanA = ((anim.fanA || 0) + (bk > 0.02 ? 900 : 0) * (dt || 0)) % 360; fan.setAttribute('transform', 'translate(780,477) rotate(' + anim.fanA.toFixed(1) + ')'); }
    setAttr('genled', 'fill', bk > 0.02 ? (s.unserved[i] > 0.01 ? '#ff4d6d' : '#ff7a59') : '#3b4656');
    setTxt('t-bk', bk > 0.02 ? (s.unserved[i] > 0.01 ? 'DÉFICIT ' : 'en marcha ') + U.fmt(bk, 1) + ' kW' : 'en espera');
    /* HUD */
    var ring = U.$('#ring'), circ = 2 * Math.PI * 50;
    if (ring) { ring.setAttribute('stroke-dasharray', (circ * soc / 100).toFixed(1) + ' ' + circ.toFixed(1)); ring.setAttribute('stroke', cA); }
    var rr = U.$('#ring-res'); if (rr) rr.setAttribute('transform', 'rotate(' + (360 * k.reserveSoc / 100).toFixed(1) + ' 60 60)');
    setTxt('hud-soc', U.fmt(soc, 0) + ' %');
    var mx = Math.max(p.kwp, p.invKw, 1);
    [['pv', pv, COL.pv], ['load', load, COL.load], ['bat', bat, bat >= 0 ? COL.chg : COL.dis], ['bk', bk, COL.backup], ['cur', cur, COL.curtail]].forEach(function (m) {
      setTxt('hm-' + m[0], (m[0] === 'bat' && Math.abs(m[1]) > 0.02 ? (m[1] > 0 ? '+' : '−') : '') + U.fmt(Math.abs(m[1]), 1) + ' kW');
      var b = U.$('#hb-' + m[0]); if (b) { b.style.width = (100 * Math.min(1, Math.abs(m[1]) / mx)).toFixed(1) + '%'; b.style.background = m[2]; }
    });
    var status = [];
    if (pv > 0.05) status.push(['☀ Generando', 'pv']);
    if (bat > 0.05) status.push(['🔋 Cargando', 'chg']); else if (bat < -0.05) status.push(['🔋 Descargando', 'dis']);
    if (p.strategy !== 'autoconsumo' && dayFrac >= 0 && bat >= -0.05 && load > pv + 0.05 && bk > 0.02) status.push(['🛡 Reserva protegida', 'res']);
    if (s.unserved[i] > 0.01) status.push(['⚠ Energía no servida', 'uns']); else if (bk > 0.02) status.push(['⛽ Respaldo activo', 'bk']);
    if (cur > 0.05) status.push(['✂ Recorte FV', 'cur']);
    if (!status.length) status.push(['🌙 Operación nocturna', 'night']);
    var hs = U.$('#hud-status'); if (hs) hs.innerHTML = status.map(function (x) { return '<span class="st st-' + x[1] + '">' + x[0] + '</span>'; }).join('');
    /* cursor en gráficos (limitado a ~8 fps) */
    var now = performance.now();
    if (force || now - anim.lastChart > 120) {
      anim.lastChart = now;
      var e1 = U.$('#sim-power'), e2 = U.$('#sim-soc');
      if (e1) C.update(e1, Sim.powerSpec(run, (t + 0.5) * DT));
      if (e2) C.update(e2, Sim.socSpec(run, (t + 0.5) * DT));
    }
  };

  /* Consumo histórico real del día (06:00 → 06:00), si existe la variable de carga */
  Sim.histLoadTotal = function (date) {
    var pr = SEDA.state.processed; if (!pr || !pr.vars.CARGA) return null;
    var t0 = date + START_H * U.HOUR, t1 = t0 + U.DAY, s = 0, n = 0;
    for (var i = 0; i < pr.n; i++) if (pr.t[i] >= t0 && pr.t[i] < t1 && isFinite(pr.vars.CARGA[i])) { s += pr.vars.CARGA[i] * pr.dtH; n++; }
    return n >= 20 ? s * 24 / (n * pr.dtH) : null;
  };

  /* Resumen para el informe y el asistente */
  Sim.ensure = function () {
    var S = SEDA.state;
    if (!S.simParams) S.simParams = Sim.defaults();
    if (!run) Sim.recompute();
    return run;
  };
})();
