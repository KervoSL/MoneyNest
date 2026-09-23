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
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:12px;">
              <div style="text-align:center;padding:8px 0;">
                <div style="font-size:.65rem;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Patrimonio neto</div>
                <div style="font-size:1.8rem;font-weight:800;color:#00D4AA;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.03em;">45.280 €</div>
              </div>
              <div class="ob-kpi-row">
                <div class="ob-kpi-mini">
                  <div class="ob-kpi-lbl">🏦 Cuentas</div>
                  <div class="ob-kpi-val green">12.500 €</div>
                </div>
                <div class="ob-kpi-mini">
                  <div class="ob-kpi-lbl">📈 Inversiones</div>
                  <div class="ob-kpi-val blue">28.300 €</div>
                </div>
              </div>
              <div class="ob-kpi-row">
                <div class="ob-kpi-mini">
                  <div class="ob-kpi-lbl">🏠 Activos</div>
                  <div class="ob-kpi-val green">15.000 €</div>
                </div>
                <div class="ob-kpi-mini">
                  <div class="ob-kpi-lbl">💳 Deudas</div>
                  <div class="ob-kpi-val red">-10.520 €</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'importer':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:10px;">
              <div style="text-align:center;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                <div style="font-size:1.4rem;margin-bottom:4px;">📄</div>
                <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.7);">movimientos_banco.csv</div>
                <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:8px;overflow:hidden;">
                  <div style="height:100%;width:75%;background:#00D4AA;border-radius:2px;"></div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:1rem;">🍔</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.7);">McDonald's</span>
                  </div>
                  <span style="font-size:.75rem;font-weight:700;color:#F43F5E;">-12,50 €</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:1rem;">⛽</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.7);">Repsol</span>
                  </div>
                  <span style="font-size:.75rem;font-weight:700;color:#F43F5E;">-45,00 €</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:1rem;">💰</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.7);">Nómina</span>
                  </div>
                  <span style="font-size:.75rem;font-weight:700;color:#00D4AA;">+2.100 €</span>
                </div>
              </div>
              <div style="text-align:center;padding:6px 10px;background:rgba(0,212,170,0.08);color:#00D4AA;border-radius:8px;font-size:.65rem;font-weight:700;">✓ 127 movimientos importados</div>
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
              <div style="text-align:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:.65rem;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Portfolio total</div>
                <div style="font-size:1.6rem;font-weight:800;color:rgba(255,255,255,0.95);font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.03em;margin-bottom:4px;">28.300 €</div>
                <div style="font-size:.75rem;font-weight:700;color:#00D4AA;">+2.847 € (+11,2%)</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                  <div style="font-size:1.3rem;">📊</div>
                  <div style="flex:1;">
                    <div style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Vanguard S&P 500</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.5);">15.000 € • <span style="color:#00D4AA;">+8,5%</span></div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                  <div style="font-size:1.3rem;">₿</div>
                  <div style="flex:1;">
                    <div style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Bitcoin</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.5);">8.500 € • <span style="color:#00D4AA;">+24,1%</span></div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                  <div style="font-size:1.3rem;">🏢</div>
                  <div style="flex:1;">
                    <div style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">Apple Inc.</div>
                    <div style="font-size:.65rem;color:rgba(255,255,255,0.5);">4.800 € • <span style="color:#00D4AA;">+6,3%</span></div>
                  </div>
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
              <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:14px;display:flex;align-items:center;gap:10px;">
                  <div style="font-size:1.4rem;">✈️</div>
                  <div style="font-size:.85rem;font-weight:800;color:white;">Viaje a Japón</div>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.03);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                    <span style="font-size:1rem;font-weight:800;color:rgba(255,255,255,0.9);">2.400 €</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.5);">de 3.500 €</span>
                  </div>
                  <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-bottom:6px;">
                    <div style="height:100%;width:68%;background:#667eea;border-radius:3px;"></div>
                  </div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.5);">68% • Faltan 4 meses</div>
                </div>
              </div>
              <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);padding:14px;display:flex;align-items:center;gap:10px;">
                  <div style="font-size:1.4rem;">💻</div>
                  <div style="font-size:.85rem;font-weight:800;color:white;">MacBook Pro</div>
                </div>
                <div style="padding:12px;background:rgba(255,255,255,0.03);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                    <span style="font-size:1rem;font-weight:800;color:rgba(255,255,255,0.9);">1.200 €</span>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.5);">de 2.500 €</span>
                  </div>
                  <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-bottom:6px;">
                    <div style="height:100%;width:48%;background:#f093fb;border-radius:3px;"></div>
                  </div>
                  <div style="font-size:.65rem;color:rgba(255,255,255,0.5);">48% • Faltan 6 meses</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'cta':
        return `
          <div class="ob-visual-preview">
            <div class="ob-preview-header">
              <div class="ob-preview-dot" style="background:#F43F5E"></div>
              <div class="ob-preview-dot" style="background:#F59E0B"></div>
              <div class="ob-preview-dot" style="background:#10B981"></div>
              <div class="ob-preview-title-bar"></div>
            </div>
            <div class="ob-preview-body" style="display:flex;flex-direction:column;gap:10px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">100 gratis</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">Sin tarjeta</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">Privado</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">Offline</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">Cloud sync</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.15);border-radius:10px;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#00D4AA;display:flex;align-items:center;justify-content:center;color:white;font-size:.65rem;font-weight:800;flex-shrink:0;">✓</div>
                  <div style="font-size:.7rem;font-weight:600;color:rgba(255,255,255,0.8);">Premium</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:rgba(0,212,170,0.12);border:1px solid rgba(0,212,170,0.2);border-radius:12px;margin-top:4px;">
                <div style="font-size:1.4rem;">🎉</div>
                <div style="font-size:.75rem;font-weight:700;color:#00D4AA;">Empieza en menos de 2 minutos</div>
              </div>
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
