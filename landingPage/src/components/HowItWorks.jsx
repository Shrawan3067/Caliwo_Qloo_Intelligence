import React, { useState } from "react";
import {
  Camera,
  Cpu,
  MessageSquare,
  TrendingUp,
  Check,
  Sparkles,
} from "lucide-react";
import "./HowItWorks.css";

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: "01",
      title: "Scan Food",
      description:
        "Point your camera at any meal. Caliwo recognizes ingredients and portion weights instantly, cross-referencing visual foods with your cultural lifestyle profile.",
      icon: <Camera size={20} />,
    },
    {
      number: "02",
      title: "AI Analysis",
      description:
        "Computes complete physical metrics — Protein, Fat, Fiber, Sugar, and Magnesium — calculated in real time alongside your Qloo cultural taste affinities.",
      icon: <Cpu size={20} />,
    },
    {
      number: "03",
      title: "Culturally Aware Coaching",
      description:
        "Receive recommendations that fit your exact macro targets while honoring your real-world dining, cinema, and music lifestyle vibes.",
      icon: <MessageSquare size={20} />,
    },
    {
      number: "04",
      title: "Long-term Progress",
      description:
        "Build lasting, effortless habits driven by contextual lifestyle alignment and taste resonance — rather than raw clinical restriction.",
      icon: <TrendingUp size={20} />,
    },
  ];

  return (
    <section id="how-it-works" className="section-padding how-it-works-section">
      <div className="container">
        {/* Header */}
        <div className="section-header text-center">
          <div className="badge-tag">
            <Sparkles size={14} />
            <span>HOW IT WORKS</span>
          </div>
          <h2 className="section-title">
            Cultural nutrition in four simple steps
          </h2>
          <p className="section-subtitle">
            From meal camera scans to Qloo cross-domain taste alignment — an
            effortless daily routine.
          </p>
        </div>

        <div className="how-it-works-grid">
          {/* Left Step Selectors */}
          <div className="steps-list">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`step-item-card ${activeStep === idx ? "active" : ""}`}
                onClick={() => setActiveStep(idx)}
              >
                <div className="step-num">{step.number}</div>
                <div className="step-content">
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Phone Dynamic Preview */}
          <div className="how-it-works-phone-wrap">
            <div className="titanium-phone-frame how-it-works-phone">
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

                {/* Step 01 Dynamic Screen: Food Scanner */}
                {activeStep === 0 && (
                  <div className="phone-ui phone-ui-scanner">
                    <div className="phone-status-bar text-white">
                      <span>9:41</span>
                      <div className="phone-status-icons">
                        <span className="battery-pill">100%</span>
                      </div>
                    </div>

                    <div className="scanner-viewport">
                      <img
                        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"
                        alt="Salmon Bowl"
                        className="scanner-live-feed"
                      />
                      <div className="ai-recognition-pill">
                        <Sparkles size={14} className="sparkle-gold" />
                        <span>98.5% Match: Salmon Quinoa Bowl</span>
                      </div>

                      <div className="ar-scan-box">
                        <div className="scan-corner tl"></div>
                        <div className="scan-corner tr"></div>
                        <div className="scan-corner bl"></div>
                        <div className="scan-corner br"></div>
                        <div className="laser-scanner-line"></div>
                      </div>
                    </div>

                    <div className="scanner-result-sheet">
                      <div className="sheet-handle"></div>
                      <div className="sheet-header">
                        <div>
                          <h4>Grilled Salmon Bowl</h4>
                          <span className="sheet-weight">
                            380g estimated portion
                          </span>
                        </div>
                        <span className="sheet-calories">520 kcal</span>
                      </div>
                      <div className="sheet-macros-row">
                        <span className="pill-metric green">
                          🍗 38g Protein
                        </span>
                        <span className="pill-metric blue">🍚 42g Carbs</span>
                        <span className="pill-metric purple">🥑 18g Fats</span>
                      </div>
                      <button className="sheet-log-btn" type="button">
                        <Check size={16} />
                        <span>Instant AI Macro Logged</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 02 Dynamic Screen: AI Analysis */}
                {activeStep === 1 && (
                  <div className="phone-ui phone-ui-dashboard">
                    <div className="phone-status-bar">
                      <span>9:41</span>
                      <span className="battery-pill">100%</span>
                    </div>

                    <div className="phone-header-row">
                      <div>
                        <span className="phone-brand-title">
                          Nutrition Breakdown
                        </span>
                        <span className="phone-greeting">
                          Full Macro & Micro Profile
                        </span>
                      </div>
                      <div className="phone-streak-badge">
                        <span>A+ Quality</span>
                      </div>
                    </div>

                    <div
                      className="phone-recent-meal-card"
                      style={{ marginBottom: 12 }}
                    >
                      <img
                        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80"
                        alt="Salmon"
                        className="meal-thumb-img"
                      />
                      <div className="meal-card-details">
                        <span className="meal-card-title">
                          Grilled Salmon Bowl
                        </span>
                        <span className="meal-card-time">
                          Wild Salmon, Quinoa, Greens
                        </span>
                        <span className="meal-card-macros">
                          38g P · 42g C · 18g F
                        </span>
                      </div>
                      <span className="meal-cal-tag">520 kcal</span>
                    </div>

                    <div className="phone-macro-grid">
                      <div className="macro-card-mini macro-p">
                        <span className="macro-tag">PROTEIN</span>
                        <span className="macro-g">38g</span>
                        <div className="macro-bar">
                          <div
                            className="bar-fill p-fill"
                            style={{ width: "85%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="macro-card-mini macro-c">
                        <span className="macro-tag">CARBS</span>
                        <span className="macro-g">42g</span>
                        <div className="macro-bar">
                          <div
                            className="bar-fill c-fill"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="macro-card-mini macro-f">
                        <span className="macro-tag">FATS</span>
                        <span className="macro-g">18g</span>
                        <div className="macro-bar">
                          <div
                            className="bar-fill f-fill"
                            style={{ width: "45%" }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="phone-calorie-card"
                      style={{ marginTop: "auto" }}
                    >
                      <div className="calorie-ring-circle">
                        <div className="ring-inner-cutout">
                          <span className="ring-number">520</span>
                          <span className="ring-label">KCAL</span>
                        </div>
                      </div>
                      <div className="calorie-side-stats">
                        <div className="mini-stat-pill">
                          <span className="pill-dot orange"></span>
                          <div>
                            <span className="stat-sm-num">8.2g</span>
                            <span className="stat-sm-lbl">Dietary Fiber</span>
                          </div>
                        </div>
                        <div className="mini-stat-pill">
                          <span className="pill-dot blue"></span>
                          <div>
                            <span className="stat-sm-num">100%</span>
                            <span className="stat-sm-lbl">Omega-3 Daily</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 03 Dynamic Screen: Personalized Coaching */}
                {activeStep === 2 && (
                  <div className="phone-ui phone-ui-coach">
                    <div className="phone-status-bar">
                      <span>9:41</span>
                      <span className="battery-pill">100%</span>
                    </div>

                    <div className="coach-top-bar">
                      <div className="coach-avatar-wrap">
                        <div className="coach-avatar-img">🤖</div>
                        <span className="online-indicator"></span>
                      </div>
                      <div>
                        <span className="coach-name">Caliwo AI Coach</span>
                        <span className="coach-status">
                          Online · Real-time Guidance
                        </span>
                      </div>
                    </div>

                    <div className="chat-stream">
                      <div className="chat-bubble bubble-user">
                        What should I eat post-workout today to hit my protein?
                      </div>

                      <div className="chat-bubble bubble-coach">
                        <div className="coach-bubble-header">
                          <Sparkles size={12} color="#FF5E00" />
                          <span>Personalized Recommendation</span>
                        </div>
                        <p>
                          Great session! Aim for ~30g protein + complex carbs.
                          Try this:
                        </p>
                        <div className="coach-food-option">
                          <span>🐟 Grilled Salmon & Quinoa</span>
                          <strong>38g P · 520 kcal</strong>
                        </div>
                        <div className="coach-food-option">
                          <span>🥣 Greek Yogurt + Berries</span>
                          <strong>28g P · 290 kcal</strong>
                        </div>
                      </div>

                      <div className="chat-bubble bubble-user">
                        Awesome, logging the salmon now!
                      </div>
                    </div>

                    <div className="chat-fake-input">
                      <span>Ask your coach anything...</span>
                      <div className="send-arrow">↑</div>
                    </div>
                  </div>
                )}

                {/* Step 04 Dynamic Screen: Long-term Progress */}
                {activeStep === 3 && (
                  <div className="phone-ui phone-ui-analytics">
                    <div className="phone-status-bar">
                      <span>9:41</span>
                      <span className="battery-pill">100%</span>
                    </div>

                    <div className="analytics-header">
                      <h4>Habit & Streak Progress</h4>
                      <span className="analytics-pill">28-Day Streak</span>
                    </div>

                    <div
                      className="phone-calorie-card"
                      style={{ marginBottom: 10 }}
                    >
                      <div>
                        <span className="stat-sm-lbl">WEIGHT CHANGE</span>
                        <span
                          style={{
                            fontSize: "1.4rem",
                            fontWeight: 900,
                            color: "#10B981",
                            display: "block",
                          }}
                        >
                          -4.2 kg
                        </span>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            color: "#64748B",
                            fontWeight: 700,
                          }}
                        >
                          Target reached: 92%
                        </span>
                      </div>
                      <div
                        className="phone-streak-badge"
                        style={{ background: "#ECFDF5", color: "#065F46" }}
                      >
                        <span>🏆 Milestone</span>
                      </div>
                    </div>

                    <div className="analytics-chart-card">
                      <div className="chart-stat-top">
                        <div>
                          <span className="chart-big-val">98%</span>
                          <span className="chart-big-lbl">
                            Goal Consistency
                          </span>
                        </div>
                        <span className="consistency-badge">🔥 Locked In</span>
                      </div>

                      <svg viewBox="0 0 200 60" className="trend-svg">
                        <defs>
                          <linearGradient
                            id="chartGradHow"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#10B981"
                              stopOpacity="0.35"
                            />
                            <stop
                              offset="100%"
                              stopColor="#10B981"
                              stopOpacity="0.0"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10 45 Q 40 30, 70 24 T 130 18 T 190 12 L 190 60 L 10 60 Z"
                          fill="url(#chartGradHow)"
                        />
                        <path
                          d="M 10 45 Q 40 30, 70 24 T 130 18 T 190 12"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>

                      <div className="chart-days-row">
                        <span>W1</span>
                        <span>W2</span>
                        <span>W3</span>
                        <span>W4</span>
                        <span>Today</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
