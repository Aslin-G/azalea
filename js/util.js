/* ==========================================================================
   util.js — Utilidades generales (DOM, formato, fechas, números, estadística,
   PRNG reproducible, hash, descargas, modales y notificaciones).
   Convención de tiempo: todas las marcas de tiempo se manejan como "hora
   local ingenua" codificada en UTC (ms). Se leen siempre con getUTC*().
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U = {};

  /* ---------------- DOM ---------------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); };
  U.debounce = function (fn, ms) {
    var t = null;
    return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  U.isNum = function (v) { return typeof v === 'number' && isFinite(v); };

  /* ---------------- Formato numérico ----------------
     Punto decimal (convención de ingeniería del proyecto) y espacio fino
     como separador de miles. */
  U.fmt = function (v, d) {
    if (v == null || typeof v !== 'number' || !isFinite(v)) return '—';
    if (d == null) d = 1;
    var s = Math.abs(v) >= 1e15 ? v.toExponential(2) : v.toFixed(d);
    if (s === '-0' || /^-0\.0*$/.test(s)) s = s.replace('-', '');
    var parts = s.split('.');
    var ip = parts[0], neg = '';
    if (ip[0] === '-') { neg = '-'; ip = ip.slice(1); }
    if (ip.length > 4) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
    return neg + ip + (parts.length > 1 ? '.' + parts[1] : '');
  };
  U.fmtInt = function (v) { return U.fmt(v, 0); };
  /* Cobertura (fracción) en %: con un decimal cerca de 100 % para no mostrar "100 %" cuando es 99.6 % */
  U.fmtCover = function (c) {
    if (c == null || !isFinite(c)) return '—';
    var p = c * 100;
    if (p >= 99 && p < 101) return U.fmt(Math.floor(p * 10) / 10, 1);
    return U.fmt(p < 100 ? Math.floor(p) : Math.round(p), 0);
  };
  U.fmtPct = function (v, d) { return (v == null || !isFinite(v)) ? '—' : U.fmt(v, d == null ? 1 : d) + ' %'; };
  U.fmtAuto = function (v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1000) return U.fmt(v, 0);
    if (a >= 100) return U.fmt(v, 1);
    if (a >= 1) return U.fmt(v, 2);
    if (a === 0) return '0';
    return U.fmt(v, 3);
  };

  /* ---------------- Fechas ---------------- */
  U.MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  U.MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  U.DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  U.p2 = p2;
  U.HOUR = 3600000;
  U.DAY = 86400000;
  U.fmtDate = function (ms) {
    if (!isFinite(ms)) return '—';
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  };
  U.fmtDateTime = function (ms) {
    if (!isFinite(ms)) return '—';
    var d = new Date(ms);
    return U.fmtDate(ms) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
  };
  U.fmtHM = function (ms) { var d = new Date(ms); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
  U.dayStart = function (ms) { return Math.floor(ms / U.DAY) * U.DAY; };
  U.hourOf = function (ms) { var d = new Date(ms); return d.getUTCHours() + d.getUTCMinutes() / 60; };
  U.monthOf = function (ms) { return new Date(ms).getUTCMonth() + 1; };
  U.doyOf = function (ms) {
    var d = new Date(ms);
    return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / U.DAY) + 1;
  };
  /* Fecha/hora "reales" del equipo, expresadas como hora local ingenua */
  U.nowLocalNaive = function () {
    var d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  };
  U.nowStamp = function () { var d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); };
  U.nowHuman = function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  U.dateInputValue = function (ms) { return U.fmtDate(ms); };
  U.parseDateInput = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };

  /* Serial de Excel (sistema 1900) -> ms ingenuos */
  U.excelSerialToMs = function (serial) {
    return Math.round((serial - 25569) * 86400) * 1000;
  };

  /* ---------------- Clasificación y conversión de valores ---------------- */
  U.isEmpty = function (v) { return v == null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && isNaN(v)); };

  /* Convierte a número admitiendo coma decimal y separadores de miles.
     Devuelve NaN si no es numérico. */
  U.parseNumber = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v === 'boolean') return NaN;
    if (v instanceof Date) return NaN;
    if (v == null) return NaN;
    var s = String(v).trim().replace(/[\u00A0\u202F\s]/g, '');
    if (!s) return NaN;
    s = s.replace(/^\+/, '');
    /* Separadores de miles solo cuando no hay ambigüedad (p. ej. 1.234.567 o 1.234,5);
       "16.427" se interpreta como decimal y "16,427" como coma decimal. */
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^-?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, '');
    else if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) s = s.replace(',', '.');
    else if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    }
    if (!/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  };

  U.valueKind = function (v) {
    if (U.isEmpty(v)) return 'empty';
    if (v instanceof Date) return v.getUTCFullYear() < 1901 ? 'time' : 'date';
    if (typeof v === 'number') return 'number';
    var s = String(v).trim();
    if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(s) || /^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}/.test(s)) return 'date';
    if (/^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i.test(s)) return 'time';
    if (isFinite(U.parseNumber(s))) return 'number';
    return 'text';
  };

  /* Detecta si un conjunto de fechas en texto usa día primero (DD/MM). */
  U.detectDayFirst = function (values) {
    var dayFirst = 0, monthFirst = 0;
    for (var i = 0; i < values.length; i++) {
      var s = values[i];
      if (typeof s !== 'string') continue;
      var m = /^\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s);
      if (!m) continue;
      var a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) dayFirst++;
      else if (b > 12 && a <= 12) monthFirst++;
    }
    return monthFirst > dayFirst ? false : true; /* por defecto DD/MM (Colombia) */
  };

  function ampm(h, suf) {
    if (!suf) return h;
    suf = suf.toLowerCase().replace(/\./g, '');
    if (suf === 'pm' && h < 12) return h + 12;
    if (suf === 'am' && h === 12) return 0;
    return h;
  }

  /* Convierte un valor a ms (fecha u hora-fecha ingenua). NaN si no es posible. */
  U.parseDateTime = function (v, dayFirst) {
    if (v == null) return NaN;
    if (v instanceof Date) return isNaN(v.getTime()) ? NaN : v.getTime();
    if (typeof v === 'number') {
      if (!isFinite(v)) return NaN;
      if (v >= 1000000000 && v <= 9999999999 && String(Math.round(v)).length === 10 && /^(19|20)\d{8}$/.test(String(v))) {
        /* formato YYYYMMDDHH (NASA POWER) */
        var s0 = String(v);
        return Date.UTC(+s0.slice(0, 4), +s0.slice(4, 6) - 1, +s0.slice(6, 8), +s0.slice(8, 10));
      }
      if (v >= 19000101 && v <= 21001231 && Number.isInteger(v)) {
        var s1 = String(v);
        return Date.UTC(+s1.slice(0, 4), +s1.slice(4, 6) - 1, +s1.slice(6, 8));
      }
      if (v > 1e11 && v < 1e13) return v; /* epoch ms */
      if (v >= 1 && v < 110000) return U.excelSerialToMs(v); /* serial Excel */
      return NaN;
    }
    var s = String(v).trim();
    if (!s) return NaN;
    var m, y, mo, d, h = 0, mi = 0, se = 0;
    m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([ap]\.?m\.?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
    if (m) {
      y = +m[1]; mo = +m[2]; d = +m[3];
      if (m[4] != null) { h = ampm(+m[4], m[7]); mi = +m[5]; se = m[6] ? +m[6] : 0; }
    } else {
      m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?$/i.exec(s);
      if (m) {
        var a = +m[1], b = +m[2];
        y = +m[3]; if (y < 100) y += 2000;
        if (dayFirst === false) { mo = a; d = b; } else { d = a; mo = b; }
        if (mo > 12 && d <= 12) { var tmp = mo; mo = d; d = tmp; }
        if (m[4] != null) { h = ampm(+m[4], m[7]); mi = +m[5]; se = m[6] ? +m[6] : 0; }
      } else {
        m = /^(\d{4})(\d{2})(\d{2})(?:[ T:]?(\d{2})(?::?(\d{2}))?)?$/.exec(s);
        if (m) {
          y = +m[1]; mo = +m[2]; d = +m[3];
          if (m[4] != null) h = +m[4];
          if (m[5] != null) mi = +m[5];
        } else {
          var n = U.parseNumber(s);
          if (isFinite(n)) return U.parseDateTime(n, dayFirst);
          return NaN;
        }
      }
    }
    if (!(y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h >= 0 && h <= 24 && mi >= 0 && mi < 60)) return NaN;
    var t = Date.UTC(y, mo - 1, d, h, mi, se);
    var chk = new Date(t);
    if (h < 24 && chk.getUTCDate() !== d) return NaN;
    return t;
  };

  /* Convierte un valor a hora decimal [0,24). NaN si no es posible. */
  U.parseTime = function (v) {
    if (v == null) return NaN;
    if (v instanceof Date) return v.getUTCHours() + v.getUTCMinutes() / 60 + v.getUTCSeconds() / 3600;
    if (typeof v === 'number') {
      if (!isFinite(v)) return NaN;
      if (v >= 0 && v < 1) return Math.round(v * 24 * 3600) / 3600; /* fracción de día (Excel) */
      if (v >= 0 && v <= 24 && Math.abs(v - Math.round(v)) < 1e-9) return v % 24;
      if (v >= 100 && v <= 2400 && Number.isInteger(v) && v % 100 < 60) return Math.floor(v / 100) + (v % 100) / 60;
      return NaN;
    }
    var s = String(v).trim();
    var m = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i.exec(s);
    if (m && (m[2] != null || m[4])) {
      var h = ampm(+m[1], m[4]);
      if (h > 24 || (m[2] && +m[2] >= 60)) return NaN;
      return (h % 24) + (m[2] ? +m[2] / 60 : 0) + (m[3] ? +m[3] / 3600 : 0);
    }
    m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*$/i.exec(s);
    if (m) {
      var h2 = ampm(+m[1], m[4]);
      if (h2 > 24 || +m[2] >= 60) return NaN;
      return (h2 % 24) + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0);
    }
    var n = U.parseNumber(s);
    if (isFinite(n)) return U.parseTime(n);
    return NaN;
  };

  /* ---------------- Estadística ---------------- */
  U.finite = function (arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) out.push(v); }
    return out;
  };
  U.sortedFinite = function (arr) { return U.finite(arr).sort(function (a, b) { return a - b; }); };
  U.quantileSorted = function (s, q) {
    if (!s.length) return NaN;
    var pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  U.quantile = function (arr, q) { return U.quantileSorted(U.sortedFinite(arr), q); };
  U.mean = function (arr) {
    var s = 0, n = 0;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) { s += v; n++; } }
    return n ? s / n : NaN;
  };
  U.sum = function (arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) s += v; }
    return s;
  };
  U.std = function (arr) {
    var m = U.mean(arr), s = 0, n = 0;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) { s += (v - m) * (v - m); n++; } }
    return n > 1 ? Math.sqrt(s / (n - 1)) : NaN;
  };
  U.minmax = function (arr) {
    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; } }
    return [mn, mx];
  };
  U.pearson = function (a, b) {
    var n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (var i = 0; i < a.length; i++) {
      var x = a[i], y = b[i];
      if (!(isFinite(x) && isFinite(y))) continue;
      n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
    }
    if (n < 3) return NaN;
    var cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n;
    if (va <= 0 || vb <= 0) return NaN;
    return cov / Math.sqrt(va * vb);
  };
  U.mode = function (arr) {
    var m = new Map(), best = NaN, bc = 0;
    for (var i = 0; i < arr.length; i++) { var c = (m.get(arr[i]) || 0) + 1; m.set(arr[i], c); if (c > bc) { bc = c; best = arr[i]; } }
    return best;
  };

  /* ---------------- PRNG reproducible (mulberry32) ---------------- */
  U.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.normal = function () {
      var u = 0, v = 0;
      while (u === 0) u = f();
      while (v === 0) v = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    f.int = function (n) { return Math.floor(f() * n); };
    return f;
  };

  /* ---------------- Hash FNV-1a (huella de datos) ---------------- */
  U.fnv1a = function (str, h) {
    h = h == null ? 0x811c9dc5 : h;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  };
  U.hashArrays = function (arrays) {
    var h = 0x811c9dc5;
    for (var a = 0; a < arrays.length; a++) {
      var arr = arrays[a];
      for (var i = 0; i < arr.length; i++) {
        var v = arr[i];
        h = U.fnv1a(isFinite(v) ? (Math.round(v * 1000) / 1000).toString() : 'NaN', h);
      }
      h = U.fnv1a('|', h);
    }
    return ('00000000' + h.toString(16)).slice(-8).toUpperCase();
  };

  /* ---------------- Descargas ---------------- */
  U.download = function (filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  U.csvCell = function (v) {
    if (v == null) return '';
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '';
    var s = String(v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  U.toCSV = function (header, rows) {
    var out = [header.map(U.csvCell).join(',')];
    for (var i = 0; i < rows.length; i++) out.push(rows[i].map(U.csvCell).join(','));
    return '\uFEFF' + out.join('\r\n');
  };
  U.slug = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  };

  /* ---------------- Notificaciones, modales, ocupado ---------------- */
  U.toast = function (msg, type, ms) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = msg;
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, (ms || 3800));
    setTimeout(function () { el.remove(); }, (ms || 3800) + 350);
  };

  U.modal = function (opts) {
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root');
      var back = document.createElement('div');
      back.className = 'modal-back';
      var btns = opts.buttons || [{ label: 'Cerrar', value: true, cls: 'btn-primary' }];
      back.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-h">' + (opts.icon ? '<span style="font-size:1.3rem">' + opts.icon + '</span>' : '') + '<h3>' + U.esc(opts.title || '') + '</h3></div>' +
        '<div class="modal-b">' + (opts.html || '') + '</div>' +
        '<div class="modal-f">' + btns.map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" data-mi="' + i + '">' + U.esc(b.label) + '</button>'; }).join('') + '</div></div>';
      function close(val) { back.remove(); document.removeEventListener('keydown', onKey); resolve(val); }
      function onKey(e) { if (e.key === 'Escape') close(opts.cancelValue !== undefined ? opts.cancelValue : false); }
      back.addEventListener('click', function (e) {
        if (e.target === back) { close(opts.cancelValue !== undefined ? opts.cancelValue : false); return; }
        var b = e.target.closest('[data-mi]');
        if (b) {
          var def = btns[+b.getAttribute('data-mi')];
          var val = def.value;
          if (typeof val === 'function') val = val(back);
          close(val);
        }
      });
      document.addEventListener('keydown', onKey);
      root.appendChild(back);
      if (opts.onOpen) opts.onOpen(back);
      var first = back.querySelector('.modal-f .btn-primary, .modal-f .btn-danger');
      if (first) first.focus();
    });
  };
  U.confirm = function (title, html, okLabel, danger) {
    return U.modal({
      title: title, html: html, icon: danger ? '⚠\uFE0F' : '❓',
      buttons: [{ label: 'Cancelar', value: false, cls: '' }, { label: okLabel || 'Aceptar', value: true, cls: danger ? 'btn-danger' : 'btn-primary' }]
    });
  };

  var busyEl = null;
  U.busy = function (msg) {
    if (!busyEl) {
      busyEl = document.createElement('div');
      busyEl.className = 'busy';
      busyEl.innerHTML = '<div class="bx"><div class="spinner"></div><div class="bmsg"></div></div>';
    }
    busyEl.querySelector('.bmsg').textContent = msg || 'Procesando…';
    if (!busyEl.parentNode) document.body.appendChild(busyEl);
  };
  U.idle = function () { if (busyEl && busyEl.parentNode) busyEl.remove(); };
  /* Ejecuta una tarea mostrando el indicador de ocupado y cediendo el hilo para pintar. */
  U.withBusy = async function (msg, fn) {
    U.busy(msg);
    await U.sleep(30);
    try { return await fn(); } finally { U.idle(); }
  };

  U.table = function (headers, rows, opts) {
    opts = opts || {};
    var numCols = opts.numCols || [];
    var h = '<div class="table-wrap' + (opts.tall ? ' tall' : '') + '"><table class="t' + (opts.compact ? ' compact' : '') + '"><thead><tr>' +
      headers.map(function (x, i) { return '<th class="' + (numCols.indexOf(i) >= 0 ? 'n' : '') + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) {
      h += '<tr>' + rows[r].map(function (c, i) { return '<td class="' + (numCols.indexOf(i) >= 0 ? 'n' : '') + '">' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>';
    }
    if (!rows.length) h += '<tr><td colspan="' + headers.length + '" class="muted">Sin datos</td></tr>';
    return h + '</tbody></table></div>';
  };
})();
