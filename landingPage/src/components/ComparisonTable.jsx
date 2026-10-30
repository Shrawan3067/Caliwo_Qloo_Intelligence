import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import './ComparisonTable.css';

export default function ComparisonTable() {
  const comparisons = [
    {
      feature: 'Cultural Intelligence',
      caliwo: 'Eliminates cultural blindness via Qloo 6-Domain Taste Graph (films, artists, venues, travel)',
      others: 'Culturally blind — generic Western diet plans (plain chicken breast & rice for everyone)'
    },
    {
      feature: 'Agentic Tool Architecture',
      caliwo: 'Autonomous multi-turn agent tool execution (macro gaps inspection + Qloo graph querying + recipe synthesis)',
      others: 'Basic LLM wrapper with hallucinated nutritional facts'
    },
    {
      feature: 'Bio-Cultural Scoring',
      caliwo: 'Verified dual-factor formula (60% cultural affinity + 40% biometric precision)',
      others: 'None — clinical numbers disconnected from real lifestyle'
    },
    {
      feature: 'AI Computer Vision',
      caliwo: 'Computer vision trained across global cuisines and complex mixed dishes',
      others: 'Manual barcode typing or single-item guesswork'
    },
    {
      feature: 'Nutrient Tracking Depth',
      caliwo: 'Comprehensive 6-macro tracking (Protein, Carbs, Fat, Fiber, Sugar, Magnesium)',
      others: 'Basic Calorie counting only'
    }
  ];

  return (
    <section id="comparison" className="section-padding comparison-section">
      <div className="container">
        {/* Header */}
        <div className="section-header text-center">
          <div className="badge-tag">
            <Sparkles size={14} />
            <span>SOLVING CULTURALLY BLIND AI</span>
          </div>
          <h2 className="section-title">Beyond generic calorie counting</h2>
          <p className="section-subtitle">
            See why Caliwo isn't just another tracker — but an agentic companion powered by Qloo's cultural taste graph.
          </p>
        </div>

        {/* Table Container */}
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="th-feature">Architecture &amp; Features</th>
                <th className="th-caliwo">Caliwo (Qloo AI)</th>
                <th className="th-others">Traditional Apps</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, idx) => (
                <tr key={idx}>
                  <td className="td-feature">{row.feature}</td>
                  <td className="td-caliwo">
                    <div className="td-cell">
                      <div className="check-icon-bg">
                        <Check size={14} className="check-svg" />
                      </div>
                      <span>{row.caliwo}</span>
                    </div>
                  </td>
                  <td className="td-others">
                    <div className="td-cell">
                      <div className="cross-icon-bg">
                        <X size={14} className="cross-svg" />
                      </div>
                      <span>{row.others}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
