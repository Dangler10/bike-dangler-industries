# 💰 Dylan's Partner Dashboard Setup

## What Dylan Sees

Dylan (capital investor partner) has access to:
- **Total Invested:** All money he's put into the farm
- **Farm Income:** All revenue from harvests
- **Farm Expenses:** All costs (feed, seed, equipment, labor)
- **Gross Profit:** Income minus expenses
- **His % Share:** Whatever percentage you agreed (50/50, 60/40, etc.)
- **ROI:** Return on investment (profit ÷ investment)
- **Breakeven Date:** When he recovers his capital

---

## SETUP STEPS

### Step 1: Create Dylan's Account

1. Give Dylan the Bike Dangler Industries app URL
2. He clicks "New user? Sign Up"
3. He enters his email + password
4. He's in! ✅

### Step 2: Set His Role

In Supabase database:
1. Go to `users` table
2. Find Dylan's row
3. Set `role` = `PARTNER`
4. Dylan now sees the Partner Dashboard

### Step 3: Set His % Share

Edit `farm_db_design.md` (or add to database):
```
Partnership:
- Dave: 50% (works the farm)
- Dylan: 50% (capital investor)

// OR change to:
- Dave: 40%
- Dylan: 60%

// Whatever you agreed
```

---

## FINANCIAL TRACKING

### Dylan's Money In

Every time Dylan contributes capital, log it:

1. App → Partner Dashboard → (record manually or use database directly)
2. Supabase `partner_contributions` table:
   ```
   Date: 2026-10-15
   Amount: $5,200
   Type: CAPITAL
   Description: Initial capital investment
   ```

Current contributions tracked:
- Oct 15: $5,200 (capital)
- Nov 5: $2,000 (equipment)
- Dec 1: $1,500 (feed inventory)
- **Total: $8,700**

### Farm Income (Harvest Sales)

Automatically tracked when you log harvest:

1. Log crop harvest (App → Crop Calendar)
   ```
   Crop: Green Peppers
   Quantity: 12 kg
   Price: $25/kg
   Total: $300
   ```

2. Log flock harvest (App → Tasks → Log Harvest)
   ```
   Birds sold: 450
   Avg weight: 2.1 kg
   Price: $2.50/kg
   Total: $2,362.50
   ```

3. **Automatically appears** in Partner Dashboard

### Farm Expenses

Every expense logged goes against profit:

Types tracked:
- Feed purchases
- Seed & fertilizer
- Labor costs
- Equipment
- Utilities
- Medicine & supplies

Example entry:
```
Date: Oct 20
Category: FEED
Amount: $180
Description: 50kg broiler feed
```

---

## SAMPLE CALCULATION

**Dylan's ROI (after 2 months of operation)**

```
Dylan's Total Contribution:    $8,700
Farm Total Income:             $4,200
Farm Total Expenses:           $2,100
Gross Profit:                  $2,100

Dylan's Share (50%):           $1,050
Dylan's ROI:                   1,050 ÷ 8,700 = 12.1%

Breakeven:                     8,700 ÷ 1,050 = ~8 months
                               (approximately March 2027)
```

**What Dylan sees in app:**
- "Total Contributed: $8,700"
- "Your ROI: 12.1%"
- "Breakeven: ~8 months (March 2027)"

---

## MONTHLY REPORT FOR DYLAN

Create a simple monthly summary (manually or automated):

**Sample Report: November 2026**

```
FURROW FARM - NOVEMBER 2026 FINANCIAL SUMMARY

Starting Capital Invested:     $8,700

INCOME (This Month):
  Broiler batch harvest:       $2,362.50
  Green pepper sales:          $480
  Tsunga harvest:              $180
  Total Income:                $3,022.50

EXPENSES (This Month):
  Feed costs:                  $850
  Seed & fertilizer:           $300
  Labor (2 workers):           $400
  Equipment maintenance:       $120
  Total Expenses:              $1,670

Month Profit:                  $1,352.50
Year-to-Date Profit:           $2,100
Dylan's Share (50%):           $1,050
Dylan's Year ROI:              12.1%

Breakeven Projection:          March 2027 (~4 months)

---
Next Review: December 1
```

---

## MONTHLY CHECKLIST FOR DAVE

Every month, do this for Dylan:

- [ ] Log all harvest sales (quantity, price, buyer)
- [ ] Log all expenses (feed, supplies, labor)
- [ ] Calculate monthly profit
- [ ] Calculate Dylan's share
- [ ] Send Dylan a summary email or report
- [ ] Update `partner_contributions` if Dylan adds more capital

---

## PARTNER DASHBOARD PAGE (IN APP)

Dylan clicks "Partner Dashboard" and sees:

```
┌─────────────────────────────────────┐
│  Dylan's Partner Dashboard          │
├─────────────────────────────────────┤
│                                     │
│  Total Contributed: $8,700          │
│                                     │
│  Farm Total Profit: $2,100          │
│  (Income $4,200 - Expenses $2,100)  │
│                                     │
│  Your ROI: 12.1%                    │
│  (Profit ÷ Contribution)            │
│                                     │
│  Breakeven: ~8 months               │
│  (Projected March 2027)             │
├─────────────────────────────────────┤
│  Recent Transactions:               │
│                                     │
│  ✓ Oct 20 - Feed purchase    -$180  │
│  ✓ Oct 18 - Pepper harvest   +$300  │
│  ✓ Oct 15 - Your capital    +$5,200 │
│  ✓ Oct 12 - Seed cost        -$120  │
│                                     │
└─────────────────────────────────────┘
```

**Dylan can see:**
- All his contributions (when he gave money)
- All farm income (every harvest sale)
- All farm expenses (automatically tracked)
- His calculated ROI
- Breakeven date projection

---

## HOW PAYMENTS WORK

**Option 1: Profit Split (Recommended)**
- Each month: Farm profit = (Income - Expenses)
- Dylan's share = His % × Monthly profit
- Pays Dylan quarterly or yearly

Example:
```
Feb 2027 Profit: $4,200
Dylan's 50% share: $2,100
Dave pays Dylan: $2,100 via bank transfer
```

**Option 2: Capital + Expenses + Agreed Split**
- Dylan recovers his capital first
- Then profit is split 50/50

Example:
```
Month 1-8: Dylan gets all profit until he recovers $8,700
Month 9+: Dylan gets his 50% share
```

**Option 3: Fixed Management Fee**
- Dylan invested: $8,700
- He gets agreed % return (e.g., 15% annually = $1,305/year)
- Dave keeps any profit beyond that

**Set your agreement in writing before launch!**

---

## WHAT TO TRACK

### For Dylan to get accurate reports, you MUST track:

**Income:**
- ✅ Every harvest (date, quantity, buyer, price)
- ✅ Every sale (when money comes in)
- ✅ Any side income (selling eggs, compost, etc.)

**Expenses:**
- ✅ All feed purchases (date, amount, cost)
- ✅ All seed & fertilizer (date, amount, cost)
- ✅ Labor payments to workers
- ✅ Equipment purchases
- ✅ Utilities (electricity, water)
- ✅ Medicine & supplies
- ✅ Repairs

**Capital Contributions:**
- ✅ Initial investment (when Dylan gave capital)
- ✅ Equipment purchases (who paid?)
- ✅ Any additional investments

### Track via:
1. **App Transactions table** (easiest) - log as you go
2. **Google Sheets** (simple) - backup tracking
3. **Paper notebook** (backup) - if tech fails

**Recommendation:** Use both app + spreadsheet until comfortable

---

## ANNUAL RECONCILIATION

Each year (January), do full reconciliation:

1. **Print all transactions** from Bike Dangler Industries
2. **Verify all amounts** against actual receipts
3. **Calculate total income** (sum all harvests)
4. **Calculate total expenses** (sum all costs)
5. **Verify Dylan's capital** (all contributions)
6. **Calculate profit & ROI**
7. **Send Dylan annual summary**

Example annual report:
```
FURROW FARM - 2026 ANNUAL SUMMARY

Capital Invested by Dylan:     $8,700

Total Income (Year):           $12,400
Total Expenses (Year):         $6,200
Gross Profit (Year):           $6,200

Dylan's Share (50%):           $3,100
Dylan's Annual ROI:            35.6%

Cumulative Profit:             $6,200
Dylan's Cumulative Share:      $3,100
Dylan's Cumulative Return:     35.6%

Status: On track for breakeven by Q2 2027
```

---

## RED FLAGS TO AVOID

❌ **Don't:** Forget to log expenses (looks more profitable than it is)  
❌ **Don't:** Mix personal expenses with farm expenses  
❌ **Don't:** Go months without updating Dylan  
❌ **Don't:** Keep records only on phone (backup to cloud)  
✅ **Do:** Log transactions daily or weekly  
✅ **Do:** Review monthly with Dylan  
✅ **Do:** Keep receipts for everything  
✅ **Do:** Update Dylan monthly on progress  

---

## AUTOMATION (Optional)

If you want Bike Dangler Industries to auto-calculate Dylan's ROI:

Database view (already in schema):
```sql
CREATE VIEW partner_roi_summary AS
SELECT 
  user_id,
  full_name,
  total_contributed,
  farm_income,
  farm_expenses,
  (farm_income - farm_expenses) AS gross_profit
FROM ...
```

This auto-calculates:
- Total invested
- Total profit
- Dylan's % share
- ROI %
- Breakeven date

**No manual work needed once set up!**

---

## DYLAN'S MONTHLY CHECKLIST

Dylan should:
- [ ] Check Partner Dashboard weekly
- [ ] Review monthly summary email from Dave
- [ ] Ask questions if numbers seem off
- [ ] Approve any major expenses (equipment, extra capital)
- [ ] Provide additional capital if needed

Dave should:
- [ ] Send Dylan monthly summary by 5th of month
- [ ] Keep records organized
- [ ] Log all transactions in Bike Dangler Industries
- [ ] Review Dylan's concerns same day
- [ ] Provide annual summary by January 15

---

## SAMPLE DYLAN EMAIL (Monthly)

```
Subject: Bike Dangler Industries Farm - November 2026 Summary

Hi Dylan,

Here's your farm summary for November:

This Month Profit:    $1,350
Year-to-Date Profit:  $2,100
Your ROI (50%):       12.1% (recovering $1,050 of your $8,700)

Next Harvest:
- Broiler batch 02 → Ready Jan 5, 2027
- Green peppers → ~50 kg harvested so far this month

Action needed: Approve equipment repair ($320) - irrigation pump maintenance

Dashboard: furrow-farm.vercel.app (login with your email)

Questions? Reply to this email.

Dave
```

---

**Remember:** Trust and transparency. Dylan needs to see his money working. Keep records clean, report monthly, and celebrate wins together! 🎉
