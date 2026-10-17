/* Genera los archivos de ejemplo de la carpeta data/ (DATOS SINTÉTICOS).
   Uso:  node tools/generar_datos_demo.js      (requiere Node.js; no requiere internet) */
'use strict';
const path = require('path');
const fs = require('fs');
const XLSX = require('../js/lib/xlsx.full.min.js');
XLSX.set_fs(fs);
const Demo = require('../js/demo.js');
const OUT = path.join(__dirname, '..', 'data');
const p2 = n => (n < 10 ? '0' : '') + n;
const dstr = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
const hstr = t => { const d = new Date(t); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
const serial = t => t / 86400000 + 25569;
const csvCell = v => v == null ? '' : (typeof v === 'string' && /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : String(v));
const toCSV = (hdr, rows, sep) => '﻿' + [hdr].concat(rows).map(r => r.map(csvCell).join(sep || ',')).join('\r\n') + '\r\n';

/* 1. CSV simple (una tabla) con problemas de calidad inyectados */
const tb = Demo.table({});
fs.writeFileSync(path.join(OUT, 'demo_la_guajira_sintetico.csv'), toCSV(tb.headers, tb.rows));

/* 2. Excel multihoja con encabezados heterogéneos (demuestra selección de hojas, unión por fecha-hora y conversión de unidades) */
const recs = Demo.generateClean({});
Demo.injectIssues(recs, 777);
const sheetFrom = (aoa, fmts) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const rg = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= rg.e.r; R++) for (const c in fmts) { const a = XLSX.utils.encode_cell({ r: R, c: +c }); if (ws[a] && ws[a].t === 'n') ws[a].z = fmts[c]; }
  ws['!cols'] = aoa[0].map(h => ({ wch: Math.max(12, String(h).length + 2) }));
  return ws;
};
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ['LEEME — DATOS SINTÉTICOS DE DEMOSTRACIÓN — NO SON DATOS REALES'],
  ['Generados con un modelo físico simplificado para La Guajira, Colombia (1 año horario, 2025).'],
  ['Hojas: "Datos meteorologicos", "Generacion FV", "Bateria" y "Carga". Tienen columnas distintas y se unen por fecha-hora.'],
  ['La presión está en kPa (la aplicación la convierte a hPa). Incluyen problemas de calidad a propósito.']
]), 'LEEME');
XLSX.utils.book_append_sheet(wb, sheetFrom([['Date', 'Time', 'Irradiance (W/m2)', 'Direct Normal (W/m2)', 'Diffuse (W/m2)', 'Temperature (°C)', 'Relative Humidity (%)', 'Wind Speed (m/s)', 'Wind Direction (deg)', 'Pressure (kPa)', 'Rainfall (mm)']]
  .concat(recs.map(r => [Math.floor(serial(r.t)), (r.t % 86400000) / 86400000, r.ghi, r.dni, r.dhi, r.temp, r.rh, r.ws, r.wd, r.ps == null ? null : Math.round(r.ps * 10) / 100, r.prec])), { 0: 'yyyy-mm-dd', 1: 'hh:mm' }), 'Datos meteorologicos');
XLSX.utils.book_append_sheet(wb, sheetFrom([['Fecha y hora', 'AC Power (kW)', 'Energia (kWh)']].concat(recs.map(r => [serial(r.t), r.pv, r.pv == null ? null : Math.round(r.pv * 1000) / 1000])), { 0: 'yyyy-mm-dd hh:mm' }), 'Generacion FV');
XLSX.utils.book_append_sheet(wb, sheetFrom([['Timestamp', 'SOC (%)', 'Potencia bateria (kW)']].concat(recs.map(r => [serial(r.t), r.soc, r.pbat])), { 0: 'yyyy-mm-dd hh:mm' }), 'Bateria');
XLSX.utils.book_append_sheet(wb, sheetFrom([['Fecha hora', 'Consumo (kW)']].concat(recs.map(r => [serial(r.t), r.load])), { 0: 'yyyy-mm-dd hh:mm' }), 'Carga');
XLSX.writeFile(wb, path.join(OUT, 'demo_la_guajira_multihoja_sintetico.xlsx'), { compression: true });

/* 3. Formato NASA POWER (horario, LST) + columna de potencia FV medida por el usuario */
const clean = Demo.generateClean({ seed: 4242 });
let nasa = '-BEGIN HEADER-\r\nNASA/POWER Hourly Data — FORMATO DE EJEMPLO CON DATOS SINTÉTICOS (NO SON DATOS REALES)\r\n' +
  'Dates (month/day/year): 01/01/2025 through 12/31/2025 in LST\r\nLocation: Latitude  11.54   Longitude -72.91\r\n' +
  'The value for missing source data that cannot be computed or is outside of the sources availability range: -999\r\nParameter(s):\r\n' +
  'ALLSKY_SFC_SW_DWN     All Sky Surface Shortwave Downward Irradiance (Wh/m^2)\r\nALLSKY_SFC_SW_DNI     All Sky Surface Shortwave Downward Direct Normal Irradiance (Wh/m^2)\r\n' +
  'ALLSKY_SFC_SW_DIFF    All Sky Surface Shortwave Diffuse Irradiance (Wh/m^2)\r\nT2M                   Temperature at 2 Meters (C)\r\nRH2M                  Relative Humidity at 2 Meters (%)\r\n' +
  'WS10M                 Wind Speed at 10 Meters (m/s)\r\nWD10M                 Wind Direction at 10 Meters (Degrees)\r\nPS                    Surface Pressure (kPa)\r\nPRECTOTCORR           Precipitation Corrected (mm/hour)\r\n' +
  'PV_POWER_KW           Potencia FV medida por el usuario (kW) — columna añadida\r\n-END HEADER-\r\n';
const hdr = ['YEAR', 'MO', 'DY', 'HR', 'ALLSKY_SFC_SW_DWN', 'ALLSKY_SFC_SW_DNI', 'ALLSKY_SFC_SW_DIFF', 'T2M', 'RH2M', 'WS10M', 'WD10M', 'PS', 'PRECTOTCORR', 'PV_POWER_KW'];
const rows = clean.map((r, i) => {
  const d = new Date(r.t);
  const miss = (i % 997 === 13);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), r.ghi, r.dni, r.dhi, miss ? -999 : r.temp, r.rh, r.ws, r.wd, Math.round(r.ps * 10) / 100, r.prec, r.pv];
});
nasa += hdr.join(',') + '\r\n' + rows.map(r => r.join(',')).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(OUT, 'nasa_power_formato_ejemplo_sintetico.csv'), nasa);

/* 4. Plantillas para datos reales */
const tplHdr = ['Fecha', 'Hora', 'GHI (W/m2)', 'DNI (W/m2)', 'DHI (W/m2)', 'Temperatura (°C)', 'Humedad relativa (%)', 'Velocidad viento (m/s)', 'Direccion viento (°)', 'Presion (hPa)', 'Precipitacion (mm)', 'Potencia FV (kW)', 'Consumo (kW)', 'SOC (%)'];
fs.writeFileSync(path.join(OUT, 'plantilla_datos_reales.csv'), toCSV(tplHdr, []));
const wb2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([tplHdr]), 'Datos');
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([
  ['Instrucciones'],
  ['1. Una fila por registro (idealmente horario). Fecha en formato AAAA-MM-DD o DD/MM/AAAA; hora HH:MM (0–23).'],
  ['2. Columnas obligatorias: Fecha (+ Hora) y Potencia FV (kW) o Energía FV (kWh). Se recomienda al menos una radiación (GHI).'],
  ['3. Columnas opcionales: DNI, DHI, temperatura, humedad, viento, dirección, presión, precipitación, consumo, SOC.'],
  ['4. Los nombres pueden variar (p. ej. "Wind Speed", "WS10", "Velocidad viento"): la aplicación los mapea automáticamente y permite corregirlos.'],
  ['5. Celdas vacías = faltantes. Se admite coma o punto decimal. −999 se interpreta como dato faltante.'],
  ['6. Fuentes sugeridas: NASA POWER (power.larc.nasa.gov), IDEAM (DHIME), UPME, XM/SIEM, datalogger del inversor.']
]), 'Instrucciones');
XLSX.writeFile(wb2, path.join(OUT, 'plantilla_datos_reales.xlsx'), { compression: true });
console.log('Archivos generados en', OUT);
fs.readdirSync(OUT).forEach(f => console.log(' -', f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB'));
