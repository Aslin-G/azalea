/* ==========================================================================
   mapping.js — Variables canónicas y MAPEO INTELIGENTE DE VARIABLES.
   Identifica columnas por sinónimos (español/inglés, NASA POWER, IDEAM,
   UPME, XM), unidades indicadas en el encabezado y plausibilidad del
   contenido. El usuario puede modificar cualquier asignación.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U;
  var M = SEDA.Mapping = {};

  /* role: time | target | feature | aux */
  M.VARS = [
    { key: 'FECHA', label: 'Fecha', role: 'time', desc: 'Fecha o fecha-hora del registro', syn: ['fecha', 'date', 'fecha hora', 'fecha y hora', 'datetime', 'date time', 'timestamp', 'time stamp', 'fechahora', 'fecha registro', 'local time', 'time utc', 'utc time', 'tiempo', 'dia', 'day time', 'periodo', 'fecha lectura'], neg: ['hora', 'hour'] },
    { key: 'HORA', label: 'Hora', role: 'time', desc: 'Hora del día (si va separada de la fecha)', syn: ['hora', 'time', 'hour', 'hr', 'hh', 'hora local', 'hour of day', 'hora del dia', 'h'] },
    { key: 'ANIO', label: 'Año (componente)', role: 'time', desc: 'Año como columna separada (p. ej. NASA POWER: YEAR)', syn: ['year', 'anio', 'ano', 'yyyy', 'yr'] },
    { key: 'MES_C', label: 'Mes (componente)', role: 'time', desc: 'Mes como columna separada (NASA POWER: MO)', syn: ['mo', 'month', 'mes', 'mm'] },
    { key: 'DIA_C', label: 'Día (componente)', role: 'time', desc: 'Día como columna separada (NASA POWER: DY)', syn: ['dy', 'day', 'dia', 'dd'] },
    { key: 'DOY_C', label: 'Día del año (componente)', role: 'time', desc: 'Día juliano (NASA POWER: DOY)', syn: ['doy', 'day of year', 'dia del ano', 'dia juliano', 'julian day', 'dia ano'] },
    { key: 'POTENCIA_FV', label: 'Potencia FV', role: 'target', unit: 'kW', units: ['kW', 'W', 'MW'], desc: 'Potencia fotovoltaica generada', syn: ['pv power', 'potencia fv', 'ac power', 'solar output', 'potencia', 'power', 'pac', 'p ac', 'potencia ac', 'potencia pv', 'potencia fotovoltaica', 'pv output', 'output power', 'p fv', 'active power', 'potencia activa', 'inverter power', 'potencia inversor', 'potencia generada', 'pv kw', 'generacion kw', 'dc power', 'pdc'], neg: ['bateria', 'battery', 'bat', 'carga', 'load', 'consumo', 'red', 'grid', 'demanda', 'nominal', 'reactiva', 'reactive'] },
    { key: 'ENERGIA_FV', label: 'Energía FV', role: 'target', unit: 'kWh', units: ['kWh', 'Wh', 'MWh'], desc: 'Energía generada por intervalo', syn: ['energia fv', 'pv energy', 'energia', 'energy', 'generacion', 'generation', 'yield', 'e ac', 'energia generada', 'produccion', 'energy output', 'generacion fv', 'energia pv', 'eac', 'generacion real'], neg: ['bateria', 'battery', 'carga', 'load', 'consumo', 'red', 'grid', 'demanda', 'import', 'export'] },
    { key: 'IRRADIANCIA', label: 'Irradiancia global (GHI)', role: 'feature', unit: 'W/m²', units: ['W/m²', 'kW/m²'], desc: 'Irradiancia/radiación global horizontal', syn: ['ghi', 'irradiancia', 'irradiance', 'radiacion global', 'radiacion solar', 'solar radiation', 'global horizontal', 'global irradiance', 'allsky sfc sw dwn', 'irradiancia global', 'rad global', 'radiacion', 'sw dwn', 'insolation', 'pyranometer', 'piranometro', 'irradiacion', 'radiacion global horizontal', 'global horizontal irradiance', 'rs', 'rad solar', 'irradiancia solar', 'global radiation'], neg: ['poa', 'directa', 'direct', 'difusa', 'diffuse', 'dni', 'dhi', 'clear', 'toa', 'plano', 'inclinada', 'tilt'] },
    { key: 'IRR_POA', label: 'Irradiancia en el plano (POA)', role: 'feature', unit: 'W/m²', units: ['W/m²', 'kW/m²'], desc: 'Irradiancia en el plano del arreglo', syn: ['poa', 'plane of array', 'irradiancia poa', 'plano del arreglo', 'gpoa', 'tilted irradiance', 'irradiancia inclinada', 'poa irradiance', 'g poa', 'irradiancia plano'] },
    { key: 'DNI', label: 'Radiación directa (DNI)', role: 'feature', unit: 'W/m²', units: ['W/m²', 'kW/m²'], desc: 'Irradiancia directa normal', syn: ['dni', 'direct normal', 'radiacion directa', 'irradiancia directa', 'allsky sfc sw dni', 'beam', 'directa', 'direct normal irradiance', 'direct radiation'] },
    { key: 'DHI', label: 'Radiación difusa (DHI)', role: 'feature', unit: 'W/m²', units: ['W/m²', 'kW/m²'], desc: 'Irradiancia difusa horizontal', syn: ['dhi', 'diffuse', 'radiacion difusa', 'irradiancia difusa', 'allsky sfc sw diff', 'difusa', 'diffuse horizontal', 'diffuse radiation', 'sw diff'] },
    { key: 'TEMPERATURA', label: 'Temperatura ambiente', role: 'feature', unit: '°C', units: ['°C', 'K', '°F'], desc: 'Temperatura del aire', syn: ['temperatura', 'temp', 'temperature', 't2m', 'tamb', 't amb', 'ambient temperature', 'air temperature', 'temperatura ambiente', 'temperatura aire', 't aire', 'ta', 'tmp', 'temperatura del aire', 'air temp'], neg: ['modulo', 'module', 'panel', 'cell', 'celda', 'max', 'min', 'rocio', 'dew', 'wet'] },
    { key: 'HUMEDAD', label: 'Humedad relativa', role: 'feature', unit: '%', units: ['%', 'fracción'], desc: 'Humedad relativa del aire', syn: ['humedad', 'humidity', 'rh', 'rh2m', 'relative humidity', 'humedad relativa', 'hr', 'hum', 'h rel'], neg: ['especifica', 'specific', 'qv2m'] },
    { key: 'VEL_VIENTO', label: 'Velocidad del viento', role: 'feature', unit: 'm/s', units: ['m/s', 'km/h', 'kn'], desc: 'Velocidad del viento', syn: ['wind speed', 'ws', 'ws10', 'ws10m', 'ws2m', 'ws50m', 'velocidad viento', 'velocidad del viento', 'viento', 'wind', 'vel viento', 'windspeed', 'wspd', 'v viento', 'vv'], neg: ['direccion', 'direction', 'dir', 'wd', 'rafaga', 'gust'] },
    { key: 'DIR_VIENTO', label: 'Dirección del viento', role: 'feature', unit: '°', units: ['°'], desc: 'Dirección de procedencia del viento', syn: ['wind direction', 'wd', 'wd10', 'wd10m', 'wd2m', 'wd50m', 'direccion viento', 'direccion del viento', 'dir viento', 'winddir', 'wdir', 'dv'] },
    { key: 'PRESION', label: 'Presión atmosférica', role: 'feature', unit: 'hPa', units: ['hPa', 'kPa', 'Pa', 'mmHg'], desc: 'Presión atmosférica en superficie', syn: ['presion', 'pressure', 'ps', 'presion atmosferica', 'atmospheric pressure', 'barometric', 'bp', 'pres', 'slp', 'presion barometrica', 'surface pressure'] },
    { key: 'PRECIPITACION', label: 'Precipitación', role: 'feature', unit: 'mm', units: ['mm'], desc: 'Precipitación en el intervalo', syn: ['precipitacion', 'precipitation', 'precip', 'prectotcorr', 'prectot', 'lluvia', 'rain', 'rainfall', 'pp', 'ppt', 'precipitacion total'] },
    { key: 'CARGA', label: 'Consumo / carga', role: 'aux', unit: 'kW', units: ['kW', 'W', 'kWh'], desc: 'Demanda eléctrica (opcional; sugiere el consumo nocturno)', syn: ['carga', 'load', 'consumo', 'demand', 'demanda', 'consumption', 'load power', 'potencia carga', 'consumo kw', 'demanda kw'] },
    { key: 'SOC', label: 'Estado de carga batería', role: 'aux', unit: '%', units: ['%'], desc: 'SOC de la batería (opcional)', syn: ['soc', 'state of charge', 'estado de carga', 'battery soc', 'soc bateria', 'estado carga'] }
  ];
  M.byKey = {};
  M.VARS.forEach(function (v) { M.byKey[v.key] = v; });
  M.NUMERIC = M.VARS.filter(function (v) { return v.role !== 'time'; }).map(function (v) { return v.key; });
  M.METEO = ['IRRADIANCIA', 'IRR_POA', 'DNI', 'DHI', 'TEMPERATURA', 'HUMEDAD', 'VEL_VIENTO', 'DIR_VIENTO', 'PRESION', 'PRECIPITACION'];
  M.label = function (k) { return M.byKey[k] ? M.byKey[k].label : k; };
  M.unitOf = function (k, mapping) { return (mapping && mapping[k] && mapping[k].unit) || (M.byKey[k] && M.byKey[k].unit) || ''; };
  /* unidad canónica tras conversión */
  M.canonUnit = function (k) {
    var v = M.byKey[k]; if (!v) return '';
    if (k === 'CARGA') return 'kW';
    return v.unit || '';
  };

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
      .replace(/[_\-\/\\.,;:()\[\]{}#°%*+]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  M.norm = norm;
  function splitUnit(h) {
    var s = String(h == null ? '' : h), unit = '';
    var m = /[\(\[]([^\)\]]+)[\)\]]/.exec(s);
    if (m) { unit = m[1]; s = s.replace(m[0], ' '); }
    return { base: norm(s), unit: String(unit).toLowerCase().replace(/\s/g, '').replace('²', '2').replace('^2', '2') };
  }
  M.splitUnit = splitUnit;

  function unitHint(unit, rawHeader) {
    var u = unit || '', h = String(rawHeader || '').toLowerCase();
    if (/w\/?m2|wm-?2|w\/m²|wh\/m2/.test(u) || /w\/m2|w\/m²|wm2/.test(h)) return 'irr';
    if (/^kw\/?m2/.test(u)) return 'irr';
    if (/^(°?c|degc|ºc|deg c|k|°f)$/.test(u)) return 'temp';
    if (/^(kwh|wh|mwh)$/.test(u)) return 'energy';
    if (/^(kw|w|mw|kwac|kwdc)$/.test(u)) return 'power';
    if (/^(m\/s|km\/h|kn|kt|ms-?1)$/.test(u)) return 'speed';
    if (/^(hpa|kpa|pa|mbar|mb|mmhg)$/.test(u)) return 'pres';
    if (/^(mm|mm\/h|mm\/hr|mm\/day)$/.test(u)) return 'precip';
    if (/^(deg|°|grados|degrees)$/.test(u)) return 'deg';
    if (u === '%') return 'pct';
    return '';
  }
  var HINT_OK = {
    IRRADIANCIA: 'irr', IRR_POA: 'irr', DNI: 'irr', DHI: 'irr', TEMPERATURA: 'temp', POTENCIA_FV: 'power', ENERGIA_FV: 'energy',
    VEL_VIENTO: 'speed', PRESION: 'pres', PRECIPITACION: 'precip', DIR_VIENTO: 'deg', HUMEDAD: 'pct', SOC: 'pct', CARGA: 'power'
  };

  function tokens(s) { return s ? s.split(' ') : []; }
  function containsSeq(hay, needle) {
    if (!needle.length || needle.length > hay.length) return false;
    for (var i = 0; i + needle.length <= hay.length; i++) {
      var ok = true;
      for (var j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  /* Puntaje de nombre (0-100+) */
  function nameScore(v, header) {
    var su = splitUnit(header), base = su.base, bt = tokens(base);
    var joined = base.replace(/ /g, '');
    var best = 0;
    for (var i = 0; i < v.syn.length; i++) {
      var syn = norm(v.syn[i]), st = tokens(syn), sc = 0;
      if (base === syn || joined === syn.replace(/ /g, '')) sc = 100;
      else if (containsSeq(bt, st)) sc = 62 + Math.round(24 * st.join(' ').length / Math.max(base.length, 1));
      else if (syn.length >= 4 && bt.some(function (t) { return t.indexOf(syn.replace(/ /g, '')) === 0 && t.length <= syn.length + 3; })) sc = 58;
      if (sc > best) best = sc;
    }
    if (best > 0 && v.neg) {
      for (var n = 0; n < v.neg.length; n++) {
        var ng = norm(v.neg[n]);
        if (containsSeq(bt, tokens(ng)) && !v.syn.some(function (s) { return norm(s) === base; })) { best -= 45; break; }
      }
    }
    var hint = unitHint(su.unit, header);
    if (hint && best > 0) {
      if (HINT_OK[v.key] === hint) best += 12;
      else if (HINT_OK[v.key] && !(v.key === 'CARGA' && hint === 'energy')) best -= 30;
    }
    return best;
  }

  /* Plausibilidad del contenido (multiplicador 0..1) */
  function contentFactor(key, sample) {
    var nums = [], dates = 0, times = 0, texts = 0, nonEmpty = 0;
    for (var i = 0; i < sample.length; i++) {
      var v = sample[i];
      if (U.isEmpty(v)) continue;
      nonEmpty++;
      var k = U.valueKind(v);
      if (k === 'date') dates++;
      else if (k === 'time') times++;
      else if (k === 'number') nums.push(U.parseNumber(v));
      else texts++;
    }
    if (!nonEmpty) return 0.2;
    var fNum = nums.length / nonEmpty;
    var mm = U.minmax(nums.filter(function (x) { return x > -900; }));
    var ints = nums.filter(function (x) { return Math.abs(x - Math.round(x)) < 1e-9; }).length;
    switch (key) {
      case 'FECHA':
        if ((dates + (sample[0] instanceof Date ? 1 : 0)) / nonEmpty > 0.6) return 1;
        if (fNum > 0.8 && mm[0] > 19000101 && mm[1] < 21001231) return 0.9;
        if (fNum > 0.8 && mm[0] > 20000 && mm[1] < 80000) return 0.8;
        return 0.15;
      case 'HORA':
        if (times / nonEmpty > 0.6) return 1;
        if (dates / nonEmpty > 0.6) return 0.7;
        if (fNum > 0.8 && mm[0] >= 0 && mm[1] <= 24 && ints / Math.max(1, nums.length) > 0.95) return 1;
        if (fNum > 0.8 && mm[0] >= 0 && mm[1] < 1) return 0.9;
        return 0.1;
      case 'ANIO': return fNum > 0.8 && mm[0] >= 1900 && mm[1] <= 2200 && ints === nums.length ? 1 : 0.1;
      case 'MES_C': return fNum > 0.8 && mm[0] >= 1 && mm[1] <= 12 && ints === nums.length ? 1 : 0.1;
      case 'DIA_C': return fNum > 0.8 && mm[0] >= 1 && mm[1] <= 31 && ints === nums.length ? 1 : 0.1;
      case 'DOY_C': return fNum > 0.8 && mm[0] >= 1 && mm[1] <= 366 && ints === nums.length ? 1 : 0.1;
      case 'HUMEDAD': if (fNum < 0.5) return 0.2; return (mm[1] <= 105 && (mm[1] > 24 || ints < nums.length)) || (mm[1] <= 1.0 && mm[0] >= 0) ? 1 : 0.3;
      case 'DIR_VIENTO': return fNum > 0.5 && mm[0] >= -1 && mm[1] <= 361 ? 1 : 0.3;
      case 'SOC': return fNum > 0.5 && mm[0] >= -1 && mm[1] <= 101 ? 1 : 0.3;
      default: return fNum >= 0.5 ? 1 : 0.25;
    }
  }

  /* Mapeo automático: devuelve {KEY: {col, score, status, unit, auto:true}} */
  M.autoMap = function (headers, rows) {
    var sampleRows = rows.slice(0, 400);
    var colSamples = headers.map(function (_, c) { return sampleRows.map(function (r) { return r[c]; }); });
    var cands = [];
    M.VARS.forEach(function (v) {
      headers.forEach(function (h, c) {
        var ns = nameScore(v, h);
        if (ns < 45) return;
        var cf = contentFactor(v.key, colSamples[c]);
        var sc = ns * cf;
        if (sc >= 42) cands.push({ key: v.key, col: c, score: sc });
      });
    });
    cands.sort(function (a, b) { return b.score - a.score; });
    var map = {}, usedCol = {};
    cands.forEach(function (cd) {
      if (map[cd.key] || usedCol[cd.col]) return;
      map[cd.key] = { col: cd.col, score: Math.round(cd.score), auto: true };
      usedCol[cd.col] = true;
    });
    /* Coherencia de tiempo: una columna "Time"/"Hora" que contiene fecha-hora completa se usa como FECHA */
    if (!map.FECHA && map.HORA) {
      var hs = colSamples[map.HORA.col], nd = 0, ne = 0;
      hs.forEach(function (v) { if (!U.isEmpty(v)) { ne++; if (U.valueKind(v) === 'date') nd++; } });
      if (ne && nd / ne > 0.6) { map.FECHA = { col: map.HORA.col, score: 90, auto: true }; delete map.HORA; }
    }
    M.VARS.forEach(function (v) {
      if (!map[v.key]) map[v.key] = { col: -1, score: 0, auto: true };
      var e = map[v.key];
      e.status = e.col < 0 ? 'none' : (e.score >= 85 ? 'ok' : 'check');
      if (v.units) e.unit = e.col >= 0 ? M.detectUnit(v.key, headers[e.col], colSamples[e.col]) : v.unit;
    });
    return map;
  };

  M.detectUnit = function (key, header, sample) {
    var su = splitUnit(header), u = su.unit, v = M.byKey[key];
    var nums = U.finite((sample || []).map(U.parseNumber)).filter(function (x) { return x > -900; });
    var mm = U.minmax(nums), med = U.quantile(nums, 0.5);
    switch (key) {
      case 'POTENCIA_FV':
      case 'CARGA':
        if (/^mw/.test(u)) return 'MW';
        if (/^kw/.test(u)) return key === 'CARGA' && /kwh/.test(u) ? 'kWh' : 'kW';
        if (/^w$|^wac$|^wdc$/.test(u)) return 'W';
        if (key === 'CARGA' && /kwh/.test(u)) return 'kWh';
        return 'kW';
      case 'ENERGIA_FV':
        if (/^mwh/.test(u)) return 'MWh';
        if (/^wh/.test(u)) return 'Wh';
        return 'kWh';
      case 'IRRADIANCIA': case 'IRR_POA': case 'DNI': case 'DHI':
        if (/^kw/.test(u)) return 'kW/m²';
        if (!u && isFinite(mm[1]) && mm[1] > 0 && mm[1] <= 1.6) return 'kW/m²';
        return 'W/m²';
      case 'TEMPERATURA':
        if (u === 'k' || (isFinite(med) && med > 200)) return 'K';
        if (/f$/.test(u) && u !== '') return '°F';
        return '°C';
      case 'PRESION':
        if (/kpa/.test(u) || (isFinite(med) && med > 50 && med < 120)) return 'kPa';
        if (/mmhg/.test(u) || (isFinite(med) && med > 500 && med < 800)) return 'mmHg';
        if (/^pa$/.test(u) || (isFinite(med) && med > 50000)) return 'Pa';
        return 'hPa';
      case 'VEL_VIENTO':
        if (/km/.test(u)) return 'km/h';
        if (/^(kn|kt|knots)$/.test(u)) return 'kn';
        return 'm/s';
      case 'HUMEDAD':
        if (isFinite(mm[1]) && mm[1] <= 1.0 && mm[0] >= 0) return 'fracción';
        return '%';
      default: return v && v.unit ? v.unit : '';
    }
  };

  /* Factor/función de conversión a la unidad canónica */
  M.converter = function (key, unit) {
    switch (unit) {
      case 'W': return function (x) { return x / 1000; };
      case 'MW': return function (x) { return x * 1000; };
      case 'Wh': return function (x) { return x / 1000; };
      case 'MWh': return function (x) { return x * 1000; };
      case 'kW/m²': return function (x) { return x * 1000; };
      case 'K': return function (x) { return x - 273.15; };
      case '°F': return function (x) { return (x - 32) * 5 / 9; };
      case 'kPa': return function (x) { return x * 10; };
      case 'Pa': return function (x) { return x / 100; };
      case 'mmHg': return function (x) { return x * 1.33322; };
      case 'km/h': return function (x) { return x / 3.6; };
      case 'kn': return function (x) { return x * 0.514444; };
      case 'fracción': return function (x) { return x * 100; };
      default: return null;
    }
  };

  /* Estado del mapeo: requisitos mínimos */
  M.check = function (map) {
    var has = function (k) { return map[k] && map[k].col >= 0; };
    var timeOk = has('FECHA') || (has('ANIO') && has('MES_C') && has('DIA_C')) || (has('ANIO') && has('DOY_C'));
    var targetOk = has('POTENCIA_FV') || has('ENERGIA_FV');
    var irrOk = has('IRRADIANCIA') || has('IRR_POA') || has('DNI') || has('DHI');
    var msgs = [];
    if (!timeOk) msgs.push('Falta la variable de tiempo: asigne FECHA (o AÑO + MES + DÍA, o AÑO + DÍA DEL AÑO).');
    if (!targetOk) msgs.push('Falta la variable objetivo: asigne POTENCIA FV o ENERGÍA FV.');
    if (!irrOk) msgs.push('Se recomienda al menos una variable de radiación (GHI, POA, DNI o DHI) para entrenar el modelo.');
    var feats = M.METEO.filter(has).length;
    return { ok: timeOk && targetOk, timeOk: timeOk, targetOk: targetOk, irrOk: irrOk, nFeatures: feats, msgs: msgs };
  };
  M.targetKey = function (map) { return map.POTENCIA_FV && map.POTENCIA_FV.col >= 0 ? 'POTENCIA_FV' : (map.ENERGIA_FV && map.ENERGIA_FV.col >= 0 ? 'ENERGIA_FV' : null); };
})();
