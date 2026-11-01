import React, { useState } from 'react';
import { 
  Download, ShieldCheck, Sparkles, Smartphone, ArrowRight, 
  Terminal, Key, Check, Copy, AlertTriangle, Cpu, Layers, ExternalLink 
} from 'lucide-react';
import './HackathonJudgeBanner.css';

export default function HackathonJudgeBanner() {
  const [copiedAdb, setCopiedAdb] = useState(false);

  const handleCopyAdb = () => {
    navigator.clipboard.writeText('adb install caliwo-release.apk');
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 3000);
  };

  return (
    <section className="hackathon-judge-section" id="hackathon-judges">
      <div className="container">
        {/* Main Header */}
        <div className="judge-section-header text-center">
          <div className="judge-badge-pill">
            <span className="live-pulse-dot"></span>
            <span className="judge-badge-text">QLOO AGENTIC AI HACKATHON 2026 · EVALUATION PORTAL</span>
          </div>

          <h2 className="judge-section-title">
            How Judges Can Test Caliwo <span className="judge-title-highlight">on Android</span>
          </h2>

          <p className="judge-section-subtitle">
            Caliwo is packaged exclusively as a downloadable <strong>Android .APK build</strong> for hackathon judges. 
            Because it connects to unconstrained live Qloo V2 Cultural Taste Graph API endpoints and agentic tool loops, 
            it is distributed directly for instant sideloading — <strong>not through published Google Play or Apple App Store apps</strong>.
          </p>
        </div>

        {/* 3 Step-by-Step Cards */}
        <div className="judge-steps-grid">
          {/* Step 1 */}
          <div className="judge-step-card">
            <div className="step-card-number">01</div>
            <div className="step-card-header">
              <div className="step-icon-box bg-orange">
                <Download size={22} className="text-white" />
              </div>
              <h3 className="step-card-title">Download Production .APK</h3>
            </div>
            <p className="step-card-desc">
              Get the verified, crash-free release build. Compiled with Hermes bytecode, ProGuard optimization, and live AWS backend connections.
            </p>
            <div className="step-action-area">
              <a 
                href="/caliwo-release.apk" 
                download="caliwo-release.apk"
                className="step-download-btn"
                id="judge-step1-download-btn"
              >
                <Download size={16} />
                <span>Download .APK (56 MB)</span>
              </a>
              <span className="step-meta-note">Version: 1.0.0 · SHA-Verified</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="judge-step-card">
            <div className="step-card-number">02</div>
            <div className="step-card-header">
              <div className="step-icon-box bg-cyan">
                <Smartphone size={22} className="text-white" />
              </div>
              <h3 className="step-card-title">Install on Device or Emulator</h3>
            </div>
            <p className="step-card-desc">
              <strong>On Android Phone:</strong> Tap the downloaded file and select <em>"Allow installation from this source"</em>.<br />
              <strong>On Emulator (Mac/PC):</strong> Drag &amp; drop the APK into the Android Studio emulator window.
            </p>
            <div className="step-action-area">
              <div className="adb-command-box">
                <Terminal size={14} className="text-muted" />
                <code>adb install caliwo-release.apk</code>
                <button 
                  type="button" 
                  className="copy-adb-btn" 
                  onClick={handleCopyAdb}
                  title="Copy ADB install command"
                >
                  {copiedAdb ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  <span>{copiedAdb ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <span className="step-meta-note">Compatible with Android 10+ (API 29-35)</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="judge-step-card highlight-card">
            <div className="step-card-number">03</div>
            <div className="step-card-header">
              <div className="step-icon-box bg-emerald">
                <Key size={22} className="text-white" />
              </div>
              <h3 className="step-card-title">1-Tap Demo Account Login</h3>
            </div>
            <p className="step-card-desc">
              Launch Caliwo on Android. On the welcome / sign-in screen, tap the dedicated <strong>"Fill Hackathon Demo Account"</strong> button to bypass registration.
            </p>
            <div className="step-action-area">
              <div className="demo-credentials-badge">
                <span className="cred-pill">Pre-loaded 6-Domain Taste Profile</span>
                <span className="cred-pill">Seeded Meals &amp; Macro History</span>
              </div>
              <span className="step-meta-note">Instant testing · Zero signup required</span>
            </div>
          </div>
        </div>

        {/* Feature Evaluation Grid */}
        <div className="judge-evaluation-showcase">
          <div className="eval-header">
            <Sparkles size={18} className="text-amber" />
            <h3>Key Agentic &amp; Cultural Capabilities for Judges to Verify</h3>
          </div>

          <div className="eval-grid">
            <div className="eval-card">
              <div className="eval-card-top">
                <span className="eval-domain-tag">QLOO TASTE DNA</span>
                <ShieldCheck size={18} className="text-emerald" />
              </div>
              <h4>Cross-Domain Taste Profiling</h4>
              <p>
                Connects user preferences in film, music, dining, and travel via Qloo V2 to generate culturally resonant meal suggestions instead of dry clinical diets.
              </p>
            </div>

            <div className="eval-card">
              <div className="eval-card-top">
                <span className="eval-domain-tag">VISION AI</span>
                <ShieldCheck size={18} className="text-emerald" />
              </div>
              <h4>Computer-Vision Macro Breakdown</h4>
              <p>
                Point camera at meals to track calories, Protein, Fat, Fiber, Sugar, Sodium, and Magnesium with intelligent portion estimation.
              </p>
            </div>

            <div className="eval-card">
              <div className="eval-card-top">
                <span className="eval-domain-tag">AGENTIC LOOP</span>
                <ShieldCheck size={18} className="text-emerald" />
              </div>
              <h4>Autonomous Tool Orchestration</h4>
              <p>
                Coach agent invokes backend tools like <code>calculate_macro_gaps</code> and <code>fetch_qloo_taste_affinities</code> during multi-turn chats.
              </p>
            </div>

            <div className="eval-card">
              <div className="eval-card-top">
                <span className="eval-domain-tag">CLOUD &amp; SYNC</span>
                <ShieldCheck size={18} className="text-emerald" />
              </div>
              <h4>Live AWS Backend + Offline Mode</h4>
              <p>
                Hosted on live AWS EC2 (<code>http://54.196.186.142:8000</code>) with automatic offline plate logging and instant cloud sync.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Specs Callout Bar */}
        <div className="judge-specs-bar">
          <div className="specs-bar-item">
            <span className="spec-label">Target OS:</span>
            <span className="spec-value">Android 10.0+ (API 29-35)</span>
          </div>
          <div className="specs-bar-divider"></div>
          <div className="specs-bar-item">
            <span className="spec-label">Package:</span>
            <span className="spec-value">com.caliwo.app</span>
          </div>
          <div className="specs-bar-divider"></div>
          <div className="specs-bar-item">
            <span className="spec-label">Build Type:</span>
            <span className="spec-value">Release APK (56 MB · ProGuard)</span>
          </div>
          <div className="specs-bar-divider"></div>
          <div className="specs-bar-item">
            <span className="spec-label">Distribution:</span>
            <span className="spec-value text-orange">Direct Sideload (Not on Play/App Store)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
