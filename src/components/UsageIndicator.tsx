
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { useQueryLimits } from '@/hooks/useQueryLimits';

const UsageIndicator = () => {
  const { usageData } = useQueryLimits();

  // Solo mostrar cuando no hay datos de uso o cuando el uso es >= 90%
  if (!usageData || usageData.usagePercentage < 90) return null;

  const { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit } = usageData;
  
  const getProgressColor = () => {
    if (usagePercentage >= 95) return 'bg-red-500';
    return 'bg-orange-500';
  };

  const getTextColor = () => {
    if (usagePercentage >= 95) return 'text-red-600';
    return 'text-orange-600';
  };

  const getWarningMessage = () => {
    if (usagePercentage >= 100) {
      return '¡Has alcanzado tu límite mensual!';
    } else if (usagePercentage >= 95) {
      return '¡Estás muy cerca del límite!';
    }
    return '¡Te estás acercando al límite!';
  };

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700">
            {getWarningMessage()}
          </span>
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
            className={`h-2 ${getProgressColor()}`}
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
