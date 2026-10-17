/* ==========================================================================
   views-project.js — PROYECTO FV: Sitio y NASA POWER (mapa mundial),
   Diseño del sistema (atajos, catálogo, optimizador, verificación,
   unifilar, ficha técnica), Costos editables y Manual de instalación.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, N = SEDA.Nasa, Sol = SEDA.Solar, WM = SEDA.WorldMap, Dz = SEDA.Design, Co = SEDA.Costs;
  var V = SEDA.Views = SEDA.Views || {};
  var App = function () { return SEDA.App; };
  function f(v, d) { return U.fmt(v, d == null ? 1 : d); }
  function money(v) { return Co.money(v); }
  function opt(v, label, sel) { return '<option value="' + U.esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + U.esc(label) + '</option>'; }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  /* =======================================================================
     SITIO Y NASA POWER
     ======================================================================= */
  var map = null;
  function placeFor(lat, lon, country) {
    var nc = WM.nearestCity(lat, lon, 45);
    if (nc) return (nc.km < 3 ? '' : 'Cerca de ') + nc.city.name + (nc.city.region && nc.city.region !== nc.city.name ? ', ' + nc.city.region : '');
    return country ? 'Punto en ' + country.name : 'Punto en el océano';
  }
  function setSite(lat, lon, country, source) {
    var p = Dz.project();
    var off = country && country.a2 === 'CO' ? -5 : Math.round(lon / 15);
    p.site = { lat: lat, lon: lon, place: placeFor(lat, lon, country), country: country ? country.name : 'Océano', a2: country ? country.a2 : '', elev: NaN, utcOffset: off, source: source || 'mapa' };
    Dz.invalidate(); Dz.saveNow();
  }
  V.sitio = {
    render: async function (el) {
      var p = Dz.project();
      await Dz.ready();
      var q = p.nasa.query, site = p.site;
      var h = V.head('Sitio y recurso solar — NASA POWER', 'Elija cualquier punto del planeta en el mapa (offline), configure la consulta como en el <b>Data Access Viewer</b> de NASA POWER (comunidad, resolución temporal, periodo y parámetros) y obtenga el recurso solar del sitio para simular, diseñar el sistema y alimentar el Machine Learning.',
        '<button class="btn" data-go="diseno">🧩 Diseñar el sistema →</button>');
      h += '<div class="site-grid">' +
        '<div class="card map-card"><div class="map-tools"><input type="text" id="site-search" list="site-cities" placeholder="🔎 Buscar ciudad o escribir «lat, lon» (p. ej. 11.54, -72.91)" autocomplete="off">' +
        '<datalist id="site-cities">' + WM.CITIES.map(function (c) { return '<option value="' + U.esc(c.name + ' — ' + c.region) + '">'; }).join('') + '</datalist>' +
        '<button class="btn btn-sm" id="site-go">Ir</button><button class="btn btn-sm" id="site-geo" title="Usar la ubicación de este dispositivo">📍 Mi ubicación</button></div>' +
        '<div id="wmap" class="wmap-box"></div></div>' +
        '<div class="site-side">' +
        '<div class="card"><div class="card-head"><h3>📍 Punto de análisis</h3></div>' +
        '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
        '<label class="f">Latitud (°)<input type="number" id="site-lat" step="0.0001" min="-90" max="90" value="' + site.lat + '"></label>' +
        '<label class="f">Longitud (°)<input type="number" id="site-lon" step="0.0001" min="-180" max="180" value="' + site.lon + '"></label>' +
        '<label class="f" style="grid-column:1/-1">Nombre del sitio<input type="text" id="site-place" value="' + U.esc(site.place || '') + '"></label>' +
        '<label class="f">Huso horario (UTC ±h)<input type="number" id="site-off" step="1" min="-12" max="14" value="' + site.utcOffset + '"><span class="hint">Colombia: UTC−5</span></label>' +
        '<label class="f">País<input type="text" id="site-country" value="' + U.esc(site.country || '') + '" disabled></label></div>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn btn-sm btn-primary" id="site-apply">Aplicar coordenadas</button><button class="btn btn-sm" id="site-sys" title="Copia coordenadas y nombre a la configuración del sistema">Usar en el sistema</button></div>' +
        '<div id="site-info" class="site-info"></div></div>' +
        '<div class="card"><div class="card-head"><h3>🗂 Consultas guardadas</h3><span class="card-sub">en este navegador</span></div><div id="site-saved" class="saved-list"><span class="muted small">Cargando…</span></div></div>' +
        '</div></div>';
      /* ---- Consulta estilo DAV ---- */
      h += '<div class="card nasa-card"><div class="card-head"><h3>🛰 NASA POWER · Acceso a datos</h3><span class="chip">API pública · power.larc.nasa.gov</span><div class="ch-actions"><span class="small muted">Solo se envían coordenadas, fechas y nombres de parámetros.</span></div></div>' +
        '<div class="dav" id="dav"></div></div>';
      h += '<div id="site-res"></div>';
      el.innerHTML = h;
      map = WM.create(U.$('#wmap', el), {
        lat: site.lat, lon: site.lon, S: 5200,
        onPick: function (lat, lon, c) { setSite(lat, lon, c, 'mapa'); syncSide(); renderDav(); renderResults(); U.toast('Punto seleccionado: <b>' + WM.fmtLat(lat) + ', ' + WM.fmtLon(lon) + '</b>' + (c ? ' · ' + U.esc(c.name) : ''), 'info', 2500); }
      });
      bindSide(el);
      syncSide();
      renderDav();
      renderSaved();
      renderResults();
    }
  };
  function syncSide() {
    var p = Dz.project(), s = p.site;
    U.$('#site-lat').value = s.lat; U.$('#site-lon').value = s.lon; U.$('#site-place').value = s.place || ''; U.$('#site-off').value = s.utcOffset; U.$('#site-country').value = s.country || '';
    var doy = U.doyOf(U.nowLocalNaive()), st = Sol.sunTimes(s.lat, s.lon, s.utcOffset, doy);
    var hm = function (x) { if (!isFinite(x)) return '—'; x = ((x % 24) + 24) % 24; return U.p2(Math.floor(x)) + ':' + U.p2(Math.round((x % 1) * 60) % 60); };
    var nc = WM.nearestCity(s.lat, s.lon, 400), ds = Dz.dataset(), near = ds && Math.abs(ds.lat - s.lat) < 0.3 && Math.abs(ds.lon - s.lon) < 0.3;
    U.$('#site-info').innerHTML = '<div class="kv"><span>Coordenadas</span><b>' + WM.fmtLat(s.lat) + ' · ' + WM.fmtLon(s.lon) + '</b></div>' +
      '<div class="kv"><span>Hoy: salida / puesta del sol</span><b>' + hm(st.rise) + ' / ' + hm(st.set) + ' (' + f(st.dayLen, 1) + ' h)</b></div>' +
      '<div class="kv"><span>Elevación del terreno (NASA)</span><b>' + (near && isFinite(ds.elev) ? f(ds.elev, 0) + ' m' : isFinite(s.elev) ? f(s.elev, 0) + ' m' : 'tras consultar') + '</b></div>' +
      (nc ? '<div class="kv"><span>Ciudad de referencia</span><b>' + U.esc(nc.city.name) + ' · ' + f(nc.km, 0) + ' km</b></div>' : '') +
      '<div class="kv"><span>Inclinación óptima (aprox.)</span><b>' + (near ? f(N.summary(ds).opt ? N.summary(ds).opt.tilt : NaN, 0) + '° hacia el ' + (s.lat >= 0 ? 'sur' : 'norte') : '≈ ' + f(Math.abs(s.lat) * 0.87 + 3, 0) + '° hacia el ' + (s.lat >= 0 ? 'sur' : 'norte')) + '</b></div>';
    if (map) map.setPoint(s.lat, s.lon);
  }
  function bindSide(el) {
    var p = Dz.project();
    U.$('#site-apply', el).onclick = function () {
      var lat = +U.$('#site-lat').value, lon = +U.$('#site-lon').value;
      if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) { U.toast('Coordenadas no válidas.', 'warn'); return; }
      setSite(lat, lon, WM.countryAt(lat, lon), 'manual');
      map.flyTo(lat, lon, Math.max(map.st.S, 9000));
      syncSide(); renderDav(); renderResults();
    };
    U.$('#site-place', el).onchange = function () { p.site.place = this.value.trim(); Dz.saveNow(); };
    U.$('#site-off', el).onchange = function () { p.site.utcOffset = U.clamp(Math.round(+this.value || 0), -12, 14); Dz.invalidate(); Dz.saveNow(); syncSide(); };
    U.$('#site-sys', el).onclick = function () {
      var sys = App().system();
      App().saveSystem(Object.assign(sys, { lat: p.site.lat, lon: p.site.lon, utcOffset: p.site.utcOffset, place: p.site.place + (p.site.country && p.site.place.indexOf(p.site.country) < 0 ? ', ' + p.site.country : '') }));
      U.toast('Coordenadas copiadas a la configuración del sistema (usadas por el modelo físico y la simulación).', 'good');
    };
    var lastGo = null;
    function go() {
      var v = U.$('#site-search').value.trim();
      if (!v) return;
      lastGo = v;
      var m = /^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/.exec(v);
      if (m) { var la = +m[1].replace(',', '.'), lo = +m[2].replace(',', '.'); if (la >= -90 && la <= 90 && lo >= -180 && lo <= 180) { map.pick(la, lo); map.flyTo(la, lo, 12000); return; } }
      var name = v.split(' — ')[0].toLowerCase();
      var c = WM.CITIES.find(function (x) { return x.name.toLowerCase() === name; }) || WM.CITIES.find(function (x) { return U.slug(x.name).indexOf(U.slug(name)) >= 0; });
      if (c) { map.pick(c.lat, c.lon); map.flyTo(c.lat, c.lon, 14000); return; }
      var ct = WM.findCountry(v) || countryByPrefix(v);
      if (ct) { map.fitBBox(ct.bb); return; }
      U.toast('No se encontró «' + U.esc(v) + '». Escriba una ciudad de la lista, un país o coordenadas «lat, lon».', 'warn');
    }
    function countryByPrefix(v) {
      var s = U.slug(v), all = window.SEDA_WORLD ? window.SEDA_WORLD.c : [];
      if (!s) return null;
      for (var i = 0; i < all.length; i++) if (U.slug(all[i][0]).indexOf(s) === 0) return WM.findCountry(all[i][0]);
      return null;
    }
    U.$('#site-go', el).onclick = go;
    U.$('#site-search', el).onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    /* selección desde la lista desplegable (sin repetir la búsqueda ya hecha con Enter) */
    U.$('#site-search', el).onchange = function () { if (/ — /.test(this.value) && this.value.trim() !== lastGo) go(); };
    U.$('#site-geo', el).onclick = function () {
      if (!navigator.geolocation) { U.toast('La geolocalización no está disponible en este navegador.', 'warn'); return; }
      navigator.geolocation.getCurrentPosition(function (pos) { var la = pos.coords.latitude, lo = pos.coords.longitude; map.pick(la, lo); map.flyTo(la, lo, 14000); },
        function () { U.toast('No se pudo obtener la ubicación (permiso denegado o sin señal). Elija el punto en el mapa.', 'warn'); }, { timeout: 8000 });
    };
  }
  async function renderSaved() {
    var box = U.$('#site-saved'); if (!box) return;
    var idx = await N.index(), p = Dz.project();
    if (map) map.setMarkers(idx.map(function (e) { return { lat: e.lat, lon: e.lon, color: e.key === p.nasa.key ? '#f29d0b' : '#2a78d6' }; }));
    if (!idx.length) { box.innerHTML = '<p class="muted small" style="margin:0">Aún no hay consultas. Los datos descargados se guardan aquí para usarlos sin conexión.</p>'; return; }
    box.innerHTML = idx.map(function (e) {
      return '<div class="saved' + (e.key === p.nasa.key ? ' on' : '') + '"><div><b>' + U.esc(e.place || (WM.fmtLat(e.lat) + ', ' + WM.fmtLon(e.lon))) + '</b><span>' + N.LEVELS[e.level].label + ' · ' + (e.level === 'climatology' ? 'largo plazo' : U.esc(e.start) + ' → ' + U.esc(e.end)) + ' · ' + e.params.length + ' parám.' + (isFinite(e.ghiYear) ? ' · GHI ' + f(e.ghiYear, 0) + ' kWh/m²·a' : '') + '</span></div>' +
        '<div class="saved-act"><button class="btn btn-sm" data-load="' + e.key + '">Usar</button><button class="btn btn-sm btn-ghost" data-del="' + e.key + '" title="Eliminar de la caché">✕</button></div></div>';
    }).join('');
    U.$$('[data-load]', box).forEach(function (b) {
      b.onclick = async function () {
        var key = b.getAttribute('data-load'), raw = await N.getCached(key), e = idx.find(function (x) { return x.key === key; });
        if (!raw) { U.toast('La consulta ya no está en la caché.', 'warn'); return; }
        var ds = N.unpack(raw);
        Dz.setDataset(ds, key);
        p.site = Object.assign({}, p.site, { lat: ds.lat, lon: ds.lon, place: e.place || p.site.place, country: e.country || p.site.country, elev: ds.elev, utcOffset: isFinite(ds.utcOffset) ? ds.utcOffset : p.site.utcOffset });
        p.nasa.query = { community: e.community, level: e.level, start: e.start, end: e.end, params: e.params.slice() };
        Dz.invalidate(); Dz.saveNow();
        map.flyTo(ds.lat, ds.lon, Math.max(map.st.S, 9000));
        syncSide(); renderDav(); renderSaved(); renderResults();
      };
    });
    U.$$('[data-del]', box).forEach(function (b) {
      b.onclick = async function () {
        var key = b.getAttribute('data-del');
        await N.deleteCached(key);
        if (p.nasa.key === key) { p.nasa.key = null; Dz._ds = null; Dz._dsKey = null; Dz.invalidate(); Dz.saveNow(); renderResults(); }
        renderSaved();
      };
    });
  }
  /* ---- formulario DAV ---- */
  function renderDav() {
    var box = U.$('#dav'); if (!box) return;
    var p = Dz.project(), q = p.nasa.query, lv = q.level, L = N.LEVELS[lv], s = p.site;
    q.params = q.params.filter(function (id) { return N.byId[id] && N.byId[id].lv.indexOf(N.LV[lv]) >= 0; });
    var yPrev = new Date().getFullYear() - 1;
    var h = '<div class="dav-step"><div class="dav-n">1</div><div class="dav-b"><h4>Comunidad de usuarios</h4><div class="seg">' +
      Object.keys(N.COMMUNITIES).map(function (k) { return '<button class="seg-b' + (q.community === k ? ' on' : '') + '" data-comm="' + k + '" title="' + U.esc(N.COMMUNITIES[k].desc) + '">' + k + '</button>'; }).join('') + '</div><p class="small muted">' + U.esc(N.COMMUNITIES[q.community].label) + ' — ' + U.esc(N.COMMUNITIES[q.community].desc) + '</p></div></div>';
    h += '<div class="dav-step"><div class="dav-n">2</div><div class="dav-b"><h4>Promedio temporal</h4><div class="lv-grid">' +
      Object.keys(N.LEVELS).map(function (k) { return '<button class="lv' + (lv === k ? ' on' : '') + '" data-lv="' + k + '"><b>' + N.LEVELS[k].label + '</b><span>' + (k === 'hourly' ? '≤ 15 parám. · desde 2001' : k === 'climatology' ? 'promedio de largo plazo' : '≤ 20 parám. · desde 1981') + '</span></button>'; }).join('') + '</div><p class="small muted">' + U.esc(L.desc) + '</p></div></div>';
    h += '<div class="dav-step"><div class="dav-n">3</div><div class="dav-b"><h4>Ubicación (punto único)</h4><div class="loc-pill">📍 ' + WM.fmtLat(s.lat) + ' · ' + WM.fmtLon(s.lon) + '</div><p class="small muted">' + U.esc(s.place || '') + '. Resolución de la fuente: ½° × ⅝° (MERRA-2) y 1° × 1° (CERES); los datos representan la celda que contiene el punto.</p></div></div>';
    h += '<div class="dav-step"><div class="dav-n">4</div><div class="dav-b"><h4>Periodo</h4>' + (lv === 'climatology' ? '<p class="small muted">La climatología no requiere fechas: NASA POWER entrega el promedio mensual de largo plazo.</p>' :
      '<div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="f">Inicio<input type="date" id="dav-start" value="' + U.esc(q.start) + '" min="' + L.minDate + '"></label><label class="f">Fin<input type="date" id="dav-end" value="' + U.esc(q.end) + '"></label></div>' +
      '<div class="chips-row"><button class="chip-b" data-rng="1">Año ' + yPrev + '</button>' + (lv !== 'hourly' ? '<button class="chip-b" data-rng="5">Últimos 5 años</button><button class="chip-b" data-rng="10">Últimos 10 años</button>' : '<button class="chip-b" data-rng="2">' + (yPrev - 1) + '–' + yPrev + '</button><button class="chip-b" data-rng="90">Últimos 90 días</button>') + '</div>') + '</div></div>';
    var avail = N.available(lv), max = L.max;
    h += '<div class="dav-step wide"><div class="dav-n">5</div><div class="dav-b"><h4>Parámetros <span class="pcount' + (q.params.length > max ? ' over' : '') + '" id="pcount">' + q.params.length + ' / ' + max + '</span></h4>' +
      '<div class="chips-row"><input type="text" id="dav-filter" placeholder="Filtrar parámetros…" style="max-width:220px">' + Object.keys(N.PRESETS).map(function (k) { return '<button class="chip-b" data-preset="' + k + '">' + N.PRESETS[k].label + '</button>'; }).join('') + '<button class="chip-b" data-preset="none">Limpiar</button></div>' +
      '<div class="pcats">' + Object.keys(N.CATS).map(function (cat) {
        var items = N.PARAMS.filter(function (x) { return x.cat === cat; });
        return '<div class="pcat"><h5>' + N.CATS[cat] + '</h5>' + items.map(function (x) {
          var ok = avail.indexOf(x) >= 0, on = q.params.indexOf(x.id) >= 0;
          return '<label class="pchk' + (ok ? '' : ' na') + '" data-name="' + U.esc((x.id + ' ' + x.name).toLowerCase()) + '" title="' + (ok ? U.esc(x.id) : 'No disponible en el nivel ' + L.label) + '"><input type="checkbox" data-param="' + x.id + '"' + (on ? ' checked' : '') + (ok ? '' : ' disabled') + '><span><b>' + U.esc(x.name) + '</b><code>' + x.id + '</code>' + (x.key ? '<i class="tag">ML</i>' : '') + '</span></label>';
        }).join('') + '</div>';
      }).join('') + '</div><p class="small muted" style="margin:6px 0 0"><i class="tag">ML</i> = variable reconocida por el mapeo automático y utilizable por el Random Forest.</p></div></div>';
    var url = N.url(q, s.lat, s.lon, 'JSON'), errs = N.validate(q, s.lat, s.lon);
    h += '<div class="dav-step wide"><div class="dav-n">6</div><div class="dav-b"><h4>Enviar solicitud</h4>' +
      '<div class="eq url-box" id="dav-url">' + U.esc(url) + '</div>' +
      (errs.length ? '<div class="alert warn" style="margin-top:8px"><span class="ai">⚠</span><div>' + errs.map(U.esc).join('<br>') + '</div></div>' : '') +
      '<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary btn-lg" id="dav-fetch"' + (errs.length ? ' disabled' : '') + '>🛰 Consultar NASA POWER</button>' +
      '<button class="btn" id="dav-copy">📋 Copiar URL</button><a class="btn" id="dav-csv" href="' + U.esc(N.url(q, s.lat, s.lon, 'CSV')) + '" target="_blank" rel="noopener noreferrer">⬇ CSV oficial (abre NASA)</a>' +
      '<button class="btn" id="dav-import">📂 Importar CSV de NASA</button><input type="file" id="dav-file" accept=".csv,.txt" hidden></div>' +
      '<p class="small muted" style="margin:8px 0 0">Sin Internet: abra el enlace CSV en otro equipo o navegador, guarde el archivo e impórtelo aquí. Las respuestas se guardan en la caché local (IndexedDB) y quedan disponibles sin conexión.</p></div></div>';
    box.innerHTML = h;
    /* eventos */
    U.$$('[data-comm]', box).forEach(function (b) { b.onclick = function () { q.community = b.getAttribute('data-comm'); Dz.saveNow(); renderDav(); }; });
    U.$$('[data-lv]', box).forEach(function (b) {
      b.onclick = function () {
        var nl = b.getAttribute('data-lv'); if (nl === q.level) return;
        q.level = nl;
        var keep = q.params.filter(function (id) { return N.byId[id].lv.indexOf(N.LV[nl]) >= 0; });
        q.params = keep.length ? keep.slice(0, N.LEVELS[nl].max) : N.presetFor('fv', nl);
        if (nl === 'hourly') { var s0 = U.parseDateInput(q.start), e0 = U.parseDateInput(q.end); if (!(e0 - s0 <= 3 * 366 * U.DAY)) { q.start = yPrev + '-01-01'; q.end = yPrev + '-12-31'; } }
        Dz.saveNow(); renderDav();
      };
    });
    U.$$('[data-rng]', box).forEach(function (b) {
      b.onclick = function () {
        var k = +b.getAttribute('data-rng');
        if (k === 90) { var e = U.dayStart(Date.now()) - 7 * U.DAY; q.end = U.fmtDate(e); q.start = U.fmtDate(e - 90 * U.DAY); }
        else { q.start = (yPrev - k + 1) + '-01-01'; q.end = yPrev + '-12-31'; }
        Dz.saveNow(); renderDav();
      };
    });
    var ds_ = U.$('#dav-start', box), de_ = U.$('#dav-end', box);
    if (ds_) ds_.onchange = function () { q.start = this.value; Dz.saveNow(); renderDav(); };
    if (de_) de_.onchange = function () { q.end = this.value; Dz.saveNow(); renderDav(); };
    U.$$('[data-param]', box).forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.getAttribute('data-param');
        if (cb.checked) { if (q.params.length >= max) { cb.checked = false; U.toast('Máximo ' + max + ' parámetros para el nivel «' + L.label + '».', 'warn'); return; } q.params.push(id); }
        else q.params = q.params.filter(function (x) { return x !== id; });
        Dz.saveNow(); renderDav();
      };
    });
    U.$$('[data-preset]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-preset'); q.params = k === 'none' ? [] : N.presetFor(k, lv); Dz.saveNow(); renderDav(); }; });
    U.$('#dav-filter', box).oninput = function () { var t = this.value.toLowerCase().trim(); U.$$('.pchk', box).forEach(function (l) { l.style.display = !t || l.getAttribute('data-name').indexOf(t) >= 0 ? '' : 'none'; }); };
    U.$('#dav-copy', box).onclick = function () {
      var t = url;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { U.toast('URL copiada.', 'good'); }, function () { prompt('Copie la URL:', t); });
      else prompt('Copie la URL:', t);
    };
    U.$('#dav-import', box).onclick = function () { U.$('#dav-file').click(); };
    U.$('#dav-file', box).onchange = async function (e) {
      var file = e.target.files[0]; e.target.value = ''; if (!file) return;
      var txt = await file.text(), ds = N.fromImportedCSV(txt, { community: q.community });
      if (!ds || !ds.t.length) { U.modal({ title: 'Archivo no reconocido', icon: '⛔', html: '<p>El archivo no tiene el formato CSV oficial de NASA POWER (encabezado <code>-BEGIN HEADER-</code> … <code>-END HEADER-</code> con columnas YEAR, MO, DY [, HR]).</p><p class="muted">Para otros formatos use «Importar datos» del flujo principal.</p>' }); return; }
      var c = isFinite(ds.lat) ? WM.countryAt(ds.lat, ds.lon) : null;
      if (isFinite(ds.lat)) setSite(ds.lat, ds.lon, c, 'csv-nasa');
      var key = await N.saveDataset(ds, Dz.project().site);
      Dz.setDataset(ds, key);
      p.site.elev = ds.elev; Dz.saveNow();
      if (isFinite(ds.lat)) map.flyTo(ds.lat, ds.lon, Math.max(map.st.S, 9000));
      syncSide(); renderDav(); renderSaved(); renderResults();
      U.toast('CSV de NASA POWER importado: ' + U.fmtInt(ds.t.length) + ' registros (' + N.LEVELS[ds.level].label.toLowerCase() + ').', 'good');
    };
    U.$('#dav-fetch', box).onclick = async function () {
      var btn = this; btn.disabled = true;
      try {
        U.busy('Consultando NASA POWER…');
        var r = await N.fetch(q, s.lat, s.lon, { utcOffset: s.utcOffset, site: s, onProgress: function (i, n) { U.busy('Consultando NASA POWER' + (n > 1 ? ' (parte ' + (i + 1) + ' de ' + n + ')' : '') + '…'); } });
        Dz.setDataset(r.ds, r.key);
        p.site.elev = r.ds.elev; Dz.saveNow();
        U.idle();
        U.toast(r.cached ? 'Datos tomados de la caché local (misma consulta).' : 'Datos NASA POWER recibidos: ' + U.fmtInt(r.ds.t.length) + ' registros · ' + r.ds.params.length + ' parámetros.', 'good');
        syncSide(); renderSaved(); renderResults();
        var res = U.$('#site-res'); if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        U.idle(); console.warn(err);
        U.modal({ title: 'No se pudo obtener la información', icon: '🛰', html: '<p>' + U.esc(err.message || String(err)) + '</p><p class="muted small">Alternativa sin conexión directa: 1) abra el enlace «CSV oficial» (o la URL) en un navegador con Internet; 2) guarde el archivo; 3) use «📂 Importar CSV de NASA». La aplicación sigue funcionando offline con la estimación de cielo claro.</p><div class="eq" style="font-size:.75rem;word-break:break-all">' + U.esc(N.url(q, s.lat, s.lon, 'CSV')) + '</div>' });
      } finally { btn.disabled = false; }
    };
  }
  /* ---- resultados del recurso ---- */
  function renderResults() {
    var box = U.$('#site-res'); if (!box) return;
    var p = Dz.project(), ds = Dz.dataset(), s = p.site;
    if (!ds) {
      box.innerHTML = '<div class="card empty"><span class="e-ico">🛰</span><h3>Aún no hay datos del sitio</h3><p>Configure la consulta y pulse <b>Consultar NASA POWER</b>, o importe el CSV oficial. Mientras tanto, el diseñador usa una estimación de cielo claro (menos precisa).</p></div>';
      return;
    }
    var sm = N.summary(ds), near = Math.abs(ds.lat - s.lat) < 0.3 && Math.abs(ds.lon - s.lon) < 0.3;
    var h = '<div class="card"><div class="card-head"><h3>☀ Recurso solar del sitio — NASA POWER</h3><span class="chip">' + N.LEVELS[ds.level].label + (ds.level !== 'climatology' ? ' · ' + U.esc(ds.start) + ' → ' + U.esc(ds.end) : '') + '</span><span class="chip">' + WM.fmtLat(ds.lat) + ', ' + WM.fmtLon(ds.lon) + (isFinite(ds.elev) ? ' · ' + f(ds.elev, 0) + ' m' : '') + '</span>' +
      '<div class="ch-actions"><button class="btn btn-sm" id="res-csv">⬇ CSV normalizado</button>' + (ds.level === 'hourly' || ds.level === 'daily' ? '<button class="btn btn-sm btn-accent" id="res-ml">🤖 Usar en el análisis (ML)</button>' : '') + '<button class="btn btn-sm btn-primary" data-go="diseno">🧩 Diseñar →</button></div></div>';
    if (!near) h += '<div class="alert warn"><span class="ai">⚠</span><div>Los datos cargados corresponden a otro punto (' + WM.fmtLat(ds.lat) + ', ' + WM.fmtLon(ds.lon) + '). Consulte NASA POWER para el punto seleccionado o use la consulta guardada.</div></div>';
    if (ds.timeNote === 'LST') h += '<div class="alert info"><span class="ai">ℹ</span><div>CSV importado: las horas se interpretan en hora solar local (LST), tal como las entrega NASA por defecto.</div></div>';
    var mCrit = isFinite(sm.worstMonth) ? U.MESES_L[sm.worstMonth] : '—';
    h += '<div class="grid g6 proj-kpis" style="margin-top:10px">' +
      V.kpi('GHI anual', sm.ghiYear ? f(sm.ghiYear, 0) : '—', 'kWh/m²', 'Irradiación global horizontal por año', '', '☀') +
      V.kpi('Horas solares pico', sm.psh ? f(sm.psh, 2) : '—', 'h/día', 'Promedio anual (kWh/m²·día)', '', '⏱') +
      V.kpi('Mes crítico', sm.ghi ? f(sm.ghi[sm.worstMonth], 2) : '—', 'kWh/m²', mCrit + ' · por día · base para sistemas aislados', '', '📉') +
      V.kpi('Inclinación óptima', sm.opt ? f(sm.opt.tilt, 0) : '—', '°', sm.opt ? '+' + f(sm.opt.gain * 100, 1) + ' % vs. horizontal · hacia el ' + (ds.lat >= 0 ? 'sur' : 'norte') : '', '', '📐') +
      V.kpi('Temperatura', sm.tMean ? f(sm.tMean, 1) : '—', '°C', 'Mín. ' + f(sm.tMinAbs, 1) + ' · máx. ' + f(sm.tMaxAbs, 1) + ' °C', '', '🌡') +
      V.kpi('Viento medio', sm.wsMean ? f(sm.wsMean, 1) : '—', 'm/s', 'A 10 m · enfría los módulos', '', '🌬') + '</div></div>';
    h += '<div class="grid g2">' + C.card('site-month', 'Irradiación mensual', 'Promedio diario por mes: global (GHI), directa normal (DNI) y difusa (DHI)', 300) +
      C.card('site-tilt', 'Irradiación anual en el plano vs. inclinación', 'Superficie orientada hacia el ecuador · modelo Hay–Davies', 300, 'Mínimo práctico recomendado: 10° para autolimpieza con la lluvia.') + '</div>';
    if (ds.level === 'hourly') h += '<div class="grid g2">' + C.card('site-grid', 'Mapa de calor de irradiancia: mes × hora', 'GHI media [W/m²] en hora local (UTC' + (ds.utcOffset >= 0 ? '+' : '−') + Math.abs(ds.utcOffset) + ')', 320) + C.card('site-daily', 'Irradiación diaria del periodo', 'kWh/m²·día', 320) + '</div>';
    else if (ds.level === 'daily') h += C.card('site-daily', 'Irradiación diaria del periodo', 'kWh/m²·día', 300);
    if (sm.t2m) h += '<div class="grid g2">' + C.card('site-temp', 'Temperatura mensual', 'Media, máxima y mínima a 2 m [°C]', 280) + (sm.ws || sm.pr ? C.card('site-met', 'Viento y precipitación', 'Promedios mensuales', 280) : '<div></div>') + '</div>';
    var rows = [];
    for (var m = 0; m < 12; m++) rows.push([U.MESES_L[m], sm.ghi ? f(sm.ghi[m], 2) : '—', sm.dni ? f(sm.dni[m], 2) : '—', sm.dhi ? f(sm.dhi[m], 2) : '—', sm.kt ? f(sm.kt[m], 2) : '—', sm.t2m ? f(sm.t2m[m], 1) : '—', sm.tmax ? f(sm.tmax[m], 1) : '—', sm.tmin ? f(sm.tmin[m], 1) : '—', sm.ws ? f(sm.ws[m], 1) : '—', sm.rh ? f(sm.rh[m], 0) : '—']);
    h += '<div class="card"><div class="card-head"><h3>Tabla mensual del recurso</h3><span class="card-sub">Fuente: ' + U.esc(ds.header.title || 'NASA/POWER') + (ds.header.api ? ' · ' + U.esc(ds.header.api) : '') + '</span></div>' +
      U.table(['Mes', 'GHI [kWh/m²·d]', 'DNI [kWh/m²·d]', 'DHI [kWh/m²·d]', 'Kt', 'T media [°C]', 'T máx [°C]', 'T mín [°C]', 'Viento [m/s]', 'HR [%]'], rows, { numCols: [1, 2, 3, 4, 5, 6, 7, 8, 9], compact: true }) +
      '<p class="small muted" style="margin:8px 0 0">Datos: NASA Langley Research Center (LaRC) POWER Project, financiado por el programa NASA Earth Science/Applied Science. Valores derivados de satélite y reanálisis (no son mediciones en sitio).</p></div>';
    box.innerHTML = h;
    /* gráficos */
    if (sm.ghi) C.mount(U.$('#site-month'), { type: 'bar', categories: U.MESES, catLabel: 'Mes', yLabel: 'kWh/m²·día', unit: 'kWh/m²·día', series: [{ name: 'GHI', values: sm.ghi, color: 3 }].concat(sm.dni ? [{ name: 'DNI', values: sm.dni, color: 0 }] : []).concat(sm.dhi ? [{ name: 'DHI', values: sm.dhi, color: 2 }] : []) });
    if (sm.opt) C.mount(U.$('#site-tilt'), { type: 'line', xLabel: 'Inclinación [°]', yLabel: 'kWh/m²·año', unit: 'kWh/m²·año', zero: false, series: [{ name: 'Irradiación en el plano', x: sm.opt.curve.map(function (c) { return c[0]; }), y: sm.opt.curve.map(function (c) { return c[1]; }), color: 1 }], refLines: [{ axis: 'x', value: sm.opt.tilt, label: 'Óptima ' + sm.opt.tilt + '°', color: 'muted' }, { axis: 'y', value: sm.opt.horizontal, label: 'Horizontal', color: 'muted' }] });
    if (ds.level === 'hourly') {
      var mh = N.monthHour(ds, 'ALLSKY_SFC_SW_DWN');
      if (mh) C.mount(U.$('#site-grid'), { type: 'grid', rows: U.MESES, cols: Array.from({ length: 24 }, function (_, i) { return U.p2(i); }), matrix: mh, unit: 'W/m²', valueLabel: 'GHI media', xLabel: 'Hora local', rowLabel: 'Mes', min: 0 });
    }
    if (ds.level === 'hourly' || ds.level === 'daily') {
      var G = ds.vals.ALLSKY_SFC_SW_DWN, dx = [], dy = [];
      if (G) {
        if (ds.level === 'daily') { for (var i = 0; i < ds.t.length; i++) if (isFinite(G[i])) { dx.push(ds.t[i]); dy.push(G[i]); } }
        else { var acc = {}; for (var j = 0; j < ds.t.length; j++) { if (!isFinite(G[j])) continue; var d = U.dayStart(ds.t[j]); acc[d] = (acc[d] || 0) + G[j] / 1000; } Object.keys(acc).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) { dx.push(d); dy.push(acc[d]); }); }
        C.mount(U.$('#site-daily'), { type: 'line', xType: 'time', xFmt: U.fmtDate, yLabel: 'kWh/m²·día', unit: 'kWh/m²·día', series: [{ name: 'GHI diaria', x: dx, y: dy, color: 3, fill: true }] });
      }
    }
    if (sm.t2m) C.mount(U.$('#site-temp'), { type: 'line', categories: U.MESES, yLabel: '°C', unit: '°C', zero: false, series: [{ name: 'Media', y: sm.t2m, color: 1, markers: true }].concat(sm.tmax ? [{ name: 'Máxima', y: sm.tmax, color: 7, dash: [5, 4] }] : []).concat(sm.tmin ? [{ name: 'Mínima', y: sm.tmin, color: 0, dash: [5, 4] }] : []) });
    if (U.$('#site-met')) C.mount(U.$('#site-met'), { type: 'bar', categories: U.MESES, catLabel: 'Mes', yLabel: sm.pr && ds.level !== 'hourly' ? 'mm/día · m/s' : 'm/s', series: [].concat(sm.ws ? [{ name: 'Viento a 10 m [m/s]', values: sm.ws, color: 2 }] : []).concat(sm.pr && ds.level !== 'hourly' ? [{ name: 'Precipitación [mm/día]', values: sm.pr, color: 0 }] : []) });
    U.$('#res-csv').onclick = function () { U.download('NASA_POWER_' + ds.level + '_' + ds.lat.toFixed(3) + '_' + ds.lon.toFixed(3) + '.csv', N.toCSV(ds), 'text/csv;charset=utf-8'); };
    var ml = U.$('#res-ml'); if (ml) ml.onclick = function () { V.useNasaInAnalysis(); };
  }

  /* Convierte el conjunto NASA en datos de análisis con generación FV estimada por el modelo físico del arreglo */
  V.useNasaInAnalysis = async function (silent) {
    await Dz.ready();
    var ds = Dz.dataset(), p = Dz.project();
    if (!ds) { U.toast('Primero consulte NASA POWER.', 'warn'); App().go('sitio'); return false; }
    if (ds.level !== 'hourly' && ds.level !== 'daily') { U.toast('Para el ML se requieren datos horarios o diarios.', 'warn'); return false; }
    if (!ds.vals.ALLSKY_SFC_SW_DWN) { U.toast('La consulta debe incluir ALLSKY_SFC_SW_DWN (GHI).', 'warn'); return false; }
    var c = Dz.current();
    if (!c || !c.ok) { U.toast('Complete un diseño válido del sistema: la generación se estima con el arreglo diseñado.', 'warn'); App().go('diseno'); return false; }
    if (!silent) {
      var ok = await U.confirm('Usar datos NASA POWER en el análisis', '<p>Se cargarán <b>' + U.fmtInt(ds.t.length) + '</b> registros ' + N.LEVELS[ds.level].label.toLowerCase() + 's de NASA POWER como datos del análisis.</p><p>Como NASA no mide la producción de su planta, la columna objetivo <b>' + (ds.level === 'hourly' ? 'POTENCIA_FV_ESTIMADA (kW)' : 'ENERGIA_FV_ESTIMADA (kWh)') + '</b> se calcula con el <b>modelo físico del arreglo diseñado</b> (' + f(c.kwp, 2) + ' kWp, ' + f(c.tilt, 0) + '°, ' + U.esc(c.panel.name) + ', ' + c.nInv + ' × ' + U.esc(c.inv.name) + '). Es una <b>estimación</b>, no una medición: úsela para prefactibilidad y reemplácela por mediciones reales en operación.</p>', 'Cargar en el análisis');
      if (!ok) return false;
    }
    var pv = Dz.pvSeries(ds, c);
    var tb = N.toTable(ds, pv);
    await App().setRaw({ headers: tb.headers, rows: tb.rows }, {
      fileName: 'NASA_POWER_' + ds.level + '_' + ds.lat.toFixed(3) + '_' + ds.lon.toFixed(3) + '.csv (API)', fileType: 'nasa-api', sizeBytes: 0, sheetNames: ['NASA POWER'],
      sheetStats: [{ name: 'NASA POWER', rows: tb.rows.length, cols: tb.headers.length, looksData: true }], selectedSheets: ['NASA POWER'], mergeMode: 'única', mergeLog: [],
      nasa: true, pvEstimated: true, pvModel: f(c.kwp, 2) + ' kWp · ' + c.panel.name + ' · ' + f(c.tilt, 0) + '° · ' + c.nInv + ' × ' + c.inv.name, synthetic: false, loadedAt: Date.now()
    });
    var sys = App().system();
    App().saveSystem(Object.assign(sys, { lat: ds.lat, lon: ds.lon, utcOffset: p.site.utcOffset, place: p.site.place + (p.site.country && (p.site.place || '').indexOf(p.site.country) < 0 ? ', ' + p.site.country : ''), kwp: Math.round(c.kwp * 100) / 100, inverterKw: Math.round(c.pacTot * 10) / 10, batteryKwh: c.bank ? Math.round(c.bank.kwh * 10) / 10 : sys.batteryKwh }));
    if (c.bank) { var S = SEDA.state; S.decisionInputs = Object.assign({}, S.decisionInputs, { capKWh: Math.round(c.bank.kwh * 10) / 10, effBat: c.bat.eff, effInv: c.inv.effEuro }); }
    U.toast('Datos NASA POWER cargados en el análisis con generación FV estimada. Continúe con el mapeo o ejecute el flujo completo.', 'good', 6000);
    return true;
  };

  /* =======================================================================
     DISEÑO DEL SISTEMA
     ======================================================================= */
  var dzTab = 'panels';
  function rankKey() { var p = Dz.project(); return JSON.stringify(p.inputs) + JSON.stringify(p.catalog) + JSON.stringify(p.econ) + JSON.stringify(p.costs.params || {}) + (Dz._dsKey || '') + JSON.stringify(p.site); }
  Dz.ranking = function () {
    var k = rankKey();
    if (Dz._cache.rankKey === k && Dz._cache.rank) return Dz._cache.rank;
    var r = Dz.optimize(Dz.project().inputs);
    Dz._cache.rank = r; Dz._cache.rankKey = k;
    return r;
  };
  Dz.applyBest = function () {
    var r = Dz.ranking(), b = r.list[0], I = Dz.project().inputs;
    if (!b) return null;
    I.panel = b.panel.id; I.inverter = b.inv.id; I.battery = b.bat ? b.bat.id : I.battery;
    Dz.save();
    return b;
  };
  function tileCompat(kind, id, rank, I) {
    var sysBat = Dz.SYS[I.sysType].bat;
    var sel = { panel: kind === 'panels' ? id : I.panel, inv: kind === 'inverters' ? id : I.inverter, bat: sysBat ? (kind === 'batteries' ? id : I.battery) : null };
    var ok = rank.list.find(function (c) { return c.panel.id === sel.panel && c.inv.id === sel.inv && (!sysBat || (c.bat && c.bat.id === sel.bat)); });
    if (ok) return { ok: true, c: ok };
    var rj = rank.rejected.find(function (x) { return x.panel.id === sel.panel && x.inv.id === sel.inv && (!sysBat || (x.bat && x.bat.id === sel.bat)); });
    if (kind === 'inverters' && Dz.SYS[I.sysType].inv.indexOf(Dz.find('inverters', id).type) < 0) return { ok: false, reason: 'No aplica a un sistema ' + Dz.SYS[I.sysType].label.toLowerCase() };
    return { ok: false, reason: rj ? rj.reason : 'Sin combinación válida con la selección actual' };
  }
  function tileHTML(kind, it, rank, I) {
    var sel = (kind === 'panels' && I.panel === it.id) || (kind === 'inverters' && I.inverter === it.id) || (kind === 'batteries' && I.battery === it.id);
    var cp = tileCompat(kind, it.id, rank, I), spec;
    if (kind === 'panels') spec = it.pmax + ' W · η ' + f(it.eff, 1) + ' % · γ ' + it.gP + ' %/°C · Voc ' + it.voc + ' V · Isc ' + it.isc + ' A' + (it.bif ? ' · bifacial ' + Math.round(it.bif * 100) + ' %' : '');
    else if (kind === 'inverters') spec = Dz.TYPES[it.type] + ' · ' + f(it.pac / 1000, 1) + ' kW · ' + it.acLabel + ' · MPPT ' + it.mpptMin + '–' + it.mpptMax + ' V · ' + it.nMppt + '×' + it.imax + ' A · η ' + f(it.effEuro, 1) + ' %';
    else spec = it.chem + ' · ' + it.vNom + ' V · ' + it.ah + ' Ah · ' + f(it.kwh, 2) + ' kWh · DoD ' + it.dod + ' % · ' + U.fmtInt(it.cycles) + ' ciclos';
    var ico = kind === 'panels' ? '▦' : kind === 'inverters' ? '⚡' : '🔋';
    var per = kind === 'panels' ? money(it.price / it.pmax) + '/Wp' : kind === 'inverters' ? money(it.price / (it.pac / 1000)) + '/kW' : money(it.price / it.kwh) + '/kWh';
    return '<div class="ptile' + (sel ? ' sel' : '') + (cp.ok ? '' : ' na') + '" data-pick="' + kind + ':' + U.esc(it.id) + '" tabindex="0" title="' + U.esc(cp.ok ? 'Compatible con la selección' : cp.reason) + '">' +
      '<div class="pt-top"><span class="pt-ico">' + ico + '</span><b>' + U.esc(it.name) + '</b><button class="pt-edit" data-edit="' + kind + ':' + U.esc(it.id) + '" title="Editar ficha y precio">✎</button></div>' +
      '<div class="pt-spec">' + U.esc(spec) + '</div>' +
      '<div class="pt-foot"><span class="pt-price">' + money(it.price) + '</span><span class="small muted">' + per + '</span>' + (cp.ok ? '<span class="pt-ok">✓ ' + (cp.c ? f(cp.c.kwp, 1) + ' kWp' : '') + '</span>' : '<span class="pt-no">✗ incompatible</span>') + '</div></div>';
  }
  function num(id, label, val, attrs, hint) {
    return '<label class="f">' + label + '<input type="number" data-in="' + id + '" value="' + (val === '' || val == null ? '' : U.esc(val)) + '" ' + (attrs || '') + '>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
  }
  function sel(id, label, val, opts, hint) {
    return '<label class="f">' + label + '<select data-in="' + id + '">' + opts.map(function (o) { return opt(o[0], o[1], val); }).join('') + '</select>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
  }
  function checkRow(label, value, limit, ok, warn) {
    var st = ok ? (warn ? '<span class="st warn">▲ revisar</span>' : '<span class="st ok">✓ cumple</span>') : '<span class="st bad">✗ no cumple</span>';
    return [label, value, limit, st];
  }
  function checks(c) {
    var e = c.elec, inv = c.inv, pan = c.panel, rows = [];
    if (inv.type === 'micro') {
      rows.push(checkRow('Voc máx. del módulo a ' + f(c.tMin, 0) + ' °C', f(c.vocMax, 1) + ' V', '≤ ' + inv.vdcMax + ' V (entrada)', c.vocMax <= inv.vdcMax));
      rows.push(checkRow('Vmp del módulo (caliente / frío)', f(c.vmpHot, 1) + ' / ' + f(c.vmpCold, 1) + ' V', inv.mpptMin + '–' + inv.mpptMax + ' V', c.vmpHot >= inv.mpptMin && c.vmpCold <= inv.mpptMax));
      rows.push(checkRow('Isc × 1.25 por entrada', f(pan.isc * 1.25, 1) + ' A', '≤ ' + inv.iscMax + ' A', pan.isc * 1.25 <= inv.iscMax));
    } else {
      var vmin = Math.max(inv.mpptMin, inv.vStart || 0), iM = c.perMppt * pan.imp, iS = c.perMppt * pan.isc * 1.25;
      rows.push(checkRow('Voc máx. de cadena a ' + f(c.tMin, 0) + ' °C (' + c.ns + ' mód.)', f(c.vStrVocMax, 0) + ' V', '≤ ' + inv.vdcMax + ' V (inversor)', c.vStrVocMax <= inv.vdcMax));
      rows.push(checkRow('Voc máx. vs. tensión de sistema del módulo', f(c.vStrVocMax, 0) + ' V', '≤ ' + pan.vSys + ' V', c.vStrVocMax <= pan.vSys));
      rows.push(checkRow('Vmp de cadena en caliente (celda ' + f(c.tCellMax, 0) + ' °C)', f(c.vStrVmpHot, 0) + ' V', '≥ ' + vmin + ' V (MPPT mín./arranque)', c.vStrVmpHot >= vmin));
      rows.push(checkRow('Vmp de cadena en frío', f(c.vStrVmpCold, 0) + ' V', '≤ ' + inv.mpptMax + ' V (MPPT máx.)', c.vStrVmpCold <= inv.mpptMax));
      rows.push(checkRow('Corriente por MPPT (' + c.perMppt + ' × Imp)', f(iM, 1) + ' A', '≤ ' + inv.imax + ' A', iM <= inv.imax * 1.1, iM > inv.imax));
      rows.push(checkRow('Cortocircuito por MPPT (1.25 × Isc)', f(iS, 1) + ' A', '≤ ' + inv.iscMax + ' A', iS <= inv.iscMax + 1e-9));
      rows.push(checkRow('Potencia DC por inversor', f(c.kwp / c.nInv, 2) + ' kWp', '≤ ' + f(inv.pdcMax / 1000, 1) + ' kWp', c.kwp / c.nInv <= inv.pdcMax / 1000 * 1.001));
      rows.push(checkRow('Caída de tensión DC (cadena, STC)', f(e.dc.cable.dropPct, 2) + ' %', '≤ 1.5 %', e.dc.cable.dropPct <= 1.5));
    }
    rows.push(checkRow('Relación DC/AC', f(c.dcAc, 2), '0.9 – 1.35 recomendado', true, c.dcAc > 1.35 || c.dcAc < 0.9));
    rows.push(checkRow('Caída de tensión AC', f(e.ac.cable.dropPct, 2) + ' %', '≤ 2 %', e.ac.cable.dropPct <= 2));
    if (c.bank) {
      var b = c.bank;
      rows.push(checkRow('Energía útil del banco', f(b.usable, 1) + ' kWh', '≥ ' + f(b.usableReq, 1) + ' kWh (reserva nocturna × autonomía, margen ' + b.margin + ' %)', b.usable >= b.usableReq - 1e-6));
      rows.push(checkRow('Corriente de descarga', f(b.iDis, 0) + ' A', '≤ ' + f(c.bat.iMax * b.par, 0) + ' A (' + b.par + ' × ' + c.bat.iMax + ' A)', b.iDis <= c.bat.iMax * b.par));
      rows.push(checkRow('Tensión del banco', f(b.vBank, 1) + ' V', 'Bus ' + (c.inv.batV || 48) + ' V ± 12 %', true));
      rows.push(checkRow('Caída de tensión en batería', f(e.bat.cable.dropPct, 2) + ' %', '≤ 1 %', e.bat.cable.dropPct <= 1));
    }
    if (c.inv.type !== 'ongrid' && c.inv.type !== 'micro') rows.push(checkRow('Potencia AC vs. demanda pico', f(c.pacTot, 1) + ' kW', '≥ ' + f(c.peakKw, 1) + ' kW', c.pacTot >= c.peakKw - 1e-6));
    return rows;
  }
  V.diseno = {
    render: async function (el) {
      await Dz.ready();
      var p = Dz.project(), I = p.inputs, res = Dz.resource(), cat = Dz.catalog();
      var rank = Dz.ranking(), c = Dz.current(), autoMsg = '';
      if ((!c || !c.ok) && rank.list.length) {
        var prev = c && c.reason;
        Dz.applyBest(); Dz._cache.cur = null; c = Dz.current();
        autoMsg = 'La selección anterior no era compatible' + (prev ? ' (' + prev + ')' : '') + ': se aplicó la mejor combinación según «' + Dz.OBJECTIVES[I.objective] + '».';
      }
      var sysBat = Dz.SYS[I.sysType].bat;
      var h = V.head('Diseño del sistema fotovoltaico', 'Seleccione tipos de paneles, inversores y baterías (o use un atajo) y el optimizador arma el arreglo más eficiente: longitud y número de cadenas dentro de la ventana MPPT, número de inversores, banco de baterías, pérdidas, producción horaria de 8 760 h, costos y LCOE.',
        '<button class="btn btn-accent" id="dz-opt">⚡ Optimizar arreglo</button><button class="btn" data-go="costos">💲 Costos →</button><button class="btn" data-go="manual">📘 Manual →</button>');
      var resCls = res.kind === 'estimado' ? 'warn' : 'info';
      h += '<div class="alert ' + resCls + '"><span class="ai">' + (res.kind === 'estimado' ? '⚠' : '🛰') + '</span><div><b>Recurso solar:</b> ' + U.esc(res.label) + ' · GHI ' + f(res.ghiYear, 0) + ' kWh/m²·año (' + f(res.ghiYear / 365, 2) + ' HSP) · T diseño ' + f(res.tMin, 0) + ' / ' + f(res.tMax, 0) + ' °C · <b>' + U.esc(p.site.place || '') + '</b> (' + WM.fmtLat(p.site.lat) + ', ' + WM.fmtLon(p.site.lon) + ') <a href="#" data-go="sitio">Cambiar sitio o consultar NASA →</a></div></div>';
      if (autoMsg) h += '<div class="alert info"><span class="ai">🔁</span><div>' + U.esc(autoMsg) + '</div></div>';
      /* atajos */
      h += '<div class="card"><div class="card-head"><h3>⚡ Atajos de diseño</h3><span class="card-sub">Cargan una configuración típica; ajuste los requerimientos y optimice</span></div><div class="preset-grid">' +
        Dz.PRESETS.map(function (x) { return '<button class="preset" data-preset="' + x.id + '"><span class="pr-ico">' + x.ico + '</span><b>' + U.esc(x.label) + '</b><span>' + U.esc(x.desc) + '</span></button>'; }).join('') + '</div></div>';
      /* requerimientos + componentes */
      var L = I.losses;
      h += '<div class="grid dz-grid"><div class="card"><div class="card-head"><h3>🎯 Requerimientos y criterios</h3></div>' +
        '<div class="seg seg-wide">' + Object.keys(Dz.SYS).map(function (k) { return '<button class="seg-b' + (I.sysType === k ? ' on' : '') + '" data-sys="' + k + '">' + Dz.SYS[k].ico + ' ' + U.esc(Dz.SYS[k].label) + '</button>'; }).join('') + '</div>' +
        '<div class="form-grid" style="margin-top:12px">' +
        num('dailyKwh', 'Consumo diario (kWh/día)', I.dailyKwh, 'min="0.5" step="0.5"') + num('nightKwh', 'Consumo nocturno (kWh)', I.nightKwh, 'min="0" step="0.5"', 'Del anochecer al amanecer') +
        num('peakKw', 'Demanda pico (kW)', I.peakKw, 'min="0.5" step="0.5"') + num('coverage', 'Cobertura solar objetivo (%)', I.coverage, 'min="10" max="200" step="5"') +
        sel('criterion', 'Criterio de dimensionamiento', I.criterion, [['anual', 'Promedio anual'], ['critico', 'Mes crítico (aislados)']]) + num('margin', 'Margen de diseño (%)', I.margin, 'min="0" max="100" step="1"') +
        (sysBat ? num('autonomyDays', 'Autonomía (noches)', I.autonomyDays, 'min="0.5" max="7" step="0.5"') + num('socMin', 'SOC mínimo operativo (%)', I.socMin, 'min="0" max="60" step="1"', 'Usado por la decisión energética') : '') +
        num('kwpTarget', 'Potencia fija (kWp, opcional)', I.kwpTarget, 'min="0" step="0.1" placeholder="auto"') + num('areaMax', 'Área disponible (m², opcional)', I.areaMax, 'min="0" step="1" placeholder="sin límite"') +
        sel('mount', 'Montaje', I.mount, [['techo', 'Cubierta (coplanar/inclinado)'], ['suelo', 'Suelo en filas']]) +
        num('tilt', 'Inclinación (°)', I.tilt, 'min="0" max="90" step="1" placeholder="auto ' + Math.max(10, Math.round(res.opt.tilt)) + '°"', 'Óptima ' + f(res.opt.tilt, 0) + '° (+' + f(res.opt.gain * 100, 1) + ' %)') +
        num('azimuth', 'Acimut (° desde el ecuador)', I.azimuth, 'min="-180" max="180" step="5"', '0 = hacia el ' + (p.site.lat >= 0 ? 'sur' : 'norte') + '; − este, + oeste') +
        num('albedo', 'Albedo del suelo', I.albedo, 'min="0" max="0.9" step="0.01" placeholder="auto ' + f(res.albedo, 2) + '"') +
        num('tMin', 'T mín. de diseño (°C)', I.tMin, 'step="0.5" placeholder="auto ' + f(res.tMin, 1) + '"', 'Para Voc máximo') + num('tMax', 'T máx. ambiente (°C)', I.tMax, 'step="0.5" placeholder="auto ' + f(res.tMax, 1) + '"', 'Para Vmp mínimo') +
        num('lenDC', 'Longitud DC cadena → inversor (m)', I.lenDC, 'min="1" step="1"') + num('lenAC', 'Longitud AC inversor → tablero (m)', I.lenAC, 'min="1" step="1"') +
        (sysBat ? num('lenBat', 'Longitud batería → inversor (m)', I.lenBat, 'min="0.5" step="0.5"') : '') + num('dcAcMax', 'DC/AC máximo', I.dcAcMax, 'min="1" max="2" step="0.05"') +
        sel('objective', 'Objetivo del optimizador', I.objective, Object.keys(Dz.OBJECTIVES).map(function (k) { return [k, Dz.OBJECTIVES[k]]; })) +
        '</div><details class="losses"><summary>Pérdidas del sistema (%)</summary><div class="form-grid" style="margin-top:8px">' +
        [['soiling', 'Suciedad'], ['mismatch', 'Desajuste (mismatch)'], ['lid', 'LID / LeTID'], ['shading', 'Sombras'], ['acWiring', 'Cableado AC'], ['availability', 'Indisponibilidad']].map(function (x) { return '<label class="f">' + x[1] + '<input type="number" data-loss="' + x[0] + '" value="' + L[x[0]] + '" min="0" max="30" step="0.1"></label>'; }).join('') +
        '</div><p class="small muted">La pérdida por temperatura, por cableado DC (calculada con la sección del conductor), por eficiencia del inversor y por recorte se calculan hora a hora.</p></details>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn btn-sm" id="dz-dec">🔗 Usar consumos de la decisión</button><button class="btn btn-sm btn-ghost" id="dz-reset">↺ Valores por defecto</button></div></div>';
      var counts = { panels: cat.panels.length, inverters: cat.inverters.length, batteries: cat.batteries.length };
      if (!sysBat && dzTab === 'batteries') dzTab = 'panels';
      h += '<div class="card"><div class="card-head"><h3>🧩 Componentes</h3><span class="card-sub">Clic para seleccionar · ✎ para editar ficha y precio</span><div class="ch-actions"><button class="btn btn-sm" id="dz-add">＋ Componente</button></div></div>' +
        '<div class="tabs">' + [['panels', '▦ Módulos'], ['inverters', '⚡ Inversores']].concat(sysBat ? [['batteries', '🔋 Baterías']] : []).map(function (t) { return '<button class="tab' + (dzTab === t[0] ? ' active' : '') + '" data-dztab="' + t[0] + '">' + t[1] + ' (' + counts[t[0]] + ')</button>'; }).join('') + '</div>' +
        '<div class="ptiles">' + cat[dzTab].map(function (it) { return tileHTML(dzTab, it, rank, I); }).join('') + '</div></div></div>';
      /* resultados */
      if (!c || !c.ok) {
        h += '<div class="card empty"><span class="e-ico">⚠</span><h3>No hay un diseño válido</h3><p>' + U.esc(c ? c.reason || '' : '') + '</p><p class="muted small">Ninguna combinación del catálogo cumple las restricciones. Revise temperaturas de diseño, tipo de sistema o agregue componentes.</p></div>';
        el.innerHTML = h; bindDesign(el); return;
      }
      var sim = c.sim, ec = c.econ;
      p.summary = { kwp: c.kwp, layout: c.layout, bat: c.bank ? c.bank.kwh : 0, total: ec.capex, lcoe: ec.lcoe, energy: sim.ac, at: Date.now() };
      Dz.save();
      h += '<div class="card dz-summary proj-kpis"><div class="card-head"><h3>✅ Arreglo diseñado</h3><span class="chip run">' + U.esc(c.layout) + '</span><div class="ch-actions"><button class="btn btn-sm btn-primary" id="dz-apply">✔ Aplicar al sistema y a la decisión</button></div></div>' +
        '<div class="grid g6">' +
        V.kpi('Potencia FV', f(c.kwp, 2), 'kWp', c.nMods + ' × ' + c.panel.pmax + ' W · ' + f(c.areaUsed, 0) + ' m²', 'big', '▦') +
        V.kpi('Inversores', c.nInv + '\u00A0×\u00A0' + f(c.inv.pac / 1000, c.inv.pac % 1000 ? 1 : 0), 'kW', 'DC/AC ' + f(c.dcAc, 2) + ' · ' + Dz.TYPES[c.inv.type], '', '⚡') +
        V.kpi('Batería', c.bank ? f(c.bank.kwh, 1) : '—', c.bank ? 'kWh' : '', c.bank ? c.bank.series + 's × ' + c.bank.par + 'p · útil ' + f(c.bank.usable, 1) + ' kWh' : 'Sin baterías', '', '🔋') +
        V.kpi('Energía anual', f(sim.ac / 1000, 2), 'MWh', f(sim.ac / 365, 1) + ' kWh/día promedio', '', '☀') +
        V.kpi('Rendimiento', f(sim.specYield, 0), 'kWh/kWp', 'PR ' + f(sim.pr * 100, 1) + ' % · FC ' + f(sim.cf * 100, 1) + ' %', '', '📈') +
        V.kpi('Fracción solar', f(sim.solarFrac * 100, 1), '%', c.sysType === 'aislado' ? 'No suministrada ' + f(sim.unmet, 0) + ' kWh/año' : 'Red ' + f(sim.gridImport, 0) + ' kWh/año', '', '🎯') +
        '</div><div class="grid g6" style="margin-top:12px">' +
        V.kpi('Inversión (CAPEX)', Co.kpiMoney(ec.capex)[0], Co.kpiMoney(ec.capex)[1], Co.moneyAlt(ec.capex) + ' · ' + money(ec.perWp) + '/Wp', '', '💲') +
        V.kpi('LCOE', money(ec.lcoe), '/kWh', 'Costo nivelado a ' + ec.years + ' años', '', '⚖') +
        V.kpi('Recuperación', isFinite(ec.payback) ? f(ec.payback, 1) : '> ' + ec.years, 'años', 'Ahorro año 1 ' + money(ec.savings1), '', '⏳') +
        V.kpi('TIR', isFinite(ec.irr) ? f(ec.irr * 100, 1) : '—', '%', 'VPN ' + money(ec.npv), '', '📊') +
        V.kpi('Pérdida térmica', f(c.tempLossPct, 1), '%', 'Celda máx. ' + f(c.tCellMax, 0) + ' °C · γ ' + c.panel.gP + ' %/°C', '', '🌡') +
        V.kpi('Inclinación / acimut', f(c.tilt, 0) + '° / ' + f(c.azimuth, 0), '°', c.mount === 'suelo' ? 'Paso entre filas ' + f(c.row.pitch, 2) + ' m' : 'Montaje en cubierta', '', '📐') +
        '</div>' + (c.warnings.length ? '<div style="margin-top:12px">' + c.warnings.map(function (w) { return '<div class="alert warn"><span class="ai">▲</span><div>' + U.esc(w) + '</div></div>'; }).join('') + '</div>' : '') + '</div>';
      /* verificación + pérdidas */
      var S2 = sim, dcIn = S2.dc, acF = (1 - I.losses.acWiring / 100) * (1 - I.losses.availability / 100);
      var invLoss = dcIn > 0 ? (dcIn - (S2.ac / acF + S2.clip)) / dcIn * 100 : 0, clipPct = dcIn > 0 ? S2.clip / dcIn * 100 : 0;
      var P = c.ctx.P;
      var lossRows = [
        ['Irradiación horizontal (GHI)', f(P.ghiYear, 0) + ' kWh/m²'], ['Ganancia por inclinación y transposición', (P.poaYear >= P.ghiYear ? '+' : '') + f((P.poaYear / P.ghiYear - 1) * 100, 1) + ' % → ' + f(P.poaYear, 0) + ' kWh/m²'],
        ['Temperatura de celda', '−' + f(c.tempLossPct, 1) + ' %'], ['Suciedad · desajuste · LID · sombras', '−' + f(I.losses.soiling, 1) + ' · −' + f(I.losses.mismatch, 1) + ' · −' + f(I.losses.lid, 1) + ' · −' + f(I.losses.shading, 1) + ' %'],
        ['Cableado DC (calculado)', '−' + f(c.dcLossPct, 2) + ' %'], ['Eficiencia del inversor', '−' + f(invLoss, 2) + ' %'], ['Recorte por potencia AC', '−' + f(clipPct, 2) + ' %'],
        ['Cableado AC · indisponibilidad', '−' + f(I.losses.acWiring, 1) + ' · −' + f(I.losses.availability, 1) + ' %'], ['<b>Índice de desempeño (PR)</b>', '<b>' + f(sim.pr * 100, 1) + ' %</b>']
      ];
      var balRows = [['Producción AC', f(sim.ac, 0) + ' kWh/año'], ['Consumo', f(sim.load, 0) + ' kWh/año'], ['FV directo a cargas', f(sim.direct, 0) + ' kWh (' + f(sim.direct / Math.max(1, sim.load) * 100, 1) + ' %)']];
      if (c.bank) balRows.push(['Carga / descarga de batería', f(sim.ch, 0) + ' / ' + f(sim.dis, 0) + ' kWh'], ['Ciclos equivalentes · vida estimada', f(sim.cycles, 0) + ' /año · ' + f(sim.batLife, 1) + ' años'], ['SOC medio · mínimo', f(sim.socMean, 0) + ' % · ' + f(sim.minSoc, 0) + ' %']);
      balRows.push(c.sysType === 'aislado' ? ['Excedente recortado · no suministrado', f(sim.curtail, 0) + ' · ' + f(sim.unmet, 0) + ' kWh (' + f(sim.lolp * 100, 2) + ' % de horas)'] : ['Exportación a la red · importación', f(sim.export, 0) + ' · ' + f(sim.gridImport, 0) + ' kWh']);
      h += '<div class="grid g2"><div class="card"><div class="card-head"><h3>🔌 Verificación eléctrica</h3><span class="card-sub">Tmín ' + f(c.tMin, 1) + ' °C · Tmáx ' + f(c.tMax, 1) + ' °C</span></div>' + U.table(['Verificación', 'Valor', 'Límite', 'Estado'], checks(c), { compact: true }) + '</div>' +
        '<div class="card"><div class="card-head"><h3>📉 Cadena de pérdidas y balance</h3><span class="card-sub">Simulación de 8 760 h</span></div>' + U.table(['Etapa', 'Valor'], lossRows, { compact: true }) + '<div style="height:10px"></div>' + U.table(['Balance anual', 'Valor'], balRows, { compact: true }) + '</div></div>';
      h += '<div class="card"><div class="card-head"><h3>📐 Diagrama unifilar</h3><span class="card-sub">Conductores y protecciones calculados · NTC 2050 / RETIE</span></div><div class="sld-box">' + Dz.diagram(c) + '</div>' +
        '<ul class="small">' + c.elec.notes.map(function (n) { return '<li>' + U.esc(n) + '</li>'; }).join('') + '</ul></div>';
      h += '<div class="grid g2">' + C.card('dz-month', 'Producción vs. consumo mensual', 'kWh/mes · simulación horaria', 290) + C.card('dz-balance', 'Cobertura de la demanda', 'FV directo, batería y red/no suministrada · kWh/mes', 290) + '</div>';
      /* ficha técnica */
      h += '<div class="card"><div class="card-head"><h3>📋 Ficha técnica del sistema</h3><div class="ch-actions"><button class="btn btn-sm" id="dz-spec-csv">⬇ CSV</button></div></div><div class="grid g3 spec-grid">' + specTables(c).map(function (t) { return '<div><h4>' + t.title + '</h4>' + U.table(['Parámetro', 'Valor'], t.rows, { compact: true }) + '</div>'; }).join('') + '</div></div>';
      /* ranking */
      var top = rank.list.slice(0, 12);
      h += '<div class="card"><div class="card-head"><h3>🏆 Ranking de combinaciones</h3><span class="card-sub">' + rank.list.length + ' compatibles · ' + rank.rejected.length + ' descartadas · orden: ' + U.esc(Dz.OBJECTIVES[I.objective]) + '</span></div>' +
        U.table(['#', 'Módulo', 'Inversor', 'Batería', 'kWp', 'Arreglo', 'MWh/año', 'kWh/kWp', 'FS', 'CAPEX', 'LCOE', ''], top.map(function (x, i) {
          var cur = x.panel.id === c.panel.id && x.inv.id === c.inv.id && (!x.bat || (c.bat && x.bat.id === c.bat.id));
          return [(i + 1) + (cur ? ' ◀' : ''), U.esc(x.panel.name), U.esc(x.inv.name), x.bank ? U.esc(x.bat.name.split('(')[0]) + ' ' + x.bank.series + 's' + x.bank.par + 'p' : '—', f(x.kwp, 2), x.inv.type === 'micro' ? x.nInv + ' micro' : x.np + '×' + x.ns + ' · ' + x.nInv + ' inv.', f(x.sim.ac / 1000, 2), f(x.sim.specYield, 0), f(x.sim.solarFrac * 100, 0) + ' %', money(x.econ.capex), money(x.econ.lcoe), cur ? '<span class="chip">actual</span>' : '<button class="btn btn-sm" data-rank="' + i + '">Aplicar</button>'];
        }), { numCols: [4, 6, 7, 8, 9, 10], compact: true });
      if (rank.rejected.length) {
        var agg = {};
        rank.rejected.forEach(function (x) { var k = x.reason.replace(/\d+(\.\d+)?/g, '#'); agg[k] = agg[k] || { n: 0, ex: x }; agg[k].n++; });
        h += '<details class="small" style="margin-top:10px"><summary>Motivos de descarte (' + rank.rejected.length + ')</summary><ul>' + Object.keys(agg).map(function (k) { var a = agg[k]; return '<li><b>' + a.n + '×</b> ' + U.esc(a.ex.reason) + ' <span class="muted">(p. ej. ' + U.esc(a.ex.panel.name) + ' + ' + U.esc(a.ex.inv.name) + ')</span></li>'; }).join('') + '</ul></details>';
      }
      h += '</div>';
      el.innerHTML = h;
      bindDesign(el, rank, c);
      /* gráficos */
      C.mount(U.$('#dz-month'), { type: 'bar', categories: U.MESES, catLabel: 'Mes', yLabel: 'kWh/mes', unit: 'kWh', series: [{ name: 'Producción FV (AC)', values: sim.monthAc, color: 3 }, { name: 'Consumo', values: sim.monthLoad, color: 0 }] });
      var dirM = sim.monthSolar, defM = sim.monthDef;
      C.mount(U.$('#dz-balance'), { type: 'bar', stacked: true, categories: U.MESES, catLabel: 'Mes', yLabel: 'kWh/mes', unit: 'kWh', series: [{ name: c.bank ? 'FV directo + batería' : 'FV directo', values: dirM, color: 2 }, { name: c.sysType === 'aislado' ? 'No suministrada' : 'Red', values: defM, color: c.sysType === 'aislado' ? 'status:critical' : 0 }] });
    }
  };
  function specTables(c) {
    var pn = c.panel, iv = c.inv, bt = c.bat, b = c.bank, e = c.elec;
    var t = [{ title: '▦ Módulo fotovoltaico', rows: [['Referencia', U.esc(pn.name)], ['Tecnología', U.esc(pn.tech) + ' · ' + U.esc(pn.cells || '')], ['Pmáx (STC)', pn.pmax + ' W'], ['Voc / Vmp', pn.voc + ' / ' + pn.vmp + ' V'], ['Isc / Imp', pn.isc + ' / ' + pn.imp + ' A'], ['Eficiencia', f(pn.eff, 1) + ' %'], ['Coef. Pmáx / Voc / Isc', pn.gP + ' / ' + pn.bV + ' / +' + pn.aI + ' %/°C'], ['NOCT', pn.noct + ' °C'], ['Dimensiones · peso', pn.L + ' × ' + pn.W + ' mm · ' + pn.kg + ' kg'], ['Fusible máx. serie · V sistema', pn.maxFuse + ' A · ' + pn.vSys + ' V'], ['Degradación', f(pn.degr1, 1) + ' % año 1 · ' + f(pn.degrY, 2) + ' %/año'], ['Garantía', U.esc(pn.warr || '—')]] },
      { title: '⚡ Inversor', rows: [['Referencia', U.esc(iv.name)], ['Tipo', Dz.TYPES[iv.type]], ['Potencia AC', f(iv.pac / 1000, 1) + ' kW · ' + U.esc(iv.acLabel)], ['DC máx. · Vdc máx.', f(iv.pdcMax / 1000, 1) + ' kW · ' + iv.vdcMax + ' V'], ['Ventana MPPT · arranque', iv.mpptMin + '–' + iv.mpptMax + ' V · ' + (iv.vStart || '—') + ' V'], ['MPPT · I máx · Isc máx', iv.nMppt + ' · ' + iv.imax + ' A · ' + iv.iscMax + ' A'], ['Eficiencia máx. / europea', f(iv.effMax, 1) + ' / ' + f(iv.effEuro, 1) + ' %'], ['Batería', iv.batV ? iv.batV + ' V · carga ' + iv.batIChg + ' A' : '—'], ['Cantidad', c.nInv]] },
      { title: '🔧 Arreglo y protecciones', rows: [['Configuración', U.esc(c.layout)], ['Potencia DC / AC', f(c.kwp, 2) + ' kWp / ' + f(c.pacTot, 1) + ' kW'], ['Voc máx. / Vmp (caliente–frío)', c.inv.type === 'micro' ? f(c.vocMax, 1) + ' V/módulo' : f(c.vStrVocMax, 0) + ' V / ' + f(c.vStrVmpHot, 0) + '–' + f(c.vStrVmpCold, 0) + ' V'], ['Conductor DC', e.dc.micro ? 'Cables del módulo' : U.esc(e.dc.cable.label)], ['Fusibles de cadena', e.dc.fuse ? e.dc.fuse.rating + ' A gPV (' + e.dc.fuse.qty + ' und.)' : 'No requeridos'], ['Seccionador / DPS DC', e.dc.micro ? '—' : e.dc.disc.rating + ' A · ' + e.dc.disc.volt + ' V / T2 ' + e.dc.spd + ' V'], ['Conductor / protección AC', U.esc(e.ac.cable.label) + ' · ' + e.ac.breaker.poles + 'P ' + e.ac.breaker.rating + ' A'], ['Tierra de equipos', e.gnd.egcLabel], ['Inclinación · acimut', f(c.tilt, 0) + '° · ' + f(c.azimuth, 0) + '°'], ['Área · peso módulos', f(c.areaMods, 1) + ' m² · ' + f(c.weight, 0) + ' kg']] }];
    if (b) t.push({ title: '🔋 Banco de baterías', rows: [['Referencia', U.esc(bt.name)], ['Química', bt.chem], ['Configuración', b.series + 's × ' + b.par + 'p (' + b.units + ' und.)'], ['Tensión · capacidad', f(b.vBank, 1) + ' V · ' + f(b.ah, 0) + ' Ah'], ['Energía nominal / útil', f(b.kwh, 1) + ' / ' + f(b.usable, 1) + ' kWh'], ['DoD · SOC mín. · eficiencia', bt.dod + ' % · ' + b.socMin + ' % · ' + bt.eff + ' %'], ['Ciclos · vida calendario', U.fmtInt(bt.cycles) + ' · ' + bt.life + ' años'], ['Protección · conductor', e.bat.ocpd + ' A · ' + U.esc(e.bat.cable.label)]] });
    return t;
  }
  function specCSV(c) {
    var rows = [];
    specTables(c).forEach(function (t) { t.rows.forEach(function (r) { rows.push([t.title.replace(/^[^\wÁÉÍÓÚ]+/, ''), String(r[0]).replace(/<[^>]+>/g, ''), String(r[1]).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')]); }); });
    return U.toCSV(['Sección', 'Parámetro', 'Valor'], rows);
  }
  function bindDesign(el, rank, c) {
    var p = Dz.project(), I = p.inputs;
    var rerender = function () { Dz.invalidate(); Dz.save(); keepScroll(function () { V.diseno.render(el); }); };
    U.$$('[data-preset]', el).forEach(function (b) { b.onclick = function () { Dz.applyPreset(b.getAttribute('data-preset')); rerender(); U.toast('Atajo aplicado. Revise el arreglo propuesto.', 'good', 2500); }; });
    U.$$('[data-sys]', el).forEach(function (b) { b.onclick = function () { I.sysType = b.getAttribute('data-sys'); if (I.sysType === 'aislado' && I.criterion === 'anual') I.criterion = 'critico'; rerender(); }; });
    U.$$('[data-in]', el).forEach(function (x) {
      x.onchange = function () {
        var k = x.getAttribute('data-in'), v = x.value;
        I[k] = x.tagName === 'SELECT' ? v : (v === '' ? '' : +v);
        if (k === 'socMin' && SEDA.state && SEDA.state.decisionInputs) SEDA.state.decisionInputs.socMin = +v;
        rerender();
      };
    });
    U.$$('[data-loss]', el).forEach(function (x) { x.onchange = function () { I.losses[x.getAttribute('data-loss')] = U.clamp(+x.value || 0, 0, 30); rerender(); }; });
    U.$$('[data-dztab]', el).forEach(function (b) { b.onclick = function () { dzTab = b.getAttribute('data-dztab'); keepScroll(function () { V.diseno.render(el); }); }; });
    U.$$('[data-pick]', el).forEach(function (t) {
      var pick = function (e) {
        if (e.target.closest('[data-edit]')) return;
        var a = t.getAttribute('data-pick').split(':'), kind = a[0], id = a.slice(1).join(':');
        if (kind === 'panels') I.panel = id; else if (kind === 'inverters') I.inverter = id; else I.battery = id;
        if (t.classList.contains('na')) U.toast('Componente seleccionado: la combinación actual no es compatible; se usará la mejor alternativa disponible.', 'warn', 3500);
        rerender();
      };
      t.onclick = pick; t.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } };
    });
    U.$$('[data-edit]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var a = b.getAttribute('data-edit').split(':'); editComponent(a[0], a.slice(1).join(':'), rerender); }; });
    var add = U.$('#dz-add', el); if (add) add.onclick = function () { var kind = dzTab, base = Dz.find(kind, kind === 'panels' ? I.panel : kind === 'inverters' ? I.inverter : I.battery) || Dz.catalog()[kind][0]; editComponent(kind, base.id, rerender, true); };
    U.$('#dz-opt', el).onclick = function () {
      var b = Dz.applyBest();
      if (!b) { U.toast('No hay combinaciones compatibles.', 'warn'); return; }
      rerender();
      U.toast('Mejor combinación (' + Dz.OBJECTIVES[I.objective] + '): <b>' + U.esc(b.panel.name) + '</b> + <b>' + U.esc(b.inv.name) + '</b>' + (b.bat ? ' + <b>' + U.esc(b.bat.name) + '</b>' : '') + '.', 'good', 5000);
    };
    U.$('#dz-dec', el).onclick = function () {
      var di = (SEDA.state && SEDA.state.decisionInputs) || {};
      I.nightKwh = +di.nightLoad || I.nightKwh; I.dailyKwh = Math.round(((+di.nightLoad || 0) + (+di.dayLoad || 0)) * 10) / 10 || I.dailyKwh; I.socMin = +di.socMin || I.socMin;
      rerender(); U.toast('Consumos tomados de la decisión energética (día ' + (di.dayLoad || '—') + ' kWh + noche ' + (di.nightLoad || '—') + ' kWh).', 'info');
    };
    U.$('#dz-reset', el).onclick = async function () { if (!(await U.confirm('Restablecer requerimientos', '<p>Se restauran los requerimientos y criterios por defecto (el catálogo y los costos editados se conservan).</p>', 'Restablecer'))) return; p.inputs = Dz.defaultInputs(); rerender(); };
    U.$$('[data-rank]', el).forEach(function (b) { b.onclick = function () { var x = rank.list[+b.getAttribute('data-rank')]; I.panel = x.panel.id; I.inverter = x.inv.id; if (x.bat) I.battery = x.bat.id; rerender(); }; });
    var sc = U.$('#dz-spec-csv', el); if (sc) sc.onclick = function () { U.download('SEGAR_ficha_tecnica_' + f(c.kwp, 1) + 'kWp.csv', specCSV(c), 'text/csv;charset=utf-8'); };
    var ap = U.$('#dz-apply', el); if (ap) ap.onclick = function () { V.applyDesignToSystem(c); };
  }
  V.applyDesignToSystem = async function (c) {
    c = c || Dz.current();
    if (!c || !c.ok) return;
    var p = Dz.project(), sys = App().system(), S = SEDA.state;
    App().saveSystem(Object.assign(sys, { lat: p.site.lat, lon: p.site.lon, utcOffset: p.site.utcOffset, place: p.site.place + (p.site.country && (p.site.place || '').indexOf(p.site.country) < 0 ? ', ' + p.site.country : ''), kwp: Math.round(c.kwp * 100) / 100, inverterKw: Math.round(c.pacTot * 10) / 10, batteryKwh: c.bank ? Math.round(c.bank.kwh * 10) / 10 : sys.batteryKwh }));
    var di = { effInv: c.inv.effEuro, nightLoad: p.inputs.nightKwh, dayLoad: Math.max(0, p.inputs.dailyKwh - p.inputs.nightKwh) };
    if (c.bank) Object.assign(di, { capKWh: Math.round(c.bank.kwh * 10) / 10, effBat: c.bat.eff, socMin: +p.inputs.socMin || 20 });
    S.decisionInputs = Object.assign({}, S.decisionInputs, di);
    if (S.simParams) S.simParams._touched = false;
    if (S.prediction) { try { await App().decide(); } catch (e) { console.warn(e); } }
    App().persist();
    U.toast('Diseño aplicado: sistema ' + f(c.kwp, 2) + ' kWp / ' + f(c.pacTot, 1) + ' kW' + (c.bank ? ' / ' + f(c.bank.kwh, 1) + ' kWh' : '') + '. La decisión y la simulación usan ahora estos valores.', 'good', 5000);
  };
  var FIELDS = {
    panels: [['name', 'Nombre', 't'], ['tech', 'Tecnología', 't'], ['pmax', 'Pmáx (W)'], ['voc', 'Voc (V)'], ['vmp', 'Vmp (V)'], ['isc', 'Isc (A)'], ['imp', 'Imp (A)'], ['eff', 'Eficiencia (%)'], ['gP', 'Coef. Pmáx (%/°C)'], ['bV', 'Coef. Voc (%/°C)'], ['aI', 'Coef. Isc (%/°C)'], ['noct', 'NOCT (°C)'], ['L', 'Largo (mm)'], ['W', 'Ancho (mm)'], ['kg', 'Peso (kg)'], ['bif', 'Bifacialidad (0–1)'], ['maxFuse', 'Fusible máx. serie (A)'], ['vSys', 'V máx. sistema (V)'], ['degr1', 'Degradación año 1 (%)'], ['degrY', 'Degradación anual (%)'], ['price', 'Precio unitario (COP)']],
    inverters: [['name', 'Nombre', 't'], ['type', 'Tipo', 's', [['ongrid', 'On-grid'], ['hibrido', 'Híbrido'], ['aislado', 'Aislado'], ['micro', 'Microinversor']]], ['phases', 'Fases', 's', [['1', '1'], ['3', '3']]], ['vAc', 'Tensión AC de cálculo (V)'], ['acLabel', 'Salida AC (texto)', 't'], ['pac', 'Potencia AC (W)'], ['pdcMax', 'Potencia DC máx. (W)'], ['vdcMax', 'Vdc máx. (V)'], ['mpptMin', 'MPPT mín. (V)'], ['mpptMax', 'MPPT máx. (V)'], ['vStart', 'Tensión de arranque (V)'], ['nMppt', 'N.º MPPT / entradas'], ['imax', 'I máx. por MPPT (A)'], ['iscMax', 'Isc máx. por MPPT (A)'], ['effMax', 'Eficiencia máx. (%)'], ['effEuro', 'Eficiencia europea (%)'], ['batV', 'Bus de batería (V, 0 = no)'], ['batIChg', 'I carga batería (A)'], ['batIDis', 'I descarga batería (A)'], ['price', 'Precio unitario (COP)']],
    batteries: [['name', 'Nombre', 't'], ['chem', 'Química', 's', [['LFP', 'LiFePO₄'], ['AGM', 'AGM'], ['GEL', 'Gel'], ['OPzV', 'OPzV'], ['NMC', 'NMC']]], ['vNom', 'Tensión nominal (V)'], ['ah', 'Capacidad (Ah)'], ['kwh', 'Energía (kWh)'], ['dod', 'Profundidad de descarga (%)'], ['eff', 'Eficiencia ida y vuelta (%)'], ['cycles', 'Ciclos de vida'], ['iMax', 'Corriente máx. continua (A)'], ['life', 'Vida calendario (años)'], ['kg', 'Peso (kg)'], ['price', 'Precio unitario (COP)']]
  };
  async function editComponent(kind, id, done, asNew) {
    var p = Dz.project(), it = Dz.find(kind, id), isCustom = (p.catalog.custom[kind] || []).some(function (x) { return x.id === id; });
    var base = Dz.CATALOG[kind].find(function (x) { return x.id === id; });
    var html = '<p class="small muted">' + (asNew ? 'Nuevo componente basado en «' + U.esc(it.name) + '». Ingrese los datos de la ficha técnica del fabricante.' : isCustom ? 'Componente personalizado.' : 'Los cambios se guardan como ajuste local del catálogo (puede restablecerlos).') + '</p><div class="form-grid">' +
      FIELDS[kind].map(function (fd) {
        var v = asNew && fd[0] === 'name' ? it.name + ' (personalizado)' : it[fd[0]];
        if (fd[2] === 's') return '<label class="f">' + fd[1] + '<select data-cf="' + fd[0] + '">' + fd[3].map(function (o) { return opt(o[0], o[1], v); }).join('') + '</select></label>';
        return '<label class="f">' + fd[1] + '<input ' + (fd[2] === 't' ? 'type="text"' : 'type="number" step="any"') + ' data-cf="' + fd[0] + '" value="' + U.esc(v == null ? '' : v) + '"></label>';
      }).join('') + '</div>';
    var btns = [{ label: 'Cancelar', value: null }];
    if (!asNew && !isCustom && p.catalog.overrides[id]) btns.push({ label: 'Restablecer ficha original', value: 'reset' });
    if (!asNew && isCustom) btns.push({ label: 'Eliminar', value: 'delete', cls: 'btn-danger' });
    btns.push({ label: asNew ? 'Agregar al catálogo' : 'Guardar', value: function (m) { var o = {}; U.$$('[data-cf]', m).forEach(function (x) { var k = x.getAttribute('data-cf'), fd = FIELDS[kind].find(function (q) { return q[0] === k; }); o[k] = fd[2] === 't' || (fd[2] === 's' && isNaN(+x.value)) ? x.value : +x.value; }); return o; }, cls: 'btn-primary' });
    var r = await U.modal({ title: (asNew ? 'Agregar ' : 'Editar ') + (kind === 'panels' ? 'módulo' : kind === 'inverters' ? 'inversor' : 'batería'), icon: '✎', html: html, wide: true, buttons: btns, cancelValue: null });
    if (!r) return;
    if (r === 'reset') { delete p.catalog.overrides[id]; }
    else if (r === 'delete') { p.catalog.custom[kind] = p.catalog.custom[kind].filter(function (x) { return x.id !== id; }); }
    else {
      if (kind === 'inverters' && !(r.batV > 0)) r.batV = null;
      var bad = Object.keys(r).filter(function (k) { return typeof r[k] === 'number' && !isFinite(r[k]); });
      if (bad.length) { U.toast('Valores numéricos no válidos: ' + bad.join(', '), 'warn'); return; }
      if (asNew) {
        var nid = 'u-' + kind.slice(0, 3) + '-' + Date.now().toString(36);
        p.catalog.custom[kind] = (p.catalog.custom[kind] || []).concat([Object.assign({}, it, r, { id: nid, custom: true })]);
        if (kind === 'panels') p.inputs.panel = nid; else if (kind === 'inverters') p.inputs.inverter = nid; else p.inputs.battery = nid;
      } else if (isCustom) {
        p.catalog.custom[kind] = p.catalog.custom[kind].map(function (x) { return x.id === id ? Object.assign({}, x, r) : x; });
      } else {
        var diff = {};
        Object.keys(r).forEach(function (k) { if (String(r[k]) !== String(base[k])) diff[k] = r[k]; });
        if (Object.keys(diff).length) p.catalog.overrides[id] = diff; else delete p.catalog.overrides[id];
      }
    }
    Dz.saveNow(); done();
  }

  /* =======================================================================
     COSTOS (presupuesto editable)
     ======================================================================= */
  V.costos = {
    render: async function (el) {
      await Dz.ready();
      var p = Dz.project(), c = Dz.final();
      var h = V.head('Resumen de costos editable', 'Presupuesto de todos los elementos del sistema —módulos, inversores, baterías, estructura, cableado, protecciones, puesta a tierra, canalización, mano de obra, ingeniería y trámites— con cantidades calculadas desde el diseño y precios referenciales editables. Todo se recalcula al instante.',
        '<button class="btn" data-go="diseno">🧩 ← Diseño</button><button class="btn" data-go="manual">📘 Manual →</button>');
      if (!c || !c.ok) { el.innerHTML = h + V.empty('💲', 'No hay un diseño válido', 'Diseñe el sistema para calcular el presupuesto.', '<button class="btn btn-primary" data-go="diseno">🧩 Diseñar el sistema</button>'); return; }
      var bom = c.bom, prm = bom.params, ec = c.econ, E = p.econ;
      h += '<div class="card no-print"><div class="btn-row"><div class="seg">' + ['COP', 'USD'].map(function (k) { return '<button class="seg-b' + (prm.currency === k ? ' on' : '') + '" data-cur="' + k + '">' + (k === 'COP' ? '$ COP' : 'US$ USD') + '</button>'; }).join('') + '</div>' +
        '<label class="f inline">TRM (COP/USD)<input type="number" data-cp="trm" value="' + prm.trm + '" step="0.01" style="width:120px"></label><span class="small muted">TRM oficial del ' + U.esc(prm.trmDate || '') + ': $ 3 192.53 (editable)</span>' +
        '<span style="flex:1"></span><button class="btn" id="co-xlsx">📊 Excel</button><button class="btn" id="co-csv">⬇ CSV</button><button class="btn" id="co-html">⬇ HTML</button><button class="btn btn-accent" id="co-print">🖨 Imprimir / PDF</button></div></div>';
      h += '<div class="grid g6 proj-kpis">' +
        V.kpi('Inversión total', Co.kpiMoney(bom.total, prm)[0], Co.kpiMoney(bom.total, prm)[1], Co.moneyAlt(bom.total, prm) + (prm.ley1715 ? ' · sin IVA (Ley 1715)' : ' · IVA incluido'), '', '💲') +
        V.kpi('Costo por vatio', money(ec.perWp), '/Wp', f(c.kwp, 2) + ' kWp' + (c.bank ? ' + ' + f(c.bank.kwh, 1) + ' kWh' : ''), '', '▦') +
        V.kpi('LCOE', money(ec.lcoe), '/kWh', ec.years + ' años · tasa ' + E.rate + ' %', '', '⚖') +
        V.kpi('Recuperación simple', isFinite(ec.payback) ? f(ec.payback, 1) : '> ' + ec.years, 'años', 'Ahorro año 1 ' + money(ec.savings1), '', '⏳') +
        V.kpi('VPN', Co.kpiMoney(ec.npv, prm)[0], Co.kpiMoney(ec.npv, prm)[1], 'Tasa de descuento ' + E.rate + ' %', '', '📊') +
        V.kpi('TIR', isFinite(ec.irr) ? f(ec.irr * 100, 1) : '—', '%', 'Proyecto a ' + ec.years + ' años', '', '📈') + '</div>';
      /* tabla editable */
      var groups = {};
      bom.items.forEach(function (it, i) { (groups[it.cat] = groups[it.cat] || []).push({ it: it, i: i }); });
      var cats = Co.CATS.filter(function (k) { return groups[k]; }).concat(Object.keys(groups).filter(function (k) { return Co.CATS.indexOf(k) < 0; }));
      var tb = '<div class="table-wrap"><table class="t cost-t"><thead><tr><th>Ítem</th><th>Especificación técnica</th><th>Und.</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th class="n">Total</th><th></th></tr></thead><tbody>';
      cats.forEach(function (k) {
        var g = bom.groups[k];
        tb += '<tr class="grp"><td colspan="5">' + U.esc(k) + '</td><td class="n">' + money(g.total) + '</td><td></td></tr>';
        groups[k].forEach(function (x) {
          var it = x.it, pr = prm.currency === 'USD' ? Math.round(it.price / prm.trm * 100) / 100 : it.price;
          tb += '<tr class="' + (it.off ? 'off' : '') + (it.custom ? ' cust' : '') + '"><td>' + U.esc(it.desc) + (it.custom ? ' <span class="tag">agregado</span>' : '') + '</td><td class="small">' + U.esc(it.spec || '') + '</td><td>' + U.esc(it.unit) + '</td>' +
            '<td class="n"><input type="number" class="ci' + (it.editedQty ? ' ed' : '') + '" data-cq="' + U.esc(it.id) + '" value="' + it.qty + '" min="0" step="any"></td>' +
            '<td class="n"><input type="number" class="ci' + (it.editedPrice ? ' ed' : '') + '" data-cpr="' + U.esc(it.id) + '" value="' + pr + '" min="0" step="any"></td>' +
            '<td class="n"><b>' + money(it.total) + '</b></td><td class="nowrap">' + (it.editedQty || it.editedPrice ? '<button class="icon-btn sm" data-crst="' + U.esc(it.id) + '" title="Restablecer valores calculados">↺</button>' : '') +
            (it.custom ? '<button class="icon-btn sm" data-cdel="' + U.esc(it.id) + '" title="Eliminar partida">✕</button>' : '<button class="icon-btn sm" data-coff="' + U.esc(it.id) + '" title="' + (it.off ? 'Incluir' : 'Excluir del presupuesto') + '">' + (it.off ? '⊕' : '⊘') + '</button>') + '</td></tr>';
        });
      });
      tb += '</tbody></table></div>';
      var sumRows = [['Equipos y materiales', money(bom.equipment)], ['Servicios (mano de obra, ingeniería, trámites, logística)', money(bom.services)], ['<b>Subtotal</b>', '<b>' + money(bom.subtotal) + '</b>'], ['Contingencia (' + prm.contPct + ' %)', money(bom.contingency)]];
      if (+prm.aiuPct) sumRows.push(['AIU / margen del contratista (' + prm.aiuPct + ' %)', money(bom.aiu)]);
      sumRows.push(['Base gravable', money(bom.base)], [prm.ley1715 ? 'IVA excluido (Ley 1715) — ahorro ' + money(bom.ivaSaved) : 'IVA (' + prm.ivaPct + ' %)', money(bom.iva)], ['<b>TOTAL</b>', '<b class="big-total">' + money(bom.total) + '</b>']);
      h += '<div class="grid cost-grid"><div class="card"><div class="card-head"><h3>🧾 Presupuesto detallado</h3><span class="card-sub">' + bom.items.length + ' partidas · edite cantidades y precios (sin IVA)</span><div class="ch-actions"><button class="btn btn-sm" id="co-add">＋ Partida</button><button class="btn btn-sm btn-ghost" id="co-rstall">↺ Todo calculado</button></div></div>' + tb + '</div>' +
        '<div class="cost-side"><div class="card"><div class="card-head"><h3>Σ Resumen</h3></div>' + U.table(['Concepto', 'Valor'], sumRows, { numCols: [1], compact: true }) +
        '<div class="form-grid" style="grid-template-columns:1fr 1fr;margin-top:12px">' +
        '<label class="f">Contingencia (%)<input type="number" data-cp="contPct" value="' + prm.contPct + '" min="0" max="50" step="0.5"></label>' +
        '<label class="f">AIU / margen (%)<input type="number" data-cp="aiuPct" value="' + prm.aiuPct + '" min="0" max="60" step="0.5"></label>' +
        '<label class="f">IVA (%)<input type="number" data-cp="ivaPct" value="' + prm.ivaPct + '" min="0" max="30" step="0.5"></label>' +
        '<label class="check" style="align-self:end"><input type="checkbox" data-cp="ley1715"' + (prm.ley1715 ? ' checked' : '') + '><span>Exclusión de IVA Ley 1715<span class="cdesc">Requiere certificación UPME</span></span></label></div></div>' +
        '<div class="card"><div class="card-head"><h3>📈 Parámetros económicos</h3></div><div class="form-grid" style="grid-template-columns:1fr 1fr">' +
        (c.sysType === 'aislado' ? '<label class="f">Costo energía alternativa (COP/kWh)<input type="number" data-ce="altCost" value="' + E.altCost + '" step="10"><span class="hint">Diésel u otra fuente evitada</span></label>' : '<label class="f">Tarifa de energía (COP/kWh)<input type="number" data-ce="tariff" value="' + E.tariff + '" step="10"></label><label class="f">Valor excedentes (% tarifa)<input type="number" data-ce="exportRatio" value="' + E.exportRatio + '" min="0" max="100" step="5"></label>') +
        '<label class="f">O&amp;M anual (% CAPEX)<input type="number" data-ce="omPct" value="' + E.omPct + '" step="0.1" min="0"></label><label class="f">Tasa de descuento (%)<input type="number" data-ce="rate" value="' + E.rate + '" step="0.5" min="0"></label>' +
        '<label class="f">Escalamiento tarifa (%/año)<input type="number" data-ce="escal" value="' + E.escal + '" step="0.5"></label><label class="f">Vida del proyecto (años)<input type="number" data-ce="years" value="' + E.years + '" min="5" max="40" step="1"></label>' +
        '<label class="f">Reposición inversor (año)<input type="number" data-ce="invRepl" value="' + E.invRepl + '" min="5" max="30" step="1"></label></div>' +
        '<p class="small muted" style="margin:8px 0 0">Reposiciones: inversor en el año ' + ec.invYear + ' (' + money(ec.invRepl) + ')' + (c.bank ? '; baterías cada ' + ec.batLife + ' años (' + money(ec.batRepl) + ')' : '') + ', a 70 % del precio actual.</p></div></div></div>';
      h += '<div class="grid g2">' + C.card('co-cats', 'Distribución de la inversión', 'Por categoría (antes de contingencia e IVA)', 340) + C.card('co-cash', 'Flujo de caja acumulado', 'Ahorros − O&M − reposiciones; año 0 = inversión', 340) + '</div>';
      h += '<div class="card"><h3>Notas sobre los precios</h3><ul class="small"><li>Precios <b>referenciales</b> en pesos colombianos de 2026, sin IVA, de distribuidores e instaladores en Colombia y del mercado internacional (módulos TOPCon ≈ US$ 0.11/W FOB China; baterías LFP 51.2 V 5–10 kWh ≈ $ 0.6–0.9 millones COP/kWh al detal). Reemplácelos por sus cotizaciones.</li><li>Rango de referencia de sistemas conectados a la red en Colombia (2026): $ 3.5–5 millones COP por kWp instalado; los sistemas con baterías cuestan 30–50 % más.</li><li>Ley 1715 de 2014 (modificada por la Ley 2099 de 2021): exclusión de IVA, exención de aranceles, deducción de renta de hasta el 50 % de la inversión y depreciación acelerada, sujetos a certificación de la UPME.</li><li>Conductores dimensionados por ampacidad (NTC 2050 Tabla 310.15(B)(16)), factor de temperatura y caída de tensión; protecciones en tamaños normalizados. Verifique con el diseño de detalle.</li></ul></div>';
      el.innerHTML = h;
      /* gráficos */
      var gk = cats.filter(function (k) { return bom.groups[k].total > 0; }).sort(function (a, b) { return bom.groups[b].total - bom.groups[a].total; });
      C.mount(U.$('#co-cats'), { type: 'bar', horizontal: true, categories: gk, catLabel: 'Categoría', unit: prm.currency, valueFmt: function (v) { return money(v); }, series: [{ name: 'Costo', values: gk.map(function (k) { return prm.currency === 'USD' ? bom.groups[k].total / prm.trm : bom.groups[k].total; }), color: 3 }], showValues: false });
      var cash = ec.cash;
      C.mount(U.$('#co-cash'), { type: 'line', categories: cash.map(function (x) { return 'Año ' + x.y; }), yLabel: prm.currency === 'USD' ? 'Millones US$' : 'Millones COP', zero: false, series: [{ name: 'Flujo acumulado', y: cash.map(function (x) { return (prm.currency === 'USD' ? x.cum / prm.trm : x.cum) / 1e6; }), color: 2, markers: true, fill: false }], refLines: [{ axis: 'y', value: 0, label: 'Punto de equilibrio', color: 'muted' }] });
      bindCosts(el, c);
    }
  };
  function bindCosts(el, c) {
    var p = Dz.project(), ov = p.costs.overrides, prm = Co.params();
    var rerender = function () { Dz.invalidate(); Dz.saveNow(); keepScroll(function () { V.costos.render(el); }); };
    U.$$('[data-cur]', el).forEach(function (b) { b.onclick = function () { p.costs.params = Object.assign({}, p.costs.params, { currency: b.getAttribute('data-cur') }); rerender(); }; });
    U.$$('[data-cp]', el).forEach(function (x) {
      x.onchange = function () { var k = x.getAttribute('data-cp'); p.costs.params = Object.assign({}, p.costs.params); p.costs.params[k] = x.type === 'checkbox' ? x.checked : +x.value; rerender(); };
    });
    U.$$('[data-ce]', el).forEach(function (x) { x.onchange = function () { p.econ[x.getAttribute('data-ce')] = +x.value; rerender(); }; });
    function findItem(id) { return c.bom.items.find(function (i) { return i.id === id; }); }
    U.$$('[data-cq]', el).forEach(function (x) {
      x.onchange = function () {
        var id = x.getAttribute('data-cq'), it = findItem(id), v = +x.value;
        if (!(v >= 0)) { x.value = it.qty; return; }
        if (it.custom) p.costs.custom = p.costs.custom.map(function (q) { return q.id === id ? Object.assign({}, q, { qty: v }) : q; });
        else { ov[id] = Object.assign({}, ov[id]); if (Math.abs(v - it.calcQty) < 1e-9) delete ov[id].qty; else ov[id].qty = v; }
        rerender();
      };
    });
    U.$$('[data-cpr]', el).forEach(function (x) {
      x.onchange = function () {
        var id = x.getAttribute('data-cpr'), it = findItem(id), v = +x.value;
        if (!(v >= 0)) return;
        var cop = prm.currency === 'USD' ? Math.round(v * prm.trm) : v;
        if (it.custom) p.costs.custom = p.costs.custom.map(function (q) { return q.id === id ? Object.assign({}, q, { price: cop }) : q; });
        else if (id === 'mod' || id === 'inv' || id === 'bat') {
          /* el precio de los equipos principales se guarda en el catálogo (lo usa también el optimizador) */
          var comp = id === 'mod' ? c.panel : id === 'inv' ? c.inv : c.bat, kind = id === 'mod' ? 'panels' : id === 'inv' ? 'inverters' : 'batteries';
          var isCustom = (p.catalog.custom[kind] || []).some(function (q) { return q.id === comp.id; });
          if (isCustom) p.catalog.custom[kind] = p.catalog.custom[kind].map(function (q) { return q.id === comp.id ? Object.assign({}, q, { price: cop }) : q; });
          else p.catalog.overrides[comp.id] = Object.assign({}, p.catalog.overrides[comp.id], { price: cop });
        } else { ov[id] = Object.assign({}, ov[id]); if (Math.abs(cop - it.calcPrice) < 0.5) delete ov[id].price; else ov[id].price = cop; }
        rerender();
      };
    });
    U.$$('[data-crst]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-crst'); delete ov[id]; if (id === 'mod' || id === 'inv' || id === 'bat') { var comp = id === 'mod' ? c.panel : id === 'inv' ? c.inv : c.bat; if (p.catalog.overrides[comp.id]) delete p.catalog.overrides[comp.id].price; } rerender(); }; });
    U.$$('[data-coff]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-coff'); ov[id] = Object.assign({}, ov[id]); ov[id].off = !ov[id].off; if (!ov[id].off) delete ov[id].off; rerender(); }; });
    U.$$('[data-cdel]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-cdel'); p.costs.custom = p.costs.custom.filter(function (q) { return q.id !== id; }); rerender(); }; });
    U.$('#co-rstall', el).onclick = async function () { if (!(await U.confirm('Restablecer presupuesto', '<p>Se eliminan las cantidades y precios editados de las partidas (los precios del catálogo de equipos y las partidas agregadas se conservan).</p>', 'Restablecer'))) return; p.costs.overrides = {}; rerender(); };
    U.$('#co-add', el).onclick = async function () {
      var r = await U.modal({
        title: 'Agregar partida', icon: '＋', buttons: [{ label: 'Cancelar', value: null }, { label: 'Agregar', cls: 'btn-primary', value: function (m) { return { cat: U.$('#na-cat', m).value, desc: U.$('#na-desc', m).value.trim(), spec: U.$('#na-spec', m).value.trim(), unit: U.$('#na-unit', m).value.trim() || 'und', qty: +U.$('#na-qty', m).value, price: +U.$('#na-price', m).value, eq: U.$('#na-eq', m).checked }; } }], cancelValue: null,
        html: '<div class="form-grid"><label class="f">Categoría<select id="na-cat">' + Co.CATS.map(function (k) { return opt(k, k, 'Otros'); }).join('') + '</select></label><label class="f" style="grid-column:span 2">Descripción<input type="text" id="na-desc" placeholder="p. ej. Generador diésel de respaldo 10 kVA"></label>' +
          '<label class="f" style="grid-column:1/-1">Especificación técnica<input type="text" id="na-spec"></label><label class="f">Unidad<input type="text" id="na-unit" value="und"></label><label class="f">Cantidad<input type="number" id="na-qty" value="1" min="0" step="any"></label><label class="f">Precio unitario (COP, sin IVA)<input type="number" id="na-price" value="0" min="0" step="any"></label>' +
          '<label class="check"><input type="checkbox" id="na-eq" checked><span>Es equipo o material<span class="cdesc">Desmarque para servicios</span></span></label></div>'
      });
      if (!r || !r.desc) return;
      p.costs.custom = (p.costs.custom || []).concat([Object.assign({ id: 'x-' + Date.now().toString(36) }, r)]);
      rerender();
    };
    U.$('#co-csv', el).onclick = function () { U.download('SEGAR_presupuesto_' + f(c.kwp, 1) + 'kWp.csv', V.costCSV(c), 'text/csv;charset=utf-8'); };
    U.$('#co-xlsx', el).onclick = function () { V.costExcel(c); };
    U.$('#co-html', el).onclick = function () { U.download('SEGAR_presupuesto_' + f(c.kwp, 1) + 'kWp.html', V.costDoc(c, true), 'text/html;charset=utf-8'); };
    U.$('#co-print', el).onclick = function () { V.printHTML(V.costDoc(c, true)); };
  }
  V.costCSV = function (c) {
    var b = c.bom, rows = b.items.map(function (it) { return [it.cat, it.desc, it.spec || '', it.unit, it.qty, it.price, it.total, it.off ? 'excluido' : '']; });
    rows.push([], ['', 'Subtotal', '', '', '', '', b.subtotal], ['', 'Contingencia', '', '', '', '', b.contingency], ['', 'AIU', '', '', '', '', b.aiu], ['', 'IVA', '', '', '', '', b.iva], ['', 'TOTAL (COP)', '', '', '', '', b.total], ['', 'TOTAL (USD)', '', '', '', '', Math.round(b.total / b.params.trm)]);
    return U.toCSV(['Categoría', 'Ítem', 'Especificación', 'Unidad', 'Cantidad', 'Precio unitario COP', 'Total COP', 'Nota'], rows);
  };
  V.costExcel = function (c) {
    if (!window.XLSX) { U.toast('Librería de Excel no disponible; use CSV.', 'warn'); return; }
    var X = window.XLSX, wb = X.utils.book_new(), b = c.bom, ec = c.econ, p = Dz.project();
    var s1 = [['Categoría', 'Ítem', 'Especificación', 'Unidad', 'Cantidad', 'Precio unitario (COP)', 'Total (COP)']].concat(b.items.filter(function (i) { return !i.off; }).map(function (i) { return [i.cat, i.desc, i.spec || '', i.unit, i.qty, i.price, i.total]; }));
    s1.push([], ['', 'Subtotal', '', '', '', '', b.subtotal], ['', 'Contingencia ' + b.params.contPct + ' %', '', '', '', '', b.contingency], ['', 'AIU ' + b.params.aiuPct + ' %', '', '', '', '', b.aiu], ['', b.params.ley1715 ? 'IVA excluido (Ley 1715)' : 'IVA ' + b.params.ivaPct + ' %', '', '', '', '', b.iva], ['', 'TOTAL', '', '', '', '', b.total], ['', 'TOTAL USD (TRM ' + b.params.trm + ')', '', '', '', '', Math.round(b.total / b.params.trm)]);
    var ws1 = X.utils.aoa_to_sheet(s1); ws1['!cols'] = [{ wch: 26 }, { wch: 48 }, { wch: 60 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
    X.utils.book_append_sheet(wb, ws1, 'Presupuesto');
    var s2 = [['Parámetro', 'Valor']];
    specTables(c).forEach(function (t) { s2.push([t.title.replace(/^[^\wÁÉÍÓÚ]+/, '')]); t.rows.forEach(function (r) { s2.push([String(r[0]).replace(/<[^>]+>/g, ''), String(r[1]).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')]); }); });
    s2.push([], ['Sitio', p.site.place + ' (' + p.site.lat + ', ' + p.site.lon + ')'], ['Energía anual (kWh)', Math.round(c.sim.ac)], ['Rendimiento (kWh/kWp)', Math.round(c.sim.specYield)], ['PR', Math.round(c.sim.pr * 1000) / 10 + ' %'], ['Fracción solar', Math.round(c.sim.solarFrac * 1000) / 10 + ' %']);
    var ws2 = X.utils.aoa_to_sheet(s2); ws2['!cols'] = [{ wch: 34 }, { wch: 70 }];
    X.utils.book_append_sheet(wb, ws2, 'Ficha técnica');
    var s3 = [['Año', 'Energía útil (kWh)', 'Ahorros (COP)', 'O&M (COP)', 'Reposiciones (COP)', 'Flujo (COP)', 'Acumulado (COP)']].concat(ec.cash.map(function (x) { return [x.y, Math.round(x.energy), Math.round(x.savings), Math.round(x.om), Math.round(x.repl), Math.round(x.cf), Math.round(x.cum)]; }));
    s3.push([], ['LCOE (COP/kWh)', Math.round(ec.lcoe)], ['VPN (COP)', Math.round(ec.npv)], ['TIR', isFinite(ec.irr) ? Math.round(ec.irr * 1000) / 10 + ' %' : '—'], ['Recuperación simple (años)', isFinite(ec.payback) ? Math.round(ec.payback * 10) / 10 : '—']);
    var ws3 = X.utils.aoa_to_sheet(s3); ws3['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    X.utils.book_append_sheet(wb, ws3, 'Flujo de caja');
    var out = X.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    U.download('SEGAR_presupuesto_' + f(c.kwp, 1) + 'kWp.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  V.costDoc = function (c, standalone) {
    var b = c.bom, ec = c.econ, p = Dz.project(), prm = b.params;
    var body = '<div class="report-doc"><div class="rc-top" style="font-size:9pt;letter-spacing:.2em;color:#6b7885;text-transform:uppercase">SEGAR SOLAR ENERGY DECISIÓN IA · Proyecto FV</div><h1>Presupuesto del sistema fotovoltaico</h1>' +
      '<p class="muted">' + U.esc(p.site.place || '') + ' · ' + WM.fmtLat(p.site.lat) + ', ' + WM.fmtLon(p.site.lon) + ' · ' + U.nowHuman() + '</p>' +
      '<div class="kpis"><div><span>Potencia</span><b>' + f(c.kwp, 2) + ' kWp</b></div><div><span>Almacenamiento</span><b>' + (c.bank ? f(c.bank.kwh, 1) + ' kWh' : '—') + '</b></div><div><span>Inversión total</span><b>' + money(b.total) + '</b></div><div><span>LCOE</span><b>' + money(ec.lcoe) + '/kWh</b></div></div>' +
      '<table class="rt"><thead><tr><th>Ítem</th><th>Especificación</th><th class="n">Cant.</th><th class="n">Precio unit.</th><th class="n">Total</th></tr></thead><tbody>' +
      b.items.filter(function (i) { return !i.off; }).map(function (i) { return '<tr><td>' + U.esc(i.desc) + '<br><span class="muted" style="font-size:8pt">' + U.esc(i.cat) + '</span></td><td style="font-size:8.4pt">' + U.esc(i.spec || '') + '</td><td class="n">' + U.fmt(i.qty, i.qty % 1 ? 1 : 0) + ' ' + U.esc(i.unit) + '</td><td class="n">' + money(i.price) + '</td><td class="n">' + money(i.total) + '</td></tr>'; }).join('') +
      '</tbody></table><table class="rt" style="max-width:110mm;margin-left:auto"><tbody><tr><td>Subtotal</td><td class="n">' + money(b.subtotal) + '</td></tr><tr><td>Contingencia (' + prm.contPct + ' %)</td><td class="n">' + money(b.contingency) + '</td></tr>' + (+prm.aiuPct ? '<tr><td>AIU (' + prm.aiuPct + ' %)</td><td class="n">' + money(b.aiu) + '</td></tr>' : '') +
      '<tr><td>' + (prm.ley1715 ? 'IVA excluido (Ley 1715)' : 'IVA (' + prm.ivaPct + ' %)') + '</td><td class="n">' + money(b.iva) + '</td></tr><tr><td><b>TOTAL</b></td><td class="n"><b>' + money(b.total) + '</b><br><span class="muted">' + Co.moneyAlt(b.total, prm) + '</span></td></tr></tbody></table>' +
      '<h2>Evaluación económica</h2><p>LCOE ' + money(ec.lcoe) + '/kWh · VPN ' + money(ec.npv) + ' · TIR ' + (isFinite(ec.irr) ? f(ec.irr * 100, 1) + ' %' : '—') + ' · recuperación simple ' + (isFinite(ec.payback) ? f(ec.payback, 1) + ' años' : '> ' + ec.years + ' años') + ' (tarifa/valor de referencia ' + money(ec.price) + '/kWh, O&M ' + p.econ.omPct + ' %/año, tasa ' + p.econ.rate + ' %).</p>' +
      '<p class="muted" style="font-size:8.6pt">Precios referenciales editables (COP 2026, sin IVA). TRM ' + prm.trm + ' COP/USD. Documento generado por SEGAR SOLAR ENERGY DECISIÓN IA; no constituye una oferta comercial.</p></div>';
    if (!standalone) return body;
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto — SEGAR</title><style>@page{size:A4;margin:14mm 12mm}body{margin:0;background:#e6e9ed;padding:20px}@media print{body{background:#fff;padding:0}}\n' + (SEDA.Report ? SEDA.Report.CSS : '') + '</style></head><body>' + body + '</body></html>';
  };
  /* Imprime un documento HTML autónomo mediante un iframe oculto (sin ventanas emergentes) */
  V.printHTML = function (html) {
    var fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    var d = fr.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { U.toast('No se pudo abrir la impresión: descargue el HTML e imprímalo.', 'warn'); } setTimeout(function () { fr.remove(); }, 2000); }, 350);
  };

  /* =======================================================================
     MANUAL DE INSTALACIÓN
     ======================================================================= */
  V.manual = {
    render: async function (el) {
      await Dz.ready();
      SEDA.Manual.injectStyles();
      var c = Dz.final();
      var h = V.head('Manual de instalación', 'Documento de obra generado para el diseño actual: seguridad, estructura, cadenas con tensiones y corrientes esperadas, protecciones y conductores, inversor, baterías, puesta a tierra, señalización, puesta en servicio IEC 62446-1, protocolo de pruebas, mantenimiento y solución de problemas.',
        '<button class="btn" data-go="costos">💲 ← Costos</button>');
      if (!c || !c.ok) { el.innerHTML = h + V.empty('📘', 'No hay un diseño válido', 'Diseñe el sistema para generar el manual.', '<button class="btn btn-primary" data-go="diseno">🧩 Diseñar el sistema</button>'); return; }
      h += '<div class="card no-print"><div class="btn-row"><button class="btn btn-accent btn-lg" id="ma-print">🖨 IMPRIMIR / GUARDAR COMO PDF</button><button class="btn" id="ma-html">⬇ DESCARGAR MANUAL HTML</button><button class="btn" data-go="diseno">🧩 Ajustar diseño</button></div>' +
        '<p class="small muted" style="margin:10px 0 0">El manual se regenera automáticamente cuando cambia el diseño o el presupuesto. Revise y ajuste con los manuales de los fabricantes antes de usarlo en obra.</p></div>';
      h += '<div class="report-frame" id="ma-frame">' + SEDA.Manual.build(c) + '</div>';
      el.innerHTML = h;
      U.$('#ma-print', el).onclick = function () { window.print(); };
      U.$('#ma-html', el).onclick = function () { U.download('SEGAR_manual_instalacion_' + f(c.kwp, 1) + 'kWp.html', SEDA.Manual.standalone(c), 'text/html;charset=utf-8'); };
    }
  };
})();
