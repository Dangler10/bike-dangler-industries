# 🚲 Bike Dangler Industries

Farm management for the Marondera mixed farm: broilers, crops, tasks, stock,
equipment and the partner's money, in one app for the owner (Dave) and the
investing partner (Dylan).

React (Create React App + Tailwind) on **Vercel**, with **Supabase** for the
database and logins. Both run on free plans at this size.

## What's in it

| Page | What it does |
|------|--------------|
| Dashboard | Today's tasks, birds on farm, crops growing, this month's profit, a "needs attention" list, recent activity |
| Tasks | Today's checklist, this week's plan (hours per day), daily / weekly / monthly / one-off tasks |
| Poultry | Batches, daily log (deaths, feed, water), sales, per-batch profit, batch comparison (FCR, weight, profit per bird), houses |
| Crops | Plantings with daily logs and harvests, crop calendar, fields |
| Inventory | Feed, seed, fertiliser… deliveries and use, low-stock alerts. Feed in the poultry log comes out of stock automatically |
| Equipment | Service schedule; logging a service books the cost and sets the next due date |
| Partner Dashboard | Capital put in, profit share, ROI, payback estimate, monthly money summary, all transactions |
| Report | Weekly / monthly summary for the partner, printable or saved as PDF |
| Team | Approve people, set roles and profit shares |

### Roles

| Role | Can see | Can change |
|------|---------|------------|
| OWNER | Everything | Everything |
| PARTNER | Everything, incl. money | Nothing |
| WORKER | Farm activity, no money | Daily logs, task ticks, stock use, services |
| PENDING | Nothing | Nothing |

There is no public sign-up. The owner invites people from Supabase, and the
database enforces these rules (Row Level Security), not just the screens.

## Going live

1. **Database:** follow [`supabase/README.md`](supabase/README.md). It covers
   creating your owner account, running the SQL scripts in order, inviting
   Dylan, and turning sign-ups off.
2. **Vercel:** in the `bike-dangler-industries` project, set these under
   Settings → Environment Variables, then redeploy:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

   (Supabase → Project Settings → API.) Without them the app shows "App not
   configured".
3. **Supabase → Authentication → URL Configuration:** set the Site URL to your
   Vercel address so invite and password-reset emails link back to the app.

## Running it locally

```bash
npm install
cp env.template .env.local   # then fill in the two Supabase values
npm start
```

`.env*` files are git-ignored; never commit real keys.

## Things to know

- **Free Supabase projects pause after about a week with no activity.** Daily
  use keeps it awake; if it pauses, resume it from the Supabase dashboard (no
  data is lost).
- **Deleting** a sale (Partner Dashboard, or a batch/crop's history) also
  removes its harvest record. Deleting a stock delivery's expense also takes
  that stock back out.
- `docs/archive/` holds the original planning documents. They describe an
  earlier design and are kept for reference only.
