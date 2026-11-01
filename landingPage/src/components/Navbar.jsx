import React, { useState, useEffect } from "react";
import { Menu, X, Sparkles, ShieldCheck, Download, Smartphone } from "lucide-react";
import "./Navbar.css";

export default function Navbar({ onDownloadClick }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`navbar-header ${isScrolled ? "scrolled" : ""}`}>
      {/* Top Judge Notice Bar */}
      <div className="navbar-top-judge-strip">
        <div className="container strip-container">
          <span className="strip-pulse-dot"></span>
          <span className="strip-text">
            <strong>QLOO AGENTIC AI HACKATHON 2026:</strong> Mobile app testable exclusively on <strong>Android</strong> via direct <strong>.APK build</strong>
          </span>
          <a href="#hackathon-judges" className="strip-link">
            Judge Testing Guide →
          </a>
        </div>
      </div>

      <div className="container navbar-container">
        {/* Brand Logo & Hackathon Tag */}
        <a href="#" className="navbar-brand">
          <div className="logo-icon-wrapper">
            <img src="/logo.svg" alt="Caliwo Logo" className="logo-img" />
          </div>
          <div className="brand-title-group">
            <span className="brand-name">Caliwo</span>
            <span className="navbar-hackathon-pill">Qloo Agentic AI</span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav">
          <a href="#how-it-works" className="nav-link">
            How It Works
          </a>
          <a href="#ai-coach" className="nav-link">
            Taste Intelligence
          </a>
          <a href="#hackathon-judges" className="nav-link nav-link-judge">
            <ShieldCheck size={14} className="judge-nav-icon" />
            Judges &amp; Android .APK
          </a>
          <a href="#comparison" className="nav-link">
            Why Caliwo
          </a>
          <a href="#faq" className="nav-link">
            FAQ
          </a>
        </nav>

        {/* Header Action Buttons */}
        <div className="header-actions">
          {/* Direct APK Download for Judges */}
          <a
            href="/caliwo-release.apk"
            download="caliwo-release.apk"
            className="nav-apk-btn"
            id="nav-apk-download"
            title="Download verified Android .APK build (56 MB)"
          >
            <Download size={15} className="nav-apk-icon" />
            <span>Download .APK</span>
            <span className="nav-apk-badge">Android</span>
          </a>

          <button
            className="btn btn-accent nav-demo-trigger-btn"
            onClick={onDownloadClick}
            title="Launch interactive browser playground"
          >
            <Sparkles size={14} />
            <span>Web Demo</span>
          </button>

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-judge-alert">
            <span className="strip-pulse-dot"></span>
            <span>Judges: Test on Android via .APK only</span>
          </div>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
            How It Works
          </a>
          <a href="#ai-coach" onClick={() => setMobileMenuOpen(false)}>
            Taste Intelligence
          </a>
          <a href="#hackathon-judges" onClick={() => setMobileMenuOpen(false)}>
            Judges &amp; Android .APK
          </a>
          <a href="#comparison" onClick={() => setMobileMenuOpen(false)}>
            Why Caliwo
          </a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
            FAQ
          </a>

          <div className="mobile-drawer-action">
            <a
              href="/caliwo-release.apk"
              download="caliwo-release.apk"
              className="btn btn-primary full-width mobile-apk-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Download size={16} />
              <span>Download Android .APK (56 MB)</span>
            </a>
            <button
              className="btn btn-accent full-width"
              style={{ marginTop: "10px" }}
              onClick={() => {
                setMobileMenuOpen(false);
                if (onDownloadClick) onDownloadClick();
              }}
            >
              <Sparkles size={15} />
              <span>Try Web Live Playground</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
