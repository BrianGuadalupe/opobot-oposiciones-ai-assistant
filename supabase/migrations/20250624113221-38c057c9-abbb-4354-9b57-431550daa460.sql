
-- Función para sincronizar datos de subscriber con user_usage
CREATE OR REPLACE FUNCTION sync_subscriber_to_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es una inserción o el estado de suscripción cambió
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.subscribed != NEW.subscribed) THEN
    
    -- Crear o actualizar registro en user_usage
    INSERT INTO public.user_usage (
      user_id,
      email,
      is_active,
      subscription_tier,
      queries_remaining_this_month,
      is_demo_user
    ) 
    VALUES (
      NEW.user_id,
      NEW.email,
      NEW.subscribed,
      NEW.subscription_tier,
      CASE 
        WHEN NEW.subscribed AND NEW.subscription_tier IS NOT NULL THEN 
          public.get_plan_limit(NEW.subscription_tier)
        ELSE 0
      END,
      false
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      email = NEW.email,
      is_active = NEW.subscribed,
      subscription_tier = NEW.subscription_tier,
      queries_remaining_this_month = CASE 
        WHEN NEW.subscribed AND NEW.subscription_tier IS NOT NULL THEN 
          public.get_plan_limit(NEW.subscription_tier)
        ELSE 0
      END,
      updated_at = now();
      
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para sincronizar automáticamente
CREATE TRIGGER sync_subscriber_data
  AFTER INSERT OR UPDATE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscriber_to_user_usage();

-- Sincronizar datos existentes (para subscribers que ya existen)
INSERT INTO public.user_usage (
  user_id,
  email,
  is_active,
  subscription_tier,
  queries_remaining_this_month,
  is_demo_user
)
SELECT 
  s.user_id,
  s.email,
  s.subscribed,
  s.subscription_tier,
  CASE 
    WHEN s.subscribed AND s.subscription_tier IS NOT NULL THEN 
      public.get_plan_limit(s.subscription_tier)
    ELSE 0
  END,
  false
FROM public.subscribers s
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_usage u WHERE u.user_id = s.user_id
);
