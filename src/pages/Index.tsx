import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import ChatDemoExample from "@/components/ChatDemoExample";

const Index = () => {
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
    </div>
  );
};

export default Index;
