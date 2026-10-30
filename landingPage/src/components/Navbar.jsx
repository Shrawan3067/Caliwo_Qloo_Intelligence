import React, { useState, useEffect } from "react";
import { Menu, X, Sparkles, ShieldCheck } from "lucide-react";
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
            Judges &amp; APK
          </a>
          <a href="#comparison" className="nav-link">
            Why Caliwo
          </a>
          <a href="#pricing" className="nav-link">
            Pricing
          </a>
          <a href="#faq" className="nav-link">
            FAQ
          </a>
        </nav>

        {/* Header Action Buttons */}
        <div className="header-actions">
          <button
            className="btn btn-accent nav-demo-trigger-btn"
            onClick={onDownloadClick}
          >
            <Sparkles size={15} />
            <span>Try Qloo Demo</span>
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
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
            How It Works
          </a>
          <a href="#ai-coach" onClick={() => setMobileMenuOpen(false)}>
            Taste Intelligence
          </a>
          <a href="#hackathon-judges" onClick={() => setMobileMenuOpen(false)}>
            Judges &amp; APK
          </a>
          <a href="#comparison" onClick={() => setMobileMenuOpen(false)}>
            Why Caliwo
          </a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>
            Pricing
          </a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
            FAQ
          </a>
          <div className="mobile-drawer-action">
            <button
              className="btn btn-accent full-width"
              onClick={() => {
                setMobileMenuOpen(false);
                if (onDownloadClick) onDownloadClick();
              }}
            >
              <Sparkles size={16} />
              <span>Try Live Qloo Demo</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
