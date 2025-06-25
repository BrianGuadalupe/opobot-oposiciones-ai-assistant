-- Actualizar límites de consultas por período de suscripción
-- Esta migración actualiza los límites existentes para que coincidan con los nuevos valores

-- Actualizar la función get_plan_limit con los nuevos límites
CREATE OR REPLACE FUNCTION get_plan_limit(plan_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE plan_tier
    WHEN 'Demo' THEN RETURN 3;
    WHEN 'Básico' THEN RETURN 100;
    WHEN 'Profesional' THEN RETURN 3000;
    WHEN 'Academias' THEN RETURN 30000;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Actualizar los límites existentes en user_usage para usuarios activos
UPDATE public.user_usage 
SET 
  queries_remaining_this_month = CASE 
    WHEN subscription_tier = 'Básico' THEN 100
    WHEN subscription_tier = 'Profesional' THEN 3000
    WHEN subscription_tier = 'Academias' THEN 30000
    WHEN subscription_tier = 'Demo' THEN 3
    ELSE queries_remaining_this_month
  END,
  updated_at = now()
WHERE is_active = true AND subscription_tier IS NOT NULL;

-- Actualizar también los usuarios de prueba existentes
UPDATE public.user_usage 
SET 
  queries_remaining_this_month = CASE 
    WHEN subscription_tier = 'Básico' THEN 100
    WHEN subscription_tier = 'Profesional' THEN 3000
    WHEN subscription_tier = 'Academias' THEN 30000
    WHEN subscription_tier = 'Demo' THEN 3
    ELSE queries_remaining_this_month
  END,
  updated_at = now()
WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');

-- Agregar comentario explicativo
COMMENT ON FUNCTION get_plan_limit(TEXT) IS 'Retorna el límite de consultas por período de suscripción: Demo=3, Básico=100, Profesional=3000, Academias=30000'; 