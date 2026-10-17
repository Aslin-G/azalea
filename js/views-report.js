/* ==========================================================================
   views-report.js — Página del informe: técnico / ejecutivo, vista previa
   A4, impresión a PDF (window.print) y descargas.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U;
  var V = SEDA.Views = SEDA.Views || {};
  var st = function () { return SEDA.state; };

  V.informe = {
    render: async function (el, opts) {
      var S = st();
      opts = opts || {};
      var h = V.head('Informe completo de operación', 'Generado automáticamente a partir de la ejecución realizada. Incluye portada, resumen, sistema, datos, limpieza, exploración, Machine Learning, división, evaluación, predicción, decisión, recomendaciones, escenarios, limitaciones y conclusión.');
      if (!S.model) { el.innerHTML = h + V.empty('📄', 'Aún no hay resultados', 'Entrene el modelo y calcule la decisión para generar el informe.', '<button class="btn btn-primary" data-action="autopilot">▶ Ejecutar flujo completo</button><button class="btn" data-action="train">ENTRENAR MODELO</button>'); return; }
      var mode = (S.report && S.report.mode) || 'tech';
      h += '<div class="report-toolbar no-print"><div class="tabs" style="margin:0;border:0"><button class="tab ' + (mode === 'tech' ? 'active' : '') + '" data-mode="tech">📐 Informe técnico</button><button class="tab ' + (mode === 'exec' ? 'active' : '') + '" data-mode="exec">👔 Informe ejecutivo</button></div></div>' +
        '<div class="card no-print"><div class="btn-row"><button class="btn btn-primary btn-lg" id="rep-full">⬇ DESCARGAR INFORME COMPLETO</button>' +
        '<button class="btn" data-action="dl-html">⬇ DESCARGAR INFORME HTML</button><button class="btn btn-accent" id="rep-print">🖨 IMPRIMIR / GUARDAR COMO PDF</button>' +
        '<button class="btn" data-action="dl-excel">📊 DESCARGAR RESULTADOS EXCEL</button><button class="btn" data-action="dl-processed">⬇ DESCARGAR DATOS PROCESADOS</button>' +
        '<button class="btn" data-action="dl-csv">⬇ DESCARGAR RESULTADOS CSV</button><button class="btn" data-action="dl-config">⚙ DESCARGAR CONFIGURACIÓN</button></div>' +
        '<p class="small muted" style="margin:10px 0 0">El PDF se genera sin internet con la función de impresión del navegador (tamaño A4): en el diálogo elija «Guardar como PDF». El informe HTML descargado es autónomo (estilos y gráficos incluidos) y también puede imprimirse.</p></div>' +
        '<div class="report-frame" id="rep-frame"><div class="empty"><div class="spinner" style="margin:0 auto 10px"></div>Generando informe…</div></div>';
      el.innerHTML = h;
      var build = async function () {
        try {
          if (SEDA.Design) await SEDA.Design.ready();
          if (!S.decision) await SEDA.App.decide();
          if (!S.scenarios) SEDA.App.simulate();
          await U.sleep(20);
          var html = SEDA.Report.build(mode);
          U.$('#rep-frame').innerHTML = html;
          S.report = { mode: mode, at: Date.now() };
          if (!S.steps[14]) SEDA.App.done(14); else SEDA.App.persist();
          await SEDA.App.saveRun('Informe generado');
        } catch (e) { console.error(e); U.$('#rep-frame').innerHTML = '<div class="alert crit"><span class="ai">⛔</span><div>' + U.esc(e.message) + '</div></div>'; }
      };
      U.$$('[data-mode]', el).forEach(function (b) {
        b.onclick = function () { mode = b.getAttribute('data-mode'); S.report = Object.assign({}, S.report || {}, { mode: mode }); V.informe.render(el, { build: true }); };
      });
      U.$('#rep-full').onclick = function () { SEDA.Exports.reportHTML(mode); };
      U.$('#rep-print').onclick = function () { if (!S.steps[15]) SEDA.App.done(15); window.print(); };
      await build();
      if (opts.print) setTimeout(function () { if (!S.steps[15]) SEDA.App.done(15); window.print(); }, 350);
    }
  };
})();
