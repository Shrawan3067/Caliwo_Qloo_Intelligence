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

        {/* Bottom Store Prompt */}
        <div className="pricing-bottom-store text-center">
          <p>Download the app to start your 3-day free trial</p>
          <div className="pricing-store-btns">
            <button className="store-btn" onClick={onDownloadClick}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.34-.58.67-1.09 1.75-.95 2.78 1.01.08 2.05-.52 2.67-1.27z"/>
              </svg>
              <div className="store-btn-text">
                <span className="store-btn-subtitle">DOWNLOAD ON THE</span>
                <span className="store-btn-title">App Store</span>
              </div>
            </button>

            <button className="store-btn" onClick={onDownloadClick}>
              <svg width="28" height="28" viewBox="0 0 512 512">
                <path fill="#4285F4" d="M30 36.3C27.4 39 26 43 26 48.3v415.4c0 5.3 1.4 9.3 4 12l.6.6L263 244v-4L30.6 35.7l-.6.6z"/>
                <path fill="#34A853" d="M341.9 322.9l-78.9-78.9v-4l78.9-78.9.7.4 93.5 53.1c26.7 15.2 26.7 40.1 0 55.3l-93.5 53-.7.4z"/>
                <path fill="#EA4335" d="M342.6 322.5L263 243 30.6 475.4c8.8 9.3 23.3 10.4 39.4 1.3l272.6-154.2z"/>
                <path fill="#FBBC04" d="M342.6 163.5L70 9.3C53.9.2 39.4 1.3 30.6 10.6L263 243l79.6-79.5z"/>
              </svg>
              <div className="store-btn-text">
                <span className="store-btn-subtitle">GET IT ON</span>
                <span className="store-btn-title">Google Play</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

