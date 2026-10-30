import React from 'react';
import { Lock, EyeOff, ShieldCheck, Cloud, Shield } from 'lucide-react';
import './PrivacySecurity.css';

export default function PrivacySecurity() {
  const cards = [
    {
      icon: <Lock size={22} />,
      title: 'End-to-end encryption',
      desc: 'Your data is encrypted in transit and at rest.'
    },
    {
      icon: <EyeOff size={22} />,
      title: 'Never sold',
      desc: 'We never sell your personal data to third parties.'
    },
    {
      icon: <ShieldCheck size={22} />,
      title: "You're in control",
      desc: 'Export or delete your data anytime instantly.'
    },
    {
      icon: <Cloud size={22} />,
      title: 'Secure infrastructure',
      desc: 'Built on enterprise cloud systems.'
    }
  ];

  return (
    <section className="section-padding privacy-section">
      <div className="container">
        <div className="privacy-container-box">
          {/* Centered Header */}
          <div className="section-header text-center">
            <div className="badge-tag">
              <Shield size={16} />
              <span>Privacy-first by design</span>
            </div>

            <h2 className="section-title">
              Your health data stays <span className="text-gradient">yours</span>
            </h2>

            <p className="section-subtitle">
              We built Caliwo with security at its core. Transparent AI, bank-grade encryption, and a simple promise: we will never sell your personal information.
            </p>
          </div>

          {/* Security Cards */}
          <div className="privacy-grid">
            {cards.map((card, idx) => (
              <div key={idx} className="security-card">
                <div className="security-icon-box">{card.icon}</div>
                <h3 className="security-card-title">{card.title}</h3>
                <p className="security-card-desc">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="privacy-badge-wrap">
            <div className="compliance-badge">
              <div className="shield-icon-wrap">🛡️</div>
              <div>
                <strong>GDPR &amp; CCPA</strong>
                <span>Compliant data practices</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
