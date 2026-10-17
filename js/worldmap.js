/* ==========================================================================
   worldmap.js — Mapa mundial interactivo 100 % offline (SEDA.WorldMap).
   Canvas + proyección Web Mercator sobre Natural Earth 1:50m (js/data/world.js).
   Arrastrar para desplazar, rueda / pellizco / doble clic para acercar,
   clic para elegir el punto de análisis, teclado (flechas, + / −, Enter).
   Capas: océano, retícula con rótulos, países, país bajo el cursor, país
   seleccionado, terminador día/noche (astronómico), sitios consultados,
   ciudades de referencia, marcador del punto elegido y barra de escala.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, Sol = SEDA.Solar;
  var WM = SEDA.WorldMap = {};
  var RAD = Math.PI / 180, MAXLAT = 85.05;

  WM.CITIES = [
    ['Riohacha', 'La Guajira', 11.544, -72.907, 1], ['Uribia', 'La Guajira', 11.714, -72.266, 1], ['Maicao', 'La Guajira', 11.378, -72.239, 1], ['Punta Gallinas', 'La Guajira', 12.458, -71.667, 1],
    ['Valledupar', 'Cesar', 10.463, -73.253, 1], ['Santa Marta', 'Magdalena', 11.241, -74.199, 1], ['Barranquilla', 'Atlántico', 10.964, -74.796, 1], ['Cartagena', 'Bolívar', 10.391, -75.479, 1],
    ['Sincelejo', 'Sucre', 9.305, -75.398, 1], ['Montería', 'Córdoba', 8.748, -75.881, 1], ['Cúcuta', 'Norte de Santander', 7.894, -72.504, 1], ['Bucaramanga', 'Santander', 7.119, -73.123, 1],
    ['Arauca', 'Arauca', 7.084, -70.759, 1], ['Medellín', 'Antioquia', 6.244, -75.581, 1], ['Quibdó', 'Chocó', 5.694, -76.661, 1], ['Tunja', 'Boyacá', 5.535, -73.368, 1],
    ['Yopal', 'Casanare', 5.337, -72.395, 1], ['Manizales', 'Caldas', 5.068, -75.517, 1], ['Pereira', 'Risaralda', 4.813, -75.696, 1], ['Bogotá', 'Cundinamarca', 4.711, -74.072, 1],
    ['Armenia', 'Quindío', 4.534, -75.681, 1], ['Ibagué', 'Tolima', 4.438, -75.232, 1], ['Villavicencio', 'Meta', 4.142, -73.627, 1], ['Puerto Carreño', 'Vichada', 6.189, -67.486, 1],
    ['Inírida', 'Guainía', 3.865, -67.924, 1], ['Cali', 'Valle del Cauca', 3.452, -76.532, 1], ['Neiva', 'Huila', 2.927, -75.282, 1], ['San José del Guaviare', 'Guaviare', 2.570, -72.641, 1],
    ['Popayán', 'Cauca', 2.444, -76.614, 1], ['Florencia', 'Caquetá', 1.614, -75.606, 1], ['Mitú', 'Vaupés', 1.253, -70.234, 1], ['Mocoa', 'Putumayo', 1.152, -76.652, 1],
    ['Pasto', 'Nariño', 1.214, -77.281, 1], ['Leticia', 'Amazonas', -4.215, -69.941, 1], ['San Andrés', 'San Andrés y Providencia', 12.584, -81.701, 1],
    ['Ciudad de Panamá', 'Panamá', 8.983, -79.517, 0], ['Caracas', 'Venezuela', 10.491, -66.879, 0], ['Maracaibo', 'Venezuela', 10.642, -71.612, 0], ['Quito', 'Ecuador', -0.180, -78.468, 0],
    ['Lima', 'Perú', -12.046, -77.043, 0], ['Calama (Atacama)', 'Chile', -22.456, -68.929, 0], ['Santiago', 'Chile', -33.449, -70.669, 0], ['Buenos Aires', 'Argentina', -34.604, -58.382, 0],
    ['São Paulo', 'Brasil', -23.551, -46.633, 0], ['Brasilia', 'Brasil', -15.794, -47.882, 0], ['San José', 'Costa Rica', 9.928, -84.091, 0], ['Ciudad de México', 'México', 19.433, -99.133, 0],
    ['Miami', 'Estados Unidos', 25.762, -80.192, 0], ['Phoenix', 'Estados Unidos', 33.448, -112.074, 0], ['Madrid', 'España', 40.417, -3.704, 0], ['Sevilla', 'España', 37.389, -5.984, 0],
    ['Berlín', 'Alemania', 52.520, 13.405, 0], ['Riad', 'Arabia Saudita', 24.713, 46.675, 0], ['Dubái', 'Emiratos Árabes Unidos', 25.205, 55.271, 0], ['Nairobi', 'Kenia', -1.292, 36.822, 0],
    ['Ciudad del Cabo', 'Sudáfrica', -33.925, 18.424, 0], ['Nueva Delhi', 'India', 28.614, 77.209, 0], ['Pekín', 'China', 39.904, 116.407, 0], ['Sídney', 'Australia', -33.869, 151.209, 0]
  ].map(function (c) { return { name: c[0], region: c[1], lat: c[2], lon: c[3], co: !!c[4] }; });

  /* ---------------- Datos del mapa (decodificados una vez) ---------------- */
  var WORLD = null;
  function mx(lon) { return (lon + 180) / 360; }
  function my(lat) { var l = U.clamp(lat, -MAXLAT, MAXLAT) * RAD; return 0.5 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / (2 * Math.PI); }
  function ilon(x) { return x * 360 - 180; }
  function ilat(y) { return (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / RAD; }
  WM.project = function (lat, lon) { return [mx(lon), my(lat)]; };
  WM.unproject = function (x, y) { return [ilat(y), ilon(x)]; };
  function load() {
    if (WORLD) return WORLD;
    var src = window.SEDA_WORLD;
    WORLD = [];
    if (!src) return WORLD;
    var q = src.q;
    src.c.forEach(function (c) {
      var rings = [], mrings = [];
      c[3].forEach(function (enc) {
        var n = enc.length / 2, g = new Float32Array(n * 2), m = new Float32Array(n * 2), x = 0, y = 0;
        for (var i = 0; i < n; i++) {
          x += enc[2 * i]; y += enc[2 * i + 1];
          var lon = x / q, lat = y / q;
          g[2 * i] = lon; g[2 * i + 1] = lat; m[2 * i] = mx(lon); m[2 * i + 1] = my(lat);
        }
        rings.push(g); mrings.push(m);
      });
      var bb = c[2];
      WORLD.push({ name: c[0], a2: c[1], bb: bb, mbb: [mx(bb[0]), my(bb[3]), mx(bb[2]), my(bb[1])], rings: rings, mrings: mrings });
    });
    return WORLD;
  }
  function pip(ring, lon, lat) {
    var inside = false, n = ring.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /* País que contiene el punto (o null si es océano) */
  WM.countryAt = function (lat, lon) {
    var W = load();
    for (var i = 0; i < W.length; i++) {
      var c = W[i], b = c.bb;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      for (var r = 0; r < c.rings.length; r++) if (pip(c.rings[r], lon, lat)) return c;
    }
    return null;
  };
  WM.findCountry = function (name) { var W = load(), n = U.slug(name); for (var i = 0; i < W.length; i++) if (U.slug(W[i].name) === n || W[i].a2 === name) return W[i]; return null; };
  WM.nearestCity = function (lat, lon, maxKm) {
    var best = null, bd = Infinity;
    WM.CITIES.forEach(function (c) { var d = WM.distKm(lat, lon, c.lat, c.lon); if (d < bd) { bd = d; best = c; } });
    return best && bd <= (maxKm || 40) ? { city: best, km: bd } : null;
  };
  WM.distKm = function (a1, o1, a2, o2) {
    var p1 = a1 * RAD, p2 = a2 * RAD, dp = (a2 - a1) * RAD, dl = (o2 - o1) * RAD;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  WM.fmtLat = function (v) { return isFinite(v) ? Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'N' : 'S') : '—'; };
  WM.fmtLon = function (v) { return isFinite(v) ? Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'E' : 'O') : '—'; };

  function cssVar(el, name, def) { var v = getComputedStyle(el).getPropertyValue(name).trim(); return v || def; }

  /* ---------------- Componente ---------------- */
  WM.create = function (host, opts) {
    opts = opts || {};
    load();
    host.classList.add('wmap');
    host.innerHTML = '<canvas class="wm-cv" tabindex="0" aria-label="Mapa mundial interactivo: arrastre para desplazar, rueda para acercar, clic para elegir el punto de análisis"></canvas>' +
      '<div class="wm-zoom"><button type="button" data-wz="in" title="Acercar">+</button><button type="button" data-wz="out" title="Alejar">−</button><button type="button" data-wz="world" title="Vista mundial">🌐</button><button type="button" data-wz="co" title="Colombia">CO</button><button type="button" data-wz="pt" title="Centrar en el punto elegido">◎</button><button type="button" data-wz="night" title="Mostrar/ocultar día y noche (ahora)">☾</button></div>' +
      '<div class="wm-read" aria-live="off"><span class="wm-ll">Mueva el cursor sobre el mapa</span><span class="wm-cn"></span></div>' +
      '<div class="wm-attr">Natural Earth · world-atlas · proyección Mercator</div><div class="wm-hint">Clic para elegir el punto · arrastre · rueda para acercar</div>';
    var cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
    var st = { cx: mx(-74), cy: my(4.5), S: 900, W: 0, H: 0, dpr: 1, point: null, hover: null, hoverC: null, selC: null, night: opts.night !== false, markers: [], showCities: true, anim: null };
    var inst = { el: host, st: st };

    function minS() { return Math.max(st.W, st.H * 0.95, 256); }
    function clampView() {
      st.S = U.clamp(st.S, minS(), 256 * Math.pow(2, 11));
      var hx = st.W / 2 / st.S, hy = st.H / 2 / st.S;
      st.cx = hx >= 0.5 ? 0.5 : U.clamp(st.cx, hx, 1 - hx);
      st.cy = hy >= 0.5 ? 0.5 : U.clamp(st.cy, hy, 1 - hy);
    }
    function toPx(x, y) { return [(x - st.cx) * st.S + st.W / 2, (y - st.cy) * st.S + st.H / 2]; }
    function toNorm(px, py) { return [(px - st.W / 2) / st.S + st.cx, (py - st.H / 2) / st.S + st.cy]; }
    function pxToLL(px, py) { var n = toNorm(px, py); return [ilat(U.clamp(n[1], 0, 1)), U.clamp(ilon(n[0]), -180, 180)]; }
    inst.pxToLL = pxToLL;
    inst.llToPx = function (lat, lon) { return toPx(mx(lon), my(lat)); };

    var raf = 0;
    function redraw() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; draw(); }); }
    inst.redraw = redraw;

    function resize() {
      var r = host.getBoundingClientRect();
      var W = Math.max(50, Math.round(r.width)), H = Math.max(50, Math.round(r.height));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W === st.W && H === st.H && dpr === st.dpr) return;
      st.W = W; st.H = H; st.dpr = dpr;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      clampView(); draw();
    }

    function ringPath(m) {
      var n = m.length / 2, lx = -1e9, ly = -1e9;
      for (var i = 0; i < n; i++) {
        var px = (m[2 * i] - st.cx) * st.S + st.W / 2, py = (m[2 * i + 1] - st.cy) * st.S + st.H / 2;
        if (i === 0) ctx.moveTo(px, py);
        else if (Math.abs(px - lx) + Math.abs(py - ly) > 0.6 || i === n - 1) ctx.lineTo(px, py);
        else continue;
        lx = px; ly = py;
      }
      ctx.closePath();
    }
    function visible(c) {
      var a = toPx(c.mbb[0], c.mbb[1]), b = toPx(c.mbb[2], c.mbb[3]);
      return !(b[0] < 0 || a[0] > st.W || b[1] < 0 || a[1] > st.H);
    }
    function gratStep() {
      var degPx = st.S / 360, steps = [30, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1];
      for (var i = 0; i < steps.length; i++) if (steps[i] * degPx < 110) return steps[Math.max(0, i - 1)];
      return 0.1;
    }
    function draw() {
      if (!st.W) return;
      var el = host;
      var C = {
        o1: cssVar(el, '--map-ocean', '#dfe9f1'), o2: cssVar(el, '--map-ocean-2', '#cddbe7'), land: cssVar(el, '--map-land', '#f7f5ef'), landH: cssVar(el, '--map-land-hover', '#fff0d0'),
        sel: cssVar(el, '--map-land-sel', '#ffe2a8'), border: cssVar(el, '--map-border', '#b3bfca'), grid: cssVar(el, '--map-grid', 'rgba(40,80,120,.13)'), label: cssVar(el, '--map-label', '#5c6b79'),
        pin: cssVar(el, '--brand', '#f29d0b'), ink: cssVar(el, '--ink-1', '#0f1b27'), night: cssVar(el, '--map-night', 'rgba(8,20,40,.22)')
      };
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      var g = ctx.createLinearGradient(0, 0, 0, st.H); g.addColorStop(0, C.o1); g.addColorStop(1, C.o2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, st.W, st.H);
      /* retícula */
      var step = gratStep(), tl = pxToLL(0, 0), br = pxToLL(st.W, st.H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
      for (var lo = Math.ceil(tl[1] / step) * step; lo <= br[1]; lo += step) { var x = Math.round(toPx(mx(lo), 0)[0]) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, st.H); }
      for (var la = Math.ceil(br[0] / step) * step; la <= tl[0]; la += step) { var y = Math.round(toPx(0, my(la))[1]) + 0.5; ctx.moveTo(0, y); ctx.lineTo(st.W, y); }
      ctx.stroke();
      /* ecuador y trópicos */
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = C.label; ctx.globalAlpha = 0.35; ctx.beginPath();
      [0, 23.44, -23.44].forEach(function (l) { var y = toPx(0, my(l))[1]; ctx.moveTo(0, y); ctx.lineTo(st.W, y); });
      ctx.stroke(); ctx.restore();
      /* países */
      var W = WORLD;
      ctx.lineJoin = 'round';
      for (var i = 0; i < W.length; i++) {
        var c = W[i]; if (!visible(c)) continue;
        ctx.beginPath(); for (var r = 0; r < c.mrings.length; r++) ringPath(c.mrings[r]);
        ctx.fillStyle = c === st.selC ? C.sel : c === st.hoverC ? C.landH : C.land; ctx.fill();
      }
      ctx.strokeStyle = C.border; ctx.lineWidth = st.S > 6000 ? 1 : 0.7; ctx.beginPath();
      for (var k = 0; k < W.length; k++) { var cc = W[k]; if (!visible(cc)) continue; for (var rr = 0; rr < cc.mrings.length; rr++) ringPath(cc.mrings[rr]); }
      ctx.stroke();
      if (st.selC && visible(st.selC)) { ctx.strokeStyle = C.pin; ctx.lineWidth = 1.6; ctx.beginPath(); st.selC.mrings.forEach(ringPath); ctx.stroke(); }
      /* noche */
      if (st.night) drawNight(C);
      /* rótulos de la retícula */
      ctx.font = '10.5px system-ui, sans-serif'; ctx.fillStyle = C.label; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      for (var lo2 = Math.ceil(tl[1] / step) * step; lo2 <= br[1]; lo2 += step) { var xx = toPx(mx(lo2), 0)[0]; if (xx > 30 && xx < st.W - 30) ctx.fillText(fmtDeg(lo2, 'lon', step), xx, st.H - 16); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (var la2 = Math.ceil(br[0] / step) * step; la2 <= tl[0]; la2 += step) { var yy = toPx(0, my(la2))[1]; if (yy > 50 && yy < st.H - 30) ctx.fillText(fmtDeg(la2, 'lat', step), 6, yy); }
      /* ciudades */
      if (st.showCities) {
        var showCo = st.S > 3500, showW = st.S > 1400;
        WM.CITIES.forEach(function (ci) {
          if (ci.co ? !showCo : !showW) return;
          var p = inst.llToPx(ci.lat, ci.lon); if (p[0] < -20 || p[0] > st.W + 20 || p[1] < -20 || p[1] > st.H + 20) return;
          ctx.fillStyle = C.ink; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          if (st.S > (ci.co ? 7000 : 2200)) { ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = C.label; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(ci.name, p[0] + 5, p[1]); }
        });
      }
      /* sitios consultados */
      st.markers.forEach(function (m) {
        var p = inst.llToPx(m.lat, m.lon); if (p[0] < -10 || p[0] > st.W + 10 || p[1] < -10 || p[1] > st.H + 10) return;
        ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fillStyle = m.color || '#2a78d6'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      });
      /* punto elegido */
      if (st.point) {
        var pp = inst.llToPx(st.point.lat, st.point.lon), px0 = pp[0], py0 = pp[1];
        ctx.beginPath(); ctx.arc(px0, py0, 16, 0, 7); ctx.fillStyle = 'rgba(242,157,11,.18)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px0, py0, 10, 0, 7); ctx.strokeStyle = 'rgba(242,157,11,.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); ctx.translate(px0, py0);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-3, -8, -9, -13, -9, -20); ctx.arc(0, -20, 9, Math.PI, 0); ctx.bezierCurveTo(9, -13, 3, -8, 0, 0); ctx.closePath();
        ctx.fillStyle = C.pin; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#6b3d00'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -20, 3.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.restore();
      }
      drawScale(C);
    }
    function fmtDeg(v, kind, step) {
      var d = step < 1 ? (step < 0.5 ? 2 : 1) : 0, a = Math.abs(v).toFixed(d);
      if (Math.abs(v) < 1e-9) return kind === 'lat' ? '0°' : '0°';
      return a + '°' + (kind === 'lat' ? (v > 0 ? 'N' : 'S') : (v > 0 ? 'E' : 'O'));
    }
    function drawNight(C) {
      var ss = Sol.subsolar(new Date()), d = ss.lat * RAD;
      var pts = [];
      for (var lo = -180; lo <= 180; lo += 1.5) {
        var lat = Math.abs(d) < 1e-4 ? 0 : Math.atan(-Math.cos((lo - ss.lon) * RAD) / Math.tan(d)) / RAD;
        pts.push([lo, U.clamp(lat, -MAXLAT, MAXLAT)]);
      }
      var pole = d > 0 ? -MAXLAT : MAXLAT;
      ctx.beginPath();
      pts.forEach(function (p, i) { var q = inst.llToPx(p[1], p[0]); if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); });
      var e = inst.llToPx(pole, 180), s = inst.llToPx(pole, -180);
      ctx.lineTo(e[0], e[1]); ctx.lineTo(s[0], s[1]); ctx.closePath();
      ctx.fillStyle = C.night; ctx.fill();
      var sp = inst.llToPx(ss.lat, ((ss.lon + 540) % 360) - 180);
      ctx.beginPath(); ctx.arc(sp[0], sp[1], 7, 0, 7); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.strokeStyle = 'rgba(255,170,0,.5)'; ctx.lineWidth = 4; ctx.stroke();
    }
    function drawScale(C) {
      var lat = ilat(st.cy), mpp = 40075016.686 * Math.cos(lat * RAD) / st.S;
      var target = 110 * mpp, pow = Math.pow(10, Math.floor(Math.log10(target))), nice = [1, 2, 5, 10].map(function (k) { return k * pow; }).filter(function (v) { return v <= target; }).pop() || pow;
      var w = nice / mpp, x = 12, y = st.H - 34;
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fillRect(x - 4, y - 14, w + 8, 20);
      ctx.strokeStyle = '#243240'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 4); ctx.stroke();
      ctx.fillStyle = '#243240'; ctx.font = '10.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(nice >= 1000 ? U.fmtInt(nice / 1000) + ' km' : U.fmtInt(nice) + ' m', x + w / 2, y - 3);
    }

    /* ---------- vistas ---------- */
    inst.setView = function (lat, lon, S) { st.cx = mx(lon); st.cy = my(lat); if (S) st.S = S; clampView(); redraw(); };
    inst.flyTo = function (lat, lon, S, ms) {
      if (st.anim) cancelAnimationFrame(st.anim);
      var a = { cx: st.cx, cy: st.cy, S: st.S }, b = { cx: mx(lon), cy: my(lat), S: S || st.S }, t0 = performance.now(), dur = ms || 650;
      var lS0 = Math.log(a.S), lS1 = Math.log(b.S);
      (function step(now) {
        var t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        st.cx = a.cx + (b.cx - a.cx) * e; st.cy = a.cy + (b.cy - a.cy) * e; st.S = Math.exp(lS0 + (lS1 - lS0) * e);
        clampView(); draw();
        if (t < 1) st.anim = requestAnimationFrame(step); else st.anim = null;
      })(t0);
    };
    inst.fitBBox = function (bb, pad) {
      var x0 = mx(bb[0]), x1 = mx(bb[2]), y0 = my(bb[3]), y1 = my(bb[1]);
      var S = Math.min(st.W / Math.max(1e-6, x1 - x0), st.H / Math.max(1e-6, y1 - y0)) * (pad || 0.85);
      inst.flyTo(ilat((y0 + y1) / 2), ilon((x0 + x1) / 2), S);
    };
    inst.setPoint = function (lat, lon, center) {
      if (!isFinite(lat) || !isFinite(lon)) { st.point = null; st.selC = null; redraw(); return; }
      st.point = { lat: lat, lon: lon };
      st.selC = WM.countryAt(lat, lon);
      if (center) inst.flyTo(lat, lon, Math.max(st.S, 5200));
      redraw();
    };
    inst.setMarkers = function (m) { st.markers = m || []; redraw(); };
    inst.zoomBy = function (f, px, py) {
      if (px == null) { px = st.W / 2; py = st.H / 2; }
      var before = toNorm(px, py);
      st.S *= f; clampView();
      var after = toNorm(px, py);
      st.cx += before[0] - after[0]; st.cy += before[1] - after[1]; clampView(); redraw();
    };

    /* ---------- interacción ---------- */
    var ptrs = new Map(), drag = null, pinch = null;
    cv.addEventListener('pointerdown', function (e) {
      cv.focus({ preventScroll: true });
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (ptrs.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: st.cx, cy: st.cy, moved: false };
      else if (ptrs.size === 2) {
        var a = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), S: st.S, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 };
        if (drag) drag.moved = true;
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && ptrs.size === 2) {
        var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        var before = toNorm(pinch.mx, pinch.my); st.S = pinch.S * d / Math.max(10, pinch.d); clampView();
        var after = toNorm(pinch.mx, pinch.my); st.cx += before[0] - after[0]; st.cy += before[1] - after[1]; clampView(); redraw();
        return;
      }
      if (drag && ptrs.size === 1) {
        var dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; host.classList.add('dragging'); }
        if (drag.moved) { st.cx = drag.cx - dx / st.S; st.cy = drag.cy - dy / st.S; clampView(); redraw(); }
        return;
      }
      hoverAt(e.offsetX, e.offsetY);
    });
    function endPtr(e) {
      var was = drag;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        host.classList.remove('dragging');
        drag = null;
        if (was && !was.moved && e.type === 'pointerup') {
          var ll = pxToLL(e.offsetX, e.offsetY);
          pick(ll[0], ll[1]);
        }
      }
    }
    cv.addEventListener('pointerup', endPtr);
    cv.addEventListener('pointercancel', endPtr);
    cv.addEventListener('pointerleave', function () { st.hoverC = null; host.querySelector('.wm-ll').textContent = st.point ? 'Punto: ' + WM.fmtLat(st.point.lat) + ', ' + WM.fmtLon(st.point.lon) : 'Mueva el cursor sobre el mapa'; host.querySelector('.wm-cn').textContent = st.selC ? st.selC.name : ''; redraw(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = Math.exp(-U.clamp(e.deltaY, -300, 300) * (e.deltaMode === 1 ? 0.05 : 0.0022));
      inst.zoomBy(f, e.offsetX, e.offsetY);
    }, { passive: false });
    cv.addEventListener('dblclick', function (e) { e.preventDefault(); inst.zoomBy(2.2, e.offsetX, e.offsetY); });
    cv.addEventListener('keydown', function (e) {
      var k = e.key, step = 80 / st.S, used = true;
      if (k === 'ArrowLeft') st.cx -= step; else if (k === 'ArrowRight') st.cx += step; else if (k === 'ArrowUp') st.cy -= step; else if (k === 'ArrowDown') st.cy += step;
      else if (k === '+' || k === '=') inst.zoomBy(1.6); else if (k === '-' || k === '_') inst.zoomBy(1 / 1.6);
      else if (k === 'Enter' || k === ' ') { var ll = pxToLL(st.W / 2, st.H / 2); pick(ll[0], ll[1]); }
      else used = false;
      if (used) { e.preventDefault(); clampView(); redraw(); }
    });
    var hovRaf = 0;
    function hoverAt(px, py) {
      if (hovRaf) cancelAnimationFrame(hovRaf);
      hovRaf = requestAnimationFrame(function () {
        var ll = pxToLL(px, py), c = WM.countryAt(ll[0], ll[1]);
        host.querySelector('.wm-ll').textContent = WM.fmtLat(ll[0]) + ', ' + WM.fmtLon(ll[1]);
        host.querySelector('.wm-cn').textContent = c ? c.name : 'Océano / sin país';
        if (c !== st.hoverC) { st.hoverC = c; redraw(); }
      });
    }
    function pick(lat, lon) {
      lat = Math.round(lat * 10000) / 10000; lon = Math.round(lon * 10000) / 10000;
      inst.setPoint(lat, lon);
      if (opts.onPick) opts.onPick(lat, lon, st.selC);
    }
    inst.pick = pick;
    host.querySelector('.wm-zoom').addEventListener('click', function (e) {
      var b = e.target.closest('[data-wz]'); if (!b) return;
      var a = b.getAttribute('data-wz');
      if (a === 'in') inst.zoomBy(1.8); else if (a === 'out') inst.zoomBy(1 / 1.8);
      else if (a === 'world') inst.flyTo(15, -20, minS());
      else if (a === 'co') { var co = WM.findCountry('CO'); if (co) inst.fitBBox([-79.5, -4.3, -66.8, 13.5], 0.95); }
      else if (a === 'pt') { if (st.point) inst.flyTo(st.point.lat, st.point.lon, Math.max(st.S, 12000)); }
      else if (a === 'night') { st.night = !st.night; b.classList.toggle('on', st.night); redraw(); }
    });
    host.querySelector('[data-wz="night"]').classList.toggle('on', st.night);

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { resize(); }) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);
    inst.destroy = function () { if (ro) ro.disconnect(); if (st.anim) cancelAnimationFrame(st.anim); };
    /* reloj del terminador: se actualiza cada minuto mientras el mapa exista */
    var tick = setInterval(function () { if (!host.isConnected) { clearInterval(tick); if (ro) ro.disconnect(); return; } if (st.night) redraw(); }, 60000);
    resize();
    if (opts.lat != null && opts.lon != null) { st.point = { lat: opts.lat, lon: opts.lon }; st.selC = WM.countryAt(opts.lat, opts.lon); inst.setView(opts.lat, opts.lon, opts.S || 5200); }
    else inst.setView(4.5, -74, opts.S || 3000);
    return inst;
  };
})();
