/* ==========================================================================
   quality.js — Conversión, VALIDACIÓN, LIMPIEZA documentada e indicador de
   CALIDAD DE LOS DATOS. Ninguna modificación es silenciosa: cada operación
   queda en el REGISTRO DE LIMPIEZA con su hora, conteo y criterio.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U, M = SEDA.Mapping, I = SEDA.Import;
  var Q = SEDA.Quality = {};

  /* Banderas de celda (validación) */
  var F_MISS = 1, F_NEGS = 2, F_NEGL = 4, F_IMP = 8, F_OUT = 16, F_FRZ = 32;
  /* Banderas de fila */
  var R_DATE = 1, R_DUP = 2, R_MISS = 4, R_PHYS = 8, R_OUT = 16, R_FRZ = 32, R_INC = 64, R_NEG = 128;
  Q.ROWFLAGS = { R_DATE: R_DATE, R_DUP: R_DUP, R_MISS: R_MISS, R_PHYS: R_PHYS, R_OUT: R_OUT, R_FRZ: R_FRZ, R_INC: R_INC, R_NEG: R_NEG };
  /* Banderas de celda en datos procesados */
  Q.P_ORIG = 0; Q.P_CORR = 1; Q.P_INTERP = 2; Q.P_INVAL = 3; Q.P_MISS = 4;

  /* Reglas físicas documentadas (en unidades canónicas) */
  Q.RULES = {
    IRRADIANCIA: { min: 0, max: 1500, negSmall: -20, frozen: 4, frozenNonZero: true, why: 'GHI ≤ 1500 W/m² (≈ 1.1 × constante solar en superficie)' },
    IRR_POA: { min: 0, max: 1600, negSmall: -20, frozen: 4, frozenNonZero: true, why: 'POA ≤ 1600 W/m²' },
    DNI: { min: 0, max: 1200, negSmall: -20, why: 'DNI ≤ 1200 W/m²' },
    DHI: { min: 0, max: 900, negSmall: -20, why: 'DHI ≤ 900 W/m²' },
    TEMPERATURA: { min: -40, max: 60, iqr: true, frozen: 6, why: 'Temperatura entre −40 y 60 °C' },
    HUMEDAD: { min: 0, max: 100, iqr: true, frozen: 6, frozenSkipAbove: 99.5, why: 'Humedad relativa entre 0 y 100 %' },
    VEL_VIENTO: { min: 0, max: 60, iqr: true, frozen: 6, frozenNonZero: true, why: 'Viento entre 0 y 60 m/s' },
    DIR_VIENTO: { min: 0, max: 360, why: 'Dirección entre 0 y 360°' },
    PRESION: { min: 500, max: 1100, iqr: true, why: 'Presión entre 500 y 1100 hPa' },
    PRECIPITACION: { min: 0, max: 300, why: 'Precipitación entre 0 y 300 mm por intervalo' },
    POTENCIA_FV: { min: 0, power: true, frozen: 4, frozenNonZero: true, why: 'Potencia ≥ 0; atípico si > 1.25 × P99.5 de la potencia positiva (o > 1.3 × kWp configurado)' },
    ENERGIA_FV: { min: 0, power: true, frozen: 4, frozenNonZero: true, why: 'Energía ≥ 0; atípico si > 1.25 × P99.5' },
    CARGA: { min: 0, iqr: true, why: 'Consumo ≥ 0' },
    SOC: { min: 0, max: 100, why: 'SOC entre 0 y 100 %' }
  };

  /* ---------------- 1. Conversión ---------------- */
  Q.parse = function (table, map) {
    var ts = I.timestamps(table, map);
    var n = table.rows.length;
    var keys = M.NUMERIC.filter(function (k) { return map[k] && map[k].col >= 0; });
    var vars = {}, cell = {}, units = {}, conv = {};
    keys.forEach(function (k) {
      var col = map[k].col, a = new Float64Array(n), s = new Uint8Array(n);
      var fn = M.converter(k, map[k].unit);
      if (fn) conv[k] = { from: map[k].unit, to: k === 'CARGA' ? 'kW' : M.byKey[k].unit };
      units[k] = M.canonUnit(k);
      for (var r = 0; r < n; r++) {
        var v = table.rows[r][col];
        if (U.isEmpty(v)) { a[r] = NaN; s[r] = 1; continue; }
        var x = v instanceof Date ? NaN : U.parseNumber(v);
        if (!isFinite(x)) { a[r] = NaN; s[r] = 2; continue; }
        if (x <= -900) { a[r] = NaN; s[r] = 3; continue; }
        a[r] = fn ? fn(x) : x;
      }
      vars[k] = a; cell[k] = s;
    });
    return { n: n, t: ts.t, dayFirst: ts.dayFirst, keys: keys, vars: vars, cell: cell, units: units, conv: conv, targetKey: M.targetKey(map), cargaUnit: map.CARGA && map.CARGA.col >= 0 ? map.CARGA.unit : null };
  };

  function sortedOrder(t) {
    var idx = [];
    for (var i = 0; i < t.length; i++) if (isFinite(t[i])) idx.push(i);
    idx.sort(function (a, b) { return t[a] - t[b] || a - b; });
    return idx;
  }

  /* ---------------- 2. Validación ---------------- */
  Q.validate = function (P, cfg) {
    cfg = cfg || {};
    var n = P.n, t = P.t;
    var rowF = new Uint8Array(n);
    var invalidDates = 0;
    for (var i = 0; i < n; i++) if (!isFinite(t[i])) { rowF[i] |= R_DATE; invalidDates++; }
    var order = sortedOrder(t);
    var outOfOrder = 0;
    var prevT = -Infinity;
    for (var i2 = 0; i2 < n; i2++) { if (!isFinite(t[i2])) continue; if (t[i2] < prevT) outOfOrder++; prevT = t[i2]; }
    /* duplicados */
    var dupTs = 0, exactDup = 0;
    for (var k = 1; k < order.length; k++) {
      var a = order[k], b = order[k - 1];
      if (t[a] === t[b]) {
        dupTs++; rowF[a] |= R_DUP;
        var same = P.keys.every(function (key) { var x = P.vars[key][a], y = P.vars[key][b]; return (isNaN(x) && isNaN(y)) || x === y; });
        if (same) exactDup++;
      }
    }
    /* continuidad temporal */
    var uniq = [];
    for (var u = 0; u < order.length; u++) { var tv = t[order[u]]; if (!uniq.length || uniq[uniq.length - 1] !== tv) uniq.push(tv); }
    var diffs = [];
    for (var d = 1; d < uniq.length; d++) diffs.push(uniq[d] - uniq[d - 1]);
    var step = diffs.length ? U.mode(diffs) : U.HOUR;
    if (!(step > 0)) step = U.HOUR;
    var gaps = 0, missingTs = 0, largestGap = 0, gapList = [];
    for (var g = 0; g < diffs.length; g++) {
      if (diffs[g] > step * 1.5) {
        gaps++; var miss = Math.round(diffs[g] / step) - 1; missingTs += miss;
        if (diffs[g] > largestGap) largestGap = diffs[g];
        if (gapList.length < 50) gapList.push({ from: uniq[g], to: uniq[g + 1], missing: miss });
      }
    }
    var expected = uniq.length ? Math.round((uniq[uniq.length - 1] - uniq[0]) / step) + 1 : 0;
    var dtH = step / U.HOUR;

    /* por variable */
    var perVar = {}, cellF = {};
    var target = P.targetKey;
    var validIdx = order.filter(function (ix) { return !(rowF[ix] & R_DUP); });
    P.keys.forEach(function (key) {
      var arr = P.vars[key], st = P.cell[key], rule = Q.RULES[key] || {};
      var f = new Uint8Array(n);
      var s = { key: key, label: M.label(key), unit: P.units[key], empty: 0, nonNumeric: 0, sentinel: 0, missing: 0, negatives: 0, negSmall: 0, impossible: 0, outliers: 0, frozen: 0, n: 0 };
      var vals = [];
      for (var r = 0; r < n; r++) {
        if (rowF[r] & R_DATE) continue;
        s.n++;
        if (st[r] === 1) s.empty++; else if (st[r] === 2) s.nonNumeric++; else if (st[r] === 3) s.sentinel++;
        if (st[r]) { f[r] |= F_MISS; continue; }
        vals.push(arr[r]);
      }
      s.missing = s.empty + s.nonNumeric + s.sentinel;
      var sorted = vals.slice().sort(function (x, y) { return x - y; });
      var hi = rule.max != null ? rule.max : Infinity;
      var outHi = Infinity, outLo = -Infinity;
      if (rule.power) {
        var pos = sorted.filter(function (x) { return x > 0; });
        var p995 = U.quantileSorted(pos, 0.995);
        s.p995 = p995;
        if (cfg.kwp > 0) hi = 1.3 * cfg.kwp * (key === 'ENERGIA_FV' ? dtH : 1);
        if (isFinite(p995)) outHi = 1.25 * p995;
        rule = Object.assign({}, rule, { negSmall: -Math.max(0.02 * (p995 || 0), 0.05) });
      }
      if (rule.iqr && sorted.length > 20) {
        var q1 = U.quantileSorted(sorted, 0.25), q3 = U.quantileSorted(sorted, 0.75), iq = q3 - q1;
        if (iq > 0) { outLo = q1 - 3 * iq; outHi = Math.min(outHi, q3 + 3 * iq); }
      }
      s.bounds = { min: rule.min, max: hi, outLo: outLo, outHi: outHi, negSmall: rule.negSmall };
      for (var r2 = 0; r2 < n; r2++) {
        if ((rowF[r2] & R_DATE) || (f[r2] & F_MISS)) continue;
        var x = arr[r2];
        if (rule.min != null && x < rule.min) {
          if (rule.min === 0) {
            s.negatives++;
            if (rule.negSmall != null && x >= rule.negSmall) { f[r2] |= F_NEGS; s.negSmall++; }
            else { f[r2] |= F_NEGL; s.impossible++; }
          } else { f[r2] |= F_IMP; s.impossible++; }
        } else if (x > hi) { f[r2] |= F_IMP; s.impossible++; }
        else if (x > outHi || x < outLo) { f[r2] |= F_OUT; s.outliers++; }
      }
      /* sensor congelado (valores idénticos consecutivos) */
      if (rule.frozen && step <= U.HOUR) {
        var run = [];
        var flush = function () {
          if (run.length >= rule.frozen) { run.forEach(function (ix) { if (!(f[ix] & F_FRZ)) { f[ix] |= F_FRZ; s.frozen++; } }); }
          run = [];
        };
        for (var q = 0; q < validIdx.length; q++) {
          var ix = validIdx[q], v = arr[ix];
          /* se excluyen: ceros (noche/calma), saturación de humedad y la meseta de recorte del inversor */
          var eligible = !(f[ix] & (F_MISS | F_IMP | F_NEGL)) && !(rule.frozenNonZero && v === 0) && !(rule.frozenSkipAbove != null && v >= rule.frozenSkipAbove) &&
            !(rule.power && isFinite(s.p995) && v >= 0.97 * s.p995);
          if (!eligible) { flush(); continue; }
          if (run.length) {
            var last = run[run.length - 1];
            if (arr[last] === v && t[ix] - t[last] <= step * 1.01) { run.push(ix); continue; }
            flush();
          }
          run.push(ix);
        }
        flush();
      }
      var mm = U.minmax(vals.filter(function (x) { return !(rule.min != null && x < rule.min) && x <= hi; }));
      s.min = mm[0]; s.max = mm[1]; s.mean = U.mean(vals); s.why = rule.why || '';
      perVar[key] = s; cellF[key] = f;
    });

    /* inconsistencias irradiancia–potencia (error de sensor o inversor) */
    var irrKey = P.vars.IRR_POA ? 'IRR_POA' : (P.vars.IRRADIANCIA ? 'IRRADIANCIA' : null);
    var inconsistent = 0;
    if (irrKey && target && perVar[target]) {
      var pmax = perVar[target].p995;
      if (isFinite(pmax) && pmax > 0) {
        var ir = P.vars[irrKey], pw = P.vars[target], fi = cellF[irrKey], fp = cellF[target];
        for (var r3 = 0; r3 < n; r3++) {
          if (rowF[r3] & R_DATE) continue;
          if (fi[r3] || fp[r3]) continue;
          var I_ = ir[r3], Pw = pw[r3];
          if ((I_ > 300 && Pw < 0.02 * pmax) || (Pw > 0.3 * pmax && I_ >= 0 && I_ < 20)) { rowF[r3] |= R_INC; inconsistent++; }
        }
      }
    }
    /* banderas de fila */
    for (var r4 = 0; r4 < n; r4++) {
      if (rowF[r4] & R_DATE) continue;
      for (var kk = 0; kk < P.keys.length; kk++) {
        var fl = cellF[P.keys[kk]][r4];
        if (!fl) continue;
        if (fl & F_MISS) rowF[r4] |= R_MISS;
        if (fl & (F_NEGL | F_IMP)) rowF[r4] |= R_PHYS;
        if (fl & F_NEGS) rowF[r4] |= R_NEG;
        if (fl & F_OUT) rowF[r4] |= R_OUT;
        if (fl & F_FRZ) rowF[r4] |= R_FRZ;
      }
    }
    var valid = 0, withErr = 0, missingCells = 0, outlierRows = 0, physRows = 0;
    for (var r5 = 0; r5 < n; r5++) {
      if (rowF[r5] === 0) valid++; else withErr++;
      if (rowF[r5] & R_OUT) outlierRows++;
      if (rowF[r5] & (R_PHYS | R_INC | R_FRZ | R_NEG)) physRows++;
    }
    var outlierCells = 0, totalCells = 0;
    P.keys.forEach(function (key) { missingCells += perVar[key].missing; outlierCells += perVar[key].outliers; totalCells += perVar[key].n; });
    var nDated = n - invalidDates;
    var q = {
      C: totalCells ? 1 - missingCells / totalCells : 0,
      K: nDated ? 1 - physRows / nDated : 0,
      T: expected ? Math.min(1, uniq.length / expected) : 0,
      O: nDated ? 1 - outlierRows / nDated : 0,
      V: n ? valid / n : 0
    };
    q.score = 100 * (q.C + q.K + q.T + q.O + q.V) / 5;
    return {
      total: n, invalidDates: invalidDates, outOfOrder: outOfOrder, duplicates: dupTs, exactDuplicates: exactDup,
      step: step, dtH: dtH, stepLabel: Q.stepLabel(step), gaps: gaps, missingTimestamps: missingTs, largestGapH: largestGap / U.HOUR, gapList: gapList,
      uniqueTs: uniq.length, expectedTs: expected, start: uniq[0], end: uniq[uniq.length - 1],
      perVar: perVar, cellF: cellF, rowF: rowF, valid: valid, withErrors: withErr, missingCells: missingCells, outlierCells: outlierCells,
      outlierRows: outlierRows, inconsistent: inconsistent, irrKey: irrKey, quality: q, keys: P.keys.slice(), targetKey: target
    };
  };
  Q.stepLabel = function (ms) {
    if (!isFinite(ms)) return '—';
    if (ms % U.DAY === 0) return (ms / U.DAY) + ' día(s)';
    if (ms % U.HOUR === 0) return (ms / U.HOUR) + ' hora(s)';
    return Math.round(ms / 60000) + ' min';
  };

  /* ---------------- 3. Limpieza ---------------- */
  Q.DEFAULT_OPTS = { dropDup: true, sortTime: true, fixSmallNeg: true, impossibleToNaN: true, outliersToNaN: true, frozenToNaN: true, excludeInconsistent: true, interpolate: true, maxGap: 2, interpolateTarget: false };

  Q.clean = function (P, V, opts) {
    opts = Object.assign({}, Q.DEFAULT_OPTS, opts || {});
    var log = [];
    var L = function (msg, type) { log.push({ time: U.nowStamp(), msg: msg, type: type || 'info' }); };
    var fmtList = function (obj) { return Object.keys(obj).filter(function (k) { return obj[k] > 0; }).map(function (k) { return M.label(k) + ': ' + obj[k]; }).join(', '); };
    L('Inicio de la limpieza y preprocesamiento: ' + P.n + ' registros brutos, ' + P.keys.length + ' variables numéricas mapeadas.');

    /* fechas */
    if (V.invalidDates) L('Se detectaron ' + V.invalidDates + ' registros con fecha/hora no interpretable. Se excluyen del conjunto procesado.', 'warn');
    else L('Conversión de fechas: los ' + P.n + ' registros tienen fecha/hora válida (formato ' + (P.dayFirst ? 'día/mes' : 'mes/día') + ' cuando aplica).', 'act');
    /* unidades */
    Object.keys(P.conv).forEach(function (k) { L('Conversión de unidades: ' + M.label(k) + ' de ' + P.conv[k].from + ' a ' + P.conv[k].to + '.', 'act'); });
    /* numéricos, centinelas, faltantes */
    var nn = {}, se = {}, em = {};
    P.keys.forEach(function (k) { nn[k] = V.perVar[k].nonNumeric; se[k] = V.perVar[k].sentinel; em[k] = V.perVar[k].empty; });
    var sumO = function (o) { return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0); };
    if (sumO(nn)) L('Conversión numérica: se detectaron ' + sumO(nn) + ' valores no numéricos (' + fmtList(nn) + '). Se convirtieron a faltantes.', 'warn');
    else L('Conversión numérica: todas las celdas no vacías de las variables mapeadas son numéricas.', 'act');
    if (sumO(se)) L('Se detectaron ' + sumO(se) + ' códigos de dato faltante (≤ −900, p. ej. −999 de NASA POWER) (' + fmtList(se) + '). Se trataron como faltantes.', 'warn');
    if (sumO(em)) L('Se detectaron ' + sumO(em) + ' valores faltantes (' + fmtList(em) + ').', 'warn');

    /* orden y duplicados */
    var order = sortedOrder(P.t);
    if (V.outOfOrder) L('Se detectaron ' + V.outOfOrder + ' registros fuera de orden cronológico.', 'warn');
    L('Los registros se ordenaron cronológicamente por fecha + hora.', 'act');
    var keep = [];
    var removedDup = 0;
    for (var i = 0; i < order.length; i++) {
      var ix = order[i];
      if (opts.dropDup && keep.length && P.t[keep[keep.length - 1]] === P.t[ix]) { removedDup++; continue; }
      keep.push(ix);
    }
    if (V.duplicates) {
      if (opts.dropDup) L('Se detectaron ' + V.duplicates + ' registros duplicados (misma fecha-hora; ' + V.exactDuplicates + ' idénticos en todas las variables). Se eliminaron ' + removedDup + ', conservando la primera ocurrencia.', 'act');
      else L('Se detectaron ' + V.duplicates + ' registros duplicados. Se conservaron por configuración del usuario.', 'warn');
    } else L('No se detectaron registros duplicados.', 'act');

    var n = keep.length;
    var t = new Float64Array(n), src = new Int32Array(n), vars = {}, flags = {};
    for (var r = 0; r < n; r++) { t[r] = P.t[keep[r]]; src[r] = keep[r]; }
    P.keys.forEach(function (k) {
      var a = new Float64Array(n), f = new Uint8Array(n), s = P.vars[k];
      for (var r2 = 0; r2 < n; r2++) { a[r2] = s[keep[r2]]; f[r2] = isFinite(a[r2]) ? Q.P_ORIG : Q.P_MISS; }
      vars[k] = a; flags[k] = f;
    });
    /* CARGA en kWh por intervalo -> kW */
    if (P.cargaUnit === 'kWh' && vars.CARGA) {
      for (var c = 0; c < n; c++) vars.CARGA[c] = vars.CARGA[c] / V.dtH;
      L('Consumo expresado en kWh por intervalo convertido a potencia media (kW) dividiendo por el paso temporal (' + V.dtH + ' h).', 'act');
    }

    var corrected = {}, invalid = {}, invReasons = [];
    P.keys.forEach(function (k) { corrected[k] = 0; invalid[k] = 0; });
    var applyCell = function (k, pred, action, flag) {
      var cf = V.cellF[k], cnt = 0;
      for (var r3 = 0; r3 < n; r3++) {
        var fl = cf[src[r3]];
        if (!pred(fl)) continue;
        if (flags[k][r3] === Q.P_INVAL || flags[k][r3] === Q.P_MISS) continue;
        action(r3); flags[k][r3] = flag; cnt++;
      }
      return cnt;
    };
    /* negativos pequeños */
    P.keys.forEach(function (k) {
      var cnt = V.perVar[k].negSmall;
      if (!cnt) return;
      var lab = M.label(k), u = P.units[k];
      if (opts.fixSmallNeg) {
        var done = applyCell(k, function (fl) { return fl & F_NEGS; }, function (r4) { vars[k][r4] = 0; }, Q.P_CORR);
        corrected[k] += done;
        L('Se detectaron ' + cnt + ' valores de ' + lab + ' negativos pequeños (≥ ' + U.fmt(V.perVar[k].bounds.negSmall, 2) + ' ' + u + '; ' + (Q.RULES[k] && Q.RULES[k].power ? 'típico del autoconsumo nocturno del inversor' : 'típico del offset nocturno del piranómetro') + '). Se corrigieron a 0 ' + u + '.', 'act');
      } else L('Se detectaron ' + cnt + ' valores de ' + lab + ' negativos pequeños. Se conservaron por configuración del usuario.', 'warn');
    });
    /* imposibles */
    P.keys.forEach(function (k) {
      var cnt = V.perVar[k].impossible;
      if (!cnt) return;
      if (opts.impossibleToNaN) {
        var done = applyCell(k, function (fl) { return fl & (F_NEGL | F_IMP); }, function (r5) { vars[k][r5] = NaN; }, Q.P_INVAL);
        invalid[k] += done;
        L('Se detectaron ' + cnt + ' valores físicamente imposibles de ' + M.label(k) + ' (criterio: ' + (V.perVar[k].why || 'rango físico') + '). Se marcaron como faltantes.', 'act');
      } else L('Se detectaron ' + cnt + ' valores físicamente imposibles de ' + M.label(k) + '. Se conservaron por configuración del usuario.', 'warn');
    });
    /* atípicos */
    P.keys.forEach(function (k) {
      var cnt = V.perVar[k].outliers;
      if (!cnt) return;
      var b = V.perVar[k].bounds, crit = (Q.RULES[k] && Q.RULES[k].power) ? '> 1.25 × P99.5 = ' + U.fmt(b.outHi, 2) : 'fuera de [Q1 − 3·IQR, Q3 + 3·IQR] = [' + U.fmt(b.outLo, 2) + ', ' + U.fmt(b.outHi, 2) + ']';
      if (opts.outliersToNaN) {
        var done = applyCell(k, function (fl) { return fl & F_OUT; }, function (r6) { vars[k][r6] = NaN; }, Q.P_INVAL);
        invalid[k] += done;
        L('Se identificaron ' + cnt + ' valores atípicos de ' + M.label(k) + ' (' + crit + ' ' + P.units[k] + '). Se marcaron como faltantes.', 'act');
      } else L('Se identificaron ' + cnt + ' valores atípicos de ' + M.label(k) + ' (' + crit + '). Se conservan (solo se reportan).', 'warn');
    });
    /* sensor congelado */
    P.keys.forEach(function (k) {
      var cnt = V.perVar[k].frozen;
      if (!cnt) return;
      if (opts.frozenToNaN) {
        var done = applyCell(k, function (fl) { return fl & F_FRZ; }, function (r7) { vars[k][r7] = NaN; }, Q.P_INVAL);
        invalid[k] += done;
        L('Posible error de sensor: ' + cnt + ' lecturas idénticas consecutivas de ' + M.label(k) + ' (≥ ' + Q.RULES[k].frozen + ' registros; sensor congelado). Se marcaron como faltantes.', 'act');
      } else L('Posible sensor congelado en ' + M.label(k) + ' (' + cnt + ' lecturas). Se conservan.', 'warn');
    });
    /* inconsistencias irradiancia–potencia */
    var tk = P.targetKey, incl = 0;
    if (V.inconsistent && tk) {
      if (opts.excludeInconsistent) {
        for (var r8 = 0; r8 < n; r8++) {
          if ((V.rowF[src[r8]] & R_INC) && flags[tk][r8] !== Q.P_INVAL && flags[tk][r8] !== Q.P_MISS) { vars[tk][r8] = NaN; flags[tk][r8] = Q.P_INVAL; invalid[tk]++; incl++; }
        }
        L('Se detectaron ' + V.inconsistent + ' registros con inconsistencia irradiancia–potencia (irradiancia > 300 W/m² con potencia < 2 % del máximo, o potencia > 30 % del máximo con irradiancia < 20 W/m²; posible falla de inversor o sensor).', 'warn');
        L('Los registros fueron excluidos del entrenamiento (' + incl + ' valores de ' + M.label(tk) + ' marcados como faltantes).', 'act');
      } else L('Se detectaron ' + V.inconsistent + ' inconsistencias irradiancia–potencia. Se conservaron por configuración del usuario.', 'warn');
    }
    /* interpolación lineal de huecos cortos */
    var interp = {};
    P.keys.forEach(function (k) { interp[k] = 0; });
    if (opts.interpolate && opts.maxGap > 0) {
      var stepMs = V.step;
      P.keys.forEach(function (k) {
        if (k === 'DIR_VIENTO' || k === 'PRECIPITACION' || k === 'SOC') return;
        if (k === tk && !opts.interpolateTarget) return;
        var a = vars[k], f = flags[k];
        var r9 = 0;
        while (r9 < n) {
          if (isFinite(a[r9])) { r9++; continue; }
          var s0 = r9; while (r9 < n && !isFinite(a[r9])) r9++;
          var e0 = r9; var len = e0 - s0;
          if (s0 === 0 || e0 >= n || len > opts.maxGap) continue;
          var tA = t[s0 - 1], tB = t[e0];
          if (tB - tA > stepMs * (opts.maxGap + 1) * 1.01) continue;
          for (var j = s0; j < e0; j++) { a[j] = a[s0 - 1] + (a[e0] - a[s0 - 1]) * (t[j] - tA) / (tB - tA); f[j] = Q.P_INTERP; interp[k]++; }
        }
      });
      var ti = sumO(interp);
      if (ti) L('Interpolación lineal de huecos de hasta ' + opts.maxGap + ' registros consecutivos: ' + ti + ' valores (' + fmtList(interp) + '). No se interpolan dirección del viento (circular), precipitación ni ' + (opts.interpolateTarget ? 'SOC' : 'la variable objetivo') + '.', 'act');
      else L('Interpolación de huecos cortos: no se encontraron huecos interpolables.', 'info');
    }
    if (V.gaps) L('Discontinuidades temporales: ' + V.gaps + ' huecos con ' + V.missingTimestamps + ' marcas de tiempo ausentes (máximo ' + U.fmt(V.largestGapH, 1) + ' h). No se inventan registros para esos períodos.', 'warn');

    /* resumen */
    var missingLeft = {}, complete = 0;
    P.keys.forEach(function (k) { var c = 0; for (var r10 = 0; r10 < n; r10++) if (!isFinite(vars[k][r10])) c++; missingLeft[k] = c; });
    var featKeys = P.keys.filter(function (k) { return M.METEO.indexOf(k) >= 0 || k === tk; });
    for (var r11 = 0; r11 < n; r11++) { var ok = true; for (var z = 0; z < featKeys.length; z++) if (!isFinite(vars[featKeys[z]][r11])) { ok = false; break; } if (ok) complete++; }
    var totCorr = sumO(corrected), totInv = sumO(invalid), totInt = sumO(interp);
    L('Resultado: ' + n + ' registros procesados; ' + complete + ' completos en variables meteorológicas y objetivo; ' + (n - complete) + ' incompletos serán excluidos del entrenamiento si les falta alguna variable usada por el modelo.', 'act');
    L('Totales: ' + totCorr + ' valores corregidos, ' + totInt + ' interpolados, ' + totInv + ' invalidados (convertidos a faltante), ' + (V.invalidDates + removedDup) + ' registros eliminados.', 'info');

    var processed = { n: n, t: t, src: src, vars: vars, flags: flags, keys: P.keys.slice(), units: P.units, targetKey: tk, stepMs: V.step, dtH: V.dtH };
    return {
      processed: processed, log: log, opts: opts,
      summary: {
        rawRows: P.n, finalRows: n, removedInvalidDate: V.invalidDates, removedDup: removedDup, corrected: totCorr, interpolated: totInt,
        invalidated: totInv, missingLeft: missingLeft, missingLeftTotal: sumO(missingLeft), completeRows: complete, correctedBy: corrected, invalidBy: invalid, interpBy: interp
      }
    };
  };

  /* ---------------- Utilidades sobre datos procesados ---------------- */
  /* Agregado diario */
  Q.daily = function (pr) {
    var tk = pr.targetKey, out = [], cur = null;
    var perDay = Math.max(1, Math.round(24 / pr.dtH));
    var kwh = function (v) { return tk === 'ENERGIA_FV' ? v : v * pr.dtH; };
    for (var i = 0; i < pr.n; i++) {
      var d = U.dayStart(pr.t[i]);
      if (!cur || cur.day !== d) {
        cur = { day: d, energy: 0, nE: 0, pmax: NaN, irr: 0, nI: 0, tsum: 0, nT: 0, hsum: 0, nH: 0, wsum: 0, nW: 0, prec: 0, nP: 0, load: 0, nL: 0, n: 0 };
        out.push(cur);
      }
      cur.n++;
      var y = tk ? pr.vars[tk][i] : NaN;
      if (isFinite(y)) { cur.energy += kwh(y); cur.nE++; var pw = tk === 'ENERGIA_FV' ? y / pr.dtH : y; if (!(pw <= cur.pmax)) cur.pmax = pw; }
      var ir = pr.vars.IRRADIANCIA ? pr.vars.IRRADIANCIA[i] : (pr.vars.IRR_POA ? pr.vars.IRR_POA[i] : NaN);
      if (isFinite(ir)) { cur.irr += ir * pr.dtH / 1000; cur.nI++; }
      if (pr.vars.TEMPERATURA && isFinite(pr.vars.TEMPERATURA[i])) { cur.tsum += pr.vars.TEMPERATURA[i]; cur.nT++; }
      if (pr.vars.HUMEDAD && isFinite(pr.vars.HUMEDAD[i])) { cur.hsum += pr.vars.HUMEDAD[i]; cur.nH++; }
      if (pr.vars.VEL_VIENTO && isFinite(pr.vars.VEL_VIENTO[i])) { cur.wsum += pr.vars.VEL_VIENTO[i]; cur.nW++; }
      if (pr.vars.PRECIPITACION && isFinite(pr.vars.PRECIPITACION[i])) { cur.prec += pr.vars.PRECIPITACION[i]; cur.nP++; }
      if (pr.vars.CARGA && isFinite(pr.vars.CARGA[i])) { cur.load += pr.vars.CARGA[i] * pr.dtH; cur.nL++; }
    }
    out.forEach(function (d) {
      d.coverage = d.nE / perDay;
      d.tmean = d.nT ? d.tsum / d.nT : NaN; d.hmean = d.nH ? d.hsum / d.nH : NaN; d.wmean = d.nW ? d.wsum / d.nW : NaN;
      if (!d.nE) d.energy = NaN; if (!d.nI) d.irr = NaN; if (!d.nP) d.prec = NaN; if (!d.nL) d.load = NaN;
    });
    return out;
  };

  /* Consumo nocturno histórico (18:00–05:59) a partir de la variable CARGA */
  Q.nightLoad = function (pr, startH, endH) {
    if (!pr || !pr.vars.CARGA) return null;
    startH = startH == null ? 18 : startH; endH = endH == null ? 6 : endH;
    var nights = new Map(), expected = Math.round(((24 - startH) + endH) / pr.dtH);
    for (var i = 0; i < pr.n; i++) {
      var h = U.hourOf(pr.t[i]);
      if (!(h >= startH || h < endH)) continue;
      var key = h >= startH ? U.dayStart(pr.t[i]) : U.dayStart(pr.t[i]) - U.DAY;
      var v = pr.vars.CARGA[i];
      if (!isFinite(v)) continue;
      var e = nights.get(key) || { e: 0, n: 0 };
      e.e += v * pr.dtH; e.n++; nights.set(key, e);
    }
    var vals = [];
    nights.forEach(function (e) { if (e.n >= expected * 0.9) vals.push(e.e * expected / e.n); });
    if (!vals.length) return null;
    var s = vals.slice().sort(function (a, b) { return a - b; });
    return { mean: U.mean(vals), p90: U.quantileSorted(s, 0.9), max: s[s.length - 1], nights: vals.length };
  };
})();
