import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeaturedDesigners from "@/components/FeaturedDesigners";
import BrandsAteliers from "@/components/BrandsAteliers";
import Overview from "@/components/Overview";
import Gallery from "@/components/Gallery";
import Collectibles from "@/components/Collectibles";
import DesignDetails from "@/components/DesignDetails";
import ContactInquiry from "@/components/ContactInquiry";
import Footer from "@/components/Footer";

import ScrollProgress from "@/components/ScrollProgress";
import CuratingTeam from "@/components/CuratingTeam";
import QuickJumpMenu from "@/components/QuickJumpMenu";
import BackToTop from "@/components/BackToTop";

const Index = () => {
  return (
    <>
      <ScrollProgress />
      <Navigation />
      <main className="min-h-screen">
        <section id="home">
          <Hero />
        </section>
        <section id="overview" className="scroll-mt-20 md:scroll-mt-24">
          <Overview />
        </section>
        <section id="gallery" className="scroll-mt-20 md:scroll-mt-24">
          <Gallery />
        </section>
        <section id="curating-team" className="scroll-mt-20 md:scroll-mt-24">
          <CuratingTeam />
        </section>
        <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24">
          <Collectibles />
        </section>
        <section id="designers" className="scroll-mt-20 md:scroll-mt-24">
          <FeaturedDesigners />
        </section>
        <section id="brands" className="scroll-mt-20 md:scroll-mt-24">
          <BrandsAteliers />
        </section>
        <section id="details" className="scroll-mt-20 md:scroll-mt-24">
          <DesignDetails />
        </section>
        <section id="contact" className="scroll-mt-20 md:scroll-mt-24">
          <ContactInquiry />
        </section>
        <Footer />
      </main>
      
      <QuickJumpMenu />
      <BackToTop />
    </>
  );
};
export default Index;