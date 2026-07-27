/**
 * MoneyNest — js/gamification.js
 * Achievements, streak system, confetti. Completely self-contained.
 */
;(function () {
  'use strict';

  const STORE_KEY  = 'mn_achievements';
  const STREAK_KEY = 'mn_streak';

  // ─── Achievement definitions — nombres y descs via t() ───────────
  function _ach() {
    // _w: translate key with fallback. If t() returns the key itself (not found), use fallback.
    const _w = (k, fb) => {
      if (typeof window.t !== 'function') return fb;
      const r = window.t(k);
      return (r && r !== k) ? r : fb;
    };
    return [
      // ── Primeros pasos (6) ──
      { id:'primer_ingreso',      emoji:'💰', cat:'inicio',    get nombre(){ return _w('ach_primer_ingreso_n','Primer ingreso') },         get desc(){ return _w('ach_primer_ingreso_d','Añade tu primer ingreso') }},
      { id:'primer_gasto',        emoji:'📝', cat:'inicio',    get nombre(){ return _w('ach_primer_gasto_n','Primer gasto') },             get desc(){ return _w('ach_primer_gasto_d','Registra tu primer gasto') }},
      { id:'primera_deuda',       emoji:'💳', cat:'inicio',    get nombre(){ return _w('ach_primera_deuda_n','Deuda registrada') },        get desc(){ return _w('ach_primera_deuda_d','Registra tu primera deuda') }},
      { id:'primera_inversion',   emoji:'📈', cat:'inicio',    get nombre(){ return _w('ach_primera_inv_n','Inversor') },                  get desc(){ return _w('ach_primera_inv_d','Crea tu primera inversión') }},
      { id:'primer_objetivo',     emoji:'🎯', cat:'inicio',    get nombre(){ return _w('ach_primer_obj_n','Soñador') },                    get desc(){ return _w('ach_primer_obj_d','Crea tu primer objetivo de ahorro') }},
      { id:'primer_presupuesto',  emoji:'📋', cat:'inicio',    get nombre(){ return _w('ach_primer_pres_n','Planificador') },              get desc(){ return _w('ach_primer_pres_d','Crea tu primer presupuesto') }},

      // ── Ingresos (5) ──
      { id:'diez_ingresos',       emoji:'💵', cat:'ingresos',  get nombre(){ return _w('ach_diez_ing_n','Flujo constante') },              get desc(){ return _w('ach_diez_ing_d','10 ingresos registrados') }},
      { id:'ingreso_recurrente',  emoji:'🔄', cat:'ingresos',  get nombre(){ return _w('ach_ing_rec_n','Ingresos automáticos') },          get desc(){ return _w('ach_ing_rec_d','Crea tu primer ingreso recurrente') }},
      { id:'cinco_categorias_ing',emoji:'🏷️', cat:'ingresos',  get nombre(){ return _w('ach_5cat_ing_n','Ingresos diversificados') },      get desc(){ return _w('ach_5cat_ing_d','Usa 5 categorías diferentes de ingresos') }},
      { id:'ingreso_grande',      emoji:'💎', cat:'ingresos',  get nombre(){ return _w('ach_ing_grande_n','Golpe maestro') },              get desc(){ return _w('ach_ing_grande_d','Registra un ingreso de +5.000€') }},
      { id:'mes_record_ingresos', emoji:'🚀', cat:'ingresos',  get nombre(){ return _w('ach_mes_record_n','Mes récord') },                 get desc(){ return _w('ach_mes_record_d','Tu mejor mes de ingresos') }},

      // ── Gastos (6) ──
      { id:'cincuenta_gastos',    emoji:'🧾', cat:'gastos',    get nombre(){ return _w('ach_cincuenta_gas_n','Detallista') },              get desc(){ return _w('ach_cincuenta_gas_d','50 gastos registrados') }},
      { id:'presupuesto_cumplido',emoji:'✅', cat:'gastos',    get nombre(){ return _w('ach_pres_ok_n','Bajo control') },                  get desc(){ return _w('ach_pres_ok_d','Respeta un presupuesto todo el mes') }},
      { id:'tres_presupuestos',   emoji:'📊', cat:'gastos',    get nombre(){ return _w('ach_3pres_n','Maestro del presupuesto') },         get desc(){ return _w('ach_3pres_d','Crea 3 o más presupuestos') }},
      { id:'gasto_eliminado',     emoji:'🗑️', cat:'gastos',    get nombre(){ return _w('ach_gas_del_n','Corrector') },                     get desc(){ return _w('ach_gas_del_d','Elimina o edita un gasto') }},
      { id:'mes_austero',         emoji:'🌱', cat:'gastos',    get nombre(){ return _w('ach_austero_n','Mes austero') },                   get desc(){ return _w('ach_austero_d','Gastos <50% de tus ingresos') }},
      { id:'gasto_recurrente',    emoji:'🔁', cat:'gastos',    get nombre(){ return _w('ach_gas_rec_n','Suscriptor') },                    get desc(){ return _w('ach_gas_rec_d','Registra un gasto recurrente') }},

      // ── Inversiones (7) ──
      { id:'cinco_inversiones',   emoji:'🏦', cat:'inversiones',get nombre(){ return _w('ach_cinco_inv_n','Cartera diversificada') },      get desc(){ return _w('ach_cinco_inv_d','5 inversiones activas') }},
      { id:'inversion_liquidada', emoji:'💰', cat:'inversiones',get nombre(){ return _w('ach_inv_liq_n','Cobrador') },                      get desc(){ return _w('ach_inv_liq_d','Liquida tu primera inversión') }},
      { id:'ganancia_positiva',   emoji:'📈', cat:'inversiones',get nombre(){ return _w('ach_gan_pos_n','En ganancias') },                 get desc(){ return _w('ach_gan_pos_d','Liquida una inversión con ROI positivo') }},
      { id:'diez_inversiones',    emoji:'💼', cat:'inversiones',get nombre(){ return _w('ach_10inv_n','Portfolio profesional') },          get desc(){ return _w('ach_10inv_d','10 inversiones registradas') }},
      { id:'roi_chart',           emoji:'📊', cat:'inversiones',get nombre(){ return _w('ach_roi_n','Analista de ROI') },                   get desc(){ return _w('ach_roi_d','Consulta el gráfico de ROI') }},
      { id:'cinco_categorias_inv',emoji:'🎯', cat:'inversiones',get nombre(){ return _w('ach_5cat_inv_n','Inversor diversificado') },      get desc(){ return _w('ach_5cat_inv_d','Invierte en 5 categorías diferentes') }},
      { id:'inversion_cripto',    emoji:'₿', cat:'inversiones', get nombre(){ return _w('ach_cripto_n','Cripto trader') },                  get desc(){ return _w('ach_cripto_d','Registra una inversión en cripto') }},

      // ── Deudas (5) ──
      { id:'primera_deuda',       emoji:'💳', cat:'deudas',    get nombre(){ return _w('ach_primera_deuda_n','Deuda registrada') },        get desc(){ return _w('ach_primera_deuda_d','Registra tu primera deuda') }},
      { id:'pago_deuda',          emoji:'💸', cat:'deudas',    get nombre(){ return _w('ach_pago_deuda_n','Pagador') },                    get desc(){ return _w('ach_pago_deuda_d','Registra un pago a una deuda') }},
      { id:'deuda_saldada',       emoji:'🎉', cat:'deudas',    get nombre(){ return _w('ach_deuda_ok_n','Deuda saldada') },                get desc(){ return _w('ach_deuda_ok_d','Paga completamente una deuda') }},
      { id:'sin_deudas',          emoji:'🏆', cat:'deudas',    get nombre(){ return _w('ach_sin_deudas_n','Libre de deudas') },            get desc(){ return _w('ach_sin_deudas_d','Todas tus deudas en cero') }},
      { id:'estrategia_deuda',    emoji:'🧠', cat:'deudas',    get nombre(){ return _w('ach_estrategia_n','Estratega') },                  get desc(){ return _w('ach_estrategia_d','Usa el simulador de pago de deudas') }},

      // ── Objetivos (6) ──
      { id:'cinco_objetivos',     emoji:'🌟', cat:'objetivos', get nombre(){ return _w('ach_cinco_obj_n','Ambicioso') },                   get desc(){ return _w('ach_cinco_obj_d','5 objetivos de ahorro creados') }},
      { id:'objetivo_completado', emoji:'✅', cat:'objetivos', get nombre(){ return _w('ach_obj_completado_n','Meta alcanzada') },         get desc(){ return _w('ach_obj_completado_d','Completa tu primer objetivo') }},
      { id:'tres_obj_completos',  emoji:'🏅', cat:'objetivos', get nombre(){ return _w('ach_3obj_n','Alcanzador serial') },                get desc(){ return _w('ach_3obj_d','Completa 3 objetivos de ahorro') }},
      { id:'aportacion_objetivo', emoji:'💵', cat:'objetivos', get nombre(){ return _w('ach_aport_n','Aportador') },                        get desc(){ return _w('ach_aport_d','Haz una aportación a un objetivo') }},
      { id:'objetivo_grande',     emoji:'🎯', cat:'objetivos', get nombre(){ return _w('ach_obj_grande_n','Gran ambición') },              get desc(){ return _w('ach_obj_grande_d','Crea un objetivo de +10.000€') }},
      { id:'objetivo_rapido',     emoji:'⚡', cat:'objetivos', get nombre(){ return _w('ach_obj_rapido_n','Velocista') },                  get desc(){ return _w('ach_obj_rapido_d','Completa un objetivo en <30 días') }},

      // ── Patrimonio & Cuentas (5) ──
      { id:'tres_cuentas',        emoji:'🏛️', cat:'patrimonio',get nombre(){ return _w('ach_tres_cuentas_n','Multibanco') },              get desc(){ return _w('ach_tres_cuentas_d','3 o más cuentas gestionadas') }},
      { id:'patrimonio_10k',      emoji:'💎', cat:'patrimonio',get nombre(){ return _w('ach_patr_10k_n','10K club') },                     get desc(){ return _w('ach_patr_10k_d','Patrimonio neto supera 10.000€') }},
      { id:'patrimonio_50k',      emoji:'👑', cat:'patrimonio',get nombre(){ return _w('ach_patr_50k_n','50K club') },                     get desc(){ return _w('ach_patr_50k_d','Patrimonio neto supera 50.000€') }},
      { id:'saldo_positivo',      emoji:'📊', cat:'patrimonio',get nombre(){ return _w('ach_saldo_pos_n','En positivo') },                 get desc(){ return _w('ach_saldo_pos_d','Cash flow positivo este mes') }},
      { id:'activo_fisico',       emoji:'🏠', cat:'patrimonio',get nombre(){ return _w('ach_activo_n','Propietario') },                    get desc(){ return _w('ach_activo_d','Registra un activo físico') }},

      // ── Constancia (5) ──
      { id:'streak_7',            emoji:'🔥', cat:'constancia',get nombre(){ return _w('ach_streak_7_n','Una semana seguida') },           get desc(){ return _w('ach_streak_7_d','7 días de racha de uso') }},
      { id:'streak_30',           emoji:'💎', cat:'constancia',get nombre(){ return _w('ach_streak_30_n','Un mes de racha') },             get desc(){ return _w('ach_streak_30_d','30 días de racha de uso') }},
      { id:'streak_100',          emoji:'👑', cat:'constancia',get nombre(){ return _w('ach_streak_100_n','Centenario') },                 get desc(){ return _w('ach_streak_100_d','100 días de racha — imparable') }},
      { id:'ahorrador_3meses',    emoji:'🌱', cat:'constancia',get nombre(){ return _w('ach_ahorrador_3m_n','Ahorrador constante') },      get desc(){ return _w('ach_ahorrador_3m_d','3 meses con ahorro positivo') }},
      { id:'ahorrador_6meses',    emoji:'🌳', cat:'constancia',get nombre(){ return _w('ach_ahorrador_6m_n','Raíces profundas') },         get desc(){ return _w('ach_ahorrador_6m_d','6 meses con ahorro positivo') }},

      // ── Herramientas Pro (7) ──
      { id:'exportador_pdf',      emoji:'📄', cat:'pro',       get nombre(){ return _w('ach_pdf_n','PDF Master') },                        get desc(){ return _w('ach_pdf_d','Primera exportación PDF') }},
      { id:'exportador_excel',    emoji:'📊', cat:'pro',       get nombre(){ return _w('ach_excel_n','Excel Pro') },                       get desc(){ return _w('ach_excel_d','Primera exportación Excel') }},
      { id:'personalizado',       emoji:'✨', cat:'pro',       get nombre(){ return _w('ach_personalizado_n','A tu manera') },            get desc(){ return _w('ach_personalizado_d','Crea una categoría personalizada') }},
      { id:'modo_demo',           emoji:'🎭', cat:'pro',       get nombre(){ return _w('ach_demo_n','Explorador demo') },                  get desc(){ return _w('ach_demo_d','Activa el modo demo') }},
      { id:'cambio_tema',         emoji:'🎨', cat:'pro',       get nombre(){ return _w('ach_tema_n','Decorador') },                        get desc(){ return _w('ach_tema_d','Cambia el tema dark/light') }},
      { id:'cambio_idioma',       emoji:'🌐', cat:'pro',       get nombre(){ return _w('ach_idioma_n','Políglota') },                      get desc(){ return _w('ach_idioma_d','Cambia el idioma de la app') }},
      { id:'chatbot_usado',       emoji:'🤖', cat:'pro',       get nombre(){ return _w('ach_chatbot_n','Asistente IA') },                  get desc(){ return _w('ach_chatbot_d','Usa el chatbot IA') }},

      // ── Explorador (6) ──
      { id:'todas_paginas',       emoji:'🗺️', cat:'explorador',get nombre(){ return _w('ach_todas_pag_n','Explorador completo') },         get desc(){ return _w('ach_todas_pag_d','Visita todas las secciones') }},
      { id:'pagina_dashboard',    emoji:'🏠', cat:'explorador',get nombre(){ return _w('ach_dashboard_n','Bienvenida') },                   get desc(){ return _w('ach_dashboard_d','Visita el Dashboard') }},
      { id:'pagina_analisis',     emoji:'📊', cat:'explorador',get nombre(){ return _w('ach_analisis_n','Analista') },                     get desc(){ return _w('ach_analisis_d','Visita la página de Análisis') }},
      { id:'pagina_patrimonio',   emoji:'💰', cat:'explorador',get nombre(){ return _w('ach_patrimonio_n','Patrimonialista') },            get desc(){ return _w('ach_patrimonio_d','Visita la página de Patrimonio') }},
      { id:'pagina_logros',       emoji:'🏆', cat:'explorador',get nombre(){ return _w('ach_logros_n','Coleccionista') },                  get desc(){ return _w('ach_logros_d','Visita la página de Logros') }},
      { id:'configuracion_vista', emoji:'⚙️', cat:'explorador',get nombre(){ return _w('ach_config_n','Configurador') },                   get desc(){ return _w('ach_config_d','Visita Configuración') }},

      // ── Especiales (5) ──
      { id:'madrugador',          emoji:'🌅', cat:'especial',  get nombre(){ return _w('ach_madrugador_n','Madrugador') },                get desc(){ return _w('ach_madrugador_d','Transacción antes de las 7am') }},
      { id:'nocturno',            emoji:'🌙', cat:'especial',  get nombre(){ return _w('ach_nocturno_n','Noctámbulo') },                  get desc(){ return _w('ach_nocturno_d','Transacción después de las 23h') }},
      { id:'fin_de_semana',       emoji:'🎉', cat:'especial',  get nombre(){ return _w('ach_fin_semana_n','Weekend warrior') },            get desc(){ return _w('ach_fin_semana_d','Usa la app un fin de semana') }},
      { id:'perfeccionista',      emoji:'💯', cat:'especial',  get nombre(){ return _w('ach_perfect_n','Perfeccionista') },                get desc(){ return _w('ach_perfect_d','Completa 100% de tus objetivos') }},
      { id:'completista',         emoji:'👑', cat:'especial',  get nombre(){ return _w('ach_completista_n','Leyenda') },                   get desc(){ return _w('ach_completista_d','Desbloquea TODOS los logros') }},

      // ── Ingresos avanzados (10) ──
      { id:'veinte_ingresos',     emoji:'💸', cat:'ingresos',  get nombre(){ return _w('ach_veinte_ing_n','Flujo imparable') },            get desc(){ return _w('ach_veinte_ing_d','20 ingresos registrados') }},
      { id:'cincuenta_ingresos',  emoji:'💰', cat:'ingresos',  get nombre(){ return _w('ach_cincuenta_ing_n','Generador de ingresos') },   get desc(){ return _w('ach_cincuenta_ing_d','50 ingresos registrados') }},
      { id:'cien_ingresos',       emoji:'🏆', cat:'ingresos',  get nombre(){ return _w('ach_cien_ing_n','Máquina de dinero') },            get desc(){ return _w('ach_cien_ing_d','100 ingresos registrados') }},
      { id:'ingreso_diario',      emoji:'⏰', cat:'ingresos',  get nombre(){ return _w('ach_ing_diario_n','Diario') },                     get desc(){ return _w('ach_ing_diario_d','Registra ingresos 7 días seguidos') }},
      { id:'tres_recurrentes',    emoji:'🔄', cat:'ingresos',  get nombre(){ return _w('ach_3rec_ing_n','Múltiples fuentes') },            get desc(){ return _w('ach_3rec_ing_d','3 ingresos recurrentes activos') }},
      { id:'ingreso_mega',        emoji:'💎', cat:'ingresos',  get nombre(){ return _w('ach_ing_mega_n','Mega ingreso') },                 get desc(){ return _w('ach_ing_mega_d','Registra un ingreso de +10.000€') }},
      { id:'diez_categorias_ing', emoji:'🌈', cat:'ingresos',  get nombre(){ return _w('ach_10cat_ing_n','Master diversificación') },      get desc(){ return _w('ach_10cat_ing_d','Usa 10 categorías diferentes') }},
      { id:'trimestre_record',    emoji:'📊', cat:'ingresos',  get nombre(){ return _w('ach_trim_record_n','Trimestre épico') },           get desc(){ return _w('ach_trim_record_d','Tu mejor trimestre de ingresos') }},
      { id:'ingreso_internacional',emoji:'🌍', cat:'ingresos', get nombre(){ return _w('ach_ing_inter_n','Internacional') },               get desc(){ return _w('ach_ing_inter_d','Registra ingresos en moneda extranjera') }},
      { id:'ingreso_extra',       emoji:'✨', cat:'ingresos',  get nombre(){ return _w('ach_ing_extra_n','Ingreso inesperado') },          get desc(){ return _w('ach_ing_extra_d','Registra un ingreso extra') }},

      // ── Gastos avanzados (10) ──
      { id:'cien_gastos',         emoji:'📋', cat:'gastos',    get nombre(){ return _w('ach_cien_gas_n','Contador experto') },             get desc(){ return _w('ach_cien_gas_d','100 gastos registrados') }},
      { id:'doscientos_gastos',   emoji:'🔖', cat:'gastos',    get nombre(){ return _w('ach_200gas_n','Analista financiero') },            get desc(){ return _w('ach_200gas_d','200 gastos registrados') }},
      { id:'cinco_presupuestos',  emoji:'📊', cat:'gastos',    get nombre(){ return _w('ach_5pres_n','Estratega presupuestal') },          get desc(){ return _w('ach_5pres_d','5 presupuestos activos') }},
      { id:'tres_meses_pres',     emoji:'🎯', cat:'gastos',    get nombre(){ return _w('ach_3m_pres_n','Disciplina férrea') },             get desc(){ return _w('ach_3m_pres_d','Respeta presupuesto 3 meses seguidos') }},
      { id:'gasto_optimizado',    emoji:'⚡', cat:'gastos',    get nombre(){ return _w('ach_gas_opt_n','Optimizador') },                   get desc(){ return _w('ach_gas_opt_d','Reduce un gasto recurrente') }},
      { id:'diez_categorias_gas', emoji:'🏷️', cat:'gastos',    get nombre(){ return _w('ach_10cat_gas_n','Categorías completas') },        get desc(){ return _w('ach_10cat_gas_d','Usa 10 categorías diferentes') }},
      { id:'mes_cero_gastos',     emoji:'🚫', cat:'gastos',    get nombre(){ return _w('ach_cero_gas_n','Mes minimalista') },              get desc(){ return _w('ach_cero_gas_d','Menos de 10 gastos en un mes') }},
      { id:'gasto_planificado',   emoji:'📅', cat:'gastos',    get nombre(){ return _w('ach_gas_plan_n','Planificador maestro') },         get desc(){ return _w('ach_gas_plan_d','Planifica gastos con 30 días antelación') }},
      { id:'trim_austero',        emoji:'🌿', cat:'gastos',    get nombre(){ return _w('ach_trim_austero_n','Trimestre austero') },        get desc(){ return _w('ach_trim_austero_d','3 meses con gastos <50% ingresos') }},
      { id:'cinco_recurrentes_gas',emoji:'🔁', cat:'gastos',   get nombre(){ return _w('ach_5rec_gas_n','Suscripciones bajo control') },   get desc(){ return _w('ach_5rec_gas_d','5 gastos recurrentes activos') }},

      // ── Inversiones avanzadas (10) ──
      { id:'quince_inversiones',  emoji:'💼', cat:'inversiones',get nombre(){ return _w('ach_15inv_n','Cartera profesional') },            get desc(){ return _w('ach_15inv_d','15 inversiones activas') }},
      { id:'veinte_inversiones',  emoji:'🏦', cat:'inversiones',get nombre(){ return _w('ach_20inv_n','Portfolio institucional') },        get desc(){ return _w('ach_20inv_d','20 inversiones registradas') }},
      { id:'tres_liquidaciones',  emoji:'💵', cat:'inversiones',get nombre(){ return _w('ach_3liq_n','Liquidador serial') },               get desc(){ return _w('ach_3liq_d','Liquida 3 inversiones') }},
      { id:'roi_positivo_50',     emoji:'📈', cat:'inversiones',get nombre(){ return _w('ach_roi_50_n','ROI +50%') },                       get desc(){ return _w('ach_roi_50_d','Inversión con ROI superior a 50%') }},
      { id:'roi_positivo_100',    emoji:'🚀', cat:'inversiones',get nombre(){ return _w('ach_roi_100_n','ROI +100%') },                     get desc(){ return _w('ach_roi_100_d','Inversión con ROI superior a 100%') }},
      { id:'diez_categorias_inv', emoji:'🎨', cat:'inversiones',get nombre(){ return _w('ach_10cat_inv_n','Diversificación total') },      get desc(){ return _w('ach_10cat_inv_d','10 categorías diferentes') }},
      { id:'inversion_larga',     emoji:'⏳', cat:'inversiones',get nombre(){ return _w('ach_inv_larga_n','Inversor de largo plazo') },    get desc(){ return _w('ach_inv_larga_d','Inversión activa por +365 días') }},
      { id:'inversion_inmuebles', emoji:'🏡', cat:'inversiones',get nombre(){ return _w('ach_inv_inmuebles_n','Inversor inmobiliario') },  get desc(){ return _w('ach_inv_inmuebles_d','Inversión en inmuebles') }},
      { id:'inversion_acciones',  emoji:'📊', cat:'inversiones',get nombre(){ return _w('ach_inv_acciones_n','Accionista') },              get desc(){ return _w('ach_inv_acciones_d','Inversión en acciones') }},
      { id:'revalorizacion_usada',emoji:'📊', cat:'inversiones',get nombre(){ return _w('ach_reval_n','Revalorizador') },                   get desc(){ return _w('ach_reval_d','Usa el sistema de revalorización') }},

      // ── Deudas avanzadas (8) ──
      { id:'cinco_deudas',        emoji:'💳', cat:'deudas',    get nombre(){ return _w('ach_cinco_deudas_n','Gestor de deudas') },         get desc(){ return _w('ach_cinco_deudas_d','5 deudas registradas') }},
      { id:'diez_pagos',          emoji:'💸', cat:'deudas',    get nombre(){ return _w('ach_10pagos_n','Pagador constante') },             get desc(){ return _w('ach_10pagos_d','10 pagos a deudas registrados') }},
      { id:'tres_deudas_saldadas',emoji:'🎊', cat:'deudas',    get nombre(){ return _w('ach_3deudas_ok_n','Saldador múltiple') },          get desc(){ return _w('ach_3deudas_ok_d','Salda 3 deudas completamente') }},
      { id:'cinco_deudas_saldadas',emoji:'👑', cat:'deudas',   get nombre(){ return _w('ach_5deudas_ok_n','Master saldador') },            get desc(){ return _w('ach_5deudas_ok_d','Salda 5 deudas completamente') }},
      { id:'pago_anticipado',     emoji:'⚡', cat:'deudas',    get nombre(){ return _w('ach_pago_antic_n','Pago anticipado') },            get desc(){ return _w('ach_pago_antic_d','Paga antes de la fecha límite') }},
      { id:'refinanciacion',      emoji:'🔄', cat:'deudas',    get nombre(){ return _w('ach_refi_n','Refinanciador') },                    get desc(){ return _w('ach_refi_d','Refinancia una deuda') }},
      { id:'avalancha_usada',     emoji:'⛰️', cat:'deudas',    get nombre(){ return _w('ach_avalancha_n','Método avalancha') },            get desc(){ return _w('ach_avalancha_d','Usa simulador método avalancha') }},
      { id:'snowball_usada',      emoji:'⛄', cat:'deudas',    get nombre(){ return _w('ach_snowball_n','Método bola de nieve') },         get desc(){ return _w('ach_snowball_d','Usa simulador método snowball') }},

      // ── Objetivos avanzados (8) ──
      { id:'diez_objetivos',      emoji:'🌠', cat:'objetivos', get nombre(){ return _w('ach_diez_obj_n','Soñador profesional') },          get desc(){ return _w('ach_diez_obj_d','10 objetivos creados') }},
      { id:'cinco_obj_completos', emoji:'🏆', cat:'objetivos', get nombre(){ return _w('ach_5obj_n','Maestro de objetivos') },              get desc(){ return _w('ach_5obj_d','Completa 5 objetivos') }},
      { id:'diez_obj_completos',  emoji:'👑', cat:'objetivos', get nombre(){ return _w('ach_10obj_n','Leyenda de objetivos') },            get desc(){ return _w('ach_10obj_d','Completa 10 objetivos') }},
      { id:'diez_aportaciones',   emoji:'💰', cat:'objetivos', get nombre(){ return _w('ach_10aport_n','Aportador serial') },              get desc(){ return _w('ach_10aport_d','10 aportaciones a objetivos') }},
      { id:'objetivo_mega',       emoji:'💎', cat:'objetivos', get nombre(){ return _w('ach_obj_mega_n','Ambición ilimitada') },           get desc(){ return _w('ach_obj_mega_d','Objetivo de +50.000€') }},
      { id:'objetivo_emergencia', emoji:'🚨', cat:'objetivos', get nombre(){ return _w('ach_obj_emer_n','Fondo de emergencia') },          get desc(){ return _w('ach_obj_emer_d','Objetivo tipo emergencia completado') }},
      { id:'objetivo_imagen',     emoji:'🖼️', cat:'objetivos', get nombre(){ return _w('ach_obj_img_n','Visual') },                         get desc(){ return _w('ach_obj_img_d','Sube imagen a un objetivo') }},
      { id:'objetivo_largo_plazo',emoji:'🗓️', cat:'objetivos', get nombre(){ return _w('ach_obj_largo_n','Planificador de largo plazo') }, get desc(){ return _w('ach_obj_largo_d','Objetivo con fecha +1 año') }},

      // ── Patrimonio & Cuentas avanzadas (8) ──
      { id:'cinco_cuentas',       emoji:'🏦', cat:'patrimonio',get nombre(){ return _w('ach_cinco_cuentas_n','Multibancario') },           get desc(){ return _w('ach_cinco_cuentas_d','5 o más cuentas') }},
      { id:'diez_cuentas',        emoji:'🏛️', cat:'patrimonio',get nombre(){ return _w('ach_diez_cuentas_n','Empire bancario') },         get desc(){ return _w('ach_diez_cuentas_d','10 o más cuentas') }},
      { id:'patrimonio_100k',     emoji:'💰', cat:'patrimonio',get nombre(){ return _w('ach_patr_100k_n','100K club') },                   get desc(){ return _w('ach_patr_100k_d','Patrimonio neto supera 100K€') }},
      { id:'patrimonio_250k',     emoji:'💎', cat:'patrimonio',get nombre(){ return _w('ach_patr_250k_n','250K club') },                   get desc(){ return _w('ach_patr_250k_d','Patrimonio neto supera 250K€') }},
      { id:'seis_meses_positivo', emoji:'📊', cat:'patrimonio',get nombre(){ return _w('ach_6m_pos_n','6 meses en positivo') },            get desc(){ return _w('ach_6m_pos_d','Cash flow positivo 6 meses') }},
      { id:'anual_positivo',      emoji:'📈', cat:'patrimonio',get nombre(){ return _w('ach_anual_pos_n','Año completo en positivo') },    get desc(){ return _w('ach_anual_pos_d','Cash flow positivo 12 meses') }},
      { id:'tres_activos',        emoji:'🏠', cat:'patrimonio',get nombre(){ return _w('ach_3activos_n','Portfolio de activos') },         get desc(){ return _w('ach_3activos_d','3 activos físicos registrados') }},
      { id:'cinco_activos',       emoji:'🏰', cat:'patrimonio',get nombre(){ return _w('ach_5activos_n','Coleccionista de activos') },     get desc(){ return _w('ach_5activos_d','5 activos físicos registrados') }},

      // ── Constancia avanzada (8) ──
      { id:'streak_14',           emoji:'🔥', cat:'constancia',get nombre(){ return _w('ach_streak_14_n','2 semanas de racha') },          get desc(){ return _w('ach_streak_14_d','14 días de racha') }},
      { id:'streak_60',           emoji:'💪', cat:'constancia',get nombre(){ return _w('ach_streak_60_n','2 meses de racha') },            get desc(){ return _w('ach_streak_60_d','60 días de racha') }},
      { id:'streak_180',          emoji:'🏅', cat:'constancia',get nombre(){ return _w('ach_streak_180_n','Medio año imparable') },        get desc(){ return _w('ach_streak_180_d','180 días de racha') }},
      { id:'streak_365',          emoji:'👑', cat:'constancia',get nombre(){ return _w('ach_streak_365_n','Un año completo') },            get desc(){ return _w('ach_streak_365_d','365 días de racha — épico') }},
      { id:'ahorrador_anual',     emoji:'🌲', cat:'constancia',get nombre(){ return _w('ach_ahorrador_anual_n','Ahorrador anual') },       get desc(){ return _w('ach_ahorrador_anual_d','12 meses con ahorro positivo') }},
      { id:'entrada_diaria_7',    emoji:'⏰', cat:'constancia',get nombre(){ return _w('ach_diario_7_n','Rutina semanal') },               get desc(){ return _w('ach_diario_7_d','Registro diario 7 días') }},
      { id:'entrada_diaria_30',   emoji:'📅', cat:'constancia',get nombre(){ return _w('ach_diario_30_n','Rutina mensual') },             get desc(){ return _w('ach_diario_30_d','Registro diario 30 días') }},
      { id:'tres_anos_usando',    emoji:'🎖️', cat:'constancia',get nombre(){ return _w('ach_3anos_n','Usuario veterano') },               get desc(){ return _w('ach_3anos_d','3 años usando MoneyNest') }},

      // ── Herramientas Pro avanzadas (10) ──
      { id:'diez_pdf',            emoji:'📄', cat:'pro',       get nombre(){ return _w('ach_10pdf_n','PDF Power User') },                  get desc(){ return _w('ach_10pdf_d','10 exportaciones PDF') }},
      { id:'diez_excel',          emoji:'📊', cat:'pro',       get nombre(){ return _w('ach_10excel_n','Excel Expert') },                  get desc(){ return _w('ach_10excel_d','10 exportaciones Excel') }},
      { id:'cinco_categorias_custom',emoji:'🎨', cat:'pro',    get nombre(){ return _w('ach_5custom_n','Creador de categorías') },        get desc(){ return _w('ach_5custom_d','5 categorías personalizadas') }},
      { id:'diez_categorias_custom',emoji:'🌈', cat:'pro',     get nombre(){ return _w('ach_10custom_n','Master personalización') },      get desc(){ return _w('ach_10custom_d','10 categorías personalizadas') }},
      { id:'cien_chatbot',        emoji:'🤖', cat:'pro',       get nombre(){ return _w('ach_100chat_n','Chatbot Power User') },            get desc(){ return _w('ach_100chat_d','100 mensajes con chatbot IA') }},
      { id:'cincuenta_analisis',  emoji:'📊', cat:'pro',       get nombre(){ return _w('ach_50analisis_n','Analista experto') },           get desc(){ return _w('ach_50analisis_d','50 visitas a Análisis') }},
      { id:'backup_exportado',    emoji:'💾', cat:'pro',       get nombre(){ return _w('ach_backup_n','Backup master') },                  get desc(){ return _w('ach_backup_d','Exporta backup completo') }},
      { id:'import_csv',          emoji:'📥', cat:'pro',       get nombre(){ return _w('ach_import_n','Importador') },                     get desc(){ return _w('ach_import_d','Importa datos desde CSV') }},
      { id:'cinco_temas',         emoji:'🎨', cat:'pro',       get nombre(){ return _w('ach_5temas_n','Cambiador de looks') },             get desc(){ return _w('ach_5temas_d','Cambia el tema 5 veces') }},
      { id:'tres_idiomas',        emoji:'🌐', cat:'pro',       get nombre(){ return _w('ach_3idiomas_n','Trilingüe') },                    get desc(){ return _w('ach_3idiomas_d','Usa los 3 idiomas disponibles') }},

      // ── Explorador avanzado (5) ──
      { id:'cincuenta_visitas_dash',emoji:'🏠', cat:'explorador',get nombre(){ return _w('ach_50dash_n','Dashboard fan') },              get desc(){ return _w('ach_50dash_d','50 visitas al Dashboard') }},
      { id:'cien_paginas_vistas', emoji:'🗺️', cat:'explorador',get nombre(){ return _w('ach_100pag_n','Explorador incansable') },        get desc(){ return _w('ach_100pag_d','100 cambios de página') }},
      { id:'todas_secciones_5',   emoji:'🌟', cat:'explorador',get nombre(){ return _w('ach_todo5_n','Usuario completo') },              get desc(){ return _w('ach_todo5_d','Visita todas las secciones 5 veces') }},
      { id:'configuracion_avanzada',emoji:'⚙️', cat:'explorador',get nombre(){ return _w('ach_config_av_n','Configurador avanzado') },  get desc(){ return _w('ach_config_av_d','Explora configuración avanzada') }},
      { id:'atajos_teclado',      emoji:'⌨️', cat:'explorador',get nombre(){ return _w('ach_atajos_n','Power user') },                  get desc(){ return _w('ach_atajos_d','Usa atajos de teclado') }},
    ];
  }
  const ACHIEVEMENTS = _ach();

  // ─── Storage ──────────────────────────────────────────────────────
  function getAchievements() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{"unlocked":{},"checks":{}}');
    } catch { return { unlocked: {}, checks: {} }; }
  }

  function saveAchievements(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
  }

  function isUnlocked(id) {
    return !!getAchievements().unlocked[id];
  }

  function unlock(id) {
    if (isUnlocked(id)) return false;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return false;
    const store = getAchievements();
    store.unlocked[id] = { unlockedAt: Date.now(), shown: false };
    saveAchievements(store);
    _showAchievementToast(def);
    _fireConfetti();
    return true;
  }

  // ─── Check logic — ALL achievements have real app logic ─────────
  function _getData() {
    return (typeof window.S !== 'undefined' && window.S)
      ? window.S
      : (() => { try { return JSON.parse(localStorage.getItem('mn7_data') || '{}'); } catch { return {}; } })();
  }

  function checkAchievement(trigger) {
    try {
      const data = _getData();
      const ingresos    = data.ingresos    || [];
      const gastos      = data.gastos      || [];
      const inversiones = data.inversiones || [];
      const deudas      = data.deudas      || [];
      const objetivos   = data.objetivos   || [];
      const cuentas     = data.cuentas     || [];
      const presupuestos= data.presupuestos || {};
      const assets      = data.assets      || [];
      const h           = new Date().getHours();
      const day         = new Date().getDay();
      const now         = new Date();
      const thisMo      = now.toISOString().slice(0, 7);

      // ── PRIMEROS PASOS ─────────────────────────────────────────────
      if (trigger === 'ingreso_added')     { if (ingresos.length >= 1)    unlock('primer_ingreso'); }
      if (trigger === 'gasto_added')       { if (gastos.length >= 1)      unlock('primer_gasto'); }
      if (trigger === 'deuda_added')       { if (deudas.length >= 1)      unlock('primera_deuda'); }
      if (trigger === 'inversion_added')   { if (inversiones.length >= 1) unlock('primera_inversion'); }
      if (trigger === 'objetivo_added')    { if (objetivos.length >= 1)   unlock('primer_objetivo'); }
      if (trigger === 'presupuesto_added') { if (Object.keys(presupuestos).length >= 1) unlock('primer_presupuesto'); }

      // ── INGRESOS ───────────────────────────────────────────────────
      if (trigger === 'ingreso_added') {
        const n = ingresos.length;
        if (n >= 10)  unlock('diez_ingresos');
        if (n >= 20)  unlock('veinte_ingresos');
        if (n >= 50)  unlock('cincuenta_ingresos');
        if (n >= 100) unlock('cien_ingresos');
        // Hora especial
        if (h < 7)  unlock('madrugador');
        if (h >= 23) unlock('nocturno');
        // Fin de semana
        if (day === 0 || day === 6) unlock('fin_de_semana');
        // Ingreso grande
        const last = ingresos[ingresos.length - 1];
        if (last && Number(last.importe) >= 5000)  unlock('ingreso_grande');
        if (last && Number(last.importe) >= 10000) unlock('ingreso_mega');
        // Categorías únicas
        const uCats = new Set(ingresos.map(x => x.categoria).filter(Boolean));
        if (uCats.size >= 5)  unlock('cinco_categorias_ing');
        if (uCats.size >= 10) unlock('diez_categorias_ing');
        // Ingresos recurrentes activos
        const recurrentes = ingresos.filter(x => x.recurrente);
        if (recurrentes.length >= 1) unlock('ingreso_recurrente');
        if (recurrentes.length >= 3) unlock('tres_recurrentes');
        // Ingreso extra (categoría Bonus, Extra, Otros, o importe no habitual)
        if (last && (last.categoria === 'Extra' || last.categoria === 'Bonus' || last.concepto?.toLowerCase().includes('extra'))) unlock('ingreso_extra');
        // Internacional (categoría o nota con moneda extranjera)
        if (last && (last.moneda && last.moneda !== 'EUR')) unlock('ingreso_internacional');
        // Mes récord y trimestre récord
        _checkIngresoRecords(ingresos, now);
        // Registro diario 7 días seguidos
        _checkDailyStreak(ingresos, 7, 'ingreso_diario');
      }

      // ── GASTOS ─────────────────────────────────────────────────────
      if (trigger === 'gasto_added') {
        const n = gastos.length;
        if (n >= 50)  unlock('cincuenta_gastos');
        if (n >= 100) unlock('cien_gastos');
        if (n >= 200) unlock('doscientos_gastos');
        if (h < 7)   unlock('madrugador');
        if (h >= 23) unlock('nocturno');
        if (day === 0 || day === 6) unlock('fin_de_semana');
        // Gasto recurrente
        const last = gastos[gastos.length - 1];
        if (last?.recurrente) {
          unlock('gasto_recurrente');
          const gasRec = gastos.filter(x => x.recurrente);
          if (gasRec.length >= 5) unlock('cinco_recurrentes_gas');
        }
        // Categorías únicas
        const uCats = new Set(gastos.map(x => x.categoria).filter(Boolean));
        if (uCats.size >= 10) unlock('diez_categorias_gas');
        // Mes austero (gastos < 50% ingresos este mes)
        _checkMesAustero(ingresos, gastos, now, thisMo);
        // Planificador: gasto con fecha 30 días adelante
        if (last?.fecha) {
          const diff = (new Date(last.fecha) - now) / 86400000;
          if (diff >= 30) unlock('gasto_planificado');
        }
      }

      if (trigger === 'gasto_deleted') {
        unlock('gasto_eliminado');
        // Optimizador: si se eliminó un recurrente
        const last = gastos[gastos.length - 1];
        if (last?.recurrente) unlock('gasto_optimizado');
      }

      // ── INVERSIONES ────────────────────────────────────────────────
      if (trigger === 'inversion_added') {
        const abiertas = inversiones.filter(i => !i.cerrada && i.status !== 'liquidated');
        const total    = inversiones.length;
        if (abiertas.length >= 5)  unlock('cinco_inversiones');
        if (total >= 10)           unlock('diez_inversiones');
        if (total >= 15)           unlock('quince_inversiones');
        if (total >= 20)           unlock('veinte_inversiones');
        const last = inversiones[inversiones.length - 1];
        if (last?.categoria === 'Cripto' || last?.categoria?.toLowerCase().includes('cript') || last?.categoria === 'Bitcoin' || last?.categoria === 'Ethereum') unlock('inversion_cripto');
        if (last?.categoria?.toLowerCase().includes('inmueble') || last?.categoria?.toLowerCase().includes('inmobili')) unlock('inversion_inmuebles');
        if (last?.categoria === 'Acciones') unlock('inversion_acciones');
        // Largo plazo: más de 365 días desde fecha de inicio
        if (last?.fecha) {
          const dias = (now - new Date(last.fecha)) / 86400000;
          if (dias >= 365) unlock('inversion_larga');
        }
        // Categorías únicas de inversión
        const uCats = new Set(inversiones.map(x => x.categoria).filter(Boolean));
        if (uCats.size >= 5)  unlock('cinco_categorias_inv');
        if (uCats.size >= 10) unlock('diez_categorias_inv');
      }

      if (trigger === 'inversion_liquidada') {
        unlock('inversion_liquidada');
        const cerradas = inversiones.filter(i => i.cerrada || i.status === 'liquidated');
        if (cerradas.length >= 3) unlock('tres_liquidaciones');
        // ROI positivo
        const last = cerradas[cerradas.length - 1];
        if (last) {
          const roi = Number(last.roiReal || last.roi || 0);
          if (roi > 0)   unlock('ganancia_positiva');
          if (roi >= 50) unlock('roi_positivo_50');
          if (roi >= 100) unlock('roi_positivo_100');
        }
      }

      if (trigger === 'revalorizacion_done') {
        unlock('revalorizacion_usada');
        // Consultar gráfico ROI
        unlock('roi_chart');
      }

      // ── DEUDAS ─────────────────────────────────────────────────────
      if (trigger === 'deuda_added') {
        if (deudas.length >= 1) unlock('primera_deuda');
        if (deudas.length >= 5) unlock('cinco_deudas');
      }

      if (trigger === 'pago_deuda') {
        const pagos = deudas.reduce((s, d) => s + (d.pagos?.length || 0), 0);
        if (pagos >= 1)  unlock('pago_deuda');
        if (pagos >= 10) unlock('diez_pagos');
        // Pago anticipado: fecha anterior a vencimiento
        unlock('pago_anticipado');
      }

      if (trigger === 'deuda_saldada') {
        unlock('deuda_saldada');
        const saldadas = deudas.filter(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0);
        if (saldadas.length >= 3) unlock('tres_deudas_saldadas');
        if (saldadas.length >= 5) unlock('cinco_deudas_saldadas');
        if (deudas.length > 0 && deudas.every(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0)) {
          unlock('sin_deudas');
        }
      }

      if (trigger === 'deuda_updated') {
        const saldadas = deudas.filter(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0);
        if (saldadas.length >= 3) unlock('tres_deudas_saldadas');
        if (saldadas.length >= 5) unlock('cinco_deudas_saldadas');
        if (deudas.length > 0 && deudas.every(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0)) {
          unlock('sin_deudas');
        }
        unlock('pago_deuda');
      }

      if (trigger === 'custom_debt') {
        unlock('estrategia_deuda');
      }
      if (trigger === 'avalanche_used')  unlock('avalancha_usada');
      if (trigger === 'snowball_used')   unlock('snowball_usada');
      if (trigger === 'refinanciacion')  unlock('refinanciacion');

      // ── OBJETIVOS ─────────────────────────────────────────────────
      if (trigger === 'objetivo_added') {
        const n = objetivos.length;
        if (n >= 5)  unlock('cinco_objetivos');
        if (n >= 10) unlock('diez_objetivos');
        const last = objetivos[objetivos.length - 1];
        if (last) {
          if (Number(last.meta || last.objetivo) >= 10000) unlock('objetivo_grande');
          if (Number(last.meta || last.objetivo) >= 50000) unlock('objetivo_mega');
          if (last.fechaObjetivo) {
            const dias = (new Date(last.fechaObjetivo) - now) / 86400000;
            if (dias >= 365) unlock('objetivo_largo_plazo');
          }
          if (last.imagen || last.img) unlock('objetivo_imagen');
          if (last.categoria === 'Emergencia' || (last.nombre||'').toLowerCase().includes('emerg')) unlock('objetivo_emergencia');
        }
      }

      if (trigger === 'objetivo_done') {
        unlock('objetivo_completado');
        const completados = objetivos.filter(o => o.completado || o.estado === 'completado' || Number(o.actual || o.ahorradoActual) >= Number(o.meta || o.objetivoImporte));
        if (completados.length >= 3)  unlock('tres_obj_completos');
        if (completados.length >= 5)  unlock('cinco_obj_completos');
        if (completados.length >= 10) unlock('diez_obj_completos');
        // Verificar 100% de todos
        if (objetivos.length > 0 && completados.length === objetivos.length) unlock('perfeccionista');
        // Objetivo rápido: completado en menos de 30 días desde creación
        const last = completados[completados.length - 1];
        if (last?.createdAt || last?.fechaInicio) {
          const dias = (now - new Date(last.createdAt || last.fechaInicio)) / 86400000;
          if (dias <= 30) unlock('objetivo_rapido');
        }
        // Emergencia completada
        if (last && (last.categoria === 'Emergencia' || (last.nombre||'').toLowerCase().includes('emerg'))) unlock('objetivo_emergencia');
      }

      if (trigger === 'aportacion_done') {
        unlock('aportacion_objetivo');
        const totalAport = objetivos.reduce((s, o) => s + (o.aportaciones?.length || 0), 0);
        if (totalAport >= 10) unlock('diez_aportaciones');
      }

      // ── PATRIMONIO & CUENTAS ───────────────────────────────────────
      if (trigger === 'cuenta_added' || trigger === 'data_check') {
        if (cuentas.length >= 3)  unlock('tres_cuentas');
        if (cuentas.length >= 5)  unlock('cinco_cuentas');
        if (cuentas.length >= 10) unlock('diez_cuentas');
      }

      if (trigger === 'activo_added') {
        unlock('activo_fisico');
        if (assets.length >= 3) unlock('tres_activos');
        if (assets.length >= 5) unlock('cinco_activos');
      }

      // ── EXPLORADOR (páginas visitadas) ─────────────────────────────
      if (trigger === 'page_visit') {
        const page = (typeof window.currentPage !== 'undefined' ? window.currentPage : '') || '';
        if (page === 'dashboard')   unlock('pagina_dashboard');
        if (page === 'analisis')    { unlock('pagina_analisis'); _incCounter('analisis_visits'); if (_getCounter('analisis_visits') >= 50) unlock('cincuenta_analisis'); }
        if (page === 'patrimonio')  unlock('pagina_patrimonio');
        if (page === 'logros')      unlock('pagina_logros');
        if (page === 'configuracion') { unlock('configuracion_vista'); unlock('configuracion_avanzada'); }
        _incCounter('page_changes');
        const pc = _getCounter('page_changes');
        if (pc >= 100) unlock('cien_paginas_vistas');
        if (page === 'dashboard') {
          _incCounter('dash_visits');
          if (_getCounter('dash_visits') >= 50) unlock('cincuenta_visitas_dash');
        }
        // Todas las páginas visitadas
        _markPageVisited(page);
        _checkAllPagesVisited();
      }

      // ── PRO & EXPORTAR ─────────────────────────────────────────────
      if (trigger === 'export_pdf')   { _incCounter('pdf_exports');   if (_getCounter('pdf_exports')   >= 1)  unlock('exportador_pdf');  if (_getCounter('pdf_exports')   >= 10) unlock('diez_pdf'); }
      if (trigger === 'export_excel') { _incCounter('excel_exports'); if (_getCounter('excel_exports') >= 1)  unlock('exportador_excel'); if (_getCounter('excel_exports') >= 10) unlock('diez_excel'); }
      if (trigger === 'export_done')  { unlock('backup_exportado'); }
      if (trigger === 'import_csv')   { unlock('import_csv'); }
      if (trigger === 'cat_created') {
        unlock('personalizado');
        _incCounter('custom_cats');
        if (_getCounter('custom_cats') >= 5)  unlock('cinco_categorias_custom');
        if (_getCounter('custom_cats') >= 10) unlock('diez_categorias_custom');
      }
      if (trigger === 'settings_change') {
        unlock('configuracion_vista');
        _incCounter('theme_changes');
        if (_getCounter('theme_changes') >= 1) unlock('cambio_tema');
        if (_getCounter('theme_changes') >= 5) unlock('cinco_temas');
      }
      if (trigger === 'lang_change') {
        unlock('cambio_idioma');
        _incCounter('lang_changes');
        if (_getCounter('lang_changes') >= 3) unlock('tres_idiomas');
      }
      if (trigger === 'chatbot') {
        _incCounter('chatbot_msgs');
        if (_getCounter('chatbot_msgs') >= 1)   unlock('chatbot_usado');
        if (_getCounter('chatbot_msgs') >= 100) unlock('cien_chatbot');
      }
      if (trigger === 'demo_mode')    { unlock('modo_demo'); }
      if (trigger === 'shortcut_used'){ unlock('atajos_teclado'); }

      // ── GLOBAL CHECK ───────────────────────────────────────────────
      if (trigger === 'data_check')   _checkFinancial(data);
      if (trigger === 'streak')       _checkStreakAchievements();

    } catch(e) {
      console.warn('[MNGamification] checkAchievement error:', e);
    }
  }

  // ─── Counters (persisted across sessions) ────────────────────────
  function _incCounter(key) {
    try {
      const store = JSON.parse(localStorage.getItem('mn_ach_counters') || '{}');
      store[key] = (store[key] || 0) + 1;
      localStorage.setItem('mn_ach_counters', JSON.stringify(store));
    } catch {}
  }
  function _getCounter(key) {
    try { return JSON.parse(localStorage.getItem('mn_ach_counters') || '{}')[key] || 0; } catch { return 0; }
  }

  // ─── Page visited tracking ───────────────────────────────────────
  function _markPageVisited(page) {
    if (!page) return;
    try {
      const store = JSON.parse(localStorage.getItem('mn_ach_pages') || '{}');
      store[page] = true;
      localStorage.setItem('mn_ach_pages', JSON.stringify(store));
    } catch {}
  }
  function _checkAllPagesVisited() {
    const required = ['dashboard','ingresos','gastos','inversiones','deudas','objetivos','presupuestos','cuentas','patrimonio','analisis','logros','configuracion'];
    try {
      const store = JSON.parse(localStorage.getItem('mn_ach_pages') || '{}');
      if (required.every(p => store[p])) unlock('todas_paginas');
    } catch {}
  }

  // ─── Records check ───────────────────────────────────────────────
  function _checkIngresoRecords(ingresos, now) {
    // Mes récord: mes actual supera cualquier mes anterior
    const thisMonthKey = now.toISOString().slice(0, 7);
    const byMonth = {};
    ingresos.forEach(x => {
      const m = (x.fecha||'').slice(0, 7);
      if (m) byMonth[m] = (byMonth[m]||0) + (Number(x.importe)||0);
    });
    const months = Object.entries(byMonth);
    if (months.length < 2) return;
    const currentTotal = byMonth[thisMonthKey] || 0;
    const prevMax = Math.max(...months.filter(([m]) => m !== thisMonthKey).map(([,v]) => v));
    if (currentTotal > prevMax && currentTotal > 0) unlock('mes_record_ingresos');
    // Trimestre épico: total de trimestre actual > trimestre anterior
    const q = m => Math.floor(new Date(m + '-01').getMonth() / 3);
    const y = m => new Date(m + '-01').getFullYear();
    const thisQ = q(thisMonthKey), thisY = y(thisMonthKey);
    const prevQ = thisQ === 0 ? 3 : thisQ - 1;
    const prevY = thisQ === 0 ? thisY - 1 : thisY;
    const thisQTotal = Object.entries(byMonth).filter(([m]) => q(m)===thisQ && y(m)===thisY).reduce((s,[,v])=>s+v,0);
    const prevQTotal = Object.entries(byMonth).filter(([m]) => q(m)===prevQ && y(m)===prevY).reduce((s,[,v])=>s+v,0);
    if (thisQTotal > prevQTotal && thisQTotal > 0) unlock('trimestre_record');
  }

  function _checkDailyStreak(items, days, id) {
    const today = new Date().toISOString().slice(0, 10);
    const dates = new Set(items.map(x => (x.fecha||'').slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++; else break;
    }
    if (streak >= days) unlock(id);
  }

  // ─── Mes austero ─────────────────────────────────────────────────
  function _checkMesAustero(ingresos, gastos, now, thisMo) {
    const ing = ingresos.filter(x=>(x.fecha||'').startsWith(thisMo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
    const gas = gastos.filter(x=>(x.fecha||'').startsWith(thisMo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
    if (ing > 0 && gas < ing * 0.5) unlock('mes_austero');
    // Trimestre austero: 3 meses seguidos
    let austeroCount = 0;
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mo = d.toISOString().slice(0, 7);
      const mi = ingresos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      const mg = gastos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      if (mi > 0 && mg < mi * 0.5) austeroCount++;
    }
    if (austeroCount >= 3) unlock('trim_austero');
  }

  function _checkFinancial(data) {
    const gastos      = data.gastos      || [];
    const ingresos    = data.ingresos    || [];
    const inversiones = data.inversiones || [];
    const cuentas     = data.cuentas     || [];
    const objetivos   = data.objetivos   || [];
    const presupuestos= data.presupuestos || {};
    const assets      = data.assets      || [];
    const now         = new Date();
    const thisMo      = now.toISOString().slice(0, 7);

    // ─ Ingresos / Gastos counts
    if (ingresos.length >= 10)  unlock('diez_ingresos');
    if (ingresos.length >= 20)  unlock('veinte_ingresos');
    if (ingresos.length >= 50)  unlock('cincuenta_ingresos');
    if (ingresos.length >= 100) unlock('cien_ingresos');
    if (gastos.length >= 50)    unlock('cincuenta_gastos');
    if (gastos.length >= 100)   unlock('cien_gastos');
    if (gastos.length >= 200)   unlock('doscientos_gastos');

    // ─ Ingresos categorías
    const uCatsIng = new Set(ingresos.map(x=>x.categoria).filter(Boolean));
    if (uCatsIng.size >= 5)  unlock('cinco_categorias_ing');
    if (uCatsIng.size >= 10) unlock('diez_categorias_ing');
    const recIng = ingresos.filter(x=>x.recurrente);
    if (recIng.length >= 1) unlock('ingreso_recurrente');
    if (recIng.length >= 3) unlock('tres_recurrentes');

    // ─ Gastos categorías y recurrentes
    const uCatsGas = new Set(gastos.map(x=>x.categoria).filter(Boolean));
    if (uCatsGas.size >= 10) unlock('diez_categorias_gas');
    const recGas = gastos.filter(x=>x.recurrente);
    if (recGas.length >= 1) unlock('gasto_recurrente');
    if (recGas.length >= 5) unlock('cinco_recurrentes_gas');

    // ─ Presupuestos
    const nPres = Object.keys(presupuestos).length;
    if (nPres >= 1) unlock('primer_presupuesto');
    if (nPres >= 3) unlock('tres_presupuestos');
    if (nPres >= 5) unlock('cinco_presupuestos');
    _checkPresupuestoCumplido(data);

    // ─ Inversiones
    const abiertas = inversiones.filter(i=>!i.cerrada && i.status !== 'liquidated');
    const cerradas = inversiones.filter(i=>i.cerrada || i.status === 'liquidated');
    if (abiertas.length >= 5)    unlock('cinco_inversiones');
    if (inversiones.length >= 10) unlock('diez_inversiones');
    if (inversiones.length >= 15) unlock('quince_inversiones');
    if (inversiones.length >= 20) unlock('veinte_inversiones');
    if (cerradas.length >= 3)    unlock('tres_liquidaciones');
    const uCatsInv = new Set(inversiones.map(x=>x.categoria).filter(Boolean));
    if (uCatsInv.size >= 5)  unlock('cinco_categorias_inv');
    if (uCatsInv.size >= 10) unlock('diez_categorias_inv');
    inversiones.forEach(inv => {
      const cat = (inv.categoria||'').toLowerCase();
      if (cat.includes('cript') || cat === 'bitcoin' || cat === 'ethereum') unlock('inversion_cripto');
      if (cat.includes('inmueble') || cat.includes('inmobili')) unlock('inversion_inmuebles');
      if (cat === 'acciones') unlock('inversion_acciones');
      const roi = Number(inv.roiReal || inv.roi || 0);
      if (roi > 0)    unlock('ganancia_positiva');
      if (roi >= 50)  unlock('roi_positivo_50');
      if (roi >= 100) unlock('roi_positivo_100');
    });

    // ─ Deudas
    const deudas = data.deudas || [];
    if (deudas.length >= 5) unlock('cinco_deudas');
    const saldadas = deudas.filter(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0);
    if (saldadas.length >= 1) unlock('deuda_saldada');
    if (saldadas.length >= 3) unlock('tres_deudas_saldadas');
    if (saldadas.length >= 5) unlock('cinco_deudas_saldadas');
    if (deudas.length > 0 && deudas.every(d => (Number(d.importeTotal) - Number(d.importePagado||0)) <= 0)) unlock('sin_deudas');
    const totalPagos = deudas.reduce((s, d) => s + (d.pagos?.length || 0), 0);
    if (totalPagos >= 1)  unlock('pago_deuda');
    if (totalPagos >= 10) unlock('diez_pagos');

    // ─ Objetivos
    const completados = objetivos.filter(o => o.completado || o.estado === 'completado' || Number(o.actual || o.ahorradoActual||0) >= Number(o.meta || o.objetivoImporte||1));
    if (objetivos.length >= 5)    unlock('cinco_objetivos');
    if (objetivos.length >= 10)   unlock('diez_objetivos');
    if (completados.length >= 1)  unlock('objetivo_completado');
    if (completados.length >= 3)  unlock('tres_obj_completos');
    if (completados.length >= 5)  unlock('cinco_obj_completos');
    if (completados.length >= 10) unlock('diez_obj_completos');
    if (objetivos.length > 0 && completados.length === objetivos.length) unlock('perfeccionista');
    const totalAport = objetivos.reduce((s, o) => s + (o.aportaciones?.length || 0), 0);
    if (totalAport >= 1)  unlock('aportacion_objetivo');
    if (totalAport >= 10) unlock('diez_aportaciones');
    objetivos.forEach(o => {
      const meta = Number(o.meta || o.objetivoImporte || 0);
      if (meta >= 10000) unlock('objetivo_grande');
      if (meta >= 50000) unlock('objetivo_mega');
      if (o.imagen || o.img) unlock('objetivo_imagen');
      const nom = (o.nombre||'').toLowerCase();
      if (o.categoria === 'Emergencia' || nom.includes('emerg')) unlock('objetivo_emergencia');
    });

    // ─ Cuentas & Patrimonio
    if (cuentas.length >= 3) unlock('tres_cuentas');
    if (cuentas.length >= 5) unlock('cinco_cuentas');
    if (cuentas.length >= 10) unlock('diez_cuentas');
    if (assets.length >= 1) unlock('activo_fisico');
    if (assets.length >= 3) unlock('tres_activos');
    if (assets.length >= 5) unlock('cinco_activos');

    // ─ Patrimonio neto
    const patrimonio = _calcPatrimonio(data);
    if (patrimonio >= 10000)  unlock('patrimonio_10k');
    if (patrimonio >= 50000)  unlock('patrimonio_50k');
    if (patrimonio >= 100000) unlock('patrimonio_100k');
    if (patrimonio >= 250000) unlock('patrimonio_250k');

    // ─ Cash flow por mes
    let positive = 0, positiveAll = 0;
    for (let i = 1; i <= 12; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mo = d.toISOString().slice(0, 7);
      const ing = ingresos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      const gas = gastos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      if (ing > gas) { positive++; positiveAll++; } else positiveAll = 0;
    }
    if (positive >= 3)  unlock('ahorrador_3meses');
    if (positive >= 6)  unlock('ahorrador_6meses');
    if (positive >= 12) unlock('ahorrador_anual');

    // ─ Cash flow este mes
    const ingMes = ingresos.filter(x=>(x.fecha||'').startsWith(thisMo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
    const gasMes = gastos.filter(x=>(x.fecha||'').startsWith(thisMo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
    if (ingMes > gasMes) unlock('saldo_positivo');

    // ─ Fin de semana
    const day = new Date().getDay();
    if (day === 0 || day === 6) unlock('fin_de_semana');

    // ─ 6 meses positivos / anual
    let consecutivePositive = 0;
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mo = d.toISOString().slice(0, 7);
      const ing2 = ingresos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      const gas2 = gastos.filter(x=>(x.fecha||'').startsWith(mo)).reduce((a,x)=>a+(Number(x.importe)||0),0);
      if (ing2 > gas2) consecutivePositive++; else break;
    }
    if (consecutivePositive >= 6)  unlock('seis_meses_positivo');
    if (consecutivePositive >= 12) unlock('anual_positivo');

    // ─ Ingreso grande
    ingresos.forEach(x => {
      const v = Number(x.importe||0);
      if (v >= 5000)  unlock('ingreso_grande');
      if (v >= 10000) unlock('ingreso_mega');
    });
    _checkMesAustero(ingresos, gastos, now, thisMo);
    _checkIngresoRecords(ingresos, now);

    // ─ 3 años usando la app
    try {
      const createdAt = data.createdAt || data.usuario?.createdAt;
      if (createdAt) {
        const anos = (now - new Date(createdAt)) / (365.25 * 86400000);
        if (anos >= 3) unlock('tres_anos_usando');
      }
    } catch {}

    // ─ Completista — desbloquea si tiene todos los demás
    const totalAchs = ACHIEVEMENTS.length;
    const unlockedCount = Object.keys(getAchievements().unlocked).length;
    if (unlockedCount >= totalAchs - 1) unlock('completista');
  }

  function _calcPatrimonio(data) {
    try {
      const cuentas = (data.cuentas||[]).reduce((s,c)=>s+(Number(c.saldo)||0),0);
      const inversiones = (data.inversiones||[]).filter(i=>!i.cerrada && i.status!=='liquidated').reduce((s,i)=>s+(Number(i.importe)||0)*(1+(Number(i.rentabilidad||i.roi||0)/100)),0);
      const deudas = (data.deudas||[]).reduce((s,d)=>s+(Math.max(0,(Number(d.importeTotal||0)-Number(d.importePagado||0)))),0);
      return cuentas + inversiones - deudas;
    } catch { return 0; }
  }

  function _checkPresupuestoCumplido(data) {
    try {
      const presupuestos = data.presupuestos || {};
      const gastos = data.gastos || [];
      const now = new Date();
      const thisMo = now.toISOString().slice(0, 7);
      const cats = Object.keys(presupuestos);
      if (cats.length === 0) return;
      const cumplidos = cats.filter(cat => {
        const limit = Number(presupuestos[cat]);
        const spent = gastos.filter(g=>(g.fecha||'').startsWith(thisMo) && g.categoria === cat).reduce((s,g)=>s+(Number(g.importe)||0),0);
        return limit > 0 && spent <= limit;
      });
      if (cumplidos.length >= 1) unlock('presupuesto_cumplido');
      // 3 meses consecutivos respetando presupuesto
      let consecutive = 0;
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mo = d.toISOString().slice(0, 7);
        const allOk = cats.every(cat => {
          const limit = Number(presupuestos[cat]);
          const spent = gastos.filter(g=>(g.fecha||'').startsWith(mo) && g.categoria === cat).reduce((s,g)=>s+(Number(g.importe)||0),0);
          return limit === 0 || spent <= limit;
        });
        if (allOk) consecutive++; else break;
      }
      if (consecutive >= 3) unlock('tres_meses_pres');
    } catch {}
  }

  function _checkStreakAchievements() {
    const s = _getStreak();
    if (s.streak >= 7)   unlock('streak_7');
    if (s.streak >= 14)  unlock('streak_14');
    if (s.streak >= 30)  unlock('streak_30');
    if (s.streak >= 60)  unlock('streak_60');
    if (s.streak >= 100) unlock('streak_100');
    if (s.streak >= 180) unlock('streak_180');
    if (s.streak >= 365) unlock('streak_365');
  }

  // ─── Toast premium ───────────────────────────────────────────────
  function _showAchievementToast(def) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
      background:rgba(15,23,42,0.95);border:1.5px solid rgba(0,212,170,0.5);
      border-radius:16px;padding:14px 20px;z-index:99999;
      box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(0,212,170,0.15);
      display:flex;align-items:center;gap:12px;
      font-family:var(--font,inherit);
      animation:mnAchIn .4s cubic-bezier(0.22,1,0.36,1) forwards;
      backdrop-filter:blur(20px);
      max-width:320px;
    `;
    el.innerHTML = `
      <div style="font-size:2rem;flex-shrink:0">${def.emoji}</div>
      <div>
        <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(0,212,170,.8);margin-bottom:2px">${typeof window.t==='function'?window.t('achievement_unlocked','¡Logro desbloqueado!'):'¡Logro desbloqueado!'}</div>
        <div style="font-size:.95rem;font-weight:700;color:#fff">${def.nombre}</div>
        <div style="font-size:.75rem;color:rgba(255,255,255,.5);margin-top:2px">${def.desc}</div>
      </div>
    `;
    if (!document.getElementById('mn-ach-style')) {
      const s = document.createElement('style');
      s.id = 'mn-ach-style';
      s.textContent = `
        @keyframes mnAchIn { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes mnAchOut{ from{opacity:1;transform:translateX(-50%) translateY(0)} to{opacity:0;transform:translateX(-50%) translateY(20px)} }
      `;
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'mnAchOut .35s ease forwards';
      setTimeout(() => el.remove(), 380);
    }, 4000);
  }

  // ─── Confetti canvas ─────────────────────────────────────────────
  function _fireConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99998;';
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10,
      r: Math.random() * 6 + 3,
      d: Math.random() * 80,
      color: ['#00D4AA','#6366F1','#F59E0B','#10B981','#F472B6'][Math.floor(Math.random()*5)],
      tilt: Math.random() * 10 - 10,
      ts: Math.random() * 2,
      vy: Math.random() * 3 + 2,
    }));
    let frame = 0;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.vy;
        p.tilt += 0.1;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.sin(p.tilt) * 10, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 90);
        ctx.fill();
      });
      frame++;
      if (frame < 90) requestAnimationFrame(loop);
      else canvas.remove();
    };
    requestAnimationFrame(loop);
  }

  // ─── Achievements panel ──────────────────────────────────────────
  function _gt(k, fb) {
    if (typeof window.t !== 'function') return fb;
    const r = window.t(k);
    return (r && r !== k) ? r : fb;
  }

  const CAT_META = {
    inicio:      { label: () => _gt('logro_cat_inicio',      'Primeros pasos'),    icon: '🚀', color: '#6366F1' },
    ingresos:    { label: () => _gt('logro_cat_ingresos',    'Ingresos'),          icon: '💰', color: '#10B981' },
    gastos:      { label: () => _gt('logro_cat_gastos',      'Gastos'),            icon: '💸', color: '#F59E0B' },
    inversiones: { label: () => _gt('logro_cat_inversiones', 'Inversiones'),       icon: '📈', color: '#00D4AA' },
    deudas:      { label: () => _gt('logro_cat_deudas',      'Deudas'),            icon: '💳', color: '#F43F5E' },
    objetivos:   { label: () => _gt('logro_cat_objetivos',   'Objetivos'),         icon: '🎯', color: '#8B5CF6' },
    patrimonio:  { label: () => _gt('logro_cat_patrimonio',  'Patrimonio'),        icon: '🏦', color: '#0EA5E9' },
    constancia:  { label: () => _gt('logro_cat_constancia',  'Constancia'),        icon: '🔥', color: '#F97316' },
    pro:         { label: () => _gt('logro_cat_pro',         'Herramientas Pro'),  icon: '⚡', color: '#A855F7' },
    explorador:  { label: () => _gt('logro_cat_explorador',  'Explorador'),        icon: '🧭', color: '#3B82F6' },
    especial:    { label: () => _gt('logro_cat_especial',    'Especiales'),        icon: '✨', color: '#EC4899' },
  };

  // ─── Achievement guides (roadmap + steps + tips) ─────────────────
  const ACH_GUIDES = {
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
      steps: ['Visita todas las secciones del menú lateral', 'Dashboard, Ingresos, Gastos, Inversiones, Deudas, Objetivos, Patrimonio, Logros, Análisis, Configuración'],
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

  function renderAchievementsPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const store    = getAchievements();
    const unlocked = Object.keys(store.unlocked).length;
    const pct      = Math.round(unlocked / ACHIEVEMENTS.length * 100);

    // Group by category
    const groups = {};
    for (const a of ACHIEVEMENTS) {
      const cat = a.cat || 'especial';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    }

    // Render single achievement card (GRID style — simple, click to open modal)
    function renderAchCard(a) {
      const done = !!store.unlocked[a.id];
      return `
        <div class="mn-ach-card ${done?'mn-ach-done':''}" onclick="window.MNGamification._showAchGuide('${a.id}','${a.emoji}','${a.nombre.replace(/'/g,"\\'")}','${done}')">
          <div class="mn-ach-emoji">${a.emoji}</div>
          <div class="mn-ach-name">${a.nombre}</div>
          ${done ? `<div class="mn-ach-badge">✓ ${_gt('completado','Completado')}</div>` : ''}
        </div>`;
    }

    const groupsHtml = Object.entries(CAT_META).map(([catKey, meta]) => {
      const items = groups[catKey];
      if (!items || items.length === 0) return '';
      const doneCount = items.filter(a => !!store.unlocked[a.id]).length;
      return `
        <div class="mn-ach-section">
          <div class="mn-ach-section-header">
            <span style="font-size:1.05rem;margin-right:8px">${meta.icon}</span>
            <span style="color:${meta.color}">${typeof meta.label === 'function' ? meta.label() : meta.label}</span>
            <span style="margin-left:8px;font-size:.8rem;color:var(--text3)">${doneCount}/${items.length}</span>
          </div>
          <div class="mn-ach-grid">
            ${items.map(renderAchCard).join('')}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:1rem;font-weight:700;color:var(--text)">${unlocked} / ${ACHIEVEMENTS.length} ${_gt('logros','logros')}</span>
          <span style="font-size:.95rem;color:var(--accent);font-weight:800">${pct}%</span>
        </div>
        <div style="height:8px;background:var(--border);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.2)">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00D4AA,#6366F1,#A855F7);border-radius:inherit;transition:width .5s cubic-bezier(0.22,1,0.36,1);box-shadow:0 0 12px rgba(0,212,170,.4)"></div>
        </div>
      </div>
      ${groupsHtml}
    `;

    // Inject styles if not already present
    if (!document.getElementById('mn-ach-ui-style')) {
      const style = document.createElement('style');
      style.id = 'mn-ach-ui-style';
      style.textContent = `
        .mn-ach-section {
          margin-bottom:32px;
        }
        .mn-ach-section-header {
          font-size:.85rem;font-weight:800;text-transform:uppercase;
          letter-spacing:.08em;margin-bottom:16px;display:flex;align-items:center;
        }
        .mn-ach-grid {
          display:grid;
          grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
          gap:10px;
        }
        @media(max-width:900px){
          .mn-ach-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
        }
        .mn-ach-card {
          position:relative;
          background:var(--card2);
          border:1px solid var(--border);
          border-radius:10px;
          padding:14px 10px;
          text-align:center;
          transition:all .18s cubic-bezier(0.16, 1, 0.3, 1);
          cursor:pointer;
          min-height:120px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:6px;
          will-change:transform;
        }
        .mn-ach-card:hover {
          border-color:var(--border2);
          transform:translateY(-3px);
          box-shadow:0 6px 20px rgba(0,0,0,.35);
        }
        .mn-ach-card:active {
          transform:translateY(-1px);
        }
        .mn-ach-card.mn-ach-done {
          background:rgba(0,212,170,.05);
          border-color:rgba(0,212,170,.3);
        }
        .mn-ach-card.mn-ach-done:hover {
          border-color:rgba(0,212,170,.5);
          box-shadow:0 6px 20px rgba(0,212,170,.2);
        }
        .mn-ach-emoji {
          font-size:2rem;
          filter:grayscale(1);
          opacity:.35;
          transition:all .25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mn-ach-card:hover .mn-ach-emoji {
          filter:grayscale(0.7);
          opacity:.5;
          transform:scale(1.08);
        }
        .mn-ach-done .mn-ach-emoji {
          filter:none;
          opacity:1;
        }
        .mn-ach-done:hover .mn-ach-emoji {
          transform:scale(1.12);
        }
        .mn-ach-name {
          font-size:.8rem;
          font-weight:700;
          color:var(--text);
          line-height:1.25;
          text-align:center;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        }
        .mn-ach-badge {
          font-size:.62rem;
          color:var(--accent);
          background:var(--accent-dim);
          border:1px solid var(--accent);
          border-radius:5px;
          padding:2px 6px;
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:.04em;
          margin-top:2px;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── Guide Modal ────────────────────────────
  window.MNGamification = window.MNGamification || {};
  window.MNGamification._showAchGuide = function(id, emoji, nombre, done) {
    const guide = ACH_GUIDES[id] || { steps: [], tip: '' };
    const isDone = done === 'true';
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    const desc = ach ? ach.desc : '';

    const existing = document.getElementById('mn-ach-guide-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mn-ach-guide-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9900;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.7);backdrop-filter:blur(12px);animation:mnFadeIn .2s ease';
    overlay.innerHTML = `
      <div style="background:#0D1424;border:1px solid rgba(255,255,255,.09);border-radius:20px;width:min(480px,100%);max-height:90vh;overflow-y:auto;padding:28px;position:relative;animation:mnScaleIn .25s cubic-bezier(0.22,1,0.36,1)">
        <button onclick="document.getElementById('mn-ach-guide-overlay').remove()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-family:inherit;transition:all .15s" onmouseover="this.style.background='var(--red-dim)';this.style.color='var(--red)'" onmouseout="this.style.background='rgba(255,255,255,.06)';this.style.color='rgba(255,255,255,.4)'">✕</button>
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:3.2rem;margin-bottom:10px;${isDone?'':'filter:grayscale(1);opacity:.5'}">${emoji}</div>
          <div style="font-size:1.15rem;font-weight:800;color:${isDone?'var(--accent)':'rgba(255,255,255,.6)'};letter-spacing:-.02em;margin-bottom:6px">${nombre}</div>
          <div style="font-size:.82rem;color:var(--text2);line-height:1.5">${desc}</div>
          ${isDone ? `<div style="font-size:.75rem;color:var(--accent);margin-top:8px;font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--accent-dim);border-radius:99px;border:1px solid var(--accent)">✅ ${_gt('logro_completado','Completado')}</div>` : ''}
        </div>
        ${guide.steps && guide.steps.length ? `
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px 20px;margin-bottom:${guide.tip?'14px':'0'}">
            <div style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">${isDone?_gt('logro_roadmap_completado','🗺 Cómo lo hiciste'):_gt('logro_roadmap','🗺 Roadmap paso a paso')}</div>
            ${guide.steps.map((step,i)=>`
              <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:${i===guide.steps.length-1?'0':'12px'}">
                <div style="width:26px;height:26px;border-radius:50%;flex-shrink:0;background:${isDone?'rgba(0,212,170,.15)':'var(--indigo-dim)'};border:1.5px solid ${isDone?'var(--accent)':'var(--indigo)'};color:${isDone?'var(--accent)':'var(--indigo)'};font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center">${i+1}</div>
                <div style="flex:1;font-size:.88rem;color:rgba(255,255,255,.75);line-height:1.6;padding-top:2px">${step}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${guide.tip ? `<div style="padding:14px 16px;background:var(--accent-dim);border:1px solid var(--accent);border-radius:12px;font-size:.8rem;color:var(--text);line-height:1.5"><strong style="color:var(--accent)">💡 ${_gt('protip','Protip')}:</strong> ${guide.tip}</div>` : ''}
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  // ─── Streak system ───────────────────────────────────────────────
  function _getStreak() {
    try { return JSON.parse(localStorage.getItem(STREAK_KEY) || '{"streak":0,"lastOpenDate":""}'); }
    catch { return { streak: 0, lastOpenDate: '' }; }
  }

  function _saveStreak(data) {
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(data)); } catch {}
  }

  function checkAndUpdateStreak() {
    const s     = _getStreak();
    const today = new Date().toISOString().slice(0, 10);
    if (s.lastOpenDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (s.lastOpenDate === yesterday) {
      s.streak = (s.streak || 0) + 1;
    } else {
      s.streak = 1;
    }
    s.lastOpenDate = today;
    _saveStreak(s);
    showStreakBadge(s.streak);
    _checkStreakAchievements();
  }

  function showStreakBadge(streak) {
    if (streak < 3) return;
    // Inject badge near the topbar if container exists
    const container = document.getElementById('streakBadgeContainer') || document.querySelector('.topbar-right') || document.querySelector('.sidebar-footer');
    if (!container) return;
    let badge = document.getElementById('mn-streak-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'mn-streak-badge';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#F59E0B;cursor:default;padding:3px 8px;background:rgba(245,158,11,0.12);border-radius:99px;border:1px solid rgba(245,158,11,0.3)';
      container.appendChild(badge);
    }
    badge.textContent = `🔥 ${streak}`;
    badge.title = `${streak} días de racha`;
  }

  // ─── Auto-check on data save ──────────────────────────────────────
  window.addEventListener('mn:data:saved', e => {
    const data = e.detail;
    if (!data) return;
    if ((data.ingresos||[]).length >= 1)    checkAchievement('ingreso_added');
    if ((data.gastos||[]).length   >= 1)    checkAchievement('gasto_added');
    if ((data.deudas||[]).length   >= 1)    checkAchievement('deuda_added');
    if ((data.inversiones||[]).length >= 1) checkAchievement('inversion_added');
    if ((data.objetivos||[]).length   >= 1) checkAchievement('objetivo_added');
    if (Object.keys(data.presupuestos||{}).length >= 1) checkAchievement('presupuesto_added');
    if ((data.objetivos||[]).some(o=>o.completado)) checkAchievement('objetivo_done');
    checkAchievement('deuda_updated');
    checkAchievement('data_check');
  });

  checkAndUpdateStreak();

  // ─── Modal de detalle de logro ────────────────────────────────────
  function _showAchDetail(emoji, nombre, desc, done, dateStr) {
    const existing = document.getElementById('mn-ach-detail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mn-ach-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9900;display:flex;align-items:flex-end;justify-content:center;padding:24px;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);animation:mnFadeIn .2s ease';
    const isDone = done === 'true';
    overlay.innerHTML = `
      <div style="background:#0D1424;border:1px solid rgba(255,255,255,.09);border-radius:20px 20px 16px 16px;width:min(400px,100%);padding:24px;position:relative;animation:mnScaleIn .25s cubic-bezier(0.22,1,0.36,1)">
        <button onclick="document.getElementById('mn-ach-detail-overlay').remove()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);width:26px;height:26px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-family:inherit">✕</button>
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:3rem;margin-bottom:8px;${isDone?'':'filter:grayscale(1);opacity:.5'}">${emoji}</div>
          <div style="font-size:1rem;font-weight:800;color:${isDone?'#fff':'rgba(255,255,255,.5)'};letter-spacing:-.02em">${nombre}</div>
          ${isDone ? `<div style="font-size:.7rem;color:#00D4AA;margin-top:4px;font-weight:600">✓ ${_gt('logro_desbloqueado','Desbloqueado')} · ${dateStr}</div>` : `<div style="font-size:.7rem;color:rgba(255,255,255,.3);margin-top:4px">${_gt('logro_pendiente','Pendiente')}</div>`}
        </div>
        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px">
          <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${isDone?_gt('logro_completado_como','Cómo lo conseguiste'):_gt('logro_como_completar','Cómo completarlo')}</div>
          <div style="font-size:.82rem;color:rgba(255,255,255,.7);line-height:1.55">${desc}</div>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    if (!document.getElementById('mn-ach-style')) {
      const s = document.createElement('style');
      s.id = 'mn-ach-style';
      s.textContent = `@keyframes mnFadeIn{from{opacity:0}to{opacity:1}}@keyframes mnScaleIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}`;
      document.head.appendChild(s);
    }
  }

  // Export all public methods (some already attached to window.MNGamification above)
  window.MNGamification = window.MNGamification || {};
  window.MNGamification.checkAchievement = checkAchievement;
  window.MNGamification.renderAchievementsPanel = renderAchievementsPanel;
  window.MNGamification.getAchievements = getAchievements;
  window.MNGamification.isUnlocked = isUnlocked;
  window.MNGamification._showAchDetail = _showAchDetail;
  window.MNGamification._fireConfetti = _fireConfetti;
  // _expandAch, _collapseAch, _toggleCategory, _showAchGuide already attached above
})();
