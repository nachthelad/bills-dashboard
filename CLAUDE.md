# CLAUDE.md — TOLVA

## Project

Finance tracker PWA built with Next.js 16, React 19, Tailwind CSS 4, Radix UI (shadcn), Firebase, and TypeScript.

## Workflow

- **Never use git worktrees.** Work directly on a new branch in the main repo.
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`
- Commit using Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, etc.
- PRs always target `main`.
- When asked to publish or push changes, use direct `git` commands only. Do not use Yeet or other publishing wrappers.

## Dev commands

```bash
npm run dev           # start dev server
npm run build         # production build
npm run lint          # ESLint
npm run test          # run tests (tsx --test tests/*.test.ts)
npm run seed:providers  # seed Firestore providers collection
```

## Stack

- **Framework:** Next.js 16 (App Router, `app/` directory)
- **Auth:** Firebase Auth + server-side cookie verification (`lib/server/require-auth.ts`)
- **Database:** Firestore via Firebase
- **Styling:** Tailwind CSS 4 + shadcn/ui components (`components/ui/`)
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **AI:** OpenAI API (document parsing via Vision, expense insights)

## Structure

```
app/
  (secure)/           # Protected routes — layout wraps with SidebarProvider + BottomNav
    dashboard/
    documents/        # Bills (list + [id] detail)
    expenses/
    hoa/
    income/
    settings/
    upload/
  auth/login/         # Public auth routes
  api/                # API routes (see below)
components/
  ui/                 # shadcn/ui primitives
  bills/              # Bill upload and table components
  dashboard/          # KPI cards, charts, recent activity
  expenses/           # Expense table, modals, AI insights sheet
  hoa/                # HOA summary cards and table
  income/             # Income table and modals
  settings/
  app-sidebar.tsx     # Desktop sidebar navigation
  bottom-nav.tsx      # Mobile bottom navigation (lg:hidden)
lib/
  server/             # Server-only utilities (require-auth, firebase-admin, logger, etc.)
  client/             # Client-only utilities
  hooks/              # use-protected-route.ts
  auth-context.tsx
  firebase.ts / firebase-admin.ts
  api-client.ts       # Typed fetch wrappers for API routes
  api-schemas.ts      # Zod schemas shared between client and API
hooks/
  use-mobile.ts       # useIsMobile() — 768px breakpoint
  use-media-query.ts  # useMediaQuery(query) — generic
  use-bill-upload.ts  # useBillUpload() — file upload state
```

## Navigation

- **Desktop (≥ 1024px):** Left sidebar (`AppSidebar`) with collapsible icon mode.
- **Mobile (< 1024px):** Fixed bottom navigation bar (`BottomNav`), sidebar is hidden.
- Nav items: Dashboard `/dashboard`, Bills `/documents`, Income `/income`, Expenses `/expenses`, HOA `/hoa`, Settings `/settings`
- **Note:** `useIsMobile()` uses a 768px threshold (different from the 1024px Tailwind `lg:` breakpoint used for layout). Don't conflate the two.

## API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/dashboard-summary` | GET, PUT | Dashboard aggregated data |
| `/api/documents` | GET, POST | Bills list / create |
| `/api/documents/[id]` | GET, DELETE | Bill detail / delete |
| `/api/expense-categories` | GET | User expense categories |
| `/api/expenses` | GET, POST | Expenses list / create |
| `/api/expenses/[id]` | PATCH, DELETE | Expense update / delete |
| `/api/expenses/insights` | POST | AI-generated expense insights |
| `/api/hoa-summaries` | GET, POST | HOA summaries |
| `/api/income` | GET, POST | Income list / create |
| `/api/income/[id]` | PATCH, DELETE | Income update / delete |
| `/api/parse` | POST | Parse uploaded PDF with OpenAI Vision |
| `/api/upload` | POST | Upload file to Firebase Storage |

## Firestore collections

| Collection | Purpose |
|---|---|
| `documents` | Uploaded bill/document records |
| `dailyExpenses` | Daily expense entries |
| `incomeEntries` | Income records |
| `hoaSummaries` | HOA payment summaries |
| `expenseSettings` | Per-user expense category settings |
| `dashboardSummaries` | Pre-calculated dashboard data |
| `providers` | Global expense/income providers (seeded) |

All documents are scoped by `userId`.

## Environment variables

**Client-side (`NEXT_PUBLIC_*`):**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_LOG_LEVEL          # optional
```

**Server-side:**
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET        # optional
OPENAI_API_KEY                 # required for parsing and insights
OPENAI_BASE_URL                # optional
OPENAI_MODEL                   # optional, defaults to gpt-4o-mini
OPENAI_VISION_MODEL            # optional, falls back to OPENAI_MODEL
LOGFLARE_SOURCE_ID             # optional
LOGFLARE_API_KEY               # optional
LOGFLARE_API_URL               # optional
MALWARE_SCAN_WEBHOOK_URL       # optional
LOG_LEVEL                      # optional
```

## Code conventions

- All client components require `"use client"` directive.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Prefer editing existing files over creating new ones.
- Do not add unnecessary comments or docstrings.
- Avoid over-engineering — keep solutions minimal and focused.
- Shared Zod schemas live in `lib/api-schemas.ts`; typed fetch wrappers in `lib/api-client.ts`.

## Design conventions

### Tables

Always use shadcn/ui Table primitives (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` from `@/components/ui/table`). Never use raw `<table>/<thead>/<tbody>/<tr>/<th>/<td>` elements.

Standard structure:

```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Column</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Value</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

The `Card` wraps the section; the `<div className="rounded-md border">` wraps only the table itself inside `CardContent`.

### Cards

Info and graph cards always use `<Card className="bg-muted">` (`#111c28`). Never use the default `<Card>` (which resolves to `bg-card` = `#0d1723`) for content/stat/chart sections. Tables are **not** wrapped in a Card — they sit bare inside a `<div className="rounded-md border">`.

### Badges

Always use `<Badge variant="outline">` for category, status, and label chips. Never use custom `inline-flex rounded-full ...` spans.
