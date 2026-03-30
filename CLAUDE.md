# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                    # Dev server on port 3000 (Turbopack)
npm run build                  # Production build
npm run start                  # Run production server

# Testing
npm run test:unit              # Vitest unit tests (tests/**/*.test.ts)
npm run test:watch             # Vitest watch mode
npm run test:e2e               # Playwright E2E tests (e2e/)
npm run test:e2e:headed        # E2E with visible browser
npm run test:all               # All tests (unit + E2E)

# Code quality
npm run lint                   # ESLint
npm run lint:fix               # ESLint auto-fix
npm run typecheck              # TypeScript type checking
npm run ci                     # lint + typecheck + test:all

# Deployment
npx vercel --prod --yes        # Deploy to Vercel (Dublin region)
# SQL migrations: run manually in Supabase SQL Editor
```

## Architecture

**Next.js 16 App Router** with Supabase PostgreSQL backend, Tailwind CSS 4, deployed on Vercel.

### Route Groups
- `src/app/(auth)/` — Login/auth pages (public)
- `src/app/(dashboard)/` — All protected pages (months, goals, subscriptions, loans, debtors, forecast, settings)
- `src/middleware.ts` — Redirects unauthenticated users to `/login`

### Service Layer (`src/lib/services/`)
All database operations go through service classes. Each service takes a Supabase client in its constructor. Use the factory to create all services at once:

```typescript
import { createServices } from '@/lib/services';
const services = createServices(supabaseClient);
await services.budget.createBudget(monthId, data);
```

Services enforce business rules (overspending prevention, date range validation, etc.) with custom error classes from `src/lib/services/errors.ts`.

### Supabase Clients
- `src/lib/supabase/client.ts` — Browser client (Client Components)
- `src/lib/supabase/server.ts` — Server client (Server Components, API routes)
- `src/lib/supabase/database.types.ts` — Auto-generated TypeScript types from database schema

### Database
- RLS enabled on all tables — every query is scoped to the authenticated user
- Triggers auto-calculate computed fields (goal balances, budget summaries)
- Schema: `supabase/schema.sql`, migrations: `supabase/migrations/`
- Key view: `budget_summary` uses `to_budget_id`/`from_budget_id` for transfer impact

### Components
- `src/components/ui/` — Custom UI components (Button, Card, Input, Dialog, Toast, etc.)
- `src/components/layout/` — Navigation, EnvironmentBadge
- Design system uses CSS variables in `src/globals.css` (terracotta primary, sage accent, warm cream surface)

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig.json)

## Critical Business Rules

**Goal balance**: `current_amount = base_amount + contributions - transfers_out`. Three database triggers maintain this — they must all use the same formula.

**Transfers table** is the single source of truth for goal drawdowns. Use `goal_to_budget` transfer type with a DrawDown budget category (not the legacy `goal_drawdowns` table).

**Select components**: HTML `<select>` shows first option but `onChange` doesn't fire until user changes selection. Always auto-select the first option in a `useEffect` when loading dynamic data.

**Payment methods**: Bank columns are TEXT (migrated from enum). Use raw settings values for dropdowns and store them as-is. `validateBankType()` just trims the value — no mapping.

## Currency

User-configurable currency. Access via `useCurrency()` hook (client) or `getUserCurrency()` (server).

## Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_ENV`
Optional: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
