import React from 'react';
import { Download, ShieldCheck, Sparkles, Smartphone, ArrowRight } from 'lucide-react';
import './HackathonJudgeBanner.css';

export default function HackathonJudgeBanner() {
  return (
    <section className="hackathon-judge-section" id="hackathon-judges">
      <div className="container">
        <div className="judge-banner-card">
          {/* Subtle Ambient Glowing Blobs */}
          <div className="judge-mesh-glow glow-primary"></div>
          <div className="judge-mesh-glow glow-cyan"></div>

          <div className="judge-card-inner">
            {/* Left Content Area */}
            <div className="judge-content">
              <div className="judge-badge-pill">
                <span className="live-pulse-dot"></span>
                <span className="judge-badge-text">ATTENTION HACKATHON JUDGES</span>
              </div>

              <h2 className="judge-title">
                Test the Live <span className="judge-title-highlight">Agentic Functionality</span>
              </h2>

              <p className="judge-description">
                Download the verified production .APK file below to experience the real-time Qloo V2 integration on mobile, or launch our interactive live demo playground to test the 6-domain Taste DNA engine and autonomous agent tool calling in real time.
              </p>

              {/* Technical Verification Meta Badges */}
              <div className="judge-meta-chips">
                <span className="meta-chip">
                  <ShieldCheck size={14} className="chip-icon icon-emerald" />
                  Verified Production Build
                </span>
                <span className="meta-chip">
                  <Sparkles size={14} className="chip-icon icon-amber" />
                  Live Qloo V2 Taste Engine
                </span>
                <span className="meta-chip">
                  <Smartphone size={14} className="chip-icon icon-cyan" />
                  Android 10+ Compatible
                </span>
              </div>
            </div>

            {/* Right Action Panel */}
            <div className="judge-action-panel">
              <a 
                href="/caliwo-release.apk" 
                download="caliwo-release.apk"
                className="judge-download-btn"
                id="hackathon-apk-download-btn"
              >
                <div className="btn-icon-circle">
                  <Download size={22} className="download-svg-icon" />
                </div>
                <div className="btn-text-group">
                  <span className="btn-subtext">DIRECT MOBILE BUILD</span>
                  <span className="btn-maintext">Download Production .APK</span>
                </div>
                <ArrowRight size={18} className="btn-arrow" />
              </a>

              <div className="apk-specs-row">
                <span className="spec-name">caliwo-release.apk</span>
                <span className="spec-dot">•</span>
                <span className="spec-size">56 MB</span>
                <span className="spec-dot">•</span>
                <span className="spec-status">Ready to Test (Release v1.0.0)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
