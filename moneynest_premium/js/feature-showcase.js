// ════════════════════════════════════════════════════════════════
// FEATURE SHOWCASE
// ════════════════════════════════════════════════════════════════
// Shows 7 visual screens to new users BEFORE onboarding.
// Order: Showcase → Onboarding → App
// State flag: mn_showcase_seen

(function() {
  'use strict';

  const SHOWCASE_FLAG = 'mn_showcase_seen';
  let currentSlide = 0;

  const slides = [
    {
      title: 'Tus finanzas personales, <span>reinventadas</span>',
      subtitle: 'Todo lo que necesitas en una sola app',
      icon: '✨',
      visual: 'welcome',
      description: 'Controla ingresos, gastos, inversiones y patrimonio. Privado, seguro y sin conexión obligatoria.'
    },
    {
      title: 'Conecta tus cuentas<br>bancarias y tarjetas.',
      subtitle: 'Centraliza tu vida financiera',
      icon: '🔗',
      visual: 'connect',
      description: 'Importa tus movimientos de forma segura y en segundos.'
    },
    {
      title: 'Controla tus <span>gastos</span><br>de forma inteligente.',
      subtitle: 'Entiende en qué se va tu dinero',
      icon: '💸',
      visual: 'expenses',
      description: 'Categoriza automáticamente tus movimientos y entiende en qué gastas.'
    },
    {
      title: 'Gestiona tus inversiones<br>y haz crecer tu <span>patrimonio</span>.',
      subtitle: 'Inversiones con visión completa',
      icon: '📈',
      visual: 'investments',
      description: 'Sigue el rendimiento de tus activos en tiempo real y toma mejores decisiones.'
    },
    {
      title: 'Ten el control<br>de tus <span>deudas</span>.',
      subtitle: 'Organiza, prioriza, avanza',
      icon: '📉',
      visual: 'debts',
      description: 'Organiza, reduce y consigue tus objetivos financieros más rápido.'
    },
    {
      title: 'Define y alcanza<br>tus <span>objetivos</span>.',
      subtitle: 'Objetivos que te motivan',
      icon: '🎯',
      visual: 'goals',
      description: 'Convierte tus metas en un plan real y hazlas realidad.'
    },
    {
      title: 'Todo en un solo <span>lugar</span>.',
      subtitle: '100% gratis para empezar',
      icon: '🚀',
      visual: 'cta',
      description: 'Tu dinero, tus decisiones, más claras que nunca.'
    }
  ];

  // Check if user has seen showcase
  window.hasSeenShowcase = function() {
    return localStorage.getItem(SHOWCASE_FLAG) === 'true';
  };

  // Show showcase
  window.showFeatureShowcase = function() {
    if (hasSeenShowcase()) {
      return false;
    }

    currentSlide = 0;
    renderShowcase();

    const overlay = document.getElementById('showcaseOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        overlay.classList.add('showcase-visible');
      });
    }

    return true;
  };

  // Render showcase UI (ONCE - no rebuilds)
  function renderShowcase() {
    let overlay = document.getElementById('showcaseOverlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'showcaseOverlay';
      overlay.className = 'showcase-overlay';
      document.body.appendChild(overlay);
    }

    // Check if already rendered
    if (overlay.querySelector('.showcase-split')) {
      updateActiveSlide();
      return;
    }

    // Render all screens at once
    overlay.innerHTML = `
      <div class="showcase-split">
        <!-- Progress dots (top center) -->
        <div class="showcase-dots">
          ${slides.map((_, i) => `
            <div class="showcase-dot" data-index="${i}"></div>
          `).join('')}
        </div>

        <!-- Skip button (top right) - only visible from slide 2 onwards -->
        <button class="showcase-skip" id="showcaseSkipBtn" onclick="showcaseComplete()">
          Saltar
        </button>

        <!-- Left panel: STATIC branding (never changes) -->
        <div class="showcase-split-left">
          <div class="showcase-left-content">
            <!-- Logo -->
            <div class="showcase-brand">
              <div class="showcase-brand-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <defs>
                    <linearGradient id="mnShowcaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#00D4AA"/>
                      <stop offset="100%" stop-color="#00A882"/>
                    </linearGradient>
                  </defs>
                  <rect width="512" height="512" fill="#0A0E17" rx="96"/>
                  <path d="M96 344 Q256 416 416 344" stroke="rgba(255,255,255,0.8)" stroke-width="34" fill="none" stroke-linecap="round"/>
                  <path d="M130 300 Q256 356 382 300" stroke="rgba(255,255,255,0.5)" stroke-width="22" fill="none" stroke-linecap="round"/>
                  <polyline points="115,300 195,207 275,253 393,115" stroke="url(#mnShowcaseGrad)" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="333,103 393,115 380,172" stroke="url(#mnShowcaseGrad)" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="showcase-brand-name">MoneyNest</div>
            </div>

            <!-- Static tagline (never changes) -->
            <h1 class="showcase-left-tagline">
              Tu dinero,<br><span>bajo control.</span>
            </h1>

            <!-- Static bullet points (never change) -->
            <div class="showcase-left-bullets">
              <div class="showcase-left-bullet">Finanzas personales inteligentes</div>
              <div class="showcase-left-bullet">Ingresos, gastos, inversiones y patrimonio</div>
              <div class="showcase-left-bullet">Privado, seguro y sin conexión obligatoria</div>
            </div>
          </div>
        </div>

        <!-- Right panel: screens container -->
        <div class="showcase-split-right">
          ${slides.map((slide, index) => `
            <div class="showcase-screen ${index === 0 ? 'welcome-screen' : ''}" data-screen="${index}" data-visual="${slide.visual}">
              <div class="showcase-screen-content">
                ${index === 0 ? '' : `
                  <!-- Header: dots + headline + description -->
                  <div class="showcase-header">
                    <div class="showcase-step-dots">
                      ${slides.map((_, i) => `<div class="showcase-step-dot${i === index ? ' active' : ''}"></div>`).join('')}
                    </div>
                    <h1 class="showcase-headline">${slide.title}</h1>
                    <p class="showcase-description">${slide.description}</p>
                  </div>

                  <!-- Visual mockup -->
                  <div class="showcase-visual">
                    ${renderVisual(slide.visual)}
                  </div>

                  <!-- Navigation -->
                  <div class="showcase-nav">
                    <button class="showcase-btn showcase-btn-primary" onclick="showcaseNext()">
                      ${index === slides.length - 1 ? 'Comenzar 🚀' : 'Siguiente →'}
                    </button>
                    ${index > 0 ? `
                      <button class="showcase-btn showcase-btn-back" onclick="showcasePrev()">
                        ← Anterior
                      </button>
                    ` : ''}
                  </div>
                `}
                ${index === 0 ? `
                  <!-- Welcome screen content -->
                  <div class="showcase-visual">
                    ${renderVisual(slide.visual)}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    updateActiveSlide();
  }

  // Update which slide is active (CSS classes only, no DOM rebuild)
  function updateActiveSlide() {
    const overlay = document.getElementById('showcaseOverlay');
    if (!overlay) return;

    // Update screens visibility
    overlay.querySelectorAll('.showcase-screen').forEach((screen, i) => {
      const isActive = i === currentSlide;
      const isPrev = i < currentSlide;
      const isNext = i > currentSlide;

      screen.classList.toggle('active', isActive);
      screen.classList.toggle('prev', isPrev);
      screen.classList.toggle('next', isNext);
    });

    // Show/hide skip button (only visible from slide 2 onwards)
    const skipBtn = document.getElementById('showcaseSkipBtn');
    if (skipBtn) {
      skipBtn.style.display = currentSlide === 0 ? 'none' : 'block';
    }
  }

  // Render visual mockups
  function renderVisual(type) {
    switch(type) {
      case 'welcome':
        return `
          <div class="welcome-premium">
            <!-- Floating card: Patrimonio neto (top-left) -->
            <div class="wc-card wc-patrimonio">
              <div class="wc-card-label">Patrimonio neto</div>
              <div class="wc-card-row">
                <span class="wc-card-value">42,847 €</span>
                <span class="wc-badge-green">↑ +12.4%</span>
              </div>
              <svg viewBox="0 0 200 55" fill="none" style="width:100%;height:auto;margin:8px 0 4px">
                <defs>
                  <linearGradient id="wcAG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#00D4AA" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="#00D4AA" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,42 C25,38 45,30 75,22 C105,14 135,18 165,10 L200,6 L200,55 L0,55Z" fill="url(#wcAG)"/>
                <path d="M0,42 C25,38 45,30 75,22 C105,14 135,18 165,10 L200,6" stroke="#00D4AA" stroke-width="2" fill="none"/>
              </svg>
              <div class="wc-tabs">
                <span>1M</span><span class="wc-tab-active">3M</span><span>6M</span><span>1A</span><span>TODO</span>
              </div>
            </div>

            <!-- Floating card: Cuentas (bottom-left) -->
            <div class="wc-card wc-cuentas">
              <div class="wc-card-label">Cuentas</div>
              <div class="wc-account"><span class="wc-acc-icon" style="background:#6366F1">🏦</span><span class="wc-acc-name">Cuenta corriente</span><span class="wc-acc-val">2,450 €</span></div>
              <div class="wc-account"><span class="wc-acc-icon" style="background:#F472B6">💰</span><span class="wc-acc-name">Ahorros</span><span class="wc-acc-val">8,200 €</span></div>
              <div class="wc-account"><span class="wc-acc-icon" style="background:#00D4AA">📈</span><span class="wc-acc-name">Inversión</span><span class="wc-acc-val">12,600 €</span></div>
              <div class="wc-account"><span class="wc-acc-icon" style="background:#3B82F6">💳</span><span class="wc-acc-name">Tarjeta</span><span class="wc-acc-val wc-neg">-1,230 €</span></div>
            </div>

            <!-- Floating card: Gastos donut (top-right) -->
            <div class="wc-card wc-gastos">
              <div class="wc-card-label" style="display:flex;align-items:center;gap:6px">
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="#00D4AA" stroke-width="2" stroke-dasharray="12 26"/></svg>
                Gastos
              </div>
              <div class="wc-gastos-body">
                <div class="wc-donut"></div>
                <div class="wc-legend">
                  <div><span class="wc-dot" style="background:#3B82F6"></span>Vivienda<span class="wc-lpct">32%</span></div>
                  <div><span class="wc-dot" style="background:#60A5FA"></span>Alimentación<span class="wc-lpct">18%</span></div>
                  <div><span class="wc-dot" style="background:#818CF8"></span>Transporte<span class="wc-lpct">12%</span></div>
                  <div><span class="wc-dot" style="background:#A78BFA"></span>Ocio<span class="wc-lpct">11%</span></div>
                  <div><span class="wc-dot" style="background:#475569"></span>Otros<span class="wc-lpct">27%</span></div>
                </div>
              </div>
            </div>

            <!-- Floating card: Inversiones (mid-right) -->
            <div class="wc-card wc-inversiones">
              <div class="wc-card-label" style="display:flex;align-items:center;gap:6px">
                <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="1,11 5,7 8,9 13,3" stroke="#00D4AA" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Inversiones
              </div>
              <div class="wc-card-row">
                <span class="wc-card-value">15,230 €</span>
                <span class="wc-badge-green">↑ +8.2%</span>
              </div>
              <svg viewBox="0 0 140 35" fill="none" style="width:100%;height:auto;margin-top:6px">
                <polyline points="0,30 20,26 40,24 60,18 80,20 100,12 120,9 140,5" stroke="#00D4AA" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <!-- Floating card: Objetivos (bottom-right) -->
            <div class="wc-card wc-objetivos">
              <div class="wc-card-label" style="display:flex;align-items:center;gap:6px">
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="3" width="12" height="8" rx="2" fill="none" stroke="#00D4AA" stroke-width="1.5"/><line x1="4" y1="6" x2="10" y2="6" stroke="#00D4AA" stroke-width="1.5" stroke-linecap="round"/></svg>
                Objetivos
              </div>
              <div style="font-size:.78rem;color:rgba(255,255,255,.7);margin-top:4px">Viaje a Japón</div>
              <div class="wc-progress"><div class="wc-progress-bar" style="width:68%"></div></div>
              <div style="font-size:.7rem;color:rgba(255,255,255,.5);text-align:right">68%</div>
            </div>

            <!-- Center hero content -->
            <div class="welcome-center">
              <div class="welcome-brand">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="welcome-brand-icon">
                  <defs>
                    <linearGradient id="wbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#00D4AA"/>
                      <stop offset="100%" stop-color="#00A882"/>
                    </linearGradient>
                  </defs>
                  <rect width="48" height="48" fill="none"/>
                  <path d="M8 32 Q24 38 40 32" stroke="rgba(255,255,255,0.9)" stroke-width="3.2" fill="none" stroke-linecap="round"/>
                  <path d="M11 28 Q24 33 37 28" stroke="rgba(255,255,255,0.5)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                  <polyline points="10,28 18,20 26,23 38,12" stroke="url(#wbGrad)" stroke-width="3.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="33,11 38,12 37,17" stroke="url(#wbGrad)" stroke-width="3.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="welcome-brand-text">MoneyNest</span>
              </div>

              <h1 class="welcome-headline">
                Tu dinero,<br>bajo <span>control</span>.
              </h1>

              <p class="welcome-subheadline">
                Ingresos, gastos, inversiones y patrimonio<br>en un solo lugar.
              </p>

              <button class="welcome-cta" onclick="showcaseNext()">
                Comenzar gratis →
              </button>

              <a href="#" class="welcome-login-link" onclick="event.preventDefault(); showcaseComplete(); setTimeout(() => window.showAuthModal?.('login'), 200)">
                ¿Ya tienes cuenta? <span>Inicia sesión</span>
              </a>
            </div>
          </div>
        `;

      case 'connect':
        return `
          <div class="obs-scene obs-connect">
            <div class="obs-gcard obs-connect-status obs-anim" style="--d:0">
              <div class="obs-pulse-dot"></div>
              <span>Conexión segura</span>
              <span class="obs-status-enc">· Encriptación bancaria</span>
            </div>
            <div class="obs-gcard obs-card-main obs-anim" style="--d:1">
              <div class="obs-card-head">Conectar cuenta</div>
              <div class="obs-bank-list" style="position:relative;max-height:232px;overflow:hidden">
                <div class="obs-bank-row obs-anim" style="--d:2"><div class="obs-bank-dot" style="--c:#004481"><span class="obs-bank-abbr">BBVA</span></div><span>BBVA</span><span class="obs-chevron">›</span></div>
                <div class="obs-bank-row obs-anim" style="--d:3"><div class="obs-bank-dot" style="--c:#EC0000"><span class="obs-bank-abbr" style="font-size:14px;font-weight:900">S</span></div><span>Santander</span><span class="obs-chevron">›</span></div>
                <div class="obs-bank-row obs-anim" style="--d:4"><div class="obs-bank-dot" style="--c:#007BC4"><span class="obs-bank-abbr" style="font-size:16px">★</span></div><span>CaixaBank</span><span class="obs-chevron">›</span></div>
                <div class="obs-bank-row obs-anim" style="--d:5"><div class="obs-bank-dot" style="--c:#FF6200"><span class="obs-bank-abbr">ING</span></div><span>ING</span><span class="obs-chevron">›</span></div>
                <div class="obs-bank-row obs-anim" style="--d:6"><div class="obs-bank-dot" style="--c:#E8410A"><span class="obs-bank-abbr" style="font-size:9px">BKT</span></div><span>Bankinter</span><span class="obs-chevron">›</span></div>
                <div class="obs-bank-row obs-anim" style="--d:7"><div class="obs-bank-dot" style="--c:#006F5B"><span class="obs-bank-abbr">BS</span></div><span>Sabadell</span><span class="obs-chevron">›</span></div>
                <div style="position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,rgba(10,15,30,0.95));pointer-events:none"></div>
              </div>
            </div>
            <div class="obs-feature-strip obs-anim" style="--d:8">
              <div class="obs-feat-item"><span class="obs-feat-icon">🔒</span><div><strong>Conexión segura</strong><span>Tus datos siempre protegidos</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">🚀</span><div><strong>Sin complicaciones</strong><span>En menos de 2 minutos</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">🏦</span><div><strong>Todas tus cuentas</strong><span>En un único lugar</span></div></div>
            </div>
          </div>
        `;

      case 'expenses':
        return `
          <div class="obs-scene obs-expenses">
            <div class="obs-expenses-grid">
              <div class="obs-gcard obs-expenses-cats obs-anim" style="--d:0">
                <div class="obs-card-head">Gastos por categoría</div>
                <div class="obs-donut-wrap">
                  <div class="obs-donut"></div>
                  <div class="obs-donut-legend">
                    <div class="obs-anim" style="--d:1"><span class="obs-dot" style="--c:#3B82F6"></span>Vivienda<b>32%</b></div>
                    <div class="obs-anim" style="--d:2"><span class="obs-dot" style="--c:#60A5FA"></span>Alimentación<b>18%</b></div>
                    <div class="obs-anim" style="--d:3"><span class="obs-dot" style="--c:#818CF8"></span>Transporte<b>12%</b></div>
                    <div class="obs-anim" style="--d:4"><span class="obs-dot" style="--c:#A78BFA"></span>Ocio<b>11%</b></div>
                    <div class="obs-anim" style="--d:5"><span class="obs-dot" style="--c:#475569"></span>Otros<b>27%</b></div>
                  </div>
                </div>
              </div>
              <div class="obs-gcard obs-expenses-feed obs-anim" style="--d:3">
                <div class="obs-card-head">Movimientos recientes</div>
                <div class="obs-tx-list">
                  <div class="obs-tx-row obs-anim" style="--d:4"><div class="obs-tx-icon" style="background:linear-gradient(135deg,#F43F5E,#E11D48)">🛒</div><div class="obs-tx-info"><strong>Mercadona</strong><span>Hoy</span></div><span class="obs-tx-neg">-48,30 €</span></div>
                  <div class="obs-tx-row obs-anim" style="--d:5"><div class="obs-tx-icon" style="background:linear-gradient(135deg,#6366F1,#4F46E5)">🎬</div><div class="obs-tx-info"><strong>Netflix</strong><span>Hoy</span></div><span class="obs-tx-neg">-12,99 €</span></div>
                  <div class="obs-tx-row obs-anim" style="--d:6"><div class="obs-tx-icon" style="background:linear-gradient(135deg,#10B981,#059669)">💼</div><div class="obs-tx-info"><strong>Sueldo</strong><span>Hoy</span></div><span class="obs-tx-pos">+2.450,00 €</span></div>
                </div>
              </div>
            </div>
            <div class="obs-feature-strip obs-anim" style="--d:7">
              <div class="obs-feat-item"><span class="obs-feat-icon">🤖</span><div><strong>Categorización automática</strong><span>Más del 90% de precisión</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">📊</span><div><strong>Gráficos y estadísticas</strong><span>Visualiza tus hábitos</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">🎨</span><div><strong>Personaliza categorías</strong><span>Adáptalo a tu estilo de vida</span></div></div>
            </div>
          </div>
        `;

      case 'investments':
        return `
          <div class="obs-scene obs-invest">
            <div class="obs-invest-layout">
              <div class="obs-gcard obs-invest-hero obs-anim" style="--d:0">
                <div class="obs-invest-header">
                  <div>
                    <div class="obs-label">Portafolio</div>
                    <div class="obs-invest-value">15,230 €</div>
                  </div>
                  <div class="obs-invest-badge obs-anim" style="--d:1">↑ +8.2%</div>
                </div>
                <svg class="obs-invest-chart obs-anim" style="--d:2" viewBox="0 0 280 60" fill="none">
                  <defs>
                    <linearGradient id="obsIG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#00D4AA" stop-opacity="0.18"/>
                      <stop offset="100%" stop-color="#00D4AA" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,48 C35,44 60,38 100,28 C140,18 180,22 230,12 L280,6 L280,60 L0,60Z" fill="url(#obsIG)"/>
                  <path d="M0,48 C35,44 60,38 100,28 C140,18 180,22 230,12 L280,6" stroke="#00D4AA" stroke-width="2" fill="none" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="obs-invest-alloc obs-anim" style="--d:3">
                <div class="obs-alloc-chip"><span class="obs-dot" style="--c:#3B82F6"></span>Acciones<b>45%</b></div>
                <div class="obs-alloc-chip"><span class="obs-dot" style="--c:#6366F1"></span>ETFs<b>30%</b></div>
                <div class="obs-alloc-chip"><span class="obs-dot" style="--c:#F59E0B"></span>Criptomonedas<b>15%</b></div>
                <div class="obs-alloc-chip"><span class="obs-dot" style="--c:#475569"></span>Otros<b>10%</b></div>
              </div>
            </div>
            <div class="obs-feature-strip obs-anim" style="--d:5">
              <div class="obs-feat-item"><span class="obs-feat-icon">📊</span><div><strong>Portafolio unificado</strong><span>Todas tus inversiones</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">⚡</span><div><strong>Rendimiento en tiempo real</strong><span>Actualizado al instante</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">📈</span><div><strong>Análisis y métricas</strong><span>Con datos claros y simples</span></div></div>
            </div>
          </div>
        `;

      case 'debts':
        return `
          <div class="obs-scene obs-debts">
            <div class="obs-debts-layout">
              <div class="obs-gcard obs-debts-main obs-anim" style="--d:0">
                <div class="obs-label">Deudas</div>
                <div class="obs-debts-total">12,480 €</div>
                <div class="obs-debts-items">
                  <div class="obs-debt-row obs-anim" style="--d:1"><span class="obs-debt-emoji">🏠</span><span class="obs-debt-name">Hipoteca</span><span class="obs-debt-val">8.200 €</span></div>
                  <div class="obs-debt-row obs-anim" style="--d:2"><span class="obs-debt-emoji">🚗</span><span class="obs-debt-name">Coche</span><span class="obs-debt-val">3.400 €</span></div>
                  <div class="obs-debt-row obs-anim" style="--d:3"><span class="obs-debt-emoji">💳</span><span class="obs-debt-name">Tarjeta de crédito</span><span class="obs-debt-val">880 €</span></div>
                </div>
              </div>
              <div class="obs-debts-plans obs-anim" style="--d:4">
                <div class="obs-gcard obs-debt-plan-card">
                  <div class="obs-debt-plan-row"><span>Plan de pago</span><b>Avance 34%</b></div>
                  <div class="obs-progress"><div class="obs-progress-fill obs-grow" style="--w:34%"></div></div>
                </div>
                <div class="obs-gcard obs-debt-plan-card obs-anim" style="--d:5">
                  <div class="obs-debt-plan-row"><span>Avance mensual</span><b>Avance 24%</b></div>
                  <div class="obs-progress"><div class="obs-progress-fill obs-grow" style="--w:24%"></div></div>
                </div>
              </div>
            </div>
            <div class="obs-feature-strip obs-anim" style="--d:6">
              <div class="obs-feat-item"><span class="obs-feat-icon">📋</span><div><strong>Vista general</strong><span>Todas tus deudas en un solo lugar</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">🎯</span><div><strong>Estrategias personalizadas</strong><span>Snowball, avalanche o a medida</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">📉</span><div><strong>Seguimiento del progreso</strong><span>Ve cómo reduces tu deuda</span></div></div>
            </div>
          </div>
        `;

      case 'goals':
        return `
          <div class="obs-scene obs-goals">
            <div class="obs-goals-layout">
              <div class="obs-gcard obs-goal-card obs-anim" style="--d:0">
                <div class="obs-goal-header"><span class="obs-goal-emoji">🏠</span><div><strong>Casa propia</strong><span>12.000 € / 50.000 €</span></div></div>
                <div class="obs-goal-bar"><div class="obs-progress"><div class="obs-progress-fill obs-grow" style="--w:24%;background:linear-gradient(90deg,#6366F1,#818CF8)"></div></div><b>24%</b></div>
              </div>
              <div class="obs-gcard obs-goal-card obs-anim" style="--d:2">
                <div class="obs-goal-header"><span class="obs-goal-emoji">✈️</span><div><strong>Viaje a Japón</strong><span>3.300 € / 4.000 €</span></div></div>
                <div class="obs-goal-bar"><div class="obs-progress"><div class="obs-progress-fill obs-grow" style="--w:80%;background:linear-gradient(90deg,#00D4AA,#10B981)"></div></div><b>80%</b></div>
              </div>
              <div class="obs-gcard obs-goal-card obs-anim" style="--d:4">
                <div class="obs-goal-header"><span class="obs-goal-emoji">🛡️</span><div><strong>Fondo de emergencia</strong><span>5.000 € / 10.000 €</span></div></div>
                <div class="obs-goal-bar"><div class="obs-progress"><div class="obs-progress-fill obs-grow" style="--w:50%;background:linear-gradient(90deg,#F59E0B,#FBBF24)"></div></div><b>50%</b></div>
              </div>
            </div>
            <div class="obs-feature-strip obs-anim" style="--d:6">
              <div class="obs-feat-item"><span class="obs-feat-icon">🎯</span><div><strong>Objetivos personalizados</strong><span>A corto y largo plazo</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">🤖</span><div><strong>Ahorro automático</strong><span>Avanza sin pensarlo</span></div></div>
              <div class="obs-feat-item"><span class="obs-feat-icon">📊</span><div><strong>Visualiza tu progreso</strong><span>Motivación en cada paso</span></div></div>
            </div>
          </div>
        `;

      case 'cta':
        return `
          <div class="obs-scene obs-final">
            <div class="obs-final-layout">
              <div class="obs-final-left">
                <div class="obs-gcard obs-final-feat obs-anim" style="--d:0"><span class="obs-feat-icon">👁️</span><div><strong>Vista completa</strong><span>Patrimonio, ingresos y gastos</span></div></div>
                <div class="obs-gcard obs-final-feat obs-anim" style="--d:1"><span class="obs-feat-icon">📱</span><div><strong>Acceso en cualquier momento</strong><span>Desde cualquier dispositivo</span></div></div>
                <div class="obs-gcard obs-final-feat obs-anim" style="--d:2"><span class="obs-feat-icon">🔒</span><div><strong>Privacidad ante todo</strong><span>Tus datos siempre seguros</span></div></div>
                <div class="obs-gcard obs-final-feat obs-anim" style="--d:3"><span class="obs-feat-icon">⚡</span><div><strong>100 movimientos gratis</strong><span>Sin tarjeta de crédito</span></div></div>
              </div>
              <div class="obs-final-right">
                <div class="obs-gcard obs-final-goals obs-anim" style="--d:1">
                  <div class="obs-card-head">Mis objetivos</div>
                  <div class="obs-mini-goal"><span>🏠</span>Casa propia<b>24%</b></div>
                  <div class="obs-mini-goal"><span>✈️</span>Viaje a Japón<b>80%</b></div>
                  <div class="obs-mini-goal"><span>🛡️</span>Fondo de emergencia<b>50%</b></div>
                </div>
                <div class="obs-gcard obs-final-app obs-anim" style="--d:2">
                  <div class="obs-final-brand">MoneyNest</div>
                  <div class="obs-label">Patrimonio neto</div>
                  <div class="obs-final-value">42,847 €</div>
                  <div class="obs-final-pct">↑ +12.4%</div>
                </div>
              </div>
            </div>
            <div class="obs-final-trust obs-anim" style="--d:5">
              <span>⚡</span>
              <span>Configuración en menos de 2 minutos</span>
            </div>
          </div>
        `;

      default:
        return '<div class="visual-placeholder">🚀</div>';
    }
  }

  // Navigation - CSS only, no DOM rebuild
  window.showcaseNext = function() {
    const isLastSlide = currentSlide === slides.length - 1;

    if (isLastSlide) {
      showcaseComplete();
    } else {
      currentSlide++;
      updateActiveSlide();
    }
  };

  window.showcasePrev = function() {
    if (currentSlide > 0) {
      currentSlide--;
      updateActiveSlide();
    }
  };

  window.showcaseComplete = function() {
    // Mark showcase as seen
    try {
      localStorage.setItem(SHOWCASE_FLAG, 'true');
      if (window.S) {
        window.S.showcase = { completed: true };
        if (typeof saveLocal === 'function') saveLocal();
      }
    } catch(e) {
      console.error('Error saving showcase state:', e);
    }

    // Close showcase
    const overlay = document.getElementById('showcaseOverlay');
    if (overlay) {
      overlay.classList.remove('showcase-visible');
      setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      }, 300);
    }

    // Start onboarding
    if (typeof checkOnboarding === 'function') {
      checkOnboarding();
    }
  };

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    const overlay = document.getElementById('showcaseOverlay');
    if (!overlay || overlay.style.display === 'none') return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      showcaseNext();
    } else if (e.key === 'ArrowLeft') {
      showcasePrev();
    } else if (e.key === 'Escape') {
      showcaseComplete();
    }
  });

})();
