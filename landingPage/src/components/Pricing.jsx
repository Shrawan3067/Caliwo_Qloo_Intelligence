import React, { useState, useEffect } from 'react';
import { Check, Sparkles, Star } from 'lucide-react';
import './Pricing.css';

export default function Pricing({ onDownloadClick }) {
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState('yearly');

  useEffect(() => {
    try {
      // Automatic location / currency detection based on device timezone & locale
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const isIndiaTimezone =
        timeZone.includes('Kolkata') ||
        timeZone.includes('Calcutta') ||
        timeZone.includes('Asia/Kolkata') ||
        timeZone.includes('Asia/Calcutta');

      const userLang = (navigator.language || navigator.userLanguage || '').toUpperCase();
      const isIndiaLocale = userLang.endsWith('-IN') || userLang === 'HI' || userLang === 'IN';

      if (isIndiaTimezone || isIndiaLocale) {
        setCurrency('INR');
      } else {
        setCurrency('USD');
      }
    } catch {
      setCurrency('USD');
    }
  }, []);

  const getPriceData = () => {
    if (currency === 'INR') {
      if (billingCycle === 'monthly') {
        return {
          val: '₹949',
          period: '/ month',
          subtext: 'Billed monthly · Cancel anytime',
          saveText: null
        };
      }
      return {
        val: '₹3,000',
        period: '/ year',
        subtext: 'Just ₹250/mo · Billed annually at ₹3,000',
        saveText: 'SAVE 74%'
      };
    } else {
      if (billingCycle === 'monthly') {
        return {
          val: '$9.99',
          period: '/ month',
          subtext: 'Billed monthly · Cancel anytime',
          saveText: null
        };
      }
      return {
        val: '$29.99',
        period: '/ year',
        subtext: 'Just $2.50/mo · Billed annually at $29.99',
        saveText: 'SAVE 75%'
      };
    }
  };

  const currentPrice = getPriceData();

  return (
    <section id="pricing" className="section-padding pricing-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header text-center">
          <span className="badge-tag">PRICING</span>
          <h2 className="section-title">Simple, transparent plans</h2>
          <p className="section-subtitle">
            Start with a 3-day free trial on all Pro plans. Cancel anytime.
          </p>

          {/* Billing Switch Tabs */}
          <div className="billing-pill-tabs">
            <button 
              className={`billing-pill-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly ({currency === 'INR' ? '₹949/mo' : '$9.99/mo'})
            </button>
            <button 
              className={`billing-pill-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly ({currency === 'INR' ? '₹3,000/yr' : '$29.99/yr'})
              <span className="discount-badge">
                {currency === 'INR' ? 'Save 74%' : 'Save 75%'}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="pricing-grid">
          {/* Free Card */}
          <div className="pricing-card free-card">
            <div className="card-header">
              <h3 className="plan-name">Free</h3>
              <p className="plan-desc">Essential tools to get started</p>
            </div>

            <div className="plan-price">
              <span className="price-val">{currency === 'INR' ? '₹0' : '$0'}</span>
              <span className="price-period">/ forever</span>
            </div>

            <ul className="plan-features">
              <li><Check size={16} className="check-icon" /> Basic Calorie &amp; Macro Tracking</li>
              <li><Check size={16} className="check-icon" /> AI Photo Food Scanner (Limited)</li>
              <li><Check size={16} className="check-icon" /> Water Hydration Log</li>
              <li><Check size={16} className="check-icon" /> Access to Public Recipes</li>
            </ul>

            <button className="btn btn-outline plan-btn" onClick={onDownloadClick}>
              Download Free
            </button>
          </div>

          {/* Caliwo Pro Card */}
          <div className="pricing-card premium-card">
            <div className="popular-badge">MOST POPULAR</div>

            <div className="card-header">
              <div className="pro-badge-header">
                <Star size={18} className="star-icon" />
                <h3 className="plan-name">Caliwo Pro</h3>
              </div>
              <p className="plan-desc">Unlock 6 macros, unlimited AI vision, &amp; family sharing</p>
            </div>

            <div className="plan-price">
              <span className="price-val">{currentPrice.val}</span>
              <span className="price-period">{currentPrice.period}</span>
            </div>
            <p className="price-sub-note">{currentPrice.subtext}</p>

            <ul className="plan-features">
              <li><Check size={16} className="check-icon-teal" /> <strong>3-Day Free Trial</strong> included for everyone</li>
              <li><Check size={16} className="check-icon-teal" /> <strong>Qloo 6-Domain Taste DNA</strong> (Music, Film, Dining, Travel)</li>
              <li><Check size={16} className="check-icon-teal" /> <strong>Autonomous AI Coach</strong> with live biometric tool calling</li>
              <li><Check size={16} className="check-icon-teal" /> <strong>Bio-Cultural Alignment</strong> scoring &amp; recipe synthesis</li>
              <li><Check size={16} className="check-icon-teal" /> Full 6-Nutrient Breakdown (Protein, Fat, Fiber, Sugar, Magnesium)</li>
              <li><Check size={16} className="check-icon-teal" /> Unlimited AI Computer-Vision Meal Scans</li>
            </ul>

            <button className="btn btn-accent plan-btn" onClick={onDownloadClick}>
              <Sparkles size={16} />
              <span>Start 3-Day Free Trial</span>
            </button>
          </div>
        </div>

        {/* Hackathon Judge Testing Note */}
        <div className="pricing-bottom-store text-center">
          <div className="pricing-judge-box">
            <span className="pricing-judge-badge">🏆 QLOO HACKATHON EVALUATION</span>
            <p className="pricing-judge-text">
              Judges can test all Pro &amp; Agentic capabilities free of charge via the downloadable Android .APK build.
              Tap <strong>"Fill Hackathon Demo Account"</strong> on the mobile login screen to evaluate.
            </p>
            <a 
              href="/caliwo-release.apk" 
              download="caliwo-release.apk" 
              className="btn btn-primary pricing-apk-download-btn"
            >
              <Sparkles size={16} />
              <span>Download Android .APK Build (56 MB)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

