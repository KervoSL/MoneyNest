// ════════════════════════════════════════════════════════════════
// FEATURE SHOWCASE
// ════════════════════════════════════════════════════════════════
// Shows 5 visual screens to new users BEFORE onboarding.
// Order: Showcase → Onboarding → App
// State flag: S.showcase.completed

(function() {
  'use strict';

  const SHOWCASE_FLAG = 'mn_showcase_seen';
  let currentSlide = 0;

  const slides = [
    {
      title: 'Controla tu patrimonio neto',
      subtitle: 'Visualiza todo lo que tienes en un solo lugar',
      icon: '💰',
      visual: 'networth',
      description: 'Suma automática de cuentas, inversiones y activos. Resta tus deudas. Ve tu riqueza total en tiempo real.'
    },
    {
      title: 'Importa tus movimientos bancarios',
      subtitle: 'CSV de cualquier banco en segundos',
      icon: '📊',
      visual: 'importer',
      description: 'Arrastra el archivo CSV de tu banco. MoneyNest detecta automáticamente el formato y categoriza tus transacciones.'
    },
    {
      title: 'Gestiona tus inversiones',
      subtitle: 'Portfolio completo con rentabilidad real',
      icon: '📈',
      visual: 'investments',
      description: 'Registra acciones, ETFs, fondos o criptomonedas. Actualiza el valor y retira beneficios cuando quieras.'
    },
    {
      title: 'Define objetivos de ahorro',
      subtitle: 'Visualiza tu progreso mes a mes',
      icon: '🎯',
      visual: 'goals',
      description: 'Crea metas con foto, color y deadline. MoneyNest calcula cuánto necesitas ahorrar cada mes para conseguirlo.'
    },
    {
      title: '¡Empieza ahora!',
      subtitle: '100 movimientos gratis para probar',
      icon: '🚀',
      visual: 'cta',
      description: 'No necesitas tarjeta de crédito. Prueba todas las funciones durante tu periodo de prueba.'
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

  // Render showcase UI
  function renderShowcase() {
    let overlay = document.getElementById('showcaseOverlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'showcaseOverlay';
      overlay.className = 'showcase-overlay';
      document.body.appendChild(overlay);
    }

    const slide = slides[currentSlide];
    const isLastSlide = currentSlide === slides.length - 1;

    overlay.innerHTML = `
      <div class="showcase-container">
        <!-- Progress dots -->
        <div class="showcase-dots">
          ${slides.map((_, i) => `
            <div class="showcase-dot ${i === currentSlide ? 'active' : ''} ${i < currentSlide ? 'completed' : ''}"></div>
          `).join('')}
        </div>

        <!-- Visual mockup -->
        <div class="showcase-visual">
          ${renderVisual(slide.visual)}
        </div>

        <!-- Content -->
        <div class="showcase-content">
          <div class="showcase-icon">${slide.icon}</div>
          <h1 class="showcase-title">${slide.title}</h1>
          <h2 class="showcase-subtitle">${slide.subtitle}</h2>
          <p class="showcase-description">${slide.description}</p>
        </div>

        <!-- Navigation -->
        <div class="showcase-nav">
          ${currentSlide > 0 ? `
            <button class="showcase-btn showcase-btn-back" onclick="showcasePrev()">
              ← Anterior
            </button>
          ` : '<div></div>'}

          <button class="showcase-btn showcase-btn-primary" onclick="${isLastSlide ? 'showcaseComplete()' : 'showcaseNext()'}">
            ${isLastSlide ? 'Comenzar 🚀' : 'Siguiente →'}
          </button>
        </div>

        <!-- Skip option (only on first slides) -->
        ${!isLastSlide ? `
          <button class="showcase-skip" onclick="showcaseComplete()">
            Saltar presentación
          </button>
        ` : ''}
      </div>
    `;
  }

  // Render visual mockups
  function renderVisual(type) {
    switch(type) {
      case 'networth':
        return `
          <div class="visual-card">
            <div class="visual-header">
              <div class="visual-label">Patrimonio neto</div>
              <div class="visual-amount">45.280 €</div>
            </div>
            <div class="visual-chart">
              <div class="visual-bar visual-bar-green" style="width: 70%">
                <span>Activos</span>
              </div>
              <div class="visual-bar visual-bar-red" style="width: 30%">
                <span>Deudas</span>
              </div>
            </div>
            <div class="visual-items">
              <div class="visual-item">
                <span class="visual-item-icon">🏦</span>
                <span class="visual-item-label">Cuentas</span>
                <span class="visual-item-value">12.500 €</span>
              </div>
              <div class="visual-item">
                <span class="visual-item-icon">📈</span>
                <span class="visual-item-label">Inversiones</span>
                <span class="visual-item-value">28.300 €</span>
              </div>
              <div class="visual-item">
                <span class="visual-item-icon">🏠</span>
                <span class="visual-item-label">Activos</span>
                <span class="visual-item-value">15.000 €</span>
              </div>
            </div>
          </div>
        `;

      case 'importer':
        return `
          <div class="visual-card">
            <div class="visual-upload">
              <div class="visual-upload-icon">📄</div>
              <div class="visual-upload-label">movimientos_banco.csv</div>
              <div class="visual-upload-progress">
                <div class="visual-upload-bar" style="width: 75%"></div>
              </div>
            </div>
            <div class="visual-transactions">
              <div class="visual-transaction">
                <span class="visual-tx-icon">🍔</span>
                <span class="visual-tx-desc">McDonald's Barcelona</span>
                <span class="visual-tx-amount">-12,50 €</span>
              </div>
              <div class="visual-transaction">
                <span class="visual-tx-icon">⛽</span>
                <span class="visual-tx-desc">Repsol Gasolina</span>
                <span class="visual-tx-amount">-45,00 €</span>
              </div>
              <div class="visual-transaction">
                <span class="visual-tx-icon">💰</span>
                <span class="visual-tx-desc">Nómina enero</span>
                <span class="visual-tx-amount">+2.100,00 €</span>
              </div>
            </div>
            <div class="visual-badge">✓ 127 movimientos importados</div>
          </div>
        `;

      case 'investments':
        return `
          <div class="visual-card">
            <div class="visual-portfolio">
              <div class="visual-portfolio-header">
                <div class="visual-portfolio-label">Portfolio total</div>
                <div class="visual-portfolio-value">28.300 €</div>
                <div class="visual-portfolio-gain">+2.847 € (+11,2%)</div>
              </div>
              <div class="visual-investment">
                <div class="visual-inv-icon">📊</div>
                <div class="visual-inv-details">
                  <div class="visual-inv-name">Vanguard S&P 500</div>
                  <div class="visual-inv-subtitle">15.000 € • +8,5%</div>
                </div>
              </div>
              <div class="visual-investment">
                <div class="visual-inv-icon">₿</div>
                <div class="visual-inv-details">
                  <div class="visual-inv-name">Bitcoin</div>
                  <div class="visual-inv-subtitle">8.500 € • +24,1%</div>
                </div>
              </div>
              <div class="visual-investment">
                <div class="visual-inv-icon">🏢</div>
                <div class="visual-inv-details">
                  <div class="visual-inv-name">Apple Inc.</div>
                  <div class="visual-inv-subtitle">4.800 € • +6,3%</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'goals':
        return `
          <div class="visual-card">
            <div class="visual-goal">
              <div class="visual-goal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div class="visual-goal-icon">✈️</div>
                <div class="visual-goal-name">Viaje a Japón</div>
              </div>
              <div class="visual-goal-progress">
                <div class="visual-goal-amount">
                  <span>2.400 €</span>
                  <span class="visual-goal-total">de 3.500 €</span>
                </div>
                <div class="visual-goal-bar">
                  <div class="visual-goal-fill" style="width: 68%"></div>
                </div>
                <div class="visual-goal-status">68% completado • Faltan 4 meses</div>
              </div>
            </div>
            <div class="visual-goal">
              <div class="visual-goal-header" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                <div class="visual-goal-icon">💻</div>
                <div class="visual-goal-name">MacBook Pro</div>
              </div>
              <div class="visual-goal-progress">
                <div class="visual-goal-amount">
                  <span>1.200 €</span>
                  <span class="visual-goal-total">de 2.500 €</span>
                </div>
                <div class="visual-goal-bar">
                  <div class="visual-goal-fill" style="width: 48%"></div>
                </div>
                <div class="visual-goal-status">48% completado • Faltan 6 meses</div>
              </div>
            </div>
          </div>
        `;

      case 'cta':
        return `
          <div class="visual-card visual-cta">
            <div class="visual-cta-features">
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">100 movimientos gratis</div>
              </div>
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">Sin tarjeta de crédito</div>
              </div>
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">Datos 100% privados</div>
              </div>
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">Funciona offline</div>
              </div>
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">Sync en la nube opcional</div>
              </div>
              <div class="visual-cta-feature">
                <div class="visual-cta-icon">✓</div>
                <div class="visual-cta-text">Diseño premium</div>
              </div>
            </div>
            <div class="visual-cta-badge">
              <div class="visual-cta-badge-icon">🎉</div>
              <div class="visual-cta-badge-text">Empieza gratis en menos de 2 minutos</div>
            </div>
          </div>
        `;

      default:
        return '<div class="visual-placeholder">🚀</div>';
    }
  }

  // Navigation
  window.showcaseNext = function() {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      renderShowcase();

      // Animate transition
      const container = document.querySelector('.showcase-container');
      if (container) {
        container.classList.add('showcase-slide-transition');
        setTimeout(() => container.classList.remove('showcase-slide-transition'), 300);
      }
    }
  };

  window.showcasePrev = function() {
    if (currentSlide > 0) {
      currentSlide--;
      renderShowcase();

      // Animate transition
      const container = document.querySelector('.showcase-container');
      if (container) {
        container.classList.add('showcase-slide-transition');
        setTimeout(() => container.classList.remove('showcase-slide-transition'), 300);
      }
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
      if (currentSlide === slides.length - 1) {
        showcaseComplete();
      } else {
        showcaseNext();
      }
    } else if (e.key === 'ArrowLeft') {
      showcasePrev();
    } else if (e.key === 'Escape') {
      showcaseComplete();
    }
  });

})();
