# Farm Management Database Design
## Mixed Farming Operations (Poultry + Crops)

**Version:** 1.0  
**Date:** October 2026  
**Use Case:** Marondera poultry farm + green pepper & greens cultivation  
**Users:** Dave + farm partner Dylan + farm workers

---

## 1. System Overview

### Scope
- **Livestock:** Poultry (broilers/layers) – tracking flocks, mortality, feed consumption, healthcare
- **Crops:** Green peppers, leafy greens (tsunga/mustard), herbs – tracking plantings, harvests, inputs
- **Finance:** All expenses, income by product/batch, profitability analysis
- **Inventory:** Feed, seed, fertilizer, tools, medications – stock levels & usage
- **Operations:** Daily tasks, worker assignments, weather logging
- **Compliance:** Records for taxation, partner reporting (Dylan)

### Key Users
- **Dave (Owner/Manager):** Full system access, financial decisions
- **Dylan Basikoro (Partner/Investor):** View financials, partner contributions, ROI tracking
- **Farm Workers:** Log daily activities, record harvests/mortality, input usage (mobile-friendly)

---

## 2. Core Database Entities & Relationships

### 2.1 Farm Structure
```
FARM
├── FIELDS (crop locations)
│   ├── Greenhouse
│   ├── Open field plots
│   └── Nursery area
├── BUILDINGS (poultry structures)
│   ├── Broiler house 1
│   ├── Broiler house 2 (future)
│   └── Storage/hatchery
└── RESOURCE_STORAGE (feed, fertilizer stores)
```

**FARM Table**
```
farm_id (PK)
name: "Marondera Mixed Farm"
location: GPS coordinates
owner_id: FK → USERS
created_date
status: ACTIVE | ARCHIVED
```

**FIELD Table**
```
field_id (PK)
farm_id (FK)
field_name: "Greenhouse North", "Plot A Open", etc.
area_sqm: 200  (for yield calculations)
field_type: GREENHOUSE | OPEN_FIELD | NURSERY
soil_type: descriptive notes
irrigation: YES | NO | DRIP | FLOOD
notes
```

**BUILDING Table**
```
building_id (PK)
farm_id (FK)
building_name: "Broiler House 1"
building_type: POULTRY_HOUSE | STORAGE | HATCHERY
capacity: 500  (birds for poultry; storage sqm for other)
climate_controlled: YES | NO
notes
```

---

### 2.2 Poultry Management

**FLOCK Table** (one record per batch)
```
flock_id (PK)
building_id (FK) → which house
flock_name: "Batch 1 Nov 2026"
species: BROILER | LAYER | MIXED
breed: "Ross 308", etc.
start_date: 2026-11-01
target_harvest_date: 2026-12-13  (7 weeks for broilers)
initial_bird_count: 500
current_bird_count: 485  (decreases with mortality)
status: ACTIVE | COMPLETED | CULLED
notes
created_by: FK → USERS
```

**FLOCK_DAILY_LOG Table** (worker entries)
```
log_id (PK)
flock_id (FK)
log_date: 2026-11-05
recorded_by: FK → USERS
mortality_count: 3
illness_observed: TEXT (notes on health issues)
feed_consumed_kg: 12.5
water_consumed_liters: 45
temperature_min: 28
temperature_max: 32
humidity_percent: 65
behavior_notes: "Normal", "Lethargy", etc.
medication_given: TEXT
action_taken: TEXT
```

**FLOCK_HEALTH_RECORD Table**
```
health_id (PK)
flock_id (FK)
date_observed
health_issue: COCCIDIOSIS | RESPIRATORY | LAMENESS | ASCITES | OTHER
severity: MILD | MODERATE | SEVERE
treatment_given
medication_id (FK) → INVENTORY_ITEM
dosage_per_bird
duration_days
cost: decimal
outcome: RESOLVED | ONGOING | CULLED_BIRDS
birds_affected: number
recorded_by: FK → USERS
```

**FLOCK_HARVESTING Table**
```
harvest_id (PK)
flock_id (FK)
harvest_date: 2026-12-13
total_birds_harvested: 480
birds_sold_live: 50  (if some sold at gate)
birds_processed: 430  (if processed on-farm/sold dressed)
average_weight_kg: 2.1
total_weight_kg: 945
buyer: "Restaurant XYZ", "Market ABC", self-processed
price_per_unit: unit type (per bird / per kg)
sale_price_total: 15200
expenses_harvest: 500  (slaughter, transport, processing)
net_income: 14700
notes
recorded_by: FK → USERS
```

---

### 2.3 Crop Management

**CROP_VARIETY Table** (reference data)
```
variety_id (PK)
crop_name: "Green Pepper", "Tsunga", "Cabbage"
typical_cycle_days: 60-90
typical_yield_kg_per_sqm: 1.5
planting_season: "Spring-Summer"
notes
```

**PLANTING Table** (one record per planting event)
```
planting_id (PK)
field_id (FK) → which field/greenhouse
variety_id (FK) → CROP_VARIETY
planting_date: 2026-10-15
planned_harvest_date: 2026-12-15
area_planted_sqm: 100
seed_source: "Own nursery", "Bought packets"
seed_cost: 500
seed_quantity: 1000  (seedlings or seeds)
transplant_date: 2026-10-25  (if applicable)
transplant_source: "Nursery plot", "Bought seedlings"
transplant_cost: 1200
seedlings_survived_percent: 95
current_status: NURSERY | GROWING | READY_FOR_HARVEST | HARVESTED | FAILED
expected_yield_kg: 150
recorded_by: FK → USERS
notes
```

**CROP_DAILY_LOG Table**
```
log_id (PK)
planting_id (FK)
log_date: 2026-11-10
recorded_by: FK → USERS
task_type: WEEDING | FERTILIZING | IRRIGATION | PEST_CONTROL | PRUNING | INSPECTION | OTHER
hours_worked: 2
workers_count: 1
fertilizer_applied: "NPK 10-10-10", "Manure"
fertilizer_qty_kg: 25
pesticide_applied: "Neem oil"
pesticide_qty_liters: 5
water_applied_liters: 1000
weather_conditions: "Sunny", "Rainy", "Cloudy"
pest_observation: "Whitefly on 10% leaves"
disease_observation: none
crop_height_cm: 45
notes
```

**CROP_HARVEST_LOG Table**
```
harvest_id (PK)
planting_id (FK)
harvest_date: 2026-12-15
harvested_by: FK → USERS
quantity_kg: 145
quality_grading: "Grade A", "Grade B", "Market", "Waste"
grade_a_kg: 100
grade_b_kg: 40
waste_kg: 5
buyer: "Market XYZ", "Restaurant ABC", "Retail", "Self"
price_per_kg: 150
total_sale: 21750  (or estimated if self-consumed)
harvest_cost: 500  (labor, transport)
notes
```

---

### 2.4 Inventory & Inputs

**INVENTORY_CATEGORY Table** (reference)
```
category_id (PK)
category_name: "Poultry Feed", "Crop Seed", "Fertilizer", "Pesticide", "Medicine", "Tools", "Fuel", "Packaging"
```

**INVENTORY_ITEM Table** (master list of all inputs)
```
item_id (PK)
category_id (FK)
item_name: "Broiler Starter (0-2 weeks)", "NPK 10-10-10", "Aspirin tablets"
unit: kg | liters | packets | pcs | doses
supplier: "AgriTrade Ltd"
unit_cost: 450  (in ZWL or your currency)
reorder_level: 50  (kg or units)
notes: expiry info, storage requirements, etc.
```

**INVENTORY_STOCK Table** (current quantities)
```
stock_id (PK)
item_id (FK)
warehouse_id (FK) → RESOURCE_STORAGE
quantity_on_hand: 120
last_count_date: 2026-10-05
expiry_date: 2026-12-31  (for medicines, seeds)
batch_number: for traceability
notes
```

**INVENTORY_USAGE Table** (consumption tracking)
```
usage_id (PK)
item_id (FK)
usage_date: 2026-11-05
used_by: FK → USERS
flock_id or planting_id (FK) → which operation consumed it
quantity_used: 12.5  (kg, liters, etc.)
unit_cost: 450
cost_total: 5625
purpose: descriptive notes
notes
```

**SUPPLIER Table**
```
supplier_id (PK)
supplier_name: "AgriTrade Ltd", "Harare Feed Mills"
contact_person
phone
email
address
preferred: YES | NO
notes
```

---

### 2.5 Financial Management

**TRANSACTION Table** (all money in/out)
```
transaction_id (PK)
transaction_date: 2026-11-05
transaction_type: EXPENSE | INCOME
category: FEED | SEED | FERTILIZER | LABOR | UTILITIES | MEDICATION | EQUIPMENT | HARVEST | OTHER
related_entity: flock_id | planting_id | item_id (what it's for)
amount: decimal (in ZWL)
description: "Feed for Batch 1", "Harvest sale - peppers"
paid_by: FK → USERS
paid_to: FK → SUPPLIER (optional)
payment_method: CASH | BANK_TRANSFER | CREDIT
receipt_attached: YES | NO
receipt_number: optional
reconciled: YES | NO (for bank reconciliation)
notes
```

**PARTNER_CONTRIBUTION Table** (for Dylan's tracking)
```
contribution_id (PK)
user_id (FK) → USERS (Dylan)
contribution_date
amount: decimal
contribution_type: CAPITAL | OPERATING_EXPENSE | EQUIPMENT | OTHER
description: "Initial capital", "Feed purchase Nov batch"
payment_method
notes
```

**FINANCIAL_SUMMARY Table** (aggregated reporting)
```
summary_id (PK)
period_start_date: 2026-11-01
period_end_date: 2026-11-30
flock_id or planting_id (optional, for per-operation summaries)
total_expenses: sum of TRANSACTION where type=EXPENSE
total_income: sum of TRANSACTION where type=INCOME
gross_profit: income - expenses
notes
```

---

### 2.6 Users & Access Control

**USER Table**
```
user_id (PK)
username
email
password_hash
full_name: "Dave Kanyandu", "Dylan Basikoro", "Worker Name"
phone
role: OWNER | PARTNER | WORKER | ADMIN
farm_id (FK)
is_active: YES | NO
created_date
last_login
```

**USER_ROLE_PERMISSION Table** (granular access)
```
permission_id (PK)
role: OWNER | PARTNER | WORKER
can_view_financials: YES | NO
can_edit_transactions: YES | NO
can_view_partner_dashboard: YES | NO
can_log_daily_activity: YES | NO
can_create_planting: YES | NO
can_harvest: YES | NO
can_manage_inventory: YES | NO
can_manage_users: YES | NO
```

---

## 3. Key Workflows & Data Entry Points

### 3.1 Poultry Operation Workflow
1. **Purchase & Receive Chicks**
   - Create FLOCK record (start_date, initial_bird_count)
   - Log TRANSACTION: expense for chicks + transport
   - Record initial medication/vaccination (FLOCK_HEALTH_RECORD)

2. **Daily Management (Worker Logs)**
   - Record FLOCK_DAILY_LOG: mortality, feed consumption, health observations
   - Track INVENTORY_USAGE: feed deduction
   - Log any health issues (FLOCK_HEALTH_RECORD)

3. **Harvest & Sale**
   - Create FLOCK_HARVESTING record
   - Log TRANSACTION: income from sale
   - Calculate net profit automatically

### 3.2 Crop Operation Workflow
1. **Plan & Plant**
   - Create PLANTING record (field, variety, date)
   - Log seed cost (TRANSACTION)

2. **Grow & Maintain (Weekly/Bi-weekly)**
   - Record CROP_DAILY_LOG: tasks, inputs used
   - Track INVENTORY_USAGE: fertilizer, pesticides

3. **Harvest & Sale**
   - Create CROP_HARVEST_LOG
   - Log TRANSACTION: income
   - Calculate harvest-to-sale timeline & profitability

### 3.3 Financial Workflows
- All costs automatically deducted from TRANSACTION
- Partner sees PARTNER_CONTRIBUTION vs. TRANSACTION expenses (ROI tracking)
- Monthly FINANCIAL_SUMMARY for reporting

---

## 4. Reporting & Analytics

### Essential Reports
1. **Flock Profitability**
   - Cost: (initial chicks + feed + medicine + labor + utilities)
   - Revenue: harvest sale
   - Profit margin, feed conversion ratio

2. **Crop Yield & Profitability**
   - Yield per sqm (kg/sqm)
   - Cost per kg produced
   - Seasonal comparison

3. **Partner Financial Dashboard** (Dylan's view)
   - Total contributed
   - Total farm expenses
   - Farm income
   - Dylan's share calculation (if % split defined)

4. **Inventory Status**
   - Stock levels vs. reorder points
   - Usage trends
   - Cost of goods consumed

5. **Worker Activity Log**
   - Hours logged
   - Tasks completed
   - Efficiency metrics

6. **Monthly/Quarterly Financial Summary**
   - Net income
   - Cost breakdown (feed, labor, inputs)
   - Seasonal trends

---

## 5. Technical Architecture Recommendations

### Database Choice
- **PostgreSQL** (robust, open-source, good for analytics queries)
- **SQLite** (if offline-first is critical; sync later to PostgreSQL)

### Backend
- **Node.js + Express** or **Python + FastAPI** (quick to build)
- RESTful API for mobile/web consumption

### Frontend
- **React** (web) + **React Native** or **Flutter** (mobile)
- Or **Next.js** for full-stack web-first with mobile PWA

### Offline Sync Strategy
- **Workers log locally on mobile**
- **Periodic sync to server** (daily at end of shift)
- **Conflict resolution:** server timestamp wins (latest entry)

---

## 6. Data Validation Rules

### Critical Constraints
- `current_bird_count` ≤ `initial_bird_count`
- Harvest date ≥ Planting date + cycle_days (warning if early)
- `quantity_on_hand` ≥ 0 (prevent negative stock)
- Transaction amount > 0
- Only OWNER or PARTNER can edit financials; WORKER is read-only on financials

### Audit Trail
- Every INSERT/UPDATE logs: user_id, timestamp, old_value → new_value
- Partner can see all transactions (for trust & oversight)

---

## 7. Mobile Data Entry Priorities

**Must Work Offline:**
- FLOCK_DAILY_LOG (mortality, feed, health notes)
- CROP_DAILY_LOG (tasks, inputs)
- INVENTORY_USAGE (consumption)

**Can Be Online-Only:**
- Financial transactions (can be logged later)
- Reports (view only; generated server-side)

---

## 8. Sample Queries for Key Insights

```sql
-- Broiler batch profitability
SELECT 
  f.flock_name,
  f.start_date,
  h.harvest_date,
  DATEDIFF(DAY, f.start_date, h.harvest_date) AS cycle_days,
  SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END) AS total_cost,
  h.sale_price_total - h.expenses_harvest AS harvest_net,
  (h.sale_price_total - h.expenses_harvest) - SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END) AS net_profit
FROM FLOCK f
LEFT JOIN FLOCK_HARVESTING h ON f.flock_id = h.flock_id
LEFT JOIN TRANSACTION t ON f.flock_id = t.related_entity AND t.category IN ('FEED', 'MEDICATION', 'LABOR')
GROUP BY f.flock_id;

-- Crop yield efficiency
SELECT
  p.planting_id,
  cv.crop_name,
  p.area_planted_sqm,
  ch.quantity_kg,
  (ch.quantity_kg / p.area_planted_sqm) AS yield_kg_per_sqm,
  ch.total_sale,
  SUM(t.amount) AS total_input_cost,
  (ch.total_sale - SUM(t.amount) - ch.harvest_cost) AS net_profit
FROM PLANTING p
JOIN CROP_VARIETY cv ON p.variety_id = cv.variety_id
LEFT JOIN CROP_HARVEST_LOG ch ON p.planting_id = ch.planting_id
LEFT JOIN TRANSACTION t ON p.planting_id = t.related_entity AND t.category IN ('SEED', 'FERTILIZER', 'PESTICIDE', 'LABOR')
GROUP BY p.planting_id;

-- Partner ROI tracking
SELECT
  u.full_name,
  SUM(pc.amount) AS total_contributed,
  SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END) AS farm_income,
  SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END) AS farm_expenses
FROM USER u
LEFT JOIN PARTNER_CONTRIBUTION pc ON u.user_id = pc.user_id
LEFT JOIN TRANSACTION t ON t.user_id = u.user_id OR t.related_entity = u.user_id
WHERE u.role = 'PARTNER'
GROUP BY u.user_id;
```

---

## 9. Implementation Roadmap

### Phase 1 (MVP - Week 1-2)
- Core tables: FLOCK, FLOCK_DAILY_LOG, PLANTING, CROP_DAILY_LOG
- Basic user auth (Dave + Dylan + 1 worker)
- Simple transaction tracking
- Offline sync for mobile

### Phase 2 (Enhancement - Week 3-4)
- Inventory management (INVENTORY_*)
- Health records for livestock
- Financial dashboard & reports
- Partner ROI view

### Phase 3 (Polish - Week 5+)
- Analytics & trend reports
- Automation (alerts for low stock, harvest readiness)
- Export to Excel
- Mobile UI refinement

---

## Appendix: Entity Relationship Diagram (Text)

```
FARM (1)
  ├──(1:N)──> FIELD (Crop locations)
  ├──(1:N)──> BUILDING (Poultry structures)
  ├──(1:N)──> RESOURCE_STORAGE
  └──(1:N)──> USER (workers + partners)

BUILDING (1)
  └──(1:N)──> FLOCK (poultry batches)

FLOCK (1)
  ├──(1:N)──> FLOCK_DAILY_LOG
  ├──(1:N)──> FLOCK_HEALTH_RECORD
  └──(1)──> FLOCK_HARVESTING

FIELD (1)
  └──(1:N)──> PLANTING (crop plantings)

PLANTING (1)
  ├──(1:N)──> CROP_DAILY_LOG
  └──(1)──> CROP_HARVEST_LOG

INVENTORY_ITEM (1)
  ├──(1:N)──> INVENTORY_STOCK
  └──(1:N)──> INVENTORY_USAGE

TRANSACTION (N)
  └──related to: FLOCK, PLANTING, INVENTORY_ITEM, SUPPLIER

USER (1)
  ├──(1:N)──> FLOCK_DAILY_LOG (recorded_by)
  ├──(1:N)──> CROP_DAILY_LOG (recorded_by)
  ├──(1:N)──> FLOCK_HARVESTING (recorded_by)
  ├──(1:N)──> CROP_HARVEST_LOG (harvested_by)
  └──(1:N)──> PARTNER_CONTRIBUTION
```

---

## Notes for Development

- **Currencies:** Design for flexible currency storage (ZWL, USD, etc.) with conversion rates if needed
- **Timezone:** All timestamps in UTC; convert on display based on user timezone
- **Data Export:** Support CSV/Excel export for tax/partner reporting
- **Mobile First:** Workers likely using phones; optimize for slow/intermittent connectivity
- **Scalability:** Design queries for 12+ months of historical data; index on dates & flock_id

---

**Next Steps:**
1. Review this schema with Dylan (partner)
2. Confirm which crops/poultry types are prioritized
3. Define your own permission rules (what can workers see?)
4. Choose tech stack (Node/React? Python/Vue? Django?)
5. Start Phase 1 MVP build
