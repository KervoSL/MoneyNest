# VISUAL QA REPORT - MoneyNest
**Date:** 2026-09-24  
**Method:** Code-based analysis  
**Status:** 🔴 Issues found

---

## 🔴 CRITICAL ISSUES

### 1. **Z-INDEX CONFLICTS** (High Priority)
**Severity:** Critical - Can block user interaction

**Conflicts identified:**
- **PIN Lock (99999) vs Plan Modal (100000):** PIN lock can be covered by plan modal
- **Feature Showcase (9999) vs Tutorial (9999):** Same z-index - could overlap if both trigger
- **Auth Modal (9900) vs Billing Modals (10000):** Billing modals cover auth modal
- **Sidebar overlay (210) vs Bottom nav (200):** Correct but close - sidebar overlay should be higher
- **Multiple modal ranges:** Inconsistent layering - modals at 200, 600, 900, 9000+, 10000

**Impact:**
- Modals can appear behind other modals
- User cannot close certain overlays when multiple are open
- Touch/click events blocked by wrong layer

**Expected z-index hierarchy (corrected):**
```
0-99:     Background elements, canvas
100-199:  Sidebar, navigation
200-299:  Bottom nav, FABs
300-499:  Dropdowns, tooltips
500-999:  First-level modals
1000-1999: Data manager, export modals
2000-8999: (reserved)
9000-9499: Story modals, coaches
9500-9899: System modals (confirm, install prompt)
9900-9999: Authentication, onboarding, tutorial, showcase
10000+:   Billing, payment (highest priority)
99999:    PIN lock (absolute highest - emergency override)
```

---

### 2. **MOBILE SIDEBAR ISSUES**
**Severity:** High - Core navigation broken on mobile

**Issues found in code:**

a) **Sidebar positioning at 900px breakpoint:**
```css
@media(max-width:900px){
  .sidebar{
    position:fixed;left:0;top:0;bottom:0;
    transform:translateX(-100%);  /* Hidden by default */
    z-index:220;
  }
  .sidebar.open{
    transform:translateX(0);
    box-shadow:8px 0 32px rgba(0,0,0,0.6);
  }
}
```

**Potential problems:**
- No `width` set in mobile mode - inherits `--sidebar-w:240px`
- Transform animation could stutter on low-end devices
- No hardware acceleration hint (`will-change` or `translate3d`)

b) **Hamburger visibility:**
```css
.hamburger{display:none;}  /* Hidden by default */
@media(max-width:900px){ .hamburger{display:flex} }
```
✅ Correct implementation

c) **Sidebar overlay:**
```css
.sidebar-overlay{
  z-index:210;
  pointer-events:none;  /* Disabled by default */
}
.sidebar-overlay.open{
  display:block;
  pointer-events:all;  /* Enabled when open */
}
```
⚠️ **Problem:** `z-index:210` is LOWER than `.sidebar{z-index:220}` - overlay appears behind sidebar instead of in front

---

### 3. **OVERFLOW & SCROLL ISSUES**
**Severity:** Medium-High - Content clipping on mobile

**Issues found:**

a) **Body overflow on mobile:**
```css
body{overflow-x:hidden;}  /* Prevents horizontal scroll */
```
✅ Correct, but scroll lock implementation should be verified when modals/sidebar open

b) **Table overflow:**
```css
.table-wrap{overflow-x:auto;}
table{min-width:600px;}  /* Forces horizontal scroll on mobile */
@media(max-width:900px){ table{min-width:600px} }
@media(max-width:600px){ table{min-width:500px} }
```
⚠️ **Still too wide for small screens** - 500px minimum on a 375px screen = always scrolling

c) **Chart containers:**
```css
.chart-container{height:200px;}
.chart-container.tall{height:260px;}
```
❌ **No responsive height adjustments** - fixed height can cause:
- Labels cut off on mobile
- Legend overflow
- Canvas not fitting viewport

d) **Modal content:**
```css
.modal-content{
  max-height:90vh;
  overflow-y:auto;
}
@media(max-width:900px){
  .modal-content{
    max-height:100%;  /* Full screen on mobile */
  }
}
```
⚠️ Safe area not accounted for - can go under notch/home indicator

---

## 🟡 MEDIUM PRIORITY ISSUES

### 4. **RESPONSIVE BREAKPOINTS INCONSISTENCY**
**Severity:** Medium - UX degradation

**Multiple conflicting breakpoints found:**
- `@media(max-width:480px)` - 7 instances
- `@media(max-width:560px)` - 4 instances
- `@media(max-width:600px)` - 6 instances
- `@media(max-width:640px)` - 3 instances
- `@media(max-width:768px)` - 2 instances (onboarding only)
- `@media(max-width:860px)` - 1 instance
- `@media(max-width:900px)` - PRIMARY MOBILE BREAKPOINT - 20+ instances
- `@media(max-width:1100px)` - Laptop breakpoint

**Problems:**
- Too many breakpoints = hard to maintain
- No clear mobile-first strategy
- Some components break at 900px, others at 600px or 480px

**Standard breakpoints should be:**
```css
/* Mobile first */
320px - 480px:   Small phones
481px - 768px:   Large phones / small tablets
769px - 900px:   Tablets
901px - 1100px:  Small laptops
1101px+:         Desktop
```

---

### 5. **BOTTOM NAVIGATION ISSUES**
**Severity:** Medium - Navigation UX

**Current implementation:**
```css
.bottom-nav{z-index:200;}
@media(max-width:900px){
  .bottom-nav{display:flex}
  .content{padding-bottom:80px!important}  /* Makes room for bottom nav */
}
```

**Issues:**
- `z-index:200` LOWER than sidebar overlay (210) and open sidebar (220)
- When sidebar opens on mobile, bottom nav should be covered but might show through
- Toast notifications at `bottom:76px` - hardcoded to avoid bottom nav, not dynamic

---

### 6. **SAFE AREA INSETS (iOS)**
**Severity:** Medium - iOS devices

**Partial implementation found:**
```css
.bottom-nav{
  padding-bottom:calc(8px + env(safe-area-inset-bottom,0px));
}
#trialPill{
  bottom:calc(72px + env(safe-area-inset-bottom,0px));
}
```

✅ Bottom nav has safe area  
❌ **Missing safe area for:**
- Modals on mobile (bottom position)
- Quick-add sheet (bottom position)
- FAB buttons (fixed bottom position)
- Sidebar (top notch area)

---

### 7. **CHART RESPONSIVENESS**
**Severity:** Medium - Data visualization broken on mobile

**No responsive handling found for:**
- Chart.js canvas sizing
- Legend overflow
- Axis label clipping
- Responsive font sizes for chart text

**Fixed heights found:**
```css
.chart-container{height:200px;}
.chart-container.tall{height:260px;}
```

❌ **Should be responsive:**
```css
@media(max-width:900px){
  .chart-container{height:180px;}
  .chart-container.tall{height:220px;}
}
@media(max-width:480px){
  .chart-container{height:160px;}
  .chart-container.tall{height:200px;}
}
```

---

## 🟢 MINOR ISSUES

### 8. **PERFORMANCE OPTIMIZATIONS MISSING**
**Severity:** Low - Performance impact

**Missing optimizations:**
```css
.sidebar{
  transition:transform .3s ease;
  /* Should add: */
  will-change:transform;  /* Hint for hardware acceleration */
}
```

**Transform should use translate3d:**
```css
/* Current */
transform:translateX(-100%);

/* Better for performance */
transform:translate3d(-100%,0,0);
```

---

### 9. **TYPOGRAPHY SCALE ON MOBILE**
**Severity:** Low - Readability

Some text sizes don't scale down on mobile:
- `.showcase-title{font-size:1.8rem}` - Responsive in feature-showcase.css ✅
- `.page-h1` - No mobile override found ❌
- `.kpi-value` - No mobile override found ❌

---

### 10. **GRID FALLBACKS**
**Severity:** Low - Layout degradation

Multiple grids collapse to 1 column on mobile:
```css
@media(max-width:480px){
  .kpi-grid-5,.kpi-grid-4,.kpi-grid-3,.kpi-grid-2{
    grid-template-columns:1fr;
  }
}
```

✅ Good for small screens  
⚠️ **But:** No intermediate state (2 columns) for 481px-900px range

---

## 📋 TESTING CHECKLIST (Ready for Option 3)

When you test in the browser, check these specifically:

### Desktop (1920x1080)
- [ ] All modals open and close properly
- [ ] Z-index: Open multiple modals in sequence
- [ ] Charts render correctly with legends
- [ ] Sidebar stays visible
- [ ] No horizontal scroll

### Tablet (768x1024)
- [ ] Sidebar behavior at breakpoint
- [ ] Bottom nav appears/disappears correctly
- [ ] Modal sizing appropriate
- [ ] Charts fit viewport

### Mobile (375x667 - iPhone SE)
- [ ] Hamburger menu visible
- [ ] Sidebar slides in/out smoothly
- [ ] Overlay darkens background when sidebar open
- [ ] Bottom nav visible and functional
- [ ] Tables scroll horizontally
- [ ] Charts readable (labels not clipped)
- [ ] Modals full-screen
- [ ] Safe area respected (notch/home indicator)
- [ ] No content behind bottom nav

### Mobile (414x896 - iPhone 11)
- [ ] Same as iPhone SE checks
- [ ] Safe area insets working

### Z-Index Stack Test
1. [ ] Open sidebar → overlay appears
2. [ ] Open modal with sidebar open → modal on top
3. [ ] Open PIN lock → everything covered
4. [ ] Open billing modal → highest layer
5. [ ] Feature showcase on first load → blocks everything

---

## 🔧 QUICK FIXES NEEDED (Priority Order)

1. **Fix z-index hierarchy** (30 min)
2. **Fix sidebar overlay z-index** (5 min)
3. **Add safe-area-inset to all bottom elements** (15 min)
4. **Make charts responsive** (45 min)
5. **Reduce table min-width on mobile** (5 min)
6. **Add will-change to animated elements** (10 min)

**Total estimated fix time:** ~2 hours

---

## 📸 SCREENSHOTS NEEDED (Option 3)

Please capture and share:
1. Desktop - Dashboard with sidebar
2. Mobile - Hamburger menu closed
3. Mobile - Sidebar open with overlay
4. Mobile - Modal open over sidebar
5. Mobile - Bottom navigation
6. Mobile - Chart overflow issue
7. Mobile - Table horizontal scroll
8. Any visual bugs you notice

---

**Report Status:** Waiting for Option 3 (visual inspection) to complete audit.
