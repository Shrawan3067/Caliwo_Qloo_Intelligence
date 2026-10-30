import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
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

            {/* Footer Store Badges */}
            <div className="footer-store-buttons">
              <button
                className="store-btn footer-store-btn"
                onClick={onDownloadClick}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.34-.58.67-1.09 1.75-.95 2.78 1.01.08 2.05-.52 2.67-1.27z" />
                </svg>
                <div className="store-btn-text">
                  <span className="store-btn-subtitle">Download on the</span>
                  <span className="store-btn-title">App Store</span>
                </div>
              </button>

              <button
                className="store-btn footer-store-btn"
                onClick={onDownloadClick}
              >
                <svg width="22" height="22" viewBox="0 0 512 512">
                  <path
                    fill="#4285F4"
                    d="M30 36.3C27.4 39 26 43 26 48.3v415.4c0 5.3 1.4 9.3 4 12l.6.6L263 244v-4L30.6 35.7l-.6.6z"
                  />
                  <path
                    fill="#34A853"
                    d="M341.9 322.9l-78.9-78.9v-4l78.9-78.9.7.4 93.5 53.1c26.7 15.2 26.7 40.1 0 55.3l-93.5 53-.7.4z"
                  />
                  <path
                    fill="#EA4335"
                    d="M342.6 322.5L263 243 30.6 475.4c8.8 9.3 23.3 10.4 39.4 1.3l272.6-154.2z"
                  />
                  <path
                    fill="#FBBC04"
                    d="M342.6 163.5L70 9.3C53.9.2 39.4 1.3 30.6 10.6L263 243l79.6-79.5z"
                  />
                </svg>
                <div className="store-btn-text">
                  <span className="store-btn-subtitle">GET IT ON</span>
                  <span className="store-btn-title">Google Play</span>
                </div>
              </button>
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
