import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Droplets,
  Activity,
  CheckCircle2,
  TrendingUp,
  Layers,
  Mic,
  Heart,
  Users,
  ScanLine,
  Target,
} from 'lucide-react';
import './ScreenshotsShowcase.css';

export default function ScreenshotsShowcase({ onDownloadClick }) {
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  const screens = [
    {
      id: 'dashboard',
      category: 'core',
      title: 'Daily Dashboard',
      subtitle: 'Calories, Macros & Vitals at a Glance',
      badge: 'Home Screen',
      content: (
        <div className="phone-ui phone-ui-dashboard">
          {/* Status Bar */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div className="phone-status-icons">
              <span className="signal-dot"></span>
              <span className="wifi-icon">●●</span>
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
              <div className="macro-bar"><div className="bar-fill p-fill" style={{ width: '60%' }}></div></div>
            </div>
            <div className="macro-card-mini macro-c">
              <span className="macro-tag">CARBS</span>
              <span className="macro-g">110 / 220g</span>
              <div className="macro-bar"><div className="bar-fill c-fill" style={{ width: '50%' }}></div></div>
            </div>
            <div className="macro-card-mini macro-f">
              <span className="macro-tag">FAT</span>
              <span className="macro-g">28 / 65g</span>
              <div className="macro-bar"><div className="bar-fill f-fill" style={{ width: '43%' }}></div></div>
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
              <span className="meal-card-title">Avocado Toast & Eggs</span>
              <span className="meal-card-time">Breakfast · 8:30 AM</span>
              <span className="meal-card-macros">P 24g · C 32g · F 18g</span>
            </div>
            <span className="meal-cal-tag">420 kcal</span>
          </div>
        </div>
      ),
    },
    {
      id: 'scanner',
      category: 'ai',
      title: 'AI Food Scanner',
      subtitle: 'Snap a Photo for Instant Macro Detection',
      badge: 'Vision AI',
      content: (
        <div className="phone-ui phone-ui-scanner">
          <div className="phone-status-bar text-white">
            <span>9:41</span>
            <div className="phone-status-icons">
              <span className="battery-pill">100%</span>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="scanner-viewport">
            <img
              src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"
              alt="Scan Food"
              className="scanner-live-feed"
            />

            {/* AR Target Reticle */}
            <div className="ar-scan-box">
              <div className="scan-corner tl"></div>
              <div className="scan-corner tr"></div>
              <div className="scan-corner bl"></div>
              <div className="scan-corner br"></div>
              <div className="laser-scanner-line"></div>
            </div>

            {/* AI Floating Tag */}
            <div className="ai-recognition-pill">
              <Sparkles size={14} className="sparkle-gold" />
              <span>99.2% Match: Salmon Quinoa Bowl</span>
            </div>
          </div>

          {/* Bottom Nutrition Result Sheet */}
          <div className="scanner-result-sheet">
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <div>
                <h4>Wild Salmon & Avocado Bowl</h4>
                <span className="sheet-weight">380g estimated portion</span>
              </div>
              <span className="sheet-calories">540 kcal</span>
            </div>

            <div className="sheet-macros-row">
              <span className="pill-metric green">🍗 42g Protein</span>
              <span className="pill-metric blue">🍚 38g Carbs</span>
              <span className="pill-metric purple">🥑 22g Healthy Fats</span>
            </div>

            <button className="sheet-log-btn" type="button">
              <CheckCircle2 size={16} />
              <span>Log Meal to Daily Diary</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'coach',
      category: 'ai',
      title: '24/7 AI Coach',
      subtitle: 'Real-time Nutritional Intelligence & Chat',
      badge: 'Coach AI',
      content: (
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
              <span className="coach-status">Online · Active Plan</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-stream">
            <div className="chat-bubble bubble-user">
              What can I eat for dinner to hit my 40g remaining protein?
            </div>

            <div className="chat-bubble bubble-coach">
              <div className="coach-bubble-header">
                <Sparkles size={12} color="#FF5E00" />
                <span>Coach Recommendation</span>
              </div>
              <p>
                Based on your 480 kcal remaining, here are 2 ideal high-protein choices:
              </p>
              <div className="coach-food-option">
                <span>🐟 Grilled Salmon (200g)</span>
                <strong>40g P · 410 kcal</strong>
              </div>
              <div className="coach-food-option">
                <span>🥣 Greek Yogurt + Whey Bowl</span>
                <strong>42g P · 320 kcal</strong>
              </div>
            </div>

            <div className="chat-bubble bubble-user">
              Let's go with the Salmon! Add it to my plan.
            </div>
          </div>

          {/* Input Box */}
          <div className="chat-fake-input">
            <span>Ask your coach anything...</span>
            <div className="send-arrow">↑</div>
          </div>
        </div>
      ),
    },
    {
      id: 'analytics',
      category: 'analytics',
      title: 'Macro Analytics',
      subtitle: 'Weekly Trends & Nutrient Balance',
      badge: 'Reports',
      content: (
        <div className="phone-ui phone-ui-analytics">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>

          <div className="analytics-header">
            <h4>Weekly Trends</h4>
            <span className="analytics-pill">Last 7 Days</span>
          </div>

          {/* Trend Chart Mockup */}
          <div className="analytics-chart-card">
            <div className="chart-stat-top">
              <div>
                <span className="chart-big-val">1,940</span>
                <span className="chart-big-lbl">Daily Avg kcal</span>
              </div>
              <span className="consistency-badge">94% On Target</span>
            </div>

            {/* SVG Bezier Trend Line */}
            <svg viewBox="0 0 200 60" className="trend-svg">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5E00" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FF5E00" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 10 42 Q 40 20, 70 30 T 130 15 T 190 22 L 190 60 L 10 60 Z"
                fill="url(#chartGrad)"
              />
              <path
                d="M 10 42 Q 40 20, 70 30 T 130 15 T 190 22"
                fill="none"
                stroke="#FF5E00"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>

            <div className="chart-days-row">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>

          {/* Macro Distribution */}
          <div className="macro-split-card">
            <h5>Macro Distribution</h5>
            <div className="split-progress-bar">
              <div className="bar-seg seg-p" style={{ width: '35%' }}></div>
              <div className="bar-seg seg-c" style={{ width: '45%' }}></div>
              <div className="bar-seg seg-f" style={{ width: '20%' }}></div>
            </div>
            <div className="split-labels">
              <span><span className="dot p"></span> Protein 35%</span>
              <span><span className="dot c"></span> Carbs 45%</span>
              <span><span className="dot f"></span> Fat 20%</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'recipes',
      category: 'features',
      title: 'Smart Meal Planner',
      subtitle: 'Curated Chef Recipes Tailored to Goals',
      badge: 'Meal Plans',
      content: (
        <div className="phone-ui phone-ui-recipes">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>

          <div className="recipes-top">
            <h4>Personalized Recipes</h4>
            <span className="recipe-filter-tag">High Protein</span>
          </div>

          {/* Featured Recipe Card */}
          <div className="recipe-hero-item">
            <img
              src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80"
              alt="Mediterranean Salad"
              className="recipe-img"
            />
            <div className="recipe-overlay">
              <span className="recipe-tag-pill">20 Min Prep</span>
              <h5>Mediterranean Chicken & Quinoa Bowl</h5>
              <div className="recipe-macro-row">
                <span>🔥 480 kcal</span>
                <span>🍗 44g Protein</span>
                <span>🥑 16g Fat</span>
              </div>
            </div>
          </div>

          <div className="recipe-mini-card">
            <div className="recipe-mini-icon">🥑</div>
            <div className="recipe-mini-info">
              <h6>Keto Avocado & Salmon Toast</h6>
              <span>10 min · 380 kcal · 32g Protein</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'weight',
      category: 'features',
      title: 'Weight & Milestones',
      subtitle: 'Body Weight Tracking & BMI Analytics',
      badge: 'Body Progress',
      content: (
        <div className="phone-ui phone-ui-weight">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>

          <div className="weight-card-top">
            <div>
              <span className="weight-eyebrow">CURRENT WEIGHT</span>
              <h3 className="weight-big-num">72.4 <span className="unit">kg</span></h3>
            </div>
            <div className="bmi-pill-badge">
              <span>BMI 22.4 · Healthy</span>
            </div>
          </div>

          {/* Goal Progress Banner */}
          <div className="goal-milestone-card">
            <div className="goal-trophy">🏆</div>
            <div>
              <span className="goal-title">Milestone Achieved!</span>
              <span className="goal-sub">-3.6 kg lost towards 68 kg target</span>
            </div>
          </div>

          {/* Mini Weight History */}
          <div className="weight-log-list">
            <div className="weight-log-row">
              <span>Today (Morning)</span>
              <strong>72.4 kg</strong>
            </div>
            <div className="weight-log-row">
              <span>Yesterday</span>
              <strong>72.7 kg</strong>
            </div>
            <div className="weight-log-row">
              <span>3 days ago</span>
              <strong>73.1 kg</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'voice',
      category: 'ai',
      title: 'Voice Logging',
      subtitle: 'Hands-Free Meal Logging with AI',
      badge: 'Voice AI',
      content: (
        <div className="phone-ui phone-ui-voice">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Voice Log</h4>
            <span style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>Listening...</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 16px', gap: 12 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FF5E00 0%, #FF8533 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(255,94,0,0.3)' }}>
              <Mic size={36} color="#fff" />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>"I had a grilled chicken salad with avocado for lunch"</p>
          </div>
          <div style={{ margin: '0 16px', padding: '14px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Detected Meal</span>
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>✓ Parsed</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
              <div>🥗 Grilled Chicken Salad</div>
              <div>🥑 Avocado (½ medium)</div>
              <div style={{ marginTop: 6, fontWeight: 600 }}>Total: 420 kcal · P 38g · C 12g · F 22g</div>
            </div>
          </div>
          <button className="sheet-log-btn" type="button" style={{ margin: '14px 16px' }}>
            <CheckCircle2 size={16} />
            <span>Confirm & Log</span>
          </button>
        </div>
      ),
    },
    {
      id: 'grocery',
      category: 'planning',
      title: 'Grocery Intelligence',
      subtitle: 'Smart Shopping Lists for Your Goals',
      badge: 'Smart Shopping',
      content: (
        <div className="phone-ui phone-ui-grocery">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Shopping List</h4>
            <span style={{ fontSize: '0.7rem', background: '#fff7ed', color: '#ea580c', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>This Week</span>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FF5E00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🥩 Proteins</div>
            {['Chicken Breast (1kg)', 'Salmon Fillet (500g)', 'Greek Yogurt × 4'].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 10, fontSize: '0.78rem', color: '#334155' }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid #cbd5e1' }}></span>
                {item}
              </div>
            ))}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>🥬 Produce</div>
            {['Avocados × 4', 'Spinach (200g)', 'Sweet Potatoes × 3'].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 10, fontSize: '0.78rem', color: '#334155' }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid #cbd5e1' }}></span>
                {item}
              </div>
            ))}
          </div>
          <div style={{ margin: '8px 16px', padding: '10px', background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', borderRadius: 12, fontSize: '0.72rem', color: '#92400e', fontWeight: 600, textAlign: 'center' }}>
            💡 Estimated total: $42 · Covers 7-day meal plan
          </div>
        </div>
      ),
    },
    {
      id: 'health',
      category: 'tracking',
      title: 'Health Tracking',
      subtitle: 'Connect Food, Energy, Sleep & Mood',
      badge: 'Vital Signs',
      content: (
        <div className="phone-ui phone-ui-health">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Health Overview</h4>
            <span style={{ fontSize: '0.7rem', background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>Today</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 16px' }}>
            <div style={{ background: '#fef2f2', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <Heart size={20} color="#dc2626" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>72</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Resting BPM</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <Activity size={20} color="#16a34a" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>8.2k</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Steps</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>😴</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>7.5h</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Sleep</div>
            </div>
            <div style={{ background: '#fefce8', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>High</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Energy</div>
            </div>
          </div>
          <div style={{ margin: '6px 16px', padding: '10px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>AI Insight</div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>Your energy is higher on days with 30g+ protein at breakfast. Keep it up! 💪</p>
          </div>
        </div>
      ),
    },
    {
      id: 'water',
      category: 'tracking',
      title: 'Water Tracking',
      subtitle: 'Smart Hydration Reminders & Goals',
      badge: 'Hydration',
      content: (
        <div className="phone-ui phone-ui-water">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Hydration</h4>
            <Droplets size={18} color="#0891b2" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px', gap: 8 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'conic-gradient(#0891b2 0deg, #0891b2 252deg, #e2e8f0 252deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0891b2' }}>1.8L</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b' }}>of 2.5L goal</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 16px' }}>
            {['250ml', '350ml', '500ml'].map((amt) => (
              <button key={amt} type="button" style={{ padding: '8px 14px', borderRadius: 12, background: '#ecfeff', border: '1px solid #a5f3fc', fontSize: '0.75rem', fontWeight: 700, color: '#0891b2', cursor: 'pointer' }}>+ {amt}</button>
            ))}
          </div>
          <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {['8:00 AM — 350ml ☕', '10:30 AM — 500ml 💧', '1:00 PM — 500ml 💧', '3:30 PM — 450ml 💧'].map((entry, i) => (
              <div key={i} style={{ fontSize: '0.72rem', color: '#475569', padding: '5px 10px', background: '#f8fafc', borderRadius: 8 }}>{entry}</div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'reports',
      category: 'tracking',
      title: 'Progress Reports',
      subtitle: 'Weekly & Monthly Health Summaries',
      badge: 'Reports',
      content: (
        <div className="phone-ui phone-ui-reports">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Weekly Report</h4>
            <span style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>Aug 18-24</span>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', borderRadius: 14, padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Score</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#FF5E00' }}>92<span style={{ fontSize: '0.9rem' }}>/100</span></div>
              <div style={{ fontSize: '0.7rem', color: '#c2410c' }}>🔥 Your best week yet!</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>6/7</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Days on track</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>1,960</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Avg kcal</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#16a34a' }}>-0.4kg</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Weight Δ</div>
              </div>
            </div>
            <div style={{ padding: '10px', background: '#eff6ff', borderRadius: 12, fontSize: '0.7rem', color: '#1e40af', lineHeight: 1.5 }}>
              📊 Protein intake improved by 15% vs last week. Keep prioritizing lean protein sources.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'insights',
      category: 'ai',
      title: 'AI Weekly Insights',
      subtitle: 'Smart Patterns & Proactive Coaching',
      badge: 'AI Insights',
      content: (
        <div className="phone-ui phone-ui-insights">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>AI Insights</h4>
            <Sparkles size={18} color="#FF5E00" />
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fff7ed)', borderRadius: 14, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={14} color="#d97706" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>Pattern Detected</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#78350f', lineHeight: 1.55, margin: 0 }}>You tend to under-eat protein on weekends (avg 90g vs 135g weekdays). Try prepping a protein-rich snack for Saturdays.</p>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <TrendingUp size={14} color="#16a34a" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>Positive Trend</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#14532d', lineHeight: 1.55, margin: 0 }}>Your fiber intake increased 22% this month. Great for digestion and heart health! 🎉</p>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 14, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Target size={14} color="#2563eb" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af' }}>Goal Adjustment</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#1e3a5f', lineHeight: 1.55, margin: 0 }}>Based on your progress, consider increasing daily calories by 100 kcal to support muscle gain.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'family',
      category: 'lifestyle',
      title: 'Family Mode',
      subtitle: 'Manage Nutrition for Your Household',
      badge: 'Household',
      content: (
        <div className="phone-ui phone-ui-family">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Family</h4>
            <Users size={18} color="#0d9488" />
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Alex (You)', emoji: '👤', cal: '1,420 / 2,000', pct: 71, color: '#FF5E00' },
              { name: 'Sarah', emoji: '👩', cal: '1,100 / 1,800', pct: 61, color: '#8b5cf6' },
              { name: 'Max', emoji: '👦', cal: '900 / 1,600', pct: 56, color: '#0891b2' },
            ].map((member, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 14, padding: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.3rem' }}>{member.emoji}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{member.name}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{member.cal} kcal</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${member.pct}%`, background: member.color, borderRadius: 3 }}></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ margin: '6px 16px', padding: '10px', background: '#f0fdfa', borderRadius: 12, fontSize: '0.7rem', color: '#0f766e', textAlign: 'center', fontWeight: 600 }}>
            👨‍👩‍👦 Family dinner planned: Mediterranean Bowl (serves 3)
          </div>
        </div>
      ),
    },
    {
      id: 'barcode',
      category: 'tracking',
      title: 'Barcode Scanner',
      subtitle: 'Scan Packaged Foods Instantly',
      badge: 'Instant Scan',
      content: (
        <div className="phone-ui phone-ui-barcode">
          <div className="phone-status-bar text-white">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div style={{ background: '#0f172a', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Scan Barcode</h4>
              <ScanLine size={18} color="#FF5E00" />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 30px' }}>
              <div style={{ width: '100%', height: 80, border: '2px solid rgba(255,94,0,0.6)', borderRadius: 12, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 2, background: '#FF5E00', boxShadow: '0 0 10px #FF5E00', animation: 'pulse 2s infinite' }}></div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[3,5,2,4,6,2,5,3,4,6,2,5,3,4,2,5,6,3,4,2].map((h, i) => (
                    <div key={i} style={{ width: i % 3 === 0 ? 2 : 1, height: h * 6, background: 'rgba(255,255,255,0.7)' }}></div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Product Found</span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Organic Almond Butter</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8 }}>Serving: 32g (2 tbsp)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#c2410c', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>196 kcal</span>
                <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>P 7g</span>
                <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>F 17g</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'recommendations',
      category: 'ai',
      title: 'Smart Recommendations',
      subtitle: 'Personalized Guidance That Adapts',
      badge: 'Tailored Diet',
      content: (
        <div className="phone-ui phone-ui-recs">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>For You</h4>
            <Target size={18} color="#d97706" />
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: '#fff7ed', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>🎯 Today's Focus</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Boost your iron intake</div>
              <p style={{ fontSize: '0.7rem', color: '#78350f', lineHeight: 1.5, margin: 0 }}>Your iron has been low this week. Try adding spinach or lentils today.</p>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', marginTop: 4 }}>Recommended Meals</div>
            {[
              { name: 'Lentil & Spinach Curry', cals: '380 kcal', tag: 'High Iron' },
              { name: 'Steak & Quinoa Bowl', cals: '520 kcal', tag: 'Iron + Protein' },
            ].map((meal, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{meal.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{meal.cals}</div>
                </div>
                <span style={{ fontSize: '0.62rem', background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: 8, fontWeight: 600 }}>{meal.tag}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'habits',
      category: 'lifestyle',
      title: 'Habit Coaching',
      subtitle: 'Build Sustainable Healthy Habits',
      badge: 'Daily Habits',
      content: (
        <div className="phone-ui phone-ui-habits">
          <div className="phone-status-bar">
            <span>9:41</span>
            <span className="battery-pill">100%</span>
          </div>
          <div className="phone-header-row">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Habits</h4>
            <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#059669', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>5/7 Done</span>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { habit: 'Drink 2.5L water', emoji: '💧', done: true, streak: '14d' },
              { habit: 'Log all 3 meals', emoji: '📝', done: true, streak: '8d' },
              { habit: '30g protein at breakfast', emoji: '🍳', done: true, streak: '5d' },
              { habit: '10k steps daily', emoji: '🚶', done: true, streak: '3d' },
              { habit: 'No snacks after 8pm', emoji: '🌙', done: true, streak: '7d' },
              { habit: 'Eat 5 servings of veggies', emoji: '🥬', done: false, streak: '—' },
              { habit: 'Take daily vitamins', emoji: '💊', done: false, streak: '—' },
            ].map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: h.done ? '#f0fdf4' : '#f8fafc', borderRadius: 10, border: `1px solid ${h.done ? '#bbf7d0' : '#e2e8f0'}` }}>
                <span style={{ fontSize: '1rem' }}>{h.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: h.done ? '#166534' : '#64748b', textDecoration: h.done ? 'none' : 'none' }}>{h.habit}</div>
                </div>
                <span style={{ fontSize: '0.62rem', color: h.done ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>{h.done ? `🔥 ${h.streak}` : h.streak}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const filteredScreens =
    activeCategory === 'all'
      ? screens
      : screens.filter((s) => s.category === activeCategory || s.id === activeCategory);

  return (
    <section id="features" className="section-padding screenshots-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header text-center">
          <span className="badge-tag">
            <Layers size={14} />
            <span>FEATURES</span>
          </span>
          <h2 className="section-title">Everything you need, beautifully designed</h2>
          <p className="section-subtitle">
            Fifteen intelligent features and pixel-perfect ergonomics crafted with native fluidity and modern intelligence.
          </p>

          {/* Category Filter Pills */}
          <div className="screens-filter-pills">
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All Screens
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'core' ? 'active' : ''}`}
              onClick={() => setActiveCategory('core')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveCategory('ai')}
            >
              AI & Vision
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'tracking' ? 'active' : ''}`}
              onClick={() => setActiveCategory('tracking')}
            >
              Tracking
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'planning' ? 'active' : ''}`}
              onClick={() => setActiveCategory('planning')}
            >
              Planning
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveCategory('analytics')}
            >
              Analytics
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'lifestyle' ? 'active' : ''}`}
              onClick={() => setActiveCategory('lifestyle')}
            >
              Lifestyle
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'features' ? 'active' : ''}`}
              onClick={() => setActiveCategory('features')}
            >
              Recipes & Weight
            </button>
          </div>
        </div>

        {/* Device Carousel Track */}
        <div className="screens-scroll-container">
          <div className="screens-track">
            {filteredScreens.map((sc) => (
              <div
                key={sc.id}
                className="screen-card-item"
                onClick={() => setSelectedScreen(sc)}
              >
                <span className="screen-pill-badge">{sc.badge}</span>

                {/* Modern Titanium Chassis Phone Frame */}
                <div className="titanium-phone-frame">
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

                    {/* UI Content */}
                    {sc.content}
                  </div>
                </div>

                {/* Bottom Card Info */}
                <div className="screen-card-info">
                  <h3 className="screen-card-title">{sc.title}</h3>
                  <p className="screen-card-subtitle">{sc.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Interactive Zoom Modal */}
      {selectedScreen && (
        <div className="screenshot-modal-backdrop" onClick={() => setSelectedScreen(null)}>
          <div className="screenshot-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedScreen(null)}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <div className="modal-phone-wrapper">
              <div className="titanium-phone-frame modal-phone-scale">
                <div className="hw-button hw-action"></div>
                <div className="hw-button hw-volume-up"></div>
                <div className="hw-button hw-volume-down"></div>
                <div className="hw-button hw-power"></div>

                <div className="phone-screen-display">
                  <div className="dynamic-island-pill">
                    <div className="camera-lens"></div>
                  </div>
                  <div className="screen-glare-overlay"></div>
                  {selectedScreen.content}
                </div>
              </div>
            </div>

            <div className="modal-screen-details">
              <span className="badge-tag">{selectedScreen.badge}</span>
              <h3>{selectedScreen.title}</h3>
              <p>{selectedScreen.subtitle}</p>
              <button
                type="button"
                className="btn btn-accent modal-cta-btn"
                onClick={() => {
                  setSelectedScreen(null);
                  if (onDownloadClick) onDownloadClick();
                }}
              >
                <Sparkles size={16} />
                <span>Get Caliwo App Free</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
