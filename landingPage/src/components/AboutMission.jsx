import React from 'react';
import { Target, Globe, Heart, Compass } from 'lucide-react';
import './AboutMission.css';

export default function AboutMission() {
  const cards = [
    {
      icon: <Compass size={22} className="mission-icon-emerald" />,
      title: 'Our core thesis',
      desc: 'Nutrition AI cannot be culturally blind. Eating is identity, memory, and heritage — not just grams of fuel.'
    },
    {
      icon: <Globe size={22} className="mission-icon-teal" />,
      title: 'Powered by Qloo',
      desc: 'Bridging physical bio-metrics with 250M+ cultural entities across music, cinema, travel, and dining.'
    },
    {
      icon: <Heart size={22} className="mission-icon-rose" />,
      title: 'Built for hackathon excellence',
      desc: 'Architected with autonomous agent tool calling and live mathematical alignment equations.'
    }
  ];

  return (
    <section id="about" className="section-padding about-section">
      <div className="container">
        <div className="section-header text-center">
          <span className="badge-tag">OUR MISSION</span>
          <h2 className="section-title">Eliminating culturally blind AI in health</h2>
          <p className="section-subtitle">
            Most nutrition apps force generic, Western-centric diet plans on everyone. Caliwo pairs computer-vision macro tracking with Qloo's Cultural Taste Graph to celebrate human culinary diversity while hitting rigorous biometric targets.
          </p>
        </div>

        {/* Right 3 Cards */}
        <div className="about-cards-list">
          {cards.map((card, idx) => (
            <div key={idx} className="about-card-item">
              <div className="about-card-icon">{card.icon}</div>
              <div className="about-card-text">
                <h3 className="about-card-title">{card.title}</h3>
                <p className="about-card-desc">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
