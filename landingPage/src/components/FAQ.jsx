import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import "./FAQ.css";

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: "How does Caliwo's AI recognize my food?",
      a: "Caliwo uses state-of-the-art computer vision models trained on millions of meal images to instantly identify food items, estimate portion sizes, and calculate a precise 6-macro breakdown including protein, fat, fiber, sugar, sodium, and magnesium.",
    },
    {
      q: "How does Caliwo prevent cultural blindness in its coaching?",
      a: "While standard computer vision tracks physical plate ingredients, Caliwo acts as an agentic companion by injecting Qloo’s V2 API. It cross-references your nutritional metrics with your cross-domain taste profile—including your favorite film genres, music artists, and venue aesthetics—ensuring coaching aligns with your lifestyle instead of forcing dry, sterile restrictions.",
    },
    {
      q: "What makes Caliwo structurally different from a typical calorie counter?",
      a: "Traditional apps are rigid, manual data logs. Caliwo is a culturally aware nutrition agent. By mapping your physical profile alongside Qloo’s taste graph of over 250 million entities, the app understands the relationship between your personal identity and your culinary habits to suggest recipes and local restaurant menu items that match your vibe and your macros.",
    },
    {
      q: "How does the Qloo Taste DNA integration affect meal and recipe suggestions?",
      a: "When you complete your non-skippable taste onboarding, Caliwo maps your entertainment preferences to culinary aesthetics via Qloo's affinity data. If you are in a strict calorie deficit but love minimalist espresso bars and indie cinema, your coach dynamically designs high-magnesium, low-sugar culinary blueprints matching that precise environmental context.",
    },
    {
      q: "Is my personal health and cultural taste data private and secure?",
      a: "Yes. Your physical bio-metrics and personal taste preferences are protected by bank-grade end-to-end encryption for all data in transit and at rest. We are fully GDPR and CCPA compliant, ensuring your health profile is strictly private and never sold to third parties.",
    },
    {
      q: "Does Caliwo work for medical parameters or highly specific diets?",
      a: "Absolutely. Caliwo's dual-engine approach supports standard setups like Keto, Vegan, Vegetarian, Low-Carb, and custom macro targets, while utilizing cultural intelligence to tailor meal planning around specific metabolic constraints like tracking fiber, sugar, and magnesium.",
    },
    {
      q: "Do I need internet to access my taste engine and log meals?",
      a: "Caliwo features local offline logging support. You can scan plates and chat with your nutrition companion while completely offline. Once a network handshake is established, the app updates your background data and runs a fresh alignment check with the Qloo API endpoints.",
    },
    {
      q: "Which platforms are available for testing the live agent functionalities?",
      a: "Caliwo is natively built for both iOS and Android. For the hackathon evaluation, judges can download the verified, production-ready .APK file directly from our landing page to test the live pre-signup onboarding flow and agentic chat interfaces on an Android 10+ device.",
    },
  ];

  return (
    <section id="faq" className="section-padding faq-section">
      <div className="container">
        {/* Header */}
        <div className="section-header text-center">
          <span className="badge-tag">FAQ</span>
          <h2 className="section-title">Questions, answered</h2>
          <p className="section-subtitle">
            Got questions about Caliwo? Find answers to everything you need to
            know below.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="faq-accordion">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`faq-item ${openIdx === idx ? "open" : ""}`}
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            >
              <div className="faq-question-row">
                <h3 className="faq-question-text">{faq.q}</h3>
                <ChevronDown className="faq-arrow-icon" size={20} />
              </div>

              {openIdx === idx && (
                <div className="faq-answer-content">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
