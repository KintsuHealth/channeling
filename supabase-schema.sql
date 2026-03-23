-- BeanDex Multi-User Schema
-- Run this in Supabase SQL Editor

-- User settings (replaces localStorage settings)
CREATE TABLE public.user_settings (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  dose_g NUMERIC DEFAULT 18,
  baseline_grind NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coffees table
CREATE TABLE public.coffees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT,
  country TEXT,
  region TEXT,
  variety TEXT,
  producer TEXT,
  roaster TEXT,
  roast_level TEXT,
  process TEXT,
  altitude TEXT,
  altitude_category TEXT,
  weight TEXT,
  price TEXT,
  tasting_notes TEXT,
  roast_date DATE,
  bag_color TEXT,
  text_color TEXT,
  label_image_url TEXT,
  status TEXT DEFAULT 'frozen',
  grams_total INTEGER,
  portions JSONB DEFAULT '[]',
  portion_index INTEGER DEFAULT 0,
  doses_used INTEGER DEFAULT 0,
  dose_g NUMERIC,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  frozen_at TIMESTAMPTZ,
  pulled_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  rested_at TIMESTAMPTZ,
  days_rested INTEGER,
  espresso JSONB,
  favorite BOOLEAN DEFAULT FALSE,
  rating INTEGER DEFAULT 0,
  grind_offset_prediction NUMERIC,
  grind_offset_rationale TEXT[],
  grind_confidence TEXT
);

CREATE INDEX idx_coffees_user_status ON public.coffees(user_id, status);

-- Row Level Security (users only see their own data)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own coffees" ON public.coffees
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create settings on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Storage bucket for label images
-- Create this manually in Supabase Dashboard:
-- 1. Go to Storage > New bucket
-- 2. Name: label-images
-- 3. Public: Yes
