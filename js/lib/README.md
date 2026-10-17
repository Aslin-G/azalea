# Librerías locales

| Archivo | Librería | Versión | Licencia | Uso |
|---|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.20.3 | Apache License 2.0 (`SHEETJS-LICENSE.txt`) | Lectura de `.xlsx`/`.xls` y escritura del libro de resultados |

La copia se obtuvo del paquete npm `@e965/xlsx@0.20.3`, que republica sin cambios la
distribución oficial de SheetJS CE 0.20.3 (el CDN oficial `cdn.sheetjs.com` no se usa en
tiempo de ejecución). La aplicación **no carga ningún recurso desde internet**.

Si desea reemplazarla por la descarga oficial, copie `xlsx.full.min.js` de
<https://cdn.sheetjs.com/> (misma versión o superior) en esta carpeta.
