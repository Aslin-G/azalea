/* ==========================================================================
   solar.js — Geometría solar y modelos físicos fotovoltaicos (SEDA.Solar).
   Referencias: Duffie & Beckman, "Solar Engineering of Thermal Processes"
   (declinación y ecuación del tiempo de Spencer, ángulo de incidencia,
   distribución horaria de Collares-Pereira & Rabl y Liu & Jordan,
   descomposición difusa de Erbs, transposición de Hay–Davies), temperatura
   de celda con NOCT y viento, modificador de ángulo de incidencia ASHRAE.
   Convención de acimut de superficie (γ): 0° = hacia el ecuador,
   negativo = hacia el este, positivo = hacia el oeste (se convierte al
   sistema de Duffie según el hemisferio).
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var Sol = SEDA.Solar = {};
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  Sol.RAD = RAD; Sol.DEG = DEG;
  Sol.GSC = 1367; /* W/m² constante solar */
  /* días característicos de cada mes (Klein) */
  Sol.MONTH_DAYS = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
  Sol.DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function B(doy) { return 2 * Math.PI * (doy - 1) / 365; }
  /* Declinación (rad) — Spencer */
  Sol.decl = function (doy) {
    var b = B(doy);
    return 0.006918 - 0.399912 * Math.cos(b) + 0.070257 * Math.sin(b) - 0.006758 * Math.cos(2 * b) + 0.000907 * Math.sin(2 * b) - 0.002697 * Math.cos(3 * b) + 0.00148 * Math.sin(3 * b);
  };
  /* Ecuación del tiempo (min) — Spencer */
  Sol.eot = function (doy) {
    var b = B(doy);
    return 229.18 * (0.000075 + 0.001868 * Math.cos(b) - 0.032077 * Math.sin(b) - 0.014615 * Math.cos(2 * b) - 0.04089 * Math.sin(2 * b));
  };
  /* Irradiancia extraterrestre normal (W/m²) */
  Sol.G0n = function (doy) { return Sol.GSC * (1 + 0.033 * Math.cos(2 * Math.PI * doy / 365)); };
  /* Hora solar a partir de la hora local estándar */
  Sol.solarHour = function (localHour, lon, utcOffset, doy) {
    return localHour + (4 * (lon - 15 * utcOffset) + Sol.eot(doy)) / 60;
  };
  /* Ángulo de puesta de sol ωs (rad) */
  Sol.ws = function (latR, d) { return Math.acos(Math.max(-1, Math.min(1, -Math.tan(latR) * Math.tan(d)))); };
  /* Irradiación extraterrestre diaria sobre horizontal (kWh/m²·día) */
  Sol.H0 = function (latDeg, doy) {
    var lat = latDeg * RAD, d = Sol.decl(doy), ws = Sol.ws(lat, d);
    return 24 / Math.PI * Sol.G0n(doy) / 1000 * (Math.cos(lat) * Math.cos(d) * Math.sin(ws) + ws * Math.sin(lat) * Math.sin(d));
  };
  /* Posición del sol. hourSolar: hora solar verdadera (h). Devuelve cenit, elevación y acimut (Duffie: 0 = sur, oeste +) */
  Sol.posSolar = function (latDeg, doy, hourSolar) {
    var lat = latDeg * RAD, d = Sol.decl(doy), w = 15 * (hourSolar - 12) * RAD;
    var cz = Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(w);
    cz = Math.max(-1, Math.min(1, cz));
    var z = Math.acos(cz), sz = Math.sin(z);
    var ca = sz > 1e-6 && Math.abs(Math.cos(lat)) > 1e-9 ? (cz * Math.sin(lat) - Math.sin(d)) / (sz * Math.cos(lat)) : 1;
    var az = (w < 0 ? -1 : 1) * Math.abs(Math.acos(Math.max(-1, Math.min(1, ca))));
    return { cosZ: cz, zen: z, elev: Math.PI / 2 - z, az: az, w: w, decl: d };
  };
  Sol.pos = function (latDeg, lonDeg, utcOffset, doy, localHour) {
    return Sol.posSolar(latDeg, doy, Sol.solarHour(localHour, lonDeg, utcOffset, doy));
  };
  /* Acimut de superficie en convención de Duffie a partir de "0 = hacia el ecuador" */
  Sol.surfAzDuffie = function (latDeg, azEq) { return (latDeg >= 0 ? azEq : 180 - azEq) * RAD; };

  /* Fracción difusa horaria de Erbs */
  Sol.erbs = function (kt) {
    if (kt <= 0.22) return 1 - 0.09 * kt;
    if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * Math.pow(kt, 3) + 12.336 * Math.pow(kt, 4);
    return 0.165;
  };
  /* Fracción difusa mensual de Erbs (Hd/H) */
  Sol.erbsMonthly = function (KT, wsRad) {
    var wsd = wsRad * DEG;
    if (wsd <= 81.4) return U3(1.391 - 3.560 * KT + 4.189 * KT * KT - 2.137 * KT * KT * KT);
    return U3(1.311 - 3.022 * KT + 3.427 * KT * KT - 1.821 * KT * KT * KT);
  };
  function U3(v) { return Math.max(0.05, Math.min(1, v)); }

  /* Transposición al plano del arreglo (Hay–Davies) para un instante.
     inp: {ghi, dni?, dhi?, pos (de Sol.pos), doy, tilt (°), surfAz (rad Duffie), albedo}
     Devuelve {poa, beam, diff, refl, cosI} en W/m² */
  Sol.poa = function (inp) {
    var ghi = Math.max(0, inp.ghi || 0), p = inp.pos, cz = p.cosZ;
    if (ghi <= 0 || cz <= 0.0175) return { poa: 0, beam: 0, diff: 0, refl: 0, cosI: 0, dni: 0, dhi: ghi };
    var g0n = Sol.G0n(inp.doy), dni = inp.dni, dhi = inp.dhi;
    if (!(dni >= 0) || !(dhi >= 0)) {
      var kt = Math.min(1, ghi / (g0n * cz));
      dhi = ghi * Sol.erbs(kt);
      dni = Math.max(0, (ghi - dhi) / Math.max(cz, 0.065));
    }
    dni = Math.min(dni, g0n);
    var beta = inp.tilt * RAD, gam = inp.surfAz || 0;
    var cosI = cz * Math.cos(beta) + Math.sin(p.zen) * Math.sin(beta) * Math.cos(p.az - gam);
    var rb = Math.max(0, cosI) / Math.max(cz, 0.0872);
    var ai = Math.min(1, dni / g0n);
    var beam = dni * Math.max(0, cosI);
    var diff = dhi * ((1 - ai) * (1 + Math.cos(beta)) / 2 + ai * rb);
    var refl = ghi * (inp.albedo == null ? 0.2 : inp.albedo) * (1 - Math.cos(beta)) / 2;
    return { poa: beam + diff + refl, beam: beam, diff: diff, refl: refl, cosI: cosI, dni: dni, dhi: dhi };
  };
  /* Modificador de ángulo de incidencia (ASHRAE, b0 = 0.05) aplicado a la componente directa */
  Sol.iam = function (cosI, b0) {
    if (cosI <= 0.035) return 0;
    return Math.max(0, 1 - (b0 == null ? 0.05 : b0) * (1 / cosI - 1));
  };
  /* Temperatura de celda (NOCT con corrección por viento; Duffie & Beckman ec. 23.3.3) */
  Sol.tCell = function (tAmb, gPoa, noct, ws, eff) {
    var v = isFinite(ws) ? Math.max(0, ws) : 1;
    return tAmb + gPoa / 800 * ((noct || 45) - 20) * (1 - (eff || 0.2) / 0.9) * (9.5 / (5.7 + 3.8 * v));
  };

  /* Distribución horaria de un día medio (Collares-Pereira & Rabl / Liu & Jordan).
     Devuelve 24 valores de irradiancia horaria media (W/m²) GHI y DHI para un día con H (kWh/m²·d). */
  Sol.synthDay = function (latDeg, doy, H, Hd) {
    var lat = latDeg * RAD, d = Sol.decl(doy), ws = Sol.ws(lat, d);
    var a = 0.409 + 0.5016 * Math.sin(ws - 60 * RAD), b = 0.6609 - 0.4767 * Math.sin(ws - 60 * RAD);
    var den = Math.sin(ws) - ws * Math.cos(ws);
    var ghi = new Array(24), dhi = new Array(24), sumT = 0, sumD = 0;
    for (var h = 0; h < 24; h++) {
      /* integración con 6 sub-pasos por hora (hora solar) */
      var accT = 0, accD = 0;
      for (var k = 0; k < 6; k++) {
        var hs = h + (k + 0.5) / 6, w = 15 * (hs - 12) * RAD;
        if (Math.cos(w) <= Math.cos(ws) || den <= 0) continue;
        var rd = Math.PI / 24 * (Math.cos(w) - Math.cos(ws)) / den;
        var rt = rd * (a + b * Math.cos(w));
        accT += rt; accD += rd;
      }
      ghi[h] = accT / 6; dhi[h] = accD / 6;
      sumT += ghi[h]; sumD += dhi[h];
    }
    /* normalización para conservar exactamente H y Hd */
    for (var i = 0; i < 24; i++) {
      ghi[i] = sumT > 0 ? ghi[i] / sumT * H * 1000 : 0;
      dhi[i] = sumD > 0 ? Math.min(ghi[i], dhi[i] / sumD * Hd * 1000) : 0;
    }
    return { ghi: ghi, dhi: dhi, ws: ws };
  };

  /* Irradiación media diaria en el plano para cada mes a partir de GHI mensual (kWh/m²·d).
     Opcional: dhiM (kWh/m²·d) medido; si falta se usa Erbs mensual. Devuelve {poa[12], ghi[12], ratio[12]} */
  Sol.monthlyPOA = function (latDeg, ghiM, tilt, azEq, albedo, dhiM) {
    var out = { poa: [], ghi: [], ratio: [] }, gam = Sol.surfAzDuffie(latDeg, azEq || 0);
    for (var m = 0; m < 12; m++) {
      var H = ghiM[m], doy = Sol.MONTH_DAYS[m];
      if (!(H > 0)) { out.poa.push(NaN); out.ghi.push(H); out.ratio.push(NaN); continue; }
      var lat = latDeg * RAD, d = Sol.decl(doy), ws = Sol.ws(lat, d), H0 = Sol.H0(latDeg, doy);
      var KT = Math.min(0.85, H / Math.max(H0, 0.01));
      var Hd = dhiM && dhiM[m] > 0 ? Math.min(H, dhiM[m]) : H * Sol.erbsMonthly(KT, ws);
      var day = Sol.synthDay(latDeg, doy, H, Hd), sum = 0;
      for (var h = 0; h < 24; h++) {
        if (day.ghi[h] <= 0) continue;
        var pos = Sol.posSolar(latDeg, doy, h + 0.5);
        var dni = pos.cosZ > 0.0175 ? Math.max(0, (day.ghi[h] - day.dhi[h]) / Math.max(pos.cosZ, 0.065)) : 0;
        sum += Sol.poa({ ghi: day.ghi[h], dni: dni, dhi: day.dhi[h], pos: pos, doy: doy, tilt: tilt, surfAz: gam, albedo: albedo }).poa;
      }
      out.poa.push(sum / 1000); out.ghi.push(H); out.ratio.push(sum / 1000 / H);
    }
    return out;
  };
  /* Anual (kWh/m²·año) a partir de medias diarias mensuales */
  Sol.annual = function (m) { var s = 0; for (var i = 0; i < 12; i++) if (isFinite(m[i])) s += m[i] * Sol.DAYS_IN_MONTH[i]; return s; };
  /* Inclinación óptima (máxima irradiación anual en el plano) */
  Sol.optimalTilt = function (latDeg, ghiM, azEq, albedo, dhiM) {
    var best = { tilt: 0, annual: -1 }, base = null, curve = [];
    for (var t = 0; t <= 60; t += 1) {
      var a = Sol.annual(Sol.monthlyPOA(latDeg, ghiM, t, azEq, albedo, dhiM).poa);
      curve.push([t, a]);
      if (t === 0) base = a;
      if (a > best.annual) best = { tilt: t, annual: a };
    }
    best.horizontal = base; best.gain = base > 0 ? best.annual / base - 1 : 0; best.curve = curve;
    return best;
  };
  /* Salida / puesta del sol (hora local estándar) */
  Sol.sunTimes = function (latDeg, lonDeg, utcOffset, doy) {
    var d = Sol.decl(doy), ws = Sol.ws(latDeg * RAD, d) * DEG / 15;
    var corr = (4 * (lonDeg - 15 * utcOffset) + Sol.eot(doy)) / 60;
    return { rise: 12 - ws - corr, set: 12 + ws - corr, dayLen: 2 * ws };
  };
  /* Separación mínima libre entre filas (m) para evitar sombra entre 9:00 y 15:00 (hora solar) en ambos solsticios.
     L: longitud inclinada del módulo/mesa (m), tilt (°), azEq (°). */
  Sol.rowSpacing = function (latDeg, L, tilt, azEq) {
    var h = L * Math.sin(tilt * RAD), gam = Sol.surfAzDuffie(latDeg, azEq || 0), worst = { gap: 0 };
    [172, 355].forEach(function (doy) {
      [9, 15].forEach(function (hs) {
        var p = Sol.posSolar(latDeg, doy, hs);
        if (p.elev <= 2 * RAD) return;
        var gap = h * Math.abs(Math.cos(p.az - gam)) / Math.tan(p.elev);
        if (gap > worst.gap) worst = { gap: gap, doy: doy, hour: hs, elevDeg: p.elev * DEG };
      });
    });
    worst.height = h;
    worst.pitch = L * Math.cos(tilt * RAD) + worst.gap;
    worst.gcr = worst.pitch > 0 ? L / worst.pitch : 1;
    return worst;
  };
  /* Estimación de GHI mensual sin datos (cielo claro × índice de claridad supuesto) */
  Sol.fallbackGHI = function (latDeg, kt) {
    return Sol.MONTH_DAYS.map(function (doy) { return Sol.H0(latDeg, doy) * (kt || 0.55); });
  };
  /* Punto subsolar para una fecha UTC (terminador día/noche del mapa) */
  Sol.subsolar = function (date) {
    var d0 = Date.UTC(date.getUTCFullYear(), 0, 1), doy = Math.floor((date.getTime() - d0) / 86400000) + 1;
    var hUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    return { lat: Sol.decl(doy) * DEG, lon: -15 * (hUTC - 12 + Sol.eot(doy) / 60) };
  };
})();
