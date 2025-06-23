
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const SubscriptionDebugPanel = () => {
  const { user, session } = useAuth();
  const { subscribed, loading, subscription_tier, subscription_end, checkSubscription } = useSubscription();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const handleDebugCheck = async () => {
    if (!user || !session?.access_token) {
      setDebugInfo({ error: 'No user or session available' });
      return;
    }

    setIsDebugging(true);
    setDebugInfo(null);

    try {
      console.log('=== MANUAL DEBUG CHECK START ===');
      
      // 1. Verificar datos del usuario
      const userInfo = {
        userId: user.id,
        email: user.email,
        sessionValid: !!session?.access_token,
        tokenLength: session?.access_token?.length || 0
      };
      
      // 2. Verificar datos en subscribers table
      const { data: subscriberData, error: subscriberError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // 3. Llamar directamente a la función check-subscription
      const startTime = Date.now();
      const { data: functionData, error: functionError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const endTime = Date.now();

      const debugResult = {
        userInfo,
        subscriberData: subscriberError ? { error: subscriberError.message } : subscriberData,
        functionCall: {
          duration: endTime - startTime,
          data: functionData,
          error: functionError?.message || null
        },
        currentHookState: {
          subscribed,
          loading,
          subscription_tier,
          subscription_end
        }
      };

      console.log('Debug result:', debugResult);
      setDebugInfo(debugResult);
      
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const handleForceRefresh = () => {
    checkSubscription(true);
  };

  if (!user) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>🔧 Subscription Debug Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p>User not authenticated</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>🔧 Subscription Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleDebugCheck} disabled={isDebugging}>
            {isDebugging ? 'Debugging...' : 'Run Debug Check'}
          </Button>
          <Button onClick={handleForceRefresh} variant="outline">
            Force Refresh Subscription
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold">Current State:</h4>
            <div className="space-y-1 text-sm">
              <div>Subscribed: <Badge variant={subscribed ? "default" : "secondary"}>{subscribed ? 'Yes' : 'No'}</Badge></div>
              <div>Loading: <Badge variant={loading ? "destructive" : "default"}>{loading ? 'Yes' : 'No'}</Badge></div>
              <div>Tier: {subscription_tier || 'None'}</div>
              <div>End: {subscription_end ? new Date(subscription_end).toLocaleDateString() : 'None'}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold">User Info:</h4>
            <div className="space-y-1 text-sm">
              <div>ID: {user.id.substring(0, 8)}...</div>
              <div>Email: {user.email}</div>
              <div>Session: <Badge variant={session ? "default" : "destructive"}>{session ? 'Valid' : 'Invalid'}</Badge></div>
            </div>
          </div>
        </div>

        {debugInfo && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Debug Results:</h4>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionDebugPanel;
