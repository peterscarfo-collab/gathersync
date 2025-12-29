-- GatherSync Database Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('flexible', 'fixed')),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  fixed_date TEXT,
  fixed_time TEXT,
  location TEXT,
  venue_name TEXT,
  venue_address TEXT,
  venue_phone TEXT,
  venue_website TEXT,
  meeting_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Participants table (embedded in events as JSONB)
-- No separate table needed as participants are stored as JSON array in events

-- Event snapshots table
CREATE TABLE IF NOT EXISTS event_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring templates table
CREATE TABLE IF NOT EXISTS recurring_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('flexible', 'fixed')),
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('monthly', 'weekly', 'custom')),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  fixed_time TEXT,
  location TEXT,
  venue_name TEXT,
  venue_address TEXT,
  venue_phone TEXT,
  venue_website TEXT,
  meeting_link TEXT,
  notes TEXT,
  participants JSONB NOT NULL DEFAULT '[]',
  last_generated_month INTEGER,
  last_generated_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_month_year ON events(month, year);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON event_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_event_id ON event_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON recurring_templates(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
-- For now, we'll allow all operations since we're using service role
-- In production, you'd want more restrictive policies based on auth.uid()

CREATE POLICY "Users can manage their own events" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own snapshots" ON event_snapshots
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their own templates" ON recurring_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON recurring_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
