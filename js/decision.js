/* ==========================================================================
   decision.js — De la predicción a la DECISIÓN ENERGÉTICA.
   - Perfil horario de predicción (climatología del mes + condiciones dadas).
   - Reserva de batería para la operación nocturna (ecuaciones explícitas).
   - Riesgo de insuficiencia energética (reglas cuantitativas documentadas).
   - Índice de confiabilidad (ponderación explícita; no es una probabilidad).
   - Recomendaciones derivadas de reglas y simulador de escenarios.
   - Backtest de la DECISIÓN en los días de prueba y su valor en pesos (COP).
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var U = SEDA.U, ML = SEDA.ML, M = SEDA.Mapping;
  var D = SEDA.Decision = {};

  D.DEFAULT_INPUTS = { capKWh: 80, socNow: 35, nightLoad: 35, socMin: 20, effBat: 95, effInv: 96, hoursLeft: null, margin: 15, dayLoad: 30, costBackup: 2000, costUnserved: 6000 };
  D.IRR_KEYS = ['IRRADIANCIA', 'IRR_POA', 'DNI', 'DHI'];

  /* ---------------- Perfil de predicción ---------------- */
  /* ctx: {pr, model, clim}; opts: {date (ms día), hour (0-23), inputs {VAR: valor}, mods} */
  D.profile = function (ctx, opts) {
    var pr = ctx.pr, model = ctx.model, tk = model.targetKey, dtH = model.dtH;
    var mods = opts.mods || {};
    var inp = opts.inputs || {};
    var num = function (v) { return v === '' || v == null ? NaN : +v; };
    var applyMods = function (vals) {
      var o = Object.assign({}, vals);
      if (mods.irrPct) D.IRR_KEYS.forEach(function (k) { if (isFinite(o[k])) o[k] = Math.max(0, o[k] * (1 + mods.irrPct / 100)); });
      if (mods.tempDelta && isFinite(o.TEMPERATURA)) o.TEMPERATURA += mods.tempDelta;
      if (mods.windPct && isFinite(o.VEL_VIENTO)) o.VEL_VIENTO = Math.max(0, o.VEL_VIENTO * (1 + mods.windPct / 100));
      if (mods.humDelta && isFinite(o.HUMEDAD)) o.HUMEDAD = U.clamp(o.HUMEDAD + mods.humDelta, 0, 100);
      return o;
    };
    var predKW = function (t, vals) {
      var row = ML.featureRow(model.features, t, vals);
      if (row.some(function (v) { return !isFinite(v); })) return { kw: NaN, row: row };
      return { kw: Math.max(0, ML.toKW(ML.predictRow(model, row), tk, dtH)), row: row };
    };
    if (dtH >= 24) {
      var v0 = applyMods(inp), r0 = predKW(opts.date, v0);
      return { daily: true, dayKWh: r0.kw * 24, H0: 0, kwH0: r0.kw, rowH0: r0.row, valsH0: v0, hours: [], kw: [], kwClim: [] };
    }
    var clim = ctx.clim, m = U.monthOf(opts.date), cl = clim[m], H0 = opts.hour;
    var c0 = cl[H0] || {};
    var factor = function (k) {
      var iv = num(inp[k]), cv = c0[k];
      if (isFinite(iv) && cv > 50) return U.clamp(iv / cv, 0, 1.6);
      return NaN;
    };
    var fIrr = factor('IRRADIANCIA');
    if (!isFinite(fIrr)) fIrr = factor('IRR_POA');
    if (!isFinite(fIrr)) fIrr = 1;
    var fk = {};
    D.IRR_KEYS.forEach(function (k) { var f = factor(k); fk[k] = isFinite(f) ? f : fIrr; });
    var dT = isFinite(num(inp.TEMPERATURA)) && isFinite(c0.TEMPERATURA) ? num(inp.TEMPERATURA) - c0.TEMPERATURA : 0;
    var dH = isFinite(num(inp.HUMEDAD)) && isFinite(c0.HUMEDAD) ? num(inp.HUMEDAD) - c0.HUMEDAD : 0;
    var fW = isFinite(num(inp.VEL_VIENTO)) && c0.VEL_VIENTO > 0.2 ? U.clamp(num(inp.VEL_VIENTO) / c0.VEL_VIENTO, 0, 3) : 1;
    var dP = isFinite(num(inp.PRESION)) && isFinite(c0.PRESION) ? num(inp.PRESION) - c0.PRESION : 0;
    var hours = [], kw = [], kwClim = [], valsAll = [];
    var kwH0 = NaN, rowH0 = null, valsH0 = null;
    for (var h = 0; h < 24; h++) {
      var c = cl[h] || {}, vals = {};
      pr.keys.forEach(function (k) {
        if (M.METEO.indexOf(k) < 0) return;
        var cv = c[k], iv = num(inp[k]);
        if (h === H0 && isFinite(iv)) { vals[k] = iv; return; }
        if (D.IRR_KEYS.indexOf(k) >= 0) vals[k] = isFinite(cv) ? cv * fk[k] : NaN;
        else if (k === 'TEMPERATURA') vals[k] = cv + dT;
        else if (k === 'HUMEDAD') vals[k] = U.clamp(cv + dH, 0, 100);
        else if (k === 'VEL_VIENTO') vals[k] = cv * fW;
        else if (k === 'DIR_VIENTO') vals[k] = isFinite(iv) ? iv : cv;
        else if (k === 'PRESION') vals[k] = cv + dP;
        else vals[k] = cv;
      });
      vals = applyMods(vals);
      var t = opts.date + h * U.HOUR;
      var r = predKW(t, vals);
      hours.push(h); kw.push(r.kw); valsAll.push(vals);
      kwClim.push(isFinite(c[tk]) ? ML.toKW(c[tk], tk, dtH) : NaN);
      if (h === H0) { kwH0 = r.kw; rowH0 = r.row; valsH0 = vals; }
    }
    var dayKWh = U.sum(kw);
    return { daily: false, hours: hours, kw: kw, kwClim: kwClim, vals: valsAll, dayKWh: dayKWh, H0: H0, kwH0: kwH0, rowH0: rowH0, valsH0: valsH0, fIrr: fIrr, climMonth: cl.borrowedFrom || m };
  };
  /* Horas restantes de generación: desde H0 hasta la última hora con generación climatológica > 1 % del máximo */
  D.autoHoursLeft = function (prof) {
    if (prof.daily) return 24;
    var ref = prof.kwClim.some(isFinite) ? prof.kwClim : prof.kw;
    var mx = Math.max.apply(null, ref.filter(isFinite).concat([0]));
    var last = -1;
    for (var h = 23; h >= 0; h--) if (ref[h] > 0.01 * mx) { last = h; break; }
    return Math.max(0, last - prof.H0 + 1);
  };
  D.remaining = function (prof, hoursLeft) {
    if (prof.daily) return prof.dayKWh;
    var s = 0;
    for (var h = prof.H0; h < Math.min(24, prof.H0 + hoursLeft); h++) if (isFinite(prof.kw[h])) s += prof.kw[h];
    return s;
  };

  /* ---------------- Decisión de reserva ---------------- */
  D.compute = function (inp, gen, ctx) {
    ctx = ctx || {};
    var cap = +inp.capKWh, socNow = +inp.socNow, socMin = +inp.socMin;
    var eB = +inp.effBat / 100, eI = +inp.effInv / 100, eta = eB * eI;
    var night = +inp.nightLoad, day = +(inp.dayLoad || 0), mg = +inp.margin / 100;
    var Ereq = night / eta;
    var Eres = Ereq * (1 + mg);
    var Emin = cap * socMin / 100;
    var usable = cap - Emin;
    var socObjRaw = socMin + Eres / cap * 100;
    var socObj = Math.min(100, socObjRaw);
    var Enow = cap * socNow / 100;
    var project = function (Egen) {
      var net = Egen - day, charge = 0, spill = 0, unmet = 0, Esun;
      if (net >= 0) {
        var stored = net * eB, free = Math.max(0, cap - Enow);
        charge = Math.min(stored, free); spill = Math.max(0, stored - free); Esun = Enow + charge;
      } else {
        var draw = -net / eta;
        Esun = Math.max(0, Enow - draw); unmet = Math.max(0, draw - Enow);
      }
      var Eavail = Math.max(0, Esun - Emin);
      return { Egen: Egen, net: net, charge: charge, spill: spill, unmetDay: unmet, Esun: Esun, socSun: Esun / cap * 100, Eavail: Eavail, margin: Eavail - Eres, cover: Eres > 0 ? Eavail / Eres : Infinity };
    };
    var errRel = isFinite(ctx.errRel) ? U.clamp(ctx.errRel, 0, 0.9) : 0;
    var nom = project(gen), cons = project(gen * (1 - errRel));
    var capInsufficient = Eres > usable + 1e-9;
    var risk, rule;
    if (capInsufficient) { risk = 'ALTO'; rule = 'R1: reserva recomendada (' + U.fmt(Eres, 1) + ' kWh) > capacidad útil (' + U.fmt(usable, 1) + ' kWh)'; }
    else if (nom.cover < 1) { risk = 'ALTO'; rule = 'R2: cobertura nominal ' + U.fmtCover(nom.cover) + ' % < 100 % (la reserva no se alcanza ni con la generación esperada)'; }
    else if (cons.cover < 1) { risk = 'MODERADO'; rule = 'R3: cobertura nominal ≥ 100 % pero cobertura conservadora ' + U.fmtCover(cons.cover) + ' % < 100 % (generación reducida por el error histórico de ' + U.fmt(errRel * 100, 1) + ' %)'; }
    else { risk = 'BAJO'; rule = 'R4: cobertura conservadora ' + U.fmtCover(cons.cover) + ' % ≥ 100 %'; }
    if (risk === 'BAJO' && isFinite(ctx.reliability) && ctx.reliability < 50) { risk = 'MODERADO'; rule += '; R5: índice de confiabilidad ' + U.fmt(ctx.reliability, 0) + ' < 50 → se eleva a MODERADO'; }
    var target = cap * socObj / 100;
    var deficit = Math.max(0, target - nom.Esun);
    var shift = eB > 0 ? deficit / eB : NaN;
    return {
      inputs: Object.assign({}, inp), eta: eta, Ereq: Ereq, Eres: Eres, Emin: Emin, usable: usable, socObj: socObj, socObjRaw: socObjRaw, Enow: Enow,
      gen: gen, errRel: errRel, nom: nom, cons: cons, capInsufficient: capInsufficient, risk: risk, rule: rule, deficit: deficit, loadShift: shift, targetE: target
    };
  };

  /* ---------------- Backtest de la decisión (días de prueba) ----------------
     Para cada día del conjunto de PRUEBA se repite la decisión de la mañana con la
     energía FV diaria que habría previsto cada regla, y se compara con lo que realmente
     ocurrió (energía FV real de ese día):
       1. Con la previsión Ê: si la energía disponible al anochecer no alcanza la reserva,
          el operador PROGRAMA respaldo B = mín(Reserva − Disponible(Ê), capacidad libre).
       2. Con la generación real E: disponible real = mín(Disponible(E) + B, capacidad útil).
       3. Déficit nocturno = máx(0, Energía nocturna requerida − disponible real) × η_global
          [kWh de carga no atendidos con lo planeado → respaldo de emergencia o energía no servida].
       Costo del día = B × costo del respaldo programado + Déficit × costo del kWh no servido.
     Supuestos: cada día empieza con el SOC actual configurado; la generación prevista es la
     del día completo; consumos y eficiencias constantes. Los costos son editables. */
  D.BT_METHODS = [
    { id: 'oracle', label: 'Previsión perfecta (referencia, inalcanzable)' },
    { id: 'rf', label: 'Random Forest (modelo)' },
    { id: 'li', label: 'Regresión lineal sobre irradiancia' },
    { id: 'pe', label: 'Persistencia («mañana igual que hoy»)' },
    { id: 'fixed', label: 'Regla fija: día promedio del entrenamiento' }
  ];
  D.backtest = function (ev, inp) {
    if (!ev || !ev.daily || !ev.daily.rows || !ev.daily.rows.length) return null;
    var rows = ev.daily.rows, n = rows.length;
    var cB = isFinite(+inp.costBackup) ? +inp.costBackup : D.DEFAULT_INPUTS.costBackup;
    var cU = isFinite(+inp.costUnserved) ? +inp.costUnserved : D.DEFAULT_INPUTS.costUnserved;
    var base = Object.assign({}, inp);
    var real = rows.map(function (r) { return D.compute(base, r.y); });
    var getPred = {
      oracle: function (r) { return r.y; }, rf: function (r) { return r.rf; }, li: function (r) { return r.li; },
      pe: function (r) { return r.pe; }, fixed: function () { return ev.daily.trainMean; }
    };
    var out = [];
    D.BT_METHODS.forEach(function (m) {
      var ok = rows.every(function (r) { return isFinite(getPred[m.id](r)); });
      if (!ok) return;
      var B = 0, S = 0, nB = 0, nS = 0, days = [];
      rows.forEach(function (r, k) {
        var p = D.compute(base, getPred[m.id](r)), rr = real[k];
        var b = Math.max(0, Math.min(p.Eres - p.nom.Eavail, +base.capKWh - p.nom.Esun));
        var avail = Math.min(rr.nom.Eavail + b, rr.usable);
        var shortLoad = Math.max(0, rr.Ereq - avail) * rr.eta;
        if (b > 0.01) nB++;
        if (shortLoad > 0.01) nS++;
        B += b; S += shortLoad;
        days.push({ day: r.day, pred: getPred[m.id](r), real: r.y, backup: b, short: shortLoad });
      });
      var cost = B * cB + S * cU;
      out.push({ id: m.id, label: m.label, backupKWh: B, shortKWh: S, daysBackup: nB, nightsShort: nS, cost: cost, costYear: cost / n * 365, days: days });
    });
    var by = {}; out.forEach(function (o) { by[o.id] = o; });
    var savingVsPe = by.rf && by.pe ? by.pe.costYear - by.rf.costYear : NaN;
    var savingVsFixed = by.rf && by.fixed ? by.fixed.costYear - by.rf.costYear : NaN;
    return { n: n, start: rows[0].day, end: rows[n - 1].day, costBackup: cB, costUnserved: cU, methods: out, by: by, savingVsPe: savingVsPe, savingVsFixed: savingVsFixed, trainMean: ev.daily.trainMean };
  };

  /* ---------------- Índice de confiabilidad ---------------- */
  D.WEIGHTS = { A: 0.30, D: 0.15, Q: 0.20, S: 0.20, T: 0.15 };
  D.reliability = function (o) {
    var c = {};
    var wape = o.evaluation ? o.evaluation.metrics.test.rf.wape : NaN;
    c.A = isFinite(wape) ? U.clamp(1 - wape / 100, 0, 1) : 0;
    var days = new Set(), months = new Set(), pr = o.pr;
    if (pr) {
      var y = pr.vars[pr.targetKey];
      for (var i = 0; i < pr.n; i++) if (isFinite(y[i])) { days.add(U.dayStart(pr.t[i])); months.add(U.monthOf(pr.t[i])); }
    }
    c.D = Math.min(1, days.size / 365);
    c.Q = o.quality != null ? U.clamp(o.quality / 100, 0, 1) : 0;
    c.S = o.similarity != null ? U.clamp(o.similarity, 0, 1) : null;
    c.T = months.size / 12;
    var w = D.WEIGHTS, sw = 0, s = 0;
    Object.keys(w).forEach(function (k) { if (c[k] == null) return; sw += w[k]; s += w[k] * c[k]; });
    var score = sw ? 100 * s / sw : NaN;
    return { score: score, comp: c, days: days.size, months: months.size, level: score >= 80 ? 'ALTA' : score >= 60 ? 'MEDIA' : 'BAJA' };
  };

  /* ---------------- Recomendaciones basadas en reglas ---------------- */
  D.recommend = function (res, ctx) {
    ctx = ctx || {};
    var out = [], inp = res.inputs;
    var H0 = ctx.hour, hl = inp.hoursLeft;
    if (res.capInsufficient) out.push({ level: 'crit', title: 'Ampliar almacenamiento o reducir consumo nocturno', text: 'La reserva recomendada (' + U.fmt(res.Eres, 1) + ' kWh) supera la capacidad útil de la batería (' + U.fmt(res.usable, 1) + ' kWh entre SOC mínimo ' + inp.socMin + ' % y 100 %). Aunque la batería se cargue por completo, no cubre la noche con el margen configurado: prever respaldo, reducir el consumo nocturno o ampliar la capacidad.', why: 'Regla R1: Eres > C·(1 − SOCmin)' });
    if (res.risk === 'ALTO' && !res.capInsufficient) {
      out.push({ level: 'crit', title: 'Aumentar reserva — priorizar almacenamiento', text: 'Con la generación esperada el SOC proyectado al anochecer es ' + U.fmt(res.nom.socSun, 0) + ' %, inferior al SOC objetivo de ' + U.fmt(res.socObj, 0) + ' %. Faltan ' + U.fmt(res.deficit, 1) + ' kWh: diferir ' + U.fmt(res.loadShift, 1) + ' kWh de cargas diurnas no críticas para destinarlos a la batería' + (res.nom.net < 0 ? ' (la generación no cubre ni el consumo diurno; prever respaldo)' : '') + '.', why: 'Regla R2: cobertura nominal ' + U.fmtCover(res.nom.cover) + ' % < 100 %' });
    }
    if (res.risk === 'MODERADO') {
      out.push({ level: 'warn', title: 'Mantener reserva y priorizar almacenamiento', text: 'La reserva se cumple con la generación esperada (cobertura ' + U.fmtCover(res.nom.cover) + ' %), pero no si la generación resultara ' + U.fmt(res.errRel * 100, 1) + ' % menor (error relativo histórico del modelo; cobertura ' + U.fmtCover(res.cons.cover) + ' %). Evitar cargas diferibles hasta confirmar un SOC ≥ ' + U.fmt(res.socObj, 0) + ' %' + (isFinite(H0) && hl ? ' antes de las ' + U.p2(Math.min(23, H0 + hl)) + ':00' : '') + '.', why: 'Regla R3: cobertura conservadora < 100 %' });
    }
    if (res.risk === 'BAJO') {
      var surplus = res.cons.margin;
      if (surplus > 0.2 * res.Eres) out.push({ level: 'good', title: 'Reducir / liberar reserva', text: 'Incluso con el escenario conservador queda un excedente de ' + U.fmt(surplus, 1) + ' kWh sobre la reserva recomendada. Ese excedente puede destinarse a cargas diferibles (bombeo, refrigeración, carga de equipos) sin comprometer la operación nocturna.', why: 'Regla R4 y margen conservador > 20 % de la reserva' });
      else out.push({ level: 'good', title: 'Mantener reserva', text: 'La energía disponible al anochecer cubre la reserva recomendada incluso con el error histórico del modelo (cobertura conservadora ' + U.fmtCover(res.cons.cover) + ' %). Mantener la operación prevista.', why: 'Regla R4' });
    }
    if (res.nom.spill > 0.5) out.push({ level: 'info', title: 'Aprovechar excedente no almacenable', text: 'Se estima que ' + U.fmt(res.nom.spill, 1) + ' kWh de generación no podrán almacenarse (batería llena). Programar cargas diurnas diferibles durante las horas de mayor generación.', why: 'Excedente = (Egen − Cdía)·ηbat − capacidad libre > 0' });
    if (res.nom.unmetDay > 0.1) out.push({ level: 'crit', title: 'Revisar balance diurno', text: 'El consumo diurno restante supera la generación y la energía almacenada: ' + U.fmt(res.nom.unmetDay, 1) + ' kWh no pueden atenderse antes del anochecer.', why: 'Balance diurno negativo mayor que la energía almacenada' });
    if (+inp.socNow < +inp.socMin) out.push({ level: 'warn', title: 'Revisar condiciones del sistema', text: 'El SOC actual (' + inp.socNow + ' %) es inferior al SOC mínimo configurado (' + inp.socMin + ' %). Verificar la medición del SOC y la estrategia de protección de la batería.', why: 'SOC actual < SOC mínimo' });
    if (ctx.quality != null && ctx.quality < 80) out.push({ level: 'warn', title: 'Revisar datos meteorológicos', text: 'La calidad de los datos es ' + U.fmt(ctx.quality, 1) + ' % (< 80 %). Revisar faltantes, discontinuidades y sensores antes de confiar en la recomendación.', why: 'Calidad de datos < 80 %' });
    if (ctx.similarity && ctx.similarity.outside && ctx.similarity.outside.length) out.push({ level: 'warn', title: 'Revisar datos de entrada', text: 'Las condiciones ingresadas están fuera del rango histórico de entrenamiento (P1–P99) en: ' + ctx.similarity.outside.map(function (o) { return ML.flabel(o.f) + ' = ' + U.fmt(o.v, 2); }).join(', ') + '. El modelo extrapola con menor fiabilidad.', why: 'Similitud < 100 %' });
    if (ctx.rfWorse) out.push({ level: 'warn', title: 'Revisar el modelo', text: 'En los datos de prueba el Random Forest no supera a la persistencia (RMSE mayor o igual). Revisar variables de entrada, calidad de datos o parámetros antes de usar la predicción.', why: 'RMSE_RF ≥ RMSE_persistencia' });
    if (ctx.reliability != null && ctx.reliability < 60) out.push({ level: 'warn', title: 'Repetir análisis con más datos', text: 'El índice de confiabilidad es ' + U.fmt(ctx.reliability, 0) + ' / 100 (< 60). Incorporar más historia (idealmente ≥ 1 año) o mejores mediciones y repetir el análisis.', why: 'Índice de confiabilidad < 60' });
    return out;
  };

  D.narrative = function (res, ctx) {
    var inp = res.inputs;
    var s = 'Se estima una generación fotovoltaica de ' + U.fmt(res.gen, 1) + ' kWh' + (ctx && ctx.window ? ' ' + ctx.window : '') + '. ';
    s += 'La demanda nocturna calculada es de ' + U.fmt(res.Ereq, 1) + ' kWh (consumo nocturno de ' + U.fmt(+inp.nightLoad, 1) + ' kWh dividido por la eficiencia global de ' + U.fmt(res.eta * 100, 1) + ' %). ';
    s += 'Considerando la eficiencia del sistema y el margen de seguridad configurado (' + U.fmt(+inp.margin, 0) + ' %), se recomienda mantener una reserva mínima de ' + U.fmt(res.Eres, 1) + ' kWh, equivalente a un SOC objetivo de ' + U.fmt(res.socObj, 0) + ' % al inicio de la noche' + (res.socObjRaw > 100 ? ' (el cálculo exige ' + U.fmt(res.socObjRaw, 0) + ' %, por encima de la capacidad)' : '') + '. ';
    s += 'Con la generación esperada, el SOC proyectado al anochecer es de ' + U.fmt(res.nom.socSun, 0) + ' % (energía disponible para la noche: ' + U.fmt(res.nom.Eavail, 1) + ' kWh; cobertura de la reserva: ' + U.fmtCover(res.nom.cover) + ' %). ';
    s += 'Riesgo de insuficiencia energética: ' + res.risk + '.';
    return s;
  };

  /* ---------------- Escenarios ---------------- */
  D.SCENARIOS = [
    { id: 'base', name: 'Escenario actual', mods: {} },
    { id: 'irr20', name: 'Irradiancia −20 %', mods: { irrPct: -20 } },
    { id: 'irr40', name: 'Irradiancia −40 %', mods: { irrPct: -40 } },
    { id: 'load20', name: 'Consumo nocturno +20 %', mods: { loadPct: 20 } },
    { id: 'batMinus', name: 'Batería reducida (−25 %)', mods: { capPct: -25 } },
    { id: 'batPlus', name: 'Batería ampliada (+25 %)', mods: { capPct: 25 } }
  ];
  D.runScenario = function (ctx, base, sc) {
    var mods = sc.mods || {};
    var prof = D.profile(ctx, { date: base.date, hour: base.hour, inputs: base.inputs, mods: mods });
    var inp = Object.assign({}, base.decisionInputs);
    if (mods.loadPct) inp.nightLoad = +inp.nightLoad * (1 + mods.loadPct / 100);
    if (mods.capPct) inp.capKWh = +inp.capKWh * (1 + mods.capPct / 100);
    if (mods.cap != null && isFinite(mods.cap)) inp.capKWh = +mods.cap;
    if (mods.margin != null && isFinite(mods.margin)) inp.margin = +mods.margin;
    var hl = inp.hoursLeft != null && inp.hoursLeft !== '' ? +inp.hoursLeft : D.autoHoursLeft(prof);
    var gen = D.remaining(prof, hl);
    var res = D.compute(inp, gen, { errRel: base.errRel, reliability: base.reliability });
    return { id: sc.id, name: sc.name, mods: mods, gen: gen, dayKWh: prof.dayKWh, reserve: res.Eres, socObj: res.socObj, socSun: res.nom.socSun, risk: res.risk, cover: res.nom.cover, coverCons: res.cons.cover, cap: inp.capKWh, nightLoad: inp.nightLoad, margin: inp.margin, profile: prof.kw };
  };
})();
