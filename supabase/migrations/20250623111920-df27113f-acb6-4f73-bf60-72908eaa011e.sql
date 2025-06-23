
-- Añadir plan Demo a la función de límites
CREATE OR REPLACE FUNCTION get_plan_limit(plan_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE plan_tier
    WHEN 'Demo' THEN RETURN 3;
    WHEN 'Básico' THEN RETURN 100;
    WHEN 'Profesional' THEN RETURN 3000;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Crear tabla para rastrear registros de demo por IP
CREATE TABLE public.demo_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  UNIQUE(ip_address, registration_date)
);

-- Habilitar RLS
ALTER TABLE public.demo_registrations ENABLE ROW LEVEL SECURITY;

-- Política para que solo puedan ver sus propios registros
CREATE POLICY "Users can view their own demo registrations" 
  ON public.demo_registrations 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Añadir columna is_demo_user a user_usage
ALTER TABLE public.user_usage ADD COLUMN is_demo_user BOOLEAN NOT NULL DEFAULT false;

-- Función para verificar si una IP puede registrar un demo hoy
CREATE OR REPLACE FUNCTION can_register_demo(check_ip TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 
    FROM public.demo_registrations 
    WHERE ip_address = check_ip 
    AND registration_date = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
