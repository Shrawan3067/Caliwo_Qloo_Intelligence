import React, { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import MarqueeTicker from "./components/MarqueeTicker";
import HackathonJudgeBanner from "./components/HackathonJudgeBanner";
import HowItWorks from "./components/HowItWorks";
import CaliwoIntelligence from "./components/CaliwoIntelligence";
import ComparisonTable from "./components/ComparisonTable";
import ScreenshotsShowcase from "./components/ScreenshotsShowcase";
import Testimonials from "./components/Testimonials";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import PrivacySecurity from "./components/PrivacySecurity";
import AboutMission from "./components/AboutMission";
import ContactForm from "./components/ContactForm";
import BottomCTA from "./components/BottomCTA";
import Footer from "./components/Footer";
import DemoModal from "./components/DemoModal";
import "./App.css";

export default function App() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const handleOpenDemo = () => {
    setDemoModalOpen(true);
  };

  return (
    <div className="landing-page-root">
      <Navbar onDownloadClick={handleOpenDemo} />
      <main>
        <Hero onDownloadClick={handleOpenDemo} onTryDemo={handleOpenDemo} />
        <MarqueeTicker />
        <HackathonJudgeBanner />
        <HowItWorks />
        <CaliwoIntelligence />
        <ComparisonTable />
        <ScreenshotsShowcase onDownloadClick={handleOpenDemo} />
        <Testimonials />
        <Pricing onDownloadClick={handleOpenDemo} />
        <FAQ />
        <PrivacySecurity />
        <AboutMission />
        <ContactForm />
        <BottomCTA onDownloadClick={handleOpenDemo} />
      </main>
      <Footer onDownloadClick={handleOpenDemo} />

      {/* Interactive Live Playground Modal */}
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}
