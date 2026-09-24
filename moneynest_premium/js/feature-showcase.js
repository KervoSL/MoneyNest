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
      title: 'Dashboard <span>inteligente</span>',
      subtitle: 'Todo en un vistazo',
      icon: '📊',
      visual: 'dashboard',
      description: 'Balance mensual, gráficos interactivos y estadísticas en tiempo real. Tu situación financiera en una sola pantalla.'
    },
    {
      title: 'Cada euro bajo <span>control</span>',
      subtitle: 'Movimientos organizados y categorizados',
      icon: '💸',
      visual: 'movements',
      description: 'Registra ingresos y gastos con categorías personalizables. Busca, filtra y exporta tus datos en cualquier momento.'
    },
    {
      title: 'Haz crecer tu <span>dinero</span>',
      subtitle: 'Portfolio completo con rentabilidad real',
      icon: '📈',
      visual: 'investments',
      description: 'Acciones, ETFs, fondos o criptomonedas. Calcula beneficios, pérdidas y rendimiento total de tu portfolio.'
    },
    {
      title: 'Conoce tu riqueza <span>real</span>',
      subtitle: 'Patrimonio neto actualizado',
      icon: '💰',
      visual: 'networth',
      description: 'Suma automática de cuentas, inversiones y activos. Resta tus deudas. Tu situación financiera completa.'
    },
    {
      title: 'Ahorra con <span>propósito</span>',
      subtitle: 'Objetivos visuales que te motivan',
      icon: '🎯',
      visual: 'goals',
      description: 'Crea metas con imagen, color y fecha límite. MoneyNest calcula cuánto ahorrar cada mes para conseguirlo.'
    },
    {
      title: '¡Empieza <span>gratis</span> ahora!',
      subtitle: '100 movimientos de prueba, sin tarjeta',
      icon: '🚀',
      visual: 'cta',
      description: 'Comienza en menos de 2 minutos. Privado, offline y con todas las funciones premium incluidas.'
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
            <div class="showcase-screen ${index === 0 ? 'welcome-screen' : ''}" data-screen="${index}">
              <div class="showcase-screen-content">
                ${index === 0 ? '' : `
                  <!-- Step indicator -->
                  <div class="showcase-step-pill">
                    <div class="showcase-step-pill-dot"></div>
                    PASO ${index + 1} DE ${slides.length}
                  </div>

                  <!-- Headline -->
                  <h1 class="showcase-headline">${slide.title}</h1>

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

      case 'dashboard':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;gap:10px;margin-bottom:4px;">
                <div style="flex:1;padding:14px;background:linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%);border:1px solid rgba(16,185,129,0.2);border-radius:12px;">
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Ingresos</div>
                  <div style="font-size:1.3rem;font-weight:800;color:#10B981;font-family:'Plus Jakarta Sans',sans-serif;">+3.245 €</div>
                </div>
                <div style="flex:1;padding:14px;background:linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(244,63,94,0.05) 100%);border:1px solid rgba(244,63,94,0.2);border-radius:12px;">
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Gastos</div>
                  <div style="font-size:1.3rem;font-weight:800;color:#F43F5E;font-family:'Plus Jakarta Sans',sans-serif;">-2.187 €</div>
                </div>
              </div>
              <div style="padding:14px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:12px;text-align:center;">
                <div style="font-size:.65rem;color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Balance</div>
                <div style="font-size:1.6rem;font-weight:800;color:#00D4AA;font-family:'Plus Jakarta Sans',sans-serif;">+1.058 €</div>
              </div>
              <div style="display:flex;gap:6px;height:50px;align-items:flex-end;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:10px;">
                <div style="flex:1;height:35%;background:rgba(0,212,170,0.4);border-radius:3px 3px 0 0;"></div>
                <div style="flex:1;height:60%;background:rgba(0,212,170,0.5);border-radius:3px 3px 0 0;"></div>
                <div style="flex:1;height:45%;background:rgba(0,212,170,0.45);border-radius:3px 3px 0 0;"></div>
                <div style="flex:1;height:80%;background:rgba(0,212,170,0.6);border-radius:3px 3px 0 0;box-shadow:0 0 10px rgba(0,212,170,0.4);"></div>
              </div>
            </div>
          </div>
        `;

      case 'movements':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">💼</div>
                  <div>
                    <div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Nómina</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.4);">01 Sep • Trabajo</div>
                  </div>
                </div>
                <div style="font-size:.95rem;font-weight:800;color:#10B981;">+2.500 €</div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#F43F5E,#E11D48);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🛒</div>
                  <div>
                    <div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Mercadona</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.4);">15 Sep • Alimentación</div>
                  </div>
                </div>
                <div style="font-size:.95rem;font-weight:800;color:#F43F5E;">-85,40 €</div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#F59E0B,#D97706);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">☕</div>
                  <div>
                    <div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Starbucks</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.4);">20 Sep • Cafetería</div>
                  </div>
                </div>
                <div style="font-size:.95rem;font-weight:800;color:#F43F5E;">-4,50 €</div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366F1,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🎬</div>
                  <div>
                    <div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Netflix</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.4);">22 Sep • Ocio</div>
                  </div>
                </div>
                <div style="font-size:.95rem;font-weight:800;color:#F43F5E;">-12,99 €</div>
              </div>
            </div>
          </div>
        `;

      case 'investments':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:12px;">
              <div style="text-align:center;padding:16px;background:linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%);border:1px solid rgba(99,102,241,0.2);border-radius:14px;">
                <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">📈 Portfolio total</div>
                <div style="font-size:2rem;font-weight:900;color:#6366F1;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.04em;text-shadow:0 2px 20px rgba(99,102,241,0.3);">32.800 €</div>
                <div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 12px;background:rgba(16,185,129,0.15);border-radius:20px;">
                  <span style="font-size:.7rem;font-weight:800;color:#10B981;">↑ +3.680 €</span>
                  <span style="font-size:.65rem;font-weight:700;color:rgba(16,185,129,0.7);">(+12,6%)</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                  <div style="width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#6366F1,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 12px rgba(99,102,241,0.3);">📊</div>
                  <div style="flex:1;">
                    <div style="font-size:.8rem;font-weight:800;color:rgba(255,255,255,0.95);margin-bottom:3px;">Vanguard S&P 500</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:.65rem;">
                      <span style="color:rgba(255,255,255,0.5);font-weight:600;">18.500 €</span>
                      <span style="padding:2px 8px;background:rgba(16,185,129,0.15);color:#10B981;font-weight:700;border-radius:6px;">+9,2%</span>
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                  <div style="width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#F59E0B,#D97706);display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 12px rgba(245,158,11,0.3);">₿</div>
                  <div style="flex:1;">
                    <div style="font-size:.8rem;font-weight:800;color:rgba(255,255,255,0.95);margin-bottom:3px;">Bitcoin</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:.65rem;">
                      <span style="color:rgba(255,255,255,0.5);font-weight:600;">9.200 €</span>
                      <span style="padding:2px 8px;background:rgba(16,185,129,0.15);color:#10B981;font-weight:700;border-radius:6px;">+28,3%</span>
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                  <div style="width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#8B5CF6,#7C3AED);display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 12px rgba(139,92,246,0.3);">🏢</div>
                  <div style="flex:1;">
                    <div style="font-size:.8rem;font-weight:800;color:rgba(255,255,255,0.95);margin-bottom:3px;">Apple Inc.</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:.65rem;">
                      <span style="color:rgba(255,255,255,0.5);font-weight:600;">5.100 €</span>
                      <span style="padding:2px 8px;background:rgba(16,185,129,0.15);color:#10B981;font-weight:700;border-radius:6px;">+7,1%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'networth':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:14px;">
              <div style="text-align:center;padding:16px;background:linear-gradient(135deg, rgba(0,212,170,0.15) 0%, rgba(0,212,170,0.05) 100%);border:1px solid rgba(0,212,170,0.2);border-radius:14px;">
                <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">💰 Patrimonio neto</div>
                <div style="font-size:2.2rem;font-weight:900;color:#00D4AA;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.04em;text-shadow:0 2px 20px rgba(0,212,170,0.3);">52.780 €</div>
                <div style="font-size:.75rem;font-weight:600;color:rgba(0,212,170,0.7);margin-top:6px;">+2.847 € este mes</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="padding:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:12px;">
                  <div style="font-size:1.3rem;margin-bottom:6px;">🏦</div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Cuentas</div>
                  <div style="font-size:1.1rem;font-weight:800;color:#10B981;font-family:'Plus Jakarta Sans',sans-serif;">15.200 €</div>
                </div>
                <div style="padding:14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
                  <div style="font-size:1.3rem;margin-bottom:6px;">📈</div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Inversiones</div>
                  <div style="font-size:1.1rem;font-weight:800;color:#6366F1;font-family:'Plus Jakarta Sans',sans-serif;">32.800 €</div>
                </div>
                <div style="padding:14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);border-radius:12px;">
                  <div style="font-size:1.3rem;margin-bottom:6px;">🏠</div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Activos</div>
                  <div style="font-size:1.1rem;font-weight:800;color:#8B5CF6;font-family:'Plus Jakarta Sans',sans-serif;">18.000 €</div>
                </div>
                <div style="padding:14px;background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.15);border-radius:12px;">
                  <div style="font-size:1.3rem;margin-bottom:6px;">💳</div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Deudas</div>
                  <div style="font-size:1.1rem;font-weight:800;color:#F43F5E;font-family:'Plus Jakarta Sans',sans-serif;">-13.220 €</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'goals':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:12px;">
              <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(102,126,234,0.2);box-shadow:0 4px 16px rgba(102,126,234,0.15);">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:16px;display:flex;align-items:center;gap:12px;">
                  <div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">✈️</div>
                  <div>
                    <div style="font-size:.9rem;font-weight:900;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.2);">Viaje a Japón</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.8);font-weight:600;margin-top:2px;">Marzo 2027</div>
                  </div>
                </div>
                <div style="padding:14px;background:rgba(255,255,255,0.03);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                    <span style="font-size:1.2rem;font-weight:900;color:rgba(255,255,255,0.95);font-family:'Plus Jakarta Sans',sans-serif;">2.650 €</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.5);font-weight:600;">de 3.500 €</span>
                  </div>
                  <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:8px;">
                    <div style="height:100%;width:76%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:4px;box-shadow:0 0 10px rgba(102,126,234,0.5);"></div>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:.7rem;color:rgba(102,126,234,0.9);font-weight:700;">76% completado</span>
                    <span style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;">Faltan 5 meses</span>
                  </div>
                </div>
              </div>
              <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(240,147,251,0.2);box-shadow:0 4px 16px rgba(240,147,251,0.15);">
                <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);padding:16px;display:flex;align-items:center;gap:12px;">
                  <div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">💻</div>
                  <div>
                    <div style="font-size:.9rem;font-weight:900;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.2);">MacBook Pro M4</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.8);font-weight:600;margin-top:2px;">Julio 2027</div>
                  </div>
                </div>
                <div style="padding:14px;background:rgba(255,255,255,0.03);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                    <span style="font-size:1.2rem;font-weight:900;color:rgba(255,255,255,0.95);font-family:'Plus Jakarta Sans',sans-serif;">1.350 €</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.5);font-weight:600;">de 2.799 €</span>
                  </div>
                  <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:8px;">
                    <div style="height:100%;width:48%;background:linear-gradient(90deg,#f093fb,#f5576c);border-radius:4px;box-shadow:0 0 10px rgba(240,147,251,0.5);"></div>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:.7rem;color:rgba(240,147,251,0.9);font-weight:700;">48% completado</span>
                    <span style="font-size:.65rem;color:rgba(255,255,255,0.4);font-weight:600;">Faltan 9 meses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'cta':
        return `
          <div class="showcase-cta-container">
            <div class="cta-badge">
              <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:#00D4AA;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>100% Gratis para empezar</span>
            </div>
            <div class="cta-features">
              <div class="cta-feature">
                <div class="cta-feature-icon">✓</div>
                <div class="cta-feature-text">
                  <strong>100 movimientos gratis</strong>
                  <span>Prueba completa sin límites</span>
                </div>
              </div>
              <div class="cta-feature">
                <div class="cta-feature-icon">✓</div>
                <div class="cta-feature-text">
                  <strong>Sin tarjeta de crédito</strong>
                  <span>Empieza sin compromisos</span>
                </div>
              </div>
              <div class="cta-feature">
                <div class="cta-feature-icon">✓</div>
                <div class="cta-feature-text">
                  <strong>Privacidad garantizada</strong>
                  <span>Tus datos son solo tuyos</span>
                </div>
              </div>
              <div class="cta-feature">
                <div class="cta-feature-icon">✓</div>
                <div class="cta-feature-text">
                  <strong>Funciona online</strong>
                  <span>Accede desde cualquier lugar</span>
                </div>
              </div>
              <div class="cta-feature">
                <div class="cta-feature-icon">✓</div>
                <div class="cta-feature-text">
                  <strong>Todas las funciones</strong>
                  <span>Versión premium completa</span>
                </div>
              </div>
            </div>
            <div class="cta-timer">
              <span class="cta-timer-icon">⚡</span>
              <span class="cta-timer-text">Configuración en menos de 2 minutos</span>
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
