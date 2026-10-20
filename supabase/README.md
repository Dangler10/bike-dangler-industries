# Database setup

Everything here happens in your Supabase project (supabase.com → your project).

## 1. Create your owner account

The app has no sign-up page. In Supabase go to **Authentication → Users → Add
user → Create new user**, enter your email and a password, and tick "Auto
confirm user".

## 2. Run the SQL scripts, in order

Open **SQL Editor**, paste each file's contents, and click **Run**. Every
script is safe to run again, but if you re-run one, re-run the later ones
after it too.

| Step | File | What it does |
|------|------|--------------|
| 1 | `../bike_dangler_database_schema.sql` | Creates the tables (skip if you already ran it). Its sample-data block fails on a fresh database; that's expected, later scripts replace it. |
| 2 | `01_security_and_roles.sql` | Locks every table with Row Level Security, gives every account a profile, and makes you the OWNER. **Before running:** put your email in `owner_email` at the top. |
| 3 | `02_poultry_and_farm_setup.sql` | Creates the farm (if none), Broiler House 1 and fields; poultry tracking. |
| 4 | `03_operations.sql` | Partner profit share and ROI, tasks, equipment service, inventory (feed stock follows the poultry log), crops, starter crop calendar. |
| 5 | `04_undo_and_reports.sql` | Deleting a sale or delivery undoes it everywhere; sale dates for the batch comparison. |

## 3. Invite Dylan

1. **Authentication → URL Configuration:** set **Site URL** to the app's
   Vercel address.
2. **Authentication → Users → Invite user:** enter Dylan's email. He gets an
   email; the link opens the app and asks him to choose a password.
3. In the app, open **Team** and set him to **PARTNER** (and his profit share,
   50% by default).

The first run of step 2 resets any existing PARTNER to PENDING, because the old
app made every sign-up a partner automatically.

## 4. Turn off sign-ups

**Authentication → Sign In / Providers → Email:** switch off "Allow new users
to sign up". Invites still work. Forgotten passwords: use "Forgot password?" on
the login page.

## Roles

| Role | Can see | Can change |
|------|---------|------------|
| OWNER | Everything | Everything, including roles and profit shares (Team page) |
| PARTNER | Everything, incl. finances | Nothing |
| WORKER | Farm activity, no finances | Adds and corrects daily logs, ticks tasks, uses stock, logs services |
| PENDING | Nothing | Nothing |
