# HOA / Expensas module overview

## Detection and parsing
- The Python parser (`parser/main.py`) now scans every PDF for Mis Expensas markers (`"MIS EXPENSAS"`, `"EXPENSAS ORDINARIAS"`, `"ESTADO DE CUENTAS Y PRORRATEO"`). If any of them are present the document is treated as an HOA bill: `providerId` is forced to `expensas`, `providerNameDetected` to `Expensas consorcio`, and `category` to `hoa`.
- When a file is classified as HOA we extract a rich `hoaDetails` payload with the following properties:
  - `buildingCode`, `buildingAddress`
  - `unitCode`, `unitLabel`, `ownerName`
  - `periodLabel`, `periodYear`, `periodMonth`
  - `firstDueAmount`, `secondDueAmount`, `totalToPayUnit`, `totalBuildingExpenses`
  - `rubros`: array of `{ rubroNumber, label, total, items }`
    - `items`: optional detail rows inside the rubro, each as `{ label, detail, amount }`
- If any of the critical values (unit, period or total) cannot be parsed the document still becomes `category = "hoa"` but `hoaDetails` is set to `null` so that Firestore data stays coherent.

## Firestore writes
- Documents in the `documents` collection now store the entire `hoaDetails` object alongside the usual parsed fields. `totalAmount`/`amount` mirror `hoaDetails.totalToPayUnit` so dashboards stay in sync.
- Each successful HOA parse also upserts a document into `hoaSummaries` (keyed by `userId + buildingCode + unitCode + periodKey`). Schema:
  ```ts
  {
    buildingCode, buildingAddress,
    unitCode, unitLabel, ownerName,
    periodKey, periodYear, periodMonth, periodLabel,
    totalToPayUnit, totalBuildingExpenses,
    rubros: Array<{
      rubroNumber, label, total,
      items: Array<{ label, detail, amount }>
    }>,
    createdAt, updatedAt
  }
  ```
  `rubros` are persisted exactly as provided by the parser so frontend logic can reuse them without extra parsing.

## Comparison logic
- `lib/hoaComparison.ts` exports `compareHoaSummaries(current, previous)` which joins rubros (case-insensitive label + rubro number) and classifies each entry with statuses: `new`, `removed`, `increased`, `decreased`, `unchanged`.
- Differences are computed numerically: `diffAmount = (current ?? 0) - (previous ?? 0)` with a `0.01` epsilon to treat floating point noise as *unchanged*. `diffPercent` is only returned if the previous value is > 0 so division-by-zero is avoided.
- The function returns `{ current, previous, rubroDiffs }` and is UI agnostic-no Firestore calls or component dependencies.

## Expensas page data flow
- New route: `GET /api/hoa-summaries` returns all summaries for the authenticated user (optionally filterable by query params).
- UI (`app/(secure)/hoa/page.tsx`) is a client component that:
  1. Reads the current Firebase user via `useAuth` and fetches `/api/hoa-summaries`.
  2. Lets the user pick a building/unit combination (auto-selects the first one).
  3. Builds a chart of `totalToPayUnit` per month using Recharts, a comparison table for the latest vs previous month using `compareHoaSummaries`, and an alerts list for new rubros or >20% increases.
  4. Handles empty/first-period states gracefully (shows the latest rubros when no previous period exists, friendly messaging when there is no data yet).

With this flow uploading a Mis Expensas PDF automatically populates `documents` + `hoaSummaries`, and the `/hoa` page reflects the new period, chart point, comparison rows, and any alerts without additional manual input.
