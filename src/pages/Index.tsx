
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import ChatDemoExample from "@/components/ChatDemoExample";
import SubscriptionRequired from "@/components/SubscriptionRequired";
import DebugPanel from "@/components/DebugPanel";

const Index = () => {
  console.log('🏠 Index page rendered');
  
  const [searchParams] = useSearchParams();
  const [showSubscriptionRequired, setShowSubscriptionRequired] = useState(false);

  useEffect(() => {
    console.log('🔍 Index useEffect - checking URL params');
    const subscriptionRequired = searchParams.get('subscription_required');
    console.log('Subscription required param:', subscriptionRequired);
    
    if (subscriptionRequired === 'true') {
      console.log('✅ Setting showSubscriptionRequired to true');
      setShowSubscriptionRequired(true);
    }
  }, [searchParams]);

  console.log('📊 Index render state:', { showSubscriptionRequired });

  if (showSubscriptionRequired) {
    console.log('🔒 Rendering SubscriptionRequired component');
    return (
      <>
        <SubscriptionRequired />
        <DebugPanel />
      </>
    );
  }

  console.log('🏡 Rendering main homepage');
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Hero />
      {/* Espacio entre hero y demo */}
      <div className="h-6 md:h-12" />
      <ChatDemoExample />
      <div className="h-6 md:h-12" />
      <Features />
      <Pricing />
      {/* Espacio para FAQ futura */}
      <div className="h-10" />
      <Testimonials />
      <Footer />
      <DebugPanel />
    </div>
  );
};

export default Index;
