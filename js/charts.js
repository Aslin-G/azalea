/* ==========================================================================
   charts.js — Librería de gráficos propia sobre Canvas (sin dependencias).
   Tipos: line, bar (vertical/horizontal, agrupado/apilado), scatter,
   heatmap y risk (barras de cobertura con umbral).
   Paleta categórica validada (orden fijo), marcas finas, rejilla sutil,
   leyenda para ≥ 2 series, tooltip + cruz al pasar el cursor, exportación
   de datos a CSV y a imagen PNG (para informes, siempre en tema claro).
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U;
  var C = SEDA.Charts = {};

  var LIGHT = {
    name: 'light', surface: '#fcfcfb', text1: '#0b0b0b', text2: '#52514e', muted: '#8a8984', grid: '#e9e8e4', axis: '#b8b7b1',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
    div: { neg: [42, 120, 214], mid: [240, 239, 236], pos: [227, 73, 72] }, tipBg: '#ffffff'
  };
  var DARK = {
    name: 'dark', surface: '#1a1a19', text1: '#ffffff', text2: '#c3c2b7', muted: '#8f8e86', grid: '#2f2f2c', axis: '#57564f',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
    div: { neg: [57, 135, 229], mid: [56, 56, 53], pos: [230, 103, 103] }, tipBg: '#1a1f26'
  };
  C.LIGHT = LIGHT; C.DARK = DARK;
  C.theme = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? DARK : LIGHT; };
  var FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  var FONT_S = '11px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  var FONT_B = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  function col(c, th) {
    if (c == null) return th.series[0];
    if (typeof c === 'number') return th.series[c % th.series.length];
    if (typeof c === 'string' && c.indexOf('status:') === 0) return th.status[c.slice(7)] || th.series[0];
    if (c === 'muted') return th.muted;
    return c;
  }
  C.color = col;
  function alpha(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join('');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- Escalas ---------- */
  function niceNum(range, round) {
    if (range <= 0 || !isFinite(range)) return 1;
    var exp = Math.floor(Math.log10(range)), f = range / Math.pow(10, exp), nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function niceScale(min, max, maxTicks) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { if (min === 0) { max = 1; } else { var d = Math.abs(min) * 0.1; min -= d; max += d; } }
    var range = niceNum(max - min, false);
    var step = niceNum(range / Math.max(1, maxTicks - 1), true);
    var nmin = Math.floor(min / step + 1e-9) * step, nmax = Math.ceil(max / step - 1e-9) * step;
    var ticks = [], k = 0;
    for (var v = nmin; v <= nmax + step * 0.5 && k < 50; v = nmin + (++k) * step) ticks.push(Math.round(v / step) * step);
    return { min: nmin, max: nmax, step: step, ticks: ticks };
  }
  function tickFmt(v, step) {
    var dec = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
    return U.fmt(v, dec);
  }
  C.niceScale = niceScale;

  function timeTicks(t0, t1, maxTicks) {
    var H = 3600000, D = 86400000, span = t1 - t0;
    var cands = [[H, 'h'], [3 * H, 'h'], [6 * H, 'h'], [12 * H, 'h'], [D, 'd'], [2 * D, 'd'], [7 * D, 'd'], [14 * D, 'd'], [1, 'M'], [2, 'M'], [3, 'M'], [6, 'M'], [12, 'M'], [24, 'M']];
    var pick = cands[cands.length - 1];
    for (var i = 0; i < cands.length; i++) {
      var stepMs = cands[i][1] === 'M' ? cands[i][0] * 30.44 * D : cands[i][0];
      if (span / stepMs <= maxTicks) { pick = cands[i]; break; }
    }
    var ticks = [];
    if (pick[1] === 'M') {
      var d0 = new Date(t0), y = d0.getUTCFullYear(), m = d0.getUTCMonth();
      var t = Date.UTC(y, m, 1); if (t < t0) { m++; t = Date.UTC(y, m, 1); }
      while (m % pick[0] !== 0) { m++; t = Date.UTC(y, m, 1); }
      var guard = 0;
      while (t <= t1 && guard++ < 200) {
        var dd = new Date(t);
        ticks.push({ v: t, l: U.MESES[dd.getUTCMonth()] + ((dd.getUTCMonth() === 0 || ticks.length === 0) ? ' ' + dd.getUTCFullYear() : '') });
        m += pick[0]; t = Date.UTC(y, m, 1);
      }
    } else {
      var step = pick[0];
      var s = Math.ceil(t0 / step) * step;
      if (step === 7 * D || step === 14 * D) s = Math.ceil(t0 / D) * D;
      var g = 0;
      for (var tt = s; tt <= t1 && g++ < 400; tt += step) {
        var d = new Date(tt), l;
        if (pick[1] === 'h' && (d.getUTCHours() !== 0 || step < D)) l = (d.getUTCHours() === 0 ? U.p2(d.getUTCDate()) + ' ' + U.MESES[d.getUTCMonth()] : U.p2(d.getUTCHours()) + ':00');
        else l = U.p2(d.getUTCDate()) + ' ' + U.MESES[d.getUTCMonth()];
        ticks.push({ v: tt, l: l });
      }
    }
    return ticks;
  }

  function roundBar(ctx, x, y, w, h, r, end) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (end === 'top') {
      ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
    } else if (end === 'bottom') {
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    } else if (end === 'right') {
      ctx.moveTo(x, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x, y + h);
    } else if (end === 'left') {
      ctx.moveTo(x + w, y); ctx.lineTo(x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h); ctx.lineTo(x + w, y + h);
    } else { ctx.rect(x, y, w, h); }
    ctx.closePath();
  }

  /* Etiqueta en máximo dos líneas (con elipsis si no cabe) */
  function wrap2(ctx, s, maxW) {
    s = String(s);
    var fit = function (t) { while (t.length > 2 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '\u2026'; return t; };
    if (ctx.measureText(s).width <= maxW) return [s];
    var words = s.split(' '), l1 = '', i = 0;
    while (i < words.length && ctx.measureText((l1 ? l1 + ' ' : '') + words[i]).width <= maxW) { l1 = (l1 ? l1 + ' ' : '') + words[i]; i++; }
    if (!l1) { l1 = words[0]; i = 1; }
    var l2 = words.slice(i).join(' ');
    return l2 ? [fit(l1), fit(l2)] : [fit(l1)];
  }

  /* ---------- Leyenda (≥ 2 series) ---------- */
  function drawLegend(ctx, items, th, W, kind) {
    if (!items || items.length < 2) return 0;
    ctx.font = FONT;
    var x = 8, y = 14, rowH = 18, maxW = W - 8;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], tw = ctx.measureText(it.name).width, need = 22 + tw + 16;
      if (x + need > maxW && x > 8) { x = 8; y += rowH; }
      ctx.fillStyle = it.color;
      if ((it.kind || kind) === 'line') {
        if (it.dash) { ctx.save(); ctx.strokeStyle = it.color; ctx.lineWidth = 2; ctx.setLineDash(it.dash); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 16, y - 4); ctx.stroke(); ctx.restore(); }
        else roundBar(ctx, x, y - 5.5, 16, 3, 1.5), ctx.fill();
      } else { roundBar(ctx, x + 3, y - 9, 10, 10, 2), ctx.fill(); }
      ctx.fillStyle = th.text2; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.name, x + 22, y);
      x += need;
    }
    return y + 8;
  }

  function frame(ctx, spec, th, W, H, legendH, yTicksLabels, opts) {
    ctx.font = FONT_S;
    var maxL = 0;
    for (var i = 0; i < yTicksLabels.length; i++) maxL = Math.max(maxL, ctx.measureText(yTicksLabels[i]).width);
    var left = Math.ceil(maxL) + 12 + (spec.yLabel ? 18 : 0);
    if (opts && opts.leftOverride) left = opts.leftOverride;
    var top = Math.max(legendH, 10) + 6;
    var bottom = 24 + (spec.xLabel ? 16 : 0) + ((opts && opts.extraBottom) || 0);
    var right = 14;
    return { l: left, t: top, r: W - right, b: H - bottom, w: W - right - left, h: H - bottom - top };
  }
  function axisLabels(ctx, spec, th, P, W, H) {
    ctx.fillStyle = th.text2; ctx.font = FONT_S;
    if (spec.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(spec.xLabel, P.l + P.w / 2, H - 4); }
    if (spec.yLabel) {
      ctx.save(); ctx.translate(11, P.t + P.h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spec.yLabel, 0, 0); ctx.restore();
    }
  }
  function yGrid(ctx, th, P, sc, Y) {
    ctx.font = FONT_S; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var i = 0; i < sc.ticks.length; i++) {
      var v = sc.ticks[i], y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(P.r, y); ctx.stroke();
      ctx.fillStyle = th.muted; ctx.fillText(tickFmt(v, sc.step), P.l - 6, y);
    }
  }
  function refLines(ctx, spec, th, P, X, Y) {
    (spec.refLines || []).forEach(function (r) {
      var c = col(r.color || 'muted', th);
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (r.axis === 'x') { var x = X(r.value); if (x < P.l || x > P.r) { ctx.restore(); return; } ctx.moveTo(x, P.t); ctx.lineTo(x, P.b); }
      else { var y = Y(r.value); if (y < P.t - 1 || y > P.b + 1) { ctx.restore(); return; } ctx.moveTo(P.l, y); ctx.lineTo(P.r, y); }
      ctx.stroke(); ctx.setLineDash([]);
      if (r.label) {
        ctx.font = FONT_S; ctx.fillStyle = th.text2;
        if (r.axis === 'x') { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(r.label, X(r.value) + 4, P.t + 2); }
        else { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(r.label, P.r - 4, Y(r.value) - 3); }
      }
      ctx.restore();
    });
  }
  function fmtY(spec, v) { return spec.valueFmt ? spec.valueFmt(v) : U.fmtAuto(v); }
  function fmtX(spec, v) {
    if (spec.xFmt) return spec.xFmt(v);
    if (spec.xType === 'time') return U.fmtDateTime(v);
    return U.fmtAuto(v);
  }
  function tipRow(color, name, val) { return '<div class="tt-r"><i style="background:' + color + '"></i>' + U.esc(name) + '<b>' + val + '</b></div>'; }

  /* ---------- LINE ---------- */
  function drawLine(ctx, spec, th, W, H) {
    var S = (spec.series || []).filter(function (s) { return s.y && s.y.length; });
    var cats = spec.categories;
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    S.forEach(function (s) {
      if (!s.x) s.x = s.y.map(function (_, i) { return i; });
      for (var i = 0; i < s.y.length; i++) {
        var x = s.x[i], y = s.y[i];
        if (!isFinite(x) || !isFinite(y)) continue;
        if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      }
    });
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
    (spec.refLines || []).forEach(function (r) { if (r.axis !== 'x' && isFinite(r.value)) { ymin = Math.min(ymin, r.value); ymax = Math.max(ymax, r.value); } });
    if (spec.yMin != null) ymin = spec.yMin; else if (ymin > 0 && spec.zero !== false) ymin = 0;
    if (spec.yMax != null) ymax = spec.yMax;
    var legendH = drawLegend(ctx, S.map(function (s, i) { return { name: s.name, color: col(s.color != null ? s.color : i, th), dash: s.dash }; }), th, W, 'line');
    var sc = niceScale(ymin, ymax, Math.max(3, Math.floor(H / 55)));
    var P = frame(ctx, spec, th, W, H, legendH, sc.ticks.map(function (v) { return tickFmt(v, sc.step); }));
    if (cats) { xmin = -0.5; xmax = cats.length - 0.5; }
    if (spec.xMin != null) xmin = spec.xMin;
    if (spec.xMax != null) xmax = spec.xMax;
    var X = function (v) { return P.l + (v - xmin) / ((xmax - xmin) || 1) * P.w; };
    var Y = function (v) { return P.b - (v - sc.min) / ((sc.max - sc.min) || 1) * P.h; };
    yGrid(ctx, th, P, sc, Y);
    /* eje X */
    ctx.fillStyle = th.muted; ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var xt;
    if (cats) {
      var every = Math.max(1, Math.ceil(cats.length / Math.max(2, Math.floor(P.w / 44))));
      xt = cats.map(function (c, i) { return { v: i, l: String(c) }; }).filter(function (_, i) { return i % every === 0; });
    } else if (spec.xTicks) {
      var stepT = Math.max(1, Math.ceil(spec.xTicks.length / Math.max(2, Math.floor(P.w / 56))));
      xt = spec.xTicks.filter(function (_, i) { return i % stepT === 0; });
    } else if (spec.xType === 'time') xt = timeTicks(xmin, xmax, Math.max(2, Math.floor(P.w / 80)));
    else { var xs = niceScale(xmin, xmax, Math.max(3, Math.floor(P.w / 70))); xt = xs.ticks.filter(function (v) { return v >= xmin - 1e-9 && v <= xmax + 1e-9; }).map(function (v) { return { v: v, l: tickFmt(v, xs.step) }; }); }
    xt.forEach(function (t) { var x = X(t.v); if (x >= P.l - 1 && x <= P.r + 1) ctx.fillText(t.l, x, P.b + 6); });
    ctx.strokeStyle = th.axis; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.l, Math.round(P.b) + 0.5); ctx.lineTo(P.r, Math.round(P.b) + 0.5); ctx.stroke();
    refLines(ctx, spec, th, P, X, Y);
    ctx.save(); ctx.beginPath(); ctx.rect(P.l, P.t - 2, P.w, P.h + 4); ctx.clip();
    S.forEach(function (s, si) {
      var c = col(s.color != null ? s.color : si, th);
      var n = s.y.length, pts = [];
      var decimate = n > P.w * 2.2;
      if (decimate) {
        var bucket = -1, bmin = 0, bmax = 0, bfirst = null, blast = null;
        var flush = function () { if (bucket >= 0 && bfirst) { pts.push([bfirst[0], bfirst[1]]); pts.push([bucket + 0.5, bmin]); pts.push([bucket + 0.5, bmax]); pts.push([blast[0], blast[1]]); } };
        for (var i = 0; i < n; i++) {
          var xv = s.x[i], yv = s.y[i];
          if (!isFinite(yv) || !isFinite(xv)) { flush(); pts.push(null); bucket = -1; bfirst = null; continue; }
          var px = X(xv), py = Y(yv), b = Math.floor(px);
          if (b !== bucket) { flush(); bucket = b; bmin = bmax = py; bfirst = [px, py]; }
          if (py < bmin) bmin = py; if (py > bmax) bmax = py; blast = [px, py];
        }
        flush();
      } else {
        for (var j = 0; j < n; j++) pts.push(isFinite(s.y[j]) && isFinite(s.x[j]) ? [X(s.x[j]), Y(s.y[j])] : null);
      }
      if (s.fill) {
        ctx.fillStyle = alpha(c, 0.12); ctx.beginPath(); var open = false, x0 = 0;
        var base = Y(Math.max(sc.min, 0));
        pts.forEach(function (p, k) {
          if (!p) { if (open) { ctx.lineTo(pts[k - 1][0], base); ctx.lineTo(x0, base); ctx.closePath(); } open = false; return; }
          if (!open) { ctx.moveTo(p[0], base); ctx.lineTo(p[0], p[1]); x0 = p[0]; open = true; } else ctx.lineTo(p[0], p[1]);
        });
        if (open) { var lp = null; for (var q = pts.length - 1; q >= 0; q--) if (pts[q]) { lp = pts[q]; break; } ctx.lineTo(lp[0], base); ctx.lineTo(x0, base); ctx.closePath(); }
        ctx.fill();
      }
      ctx.strokeStyle = c; ctx.lineWidth = s.width || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      ctx.beginPath(); var pen = false;
      pts.forEach(function (p) { if (!p) { pen = false; return; } if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]); });
      ctx.stroke(); ctx.setLineDash([]);
      if (s.markers) {
        pts.forEach(function (p) { if (!p) return; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fillStyle = th.surface; ctx.fill(); ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });
      }
    });
    ctx.restore();
    axisLabels(ctx, spec, th, P, W, H);
    return {
      hit: function (mx, my) {
        if (mx < P.l || mx > P.r || my < P.t - 10 || my > P.b + 10 || !S.length) return null;
        var xv = xmin + (mx - P.l) / P.w * (xmax - xmin);
        var ref = S[0], idx = nearestIdx(ref.x, xv);
        if (idx < 0) return null;
        var xAt = ref.x[idx];
        var html = '<div class="tt-h">' + U.esc(cats ? cats[Math.round(xAt)] : fmtX(spec, xAt)) + '</div>';
        var dots = [];
        S.forEach(function (s, si) {
          var k = s === ref ? idx : nearestIdx(s.x, xAt);
          if (k < 0) return;
          var v = s.y[k], c = col(s.color != null ? s.color : si, th);
          html += tipRow(c, s.name || 'Serie', isFinite(v) ? fmtY(spec, v) + (spec.unit ? ' ' + spec.unit : '') : '—');
          if (isFinite(v)) dots.push([X(s.x[k]), Y(v), c]);
        });
        var px = X(xAt);
        return {
          html: html, x: px, y: my,
          overlay: function (o) {
            o.strokeStyle = th.axis; o.lineWidth = 1; o.beginPath(); o.moveTo(Math.round(px) + 0.5, P.t); o.lineTo(Math.round(px) + 0.5, P.b); o.stroke();
            dots.forEach(function (d) { o.beginPath(); o.arc(d[0], d[1], 6, 0, Math.PI * 2); o.fillStyle = th.surface; o.fill(); o.beginPath(); o.arc(d[0], d[1], 4, 0, Math.PI * 2); o.fillStyle = d[2]; o.fill(); });
          }
        };
      }
    };
  }
  function nearestIdx(xs, v) {
    var n = xs.length; if (!n) return -1;
    var lo = 0, hi = n - 1;
    if (xs[0] > xs[n - 1]) { var best = -1, bd = Infinity; for (var i = 0; i < n; i++) { var d = Math.abs(xs[i] - v); if (d < bd) { bd = d; best = i; } } return best; }
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] < v) lo = mid; else hi = mid; }
    return Math.abs(xs[lo] - v) <= Math.abs(xs[hi] - v) ? lo : hi;
  }

  /* ---------- BAR ---------- */
  function drawBar(ctx, spec, th, W, H) {
    var cats = spec.categories || [], S = spec.series || [], stacked = !!spec.stacked, horiz = !!spec.horizontal;
    var nC = cats.length, nS = S.length;
    var vmin = 0, vmax = 0;
    for (var c = 0; c < nC; c++) {
      var pos = 0, neg = 0;
      for (var s = 0; s < nS; s++) {
        var v = S[s].values[c]; if (!isFinite(v)) continue;
        if (stacked) { if (v >= 0) pos += v; else neg += v; }
        else { vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); }
      }
      if (stacked) { vmax = Math.max(vmax, pos); vmin = Math.min(vmin, neg); }
    }
    (spec.refLines || []).forEach(function (r) { if (isFinite(r.value)) { vmax = Math.max(vmax, r.value); vmin = Math.min(vmin, r.value); } });
    if (spec.yMax != null) vmax = spec.yMax;
    else if (spec.showValues) vmax += (vmax - vmin) * 0.08;
    var legendH = drawLegend(ctx, S.map(function (s, i) { return { name: s.name, color: col(s.color != null ? s.color : i, th) }; }), th, W, 'bar');
    var sc = niceScale(vmin, vmax, Math.max(3, Math.floor((horiz ? W : H) / (horiz ? 90 : 55))));
    var bars = [];
    var P;
    if (!horiz) {
      ctx.font = FONT_S;
      var estBand = (W - 70) / Math.max(1, nC), estEvery = Math.max(1, Math.ceil(nC / Math.max(1, Math.floor((W - 70) / 38))));
      var labs = cats.map(function (c) { return wrap2(ctx, c, estBand * estEvery - 6); });
      var twoLines = labs.some(function (l) { return l.length > 1; });
      P = frame(ctx, spec, th, W, H, legendH, sc.ticks.map(function (v) { return tickFmt(v, sc.step); }), { extraBottom: twoLines ? 13 : 0 });
      var Y = function (v) { return P.b - (v - sc.min) / ((sc.max - sc.min) || 1) * P.h; };
      yGrid(ctx, th, P, sc, Y);
      var band = P.w / Math.max(1, nC);
      var groupW = stacked ? Math.min(band * 0.72, 28) : Math.min(band * 0.8, nS * 24 + (nS - 1) * 2);
      var bw = stacked ? groupW : Math.max(1, Math.min(24, (groupW - (nS - 1) * 2) / nS));
      var maxLab = Math.max(1, Math.floor(P.w / 38)), every = Math.max(1, Math.ceil(nC / maxLab));
      for (var ci = 0; ci < nC; ci++) {
        var cx = P.l + band * (ci + 0.5);
        if (ci % every === 0) {
          ctx.font = FONT_S; ctx.fillStyle = th.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          var ll = wrap2(ctx, cats[ci], band * every - 6);
          for (var li = 0; li < ll.length; li++) ctx.fillText(ll[li], cx, P.b + 6 + li * 13);
        }
        var accP = 0, accN = 0;
        for (var si = 0; si < nS; si++) {
          var val = S[si].values[ci]; if (!isFinite(val)) continue;
          var color = col(S[si].colors ? S[si].colors[ci] : (S[si].color != null ? S[si].color : si), th);
          var x, y0, y1;
          if (stacked) { x = cx - bw / 2; if (val >= 0) { y0 = Y(accP); accP += val; y1 = Y(accP); } else { y0 = Y(accN); accN += val; y1 = Y(accN); } }
          else { x = cx - groupW / 2 + si * (bw + 2); y0 = Y(0); y1 = Y(val); }
          var top = Math.min(y0, y1), h = Math.abs(y1 - y0);
          if (stacked && si > 0 && h > 2) { if (val >= 0) h -= 2; else top += 2; }
          var isEnd = !stacked || si === lastNonZero(S, ci, val >= 0);
          ctx.fillStyle = color;
          roundBar(ctx, x, top, bw, Math.max(h, val === 0 ? 0 : 1), isEnd ? 4 : 0, val >= 0 ? 'top' : 'bottom'); ctx.fill();
          bars.push({ ci: ci, x: x, y: top, w: bw, h: h });
          if (spec.showValues && !stacked) {
            ctx.fillStyle = th.text1; ctx.font = FONT_B; ctx.textAlign = 'center'; ctx.textBaseline = val >= 0 ? 'bottom' : 'top';
            ctx.fillText(fmtY(spec, val), x + bw / 2, val >= 0 ? top - 3 : top + h + 3);
            ctx.font = FONT_S; ctx.fillStyle = th.muted; ctx.textBaseline = 'top';
          }
        }
      }
      ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(P.l, Math.round(Y(0)) + 0.5); ctx.lineTo(P.r, Math.round(Y(0)) + 0.5); ctx.stroke();
      refLines(ctx, spec, th, P, function () { return 0; }, Y);
      axisLabels(ctx, spec, th, P, W, H);
      return {
        hit: function (mx, my) {
          if (mx < P.l || mx > P.r || my < P.t || my > P.b + 20) return null;
          var ci = Math.floor((mx - P.l) / band); if (ci < 0 || ci >= nC) return null;
          var html = '<div class="tt-h">' + U.esc(spec.tipTitle ? spec.tipTitle(ci) : cats[ci]) + '</div>';
          S.forEach(function (s, si) { html += tipRow(col(s.colors ? s.colors[ci] : (s.color != null ? s.color : si), th), s.name || '', fmtY(spec, s.values[ci]) + (spec.unit ? ' ' + spec.unit : '')); });
          var bx = P.l + band * ci;
          return { html: html, x: bx + band / 2, y: my, overlay: function (o) { o.fillStyle = alpha(th.axis, 0.18); o.fillRect(bx, P.t, band, P.h); } };
        }
      };
    }
    /* horizontal */
    ctx.font = FONT;
    var labW = 0; cats.forEach(function (c) { labW = Math.max(labW, ctx.measureText(String(c)).width); });
    labW = Math.min(labW, W * 0.38);
    P = frame(ctx, spec, th, W, H, legendH, [], { leftOverride: labW + 14 });
    P.r -= spec.showValues ? 56 : 0; P.w = P.r - P.l;
    var X = function (v) { return P.l + (v - sc.min) / ((sc.max - sc.min) || 1) * P.w; };
    ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    sc.ticks.forEach(function (v) { var x = Math.round(X(v)) + 0.5; ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, P.b); ctx.stroke(); ctx.fillStyle = th.muted; ctx.fillText(tickFmt(v, sc.step), x, P.b + 6); });
    var bandH = P.h / Math.max(1, nC);
    var bh = Math.max(4, Math.min(22, bandH * 0.66));
    for (var ci2 = 0; ci2 < nC; ci2++) {
      var cy = P.t + bandH * (ci2 + 0.5);
      ctx.font = FONT; ctx.fillStyle = th.text2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      var lab = String(cats[ci2]);
      while (ctx.measureText(lab).width > labW && lab.length > 3) lab = lab.slice(0, -2) + '…';
      ctx.fillText(lab, P.l - 8, cy);
      var acc = 0;
      for (var s2 = 0; s2 < nS; s2++) {
        var v2 = S[s2].values[ci2]; if (!isFinite(v2)) continue;
        var c2 = col(S[s2].colors ? S[s2].colors[ci2] : (S[s2].color != null ? S[s2].color : s2), th);
        var x0 = stacked ? X(acc) : X(0), x1 = stacked ? X(acc + v2) : X(v2);
        if (stacked) acc += v2;
        var left = Math.min(x0, x1), w = Math.abs(x1 - x0);
        if (stacked && s2 > 0 && w > 2) { left += 2; w -= 2; }
        var yb = stacked ? cy - bh / 2 : cy - bh / 2 + (nS > 1 ? (s2 - (nS - 1) / 2) * (bh / nS) : 0);
        var hh = stacked ? bh : bh / (nS > 1 ? nS : 1);
        ctx.fillStyle = c2;
        roundBar(ctx, left, yb, Math.max(w, 1), hh - (nS > 1 && !stacked ? 1 : 0), (!stacked || s2 === nS - 1) ? 4 : 0, v2 >= 0 ? 'right' : 'left'); ctx.fill();
        if (spec.showValues && (!stacked || s2 === nS - 1)) {
          ctx.fillStyle = th.text1; ctx.font = FONT_B; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(fmtY(spec, stacked ? acc : v2) + (spec.unit ? ' ' + spec.unit : ''), Math.max(x0, x1) + 6, yb + hh / 2);
        }
      }
    }
    ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(Math.round(X(0)) + 0.5, P.t); ctx.lineTo(Math.round(X(0)) + 0.5, P.b); ctx.stroke();
    refLines(ctx, spec, th, P, X, function () { return 0; });
    axisLabels(ctx, spec, th, P, W, H);
    return {
      hit: function (mx, my) {
        if (my < P.t || my > P.b || mx < 0 || mx > W) return null;
        var ci = Math.floor((my - P.t) / bandH); if (ci < 0 || ci >= nC) return null;
        var html = '<div class="tt-h">' + U.esc(cats[ci]) + '</div>';
        S.forEach(function (s, si) { html += tipRow(col(s.colors ? s.colors[ci] : (s.color != null ? s.color : si), th), s.name || '', fmtY(spec, s.values[ci]) + (spec.unit ? ' ' + spec.unit : '')); });
        var by = P.t + bandH * ci;
        return { html: html, x: mx, y: by + bandH / 2, overlay: function (o) { o.fillStyle = alpha(th.axis, 0.18); o.fillRect(P.l, by, P.w, bandH); } };
      }
    };
  }
  function lastNonZero(S, ci, positive) {
    var last = -1;
    for (var s = 0; s < S.length; s++) { var v = S[s].values[ci]; if (isFinite(v) && v !== 0 && (v >= 0) === positive) last = s; }
    return last;
  }

  /* ---------- SCATTER ---------- */
  function drawScatter(ctx, spec, th, W, H) {
    var S = spec.series || [];
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, total = 0;
    S.forEach(function (s) {
      for (var i = 0; i < s.x.length; i++) {
        var x = s.x[i], y = s.y[i]; if (!isFinite(x) || !isFinite(y)) continue;
        total++;
        if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      }
    });
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
    if (spec.diag) { var lo = Math.min(xmin, ymin), hi = Math.max(xmax, ymax); xmin = ymin = Math.min(lo, 0); xmax = ymax = hi; }
    if (spec.zero !== false && ymin > 0) ymin = 0;
    if (spec.zeroX && xmin > 0) xmin = 0;
    var legendH = drawLegend(ctx, S.map(function (s, i) { return { name: s.name, color: col(s.color != null ? s.color : i, th) }; }), th, W, 'bar');
    var sy = niceScale(ymin, ymax, Math.max(3, Math.floor(H / 55)));
    var P = frame(ctx, spec, th, W, H, legendH, sy.ticks.map(function (v) { return tickFmt(v, sy.step); }));
    var sx = niceScale(xmin, xmax, Math.max(3, Math.floor(P.w / 70)));
    var X = function (v) { return P.l + (v - sx.min) / ((sx.max - sx.min) || 1) * P.w; };
    var Y = function (v) { return P.b - (v - sy.min) / ((sy.max - sy.min) || 1) * P.h; };
    yGrid(ctx, th, P, sy, Y);
    ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    sx.ticks.forEach(function (v) { var x = Math.round(X(v)) + 0.5; ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, P.b); ctx.stroke(); ctx.fillStyle = th.muted; ctx.fillText(tickFmt(v, sx.step), x, P.b + 6); });
    ctx.strokeStyle = th.axis; ctx.beginPath(); ctx.moveTo(P.l, Math.round(P.b) + 0.5); ctx.lineTo(P.r, Math.round(P.b) + 0.5); ctx.stroke();
    if (spec.diag) {
      ctx.save(); ctx.strokeStyle = th.text2; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]); ctx.beginPath();
      var a = Math.max(sx.min, sy.min), b = Math.min(sx.max, sy.max);
      ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.text2; ctx.font = FONT_S; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('1:1 (predicción perfecta)', X(a) + 8, Y(b) + 14);
      ctx.restore();
    }
    refLines(ctx, spec, th, P, X, Y);
    var r = spec.r || (total > 4000 ? 2 : total > 800 ? 2.6 : 4);
    var al = spec.alpha || (total > 4000 ? 0.28 : total > 800 ? 0.45 : 0.85);
    var pts = [];
    ctx.save(); ctx.beginPath(); ctx.rect(P.l, P.t, P.w, P.h); ctx.clip();
    S.forEach(function (s, si) {
      var c = col(s.color != null ? s.color : si, th);
      ctx.fillStyle = alpha(c, al);
      for (var i = 0; i < s.x.length; i++) {
        var x = s.x[i], y = s.y[i]; if (!isFinite(x) || !isFinite(y)) continue;
        var px = X(x), py = Y(y);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        pts.push([px, py, si, i]);
      }
    });
    ctx.restore();
    axisLabels(ctx, spec, th, P, W, H);
    return {
      hit: function (mx, my) {
        if (mx < P.l || mx > P.r || my < P.t || my > P.b) return null;
        var best = null, bd = 144;
        for (var i = 0; i < pts.length; i++) { var dx = pts[i][0] - mx, dy = pts[i][1] - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = pts[i]; } }
        if (!best) return null;
        var s = S[best[2]], k = best[3], c = col(s.color != null ? s.color : best[2], th);
        var html = (s.labels ? '<div class="tt-h">' + U.esc(s.labels[k]) + '</div>' : (s.name ? '<div class="tt-h">' + U.esc(s.name) + '</div>' : '')) +
          tipRow(c, spec.xLabel || 'x', U.fmtAuto(s.x[k])) + tipRow(c, spec.yLabel || 'y', U.fmtAuto(s.y[k]));
        return { html: html, x: best[0], y: best[1], overlay: function (o) { o.beginPath(); o.arc(best[0], best[1], 7, 0, Math.PI * 2); o.fillStyle = th.surface; o.fill(); o.beginPath(); o.arc(best[0], best[1], 5, 0, Math.PI * 2); o.fillStyle = c; o.fill(); } };
      }
    };
  }

  /* ---------- HEATMAP (correlación, divergente azul–gris–rojo) ---------- */
  function divColor(v, th) {
    if (!isFinite(v)) return th.grid;
    var t = U.clamp(v, -1, 1), a = th.div.mid, b = t < 0 ? th.div.neg : th.div.pos, k = Math.abs(t);
    var r = Math.round(a[0] + (b[0] - a[0]) * k), g = Math.round(a[1] + (b[1] - a[1]) * k), bl = Math.round(a[2] + (b[2] - a[2]) * k);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function drawHeatmap(ctx, spec, th, W, H) {
    var L = spec.labels || [], M = spec.matrix || [], n = L.length;
    ctx.font = FONT_S;
    var lw = 0; L.forEach(function (l) { lw = Math.max(lw, ctx.measureText(l).width); });
    lw = Math.min(lw + 10, W * 0.3);
    var top = 8, bottom = Math.min(Math.max(40, lw * 0.72 + 14), H * 0.4), right = 10;
    var size = Math.max(8, Math.min((W - lw - right) / Math.max(1, n), (H - top - bottom) / Math.max(1, n)));
    var x0 = lw, y0 = top;
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = th.text2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(L[i], x0 - 6, y0 + size * (i + 0.5));
      for (var j = 0; j < n; j++) {
        var v = M[i][j];
        ctx.fillStyle = divColor(v, th);
        ctx.fillRect(x0 + j * size + 1, y0 + i * size + 1, size - 2, size - 2);
        if (size >= 30 && isFinite(v)) {
          var dark = Math.abs(v) > 0.55;
          ctx.fillStyle = dark ? '#ffffff' : th.text1; ctx.textAlign = 'center';
          ctx.fillText(v.toFixed(2), x0 + (j + 0.5) * size, y0 + (i + 0.5) * size);
        }
      }
    }
    for (var k = 0; k < n; k++) {
      ctx.save(); ctx.translate(x0 + (k + 0.5) * size, y0 + n * size + 6); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = th.text2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(L[k], 0, 0); ctx.restore();
    }
    /* escala */
    var sx = x0 + n * size + 16;
    if (sx + 30 < W) {
      for (var q = 0; q <= 40; q++) { ctx.fillStyle = divColor(1 - q / 20, th); ctx.fillRect(sx, y0 + q * (n * size / 41), 12, n * size / 41 + 1); }
      ctx.fillStyle = th.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('+1', sx + 16, y0);
      ctx.textBaseline = 'middle'; ctx.fillText('0', sx + 16, y0 + n * size / 2); ctx.textBaseline = 'bottom'; ctx.fillText('−1', sx + 16, y0 + n * size);
    }
    return {
      hit: function (mx, my) {
        var j = Math.floor((mx - x0) / size), i = Math.floor((my - y0) / size);
        if (i < 0 || j < 0 || i >= n || j >= n) return null;
        return {
          html: '<div class="tt-h">' + U.esc(L[i]) + ' × ' + U.esc(L[j]) + '</div>' + tipRow(divColor(M[i][j], th), 'r de Pearson', isFinite(M[i][j]) ? M[i][j].toFixed(3) : '—'),
          x: x0 + (j + 0.5) * size, y: y0 + (i + 0.5) * size,
          overlay: function (o) { o.strokeStyle = th.text1; o.lineWidth = 2; o.strokeRect(x0 + j * size + 1, y0 + i * size + 1, size - 2, size - 2); }
        };
      }
    };
  }

  /* ---------- RISK (cobertura de reserva) ---------- */
  function drawRisk(ctx, spec, th, W, H) {
    var rows = spec.rows || [];
    var maxV = Math.max(1.6, Math.max.apply(null, rows.map(function (r) { return isFinite(r.value) ? r.value : 0; })) * 1.12);
    ctx.font = FONT;
    var lw = 0; rows.forEach(function (r) { lw = Math.max(lw, ctx.measureText(r.label).width); });
    lw = Math.min(lw + 16, W * 0.45);
    var P = { l: lw, r: W - 64, t: 26, b: H - 30 }; P.w = P.r - P.l; P.h = P.b - P.t;
    var X = function (v) { return P.l + U.clamp(v, 0, maxV) / maxV * P.w; };
    var sc = niceScale(0, maxV, 5);
    ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    sc.ticks.forEach(function (v) { if (v > maxV) return; var x = Math.round(X(v)) + 0.5; ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, P.b); ctx.stroke(); ctx.fillStyle = th.muted; ctx.fillText(Math.round(v * 100) + ' %', x, P.b + 6); });
    var bandH = P.h / Math.max(1, rows.length), bh = Math.min(26, bandH * 0.6);
    rows.forEach(function (r, i) {
      var cy = P.t + bandH * (i + 0.5);
      ctx.font = FONT; ctx.fillStyle = th.text2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      var lab = r.label; while (lab.length > 3 && ctx.measureText(lab).width > lw - 12) lab = lab.slice(0, -2) + '\u2026';
      ctx.fillText(lab, P.l - 8, cy);
      ctx.fillStyle = th.grid; roundBar(ctx, P.l, cy - bh / 2, P.w, bh, 4, 'right'); ctx.fill();
      ctx.fillStyle = col(r.color || 'status:good', th);
      roundBar(ctx, P.l, cy - bh / 2, Math.max(2, X(isFinite(r.value) ? r.value : 0) - P.l), bh, 4, 'right'); ctx.fill();
      ctx.fillStyle = th.text1; ctx.font = FONT_B; ctx.textAlign = 'left';
      ctx.fillText(isFinite(r.value) ? U.fmtCover(r.value) + ' %' : '—', Math.min(X(r.value || 0), P.r) + 6, cy);
    });
    var x1 = Math.round(X(1)) + 0.5;
    ctx.strokeStyle = th.text1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, P.t - 8); ctx.lineTo(x1, P.b); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = th.text1; ctx.font = FONT_S; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('100 % = reserva recomendada cubierta', x1, P.t - 10);
    return {
      hit: function (mx, my) {
        var i = Math.floor((my - P.t) / bandH); if (i < 0 || i >= rows.length) return null;
        var r = rows[i];
        return { html: '<div class="tt-h">' + U.esc(r.label) + '</div>' + tipRow(col(r.color || 'status:good', th), 'Cobertura', isFinite(r.value) ? U.fmt(r.value * 100, 1) + ' %' : '—') + (r.tip ? '<div class="small">' + r.tip + '</div>' : ''), x: mx, y: P.t + bandH * (i + 0.5) };
      }
    };
  }

  /* ---------- GRID (matriz secuencial, p. ej. mes × hora de irradiancia) ---------- */
  var SEQ_L = [[248, 246, 240], [253, 226, 166], [248, 180, 74], [232, 120, 31], [184, 67, 14], [110, 31, 6]];
  var SEQ_D = [[40, 38, 34], [74, 52, 19], [138, 84, 18], [210, 120, 26], [244, 166, 58], [255, 224, 138]];
  function seqColor(t, th) {
    var R = th.name === 'dark' ? SEQ_D : SEQ_L;
    if (!isFinite(t)) return th.grid;
    t = U.clamp(t, 0, 1) * (R.length - 1);
    var i = Math.min(R.length - 2, Math.floor(t)), f = t - i, a = R[i], b = R[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  C.seqColor = seqColor;
  function drawGrid(ctx, spec, th, W, H) {
    var R = spec.rows || [], Cc = spec.cols || [], M = spec.matrix || [];
    var vmin = spec.min != null ? spec.min : Infinity, vmax = spec.max != null ? spec.max : -Infinity;
    if (spec.min == null || spec.max == null) M.forEach(function (r) { r.forEach(function (v) { if (isFinite(v)) { if (spec.min == null) vmin = Math.min(vmin, v); if (spec.max == null) vmax = Math.max(vmax, v); } }); });
    if (!isFinite(vmin)) { vmin = 0; vmax = 1; }
    ctx.font = FONT_S;
    var lw = 0; R.forEach(function (l) { lw = Math.max(lw, ctx.measureText(l).width); });
    var left = lw + 12, top = 8, bottom = 22 + (spec.xLabel ? 16 : 0), right = 64;
    var cw = (W - left - right) / Math.max(1, Cc.length), ch = (H - top - bottom) / Math.max(1, R.length);
    for (var i = 0; i < R.length; i++) {
      ctx.fillStyle = th.text2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(R[i], left - 6, top + ch * (i + 0.5));
      for (var j = 0; j < Cc.length; j++) {
        var v = M[i] ? M[i][j] : NaN;
        ctx.fillStyle = seqColor((v - vmin) / ((vmax - vmin) || 1), th);
        ctx.fillRect(left + j * cw, top + i * ch, Math.ceil(cw) - (cw > 8 ? 1 : 0), Math.ceil(ch) - (ch > 8 ? 1 : 0));
      }
    }
    var every = Math.max(1, Math.ceil(Cc.length / Math.max(2, Math.floor((W - left - right) / 34))));
    ctx.fillStyle = th.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    Cc.forEach(function (c, j) { if (j % every === 0) ctx.fillText(c, left + (j + 0.5) * cw, top + R.length * ch + 5); });
    if (spec.xLabel) { ctx.fillStyle = th.text2; ctx.textBaseline = 'alphabetic'; ctx.fillText(spec.xLabel, left + (W - left - right) / 2, H - 4); }
    var sx = W - right + 14, sh = R.length * ch;
    for (var q = 0; q <= 40; q++) { ctx.fillStyle = seqColor(1 - q / 40, th); ctx.fillRect(sx, top + q * sh / 41, 12, sh / 41 + 1); }
    ctx.fillStyle = th.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(U.fmtAuto(vmax), sx + 16, top);
    ctx.textBaseline = 'bottom'; ctx.fillText(U.fmtAuto(vmin), sx + 16, top + sh);
    if (spec.unit) { ctx.textBaseline = 'middle'; ctx.fillText(spec.unit, sx + 16, top + sh / 2); }
    return {
      hit: function (mx, my) {
        var j = Math.floor((mx - left) / cw), i = Math.floor((my - top) / ch);
        if (i < 0 || j < 0 || i >= R.length || j >= Cc.length) return null;
        var v = M[i] ? M[i][j] : NaN;
        return {
          html: '<div class="tt-h">' + U.esc(R[i]) + ' · ' + U.esc(Cc[j]) + '</div>' + tipRow(seqColor((v - vmin) / ((vmax - vmin) || 1), th), spec.valueLabel || 'Valor', (isFinite(v) ? U.fmtAuto(v) : '—') + (spec.unit ? ' ' + spec.unit : '')),
          x: left + (j + 0.5) * cw, y: top + (i + 0.5) * ch,
          overlay: function (o) { o.strokeStyle = th.text1; o.lineWidth = 2; o.strokeRect(left + j * cw + 0.5, top + i * ch + 0.5, cw - 1, ch - 1); }
        };
      }
    };
  }

  var DRAW = { line: drawLine, bar: drawBar, scatter: drawScatter, heatmap: drawHeatmap, risk: drawRisk, grid: drawGrid };

  C.draw = function (canvas, spec, th, W, H, dpr) {
    var ctx = canvas.getContext('2d');
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.surface; ctx.fillRect(0, 0, W, H);
    var fn = DRAW[spec.type] || drawLine;
    var noData = spec.empty || (spec.type === 'line' && !(spec.series || []).some(function (s) { return s.y && s.y.length; })) ||
      (spec.type === 'scatter' && !(spec.series || []).some(function (s) { return s.x && s.x.length; })) ||
      (spec.type === 'bar' && !(spec.categories || []).length) || (spec.type === 'grid' && !(spec.rows || []).length);
    if (noData) {
      ctx.fillStyle = th.muted; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spec.emptyText || 'Sin datos suficientes para este gráfico', W / 2, H / 2);
      return { hit: function () { return null; } };
    }
    return fn(ctx, spec, th, W, H) || { hit: function () { return null; } };
  };

  /* ---------- Montaje interactivo ---------- */
  var registry = new Map();
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { var h = registry.get(e.target); if (h) schedule(h); });
  }) : null;
  function schedule(h) {
    if (h.pending) return;
    h.pending = true;
    requestAnimationFrame(function () { h.pending = false; render(h); });
  }
  function render(h) {
    if (!h.el.isConnected) return;
    var W = h.el.clientWidth, H = h.el.clientHeight;
    if (W < 20 || H < 20) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    h.res = C.draw(h.cv, h.spec, C.theme(), W, H, dpr);
    h.ov.width = Math.round(W * dpr); h.ov.height = Math.round(H * dpr);
    h.dpr = dpr; h.W = W; h.H = H;
  }
  C.mount = function (el, spec) {
    if (!el) return null;
    var old = registry.get(el); if (old && ro) ro.unobserve(el);
    el.innerHTML = '<canvas aria-hidden="true"></canvas><canvas class="ov" style="position:absolute;inset:0;pointer-events:none" aria-hidden="true"></canvas><div class="chart-tip"></div>';
    el.setAttribute('role', 'img');
    if (spec.aria) el.setAttribute('aria-label', spec.aria);
    var cvs = el.querySelectorAll('canvas');
    var h = { el: el, spec: spec, cv: cvs[0], ov: cvs[1], tip: el.querySelector('.chart-tip') };
    registry.set(el, h);
    render(h);
    if (ro) ro.observe(el);
    var raf = 0;
    el.onpointermove = function (e) {
      var rect = el.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var o = h.ov.getContext('2d'); o.setTransform(h.dpr, 0, 0, h.dpr, 0, 0); o.clearRect(0, 0, h.W, h.H);
        var r = h.res && h.res.hit ? h.res.hit(mx, my) : null;
        if (!r) { h.tip.style.display = 'none'; return; }
        if (r.overlay) r.overlay(o);
        h.tip.innerHTML = r.html; h.tip.style.display = 'block';
        var tw = h.tip.offsetWidth, tht = h.tip.offsetHeight;
        var tx = r.x + 14; if (tx + tw > h.W - 4) tx = r.x - tw - 14; if (tx < 4) tx = 4;
        var ty = r.y - tht / 2; ty = U.clamp(ty, 2, Math.max(2, h.H - tht - 2));
        h.tip.style.left = tx + 'px'; h.tip.style.top = ty + 'px';
      });
    };
    el.onpointerleave = function () {
      h.tip.style.display = 'none';
      var o = h.ov.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, h.ov.width, h.ov.height);
    };
    return h;
  };
  C.redrawAll = function () {
    registry.forEach(function (h, el) { if (!el.isConnected) { registry.delete(el); if (ro) ro.unobserve(el); } else render(h); });
  };
  /* Actualiza la especificación de un gráfico ya montado (p. ej. cursor de tiempo) */
  C.update = function (el, spec) {
    var h = el && registry.get(el);
    if (!h) return C.mount(el, spec);
    h.spec = spec; render(h); return h;
  };
  C.specById = function (id) { var el = document.getElementById(id); var h = el && registry.get(el); return h ? h.spec : null; };

  /* Imagen PNG (tema claro) para informes */
  C.toImage = function (spec, W, H) {
    var cv = document.createElement('canvas');
    try { C.draw(cv, spec, LIGHT, W || 880, H || 330, 2); return cv.toDataURL('image/png'); } catch (e) { console.warn(e); return ''; }
  };

  /* Datos del gráfico -> CSV (vista tabular de respaldo) */
  C.specToCSV = function (spec) {
    var header = [], rows = [];
    if (spec.type === 'bar') {
      header = [spec.catLabel || 'Categoría'].concat(spec.series.map(function (s) { return s.name || 'Valor'; }));
      spec.categories.forEach(function (c, i) { rows.push([c].concat(spec.series.map(function (s) { return s.values[i]; }))); });
    } else if (spec.type === 'scatter') {
      header = ['Serie', spec.xLabel || 'x', spec.yLabel || 'y'];
      spec.series.forEach(function (s) { for (var i = 0; i < s.x.length; i++) rows.push([s.name || '', s.x[i], s.y[i]]); });
    } else if (spec.type === 'grid') {
      header = [spec.rowLabel || ''].concat(spec.cols);
      spec.rows.forEach(function (l, i) { rows.push([l].concat(spec.matrix[i])); });
    } else if (spec.type === 'heatmap') {
      header = [''].concat(spec.labels);
      spec.labels.forEach(function (l, i) { rows.push([l].concat(spec.matrix[i])); });
    } else if (spec.type === 'risk') {
      header = ['Indicador', 'Cobertura']; spec.rows.forEach(function (r) { rows.push([r.label, r.value]); });
    } else {
      header = [spec.xLabel || 'x'].concat(spec.series.map(function (s) { return s.name || 'Serie'; }));
      var base = spec.series[0] || { x: [], y: [] };
      var xs = base.x || base.y.map(function (_, i) { return i; });
      for (var i = 0; i < xs.length; i++) {
        var xv = spec.categories ? spec.categories[xs[i]] : (spec.xType === 'time' ? U.fmtDateTime(xs[i]) : xs[i]);
        rows.push([xv].concat(spec.series.map(function (s) { var k = s === base ? i : nearestIdx(s.x || [], xs[i]); return k >= 0 && (s.x ? s.x[k] === xs[i] : true) ? s.y[k] : ''; })));
      }
    }
    return U.toCSV(header, rows);
  };

  /* HTML de tarjeta de gráfico */
  C.card = function (id, title, sub, height, note) {
    return '<div class="chart-card"><div class="cc-head"><div><h3>' + title + '</h3>' + (sub ? '<p class="cc-sub">' + sub + '</p>' : '') + '</div>' +
      '<button class="btn btn-sm btn-ghost no-print" data-chart-csv="' + id + '" title="Descargar los datos de este gráfico (CSV)">⇩ CSV</button></div>' +
      '<div class="chart-box" id="' + id + '" style="height:' + (height || 300) + 'px"></div>' + (note ? '<div class="chart-note">' + note + '</div>' : '') + '</div>';
  };
})();
