
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, Star } from "lucide-react";

interface SubscriptionRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionRequiredModal = ({ isOpen, onClose }: SubscriptionRequiredModalProps) => {
  const navigate = useNavigate();

  const handleSubscribe = () => {
    onClose();
    navigate("/?subscription_required=true");
  };

  const handleCancel = () => {
    onClose();
    navigate("/");
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-orange-600" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-bold">
            Suscripción Requerida
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-600">
            Para acceder al Chat IA de Opobot necesitas una suscripción activa. 
            Elige uno de nuestros planes y comienza a estudiar con nuestro asistente inteligente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4">
          <div className="bg-gradient-to-r from-opobot-blue/10 to-opobot-green/10 p-4 rounded-lg border border-opobot-blue/20">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-opobot-blue" />
              <span className="font-semibold text-opobot-blue">Más Popular</span>
            </div>
            <h3 className="font-bold text-lg mb-1">Plan Profesional</h3>
            <p className="text-sm text-gray-600 mb-2">Consultas ilimitadas y acceso completo</p>
            <div className="flex items-center">
              <span className="text-2xl font-bold text-gray-900">€19,95</span>
              <span className="text-gray-600 ml-2">/mes</span>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} className="w-full sm:w-auto">
            Volver al Inicio
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleSubscribe}
            className="w-full sm:w-auto bg-opobot-blue hover:bg-opobot-blue-dark"
          >
            Ver Planes de Suscripción
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SubscriptionRequiredModal;
