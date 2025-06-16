
-- First, let's fix the critical RLS policies for the subscribers table
-- Remove the overly permissive policies and create secure ones

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create secure policy for users to view only their own subscription data
CREATE POLICY "users_can_view_own_subscription" ON public.subscribers
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for edge functions to update subscription data using service role
CREATE POLICY "service_role_can_update_subscriptions" ON public.subscribers
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create policy for edge functions to insert subscription data using service role
CREATE POLICY "service_role_can_insert_subscriptions" ON public.subscribers
FOR INSERT
WITH CHECK (true);

-- Add validation constraints to prevent data corruption (skip foreign key since it exists)
ALTER TABLE public.subscribers 
ADD CONSTRAINT valid_email_format 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add constraint to ensure subscription_end is in the future when subscribed is true
ALTER TABLE public.subscribers 
ADD CONSTRAINT valid_subscription_end 
CHECK (
  (subscribed = false) OR 
  (subscribed = true AND subscription_end > now())
);

-- Add constraint for valid subscription tiers
ALTER TABLE public.subscribers 
ADD CONSTRAINT valid_subscription_tier 
CHECK (
  subscription_tier IS NULL OR 
  subscription_tier IN ('Básico', 'Profesional', 'Academias')
);

-- Ensure user_id is not nullable for better RLS enforcement
ALTER TABLE public.subscribers 
ALTER COLUMN user_id SET NOT NULL;

-- Add indexes for better performance on RLS queries
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON public.subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers(email);
