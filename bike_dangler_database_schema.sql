-- ============================================
-- BIKE DANGLER INDUSTRIES - FARM MANAGEMENT ERP
-- Database Schema (PostgreSQL)
-- ============================================

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'PARTNER', 'WORKER')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FARM STRUCTURE
-- ============================================

CREATE TABLE farms (
  farm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  total_area_sqm INT,
  owner_id UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fields (
  field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  field_name VARCHAR(255) NOT NULL,
  area_sqm INT,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('GREENHOUSE', 'OPEN_FIELD', 'NURSERY')),
  irrigation VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE buildings (
  building_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  building_name VARCHAR(255) NOT NULL,
  building_type VARCHAR(50) NOT NULL CHECK (building_type IN ('POULTRY_HOUSE', 'STORAGE', 'PROCESSING')),
  capacity INT,
  climate_controlled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- POULTRY MANAGEMENT
-- ============================================

CREATE TABLE flocks (
  flock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  building_id UUID REFERENCES buildings(building_id),
  batch_number VARCHAR(50) NOT NULL,
  bird_count INT NOT NULL,
  bird_type VARCHAR(100) DEFAULT 'Broiler',
  start_date DATE NOT NULL,
  expected_harvest_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HARVESTED', 'CULLED', 'PLANNED')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE flock_daily_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flock_id UUID NOT NULL REFERENCES flocks(flock_id),
  log_date DATE NOT NULL,
  birds_alive INT,
  mortality INT DEFAULT 0,
  feed_given_kg DECIMAL(10,2),
  water_given_liters DECIMAL(10,2),
  health_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE flock_harvesting (
  harvest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flock_id UUID NOT NULL REFERENCES flocks(flock_id),
  harvest_date DATE NOT NULL,
  birds_harvested INT,
  average_weight_kg DECIMAL(10,2),
  total_weight_kg DECIMAL(10,2),
  quality_grade VARCHAR(50),
  buyer_name VARCHAR(255),
  sale_price_per_kg DECIMAL(10,2),
  total_revenue DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CROP MANAGEMENT
-- ============================================

CREATE TABLE crop_varieties (
  variety_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name VARCHAR(255) NOT NULL UNIQUE,
  typical_cycle_days INT,
  typical_yield_kg_per_sqm DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plantings (
  planting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(field_id),
  crop_name VARCHAR(255) NOT NULL,
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  area_planted_sqm INT,
  seed_quantity_kg DECIMAL(10,2),
  seed_cost DECIMAL(10,2),
  expected_yield_kg DECIMAL(10,2),
  current_status VARCHAR(50) NOT NULL DEFAULT 'GROWING' CHECK (current_status IN ('NURSERY', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED', 'FAILED')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE crop_daily_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID NOT NULL REFERENCES plantings(planting_id),
  log_date DATE NOT NULL,
  height_cm DECIMAL(10,2),
  health_status VARCHAR(50),
  pest_observations TEXT,
  irrigation_ml INT,
  fertilizer_applied_kg DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE crop_harvests (
  harvest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id UUID NOT NULL REFERENCES plantings(planting_id),
  harvest_date DATE NOT NULL,
  quantity_harvested_kg DECIMAL(10,2),
  quality_grade VARCHAR(50),
  market_price_per_kg DECIMAL(10,2),
  total_revenue DECIMAL(15,2),
  buyer_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CROP CALENDAR & PLANNING
-- ============================================

CREATE TABLE crop_calendar (
  calendar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  crop_name VARCHAR(255) NOT NULL,
  optimal_planting_month INT,
  nursery_start_month INT,
  nursery_duration_days INT,
  transplant_month INT,
  days_to_harvest INT,
  harvest_start_month INT,
  expected_yield_kg_per_sqm DECIMAL(10,2),
  peak_season_price_per_kg DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE seasonal_plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  season_name VARCHAR(100),
  start_date DATE,
  end_date DATE,
  planned_crops TEXT,
  budget DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INVENTORY MANAGEMENT
-- ============================================

CREATE TABLE inventory_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('FEED', 'SEED', 'FERTILIZER', 'TOOL', 'CHEMICAL', 'OTHER')),
  unit_of_measure VARCHAR(50),
  unit_cost DECIMAL(10,2),
  supplier_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_stock (
  stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(item_id),
  quantity_in_stock DECIMAL(10,2) NOT NULL,
  reorder_level DECIMAL(10,2),
  location VARCHAR(255),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(item_id),
  quantity_used DECIMAL(10,2) NOT NULL,
  usage_date DATE NOT NULL,
  reason VARCHAR(255),
  used_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EQUIPMENT & MAINTENANCE
-- ============================================

CREATE TABLE equipment (
  equipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  equipment_name VARCHAR(255) NOT NULL,
  equipment_type VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(15,2),
  location VARCHAR(255),
  current_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (current_status IN ('ACTIVE', 'MAINTENANCE', 'BROKEN', 'RETIRED')),
  maintenance_frequency_months INT,
  next_maintenance_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maintenance_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(equipment_id),
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100),
  cost DECIMAL(10,2),
  notes TEXT,
  next_due_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TASK & REMINDER MANAGEMENT
-- ============================================

CREATE TABLE reminders (
  reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  reminder_title VARCHAR(255) NOT NULL,
  description TEXT,
  reminder_type VARCHAR(50) CHECK (reminder_type IN ('FEEDING', 'WATERING', 'HARVESTING', 'MAINTENANCE', 'HEALTH_CHECK', 'INSPECTION', 'OTHER')),
  frequency VARCHAR(50) CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'ONCE')),
  assigned_to UUID REFERENCES users(user_id),
  due_date DATE,
  status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
  priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE task_logs (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(reminder_id),
  completed_date DATE,
  completed_by UUID REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FINANCIAL TRACKING
-- ============================================

CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('INCOME', 'EXPENSE')),
  category VARCHAR(100),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE partner_contributions (
  contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  partner_id UUID NOT NULL REFERENCES users(user_id),
  contribution_amount DECIMAL(15,2) NOT NULL,
  contribution_date DATE NOT NULL,
  contribution_type VARCHAR(50) CHECK (contribution_type IN ('CASH', 'EQUIPMENT', 'LABOR', 'MATERIALS')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE financial_summaries (
  summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(farm_id),
  summary_period VARCHAR(50),
  total_income DECIMAL(15,2),
  total_expenses DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SAMPLE DATA
-- ============================================

INSERT INTO farms (name, location, total_area_sqm, owner_id) VALUES 
('Marondera Farm', 'Marondera, Zimbabwe', 5000, (SELECT user_id FROM users WHERE role = 'OWNER' LIMIT 1));

INSERT INTO fields (farm_id, field_name, area_sqm, field_type, irrigation) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Greenhouse North', 200, 'GREENHOUSE', 'DRIP'),
((SELECT farm_id FROM farms LIMIT 1), 'Plot A', 500, 'OPEN_FIELD', 'FLOOD'),
((SELECT farm_id FROM farms LIMIT 1), 'Nursery', 100, 'NURSERY', 'DRIP');

INSERT INTO buildings (farm_id, building_name, building_type, capacity, climate_controlled) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Broiler House 1', 'POULTRY_HOUSE', 500, FALSE),
((SELECT farm_id FROM farms LIMIT 1), 'Storage Shed', 'STORAGE', 1000, FALSE);

INSERT INTO crop_varieties (crop_name, typical_cycle_days, typical_yield_kg_per_sqm) VALUES 
('Green Pepper', 75, 1.5),
('Tsunga', 45, 1.2),
('Cabbage', 90, 2.0);

INSERT INTO equipment (farm_id, equipment_name, equipment_type, purchase_date, purchase_cost, location, current_status, maintenance_frequency_months, next_maintenance_date) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Irrigation Pump', 'PUMP', '2026-06-01', 12000, 'Greenhouse', 'ACTIVE', 3, '2026-11-15'),
((SELECT farm_id FROM farms LIMIT 1), 'Tractor', 'TRACTOR', '2025-01-15', 150000, 'Storage', 'ACTIVE', 6, '2026-10-15');

INSERT INTO crop_calendar (farm_id, crop_name, optimal_planting_month, nursery_start_month, nursery_duration_days, transplant_month, days_to_harvest, harvest_start_month, expected_yield_kg_per_sqm, peak_season_price_per_kg) VALUES 
((SELECT farm_id FROM farms LIMIT 1), 'Green Pepper', 9, 8, 30, 9, 75, 12, 1.5, 250),
((SELECT farm_id FROM farms LIMIT 1), 'Tsunga', 9, 8, 20, 9, 45, 10, 1.2, 150);

-- ============================================
-- VIEWS FOR DASHBOARDS
-- ============================================

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
LEFT JOIN plantings p ON f.farm_id = (SELECT farm_id FROM fields WHERE field_id = p.field_id LIMIT 1) AND p.current_status IN ('GROWING', 'READY_FOR_HARVEST')
LEFT JOIN equipment e ON f.farm_id = e.farm_id
LEFT JOIN transactions t ON f.farm_id = t.farm_id
GROUP BY f.farm_id, f.name;

CREATE VIEW equipment_maintenance_due AS
SELECT 
  e.equipment_id,
  e.equipment_name,
  e.equipment_type,
  e.current_status,
  e.next_maintenance_date,
  CASE 
    WHEN e.next_maintenance_date <= CURRENT_DATE THEN 'OVERDUE'
    WHEN e.next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'DUE THIS WEEK'
    ELSE 'UPCOMING'
  END as maintenance_status
FROM equipment e
WHERE e.current_status = 'ACTIVE'
ORDER BY e.next_maintenance_date;

CREATE VIEW task_checklist AS
SELECT 
  r.reminder_id,
  r.reminder_title,
  r.reminder_type,
  r.priority,
  r.due_date,
  r.assigned_to,
  u.full_name as assigned_to_name,
  r.status
FROM reminders r
LEFT JOIN users u ON r.assigned_to = u.user_id
WHERE r.status = 'ACTIVE'
ORDER BY r.priority DESC, r.due_date ASC;

CREATE VIEW flock_profitability AS
SELECT 
  f.flock_id,
  f.batch_number,
  f.start_date,
  fh.harvest_date,
  fh.birds_harvested,
  fh.total_revenue,
  COALESCE(SUM(cdl.feed_given_kg * (SELECT unit_cost FROM inventory_items ii WHERE ii.item_name LIKE '%feed%' LIMIT 1)), 0) as feed_cost,
  (fh.total_revenue - COALESCE(SUM(cdl.feed_given_kg * (SELECT unit_cost FROM inventory_items ii WHERE ii.item_name LIKE '%feed%' LIMIT 1)), 0)) as profit
FROM flocks f
LEFT JOIN flock_daily_logs cdl ON f.flock_id = cdl.flock_id
LEFT JOIN flock_harvesting fh ON f.flock_id = fh.flock_id
GROUP BY f.flock_id, f.batch_number, f.start_date, fh.harvest_date, fh.birds_harvested, fh.total_revenue;

CREATE VIEW partner_roi_summary AS
SELECT 
  pc.partner_id,
  u.full_name as partner_name,
  SUM(pc.contribution_amount) as total_contributed,
  SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END) as farm_income,
  SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END) as farm_expenses,
  (SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END)) as gross_profit,
  ROUND(((SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount ELSE 0 END) - SUM(pc.contribution_amount)) / NULLIF(SUM(pc.contribution_amount), 0) * 100), 2) as roi_percentage
FROM partner_contributions pc
LEFT JOIN users u ON pc.partner_id = u.user_id
LEFT JOIN transactions t ON pc.farm_id = t.farm_id
GROUP BY pc.partner_id, u.full_name;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_farms_owner_id ON farms(owner_id);
CREATE INDEX idx_fields_farm_id ON fields(farm_id);
CREATE INDEX idx_flocks_farm_id ON flocks(farm_id);
CREATE INDEX idx_flocks_status ON flocks(status);
CREATE INDEX idx_plantings_field_id ON plantings(field_id);
CREATE INDEX idx_plantings_status ON plantings(current_status);
CREATE INDEX idx_transactions_farm_id ON transactions(farm_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_reminders_farm_id ON reminders(farm_id);
CREATE INDEX idx_reminders_status ON reminders(status);

-- ============================================
-- END OF SCHEMA
-- ============================================
