
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { useQueryLimits } from '@/hooks/useQueryLimits';

const UsageIndicator = () => {
  const { usageData } = useQueryLimits();

  if (!usageData) return null;

  const { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit } = usageData;
  
  const getProgressColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (usagePercentage >= 90) return 'text-red-600';
    if (usagePercentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium">Consultas este mes</span>
          {usagePercentage >= 90 && (
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={getTextColor()}>
              {queriesUsed} de {monthlyLimit} consultas
            </span>
            <span className="text-gray-500">
              {queriesRemaining} restantes
            </span>
          </div>
          
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
          
          <div className="text-xs text-gray-500 text-center">
            {usagePercentage.toFixed(1)}% utilizado
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageIndicator;
