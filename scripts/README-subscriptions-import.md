# Salesforce subscriptions import

Clean Salesforce `Subscription__c` JSON and import it into MoneyApp.

## 1. Clean (strip, map, validate)

Reads raw SF export, strips SF-only fields, maps to app schema, validates, and writes `subscriptions-cleaned.json` plus `subscriptions-cleaned-report.txt` in the **same directory as the input file**.

```bash
npm run clean:subscriptions -- <path-to-raw-sf.json>
# Example:
npm run clean:subscriptions -- ./sf-export.json
```

Output next to your input file:

- `subscriptions-cleaned.json` – app-ready rows (no `user_id`)
- `subscriptions-cleaned-report.txt` – row counts and skipped rows with reasons

## 2. Import

Imports `subscriptions-cleaned.json` into Supabase `subscriptions` for a given user.

**Required env:**

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (bypasses RLS; use only for this script)
- `SUPABASE_IMPORT_USER_ID` – Target user UUID (subscriptions will be attached to this user)

Optional: create `.env.local` in the project root with these vars; the script loads it automatically.

```bash
npm run import:subscriptions -- <path-to-subscriptions-cleaned.json>
# Example:
npm run import:subscriptions -- ./subscriptions-cleaned.json
```

The script inserts rows one-by-one, prints `Imported X / N subscriptions`, and lists any errors.

## Field mapping (SF → app)

| Salesforce | App |
|------------|-----|
| `Name` | `name` |
| `Amount__c` | `amount` |
| `Frequency__c` | `frequency` (Monthly / Annually / Quarterly etc.) |
| `Status__c` | `status` (Active / Paused / **Deactivated → Ended** / Cancelled) |
| `Person__c` | `person` |
| `Bank__c` | `bank` |
| `Subscription_Type__c` | `subscription_type` |
| `Start_Date__c` | `start_date` |
| `End_Date__c` | `end_date` |
| `Collection_Day__c` | `collection_day` (1–31) |
| `Last_Collection_Date__c` | `last_collection_date` |
| `Next_Collection_Date__c` | `next_collection_date` |
| `Paid_This_Month__c` | `paid_this_period` |
| `Description__c` | `description` |
| `To_be_Expensed__c` | `is_essential` |

Rows with `IsDeleted === true` are dropped. Rows with empty `name`, invalid or non‑positive `amount`, or invalid `frequency`/`status` are skipped and reported.
