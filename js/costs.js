/* ==========================================================================
   costs.js — Ingeniería eléctrica y PRESUPUESTO EDITABLE (SEDA.Costs).
   - Conductores: ampacidad NTC 2050 (NFPA 70) Tabla 310.15(B)(16) cobre,
     factores de temperatura 310.15(B)(2)(a), caída de tensión con R a 75 °C,
     corrientes de diseño FV 690.8 (1.25 × 1.25 × Isc), fusibles de cadena
     690.9, conductor de puesta a tierra de equipos por Tabla 250.122.
   - Protecciones: fusibles gPV, seccionador DC, DPS DC/AC tipo 2,
     interruptores AC y de batería en tamaños normalizados.
   - Presupuesto: cantidades calculadas desde el diseño y precios
     referenciales en COP (2026, sin IVA) totalmente editables; contingencia,
     AIU, IVA 19 % y exclusión por Ley 1715/2014 (mod. Ley 2099/2021).
   - Economía: LCOE, VPN, TIR y recuperación simple con degradación,
     escalamiento de tarifa, O&M y reposición de inversores y baterías.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U;
  var Co = SEDA.Costs = {};

  /* AWG/kcmil, mm², A (75 °C), A (90 °C), Ω/km a 75 °C, sección métrica comercial equivalente */
  Co.COND = [
    ['14', 2.08, 20, 25, 10.3, 2.5], ['12', 3.31, 25, 30, 6.50, 4], ['10', 5.26, 35, 40, 4.07, 6], ['8', 8.37, 50, 55, 2.55, 10], ['6', 13.3, 65, 75, 1.61, 16],
    ['4', 21.2, 85, 95, 1.01, 25], ['3', 26.7, 100, 115, 0.804, 25], ['2', 33.6, 115, 130, 0.636, 35], ['1', 42.4, 130, 145, 0.505, 50], ['1/0', 53.5, 150, 170, 0.400, 50],
    ['2/0', 67.4, 175, 195, 0.317, 70], ['3/0', 85.0, 200, 225, 0.251, 95], ['4/0', 107, 230, 260, 0.199, 120], ['250', 127, 255, 290, 0.169, 120], ['300', 152, 285, 320, 0.141, 150],
    ['350', 177, 310, 350, 0.120, 185], ['500', 253, 380, 430, 0.0846, 240]
  ].map(function (r) { return { awg: r[0], mm2: r[1], a75: r[2], a90: r[3], r: r[4], iec: r[5] }; });
  Co.awgLabel = function (c) { return (/^\d{3}$/.test(c.awg) ? c.awg + ' kcmil' : c.awg + ' AWG') + ' (' + c.iec + ' mm²)'; };
  /* Factor de corrección por temperatura ambiente (base 30 °C) */
  Co.tempFactor = function (t, col) {
    var T90 = [[35, 0.96], [40, 0.91], [45, 0.87], [50, 0.82], [55, 0.76], [60, 0.71], [65, 0.65], [70, 0.58]];
    var T75 = [[35, 0.94], [40, 0.88], [45, 0.82], [50, 0.75], [55, 0.67], [60, 0.58], [65, 0.47], [70, 0.33]];
    if (t <= 30) return 1;
    var tb = col === 'a90' ? T90 : T75;
    for (var i = 0; i < tb.length; i++) if (t <= tb[i][0]) return tb[i][1];
    return tb[tb.length - 1][1];
  };
  Co.FUSES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 32, 35, 40, 45, 50, 60, 63, 70, 80, 90, 100, 110, 125, 150, 160, 175, 200, 225, 250, 300, 315, 350, 400, 450, 500, 600, 630, 700, 800];
  Co.BREAKERS = [6, 10, 15, 16, 20, 25, 30, 32, 40, 50, 63, 70, 80, 100, 125, 150, 160, 175, 200, 225, 250, 300, 350, 400, 500, 600, 630, 800];
  function nextStd(list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v - 1e-9) return list[i]; return list[list.length - 1]; }
  Co.nextFuse = function (v) { return nextStd(Co.FUSES, v); };
  Co.nextBreaker = function (v) { return nextStd(Co.BREAKERS, v); };
  /* Conductor de puesta a tierra de equipos (Tabla 250.122, cobre) */
  Co.egc = function (ocpd) {
    var t = [[15, '14'], [20, '12'], [60, '10'], [100, '8'], [200, '6'], [300, '4'], [400, '3'], [500, '2'], [600, '1'], [800, '1/0'], [1000, '2/0'], [1200, '3/0']];
    for (var i = 0; i < t.length; i++) if (ocpd <= t[i][0]) return t[i][1];
    return '4/0';
  };
  Co.cond = function (awg) { for (var i = 0; i < Co.COND.length; i++) if (Co.COND[i].awg === awg) return Co.COND[i]; return null; };
  function idx(awg) { for (var i = 0; i < Co.COND.length; i++) if (Co.COND[i].awg === awg) return i; return 0; }
  /* Selección de conductor: ampacidad corregida ≥ I diseño, ampacidad ≥ protección y caída ≤ límite.
     o: {iCont (A continua), iDesign (A para ampacidad), ocpd, L (m, un sentido), V, drop (%), phases (1|3), col ('a75'|'a90'), tAmb, minAwg} */
  Co.size = function (o) {
    var cf = Co.tempFactor(o.tAmb || 30, o.col), start = idx(o.minAwg || '14'), k = o.phases === 3 ? Math.sqrt(3) : 2;
    for (var i = start; i < Co.COND.length; i++) {
      var c = Co.COND[i], amp = c[o.col] * cf;
      if (amp < o.iDesign) continue;
      if (o.ocpd && c.a75 < o.ocpd && !(o.ocpd > 800)) continue;
      /* regla de conductores pequeños 240.4(D) */
      if (o.ocpd && ((c.awg === '14' && o.ocpd > 15) || (c.awg === '12' && o.ocpd > 20) || (c.awg === '10' && o.ocpd > 30))) continue;
      var dv = k * o.L * o.iCont * c.r / 1000, pct = dv / o.V * 100;
      if (pct > o.drop && i < Co.COND.length - 1) continue;
      return { c: c, amp: amp, cf: cf, dv: dv, dropPct: pct, par: 1, label: Co.awgLabel(c), awg: c.awg, mm2: c.iec };
    }
    var last = Co.COND[Co.COND.length - 1];
    return { c: last, amp: last[o.col] * cf, cf: cf, dv: NaN, dropPct: NaN, par: 1, label: Co.awgLabel(last) + ' (verificar conductores en paralelo)', awg: last.awg, mm2: last.iec, overflow: true };
  };

  /* ---------------- Ingeniería eléctrica del diseño ---------------- */
  Co.electrical = function (cfg, inputs) {
    var p = cfg.panel, inv = cfg.inv, e = { notes: [] };
    var tRoof = (isFinite(cfg.tMax) ? cfg.tMax : 35) + 10;   /* cables expuestos en cubierta */
    var tRoom = isFinite(cfg.tMax) ? cfg.tMax : 35;
    var LDC = Math.max(1, +inputs.lenDC || 25), LAC = Math.max(1, +inputs.lenAC || 20), LBAT = Math.max(0.5, +inputs.lenBat || 3);
    if (inv.type === 'micro') {
      var Imax = p.isc * 1.25;
      e.dc = { micro: true, iMax: Imax, cable: { label: 'Cables del módulo (MC4) hasta el microinversor' }, disc: { rating: 0, volt: inv.vdcMax }, spd: 0, fuse: null, strings: cfg.nMods };
      e.dcLossPct = 0.3;
    } else {
      var isc = p.isc, iMaxStr = 1.25 * isc, iDesStr = 1.25 * iMaxStr;
      var needFuse = (cfg.perMppt - 1) * iMaxStr > p.maxFuse;
      var fuse = needFuse ? { rating: Math.min(Co.nextFuse(iDesStr), p.maxFuse >= Co.nextFuse(iDesStr) ? Co.nextFuse(iDesStr) : p.maxFuse), qty: cfg.np * 2, volt: cfg.vStrVocMax > 1000 ? 1500 : 1000 } : null;
      var vStr = cfg.ns * p.vmp;
      var cab = Co.size({ iCont: p.imp, iDesign: iDesStr, ocpd: fuse ? fuse.rating : 0, L: LDC, V: vStr, drop: 1.5, phases: 1, col: 'a90', tAmb: tRoof, minAwg: '12' });
      var perM = cfg.perMppt, iMain = perM * iMaxStr;
      var main = null;
      if (fuse) main = Co.size({ iCont: perM * p.imp, iDesign: 1.25 * iMain, ocpd: 0, L: 3, V: vStr, drop: 0.5, phases: 1, col: 'a90', tAmb: tRoom, minAwg: '10' });
      var discA = Co.nextBreaker(1.25 * iMain);
      var volt = cfg.vStrVocMax <= 600 ? 600 : cfg.vStrVocMax <= 1000 ? 1000 : 1500;
      e.dc = { iscStr: isc, iMaxStr: iMaxStr, iDesStr: iDesStr, cable: cab, cableMain: main, fuse: fuse, needFuse: needFuse, disc: { rating: discA, volt: volt, qty: cfg.nInv * inv.nMppt }, spd: volt, strings: cfg.np, perMppt: perM, iMppt: iMain };
      e.dcLossPct = Math.max(0.2, 0.6 * (cab.dropPct + (main ? main.dropPct : 0)));
      if (!needFuse) e.notes.push('Con ' + perM + ' cadena(s) por MPPT la corriente inversa posible (' + U.fmt((perM - 1) * iMaxStr, 1) + ' A) no supera la protección máxima del módulo (' + p.maxFuse + ' A): no se requieren fusibles de cadena (NTC 2050, 690.9).');
      else e.notes.push('Se requieren fusibles gPV de ' + fuse.rating + ' A en ambos polos de cada cadena: la corriente inversa posible (' + U.fmt((perM - 1) * iMaxStr, 1) + ' A) supera la protección máxima del módulo (' + p.maxFuse + ' A).');
    }
    /* AC por inversor */
    var k3 = inv.phases === 3 ? Math.sqrt(3) : 1, iAc = inv.pac / (inv.vAc * k3);
    var brk = Co.nextBreaker(1.25 * iAc);
    var ac = Co.size({ iCont: iAc, iDesign: 1.25 * iAc, ocpd: brk, L: LAC, V: inv.vAc, drop: 2, phases: inv.phases, col: 'a75', tAmb: tRoom, minAwg: '12' });
    var poles = inv.phases === 3 ? 3 : 2;
    e.ac = { iAc: iAc, breaker: { rating: brk, poles: poles }, cable: ac, conductors: inv.phases === 3 ? 4 : 2 };
    if (inv.type === 'micro') {
      /* ramal AC de microinversores: máx. unidades por ramal según protección de 20–25 A */
      var perBranch = Math.max(1, Math.floor(20 / 1.25 / iAc));
      var branches = Math.ceil(cfg.nInv / perBranch), iBr = Math.min(cfg.nInv, perBranch) * iAc;
      var brkB = Co.nextBreaker(1.25 * iBr);
      e.ac = { iAc: iBr, breaker: { rating: brkB, poles: 2 }, cable: Co.size({ iCont: iBr, iDesign: 1.25 * iBr, ocpd: brkB, L: LAC, V: inv.vAc, drop: 2, phases: 1, col: 'a75', tAmb: tRoom, minAwg: '12' }), conductors: 2, branches: branches, perBranch: perBranch };
      e.notes.push(branches + ' ramal(es) AC de hasta ' + perBranch + ' microinversores (' + U.fmt(iBr, 1) + ' A), cable troncal y tapones según el fabricante.');
    }
    var nFeed = inv.type === 'micro' ? e.ac.branches : cfg.nInv;
    if (nFeed > 1) {
      var iTot = inv.type === 'micro' ? cfg.nInv * iAc : cfg.nInv * iAc;
      var mb = Co.nextBreaker(1.25 * iTot);
      e.acMain = { iAc: iTot, breaker: { rating: mb, poles: poles }, cable: Co.size({ iCont: iTot, iDesign: 1.25 * iTot, ocpd: mb, L: 5, V: inv.vAc, drop: 1, phases: inv.phases, col: 'a75', tAmb: tRoom, minAwg: '10' }) };
      e.notes.push('Tablero de paralelo FV con interruptor general de ' + mb + ' A; verifique la regla del 120 % del barraje (NTC 2050, 705.12).');
    }
    /* batería */
    if (cfg.bank) {
      var b = cfg.bank, pInv = Math.min(inv.pac, cfg.peakKw * 1000 / cfg.nInv) , iB = Math.max(pInv / (b.vBank * 0.9), (inv.batIChg || 0) > 0 ? Math.min(inv.batIChg, b.pChgKw * 1000 / b.vBank / cfg.nInv) : 0);
      var ocpdB = Co.nextFuse(1.25 * iB);
      /* recinto de baterías: se recomienda climatizado (15–30 °C) */
      var cb = Co.size({ iCont: iB, iDesign: 1.25 * iB, ocpd: ocpdB, L: LBAT, V: b.vBank, drop: 1, phases: 1, col: 'a75', tAmb: 30, minAwg: '6' });
      e.bat = { i: iB, ocpd: ocpdB, cable: cb, link: Co.awgLabel(cb.c) };
      if (cb.overflow) e.notes.push('La corriente de batería requiere conductores en paralelo o barras: consulte al fabricante.');
    }
    /* puesta a tierra */
    var ocpdMax = Math.max(e.ac.breaker.rating, e.dc.fuse ? e.dc.fuse.rating : 20, e.bat ? e.bat.ocpd : 0);
    var egcAc = Co.egc(e.ac.breaker.rating), egcDc = Co.egc(e.dc.fuse ? e.dc.fuse.rating : Math.max(20, e.dc.iDesStr || 20));
    if (idx(egcDc) < idx('10')) egcDc = '10';
    e.gnd = { egcAc: egcAc, egcDc: egcDc, egcBat: e.bat ? Co.egc(e.bat.ocpd) : null, gec: '6', rod: 'varilla Cu 5/8" × 2.4 m', rods: cfg.kwp > 30 ? 2 : 1, egcLabel: egcDc + ' AWG DC / ' + egcAc + ' AWG AC', ocpdMax: ocpdMax };
    e.notes.push('Resistencia de puesta a tierra objetivo ≤ 25 Ω (valor de referencia RETIE para el neutro de acometida en BT); si hay sistema de protección contra rayos, ≤ 10 Ω. Si no se cumple, agregue electrodos.');
    return e;
  };

  /* ---------------- Precios referenciales (COP 2026, sin IVA) ---------------- */
  Co.PRICES = {
    cablePV: { '12': 3800, '10': 5200, '8': 8200, '6': 12500, '4': 19000, '3': 24000, '2': 29000, '1': 36000, '1/0': 44000, '2/0': 54000, '3/0': 68000, '4/0': 84000 },
    cableCu: { '14': 1900, '12': 2700, '10': 4200, '8': 6800, '6': 10500, '4': 16500, '3': 20500, '2': 25500, '1': 32000, '1/0': 39500, '2/0': 49000, '3/0': 61000, '4/0': 76000, '250': 92000, '300': 110000, '350': 128000, '500': 180000 },
    bareCu: { '14': 1500, '12': 2100, '10': 3300, '8': 5200, '6': 8300, '4': 13000, '3': 16500, '2': 20500, '1': 26000, '1/0': 32000, '2/0': 40000, '3/0': 50000, '4/0': 62000 },
    conduit: 14000, conduitBig: 24000, mc4: 14000, structTecho: 180000, structSuelo: 260000,
    combiner: 750000, fuse: 28000, fuseHolder: 22000, spdDC: 290000, spdDC1500: 380000, spdAC: 230000,
    board: 380000, boardExtra: 120000, busbar: 450000, rod: 95000, weld: 45000, gndBox: 70000,
    monitor: 450000, meter: 950000, labels: 180000,
    laborTecho: 450000, laborSuelo: 380000, laborBat: 60000, laborMin: 2500000, commission: 600000, commissionKwp: 30000,
    engPct: 4, engMin: 1500000, retie: [[10, 1800000], [100, 3500000], [1e9, 6500000]], connection: 1200000, transportPct: 2
  };
  Co.breakerPrice = function (a, poles) {
    var base = a <= 32 ? 85000 : a <= 63 ? 140000 : a <= 125 ? 420000 : a <= 250 ? 1150000 : a <= 400 ? 2100000 : 3600000;
    return Math.round(base * (poles >= 3 ? 1.45 : 1));
  };
  Co.discPrice = function (a) { return a <= 32 ? 420000 : a <= 63 ? 650000 : 980000; };
  Co.batOcpdPrice = function (a) { return a <= 125 ? 380000 : a <= 250 ? 650000 : a <= 400 ? 1100000 : 1800000; };
  Co.defaultParams = function () { return { contPct: 5, aiuPct: 0, ivaPct: 19, ley1715: false, trm: 3192.53, trmDate: '2026-09-22', currency: 'COP' }; };
  Co.params = function () { var p = SEDA.Design.project(); return Object.assign(Co.defaultParams(), p.costs.params || {}); };
  Co.CATS = ['Módulos FV', 'Inversores', 'Almacenamiento', 'Estructura y montaje', 'Cableado DC', 'Cableado AC', 'Cableado de baterías', 'Protecciones', 'Puesta a tierra', 'Canalización', 'Monitoreo, medición y señalización', 'Mano de obra y puesta en marcha', 'Ingeniería y trámites', 'Logística', 'Otros'];

  /* ---------------- Presupuesto (lista de materiales y servicios) ---------------- */
  Co.bom = function (cfg, inputs, opts) {
    opts = opts || {};
    var P = Co.PRICES, e = cfg.elec, inv = cfg.inv, pan = cfg.panel, items = [];
    var proj = SEDA.Design.project(), ov = (proj.costs && proj.costs.overrides) || {}, prm = Co.params();
    function add(id, cat, desc, spec, unit, qty, price, eq) {
      if (!(qty > 0)) return;
      items.push({ id: id, cat: cat, desc: desc, spec: spec, unit: unit, qty: qty, price: Math.round(price), eq: eq !== false, calcQty: qty, calcPrice: Math.round(price) });
    }
    var LDC = Math.max(1, +inputs.lenDC || 25), LAC = Math.max(1, +inputs.lenAC || 20), LBAT = Math.max(0.5, +inputs.lenBat || 3);
    add('mod', 'Módulos FV', pan.name, pan.pmax + ' Wp · ' + pan.tech + ' · Voc ' + pan.voc + ' V · Isc ' + pan.isc + ' A · η ' + pan.eff + ' %', 'und', cfg.nMods, pan.price);
    add('inv', 'Inversores', inv.name, U.fmt(inv.pac / 1000, 1) + ' kW · ' + inv.acLabel + ' · MPPT ' + inv.mpptMin + '–' + inv.mpptMax + ' V · ' + inv.nMppt + ' MPPT', 'und', cfg.nInv, inv.price);
    if (cfg.bank) add('bat', 'Almacenamiento', cfg.bat.name, cfg.bank.series + 's × ' + cfg.bank.par + 'p · ' + U.fmt(cfg.bank.vBank, 1) + ' V · ' + U.fmt(cfg.bank.kwh, 1) + ' kWh (útil ' + U.fmt(cfg.bank.usable, 1) + ' kWh)', 'und', cfg.bank.units, cfg.bat.price);
    var st = inputs.mount === 'suelo' ? P.structSuelo : P.structTecho;
    add('struct', 'Estructura y montaje', 'Estructura de aluminio ' + (inputs.mount === 'suelo' ? 'sobre suelo (hincado/zapatas)' : 'para cubierta') + ' con rieles, grapas y anclajes', 'Inclinación ' + U.fmt(cfg.tilt, 0) + '° · acimut ' + U.fmt(cfg.azimuth, 0) + '° · ' + cfg.nMods + ' módulos', 'módulo', cfg.nMods, st);
    if (!e.dc.micro) {
      add('mc4', 'Cableado DC', 'Conectores MC4 compatibles (par macho-hembra)', 'IP68 · 1500 V DC', 'par', cfg.np * 2 + 4, P.mc4);
      var pvp = P.cablePV[e.dc.cable.awg] || P.cablePV['10'];
      add('cab-dc', 'Cableado DC', 'Cable solar H1Z2Z2-K / PV Wire (rojo/negro)', e.dc.cable.label + ' · 90 °C · caída ' + U.fmt(e.dc.cable.dropPct, 2) + ' %', 'm', Math.ceil(2 * LDC * 1.1 * cfg.np), pvp);
      if (e.dc.cableMain) add('cab-dc-main', 'Cableado DC', 'Cable DC caja de combinación → inversor', e.dc.cableMain.label, 'm', Math.ceil(2 * 3 * 1.1 * cfg.nInv * inv.nMppt), P.cablePV[e.dc.cableMain.awg] || pvp);
      add('cab-egc-dc', 'Puesta a tierra', 'Conductor de tierra de equipos del arreglo (Cu verde/desnudo)', e.gnd.egcDc + ' AWG', 'm', Math.ceil(LDC * 1.2 * cfg.nInv), P.bareCu[e.gnd.egcDc] || 3300);
      if (e.dc.fuse) {
        add('comb', 'Protecciones', 'Caja de combinación DC IP65 con barras', (cfg.perMppt) + ' entradas por MPPT · ' + e.dc.fuse.volt + ' V DC', 'und', cfg.nInv, P.combiner);
        add('fuse', 'Protecciones', 'Fusible gPV 10×38 con portafusible', e.dc.fuse.rating + ' A · ' + e.dc.fuse.volt + ' V DC (ambos polos)', 'und', e.dc.fuse.qty, P.fuse + P.fuseHolder);
      }
      add('disc-dc', 'Protecciones', 'Seccionador DC bajo carga (' + (inv.dcSwitch ? 'externo, adicional al integrado' : 'externo') + ')', e.dc.disc.rating + ' A · ' + e.dc.disc.volt + ' V DC · 2 polos por MPPT', 'und', cfg.nInv, Co.discPrice(e.dc.disc.rating));
      add('spd-dc', 'Protecciones', 'DPS DC tipo 2 (fotovoltaico)', 'Ucpv ' + e.dc.spd + ' V · In 20 kA', 'und', cfg.nInv, e.dc.spd > 1000 ? P.spdDC1500 : P.spdDC);
    }
    var acQty = inv.type === 'micro' ? e.ac.branches : cfg.nInv;
    add('cab-ac', 'Cableado AC', 'Conductor Cu THHN/THWN-2 salida AC', e.ac.cable.label + ' · ' + e.ac.conductors + ' fases + neutro según red · caída ' + U.fmt(e.ac.cable.dropPct, 2) + ' %', 'm', Math.ceil(LAC * 1.1 * (e.ac.conductors + (inv.phases === 3 ? 0 : 1)) * acQty), P.cableCu[e.ac.cable.awg] || 4200);
    add('cab-egc-ac', 'Puesta a tierra', 'Conductor de tierra de equipos AC (verde)', e.gnd.egcAc + ' AWG', 'm', Math.ceil(LAC * 1.1 * acQty), P.cableCu[e.gnd.egcAc] || 2700);
    add('brk-ac', 'Protecciones', 'Interruptor termomagnético de salida del inversor', e.ac.breaker.poles + 'P · ' + e.ac.breaker.rating + ' A · ' + inv.acLabel, 'und', acQty, Co.breakerPrice(e.ac.breaker.rating, e.ac.breaker.poles));
    if (e.acMain) {
      add('brk-main', 'Protecciones', 'Interruptor general del tablero FV', e.acMain.breaker.poles + 'P · ' + e.acMain.breaker.rating + ' A', 'und', 1, Co.breakerPrice(e.acMain.breaker.rating, e.acMain.breaker.poles));
      add('cab-ac-main', 'Cableado AC', 'Alimentador tablero FV → tablero general', e.acMain.cable.label, 'm', Math.ceil(5 * 1.1 * (inv.phases === 3 ? 4 : 3)), P.cableCu[e.acMain.cable.awg] || 10500);
    }
    add('spd-ac', 'Protecciones', 'DPS AC tipo 2', 'Uc 275 V · In 20 kA · ' + (inv.phases === 3 ? '3P+N' : '1P+N/2P'), 'und', 1, P.spdAC);
    add('board', 'Protecciones', 'Tablero/gabinete FV metálico con barraje y señalización', 'IP54 · ' + (acQty > 1 ? acQty + ' circuitos' : '1 circuito'), 'und', 1, P.board + Math.max(0, acQty - 1) * P.boardExtra);
    if (cfg.bank) {
      var b = cfg.bank, bat = e.bat;
      add('bat-ocpd', 'Protecciones', 'Fusible/interruptor DC de batería (con seccionamiento)', bat.ocpd + ' A · ' + U.fmt(b.vBank, 0) + ' V DC', 'und', cfg.nInv, Co.batOcpdPrice(bat.ocpd));
      add('cab-bat', 'Cableado de baterías', 'Cable Cu flexible clase 5 (batería ↔ inversor)', bat.cable.label + ' · caída ' + U.fmt(bat.cable.dropPct, 2) + ' %', 'm', Math.ceil(2 * LBAT * 1.2 * cfg.nInv), Math.round((P.cableCu[bat.cable.awg] || 25500) * 1.25));
      if (b.units > 1) {
        add('cab-bat-link', 'Cableado de baterías', 'Puentes entre baterías con terminales ponchados', bat.link, 'm', Math.ceil(b.units * 2 * 0.8), Math.round((P.cableCu[bat.cable.awg] || 25500) * 1.25));
        add('busbar', 'Cableado de baterías', 'Barraje DC de paralelo (+/−) con cubierta', 'Para ' + b.par + ' ramas', 'und', b.par > 1 || cfg.nInv > 1 ? 1 : 0, P.busbar);
      }
      if (e.gnd.egcBat) add('cab-egc-bat', 'Puesta a tierra', 'Tierra de gabinete/rack de baterías', e.gnd.egcBat + ' AWG', 'm', Math.ceil(LBAT * 1.5), P.cableCu[e.gnd.egcBat] || 6800);
    }
    add('gnd-rod', 'Puesta a tierra', 'Electrodo de puesta a tierra', e.gnd.rod, 'und', e.gnd.rods, P.rod);
    add('gnd-gec', 'Puesta a tierra', 'Conductor del electrodo de puesta a tierra (Cu desnudo)', e.gnd.gec + ' AWG', 'm', 15, P.bareCu[e.gnd.gec]);
    add('gnd-weld', 'Puesta a tierra', 'Soldadura exotérmica / conectores certificados', 'Uniones electrodo–conductor', 'und', e.gnd.rods * 2, P.weld);
    add('gnd-box', 'Puesta a tierra', 'Caja de inspección de puesta a tierra', '30 × 30 cm con tapa', 'und', e.gnd.rods, P.gndBox);
    var runs = (e.dc.micro ? 0 : LDC) + LAC + (cfg.bank ? LBAT : 0);
    add('conduit', 'Canalización', 'Tubería EMT/PVC, bandeja y accesorios', 'Ø 3/4"–1" · recorrido DC + AC' + (cfg.bank ? ' + batería' : ''), 'm', Math.ceil(runs * 1.1 * Math.max(1, cfg.nInv > 1 ? 1.4 : 1)), (e.ac.cable.c.mm2 > 30 ? P.conduitBig : P.conduit));
    add('mon', 'Monitoreo, medición y señalización', 'Monitoreo remoto (datalogger / Wi-Fi) y medidor de energía', 'Registro de producción, alarmas', 'und', 1, P.monitor);
    if (cfg.sysType !== 'aislado') add('meter', 'Monitoreo, medición y señalización', 'Medidor bidireccional de energía', 'Clase 1 · para autogeneración (AGPE)', 'und', 1, P.meter);
    add('labels', 'Monitoreo, medición y señalización', 'Señalización de seguridad y rótulos (RETIE / NTC 2050 690)', 'Advertencias DC, doble fuente, desconexión', 'kit', 1, P.labels);
    var kwp = cfg.kwp;
    var lab = Math.max(P.laborMin, kwp * (inputs.mount === 'suelo' ? P.laborSuelo : P.laborTecho));
    add('lab-inst', 'Mano de obra y puesta en marcha', 'Instalación electromecánica (cuadrilla certificada en alturas)', U.fmt(kwp, 2) + ' kWp · montaje, cableado y conexionado', 'gl', 1, lab, false);
    if (cfg.bank) add('lab-bat', 'Mano de obra y puesta en marcha', 'Instalación y configuración del banco de baterías', U.fmt(cfg.bank.kwh, 1) + ' kWh · BMS y comunicación', 'gl', 1, cfg.bank.kwh * P.laborBat, false);
    add('comm', 'Mano de obra y puesta en marcha', 'Pruebas de puesta en servicio IEC 62446-1 y termografía', 'Continuidad, polaridad, Voc, Isc, aislamiento', 'gl', 1, P.commission + kwp * P.commissionKwp, false);
    var eqSum = items.filter(function (x) { return x.eq; }).reduce(function (s, x) { return s + x.qty * x.price; }, 0);
    add('eng', 'Ingeniería y trámites', 'Ingeniería de detalle y memorias de cálculo', 'Planos, unifilar, coordinación de protecciones', 'gl', 1, Math.max(P.engMin, eqSum * P.engPct / 100), false);
    var ret = P.retie.find(function (r) { return kwp <= r[0]; })[1];
    add('retie', 'Ingeniería y trámites', 'Inspección y dictamen RETIE por organismo acreditado', 'Declaración de cumplimiento + dictamen', 'gl', 1, ret, false);
    if (cfg.sysType !== 'aislado') add('or', 'Ingeniería y trámites', 'Trámite de conexión con el operador de red (CREG 174 de 2021)', 'Solicitud AGPE, estudio simplificado', 'gl', 1, P.connection, false);
    add('transp', 'Logística', 'Transporte, cargue y descargue de equipos', 'Estimado ' + P.transportPct + ' % de equipos', 'gl', 1, eqSum * P.transportPct / 100, false);

    /* ediciones del usuario */
    if (opts.applyEdits !== false) {
      items.forEach(function (it) {
        var o = ov[it.id];
        if (!o) return;
        if (o.price != null && isFinite(o.price)) { it.price = +o.price; it.editedPrice = true; }
        if (opts.applyQty && o.qty != null && isFinite(o.qty)) { it.qty = +o.qty; it.editedQty = true; }
        if (o.off) it.off = true;
      });
      if (opts.applyQty) (proj.costs.custom || []).forEach(function (c) { items.push(Object.assign({ custom: true, eq: c.eq !== false }, c)); });
    }
    return Co.totals(items, prm);
  };
  Co.totals = function (items, prm) {
    var r = { items: items, params: prm, groups: {} };
    var eq = 0, sv = 0;
    items.forEach(function (it) {
      it.total = it.off ? 0 : Math.round((+it.qty || 0) * (+it.price || 0));
      if (it.eq) eq += it.total; else sv += it.total;
      var g = r.groups[it.cat] = r.groups[it.cat] || { total: 0, n: 0 }; g.total += it.total; g.n++;
    });
    r.equipment = eq; r.services = sv; r.subtotal = eq + sv;
    r.contingency = r.subtotal * (+prm.contPct || 0) / 100;
    r.aiu = r.subtotal * (+prm.aiuPct || 0) / 100;
    r.base = r.subtotal + r.contingency + r.aiu;
    r.iva = prm.ley1715 ? 0 : r.base * (+prm.ivaPct || 0) / 100;
    r.ivaSaved = prm.ley1715 ? r.base * (+prm.ivaPct || 0) / 100 : 0;
    r.total = r.base + r.iva;
    return r;
  };

  /* ---------------- Evaluación económica ---------------- */
  Co.economics = function (cfg, bom, ep) {
    var sim = cfg.sim, years = Math.max(5, +ep.years || 25), r = (+ep.rate || 0) / 100, esc = (+ep.escal || 0) / 100;
    var aislado = cfg.sysType === 'aislado';
    var price = aislado ? +ep.altCost : +ep.tariff, expPrice = (+ep.tariff) * (+ep.exportRatio || 0) / 100;
    var capex = bom.total, ivaF = bom.params.ley1715 ? 1 : 1 + (+bom.params.ivaPct || 0) / 100;
    var om1 = capex * (+ep.omPct || 0) / 100;
    var invRepl = cfg.inv.price * cfg.nInv * 0.7 * ivaF, invYear = +ep.invRepl || 12;
    var batRepl = cfg.bank ? cfg.bat.price * cfg.bank.units * 0.7 * ivaF : 0, batLife = cfg.bank ? Math.max(3, Math.floor(sim.batLife || cfg.bat.life)) : 0;
    var cash = [{ y: 0, cf: -capex, cum: -capex, energy: 0, savings: 0, om: 0, repl: 0 }], npv = -capex, pvCost = capex, pvE = 0, cum = -capex, payback = NaN;
    for (var y = 1; y <= years; y++) {
      var deg = (1 - cfg.panel.degr1 / 100) * Math.pow(1 - cfg.panel.degrY / 100, y - 1), f = Math.pow(1 + esc, y - 1);
      var eSelf = sim.selfServed * deg, eExp = sim.export * deg;
      var sav = eSelf * price * f + eExp * expPrice * f;
      var om = om1 * f, repl = (y === invYear && y < years ? invRepl : 0) + (batLife && y % batLife === 0 && y < years ? batRepl : 0);
      var cf = sav - om - repl, dfac = Math.pow(1 + r, y);
      npv += cf / dfac; pvCost += (om + repl) / dfac; pvE += sim.useful * deg / dfac;
      var prev = cum; cum += cf;
      if (!isFinite(payback) && cum >= 0) payback = y - 1 + (cf > 0 ? -prev / cf : 0);
      cash.push({ y: y, cf: cf, cum: cum, energy: eSelf + eExp, savings: sav, om: om, repl: repl });
    }
    function npvAt(rate) { var v = -capex; for (var k = 1; k < cash.length; k++) v += cash[k].cf / Math.pow(1 + rate, k); return v; }
    var irr = NaN, lo = -0.9, hi = 1.5;
    if (npvAt(lo) > 0 && npvAt(hi) < 0) { for (var it = 0; it < 80; it++) { var mid = (lo + hi) / 2; if (npvAt(mid) > 0) lo = mid; else hi = mid; } irr = (lo + hi) / 2; }
    return { capex: capex, lcoe: pvE > 0 ? pvCost / pvE : NaN, npv: npv, irr: irr, payback: payback, cash: cash, savings1: cash[1] ? cash[1].savings : 0, om1: om1, price: price, expPrice: expPrice, invRepl: invRepl, invYear: invYear, batRepl: batRepl, batLife: batLife, years: years, perWp: capex / (cfg.kwp * 1000) };
  };
  /* Moneda */
  Co.money = function (cop, prm, dec) {
    prm = prm || Co.params();
    if (!isFinite(cop)) return '—';
    if (prm.currency === 'USD') { var u = cop / (+prm.trm || 1); return 'US$\u00A0' + U.fmt(u, dec != null ? dec : Math.abs(u) < 100 ? 3 : 0); }
    return '$\u00A0' + U.fmtInt(cop);
  };
  /* Valor compacto para tarjetas KPI: [valor, unidad] (millones cuando es grande) */
  Co.kpiMoney = function (cop, prm) {
    prm = prm || Co.params();
    if (!isFinite(cop)) return ['—', ''];
    var usd = prm.currency === 'USD', v = usd ? cop / (+prm.trm || 1) : cop, sym = usd ? 'US$\u00A0' : '$\u00A0';
    if (Math.abs(v) >= 1e6) return [sym + U.fmt(v / 1e6, Math.abs(v) >= 1e8 ? 0 : 1), usd ? 'millones USD' : 'millones'];
    if (usd && Math.abs(v) >= 1e4) return [sym + U.fmt(v / 1e3, 1), 'mil USD'];
    return [sym + U.fmt(v, usd ? 2 : 0), ''];
  };
  Co.moneyAlt = function (cop, prm) {
    prm = prm || Co.params();
    if (!isFinite(cop)) return '—';
    return prm.currency === 'USD' ? '$ ' + U.fmtInt(cop) + ' COP' : 'US$ ' + U.fmt(cop / (+prm.trm || 1), 0);
  };
})();
