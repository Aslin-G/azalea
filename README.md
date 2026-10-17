# ☀ SEGAR SOLAR ENERGY DECISIÓN IA

**Plataforma Offline-First de Machine Learning para análisis, predicción y toma de decisiones en sistemas solares fotovoltaicos.**

> *¿Cuánta energía solar puedo esperar y cuánta energía debo reservar para garantizar la operación nocturna?*

La aplicación convierte datos históricos meteorológicos y energéticos en una **decisión cuantitativa**:
energía a reservar [kWh], SOC objetivo [%], riesgo de insuficiencia energética y recomendaciones de operación,
con informe técnico y ejecutivo descargables.

---

## 1. Cómo ejecutarla

1. Descomprima la carpeta `segar-solar-energy-decision-ai/`.
2. Abra **`index.html`** con doble clic (Chrome, Edge o Firefox recientes).
3. No requiere servidor, instalación, internet ni base de datos externa. Solo el **Asistente IA en modo en línea**
   y la **consulta a NASA POWER** (ambos opcionales y a pedido del usuario) usan internet.

La cabecera muestra permanentemente **● MODO OFFLINE ACTIVO — Los datos permanecen en este dispositivo.**
La política de seguridad de la página (`connect-src`) solo permite conectarse a `api.deepseek.com` y `api.openai.com`
(asistente en línea) y a `power.larc.nasa.gov` (consulta NASA POWER: solo coordenadas, fechas y parámetros);
cualquier otra conexión está bloqueada. El mapa mundial está incluido en la aplicación (no descarga mosaicos).

**Prueba rápida:** Dashboard → **▶ EJECUTAR FLUJO COMPLETO** (carga los datos sintéticos de La Guajira y ejecuta
los 15 pasos) o **CARGAR DEMO LA GUAJIRA** para recorrerlos uno a uno. Luego abra **🛰 Simulación interactiva** y el
botón **✦ Asistente SEGAR** (abajo a la derecha). Para un proyecto nuevo: **🌍 Sitio y NASA POWER → 🧩 Diseño del sistema →
💲 Costos y presupuesto → 📘 Manual de instalación**.

## 2. Estructura

```
segar-solar-energy-decision-ai/
├── index.html              ← punto de entrada (abrir con doble clic)
├── css/styles.css          ← diseño (tema claro/oscuro, responsive, impresión A4)
├── js/
│   ├── lib/xlsx.full.min.js   ← SheetJS 0.20.3 local (Excel), Apache-2.0
│   ├── util.js             ← formato, fechas, números, estadística, PRNG, descargas
│   ├── storage.js          ← IndexedDB + localStorage
│   ├── charts.js           ← librería de gráficos propia (Canvas)
│   ├── mapping.js          ← mapeo inteligente de variables y unidades
│   ├── importer.js         ← Excel/CSV, NASA POWER, hojas múltiples
│   ├── demo.js             ← generador de datos sintéticos (La Guajira)
│   ├── quality.js          ← validación, limpieza documentada, calidad de datos
│   ├── ml.js               ← Random Forest, persistencia, métricas, división 60/20/20
│   ├── decision.js         ← predicción diaria, reserva, riesgo, confiabilidad, escenarios
│   ├── specs.js            ← definición de gráficos compartida (app + informe)
│   ├── report.js           ← informe técnico / ejecutivo (A4)
│   ├── exports.js          ← HTML, Excel, CSV, configuración JSON
│   ├── simulation.js       ← simulación interactiva (gemelo digital, despacho de 5 min, Sankey)
│   ├── data/world.js       ← mapa mundial offline (Natural Earth 1:50m, 241 países, nombres en español)
│   ├── solar.js            ← geometría solar, transposición Hay–Davies, Erbs, temperatura de celda, inclinación óptima
│   ├── nasa.js             ← API NASA POWER (horario/diario/mensual/climatología), caché, unidades, resumen
│   ├── worldmap.js         ← mapa interactivo (Mercator, zoom, arrastre, país, día/noche, sitios guardados)
│   ├── designer.js         ← catálogo, dimensionamiento de cadenas y baterías, simulación 8 760 h, optimizador, unifilar
│   ├── costs.js            ← conductores y protecciones (NTC 2050), presupuesto editable, LCOE/VPN/TIR
│   ├── manual.js           ← manual de instalación específico del diseño
│   ├── views-project.js    ← páginas Sitio, Diseño, Costos y Manual
│   ├── assistant.js        ← Asistente SEGAR IA (chat local + API compatible con OpenAI)
│   └── views-*.js, app.js  ← interfaz, flujo de trabajo, historial y trazabilidad
├── assets/logo.svg
├── data/                   ← ejemplos (SINTÉTICOS) y plantillas para datos reales
├── reports/                ← informes de ejemplo generados con los datos de demostración
├── tools/generar_datos_demo.js  ← regenera los archivos de data/ (opcional, Node.js)
└── tools/build_world.js    ← regenera js/data/world.js desde Natural Earth (opcional, Node.js)
```

## 3. Flujo de trabajo (15 pasos)

`CARGAR → MAPEAR → VALIDAR → LIMPIAR → EXPLORAR → CONFIGURAR ML → ENTRENAR → VALIDAR → EVALUAR → PREDICCIÓN → DECISIÓN ENERGÉTICA → RECOMENDACIONES → ESCENARIOS → INFORME → DESCARGA`

La barra de pasos y el menú lateral muestran el avance. Cada ejecución recibe un identificador **RUN-AAAA-NNN**.

Metodología del curso (sección *Metodología*): 1) elegir el sistema, 2) formular la decisión, 3) conseguir los datos,
4) explorar y limpiar, 5) línea base y modelo, 6) evaluar (60/20/20 cronológico), 7) comunicar la decisión.

## 4. Datos admitidos

- **Excel** `.xlsx`/`.xls`: detecta hojas, filas, columnas, encabezados, tipos, fechas, números y vacíos. Si hay varias
  hojas se elige cuáles analizar: con las mismas columnas se **apilan**; con columnas distintas se **unen por fecha-hora**.
- **CSV/TXT**: delimitador automático (`,` `;` tab `|`), coma o punto decimal, UTF-8 o Windows-1252,
  formato **NASA POWER** (encabezado `-BEGIN HEADER- … -END HEADER-`, columnas `YEAR, MO, DY, HR`, código `-999`).
- Fuentes: NASA POWER, IDEAM (DHIME), UPME, XM/SIEM, datalogger del inversor y datos propios.
- Plantillas: `data/plantilla_datos_reales.xlsx` y `.csv`.

**Mapeo inteligente:** sinónimos en español/inglés y códigos (p. ej. `Wind Speed`, `WS10`, `Velocidad viento` → VELOCIDAD_VIENTO;
`GHI`, `Radiación global`, `Irradiance`, `ALLSKY_SFC_SW_DWN` → IRRADIANCIA; `PV Power`, `AC Power`, `Potencia FV` → POTENCIA_FV),
unidades del encabezado (W/kW/MW, Wh/kWh, kPa/hPa, K/°F, km/h…) y plausibilidad del contenido. Todo es editable.

## 5. Validación y limpieza (sin modificaciones silenciosas)

Validación: fechas, numéricos, NaN/vacíos, códigos −999, duplicados, negativos, valores físicamente imposibles
(GHI ≤ 1500 W/m², −40 ≤ T ≤ 60 °C, 0 ≤ HR ≤ 100 %, …), atípicos (IQR × 3; potencia > 1.25 × P99.5),
sensores congelados, inconsistencias irradiancia–potencia y discontinuidades temporales.

Limpieza configurable (cada acción se registra con hora, conteo y criterio en el **REGISTRO DE LIMPIEZA**):
eliminar duplicados, ordenar, negativos pequeños → 0, imposibles/atípicos/congelados → faltante,
exclusión de inconsistencias del entrenamiento, interpolación lineal de huecos cortos (solo variables meteorológicas continuas).

**Calidad de datos** = 100 × (C + K + T + O + V)/5 — completitud, consistencia, continuidad temporal, atípicos y validez.

## 6. Machine Learning

- **Random Forest Regressor** implementado localmente (árboles CART de regresión, bootstrap, `max_features`, cortes por
  histogramas de hasta 64 umbrales, importancia MDI, semilla reproducible). Parámetros iniciales: 100 árboles, profundidad 10,
  min samples leaf 2 (modificables).
- Objetivo automático: **POTENCIA FV [kW]** o, si no existe, **ENERGÍA FV [kWh]**.
- Entradas: irradiancia, GHI/POA, DNI, DHI, temperatura, humedad, viento (velocidad y dirección seno/coseno), presión,
  precipitación, hora, mes, día del año y variables cíclicas `hora_seno`, `hora_coseno`, `dia_año_seno`, `dia_año_coseno`.
- **Línea base de persistencia:** ŷ(t) = y(t − 24 h).
- **División cronológica 60/20/20** (nunca aleatoria), con fechas de cada conjunto; ajuste de profundidad con validación.
- Métricas en **datos de prueba**: MAE, RMSE, MAPE (solo |real| > 5 % del máximo), WAPE, R², sesgo, error en kW y kWh,
  error de energía diaria. Gráficos: real vs predicho, residuos, distribución de errores, error por hora, por mes y por condición meteorológica.

- **Línea base intermedia (v2.0):** regresión lineal por el origen ŷ = b·irradiancia, ajustada solo con entrenamiento.
  Usa la misma información meteorológica que el Random Forest con un modelo simple, para separar cuánto de la mejora
  frente a la persistencia viene del algoritmo y cuánto de disponer del clima observado.

## 7. De la predicción a la decisión

```
η_global                      = η_batería × η_inversor
Energía nocturna requerida    = Consumo nocturno / η_global
Reserva recomendada           = Energía nocturna requerida × (1 + margen de seguridad)
SOC objetivo                  = SOC_mín + Reserva / Capacidad × 100   (máx. 100 %)
Energía al anochecer          = E_actual + mín[(E_FV − C_día)·η_bat, capacidad libre]
Energía disponible (noche)    = Energía al anochecer − Capacidad × SOC_mín
Cobertura                     = Energía disponible / Reserva recomendada
Cobertura conservadora        = misma cuenta con E_FV × (1 − WAPE diario histórico del modelo)
```

**Backtest de la decisión y valor en pesos (v2.0).** En cada día de prueba se repite la decisión de la mañana con la
energía diaria prevista por cada regla (Random Forest, regresión lineal, persistencia, regla fija = día promedio del
entrenamiento y previsión perfecta como referencia) y se compara con la generación real:

```
Respaldo programado B   = mín(Reserva − Disponible(Ê), capacidad libre)   si Disponible(Ê) < Reserva
Disponible real         = mín(Disponible(E_real) + B, capacidad útil)
Déficit nocturno        = máx(0, Energía nocturna requerida − Disponible real) × η_global
Costo                   = B × costo respaldo [COP/kWh] + Déficit × costo kWh no servido [COP/kWh]
```

Los costos son supuestos editables en *Decisión energética* (por defecto COP 2 000 y COP 6 000 por kWh). El resultado
(noches con déficit, kWh y costo anual en COP) aparece en el Dashboard, en *Decisión energética* y en ambos informes.
Con la demo de La Guajira (72 días de prueba): modelo 0 noches con déficit, persistencia 4, regla fija 9; ahorro
estimado ≈ COP 0,94 millones/año frente a la persistencia.

**Riesgo** (reglas, no probabilidad): R1 ALTO si la reserva supera la capacidad útil · R2 ALTO si cobertura < 100 % ·
R3 MODERADO si solo la cobertura conservadora < 100 % · R4 BAJO · R5 BAJO → MODERADO si confiabilidad < 50.

**Índice de confiabilidad** (0–100, no es probabilidad): 0.30·(1 − WAPE) + 0.15·cantidad de datos + 0.20·calidad +
0.20·similitud de las entradas con el entrenamiento (P1–P99) + 0.15·cobertura de meses.

La predicción es **puntual** (no se inventan intervalos de confianza); se acompaña del error histórico, registros
históricos comparables e indicador de calidad. El perfil del resto del día usa la climatología horaria del mes ajustada
a las condiciones ingresadas.

## 8. Informes y descargas

- **INFORME TÉCNICO** (metodología, fórmulas, variables, métricas, gráficos, resultados, limitaciones) e
  **INFORME EJECUTIVO** (problema, resultado, riesgo, decisión, recomendación).
- **IMPRIMIR / GUARDAR COMO PDF**: usa `window.print()` con hoja A4 preparada; funciona sin internet.
- Descargas: informe HTML autónomo, resultados Excel (11 hojas), datos procesados CSV, resultados CSV, configuración JSON
  (también se puede volver a cargar).

## 9. Simulación interactiva (gemelo digital)

Página **🛰 Simulación interactiva**: reproduce un día completo (06:00 → 06:00, paso de 5 min) con un esquema animado
del sistema (sol y cielo según la hora, nubes, arreglo FV, inversor, batería, carga y respaldo) y flujos de potencia
animados cuyo grosor y velocidad dependen de la potencia. Panel de instrumentos con reloj, anillo de SOC con la marca
de la reserva, medidores y estado operativo; línea de tiempo con reproducción (15 min/s a 3 h/s).

- **Fuente del perfil FV:** Random Forest entrenado + climatología del mes, día histórico real de los datos, o modelo
  físico de cielo claro. Variabilidad de nubes estocástica que conserva la energía diaria.
- **Controles:** irradiancia, temperatura, kWp, inversor, capacidad y potencia de batería, eficiencias, SOC inicial y
  mínimo, consumo diario, SOC de reserva, respaldo (generador/red o sistema aislado).
- **Estrategias:** *Predictiva (SEGAR)* — de día solo descarga si el excedente previsto hasta el anochecer permite
  recuperar el SOC de reserva; *Reserva fija*; *Autoconsumo máximo*. Tabla comparativa de las tres.
- **Resultados:** KPIs (energía FV, consumo, autosuficiencia, respaldo, energía no servida, recorte, SOC al anochecer
  vs. reserva, SOC al amanecer, ciclos), gráficos de potencia y SOC con cursor de tiempo, diagrama de Sankey diario.
  Se incluye en el informe técnico (sección 12b).

## 10. Proyecto FV: sitio, NASA POWER, diseño, costos y manual

**🌍 Sitio y NASA POWER**
- Mapa mundial **offline** (Natural Earth 1:50m, proyección Mercator): arrastre, rueda/pellizco para acercar, clic para
  elegir el punto, búsqueda de ciudades o «lat, lon», país bajo el cursor, terminador día/noche actual, barra de escala
  y marcadores de las consultas guardadas.
- Consulta estilo **Data Access Viewer**: (1) comunidad RE/AG/SB, (2) promedio temporal horario/diario/mensual/
  climatología, (3) punto, (4) periodo, (5) parámetros por categoría con el límite de la API (15 horario, 20 los demás)
  y atajos «Recomendado para FV», «Solo radiación», «Meteorología», (6) URL de la API, copia y enlace al CSV oficial.
- Las respuestas se guardan en IndexedDB (uso sin conexión). Sin internet: descargue el CSV oficial en otro equipo e
  impórtelo con **📂 Importar CSV de NASA**.
- Resumen del recurso: GHI anual, horas solares pico, mes crítico, temperaturas, viento, **inclinación óptima**
  (Hay–Davies con días medios de Collares-Pereira & Rabl), mapa de calor mes × hora y tabla mensual.
- **Usar en el análisis (ML):** convierte los datos horarios/diarios en datos del flujo de 15 pasos. Como NASA no mide la
  producción de su planta, la columna objetivo `POTENCIA_FV_ESTIMADA` se **estima con el modelo físico del arreglo
  diseñado** y así se declara en la app y en el informe.

**🧩 Diseño del sistema**
- **Atajos**: residencial on-grid, híbrido con reserva nocturna (toma los consumos de la decisión), aislado rural,
  comercial 50 kW y microinversores.
- **Catálogo editable** (valores típicos de ficha técnica 2026): 8 módulos (TOPCon, HJT, BC, PERC, poli, CdTe, 12 V),
  9 inversores (string mono/trifásicos, híbridos 48 V, aislado con MPPT, microinversor) y 6 baterías (LiFePO₄, AGM, gel,
  OPzV). ✎ edita fichas y precios; ＋ agrega componentes propios.
- **Dimensionamiento**: kWp por energía (promedio anual o mes crítico, cobertura y margen); cadenas con Voc a T mín.,
  Vmp a T de celda máx., ventana MPPT, tensión de arranque, corriente e Isc por MPPT, potencia DC máx. y relación DC/AC;
  número de inversores; banco de baterías coherente con la decisión (reserva = noche/(η_bat·η_inv)·(1+margen) entre el
  SOC mínimo y 100 %), corrientes y límites del BMS.
- **Simulación horaria de 8 760 h**: transposición, IAM, temperatura NOCT + viento, pérdidas, cableado DC calculado,
  curva de eficiencia y recorte del inversor, despacho con batería, red o energía no suministrada.
- **Optimizador**: evalúa todas las combinaciones compatibles y las ordena por LCOE, kWh/kWp, fracción solar, CAPEX o
  área; muestra los motivos de descarte. Verificación eléctrica ✓/✗, cadena de pérdidas, balance, **diagrama unifilar**
  y **ficha técnica** (CSV). «Aplicar al sistema y a la decisión» actualiza kWp, inversor, batería y la decisión.

**💲 Costos y presupuesto (editable)**
- Partidas calculadas desde el diseño: módulos, inversores, baterías, estructura, conectores, **cableado DC/AC/baterías
  dimensionado** (ampacidad NTC 2050 Tabla 310.15(B)(16), factor de temperatura, caída de tensión), fusibles gPV,
  seccionador DC, DPS DC/AC, interruptores, puesta a tierra, canalización, monitoreo, medidor bidireccional,
  señalización, mano de obra, pruebas IEC 62446-1, ingeniería, dictamen RETIE, trámite CREG 174 y transporte.
- Cantidades y precios editables (↺ restablece), partidas adicionales, excluir partidas, contingencia, AIU, IVA 19 % y
  exclusión por **Ley 1715/2014** (mod. Ley 2099/2021). Moneda COP/USD con TRM editable (3 192.53 COP/USD, 22-sep-2026).
- Economía: LCOE, VPN, TIR y recuperación con degradación, escalamiento de tarifa, O&M y reposición de inversor y
  baterías. Exporta **Excel** (presupuesto, ficha técnica, flujo de caja), CSV, HTML e impresión/PDF.
- Precios **referenciales** (COP 2026, sin IVA): módulos TOPCon ≈ US$ 0.11/W FOB China (pv magazine, jul-2026),
  baterías LFP 51.2 V ≈ 0.6–0.9 millones COP/kWh al detal, sistemas on-grid en Colombia 3.5–5 millones COP/kWp.
  Reemplácelos por sus cotizaciones.

**📘 Manual de instalación**
Documento de obra generado para el diseño: normativa (RETIE Res. 40117/2024, NTC 2050 690/705/706/480/250, IEC 62446-1,
IEC 60364-7-712, CREG 174/2021, Res. 4272/2021 alturas), seguridad y cinco reglas de oro, herramientas, materiales,
estructura (separación entre filas sin sombras), montaje, **tabla de cadenas con Voc/Isc esperados**, protecciones y
conductores, inversor, baterías y parámetros de configuración, puesta a tierra, rótulos, secuencia de pruebas y protocolo
con casillas, mantenimiento, solución de problemas, unifilar y firmas. Imprimible (A4) y descargable (HTML).
Debe ser revisado y firmado por un profesional competente con matrícula vigente.

## 11. Asistente SEGAR IA (chatbot)

Botón **✦ Asistente SEGAR** (abajo a la derecha, en todas las páginas).

- **Modo local (sin conexión):** responde con los resultados calculados (reserva, SOC, riesgo, métricas, importancia,
  calidad, confiabilidad, limpieza, escenarios) y ejecuta comandos: «ejecuta el flujo completo», «entrena con 200 árboles»,
  «recalcula la decisión con SOC 40 y margen 20», «simula irradiancia −30 %», «abre la simulación y reprodúcela»,
  «genera el informe ejecutivo», «descarga el Excel», «elige el punto 11.54, -72.91», «consulta NASA POWER horario»,
  «diseña un sistema aislado de 12 kWh con 7 kWh de noche», «¿cuánto cuesta el sistema en dólares?», «descarga el manual».
- **Modo en línea (opcional):** API compatible con OpenAI. **DeepSeek** por defecto (`https://api.deepseek.com`,
  modelos `deepseek-flash` o `deepseek-v4-pro`) u OpenAI. Responde preguntas abiertas de ingeniería con el contexto de
  la operación y puede **proponer acciones** sobre la app, que usted confirma con «Ejecutar».
- **Configurar la clave:** ✦ Asistente → ⚙ → pegue su clave API → *Probar conexión* → *Guardar*. El proveedor se
  detecta por el formato de la clave. La clave **no está escrita en el código** ni se incluye en los archivos exportados;
  se guarda solo en el navegador (o solo en la pestaña si desmarca «Recordar»).
- **Privacidad:** en línea se envían su pregunta y un **resumen agregado** de resultados (puede desactivarlo); nunca el
  archivo ni los datos brutos. En modo local no sale nada del equipo.
- Otro proveedor compatible con OpenAI: agregue su dominio a `connect-src` en `index.html` y su URL en
  `A.PROVIDERS` de `js/assistant.js`.

## 12. Almacenamiento, historial y privacidad

- Sesión, datos, modelo y resultados en **IndexedDB** del navegador (se restauran al reabrir); preferencias en localStorage.
- **Historial de operaciones** con fecha, archivo, registros, huella de datos, modelo, parámetros, MAE, RMSE, generación,
  reserva, SOC, riesgo y recomendación; exportable a CSV/JSON.
- **Privacidad:** los datos son procesados localmente y no son enviados a servidores externos.
- «Limpiar datos» quita los datos de la sesión; «Eliminar base actual» borra toda la base local (incluido el historial).

## 13. Datos de demostración

`CARGAR DEMO LA GUAJIRA` genera en el navegador 1 año horario **sintético** (modelo físico simplificado: geometría solar,
cielo claro de Haurwitz, nubosidad estacional, separación de Erbs, temperatura de celda de Faiman, suciedad, fallas parciales)
con problemas de calidad inyectados a propósito. En toda la aplicación y en los informes aparece:
**DATOS SINTÉTICOS DE DEMOSTRACIÓN — NO SON DATOS REALES**.

## 14. Verificación realizada

Probado en Chromium sin conexión (contexto *offline* y bloqueo de toda petición no local): 0 errores de JavaScript y
0 peticiones de red; lectura de Excel multihoja (unión por fecha-hora y conversión kPa → hPa), CSV, formato NASA POWER;
validación, limpieza, entrenamiento (~1 s para 100 árboles con 5 200 registros), métricas, 30+ gráficos, predicción,
reserva, riesgo, recomendaciones, escenarios, informe técnico/ejecutivo, PDF A4 por impresión, todas las descargas,
historial, restauración de sesión, tema oscuro y vista móvil. Simulación interactiva (las tres fuentes y las tres
estrategias, reproducción animada) y asistente (modo local con comandos; modo en línea probado con una respuesta
simulada del API en *streaming*, verificando que se envía el resumen agregado y no los datos brutos). Proyecto FV
(v1.2): mapa (clic, búsqueda, zoom, arrastre), consulta NASA POWER con una respuesta de prueba que replica el formato JSON
de la API (el entorno de pruebas no tiene acceso a internet), resumen del recurso, uso en el ML (mapeo automático y
entrenamiento), diseño/optimizador en los tres tipos de sistema, edición de catálogo, presupuesto (cantidades, Ley 1715,
USD, Excel), manual (HTML y PDF A4), comandos del asistente y vista móvil sin desbordamiento.

## 15. Limitaciones

- El modelo estima la generación a partir de condiciones meteorológicas de la misma hora; en operación anticipada estas
  entradas deben venir de un pronóstico, cuyo error se sumaría.
- Balance de batería simplificado (eficiencias constantes, sin límites de potencia ni degradación).
- El riesgo y la confiabilidad son clasificaciones por reglas explícitas, no probabilidades.
- El backtest de la decisión es simplificado (cada día inicia con el mismo SOC; consumos y eficiencias constantes) y
  su valor en pesos depende de costos por kWh supuestos.
- Los resultados con datos sintéticos solo ilustran el funcionamiento de la herramienta.
- La simulación usa perfiles horarios interpolados y un modelo de batería simplificado; la estrategia predictiva supone
  que el perfil previsto se cumple (previsión perfecta dentro de la simulación).
- El asistente en línea depende del proveedor externo; sus respuestas deben verificarse con los resultados de la app.
- NASA POWER entrega datos de satélite y reanálisis (celda de ½° a 1°), no mediciones en sitio. La generación estimada
  para el ML es un modelo físico, no una medición.
- El diseñador usa inversores iguales en paralelo y fichas técnicas típicas; los precios son referenciales. El diseño,
  el presupuesto y el manual son de prefactibilidad y deben validarse con el diseño de detalle, los manuales de los
  fabricantes y la inspección RETIE.

## 16. Cambios de la versión 2.0 (2026-10-01)

- Nuevo nombre: **SEGAR SOLAR ENERGY DECISIÓN IA** (interfaz, informes, exportaciones y asistente). Las configuraciones
  JSON exportadas con el nombre anterior se siguen pudiendo cargar.
- Línea base intermedia de regresión lineal sobre la irradiancia (página Evaluación e informe técnico).
- Backtest de la decisión en los días de prueba con su valor en pesos (Dashboard, Decisión energética e informes),
  con costos por kWh editables.
- Verificado en Chromium sin conexión: flujo completo con la demo, informes técnico y ejecutivo, 0 errores de
  JavaScript y 0 peticiones de red. Informes de ejemplo de `reports/` regenerados.
