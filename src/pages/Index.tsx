import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import ChatDemoExample from "@/components/ChatDemoExample";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <ChatDemoExample />
      <Features />
      <Pricing />
      <Testimonials />
      <Footer />
    </div>
  );
};

export default Index;
