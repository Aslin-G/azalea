/* ==========================================================================
   manual.js — MANUAL DE INSTALACIÓN específico del diseño (SEDA.Manual).
   Se genera a partir del diseño actual: sitio, arreglo, cadenas con
   tensiones y corrientes esperadas, protecciones, conductores, banco de
   baterías, puesta a tierra, señalización, puesta en servicio (IEC 62446-1),
   protocolo de pruebas, mantenimiento y solución de problemas.
   Documento orientativo: debe ser revisado y firmado por un profesional
   competente con matrícula profesional vigente antes de su uso en obra.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA;
  var U = SEDA.U;
  var Ma = SEDA.Manual = {};
  var Dz = function () { return SEDA.Design; };

  Ma.CSS = [
    '.report-doc.manual h2{counter-increment:msec}',
    '.report-doc .ck{width:22px;text-align:center;font-size:12pt}',
    '.report-doc .warnbox{background:#fff3d3;border:1px solid #fab219;border-radius:6px;padding:8px 11px;margin:8px 0;break-inside:avoid}',
    '.report-doc .danger{background:#fbe5e5;border:1px solid #d03b3b;border-radius:6px;padding:8px 11px;margin:8px 0;break-inside:avoid}',
    '.report-doc .lbl{display:inline-block;border:2px solid #d03b3b;border-radius:4px;padding:6px 10px;margin:4px 6px 4px 0;font-weight:800;font-size:8.6pt;color:#a02525;background:#fff;text-transform:uppercase;max-width:88mm;vertical-align:top}',
    '.report-doc .lbl.y{border-color:#e0a800;color:#6b4500;background:#fff8d6}',
    '.report-doc ol.steps{padding-left:18px;margin:4px 0 10px}.report-doc ol.steps li{margin:3px 0}',
    '.report-doc .sld-wrap svg{width:100%;height:auto;border:1px solid #e6eaee;border-radius:6px}',
    '.report-doc .sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:22px}.report-doc .sig div{border-top:1px solid #16202a;padding-top:4px;font-size:8.6pt;color:#44525f}'
  ].join('\n');
  Ma.injectStyles = function () {
    if (document.getElementById('manual-css')) return;
    var s = document.createElement('style'); s.id = 'manual-css'; s.textContent = Ma.CSS; document.head.appendChild(s);
  };

  function f(v, d) { return U.fmt(v, d == null ? 1 : d); }
  function tbl(head, rows, num) {
    num = num || [];
    return '<table class="rt"><thead><tr>' + head.map(function (h, i) { return '<th class="' + (num.indexOf(i) >= 0 ? 'n' : '') + '">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td class="' + (num.indexOf(i) >= 0 ? 'n' : '') + '">' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function vT(v, coef, t) { return v * (1 + coef / 100 * (t - 25)); }

  Ma.build = function (c) {
    if (!c || !c.ok) return '<div class="report-doc"><p>No hay un diseño válido. Complete el diseño del sistema.</p></div>';
    var p = Dz().project(), site = p.site, res = c.ctx.res, e = c.elec, pan = c.panel, inv = c.inv, bat = c.bat, b = c.bank, sim = c.sim;
    var S = SEDA.state || {}, run = S.runId || '—', now = U.nowHuman();
    var sysL = Dz().SYS[c.sysType].label, north = site.lat >= 0;
    var eqDir = north ? 'sur geográfico' : 'norte geográfico';
    var azTxt = c.azimuth === 0 ? 'hacia el ' + eqDir : (Math.abs(c.azimuth) + '° hacia el ' + (c.azimuth < 0 ? 'este' : 'oeste') + ' desde el ' + eqDir);
    var h = '<div class="report-doc manual">';
    /* ---------- portada ---------- */
    h += '<section class="rep-cover"><div><div class="rc-top">SEGAR SOLAR ENERGY DECISIÓN IA · Proyecto FV</div>' +
      '<div class="rc-title">Manual de instalación</div>' +
      '<div class="rc-sub">Sistema solar fotovoltaico ' + U.esc(sysL.toLowerCase()) + ' de <b>' + f(c.kwp, 2) + ' kWp</b>' + (b ? ' con almacenamiento de <b>' + f(b.kwh, 1) + ' kWh</b>' : '') + '<br>' + U.esc(site.place || '') + (site.country ? ' · ' + U.esc(site.country) : '') + '</div>' +
      '<span class="rc-kind">DOCUMENTO TÉCNICO DE OBRA</span>' +
      '<table><tr><td>Ubicación</td><td>' + SEDA.WorldMap.fmtLat(site.lat) + ', ' + SEDA.WorldMap.fmtLon(site.lon) + (isFinite(site.elev) ? ' · ' + f(site.elev, 0) + ' m s. n. m.' : '') + '</td></tr>' +
      '<tr><td>Generador FV</td><td>' + c.nMods + ' × ' + U.esc(pan.name) + '</td></tr>' +
      '<tr><td>Conversión</td><td>' + c.nInv + ' × ' + U.esc(inv.name) + '</td></tr>' +
      (b ? '<tr><td>Almacenamiento</td><td>' + b.units + ' × ' + U.esc(bat.name) + ' (' + b.series + 's × ' + b.par + 'p)</td></tr>' : '') +
      '<tr><td>Operación / fecha</td><td>' + U.esc(run) + ' · ' + now + '</td></tr></table></div>' +
      '<div class="rc-foot">Documento generado automáticamente a partir del diseño. Debe ser revisado, ajustado a los manuales de los fabricantes de los equipos adquiridos y firmado por un profesional competente con matrícula profesional vigente antes de su uso en obra. Cumplimiento exigible: RETIE (Resolución 40117 de 2024) y NTC 2050.</div></section>';

    /* ---------- 1. datos ---------- */
    h += '<h2>1. Datos del proyecto</h2>';
    h += tbl(['Concepto', 'Valor'], [
      ['Sitio', U.esc(site.place || '') + (site.country ? ', ' + U.esc(site.country) : '')],
      ['Coordenadas', SEDA.WorldMap.fmtLat(site.lat) + ', ' + SEDA.WorldMap.fmtLon(site.lon) + ' · UTC' + (site.utcOffset >= 0 ? '+' : '−') + Math.abs(site.utcOffset)],
      ['Recurso solar', U.esc(res.label) + ' · GHI ' + f(res.ghiYear, 0) + ' kWh/m²·año (' + f(res.ghiYear / 365, 2) + ' HSP)'],
      ['Temperaturas de diseño', 'Mínima ' + f(c.tMin, 1) + ' °C (Voc máx.) · máxima ' + f(c.tMax, 1) + ' °C · celda máx. ' + f(c.tCellMax, 0) + ' °C'],
      ['Tipo de sistema', U.esc(sysL)],
      ['Potencia instalada', f(c.kwp, 2) + ' kWp DC · ' + f(c.pacTot, 1) + ' kW AC · DC/AC ' + f(c.dcAc, 2)],
      ['Configuración', U.esc(c.layout)],
      ['Orientación', 'Inclinación ' + f(c.tilt, 0) + '° · ' + azTxt + ' · montaje en ' + (c.mount === 'suelo' ? 'suelo' : 'cubierta')],
      ['Área de módulos / ocupada', f(c.areaMods, 1) + ' m² / ' + f(c.areaUsed, 1) + ' m² · peso de módulos ' + f(c.weight, 0) + ' kg'],
      ['Producción estimada año 1', f(sim.ac, 0) + ' kWh (' + f(sim.specYield, 0) + ' kWh/kWp · PR ' + f(sim.pr * 100, 1) + ' %)']
    ]);

    /* ---------- 2. normativa ---------- */
    h += '<h2>2. Alcance y referencias normativas</h2><p>Este manual cubre el suministro, montaje, conexionado, puesta en servicio y mantenimiento del sistema descrito. Prevalecen siempre las instrucciones de los fabricantes de los equipos efectivamente adquiridos y la normativa vigente:</p><ul>' +
      '<li><b>RETIE</b> — Reglamento Técnico de Instalaciones Eléctricas, Resolución MME 40117 de 2024 (disposiciones transitorias modificadas por la Resolución 40304 de 2025; plenamente exigible desde el 1 de enero de 2026).</li>' +
      '<li><b>NTC 2050</b> (Código Eléctrico Colombiano, basado en NFPA 70): Secciones 690 (sistemas FV), 705 (fuentes interconectadas), 706 (almacenamiento de energía), 480 (baterías), 250 (puesta a tierra), 310 (conductores) y 240 (protección contra sobrecorriente).</li>' +
      '<li><b>IEC 62446-1</b>: documentación, pruebas de puesta en servicio e inspección de sistemas FV conectados a la red.</li>' +
      '<li><b>IEC 60364-7-712</b>: requisitos para instalaciones de suministro solar fotovoltaico.</li>' +
      '<li>Módulos certificados IEC 61215 / IEC 61730; inversores IEC 62109-1/-2 (y requisitos de conexión del operador de red); baterías de litio IEC 62619.</li>' +
      (c.sysType !== 'aislado' ? '<li><b>CREG 174 de 2021</b>: autogeneración a pequeña escala y generación distribuida (trámite de conexión y medición bidireccional).</li>' : '') +
      '<li><b>Ley 1715 de 2014</b> y <b>Ley 2099 de 2021</b>: incentivos a las fuentes no convencionales de energía (requieren certificación UPME).</li>' +
      '<li><b>Resolución 4272 de 2021</b> (Ministerio del Trabajo): requisitos mínimos de seguridad para trabajo en alturas.</li></ul>';

    /* ---------- 3. seguridad ---------- */
    h += '<h2>3. Seguridad</h2>';
    h += '<div class="danger"><b>⚠ Los módulos FV generan tensión DC siempre que reciben luz.</b> Un arreglo desconectado de la red <b>no</b> está desenergizado. Tensión máxima esperada de cadena en este proyecto: <b>' + (inv.type === 'micro' ? f(c.vocMax, 1) + ' V por módulo' : f(c.vStrVocMax, 0) + ' V DC') + '</b>. Nunca desconecte conectores MC4 bajo carga: abra primero el seccionador DC.</div>';
    h += '<h3>3.1 Cinco reglas de oro (antes de intervenir)</h3><ol class="steps"><li>Corte efectivo de todas las fuentes (red, inversor, seccionador DC, batería).</li><li>Bloqueo y etiquetado de los dispositivos de maniobra.</li><li>Verificación de ausencia de tensión con instrumento CAT III/IV adecuado (DC y AC).</li><li>Puesta a tierra y en cortocircuito de las fuentes cuando aplique (en FV: cubrir módulos con material opaco).</li><li>Señalización y demarcación de la zona de trabajo.</li></ol>';
    h += '<h3>3.2 Elementos de protección personal</h3><p>Casco dieléctrico con barboquejo, gafas de seguridad, guantes dieléctricos clase 0 (1 000 V) con protectores de cuero, calzado dieléctrico, ropa ignífuga (arco eléctrico), arnés de cuerpo completo con línea de vida y punto de anclaje certificado para trabajo en alturas (Res. 4272 de 2021), protector solar e hidratación.</p>';
    if (b) h += '<h3>3.3 Baterías</h3><p>' + (b && /LFP/.test(bat.chem) ? 'Litio-ferrofosfato (LFP) con BMS: no perforar, no cortocircuitar terminales (corrientes de miles de amperios), use herramienta aislada, mantenga la temperatura del recinto entre 15 y 30 °C.' : 'Plomo-ácido (' + bat.chem + '): ventile el recinto (desprendimiento de hidrógeno durante la carga, NTC 2050 Sección 480), prohíba llamas y chispas, disponga lavaojos y bicarbonato para neutralizar derrames.') + ' Extintor tipo ABC/CO₂ cerca del banco, sin obstruir la salida.</p>';

    /* ---------- 4. herramientas ---------- */
    h += '<h2>4. Herramientas e instrumentos</h2><ul><li>Multímetro CAT III 1 000 V DC y pinza amperimétrica DC/AC.</li><li>Medidor de resistencia de aislamiento (500 V / 1 000 V) y telurómetro (método de caída de potencial).</li><li>Piranómetro o celda de referencia y termómetro de contacto para la temperatura del módulo (puesta en servicio).</li><li>Cámara termográfica; trazador de curva I-V (recomendado).</li><li>Crimpadora y llaves de desconexión MC4 de la marca de los conectores; ponchadora hidráulica para terminales de batería.</li><li>Torquímetro, inclinómetro, brújula (corrija la declinación magnética local), nivel, cinta y equipo de alturas.</li></ul>';

    /* ---------- 5. materiales ---------- */
    h += '<h2>5. Lista de materiales</h2>';
    var bomQ = c.bom.items.filter(function (it) { return it.eq && !it.off; });
    h += tbl(['Ítem', 'Especificación', 'Cant.', 'Und.'], bomQ.map(function (it) { return [U.esc(it.desc), U.esc(it.spec), U.fmt(it.qty, it.qty % 1 ? 1 : 0), it.unit]; }), [2]);

    /* ---------- 6. recepción ---------- */
    h += '<h2>6. Recepción y almacenamiento</h2><ol class="steps"><li>Verifique referencias, cantidades, números de serie y certificados de conformidad RETIE de cada equipo contra la lista de materiales.</li><li>Inspeccione los módulos (vidrio, marco, caja de conexiones y cables) y rechace unidades dañadas; almacénelos de canto, en su empaque, bajo techo.</li><li>Almacene inversores y baterías en lugar seco; las baterías de litio con SOC de transporte (≈ 30–50 %) y lejos de fuentes de calor.</li><li>Registre fotográficamente la recepción.</li></ol>';

    /* ---------- 7. estructura ---------- */
    h += '<h2>7. Replanteo y estructura</h2>';
    var loadKgM2 = (pan.kg / (pan.L * pan.W / 1e6)) + 3.5;
    h += '<ul><li><b>Orientación:</b> ' + azTxt + ' (acimut de diseño ' + c.azimuth + '°). Corrija la declinación magnética local al usar brújula.</li>' +
      '<li><b>Inclinación:</b> ' + f(c.tilt, 0) + '° respecto a la horizontal' + (c.tilt <= 12 ? ' (mínimo recomendado 10° para autolimpieza con la lluvia)' : '') + '. Verifique con inclinómetro en al menos 3 puntos por mesa.</li>' +
      '<li><b>Carga muerta estimada</b> del generador: ≈ ' + f(loadKgM2, 1) + ' kg/m² (módulos + estructura). ' + (c.mount === 'techo' ? 'Un ingeniero civil/estructural debe verificar la capacidad de la cubierta, el viento de diseño y el tipo de anclaje (NSR-10).' : 'Verifique el suelo y la cimentación (hincado o zapatas) para el viento de diseño (NSR-10).') + '</li>';
    if (c.mount === 'suelo') h += '<li><b>Separación entre filas</b> (sin sombras de 9:00 a 15:00 hora solar en ambos solsticios): altura de la fila ' + f(c.row.height, 2) + ' m · espacio libre mínimo <b>' + f(c.row.gap, 2) + ' m</b> · paso entre filas ' + f(c.row.pitch, 2) + ' m (GCR ' + f(c.row.gcr, 2) + ').</li>';
    else h += '<li>Deje ≥ 10 cm de espacio bajo los módulos para ventilación, ≥ 50 cm libres al borde de la cubierta y pasillos de mantenimiento; no bloquee drenajes.</li>';
    h += '<li>Sujete los módulos solo en las zonas de fijación indicadas por el fabricante (normalmente entre ¼ y ⅕ de la longitud desde cada extremo) con grapas del sistema de montaje y el par de apriete especificado.</li><li>Selle todas las perforaciones de cubierta con productos compatibles y certifique la impermeabilización.</li></ul>';

    /* ---------- 8. módulos ---------- */
    h += '<h2>8. Montaje de módulos</h2><ol class="steps"><li>Manipule cada módulo entre dos personas por el marco; nunca por la caja de conexiones o los cables; no pise los módulos.</li><li>Mantenga los módulos cubiertos o desconectados hasta el final del conexionado.</li><li>Una eléctricamente cada marco a la estructura con elementos de unión certificados (arandelas de puesta a tierra o terminales), según el fabricante del sistema de montaje.</li><li>Distribuya los módulos por cadena según la tabla de la sección 9 y rotule cada cadena en ambos extremos.</li></ol>';

    /* ---------- 9. cadenas ---------- */
    h += '<h2>9. Cableado DC y valores esperados por cadena</h2>';
    if (inv.type === 'micro') {
      h += '<p>Arquitectura con microinversores: cada módulo se conecta a una entrada del microinversor con sus propios cables MC4 (tensión DC ≤ ' + inv.vdcMax + ' V). Voc máximo por módulo a ' + f(c.tMin, 0) + ' °C: <b>' + f(c.vocMax, 1) + ' V</b>. Isc: ' + f(pan.isc, 2) + ' A.</p>';
    } else {
      var tHot = 45;
      h += '<p>Conductor de cadena: <b>' + U.esc(e.dc.cable.label) + '</b> tipo PV (H1Z2Z2-K / PV Wire, 90 °C, resistente a UV), longitud de diseño ' + (+p.inputs.lenDC || 25) + ' m (un sentido), caída de tensión a STC ' + f(e.dc.cable.dropPct, 2) + ' %. Conectores MC4 de una misma marca y modelo en cada unión. Tienda los cables fijados a la estructura (sin tocar la cubierta), con bucles de goteo y amarres resistentes a UV; no mezcle polaridades en un mismo haz sin identificación.</p>';
      var rows = c.strings.map(function (s) {
        return [s.id, 'INV-' + s.inv + ' / MPPT ' + s.mppt, s.ns, f(s.ns * pan.voc, 1), f(s.ns * vT(pan.voc, pan.bV, tHot), 1), f(s.ns * vT(pan.voc, pan.bV, c.tMin), 1), f(s.ns * pan.vmp, 1), f(pan.isc, 2), f(pan.isc * 0.8, 2)];
      });
      h += tbl(['Cadena', 'Inversor / MPPT', 'Mód.', 'Voc STC [V]', 'Voc a 45 °C [V]', 'Voc a ' + f(c.tMin, 0) + ' °C [V]', 'Vmp STC [V]', 'Isc STC [A]', 'Isc a 800 W/m² [A]'], rows, [2, 3, 4, 5, 6, 7, 8]);
      h += '<div class="box">Verificación de diseño: Voc máx. de cadena ' + f(c.vStrVocMax, 0) + ' V ≤ ' + inv.vdcMax + ' V (entrada del inversor) y ≤ ' + pan.vSys + ' V (sistema del módulo) · Vmp en caliente ' + f(c.vStrVmpHot, 0) + ' V ≥ ' + inv.mpptMin + ' V (MPPT mín.) · Vmp en frío ' + f(c.vStrVmpCold, 0) + ' V ≤ ' + inv.mpptMax + ' V (MPPT máx.) · Corriente por MPPT ' + f(e.dc.perMppt * pan.imp, 1) + ' A (máx. ' + inv.imax + ' A) · Isc × 1.25 por MPPT ' + f(e.dc.perMppt * pan.isc * 1.25, 1) + ' A (máx. ' + inv.iscMax + ' A).</div>';
    }

    /* ---------- 10. protecciones ---------- */
    h += '<h2>10. Protecciones y conductores</h2>';
    var pr = [];
    if (!e.dc.micro) {
      pr.push(['Cadena FV (módulos → caja/inversor)', U.esc(e.dc.cable.label) + ' PV 90 °C', e.dc.fuse ? 'Fusible gPV ' + e.dc.fuse.rating + ' A / ' + e.dc.fuse.volt + ' V en ambos polos' : 'No requiere fusible (≤ 2 cadenas por MPPT)', f(e.dc.iDesStr, 1) + ' A (1.56 × Isc)']);
      if (e.dc.cableMain) pr.push(['Caja de combinación → inversor', U.esc(e.dc.cableMain.label), 'Seccionador DC ' + e.dc.disc.rating + ' A / ' + e.dc.disc.volt + ' V', f(e.dc.iMppt, 1) + ' A']);
      pr.push(['Seccionamiento DC', '—', 'Seccionador DC bajo carga ' + e.dc.disc.rating + ' A / ' + e.dc.disc.volt + ' V + DPS DC tipo 2 (Ucpv ' + e.dc.spd + ' V)', '—']);
    }
    pr.push(['Salida AC del inversor' + (e.ac.branches ? ' (ramal de microinversores)' : ''), U.esc(e.ac.cable.label) + ' THHN/THWN-2 75 °C', 'Interruptor ' + e.ac.breaker.poles + 'P ' + e.ac.breaker.rating + ' A + DPS AC tipo 2', f(e.ac.iAc, 1) + ' A']);
    if (e.acMain) pr.push(['Tablero FV → tablero general', U.esc(e.acMain.cable.label), 'Interruptor general ' + e.acMain.breaker.poles + 'P ' + e.acMain.breaker.rating + ' A', f(e.acMain.iAc, 1) + ' A']);
    if (e.bat) pr.push(['Batería ↔ inversor', U.esc(e.bat.cable.label) + ' Cu flexible', 'Fusible/interruptor DC ' + e.bat.ocpd + ' A (en el positivo, lo más cerca posible de la batería)', f(e.bat.i, 1) + ' A']);
    pr.push(['Tierra de equipos', e.gnd.egcDc + ' AWG (DC) / ' + e.gnd.egcAc + ' AWG (AC)' + (e.gnd.egcBat ? ' / ' + e.gnd.egcBat + ' AWG (batería)' : ''), 'Tabla 250.122 NTC 2050', '—']);
    h += tbl(['Circuito', 'Conductor', 'Protección', 'Corriente de diseño'], pr);
    h += '<ul>' + e.notes.map(function (n) { return '<li>' + U.esc(n) + '</li>'; }).join('') + '</ul>';

    /* ---------- 11. inversor ---------- */
    h += '<h2>11. Inversor' + (c.nInv > 1 ? 'es' : '') + '</h2><ol class="steps"><li>Instale ' + (c.nInv > 1 ? 'cada inversor' : 'el inversor') + ' en posición vertical sobre superficie incombustible, a la sombra y con ventilación, respetando las distancias libres del fabricante (típicamente ≥ 30–50 cm a los lados y arriba) y con la pantalla a 1.2–1.6 m del piso.</li>' +
      '<li>Conecte la tierra de equipos antes que cualquier conductor activo.</li><li>Conecte la salida AC (' + U.esc(inv.acLabel) + ') a través del interruptor de ' + e.ac.breaker.rating + ' A; respete la secuencia de fases y el neutro.</li>' +
      (inv.type !== 'micro' ? '<li>Con el seccionador DC abierto, mida la polaridad y el Voc de cada cadena (sección 13) antes de conectarlas al inversor.</li>' : '') +
      (c.sysType !== 'aislado' ? '<li>Configure el código de red/país y los parámetros de conexión exigidos por el operador de red (protección anti-isla, límites de tensión y frecuencia); si hay límite de exportación, instale el medidor/sensor de inyección cero.</li>' : '<li>Configure el modo aislado, la tensión y frecuencia de salida (60 Hz) y, si existe, el arranque automático del generador.</li>') +
      '<li>Conecte el monitoreo (Wi-Fi/RS485) y registre el sistema en la plataforma del fabricante.</li></ol>';

    /* ---------- 12. baterías ---------- */
    if (b) {
      var lfp = /LFP/.test(bat.chem), cellsPerBat = lfp ? 16 : bat.vNom / 2;
      h += '<h2>12. Banco de baterías</h2><p>Configuración: <b>' + b.series + ' en serie × ' + b.par + ' en paralelo</b> (' + b.units + ' unidades) · ' + f(b.vBank, 1) + ' V · ' + f(b.ah, 0) + ' Ah · ' + f(b.kwh, 1) + ' kWh nominales · ' + f(b.usable, 1) + ' kWh útiles entre el SOC mínimo operativo (' + b.socMin + ' %) y la carga completa (DoD máx. del fabricante ' + bat.dod + ' %).</p>';
      h += '<ol class="steps"><li>Ubique el banco en recinto ventilado, seco, sin radiación solar directa, sobre base nivelada y con acceso restringido.</li><li>En paralelo, use cables de <b>igual longitud y sección</b> hacia un barraje común (conexión en diagonal: positivo del primer banco y negativo del último) para repartir la corriente.</li><li>Apriete los terminales con el par del fabricante y proteja con cubiertas aislantes.</li><li>Instale el fusible/interruptor DC de ' + e.bat.ocpd + ' A en el positivo, tan cerca de la batería como sea posible.</li><li>' + (lfp ? 'Conecte el cable de comunicación del BMS (CAN/RS485) al inversor y seleccione el protocolo del fabricante; verifique que el inversor lea SOC, tensión y corriente.' : 'Instale el sensor de temperatura de batería para compensación de la tensión de carga.') + '</li></ol>';
      h += '<h3>Parámetros de configuración recomendados en el inversor</h3>';
      var setRows = lfp ? [
        ['Tipo de batería', 'Litio (comunicación BMS) o «User» LFP'], ['Tensión de absorción / carga', '≈ ' + f(3.5 * 16, 1) + ' V (3.50 V/celda)'], ['Tensión de flotación', '≈ ' + f(3.375 * 16, 1) + ' V'], ['Corte por baja tensión', '≈ ' + f(3.0 * 16, 1) + ' V'],
        ['SOC mínimo de descarga', (p.inputs.socMin || 20) + ' % (coherente con la decisión energética)'], ['Corriente máx. de carga / descarga', f(Math.min((inv.batIChg || 100) * c.nInv, bat.iMax * b.par), 0) + ' A / ' + f(Math.min((inv.batIDis || 100) * c.nInv, bat.iMax * b.par), 0) + ' A']
      ] : [
        ['Tipo de batería', bat.chem + ' (plomo-ácido)'], ['Tensión de absorción (25 °C)', '≈ ' + f(2.40 * cellsPerBat * b.series, 1) + ' V (2.40 V/celda)'], ['Tensión de flotación (25 °C)', '≈ ' + f(2.25 * cellsPerBat * b.series, 1) + ' V'],
        ['Compensación térmica', '−3 mV/°C·celda'], ['Corte por baja tensión', '≈ ' + f(1.95 * cellsPerBat * b.series, 1) + ' V'], ['Corriente máx. de carga', f(0.2 * b.ah, 0) + ' A (0.2 C)']
      ];
      h += tbl(['Parámetro', 'Valor orientativo (confirme con el fabricante)'], setRows);
    }

    /* ---------- 13. puesta en servicio ---------- */
    var vsys = inv.type === 'micro' ? c.vocMax : c.vStrVocMax * 1.25;
    var testV = vsys < 120 ? 250 : vsys <= 500 ? 500 : 1000, rMin = vsys < 120 ? 0.5 : 1;
    h += '<h2>' + (b ? '13' : '12') + '. Puesta a tierra, señalización y puesta en servicio</h2>';
    h += '<h3>Puesta a tierra</h3><p>Electrodo: ' + e.gnd.rods + ' × ' + e.gnd.rod + ' unido con soldadura exotérmica y conductor ' + e.gnd.gec + ' AWG Cu al barraje de tierra del tablero general (un solo sistema de puesta a tierra, equipotencial). Mida la resistencia con telurómetro por el método de caída de potencial (sonda de potencial al 62 %) y registre el valor.</p>';
    h += '<h3>Señalización mínima</h3><div>' + [
      'PELIGRO — SISTEMA SOLAR FOTOVOLTAICO. Conductores DC energizados durante el día',
      'Tensión máxima DC: ' + (inv.type === 'micro' ? f(c.vocMax, 0) + ' V' : f(c.vStrVocMax, 0) + ' V') + ' · Corriente máx.: ' + f(inv.type === 'micro' ? pan.isc * 1.25 : e.dc.perMppt * pan.isc * 1.25, 1) + ' A',
      'ADVERTENCIA — DOBLE ALIMENTACIÓN: red y sistema FV' + (b ? ' y batería' : ''),
      'Seccionador DC del sistema FV — abrir antes de intervenir',
      b ? 'BATERÍA ' + f(b.vBank, 0) + ' V DC · ' + f(b.kwh, 1) + ' kWh — riesgo de arco y cortocircuito' : null,
      'Interruptor de salida FV — no reubicar (NTC 2050, 705.12)'
    ].filter(Boolean).map(function (t, i) { return '<span class="lbl' + (i % 2 ? ' y' : '') + '">' + U.esc(t) + '</span>'; }).join('') + '</div>';
    h += '<h3>Secuencia de pruebas (IEC 62446-1)</h3><ol class="steps"><li>Inspección visual completa (fijaciones, cableado, rótulos, grados IP, distancias).</li><li>Continuidad de los conductores de protección y equipotencialidad.</li><li>Polaridad de cada cadena antes de conectar.</li><li>Tensión en circuito abierto (Voc) de cada cadena: compare con el valor esperado a la temperatura medida del módulo, Voc(T) = Voc<sub>STC</sub> × [1 + β<sub>Voc</sub> (T − 25)], β<sub>Voc</sub> = ' + pan.bV + ' %/°C. Diferencias &gt; 5 % entre cadenas iguales indican módulos invertidos, faltantes o defectuosos.</li><li>Corriente de cortocircuito (Isc) o de operación: Isc(G) ≈ Isc<sub>STC</sub> × G/1000 con G medida en el plano (preferible G &gt; 400 W/m², cielo estable).</li><li>Resistencia de aislamiento de cada cadena (positivo y negativo contra tierra): tensión de prueba ' + testV + ' V, valor mínimo ' + rMin + ' MΩ.</li><li>Pruebas funcionales: maniobra de seccionadores e interruptores, arranque y parada del inversor' + (c.sysType !== 'aislado' ? ', desconexión ante pérdida de red (anti-isla)' : '') + (b ? ', carga y descarga de la batería con lectura del BMS' : '') + '.</li><li>Termografía con el sistema en producción (&gt; 600 W/m²): puntos calientes en módulos, conectores y bornes.</li></ol>';
    h += '<h3>Protocolo de pruebas</h3>';
    var prot = [];
    if (inv.type !== 'micro') c.strings.forEach(function (s) { prot.push([s.id, f(s.ns * pan.voc, 0), '', '', f(pan.isc, 1), '', '', '', '☐']); });
    else prot.push(['Módulos (muestreo)', f(pan.voc, 1), '', '', f(pan.isc, 1), '', '', '', '☐']);
    h += tbl(['Cadena', 'Voc STC [V]', 'T módulo [°C]', 'Voc medido [V]', 'Isc STC [A]', 'G [W/m²]', 'Isc medido [A]', 'R aisl. [MΩ]', 'OK'], prot, [1, 4]);
    h += tbl(['Verificación', 'Resultado', 'OK'], [['Resistencia de puesta a tierra [Ω]', '', '☐'], ['Continuidad de protección (marcos, estructura, tableros)', '', '☐'], ['Rótulos y señalización instalados', '', '☐'], ['Par de apriete de bornes verificado', '', '☐'], ['Configuración del inversor registrada', '', '☐'], ['Monitoreo en línea y alarmas', '', '☐']].concat(b ? [['BMS comunicando, SOC y límites de corriente', '', '☐']] : []).concat(c.sysType !== 'aislado' ? [['Anti-isla verificada / medidor bidireccional', '', '☐']] : []));

    /* ---------- 14. mantenimiento ---------- */
    var dusty = Math.abs(site.lat - 11.5) < 2 && site.lon > -74 && site.lon < -71;
    h += '<h2>' + (b ? '14' : '13') + '. Operación y mantenimiento</h2>';
    h += tbl(['Frecuencia', 'Actividad'], [
      ['Diaria / semanal', 'Revisar el monitoreo: producción vs. esperada (' + f(sim.ac / 365, 1) + ' kWh/día en promedio' + (b ? '; SOC al anochecer frente a la reserva recomendada' : '') + '), alarmas.'],
      ['Mensual', 'Inspección visual; limpieza de módulos con agua desmineralizada y cepillo suave, sin detergentes abrasivos, en horas de baja irradiancia' + (dusty ? ' (en La Guajira el polvo y la salinidad exigen limpieza al menos mensual)' : '') + '.'],
      ['Semestral', 'Reapriete de bornes y conectores; verificación de DPS (indicador), sellos, anclajes y corrosión; limpieza de filtros/ventiladores del inversor; termografía.'],
      ['Anual', 'Medición de Voc/Isc por cadena y resistencia de aislamiento; resistencia de puesta a tierra; revisión de la estructura' + (b ? '; prueba de capacidad y balance del banco de baterías' : '') + '; actualización del firmware.'],
      ['10–12 años', 'Evaluar reposición del inversor' + (b ? ' y de las baterías según ciclos (' + f(sim.cycles, 0) + ' ciclos/año estimados)' : '') + '.']
    ]);

    /* ---------- 15. fallas ---------- */
    h += '<h2>' + (b ? '15' : '14') + '. Solución de problemas</h2>';
    h += tbl(['Síntoma', 'Causa probable', 'Acción'], [
      ['Producción inferior a la esperada', 'Suciedad, sombras nuevas, cadena abierta, recorte por temperatura', 'Limpiar; comparar corrientes por MPPT; revisar fusibles y conectores; termografía.'],
      ['Voc de una cadena menor al esperado', 'Módulo invertido o faltante, diodo de bypass en corto', 'Medir módulo por módulo; reemplazar el defectuoso.'],
      ['Alarma de aislamiento / falla a tierra', 'Cable pellizcado, humedad en conectores o cajas', 'Aislar cadena por cadena con megóhmetro; secar y reparar.'],
      ['El inversor no se conecta a la red', 'Tensión/frecuencia fuera de rango, código de red incorrecto', 'Verificar la red y la configuración; contactar al operador de red.'],
      ['DPS con indicador rojo', 'Sobretensión atmosférica', 'Reemplazar el cartucho; revisar la puesta a tierra.']
    ].concat(b ? [['La batería no llega a la reserva al anochecer', 'Consumo diurno alto o baja irradiancia', 'Aplicar la estrategia predictiva de SEGAR; revisar límites de carga y el SOC mínimo.'], ['Error de comunicación BMS', 'Protocolo o cable incorrecto', 'Verificar pines del cable CAN/RS485 y el protocolo seleccionado.']] : []));

    /* ---------- anexos ---------- */
    h += '<h2>Anexo A. Diagrama unifilar</h2><div class="sld-wrap">' + Dz().diagram(c) + '</div>';
    h += '<h2>Anexo B. Firmas</h2><p class="muted">Declaro que la instalación se ejecutó conforme a este manual, a las instrucciones de los fabricantes y al RETIE.</p><div class="sig"><div>Instalador responsable · matrícula</div><div>Interventor / inspector</div><div>Propietario / usuario</div></div>';
    h += '<div class="foot">Generado por SEGAR SOLAR ENERGY DECISIÓN IA · ' + now + ' · Valores calculados con el modelo del diseño; los datos de los fabricantes prevalecen.</div>';
    h += '</div>';
    return h;
  };

  Ma.standalone = function (c) {
    var R = SEDA.Report;
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manual de instalación — SEGAR</title>' +
      '<style>@page{size:A4;margin:14mm 12mm}body{margin:0;background:#e6e9ed;padding:20px}.pbar{max-width:210mm;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}.pbar button{font:600 13px system-ui,sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #c9d2db;background:#f29d0b;cursor:pointer}@media print{body{background:#fff;padding:0}.pbar{display:none}}\n' + (R ? R.CSS : '') + '\n' + Ma.CSS + '</style></head><body>' +
      '<div class="pbar"><button onclick="window.print()">🖨 Imprimir / Guardar como PDF</button></div>' + Ma.build(c) + '</body></html>';
  };
})();
