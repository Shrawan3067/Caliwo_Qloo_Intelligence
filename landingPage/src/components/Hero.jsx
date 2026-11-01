import React from "react";
import { Sparkles, Flame, Utensils, Star, ArrowRight, Download, ShieldCheck, Key, Smartphone, Info } from "lucide-react";
import "./Hero.css";

export default function Hero({ onDownloadClick, onTryDemo }) {
  return (
    <section className="hero-section">
      {/* Background Decorative Glow Blobs */}
      <div className="hero-glow-blob glow-1"></div>
      <div className="hero-glow-blob glow-2"></div>

      <div className="container hero-container">
        {/* Left Hero Content */}
        <div className="hero-content">
          {/* Hackathon Badge Pill */}
          <div className="badge-tag hero-hackathon-badge">
            <span className="live-dot-pulse"></span>
            <span className="badge-label">QLOO AGENTIC AI HACKATHON 2026 SUBMISSION</span>
          </div>

          <h1 className="hero-title">
            The Culturally Aware AI
            <br />
            <span className="text-gradient">Calorie &amp; Taste Companion</span>
          </h1>

          <p className="hero-subtitle">
            Say goodbye to culturally blind coaching. Snap any meal for instant
            computer-vision calorie tracking, while Qloo’s Cultural Taste Graph aligns
            every recommendation to your music rotation, cinema favorites, and
            dining lifestyle vibes.
          </p>

          {/* Action Buttons: Direct Android APK & Interactive Demo */}
          <div className="hero-action-buttons">
            <a
              href="/caliwo-release.apk"
              download="caliwo-release.apk"
              className="hero-primary-apk-btn"
              id="hero-apk-download-btn"
              aria-label="Download Android Production APK Build"
            >
              <div className="hero-btn-android-icon">
                {/* Clean Android Robot SVG */}
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v6c0 .83.67 1.5 1.5 1.5S5 16.33 5 15.5v-6C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.95 2 12 2c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.73 3.35 5.5 5.12 5.5 7.15h13c0-2.03-1.23-3.8-2.97-4.99zM9 5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                </svg>
              </div>
              <div className="hero-btn-text">
                <span className="hero-btn-micro">DIRECT BUILD · 56 MB · ANDROID 10+</span>
                <span className="hero-btn-title">Download Android .APK</span>
              </div>
              <Download size={20} className="hero-btn-arrow" />
            </a>

            <button
              type="button"
              className="hero-secondary-demo-btn"
              onClick={onTryDemo}
              id="hero-try-demo-btn"
              aria-label="Launch interactive live demo playground"
            >
              <Sparkles size={18} className="demo-sparkle-icon" />
              <div className="hero-btn-text">
                <span className="hero-btn-micro">IN-BROWSER PREVIEW</span>
                <span className="hero-btn-title">Try Live Web Demo</span>
              </div>
            </button>
          </div>

          {/* Prominent Hackathon Judge Notice Card */}
          <div className="hero-judge-notice-box">
            <div className="judge-notice-header">
              <div className="judge-notice-pill">
                <span className="live-dot-pulse"></span>
                <span>ATTENTION JUDGES: ANDROID .APK TESTING ONLY</span>
              </div>
              <span className="judge-notice-offline-tag">Not on Play Store / App Store</span>
            </div>

            <p className="judge-notice-text">
              The Caliwo mobile app is packaged exclusively as an <strong>Android .APK file</strong> for hackathon evaluation. 
              Sideload directly onto any Android device (Android 10+) or drag into an emulator. 
              On the sign-in screen, tap <strong>"Fill Hackathon Demo Account"</strong> for instant 1-tap evaluation.
            </p>

            <div className="judge-notice-badges-row">
              <span className="notice-chip">
                <Key size={13} className="notice-chip-icon text-amber" />
                1-Tap Demo Login
              </span>
              <span className="notice-chip">
                <Smartphone size={13} className="notice-chip-icon text-cyan" />
                Android 10+ / Emulator
              </span>
              <span className="notice-chip">
                <ShieldCheck size={13} className="notice-chip-icon text-emerald" />
                Zero-Crash Release Build
              </span>
            </div>
          </div>

          {/* Social Proof & Ratings */}
          <div className="hero-rating-wrapper">
            <div className="avatar-stack">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                alt="User"
                className="avatar"
              />
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                alt="User"
                className="avatar"
              />
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
                alt="User"
                className="avatar"
              />
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80"
                alt="User"
                className="avatar"
              />
            </div>
            <div className="rating-info">
              <div className="stars-row">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#f59e0b" stroke="#f59e0b" />
                ))}
              </div>
              <span className="rating-text">
                <strong>4.9</strong> · Evaluated for Qloo Cultural AI Hackathon
              </span>
            </div>
          </div>
        </div>

        {/* Right Phone Mockup Visual */}
        <div className="hero-visual">
          {/* Floating Pill Cards */}
          <div className="floating-card float-top-left animate-float">
            <div className="card-icon flame-icon">
              <Flame size={18} />
            </div>
            <div className="card-text">
              <span className="card-title">Daily goal met</span>
              <span className="card-val">1,850 / 2,000 kcal</span>
            </div>
          </div>

          <div className="floating-card float-top-right animate-float-delayed">
            <div className="card-icon coach-icon">
              <Sparkles size={16} />
            </div>
            <div className="card-text">
              <span className="card-title">Qloo Taste Agent</span>
              <span className="card-val">Tokyo Omakase Aligned</span>
            </div>
          </div>

          <div className="floating-card float-bottom-right animate-float">
            <div className="card-icon recipe-icon">
              <Utensils size={18} />
            </div>
            <div className="card-text">
              <span className="card-title">Bio-Cultural Recipe</span>
              <span className="card-sub">Miso Cod Bowl (48g P)</span>
            </div>
          </div>

          {/* Main Titanium Phone Frame */}
          <div className="titanium-phone-frame hero-titanium-phone">
            {/* Outer Hardware Buttons */}
            <div className="hw-button hw-action"></div>
            <div className="hw-button hw-volume-up"></div>
            <div className="hw-button hw-volume-down"></div>
            <div className="hw-button hw-power"></div>

            {/* Inner Screen Display */}
            <div className="phone-screen-display">
              {/* Dynamic Island */}
              <div className="dynamic-island-pill">
                <div className="camera-lens"></div>
              </div>

              {/* Glare Reflection */}
              <div className="screen-glare-overlay"></div>

              {/* Internal Screen Content */}
              <div className="phone-ui phone-ui-dashboard hero-screen-content">
                {/* Status Bar */}
                <div className="phone-status-bar">
                  <span>9:41</span>
                  <div className="phone-status-icons">
                    <span className="battery-pill">100%</span>
                  </div>
                </div>

                {/* App Header */}
                <div className="phone-header-row">
                  <div className="phone-brand-wrap">
                    <div className="phone-brand-icon">🔥</div>
                    <div>
                      <span className="phone-brand-title">Caliwo</span>
                      <span className="phone-greeting">Hackathon Demo Mode</span>
                    </div>
                  </div>
                  <div className="phone-streak-badge">
                    <span>🔥 14d</span>
                  </div>
                </div>

                {/* Calorie Hero Ring Card */}
                <div className="phone-calorie-card">
                  <div className="calorie-ring-circle">
                    <div className="ring-inner-cutout">
                      <span className="ring-number">1,420</span>
                      <span className="ring-label">CAL LEFT</span>
                    </div>
                  </div>
                  <div className="calorie-side-stats">
                    <div className="mini-stat-pill">
                      <span className="pill-dot orange"></span>
                      <div>
                        <span className="stat-sm-num">580</span>
                        <span className="stat-sm-lbl">Eaten</span>
                      </div>
                    </div>
                    <div className="mini-stat-pill">
                      <span className="pill-dot blue"></span>
                      <div>
                        <span className="stat-sm-num">2,000</span>
                        <span className="stat-sm-lbl">Target</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Macro Cards */}
                <div className="phone-macro-grid">
                  <div className="macro-card-mini macro-p">
                    <span className="macro-tag">PROTEIN</span>
                    <span className="macro-g">84 / 140g</span>
                    <div className="macro-bar">
                      <div
                        className="bar-fill p-fill"
                        style={{ width: "60%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="macro-card-mini macro-c">
                    <span className="macro-tag">CARBS</span>
                    <span className="macro-g">110 / 220g</span>
                    <div className="macro-bar">
                      <div
                        className="bar-fill c-fill"
                        style={{ width: "50%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="macro-card-mini macro-f">
                    <span className="macro-tag">FAT</span>
                    <span className="macro-g">28 / 65g</span>
                    <div className="macro-bar">
                      <div
                        className="bar-fill f-fill"
                        style={{ width: "43%" }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Recent Meal */}
                <div className="phone-recent-meal-card">
                  <img
                    src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80"
                    alt="Meal"
                    className="meal-thumb-img"
                  />
                  <div className="meal-card-details">
                    <span className="meal-card-title">
                      Miso-Glazed Salmon Bowl
                    </span>
                    <span className="meal-card-time">Qloo Tokyo Affinity · 96%</span>
                    <span className="meal-card-macros">
                      P 42g · C 38g · F 16g
                    </span>
                  </div>
                  <span className="meal-cal-tag">480 kcal</span>
                </div>

                {/* Interactive Demo Prompt inside Phone Screen */}
                <button className="phone-demo-trigger" onClick={onTryDemo}>
                  <Sparkles size={14} />
                  <span>Launch Live Web Playground</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
