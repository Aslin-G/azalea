/* ==========================================================================
   designer.js — DISEÑADOR DEL SISTEMA FV (SEDA.Design).
   - Catálogo editable de módulos, inversores y baterías (valores típicos de
     ficha técnica por tecnología; precios referenciales en COP, sin IVA).
   - Recurso del sitio: NASA POWER horario (año tipo) › NASA diario/mensual/
     climatología (días medios sintéticos) › datos cargados › estimación.
   - Modelo horario de 8 760 h: transposición Hay–Davies, IAM, temperatura
     de celda NOCT+viento, coeficientes térmicos, pérdidas, inversor con
     curva de eficiencia y recorte, despacho con batería y red/respaldo.
   - Dimensionamiento: kWp por energía (anual o mes crítico), cadenas por
     ventana MPPT con Voc a Tmín y Vmp a Tmáx, corrientes por MPPT, número de
     inversores, banco de baterías por autonomía, DoD y corrientes.
   - Optimizador: evalúa todas las combinaciones compatibles y las ordena
     por LCOE, energía específica, CAPEX, fracción solar o área.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, Store = SEDA.Store, Sol = SEDA.Solar, N = SEDA.Nasa;
  var Dz = SEDA.Design = {};
  var RAD = Math.PI / 180;

  /* ---------------- Catálogo base (genérico, valores típicos 2026) ---------------- */
  Dz.CATALOG = {
    panels: [
      { id: 'pv-topcon-580', name: 'TOPCon tipo N bifacial 580 W', tech: 'TOPCon N bifacial (vidrio-vidrio)', pmax: 580, voc: 51.9, vmp: 43.1, isc: 14.2, imp: 13.46, eff: 22.5, gP: -0.29, bV: -0.25, aI: 0.045, noct: 43, L: 2278, W: 1134, kg: 32, cells: '144 medias celdas', bif: 0.8, maxFuse: 30, vSys: 1500, degr1: 1.0, degrY: 0.4, warr: '12 / 30 años', price: 520000 },
      { id: 'pv-topcon-620', name: 'TOPCon tipo N 620 W (formato grande)', tech: 'TOPCon N bifacial', pmax: 620, voc: 55.6, vmp: 46.2, isc: 14.25, imp: 13.42, eff: 23.0, gP: -0.29, bV: -0.25, aI: 0.045, noct: 43, L: 2382, W: 1134, kg: 33.5, cells: '156 medias celdas', bif: 0.8, maxFuse: 30, vSys: 1500, degr1: 1.0, degrY: 0.4, warr: '12 / 30 años', price: 560000 },
      { id: 'pv-hjt-700', name: 'Heterounión (HJT) 700 W', tech: 'HJT bifacial', pmax: 700, voc: 49.4, vmp: 41.4, isc: 17.9, imp: 16.91, eff: 22.5, gP: -0.24, bV: -0.24, aI: 0.04, noct: 42, L: 2384, W: 1303, kg: 38, cells: '132 medias celdas 210 mm', bif: 0.85, maxFuse: 35, vSys: 1500, degr1: 1.0, degrY: 0.3, warr: '15 / 30 años', price: 700000 },
      { id: 'pv-bc-450', name: 'Contacto posterior (BC) 450 W residencial', tech: 'Back-contact monofacial', pmax: 450, voc: 40.3, vmp: 34.0, isc: 14.0, imp: 13.24, eff: 22.5, gP: -0.26, bV: -0.24, aI: 0.05, noct: 43, L: 1762, W: 1134, kg: 21, cells: '108 medias celdas', bif: 0, maxFuse: 25, vSys: 1500, degr1: 1.0, degrY: 0.35, warr: '15 / 30 años', price: 520000 },
      { id: 'pv-perc-550', name: 'Monocristalino PERC 550 W', tech: 'PERC tipo P monofacial', pmax: 550, voc: 49.8, vmp: 41.9, isc: 14.0, imp: 13.13, eff: 21.3, gP: -0.35, bV: -0.27, aI: 0.048, noct: 45, L: 2278, W: 1134, kg: 27.5, cells: '144 medias celdas', bif: 0, maxFuse: 25, vSys: 1500, degr1: 2.0, degrY: 0.55, warr: '12 / 25 años', price: 450000 },
      { id: 'pv-poly-330', name: 'Policristalino 330 W (tecnología heredada)', tech: 'Poli-Si BSF', pmax: 330, voc: 46.2, vmp: 37.6, isc: 9.25, imp: 8.78, eff: 17.0, gP: -0.40, bV: -0.30, aI: 0.06, noct: 45, L: 1956, W: 992, kg: 22, cells: '72 celdas', bif: 0, maxFuse: 15, vSys: 1000, degr1: 2.5, degrY: 0.7, warr: '10 / 25 años', price: 280000 },
      { id: 'pv-cdte-470', name: 'Película delgada CdTe 470 W', tech: 'Película delgada CdTe', pmax: 470, voc: 219.8, vmp: 180.2, isc: 2.74, imp: 2.61, eff: 19.0, gP: -0.28, bV: -0.28, aI: 0.04, noct: 45, L: 2009, W: 1232, kg: 36, cells: 'monolítico', bif: 0, maxFuse: 5, vSys: 1500, degr1: 1.0, degrY: 0.3, warr: '12 / 30 años', price: 430000 },
      { id: 'pv-mono-200', name: 'Monocristalino 200 W (12 V, pequeños sistemas)', tech: 'Mono-Si 36 celdas', pmax: 200, voc: 24.5, vmp: 20.4, isc: 10.4, imp: 9.8, eff: 19.9, gP: -0.38, bV: -0.29, aI: 0.05, noct: 45, L: 1480, W: 680, kg: 11.5, cells: '36 celdas', bif: 0, maxFuse: 15, vSys: 1000, degr1: 2.0, degrY: 0.6, warr: '10 / 25 años', price: 260000 }
    ],
    inverters: [
      { id: 'inv-on-5k', name: 'On-grid string monofásico 5 kW', type: 'ongrid', phases: 1, vAc: 240, acLabel: '240 V (2F) / 220 V', pac: 5000, pdcMax: 7500, vdcMax: 600, mpptMin: 80, mpptMax: 550, vStart: 100, nMppt: 2, imax: 16, iscMax: 20, effMax: 97.8, effEuro: 97.2, kg: 11, dcSwitch: true, price: 3800000 },
      { id: 'inv-on-10k', name: 'On-grid string trifásico 10 kW', type: 'ongrid', phases: 3, vAc: 220, acLabel: '3F 220/127 V', pac: 10000, pdcMax: 15000, vdcMax: 1100, mpptMin: 140, mpptMax: 1000, vStart: 180, nMppt: 2, imax: 20, iscMax: 30, effMax: 98.5, effEuro: 98.0, kg: 17, dcSwitch: true, price: 6500000 },
      { id: 'inv-on-20k', name: 'On-grid string trifásico 20 kW', type: 'ongrid', phases: 3, vAc: 220, acLabel: '3F 220/127 V', pac: 20000, pdcMax: 30000, vdcMax: 1100, mpptMin: 200, mpptMax: 1000, vStart: 250, nMppt: 2, imax: 32, iscMax: 40, effMax: 98.6, effEuro: 98.2, kg: 22, dcSwitch: true, price: 10500000 },
      { id: 'inv-on-50k', name: 'On-grid string trifásico 50 kW', type: 'ongrid', phases: 3, vAc: 440, acLabel: '3F 440/254 V', pac: 50000, pdcMax: 75000, vdcMax: 1100, mpptMin: 200, mpptMax: 1000, vStart: 250, nMppt: 4, imax: 32, iscMax: 40, effMax: 98.7, effEuro: 98.4, kg: 55, dcSwitch: true, price: 22000000 },
      { id: 'inv-hyb-6k', name: 'Híbrido monofásico 6 kW (batería 48 V)', type: 'hibrido', phases: 1, vAc: 240, acLabel: '240 V (2F) / 220 V', pac: 6000, pdcMax: 7800, vdcMax: 500, mpptMin: 125, mpptMax: 425, vStart: 150, nMppt: 2, imax: 13, iscMax: 17, effMax: 97.6, effEuro: 96.5, batV: 48, batIChg: 135, batIDis: 135, kg: 20, dcSwitch: true, price: 7800000 },
      { id: 'inv-hyb-8k', name: 'Híbrido monofásico 8 kW (batería 48 V, entradas 22 A)', type: 'hibrido', phases: 1, vAc: 240, acLabel: '240 V (2F) / 220 V', pac: 8000, pdcMax: 10400, vdcMax: 500, mpptMin: 125, mpptMax: 425, vStart: 150, nMppt: 2, imax: 22, iscMax: 28, effMax: 97.6, effEuro: 96.8, batV: 48, batIChg: 190, batIDis: 190, kg: 24, dcSwitch: true, price: 9200000 },
      { id: 'inv-hyb-12k', name: 'Híbrido trifásico 12 kW (batería 48 V)', type: 'hibrido', phases: 3, vAc: 220, acLabel: '3F 220/127 V', pac: 12000, pdcMax: 15600, vdcMax: 800, mpptMin: 200, mpptMax: 650, vStart: 160, nMppt: 2, imax: 26, iscMax: 34, effMax: 97.6, effEuro: 97.0, batV: 48, batIChg: 240, batIDis: 240, kg: 34, dcSwitch: true, price: 12160000 },
      { id: 'inv-off-8k', name: 'Inversor-cargador aislado 8 kW con MPPT (48 V)', type: 'aislado', phases: 1, vAc: 240, acLabel: '1F 120/240 V', pac: 8000, pdcMax: 8000, vdcMax: 500, mpptMin: 120, mpptMax: 450, vStart: 150, nMppt: 1, imax: 27, iscMax: 30, effMax: 93.5, effEuro: 92.0, batV: 48, batIChg: 150, batIDis: 170, kg: 18, dcSwitch: false, price: 6400000 },
      { id: 'inv-micro-2k', name: 'Microinversor 4 entradas 2 kW', type: 'micro', phases: 1, vAc: 240, acLabel: '240 V (2F)', pac: 2000, pdcMax: 2680, vdcMax: 60, mpptMin: 16, mpptMax: 60, vStart: 20, nMppt: 4, imax: 18, iscMax: 25, effMax: 96.7, effEuro: 96.5, kg: 4, dcSwitch: false, price: 2600000 }
    ],
    batteries: [
      { id: 'bat-lfp-5', name: 'LiFePO₄ 51.2 V 100 Ah (rack 5.12 kWh)', chem: 'LFP', vNom: 51.2, ah: 100, kwh: 5.12, dod: 90, eff: 95, cycles: 6000, iMax: 100, life: 15, kg: 45, price: 4100000 },
      { id: 'bat-lfp-10', name: 'LiFePO₄ 51.2 V 200 Ah (mural 10.24 kWh)', chem: 'LFP', vNom: 51.2, ah: 200, kwh: 10.24, dod: 90, eff: 95, cycles: 6000, iMax: 160, life: 15, kg: 90, price: 6950000 },
      { id: 'bat-lfp-16', name: 'LiFePO₄ 51.2 V 314 Ah (16 kWh)', chem: 'LFP', vNom: 51.2, ah: 314, kwh: 16.08, dod: 90, eff: 95, cycles: 6000, iMax: 200, life: 15, kg: 125, price: 10400000 },
      { id: 'bat-agm-200', name: 'AGM 12 V 200 Ah (2.4 kWh)', chem: 'AGM', vNom: 12, ah: 200, kwh: 2.4, dod: 50, eff: 85, cycles: 600, iMax: 40, life: 5, kg: 58, price: 1350000 },
      { id: 'bat-gel-200', name: 'Gel 12 V 200 Ah (2.4 kWh)', chem: 'GEL', vNom: 12, ah: 200, kwh: 2.4, dod: 50, eff: 85, cycles: 1200, iMax: 40, life: 8, kg: 62, price: 1650000 },
      { id: 'bat-opzv-800', name: 'OPzV tubular gel 2 V 800 Ah (1.6 kWh)', chem: 'OPzV', vNom: 2, ah: 800, kwh: 1.6, dod: 60, eff: 85, cycles: 3000, iMax: 160, life: 15, kg: 58, price: 2200000 }
    ]
  };
  Dz.TYPES = { ongrid: 'On-grid', hibrido: 'Híbrido', aislado: 'Aislado', micro: 'Microinversor' };
  Dz.SYS = {
    ongrid: { label: 'Conectado a la red (sin baterías)', ico: '🔌', inv: ['ongrid', 'micro', 'hibrido'], bat: false },
    hibrido: { label: 'Híbrido (red + baterías)', ico: '🔋', inv: ['hibrido'], bat: true },
    aislado: { label: 'Aislado / autónomo (off-grid)', ico: '🏜', inv: ['aislado', 'hibrido'], bat: true }
  };
  Dz.OBJECTIVES = { lcoe: 'Mínimo LCOE (costo nivelado)', yield: 'Máxima energía específica (kWh/kWp)', fraction: 'Máxima fracción solar', capex: 'Mínima inversión (CAPEX)', area: 'Mínima área ocupada' };

  /* ---------------- Proyecto (persistente en este navegador) ---------------- */
  Dz.defaultInputs = function () {
    var S = SEDA.state || {}, di = S.decisionInputs || {}, sys = SEDA.App ? SEDA.App.system() : {};
    var night = +di.nightLoad || 35, day = +di.dayLoad || 30;
    return {
      sysType: 'hibrido', dailyKwh: Math.round((night + day) * 10) / 10, nightKwh: night, peakKw: 8,
      coverage: 100, criterion: 'anual', margin: 10, autonomyDays: 1, kwpTarget: '',
      tilt: '', azimuth: 0, mount: 'techo', albedo: '',
      losses: { soiling: 3, mismatch: 2, lid: 1.5, shading: 0, acWiring: 1, availability: 1 },
      dcAcMax: 1.3, tMin: '', tMax: '', lenDC: 25, lenBat: 3, lenAC: 20, areaMax: '',
      objective: 'lcoe', panel: 'pv-topcon-580', inverter: 'inv-hyb-12k', battery: 'bat-lfp-10', auto: true,
      socMin: +di.socMin || 20
    };
  };
  Dz.defaultEcon = function () { return { tariff: 950, exportRatio: 60, altCost: 2200, omPct: 1.0, rate: 10, years: 25, escal: 3, invRepl: 12 }; };
  var PKEY = 'seda-project';
  Dz.project = function () {
    if (Dz._p) return Dz._p;
    var p = Store.lsGet(PKEY, null) || {};
    var sys = SEDA.App ? SEDA.App.system() : {};
    p.site = p.site || { lat: +sys.lat || 11.54, lon: +sys.lon || -72.91, place: sys.place || 'La Guajira, Colombia', country: 'Colombia', a2: 'CO', elev: NaN, utcOffset: -5, source: 'sistema' };
    p.nasa = p.nasa || { query: N.defaultQuery(), key: null };
    p.inputs = Object.assign(Dz.defaultInputs(), p.inputs || {});
    p.inputs.losses = Object.assign(Dz.defaultInputs().losses, (p.inputs && p.inputs.losses) || {});
    p.catalog = p.catalog || { custom: { panels: [], inverters: [], batteries: [] }, overrides: {} };
    p.costs = p.costs || { overrides: {}, custom: [], params: {} };
    p.econ = Object.assign(Dz.defaultEcon(), p.econ || {});
    Dz._p = p;
    return p;
  };
  Dz.save = U.debounce(function () { if (Dz._p) Store.lsSet(PKEY, Dz._p); }, 250);
  Dz.saveNow = function () { if (Dz._p) Store.lsSet(PKEY, Dz._p); };
  Dz.reset = function () { Dz._p = null; Dz._ds = null; Dz._dsKey = null; Dz._cache = {}; try { localStorage.removeItem(PKEY); } catch (e) { /* sin acción */ } };
  Dz._cache = {};
  Dz.invalidate = function () { Dz._cache = {}; };

  /* Catálogo efectivo (base + personalizados + precios editados) */
  Dz.catalog = function () {
    var p = Dz.project(), ov = p.catalog.overrides || {}, out = {};
    ['panels', 'inverters', 'batteries'].forEach(function (k) {
      out[k] = Dz.CATALOG[k].concat(p.catalog.custom[k] || []).map(function (it) { return Object.assign({}, it, ov[it.id] || {}); });
    });
    return out;
  };
  Dz.find = function (kind, id) { var c = Dz.catalog()[kind]; for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i]; return null; };

  /* ---------------- Recurso solar del sitio ---------------- */
  Dz.ready = async function () {
    var p = Dz.project();
    if (p.nasa.key && Dz._dsKey !== p.nasa.key) {
      try { Dz._ds = N.unpack(await N.getCached(p.nasa.key)); } catch (e) { Dz._ds = null; }
      Dz._dsKey = p.nasa.key;
      Dz.invalidate();
    }
    return Dz._ds;
  };
  Dz.setDataset = function (ds, key) { Dz._ds = ds; Dz._dsKey = key; var p = Dz.project(); p.nasa.key = key; p.nasa.at = Date.now(); Dz.invalidate(); Dz.save(); };
  Dz.dataset = function () { return Dz._ds; };

  Dz.resource = function () {
    if (Dz._cache.res) return Dz._cache.res;
    var p = Dz.project(), site = p.site, ds = Dz._ds, S = SEDA.state || {};
    var res = { lat: +site.lat, lon: +site.lon, off: isFinite(+site.utcOffset) ? +site.utcOffset : Math.round(site.lon / 15), albedo: 0.2 };
    var near = ds && Math.abs(ds.lat - res.lat) < 0.3 && Math.abs(ds.lon - res.lon) < 0.3;
    if (ds && near) {
      var sm = N.summary(ds);
      if (sm.ghi) {
        res.summary = sm; res.ghiM = sm.ghi; res.dhiM = sm.dhi; res.tM = sm.t2m; res.wsM = sm.ws; res.albedo = sm.albedo || 0.2;
        res.tMin = sm.tMinAbs; res.tMax = sm.tMaxAbs; res.elev = ds.elev;
        res.tRangeM = sm.tmax && sm.tmin ? sm.tmax.map(function (v, i) { return ds.level === 'hourly' || ds.level === 'daily' ? NaN : v - sm.tmin[i]; }) : null;
        var hy = N.hourlyYear(ds);
        if (hy) { res.kind = 'nasa-h'; res.hourly = hy; res.label = 'NASA POWER horario (año ' + hy.year + ')'; }
        else { res.kind = 'nasa-m'; res.label = 'NASA POWER ' + N.LEVELS[ds.level].label.toLowerCase() + ' (días medios sintéticos)'; }
      }
    }
    if (!res.kind && S.processed && S.processed.vars.IRRADIANCIA && S.processed.dtH <= 1.01) {
      /* datos cargados en el análisis (si son del mismo sitio del sistema) */
      var pr = S.processed, irr = pr.vars.IRRADIANCIA, tt = pr.vars.TEMPERATURA, sums = new Array(12).fill(0), cnt = new Array(12).fill(0), dsum = {}, dn = {}, tS = new Array(12).fill(0), tN = new Array(12).fill(0), tmn = Infinity, tmx = -Infinity;
      for (var i = 0; i < pr.n; i++) {
        var d = Math.floor(pr.t[i] / U.DAY);
        if (isFinite(irr[i])) { dsum[d] = (dsum[d] || 0) + irr[i] * pr.dtH; dn[d] = (dn[d] || 0) + 1; }
        if (tt && isFinite(tt[i])) { var mm = U.monthOf(pr.t[i]) - 1; tS[mm] += tt[i]; tN[mm]++; tmn = Math.min(tmn, tt[i]); tmx = Math.max(tmx, tt[i]); }
      }
      Object.keys(dsum).forEach(function (d) { if (dn[d] < 20 / pr.dtH * 0.9) return; var m = new Date(d * U.DAY).getUTCMonth(); sums[m] += dsum[d] / 1000; cnt[m]++; });
      if (cnt.filter(Boolean).length >= 10) {
        res.kind = 'datos'; res.label = 'Datos cargados en el análisis (' + (S.source ? S.source.fileName : '') + ')';
        res.ghiM = sums.map(function (s, m) { return cnt[m] ? s / cnt[m] : NaN; });
        var avg = U.mean(res.ghiM.filter(isFinite)); res.ghiM = res.ghiM.map(function (v) { return isFinite(v) ? v : avg; });
        res.tM = tN.some(Boolean) ? tS.map(function (s, m) { return tN[m] ? s / tN[m] : NaN; }) : null;
        if (isFinite(tmn)) { res.tMin = tmn; res.tMax = tmx; }
      }
    }
    if (!res.kind) {
      res.kind = 'estimado'; res.label = 'Estimación sin datos del sitio (cielo claro × Kt 0.55) — consulte NASA POWER';
      res.ghiM = Sol.fallbackGHI(res.lat, 0.55);
    }
    if (!res.tM || !res.tM.some(isFinite)) res.tM = new Array(12).fill(Math.abs(res.lat) < 23 ? 27 : 15);
    res.tM = res.tM.map(function (v) { return isFinite(v) ? v : 25; });
    if (!isFinite(res.tMin)) res.tMin = Math.min.apply(null, res.tM) - 8;
    if (!isFinite(res.tMax)) res.tMax = Math.max.apply(null, res.tM) + 8;
    if (!res.wsM || !res.wsM.some(isFinite)) res.wsM = new Array(12).fill(2.5);
    res.ghiYear = Sol.annual(res.ghiM);
    res.opt = Sol.optimalTilt(res.lat, res.ghiM, 0, res.albedo, res.dhiM);
    Dz._cache.res = res;
    return res;
  };

  /* Meteorología de 8 760 h (horaria real o sintetizada con días medios mensuales) */
  Dz.weather = function (res) {
    if (Dz._cache.wx) return Dz._cache.wx;
    var n = 8760, w = { ghi: new Float32Array(n), dni: null, dhi: null, tamb: new Float32Array(n), ws: new Float32Array(n), doy: new Uint16Array(n), hour: new Float32Array(n), month: new Uint8Array(n) };
    var t0 = Date.UTC(2025, 0, 1);
    for (var h = 0; h < n; h++) { var d = new Date(t0 + h * U.HOUR); w.doy[h] = Math.floor(h / 24) + 1; w.hour[h] = d.getUTCHours(); w.month[h] = d.getUTCMonth(); }
    if (res.hourly) {
      var hy = res.hourly;
      w.dni = hy.dni ? new Float32Array(n) : null; w.dhi = hy.dhi ? new Float32Array(n) : null;
      for (var i = 0; i < n; i++) {
        w.ghi[i] = Math.max(0, hy.ghi[i] || 0); w.tamb[i] = isFinite(hy.tamb[i]) ? hy.tamb[i] : res.tM[w.month[i]]; w.ws[i] = isFinite(hy.ws[i]) ? hy.ws[i] : res.wsM[w.month[i]];
        if (w.dni) w.dni[i] = Math.max(0, hy.dni[i] || 0); if (w.dhi) w.dhi[i] = Math.max(0, hy.dhi[i] || 0);
      }
    } else {
      w.dhi = new Float32Array(n);
      for (var m = 0; m < 12; m++) {
        var doyM = Sol.MONTH_DAYS[m], lat = res.lat, d0 = Sol.decl(doyM), ws = Sol.ws(lat * RAD, d0);
        var H = res.ghiM[m], KT = Math.min(0.85, H / Math.max(0.01, Sol.H0(lat, doyM)));
        var Hd = res.dhiM && res.dhiM[m] > 0 ? Math.min(H, res.dhiM[m]) : H * Sol.erbsMonthly(KT, ws);
        var day = Sol.synthDay(lat, doyM, H, Hd);
        var rng = res.tRangeM && isFinite(res.tRangeM[m]) ? res.tRangeM[m] : 8;
        for (var k = 0; k < n; k++) {
          if (w.month[k] !== m) continue;
          /* hora local → hora solar para ubicar el perfil sintético (definido en hora solar) */
          var hs = Sol.solarHour(w.hour[k] + 0.5, res.lon, res.off, w.doy[k]);
          var hi = Math.floor(((hs % 24) + 24) % 24), fr = ((hs % 24) + 24) % 24 - hi - 0.5;
          var a = day.ghi[hi], b = day.ghi[(hi + (fr >= 0 ? 1 : 23)) % 24], ad = day.dhi[hi], bd = day.dhi[(hi + (fr >= 0 ? 1 : 23)) % 24];
          var f = Math.abs(fr);
          w.ghi[k] = Math.max(0, a + (b - a) * f); w.dhi[k] = Math.max(0, Math.min(w.ghi[k], ad + (bd - ad) * f));
          w.tamb[k] = res.tM[m] + rng / 2 * Math.cos(2 * Math.PI * (w.hour[k] - 15) / 24);
          w.ws[k] = res.wsM[m];
        }
      }
    }
    Dz._cache.wx = w;
    return w;
  };

  /* Irradiancia en el plano del arreglo (8 760 h) */
  Dz.poa = function (res, w, tilt, azEq, albedo) {
    var key = 'poa:' + tilt + ':' + azEq + ':' + albedo;
    if (Dz._cache[key]) return Dz._cache[key];
    var n = 8760, out = { poa: new Float32Array(n), beam: new Float32Array(n), diff: new Float32Array(n), refl: new Float32Array(n), cosI: new Float32Array(n), cosZ: new Float32Array(n), sumPoa: 0, sumGhi: 0, monthPoa: new Array(12).fill(0) };
    var gam = Sol.surfAzDuffie(res.lat, azEq);
    for (var h = 0; h < n; h++) {
      var pos = Sol.pos(res.lat, res.lon, res.off, w.doy[h], w.hour[h] + 0.5);
      out.cosZ[h] = pos.cosZ;
      if (w.ghi[h] <= 0) continue;
      var r = Sol.poa({ ghi: w.ghi[h], dni: w.dni ? w.dni[h] : undefined, dhi: w.dhi ? w.dhi[h] : undefined, pos: pos, doy: w.doy[h], tilt: tilt, surfAz: gam, albedo: albedo });
      out.poa[h] = r.poa; out.beam[h] = r.beam; out.diff[h] = r.diff; out.refl[h] = r.refl; out.cosI[h] = r.cosI;
      out.sumPoa += r.poa; out.sumGhi += w.ghi[h]; out.monthPoa[w.month[h]] += r.poa / 1000;
    }
    out.poaYear = out.sumPoa / 1000; out.ghiYear = out.sumGhi / 1000;
    Dz._cache[key] = out;
    return out;
  };

  /* Potencia DC por kWp instalado (kW/kWp) para un módulo, antes de pérdidas de cableado DC */
  Dz.panelProfile = function (panel, w, P, inputs, res) {
    var key = 'pp:' + panel.id + ':' + panel.gP + ':' + panel.noct + ':' + P.poaYear.toFixed(3) + ':' + inputs.mount + ':' + inputs.albedoUsed + ':' + JSON.stringify(inputs.losses);
    if (Dz._cache[key]) return Dz._cache[key];
    var n = 8760, dc = new Float32Array(n), tc = new Float32Array(n), L = inputs.losses;
    var lossF = (1 - L.soiling / 100) * (1 - L.mismatch / 100) * (1 - L.lid / 100) * (1 - L.shading / 100);
    var rearF = panel.bif ? panel.bif * (inputs.mount === 'suelo' ? 0.30 : 0.08) : 0;
    var alb = +inputs.albedoUsed || 0.2, eff = panel.eff / 100, sum = 0, tMaxCell = -Infinity, month = new Array(12).fill(0), tempLoss = 0, tempRef = 0;
    for (var h = 0; h < n; h++) {
      var g = P.poa[h]; if (g <= 0) { tc[h] = w.tamb[h]; continue; }
      var geff = P.beam[h] * Sol.iam(P.cosI[h]) + P.diff[h] + P.refl[h] + rearF * w.ghi[h] * alb;
      var t = Sol.tCell(w.tamb[h], g, panel.noct, w.ws[h], eff);
      tc[h] = t; if (t > tMaxCell) tMaxCell = t;
      var fT = 1 + panel.gP / 100 * (t - 25);
      var p = Math.max(0, geff / 1000 * fT * lossF);
      dc[h] = p; sum += p; month[w.month[h]] += p;
      tempLoss += geff / 1000 * (1 - fT); tempRef += geff / 1000;
    }
    var out = { dc: dc, tc: tc, sum: sum, month: month, tMaxCell: tMaxCell, tempLossPct: tempRef > 0 ? tempLoss / tempRef * 100 : 0, lossF: lossF };
    Dz._cache[key] = out;
    return out;
  };

  /* Perfil de carga horario (kW) de 8 760 h: forma diaria del análisis (o típica) escalada a consumo diurno/nocturno */
  Dz.loadProfile = function (inputs, res, w, P) {
    var key = 'load:' + inputs.dailyKwh + ':' + inputs.nightKwh;
    if (Dz._cache[key]) return Dz._cache[key];
    var n = 8760, out = new Float32Array(n), dayK = Math.max(0, inputs.dailyKwh - inputs.nightKwh), nightK = Math.max(0, Math.min(inputs.dailyKwh, inputs.nightKwh));
    for (var m = 0; m < 12; m++) {
      var shape = SEDA.Sim ? SEDA.Sim.loadShape(m + 1).shape : null;
      if (!shape) shape = [2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.8, 3.3, 3.3, 3.3, 3.3, 3.3, 3.6, 3.6, 3.6, 3.6, 3.6, 3.4, 3.9, 4.3, 4.3, 4.3, 3.0, 3.0];
      var st = Sol.sunTimes(res.lat, res.lon, res.off, Sol.MONTH_DAYS[m]);
      var isDay = shape.map(function (_, h) { return h + 0.5 > st.rise && h + 0.5 < st.set; });
      var sd = 0, sn = 0; shape.forEach(function (v, h) { if (isDay[h]) sd += v; else sn += v; });
      var kd = sd > 0 ? dayK / sd : 0, kn = sn > 0 ? nightK / sn : 0;
      for (var h = 0; h < n; h++) if (w.month[h] === m) { var hh = w.hour[h]; out[h] = shape[hh] * (isDay[hh] ? kd : kn); }
    }
    var peak = 0; for (var i = 0; i < n; i++) peak = Math.max(peak, out[i]);
    out.peak = peak;
    Dz._cache[key] = out;
    return out;
  };

  /* ---------------- Dimensionamiento de una combinación ---------------- */
  function tempV(v, coefPct, t) { return v * (1 + coefPct / 100 * (t - 25)); }
  Dz.config = function (panel, inv, bat, inputs, res, ctx) {
    var sysT = inputs.sysType, S = Dz.SYS[sysT], why = [];
    if (S.inv.indexOf(inv.type) < 0) return { ok: false, reason: 'El inversor ' + Dz.TYPES[inv.type] + ' no corresponde a un sistema ' + S.label.toLowerCase() + '.' };
    if (S.bat && !bat) return { ok: false, reason: 'Se requiere banco de baterías.' };
    if (S.bat && !inv.batV) return { ok: false, reason: 'El inversor no admite baterías.' };
    var tMin = isFinite(+inputs.tMin) && inputs.tMin !== '' ? +inputs.tMin : res.tMin;
    var tMax = isFinite(+inputs.tMax) && inputs.tMax !== '' ? +inputs.tMax : res.tMax;
    var tCellMax = Math.max(ctx.pp.tMaxCell, tMax + (panel.noct - 20) * 1.25);
    var bVmp = panel.gP - panel.aI;
    var vocMax = tempV(panel.voc, panel.bV, tMin), vmpCold = tempV(panel.vmp, bVmp, tMin), vmpHot = tempV(panel.vmp, bVmp, tCellMax);
    var iscMax = panel.isc * (1 + panel.aI / 100 * (tCellMax - 25));
    /* energía requerida */
    var etaRt = bat ? bat.eff / 100 : 1;
    var need = inputs.dailyKwh * inputs.coverage / 100;
    var fDay = inputs.dailyKwh > 0 ? Math.max(0, inputs.dailyKwh - inputs.nightKwh) / inputs.dailyKwh : 0.5;
    var needPv = S.bat ? need * (fDay + (1 - fDay) / etaRt) : need;
    needPv *= 1 + (+inputs.margin || 0) / 100;
    var effInv = inv.effEuro / 100 * (1 - inputs.losses.acWiring / 100) * (1 - inputs.losses.availability / 100) * 0.985; /* 0.985 ≈ pérdidas en cableado DC */
    var specYear = ctx.pp.sum * effInv, specMonthDay = ctx.pp.month.map(function (e, m) { return e * effInv / Sol.DAYS_IN_MONTH[m]; });
    var kwpReq;
    if (+inputs.kwpTarget > 0) kwpReq = +inputs.kwpTarget;
    else if (inputs.criterion === 'critico') kwpReq = needPv / Math.max(0.2, Math.min.apply(null, specMonthDay));
    else kwpReq = needPv * 365 / Math.max(50, specYear);
    var areaMod = panel.L * panel.W / 1e6, areaF = inputs.mount === 'suelo' ? 1 / Math.max(0.25, ctx.gcr || 0.5) : 1.12;
    var capped = false;
    if (+inputs.areaMax > 0) {
      var maxMods = Math.floor(+inputs.areaMax / (areaMod * areaF));
      if (maxMods * panel.pmax / 1000 < kwpReq) { kwpReq = maxMods * panel.pmax / 1000; capped = true; }
    }
    var nMods = Math.max(1, Math.ceil(kwpReq * 1000 / panel.pmax));
    var cfg = { ok: true, panel: panel, inv: inv, bat: bat, sysType: sysT, tMin: tMin, tMax: tMax, tCellMax: tCellMax, vocMax: vocMax, vmpCold: vmpCold, vmpHot: vmpHot, iscMax: iscMax, kwpReq: kwpReq, needPv: needPv, capped: capped, warnings: [] };
    var peakKw = Math.max(+inputs.peakKw || 0, ctx.load.peak * 1.25);
    if (inv.type === 'micro') {
      if (vocMax > inv.vdcMax) return { ok: false, reason: 'Voc a Tmín (' + U.fmt(vocMax, 1) + ' V) supera la entrada del microinversor (' + inv.vdcMax + ' V).' };
      if (vmpHot < inv.mpptMin || vmpCold > inv.mpptMax) return { ok: false, reason: 'Vmp fuera de la ventana MPPT del microinversor.' };
      if (panel.isc * 1.25 > inv.iscMax) return { ok: false, reason: 'Isc del módulo supera la entrada del microinversor.' };
      if (panel.pmax > inv.pdcMax / inv.nMppt * 1.35) return { ok: false, reason: 'Módulo demasiado grande para cada entrada del microinversor.' };
      var units = Math.ceil(nMods / inv.nMppt);
      Object.assign(cfg, { nInv: units, ns: 1, np: nMods, nMods: nMods, perMppt: 1, layout: units + ' microinversores × ' + inv.nMppt + ' módulos (1 módulo por entrada)', strings: [] });
    } else {
      var nsMax = Math.floor(Math.min(inv.vdcMax / vocMax, inv.mpptMax / vmpCold));
      var nsMin = Math.ceil(Math.max(inv.mpptMin, inv.vStart || 0) / vmpHot);
      if (panel.vSys && vocMax * nsMin > panel.vSys) return { ok: false, reason: 'La tensión de cadena supera la tensión máxima de sistema del módulo.' };
      nsMax = Math.min(nsMax, Math.floor(panel.vSys / vocMax));
      if (nsMin > nsMax || nsMax < 1) return { ok: false, reason: 'No existe longitud de cadena válida: Vmp a ' + U.fmt(tCellMax, 0) + ' °C (' + U.fmt(vmpHot, 1) + ' V/módulo) y Voc a ' + U.fmt(tMin, 0) + ' °C (' + U.fmt(vocMax, 1) + ' V/módulo) no caben en la ventana ' + inv.mpptMin + '–' + inv.mpptMax + ' V / ' + inv.vdcMax + ' V.' };
      var npMax = Math.min(Math.floor(inv.iscMax / (1.25 * panel.isc) + 1e-9), Math.floor(inv.imax * 1.1 / panel.imp + 1e-9));
      if (npMax < 1) return { ok: false, reason: 'La corriente del módulo (Isc ' + panel.isc + ' A) supera la entrada MPPT (' + inv.iscMax + ' A).' };
      var nInv0 = Math.max(1, Math.ceil(nMods * panel.pmax / (inv.pac * (+inputs.dcAcMax || 1.3))), inv.type !== 'ongrid' ? Math.ceil(peakKw * 1000 / inv.pac) : 1);
      var best = null;
      for (var nInv = nInv0; nInv <= nInv0 + 60 && !best; nInv++) {
        for (var ns = nsMax; ns >= nsMin; ns--) {
          /* se admite quedar hasta 5 % por debajo del objetivo si así se evita un inversor adicional */
          var npFit = Math.min(nInv * inv.nMppt * npMax, Math.floor(nInv * inv.pdcMax * 1.001 / (ns * panel.pmax)));
          var np = Math.min(Math.ceil(nMods / ns), npFit);
          if (np < 1 || ns * np < nMods * 0.95) continue;
          var over = ns * np - nMods;
          var sc = (over >= 0 ? over * 10 : -over * 14) + (nsMax - ns);
          if (!best || sc < best.sc) best = { sc: sc, nInv: nInv, ns: ns, np: np };
        }
      }
      if (!best) return { ok: false, reason: 'No se encontró una distribución de cadenas compatible.' };
      /* reparto de cadenas por inversor y MPPT */
      var strings = [], k = 0;
      var perInv = [];
      for (var iI = 0; iI < best.nInv; iI++) perInv.push(Math.floor(best.np / best.nInv) + (iI < best.np % best.nInv ? 1 : 0));
      perInv.forEach(function (cnt, iI) {
        var mp = []; for (var j = 0; j < inv.nMppt; j++) mp.push(Math.floor(cnt / inv.nMppt) + (j < cnt % inv.nMppt ? 1 : 0));
        mp.forEach(function (c, j) { for (var q = 0; q < c; q++) strings.push({ id: 'S' + (++k), inv: iI + 1, mppt: j + 1, ns: best.ns }); });
      });
      var cntM = {};
      strings.forEach(function (s) { var key2 = s.inv + '-' + s.mppt; cntM[key2] = (cntM[key2] || 0) + 1; });
      var perMppt = Math.max.apply(null, Object.keys(cntM).map(function (k2) { return cntM[k2]; }));
      Object.assign(cfg, { nInv: best.nInv, ns: best.ns, np: best.np, nMods: best.ns * best.np, perMppt: perMppt, nsMin: nsMin, nsMax: nsMax, npMax: npMax, strings: strings,
        layout: best.np + ' cadena' + (best.np > 1 ? 's' : '') + ' × ' + best.ns + ' módulos en ' + best.nInv + ' inversor' + (best.nInv > 1 ? 'es' : '') + ' (' + inv.nMppt + ' MPPT c/u; máx. ' + perMppt + ' cadena' + (perMppt > 1 ? 's' : '') + ' por MPPT)' });
      cfg.vStrVocMax = best.ns * vocMax; cfg.vStrVmpHot = best.ns * vmpHot; cfg.vStrVmpCold = best.ns * vmpCold; cfg.vStrVmpStc = best.ns * panel.vmp; cfg.vStrVocStc = best.ns * panel.voc;
    }
    cfg.kwp = cfg.nMods * panel.pmax / 1000;
    cfg.pacTot = cfg.nInv * inv.pac / 1000;
    cfg.dcAc = cfg.kwp / cfg.pacTot;
    cfg.areaMods = cfg.nMods * areaMod;
    cfg.areaUsed = cfg.areaMods * areaF;
    cfg.weight = cfg.nMods * panel.kg;
    if (cfg.dcAc > 1.5) cfg.warnings.push('Relación DC/AC alta (' + U.fmt(cfg.dcAc, 2) + '): habrá recorte frecuente.');
    if (cfg.dcAc < 0.8 && inv.type !== 'micro') cfg.warnings.push('Inversor sobredimensionado (DC/AC ' + U.fmt(cfg.dcAc, 2) + ').');
    if (capped) cfg.warnings.push('El área disponible limita la potencia instalada.');
    if (inv.type !== 'ongrid' && inv.type !== 'micro' && cfg.pacTot < peakKw) cfg.warnings.push('La potencia AC (' + U.fmt(cfg.pacTot, 1) + ' kW) es menor que la demanda pico estimada (' + U.fmt(peakKw, 1) + ' kW).');
    cfg.peakKw = peakKw;
    /* banco de baterías */
    if (S.bat && bat) {
      var busV = inv.batV || 48, series = Math.max(1, Math.round(busV / bat.vNom)), vBank = series * bat.vNom;
      if (Math.abs(vBank - busV) / busV > 0.12) return { ok: false, reason: 'La batería (' + bat.vNom + ' V) no forma un banco de ' + busV + ' V.' };
      var effInvBat = inv.effEuro / 100;
      /* coherente con la decisión energética: reserva = noche/(η_bat·η_inv)·(1+margen) dentro de la ventana SOC_mín…100 % */
      var di = (SEDA.state && SEDA.state.decisionInputs) || {}, marginDec = isFinite(+di.margin) ? +di.margin : 15;
      var socMinD = U.clamp(+inputs.socMin || +di.socMin || 20, 0, 90), win = Math.min(bat.dod / 100, 1 - socMinD / 100);
      var usableReq = inputs.nightKwh * Math.max(1, +inputs.autonomyDays || 1) / (effInvBat * bat.eff / 100) * (1 + marginDec / 100);
      var nomReq = usableReq / win;
      var par = Math.max(1, Math.ceil(nomReq / (series * bat.kwh) - 1e-9));
      var iDis = Math.min(cfg.pacTot, peakKw) * 1000 / (vBank * 0.9), iChgInv = (inv.batIChg || 100) * cfg.nInv;
      var iChg = Math.min(iChgInv, cfg.kwp * 1000 / vBank);
      par = Math.max(par, Math.ceil(iDis / bat.iMax - 1e-9));
      var bank = { series: series, par: par, units: series * par, vBank: vBank, ah: par * bat.ah, kwh: series * par * bat.kwh, usable: series * par * bat.kwh * win, win: win, socMin: socMinD, margin: marginDec, usableReq: usableReq, iDis: iDis, iChg: iChg, pChgKw: Math.min(iChgInv, bat.iMax * par) * vBank / 1000, pDisKw: Math.min((inv.batIDis || 100) * cfg.nInv, bat.iMax * par) * vBank / 1000 };
      if (/AGM|GEL/.test(bat.chem)) bank.pChgKw = Math.min(bank.pChgKw, 0.2 * bank.ah * vBank / 1000);
      if (/AGM|GEL|OPzV/.test(bat.chem) && par > 4) cfg.warnings.push('Más de 4 ramas en paralelo de plomo-ácido: considere celdas de 2 V de mayor capacidad o litio.');
      if (bat.chem === 'LFP' && par > 16) cfg.warnings.push('Más de 16 baterías de litio en paralelo: verifique el límite del BMS/inversor.');
      cfg.bank = bank;
    }
    return cfg;
  };

  /* ---------------- Simulación anual horaria ---------------- */
  Dz.simulate = function (cfg, ctx, inputs) {
    var n = 8760, pp = ctx.pp, load = ctx.load, inv = cfg.inv, bank = cfg.bank, sysT = cfg.sysType;
    var dcLoss = cfg.dcLossPct != null ? cfg.dcLossPct / 100 : 0.015;
    var acF = (1 - inputs.losses.acWiring / 100) * (1 - inputs.losses.availability / 100);
    var pacTot = cfg.pacTot, pdcRated = cfg.kwp;
    var E = bank ? bank.kwh : 0, Emax = E, Efloor = bank ? bank.kwh * (1 - bank.win) : 0;
    var etaC = bank ? Math.sqrt(cfg.bat.eff / 100) : 1, etaD = etaC;
    var S = { dc: 0, ac: 0, clip: 0, load: 0, direct: 0, ch: 0, dis: 0, sur: 0, def: 0, unmetH: 0, monthAc: new Array(12).fill(0), monthLoad: new Array(12).fill(0), monthDef: new Array(12).fill(0), monthSolar: new Array(12).fill(0), minSoc: 100, socSum: 0 };
    var dayProfile = null;
    for (var loop = 0; loop < (bank ? 2 : 1); loop++) {
      var last = loop === (bank ? 1 : 0);
      for (var h = 0; h < n; h++) {
        var pdc = pp.dc[h] * pdcRated * (1 - dcLoss);
        var x = pdc / Math.max(1e-6, pacTot), eta = x > 0.005 ? inv.effEuro / 100 * Math.max(0, 1 - 0.003 / x) : 0;
        var pac = pdc * eta, clip = 0;
        if (pac > pacTot) { clip = pac - pacTot; pac = pacTot; }
        pac *= acF;
        var L = load[h], direct = Math.min(pac, L), sur = pac - direct, def = L - direct, ch = 0, dis = 0;
        if (bank) {
          ch = Math.min(sur, bank.pChgKw, Math.max(0, (Emax - E) / etaC)); E += ch * etaC; sur -= ch;
          dis = Math.min(def, bank.pDisKw, Math.max(0, (E - Efloor) * etaD), Math.max(0, pacTot - direct)); E -= dis / etaD; def -= dis;
        }
        if (!last) continue;
        S.dc += pdc; S.ac += pac; S.clip += clip; S.load += L; S.direct += direct; S.ch += ch; S.dis += dis; S.sur += sur; S.def += def;
        if (def > 1e-3 && sysT === 'aislado') S.unmetH++;
        var m = ctx.w.month[h];
        S.monthAc[m] += pac; S.monthLoad[m] += L; S.monthDef[m] += def; S.monthSolar[m] += direct + dis;
        if (bank) { var soc = E / Emax * 100; S.minSoc = Math.min(S.minSoc, soc); S.socSum += soc; }
      }
    }
    var kwp = cfg.kwp, H = ctx.P.poaYear;
    S.specYield = S.ac / kwp;
    S.pr = H > 0 ? S.ac / (kwp * H) : NaN;
    S.cf = S.ac / (kwp * 8760);
    S.solarFrac = S.load > 0 ? (S.load - S.def) / S.load : 0;
    S.selfUse = S.ac > 0 ? (S.direct + S.ch) / S.ac : 0;
    S.useful = sysT === 'aislado' ? S.direct + S.dis : S.direct + S.dis + S.sur;
    S.selfServed = S.direct + S.dis;
    S.export = sysT === 'aislado' ? 0 : S.sur;
    S.curtail = sysT === 'aislado' ? S.sur : 0;
    S.gridImport = sysT === 'aislado' ? 0 : S.def;
    S.unmet = sysT === 'aislado' ? S.def : 0;
    S.lolp = S.unmetH / 8760;
    S.cycles = bank ? S.dis / Math.max(0.01, bank.usable) : 0;
    S.socMean = bank ? S.socSum / 8760 : NaN;
    if (bank) {
      var b = cfg.bat, life = Math.min(b.life, S.cycles > 0 ? b.cycles / S.cycles : b.life);
      S.batLife = Math.max(1, life);
    }
    return S;
  };

  /* ---------------- Evaluación completa (dimensionamiento + simulación + costos + economía) ---------------- */
  Dz.context = function (inputs) {
    var res = Dz.resource(), w = Dz.weather(res);
    /* inclinación automática: la óptima anual, con mínimo de 10° para autolimpieza con la lluvia */
    var tilt = inputs.tilt !== '' && isFinite(+inputs.tilt) ? +inputs.tilt : Math.max(10, Math.round(res.opt.tilt));
    var albedo = inputs.albedo !== '' && isFinite(+inputs.albedo) ? +inputs.albedo : res.albedo;
    inputs.albedoUsed = albedo;
    var P = Dz.poa(res, w, tilt, +inputs.azimuth || 0, albedo);
    var load = Dz.loadProfile(inputs, res, w, P);
    return { res: res, w: w, P: P, load: load, tilt: tilt, albedo: albedo };
  };
  Dz.evaluate = function (panel, inv, bat, inputs, base) {
    var ctx = Object.assign({}, base, { pp: Dz.panelProfile(panel, base.w, base.P, inputs, base.res) });
    var L = panel.L / 1000;
    ctx.gcr = inputs.mount === 'suelo' ? Sol.rowSpacing(base.res.lat, L, ctx.tilt, +inputs.azimuth || 0).gcr : 1;
    var cfg = Dz.config(panel, inv, bat, inputs, base.res, ctx);
    if (!cfg.ok) return cfg;
    cfg.tilt = ctx.tilt; cfg.azimuth = +inputs.azimuth || 0; cfg.albedo = ctx.albedo; cfg.mount = inputs.mount; cfg.gcr = ctx.gcr;
    cfg.row = Sol.rowSpacing(base.res.lat, L, ctx.tilt, cfg.azimuth);
    var C = SEDA.Costs;
    cfg.elec = C.electrical(cfg, inputs);
    cfg.dcLossPct = cfg.elec.dcLossPct;
    cfg.sim = Dz.simulate(cfg, ctx, inputs);
    cfg.bom = C.bom(cfg, inputs);
    cfg.econ = C.economics(cfg, cfg.bom, Dz.project().econ);
    cfg.tempLossPct = ctx.pp.tempLossPct;
    cfg.ctx = { res: base.res, P: base.P };
    return cfg;
  };
  function score(c, obj) {
    switch (obj) {
      case 'yield': return -c.sim.specYield;
      case 'fraction': return -c.sim.solarFrac * 1e6 + c.econ.lcoe;
      case 'capex': return c.bom.total;
      case 'area': return c.areaUsed;
      default: return isFinite(c.econ.lcoe) ? c.econ.lcoe : 1e12;
    }
  }
  Dz.optimize = function (inputs) {
    var cat = Dz.catalog(), base = Dz.context(inputs), S = Dz.SYS[inputs.sysType], out = [], rejected = [];
    var bats = S.bat ? cat.batteries : [null];
    cat.panels.forEach(function (p) {
      cat.inverters.forEach(function (iv) {
        if (S.inv.indexOf(iv.type) < 0) return;
        bats.forEach(function (b) {
          var c = Dz.evaluate(p, iv, b, inputs, base);
          if (c.ok) out.push(c); else rejected.push({ panel: p, inv: iv, bat: b, reason: c.reason });
        });
      });
    });
    /* en sistemas aislados se descartan combinaciones con demasiada energía no suministrada frente a la mejor */
    if (inputs.sysType === 'aislado' && out.length) {
      var bestFrac = Math.max.apply(null, out.map(function (c) { return c.sim.solarFrac; }));
      out.forEach(function (c) { if (c.sim.solarFrac < bestFrac - 0.05) c.lowFrac = true; });
    }
    out.sort(function (a, b) { return (a.lowFrac ? 1 : 0) - (b.lowFrac ? 1 : 0) || score(a, inputs.objective) - score(b, inputs.objective); });
    return { list: out, rejected: rejected, ctx: base };
  };
  /* Diseño actual con los componentes seleccionados (o el mejor si no son compatibles) */
  Dz.current = function () {
    var p = Dz.project(), inputs = p.inputs, key = 'cur:' + JSON.stringify(inputs) + JSON.stringify(p.econ) + JSON.stringify(p.catalog) + JSON.stringify(p.costs) + (Dz._dsKey || '') + JSON.stringify(p.site);
    if (Dz._cache.curKey === key && Dz._cache.cur) return Dz._cache.cur;
    var base = Dz.context(inputs), S = Dz.SYS[inputs.sysType];
    var pa = Dz.find('panels', inputs.panel), iv = Dz.find('inverters', inputs.inverter), b = S.bat ? Dz.find('batteries', inputs.battery) : null;
    var c = pa && iv ? Dz.evaluate(pa, iv, b, inputs, base) : { ok: false, reason: 'Seleccione módulo e inversor.' };
    Dz._cache.cur = c; Dz._cache.curKey = key;
    return c;
  };

  /* Diseño final para presupuesto, manual e informes: aplica cantidades editadas y partidas adicionales */
  Dz.final = function () {
    var c = Dz.current();
    if (!c || !c.ok) return c;
    var p = Dz.project();
    var bom = SEDA.Costs.bom(c, p.inputs, { applyQty: true });
    return Object.assign({}, c, { bom: bom, econ: SEDA.Costs.economics(c, bom, p.econ) });
  };

  /* Serie FV estimada con el modelo físico del arreglo para un conjunto NASA (kW horario o kWh diario) */
  Dz.pvSeries = function (ds, c) {
    var n = ds.t.length, out = new Float64Array(n), pan = c.panel, inv = c.inv, p = Dz.project(), L = p.inputs.losses;
    var lossF = (1 - L.soiling / 100) * (1 - L.mismatch / 100) * (1 - L.lid / 100) * (1 - L.shading / 100) * (1 - (c.dcLossPct || 1.5) / 100);
    var acF = (1 - L.acWiring / 100) * (1 - L.availability / 100), gam = Sol.surfAzDuffie(ds.lat, c.azimuth), off = ds.timeNote === 'LST' ? null : ds.utcOffset;
    var G = ds.vals.ALLSKY_SFC_SW_DWN, DNI = ds.vals.ALLSKY_SFC_SW_DNI, DHI = ds.vals.ALLSKY_SFC_SW_DIFF, T = ds.vals.T2M, WS = ds.vals.WS10M || ds.vals.WS2M;
    if (!G) return null;
    function acPower(ghi, dni, dhi, doy, hourLocal, tamb, ws) {
      var pos = off == null ? Sol.posSolar(ds.lat, doy, hourLocal) : Sol.pos(ds.lat, ds.lon, off, doy, hourLocal);
      var r = Sol.poa({ ghi: ghi, dni: dni, dhi: dhi, pos: pos, doy: doy, tilt: c.tilt, surfAz: gam, albedo: c.albedo });
      if (r.poa <= 0) return 0;
      var geff = r.beam * Sol.iam(r.cosI) + r.diff + r.refl;
      var tc = Sol.tCell(isFinite(tamb) ? tamb : 25, r.poa, pan.noct, isFinite(ws) ? ws : 2, pan.eff / 100);
      var pdc = c.kwp * geff / 1000 * (1 + pan.gP / 100 * (tc - 25)) * lossF;
      var x = pdc / c.pacTot, eta = x > 0.005 ? inv.effEuro / 100 * Math.max(0, 1 - 0.003 / x) : 0;
      return Math.min(c.pacTot, pdc * eta) * acF;
    }
    for (var i = 0; i < n; i++) {
      var d = new Date(ds.t[i]), doy = Math.floor((ds.t[i] - Date.UTC(d.getUTCFullYear(), 0, 1)) / U.DAY) + 1;
      if (!isFinite(G[i])) { out[i] = NaN; continue; }
      if (ds.level === 'hourly') {
        out[i] = acPower(G[i], DNI ? DNI[i] : undefined, DHI ? DHI[i] : undefined, doy, d.getUTCHours() + 0.5, T ? T[i] : 25, WS ? WS[i] : 2);
      } else {
        /* diario: día sintético (hora solar) con la irradiación del día */
        var H = G[i], H0 = Sol.H0(ds.lat, doy), kt = Math.min(0.85, H / Math.max(0.01, H0)), ws0 = Sol.ws(ds.lat * RAD, Sol.decl(doy));
        var Hd = DHI && isFinite(DHI[i]) ? Math.min(H, DHI[i]) : H * Sol.erbsMonthly(kt, ws0);
        var day = Sol.synthDay(ds.lat, doy, H, Hd), e = 0, tmean = T && isFinite(T[i]) ? T[i] : 25;
        var rng = ds.vals.T2M_MAX && ds.vals.T2M_MIN && isFinite(ds.vals.T2M_MAX[i]) ? ds.vals.T2M_MAX[i] - ds.vals.T2M_MIN[i] : 8;
        for (var h = 0; h < 24; h++) {
          if (day.ghi[h] <= 0) continue;
          var pos2 = Sol.posSolar(ds.lat, doy, h + 0.5), dni2 = pos2.cosZ > 0.0175 ? Math.max(0, (day.ghi[h] - day.dhi[h]) / Math.max(pos2.cosZ, 0.065)) : 0;
          var r2 = Sol.poa({ ghi: day.ghi[h], dni: dni2, dhi: day.dhi[h], pos: pos2, doy: doy, tilt: c.tilt, surfAz: gam, albedo: c.albedo });
          var ta = tmean + rng / 2 * Math.cos(2 * Math.PI * (h - 15) / 24);
          var tc2 = Sol.tCell(ta, r2.poa, pan.noct, WS && isFinite(WS[i]) ? WS[i] : 2, pan.eff / 100);
          var pdc2 = c.kwp * (r2.beam * Sol.iam(r2.cosI) + r2.diff + r2.refl) / 1000 * (1 + pan.gP / 100 * (tc2 - 25)) * lossF;
          var x2 = pdc2 / c.pacTot, eta2 = x2 > 0.005 ? inv.effEuro / 100 * Math.max(0, 1 - 0.003 / x2) : 0;
          e += Math.min(c.pacTot, pdc2 * eta2) * acF;
        }
        out[i] = e;
      }
    }
    return out;
  };

  /* Atajos de diseño */
  Dz.PRESETS = [
    { id: 'res-on', ico: '🏠', label: 'Residencial on-grid', desc: '≈ 20 kWh/día · TOPCon + string 5 kW', set: { sysType: 'ongrid', dailyKwh: 20, nightKwh: 8, peakKw: 5, panel: 'pv-topcon-580', inverter: 'inv-on-5k', battery: '', coverage: 90, criterion: 'anual', margin: 0, mount: 'techo' } },
    { id: 'hyb', ico: '🔋', label: 'Híbrido con reserva nocturna', desc: 'Consumo y noche de la decisión · híbrido 12 kW + LFP', set: { sysType: 'hibrido', panel: 'pv-topcon-580', inverter: 'inv-hyb-12k', battery: 'bat-lfp-10', coverage: 100, criterion: 'anual', margin: 10, mount: 'techo', fromDecision: true } },
    { id: 'off', ico: '🏜', label: 'Aislado rural', desc: '12 kWh/día · inversor-cargador + LFP · mes crítico', set: { sysType: 'aislado', dailyKwh: 12, nightKwh: 7, peakKw: 4, panel: 'pv-perc-550', inverter: 'inv-off-8k', battery: 'bat-lfp-5', coverage: 100, criterion: 'critico', margin: 15, autonomyDays: 1.5, mount: 'suelo' } },
    { id: 'com', ico: '🏭', label: 'Comercial 50 kW', desc: '250 kWh/día · TOPCon 620 W + string 50 kW', set: { sysType: 'ongrid', dailyKwh: 250, nightKwh: 60, peakKw: 50, panel: 'pv-topcon-620', inverter: 'inv-on-50k', battery: '', coverage: 80, criterion: 'anual', margin: 0, mount: 'techo' } },
    { id: 'micro', ico: '🧩', label: 'Microinversores', desc: 'Techos con sombras parciales · BC 450 W', set: { sysType: 'ongrid', dailyKwh: 15, nightKwh: 6, peakKw: 4, panel: 'pv-bc-450', inverter: 'inv-micro-2k', battery: '', coverage: 90, criterion: 'anual', margin: 0, mount: 'techo' } }
  ];
  Dz.applyPreset = function (id) {
    var pr = Dz.PRESETS.find(function (x) { return x.id === id; }); if (!pr) return;
    var p = Dz.project(), set = Object.assign({ autonomyDays: 1, kwpTarget: '', areaMax: '', tilt: '', azimuth: 0 }, pr.set);
    if (set.fromDecision) {
      var di = (SEDA.state && SEDA.state.decisionInputs) || {};
      set.nightKwh = +di.nightLoad || 35; set.dailyKwh = Math.round(((+di.nightLoad || 35) + (+di.dayLoad || 30)) * 10) / 10; set.peakKw = 8;
      delete set.fromDecision;
    }
    Object.assign(p.inputs, set);
    p.inputs.kwpTarget = '';
    Dz.invalidate(); Dz.save();
  };

  /* ---------------- Diagrama unifilar (SVG) ---------------- */
  Dz.diagram = function (c) {
    if (!c || !c.ok) return '';
    var e = c.elec, inv = c.inv, bat = c.bat, W = 960, H = c.bank ? 520 : 430, gy = H - 44;
    var col = { dc: '#d9480f', ac: '#1c6fd1', bat: '#7b3fe4', gnd: '#2b8a3e' };
    function esc(t) { return U.esc(t == null ? '' : t); }
    function box(x, y, w, h, lines) {
      var o = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="#fff" stroke="#0b1928" stroke-width="1.6"/>';
      lines.forEach(function (t, i) { if (t) o += '<text x="' + (x + w / 2) + '" y="' + (y + 20 + i * 15) + '" text-anchor="middle" class="' + (i ? 's' : 't') + '">' + esc(t) + '</text>'; });
      return o;
    }
    function line(pts, c1) { return '<path d="M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L') + '" stroke="' + c1 + '" stroke-width="3" fill="none" stroke-linejoin="round"/>'; }
    function lab(x, y, t, anchor) { return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" class="s">' + esc(t) + '</text>'; }
    var s = '<svg class="sld" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama unifilar del sistema">' +
      '<defs><pattern id="pvp" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#15406b"/><path d="M0 5H10M5 0V10" stroke="#3f7fc0" stroke-width="1"/></pattern></defs>' +
      '<style>.sld text{font:12px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;fill:#16202a}.sld .t{font-weight:700;font-size:12.5px}.sld .s{fill:#4b5866;font-size:11px}</style>';
    /* generador FV */
    for (var i = 0; i < 3; i++) s += '<rect x="' + (52 + i * 40) + '" y="28" width="36" height="58" fill="url(#pvp)" stroke="#0b1928" stroke-width="1.2" rx="2"/>';
    s += '<text x="110" y="106" text-anchor="middle" class="t">Generador FV ' + f2(c.kwp) + ' kWp</text>';
    s += lab(110, 122, c.nMods + ' × ' + c.panel.pmax + ' W · ' + (inv.type === 'micro' ? '1 módulo por entrada' : c.np + ' cad. × ' + c.ns + ' mód.'));
    s += lab(110, 137, inv.type === 'micro' ? 'Voc máx. ' + U.fmt(c.vocMax, 1) + ' V/módulo' : 'Voc máx. cadena ' + U.fmt(c.vStrVocMax, 0) + ' V');
    var y = 57, ix = 700, iw = 200, icx = ix + iw / 2;
    if (inv.type !== 'micro') {
      s += line([[200, y], [290, y]], col.dc) + lab(245, y + 18, e.dc.cable.awg + (/^\d{3}$/.test(e.dc.cable.awg) ? ' kcmil' : ' AWG') + ' PV');
      s += lab(245, y + 31, '(' + e.dc.cable.mm2 + ' mm²)');
      s += box(290, 20, 180, 76, [e.dc.fuse ? 'Caja de combinación DC' : 'Caja de conexión DC', e.dc.fuse ? 'Fusibles gPV ' + e.dc.fuse.rating + ' A (±)' : 'Sin fusibles (≤ 2 cad./MPPT)', 'DPS DC tipo 2 · ' + e.dc.spd + ' V']);
      s += line([[470, y], [525, y]], col.dc) + (e.dc.cableMain ? lab(497, y + 18, e.dc.cableMain.awg + ' AWG') : '');
      s += box(525, 20, 145, 76, ['Seccionador DC', e.dc.disc.rating + ' A · ' + e.dc.disc.volt + ' V DC', inv.dcSwitch ? '+ integrado al inversor' : '']);
      s += line([[670, y], [ix, y]], col.dc);
    } else {
      s += line([[200, y], [ix, y]], col.dc) + lab(465, y - 10, 'Cables del módulo → entradas del microinversor (DC ≤ ' + inv.vdcMax + ' V)');
    }
    s += box(ix, 14, iw, 90, [(c.nInv > 1 ? c.nInv + ' × ' : '') + (inv.type === 'micro' ? 'Microinversor' : 'Inversor ' + Dz.TYPES[inv.type]), U.fmt(inv.pac / 1000, 1) + ' kW c/u · ' + inv.acLabel, 'η europea ' + U.fmt(inv.effEuro, 1) + ' %', inv.type !== 'micro' ? inv.nMppt + ' MPPT · ' + inv.mpptMin + '–' + inv.mpptMax + ' V' : '']);
    /* AC */
    s += line([[icx + 40, 104], [icx + 40, 196]], col.ac) + lab(icx + 32, 172, e.ac.cable.label, 'end') + lab(icx + 32, 186, 'THHN/THWN-2 · ' + (e.ac.conductors === 4 ? '3F + N' : '2 conductores') + ' + T', 'end');
    s += box(icx - 50, 196, 180, 62, ['Protección AC', 'Interruptor ' + e.ac.breaker.poles + 'P · ' + e.ac.breaker.rating + ' A', 'DPS AC tipo 2']);
    s += line([[icx + 40, 258], [icx + 40, 300]], col.ac);
    s += box(icx - 70, 300, 220, 62, c.sysType === 'aislado' ? ['Tablero de cargas', 'Cargas de la instalación', e.acMain ? 'Totalizador ' + e.acMain.breaker.rating + ' A' : ''] : ['Tablero general / red', 'Medidor bidireccional (AGPE)', e.acMain ? 'Totalizador FV ' + e.acMain.breaker.rating + ' A' : 'Acometida del operador de red']);
    /* batería */
    if (c.bank) {
      var b = c.bank, bx = 600;
      s += line([[icx - 50, 104], [icx - 50, 150], [bx, 150], [bx, 250]], col.bat);
      s += lab(bx - 8, 176, e.bat.cable.label, 'end') + lab(bx - 8, 190, 'Cu flexible · caída ' + U.fmt(e.bat.cable.dropPct, 2) + ' %', 'end');
      s += box(bx - 95, 250, 190, 62, ['Protección de batería', 'Fusible / interruptor DC ' + e.bat.ocpd + ' A', U.fmt(b.vBank, 1) + ' V DC · en el positivo']);
      s += line([[bx, 312], [bx, 360]], col.bat);
      s += box(bx - 115, 360, 230, 76, ['Banco de baterías', b.series + 's × ' + b.par + 'p · ' + bat.chem + ' ' + bat.vNom + ' V ' + bat.ah + ' Ah', U.fmt(b.kwh, 1) + ' kWh nominal · ' + U.fmt(b.usable, 1) + ' kWh útil', 'BMS / sensor de temperatura']);
    }
    /* puesta a tierra */
    s += '<path d="M40 ' + gy + ' H910" stroke="' + col.gnd + '" stroke-width="2" stroke-dasharray="7 5"/>';
    s += lab(44, gy - 8, 'Tierra de equipos ' + e.gnd.egcLabel + ' — marcos, estructura, inversor, tableros' + (c.bank ? ', rack de baterías' : '') + ' · electrodo ' + e.gnd.rod + ' · GEC ' + e.gnd.gec + ' AWG', 'start');
    s += '<path d="M910 ' + (gy - 10) + ' v10 m-12 0 h24 m-19 6 h14 m-10 6 h6" stroke="' + col.gnd + '" stroke-width="2" fill="none"/>';
    s += '<g transform="translate(40,' + (H - 12) + ')"><rect width="16" height="4" y="-6" fill="' + col.dc + '"/><text x="22" y="0" class="s">DC</text><rect x="60" width="16" height="4" y="-6" fill="' + col.ac + '"/><text x="82" y="0" class="s">AC</text>' +
      (c.bank ? '<rect x="120" width="16" height="4" y="-6" fill="' + col.bat + '"/><text x="142" y="0" class="s">Batería</text>' : '') + '<rect x="' + (c.bank ? 210 : 120) + '" width="16" height="2" y="-5" fill="' + col.gnd + '"/><text x="' + (c.bank ? 232 : 142) + '" y="0" class="s">Puesta a tierra</text></g>';
    return s + '</svg>';
  };
  function f2(v) { return U.fmt(v, 2); }
})();
