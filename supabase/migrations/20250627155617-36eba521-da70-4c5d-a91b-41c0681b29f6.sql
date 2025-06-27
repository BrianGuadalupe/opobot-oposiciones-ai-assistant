
-- Actualizar la función get_plan_limit para incluir el plan 'Academias'
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

-- Asegurar que las políticas RLS estén correctamente configuradas para user_usage
DROP POLICY IF EXISTS "Users can view their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_usage;

CREATE POLICY "Users can view their own usage" 
  ON public.user_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user usage" 
  ON public.user_usage 
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Asegurar que las políticas RLS estén correctamente configuradas para query_logs
DROP POLICY IF EXISTS "Users can view their own query logs" ON public.query_logs;
DROP POLICY IF EXISTS "Users can insert their own query logs" ON public.query_logs;

CREATE POLICY "Users can view their own query logs" 
  ON public.query_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage query logs" 
  ON public.query_logs 
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Asegurar que las políticas RLS estén correctamente configuradas para demo_registrations
DROP POLICY IF EXISTS "Users can view their own demo registrations" ON public.demo_registrations;

CREATE POLICY "Users can view their own demo registrations" 
  ON public.demo_registrations 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage demo registrations" 
  ON public.demo_registrations 
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON public.query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_month_year ON public.query_logs(month_year);
CREATE INDEX IF NOT EXISTS idx_demo_registrations_ip_date ON public.demo_registrations(ip_address, registration_date);
CREATE INDEX IF NOT EXISTS idx_frequent_questions_user_id ON public.frequent_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON public.test_results(user_id);

-- Actualizar la función de cálculo de porcentaje de uso
CREATE OR REPLACE FUNCTION update_usage_percentage()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular el porcentaje de uso basado en el tier de suscripción
  IF NEW.subscription_tier IS NOT NULL THEN
    NEW.usage_percentage = CASE 
      WHEN get_plan_limit(NEW.subscription_tier) > 0 THEN
        (NEW.queries_this_month::DECIMAL / get_plan_limit(NEW.subscription_tier)::DECIMAL) * 100
      ELSE 0
    END;
  ELSE
    NEW.usage_percentage = 0;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar automáticamente el porcentaje de uso
DROP TRIGGER IF EXISTS trigger_update_usage_percentage ON public.user_usage;
CREATE TRIGGER trigger_update_usage_percentage
  BEFORE UPDATE ON public.user_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_percentage();

-- Asegurar que la política de academy_contacts permita inserción pública
DROP POLICY IF EXISTS "Only admins can view academy contacts" ON public.academy_contacts;

CREATE POLICY "Public can insert academy contacts" 
  ON public.academy_contacts 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Service role can manage academy contacts" 
  ON public.academy_contacts 
  FOR ALL
  USING (true)
  WITH CHECK (true);
