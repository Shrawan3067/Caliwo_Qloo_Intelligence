import React from "react";
import { Sparkles, Flame, Utensils, Star, ArrowRight } from "lucide-react";
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
          <div className="badge-tag">
            <Sparkles size={16} className="badge-sparkle" />
            <span>Powered by Qloo Cultural Taste Graph</span>
          </div>

          <h1 className="hero-title">
            The Culturally Aware AI
            <br />
            <span className="text-gradient">Calorie &amp; Taste Companion</span>
          </h1>

          <p className="hero-subtitle">
            Say goodbye to culturally blind coaching. Snap any meal for instant
            computer-vision calorie tracking, while Qloo’s taste graph aligns
            every recommendation to your music rotation, cinema favorites, and
            favorite dining vibes.
          </p>

          {/* Store Buttons */}
          <div className="hero-store-buttons">
            <button className="store-btn" onClick={onDownloadClick}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.34-.58.67-1.09 1.75-.95 2.78 1.01.08 2.05-.52 2.67-1.27z" />
              </svg>
              <div className="store-btn-text">
                <span className="store-btn-subtitle">DOWNLOAD ON THE</span>
                <span className="store-btn-title">App Store</span>
              </div>
            </button>

            <a 
              href="/caliwo-release.apk" 
              download="caliwo-release.apk" 
              className="store-btn"
              style={{ textDecoration: "none", color: "inherit" }}
              aria-label="Download Android Production APK"
            >
              <svg width="32" height="32" viewBox="0 0 512 512">
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
                <span className="store-btn-subtitle">ANDROID RELEASE (46MB)</span>
                <span className="store-btn-title">Download .APK</span>
              </div>
            </a>
          </div>

          {/* User Ratings & Social Proof */}
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
                  <Star key={i} size={16} fill="#f59e0b" stroke="#f59e0b" />
                ))}
              </div>
              <span className="rating-text">
                <strong>4.9</strong> · 12,840 reviews
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
              <span className="card-title">Coach is typing...</span>
            </div>
          </div>

          <div className="floating-card float-bottom-right animate-float">
            <div className="card-icon recipe-icon">
              <Utensils size={16} />
            </div>
            <div className="card-text">
              <span className="card-title">AI recipe generated</span>
              <span className="card-sub">Mediterranean bowl</span>
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
                      <span className="phone-greeting">Good morning, Alex</span>
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
                      Avocado Toast & Eggs
                    </span>
                    <span className="meal-card-time">Breakfast · 8:30 AM</span>
                    <span className="meal-card-macros">
                      P 24g · C 32g · F 18g
                    </span>
                  </div>
                  <span className="meal-cal-tag">420 kcal</span>
                </div>

                {/* Interactive Demo Prompt inside Phone Screen */}
                <button className="phone-demo-trigger" onClick={onTryDemo}>
                  <Sparkles size={14} />
                  <span>Try Interactive Demo</span>
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
