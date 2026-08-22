// Guías completas para los 63 logros con roadmap + protips
const ACH_GUIDES_COMPLETE = {
  // INICIO
  primer_ingreso: {
    steps: ['Ve al Dashboard', 'Pulsa el botón "+" flotante verde', 'Selecciona "Ingreso"', 'Rellena importe y concepto', 'Guarda'],
    tip: 'Registra todos tus ingresos para tener control total de tu dinero'
  },
  primer_gasto: {
    steps: ['Pulsa el botón "+"', 'Selecciona "Gasto"', 'Introduce importe y elige categoría', 'Opcionalmente marca como recurrente', 'Guarda'],
    tip: 'Cada gasto registrado te acerca a entender tus patrones de consumo'
  },
  primera_deuda: {
    steps: ['Ve a la sección "Deudas"', 'Pulsa "+ Nueva deuda"', 'Introduce nombre, importe total e interés', 'Define la fecha de vencimiento', 'Guarda'],
    tip: 'Tener tus deudas registradas es el primer paso para liberarte de ellas'
  },
  primera_inversion: {
    steps: ['Accede a "Inversiones"', 'Pulsa "+ Nueva inversión"', 'Elige categoría (ETF, Acciones, Cripto, etc)', 'Introduce importe inicial y fecha', 'Guarda'],
    tip: 'Registra todas tus inversiones para calcular tu ROI automáticamente'
  },
  primer_objetivo: {
    steps: ['Ve a "Objetivos"', 'Pulsa "+ Nuevo objetivo"', 'Define nombre, meta y plazo', 'Establece aportación mensual estimada', 'Guarda'],
    tip: 'Los objetivos claros con plazos te motivan a ahorrar consistentemente'
  },
  primer_presupuesto: {
    steps: ['Ve a "Objetivos" → pestaña "Presupuestos"', 'Pulsa "Crear presupuesto"', 'Elige una categoría de gasto', 'Asigna un límite mensual', 'Activa'],
    tip: 'Los presupuestos te avisan cuando te estás pasando en una categoría'
  },

  // INGRESOS
  diez_ingresos: {
    steps: ['Registra ingresos de diferentes fuentes', 'Usa categorías: Salario, Freelance, Dividendos, etc', 'Sé constante cada mes', 'Alcanza 10 registros totales'],
    tip: 'Diversificar tus fuentes de ingresos es clave para seguridad financiera'
  },
  ingreso_recurrente: {
    steps: ['Al crear un ingreso, marca el checkbox "Recurrente"', 'Define la frecuencia (mensual, semanal, etc)', 'MoneyNest lo proyectará automáticamente'],
    tip: 'Los ingresos recurrentes te permiten hacer proyecciones de flujo de caja'
  },
  cinco_categorias_ing: {
    steps: ['Explora las categorías predeterminadas', 'O crea categorías personalizadas en Configuración', 'Usa al menos 5 categorías diferentes en tus ingresos'],
    tip: 'Categorizar te ayuda a identificar qué fuentes de dinero son más rentables'
  },
  ingreso_grande: {
    steps: ['Registra un ingreso extraordinario de +5.000€', 'Puede ser un bono, venta de activo, herencia, etc', 'Márcalo con la categoría apropiada'],
    tip: 'Los ingresos grandes son oportunidades perfectas para invertir o saldar deudas'
  },
  mes_record_ingresos: {
    steps: ['Supera tu propio récord mensual de ingresos', 'Revisa el histórico en Análisis para ver tu mejor mes', 'Celébra tus logros financieros'],
    tip: 'Batir tus propios récords demuestra que estás progresando financieramente'
  },

  // GASTOS
  cincuenta_gastos: {
    steps: ['Registra TODOS tus gastos durante varios meses', 'No te saltes ni el café', 'Categoriza correctamente cada uno', 'Alcanza 50 registros'],
    tip: 'La constancia en registrar gastos revela patrones que no sabías que tenías'
  },
  presupuesto_cumplido: {
    steps: ['Crea un presupuesto en una categoría', 'Monitorea tus gastos durante el mes', 'Mantente por debajo del límite todo el mes'],
    tip: 'Cumplir presupuestos requiere disciplina pero se vuelve un hábito positivo'
  },
  tres_presupuestos: {
    steps: ['Ve a Presupuestos', 'Crea límites para 3 categorías diferentes', 'Empieza con las que más gastas: Restaurantes, Ocio, Compras'],
    tip: 'Tener varios presupuestos te da control total sobre tu dinero'
  },
  gasto_eliminado: {
    steps: ['Encuentra un gasto que registraste por error', 'Pulsa sobre él', 'Edítalo o elimínalo', '¡Listo!'],
    tip: 'Corregir errores mantiene tus datos precisos y útiles'
  },
  mes_austero: {
    steps: ['Planifica un mes de ahorro intensivo', 'Reduce gastos no esenciales', 'Logra que tus gastos sean <50% de tus ingresos'],
    tip: 'Un mes austero puede ser el impulso que necesitas para saldar una deuda'
  },
  gasto_recurrente: {
    steps: ['Al crear un gasto, marca "Recurrente"', 'Ideal para: Netflix, Gym, Seguros, Alquiler', 'MoneyNest lo proyectará cada mes'],
    tip: 'Los gastos recurrentes identificados te ayudan a optimizar suscripciones'
  },

  // INVERSIONES
  cinco_inversiones: {
    steps: ['Diversifica tu cartera en diferentes activos', 'Considera: ETFs, Acciones, Bonos, Cripto, Inmuebles', 'Mantén activas 5 inversiones simultáneamente'],
    tip: 'La diversificación reduce riesgo y aumenta probabilidad de rendimiento'
  },
  inversion_liquidada: {
    steps: ['Ve a una inversión activa', 'Pulsa "Liquidar"', 'Introduce el valor final de salida', 'MoneyNest calculará tu ROI automáticamente'],
    tip: 'Liquidar inversiones con ganancia es el objetivo, pero las pérdidas enseñan'
  },
  ganancia_positiva: {
    steps: ['Cierra una inversión con ROI positivo', 'Puede ser pequeña ganancia, ¡cada % cuenta!', 'Analiza qué hiciste bien para repetirlo'],
    tip: 'Tu primera ganancia positiva demuestra que puedes hacer crecer tu dinero'
  },
  diez_inversiones: {
    steps: ['Invierte regularmente durante varios meses', 'Combina inversiones de corto, medio y largo plazo', 'Alcanza 10 inversiones registradas'],
    tip: 'Un historial de inversiones te permite analizar qué estrategias funcionan mejor'
  },
  roi_chart: {
    steps: ['Ve a Inversiones', 'Scroll hasta el gráfico de ROI', 'Observa tu evolución de rentabilidad'],
    tip: 'El gráfico de ROI muestra tu tendencia como inversor a lo largo del tiempo'
  },
  cinco_categorias_inv: {
    steps: ['Explora categorías: ETF, Acciones, Bonos, Cripto, Inmuebles', 'Invierte en al menos 5 categorías diferentes', 'Cada una tiene riesgo/rentabilidad distinta'],
    tip: 'Diversificar por categorías protege tu cartera de caídas sectoriales'
  },
  inversion_cripto: {
    steps: ['Crea una inversión con categoría "Cripto"', 'Puede ser Bitcoin, Ethereum, o cualquier criptomoneda', 'Registra compra y sigue su evolución'],
    tip: 'Las criptos son volátiles pero pueden ofrecer rendimientos altos'
  },

  // DEUDAS
  pago_deuda: {
    steps: ['Ve a una deuda activa', 'Pulsa "Registrar pago"', 'Introduce el importe pagado este mes', 'MoneyNest actualizará el saldo restante'],
    tip: 'Cada pago, por pequeño que sea, te acerca a la libertad financiera'
  },
  deuda_saldada: {
    steps: ['Continúa pagando una deuda hasta que el saldo llegue a 0', 'MoneyNest la marcará como saldada automáticamente', '¡Celébralo!'],
    tip: 'Saldar una deuda libera flujo de caja para invertir o ahorrar'
  },
  sin_deudas: {
    steps: ['Salda TODAS tus deudas registradas', 'Una por una, siguiendo una estrategia', 'Alcanza balance cero en deudas'],
    tip: 'Estar libre de deudas es uno de los hitos más importantes en finanzas personales'
  },
  estrategia_deuda: {
    steps: ['Ve a Deudas → "Simulador de pago"', 'Compara Avalancha (menor interés) vs Bola de nieve (menor saldo)', 'Elige tu estrategia y síguea'],
    tip: 'Avalancha ahorra más dinero en intereses, Bola de nieve da victorias rápidas'
  },

  // OBJETIVOS
  cinco_objetivos: {
    steps: ['Define metas concretas: Emergencia, Vacaciones, Coche, etc', 'Crea 5 objetivos de ahorro', 'Asigna plazos realistas a cada uno'],
    tip: 'Tener varios objetivos te motiva a ahorrar para cosas que realmente importan'
  },
  objetivo_completado: {
    steps: ['Ahorra consistentemente en un objetivo', 'Haz aportaciones regulares', 'Cuando llegues a la meta, márcalo como completado'],
    tip: 'Completar un objetivo refuerza tu disciplina financiera'
  },
  tres_obj_completos: {
    steps: ['Completa 3 objetivos diferentes', 'Pueden ser pequeños (1.000€) o grandes (20.000€)', 'Lo importante es terminarlos'],
    tip: 'Cada objetivo completado aumenta tu confianza para metas más ambiciosas'
  },
  aportacion_objetivo: {
    steps: ['Ve a un objetivo activo', 'Pulsa "Aportar"', 'Introduce el importe que ahorras este mes', 'MoneyNest actualizará el progreso'],
    tip: 'Las aportaciones pequeñas y constantes suman más que aportaciones grandes esporádicas'
  },
  objetivo_grande: {
    steps: ['Crea un objetivo ambicioso de +10.000€', 'Puede ser: Casa, Coche, Inversión inicial', 'Divide la meta en hitos mensuales'],
    tip: 'Las grandes metas requieren planificación pero son totalmente alcanzables'
  },
  objetivo_rapido: {
    steps: ['Crea un objetivo pequeño y alcanzable', 'Ahorra intensivamente', 'Complétalo en menos de 30 días'],
    tip: 'Las victorias rápidas generan momentum para objetivos más largos'
  },

  // PATRIMONIO
  tres_cuentas: {
    steps: ['Ve a Cuentas', 'Añade al menos 3 cuentas diferentes', 'Pueden ser: Banco, Efectivo, Cripto, Ahorro'],
    tip: 'Gestionar múltiples cuentas te da visibilidad total de dónde está tu dinero'
  },
  patrimonio_10k: {
    steps: ['Suma de: Cuentas + Inversiones - Deudas debe superar 10.000€', 'Ahorra e invierte consistentemente', 'Reduce deudas'],
    tip: '10K es un hito psicológico importante que demuestra solidez financiera'
  },
  patrimonio_50k: {
    steps: ['Continúa acumulando activos', 'Invierte ganancias', 'Mantén deudas bajo control', 'Alcanza 50.000€ netos'],
    tip: '50K te pone en el camino hacia independencia financiera'
  },
  saldo_positivo: {
    steps: ['Asegúrate de que Ingresos > Gastos este mes', 'Revisa el KPI de Cash Flow en Dashboard', 'Debe estar en verde'],
    tip: 'El flujo de caja positivo sostenido es la base de la riqueza'
  },
  activo_fisico: {
    steps: ['Ve a Patrimonio → Activos físicos', 'Añade propiedades, vehículos, joyas, etc', 'Introduce valor actual'],
    tip: 'Los activos físicos son parte importante de tu patrimonio neto'
  },

  // CONSTANCIA
  streak_7: {
    steps: ['Abre MoneyNest cada día durante 7 días', 'Registra al menos 1 transacción diaria', 'No rompas la racha'],
    tip: 'La constancia convierte el control financiero en un hábito automático'
  },
  streak_30: {
    steps: ['Mantén tu racha durante 30 días', 'Usa MoneyNest como herramienta diaria', 'Revisa tus números cada día'],
    tip: '30 días es el tiempo que se necesita para formar un hábito permanente'
  },
  streak_100: {
    steps: ['Usa MoneyNest durante 100 días consecutivos', 'Conviértelo en parte de tu rutina', 'Eres imparable'],
    tip: '100 días de racha significa que dominas tus finanzas como un profesional'
  },
  ahorrador_3meses: {
    steps: ['Asegura que Ingresos > Gastos durante 3 meses seguidos', 'No rompas la racha', 'Invierte o ahorra la diferencia'],
    tip: '3 meses de ahorro positivo demuestran que tienes control real'
  },
  ahorrador_6meses: {
    steps: ['Mantén ahorro positivo durante medio año', 'Ajusta gastos cuando sea necesario', 'Aumenta ingresos si puedes'],
    tip: '6 meses de ahorro sostenido te pone en el top 10% de disciplina financiera'
  },

  // PRO
  exportador_pdf: {
    steps: ['Ve a Dashboard', 'Pulsa "Exportar" en la topbar', 'Elige formato PDF', 'Descarga tu reporte financiero'],
    tip: 'Los PDFs son perfectos para imprimir o compartir con asesores financieros'
  },
  exportador_excel: {
    steps: ['Ve a Dashboard', 'Pulsa "Exportar"', 'Elige formato Excel', 'Abre el archivo para análisis avanzado'],
    tip: 'Excel te permite hacer análisis personalizados con tus datos'
  },
  personalizado: {
    steps: ['Ve a Configuración', 'Busca "Categorías personalizadas"', 'Crea una categoría única para tus necesidades'],
    tip: 'Las categorías personalizadas adaptan MoneyNest a tu estilo de vida'
  },
  modo_demo: {
    steps: ['Ve a Configuración', 'Activa "Modo demo"', 'Explora la app con datos de ejemplo', 'Sal del demo cuando estés listo'],
    tip: 'El modo demo es perfecto para experimentar sin miedo a romper tus datos reales'
  },
  cambio_tema: {
    steps: ['Ve a Configuración → Apariencia', 'Cambia entre tema Claro y Oscuro', 'Elige el que te resulte más cómodo'],
    tip: 'El tema oscuro reduce fatiga visual en uso nocturno'
  },
  cambio_idioma: {
    steps: ['Ve a Configuración → Idioma', 'Elige entre 6 idiomas disponibles', 'La app se traduce instantáneamente'],
    tip: 'MoneyNest habla tu idioma para que te sientas como en casa'
  },
  chatbot_usado: {
    steps: ['Pulsa el botón de chat flotante', 'Pregunta algo sobre tus finanzas', 'El asistente IA te responderá con contexto'],
    tip: 'El chatbot puede darte insights que no verías manualmente en los datos'
  },

  // EXPLORADOR
  todas_paginas: {
    steps: ['Visita todas las secciones del menú lateral', 'Dashboard, Ingresos, Gastos, Inversiones, Deudas, Objetivos, Presupuestos, Cuentas, Patrimonio, Análisis, Logros, Configuración'],
    tip: 'Cada sección tiene herramientas únicas para gestionar tu dinero'
  },
  pagina_dashboard: {
    steps: ['Abre MoneyNest', 'El Dashboard es la primera pantalla', 'Revisa todos los KPIs y gráficos'],
    tip: 'El Dashboard te da una visión 360° de tu salud financiera en segundos'
  },
  pagina_analisis: {
    steps: ['Pulsa "Análisis" en el menú', 'Explora gráficos, proyecciones y tendencias', 'Usa los filtros para profundizar'],
    tip: 'Análisis te muestra patrones que no ves en el día a día'
  },
  pagina_patrimonio: {
    steps: ['Ve a "Patrimonio"', 'Revisa tu evolución de activos vs pasivos', 'Observa tu gráfico histórico'],
    tip: 'Tu patrimonio neto es el KPI más importante para medir riqueza real'
  },
  pagina_logros: {
    steps: ['Pulsa "Logros" en el menú', 'Explora todos los achievements disponibles', '¡Estás aquí ahora mismo!'],
    tip: 'Los logros gamifican tus finanzas y te enseñan a usar cada función'
  },
  configuracion_vista: {
    steps: ['Ve a "Configuración"', 'Explora todas las opciones disponibles', 'Personaliza MoneyNest a tu gusto'],
    tip: 'Configuración te permite ajustar la app exactamente como la necesitas'
  },

  // ESPECIALES
  madrugador: {
    steps: ['Despierta temprano (antes de las 7am)', 'Abre MoneyNest', 'Registra una transacción'],
    tip: 'Los madrugadores suelen ser más disciplinados financieramente'
  },
  nocturno: {
    steps: ['Usa MoneyNest después de las 23h', 'Registra gastos del día antes de dormir', 'Es un excelente hábito nocturno'],
    tip: 'Revisar finanzas antes de dormir te ayuda a dormir tranquilo'
  },
  fin_de_semana: {
    steps: ['Abre MoneyNest un sábado o domingo', 'Registra transacciones del fin de semana', 'Mantén el control 7 días/semana'],
    tip: 'Los fines de semana suelen tener gastos impulsivos, regístralos'
  },
  perfeccionista: {
    steps: ['Completa el 100% de tus objetivos de ahorro', 'No abandones ninguno a medias', 'Termina lo que empiezas'],
    tip: 'El perfeccionismo financiero te convierte en una máquina de lograr metas'
  },
  completista: {
    steps: ['Desbloquea TODOS los demás logros', 'Explora cada rincón de MoneyNest', 'Domina todas las funcionalidades', '¡Serás un maestro!'],
    tip: 'Solo el 1% de usuarios desbloquea todos los logros. ¿Serás tú uno de ellos?'
  }
};
