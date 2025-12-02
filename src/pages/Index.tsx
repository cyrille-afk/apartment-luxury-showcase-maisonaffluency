import Hero from "@/components/Hero";
import Overview from "@/components/Overview";
import Gallery from "@/components/Gallery";
import DesignDetails from "@/components/DesignDetails";
import ContactInquiry from "@/components/ContactInquiry";
import Footer from "@/components/Footer";
const Index = () => {
  return <main className="min-h-screen">
      <Hero />
      <Overview />
      <Gallery />
      <DesignDetails />
      <ContactInquiry />
      <Footer />
    </main>;
};
export default Index;