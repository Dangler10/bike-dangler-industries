-- Furrow Farm Management System
-- PostgreSQL Schema
-- For Supabase or self-hosted PostgreSQL

-- ============================================
-- 1. USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50), -- OWNER, PARTNER, WORKER, ADMIN
  farm_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- ============================================
-- 2. FARM BASICS
-- ============================================

CREATE TABLE farms (
  farm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  owner_id UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fields (
  field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  field_name VARCHAR(100),
  area_sqm DECIMAL(8,2),
  field_type VARCHAR(50), -- GREENHOUSE, OPEN_FIELD, NURSERY
  irrigation VARCHAR(50), -- YES, NO, DRIP, FLOOD
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE buildings (
  building_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  building_name VARCHAR(100),
  building_type VARCHAR(50), -- POULTRY_HOUSE, STORAGE, HATCHERY
  capacity INT,
  climate_controlled BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. POULTRY MANAGEMENT
-- ============================================

CREATE TABLE flocks (
  flock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id),
  flock_name VARCHAR(100),
  species VARCHAR(50), -- BROILER, LAYER, MIXED
  start_date DATE,
  target_harvest_date DATE,
  initial_bird_count INT,
  current_bird_count INT,
  status VARCHAR(50), -- ACTIVE, COMPLETED, CULLED
  notes TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flock_daily_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flock_id UUID REFERENCES flocks(flock_id),
  log_date DATE,
  recorded_by UUID REFERENCES users(user_id),
  mortality_count INT DEFAULT 0,
  illness_observed TEXT,
  feed_consumed_kg DECIMAL(8,2),
  water_consumed_liters DECIMAL(8,2),
  temperature_min INT,
  temperature_max INT,
  humidity_percent INT,
  behavior_notes TEXT,
  medication_given TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flock_harvesting (
  harvest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flock_id UUID REFERENCES flocks(flock_id),
  harvest_date DATE,
  total_birds_harvested INT,
  birds_sold_live INT,
  average_weight_kg DECIMAL(8,2),
  total_weight_kg DECIMAL(10,2),
  buyer VARCHAR(255),
  price_per_unit DECIMAL(10,2),
  sale_price_total DECIMAL(12,2),
  expenses_harvest DECIMAL(10,2),
  net_income DECIMAL(12,2),
  notes TEXT,
  recorded_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. CROP MANAGEMENT
-- ============================================

CREATE TABLE crop_varieties (
  variety_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name VARCHAR(100),
  typical_cycle_days INT,
  typical_yield_kg_per_sqm DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plantings (
  planting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID REFERENCES fields(field_id),
  variety_id UUID REFERENCES crop_varieties(variety_id),
  planting_date DATE,
  planned_harvest_date DATE,
  area_planted_sqm DECIMAL(8,2),
  seed_cost DECIMAL(10,2),
  current_status VARCHAR(50), -- NURSERY, GROWING, READY_FOR_HARVEST, HARVESTED
  expected_yield_kg DECIMAL(10,2),
  recorded_by UUID REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crop_daily_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID REFERENCES plantings(planting_id),
  log_date DATE,
  recorded_by UUID REFERENCES users(user_id),
  task_type VARCHAR(50), -- WEEDING, FERTILIZING, IRRIGATION, PEST_CONTROL, PRUNING, INSPECTION
  hours_worked DECIMAL(5,2),
  workers_count INT,
  fertilizer_applied VARCHAR(255),
  fertilizer_qty_kg DECIMAL(8,2),
  pesticide_applied VARCHAR(255),
  pesticide_qty_liters DECIMAL(8,2),
  water_applied_liters DECIMAL(10,2),
  weather_conditions VARCHAR(100),
  pest_observation TEXT,
  disease_observation TEXT,
  crop_height_cm INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crop_harvests (
  harvest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID REFERENCES plantings(planting_id),
  harvest_date DATE,
  harvested_by UUID REFERENCES users(user_id),
  quantity_kg DECIMAL(10,2),
  grade_a_kg DECIMAL(10,2),
  grade_b_kg DECIMAL(10,2),
  waste_kg DECIMAL(10,2),
  buyer VARCHAR(255),
  price_per_kg DECIMAL(10,2),
  total_sale DECIMAL(12,2),
  harvest_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. INVENTORY & SUPPLIES
-- ============================================

CREATE TABLE inventory_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  item_name VARCHAR(255),
  category VARCHAR(50), -- FEED, SEED, FERTILIZER, PESTICIDE, MEDICINE, TOOLS, FUEL
  unit VARCHAR(20), -- kg, liters, packets, pcs
  supplier VARCHAR(255),
  unit_cost DECIMAL(10,2),
  reorder_level INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_stock (
  stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(item_id),
  quantity_on_hand DECIMAL(10,2),
  last_count_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(item_id),
  usage_date DATE,
  used_by UUID REFERENCES users(user_id),
  flock_id UUID REFERENCES flocks(flock_id),
  planting_id UUID REFERENCES plantings(planting_id),
  quantity_used DECIMAL(10,2),
  unit_cost DECIMAL(10,2),
  cost_total DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. PRODUCTION PLANNING
-- ============================================

CREATE TABLE crop_calendar (
  calendar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  crop_name VARCHAR(100),
  optimal_planting_month INT,
  nursery_start_month INT,
  nursery_duration_days INT,
  transplant_month INT,
  days_to_harvest INT,
  harvest_start_month INT,
  expected_yield_kg_per_sqm DECIMAL(5,2),
  peak_season_price_per_kg DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seasonal_plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  season_name VARCHAR(50),
  year INT,
  season_start_date DATE,
  season_end_date DATE,
  planned_crops TEXT, -- JSON: [{"crop_id": "...", "field_id": "...", "area_sqm": 100}]
  total_planned_crop_area_sqm INT,
  planned_broiler_batches INT,
  birds_per_batch INT,
  projected_total_revenue DECIMAL(12,2),
  projected_total_expenses DECIMAL(12,2),
  projected_profit DECIMAL(12,2),
  plan_status VARCHAR(50), -- DRAFT, APPROVED, IN_PROGRESS, COMPLETED
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. EQUIPMENT & MAINTENANCE
-- ============================================

CREATE TABLE equipment (
  equipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  equipment_name VARCHAR(255),
  equipment_type VARCHAR(50), -- PUMP, MOTOR, TOOL, LIGHTING, OTHER
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  location VARCHAR(255),
  current_status VARCHAR(50), -- ACTIVE, MAINTENANCE_SCHEDULED, BROKEN, RETIRED
  maintenance_frequency_months INT,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_logs (
  maintenance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES equipment(equipment_id),
  maintenance_date DATE,
  maintenance_type VARCHAR(50), -- PREVENTIVE, REPAIR, INSPECTION
  performed_by UUID REFERENCES users(user_id),
  issue_description TEXT,
  action_taken TEXT,
  labor_cost DECIMAL(10,2),
  parts_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  equipment_status_after VARCHAR(50), -- WORKING, PARTIALLY_WORKING, STILL_BROKEN
  downtime_hours INT,
  next_maintenance_due_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. ACTIVITY REMINDERS & TASKS
-- ============================================

CREATE TABLE reminders (
  reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  activity_name VARCHAR(255),
  activity_type VARCHAR(50), -- WATERING, FEEDING, HEALTH_CHECK, WEEDING, FERTILIZING, HARVEST_CHECK, CLEANING, INSPECTION
  related_flock_id UUID REFERENCES flocks(flock_id),
  related_planting_id UUID REFERENCES plantings(planting_id),
  related_equipment_id UUID REFERENCES equipment(equipment_id),
  frequency VARCHAR(50), -- ONE_TIME, DAILY, EVERY_2_DAYS, WEEKLY, BI_WEEKLY, MONTHLY
  start_date DATE,
  end_date DATE,
  due_date DATE,
  preferred_time_of_day VARCHAR(50), -- Morning, Afternoon, Anytime
  estimated_duration_minutes INT,
  assigned_to UUID REFERENCES users(user_id),
  priority VARCHAR(50), -- LOW, MEDIUM, HIGH, CRITICAL
  instructions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_logs (
  task_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES reminders(reminder_id),
  task_date DATE,
  completed_date TIMESTAMP,
  completed_by UUID REFERENCES users(user_id),
  task_status VARCHAR(50), -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
  completion_notes TEXT,
  supervisor_verified BOOLEAN DEFAULT FALSE,
  supervisor_id UUID REFERENCES users(user_id),
  supervisor_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. FINANCIAL TRACKING
-- ============================================

CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  transaction_date DATE,
  transaction_type VARCHAR(50), -- EXPENSE, INCOME
  category VARCHAR(50), -- FEED, SEED, FERTILIZER, LABOR, UTILITIES, MEDICATION, EQUIPMENT, HARVEST, OTHER
  related_flock_id UUID REFERENCES flocks(flock_id),
  related_planting_id UUID REFERENCES plantings(planting_id),
  amount DECIMAL(12,2),
  description TEXT,
  paid_by UUID REFERENCES users(user_id),
  payment_method VARCHAR(50), -- CASH, BANK_TRANSFER, CREDIT
  receipt_attached BOOLEAN DEFAULT FALSE,
  receipt_number VARCHAR(100),
  reconciled BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE partner_contributions (
  contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  user_id UUID REFERENCES users(user_id),
  contribution_date DATE,
  amount DECIMAL(12,2),
  contribution_type VARCHAR(50), -- CAPITAL, OPERATING_EXPENSE, EQUIPMENT
  description TEXT,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE financial_summaries (
  summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  period_start_date DATE,
  period_end_date DATE,
  total_expenses DECIMAL(12,2),
  total_income DECIMAL(12,2),
  gross_profit DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_farm ON users(farm_id);
CREATE INDEX idx_fields_farm ON fields(farm_id);
CREATE INDEX idx_buildings_farm ON buildings(farm_id);
CREATE INDEX idx_flocks_building ON flocks(building_id);
CREATE INDEX idx_flocks_status ON flocks(status);
CREATE INDEX idx_plantings_field ON plantings(field_id);
CREATE INDEX idx_plantings_status ON plantings(current_status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_reminders_farm ON reminders(farm_id);
CREATE INDEX idx_reminders_active ON reminders(is_active);
CREATE INDEX idx_equipment_maintenance ON equipment(next_maintenance_date);
CREATE INDEX idx_inventory_item ON inventory_stock(item_id);

-- ============================================
-- 11. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Insert a test farm
INSERT INTO farms (name, location) VALUES 
('Marondera Mixed Farm', 'Marondera, Mashonaland East');

-- Insert test fields
INSERT INTO fields (farm_id, field_name, area_sqm, field_type, irrigation) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Greenhouse North', 100, 'GREENHOUSE', 'DRIP'),
((SELECT farm_id FROM farms LIMIT 1), 'Plot A', 50, 'OPEN_FIELD', 'FLOOD'),
((SELECT farm_id FROM farms LIMIT 1), 'Plot B', 50, 'OPEN_FIELD', 'FLOOD');

-- Insert test building
INSERT INTO buildings (farm_id, building_name, building_type, capacity, climate_controlled) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Broiler House 1', 'POULTRY_HOUSE', 500, FALSE);

-- Insert test crop varieties
INSERT INTO crop_varieties (crop_name, typical_cycle_days, typical_yield_kg_per_sqm) VALUES 
('Green Pepper', 75, 1.5),
('Tsunga', 45, 1.2),
('Cabbage', 90, 2.0);

-- Insert test equipment
INSERT INTO equipment (farm_id, equipment_name, equipment_type, purchase_date, purchase_cost, location, current_status, maintenance_frequency_months, next_maintenance_date) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Irrigation Pump', 'PUMP', '2026-06-01', 12000, 'Greenhouse', 'ACTIVE', 3, '2026-11-15');

-- Insert crop calendar
INSERT INTO crop_calendar (farm_id, crop_name, optimal_planting_month, nursery_start_month, nursery_duration_days, transplant_month, days_to_harvest, harvest_start_month, expected_yield_kg_per_sqm, peak_season_price_per_kg) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Green Pepper', 9, 8, 30, 9, 75, 12, 1.5, 250),
((SELECT farm_id FROM farms LIMIT 1), 'Tsunga', 9, 8, 20, 9, 45, 10, 1.2, 150);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Dashboard Summary View
CREATE VIEW farm_dashboard_summary AS
SELECT 
  f.farm_id,
  f.name as farm_name,
  COUNT(DISTINCT fl.flock_id) as active_flocks,
  COUNT(DISTINCT p.planting_id) as active_plantings,
  COUNT(DISTINCT e.equipment_id) as total_equipment,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as total_expenses
FROM farms f
LEFT JOIN flocks fl ON f.farm_id = fl.farm_id AND fl.status = 'ACTIVE'
LEFT JOIN plantings p ON f.farm_id IN (SELECT farm_id FROM fields WHERE field_id = p.field_id) AND p.current_status IN ('GROWING', 'READY_FOR_HARVEST')
LEFT JOIN equipment e ON f.farm_id = e.farm_id
LEFT JOIN transactions t ON f.farm_id = t.farm_id
GROUP BY f.farm_id, f.name;

-- Equipment Maintenance Due View
CREATE VIEW equipment_maintenance_due AS
SELECT 
  e.equipment_id,
  e.equipment_name,
  e.current_status,
  e.next_maintenance_date,
  EXTRACT(DAY FROM e.next_maintenance_date - CURRENT_DATE) as days_until_due,
  CASE 
    WHEN e.next_maintenance_date <= CURRENT_DATE THEN 'OVERDUE'
    WHEN e.next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'DUE THIS WEEK'
    WHEN e.next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'DUE THIS MONTH'
    ELSE 'UPCOMING'
  END as urgency
FROM equipment e
WHERE e.current_status IN ('ACTIVE', 'MAINTENANCE_SCHEDULED')
ORDER BY e.next_maintenance_date ASC;

-- Task Checklist View
CREATE VIEW task_checklist AS
SELECT 
  r.reminder_id,
  r.activity_name,
  r.priority,
  r.due_date,
  u.full_name as assigned_to,
  CASE 
    WHEN r.due_date <= CURRENT_DATE THEN 'OVERDUE'
    WHEN r.due_date = CURRENT_DATE THEN 'TODAY'
    WHEN r.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'THIS WEEK'
    ELSE 'UPCOMING'
  END as status,
  tl.task_status as latest_status
FROM reminders r
LEFT JOIN users u ON r.assigned_to = u.user_id
LEFT JOIN task_logs tl ON r.reminder_id = tl.reminder_id 
  AND tl.task_log_id = (SELECT MAX(task_log_id) FROM task_logs WHERE reminder_id = r.reminder_id)
WHERE r.is_active = TRUE
ORDER BY r.priority DESC, r.due_date ASC;

-- Flock Profitability View
CREATE VIEW flock_profitability AS
SELECT 
  f.flock_id,
  f.flock_name,
  f.start_date,
  fh.harvest_date,
  EXTRACT(DAY FROM fh.harvest_date - f.start_date) as cycle_days,
  fh.total_birds_harvested,
  fh.average_weight_kg,
  fh.sale_price_total,
  fh.expenses_harvest,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as total_operating_cost,
  (fh.sale_price_total - fh.expenses_harvest) - COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as net_profit
FROM flocks f
LEFT JOIN flock_harvesting fh ON f.flock_id = fh.flock_id
LEFT JOIN transactions t ON f.flock_id = t.related_flock_id AND t.transaction_type = 'EXPENSE'
GROUP BY f.flock_id, f.flock_name, f.start_date, fh.harvest_date, fh.total_birds_harvested, fh.average_weight_kg, fh.sale_price_total, fh.expenses_harvest;

-- Partner Financial View
CREATE VIEW partner_roi_summary AS
SELECT 
  u.user_id,
  u.full_name,
  f.farm_id,
  f.name as farm_name,
  COALESCE(SUM(pc.amount), 0) as total_contributed,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END), 0) as farm_income,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as farm_expenses,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as gross_profit
FROM users u
LEFT JOIN partner_contributions pc ON u.user_id = pc.user_id
LEFT JOIN farms f ON pc.farm_id = f.farm_id
LEFT JOIN transactions t ON f.farm_id = t.farm_id
WHERE u.role = 'PARTNER'
GROUP BY u.user_id, u.full_name, f.farm_id, f.name;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE flocks IS 'Tracks poultry batches/flocks - each batch has its own lifecycle from purchase to harvest';
COMMENT ON TABLE plantings IS 'Tracks individual crop plantings - one row per planting event (same crop can be planted multiple times per season)';
COMMENT ON TABLE reminders IS 'Recurring tasks that should happen daily/weekly/monthly - auto-generates task_log entries';
COMMENT ON TABLE transactions IS 'All farm expenses and income - central ledger for financial tracking';
COMMENT ON TABLE partner_contributions IS 'Tracks Dylan''s capital contributions for ROI calculations';
COMMENT ON COLUMN transactions.related_flock_id IS 'Link expense/income to specific flock for profitability analysis';
COMMENT ON COLUMN transactions.related_planting_id IS 'Link expense/income to specific crop planting for yield analysis';
