
-- Actualizar la función para verificar correctamente los límites de demo
CREATE OR REPLACE FUNCTION can_register_demo(check_ip TEXT, check_email TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  -- Si se proporciona email, verificar que ese email no tenga demo ya
  IF check_email IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 
      FROM public.demo_registrations 
      WHERE email = check_email
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Verificar que la IP no haya registrado un demo hoy
  RETURN NOT EXISTS (
    SELECT 1 
    FROM public.demo_registrations 
    WHERE ip_address = check_ip 
    AND registration_date = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
