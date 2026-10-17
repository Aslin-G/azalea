/* ==========================================================================
   views-model.js — Configuración y entrenamiento del Random Forest,
   división cronológica, validación, importancia de variables y evaluación.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U, C = SEDA.Charts, SP = SEDA.Specs, M = SEDA.Mapping, ML = SEDA.ML;
  var V = SEDA.Views = SEDA.Views || {};
  var st = function () { return SEDA.state; };
  var training = false;

  V.splitBar = function (sp) {
    var pct = function (n) { return U.fmt(n / sp.m * 100, 0) + ' %'; };
    return '<div class="splitbar"><div class="s-train" style="flex:' + sp.train.n + '">ENTRENAMIENTO<small>' + pct(sp.train.n) + '</small></div><div class="s-val" style="flex:' + sp.val.n + '">VALIDACIÓN<small>' + pct(sp.val.n) + '</small></div><div class="s-test" style="flex:' + sp.test.n + '">PRUEBA<small>' + pct(sp.test.n) + '</small></div></div>' +
      U.table(['Conjunto', 'Registros', 'Desde', 'Hasta', 'Uso'], [
        ['<b>Entrenamiento</b>', U.fmtInt(sp.train.n), U.fmtDateTime(sp.train.start), U.fmtDateTime(sp.train.end), 'Ajuste de los árboles'],
        ['<b>Validación</b>', U.fmtInt(sp.val.n), U.fmtDateTime(sp.val.start), U.fmtDateTime(sp.val.end), 'Selección de hiperparámetros'],
        ['<b>Prueba</b>', U.fmtInt(sp.test.n), U.fmtDateTime(sp.test.start), U.fmtDateTime(sp.test.end), 'Evaluación final (datos no vistos)']
      ], { numCols: [1], compact: true });
  };
  V.previewSplit = function (pr, feats) {
    var ds = ML.buildDataset(pr, feats, pr.targetKey), sp = ML.chronoSplit(ds.m);
    var mk = function (a, b) { return { n: b - a, start: ds.t[a], end: ds.t[b - 1] }; };
    return { m: ds.m, excluded: ds.excluded, train: mk(sp.train[0], sp.train[1]), val: mk(sp.val[0], sp.val[1]), test: mk(sp.test[0], sp.test[1]) };
  };

  /* ================= MODELO ================= */
  V.modelo = {
    render: function (el, opts) {
      var S = st(), pr = S.processed;
      var h = V.head('Machine Learning — Random Forest Regressor', 'Configure las variables y los parámetros, revise la división cronológica y entrene el modelo. Todo el cálculo ocurre en este navegador.');
      if (!pr) { el.innerHTML = h + V.empty('🤖', 'Datos no procesados', 'Primero valide y limpie los datos.', '<button class="btn btn-primary" data-action="clean">LIMPIAR DATOS</button>'); return; }
      var avail = ML.available(pr);
      if (!S.features) S.features = avail.slice();
      S.features = S.features.filter(function (f) { return avail.indexOf(f) >= 0; });
      var p = S.mlParams, tk = pr.targetKey;
      var fck = function (f) { return '<label class="check" style="padding:3px 0"><input type="checkbox" data-feat="' + f + '"' + (S.features.indexOf(f) >= 0 ? ' checked' : '') + '><span>' + U.esc(ML.flabel(f)) + '</span></label>'; };
      var meteo = avail.filter(function (f) { return ML.FEAT[f].group === 'meteo'; }), tim = avail.filter(function (f) { return ML.FEAT[f].group === 'tiempo'; });
      h += '<div class="grid g2"><div class="card"><div class="card-head"><h3>PASO 6 · Configurar Machine Learning</h3></div>' +
        '<p><b>Variable objetivo:</b> ' + (tk === 'POTENCIA_FV' ? 'POTENCIA FV [kW]' : 'ENERGÍA FV [kWh por intervalo]') + ' <span class="small muted">(seleccionada automáticamente: ' + (tk === 'POTENCIA_FV' ? 'existe una columna de potencia' : 'no hay potencia; se usa energía') + ')</span></p>' +
        '<div class="grid g2" style="gap:8px"><div><h4>Variables meteorológicas</h4>' + meteo.map(fck).join('') + '</div><div><h4>Variables temporales (cíclicas)</h4>' + tim.map(fck).join('') + '</div></div>' +
        '<div class="btn-row small" style="margin-top:6px"><button class="btn btn-sm" id="f-all">Todas</button><button class="btn btn-sm" id="f-meteo">Solo meteorológicas + cíclicas</button></div>' +
        '<p class="small muted" style="margin-top:6px">Solo se ofrecen variables con ≥ 80 % de datos válidos. La dirección del viento entra como seno/coseno (variable circular). hora_seno = sen(2π·h/24), dia_año_seno = sen(2π·(d−1)/365.25).</p></div>';
      h += '<div class="card"><div class="card-head"><h3>Parámetros del Random Forest</h3></div><div class="form-grid">' +
        '<label class="f">Número de árboles<input type="number" id="p-trees" min="1" max="500" value="' + p.nTrees + '"></label>' +
        '<label class="f">Profundidad máxima<input type="number" id="p-depth" min="1" max="30" value="' + p.maxDepth + '"></label>' +
        '<label class="f">Min samples leaf<input type="number" id="p-leaf" min="1" max="200" value="' + p.minLeaf + '"></label>' +
        '<label class="f">max_features<select id="p-mf">' + [['1.0', '1.0 (todas)'], ['sqrt', 'sqrt'], ['third', '1/3'], ['0.5', '0.5']].map(function (o) { return '<option value="' + o[0] + '"' + (String(p.maxFeatures) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f">Semilla aleatoria<input type="number" id="p-seed" value="' + p.seed + '"></label>' +
        '<label class="check" style="align-self:end"><input type="checkbox" id="p-boot"' + (p.bootstrap ? ' checked' : '') + '><span>Bootstrap</span></label></div>' +
        '<div id="pre-summary" style="margin-top:12px"></div></div></div>';
      h += '<div class="card"><div class="card-head"><h3>División cronológica 60 / 20 / 20</h3><span class="small muted">Ordenado por fecha + hora. Nunca se usa división aleatoria.</span></div><div id="split-box"></div></div>';
      h += '<div class="card"><div class="card-head"><h3>PASO 7 · Entrenamiento</h3></div>' +
        '<div class="btn-row"><button class="btn btn-primary btn-lg" id="train-btn">🤖 ENTRENAR MACHINE LEARNING</button><span id="train-status" class="small ink2"></span></div>' +
        '<div class="progress" style="margin-top:12px"><div id="train-bar"></div></div><div id="train-result" style="margin-top:12px"></div></div>';
      h += '<div id="post-train"></div>';
      el.innerHTML = h;

      var updatePre = function () {
        var sp = V.previewSplit(pr, S.features);
        U.$('#pre-summary').innerHTML = U.table(['Antes del entrenamiento', 'Valor'], [
          ['Registros de entrenamiento', U.fmtInt(sp.train.n) + ' <span class="small muted">(de ' + U.fmtInt(sp.m) + ' completos; ' + U.fmtInt(sp.excluded) + ' excluidos por faltantes)</span>'],
          ['Variables', S.features.length + ''], ['Variable objetivo', M.label(tk) + ' [' + SP.tUnit(tk) + ']'],
          ['Número de árboles', String(p.nTrees)], ['Profundidad máxima', String(p.maxDepth)], ['Min samples leaf', String(p.minLeaf)]
        ], { compact: true });
        U.$('#split-box').innerHTML = sp.m >= 10 ? V.splitBar(sp) : '<div class="alert crit"><span class="ai">⛔</span><div>Muy pocos registros completos con las variables seleccionadas.</div></div>';
      };
      var readParams = function () {
        p.nTrees = U.clamp(Math.round(+U.$('#p-trees').value || 100), 1, 500);
        p.maxDepth = U.clamp(Math.round(+U.$('#p-depth').value || 10), 1, 30);
        p.minLeaf = U.clamp(Math.round(+U.$('#p-leaf').value || 2), 1, 200);
        p.maxFeatures = U.$('#p-mf').value; p.seed = Math.round(+U.$('#p-seed').value || 42); p.bootstrap = U.$('#p-boot').checked;
        SEDA.App.persist();
      };
      U.$$('input[id^="p-"], select[id^="p-"]', el).forEach(function (x) { x.onchange = function () { readParams(); updatePre(); }; });
      U.$$('[data-feat]', el).forEach(function (x) {
        x.onchange = function () {
          var f = x.getAttribute('data-feat');
          if (x.checked && S.features.indexOf(f) < 0) S.features.push(f);
          if (!x.checked) S.features = S.features.filter(function (y) { return y !== f; });
          S.features.sort(function (a, b) { return ML.ORDER.indexOf(a) - ML.ORDER.indexOf(b); });
          SEDA.App.persist(); updatePre();
        };
      });
      U.$('#f-all').onclick = function () { S.features = avail.slice(); V.modelo.render(el); };
      U.$('#f-meteo').onclick = function () { S.features = avail.filter(function (f) { return ML.FEAT[f].group === 'meteo' || /_SIN|_COS/.test(f); }); V.modelo.render(el); };
      updatePre();
      var showPost = function () {
        if (!S.model) return;
        var m = S.model, ev = S.evaluation;
        U.$('#train-bar').style.width = '100%';
        U.$('#train-result').innerHTML = '<div class="alert good"><span class="ai">✔</span><div><b>MODELO ENTRENADO ✓</b> — tiempo de entrenamiento: <b>' + U.fmt(m.trainMs / 1000, 2) + ' s</b> · ' + m.params.nTrees + ' árboles · ' + U.fmtInt(m.nodes) + ' nodos · ' + m.features.length + ' variables · ' + U.fmtInt(ev.split.train.n) + ' registros de entrenamiento · semilla ' + m.params.seed + '</div></div>';
        var mv = ev.metrics.val, conv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
        var post = '<div class="grid g2"><div class="card"><div class="card-head"><h3>PASO 8 · Validación</h3><span class="small muted">Conjunto de validación (' + U.fmtInt(ev.split.val.n) + ' registros)</span></div>' +
          U.table(['Modelo', 'MAE [kW]', 'RMSE [kW]', 'MAPE [%]', 'R²'], [
            ['<b>Random Forest</b>', U.fmt(conv(mv.rf.mae), 3), U.fmt(conv(mv.rf.rmse), 3), U.fmt(mv.rf.mape, 1), U.fmt(mv.rf.r2, 3)],
            ['Persistencia 24 h', U.fmt(conv(mv.pers.mae), 3), U.fmt(conv(mv.pers.rmse), 3), U.fmt(mv.pers.mape, 1), U.fmt(mv.pers.r2, 3)]
          ], { numCols: [1, 2, 3, 4], compact: true }) +
          '<p class="small muted" style="margin-top:8px">Entrenamiento: MAE ' + U.fmt(conv(ev.metrics.train.rf.mae), 3) + ' kW, RMSE ' + U.fmt(conv(ev.metrics.train.rf.rmse), 3) + ' kW (una diferencia grande con validación indicaría sobreajuste).</p>' +
          '<h4 style="margin-top:12px">Ajuste de hiperparámetros con validación</h4><p class="small ink2">Prueba profundidades 4–16 con 30 árboles y elige la de menor RMSE en validación (la prueba no se usa).</p>' +
          '<div class="btn-row"><button class="btn" id="tune-btn">Ajustar profundidad con validación</button><span id="tune-status" class="small ink2"></span></div><div id="tune-box" style="margin-top:10px"></div>' +
          '<div class="btn-row" style="margin-top:12px"><button class="btn btn-accent" data-action="evaluate">📈 EVALUAR MODELO →</button></div></div>' +
          '<div>' + C.card('imp-chart', 'IMPORTANCIA DE VARIABLES', 'Reducción media de impureza (MDI), normalizada a 100 %', Math.max(260, 26 * m.features.length + 60), '<b>La importancia de una variable no implica causalidad.</b> Refleja cuánto usa el modelo cada variable para reducir el error; variables correlacionadas se reparten la importancia.') + '</div></div>';
        U.$('#post-train').innerHTML = post;
        C.mount(U.$('#imp-chart'), SP.importance(m));
        var renderTune = function () {
          if (!S.tuning) return;
          var best = S.tuning.reduce(function (a, b) { return b.rmse < a.rmse ? b : a; });
          U.$('#tune-box').innerHTML = U.table(['Profundidad', 'Min hoja', 'MAE val. [kW]', 'RMSE val. [kW]', 'R²'], S.tuning.map(function (r) {
            var b = r === best;
            return [(b ? '★ ' : '') + r.params.maxDepth, r.params.minLeaf, U.fmt(conv(r.mae), 3), (b ? '<b>' : '') + U.fmt(conv(r.rmse), 3) + (b ? '</b>' : ''), U.fmt(r.r2, 4)];
          }), { numCols: [0, 1, 2, 3, 4], compact: true }) + '<div class="btn-row" style="margin-top:8px"><button class="btn btn-sm btn-primary" id="tune-apply">Aplicar profundidad ' + best.params.maxDepth + ' y reentrenar</button></div>';
          U.$('#tune-apply').onclick = function () { S.mlParams.maxDepth = best.params.maxDepth; S.mlParams.minLeaf = best.params.minLeaf; V.modelo.render(el, { autoTrain: true }); };
        };
        renderTune();
        U.$('#tune-btn').onclick = async function () {
          var b = this; b.disabled = true;
          var grid = [4, 6, 8, 10, 12, 16].map(function (d) { return { maxDepth: d, minLeaf: S.mlParams.minLeaf, nTrees: 30 }; });
          S.tuning = await ML.tune(pr, S.features, S.mlParams, grid, function (a, n) { U.$('#tune-status').textContent = 'Evaluando ' + a + ' / ' + n + '…'; });
          U.$('#tune-status').textContent = 'Listo.';
          b.disabled = false; SEDA.App.persist(); renderTune();
        };
      };
      var doTrain = async function () {
        if (training) return;
        if (!S.features.length) { U.toast('Seleccione al menos una variable de entrada.', 'warn'); return; }
        readParams();
        training = true;
        var btn = U.$('#train-btn'); btn.disabled = true;
        U.$('#train-result').innerHTML = ''; U.$('#post-train').innerHTML = '';
        U.$('#train-status').textContent = 'Entrenando…';
        var ok = await SEDA.App.train(function (a, n) {
          var bar = U.$('#train-bar'); if (bar) bar.style.width = (a / n * 100) + '%';
          var s = U.$('#train-status'); if (s) s.textContent = 'Árbol ' + a + ' de ' + n + '…';
        });
        training = false;
        if (!U.$('#train-btn')) return;
        btn.disabled = false;
        U.$('#train-status').textContent = ok ? 'Entrenamiento completado.' : 'Error en el entrenamiento.';
        if (ok) { U.toast('MODELO ENTRENADO ✓ en ' + U.fmt(S.model.trainMs / 1000, 2) + ' s', 'good'); showPost(); }
      };
      U.$('#train-btn').onclick = doTrain;
      if (S.model) showPost();
      if (opts && opts.autoTrain) doTrain();
    }
  };

  /* ================= EVALUACIÓN ================= */
  V.evaluacion = {
    render: function (el) {
      var S = st(), ev = S.evaluation;
      var h = V.head('Evaluación del modelo', 'Comparación del Random Forest con la línea base de persistencia. <b>Evaluación realizada sobre datos de prueba.</b>');
      if (!ev) { el.innerHTML = h + V.empty('📈', 'Modelo no entrenado', 'Entrene el modelo para evaluarlo.', '<button class="btn btn-primary" data-action="train">ENTRENAR MODELO</button>'); return; }
      var mt = ev.metrics.test, conv = function (v) { return ML.toKW(v, ev.targetKey, ev.dtH); };
      var skill = 1 - mt.rf.rmse / mt.pers.rmse;
      var box = function (name, m, cls, ico) {
        return '<div class="card" style="border-top:4px solid ' + cls + '"><div class="card-head"><h2>' + ico + ' ' + name + '</h2></div><div class="grid g3" style="gap:10px">' +
          V.kpi('MAE', U.fmt(conv(m.mae), 3), 'kW') + V.kpi('RMSE', U.fmt(conv(m.rmse), 3), 'kW') + V.kpi('MAPE', U.fmt(m.mape, 1), '%') + '</div></div>';
      };
      h += '<div class="alert info"><span class="ai">🧪</span><div>Evaluación realizada sobre datos de prueba: <b>' + U.fmtInt(mt.rf.n) + '</b> registros del ' + U.fmtDate(ev.split.test.start) + ' al ' + U.fmtDate(ev.split.test.end) + ' (último 20 % cronológico, nunca usado para entrenar ni ajustar).</div></div>';
      h += '<div class="grid g2">' + box('RANDOM FOREST', mt.rf, '#eb6834', '🌲') + box('PERSISTENCIA', mt.pers, '#1baf7a', '⏮') + '</div>';
      h += '<div class="alert ' + (skill > 0 ? 'good' : 'warn') + '"><span class="ai">' + (skill > 0 ? '✔' : '⚠') + '</span><div>' + (skill > 0 ?
        'El Random Forest reduce el RMSE en <b>' + U.fmt(skill * 100, 1) + ' %</b> respecto de la persistencia (índice de habilidad = 1 − RMSE<sub>RF</sub>/RMSE<sub>pers</sub>).' :
        'El Random Forest <b>no</b> supera a la persistencia en RMSE (índice de habilidad ' + U.fmt(skill * 100, 1) + ' %). Revise las variables de entrada y la calidad de los datos.') + '</div></div>';
      var row = function (lab, m, pers) {
        return [lab, U.fmtInt(m.n), U.fmt(conv(m.mae), 3), U.fmt(conv(m.rmse), 3), U.fmt(m.mape, 1), U.fmt(m.wape, 1), U.fmt(m.r2, 4), U.fmt(conv(m.bias), 3), U.fmt(ML.toKWh(m.mae, ev.targetKey, ev.dtH), 3)];
      };
      h += '<div class="card"><h3>Métricas detalladas</h3>' + U.table(['Conjunto / modelo', 'N', 'MAE [kW]', 'RMSE [kW]', 'MAPE [%]', 'WAPE [%]', 'R²', 'Sesgo [kW]', 'Error promedio [kWh/intervalo]'], [
        row('Entrenamiento · Random Forest', ev.metrics.train.rf), row('Validación · Random Forest', ev.metrics.val.rf), row('Validación · Persistencia', ev.metrics.val.pers),
        row('<b>Prueba · Random Forest</b>', mt.rf), row('<b>Prueba · Persistencia</b>', mt.pers)
      ].concat(mt.lin ? [row('Validación · Regresión lineal', ev.metrics.val.lin), row('<b>Prueba · Regresión lineal</b>', mt.lin)] : []), { numCols: [1, 2, 3, 4, 5, 6, 7, 8], compact: true }) +
        '<h4 style="margin-top:12px">Error de energía diaria (prueba, ' + ev.daily.rf.n + ' días completos)</h4>' + U.table(['Modelo', 'MAE [kWh/día]', 'RMSE [kWh/día]', 'Error relativo (WAPE) [%]', 'Energía real media [kWh/día]'], [
          ['Random Forest', U.fmt(ev.daily.rf.mae, 2), U.fmt(ev.daily.rf.rmse, 2), U.fmt(ev.daily.rf.wape, 2), U.fmt(ev.daily.rf.meanY, 1)],
          ['Persistencia', U.fmt(ev.daily.pe.mae, 2), U.fmt(ev.daily.pe.rmse, 2), U.fmt(ev.daily.pe.wape, 2), U.fmt(ev.daily.pe.meanY, 1)]
        ].concat(ev.daily.li ? [['Regresión lineal sobre irradiancia', U.fmt(ev.daily.li.mae, 2), U.fmt(ev.daily.li.rmse, 2), U.fmt(ev.daily.li.wape, 2), U.fmt(ev.daily.li.meanY, 1)]] : []), { numCols: [1, 2, 3, 4], compact: true }) +
        (ev.linear ? '<div class="alert info" style="margin-top:10px"><span class="ai">⚖</span><div><b>Comparación honesta.</b> La persistencia solo conoce la generación de ayer; el Random Forest usa además el clima observado. La <b>regresión lineal</b> ŷ = ' + U.fmt(ev.linear.b, 5) + ' × ' + U.esc(M.label ? M.label(ev.linear.key) : ev.linear.key) + ' (ajustada solo con entrenamiento) usa la misma información meteorológica con un modelo simple: ' +
          (mt.lin && isFinite(mt.lin.rmse) ? 'el Random Forest reduce su RMSE en <b>' + U.fmt((1 - mt.rf.rmse / mt.lin.rmse) * 100, 1) + ' %</b>. Esa es la mejora atribuible al algoritmo; el resto de la ventaja frente a la persistencia proviene de disponer del clima observado.' : 'no fue posible evaluarla en prueba.') + '</div></div>' : '') +
        '<p class="small muted" style="margin-top:8px">Persistencia: ŷ(t) = y(t − ' + ev.persLagH + ' h). Ambos modelos se comparan sobre el mismo subconjunto (registros con valor de persistencia disponible). MAPE: solo registros con |real| &gt; 5 % del máximo del conjunto (evita la división por cero nocturna). ' +
        'Error promedio [kWh] = MAE × paso temporal (' + ev.dtH + ' h). El WAPE diario del Random Forest se usa como error relativo en el escenario conservador de la decisión.</p></div>';
      h += '<div class="grid g2">' + C.card('ev-rvp', '1. Real vs predicho', 'Datos de prueba; la línea discontinua es la predicción perfecta', 320) + C.card('ev-week', 'Serie de prueba (primeros 7 días)', 'Real, Random Forest y persistencia', 320) + '</div>';
      h += '<div class="grid g2">' + C.card('ev-res', '2. Residuos', 'Residuo = predicho − real frente al valor predicho', 300) + C.card('ev-dist', '3. Distribución de errores', 'Horas con generación real o predicha', 300) + '</div>';
      h += '<div class="grid g2">' + C.card('ev-hour', '4. Error por hora', 'MAE por hora del día', 300) + C.card('ev-month', '5. Error por mes', 'MAE por mes (meses presentes en prueba)', 300) + '</div>';
      h += '<div class="grid g2">' + C.card('ev-cond', '6. Error por condición meteorológica', 'Índice de cielo claro kc = irradiancia / P95 histórico (mes, hora)', 300, 'Despejado kc ≥ 0.75 · Parcialmente nublado 0.40–0.75 · Nublado &lt; 0.40 · Lluvia: precipitación &gt; 0.1 mm · Noche: referencia &lt; 30 W/m².') + C.card('ev-daily', 'Energía diaria en prueba', 'Real vs Random Forest vs persistencia', 300) + '</div>';
      el.innerHTML = h;
      C.mount(U.$('#ev-rvp'), SP.realVsPred(ev));
      C.mount(U.$('#ev-week'), SP.testSeries(ev, 7));
      C.mount(U.$('#ev-res'), SP.residuals(ev));
      C.mount(U.$('#ev-dist'), SP.errorHist(ev));
      C.mount(U.$('#ev-hour'), SP.errBy(ev, 'hour'));
      C.mount(U.$('#ev-month'), SP.errBy(ev, 'month'));
      C.mount(U.$('#ev-cond'), SP.errBy(ev, 'cond'));
      C.mount(U.$('#ev-daily'), SP.dailyTest(ev));
    }
  };
})();
