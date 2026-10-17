/* ==========================================================================
   demo.js — Generador de DATOS SINTÉTICOS DE DEMOSTRACIÓN (La Guajira).
   ⚠ NO SON DATOS REALES. Sirven solo para demostrar el funcionamiento de la
   aplicación cuando el usuario no dispone de datos.

   Modelo físico simplificado (documentado):
   - Geometría solar (declinación de Cooper, ecuación del tiempo, lat 11.54 N,
     lon 72.91 W, meridiano estándar 75 W).
   - Cielo despejado: modelo de Haurwitz  GHI_cs = 1098·cosZ·exp(−0.057/cosZ).
   - Nubosidad: índice de cielo claro diario AR(1) con estacionalidad bimodal
     de lluvias (abr–may y sep–nov) y convección vespertina.
   - Separación directa/difusa: correlación de Erbs.
   - Temperatura con ciclo diurno; humedad relacionada con temperatura y
     lluvia; viento alisio con máximos dic–abr y julio (veranillo).
   - Potencia FV: 20 kWp inclinados 10° al sur (irradiancia POA isotrópica),
     inversor 17 kW AC, temperatura de celda de Faiman, coeficiente
     −0.37 %/°C, pérdidas 13 %, suciedad que se limpia con lluvia, fallas
     parciales ocasionales y ruido de medición.
   - Consumo con perfil diario (~35 kWh nocturnos) y batería de 80 kWh.
   - Se inyectan problemas de calidad controlados (faltantes, duplicados,
     negativos, picos imposibles, sensor congelado, discontinuidad temporal,
     texto no numérico, inconsistencias irradiancia–potencia) para demostrar
     la validación y la limpieza.
   Funciona en navegador y en Node.js (para generar los archivos de /data).
   ========================================================================== */
(function (root) {
  'use strict';
  var Demo = {};

  function rng(seed) {
    var a = seed >>> 0;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.n = function () { var u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return f;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r2(v, d) { var k = Math.pow(10, d); return Math.round(v * k) / k; }
  var D2R = Math.PI / 180;

  Demo.SYSTEM = { kwp: 20, inverterKw: 17, batteryKwh: 80, lat: 11.54, lon: -72.91, place: 'La Guajira, Colombia' };

  /* Genera registros horarios limpios (objetos) */
  Demo.generateClean = function (opts) {
    opts = opts || {};
    var R = rng(opts.seed || 20250101);
    var year = opts.year || 2025;
    var days = opts.days || 365;
    var lat = Demo.SYSTEM.lat * D2R, lon = Demo.SYSTEM.lon;
    var out = [];
    var dayK = 0, hn = 0, E = 0.6 * Demo.SYSTEM.batteryKwh;
    var tilt = 10 * D2R, soil = 1, prevRain = 0;
    var t0 = Date.UTC(year, 0, 1);
    for (var d = 0; d < days; d++) {
      var dayStart = t0 + d * 86400000;
      var dt = new Date(dayStart);
      var doy = Math.floor((dayStart - Date.UTC(dt.getUTCFullYear(), 0, 1)) / 86400000) + 1;
      var rain = 0.04 + 0.34 * Math.exp(-Math.pow((doy - 135) / 22, 2)) + 0.62 * Math.exp(-Math.pow((doy - 290) / 32, 2));
      var rainyDay = R() < 0.06 + 0.6 * rain;
      dayK = 0.6 * dayK + 0.4 * R.n();
      var kcDay = clamp(0.93 - 0.42 * rain - (rainyDay ? 0.2 : 0) + 0.07 * dayK, 0.22, 1.0);
      var tMean = 28.3 + 0.9 * Math.cos(2 * Math.PI * (doy - 240) / 365) - (rainyDay ? 0.9 : 0) + 0.4 * R.n();
      var wBase = Math.max(1.5, 6.8 + 2.4 * Math.cos(2 * Math.PI * (doy - 40) / 365) + 1.2 * Math.exp(-Math.pow((doy - 195) / 22, 2)) - 1.6 * rain + 0.8 * R.n());
      var psDay = 1010.8 - 1.4 * rain + 0.5 * R.n();
      var weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
      var decl = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * D2R;
      var B = 2 * Math.PI * (doy - 81) / 364;
      var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      var E0 = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
      /* suciedad de módulos: pérdida 0.12 %/día, limpieza con lluvia ≥ 4 mm */
      soil = prevRain >= 4 ? 1 : Math.max(0.9, soil - 0.0012);
      var derate = R() < 0.02 ? 0.85 : 1; /* falla parcial de string (2 % de los días) */
      var dayRain = 0;
      for (var h = 0; h < 24; h++) {
        var tSolar = h + 0.5 + (4 * (lon + 75) + eot) / 60;
        var w = 15 * (tSolar - 12) * D2R;
        var cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(w);
        hn = 0.7 * hn + 0.3 * R.n();
        var conv = (h >= 13 && h <= 18) ? rain * 0.28 : 0;
        var rainHour = rainyDay && h >= 12 && h <= 20 && R() < 0.3;
        var ghi = 0, dni = 0, dhi = 0;
        if (cosZ > 0.01) {
          var cs = 1098 * cosZ * Math.exp(-0.057 / cosZ);
          var kc = clamp(kcDay + 0.13 * hn - conv - (rainHour ? 0.45 : 0), 0.06, 1.05);
          ghi = cs * kc;
          var kt = clamp(ghi / (1367 * E0 * cosZ), 0, 1);
          var df = kt <= 0.22 ? 1 - 0.09 * kt : kt <= 0.8 ? 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * Math.pow(kt, 3) + 12.336 * Math.pow(kt, 4) : 0.165;
          dhi = df * ghi;
          dni = clamp((ghi - dhi) / cosZ, 0, 1000);
        }
        var A = 3.0 * (0.55 + 0.45 * kcDay);
        var temp = tMean + A * Math.cos(2 * Math.PI * (h - 14) / 24) + 0.0025 * ghi - (rainHour ? 1.5 : 0) + 0.25 * R.n();
        var rh = clamp(74 - 2.9 * (temp - 28.3) + 14 * rain + (rainHour ? 12 : 0) + (rainyDay ? 5 : 0) + 2.5 * R.n(), 38, 100);
        var ws = Math.max(0.3, wBase * (0.72 + 0.5 * Math.exp(-Math.pow((h - 14) / 4.5, 2))) + 0.9 * R.n());
        var wd = ((70 + 12 * R.n() + (rainHour ? 60 * R.n() : 0)) % 360 + 360) % 360;
        var ps = psDay + 0.9 * Math.cos(2 * Math.PI * (h - 10) / 12) + 0.15 * R.n();
        var prec = rainHour ? r2(-Math.log(R() + 1e-9) * 3.2, 1) : 0;
        dayRain += prec;
        /* irradiancia en el plano (10° al sur, modelo isotrópico) */
        var cosT = Math.sin(decl) * Math.sin(lat - tilt) + Math.cos(decl) * Math.cos(lat - tilt) * Math.cos(w);
        var poa = ghi > 0 ? Math.max(0, dni * Math.max(0, cosT)) + dhi * (1 + Math.cos(tilt)) / 2 + ghi * 0.2 * (1 - Math.cos(tilt)) / 2 : 0;
        var tcell = temp + poa / (25 + 6.84 * ws);
        var pdc = Demo.SYSTEM.kwp * poa / 1000 * (1 - 0.0037 * (tcell - 25)) * 0.87 * soil * derate;
        var pac = Math.min(Demo.SYSTEM.inverterKw, pdc * 0.975);
        if (ghi > 0) pac = pac * (1 + 0.02 * R.n()) + 0.1 * R.n();
        if (pac < 0.05) pac = 0;
        var baseLoad = h <= 5 ? 2.3 : h === 6 ? 2.8 : h <= 11 ? 3.3 : h <= 16 ? 3.6 : h === 17 ? 3.4 : h === 18 ? 3.9 : h <= 21 ? 4.3 : 3.0;
        var load = Math.max(0.8, baseLoad * (weekend ? 0.93 : 1) + 0.3 * R.n());
        /* batería simple (eficiencia 95 % por sentido, SOC mínimo 20 %) */
        var cap = Demo.SYSTEM.batteryKwh, before = E, net = pac - load;
        if (net > 0) E = Math.min(cap, E + net * 0.95);
        else E = Math.max(0.2 * cap, E + net / 0.95);
        out.push({
          t: dayStart + h * 3600000,
          ghi: r2(ghi, 1), dni: r2(dni, 1), dhi: r2(dhi, 1), temp: r2(temp, 2), rh: r2(rh, 1), ws: r2(ws, 2), wd: r2(wd, 0),
          ps: r2(ps, 1), prec: prec, pv: r2(pac, 3), load: r2(load, 3), soc: r2(E / cap * 100, 1), pbat: r2(E - before, 3)
        });
      }
      prevRain = dayRain;
    }
    return out;
  };

  /* Inyecta problemas de calidad controlados (documentados en el registro) */
  Demo.injectIssues = function (recs, seed) {
    var R = rng(seed || 777);
    var n = recs.length;
    var pick = function (filter, k) {
      var res = [], guard = 0;
      while (res.length < k && guard++ < 200000) {
        var i = Math.floor(R() * n);
        if (filter(recs[i], i) && res.indexOf(i) < 0) res.push(i);
      }
      return res;
    };
    var hourOf = function (r) { return new Date(r.t).getUTCHours(); };
    var issues = [];
    /* 12 irradiancias negativas nocturnas (offset del piranómetro) */
    pick(function (r) { var h = hourOf(r); return r.ghi === 0 && (h >= 18 && h <= 21); }, 12).forEach(function (i) { recs[i].ghi = -r2(1 + R() * 3, 1); });
    issues.push('12 irradiancias negativas nocturnas');
    /* picos imposibles de irradiancia */
    pick(function (r) { return r.ghi > 400; }, 3).forEach(function (i, k) { recs[i].ghi = [1850, 2600, 1720][k]; });
    issues.push('3 picos de irradiancia físicamente imposibles');
    /* temperatura / humedad imposibles */
    pick(function () { return true; }, 2).forEach(function (i, k) { recs[i].temp = [85.4, -45][k]; });
    pick(function () { return true; }, 1).forEach(function (i) { recs[i].rh = 112; });
    issues.push('2 temperaturas y 1 humedad imposibles');
    /* sensor de temperatura congelado 9 h */
    var fz = 24 * 150 + 8;
    for (var f = 0; f < 9; f++) recs[fz + f].temp = 27.4;
    issues.push('Sensor de temperatura congelado 9 h');
    /* inversor detenido con sol (inconsistencia irradiancia–potencia) */
    var trip = 24 * 201 + 10;
    for (var q = 0; q < 5; q++) recs[trip + q].pv = 0;
    issues.push('Inversor detenido 5 h con irradiancia alta');
    /* potencia negativa nocturna (autoconsumo del inversor) */
    pick(function (r) { var h = hourOf(r); return r.pv === 0 && (h <= 4 || h >= 20); }, 60).forEach(function (i) { recs[i].pv = -0.02; });
    issues.push('60 potencias nocturnas levemente negativas');
    /* picos atípicos de potencia (error de comunicación) */
    pick(function (r) { return r.pv > 3; }, 2).forEach(function (i) { recs[i].pv = 48.7; });
    issues.push('2 picos atípicos de potencia');
    /* 37 valores faltantes */
    var miss = { temp: 12, rh: 10, ws: 8, ps: 7 };
    Object.keys(miss).forEach(function (k) { pick(function (r) { return r[k] != null; }, miss[k]).forEach(function (i) { recs[i][k] = null; }); });
    issues.push('37 valores faltantes');
    /* 3 textos no numéricos */
    pick(function (r) { return r.ws != null; }, 3).forEach(function (i) { recs[i].ws = 'ERR'; });
    issues.push('3 lecturas de viento no numéricas ("ERR")');
    /* discontinuidad temporal: 6 horas sin registro */
    var gap = 24 * 250 + 3;
    recs.splice(gap, 6);
    issues.push('Discontinuidad de 6 h sin registros');
    /* 4 duplicados */
    var dups = pick(function (r, i) { return i > 100 && i < recs.length - 100; }, 4).sort(function (a, b) { return b - a; });
    dups.forEach(function (i) { recs.splice(i + 1, 0, Object.assign({}, recs[i])); });
    issues.push('4 registros duplicados');
    return issues;
  };

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function hstr(t) { var d = new Date(t); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); }

  Demo.HEADERS = ['Fecha', 'Hora', 'GHI (W/m2)', 'DNI (W/m2)', 'DHI (W/m2)', 'Temp (°C)', 'RH (%)', 'WS10 (m/s)', 'WD10 (°)', 'Presion (hPa)', 'Precipitacion (mm)', 'PV Power (kW)', 'Carga (kW)', 'SOC (%)'];
  Demo.toTable = function (recs) {
    return {
      headers: Demo.HEADERS.slice(),
      rows: recs.map(function (r) { return [dstr(r.t), hstr(r.t), r.ghi, r.dni, r.dhi, r.temp, r.rh, r.ws, r.wd, r.ps, r.prec, r.pv, r.load, r.soc]; })
    };
  };
  /* Tabla lista para la aplicación (1 año horario con problemas inyectados) */
  Demo.table = function (opts) {
    var recs = Demo.generateClean(opts);
    var issues = Demo.injectIssues(recs, (opts && opts.issueSeed) || 777);
    var tb = Demo.toTable(recs);
    tb.issues = issues;
    return tb;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Demo;
  if (root) { root.SEDA = root.SEDA || {}; root.SEDA.Demo = Demo; }
})(typeof window !== 'undefined' ? window : null);
