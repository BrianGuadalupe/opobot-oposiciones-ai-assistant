
-- Crear tabla para rastrear el uso de consultas de cada usuario
CREATE TABLE public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  
  -- Consultas del mes actual
  queries_this_month INTEGER NOT NULL DEFAULT 0,
  queries_remaining_this_month INTEGER NOT NULL DEFAULT 0,
  usage_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  
  -- Estadísticas generales
  months_with_active_subscription INTEGER NOT NULL DEFAULT 0,
  total_queries INTEGER NOT NULL DEFAULT 0,
  queries_per_month DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  
  -- Control de período
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month' - interval '1 day'),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Crear tabla para registrar cada consulta individual
CREATE TABLE public.query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response_length INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  month_year TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM')
);

-- Habilitar RLS en ambas tablas
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_usage
CREATE POLICY "Users can view their own usage" 
  ON public.user_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" 
  ON public.user_usage 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" 
  ON public.user_usage 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para query_logs
CREATE POLICY "Users can view their own query logs" 
  ON public.query_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own query logs" 
  ON public.query_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar estadísticas de uso
CREATE OR REPLACE FUNCTION update_user_usage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
CREATE TRIGGER update_user_usage_timestamp
  BEFORE UPDATE ON public.user_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_usage();

-- Función para obtener límite según el plan
CREATE OR REPLACE FUNCTION get_plan_limit(plan_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE plan_tier
    WHEN 'Básico' THEN RETURN 100;
    WHEN 'Profesional' THEN RETURN 3000;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;
