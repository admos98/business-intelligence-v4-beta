# Copilot Instructions for Business Intelligence App

## Project Overview

**Business Intelligence for Mehrnoosh's Cafe** — A React + Vite frontend connected to Vercel Serverless Functions, using a private GitHub Gist as the database. The app manages cafe purchasing, tracks inflation, analyzes spending patterns, and provides AI-powered insights via Google Gemini API.

## Architecture

### Frontend (React/TypeScript/Vite)
- **State Management**: Zustand (`src/store/useShoppingStore.ts`) — single, large store managing auth, lists, vendors, items, and computed data
- **Deployment**: Vercel
- **Styling**: Tailwind CSS + PostCSS
- **Key Patterns**: Debounced auto-save to cloud, computed selectors for complex analytics (inflation, suggestions, summaries)

### Backend (Vercel Serverless)
- **API Endpoints**: `/api/data` (GET/PATCH), `/api/gemini` (AI features)
- **Database**: Private GitHub Gist (simple JSON file) — accessed via GitHub API using `GITHUB_TOKEN` and `GIST_ID`
- **External APIs**: Google Gemini for OCR receipt scanning and AI analysis

### Key Data Flow
1. **Frontend** → Zustand store (local state + computed selectors)
2. **Debounced Save** (1.5s) → `/api/data` PATCH endpoint
3. **Backend** → Validates payload → Updates GitHub Gist file
4. **Initial Hydration** → On login, fetch data from `/api/data` GET endpoint

## Critical Developer Workflows

### Local Development
```bash
npm install
vercel env pull .env.development.local  # Downloads env vars
vercel dev                              # Runs dev server + local Vercel Functions
```
- Dev server runs on `http://localhost:3000`
- Vercel CLI simulates serverless functions locally

### Building & Deploying
```bash
npm run build    # Vite builds to /dist
npm run preview  # Preview production build locally
```
- Push to GitHub → Vercel auto-deploys
- Environment variables set in Vercel dashboard (not `.env` files in production)

### Environment Variables (Required in Vercel)
- `GITHUB_TOKEN`: GitHub Personal Access Token (gist scope)
- `GIST_ID`: Private Gist ID for data storage
- `API_KEY`: Google Gemini API key

## Project-Specific Conventions

### State Management (Zustand)
- All state in single store (`useShoppingStore`)
- **Auth Slice**: `login()`, `logout()`, `users`, `currentUser`
- **Shopping Slice**: Lists, items, vendors, categories
- **No callbacks**: Avoid passing functions as props; use store directly
- **Debounced saves**: `debouncedSaveData(get())` on mutations (prevents 100+ saves/sec during edits)
- **Computed selectors**: Methods like `getSmartSuggestions()`, `getSummaryData()`, `getInflationData()` — avoid storing computed data

Example:
```typescript
// ✅ Do this
const suggestions = useShoppingStore(state => state.getSmartSuggestions());

// ❌ Don't store suggestions in state directly
```

### Component Structure
- **Pages**: Full-page views in `src/pages/` (Dashboard, ShoppingView, AnalysisDashboard, etc.)
- **Modals**: Dialog components in `src/components/modals/` (BuyItemModal, NewListModal, etc.)
- **Common**: Reusable components in `src/components/common/` (Card, Toast, ThemeToggleButton, SafeSVG, ErrorBoundary)
- **Error Boundaries**: Wrap App with ErrorBoundary; SafeSVG sanitizes SVG content to prevent XSS

### Data Types (Jalali Calendar Focus)
- **Dates**: Always stored as ISO strings internally; converted to **Jalali (Persian) calendar** for display
- **Units**: Use `Unit` enum (کیلوگرم, گرم, لیتر, عدد, بسته, etc.) — Persian labels
- **Categories**: `CafeCategory` enum (لبنیات, میوه و سبزیجات, نان و شیرینی, etc.)
- **ItemStatus**: `Pending` | `Bought`
- **PaymentStatus**: `Paid` | `Due`

Use `toJalaliDateString()` and `parseJalaliDate()` from `shared/jalali.ts` for conversions.

### API Pattern
- **Frontend**: `fetchData()` and `saveData()` in `src/lib/api.ts` — 30-second timeouts, proper error types
- **Backend**: `api/data.ts` validates input with `isValidStoredData()` before mutating GitHub Gist
- **Error Handling**: Always use `error instanceof Error` to check error types; propagate meaningful messages

### Validation & Security
- **Input Sanitization**: Use `src/utils/validation.ts` for strings, email, ranges
- **XSS Prevention**: All SVG rendered through `SafeSVG` component; avoid `dangerouslySetInnerHTML`
- **No TypeScript `any`**: All types properly defined in `shared/types.ts`
- **Logging**: Use `src/utils/logger.ts` for structured logging (dev/prod aware)

### Localization
- **Language**: Farsi (Persian) only — all strings in `shared/translations.ts`
- **Usage**: Import `t` from translations; call functions like `t.todaysShoppingList(date)`

## Essential File Map

| File | Purpose |
|------|---------|
| `src/store/useShoppingStore.ts` | Zustand store — ALL state + computed data |
| `shared/types.ts` | TypeScript interfaces (ShoppingList, ShoppingItem, Unit, etc.) |
| `shared/jalali.ts` | Jalali date utilities |
| `src/lib/api.ts` | Frontend API client (fetch/save data) |
| `api/data.ts` | Backend handler for data persistence via GitHub Gist |
| `api/gemini.ts` | Backend handler for AI features (OCR, analysis) |
| `src/App.tsx` | Main router/view switcher |
| `src/components/common/SafeSVG.tsx` | XSS-safe SVG renderer |
| `src/components/common/ErrorBoundary.tsx` | React error boundary |
| `src/utils/validation.ts` | Input validation utilities |

## Complex Patterns to Understand

### Smart Suggestions Algorithm
- Tracks purchase frequency (daily consumption rate)
- Compares estimated current stock vs. reorder buffer (3 days' worth)
- Returns prioritized suggestions: `high` (depleted) → `medium` (low stock) → `low`
- See: `getSmartSuggestions()` in store

### Inflation Tracking
- **Item-level**: Compares price/unit over time
- **Category-level**: Weighted by spending (expensive items weigh more)
- **Price Index**: Monthly baseline-relative index (100 = start, 110 = 10% inflation)
- See: `getInflationData()` in store

### Summary Data Aggregation
- Periods: `7d`, `30d`, `mtd` (month-to-date), `ytd`, `all`
- Calculates KPIs: total spend, unique items, avg daily spend, top category/vendor
- Generates chart data (spending over time, by category)
- See: `getSummaryData()` in store

## When Adding Features

1. **New data fields**: Add to `ShoppingItem` in `shared/types.ts` → update store → update `StoredData` interface in `api/data.ts`
2. **New API endpoints**: Create `api/newfeature.ts` → add to vercel deployment
3. **New computed data**: Add selector method in store (don't store as state)
4. **New UI views**: Create in `src/pages/` → import in App.tsx → add case to view router
5. **Modals**: Create in `src/components/modals/` → manage visibility in store or parent component state

## Known Gotchas

- **Debounced saves**: Don't expect immediate persistence; data syncs after 1.5s of inactivity
- **Ishydrating flag**: Set during `hydrateFromCloud()`; prevents saves while loading remote data
- **GitHub Gist format**: Gist file must be named `mehrnoosh-cafe-data.json`; backend won't find it otherwise
- **Jalali date keys**: List IDs are Jalali date strings (`1403/08/25`); don't use timestamps
- **No real-time sync**: Multi-tab users may overwrite each other's data; Gist is simple, not a real DB
