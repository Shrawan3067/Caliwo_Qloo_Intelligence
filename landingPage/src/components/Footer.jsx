import React, { useState } from "react";
import { ArrowRight, Check, Download, Smartphone, Sparkles } from "lucide-react";
import "./Footer.css";

export default function Footer({ onDownloadClick }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail("");
      setSubscribed(false);
    }, 4000);
  };

  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-top-grid">
          {/* Brand & Newsletter Column */}
          <div className="footer-brand-col">
            <a href="#" className="footer-brand">
              <div className="logo-icon-wrapper">
                <img src="/logo.svg" alt="Caliwo Logo" className="logo-img" />
              </div>
              <span className="brand-name">Caliwo</span>
            </a>

            <p className="footer-bio">
              The AI-powered nutrition &amp; health coach that turns every meal
              into meaningful progress.
            </p>

            {/* Newsletter Form */}
            <div className="newsletter-box">
              <span className="newsletter-title">NEWSLETTER</span>
              {subscribed ? (
                <div className="subscribed-msg">
                  <Check size={16} /> Subscribed to weekly insights!
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="newsletter-form">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="newsletter-submit-btn"
                    aria-label="Subscribe"
                  >
                    <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>

            {/* Footer Hackathon & APK Sideload Badge */}
            <div className="footer-apk-card">
              <div className="footer-apk-header">
                <span className="live-dot-pulse"></span>
                <span className="footer-hackathon-label">QLOO AGENTIC HACKATHON 2026</span>
              </div>
              <p className="footer-apk-note">
                Mobile app testable exclusively on Android via direct build. Not published on Google Play or App Store.
              </p>
              <a
                href="/caliwo-release.apk"
                download="caliwo-release.apk"
                className="footer-apk-btn"
                title="Download verified Android .APK release build"
              >
                <Download size={16} />
                <span>Download Android .APK (56 MB)</span>
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div className="footer-links-grid">
            <div className="link-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#ai-coach">Taste Intelligence</a>
              <a href="#hackathon-judges">Judges &amp; APK</a>
              <a href="#pricing">Pricing</a>
              <a
                href="#demo"
                onClick={(e) => {
                  e.preventDefault();
                  if (onDownloadClick) onDownloadClick();
                }}
              >
                Live Playground
              </a>
              <a href="#faq">FAQ</a>
            </div>

            <div className="link-col">
              <h4>Company</h4>
              <a href="#about">About Mission</a>
              <a href="#comparison">Why Caliwo</a>
              <a href="#hackathon-judges">Hackathon Evaluation</a>
              <a href="#contact">Contact</a>
            </div>

            <div className="link-col">
              <h4>Legal</h4>
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#cookies">Cookie Policy</a>
              <a href="#disclaimer">Disclaimer</a>
              <a href="#security">Security</a>
            </div>
          </div>
        </div>

        {/* Bottom Rights Bar */}
        <div className="footer-bottom-bar">
          <span>&copy; 2026 Caliwo. All rights reserved.</span>
          <div className="footer-social-row">
            <a href="#twitter" aria-label="Twitter" className="social-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#instagram" aria-label="Instagram" className="social-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a href="#linkedin" aria-label="LinkedIn" className="social-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
            <a href="#youtube" aria-label="YouTube" className="social-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
