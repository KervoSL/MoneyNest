# CLAUDE_CONTEXT.md
> MoneyNest · KervoSL · Last updated: 2026-09-23
> Single source of truth for Claude Code. Read this file before touching any code.

---

## QUICK REFERENCE

| Item | Value |
|---|---|
| Repo | https://github.com/KervoSL/MoneyNest |
| Deploy | Vercel (auto-deploy from `main`) |
| Type | PWA · Vanilla JS · Local-first |
| Auth | Supabase |
| Payments | Stripe |
| Storage | `localStorage` key: `mn7_data` · Global state: `S` |
| Last commit | `dc7d992` (fix: demo auto-activation) · **New uncommitted:** Feature Showcase (2026-09-24) |

---

## CLAUDE CODE OPERATING SYSTEM

Rules that apply to every session. No exceptions.

**ALWAYS**
- Read this file before opening any code file.
- Open only the minimum files required for the active task.
- Find the real root cause before modifying anything.
- Verify only what you changed.
- Stop completely when the task is done.
- Report: files modified · changes made · how it was verified · out-of-scope issues noted (not fixed).

**NEVER**
- Audit the whole application.
- Refactor code outside the task scope.
- Modify pricing or billing configuration unless the task explicitly requires it.
- Touch stable features to "improve" them.
- Fix bugs not related to the active task.
- Rewrite the architecture.
- Change the visual design outside the task scope.

**RESPONSE FORMAT** (mandatory after each task)
```
## Done
- Files modified: [list]
- Changes: [what changed and why]
- Verified: [how you tested it]
- Out of scope (not touched): [list]
```

---

## 1. PROJECT OVERVIEW

**MoneyNest** is a premium personal finance PWA targeting users who want a local-first, Apple-quality experience with optional cloud sync.

- **Problem solved:** Most finance apps are either too complex, require cloud accounts from day one, or look and feel generic. MoneyNest is fast, private-by-default, and premium.
- **Philosophy:** Local-first. Works fully offline. Supabase adds sync. Stripe adds premium.
- **Design inspiration:** Apple · Linear · Stripe · Notion. No "AI-generated" look.
- **Status:** Production. Vercel deployment live. Stripe purchase flow verified end-to-end.

**Company:** KERVO (GitHub: KervoSL) — also runs TradeVault and Axiora.

---

## 2. CURRENT STATE

### ✅ Working
- Authentication (register + login)
- Full Stripe purchase flow (verified end-to-end)
- PWA (manifest + service worker)
- LocalStorage sync
- Dashboard
- Net Worth
- Income & Expenses (Transactions)
- Accounts
- Budgets
- Investments
- Debts (including snowball / avalanche / custom strategy)
- Automatic category detection for imported bank transactions
- CSV/bank importer (integrated into financial engine)
- Categories management (unified modal)
- Multi-delete correction for income/expense (partially — see bugs)
- Consecutive transaction entry flow
- Centro de Revisión
- Financial Calendar
- Net Worth enhanced comparison view
- Custom debt strategy activation
- Decimal input with comma (,) and period (.) support

### 🟡 Partially Implemented
- None currently - all major features are either complete or not started

### ❌ Broken / Known Bugs
- Multi-delete for income/expense may still have edge cases (see section 29)
- Mobile navigation / sidebar — historical issues, partially addressed
- Responsive charts — overflow and label clipping on mobile

### ⏳ Pending
- Full mobile responsive pass (dashboard, transactions, accounts, settings)
- Full chart responsive pass (labels, legends, canvas sizing)
- CSV import UI polish (duplicate detection UX)
- End-to-end production QA

---

## 3. PRODUCT VISION

- Premium, not generic. Every UI detail matters.
- Local-first: no account required to use the app. Cloud is additive.
- Mobile + desktop parity — must feel native on both.
- Speed: entering 50 transactions in a row must be fast.
- No friction: onboarding → showcase → empty state → first action must flow naturally.
- Trial: 100 movements free, then payment wall.

**Non-negotiables (never change without explicit user request):**
- Soft borders, clean spacing, sidebar elegance, consistent modals.
- Local storage as fallback always works.
- Trial limit at 100 movements.
- Design language: Apple/Linear/Stripe aesthetic.

---

## 4. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | HTML · CSS · Vanilla JavaScript |
| Backend | Supabase (auth + sync) |
| Payments | Stripe (Checkout) |
| Hosting | Vercel |
| PWA | manifest.json + sw.js |
| State | Global `S` object |
| Persistence | `localStorage` (`mn7_data`) + Supabase (cloud sync) |
| i18n | Custom i18n system + `i18n-patch.js` |
| Imports | CSV / XLSX bank import |
| Exports | CSV · Excel · PDF (planned) |

No frameworks. No bundlers required for core app logic. Pure browser environment.

---

## 5. ARCHITECTURE

```
User action
    ↓
S (global state object)
    ↓
render() / updateUI()
    ↓
localStorage.setItem('mn7_data', JSON.stringify(S))
    ↓ (async, when logged in)
Supabase sync
```

**State object `S`:** Single global object holding all app data. Every financial calculation reads from `S`. Every save writes to both `localStorage` and Supabase (when authenticated).

**Auth modes:**
- **Local mode:** No account. Full app with trial limit. Data in `localStorage` only.
- **Cloud mode:** Supabase account. Sync across devices. Stripe for premium.

**Onboarding flow (intended):**
1. First visit → Feature Showcase (5 screens, no data)
2. Showcase → Onboarding (name, accounts, categories)
3. Onboarding complete → Free trial starts (100 movement limit)
4. Trial exhausted → Paywall modal → Stripe checkout

**checkOnboarding():** Central function that decides which screen to show on load. Called on app init.

---

## 6. REPOSITORY STRUCTURE

```
MoneyNest/
├── moneynest_premium/
│   ├── index.html               # App entry point
│   ├── css/
│   │   ├── main.css             # Core styles
│   │   ├── feature-showcase.css # Showcase screens (NEW — active task)
│   │   └── [other css files]
│   ├── js/
│   │   ├── app.js               # Core app logic, state (S), init
│   │   ├── auth.js              # Supabase auth
│   │   ├── billing.js           # Stripe + plan logic
│   │   ├── i18n.js              # Translations
│   │   ├── i18n-patch.js        # Translation overrides (CAUTION: loads after i18n.js, can override keys)
│   │   ├── onboarding.js        # Onboarding flow
│   │   ├── feature-showcase.js  # Feature showcase before onboarding (NEW — active task)
│   │   ├── transactions.js      # Income/expenses logic
│   │   ├── accounts.js          # Accounts
│   │   ├── budgets.js           # Budgets
│   │   ├── investments.js       # Investments
│   │   ├── debts.js             # Debts + strategies
│   │   ├── networth.js          # Net worth + assets
│   │   ├── categories.js        # Category management
│   │   ├── importer.js          # CSV/XLSX bank importer
│   │   ├── calendar.js          # Financial calendar
│   │   ├── review-center.js     # Centro de Revisión
│   │   ├── analytics.js         # Charts + analytics
│   │   └── [other js files]
│   ├── components/              # Reusable UI components
│   ├── assets/                  # Images, icons
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker
├── supabase/
│   ├── migrations/              # DB migrations
│   └── functions/               # Edge functions (Stripe webhook etc.)
├── package.json
└── vercel.json
```

**Key files to know:**
- `i18n-patch.js` — loads AFTER `i18n.js`. Any key defined here overrides the main dictionary. Source of the "Este mes" bug (now fixed). Be careful adding keys here.
- `feature-showcase.js` + `feature-showcase.css` — the current active task files.
- `checkOnboarding()` in `onboarding.js` — controls the entire first-run flow.

---

## 7. DATA MODEL

### Global State Object `S`

All app data lives here. Persisted to `localStorage` as `mn7_data`.

```js
S = {
  user: { name, email, currency, locale },
  accounts: [ { id, name, type, balance, color, icon } ],
  transactions: [ { id, date, amount, type, category, account, note, imported } ],
  budgets: [ { id, category, amount, period } ],
  investments: [ { id, name, type, amount, currentValue, date } ],
  assets: [ { id, name, type, purchasePrice, currentValue, salePrice, soldDate } ],
  debts: [ { id, name, amount, rate, minPayment, type } ],
  debtStrategy: { type: 'snowball'|'avalanche'|'custom', customOrder: [] },
  categories: { income: [], expense: [] },
  goals: [ { id, name, target, current, deadline } ],
  settings: { ... },
  onboarding: { completed: bool, step: number },
  showcase: { completed: bool },  // feature showcase state
  subscription: { plan: 'free'|'premium', status, stripeCustomerId }
}
```

### Supabase Tables (known)

| Table | Purpose |
|---|---|
| `users` | Auth users (Supabase Auth) |
| `profiles` | User profile data |
| `data_sync` | Serialized `S` for cloud sync |
| `subscriptions` | Stripe subscription status |

**RLS:** All tables have Row Level Security. Users can only access their own data.

**Important:** `session_id` column was missing from the devices table — this caused the device limit feature to crash. Fixed in commit `d0d8191`.

---

## 8. AUTHENTICATION

| Mode | Description |
|---|---|
| Local | No account. Full app up to trial limit. |
| Register | Supabase email + password. Creates profile. |
| Login | Supabase auth. Loads cloud data, merges with local. |
| Logout | Clears cloud session. Local data preserved. |

**Device limit:** Implemented via Supabase. The `session_id` column issue was fixed.

**Onboarding behavior:** When the auth form detects an existing email, it auto-switches to login mode. This means a returning user skips the "create account" onboarding steps — this is intentional.

---

## 9. SUPABASE

### Configuration
- Project URL: [REDACTED]
- Anon key: [REDACTED]
- Service role: [REDACTED] (only in edge functions)

### Edge Functions
- Stripe webhook handler (deployed in `supabase/functions/`)
- Promo code validator (was not deployed → fixed in d0d8191, now deployed)

### Known Issues Fixed
- `session_id` column missing → fixed
- Promo code function not deployed → fixed and deployed

### RLS Policies
- All tables: `auth.uid() = user_id` policy on SELECT, INSERT, UPDATE, DELETE
- No public read access

---

## 10. STRIPE & BILLING

### Plans

| Plan | Price | Features |
|---|---|---|
| Free / Trial | €0 | 100 movements max |
| Premium | [REDACTED] | Unlimited movements, sync, all features |

**Trial logic:** Movement count checked on every add. At 100, paywall modal shown.

### Stripe Flow
1. User hits trial limit → `showPaywallModal()` opens
2. User selects plan → `createCheckoutSession()` called
3. Stripe Checkout opens in new tab/window
4. Webhook confirms payment → Supabase `subscriptions` updated
5. App reads subscription status on next load

**Bug fixed:** Button stuck on "⌛ Abriendo pago…" — the checkout session creation was not completing. Fixed.

**Promo codes:** Enabled in checkout. Backend function was not deployed (fixed).

**Payment modal scroll lock:** Was locking body scroll after close. Fixed.

### Entitlements
- Checked via `S.subscription.status === 'active'`
- Local cache of subscription status for offline use

---

## 11. FEATURES — IMPLEMENTED

### Dashboard
- Overview cards: balance, income, expenses, net worth
- Recent transactions
- Budget progress bars
- Charts (line/bar)
- Status: ✅ functional, 🟡 responsive issues on mobile

### Transactions (Income & Expenses)
- Add / edit / delete
- Category assignment
- Account assignment
- Multi-select + bulk delete (fixed — may have edge cases)
- Fast consecutive entry (modal stays open, fields reset)
- Import from CSV
- Status: ✅ mostly stable

### Accounts
- Add / edit / delete
- Types: checking, savings, credit, cash, investment
- Balance tracking
- Status: ✅ stable

### Budgets
- Monthly budgets by category
- Progress tracking
- Alerts at threshold
- Status: ✅ stable

### Investments
- Portfolio tracking
- Return calculation
- Status: ✅ stable

### Net Worth
- Automatic calculation from accounts + assets − debts
- Assets with purchase price, current value, and **sale price** (when sold)
- **Asset sale price fix:** Was using last valuation instead of actual sale price → fixed
- Visual redesign of asset cards (parity with Goals section)
- Enhanced comparison view (month-over-month, explanation)
- Status: ✅ stable

### Debts
- Snowball strategy
- Avalanche strategy
- Custom strategy (user-defined order)
- **Custom strategy activation fix:** User-created strategy couldn't be activated like built-in ones → fixed
- Debt assistant
- Status: ✅ stable

### Categories
- Income + expense categories
- **Unified modal:** All category creation across the app uses the same modal component
- Automatic detection for imported transactions (fuzzy matching)
- Status: ✅ stable

### CSV/Bank Importer
- File selector (CSV, XLSX)
- Parser
- Bank detection
- Column mapping
- Account assignment
- Category assignment (with auto-detection)
- Preview before import
- Duplicate detection
- **Integration with financial engine:** Imported data fully affects all calculations
- First-import CTA
- Status: ✅ functional

### Onboarding
- Multi-step: name → accounts → categories → tutorial
- `checkOnboarding()` controls the first-run flow
- Feature showcase runs BEFORE onboarding (✅ completed 2026-09-24)
- Status: ✅ stable

### Centro de Revisión
- Review panel for flagged/unreviewed transactions
- Status: ✅ implemented

### Financial Calendar
- Monthly view of financial events
- Income/expense on calendar
- Status: ✅ implemented

### Settings
- Profile
- Currency / locale
- Categories
- PWA install option (manual — auto-prompt was removed)
- PIN lock configuration
- Status: ✅ stable

### Wizards (Guided Creation Flows)
- **Transaction Wizard:** 3-step guided flow for income/expenses with smart defaults
- **Investment Wizard:** 4-step flow for adding investments with portfolio context
- **Debt Wizard:** 4-step flow for debt creation with strategy recommendations
- Status: ✅ implemented

### Security
- **PIN Lock:** Optional PIN protection for app access (available in Local and Pro plans)
- Lock screen with PIN entry
- Configurable in Settings
- Status: ✅ implemented

### Export & Backup
- **PDF Export:** Complete financial report with all sections
- **Excel Export:** Multi-sheet workbook (transactions, investments, debts, goals, budgets)
- **JSON Export:** Full backup for restoration
- **Section Exports:** Individual CSV exports per section
- Status: ✅ fully functional

### Enterprise Features (Optional Mode)
- **Clients Management:** Track income sources with avatar, company, color coding
- **Suppliers Management:** Track expense providers
- **Devengos (Accrual):** Track income/expenses by accrual date vs payment date
- Tax configuration (VAT, IRPF)
- Status: ✅ implemented (enterprise mode optional)

### Budgets - Extended
- Monthly / Quarterly / Annual periods
- Expense budgets (traditional)
- **Investment budgets:** Track monthly investment targets per category
- Progress tracking with alerts
- Status: ✅ stable

---

## 12. FEATURE SHOWCASE — ✅ COMPLETED

**Goal:** 5 screens shown to new users BEFORE onboarding. Explains the app visually without data.

**Order:**
1. Feature Showcase (5 screens, CSS mockups of real UI)
2. Onboarding (name, accounts, categories)
3. Free trial begins

**Files:**
- `js/feature-showcase.js` — Fully implemented with 5 screens and navigation
- `css/feature-showcase.css` — Complete with mobile responsive design (768px, 480px, 375px breakpoints)

**Integration:** Integrated into `checkOnboarding()` in `app.js` (not onboarding.js)

**State flag:** `localStorage` key `mn_showcase_seen` (set to `'true'` when completed)

**Status:** ✅ Complete as of 2026-09-24

**How it works:**
1. New user (no `mn_showcase_seen` flag) → `checkOnboarding()` calls `showFeatureShowcase()`
2. 5 screens shown with visual mockups: Net Worth, Bank Importer, Investments, Goals, CTA
3. User navigates with next/back buttons or keyboard (arrows, Enter, Escape)
4. Final screen "Comenzar 🚀" button calls `showcaseComplete()`
5. Flag set in localStorage → showcase closes → `checkOnboarding()` called again
6. Normal onboarding flow starts
7. Returning user → flag exists → showcase skipped entirely

**Acceptance criteria:** All met
1. ✅ New user sees showcase first
2. ✅ 5 screens with next/back navigation
3. ✅ Final screen has CTA to start onboarding
4. ✅ After showcase, normal onboarding runs
5. ✅ Returning user skips showcase
6. ✅ Mobile responsive design implemented

---

## 13. BUGS — FIXED

| Bug | Symptom | Cause | Fix | Commit |
|---|---|---|---|---|
| "Este mes" lowercase | Button label in wrong case | `i18n-patch.js` loaded after main i18n and overrode the key with lowercase value | Corrected key in `i18n-patch.js` | d0d8191 |
| Modal scroll lock | App appeared frozen after onboarding | PWA install modal auto-fired 15s after onboarding ended, covering screen | Removed auto-trigger (install option moved to Settings) + fixed 2 other modals not releasing scroll | d0d8191 |
| Promo code never worked | Promo code field had no effect | Edge function not deployed | Deployed the function | d0d8191 |
| Device limit crash | Error on device limit check | `session_id` column missing in DB | Added column via migration | d0d8191 |
| Stripe button stuck | "⌛ Abriendo pago…" stayed forever | Checkout session call not completing | Fixed checkout session creation | — |
| Demo auto-activation | Trial limit hit immediately for new users | Old code loaded 200+ demo transactions on first open, instantly exceeding 100-movement trial | Removed auto-demo activation | dc7d992 |
| Asset sale price wrong | Net worth wrong after selling asset | Code used last valuation value instead of actual sale price | Fixed to use `salePrice` field | — |
| Custom debt strategy | Couldn't activate user-created strategy | Activation code only handled built-in strategy types | Fixed to handle custom strategies | — |
| Payment modal scroll | Body scroll locked after closing plan modal | Modal close didn't restore `overflow` | Fixed scroll restoration | — |
| Stripe checkout stuck | Button permanently in loading state | Session creation failing silently | Fixed error handling + session creation | — |
| Multi-delete broken | Selecting transactions + delete had no effect | Event handler bug | Fixed (may have edge cases remaining) | — |
| Category detection strict | "McDonald's, Barcelona" not matched | Exact match only | Upgraded to fuzzy/partial matching | — |
| Decimals with comma | Amount field rejected comma as decimal | Input only accepted period | Fixed to accept both `,` and `.` | — |

---

## 14. BUGS — KNOWN (OPEN)

| Bug | Symptom | Status |
|---|---|---|
| Multi-delete edge cases | Bulk deletion may fail in some scenarios | Not fully verified |
| Mobile sidebar | Hamburger / overlay / z-index issues on some devices | Historical, partially addressed |
| Charts mobile | Labels clipped, legends overflow, canvas sizing | Pending responsive pass |
| Dashboard mobile | Some cards overflow on small screens | Pending responsive pass |
| iOS Safari safe-area | Some elements may not respect safe-area insets | Not verified |

---

## 15. UI/UX SYSTEM

**Color palette:** Dark mode primary. CSS variables throughout.
**Typography:** System fonts + custom weights.
**Spacing:** 4px base grid. Clean, airy.
**Sidebar:** Collapsible. Mobile: hamburger → overlay.
**Modals:** Consistent animation, consistent close behavior, scroll restored on close.
**Cards:** Rounded corners, subtle shadows.
**Forms:** Inline validation, smooth transitions.
**Charts:** Chart.js or custom canvas. Must be responsive.

**Do not:**
- Use heavy drop shadows.
- Use bright/garish colors.
- Add decorative elements not in the existing design language.
- Make forms that look like generic HTML.

---

## 16. MOBILE & RESPONSIVE

**Known historical issues:**
- Sidebar z-index conflicts with modals
- `pointer-events: none` accidentally applied to interactive elements
- `overflow: hidden` on body not restored after modal close
- `safe-area-inset` not applied to bottom nav
- iOS Safari: 100vh includes address bar, use `dvh` or JS height
- Android Chrome: slightly different scroll behavior

**Hamburger menu:** Opens sidebar as overlay. Tap outside closes it.
**Overlay pattern:** Dark semi-transparent overlay → closes sidebar on tap.
**Scroll lock pattern:** When modal opens: `document.body.style.overflow = 'hidden'`. When modal closes: restore it.

---

## 17. ONBOARDING SYSTEM

```
checkOnboarding()
    ↓
S.showcase?.completed?
    No → showFeatureShowcase()    ← PENDING INTEGRATION
    Yes ↓
S.onboarding?.completed?
    No → showOnboardingFlow()
    Yes ↓
Normal app load
```

**Feature Showcase:** 5 screens. Navigation: next/back buttons. Completion sets `S.showcase.completed = true`.

**Onboarding steps:**
1. Welcome + name
2. First account creation
3. First category setup
4. Brief tutorial overlay

**After onboarding:** Trial starts. Movement count = 0. Limit = 100.

---

## 18. CSV/XLSX IMPORT

**Flow:**
1. User selects file (CSV or XLSX)
2. Parser detects bank format (column structure)
3. Column mapping (date, description, amount, type)
4. Category auto-detection (fuzzy matching by description)
5. Account assignment
6. Preview table with assign/skip per row
7. Duplicate detection (same date + amount + description)
8. Import confirmation
9. Summary (imported N, skipped M)
10. Financial engine recalculates everything

**Category auto-detection:** Fuzzy/partial match. "McDonald's, Barcelona" matches "McDonald's" rule. Uses `includes()` + normalized string comparison.

**First-import CTA:** Shown when transactions list is empty.

---

## 19. CATEGORIES SYSTEM

**Architecture:** Single unified modal for creating categories everywhere in the app.

**Category types:** Income / Expense

**Storage:** `S.categories.income[]` and `S.categories.expense[]`

**Auto-detection rules:** Stored as { keyword, category } pairs. Checked on import.

**Category modal:** Triggered from: Transactions add, Budget add, Import mapping, Category settings. Always the same modal (`openCategoryModal()`).

---

## 20. DEBTS MODULE

**Strategies:**
- `snowball` — lowest balance first
- `avalanche` — highest rate first
- `custom` — user-defined order (drag or manual order)

**Custom strategy activation:** Fixed — was not activatable like built-in ones.

**Debt assistant:** Suggestions for payment optimization.

**Fields per debt:** name, amount, interest rate, minimum payment, type (mortgage, loan, credit card, etc.)

---

## 21. GIT & DEPLOY

**Repository:** https://github.com/KervoSL/MoneyNest
**Branch:** `main` (deploys to Vercel automatically)
**Vercel:** Auto-deploy on push to `main`

**Push with token (temporary, do not store in repo):**
```bash
git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f' push origin main
```

**Important commits:**
| Hash | Description |
|---|---|
| `dc7d992` | Fix: removed demo auto-activation on first visit (v1.21.1) |
| `d0d8191` | Fix: i18n "Este mes", modal scroll locks, session_id, promo code |

---

## 22. SECURITY

- **RLS:** Every Supabase table has Row Level Security. `auth.uid() = user_id` on all policies.
- **No secrets in repo.** All secrets via environment variables.
- **Stripe webhook:** Verified with signature header. Handled in edge function.
- **Local data:** No encryption of `localStorage` (known limitation, acceptable for v1).

**Environment variables (never in code):**
```
SUPABASE_URL=[REDACTED]
SUPABASE_ANON_KEY=[REDACTED]
STRIPE_PUBLISHABLE_KEY=[REDACTED]
STRIPE_SECRET_KEY=[REDACTED]
STRIPE_WEBHOOK_SECRET=[REDACTED]
```

---

## 23. IMPORTANT DECISIONS

1. **No frameworks.** Vanilla JS only. No React, Vue, or bundlers. Decision is final.
2. **Local-first.** App always works without Supabase. Cloud is additive.
3. **Global state `S`.** All data in one object. No Redux, no context API.
4. **Single category modal.** All category creation in the entire app uses one unified modal.
5. **Trial = 100 movements.** Not configurable by users.
6. **Feature showcase before onboarding.** Order: showcase → onboarding → app.
7. **No auto-PWA install prompt.** User installs manually from Settings.
8. **No demo mode auto-activation.** First visit = empty state = real onboarding.
9. **Promo codes enabled** in Stripe checkout.
10. **Asset sale uses actual sale price**, not last valuation.
11. **Decimal inputs accept both `,` and `.`** as decimal separator.

---

## 24. DECISION HISTORY

| Decision | Original | Change | Final |
|---|---|---|---|
| Demo mode | Auto-activated on first visit (200+ transactions) | Caused trial limit to be hit immediately | Removed auto-activation completely |
| PWA install prompt | Auto-fired 15s after onboarding | Caused apparent app freeze | Removed auto-trigger; option in Settings |
| Category modal | Multiple different modals per section | Inconsistent UX | Unified single modal |
| i18n patch file | Loaded after main i18n for overrides | Was overriding "Este mes" with lowercase | Fixed the patch file key |

---

## 25. ROADMAP

```
[x] Authentication (register + login)
[x] Dashboard
[x] Transactions (income + expenses)
[x] Accounts
[x] Budgets
[x] Investments
[x] Net Worth + Assets
[x] Debts (snowball + avalanche + custom)
[x] Categories (unified modal)
[x] CSV/XLSX importer (full flow + engine integration)
[x] Automatic category detection (fuzzy)
[x] Stripe billing (full flow)
[x] Trial limit (100 movements)
[x] Centro de Revisión
[x] Financial Calendar
[x] Net Worth enhanced comparison
[x] Multi-delete income/expense (basic fix)
[x] Fast consecutive transaction entry
[x] Decimal input fix (comma + period)
[x] Custom debt strategy activation
[x] Asset sale price fix
[x] Asset card visual redesign
[x] Feature Showcase (5 screens, CSS, integration complete - 2026-09-24)
[x] PIN lock system
[x] Transaction wizard (3-step guided flow)
[x] Investment wizard (4-step guided flow)
[x] Debt wizard (4-step guided flow)
[x] PDF export (complete report)
[x] Excel export (all sheets)
[x] Clients & Suppliers management (enterprise mode)
[x] Investment budgets (monthly/quarterly/annual)
[ ] Mobile navigation full pass (sidebar, hamburger, overlays)
[ ] Charts responsive full pass
[ ] Dashboard mobile full pass
[ ] Transactions view mobile full pass
[ ] Accounts view mobile full pass
[ ] Settings view mobile full pass
[ ] Modal scroll on mobile full pass
[ ] CSV duplicate detection UX polish
[ ] Exports: PDF, Excel
[ ] Production build + full QA
```

Legend: `[x]` done · `[~]` in progress · `[ ]` pending · `[-]` discarded

---

## 26. FEATURE SHOWCASE — ✅ COMPLETED 2026-09-24

**Status:** Fully implemented and integrated.

**What was done:**
- Created `js/feature-showcase.js` with 5 visual screens (Net Worth, Bank Importer, Investments, Goals, CTA)
- Created `css/feature-showcase.css` with complete styling and mobile responsive design
- Added files to `index.html` (CSS + JS tags)
- Integrated into `checkOnboarding()` in `app.js` — showcase now runs before onboarding for new users
- State managed via `localStorage` flag `mn_showcase_seen`
- Keyboard navigation support (arrows, Enter, Escape)
- Mobile responsive (breakpoints at 768px, 480px, 375px)

**Flow:**
1. New user (no `mn_showcase_seen` flag) → sees 5-screen showcase first
2. User completes showcase → `checkOnboarding()` called → normal onboarding starts
3. Returning user → showcase skipped entirely, goes straight to app

**Files:**
- `moneynest_premium/js/feature-showcase.js` (373 lines)
- `moneynest_premium/css/feature-showcase.css` (574 lines)
- `moneynest_premium/js/app.js` (integration in `checkOnboarding()`)
- `moneynest_premium/index.html` (links added)

**Next priority:** Mobile navigation full pass (hamburger, sidebar overlay, z-index).

---

## 27. COMMANDS

```bash
# Clone
git clone https://github.com/KervoSL/MoneyNest.git
cd MoneyNest

# Push with temporary token (NEVER store token in repo)
git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f' push origin main

# Commit
git add -A && git commit -m "fix: [description]"

# Check status
git status
git log --oneline -10
```

---

## 28. WHAT CLAUDE CODE MUST NEVER DO

1. ❌ Audit the whole application without being asked
2. ❌ Refactor files not related to the current task
3. ❌ Change pricing / billing configuration without explicit instruction
4. ❌ Add a new framework or dependency without explicit approval
5. ❌ Modify Stripe or Supabase config outside the task scope
6. ❌ Change the visual design language
7. ❌ Fix bugs unrelated to the active task (log them, don't fix them)
8. ❌ Continue working after the task is done
9. ❌ Rewrite architecture or restructure the repo
10. ❌ Store secrets or tokens in any file

---

## 29. OPEN QUESTIONS

1. **Showcase state key:** What exact key does `feature-showcase.js` use to mark completion? (`S.showcase?.completed` or similar — verify in file before assuming)
2. **Multi-delete edge cases:** Are there remaining scenarios where bulk delete fails? Needs manual QA.
3. **Mobile safe-area:** iOS bottom nav — has `env(safe-area-inset-bottom)` been applied everywhere needed?

---

## 30. PRIORITIZED TODO

```
P0 — No active critical tasks (Feature Showcase completed 2026-09-24)

P1 — Mobile (core usability)
  [ ] Mobile sidebar + hamburger full fix
  [ ] Modal scroll on mobile
  [ ] Dashboard mobile layout

P2 — Responsive polish
  [ ] Charts: labels, legends, overflow
  [ ] Transactions view mobile
  [ ] Accounts view mobile
  [ ] Settings view mobile

P3 — QA
  [ ] Multi-delete full verification
  [ ] iOS Safari safe-area audit
  [ ] End-to-end purchase flow re-verification after any billing change

P4 — Export
  [ ] PDF export
  [ ] Excel export

P5 — Production
  [ ] Full build QA
  [ ] Performance pass
  [ ] Lighthouse PWA score
```
