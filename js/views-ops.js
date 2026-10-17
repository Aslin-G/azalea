/* ==========================================================================
   views-ops.js — Predicción solar, Decisión energética (reserva, riesgo,
   confiabilidad, recomendaciones y recomendaciones visuales) y simulador
   de escenarios «¿Qué pasaría si?».
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, SP = SEDA.Specs, M = SEDA.Mapping, ML = SEDA.ML, D = SEDA.Decision;
  var V = SEDA.Views = SEDA.Views || {};
  var st = function () { return SEDA.state; };

  var PRED_FIELDS = ['IRRADIANCIA', 'IRR_POA', 'TEMPERATURA', 'HUMEDAD', 'VEL_VIENTO', 'DIR_VIENTO', 'PRESION', 'DNI', 'DHI', 'PRECIPITACION'];

  /* ================= PREDICCIÓN ================= */
  V.prediccion = {
    render: function (el) {
      var S = st();
      var h = V.head('Predicción solar', 'Estimación de la generación fotovoltaica con el Random Forest entrenado, a partir de fecha, hora y condiciones meteorológicas.');
      if (!S.model) { el.innerHTML = h + V.empty('☀\uFE0F', 'Modelo no entrenado', 'Entrene el modelo para calcular predicciones.', '<button class="btn btn-primary" data-action="train">ENTRENAR MODELO</button>'); return; }
      var pr = S.processed, P = S.prediction;
      var date = P ? P.date : U.dayStart(U.nowLocalNaive()), hour = P ? P.hour : 9;
      var inputs = P ? P.inputs : SEDA.App.defaultPredictionInputs(date, hour);
      var used = {}; S.model.features.forEach(function (f) { if (ML.FEAT[f].src) used[ML.FEAT[f].src] = true; });
      var fld = function (k) {
        var has = !!pr.vars[k], u = pr.units[k] || M.byKey[k].unit;
        var note = !has ? 'no disponible en los datos' : !used[k] ? 'no usada por el modelo' : '';
        return '<label class="f">' + M.label(k) + ' [' + u + ']<input type="number" step="any" data-in="' + k + '" value="' + (has && inputs[k] != null && inputs[k] !== '' ? inputs[k] : '') + '"' + (has ? '' : ' disabled') + '>' + (note ? '<span class="hint">' + note + '</span>' : '') + '</label>';
      };
      h += '<div class="card"><div class="card-head"><h3>Condiciones de entrada</h3><div class="ch-actions"><button class="btn btn-sm" id="pr-typ">↺ Valores típicos (media histórica del mes y hora)</button></div></div><div class="form-grid">' +
        '<label class="f">Fecha<input type="date" id="pr-date" value="' + U.fmtDate(date) + '"></label>' +
        '<label class="f">Hora<select id="pr-hour">' + Array.from({ length: 24 }, function (_, i) { return '<option value="' + i + '"' + (i === hour ? ' selected' : '') + '>' + U.p2(i) + ':00</option>'; }).join('') + '</select></label>' +
        PRED_FIELDS.map(fld).join('') + '</div>' +
        '<p class="small muted" style="margin-top:8px">Las condiciones se aplican a la hora indicada. Para el resto del día se usa el perfil horario medio histórico del mes, ajustado con las condiciones ingresadas (factor de irradiancia, desplazamientos de temperatura, humedad y presión, factor de viento).</p>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary btn-lg" id="pr-go">☀ CALCULAR PREDICCIÓN</button></div></div>';
      if (P) {
        var ev = S.evaluation, pf = P.profile;
        h += '<div class="grid g4">' + V.kpi('Generación estimada', U.fmt(P.kwH0, 2), 'kW', 'Potencia a las ' + U.p2(P.hour) + ':00 del ' + U.fmtDate(P.date), 'big', '☀') +
          V.kpi('Energía en la hora', U.fmt(P.kwH0 * 1, 2), 'kWh', 'kW × 1 h (' + U.p2(P.hour) + ':00–' + U.p2((P.hour + 1) % 24) + ':00)', 'big accent', '⚡') +
          V.kpi('Generación restante', U.fmt(P.remainingKWh, 1), 'kWh', pf.daily ? 'Día completo' : P.hoursLeft + ' h de generación desde las ' + U.p2(P.hour) + ':00', 'big accent', '🔋') +
          V.kpi('Generación del día', U.fmt(P.dayKWh, 1), 'kWh', 'Perfil de 24 h (' + U.fmtDate(P.date) + ')', 'big', '📊') + '</div>';
        h += '<div class="alert info"><span class="ai">ℹ\uFE0F</span><div><b>El modelo proporciona una estimación puntual.</b> No se presentan intervalos de confianza porque el Random Forest implementado no incluye un método estadístico calibrado para ello; como referencia de incertidumbre se muestra el error histórico en datos de prueba.</div></div>';
        h += '<div class="grid g3"><div class="card"><h3>Error histórico del modelo</h3>' + U.table(['Indicador (datos de prueba)', 'Valor'], [
          ['MAE a las ' + U.p2(P.hour) + ':00', U.fmt(P.errHour, 3) + ' kW'], ['MAE global', U.fmt(P.errGlobal, 3) + ' kW'], ['MAE de energía diaria', U.fmt(P.errDaily, 2) + ' kWh/día'], ['Error relativo diario (WAPE)', U.fmtPct(P.errRel * 100, 1)]
        ], { compact: true }) + '</div>' +
          '<div class="card"><h3>Calidad y similitud</h3>' + V.kpi('Indicador de calidad de datos', U.fmt(P.quality, 1), '%', V.meter(P.quality, V.qualityColor(P.quality)), '') +
          '<p class="small" style="margin-top:10px">Similitud con el entrenamiento: <b>' + P.similarity.inRange + ' de ' + P.similarity.total + '</b> entradas meteorológicas dentro del rango P1–P99.' +
          (P.similarity.outside.length ? '<br><span class="status-warn">Fuera de rango: ' + P.similarity.outside.map(function (o) { return ML.flabel(o.f) + ' = ' + U.fmt(o.v, 2) + ' (P1–P99: ' + U.fmt(o.p1, 1) + '–' + U.fmt(o.p99, 1) + ')'; }).join('; ') + '</span>' : '') + '</p></div>' +
          '<div class="card"><h3>Predicción histórica comparable</h3>' + (P.comparable.length ? U.table(['Fecha y hora', 'Irrad. [W/m²]', 'Real [kW]', 'RF [kW]'], P.comparable.map(function (c) { return [U.fmtDateTime(c.t), U.fmt(c.irr, 0), U.fmt(ML.toKW(c.y, S.model.targetKey, S.model.dtH), 2), U.fmt(ML.toKW(c.pred, S.model.targetKey, S.model.dtH), 2)]; }), { numCols: [1, 2, 3], compact: true }) +
            '<p class="small muted" style="margin-top:6px">5 registros históricos más parecidos (misma hora ± 1 h, distancia estandarizada en las variables meteorológicas). Media real: <b>' + U.fmt(U.mean(P.comparable.map(function (c) { return ML.toKW(c.y, S.model.targetKey, S.model.dtH); })), 2) + ' kW</b>.</p>' : '<p class="muted">No aplica para datos diarios.</p>') + '</div></div>';
        if (!pf.daily) h += '<div style="margin-top:16px">' + C.card('pr-prof', 'Perfil de generación previsto', 'Predicción horaria del Random Forest frente a la media histórica real del mes' + (pf.climMonth !== U.monthOf(P.date) ? ' (mes sin datos: se usa ' + U.MESES_L[pf.climMonth - 1] + ')' : ''), 300) + '</div>';
        h += '<div class="btn-row" style="margin-top:16px"><button class="btn btn-accent btn-lg" data-action="decide">🔋 CALCULAR DECISIÓN →</button></div>';
      }
      el.innerHTML = h;
      var readForm = function () {
        var o = {};
        U.$$('[data-in]', el).forEach(function (x) { if (!x.disabled) o[x.getAttribute('data-in')] = x.value === '' ? '' : +x.value; });
        return { date: U.parseDateInput(U.$('#pr-date').value), hour: +U.$('#pr-hour').value, inputs: o };
      };
      U.$('#pr-typ').onclick = function () {
        var f = readForm(); if (!isFinite(f.date)) f.date = U.dayStart(U.nowLocalNaive());
        var typ = SEDA.App.defaultPredictionInputs(f.date, f.hour);
        U.$$('[data-in]', el).forEach(function (x) { var k = x.getAttribute('data-in'); if (!x.disabled) x.value = typ[k] != null ? typ[k] : ''; });
      };
      U.$('#pr-go').onclick = function () {
        var f = readForm();
        if (!isFinite(f.date)) { U.toast('Indique una fecha válida.', 'warn'); return; }
        if (SEDA.App.predict(f)) { U.toast('Predicción calculada.', 'good'); V.prediccion.render(el); }
      };
      if (P && !P.profile.daily) C.mount(U.$('#pr-prof'), SP.profile(P));
    }
  };

  /* ================= DECISIÓN ================= */
  V.decision = {
    render: function (el, opts) {
      var S = st();
      var h = V.head('Decisión energética', '¿Cuánta energía solar puedo esperar y cuánta energía debo reservar para garantizar la operación nocturna?');
      if (!S.model) { el.innerHTML = h + V.empty('🔋', 'Modelo no entrenado', 'La decisión se apoya en la predicción del modelo.', '<button class="btn btn-primary" data-action="train">ENTRENAR MODELO</button>'); return; }
      var di = S.decisionInputs, d = S.decision, P = S.prediction;
      var nl = SEDA.Quality.nightLoad(S.processed);
      var f = function (k, label, hint, step) { return '<label class="f">' + label + '<input type="number" step="' + (step || 'any') + '" data-di="' + k + '" value="' + (di[k] == null ? '' : di[k]) + '">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>'; };
      h += '<div class="card"><div class="card-head"><h3>Entradas de la decisión</h3></div><div class="form-grid">' +
        f('capKWh', 'Capacidad batería [kWh]') + f('socNow', 'SOC actual [%]') +
        f('nightLoad', 'Consumo nocturno [kWh]', nl ? 'Histórico: media ' + U.fmt(nl.mean, 1) + ' · P90 ' + U.fmt(nl.p90, 1) + ' kWh (' + nl.nights + ' noches, 18:00–06:00)' : 'Energía a atender desde el anochecer hasta el amanecer') +
        f('socMin', 'SOC mínimo [%]') + f('effBat', 'Eficiencia batería [%]') + f('effInv', 'Eficiencia inversor [%]') +
        f('hoursLeft', 'Horas restantes de generación solar', 'Vacío = automático (' + (P ? P.hoursLeftAuto + ' h desde las ' + U.p2(P.hour) + ':00' : 'según la predicción') + ')', 1) +
        f('margin', 'Margen de seguridad [%]') + f('dayLoad', 'Consumo diurno restante [kWh]', 'Opcional: carga a atender antes del anochecer') +
        f('costBackup', 'Costo del respaldo programado [COP/kWh]', 'Supuesto editable: combustible y operación del generador o compra a la red') +
        f('costUnserved', 'Costo del kWh no servido [COP/kWh]', 'Supuesto editable: respaldo de emergencia o pérdida por energía no atendida') + '</div>' +
        (nl ? '<div class="btn-row small" style="margin-top:8px"><button class="btn btn-sm" id="nl-mean">Usar consumo nocturno medio histórico</button><button class="btn btn-sm" id="nl-p90">Usar P90 (conservador)</button></div>' : '') +
        '<p class="small muted" style="margin-top:8px">' + (P ? 'Generación prevista usada: predicción del ' + U.fmtDate(P.date) + ' desde las ' + U.p2(P.hour) + ':00 (<a href="#" data-go="prediccion">cambiar en Predicción solar</a>).' : 'Se calculará una predicción con valores típicos de hoy a las 09:00; puede ajustarla en Predicción solar.') + '</p>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary btn-lg" id="dec-go">🔋 CALCULAR DECISIÓN</button></div></div>';
      if (d) h += V.decisionBody(S);
      el.innerHTML = h;
      var read = function () {
        var o = {};
        U.$$('[data-di]', el).forEach(function (x) { var k = x.getAttribute('data-di'); o[k] = x.value === '' ? (k === 'hoursLeft' ? null : 0) : +x.value; });
        return o;
      };
      var valid = function (o) {
        var err = [];
        if (!(o.capKWh > 0)) err.push('La capacidad de batería debe ser mayor que 0.');
        if (!(o.socNow >= 0 && o.socNow <= 100)) err.push('El SOC actual debe estar entre 0 y 100 %.');
        if (!(o.socMin >= 0 && o.socMin < 100)) err.push('El SOC mínimo debe estar entre 0 y 99 %.');
        if (!(o.effBat > 0 && o.effBat <= 100) || !(o.effInv > 0 && o.effInv <= 100)) err.push('Las eficiencias deben estar entre 1 y 100 %.');
        if (!(o.nightLoad >= 0)) err.push('El consumo nocturno no puede ser negativo.');
        if (!(o.margin >= 0)) err.push('El margen de seguridad no puede ser negativo.');
        if (o.hoursLeft != null && !(o.hoursLeft >= 0 && o.hoursLeft <= 24)) err.push('Las horas restantes deben estar entre 0 y 24.');
        if (!(o.costBackup >= 0) || !(o.costUnserved >= 0)) err.push('Los costos no pueden ser negativos.');
        return err;
      };
      U.$('#dec-go').onclick = async function () {
        var o = read(), err = valid(o);
        if (err.length) { U.modal({ title: 'Revise las entradas', icon: '⚠\uFE0F', html: '<ul>' + err.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' }); return; }
        if (await SEDA.App.decide(o)) { U.toast('Decisión calculada.', 'good'); V.decision.render(el); }
      };
      if (nl) {
        U.$('#nl-mean').onclick = function () { U.$('[data-di="nightLoad"]', el).value = Math.round(nl.mean * 10) / 10; };
        U.$('#nl-p90').onclick = function () { U.$('[data-di="nightLoad"]', el).value = Math.round(nl.p90 * 10) / 10; };
      }
      if (d) {
        V.mountDecisionCharts(S);
        if (opts && opts.anchor) { var a = U.$('#' + opts.anchor); if (a) setTimeout(function () { a.scrollIntoView({ behavior: 'smooth' }); }, 60); }
      }
    }
  };
  V.decisionBody = function (S) {
    var d = S.decision, r = d.result, i = r.inputs, rel = d.reliability;
    var h = '<div class="big-result" style="margin-top:16px"><div><div class="br-l">Energía a reservar</div><div class="br-v">' + U.fmt(r.Eres, 1) + ' kWh</div><div class="small ink2">Reserva recomendada al inicio de la noche</div></div>' +
      '<div><div class="br-l">SOC objetivo</div><div class="br-v">' + U.fmt(r.socObj, 0) + ' %</div><div class="small ink2">SOC proyectado al anochecer: ' + U.fmt(r.nom.socSun, 0) + ' %</div></div>' +
      '<div style="background:var(--surface);border-color:var(--line)"><div class="br-l" style="color:var(--ink-2)">Riesgo de insuficiencia energética</div><div style="margin-top:8px">' + V.riskPill(r.risk) + '</div><div class="small ink2" style="margin-top:6px">' + U.esc(r.rule) + '</div></div></div>';
    h += '<div class="grid g2"><div class="card"><h3>Resultados del cálculo</h3>' + U.table(['Magnitud', 'Valor'], [
      ['Generación solar esperada (horas restantes)', '<b>' + U.fmt(r.gen, 1) + ' kWh</b>'],
      ['Eficiencia global η = η<sub>bat</sub> × η<sub>inv</sub>', U.fmtPct(r.eta * 100, 1)],
      ['Energía nocturna requerida', U.fmt(r.Ereq, 1) + ' kWh'],
      ['Energía mínima de reserva (SOC mínimo)', U.fmt(r.Emin, 1) + ' kWh'],
      ['Reserva recomendada', '<b>' + U.fmt(r.Eres, 1) + ' kWh</b>'],
      ['SOC recomendado (objetivo)', '<b>' + U.fmt(r.socObj, 1) + ' %</b>' + (r.socObjRaw > 100 ? ' <span class="status-bad">(requiere ' + U.fmt(r.socObjRaw, 0) + ' %)</span>' : '')],
      ['Energía almacenada actual', U.fmt(r.Enow, 1) + ' kWh (SOC ' + i.socNow + ' %)'],
      ['Energía cargada con el excedente solar', U.fmt(r.nom.charge, 1) + ' kWh' + (r.nom.spill > 0.05 ? ' · no almacenable ' + U.fmt(r.nom.spill, 1) + ' kWh' : '')],
      ['Energía al anochecer (SOC proyectado)', U.fmt(r.nom.Esun, 1) + ' kWh (' + U.fmt(r.nom.socSun, 1) + ' %)'],
      ['Energía disponible para la noche', U.fmt(r.nom.Eavail, 1) + ' kWh'],
      ['Margen disponible (disponible − reserva)', '<b class="' + (r.nom.margin >= 0 ? 'status-ok' : 'status-bad') + '">' + (r.nom.margin >= 0 ? '+' : '') + U.fmt(r.nom.margin, 1) + ' kWh</b>'],
      ['Energía adicional para alcanzar el SOC objetivo', U.fmt(r.deficit, 1) + ' kWh']
    ], { compact: true }) + '</div>';
    h += '<div class="card"><h3>Ecuaciones (valores de esta operación)</h3><div class="eq">' +
      'η<sub>global</sub> = ' + U.fmt(i.effBat / 100, 3) + ' × ' + U.fmt(i.effInv / 100, 3) + ' = <b>' + U.fmt(r.eta, 4) + '</b><br>' +
      'Energía nocturna requerida = Consumo nocturno / eficiencia global<br>&nbsp;&nbsp;= ' + U.fmt(+i.nightLoad, 2) + ' / ' + U.fmt(r.eta, 4) + ' = <span class="r">' + U.fmt(r.Ereq, 2) + ' kWh</span><br>' +
      'Reserva recomendada = Energía nocturna requerida × (1 + margen de seguridad)<br>&nbsp;&nbsp;= ' + U.fmt(r.Ereq, 2) + ' × (1 + ' + U.fmt(i.margin / 100, 2) + ') = <span class="r">' + U.fmt(r.Eres, 2) + ' kWh</span><br>' +
      'SOC objetivo = SOC<sub>mín</sub> + Reserva / Capacidad × 100 = ' + i.socMin + ' + ' + U.fmt(r.Eres, 2) + ' / ' + U.fmt(+i.capKWh, 1) + ' × 100 = <span class="r">' + U.fmt(r.socObjRaw, 1) + ' %</span>' + (r.socObjRaw > 100 ? ' → 100 %' : '') + '<br>' +
      'E<sub>anochecer</sub> = ' + (r.nom.net >= 0 ? 'E<sub>actual</sub> + mín[(E<sub>FV</sub> − C<sub>día</sub>)·η<sub>bat</sub>, libre] = ' + U.fmt(r.Enow, 2) + ' + mín[(' + U.fmt(r.gen, 2) + ' − ' + U.fmt(+(i.dayLoad || 0), 2) + ')·' + U.fmt(i.effBat / 100, 2) + ', ' + U.fmt(+i.capKWh - r.Enow, 2) + ']' :
        'E<sub>actual</sub> − (C<sub>día</sub> − E<sub>FV</sub>)/η<sub>global</sub> = ' + U.fmt(r.Enow, 2) + ' − (' + U.fmt(+(i.dayLoad || 0), 2) + ' − ' + U.fmt(r.gen, 2) + ')/' + U.fmt(r.eta, 3)) + ' = <span class="r">' + U.fmt(r.nom.Esun, 2) + ' kWh</span><br>' +
      'Energía disponible = E<sub>anochecer</sub> − E<sub>mín</sub> = ' + U.fmt(r.nom.Esun, 2) + ' − ' + U.fmt(r.Emin, 2) + ' = <span class="r">' + U.fmt(r.nom.Eavail, 2) + ' kWh</span><br>' +
      'Cobertura = Disponible / Reserva = ' + U.fmt(r.nom.Eavail, 2) + ' / ' + U.fmt(r.Eres, 2) + ' = <span class="r">' + U.fmtCover(r.nom.cover) + ' %</span><br>' +
      'Cobertura conservadora (E<sub>FV</sub> × (1 − ' + U.fmt(r.errRel, 3) + ')) = <span class="r">' + U.fmtCover(r.cons.cover) + ' %</span></div></div></div>';
    h += '<div class="grid g2"><div class="card"><div class="card-head"><h3>⚠ RIESGO DE INSUFICIENCIA ENERGÉTICA</h3>' + V.riskPill(r.risk) + '</div>' + U.table(['Componente', 'Valor'], [
      ['Energía disponible para la noche (esperada)', U.fmt(r.nom.Eavail, 1) + ' kWh'], ['Energía disponible (conservadora)', U.fmt(r.cons.Eavail, 1) + ' kWh'],
      ['Demanda esperada (energía nocturna requerida)', U.fmt(r.Ereq, 1) + ' kWh'], ['Reserva recomendada', U.fmt(r.Eres, 1) + ' kWh'],
      ['Margen disponible', (r.nom.margin >= 0 ? '+' : '') + U.fmt(r.nom.margin, 1) + ' kWh'], ['Error histórico del modelo (WAPE diario)', U.fmtPct(r.errRel * 100, 1)],
      ['Regla aplicada', U.esc(r.rule)]
    ], { compact: true }) + '<p class="small muted" style="margin-top:8px">Reglas: R1 ALTO si la reserva supera la capacidad útil · R2 ALTO si la cobertura esperada &lt; 100 % · R3 MODERADO si solo la cobertura conservadora &lt; 100 % · R4 BAJO si la cobertura conservadora ≥ 100 % · R5 BAJO→MODERADO si la confiabilidad &lt; 50. <b>El nivel de riesgo es una clasificación por reglas, no una probabilidad estadística.</b></p></div>';
    h += '<div class="card"><div class="card-head"><h3>🛡 ÍNDICE DE CONFIABILIDAD: ' + U.fmt(rel.score, 0) + ' / 100 (' + rel.level + ')</h3></div>' + V.meter(rel.score, V.qualityColor(rel.score)) + U.table(['Componente', 'Cálculo', 'Peso', 'Valor'], [
      ['A — Error histórico', '1 − WAPE del RF en prueba', '0.30', U.fmt(rel.comp.A, 3)], ['D — Cantidad de datos', 'mín(1, ' + rel.days + ' días / 365)', '0.15', U.fmt(rel.comp.D, 3)],
      ['Q — Calidad de datos', 'Calidad / 100', '0.20', U.fmt(rel.comp.Q, 3)], ['S — Similitud de condiciones', rel.comp.S == null ? 'no evaluada (sin predicción)' : 'entradas en rango P1–P99', '0.20', rel.comp.S == null ? '—' : U.fmt(rel.comp.S, 3)],
      ['T — Cobertura temporal', rel.months + ' meses / 12', '0.15', U.fmt(rel.comp.T, 3)]
    ], { numCols: [2, 3], compact: true }) + '<p class="small muted" style="margin-top:8px">Índice = 100 × Σ w·c / Σ w. Es un indicador de solidez del análisis, <b>no una probabilidad estadística</b>.</p></div></div>';
    h += V.backtestHTML(SEDA.App.backtest());
    h += '<div class="card" id="recomendaciones"><div class="card-head"><h2>💡 RECOMENDACIÓN DE OPERACIÓN</h2></div><div class="narrative">' + U.esc(d.narrative) + '</div><div style="margin-top:12px">' + V.recoHTML(d.recos) + '</div>' +
      '<p class="small muted">Cada recomendación se deriva de los resultados calculados mediante la regla indicada en su pie.</p></div>';
    h += '<h2 style="margin-top:22px">📊 RECOMENDACIONES VISUALES</h2>';
    h += '<div class="grid g2">' + C.card('rv1', 'Gráfico 1 · Generación solar histórica', 'Energía FV diaria [kWh]', 260) + C.card('rv2', 'Gráfico 2 · Predicción vs generación real', 'Primeros 7 días del conjunto de prueba', 260) + '</div>';
    h += '<div class="grid g2">' + C.card('rv3', 'Gráfico 3 · Irradiancia vs generación', '', 260) + C.card('rv4', 'Gráfico 4 · Velocidad del viento vs generación', 'Horas diurnas', 260) + '</div>';
    h += '<div class="grid g2">' + C.card('rv5', 'Gráfico 5 · Temperatura vs generación', 'Horas diurnas', 260) + C.card('rv6', 'Gráfico 6 · Humedad vs generación', 'Horas diurnas', 260) + '</div>';
    h += '<div class="grid g2">' + C.card('rv7', 'Gráfico 7 · Energía necesaria vs energía disponible', 'Escenario esperado y conservador', 260) + C.card('rv8', 'Gráfico 8 · SOC actual vs SOC recomendado', '', 260) + '</div>';
    h += '<div class="grid g2">' + C.card('rv9', 'Gráfico 9 · Reserva de batería recomendada', 'Composición de la reserva [kWh]', 200) + C.card('rv10', 'Gráfico 10 · Riesgo energético', 'Cobertura de la reserva recomendada', 200, 'Verde: cubierta · Amarillo: solo cubierta en el escenario esperado · Rojo: no cubierta. Siempre acompañado del nivel de riesgo en texto.') + '</div>';
    h += '<div class="btn-row" style="margin-top:16px"><button class="btn btn-accent btn-lg" data-action="simulate">🧪 SIMULAR ESCENARIOS →</button><button class="btn btn-lg" data-action="report">📄 GENERAR INFORME</button></div>';
    return h;
  };
  V.cop = function (v) { return isFinite(v) ? (v < 0 ? '−' : '') + 'COP ' + U.fmtInt(Math.abs(Math.round(v))) : '—'; };
  /* Backtest de la decisión: tabla comparativa en unidades del negocio (kWh, noches, COP) */
  V.backtestHTML = function (bt) {
    if (!bt || !bt.methods.length) return '';
    var rf = bt.by.rf;
    var rows = bt.methods.map(function (m) {
      var b = m.id === 'rf' ? function (x) { return '<b>' + x + '</b>'; } : function (x) { return x; };
      return [b(U.esc(m.label)), b(U.fmtInt(m.nightsShort)), b(U.fmt(m.shortKWh, 1)), b(U.fmtInt(m.daysBackup)), b(U.fmt(m.backupKWh, 1)), b(V.cop(m.cost)), b(V.cop(m.costYear)), m.id === 'rf' || !rf ? '—' : V.cop(m.costYear - rf.costYear)];
    });
    var verdict = isFinite(bt.savingVsPe) ? (bt.savingVsPe > 0 ?
      '<div class="alert good"><span class="ai">✔</span><div>Decidiendo con el modelo, el costo anual estimado baja <b>' + V.cop(bt.savingVsPe) + '</b> frente a la persistencia' + (isFinite(bt.savingVsFixed) ? ' y <b>' + V.cop(bt.savingVsFixed) + '</b> frente a la regla fija' : '') + ', con ' + rf.nightsShort + ' noches con déficit en ' + bt.n + ' días (persistencia: ' + bt.by.pe.nightsShort + ').</div></div>' :
      '<div class="alert warn"><span class="ai">⚠</span><div>En este periodo el modelo <b>no</b> reduce el costo frente a la persistencia (diferencia ' + V.cop(bt.savingVsPe) + '/año). No se recomienda cambiar la regla de operación con estos datos.</div></div>') : '';
    return '<div class="card" id="backtest"><div class="card-head"><h2>💲 EVALUACIÓN DE LA DECISIÓN EN DATOS DE PRUEBA (BACKTEST)</h2></div>' +
      '<p class="small ink2">Se repite la decisión de la mañana en cada uno de los <b>' + bt.n + ' días de prueba</b> (' + U.fmtDate(bt.start) + ' → ' + U.fmtDate(bt.end) + ') con la energía FV diaria que habría previsto cada regla, y se compara con lo que realmente ocurrió. ' +
      'Si la previsión indica que no se alcanza la reserva, se programa respaldo; si la generación real resulta menor que la prevista, la noche queda con déficit.</p>' + verdict +
      U.table(['Regla de previsión', 'Noches con déficit', 'Energía no servida [kWh]', 'Días con respaldo', 'Respaldo programado [kWh]', 'Costo en prueba', 'Costo anual estimado', 'Sobrecosto anual vs modelo'], rows, { numCols: [1, 2, 3, 4, 5, 6, 7], compact: true }) +
      '<div class="eq" style="margin-top:10px">Respaldo programado B = mín(Reserva − Disponible(Ê), capacidad libre) si Disponible(Ê) &lt; Reserva<br>Disponible real = mín(Disponible(E<sub>real</sub>) + B, capacidad útil)<br>Déficit nocturno = máx(0, Energía nocturna requerida − Disponible real) × η<sub>global</sub><br>Costo = B × ' + V.cop(bt.costBackup) + '/kWh + Déficit × ' + V.cop(bt.costUnserved) + '/kWh · Costo anual = costo en prueba / ' + bt.n + ' días × 365</div>' +
      '<p class="small muted" style="margin-top:8px">Supuestos: cada día inicia con el SOC actual configurado; se usa la generación del día completo; consumos y eficiencias constantes; regla fija = energía diaria media del entrenamiento (' + U.fmt(bt.trainMean, 1) + ' kWh/día). Los costos por kWh son supuestos editables arriba. La previsión perfecta es solo una referencia del mínimo alcanzable.</p></div>';
  };
  V.mountDecisionCharts = function (S) {
    var pr = S.processed, d = S.decision;
    C.mount(U.$('#rv1'), SP.dailyEnergy(SEDA.App.daily()));
    C.mount(U.$('#rv2'), SP.testSeries(S.evaluation, 7));
    C.mount(U.$('#rv3'), SP.scatterVs(pr, pr.vars.IRRADIANCIA ? 'IRRADIANCIA' : 'IRR_POA', 2500));
    C.mount(U.$('#rv4'), SP.scatterVs(pr, 'VEL_VIENTO', 2500));
    C.mount(U.$('#rv5'), SP.scatterVs(pr, 'TEMPERATURA', 2500));
    C.mount(U.$('#rv6'), SP.scatterVs(pr, 'HUMEDAD', 2500));
    C.mount(U.$('#rv7'), SP.energyBalance(d));
    C.mount(U.$('#rv8'), SP.soc(d));
    C.mount(U.$('#rv9'), SP.reserve(d));
    C.mount(U.$('#rv10'), SP.risk(d));
  };

  /* ================= ESCENARIOS ================= */
  var custom = null;
  V.escenarios = {
    render: function (el) {
      var S = st();
      var h = V.head('¿Qué pasaría si? — Simulador de escenarios', 'Evalúe cómo cambian la generación, la reserva, el SOC y el riesgo ante variaciones meteorológicas, de consumo o de batería. Cada escenario vuelve a ejecutar el Random Forest y la decisión.');
      if (!S.decision) { el.innerHTML = h + V.empty('🧪', 'Sin decisión calculada', 'Calcule primero la decisión energética (escenario base).', '<button class="btn btn-primary" data-action="decide">CALCULAR DECISIÓN</button>'); return; }
      var base = S.decision.inputs;
      custom = Object.assign({ irrPct: 0, tempDelta: 0, windPct: 0, humDelta: 0, loadPct: 0, cap: +base.capKWh, margin: +base.margin }, (S.scenarios && S.scenarios.custom) || {});
      var rr = function (k, label, min, max, step, unit) {
        return '<div class="range-row"><label for="sc-' + k + '">' + label + '</label><input type="range" id="sc-' + k + '" data-sc="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + custom[k] + '"><output id="so-' + k + '">' + (custom[k] > 0 && unit !== 'kWh' && unit !== '%abs' ? '+' : '') + custom[k] + ' ' + (unit === '%abs' ? '%' : unit) + '</output></div>';
      };
      h += '<div class="card"><div class="card-head"><h3>Escenario personalizado</h3><div class="ch-actions"><button class="btn btn-sm" id="sc-reset">↺ Restablecer</button></div></div><div class="grid g2"><div class="stack">' +
        rr('irrPct', 'Irradiancia ± %', -60, 30, 5, '%') + rr('tempDelta', 'Temperatura ± °C', -10, 10, 0.5, '°C') + rr('windPct', 'Viento ± %', -60, 60, 5, '%') + rr('humDelta', 'Humedad ± puntos %', -30, 30, 1, 'pp') + '</div><div class="stack">' +
        rr('loadPct', 'Consumo nocturno ± %', -50, 60, 5, '%') + rr('cap', 'Capacidad de batería', Math.max(5, Math.round(base.capKWh * 0.25)), Math.round(base.capKWh * 2.5), 1, 'kWh') + rr('margin', 'Margen de seguridad', 0, 60, 1, '%abs') + '</div></div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-lg" id="sc-go">🧪 SIMULAR ESCENARIO</button></div></div>';
      var L = S.scenarios ? S.scenarios.list : null;
      if (L) {
        /* good = true si un aumento es favorable */
        var dd = function (v, d, upGood) {
          if (upGood === undefined) upGood = true;
          if (!isFinite(v) || Math.abs(v) < 1e-9) return '<span class="muted">0</span>';
          return '<span class="' + ((v > 0) === upGood ? 'status-ok' : 'status-bad') + '">' + (v > 0 ? '+' : '') + U.fmt(v, d) + '</span>';
        };
        h += '<div class="card"><h3>Resultados por escenario</h3>' + U.table(['Escenario', 'Gen. [kWh]', 'Δ gen.', 'Reserva [kWh]', 'Δ res.', 'SOC obj. [%]', 'SOC anoch. [%]', 'Δ SOC', 'Cobertura', 'Riesgo'], L.map(function (s) {
          return ['<b>' + U.esc(s.name) + '</b>', U.fmt(s.gen, 1), dd(s.dGen, 1), U.fmt(s.reserve, 1), dd(s.dRes, 1, false),U.fmt(s.socObj, 0), U.fmt(s.socSun, 0), dd(s.dSoc, 1), U.fmtCover(s.cover) + ' %', V.riskPill(s.risk)];
        }), { numCols: [1, 2, 3, 4, 5, 6, 7, 8], compact: true }) + '<p class="small muted" style="margin-top:8px">Diferencias respecto al escenario actual (base). En Δ reserva, rojo indica que se necesita más reserva.</p></div>';
        h += '<div class="grid g2">' + C.card('sc-gen', 'Generación esperada y reserva por escenario', '[kWh]', 300) + C.card('sc-soc', 'SOC proyectado al anochecer vs SOC objetivo', '[%]', 300) + '</div>';
        h += '<div style="margin-top:16px">' + C.card('sc-risk', 'Riesgo por escenario', 'Cobertura de la reserva con la generación esperada', Math.max(220, 42 * L.length + 60)) + '</div>';
      }
      el.innerHTML = h;
      U.$$('[data-sc]', el).forEach(function (x) {
        x.oninput = function () { var k = x.getAttribute('data-sc'); custom[k] = +x.value; var unit = { irrPct: '%', tempDelta: '°C', windPct: '%', humDelta: 'pp', loadPct: '%', cap: 'kWh', margin: '%' }[k]; U.$('#so-' + k).textContent = (custom[k] > 0 && k !== 'cap' && k !== 'margin' ? '+' : '') + custom[k] + ' ' + unit; };
      });
      U.$('#sc-reset').onclick = function () { custom = null; if (S.scenarios) S.scenarios.custom = {}; V.escenarios.render(el); };
      U.$('#sc-go').onclick = function () {
        var mods = Object.assign({}, custom);
        if (mods.cap === +base.capKWh) delete mods.cap;
        if (mods.margin === +base.margin) delete mods.margin;
        if (SEDA.App.simulate(mods)) { U.toast('Escenarios simulados.', 'good'); V.escenarios.render(el); }
      };
      if (L) { C.mount(U.$('#sc-gen'), SP.scenGen(L)); C.mount(U.$('#sc-soc'), SP.scenSOC(L)); C.mount(U.$('#sc-risk'), SP.scenRisk(L)); }
    }
  };
})();
