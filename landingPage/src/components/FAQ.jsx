import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import "./FAQ.css";

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: "How do hackathon judges test the Caliwo mobile app?",
      a: "Judges can test Caliwo exclusively on Android by downloading our verified production build (caliwo-release.apk, 56 MB) directly from the download buttons on this landing page. You can sideload it onto any physical Android device running Android 10+ (API 29+) or drag-and-drop it into an Android Studio / Genymotion emulator. On the mobile sign-in screen, tap 'Fill Hackathon Demo Account' for instant 1-tap evaluation.",
    },
    {
      q: "Why is the app testable only on Android via .APK build (not Google Play or Apple App Store)?",
      a: "For the Qloo Agentic AI Hackathon, Caliwo connects directly to unthrottled live Qloo V2 API endpoints and dynamic agentic tool-calling loops hosted on our AWS EC2 backend. To provide judges with immediate, frictionless access without the delays of Google Play Store or Apple App Store review cycles, we distribute the verified production APK directly. Public store releases will follow post-hackathon.",
    },
    {
      q: "Do I need to sign up or create an account to test the mobile app?",
      a: "No! On the welcome and sign-in screen of the Android app, we have placed a dedicated 'Fill Hackathon Demo Account' button. Simply tap it, and you will be logged in immediately with pre-configured 6-domain taste DNA profiles, daily macro targets, and seeded meal histories so you can jump straight into evaluating the agentic capabilities.",
    },
    {
      q: "How does Caliwo's AI recognize my food and calculate macros?",
      a: "Caliwo uses Gemini computer vision models trained on meal images to identify food items, estimate portion sizes, and calculate a precise 6-macro breakdown including Protein, Fat, Carbs, Fiber, Sugar, and Magnesium in real time.",
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
      a: "When you complete your taste onboarding, Caliwo maps your entertainment preferences to culinary aesthetics via Qloo's affinity data. If you are in a calorie deficit but love minimalist espresso bars and indie cinema, your coach dynamically designs high-magnesium, low-sugar culinary blueprints matching that precise environmental context.",
    },
    {
      q: "Is my personal health and cultural taste data private and secure?",
      a: "Yes. Your physical bio-metrics and personal taste preferences are protected with bank-grade encryption in transit and at rest. We are fully GDPR and CCPA compliant, ensuring your profile is strictly private.",
    },
    {
      q: "Can I test the agent functionalities directly in my browser without an Android device?",
      a: "Yes! If you do not have an Android device or emulator on hand, click the 'Try Live Web Demo' button anywhere on this landing page to open our interactive in-browser playground. It lets you simulate plate scans and inspect live Qloo 6-domain Taste DNA persona calculations (Tokyo, Amalfi, Oaxaca) in real time.",
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
