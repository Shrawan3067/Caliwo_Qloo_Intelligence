import React from 'react';
import { Scan, Compass, Cpu, ChefHat, BarChart3, Sparkles } from 'lucide-react';
import './CaliwoIntelligence.css';

export default function CaliwoIntelligence() {
  const cards = [
    {
      icon: <Scan size={22} className="card-ai-icon text-cyan" />,
      title: 'Computer Vision AI',
      desc: 'Instant 6-macro breakdown and portion estimation from a single photo.'
    },
    {
      icon: <Compass size={22} className="card-ai-icon text-indigo" />,
      title: 'Qloo 6-Domain Taste DNA',
      desc: 'Connects dining preferences with your cinema, music, and travel tastes.'
    },
    {
      icon: <Cpu size={22} className="card-ai-icon text-emerald" />,
      title: 'Autonomous Agent Tools',
      desc: 'Multi-turn agent calls live tools to fetch macro gaps & synthesize recipes.'
    },
    {
      icon: <ChefHat size={22} className="card-ai-icon text-amber" />,
      title: 'Bio-Cultural Calibration',
      desc: 'Portions dynamically adjust to hit daily calorie & protein targets.'
    },
    {
      icon: <BarChart3 size={22} className="card-ai-icon text-purple" />,
      title: 'Deep Micronutrient Tracking',
      desc: 'Full visibility across Protein, Fat, Fiber, Sugar, and Magnesium.'
    },
    {
      icon: <Sparkles size={22} className="card-ai-icon text-teal" />,
      title: 'Dynamic Taste Evolution',
      desc: 'Taste profile refines with every meal logged and new cuisine explored.'
    }
  ];

  return (
    <section id="ai-coach" className="section-padding intelligence-section">
      <div className="container">
        <div className="dark-intelligence-banner">
          {/* Inner Header */}
          <div className="intelligence-header text-center">
            <div className="badge-tag badge-tag-dark">
              <Sparkles size={16} />
              <span>QLOO CULTURAL INTELLIGENCE</span>
            </div>
            <h2 className="intelligence-title">
              AI that understands <span className="text-gradient-cyan">culture &amp; biometrics</span>
            </h2>
            <p className="intelligence-subtitle">
              More than a tracker — an autonomous companion that fuses real-time physical biometrics with Qloo's cultural taste graph to eliminate culturally blind nutrition.
            </p>
          </div>

          {/* 6 Dark Cards Grid */}
          <div className="intelligence-grid">
            {cards.map((item, idx) => (
              <div key={idx} className="intelligence-card">
                <div className="intelligence-icon-box">
                  {item.icon}
                </div>
                <h3 className="intelligence-card-title">{item.title}</h3>
                <p className="intelligence-card-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
