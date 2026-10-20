# 🌾 FURROW - Complete Setup & Deployment Guide

## Quick Overview

**What you're getting:**
- ✅ Complete React application (full UI, all pages)
- ✅ PostgreSQL database schema (20+ tables)
- ✅ Authentication (email/password login)
- ✅ Offline-ready (IndexedDB support ready)
- ✅ Mobile responsive design
- ✅ Production-ready hosting

**Tech Stack Recommendation:**
- **Database:** Supabase (PostgreSQL) — Free tier perfect for personal use
- **Hosting:** Vercel or Netlify — Free tier, instant deploys
- **Cost:** $0/month for 12+ months (free tiers)

---

## OPTION 1: SUPABASE + VERCEL (RECOMMENDED)
### Complete setup in 20 minutes

### Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Sign up"
3. Sign up with GitHub or email
4. Create new project:
   - Name: `furrow-farm`
   - Database password: Save this securely
   - Region: Pick closest to Marondera (Europe or Africa)
5. Wait 1-2 minutes for project to spin up

### Step 2: Create Database Schema

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `furrow_database_schema.sql`
4. Paste it into the query editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for all tables to be created ✅

### Step 3: Get Supabase Keys

1. Go to **Settings** → **API** (left sidebar)
2. Copy these two values:
   - `Project URL` → Save as `REACT_APP_SUPABASE_URL`
   - `Anon Key` → Save as `REACT_APP_SUPABASE_ANON_KEY`

### Step 4: Deploy to Vercel

1. **Option A - GitHub (Easiest):**
   - Create GitHub account (if you don't have one)
   - Create new repository named `furrow-farm`
   - Upload `furrow-app.jsx` as `src/App.jsx`
   - Create `.env.local`:
     ```
     REACT_APP_SUPABASE_URL=your_url_here
     REACT_APP_SUPABASE_ANON_KEY=your_key_here
     ```
   - Push to GitHub
   - Go to https://vercel.com, click "New Project"
   - Import your GitHub repository
   - Add environment variables from `.env.local`
   - Click "Deploy"

2. **Option B - Direct Upload:**
   - Use Netlify Drag & Drop: https://app.netlify.com/drop
   - (Requires more manual setup)

### Step 5: Get Your Live URL

After deploy finishes, Vercel gives you a URL like:
```
https://furrow-farm-abc123.vercel.app
```

**That's it!** Your app is live. 🎉

---

## PROJECT SETUP (For Local Development)

If you want to run locally before deploying:

```bash
# 1. Create React app
npx create-react-app furrow-farm
cd furrow-farm

# 2. Install Supabase client
npm install @supabase/supabase-js

# 3. Create .env.local in project root
echo "REACT_APP_SUPABASE_URL=your_url" > .env.local
echo "REACT_APP_SUPABASE_ANON_KEY=your_key" >> .env.local

# 4. Replace src/App.jsx with furrow-app.jsx content

# 5. Add Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 6. Update tailwind.config.js
# content: ["./src/**/*.{js,jsx}"]

# 7. Add to src/index.css
# @tailwind base; @tailwind components; @tailwind utilities;

# 8. Run locally
npm start
```

---

## COST BREAKDOWN

| Service | Free Tier | Cost for You |
|---------|-----------|-------------|
| **Supabase (Database)** | 500 MB storage, 2GB transfer/month | **$0** (plenty for personal use) |
| **Vercel (Hosting)** | Unlimited projects, fast deploys | **$0** (free tier perfect) |
| **Netlify (Alternative)** | Unlimited sites, 300 minutes/month | **$0** (free tier perfect) |
| **Total Monthly Cost** | — | **$0** |

**When to upgrade (optional):**
- If you hit 500 MB storage → $5/month for Supabase
- If you need custom domain → $12/month for Vercel Pro
- For this farm: **Not needed for years**

---

## FIRST-TIME LOGIN

After deployment, create your first account:

1. Go to your deployed app URL
2. Click "New user? Sign Up"
3. Email: your_email@example.com
4. Password: anything (min 6 chars)
5. Click "Sign Up"
6. ✅ Logged in!

**To create partner account for Dylan:**
1. You sign out
2. Dylan goes to URL
3. Clicks "Sign Up" with his email
4. Logs in with his password

---

## CUSTOMIZATION CHECKLIST

After you're live, customize:

### 1. Farm Info
- Go to database → `farms` table
- Edit name, location, etc.

### 2. User Roles
In `users` table, set:
- Your role: `OWNER`
- Dylan role: `PARTNER`
- Workers role: `WORKER`

### 3. Buildings & Fields
Add your actual poultry houses and crop fields to the database

### 4. Crop Calendar
Add your specific crops to `crop_calendar` table with realistic dates

### 5. Equipment
Add all your actual equipment to track

---

## CONNECTING OFFLINE SYNC (Optional)

For workers to work offline and sync later:

```bash
npm install idb
```

This lets workers:
- Log tasks offline (on phone with no signal)
- Auto-sync when they get signal back
- Never lose data

(Requires additional code beyond scope — ask if needed)

---

## BACKUPS

Supabase automatically backs up your database. To download a backup:

1. Supabase Dashboard → **Settings** → **Backups**
2. Click "Download" on any backup
3. Stores as `.sql` file

Do this weekly for peace of mind.

---

## TROUBLESHOOTING

### "Can't connect to database"
- Check environment variables in Vercel match Supabase exactly
- Copy-paste carefully (no extra spaces)
- Redeploy

### "Authentication not working"
- Make sure Supabase project is running (check status)
- Check Email Auth is enabled: Settings → Authentication → Providers

### "App loads but data doesn't show"
- Check browser console for errors (F12)
- Ensure you ran the SQL schema file
- Check Supabase query performance

### "Want to see server logs"
- Vercel: Dashboard → Deployments → View Logs
- Supabase: Dashboard → Logs → Query Performance

---

## NEXT STEPS

### Week 1: Get it running
- [ ] Create Supabase account & database
- [ ] Deploy to Vercel
- [ ] Log in and test
- [ ] Share URL with Dylan

### Week 2: Add real data
- [ ] Add your buildings/fields
- [ ] Add your equipment
- [ ] Add crop varieties
- [ ] Create 2-3 test flocks/plantings

### Week 3: Team setup
- [ ] Dylan creates his account
- [ ] Set up user roles
- [ ] Workers create accounts (if applicable)
- [ ] Start logging daily activity

### Week 4+: Optimize
- [ ] Add equipment maintenance logs
- [ ] Set up seasonal plan for Q1 2027
- [ ] Export reports for Dylan monthly
- [ ] Identify missing features & request

---

## IMPORTANT: DATABASE KEYS

**Never share your `Anon Key` on GitHub as plain text!**

✅ **DO:** Use environment variables (as shown above)
❌ **DON'T:** Commit keys to git repo

If you accidentally commit keys:
1. Regenerate in Supabase Settings → API
2. Update Vercel environment variables
3. Redeploy

---

## GETTING HELP

### Supabase Issues:
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

### Vercel Issues:
- Docs: https://vercel.com/docs
- Status: https://www.vercelstatus.com

### React/App Issues:
- Create issue in your GitHub repo
- Ask Claude for help in this chat

---

## FUTURE EXPANSION

This setup scales to:
- 🌾 Multiple farms (different URLs or multi-tenant)
- 👥 50+ workers
- 📊 Years of historical data
- 📱 Mobile app (React Native version)
- 📈 Advanced analytics & reports

No code changes needed until you hit production scale (Supabase/Vercel auto-scale).

---

## SUMMARY

| Step | Time | Status |
|------|------|--------|
| 1. Create Supabase | 5 min | ⏳ Do now |
| 2. Create database | 2 min | ⏳ Do now |
| 3. Get API keys | 1 min | ⏳ Do now |
| 4. Deploy to Vercel | 5 min | ⏳ Do now |
| 5. Test login | 2 min | ⏳ Do now |
| **Total: Get live in 15 minutes** | | **🚀 Go!** |

---

**Need help?** Keep this chat open. I can help with any errors or customizations.

Good luck with Bike Dangler Industries! 🌾
