import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeaturedDesigners from "@/components/FeaturedDesigners";
import BrandsAteliers from "@/components/BrandsAteliers";
import Overview from "@/components/Overview";
import Gallery from "@/components/Gallery";
import DesignDetails from "@/components/DesignDetails";
import ContactInquiry from "@/components/ContactInquiry";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import ScrollProgress from "@/components/ScrollProgress";
import CuratingTeam from "@/components/CuratingTeam";
import QuickJumpMenu from "@/components/QuickJumpMenu";

const Index = () => {
  return (
    <>
      <ScrollProgress />
      <Navigation />
      <main className="min-h-screen">
        <section id="home">
          <Hero />
        </section>
        <section id="overview">
          <Overview />
        </section>
        <section id="gallery">
          <Gallery />
        </section>
        <section id="curating-team">
          <CuratingTeam />
        </section>
        <section id="designers">
          <FeaturedDesigners />
        </section>
        <section id="brands">
          <BrandsAteliers />
        </section>
        <section id="details">
          <DesignDetails />
        </section>
        <section id="contact">
          <ContactInquiry />
        </section>
        <Footer />
      </main>
      <BackToTop />
      <QuickJumpMenu />
    </>
  );
};
export default Index;