-- ENABLE UUID EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════
-- USERS & AUTHENTICATION
-- ═══════════════════════════════════

CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL
    CHECK (role IN (
      'municipality_admin',
      'municipality_officer',
      'citizen',
      'recycling_manager',
      'recycling_operator',
      'government_agency',
      'private_company',
      'community_group'
    )),
  organization_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_image_url TEXT,
  wallet_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- ═══════════════════════════════════
-- SMART BINS
-- ═══════════════════════════════════

CREATE TABLE bins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bin_id VARCHAR(20) UNIQUE NOT NULL,
  location_lat DECIMAL(10,8) NOT NULL,
  location_lng DECIMAL(11,8) NOT NULL,
  address TEXT,
  zone VARCHAR(100),
  ward VARCHAR(100),
  fill_level INTEGER DEFAULT 0
    CHECK (fill_level BETWEEN 0 AND 100),
  waste_type VARCHAR(30)
    CHECK (waste_type IN (
      'general','recyclable','organic',
      'hazardous','electronic'
    )),
  weight_kg DECIMAL(8,2) DEFAULT 0,
  capacity_kg DECIMAL(8,2) DEFAULT 100,
  sensor_status VARCHAR(20) DEFAULT 'active'
    CHECK (sensor_status IN (
      'active','inactive','maintenance'
    )),
  battery_level INTEGER DEFAULT 100,
  last_collected TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  installed_date DATE,
  assigned_recycling_plant_id UUID,
  is_smart BOOLEAN DEFAULT TRUE
);

-- ═══════════════════════════════════
-- VEHICLES
-- ═══════════════════════════════════

CREATE TABLE vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id VARCHAR(20) UNIQUE NOT NULL,
  vehicle_number VARCHAR(30),
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  driver_user_id UUID REFERENCES users(id),
  current_lat DECIMAL(10,8),
  current_lng DECIMAL(11,8),
  capacity_kg DECIMAL(8,2) DEFAULT 5000,
  current_load_kg DECIMAL(8,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'available'
    CHECK (status IN (
      'available','collecting',
      'full','maintenance','offline'
    )),
  vehicle_type VARCHAR(30) DEFAULT 'collection_truck',
  fuel_level INTEGER DEFAULT 100,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  assigned_zone VARCHAR(100),
  municipality_id UUID REFERENCES users(id)
);

-- ═══════════════════════════════════
-- RECYCLING PLANTS
-- ═══════════════════════════════════

CREATE TABLE recycling_plants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plant_id VARCHAR(20) UNIQUE NOT NULL,
  plant_name VARCHAR(255) NOT NULL,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  address TEXT,
  capacity_kg_per_day DECIMAL(10,2),
  current_load_kg DECIMAL(10,2) DEFAULT 0,
  accepted_waste_types TEXT[],
  manager_user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'operational'
    CHECK (status IN (
      'operational','maintenance',
      'full','offline'
    )),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- COLLECTION EVENTS
-- ═══════════════════════════════════

CREATE TABLE collection_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id VARCHAR(50) UNIQUE NOT NULL,
  bin_id VARCHAR(20) REFERENCES bins(bin_id),
  vehicle_id VARCHAR(20) REFERENCES vehicles(vehicle_id),
  recycling_plant_id UUID REFERENCES recycling_plants(id),
  fill_before INTEGER,
  fill_after INTEGER DEFAULT 5,
  waste_collected_kg DECIMAL(8,2),
  waste_type VARCHAR(30),
  is_compliant BOOLEAN DEFAULT TRUE,
  compliance_score INTEGER DEFAULT 100,
  blockchain_hash VARCHAR(100),
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  notes TEXT
);

-- ═══════════════════════════════════
-- OPTIMIZED ROUTES
-- ═══════════════════════════════════

CREATE TABLE routes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id VARCHAR(20) REFERENCES vehicles(vehicle_id),
  total_bins INTEGER,
  total_distance_km DECIMAL(8,2),
  traditional_distance_km DECIMAL(8,2),
  distance_saved_km DECIMAL(8,2),
  estimated_duration_minutes INTEGER,
  fuel_cost DECIMAL(8,2),
  fuel_saved DECIMAL(8,2),
  route_data JSONB,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN (
      'pending','active',
      'completed','cancelled'
    )),
  generated_by VARCHAR(50) DEFAULT 'route_agent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ═══════════════════════════════════
-- AI PREDICTIONS
-- ═══════════════════════════════════

CREATE TABLE predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bin_id VARCHAR(20) REFERENCES bins(bin_id),
  current_fill INTEGER,
  predicted_fill_6hrs INTEGER,
  predicted_fill_12hrs INTEGER,
  overflow_risk BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20)
    CHECK (priority IN (
      'CRITICAL','HIGH',
      'MEDIUM','LOW'
    )),
  confidence DECIMAL(5,2),
  time_to_overflow_mins INTEGER,
  recommended_action TEXT,
  model_version VARCHAR(20),
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  actual_fill_6hrs INTEGER,
  was_accurate BOOLEAN
);

-- ═══════════════════════════════════
-- BIN FILL HISTORY
-- ═══════════════════════════════════

CREATE TABLE bin_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bin_id VARCHAR(20) REFERENCES bins(bin_id),
  fill_level INTEGER NOT NULL,
  weight_kg DECIMAL(8,2),
  waste_type VARCHAR(30),
  battery_level INTEGER,
  temperature DECIMAL(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- ALERTS
-- ═══════════════════════════════════

CREATE TABLE alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_type VARCHAR(50)
    CHECK (alert_type IN (
      'bin_critical','bin_overflow',
      'vehicle_breakdown','illegal_dumping',
      'compliance_violation',
      'sensor_failure','plant_full',
      'collection_delayed'
    )),
  severity VARCHAR(20)
    CHECK (severity IN (
      'low','medium','high','critical'
    )),
  title VARCHAR(255),
  message TEXT,
  bin_id VARCHAR(20),
  vehicle_id VARCHAR(20),
  plant_id UUID,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- CITIZEN TOKENS
-- ═══════════════════════════════════

CREATE TABLE citizen_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  token_balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_redeemed INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ,
  recycling_count INTEGER DEFAULT 0,
  total_waste_kg DECIMAL(10,2) DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- TOKEN TRANSACTIONS
-- ═══════════════════════════════════

CREATE TABLE token_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(30)
    CHECK (action IN (
      'earned','redeemed',
      'bonus','penalty'
    )),
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  waste_type VARCHAR(30),
  weight_kg DECIMAL(8,2),
  bin_id VARCHAR(20),
  description TEXT,
  blockchain_hash VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- WASTE REPORTS (Citizens)
-- ═══════════════════════════════════

CREATE TABLE waste_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id VARCHAR(50) UNIQUE NOT NULL,
  reported_by UUID REFERENCES users(id),
  report_type VARCHAR(50)
    CHECK (report_type IN (
      'illegal_dumping','bin_overflow',
      'damaged_bin','missed_collection',
      'general_complaint'
    )),
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  address TEXT,
  description TEXT,
  image_url TEXT,
  bin_id VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN (
      'pending','investigating',
      'resolved','rejected'
    )),
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- RECYCLING INTAKE RECORDS
-- ═══════════════════════════════════

CREATE TABLE recycling_intake (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  intake_id VARCHAR(50) UNIQUE NOT NULL,
  plant_id UUID REFERENCES recycling_plants(id),
  vehicle_id VARCHAR(20),
  collection_event_id UUID REFERENCES collection_events(id),
  waste_type VARCHAR(30),
  gross_weight_kg DECIMAL(10,2),
  net_weight_kg DECIMAL(10,2),
  quality_grade VARCHAR(10)
    CHECK (quality_grade IN (
      'A','B','C','rejected'
    )),
  processing_status VARCHAR(30) DEFAULT 'received'
    CHECK (processing_status IN (
      'received','sorting','processing',
      'completed','rejected'
    )),
  blockchain_hash VARCHAR(100),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

-- ═══════════════════════════════════
-- SUPABASE ROLE GRANTS
-- Ensure backend service_role can read/write all tables.
-- Run these statements in your Supabase SQL editor after creating tables.
-- ═══════════════════════════════════

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

-- ═══════════════════════════════════
-- VIOLATIONS
-- ═══════════════════════════════════

CREATE TABLE violations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  violation_id VARCHAR(50) UNIQUE,
  collection_event_id UUID REFERENCES collection_events(id),
  vehicle_id VARCHAR(20),
  violation_type VARCHAR(50),
  failed_checks JSONB,
  penalty_amount DECIMAL(8,2) DEFAULT 0,
  penalty_applied BOOLEAN DEFAULT FALSE,
  blockchain_hash VARCHAR(100),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- BLOCKCHAIN LOGS
-- ═══════════════════════════════════

CREATE TABLE blockchain_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_type VARCHAR(50),
  related_id VARCHAR(100),
  tx_hash VARCHAR(100) UNIQUE,
  block_number INTEGER,
  gas_used INTEGER,
  status VARCHAR(20) DEFAULT 'confirmed',
  data JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════

CREATE INDEX idx_bin_history_bin_id ON bin_history(bin_id);
CREATE INDEX idx_bin_history_recorded ON bin_history(recorded_at DESC);
CREATE INDEX idx_collection_events_date ON collection_events(collected_at DESC);
CREATE INDEX idx_predictions_bin_id ON predictions(bin_id);
CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved, created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_token_tx_user ON token_transactions(user_id);
CREATE INDEX idx_waste_reports_status ON waste_reports(status, created_at DESC);
CREATE INDEX idx_recycling_intake_plant ON recycling_intake(plant_id, received_at);

-- ═══════════════════════════════════
-- ENABLE ROW LEVEL SECURITY
-- ═══════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════
-- ENABLE REALTIME
-- ═══════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE bins;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE collection_events;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE recycling_intake;
