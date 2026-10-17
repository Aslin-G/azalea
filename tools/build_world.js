/* ==========================================================================
   build_world.js — Genera js/data/world.js (mapa mundial offline) a partir de
   Natural Earth 1:50m (paquete npm "world-atlas", dominio público) con
   nombres de países en español (paquete "i18n-iso-countries", MIT).

   Uso (solo para regenerar el archivo; la aplicación NO necesita Node):
     npm install world-atlas@2 topojson-client@3 i18n-iso-countries@7
     node tools/build_world.js [ruta/node_modules]

   Formato de salida (compacto, cuantizado a 0.01°):
     SEDA_WORLD = { q: 100, c: [ [nombre, iso2, [minLon,minLat,maxLon,maxLat], [anillo, ...]], ... ] }
     cada anillo = [lon0, lat0, dLon1, dLat1, dLon2, dLat2, ...] en centésimas de grado.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const nm = process.argv[2] || path.join(process.cwd(), 'node_modules');
const topo = require(path.join(nm, 'world-atlas/countries-50m.json'));
const topojson = require(path.join(nm, 'topojson-client'));
const iso = require(path.join(nm, 'i18n-iso-countries'));
iso.registerLocale(require(path.join(nm, 'i18n-iso-countries/langs/es.json')));

const TOL = 0.02;             // tolerancia Douglas-Peucker (grados)
const MIN_AREA = 0.02;        // descarta islas muy pequeñas (grados²) salvo que el país sea pequeño
const Q = 100;

function sqSegDist(p, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}
function dp(points, tol) {
  const sq = tol * tol, keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [f, l] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = f + 1; i < l; i++) { const d = sqSegDist(points[i], points[f], points[l]); if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > sq) { keep[idx] = 1; stack.push([f, idx], [idx, l]); }
  }
  return points.filter((_, i) => keep[i]);
}
function area(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); }

const geo = topojson.feature(topo, topo.objects.countries);
const out = [];
let pts = 0;
for (const f of geo.features) {
  const num = f.id;
  const a2 = num ? iso.numericToAlpha2(num) : null;
  let name = (a2 && iso.getName(a2, 'es')) || f.properties.name;
  if (!name) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const areas = polys.map(p => area(p[0]));
  const maxA = Math.max(...areas);
  const rings = [];
  let bb = [180, 90, -180, -90];
  polys.forEach((p, pi) => {
    if (areas[pi] < MIN_AREA && areas[pi] < maxA * 0.5) return;
    const outer = p[0];                                 // solo el anillo exterior (suficiente a esta escala)
    let s = dp(outer, areas[pi] < 1 ? TOL / 3 : TOL);
    if (s.length < 4) s = outer;
    const enc = [];
    let px = 0, py = 0;
    s.forEach((c, i) => {
      const x = Math.round(c[0] * Q), y = Math.round(c[1] * Q);
      if (i === 0) enc.push(x, y); else { if (x === px && y === py) return; enc.push(x - px, y - py); }
      px = x; py = y;
      bb = [Math.min(bb[0], c[0]), Math.min(bb[1], c[1]), Math.max(bb[2], c[0]), Math.max(bb[3], c[1])];
    });
    pts += enc.length / 2;
    rings.push(enc);
  });
  if (!rings.length) continue;
  out.push([name, a2 || '', bb.map(v => Math.round(v * 100) / 100), rings]);
}
out.sort((a, b) => a[0].localeCompare(b[0], 'es'));
const header = '/* Mapa mundial offline — Natural Earth 1:50m (dominio público) vía world-atlas; nombres en español: i18n-iso-countries (MIT).\n   Generado por tools/build_world.js. ' + out.length + ' países, ' + pts + ' vértices. No editar a mano. */\n';
const js = header + 'window.SEDA_WORLD={q:' + Q + ',c:' + JSON.stringify(out) + '};\n';
const dest = path.join(__dirname, '..', 'js', 'data', 'world.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, js);
console.log('OK', dest, (js.length / 1024).toFixed(0) + ' KB', out.length, 'países', pts, 'vértices');
