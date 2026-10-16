# Database setup

Run these in the Supabase SQL Editor, in order. Every script is safe to run again.

| Step | File | What it does |
|------|------|--------------|
| 1 | `../bike_dangler_database_schema.sql` | Creates the tables (skip if you already ran it). Its sample-data block fails on a fresh database; that's expected, step 3 replaces it. |
| 2 | `01_security_and_roles.sql` | Locks every table with Row Level Security, auto-creates a profile for each sign-up, and makes you the OWNER. **Before running:** sign up in the app with your email, then put that email in `owner_email` at the top of the file. |
| 3 | `02_poultry_and_farm_setup.sql` | Creates the farm (if none), Broiler House 1 and fields; adds poultry tracking (batch summary view, one-step sale recording, batch-linked expenses). |
| 4 | `03_operations.sql` | Partner profit share & ROI (`partner_position`), tasks (time, hours, ticking off), one-step equipment service, inventory with feed stock that follows the poultry daily log, crops (planting summary, one-step harvest/sale), starter crop calendar. |

## Roles

| Role | Can see | Can change |
|------|---------|------------|
| OWNER | Everything | Everything, including other people's roles (Team page) |
| PARTNER | Everything, incl. finances | Nothing |
| WORKER | Farm activity, no finances | Adds and corrects daily logs |
| PENDING | Nothing | Nothing (every new sign-up starts here) |

The first run of step 2 resets every existing PARTNER to PENDING, because the
old app made every sign-up a partner automatically. Approve Dylan again on the
Team page.

## Supabase settings to check

- Authentication → Providers → Email: enabled.
- Authentication → URL Configuration → Site URL: your Vercel URL (so the
  confirmation email links back to the app).
