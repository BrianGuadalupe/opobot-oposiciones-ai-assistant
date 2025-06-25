import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Calendar, TrendingUp } from 'lucide-react';
import { useQueryLimits } from '@/hooks/useQueryLimits';
import { useSubscription } from '@/hooks/useSubscription';

const UsageDisplay = () => {
  const { usageData, isLoading } = useQueryLimits();
  const { subscription_tier } = useSubscription();

  if (isLoading || !usageData) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-2 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { queriesUsed, queriesRemaining, usagePercentage, monthlyLimit } = usageData;

  const getUsageColor = () => {
    if (usagePercentage >= 90) return 'text-red-600';
    if (usagePercentage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500';
    if (usagePercentage >= 75) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getUsageStatus = () => {
    if (queriesRemaining <= 0) return 'Límite alcanzado';
    if (usagePercentage >= 90) return 'Uso alto';
    if (usagePercentage >= 75) return 'Uso moderado';
    return 'Uso normal';
  };

  const getPlanDisplayName = () => {
    switch (subscription_tier) {
      case 'Básico': return 'Plan Básico';
      case 'Profesional': return 'Plan Profesional';
      case 'Academias': return 'Plan Academias';
      case 'Demo': return 'Demo Gratuito';
      default: return 'Sin plan';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Uso de Consultas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan actual */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Plan actual:</span>
          <Badge variant="outline">{getPlanDisplayName()}</Badge>
        </div>

        {/* Progreso de uso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progreso del período:</span>
            <span className={getUsageColor()}>
              {queriesUsed} / {monthlyLimit}
            </span>
          </div>
          
          <Progress 
            value={usagePercentage} 
            className={`h-3 ${getProgressColor()}`}
          />
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>{usagePercentage.toFixed(1)}% utilizado</span>
            <span>{queriesRemaining} restantes</span>
          </div>
        </div>

        {/* Estado del uso */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">Estado:</span>
          </div>
          <Badge 
            variant={queriesRemaining <= 0 ? "destructive" : "default"}
            className={getUsageColor()}
          >
            {getUsageStatus()}
          </Badge>
        </div>

        {/* Información adicional */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            <span>Límites se renuevan con cada período de suscripción</span>
          </div>
          <div>
            <span>• Plan Básico: 100 consultas por período</span>
          </div>
          <div>
            <span>• Plan Profesional: 3.000 consultas por período</span>
          </div>
          <div>
            <span>• Plan Academias: 30.000 consultas por período</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageDisplay; 