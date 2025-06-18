
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, session } = useAuth();
  const subscription = useSubscription();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const debugInfo = {
    user: {
      exists: !!user,
      id: user?.id,
      email: user?.email,
      emailConfirmed: user?.email_confirmed_at ? 'Yes' : 'No',
    },
    session: {
      exists: !!session,
      accessToken: session?.access_token ? `${session.access_token.substring(0, 20)}...` : 'None',
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'None',
    },
    subscription: {
      subscribed: subscription.subscribed,
      loading: subscription.loading,
      tier: subscription.subscription_tier || 'None',
      end: subscription.subscription_end || 'None',
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      currentUrl: window.location.href,
      userAgent: navigator.userAgent.substring(0, 50) + '...',
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
          >
            <Bug className="w-4 h-4 mr-2" />
            Debug
            {isOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="w-80 max-h-96 overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">User</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo.user, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Session</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo.session, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Subscription</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo.subscription, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Environment</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo.environment, null, 2)}
                </pre>
              </div>
              
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    console.log('=== MANUAL DEBUG INFO ===');
                    console.log('Full debug info:', debugInfo);
                    console.log('Local storage:', localStorage);
                    console.log('Session storage:', sessionStorage);
                  }}
                  className="w-full text-xs"
                >
                  Log Full Debug Info
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default DebugPanel;
