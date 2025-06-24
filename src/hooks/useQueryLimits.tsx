
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UsageData {
  queriesUsed: number;
  queriesRemaining: number;
  usagePercentage: number;
  monthlyLimit: number;
}

interface LimitCheckResult {
  canProceed: boolean;
  reason: string;
  message?: string;
  usageData?: UsageData;
}

// Control de concurrencia fuera del hook para evitar múltiples llamadas
let isChecking = false;
let lastCheckResult: LimitCheckResult | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 3000; // 3 segundos de caché

export const useQueryLimits = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const fetchFromManageUsage = async (action: string, body: any = {}): Promise<any> => {
    if (!session) throw new Error('No session');

    console.log(`🔄 Calling manage-usage with action: ${action}`);
    
    const { data, error } = await supabase.functions.invoke('manage-usage', {
      body: { action, ...body },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      console.error('❌ manage-usage error:', error);
      throw error;
    }
    
    console.log(`✅ manage-usage ${action} response:`, data);
    return data;
  };

  const waitUntilReady = async (): Promise<void> => {
    console.log('⏳ waitUntilReady called, initialCheckComplete:', initialCheckComplete);
    
    if (initialCheckComplete) {
      console.log('✅ Already ready, returning immediately');
      return;
    }
    
    console.log('⏳ Waiting for initial check to complete...');
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkReady = () => {
        console.log('🔍 Checking if ready... initialCheckComplete:', initialCheckComplete);
        if (initialCheckComplete) {
          console.log('✅ Ready! Resolving waitUntilReady');
          resolve();
          return;
        }
        
        // Timeout de seguridad después de 10 segundos
        if (Date.now() - startTime > 10000) {
          console.warn('⚠️ waitUntilReady timeout after 10 seconds, resolving anyway');
          resolve();
          return;
        }
        
        // Continuar verificando cada 200ms
        setTimeout(checkReady, 200);
      };
      
      checkReady();
    });
  };

  const checkQueryLimit = async (forceRefresh: boolean = false): Promise<LimitCheckResult> => {
    console.log('=== CHECK QUERY LIMIT START ===');
    console.log('🔍 Force refresh:', forceRefresh);
    console.log('🔍 Initial check complete:', initialCheckComplete);
    console.log('🔍 Is loading:', isLoading);
    console.log('🔍 User/session present:', !!user, !!session);
    
    if (!user || !session) {
      console.log('❌ No user or session for limit check');
      return { 
        canProceed: false, 
        reason: 'no_auth', 
        message: 'Debes iniciar sesión para usar el chat' 
      };
    }

    // NUEVA LÓGICA: No usar caché si no hemos completado el check inicial
    if (!initialCheckComplete && !forceRefresh) {
      console.log('⚠️ Initial check not complete, forcing fresh check');
      forceRefresh = true;
    }

    // Control de concurrencia - pero permitir si es forzado
    if (isChecking && !forceRefresh) {
      console.log('⚠️ Limit check already in progress, using cached or waiting state');
      
      // Si tenemos caché válido, usarlo
      if (lastCheckResult && initialCheckComplete) {
        console.log('📋 Using cached result while checking');
        return lastCheckResult;
      }
      
      // Si no hay caché válido, devolver estado de espera
      return {
        canProceed: false,
        reason: 'checking_in_progress',
        message: 'Verificando límites, espera un momento...',
      };
    }

    // Verificar caché solo si el check inicial está completo
    const now = Date.now();
    if (!forceRefresh && lastCheckResult && initialCheckComplete && (now - lastCheckTime) < CACHE_DURATION) {
      console.log('📋 Using cached limit check result (initial complete)');
      return lastCheckResult;
    }

    isChecking = true;
    setIsLoading(true);
    
    try {
      console.log('🔍 Performing fresh limit check...');
      const data = await fetchFromManageUsage('check_limit');

      const result: LimitCheckResult = {
        canProceed: !!data?.canProceed,
        reason: data?.reason || 'unknown',
        message: data?.message,
        usageData: data?.usageData,
      };

      // Actualizar caché
      lastCheckResult = result;
      lastCheckTime = now;

      if (result.usageData) {
        setUsageData(result.usageData);
      }

      console.log('✅ Limit check completed:', result);
      return result;
      
    } catch (err: any) {
      console.error('❌ Error in checkQueryLimit:', err);
      toast({ 
        title: 'Error', 
        description: `Error al verificar límites: ${err.message || 'desconocido'}`, 
        variant: 'destructive' 
      });
      
      const errorResult: LimitCheckResult = {
        canProceed: false,
        reason: 'error',
        message: err.message || 'Error desconocido'
      };
      
      // No cachear errores
      lastCheckResult = null;
      return errorResult;
      
    } finally {
      isChecking = false;
      setIsLoading(false);
      
      // ✅ CRÍTICO: Marcar como completado SIEMPRE, sin importar resultado
      if (!initialCheckComplete) {
        console.log('✅ Setting initialCheckComplete = true (first check completed)');
        setInitialCheckComplete(true);
      }
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    if (!user || !session) return;
    
    try {
      console.log('📝 Logging query usage...');
      await fetchFromManageUsage('log_query', { queryText, responseLength });
      
      // Invalidar caché después de log para que el próximo check sea fresh
      lastCheckResult = null;
      lastCheckTime = 0;
      
    } catch (err) {
      console.error('❌ Error logging query:', err);
    }
  };

  const loadUsageData = async () => {
    try {
      console.log('📊 Loading initial usage data...');
      const result = await checkQueryLimit(true); // Forzar refresh en carga inicial
      if (result.usageData) {
        setUsageData(result.usageData);
      }
    } catch (err) {
      console.error('❌ Error loading usage data:', err);
    }
  };

  useEffect(() => {
    if (session && user && !initialCheckComplete) {
      console.log('🚀 Initial usage data load...');
      loadUsageData();
    }
  }, [session, user]);

  return {
    usageData,
    isLoading,
    initialCheckComplete,
    checkQueryLimit,
    logQuery,
    loadUsageData,
    waitUntilReady,
  };
};
