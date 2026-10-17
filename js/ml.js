/* ==========================================================================
   ml.js — Machine Learning local (sin librerías externas).

   RANDOM FOREST REGRESSOR
   - Ensamble de árboles CART de regresión (criterio: reducción de la suma de
     errores cuadráticos, equivalente al MSE de scikit-learn).
   - Bootstrap por árbol y submuestreo de variables por nodo (max_features).
   - Búsqueda de cortes por histogramas (hasta 64 umbrales por variable,
     cuantiles del conjunto de entrenamiento), técnica usada por LightGBM y
     HistGradientBoosting para acelerar el entrenamiento.
   - Importancia por reducción media de impureza (MDI), normalizada a 100 %.
   - Semilla reproducible (mulberry32).

   LÍNEA BASE: PERSISTENCIA — ŷ(t) = y(t − 24 h) (misma hora del día anterior);
   para datos diarios, ŷ(d) = y(d − 1).

   DIVISIÓN CRONOLÓGICA 60/20/20 (nunca aleatoria).
   MÉTRICAS: MAE, RMSE, MAPE (solo con |y| > 5 % del máximo, para evitar la
   división por cero nocturna), WAPE, R², sesgo y errores de energía diaria.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U, M = SEDA.Mapping;
  var ML = SEDA.ML = {};

  /* ---------------- Catálogo de variables de entrada ---------------- */
  ML.FEAT = {
    IRRADIANCIA: { label: 'Irradiancia (GHI)', src: 'IRRADIANCIA', group: 'meteo' },
    IRR_POA: { label: 'Irradiancia POA', src: 'IRR_POA', group: 'meteo' },
    DNI: { label: 'Radiación directa (DNI)', src: 'DNI', group: 'meteo' },
    DHI: { label: 'Radiación difusa (DHI)', src: 'DHI', group: 'meteo' },
    TEMPERATURA: { label: 'Temperatura', src: 'TEMPERATURA', group: 'meteo' },
    HUMEDAD: { label: 'Humedad', src: 'HUMEDAD', group: 'meteo' },
    VEL_VIENTO: { label: 'Velocidad del viento', src: 'VEL_VIENTO', group: 'meteo' },
    WD_SIN: { label: 'Dirección viento (seno)', src: 'DIR_VIENTO', group: 'meteo' },
    WD_COS: { label: 'Dirección viento (coseno)', src: 'DIR_VIENTO', group: 'meteo' },
    PRESION: { label: 'Presión', src: 'PRESION', group: 'meteo' },
    PRECIPITACION: { label: 'Precipitación', src: 'PRECIPITACION', group: 'meteo' },
    HORA: { label: 'Hora', src: null, group: 'tiempo', subdaily: true },
    MES: { label: 'Mes', src: null, group: 'tiempo' },
    DIA_ANIO: { label: 'Día del año', src: null, group: 'tiempo' },
    HORA_SIN: { label: 'hora_seno', src: null, group: 'tiempo', subdaily: true },
    HORA_COS: { label: 'hora_coseno', src: null, group: 'tiempo', subdaily: true },
    DOY_SIN: { label: 'dia_año_seno', src: null, group: 'tiempo' },
    DOY_COS: { label: 'dia_año_coseno', src: null, group: 'tiempo' }
  };
  ML.ORDER = ['IRRADIANCIA', 'IRR_POA', 'DNI', 'DHI', 'TEMPERATURA', 'HUMEDAD', 'VEL_VIENTO', 'WD_SIN', 'WD_COS', 'PRESION', 'PRECIPITACION', 'HORA', 'MES', 'DIA_ANIO', 'HORA_SIN', 'HORA_COS', 'DOY_SIN', 'DOY_COS'];
  ML.flabel = function (k) { return ML.FEAT[k] ? ML.FEAT[k].label : k; };

  ML.available = function (pr) {
    var out = [];
    ML.ORDER.forEach(function (k) {
      var f = ML.FEAT[k];
      if (f.subdaily && pr.dtH >= 24) return;
      if (f.src) {
        var a = pr.vars[f.src]; if (!a) return;
        var ok = 0; for (var i = 0; i < a.length; i++) if (isFinite(a[i])) ok++;
        if (ok / Math.max(1, a.length) < 0.8) return;
      }
      out.push(k);
    });
    return out;
  };

  ML.featureValue = function (k, t, get) {
    var h, d;
    switch (k) {
      case 'HORA': return U.hourOf(t);
      case 'MES': return U.monthOf(t);
      case 'DIA_ANIO': return U.doyOf(t);
      case 'HORA_SIN': h = U.hourOf(t); return Math.sin(2 * Math.PI * h / 24);
      case 'HORA_COS': h = U.hourOf(t); return Math.cos(2 * Math.PI * h / 24);
      case 'DOY_SIN': d = U.doyOf(t); return Math.sin(2 * Math.PI * (d - 1) / 365.25);
      case 'DOY_COS': d = U.doyOf(t); return Math.cos(2 * Math.PI * (d - 1) / 365.25);
      case 'WD_SIN': d = get('DIR_VIENTO'); return isFinite(d) ? Math.sin(d * Math.PI / 180) : NaN;
      case 'WD_COS': d = get('DIR_VIENTO'); return isFinite(d) ? Math.cos(d * Math.PI / 180) : NaN;
      default: return get(ML.FEAT[k] ? ML.FEAT[k].src : k);
    }
  };
  ML.featureRow = function (feats, t, vals) {
    var get = function (key) { var v = vals[key]; return v == null || v === '' ? NaN : +v; };
    return feats.map(function (k) { return ML.featureValue(k, t, get); });
  };

  ML.buildDataset = function (pr, feats, tk) {
    var n = pr.n, rows = [], y = [];
    var cols = feats.map(function () { return []; });
    var times = [];
    for (var i = 0; i < n; i++) {
      var yv = pr.vars[tk][i];
      if (!isFinite(yv)) continue;
      var ok = true, vals = new Array(feats.length);
      var get = function (key) { return pr.vars[key] ? pr.vars[key][i] : NaN; };
      for (var f = 0; f < feats.length; f++) { var v = ML.featureValue(feats[f], pr.t[i], get); if (!isFinite(v)) { ok = false; break; } vals[f] = v; }
      if (!ok) continue;
      for (var f2 = 0; f2 < feats.length; f2++) cols[f2].push(vals[f2]);
      y.push(yv); rows.push(i); times.push(pr.t[i]);
    }
    return { X: cols.map(function (c) { return Float64Array.from(c); }), y: Float64Array.from(y), t: Float64Array.from(times), idx: Int32Array.from(rows), m: y.length, excluded: n - y.length };
  };

  ML.chronoSplit = function (m, fr) {
    fr = fr || [0.6, 0.2, 0.2];
    var a = Math.floor(m * fr[0]), b = Math.floor(m * (fr[0] + fr[1]));
    return { train: [0, a], val: [a, b], test: [b, m] };
  };

  /* ---------------- Binning ---------------- */
  function makeBins(col, maxBins) {
    var s = Array.prototype.slice.call(col).sort(function (a, b) { return a - b; });
    var uniq = [];
    for (var i = 0; i < s.length; i++) if (!uniq.length || s[i] !== uniq[uniq.length - 1]) uniq.push(s[i]);
    var thr = [];
    if (uniq.length <= maxBins) {
      for (var j = 0; j < uniq.length - 1; j++) thr.push((uniq[j] + uniq[j + 1]) / 2);
    } else {
      for (var q = 1; q < maxBins; q++) {
        var v = s[Math.min(s.length - 1, Math.floor(q * s.length / maxBins))];
        /* punto medio entre v y el siguiente valor distinto para que el umbral separe valores reales */
        var k = binarySearchGreater(uniq, v);
        var mid = k < uniq.length ? (v + uniq[k]) / 2 : v;
        if (!thr.length || mid > thr[thr.length - 1]) thr.push(mid);
      }
      if (thr.length && thr[thr.length - 1] >= uniq[uniq.length - 1]) thr.pop();
    }
    return Float64Array.from(thr);
  }
  function binarySearchGreater(arr, v) { var lo = 0, hi = arr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] <= v) lo = m + 1; else hi = m; } return lo; }
  function binOf(thr, x) { var lo = 0, hi = thr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (thr[m] < x) lo = m + 1; else hi = m; } return lo; }

  /* ---------------- Árbol de regresión (construcción iterativa) ---------------- */
  function buildTree(bins, thrs, y, nF, idx, p, rnd, imp) {
    var feat = [], thr = [], left = [], right = [], val = [];
    var maxB = 0; for (var f0 = 0; f0 < nF; f0++) maxB = Math.max(maxB, thrs[f0].length + 1);
    var cnt = new Float64Array(maxB), sum = new Float64Array(maxB);
    var fidx = new Int32Array(nF); for (var q = 0; q < nF; q++) fidx[q] = q;
    var mtry = p.mtry;
    var stack = [[0, idx.length, 0, -1, 0]]; /* start, end, depth, parent, side */
    while (stack.length) {
      var it = stack.pop(), s = it[0], e = it[1], depth = it[2];
      var node = feat.length;
      feat.push(-1); thr.push(0); left.push(-1); right.push(-1); val.push(0);
      if (it[3] >= 0) { if (it[4] === 0) left[it[3]] = node; else right[it[3]] = node; }
      var n = e - s, S = 0, SS = 0;
      for (var i = s; i < e; i++) { var yv = y[idx[i]]; S += yv; SS += yv * yv; }
      val[node] = S / n;
      if (depth >= p.maxDepth || n < 2 * p.minLeaf || n < p.minSplit || SS - S * S / n <= 1e-12 * n) continue;
      /* selección aleatoria de variables */
      for (var a = 0; a < mtry; a++) { var b = a + Math.floor(rnd() * (nF - a)); var tmp = fidx[a]; fidx[a] = fidx[b]; fidx[b] = tmp; }
      var parent = S * S / n, bestGain = 1e-12, bestF = -1, bestB = -1;
      for (var ff = 0; ff < mtry; ff++) {
        var f = fidx[ff], nb = thrs[f].length + 1, bf = bins[f];
        if (nb < 2) continue;
        for (var z = 0; z < nb; z++) { cnt[z] = 0; sum[z] = 0; }
        for (var j = s; j < e; j++) { var r = idx[j], bb = bf[r]; cnt[bb]++; sum[bb] += y[r]; }
        var nL = 0, sL = 0;
        for (var k = 0; k < nb - 1; k++) {
          nL += cnt[k]; sL += sum[k];
          var nR = n - nL;
          if (nL < p.minLeaf) continue;
          if (nR < p.minLeaf) break;
          var sR = S - sL, g = sL * sL / nL + sR * sR / nR - parent;
          if (g > bestGain) { bestGain = g; bestF = f; bestB = k; }
        }
      }
      if (bestF < 0) continue;
      /* partición en el lugar */
      var bfb = bins[bestF], lo = s, hi = e - 1;
      while (lo <= hi) {
        if (bfb[idx[lo]] <= bestB) lo++;
        else { var t2 = idx[lo]; idx[lo] = idx[hi]; idx[hi] = t2; hi--; }
      }
      feat[node] = bestF; thr[node] = thrs[bestF][bestB];
      imp[bestF] += bestGain;
      stack.push([lo, e, depth + 1, node, 1]);
      stack.push([s, lo, depth + 1, node, 0]);
    }
    return { f: Int16Array.from(feat), t: Float64Array.from(thr), l: Int32Array.from(left), r: Int32Array.from(right), v: Float64Array.from(val) };
  }

  function mtryOf(mf, nF) {
    if (mf === 'sqrt') return Math.max(1, Math.round(Math.sqrt(nF)));
    if (mf === 'log2') return Math.max(1, Math.round(Math.log2(nF)));
    if (mf === 'third') return Math.max(1, Math.round(nF / 3));
    var x = +mf; if (x > 0 && x <= 1) return Math.max(1, Math.round(x * nF));
    return nF;
  }

  ML.DEFAULT_PARAMS = { nTrees: 100, maxDepth: 10, minLeaf: 2, maxFeatures: '1.0', bootstrap: true, seed: 42, bins: 64 };

  /* Entrena el bosque (asíncrono, cede el hilo entre árboles para mostrar progreso) */
  ML.trainForest = async function (X, y, params, onProgress) {
    var p = Object.assign({}, ML.DEFAULT_PARAMS, params || {});
    p.nTrees = Math.max(1, Math.round(p.nTrees)); p.maxDepth = Math.max(1, Math.round(p.maxDepth)); p.minLeaf = Math.max(1, Math.round(p.minLeaf));
    p.minSplit = 2 * p.minLeaf;
    var nF = X.length, n = y.length;
    p.mtry = mtryOf(p.maxFeatures, nF);
    var thrs = X.map(function (c) { return makeBins(c, p.bins); });
    var bins = X.map(function (c, f) { var b = new Uint8Array(n), th = thrs[f]; for (var i = 0; i < n; i++) b[i] = binOf(th, c[i]); return b; });
    var rnd = U.rng(p.seed);
    var imp = new Float64Array(nF);
    var trees = [];
    var t0 = performance.now(), lastYield = t0;
    var idx = new Int32Array(n);
    for (var tI = 0; tI < p.nTrees; tI++) {
      if (p.bootstrap) for (var i = 0; i < n; i++) idx[i] = Math.floor(rnd() * n);
      else for (var i2 = 0; i2 < n; i2++) idx[i2] = i2;
      trees.push(buildTree(bins, thrs, y, nF, idx, p, rnd, imp));
      var now = performance.now();
      if (onProgress && (now - lastYield > 40 || tI === p.nTrees - 1)) { onProgress(tI + 1, p.nTrees); await U.sleep(0); lastYield = performance.now(); }
    }
    var tot = 0; for (var f = 0; f < nF; f++) tot += imp[f];
    var impN = Array.prototype.map.call(imp, function (v) { return tot > 0 ? v / tot : 0; });
    var nodes = trees.reduce(function (s, t) { return s + t.f.length; }, 0);
    return { trees: trees, params: p, importance: impN, trainMs: performance.now() - t0, nodes: nodes };
  };

  ML.predictRow = function (forest, x) {
    var s = 0, T = forest.trees;
    for (var k = 0; k < T.length; k++) {
      var tr = T[k], nd = 0;
      while (tr.f[nd] >= 0) nd = x[tr.f[nd]] <= tr.t[nd] ? tr.l[nd] : tr.r[nd];
      s += tr.v[nd];
    }
    return s / T.length;
  };
  ML.predictCols = function (forest, X, from, to) {
    from = from || 0; to = to == null ? X[0].length : to;
    var out = new Float64Array(to - from), x = new Array(X.length);
    for (var i = from; i < to; i++) {
      for (var f = 0; f < X.length; f++) x[f] = X[f][i];
      out[i - from] = ML.predictRow(forest, x);
    }
    return out;
  };

  /* ---------------- Métricas ---------------- */
  ML.metrics = function (y, yh, mask) {
    var n = 0, sa = 0, ss = 0, sy = 0, syy = 0, sb = 0, sumAbsY = 0, ymax = 0;
    for (var i = 0; i < y.length; i++) { if (mask && !mask[i]) continue; if (!isFinite(y[i]) || !isFinite(yh[i])) continue; ymax = Math.max(ymax, Math.abs(y[i])); }
    var thr = 0.05 * ymax, mp = 0, np = 0;
    for (var j = 0; j < y.length; j++) {
      if (mask && !mask[j]) continue;
      var a = y[j], b = yh[j];
      if (!isFinite(a) || !isFinite(b)) continue;
      var e = b - a;
      n++; sa += Math.abs(e); ss += e * e; sy += a; syy += a * a; sb += e; sumAbsY += Math.abs(a);
      if (Math.abs(a) > thr) { mp += Math.abs(e / a); np++; }
    }
    if (!n) return { n: 0, mae: NaN, rmse: NaN, mape: NaN, wape: NaN, r2: NaN, bias: NaN, nMape: 0, mapeThr: thr };
    var sst = syy - sy * sy / n;
    return { n: n, mae: sa / n, rmse: Math.sqrt(ss / n), mape: np ? 100 * mp / np : NaN, nMape: np, mapeThr: thr, wape: sumAbsY > 0 ? 100 * sa / sumAbsY : NaN, r2: sst > 0 ? 1 - ss / sst : NaN, bias: sb / n };
  };

  /* Persistencia: misma hora del día anterior (24 h) o registro anterior si los datos son diarios */
  ML.persistence = function (pr, tk, times) {
    var map = new Map(), yv = pr.vars[tk];
    for (var i = 0; i < pr.n; i++) if (isFinite(yv[i])) map.set(pr.t[i], yv[i]);
    var lag = pr.dtH >= 24 ? pr.stepMs : U.DAY;
    var out = new Float64Array(times.length);
    for (var j = 0; j < times.length; j++) { var v = map.get(times[j] - lag); out[j] = v == null ? NaN : v; }
    return { pred: out, lagH: lag / U.HOUR };
  };

  /* Línea base intermedia: regresión lineal por el origen ŷ = b·irradiancia (sin irradiancia
     no hay generación), ajustada por mínimos cuadrados SOLO con el conjunto de entrenamiento [0, nTrain). Usa la misma información
     meteorológica observada que el Random Forest, pero con un modelo simple: separa cuánto de
     la mejora frente a la persistencia viene de los datos y cuánto del algoritmo. */
  ML.linearBaseline = function (pr, ds, nTrain) {
    var key = pr.vars.IRR_POA ? 'IRR_POA' : (pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : null);
    if (!key) return null;
    var xv = pr.vars[key], n = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < nTrain; i++) {
      var x = xv[ds.idx[i]], y = ds.y[i];
      if (!isFinite(x) || !isFinite(y)) continue;
      n++; sxx += x * x; sxy += x * y;
    }
    if (n < 10 || !(sxx > 1e-12)) return null;
    var a = 0, b = sxy / sxx;
    var pred = new Float64Array(ds.m);
    for (var j = 0; j < ds.m; j++) { var xj = xv[ds.idx[j]]; pred[j] = isFinite(xj) ? Math.max(0, a + b * xj) : NaN; }
    return { key: key, a: a, b: b, pred: pred };
  };

  /* Rangos de entrenamiento (para la similitud de condiciones) */
  function ranges(X, feats, a, b) {
    var out = {};
    feats.forEach(function (k, f) {
      var s = Array.prototype.slice.call(X[f].subarray(a, b)).sort(function (x, y) { return x - y; });
      out[k] = { p1: U.quantileSorted(s, 0.01), p99: U.quantileSorted(s, 0.99), min: s[0], max: s[s.length - 1], mean: U.mean(s), std: U.std(s) };
    });
    return out;
  }

  /* Conversión objetivo -> kW / kWh */
  ML.toKW = function (v, tk, dtH) { return tk === 'ENERGIA_FV' ? v / dtH : v; };
  ML.toKWh = function (v, tk, dtH) { return tk === 'ENERGIA_FV' ? v : v * dtH; };

  /* Referencia de cielo claro por (mes, hora): P95 de la irradiancia observada */
  ML.clearRef = function (pr) {
    var key = pr.vars.IRR_POA ? 'IRR_POA' : (pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : null);
    if (!key) return null;
    var buckets = {};
    for (var i = 0; i < pr.n; i++) {
      var v = pr.vars[key][i]; if (!isFinite(v)) continue;
      var k = U.monthOf(pr.t[i]) * 100 + Math.floor(U.hourOf(pr.t[i]));
      (buckets[k] = buckets[k] || []).push(v);
    }
    var ref = {};
    Object.keys(buckets).forEach(function (k) { ref[k] = U.quantile(buckets[k], 0.95); });
    return { key: key, ref: ref };
  };
  ML.CONDITIONS = ['Despejado', 'Parcialmente nublado', 'Nublado', 'Lluvia', 'Noche / crepúsculo'];
  ML.condition = function (pr, i, cref) {
    if (!cref) return null;
    var r = cref.ref[U.monthOf(pr.t[i]) * 100 + Math.floor(U.hourOf(pr.t[i]))];
    if (!(r >= 30)) return 'Noche / crepúsculo';
    if (pr.vars.PRECIPITACION && pr.vars.PRECIPITACION[i] > 0.1) return 'Lluvia';
    var v = pr.vars[cref.key][i];
    if (!isFinite(v)) return null;
    var kc = v / r;
    return kc >= 0.75 ? 'Despejado' : kc >= 0.4 ? 'Parcialmente nublado' : 'Nublado';
  };

  /* ---------------- Entrenamiento + evaluación completa ---------------- */
  ML.run = async function (pr, feats, params, onProgress) {
    var tk = pr.targetKey;
    var ds = ML.buildDataset(pr, feats, tk);
    if (ds.m < 60) throw new Error('Datos insuficientes para entrenar: solo ' + ds.m + ' registros completos con las variables seleccionadas.');
    var sp = ML.chronoSplit(ds.m);
    var a = sp.train[1], b = sp.val[1], m = ds.m;
    var Xtr = ds.X.map(function (c) { return c.subarray(0, a); }), ytr = ds.y.subarray(0, a);
    var forest = await ML.trainForest(Xtr, ytr, params, onProgress);
    var yhat = ML.predictCols(forest, ds.X, 0, m);
    for (var i = 0; i < m; i++) if (yhat[i] < 0) yhat[i] = 0;
    var pers = ML.persistence(pr, tk, ds.t);
    var lin = ML.linearBaseline(pr, ds, a);
    var mk = function (from, to, both) { var mask = new Uint8Array(m); for (var i2 = from; i2 < to; i2++) mask[i2] = both ? (isFinite(pers.pred[i2]) ? 1 : 0) : 1; return mask; };
    var mTr = mk(0, a), mVa = mk(a, b), mTe = mk(b, m), mVaB = mk(a, b, true), mTeB = mk(b, m, true);
    var met = {
      train: { rf: ML.metrics(ds.y, yhat, mTr) },
      val: { rf: ML.metrics(ds.y, yhat, mVaB), pers: ML.metrics(ds.y, pers.pred, mVaB), rfAll: ML.metrics(ds.y, yhat, mVa) },
      test: { rf: ML.metrics(ds.y, yhat, mTeB), pers: ML.metrics(ds.y, pers.pred, mTeB), rfAll: ML.metrics(ds.y, yhat, mTe) }
    };
    if (lin) { met.val.lin = ML.metrics(ds.y, lin.pred, mVaB); met.test.lin = ML.metrics(ds.y, lin.pred, mTeB); }
    /* errores por hora, mes y condición (prueba, subconjunto común) */
    var byHour = [], byMonth = [], byCond = {};
    for (var h = 0; h < 24; h++) byHour.push({ rf: 0, pe: 0, n: 0 });
    for (var mo = 0; mo < 12; mo++) byMonth.push({ rf: 0, pe: 0, n: 0 });
    ML.CONDITIONS.forEach(function (c) { byCond[c] = { rf: 0, pe: 0, n: 0 }; });
    var cref = ML.clearRef(pr);
    var test = { t: [], y: [], rf: [], pe: [], cond: [] };
    for (var k = b; k < m; k++) {
      var yt = ds.y[k], yr = yhat[k], yp = pers.pred[k];
      var cond = ML.condition(pr, ds.idx[k], cref);
      test.t.push(ds.t[k]); test.y.push(yt); test.rf.push(yr); test.pe.push(yp); test.cond.push(cond);
      if (!isFinite(yp)) continue;
      var hh = Math.floor(U.hourOf(ds.t[k])), mm = U.monthOf(ds.t[k]) - 1;
      byHour[hh].rf += Math.abs(yr - yt); byHour[hh].pe += Math.abs(yp - yt); byHour[hh].n++;
      byMonth[mm].rf += Math.abs(yr - yt); byMonth[mm].pe += Math.abs(yp - yt); byMonth[mm].n++;
      if (cond && byCond[cond]) { byCond[cond].rf += Math.abs(yr - yt); byCond[cond].pe += Math.abs(yp - yt); byCond[cond].n++; }
    }
    var fin = function (o) { return { rf: o.n ? o.rf / o.n : NaN, pe: o.n ? o.pe / o.n : NaN, n: o.n }; };
    byHour = byHour.map(fin); byMonth = byMonth.map(fin);
    Object.keys(byCond).forEach(function (c) { byCond[c] = fin(byCond[c]); });
    /* energía diaria en prueba (solo días con cobertura ≥ 90 %) */
    var perDay = Math.max(1, Math.round(24 / pr.dtH)), days = new Map();
    for (var q = b; q < m; q++) {
      var d = U.dayStart(ds.t[q]), e = days.get(d) || { y: 0, rf: 0, pe: 0, li: 0, n: 0, np: 0, nl: 0 };
      e.y += ML.toKWh(ds.y[q], tk, pr.dtH); e.rf += ML.toKWh(yhat[q], tk, pr.dtH); e.n++;
      if (isFinite(pers.pred[q])) { e.pe += ML.toKWh(pers.pred[q], tk, pr.dtH); e.np++; }
      if (lin && isFinite(lin.pred[q])) { e.li += ML.toKWh(lin.pred[q], tk, pr.dtH); e.nl++; }
      days.set(d, e);
    }
    var dayRows = [];
    days.forEach(function (e, d) { if (e.n >= 0.9 * perDay && e.np === e.n) dayRows.push({ day: d, y: e.y, rf: e.rf, pe: e.pe, li: lin && e.nl === e.n ? e.li : NaN }); });
    dayRows.sort(function (x, y) { return x.day - y.day; });
    var dm = function (key) {
      if (!dayRows.length) return { mae: NaN, rmse: NaN, wape: NaN, n: 0 };
      var sa = 0, ss = 0, sy = 0;
      dayRows.forEach(function (r) { var er = r[key] - r.y; sa += Math.abs(er); ss += er * er; sy += Math.abs(r.y); });
      return { mae: sa / dayRows.length, rmse: Math.sqrt(ss / dayRows.length), wape: sy > 0 ? 100 * sa / sy : NaN, n: dayRows.length, meanY: sy / dayRows.length };
    };
    var daily = { rf: dm('rf'), pe: dm('pe'), rows: dayRows };
    if (lin && dayRows.every(function (r) { return isFinite(r.li); })) daily.li = dm('li');
    /* Energía diaria media del ENTRENAMIENTO: regla fija «día promedio» para el backtest de la decisión */
    var trDays = new Map();
    for (var q2 = 0; q2 < a; q2++) { var d2 = U.dayStart(ds.t[q2]), e2 = trDays.get(d2) || { y: 0, n: 0 }; e2.y += ML.toKWh(ds.y[q2], tk, pr.dtH); e2.n++; trDays.set(d2, e2); }
    var trSum = 0, trN = 0;
    trDays.forEach(function (e2) { if (e2.n >= 0.9 * perDay) { trSum += e2.y; trN++; } });
    daily.trainMean = trN ? trSum / trN : NaN;
    var model = {
      trees: forest.trees, params: forest.params, importance: forest.importance, trainMs: forest.trainMs, nodes: forest.nodes,
      features: feats.slice(), targetKey: tk, dtH: pr.dtH, stepMs: pr.stepMs, ranges: ranges(ds.X, feats, 0, a), trainedAt: Date.now()
    };
    var split = {
      m: m, excluded: ds.excluded,
      train: { n: a, start: ds.t[0], end: ds.t[a - 1] },
      val: { n: b - a, start: ds.t[a], end: ds.t[b - 1] },
      test: { n: m - b, start: ds.t[b], end: ds.t[m - 1] }
    };
    var evaluation = { metrics: met, split: split, persLagH: pers.lagH, linear: lin ? { key: lin.key, a: lin.a, b: lin.b } : null, byHour: byHour, byMonth: byMonth, byCond: byCond, test: test, daily: daily, condRefKey: cref ? cref.key : null, targetKey: tk, dtH: pr.dtH };
    return { model: model, evaluation: evaluation, ds: ds };
  };

  /* Ajuste de profundidad con el conjunto de VALIDACIÓN (paso 8) */
  ML.tune = async function (pr, feats, baseParams, grid, onProgress) {
    var ds = ML.buildDataset(pr, feats, pr.targetKey);
    var sp = ML.chronoSplit(ds.m), a = sp.train[1], b = sp.val[1];
    var Xtr = ds.X.map(function (c) { return c.subarray(0, a); }), ytr = ds.y.subarray(0, a);
    var out = [];
    for (var i = 0; i < grid.length; i++) {
      var p = Object.assign({}, baseParams, grid[i]);
      var f = await ML.trainForest(Xtr, ytr, p);
      var yh = ML.predictCols(f, ds.X, a, b);
      var yv = ds.y.subarray(a, b);
      for (var k = 0; k < yh.length; k++) if (yh[k] < 0) yh[k] = 0;
      var mt = ML.metrics(yv, yh);
      out.push({ params: grid[i], mae: mt.mae, rmse: mt.rmse, r2: mt.r2 });
      if (onProgress) onProgress(i + 1, grid.length);
      await U.sleep(0);
    }
    return out;
  };

  /* ---------------- Climatología mensual por hora ---------------- */
  ML.climatology = function (pr) {
    var keys = pr.keys.slice(), acc = {};
    for (var m = 1; m <= 12; m++) { acc[m] = []; for (var h = 0; h < 24; h++) { var o = {}; keys.forEach(function (k) { o[k] = [0, 0]; }); acc[m].push(o); } }
    for (var i = 0; i < pr.n; i++) {
      var mo = U.monthOf(pr.t[i]), hr = Math.floor(U.hourOf(pr.t[i])), cell = acc[mo][hr];
      for (var j = 0; j < keys.length; j++) { var v = pr.vars[keys[j]][i]; if (isFinite(v)) { cell[keys[j]][0] += v; cell[keys[j]][1]++; } }
    }
    var out = {};
    for (var m2 = 1; m2 <= 12; m2++) {
      out[m2] = acc[m2].map(function (o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k][1] ? o[k][0] / o[k][1] : NaN; }); return r; });
    }
    /* meses sin datos: usar el mes más cercano con datos */
    for (var m3 = 1; m3 <= 12; m3++) {
      var has = out[m3].some(function (r) { return keys.some(function (k) { return isFinite(r[k]); }); });
      if (has) continue;
      for (var d = 1; d <= 6; d++) {
        var c1 = ((m3 - 1 + d) % 12) + 1, c2 = ((m3 - 1 - d + 12) % 12) + 1;
        var src = [c1, c2].find(function (c) { return out[c].some(function (r) { return keys.some(function (k) { return isFinite(r[k]); }); }); });
        if (src) { out[m3] = out[src]; out[m3].borrowedFrom = src; break; }
      }
    }
    return out;
  };

  /* Registros históricos comparables (vecinos más cercanos con misma hora ± 1 h) */
  ML.comparable = function (pr, model, t, vals, k) {
    k = k || 5;
    var meteo = model.features.filter(function (f) { return ML.FEAT[f].group === 'meteo'; });
    var srcs = []; meteo.forEach(function (f) { var s = ML.FEAT[f].src; if (srcs.indexOf(s) < 0) srcs.push(s); });
    var stats = {};
    srcs.forEach(function (s) { stats[s] = { m: U.mean(pr.vars[s]), sd: U.std(pr.vars[s]) || 1 }; });
    var H = U.hourOf(t), tk = model.targetKey, cand = [];
    for (var i = 0; i < pr.n; i++) {
      var y = pr.vars[tk][i]; if (!isFinite(y)) continue;
      var dh = Math.abs(U.hourOf(pr.t[i]) - H); dh = Math.min(dh, 24 - dh);
      if (pr.dtH < 24 && dh > 1) continue;
      var d2 = 0, ok = true;
      for (var j = 0; j < srcs.length; j++) {
        var s = srcs[j], v = pr.vars[s][i], iv = +vals[s];
        if (!isFinite(iv)) continue;
        if (!isFinite(v)) { ok = false; break; }
        var z = (v - iv) / stats[s].sd;
        if (s === 'DIR_VIENTO') { var dd = Math.abs(v - iv) % 360; dd = Math.min(dd, 360 - dd); z = dd / 90; }
        d2 += z * z;
      }
      if (!ok) continue;
      cand.push({ i: i, d: Math.sqrt(d2) });
    }
    cand.sort(function (a, b) { return a.d - b.d; });
    return cand.slice(0, k).map(function (c) {
      var row = model.features.map(function (f) { return ML.featureValue(f, pr.t[c.i], function (key) { return pr.vars[key] ? pr.vars[key][c.i] : NaN; }); });
      return { t: pr.t[c.i], y: pr.vars[tk][c.i], pred: Math.max(0, ML.predictRow(model, row)), dist: c.d, irr: pr.vars.IRRADIANCIA ? pr.vars.IRRADIANCIA[c.i] : NaN };
    });
  };

  /* Similitud: fracción de entradas meteorológicas dentro de [P1, P99] del entrenamiento */
  ML.similarity = function (model, row) {
    var inR = 0, tot = 0, out = [];
    model.features.forEach(function (f, j) {
      if (ML.FEAT[f].group !== 'meteo') return;
      var r = model.ranges[f]; if (!r) return;
      tot++;
      var v = row[j];
      if (v >= r.p1 - 1e-9 && v <= r.p99 + 1e-9) inR++;
      else out.push({ f: f, v: v, p1: r.p1, p99: r.p99 });
    });
    return { score: tot ? inR / tot : 1, inRange: inR, total: tot, outside: out };
  };
})();
