import React from 'react';
import { Download, Sparkles, Smartphone, ShieldCheck, Star, Play, ArrowRight } from 'lucide-react';
import './BottomCTA.css';

export default function BottomCTA({ onDownloadClick }) {
  return (
    <section id="download" className="bottom-cta-section">
      <div className="container">
        <div className="dark-cta-card">
          {/* Ambient Decorative Background Glows */}
          <div className="cta-ambient-glow cta-glow-primary"></div>
          <div className="cta-ambient-glow cta-glow-cyan"></div>

          <div className="cta-card-content">
            {/* Pill Badge */}
            <div className="badge-tag badge-tag-dark">
              <Sparkles size={16} />
              <span>START YOUR JOURNEY TODAY</span>
            </div>

            {/* Main Heading */}
            <h2 className="cta-heading">
              Ready to eat smarter with{' '}
              <span className="text-gradient">Cultural Intelligence?</span>
            </h2>

            {/* Subheading */}
            <p className="cta-subheading">
              Join thousands of people transforming their nutrition without abandoning their heritage cuisines.
              Snap meals for instant macro breakdowns, calibrate your 6-domain taste DNA with Qloo, and experience
              autonomous AI coaching.
            </p>

            {/* Primary Action Buttons (APK & Live Demo) */}
            <div className="cta-primary-actions">
              <a
                href="/caliwo-release.apk"
                download="caliwo-release.apk"
                className="cta-btn cta-btn-apk"
                id="bottom-cta-apk-download"
                aria-label="Download Android Production APK"
              >
                <div className="cta-btn-icon-box">
                  <Download size={22} className="cta-icon-download" />
                </div>
                <div className="cta-btn-text-col">
                  <span className="cta-btn-micro">DIRECT BUILD · 56 MB</span>
                  <span className="cta-btn-headline">Download .APK</span>
                </div>
                <ArrowRight size={18} className="cta-btn-arrow" />
              </a>

              <button
                type="button"
                className="cta-btn cta-btn-demo"
                onClick={onDownloadClick}
                id="bottom-cta-live-demo"
                aria-label="Launch interactive live demo playground"
              >
                <div className="cta-btn-icon-box cyan">
                  <Play size={20} className="cta-icon-play" />
                </div>
                <div className="cta-btn-text-col">
                  <span className="cta-btn-micro">INSTANT IN-BROWSER</span>
                  <span className="cta-btn-headline">Try Live Playground</span>
                </div>
                <Sparkles size={18} className="cta-btn-sparkle" />
              </button>
            </div>

            {/* Official Store Buttons */}
            <div className="cta-store-divider">
              <span>OR GET THE MOBILE APP</span>
            </div>

            <div className="cta-store-buttons">
              <button
                type="button"
                className="store-btn"
                onClick={onDownloadClick}
                aria-label="Download on the Apple App Store"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.34-.58.67-1.09 1.75-.95 2.78 1.01.08 2.05-.52 2.67-1.27z"/>
                </svg>
                <div className="store-btn-text">
                  <span className="store-btn-subtitle">DOWNLOAD ON THE</span>
                  <span className="store-btn-title">App Store</span>
                </div>
              </button>

              <button
                type="button"
                className="store-btn"
                onClick={onDownloadClick}
                aria-label="Get it on Google Play Store"
              >
                <svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true">
                  <path fill="#4285F4" d="M30 36.3C27.4 39 26 43 26 48.3v415.4c0 5.3 1.4 9.3 4 12l.6.6L263 244v-4L30.6 35.7l-.6.6z"/>
                  <path fill="#34A853" d="M341.9 322.9l-78.9-78.9v-4l78.9-78.9.7.4 93.5 53.1c26.7 15.2 26.7 40.1 0 55.3l-93.5 53-.7.4z"/>
                  <path fill="#EA4335" d="M342.6 322.5L263 243 30.6 475.4c8.8 9.3 23.3 10.4 39.4 1.3l272.6-154.2z"/>
                  <path fill="#FBBC04" d="M342.6 163.5L70 9.3C53.9.2 39.4 1.3 30.6 10.6L263 243l79.6-79.5z"/>
                </svg>
                <div className="store-btn-text">
                  <span className="store-btn-subtitle">GET IT ON</span>
                  <span className="store-btn-title">Google Play</span>
                </div>
              </button>
            </div>

            {/* Trust Badges & Highlights */}
            <div className="cta-trust-row">
              <div className="trust-pill">
                <ShieldCheck size={16} className="trust-icon text-emerald" />
                <span>Verified .APK (Android 10+)</span>
              </div>
              <div className="trust-pill">
                <Sparkles size={16} className="trust-icon text-amber" />
                <span>Live Qloo V2 Taste Engine</span>
              </div>
              <div className="trust-pill">
                <Smartphone size={16} className="trust-icon text-cyan" />
                <span>Free 7-Day Pro Access</span>
              </div>
              <div className="trust-pill">
                <Star size={16} className="trust-icon text-amber" fill="#f59e0b" />
                <span>4.9 / 5 Rating</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

