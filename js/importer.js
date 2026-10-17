/* ==========================================================================
   importer.js — Importación de datos brutos: Excel (.xlsx/.xls mediante
   SheetJS local), CSV/TXT (delimitador automático, formato NASA POWER),
   detección de encabezados, tipos de datos, selección y unión de hojas.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U, Map_ = SEDA.Mapping;
  var I = SEDA.Import = {};

  I.readAsArrayBuffer = function (file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('No se pudo leer el archivo')); };
      r.readAsArrayBuffer(file);
    });
  };
  I.readAsText = function (file, enc) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('No se pudo leer el archivo')); };
      r.readAsText(file, enc || 'UTF-8');
    });
  };

  /* ---------------- Excel ---------------- */
  function cellValue(cell, stats) {
    if (!cell) return null;
    switch (cell.t) {
      case 'n':
        if (cell.z && typeof cell.z === 'string' && window.XLSX.SSF.is_date(cell.z)) return new Date(U.excelSerialToMs(cell.v));
        return cell.v;
      case 'd': {
        var d = cell.v instanceof Date ? cell.v : new Date(cell.v);
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
      }
      case 's': return cell.v;
      case 'b': return cell.v ? 'VERDADERO' : 'FALSO';
      case 'e': stats.errors++; return null;
      case 'z': return null;
      default: return cell.v == null ? null : cell.v;
    }
  }
  I.parseExcel = function (buf) {
    if (!window.XLSX) throw new Error('La librería local de Excel (js/lib/xlsx.full.min.js) no se cargó.');
    var wb = window.XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, cellText: false });
    var sheets = [];
    wb.SheetNames.forEach(function (name) {
      var ws = wb.Sheets[name], stats = { errors: 0 };
      var aoa = [];
      if (ws && ws['!ref']) {
        var rg = window.XLSX.utils.decode_range(ws['!ref']);
        var maxR = Math.min(rg.e.r, rg.s.r + 1048575);
        for (var R = rg.s.r; R <= maxR; R++) {
          var row = [], any = false;
          for (var Cc = rg.s.c; Cc <= rg.e.c; Cc++) {
            var v = cellValue(ws[window.XLSX.utils.encode_cell({ r: R, c: Cc })], stats);
            if (v != null && v !== '') any = true;
            row.push(v);
          }
          aoa.push(any ? row : []);
        }
      }
      sheets.push({ name: name, aoa: aoa, cellErrors: stats.errors });
    });
    return sheets;
  };

  /* ---------------- CSV ---------------- */
  function detectDelimiter(lines) {
    var cands = [',', ';', '\t', '|'], best = ',', bestScore = -1;
    cands.forEach(function (d) {
      var counts = lines.map(function (l) { return splitLine(l, d).length; }).filter(function (c) { return c > 1; });
      if (!counts.length) return;
      var mode = U.mode(counts), consistent = counts.filter(function (c) { return c === mode; }).length;
      var score = consistent * 10 + mode;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }
  function splitLine(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  I.parseCSV = function (text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var meta = { nasa: false, headerLines: [] };
    var endIdx = text.indexOf('-END HEADER-');
    if (endIdx >= 0) {
      meta.nasa = /NASA\/POWER|POWER/i.test(text.slice(0, endIdx));
      meta.headerLines = text.slice(0, endIdx).split(/\r?\n/).slice(0, 40);
      text = text.slice(text.indexOf('\n', endIdx) + 1);
    }
    /* líneas respetando comillas con saltos de línea */
    var lines = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '"') q = !q;
      if ((ch === '\n' || ch === '\r') && !q) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        lines.push(cur); cur = '';
      } else cur += ch;
    }
    if (cur.length) lines.push(cur);
    var probe = lines.filter(function (l) { return l.trim(); }).slice(0, 30);
    var d = detectDelimiter(probe);
    meta.delimiter = d === '\t' ? 'TAB' : d;
    var aoa = lines.map(function (l) { return l.trim() ? splitLine(l, d).map(function (c) { return c.trim(); }) : []; });
    return { aoa: aoa, meta: meta };
  };

  /* ---------------- Encabezados y tabla ---------------- */
  I.findHeaderRow = function (aoa) {
    var lim = Math.min(aoa.length, 40);
    for (var r = 0; r < lim; r++) {
      var row = aoa[r] || [], ne = 0, txt = 0;
      for (var c = 0; c < row.length; c++) {
        var v = row[c]; if (U.isEmpty(v)) continue; ne++;
        var k = U.valueKind(v);
        if (k === 'text') txt++;
      }
      if (ne >= 2 && txt >= Math.max(2, Math.ceil(ne * 0.6))) {
        /* confirmar que alguna de las 3 filas siguientes contiene datos no textuales */
        for (var k2 = 1; k2 <= 3 && r + k2 < aoa.length; k2++) {
          var nx = aoa[r + k2] || [], nonText = 0;
          for (var c2 = 0; c2 < nx.length; c2++) { var v2 = nx[c2]; if (!U.isEmpty(v2) && U.valueKind(v2) !== 'text') nonText++; }
          if (nonText >= 1) return r;
        }
      }
    }
    return 0;
  };
  I.buildTable = function (aoa, headerIdx) {
    if (headerIdx == null) headerIdx = I.findHeaderRow(aoa);
    var hdrRow = aoa[headerIdx] || [];
    var body = [];
    var maxC = hdrRow.length;
    for (var r = headerIdx + 1; r < aoa.length; r++) {
      var row = aoa[r];
      if (!row || !row.length) continue;
      var any = false;
      for (var c = 0; c < row.length; c++) if (!U.isEmpty(row[c])) { any = true; if (c + 1 > maxC) maxC = c + 1; }
      if (any) body.push(row);
    }
    /* recortar columnas totalmente vacías al final */
    var lastUsed = -1;
    for (var cc = 0; cc < maxC; cc++) {
      var used = !U.isEmpty(hdrRow[cc]);
      for (var rr = 0; rr < body.length && !used; rr++) if (!U.isEmpty(body[rr][cc])) used = true;
      if (used) lastUsed = cc;
    }
    var ncol = lastUsed + 1;
    var seen = {};
    var headers = [];
    for (var h = 0; h < ncol; h++) {
      var name = U.isEmpty(hdrRow[h]) ? 'Columna ' + (h + 1) : (hdrRow[h] instanceof Date ? U.fmtDate(hdrRow[h].getTime()) : String(hdrRow[h]).trim());
      var base = name, k = 2;
      while (seen[name]) name = base + ' (' + (k++) + ')';
      seen[name] = true;
      headers.push(name);
    }
    var rows = body.map(function (row) { var o = new Array(ncol); for (var i = 0; i < ncol; i++) o[i] = row[i] === undefined || row[i] === '' ? null : row[i]; return o; });
    return { headers: headers, rows: rows, headerRow: headerIdx };
  };

  /* Descripción de columnas: tipos, vacíos, muestra */
  I.describe = function (table) {
    var n = table.rows.length;
    return table.headers.map(function (h, c) {
      var k = { number: 0, date: 0, time: 0, text: 0, empty: 0 };
      var step = Math.max(1, Math.floor(n / 3000));
      var seen = 0;
      for (var r = 0; r < n; r += step) { k[U.valueKind(table.rows[r][c])]++; seen++; }
      var ne = seen - k.empty, type = 'vacío';
      if (ne) {
        var best = ['number', 'date', 'time', 'text'].sort(function (a, b) { return k[b] - k[a]; })[0];
        type = { number: 'numérico', date: 'fecha', time: 'hora', text: 'texto' }[best];
        if (k[best] / ne < 0.9) type += ' (mixto)';
      }
      var sample = [];
      for (var r2 = 0; r2 < n && sample.length < 3; r2++) if (!U.isEmpty(table.rows[r2][c])) sample.push(I.showVal(table.rows[r2][c]));
      return { name: h, type: type, emptyPct: seen ? k.empty / seen * 100 : 0, numericPct: ne ? k.number / ne * 100 : 0, sample: sample };
    });
  };
  I.showVal = function (v) {
    if (v == null) return '';
    if (v instanceof Date) return v.getUTCFullYear() < 1901 ? U.fmtHM(v.getTime()) : (v.getTime() % U.DAY === 0 ? U.fmtDate(v.getTime()) : U.fmtDateTime(v.getTime()));
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
    return String(v);
  };

  /* ---------------- Marcas de tiempo desde el mapeo ---------------- */
  I.timestamps = function (table, map) {
    var rows = table.rows, n = rows.length;
    var col = function (k) { return map[k] && map[k].col >= 0 ? map[k].col : -1; };
    var cF = col('FECHA'), cH = col('HORA'), cY = col('ANIO'), cM = col('MES_C'), cD = col('DIA_C'), cJ = col('DOY_C');
    var t = new Float64Array(n);
    var dayFirst = true;
    if (cF >= 0) {
      var smp = [];
      for (var i = 0; i < n && smp.length < 800; i += Math.max(1, Math.floor(n / 800))) smp.push(rows[i][cF]);
      dayFirst = U.detectDayFirst(smp);
    }
    for (var r = 0; r < n; r++) {
      var row = rows[r], ms = NaN, h = NaN;
      if (cH >= 0) h = U.parseTime(row[cH]);
      if (cF >= 0) {
        ms = U.parseDateTime(row[cF], dayFirst);
        if (isFinite(ms) && cH >= 0 && cH !== cF) {
          if (isFinite(h)) ms = U.dayStart(ms) + Math.round(h * 3600) * 1000;
          else if (U.isEmpty(row[cH]) && ms % U.DAY !== 0) { /* la fecha ya incluye la hora */ }
          else ms = NaN;
        }
      } else if (cY >= 0 && cM >= 0 && cD >= 0) {
        var y = U.parseNumber(row[cY]), m = U.parseNumber(row[cM]), d = U.parseNumber(row[cD]);
        if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          ms = Date.UTC(y, m - 1, d);
          if (new Date(ms).getUTCDate() !== d) ms = NaN;
          else if (cH >= 0) ms = isFinite(h) ? ms + Math.round(h * 3600) * 1000 : NaN;
        }
      } else if (cY >= 0 && cJ >= 0) {
        var y2 = U.parseNumber(row[cY]), j = U.parseNumber(row[cJ]);
        if (y2 >= 1900 && j >= 1 && j <= 366) {
          ms = Date.UTC(y2, 0, 1) + (j - 1) * U.DAY;
          if (cH >= 0) ms = isFinite(h) ? ms + Math.round(h * 3600) * 1000 : NaN;
        }
      }
      t[r] = ms;
    }
    return { t: t, dayFirst: dayFirst };
  };

  /* ---------------- Hojas: información y unión ---------------- */
  I.sheetInfo = function (sheet) {
    var table = I.buildTable(sheet.aoa);
    var map = Map_.autoMap(table.headers, table.rows);
    var ts = I.timestamps({ rows: table.rows.slice(0, 500) }, map);
    var validT = 0; for (var i = 0; i < ts.t.length; i++) if (isFinite(ts.t[i])) validT++;
    var numericCols = I.describe({ headers: table.headers, rows: table.rows.slice(0, 300) }).filter(function (d) { return d.type.indexOf('numérico') === 0; }).length;
    return {
      name: sheet.name, table: table, map: map, rows: table.rows.length, cols: table.headers.length,
      hasTime: ts.t.length > 0 && validT / ts.t.length > 0.8, numericCols: numericCols,
      looksData: table.rows.length >= 3 && numericCols >= 1
    };
  };

  /* Une varias hojas: apila si comparten encabezados; si no, une por fecha-hora. */
  I.combine = function (infos) {
    var log = [];
    if (infos.length === 1) return { table: infos[0].table, mode: 'única', log: log };
    var same = infos.every(function (s) { return s.table.headers.join('|') === infos[0].table.headers.join('|'); });
    if (same) {
      var rows = [];
      infos.forEach(function (s) { rows = rows.concat(s.table.rows); log.push('Hoja "' + s.name + '": ' + s.table.rows.length + ' filas apiladas.'); });
      return { table: { headers: infos[0].table.headers.slice(), rows: rows }, mode: 'apilado (mismas columnas)', log: log };
    }
    var byT = new Map(), headers = ['Fecha_Hora'], colIdx = {}, usedNames = { 'Fecha_Hora': true };
    infos.forEach(function (s) {
      if (!s.hasTime) throw new Error('La hoja "' + s.name + '" no tiene una columna de fecha/hora reconocible; no puede unirse por fecha.');
      var timeCols = ['FECHA', 'HORA', 'ANIO', 'MES_C', 'DIA_C', 'DOY_C'].map(function (k) { return s.map[k] && s.map[k].col; }).filter(function (c) { return c != null && c >= 0; });
      colIdx[s.name] = {};
      s.table.headers.forEach(function (h, c) {
        if (timeCols.indexOf(c) >= 0) return;
        var name = h;
        if (usedNames[name]) name = h + ' [' + s.name + ']';
        usedNames[name] = true;
        colIdx[s.name][c] = headers.length;
        headers.push(name);
      });
    });
    var bad = 0;
    infos.forEach(function (s) {
      var ts = I.timestamps(s.table, s.map), ok = 0;
      for (var r = 0; r < s.table.rows.length; r++) {
        var t = ts.t[r];
        if (!isFinite(t)) { bad++; continue; }
        var target = byT.get(t);
        if (!target) { target = new Array(headers.length).fill(null); target[0] = new Date(t); byT.set(t, target); }
        var ci = colIdx[s.name];
        for (var c in ci) { var v = s.table.rows[r][c]; if (!U.isEmpty(v) && target[ci[c]] == null) target[ci[c]] = v; }
        ok++;
      }
      log.push('Hoja "' + s.name + '": ' + ok + ' filas unidas por fecha-hora.');
    });
    var rowsJ = Array.from(byT.keys()).sort(function (a, b) { return a - b; }).map(function (k) {
      var row = byT.get(k); while (row.length < headers.length) row.push(null); return row;
    });
    if (bad) log.push(bad + ' filas sin fecha-hora válida no pudieron unirse (se excluyen de la unión).');
    return { table: { headers: headers, rows: rowsJ }, mode: 'unión por fecha-hora', log: log };
  };

  I.isSyntheticName = function (name) { return /sint[eé]tic|synthetic|demo/i.test(String(name || '')); };
})();
