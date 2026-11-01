import React from 'react';
import { Download, Sparkles, Smartphone, ShieldCheck, Play, ArrowRight, Key } from 'lucide-react';
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
              <span>QLOO AGENTIC AI HACKATHON 2026</span>
            </div>

            {/* Main Heading */}
            <h2 className="cta-heading">
              Ready to evaluate Caliwo's{' '}
              <span className="text-gradient">Cultural Intelligence?</span>
            </h2>

            {/* Subheading */}
            <p className="cta-subheading">
              Download the verified production Android .APK build to test real-time plate scanning, 
              cross-domain Qloo taste mapping, and autonomous agent tool loops on mobile.
            </p>

            {/* Primary Action Buttons (Android APK & Live Demo) */}
            <div className="cta-primary-actions">
              <a
                href="/caliwo-release.apk"
                download="caliwo-release.apk"
                className="cta-btn cta-btn-apk"
                id="bottom-cta-apk-download"
                aria-label="Download Android Production APK Build"
              >
                <div className="cta-btn-icon-box">
                  <Download size={22} className="cta-icon-download" />
                </div>
                <div className="cta-btn-text-col">
                  <span className="cta-btn-micro">DIRECT BUILD · 56 MB · ANDROID 10+</span>
                  <span className="cta-btn-headline">Download Android .APK</span>
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
                  <span className="cta-btn-micro">IN-BROWSER PLAYGROUND</span>
                  <span className="cta-btn-headline">Try Web Live Demo</span>
                </div>
                <Sparkles size={18} className="cta-btn-sparkle" />
              </button>
            </div>

            {/* Judge Sideload Notice Box */}
            <div className="cta-judge-callout">
              <div className="callout-pill">
                <span className="live-dot-pulse"></span>
                <span>ATTENTION JUDGES: MOBILE EVALUATION ON ANDROID ONLY</span>
              </div>
              <p className="callout-desc">
                The mobile app is distributed exclusively as an <strong>Android .APK file</strong> for the hackathon. 
                It is <strong>not published on Google Play or the Apple App Store</strong>. 
                Sideload onto any Android phone or emulator, then tap <strong>"Fill Hackathon Demo Account"</strong> on the sign-in screen for instant 1-tap evaluation!
              </p>
            </div>

            {/* Verification Trust Row */}
            <div className="cta-trust-row">
              <div className="trust-item">
                <ShieldCheck size={16} className="trust-icon emerald" />
                <span>Zero-Crash Release Verified</span>
              </div>
              <div className="trust-item">
                <Key size={16} className="trust-icon amber" />
                <span>1-Tap Demo Login Included</span>
              </div>
              <div className="trust-item">
                <Smartphone size={16} className="trust-icon cyan" />
                <span>Compatible with Android 10+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
