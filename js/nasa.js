/* ==========================================================================
   nasa.js — Módulo NASA POWER (SEDA.Nasa): catálogo de parámetros, armado de
   la consulta a la API pública (igual que el Data Access Viewer), descarga
   con caché local (IndexedDB), normalización de unidades, resumen del
   recurso solar del sitio y conversión a tabla para el flujo de ML.

   API: https://power.larc.nasa.gov/api/temporal/{hourly|daily|monthly|climatology}/point
   Límites de la API: horario ≤ 15 parámetros (2001 → casi tiempo real);
   diario / mensual / climatología ≤ 20 parámetros (1981 → casi tiempo real).
   La única información que sale del equipo son las coordenadas, las fechas y
   los parámetros solicitados. Sin conexión se puede importar el CSV oficial.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, Store = SEDA.Store, Sol = SEDA.Solar;
  var N = SEDA.Nasa = {};
  N.BASE = 'https://power.larc.nasa.gov/api/temporal/';
  N.LEVELS = {
    hourly: { label: 'Horario', max: 15, minDate: '2001-01-01', desc: 'Valores horarios (Wh/m² ≡ W/m² medios). Necesario para simular la operación hora a hora.' },
    daily: { label: 'Diario', max: 20, minDate: '1981-01-01', desc: 'Totales/medias diarias (kWh/m²·día). Buen balance entre detalle y tamaño.' },
    monthly: { label: 'Mensual y anual', max: 20, minDate: '1981-01-01', desc: 'Medias mensuales de cada año y media anual.' },
    climatology: { label: 'Climatología', max: 20, minDate: null, desc: 'Promedio multianual de largo plazo por mes (sin fechas). Ideal para dimensionar.' }
  };
  N.COMMUNITIES = {
    RE: { label: 'Energías renovables (RE)', desc: 'Unidades para ingeniería solar/eólica: kWh/m²·día, W/m².' },
    AG: { label: 'Agroclimatología (AG)', desc: 'Unidades agronómicas: MJ/m²·día.' },
    SB: { label: 'Edificaciones sostenibles (SB)', desc: 'Parámetros para eficiencia energética de edificaciones.' }
  };
  /* id, nombre, categoría, niveles (H=horario, D=diario, M=mensual, C=climatología), clave canónica de la app */
  N.PARAMS = [
    ['ALLSKY_SFC_SW_DWN', 'Irradiancia global horizontal (GHI), cielo real', 'solar', 'HDMC', 'IRRADIANCIA'],
    ['ALLSKY_SFC_SW_DNI', 'Irradiancia directa normal (DNI), cielo real', 'solar', 'HDMC', 'DNI'],
    ['ALLSKY_SFC_SW_DIFF', 'Irradiancia difusa horizontal (DHI), cielo real', 'solar', 'HDMC', 'DHI'],
    ['CLRSKY_SFC_SW_DWN', 'GHI de cielo despejado', 'solar', 'HDMC'],
    ['ALLSKY_KT', 'Índice de claridad (Kt), cielo real', 'solar', 'HDMC'],
    ['CLRSKY_KT', 'Índice de claridad de cielo despejado', 'solar', 'HDMC'],
    ['TOA_SW_DWN', 'Irradiancia en el tope de la atmósfera', 'solar', 'HDMC'],
    ['ALLSKY_SFC_LW_DWN', 'Radiación de onda larga descendente', 'solar', 'HDMC'],
    ['ALLSKY_SFC_PAR_TOT', 'Radiación fotosintéticamente activa (PAR)', 'solar', 'HDMC'],
    ['ALLSKY_SFC_UV_INDEX', 'Índice UV', 'solar', 'HDMC'],
    ['ALLSKY_SRF_ALB', 'Albedo de superficie', 'solar', 'DMC'],
    ['CLOUD_AMT', 'Nubosidad', 'solar', 'HDMC'],
    ['SZA', 'Ángulo cenital solar', 'solar', 'H'],
    ['T2M', 'Temperatura del aire a 2 m', 'temp', 'HDMC', 'TEMPERATURA'],
    ['T2M_MAX', 'Temperatura máxima a 2 m', 'temp', 'DMC'],
    ['T2M_MIN', 'Temperatura mínima a 2 m', 'temp', 'DMC'],
    ['T2M_RANGE', 'Rango de temperatura a 2 m', 'temp', 'DMC'],
    ['T2MDEW', 'Punto de rocío a 2 m', 'temp', 'HDMC'],
    ['T2MWET', 'Temperatura de bulbo húmedo a 2 m', 'temp', 'HDMC'],
    ['TS', 'Temperatura de la superficie terrestre', 'temp', 'HDMC'],
    ['RH2M', 'Humedad relativa a 2 m', 'hum', 'HDMC', 'HUMEDAD'],
    ['QV2M', 'Humedad específica a 2 m', 'hum', 'HDMC'],
    ['PRECTOTCORR', 'Precipitación corregida', 'hum', 'HDMC', 'PRECIPITACION'],
    ['WS2M', 'Velocidad del viento a 2 m', 'wind', 'HDMC'],
    ['WS10M', 'Velocidad del viento a 10 m', 'wind', 'HDMC', 'VEL_VIENTO'],
    ['WS50M', 'Velocidad del viento a 50 m', 'wind', 'HDMC'],
    ['WD10M', 'Dirección del viento a 10 m', 'wind', 'HDMC', 'DIR_VIENTO'],
    ['WS10M_MAX', 'Velocidad máxima del viento a 10 m', 'wind', 'DMC'],
    ['WS50M_MAX', 'Velocidad máxima del viento a 50 m', 'wind', 'DMC'],
    ['PS', 'Presión en superficie', 'wind', 'HDMC', 'PRESION']
  ].map(function (p) { return { id: p[0], name: p[1], cat: p[2], lv: p[3], key: p[4] || null }; });
  N.byId = {};
  N.PARAMS.forEach(function (p) { N.byId[p.id] = p; });
  N.CATS = { solar: '☀ Flujos solares y relacionados', temp: '🌡 Temperatura', hum: '💧 Humedad y precipitación', wind: '🌬 Viento y presión' };
  N.LV = { hourly: 'H', daily: 'D', monthly: 'M', climatology: 'C' };
  N.PRESETS = {
    fv: { label: '⚡ Recomendado para FV', ids: ['ALLSKY_SFC_SW_DWN', 'ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF', 'CLRSKY_SFC_SW_DWN', 'ALLSKY_KT', 'T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'WS10M', 'PS', 'PRECTOTCORR', 'CLOUD_AMT', 'ALLSKY_SRF_ALB'] },
    rad: { label: '☀ Solo radiación', ids: ['ALLSKY_SFC_SW_DWN', 'ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF', 'CLRSKY_SFC_SW_DWN', 'ALLSKY_KT', 'TOA_SW_DWN'] },
    met: { label: '🌦 Meteorología', ids: ['T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'PRECTOTCORR', 'WS10M', 'WD10M', 'PS', 'CLOUD_AMT'] }
  };
  N.available = function (level) { var lv = N.LV[level]; return N.PARAMS.filter(function (p) { return p.lv.indexOf(lv) >= 0; }); };
  N.presetFor = function (name, level) {
    var lv = N.LV[level], max = N.LEVELS[level].max;
    return (N.PRESETS[name] ? N.PRESETS[name].ids : []).filter(function (id) { return N.byId[id].lv.indexOf(lv) >= 0; }).slice(0, max);
  };

  /* ---------------- Consulta ---------------- */
  N.defaultQuery = function () {
    var y = new Date().getFullYear() - 1;
    return { community: 'RE', level: 'hourly', start: y + '-01-01', end: y + '-12-31', params: N.presetFor('fv', 'hourly') };
  };
  function ymd(s) { return String(s || '').replace(/-/g, ''); }
  N.url = function (q, lat, lon, format) {
    var lv = q.level, p = [
      'parameters=' + q.params.join(','),
      'community=' + (q.community || 'RE'),
      'longitude=' + (+lon).toFixed(4),
      'latitude=' + (+lat).toFixed(4)
    ];
    if (lv === 'monthly') { p.push('start=' + String(q.start).slice(0, 4), 'end=' + String(q.end).slice(0, 4)); }
    else if (lv !== 'climatology') { p.push('start=' + ymd(q.start), 'end=' + ymd(q.end)); }
    p.push('format=' + (format || 'JSON'));
    if (lv === 'hourly') p.push('time-standard=UTC');
    return N.BASE + lv + '/point?' + p.join('&');
  };
  N.validate = function (q, lat, lon) {
    var errs = [], L = N.LEVELS[q.level];
    if (!L) errs.push('Nivel temporal no válido.');
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) errs.push('Seleccione un punto válido en el mapa (latitud −90…90, longitud −180…180).');
    if (!q.params.length) errs.push('Seleccione al menos un parámetro.');
    if (L && q.params.length > L.max) errs.push('La API admite como máximo ' + L.max + ' parámetros para el nivel «' + L.label + '» (seleccionados: ' + q.params.length + ').');
    var bad = q.params.filter(function (id) { return !N.byId[id] || N.byId[id].lv.indexOf(N.LV[q.level]) < 0; });
    if (bad.length) errs.push('No disponibles en el nivel «' + (L ? L.label : q.level) + '»: ' + bad.join(', ') + '.');
    if (q.level !== 'climatology') {
      var s = U.parseDateInput(q.start), e = U.parseDateInput(q.end), today = Date.now();
      if (!isFinite(s) || !isFinite(e)) errs.push('Fechas de inicio y fin requeridas.');
      else {
        if (e < s) errs.push('La fecha final es anterior a la inicial.');
        if (L && L.minDate && s < U.parseDateInput(L.minDate)) errs.push('El nivel «' + L.label + '» inicia el ' + L.minDate + '.');
        if (e > today) errs.push('La fecha final no puede ser futura.');
        if (q.level === 'hourly' && e - s > 3 * 366 * U.DAY) errs.push('Para datos horarios limite el rango a 3 años (se descargan por año).');
      }
    }
    return errs;
  };
  /* Parte las consultas horarias en años calendario (menor tamaño por respuesta) */
  N.chunks = function (q) {
    if (q.level !== 'hourly') return [q];
    var s = U.parseDateInput(q.start), e = U.parseDateInput(q.end), out = [];
    var y0 = new Date(s).getUTCFullYear(), y1 = new Date(e).getUTCFullYear();
    for (var y = y0; y <= y1; y++) {
      var a = Math.max(s, Date.UTC(y, 0, 1)), b = Math.min(e, Date.UTC(y, 11, 31));
      out.push(Object.assign({}, q, { start: U.fmtDate(a), end: U.fmtDate(b) }));
    }
    return out;
  };

  /* ---------------- Descarga con caché local ---------------- */
  var IDX = 'nasa-index', MAXC = 12;
  N.cacheKey = function (q, lat, lon) { return 'nasa:' + U.fnv1a(N.url(q, lat, lon)).toString(16); };
  N.index = async function () { return (await Store.get(IDX)) || []; };
  N.getCached = async function (key) { return await Store.get(key); };
  N.deleteCached = async function (key) {
    var idx = (await N.index()).filter(function (e) { return e.key !== key; });
    await Store.del(key); await Store.set(IDX, idx);
  };
  async function putCache(key, ds, q, site) {
    var idx = (await N.index()).filter(function (e) { return e.key !== key; });
    var s = N.summary(ds);
    idx.unshift({ key: key, at: Date.now(), lat: ds.lat, lon: ds.lon, elev: ds.elev, level: q.level, community: q.community, start: q.start, end: q.end, params: q.params.slice(), n: ds.t.length, place: site && site.place || '', country: site && site.country || '', ghiYear: s.ghiYear, psh: s.psh });
    while (idx.length > MAXC) { var old = idx.pop(); await Store.del(old.key); }
    await Store.set(key, N.pack(ds));
    await Store.set(IDX, idx);
  }
  /* Guarda en la caché local un conjunto obtenido por otra vía (p. ej. CSV oficial importado) */
  N.saveDataset = async function (ds, site) {
    var q = { community: ds.community || 'RE', level: ds.level, start: ds.start || (ds.t.length ? U.fmtDate(ds.t[0]) : ''), end: ds.end || (ds.t.length ? U.fmtDate(ds.t[ds.t.length - 1]) : ''), params: ds.params.map(function (p) { return p.id; }) };
    var key = 'nasa:csv:' + U.fnv1a(q.level + ds.lat + ',' + ds.lon + q.start + q.end + q.params.join(',')).toString(16);
    await putCache(key, ds, q, site);
    return key;
  };
  /* Serialización compacta (arrays planos) */
  N.pack = function (ds) {
    var o = Object.assign({}, ds, { t: Array.from(ds.t), vals: {} });
    Object.keys(ds.vals).forEach(function (k) { o.vals[k] = Array.from(ds.vals[k]); });
    return o;
  };
  N.unpack = function (o) {
    if (!o) return null;
    var ds = Object.assign({}, o, { t: Float64Array.from(o.t), vals: {} });
    Object.keys(o.vals).forEach(function (k) { ds.vals[k] = Float64Array.from(o.vals[k].map(function (v) { return v == null ? NaN : v; })); });
    return ds;
  };

  async function fetchJSON(url, signal) {
    var res;
    try { res = await fetch(url, { signal: signal, headers: { Accept: 'application/json' } }); }
    catch (e) {
      if (e && e.name === 'AbortError') throw e;
      var err = new Error('No fue posible conectarse con NASA POWER (sin Internet, bloqueo de red o política del navegador). Puede abrir el enlace CSV en su navegador, descargar el archivo e importarlo con «Importar CSV de NASA».');
      err.offline = true; throw err;
    }
    var txt = await res.text(), js = null;
    try { js = JSON.parse(txt); } catch (e) { /* respuesta no JSON */ }
    if (res.status === 429) { var e429 = new Error('NASA POWER limitó temporalmente las solicitudes (HTTP 429). Espere un minuto e intente de nuevo.'); e429.rate = true; throw e429; }
    if (!res.ok || !js) {
      var msg = js && (js.messages || js.detail || js.message || js.errors);
      if (Array.isArray(msg)) msg = msg.map(function (m) { return typeof m === 'string' ? m : (m.msg || JSON.stringify(m)); }).join(' · ');
      throw new Error('NASA POWER respondió HTTP ' + res.status + (msg ? ': ' + String(msg).slice(0, 400) : '.'));
    }
    return js;
  }
  /* Descarga (con caché). onProgress(i, n). Devuelve {ds, key, cached} */
  N.fetch = async function (q, lat, lon, opts) {
    opts = opts || {};
    var key = N.cacheKey(q, lat, lon);
    if (!opts.force) {
      var c = await N.getCached(key);
      if (c) return { ds: N.unpack(c), key: key, cached: true };
    }
    var parts = N.chunks(q), jsons = [];
    for (var i = 0; i < parts.length; i++) {
      if (opts.onProgress) opts.onProgress(i, parts.length);
      var url = N.url(parts[i], lat, lon, 'JSON'), js;
      try { js = await fetchJSON(url, opts.signal); }
      catch (e) { if (e.rate) { await U.sleep(4000); js = await fetchJSON(url, opts.signal); } else throw e; }
      jsons.push(js);
      if (i < parts.length - 1) await U.sleep(600);
    }
    var ds = N.parse(jsons, q, opts.utcOffset);
    await putCache(key, ds, q, opts.site);
    return { ds: ds, key: key, cached: false };
  };

  /* ---------------- Normalización ---------------- */
  /* Convierte a unidades canónicas. kind: 'irr' (horario W/m² | diario kWh/m²·d), 'temp' °C, 'pres' hPa, … */
  function convFactor(id, units, level) {
    var u = String(units || '').toLowerCase();
    if (/mj/.test(u)) return level === 'hourly' ? { f: 277.7778, u: 'W/m²' } : { f: 1 / 3.6, u: 'kWh/m²·día' };
    if (/kw-hr|kwh/.test(u)) return level === 'hourly' ? { f: 1000, u: 'W/m²' } : { f: 1, u: 'kWh/m²·día' };
    if (/^wh\/m\^?2$|wh\/m2|w-hr/.test(u)) return level === 'hourly' ? { f: 1, u: 'W/m²' } : { f: 1 / 1000, u: 'kWh/m²·día' };
    if (/^w\/m\^?2$|w\/m2/.test(u)) return level === 'hourly' ? { f: 1, u: 'W/m²' } : { f: 0.024, u: 'kWh/m²·día' };
    if (id === 'PS' && /kpa/.test(u)) return { f: 10, u: 'hPa' };
    if (/^c$|deg c|°c|celsius/.test(u)) return { f: 1, u: '°C' };
    if (/m\/s/.test(u)) return { f: 1, u: 'm/s' };
    if (/mm\/hour|mm\/hr/.test(u)) return { f: 1, u: 'mm/h' };
    if (/mm\/day/.test(u)) return { f: 1, u: 'mm/día' };
    if (/^%$/.test(u)) return { f: 1, u: '%' };
    if (/g\/kg/.test(u)) return { f: 1, u: 'g/kg' };
    if (/degrees|^deg$/.test(u)) return { f: 1, u: '°' };
    if (/dimensionless|^-$|^1$|^$/.test(u)) return { f: 1, u: '' };
    return { f: 1, u: units || '' };
  }
  N.convFactor = convFactor;
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  /* jsons: una o varias respuestas GeoJSON de POWER (partes de la misma consulta) */
  N.parse = function (jsons, q, utcOffset) {
    if (!Array.isArray(jsons)) jsons = [jsons];
    var first = jsons[0] || {};
    var coords = (first.geometry && first.geometry.coordinates) || [];
    var lon = +coords[0], lat = +coords[1], elev = coords.length > 2 ? +coords[2] : NaN;
    var level = q.level, off = isFinite(utcOffset) ? utcOffset : Math.round(lon / 15);
    var meta = first.parameters || {}, fill = first.header && isFinite(first.header.fill_value) ? +first.header.fill_value : -999;
    var ids = q.params.filter(function (id) { return jsons.some(function (j) { return j.properties && j.properties.parameter && j.properties.parameter[id]; }); });
    var rows = {}, annual = {};
    jsons.forEach(function (j) {
      var P = (j.properties && j.properties.parameter) || {};
      ids.forEach(function (id) {
        var obj = P[id] || {};
        Object.keys(obj).forEach(function (k) {
          var v = +obj[k];
          if (!isFinite(v) || v === fill || v <= -990) v = NaN;
          var t;
          if (level === 'hourly') t = Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8), +k.slice(8, 10)) + off * U.HOUR;
          else if (level === 'daily') t = Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
          else if (level === 'monthly') {
            var mo = +k.slice(4, 6);
            if (mo === 13) { (annual[id] = annual[id] || {})[k.slice(0, 4)] = v; return; }
            t = Date.UTC(+k.slice(0, 4), mo - 1, 1);
          } else {
            var mi = MON.indexOf(k);
            if (mi < 0) { if (k === 'ANN') (annual[id] = annual[id] || {}).ANN = v; return; }
            t = Date.UTC(2000, mi, 1);
          }
          (rows[t] = rows[t] || {})[id] = v;
        });
      });
    });
    var ts = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    var vals = {}, params = [];
    ids.forEach(function (id) {
      var m = meta[id] || {}, cf = convFactor(id, m.units, level);
      var arr = new Float64Array(ts.length);
      for (var i = 0; i < ts.length; i++) { var v = rows[ts[i]][id]; arr[i] = isFinite(v) ? v * cf.f : NaN; }
      vals[id] = arr;
      params.push({ id: id, units: cf.u, unitsRaw: m.units || '', longname: m.longname || m.name || (N.byId[id] ? N.byId[id].name : id), name: N.byId[id] ? N.byId[id].name : (m.longname || id) });
      if (annual[id]) Object.keys(annual[id]).forEach(function (k) { if (isFinite(annual[id][k])) annual[id][k] *= cf.f; });
    });
    var src = first.header && first.header.sources ? first.header.sources : [];
    return {
      level: level, community: q.community, lat: lat, lon: lon, elev: elev, utcOffset: off, start: q.start, end: q.end,
      params: params, t: Float64Array.from(ts), vals: vals, annual: annual,
      header: { title: first.header && first.header.title || 'NASA/POWER', sources: src, api: first.header && first.header.api ? (first.header.api.name || '') + ' ' + (first.header.api.version || '') : '' },
      fetchedAt: Date.now()
    };
  };

  /* ---------------- Resumen del recurso ---------------- */
  function monthAgg(ds, id, how) {
    var v = ds.vals[id]; if (!v) return null;
    var out = new Array(12).fill(NaN);
    if (ds.level === 'climatology' || ds.level === 'monthly') {
      var s = new Array(12).fill(0), n = new Array(12).fill(0);
      for (var i = 0; i < ds.t.length; i++) { if (!isFinite(v[i])) continue; var m = new Date(ds.t[i]).getUTCMonth(); s[m] += v[i]; n[m]++; }
      for (var k = 0; k < 12; k++) out[k] = n[k] ? s[k] / n[k] : NaN;
      return out;
    }
    if (ds.level === 'daily') {
      var sd = new Array(12).fill(0), nd = new Array(12).fill(0), mx = new Array(12).fill(-Infinity), mn = new Array(12).fill(Infinity);
      for (var j = 0; j < ds.t.length; j++) { if (!isFinite(v[j])) continue; var md = new Date(ds.t[j]).getUTCMonth(); sd[md] += v[j]; nd[md]++; mx[md] = Math.max(mx[md], v[j]); mn[md] = Math.min(mn[md], v[j]); }
      for (var q = 0; q < 12; q++) out[q] = nd[q] ? (how === 'max' ? mx[q] : how === 'min' ? mn[q] : sd[q] / nd[q]) : NaN;
      return out;
    }
    /* horario: irradiancia -> suma diaria (kWh/m²·d) promediada; resto -> media o extremos */
    var isIrr = /SW_DWN|SW_DNI|SW_DIFF|PAR_TOT|LW_DWN/.test(id);
    var daySum = {}, dayN = {}, s2 = new Array(12).fill(0), n2 = new Array(12).fill(0), mx2 = new Array(12).fill(-Infinity), mn2 = new Array(12).fill(Infinity);
    for (var r = 0; r < ds.t.length; r++) {
      var x = v[r]; if (!isFinite(x)) continue;
      var m2 = new Date(ds.t[r]).getUTCMonth();
      if (isIrr) { var d = Math.floor(ds.t[r] / U.DAY); daySum[d] = (daySum[d] || 0) + x; dayN[d] = (dayN[d] || 0) + 1; }
      else { s2[m2] += x; n2[m2]++; mx2[m2] = Math.max(mx2[m2], x); mn2[m2] = Math.min(mn2[m2], x); }
    }
    if (isIrr) {
      Object.keys(daySum).forEach(function (d) { if (dayN[d] < 20) return; var mm = new Date(d * U.DAY).getUTCMonth(); s2[mm] += daySum[d] / 1000; n2[mm]++; });
      for (var a = 0; a < 12; a++) out[a] = n2[a] ? s2[a] / n2[a] : NaN;
      return out;
    }
    for (var b = 0; b < 12; b++) out[b] = n2[b] ? (how === 'max' ? mx2[b] : how === 'min' ? mn2[b] : s2[b] / n2[b]) : NaN;
    return out;
  }
  N.monthAgg = monthAgg;
  function fin(a) { return a && a.some(isFinite) ? a : null; }
  N.summary = function (ds) {
    var ghi = fin(monthAgg(ds, 'ALLSKY_SFC_SW_DWN')), dni = fin(monthAgg(ds, 'ALLSKY_SFC_SW_DNI')), dhi = fin(monthAgg(ds, 'ALLSKY_SFC_SW_DIFF'));
    var clr = fin(monthAgg(ds, 'CLRSKY_SFC_SW_DWN')), kt = fin(monthAgg(ds, 'ALLSKY_KT'));
    var t2m = fin(monthAgg(ds, 'T2M')), tmax = fin(monthAgg(ds, ds.vals.T2M_MAX ? 'T2M_MAX' : 'T2M', 'max')), tmin = fin(monthAgg(ds, ds.vals.T2M_MIN ? 'T2M_MIN' : 'T2M', 'min'));
    var ws = fin(monthAgg(ds, ds.vals.WS10M ? 'WS10M' : 'WS2M')), rh = fin(monthAgg(ds, 'RH2M')), pr = fin(monthAgg(ds, 'PRECTOTCORR')), cloud = fin(monthAgg(ds, 'CLOUD_AMT')), alb = fin(monthAgg(ds, 'ALLSKY_SRF_ALB'));
    var out = { ghi: ghi, dni: dni, dhi: dhi, clr: clr, kt: kt, t2m: t2m, tmax: tmax, tmin: tmin, ws: ws, rh: rh, pr: pr, cloud: cloud, alb: alb, level: ds.level };
    if (ghi) {
      out.ghiYear = Sol.annual(ghi);
      out.psh = out.ghiYear / 365;
      var fm = ghi.map(function (v, i) { return [v, i]; }).filter(function (x) { return isFinite(x[0]); });
      fm.sort(function (a, b) { return a[0] - b[0]; });
      out.worstMonth = fm[0][1]; out.bestMonth = fm[fm.length - 1][1];
      out.albedo = alb ? U.mean(alb.filter(isFinite)) : 0.2;
      if (!(out.albedo > 0.05 && out.albedo < 0.9)) out.albedo = 0.2;
      out.opt = Sol.optimalTilt(ds.lat, ghi, 0, out.albedo, dhi);
    }
    if (tmin) out.tMinAbs = Math.min.apply(null, tmin.filter(isFinite));
    if (tmax) out.tMaxAbs = Math.max.apply(null, tmax.filter(isFinite));
    if (t2m) out.tMean = U.mean(t2m.filter(isFinite));
    if (ws) out.wsMean = U.mean(ws.filter(isFinite));
    if (pr) out.prYear = ds.level === 'hourly' ? NaN : Sol.annual(pr);
    return out;
  };

  /* Serie horaria de un año tipo (para el diseñador): usa el año calendario más reciente con ≥ 90 % de horas.
     Devuelve {t, ghi, dni, dhi, tamb, ws} con 8760 valores (se completa con medias horarias por mes si faltan). */
  N.hourlyYear = function (ds) {
    if (!ds || ds.level !== 'hourly' || !ds.vals.ALLSKY_SFC_SW_DWN) return null;
    var byYear = {};
    for (var i = 0; i < ds.t.length; i++) { var y = new Date(ds.t[i]).getUTCFullYear(); byYear[y] = (byYear[y] || 0) + 1; }
    var years = Object.keys(byYear).map(Number).filter(function (y) { return byYear[y] >= 0.9 * 8760; }).sort();
    var year = years.length ? years[years.length - 1] : +Object.keys(byYear).sort(function (a, b) { return byYear[b] - byYear[a]; })[0];
    var t0 = Date.UTC(year, 0, 1), n = 8760;
    var get = function (id) { return ds.vals[id] || null; };
    var src = { ghi: get('ALLSKY_SFC_SW_DWN'), dni: get('ALLSKY_SFC_SW_DNI'), dhi: get('ALLSKY_SFC_SW_DIFF'), tamb: get('T2M'), ws: get('WS10M') || get('WS2M') };
    var out = { year: year, t: new Float64Array(n) };
    Object.keys(src).forEach(function (k) { out[k] = new Float64Array(n).fill(NaN); });
    for (var j = 0; j < ds.t.length; j++) {
      var h = Math.round((ds.t[j] - t0) / U.HOUR);
      if (h < 0 || h >= n) continue;
      Object.keys(src).forEach(function (k) { if (src[k]) out[k][h] = src[k][j]; });
    }
    /* relleno: media del mismo mes y hora */
    Object.keys(src).forEach(function (k) {
      var a = out[k], s = {}, c = {};
      for (var h = 0; h < n; h++) { var key = new Date(t0 + h * U.HOUR).getUTCMonth() * 24 + h % 24; if (isFinite(a[h])) { s[key] = (s[key] || 0) + a[h]; c[key] = (c[key] || 0) + 1; } }
      for (var h2 = 0; h2 < n; h2++) { if (isFinite(a[h2])) continue; var k2 = new Date(t0 + h2 * U.HOUR).getUTCMonth() * 24 + h2 % 24; a[h2] = c[k2] ? s[k2] / c[k2] : (k === 'ghi' || k === 'dni' || k === 'dhi' ? 0 : NaN); }
    });
    for (var z = 0; z < n; z++) out.t[z] = t0 + z * U.HOUR;
    if (!src.dni || !src.dhi) { out.dni = null; out.dhi = null; }
    return out;
  };

  /* Matriz mes × hora de un parámetro horario (media) */
  N.monthHour = function (ds, id) {
    var v = ds.vals[id]; if (!v || ds.level !== 'hourly') return null;
    var s = [], c = [];
    for (var m = 0; m < 12; m++) { s.push(new Array(24).fill(0)); c.push(new Array(24).fill(0)); }
    for (var i = 0; i < ds.t.length; i++) { if (!isFinite(v[i])) continue; var d = new Date(ds.t[i]); s[d.getUTCMonth()][d.getUTCHours()] += v[i]; c[d.getUTCMonth()][d.getUTCHours()]++; }
    return s.map(function (row, m) { return row.map(function (x, h) { return c[m][h] ? x / c[m][h] : NaN; }); });
  };

  /* ---------------- Tabla para el flujo de ML ---------------- */
  var HEAD = { IRRADIANCIA: 'GHI', DNI: 'DNI', DHI: 'DHI', TEMPERATURA: 'T2M', HUMEDAD: 'RH2M', VEL_VIENTO: 'WS10M', DIR_VIENTO: 'WD10M', PRESION: 'PS', PRECIPITACION: 'PRECTOTCORR' };
  /* pv: Float64Array de potencia (kW, horario) o energía (kWh, diario) estimada con el modelo físico del arreglo */
  N.toTable = function (ds, pv, pvLabel) {
    if (ds.level !== 'hourly' && ds.level !== 'daily') throw new Error('Para el análisis de ML se requieren datos horarios o diarios (no mensuales ni climatología).');
    var cols = [];
    ds.params.forEach(function (p) {
      var cat = N.byId[p.id];
      if (!cat || !cat.key) return;
      var v = ds.vals[p.id], unit = p.units === 'W/m²' ? 'W/m2' : p.units === '°C' ? 'C' : p.units === 'mm/h' || p.units === 'mm/día' ? 'mm' : p.units;
      if (p.units === 'kWh/m²·día') { v = v.map(function (x) { return x * 1000 / 24; }); unit = 'W/m2'; } /* media diaria equivalente */
      cols.push({ head: p.id + ' (' + unit + ')', v: v, key: cat.key });
    });
    var headers = ['FECHA_HORA'].concat(cols.map(function (c) { return c.head; }));
    if (pv) headers.push(pvLabel || (ds.level === 'hourly' ? 'POTENCIA_FV_ESTIMADA (kW)' : 'ENERGIA_FV_ESTIMADA (kWh)'));
    var rows = new Array(ds.t.length);
    for (var i = 0; i < ds.t.length; i++) {
      var d = new Date(ds.t[i]);
      var r = [d.getUTCFullYear() + '-' + U.p2(d.getUTCMonth() + 1) + '-' + U.p2(d.getUTCDate()) + (ds.level === 'hourly' ? ' ' + U.p2(d.getUTCHours()) + ':00' : '')];
      for (var c = 0; c < cols.length; c++) { var x = cols[c].v[i]; r.push(isFinite(x) ? Math.round(x * 1000) / 1000 : ''); }
      if (pv) r.push(isFinite(pv[i]) ? Math.round(pv[i] * 1000) / 1000 : '');
      rows[i] = r;
    }
    return { headers: headers, rows: rows, keys: cols.map(function (c) { return c.key; }) };
  };
  /* CSV normalizado (todas las variables) */
  N.toCSV = function (ds) {
    var head = ['FECHA'].concat(ds.params.map(function (p) { return p.id + (p.units ? ' [' + p.units + ']' : ''); }));
    var rows = [];
    for (var i = 0; i < ds.t.length; i++) {
      var d = new Date(ds.t[i]);
      var f = ds.level === 'climatology' ? U.MESES_L[d.getUTCMonth()] : ds.level === 'monthly' ? d.getUTCFullYear() + '-' + U.p2(d.getUTCMonth() + 1) : ds.level === 'daily' ? U.fmtDate(ds.t[i]) : U.fmtDateTime(ds.t[i]);
      rows.push([f].concat(ds.params.map(function (p) { return ds.vals[p.id][i]; })));
    }
    return U.toCSV(head, rows);
  };
  /* Detecta y lee un CSV oficial de NASA POWER importado manualmente (como dataset) */
  N.fromImportedCSV = function (text, q) {
    var lines = text.split(/\r?\n/), start = -1, lat = NaN, lon = NaN, elev = NaN;
    for (var i = 0; i < Math.min(lines.length, 80); i++) {
      var L = lines[i];
      var m = /Location:\s*latitude\s+(-?[\d.]+)\s+longitude\s+(-?[\d.]+)/i.exec(L); if (m) { lat = +m[1]; lon = +m[2]; }
      var e = /Elevation[^=]*=\s*(-?[\d.]+)/i.exec(L); if (e) elev = +e[1];
      if (/-END HEADER-/.test(L)) { start = i + 1; break; }
    }
    if (start < 0) return null;
    var head = lines[start].split(',').map(function (s) { return s.trim(); });
    var hasHR = head.indexOf('HR') >= 0, isDaily = head.indexOf('DY') >= 0 || head.indexOf('DOY') >= 0;
    var ids = head.filter(function (h) { return ['YEAR', 'MO', 'DY', 'HR', 'DOY', 'LAT', 'LON'].indexOf(h) < 0; });
    var level = hasHR ? 'hourly' : isDaily ? 'daily' : null;
    if (!level) return null;
    var P = {}; ids.forEach(function (id) { P[id] = {}; });
    var iY = head.indexOf('YEAR'), iM = head.indexOf('MO'), iD = head.indexOf('DY'), iH = head.indexOf('HR'), iDoy = head.indexOf('DOY');
    for (var r = start + 1; r < lines.length; r++) {
      var c = lines[r].split(','); if (c.length < head.length) continue;
      var y = +c[iY], mo, dy;
      if (iM >= 0) { mo = +c[iM]; dy = +c[iD]; } else { var dd = new Date(Date.UTC(y, 0, +c[iDoy])); mo = dd.getUTCMonth() + 1; dy = dd.getUTCDate(); }
      var key = y + U.p2(mo) + U.p2(dy) + (hasHR ? U.p2(+c[iH]) : '');
      ids.forEach(function (id) { P[id][key] = +c[head.indexOf(id)]; });
    }
    var units = {};
    ids.forEach(function (id) { units[id] = { units: level === 'hourly' ? (/SW_DWN|SW_DNI|SW_DIFF/.test(id) ? 'Wh/m^2' : '') : (/SW_DWN|SW_DNI|SW_DIFF/.test(id) ? 'kW-hr/m^2/day' : ''), longname: id }; if (id === 'PS') units[id].units = 'kPa'; if (/^T2M|^TS$/.test(id)) units[id].units = 'C'; if (/^WS/.test(id)) units[id].units = 'm/s'; if (id === 'RH2M') units[id].units = '%'; if (id === 'PRECTOTCORR') units[id].units = level === 'hourly' ? 'mm/hour' : 'mm/day'; });
    var js = { geometry: { coordinates: [lon, lat, elev] }, properties: { parameter: P }, parameters: units, header: { fill_value: -999, title: 'NASA/POWER (CSV importado)' } };
    var qq = Object.assign({ community: 'RE' }, q || {}, { level: level, params: ids });
    /* el CSV horario oficial se descarga normalmente en hora solar local (LST): se toma tal cual como hora local */
    var ds = N.parse([js], qq, 0);
    ds.utcOffset = isFinite(lon) ? Math.round(lon / 15) : 0;
    ds.timeNote = 'LST';
    return ds;
  };
})();
