# Farm Database Schema - Additions
## Production Planning, Equipment Maintenance, & Activity Reminders

**Version:** 1.1  
**Date:** October 2026  
**Additions to:** Bike Dangler Industries Farm Management ERP

---

## ADDITION 1: Production Planning & Crop Calendar

### CROP_CALENDAR Table (Reference Data)
Master crop template for your farm location (Marondera, Mashonaland East)

```sql
CREATE TABLE CROP_CALENDAR (
  calendar_id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  crop_name VARCHAR(100),  -- "Green Pepper", "Tsunga", "Cabbage", "Rape"
  variety VARCHAR(100),
  
  -- Seasonal timing
  optimal_planting_month INT,  -- 1-12; e.g., 9 for Sept planting
  nursery_start_month INT,     -- Start seedlings this month
  nursery_duration_days INT,   -- e.g., 30 days in nursery
  transplant_month INT,        -- When to transplant to field
  days_to_harvest INT,         -- 60-90 for peppers, 45-60 for greens
  harvest_start_month INT,
  harvest_end_month INT,
  
  -- Yield targets
  expected_yield_kg_per_sqm DECIMAL(5,2),  -- 1.5 kg/sqm for peppers
  typical_cycle_days INT,
  
  -- Market info
  peak_season_price_per_kg DECIMAL(8,2),  -- High season price
  low_season_price_per_kg DECIMAL(8,2),   -- Low season price
  preferred_sales_channel VARCHAR(100),    -- "Market", "Restaurant", "Retail"
  
  -- Input requirements
  seed_cost_per_sqm DECIMAL(6,2),
  fertilizer_kg_per_sqm DECIMAL(4,2),
  pesticide_liters_per_sqm DECIMAL(4,2),
  water_liters_per_day_per_sqm DECIMAL(5,1),
  
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Records:**
```
| crop_name    | planting_month | days_to_harvest | yield_kg/sqm | peak_price/kg |
|--------------|----------------|-----------------|--------------|---------------|
| Green Pepper | 9 (Sept)       | 75              | 1.5          | 250 ZWL       |
| Tsunga       | 9 (Sept)       | 45              | 1.2          | 150 ZWL       |
| Cabbage      | 8 (Aug)        | 90              | 2.0          | 80 ZWL        |
| Rape         | 10 (Oct)       | 50              | 0.8          | 120 ZWL       |
```

---

### SEASONAL_PLAN Table
Your annual production plan (what you'll grow/breed each season)

```sql
CREATE TABLE SEASONAL_PLAN (
  plan_id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  season_name VARCHAR(50),  -- "Spring 2026", "Summer 2026"
  year INT,
  season_start_date DATE,
  season_end_date DATE,
  
  -- Crop planning
  planned_crops JSON,  -- [{"crop_id": 1, "field_id": 2, "area_sqm": 100, "variety": "Local Red"}]
  total_planned_crop_area_sqm INT,
  projected_crop_yield_kg INT,
  projected_crop_revenue DECIMAL(12,2),
  
  -- Livestock planning
  planned_broiler_batches INT,  -- e.g., 2 batches of 500 birds
  birds_per_batch INT,  -- 500
  projected_bird_revenue DECIMAL(12,2),
  
  -- Finance
  projected_total_revenue DECIMAL(12,2),
  projected_total_expenses DECIMAL(12,2),
  projected_profit DECIMAL(12,2),
  
  -- Execution tracking
  actual_crops_planted INT,  -- How many actually done
  actual_batches_started INT,
  plan_status ENUM('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  
  created_by INT,  -- FK → USER
  approved_by INT,  -- FK → USER (Dylan or Dave must approve)
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### PRODUCTION_CALENDAR View (Query)
What's due *this month* across all operations

```sql
CREATE VIEW PRODUCTION_CALENDAR AS
SELECT 
  'Crop Nursery' AS activity_type,
  cc.crop_name,
  cc.nursery_start_month AS due_month,
  CONCAT('Start ', cc.crop_name, ' seedlings') AS action,
  CONCAT(cc.nursery_duration_days, ' days') AS duration,
  CONCAT(cc.seed_cost_per_sqm, ' ZWL/sqm') AS cost_estimate,
  'NURSERY' AS category
FROM CROP_CALENDAR cc
UNION ALL
SELECT 
  'Crop Transplant',
  cc.crop_name,
  cc.transplant_month,
  CONCAT('Transplant ', cc.crop_name, ' to field'),
  CONCAT(cc.days_to_harvest, ' days to harvest'),
  CONCAT(cc.fertilizer_kg_per_sqm * 50, ' ZWL estimate'),
  'TRANSPLANT'
FROM CROP_CALENDAR cc
UNION ALL
SELECT 
  'Crop Harvest',
  cc.crop_name,
  cc.harvest_start_month,
  CONCAT('Ready to harvest ', cc.crop_name),
  CONCAT(cc.harvest_end_month - cc.harvest_start_month, ' months harvest window'),
  CONCAT(cc.expected_yield_kg_per_sqm * 100 * cc.peak_season_price_per_kg / 1000, ' ZWL/100sqm'),
  'HARVEST'
FROM CROP_CALENDAR cc;
```

---

## ADDITION 2: Equipment & Tool Maintenance

### EQUIPMENT Table
Inventory of all farm equipment

```sql
CREATE TABLE EQUIPMENT (
  equipment_id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  equipment_name VARCHAR(150),  -- "Irrigation pump", "Brooder lamp", "Wheelbarrow"
  equipment_type ENUM('PUMP', 'MOTOR', 'TOOL', 'STRUCTURE', 'LIGHTING', 'TRANSPORT', 'PROCESSING', 'OTHER'),
  
  -- Acquisition
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  supplier_id INT,  -- FK → SUPPLIER
  warranty_end_date DATE,
  
  -- Location & status
  location VARCHAR(100),  -- "Broiler House 1", "Greenhouse", "Storage"
  current_status ENUM('ACTIVE', 'MAINTENANCE_SCHEDULED', 'BROKEN', 'RETIRED'),
  
  -- Specifications
  brand VARCHAR(50),
  model VARCHAR(50),
  serial_number VARCHAR(100),
  capacity_or_specs TEXT,  -- "2HP", "500W", "10-liter capacity"
  
  -- Maintenance schedule
  maintenance_frequency_months INT,  -- Every N months (e.g., 3 for quarterly)
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  
  -- Operating costs
  estimated_lifespan_years INT,
  annual_fuel_cost DECIMAL(10,2),  -- For motors
  estimated_replacement_date DATE,
  
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Records:**
```
| equipment_name      | type    | purchase_cost | status | next_maintenance |
|---------------------|---------|---------------|--------|------------------|
| Irrigation pump     | PUMP    | 12,000 ZWL    | ACTIVE | 2026-11-15       |
| Brooder lamp        | LIGHT   | 500 ZWL       | ACTIVE | 2026-12-01       |
| Fertilizer sprayer  | TOOL    | 800 ZWL       | ACTIVE | 2026-10-30       |
| Transport wheelbar  | TOOL    | 1,200 ZWL     | ACTIVE | No schedule      |
```

---

### MAINTENANCE_LOG Table
Track all repairs, maintenance, and parts replacement

```sql
CREATE TABLE MAINTENANCE_LOG (
  maintenance_id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_id INT NOT NULL,
  
  -- When & who
  maintenance_date DATE,
  maintenance_type ENUM('PREVENTIVE', 'REPAIR', 'INSPECTION', 'REPLACEMENT'),
  performed_by INT,  -- FK → USER (worker or technician)
  
  -- What was done
  issue_description TEXT,  -- "Pump is leaking from seal"
  action_taken TEXT,       -- "Replaced seal and checked pressure"
  parts_replaced TEXT,     -- "Seal (500 ZWL), Oil (200 ZWL)"
  
  -- Costs
  labor_cost DECIMAL(8,2),
  parts_cost DECIMAL(8,2),
  total_cost DECIMAL(8,2),
  
  -- Outcome
  maintenance_status ENUM('COMPLETED', 'IN_PROGRESS', 'PENDING_PARTS'),
  equipment_status_after ENUM('WORKING', 'WORKING_PARTIALLY', 'STILL_BROKEN'),
  
  -- Scheduling
  downtime_hours INT,  -- How long equipment was out of service
  next_maintenance_due_date DATE,
  
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Log Entry:**
```
| equipment_id | date       | type        | issue                 | parts_cost | labor | total |
|--------------|------------|-------------|-----------------------|------------|-------|-------|
| 1 (pump)     | 2026-11-05 | PREVENTIVE  | Oil change + filter   | 1,200      | 500   | 1,700 |
| 2 (brooder)  | 2026-10-20 | INSPECTION  | Thermostat checked OK | 0          | 300   | 300   |
```

---

### EQUIPMENT_STATUS Dashboard Query
See what needs maintenance this month

```sql
SELECT 
  e.equipment_name,
  e.location,
  e.current_status,
  DATEDIFF(DAY, NOW(), e.next_maintenance_date) AS days_until_due,
  CASE 
    WHEN DATEDIFF(DAY, NOW(), e.next_maintenance_date) < 0 THEN 'OVERDUE'
    WHEN DATEDIFF(DAY, NOW(), e.next_maintenance_date) < 7 THEN 'DUE THIS WEEK'
    WHEN DATEDIFF(DAY, NOW(), e.next_maintenance_date) < 30 THEN 'DUE THIS MONTH'
    ELSE 'UPCOMING'
  END AS urgency,
  ml.maintenance_date AS last_done,
  CAST(DATEDIFF(DAY, ml.maintenance_date, NOW()) / 30 AS INT) AS months_since_last
FROM EQUIPMENT e
LEFT JOIN MAINTENANCE_LOG ml ON e.equipment_id = ml.equipment_id 
  AND ml.maintenance_id = (SELECT MAX(ml2.maintenance_id) FROM MAINTENANCE_LOG ml2 WHERE ml2.equipment_id = e.equipment_id)
WHERE e.farm_id = ? AND e.current_status IN ('ACTIVE', 'MAINTENANCE_SCHEDULED')
ORDER BY days_until_due ASC;
```

---

## ADDITION 3: Activity Reminders & Task Management

### REMINDER Table
Daily/weekly tasks that need to happen (watering, feeding checks, etc.)

```sql
CREATE TABLE REMINDER (
  reminder_id INT PRIMARY KEY AUTO_INCREMENT,
  farm_id INT NOT NULL,
  
  -- What activity
  activity_name VARCHAR(150),  -- "Water peppers greenhouse", "Check broiler mortality", "Weed plot A"
  activity_type ENUM('WATERING', 'FEEDING', 'HEALTH_CHECK', 'WEEDING', 'FERTILIZING', 'HARVEST_CHECK', 'CLEANING', 'INSPECTION', 'OTHER'),
  
  -- Related operation
  related_flock_id INT,        -- FK → FLOCK (if poultry task)
  related_planting_id INT,     -- FK → PLANTING (if crop task)
  related_equipment_id INT,    -- FK → EQUIPMENT (if maintenance)
  
  -- Scheduling
  frequency ENUM('ONE_TIME', 'DAILY', 'EVERY_2_DAYS', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY'),
  start_date DATE,
  end_date DATE,  -- When to stop repeating (null = indefinite)
  
  -- Timing
  due_date DATE,              -- Next due date
  preferred_time_of_day VARCHAR(20),  -- "Morning", "Afternoon", "Anytime"
  estimated_duration_minutes INT,     -- "30 minutes"
  
  -- Assignment
  assigned_to INT,  -- FK → USER (specific worker or null for "anyone")
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
  
  -- Description
  instructions TEXT,  -- "Water until soil is moist 10cm deep. Check for wilting."
  
  -- Status tracking
  is_active ENUM('YES', 'NO'),
  created_by INT,  -- FK → USER (who set the reminder)
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Records:**
```
| activity_name              | type           | frequency  | assigned_to | priority |
|----------------------------|----------------|-----------|-------------|----------|
| Water greenhouse peppers   | WATERING       | DAILY     | Worker1    | HIGH     |
| Check broiler feed/water   | FEEDING        | DAILY     | Worker1    | CRITICAL |
| Weed plot A                | WEEDING        | WEEKLY    | Any        | MEDIUM   |
| Inspect for disease        | HEALTH_CHECK   | BI_WEEKLY | Dave       | HIGH     |
| Pump maintenance check     | INSPECTION     | MONTHLY   | Dave       | MEDIUM   |
```

---

### TASK_LOG Table
Track which reminders were actually completed (worker accountability)

```sql
CREATE TABLE TASK_LOG (
  task_log_id INT PRIMARY KEY AUTO_INCREMENT,
  reminder_id INT NOT NULL,
  
  -- Completion
  task_date DATE,
  completed_date TIMESTAMP,  -- When actually done
  completed_by INT,  -- FK → USER
  
  -- Status
  task_status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'),
  completion_notes TEXT,  -- "Watered 50 liters", "Mortality: 2 birds"
  
  -- Quality check
  supervisor_verified ENUM('YES', 'NO'),
  supervisor_id INT,  -- FK → USER (Dave reviews)
  supervisor_notes TEXT,  -- "Good work, soil needs more water"
  
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example Log:**
```
| reminder_id | task_date  | status    | completed_by | completion_notes             |
|-------------|-----------|-----------|--------------|------------------------------|
| 1           | 2026-11-05 | COMPLETED | Worker1      | "Watered 50 liters, no wilting" |
| 2           | 2026-11-05 | COMPLETED | Worker1      | "All birds active, ate well"     |
| 3           | 2026-11-05 | PENDING   | Worker1      | NULL (due end of day)            |
```

---

### REMINDER_SCHEDULE View
What's due today/this week

```sql
CREATE VIEW REMINDER_SCHEDULE AS
SELECT 
  r.reminder_id,
  r.activity_name,
  r.activity_type,
  u.full_name AS assigned_to,
  r.priority,
  r.due_date,
  r.preferred_time_of_day,
  DATEDIFF(DAY, NOW(), r.due_date) AS days_until_due,
  CASE 
    WHEN r.due_date <= NOW() THEN 'OVERDUE'
    WHEN r.due_date <= DATE_ADD(NOW(), INTERVAL 1 DAY) THEN 'TODAY'
    WHEN r.due_date <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'THIS WEEK'
    ELSE 'UPCOMING'
  END AS urgency,
  COALESCE(tl.task_status, 'NO_LOG') AS latest_status,
  COALESCE(tl.completion_notes, 'Not yet logged') AS latest_notes
FROM REMINDER r
LEFT JOIN USER u ON r.assigned_to = u.user_id
LEFT JOIN TASK_LOG tl ON r.reminder_id = tl.reminder_id 
  AND tl.task_log_id = (SELECT MAX(task_log_id) FROM TASK_LOG WHERE reminder_id = r.reminder_id)
WHERE r.farm_id = ? AND r.is_active = 'YES'
ORDER BY r.due_date ASC, r.priority DESC;
```

---

## Integration Points

### Reminders + Equipment Maintenance
When maintenance is due, auto-create a REMINDER:
```
TRIGGER: When maintenance_due_date approaches (7 days before)
ACTION: INSERT into REMINDER
  activity_name = "Service " + equipment.name
  related_equipment_id = equipment.id
  due_date = equipment.next_maintenance_date
  priority = 'HIGH' if overdue, else 'MEDIUM'
```

### Crop Calendar + Plantings
Create reminders based on your seasonal plan:
```
When PLANTING record created:
  IF planting_date - 30 days = TODAY:
    CREATE REMINDER: "Prepare nursery for [crop]" (NURSERY type, 30 days before transplant)
  IF transplant_date = TODAY:
    CREATE REMINDER: "Transplant [crop] to field" (TRANSPLANT type)
  IF harvest_date - 7 days = TODAY:
    CREATE REMINDER: "Ready for harvest [crop]?" (HARVEST_CHECK type)
```

---

## Data Flow: Seasonal Plan → Calendar → Reminders → Logs

```
Sept 1: Dave creates SEASONAL_PLAN
  ├─ Crop: Peppers, 100 sqm in Greenhouse
  ├─ Crop: Tsunga, 50 sqm in Plot A
  └─ Livestock: 2 batches broilers, 500 birds each

Sept 5: System auto-generates REMINDERS from CROP_CALENDAR
  ├─ REMINDER: "Start pepper nursery" (TODAY, 30 days)
  ├─ REMINDER: "Start tsunga nursery" (TODAY, 30 days)
  └─ Equipment alerts: "Service irrigation pump" (Oct 15)

Sept 5-Oct 5: Worker logs daily TASK_LOG entries
  ├─ Sept 5-15: "Seedlings germinated well"
  ├─ Sept 20: "Transplanted peppers to pots"
  ├─ Sept 25: "All seedlings growing normal"
  └─ Oct 5: "Ready to transplant to field"

Oct 5: PLANTING created with transplant_date = Oct 8
  ├─ Auto-REMINDER: "Prepare Greenhouse" (Oct 5)
  └─ Auto-REMINDER: "Transplant peppers" (Oct 8, CRITICAL)

Oct 8-Dec 15: Daily crop maintenance logs
  ├─ Watering, weeding, fertilizing
  ├─ Pest/disease observations
  └─ Growth notes

Dec 14: "Harvest ready?" REMINDER created
  └─ Worker logs "75 kg harvested, Grade A"

Dec 14: HARVEST created
  └─ TRANSACTION: Income logged
  └─ Profitability calculated

Timeline complete → Review for next season
```

---

## Database Relationships

```
CROP_CALENDAR (1) ──> (many) SEASONAL_PLAN
SEASONAL_PLAN (1) ──> (many) PLANTING
SEASONAL_PLAN (1) ──> (many) FLOCK
SEASONAL_PLAN (1) ──> (many) REMINDER

EQUIPMENT (1) ──> (many) MAINTENANCE_LOG
EQUIPMENT (1) ──> (many) REMINDER

REMINDER (1) ──> (many) TASK_LOG
FLOCK (1) ──> (many) REMINDER (related_flock_id)
PLANTING (1) ──> (many) REMINDER (related_planting_id)

USER (1) ──> (many) REMINDER (assigned_to)
USER (1) ──> (many) TASK_LOG (completed_by, supervisor_id)
USER (1) ──> (many) MAINTENANCE_LOG (performed_by)
```

---

## Mobile UI Expectations

### Worker's "Daily Checklist" Screen
```
TODAY'S TASKS (Nov 5, 2026)
═══════════════════════════════

🔴 CRITICAL - OVERDUE
  ☐ Check broiler water/feed (Broiler House 1)
    → Assigned to: You
    → Due: 2 hours ago
    → Add note: [____________________]

🔴 HIGH PRIORITY - TODAY
  ☐ Water greenhouse peppers (Greenhouse)
    → Morning, 30 mins
    → Water until soil moist 10cm deep
    → Add note: [____________________]

  ☐ Inspect for whitefly (Plot A - Tsunga)
    → Afternoon
    → Check bottom of leaves
    → Add note: [____________________]

🟡 MEDIUM - THIS WEEK
  ☐ Weed Plot B (due Nov 6)
  ☐ Fertilize Plot A (due Nov 7)
  ☐ Service irrigation pump (due Nov 15)

[MARK ALL COMPLETE] [SYNC TO SERVER]
```

### Dave's "Dashboard" Screen
```
FARM STATUS - Nov 5, 2026
═══════════════════════════

ALERTS
  🔔 Pump maintenance overdue (15 days)
  🔔 Broiler Batch 1: mortality rate 2% (normal)
  ✓ No diseases reported

TODAY'S TIMELINE (7 active reminders)
  ✓ 2 completed
  ⏳ 3 in progress
  ⚠️ 2 pending

EQUIPMENT STATUS
  ✅ Brooder lamp - OK
  ⚠️ Irrigation pump - maintenance due
  ✓ Sprayer - OK

SEASONAL PLAN: Spring 2026
  Crops: Peppers (100 sqm), Tsunga (50 sqm)
  Livestock: 2 broiler batches (500 birds)
  Progress: 45% complete

[FULL REPORT] [EDIT PLAN] [MANAGE TASKS]
```

---

## Summary of New Tables

| Table | Purpose | Records |
|-------|---------|---------|
| CROP_CALENDAR | Master template for each crop (seasonal timing, yields, costs) | ~10-20 |
| SEASONAL_PLAN | Annual/seasonal production plan (what you'll grow/breed) | 1-2 per year |
| EQUIPMENT | Farm machinery inventory (pump, lights, tools) | ~15-30 |
| MAINTENANCE_LOG | Repair & preventive maintenance history | 2-5 per month |
| REMINDER | Recurring daily/weekly tasks (water, feed, weed, etc.) | ~20-30 active |
| TASK_LOG | Log showing which reminders were completed & when | 20-30 per day |

**Total new records per month:** ~500-800  
**Storage estimate:** ~2 MB per year (minimal)

---

**Next Steps:**
1. Review schema with Dylan
2. Choose database (PostgreSQL recommended)
3. Build prototypes for each feature
4. Integrate with existing FLOCK, PLANTING, TRANSACTION tables
