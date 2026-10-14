# Recursos de terceros alojados localmente (H-08)

Antes se cargaban desde Google Fonts, jsDelivr y cdnjs, que recibían la IP de cada visitante.
Ahora se sirven desde este mismo dominio. Archivos obtenidos del registro npm, sin modificar:

| Archivo | Paquete npm | Versión | Licencia |
|---|---|---|---|
| chart.umd.min.js | chart.js (dist/chart.umd.js) | 4.4.0 | MIT |
| jspdf.umd.min.js | jspdf | 2.5.1 | MIT |
| jspdf.plugin.autotable.min.js | jspdf-autotable | 3.8.2 | MIT |
| xlsx.full.min.js | xlsx | 0.18.5 | Apache-2.0 |
| supabase.min.js | @supabase/supabase-js (dist/umd/supabase.js) | 2.117.3 | MIT |
| fonts/inter-*.woff2 | @fontsource-variable/inter | 5.3.0 | OFL-1.1 |
| fonts/plus-jakarta-sans-*.woff2 | @fontsource-variable/plus-jakarta-sans | 5.3.0 | OFL-1.1 |

Actualizar: `npm i <paquete>@<versión>` en un directorio temporal y copiar el archivo indicado.
Nota: xlsx 0.18.5 es la última versión publicada en npm y tiene avisos de seguridad conocidos
corregidos en versiones que SheetJS solo distribuye desde su propio sitio; en MoneyNest solo se
usa para exportar, nunca para leer archivos de terceros — revisar antes de ampliar su uso.
Stripe (js.stripe.com) y Cloudflare Turnstile no se pueden alojar localmente.
