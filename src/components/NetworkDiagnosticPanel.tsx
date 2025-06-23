
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { networkDiagnostics } from '@/utils/networkDiagnostics';
import { useAuth } from '@/hooks/useAuth';

const NetworkDiagnosticPanel = () => {
  const { session } = useAuth();
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [testing, setTesting] = useState(false);

  const runDiagnostics = async () => {
    if (!session?.access_token) {
      console.log('No access token available');
      return;
    }

    setTesting(true);
    console.log('🔍 STARTING COMPREHENSIVE NETWORK DIAGNOSTICS...');
    
    const results: any = {};
    
    // Test 1: Basic connectivity
    console.log('Running connectivity test...');
    results.connectivity = await networkDiagnostics.testSupabaseConnection();
    
    // Test 2: Direct function call with default plan
    console.log('Running direct function test...');
    results.directCall = await networkDiagnostics.testDirectFunctionCall(session.access_token, 'Profesional');
    
    setDiagnostics(results);
    setTesting(false);
    
    console.log('🔍 DIAGNOSTICS COMPLETE:', results);
  };

  return (
    <Card className="mt-4 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-orange-800 flex items-center gap-2">
          🔧 Network Diagnostics Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={testing || !session?.access_token}
          variant="outline"
          className="w-full"
        >
          {testing ? 'Running Diagnostics...' : 'Run Network Tests'}
        </Button>
        
        {!session?.access_token && (
          <Badge variant="destructive">Please login first</Badge>
        )}
        
        {Object.keys(diagnostics).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Test Results:</h4>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Supabase Connectivity:</span>
              <Badge variant={diagnostics.connectivity ? "default" : "destructive"}>
                {diagnostics.connectivity ? "✅ Connected" : "❌ Failed"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Direct Function Call:</span>
              <Badge variant={diagnostics.directCall?.success ? "default" : "destructive"}>
                {diagnostics.directCall?.success ? "✅ Success" : "❌ Failed"}
              </Badge>
              {diagnostics.directCall?.status && (
                <span className="text-xs text-gray-600">
                  Status: {diagnostics.directCall.status}
                </span>
              )}
            </div>
            
            {diagnostics.directCall?.body && (
              <div className="text-xs bg-gray-100 p-2 rounded">
                <strong>Response:</strong> {diagnostics.directCall.body.substring(0, 200)}...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkDiagnosticPanel;
