
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import ChatDemoExample from "@/components/ChatDemoExample";
import SubscriptionRequired from "@/components/SubscriptionRequired";

const Index = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [showSubscriptionRequired, setShowSubscriptionRequired] = useState(false);

  useEffect(() => {
    const subscriptionRequired = searchParams.get('subscription_required');
    if (subscriptionRequired === 'true' && user) {
      setShowSubscriptionRequired(true);
    }
  }, [searchParams, user]);

  // If user needs subscription, show the subscription required component
  if (showSubscriptionRequired) {
    return <SubscriptionRequired />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <Hero />
        <ChatDemoExample />
        <Features />
        <Pricing />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
