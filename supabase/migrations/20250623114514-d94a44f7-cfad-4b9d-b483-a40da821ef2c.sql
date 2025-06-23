
-- Corregir los usuarios de prueba con campos NULL apropiados
DO $$
DECLARE
    basic_user_id UUID;
    pro_user_id UUID;
    demo_user_id UUID;
    existing_ids UUID[];
BEGIN
    -- Obtener IDs de usuarios existentes con estos emails
    SELECT array_agg(id) INTO existing_ids 
    FROM auth.users 
    WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    
    -- Limpiar todas las tablas relacionadas usando los IDs existentes
    IF existing_ids IS NOT NULL THEN
        DELETE FROM public.query_logs WHERE user_id = ANY(existing_ids);
        DELETE FROM public.user_usage WHERE user_id = ANY(existing_ids);
        DELETE FROM public.demo_registrations WHERE user_id = ANY(existing_ids);
        DELETE FROM public.subscribers WHERE user_id = ANY(existing_ids);
        DELETE FROM public.profiles WHERE id = ANY(existing_ids);
    END IF;
    
    -- Limpiar también por email como medida adicional
    DELETE FROM public.user_usage WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    DELETE FROM public.demo_registrations WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    DELETE FROM public.subscribers WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    DELETE FROM public.profiles WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    
    -- Eliminar usuarios de auth
    DELETE FROM auth.users WHERE email IN ('admin_basic@opobots.com', 'admin_pro@opobots.com', 'admin_demo@opobots.com');
    
    -- Generar nuevos IDs únicos
    basic_user_id := gen_random_uuid();
    pro_user_id := gen_random_uuid();
    demo_user_id := gen_random_uuid();
    
    -- Crear usuarios en auth.users con campos NULL apropiados
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        confirmation_sent_at,
        recovery_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at,
        is_anonymous,
        created_at,
        updated_at,
        raw_user_meta_data,
        raw_app_meta_data
    ) VALUES 
        (basic_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_basic@opobots.com', crypt('password123', gen_salt('bf')), now(), '', '', '', '', NULL, NULL, '', '', now(), now(), '', 0, NULL, '', now(), false, NULL, false, now(), now(), '{"full_name": "Admin Básico"}'::jsonb, '{}'::jsonb),
        (pro_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_pro@opobots.com', crypt('password123', gen_salt('bf')), now(), '', '', '', '', NULL, NULL, '', '', now(), now(), '', 0, NULL, '', now(), false, NULL, false, now(), now(), '{"full_name": "Admin Profesional"}'::jsonb, '{}'::jsonb),
        (demo_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_demo@opobots.com', crypt('password123', gen_salt('bf')), now(), '', '', '', '', NULL, NULL, '', '', now(), now(), '', 0, NULL, '', now(), false, NULL, false, now(), now(), '{"full_name": "Admin Demo"}'::jsonb, '{}'::jsonb);

    -- Esperar un momento para que los triggers se ejecuten
    PERFORM pg_sleep(0.1);

    -- Crear perfiles solo si no fueron creados por el trigger
    INSERT INTO public.profiles (id, email, full_name) 
    SELECT basic_user_id, 'admin_basic@opobots.com', 'Admin Básico'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = basic_user_id);
    
    INSERT INTO public.profiles (id, email, full_name) 
    SELECT pro_user_id, 'admin_pro@opobots.com', 'Admin Profesional'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = pro_user_id);
    
    INSERT INTO public.profiles (id, email, full_name) 
    SELECT demo_user_id, 'admin_demo@opobots.com', 'Admin Demo'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = demo_user_id);

    -- Crear suscripciones para usuarios básico y profesional
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, subscription_end) VALUES
        (basic_user_id, 'admin_basic@opobots.com', true, 'Básico', now() + interval '1 year'),
        (pro_user_id, 'admin_pro@opobots.com', true, 'Profesional', now() + interval '1 year');

    -- Crear registro de demo para usuario demo
    INSERT INTO public.demo_registrations (user_id, email, ip_address) VALUES
        (demo_user_id, 'admin_demo@opobots.com', '127.0.0.1');

    -- Crear registros de uso para cada usuario
    INSERT INTO public.user_usage (
        user_id, 
        email, 
        is_active, 
        is_demo_user, 
        subscription_tier, 
        queries_remaining_this_month,
        current_period_start,
        current_period_end
    ) VALUES
        (basic_user_id, 'admin_basic@opobots.com', true, false, 'Básico', 100, date_trunc('month', now()), (date_trunc('month', now()) + interval '1 month' - interval '1 day')),
        (pro_user_id, 'admin_pro@opobots.com', true, false, 'Profesional', 3000, date_trunc('month', now()), (date_trunc('month', now()) + interval '1 month' - interval '1 day')),
        (demo_user_id, 'admin_demo@opobots.com', true, true, 'Demo', 3, date_trunc('month', now()), (date_trunc('month', now()) + interval '1 month' - interval '1 day'));

    RAISE NOTICE 'Usuarios de prueba creados exitosamente:';
    RAISE NOTICE 'Admin Básico ID: %', basic_user_id;
    RAISE NOTICE 'Admin Pro ID: %', pro_user_id;
    RAISE NOTICE 'Admin Demo ID: %', demo_user_id;
END
$$;
