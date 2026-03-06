# CLAUDE.md

This is a Next.js 16 (App Router) family money tracking app with a Supabase (PostgreSQL) backend, Tailwind CSS v4, and Sentry error tracking. Deployed on Vercel.

## Quick Reference

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint check
npm run lint:fix         # ESLint autofix
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm run test:unit        # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
npm run ci               # Full CI: lint + typecheck + all tests
```

## Project Structure

- `src/app/` - Next.js App Router pages. Route groups: `(auth)` for login, `(dashboard)` for authenticated pages.
- `src/lib/services/` - Business logic layer (service pattern)
- `src/lib/supabase/` - Supabase client setup and generated types
- `src/lib/validation/` - Validation logic
- `src/lib/hooks/` - Custom React hooks
- `src/lib/utils/` - Utility functions
- `src/lib/config/` - App configuration
- `src/components/` - Shared React components (`ui/`, `layout/`, `filters/`, `search/`)
- `supabase/schema.sql` - Database schema
- `supabase/migrations/` - SQL migrations (run manually via Supabase SQL Editor)
- `tests/` - Vitest unit tests
- `e2e/` - Playwright E2E tests
- `scripts/` - Utility scripts (subscription import, test data seeding)

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Key Architecture Decisions

- **Server Actions** in `src/app/actions/index.ts` for mutations
- **Service layer** (`src/lib/services/`) enforces business rules in TypeScript
- **Database constraints** also enforce rules (triggers, CHECK constraints, RLS)
- **Business rules**: auto-create 13 default budget categories on month creation; expenses must fall within month date range; no overspending allowed
- **Auth**: Supabase Auth with middleware-based route protection (`src/middleware.ts`)
- **AI features**: API routes under `src/app/api/ai/` using Anthropic and OpenAI SDKs via Vercel AI SDK

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_APP_ENV` - `development`, `preview`, or `production`

Optional:
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` - Sentry error tracking

## Code Style

- TypeScript strict mode enabled
- ESLint with next/core-web-vitals and next/typescript configs
- `@typescript-eslint/no-explicit-any` is warn (not error)
- Unused vars with `_` prefix are allowed
- Tailwind CSS v4 for styling

## Testing

- **Unit tests** (Vitest + Testing Library): cover service layer logic, business rules, validation
- **E2E tests** (Playwright): cover critical user flows (month creation, income/expense CRUD, overspending prevention)
- E2E tests are currently disabled in CI (need test data seeding)
- Unit tests and lint run in CI with `continue-on-error: true`

## Database

- Supabase PostgreSQL with Row Level Security (RLS) enabled
- Migrations are applied manually via the Supabase SQL Editor
- Key tables: months, budgets, expenses, incomes, subscriptions, goals, loans, transfers, master_budgets
