# Family Money Tracker

A Next.js web application for tracking family income, expenses, and budgets month by month. Built with Supabase backend and a custom design system.

## Features

- 📅 **Monthly Budget Tracking**: Create monthly budget periods with automatic default categories
- 💰 **Income Management**: Track income sources with automatic tithe (10%) and offering (5%) calculations
- 💸 **Expense Tracking**: Record expenses by category with overspending prevention
- 📊 **Budget Categories**: 13 default categories including Tithe, Offering, Housing, Food, and more
- 🔒 **Business Rules**: Enforced at both service layer and database level
  - Auto-create 12 default budget categories when month is created
  - Expense date must be within month range
  - Prevent overspending (no negative "amount left")
- 🧪 **Automated Testing**: E2E tests (Playwright) and unit tests (Vitest)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS with custom design system
- **Testing**: Playwright (E2E), Vitest (Unit)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account and project

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Environment
NEXT_PUBLIC_APP_ENV=development

# Sentry (optional, for error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=money-app
```

### Database Setup

1. Create a Supabase project
2. Run the schema:
   ```bash
   # Copy contents of supabase/schema.sql
   # Paste into Supabase SQL Editor and execute
   ```
3. Run migrations:
   ```bash
   # Copy contents of supabase/migrations/001_business_rules_constraints.sql
   # Paste into Supabase SQL Editor and execute
   ```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm run test:unit      # Unit tests
npm run test:e2e       # E2E tests
npm run test:all       # All tests

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Documentation

- [Production Prerequisites](./docs/production-prerequisites.md) - **START HERE** - Verify Supabase, environments, and Git setup
- [Deployment Guide](./docs/deployment.md) - Deploy to Vercel with staging/production
- [Backups & Restore](./docs/backups-restore.md) - Set up backups and restore procedures
- [Monitoring & Error Tracking](./docs/monitoring.md) - Sentry setup and error tracking
- [Production Hardening](./docs/production-hardening.md) - Complete production readiness checklist
- [Next.js Production Checklist](./docs/nextjs-production-checklist.md) - Next.js-specific optimizations
- [Uptime Monitoring](./docs/uptime-monitoring.md) - Set up external uptime monitoring

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/
│   │   ├── services/     # Business logic layer
│   │   └── supabase/     # Supabase client & types
│   └── middleware.ts     # Auth middleware
├── supabase/
│   ├── schema.sql        # Database schema
│   └── migrations/       # Database migrations
├── tests/                # Unit tests
├── e2e/                  # E2E tests
└── scripts/              # Utility scripts
```

## Key Business Rules

1. **Auto-create Budgets**: When a month is created, 13 default budget categories are automatically created
2. **Expense Date Validation**: Expenses must have dates within the month's date range
3. **Overspending Prevention**: Expenses cannot exceed the budget amount (no negative "amount left")

These rules are enforced at:
- **Service Layer**: TypeScript services with custom error classes
- **Database Layer**: PostgreSQL triggers and CHECK constraints

## Testing

### Unit Tests

```bash
npm run test:unit
```

Tests cover:
- Business rule validations
- Service layer logic
- Error handling

### E2E Tests

```bash
npm run test:e2e
npm run test:e2e:ui      # With Playwright UI
npm run test:e2e:headed  # With browser visible
```

Tests cover:
- Critical user flows
- Month creation → budget auto-creation
- Income and expense creation
- Overspending prevention

## Deployment

See [Deployment Guide](./docs/deployment.md) for detailed instructions.

Quick summary:
1. Push code to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy!

## Backups

**⚠️ Important**: Set up backups before using with real money!

See [Backups & Restore Guide](./docs/backups-restore.md) for:
- Enabling scheduled backups
- Point-In-Time Recovery (PITR) setup
- Restore drill procedures
- Backup verification

Quick start:
```bash
# Verify production prerequisites (START HERE)
./scripts/verify-prerequisites.sh

# Run complete production checklist
./scripts/production-checklist.sh

# Or run individual checks
./scripts/verify-rls.sh          # Verify Row Level Security
./scripts/verify-backups.sh      # Verify backup configuration
./scripts/verify-env-vars.sh     # Verify environment variables
```

## License

Private project - All rights reserved
