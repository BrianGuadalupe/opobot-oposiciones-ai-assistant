
import { useAuth } from "@/hooks/useAuth";
import { useQueryLimits } from "@/hooks/useQueryLimits";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SubscriptionRequiredModal from "@/components/SubscriptionRequiredModal";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";
import SubscriptionDebugPanel from "@/components/SubscriptionDebugPanel";

const Index = () => {
  const { user } = useAuth();
  const { subscribed, loading: subscriptionLoading } = useSubscription();
  const { usageData, isLoading: usageLoading } = useQueryLimits();
  const [searchParams] = useSearchParams();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Check if the user is not authenticated and redirect to /auth
  useEffect(() => {
    if (!user && !localStorage.getItem('supabase.auth.token')) {
      window.location.href = '/auth';
    }
  }, [user]);

  // Display a toast message if the user has exceeded their query limits
  useEffect(() => {
    if (!usageLoading && usageData && usageData.queriesRemaining <= 0) {
      toast({
        title: "Límite de Consultas Alcanzado",
        description: "Has alcanzado el límite de consultas gratuitas. Suscríbete para obtener consultas ilimitadas.",
        variant: "destructive",
        action: (
          <Link to="/" onClick={() => setShowSubscriptionModal(true)}>
            Suscribirse
          </Link>
        ),
      });
    }
  }, [usageData, usageLoading, toast]);

  // Check for subscription_required parameter
  useEffect(() => {
    if (searchParams.get('subscription_required') === 'true') {
      setShowSubscriptionModal(true);
    }
  }, [searchParams]);

  // Check for demo_expired parameter
  useEffect(() => {
    if (searchParams.get('demo_expired') === 'true') {
      toast({
        title: "Demo Expirado",
        description: "Has agotado tus consultas de demostración. Suscríbete para continuar usando el chat de Opobot.",
        variant: "destructive",
      });
      setShowSubscriptionModal(true);
    }
  }, [searchParams]);

  // Show forgot password modal if requested
  useEffect(() => {
    if (searchParams.get('show_forgot_password') === 'true') {
      setShowForgotPasswordModal(true);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      
      {/* Debug Panel - TEMPORAL PARA DEBUGGING */}
      {user && (
        <div className="container mx-auto px-4 py-8">
          <SubscriptionDebugPanel />
        </div>
      )}
      
      <Footer />
      
      <SubscriptionRequiredModal 
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
      
      <ForgotPasswordModal 
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
};

export default Index;
