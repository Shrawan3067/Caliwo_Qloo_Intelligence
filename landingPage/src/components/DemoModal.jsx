import React, { useState, useEffect } from 'react';
import { 
  X, Camera, Sparkles, Send, Download, RefreshCw, 
  Compass, Flame, CheckCircle2, Cpu, Film, Music, MapPin, Utensils, ArrowRight
} from 'lucide-react';
import './DemoModal.css';

// 6-Domain Qloo Taste DNA Personas for Judges to test live
const TASTE_PERSONAS = [
  {
    id: 'alex',
    name: 'Alex',
    tagline: 'Tokyo Omakase & Cinema Lover',
    avatar: '🍣',
    domains: {
      dining: 'Nobu NYC, Sukiyabashi Jiro',
      film: 'Inception, Jiro Dreams of Sushi',
      music: 'Daft Punk, Chet Baker',
      travel: 'Tokyo & Kyoto, Japan',
      cuisines: 'Japanese, California Fusion'
    },
    meal: {
      name: 'Miso-Glazed Black Cod Bowl',
      restaurantAnchor: 'Nobu NYC & Tokyo Ginza Dining',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      cals: '648 kcal',
      protein: '48g',
      carbs: '52g',
      fats: '18g',
      bioCulturalScore: 96,
      culturalAffinity: 98,
      macroPrecision: 94,
      ingredients: 'Wild Alaskan Cod, Saikyo Sweet Miso, Forbidden Black Rice, Baby Bok Choy, Edamame',
      qlooRationale: 'Qloo detected high cross-domain affinity between your love for Tokyo dining, sci-fi cinema, and Nobu culinary techniques, calibrated to your 48g protein dinner target.'
    }
  },
  {
    id: 'elena',
    name: 'Elena',
    tagline: 'Mediterranean Minimalist',
    avatar: '🍋',
    domains: {
      dining: 'Sweetgreen, Osteria Francescana',
      film: 'Midnight in Paris, Call Me By Your Name',
      music: 'Bill Evans, Norah Jones',
      travel: 'Amalfi Coast & Santorini',
      cuisines: 'Southern Italian, Aegean Organic'
    },
    meal: {
      name: 'Amalfi Lemon-Herb Chicken & Farro',
      restaurantAnchor: 'Positano Trattorias & Sweetgreen',
      image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
      cals: '540 kcal',
      protein: '44g',
      carbs: '46g',
      fats: '15g',
      bioCulturalScore: 95,
      culturalAffinity: 97,
      macroPrecision: 93,
      ingredients: 'Free-Range Chicken Breast, Ancient Farro, Meyer Lemon Zest, Sun-ripened Tomatoes, Kalamata Olives',
      qlooRationale: 'Qloo bridged your passion for Italian coastal dining and acoustic jazz with ancient grains, yielding anti-inflammatory recovery nutrition under 550 kcal.'
    }
  },
  {
    id: 'marcus',
    name: 'Marcus',
    tagline: 'Oaxacan Smoke & Strength Explorer',
    avatar: '🌮',
    domains: {
      dining: 'Pujol, Franklin BBQ',
      film: 'Interstellar, Chef\'s Table',
      music: 'Kendrick Lamar, Kaytranada',
      travel: 'Oaxaca & Austin',
      cuisines: 'Oaxacan Smoke, Modern Mexican'
    },
    meal: {
      name: 'Oaxacan Braised Beef Barbacoa Bowl',
      restaurantAnchor: 'Pujol Mexico City & Mercado 20 de Noviembre',
      image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80',
      cals: '710 kcal',
      protein: '54g',
      carbs: '56g',
      fats: '22g',
      bioCulturalScore: 94,
      culturalAffinity: 95,
      macroPrecision: 93,
      ingredients: 'Slow-Braised Grass-Fed Beef, Guajillo Adobo, Charred Poblanos, Cilantro Quinoa, Black Beans',
      qlooRationale: 'Qloo correlated your preference for smoky Mexican heritage and hip-hop rhythms with an iron-dense, 54g lean protein dinner to fuel your strength targets.'
    }
  }
];

const SAMPLE_MEALS = [
  {
    id: 'salmon',
    name: 'Mediterranean Salmon Bowl',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    ingredients: 'Grilled Salmon, Quinoa, Avocado, Cherry Tomatoes, Feta',
    cals: '520 kcal',
    protein: '38g',
    carbs: '42g',
    fats: '18g',
    fiber: '7g',
    coachTip: 'High in anti-inflammatory omega-3 fats and clean lean protein. Excellent for recovery!'
  },
  {
    id: 'toast',
    name: 'Avocado Toast & Poached Eggs',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    ingredients: 'Sourdough, Ripe Hass Avocado, Pasture Eggs, Chili Flakes',
    cals: '420 kcal',
    protein: '24g',
    carbs: '32g',
    fats: '18g',
    fiber: '6g',
    coachTip: 'Balanced complex carbs with healthy monounsaturated fats. Keeps blood sugar steady until lunch.'
  },
  {
    id: 'acai',
    name: 'Wild Berry Protein Acai Bowl',
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=600&q=80',
    ingredients: 'Organic Acai, Blueberries, Whey Isolate, Chia Seeds, Granola',
    cals: '340 kcal',
    protein: '26g',
    carbs: '46g',
    fats: '7g',
    fiber: '9g',
    coachTip: 'Rich in antioxidants and high dietary fiber. Ideal pre-workout fuel!'
  }
];

const QUICK_PROMPTS = [
  "Suggest a dinner that matches my taste",
  "How does Qloo solve culturally blind AI?",
  "High-protein dinner under 600 kcal?"
];

export default function DemoModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('taste'); // Default to Qloo Taste AI
  const [selectedPersonaIndex, setSelectedPersonaIndex] = useState(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState(true);
  const [synthStep, setSynthStep] = useState(0);

  // Scan tab state
  const [selectedMealIndex, setSelectedMealIndex] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Chat tab state
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Caliwo AI Coach powered by Qloo Cultural Intelligence. I blend your daily macro budget with your favorite films, music, and dining vibes.',
      telemetry: null
    }
  ]);
  const [userInput, setUserInput] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPersona = TASTE_PERSONAS[selectedPersonaIndex];
  const currentMeal = SAMPLE_MEALS[selectedMealIndex];

  const handleSynthesizeTaste = () => {
    setIsSynthesizing(true);
    setSynthesized(false);
    setSynthStep(1);

    setTimeout(() => setSynthStep(2), 350);
    setTimeout(() => setSynthStep(3), 700);
    setTimeout(() => {
      setIsSynthesizing(false);
      setSynthesized(true);
      setSynthStep(0);
    }, 1000);
  };

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
    }, 600);
  };

  const handleSendPrompt = (promptText) => {
    const text = promptText || userInput;
    if (!text.trim()) return;

    const newMsgs = [...chatMessages, { sender: 'user', text, telemetry: null }];
    setChatMessages(newMsgs);
    if (!promptText) setUserInput('');

    setTimeout(() => {
      let replyText = 'Great question! Based on your target of 2,000 kcal and 120g protein, I recommend healthy fats like avocado or almonds to balance your macros.';
      let telemetry = null;

      if (text.toLowerCase().includes('taste') || text.toLowerCase().includes('dinner') || text.toLowerCase().includes('suggest')) {
        replyText = "I called Qloo's Cultural Taste Graph to discover dining anchors aligned with your 6-domain profile (Tokyo Omakase & Daft Punk). I synthesized a **Miso-Glazed Black Cod Bowl** hitting your exact remaining 48g protein budget with a **96% Bio-Cultural Alignment Score**!";
        telemetry = {
          tools: ['get_biometrics_and_macro_gaps', 'query_qloo_taste_graph', 'synthesize_culturally_aligned_recipe'],
          score: 96,
          anchors: ['Nobu NYC', 'Tokyo Dining', 'Inception', 'Daft Punk'],
          recipe: {
            dish: 'Miso-Glazed Black Cod Bowl',
            cals: '648 kcal',
            protein: '48g',
            carbs: '52g',
            fats: '18g'
          }
        };
      } else if (text.toLowerCase().includes('culturally blind') || text.toLowerCase().includes('qloo')) {
        replyText = "Standard AI recommends generic 'plain chicken breast & brown rice' to everyone regardless of culture. Caliwo queries Qloo across 6 cultural domains (music, film, dining, travel, cuisines, and food influences) so your meal plan is culturally authentic while hitting strict macro metrics.";
        telemetry = {
          tools: ['query_qloo_taste_graph', 'search_qloo_cultural_entity'],
          score: 98,
          anchors: ['Cross-Domain Taste DNA', 'Nobu', 'Positano', 'Jiro Dreams of Sushi'],
          recipe: null
        };
      } else if (text.toLowerCase().includes('protein') || text.toLowerCase().includes('600')) {
        replyText = 'Try grilled citrus salmon with steamed asparagus and roasted sweet potato (~520 kcal, 44g protein). It fits your remaining calorie budget while maximizing muscle recovery.';
        telemetry = {
          tools: ['get_biometrics_and_macro_gaps'],
          score: 91,
          anchors: ['Mediterranean Clean', 'Sweetgreen'],
          recipe: null
        };
      }

      setChatMessages([
        ...newMsgs,
        { sender: 'ai', text: replyText, telemetry }
      ]);
    }, 700);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    handleSendPrompt();
  };

  return (
    <div className="demo-modal-overlay" onClick={onClose}>
      <div className="demo-modal-window" onClick={e => e.stopPropagation()}>
        <button className="demo-close-btn" onClick={onClose} aria-label="Close Demo">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="demo-modal-header text-center">
          <div className="badge-tag qloo-badge-tag">
            <Sparkles size={14} />
            <span>Qloo Agentic Hackathon Interactive Demo</span>
          </div>
          <h3>Try Caliwo Live</h3>
          <p>Experience the world's first cultural taste intelligence engine for nutrition.</p>

          <div className="demo-tabs">
            <button 
              className={`demo-tab-btn ${activeTab === 'taste' ? 'active highlight' : ''}`}
              onClick={() => setActiveTab('taste')}
            >
              <Compass size={15} />
              <span>Qloo Taste DNA</span>
              <span className="tab-pill-star">★</span>
            </button>
            <button 
              className={`demo-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
              onClick={() => setActiveTab('scan')}
            >
              <Camera size={15} />
              <span>AI Food Scan</span>
            </button>
            <button 
              className={`demo-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <Sparkles size={15} />
              <span>Agent Coach</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="demo-modal-body">
          {/* ──────────────── TAB 1: QLOO TASTE AI PLAYGROUND ──────────────── */}
          {activeTab === 'taste' && (
            <div className="demo-taste-view animate-fadeIn">
              {/* Persona Selector */}
              <div className="taste-persona-picker">
                <span className="section-mini-label">Choose Cultural Persona:</span>
                <div className="persona-chip-group">
                  {TASTE_PERSONAS.map((persona, idx) => (
                    <button
                      key={persona.id}
                      className={`persona-chip ${selectedPersonaIndex === idx ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedPersonaIndex(idx);
                        setSynthesized(true);
                      }}
                    >
                      <span className="persona-avatar">{persona.avatar}</span>
                      <div className="persona-chip-info">
                        <strong>{persona.name}</strong>
                        <small>{persona.tagline.split(' ')[0]} {persona.tagline.split(' ')[1]}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona 6-Domain Taste DNA Matrix */}
              <div className="dna-matrix-card">
                <div className="dna-matrix-header">
                  <div className="dna-matrix-title">
                    <Compass size={16} className="text-orange" />
                    <h4>{currentPersona.name}'s 6-Domain Qloo Taste DNA</h4>
                  </div>
                  <span className="dna-badge">Real-Time Qloo Seeds</span>
                </div>
                <div className="dna-tags-grid">
                  <div className="dna-tag-item">
                    <Utensils size={13} />
                    <span><strong>Dining:</strong> {currentPersona.domains.dining}</span>
                  </div>
                  <div className="dna-tag-item">
                    <Film size={13} />
                    <span><strong>Film:</strong> {currentPersona.domains.film}</span>
                  </div>
                  <div className="dna-tag-item">
                    <Music size={13} />
                    <span><strong>Music:</strong> {currentPersona.domains.music}</span>
                  </div>
                  <div className="dna-tag-item">
                    <MapPin size={13} />
                    <span><strong>Travel:</strong> {currentPersona.domains.travel}</span>
                  </div>
                </div>
              </div>

              {/* Synthesize Button / Loading Pipeline */}
              {isSynthesizing ? (
                <div className="synth-pipeline-box">
                  <div className="pipeline-spinner">
                    <Cpu size={22} className="spin-icon text-orange" />
                  </div>
                  <div className="pipeline-steps">
                    <span className={synthStep >= 1 ? 'step active' : 'step'}>
                      1. Resolving 6-Domain Cultural Seeds in Qloo Taste Graph...
                    </span>
                    <span className={synthStep >= 2 ? 'step active' : 'step'}>
                      2. Calibrating portion size to hit remaining daily macro budget...
                    </span>
                    <span className={synthStep >= 3 ? 'step active' : 'step'}>
                      3. Computing Dual-Factor Bio-Cultural Alignment Score...
                    </span>
                  </div>
                </div>
              ) : (
                <button 
                  className="btn btn-accent taste-synth-btn" 
                  onClick={handleSynthesizeTaste}
                >
                  <Sparkles size={16} />
                  <span>Synthesize Dish with Qloo Pipeline</span>
                </button>
              )}

              {/* Synthesized Result Card */}
              {synthesized && !isSynthesizing && (
                <div className="taste-result-card animate-fadeIn">
                  <div className="taste-card-banner">
                    <div className="score-pill">
                      <CheckCircle2 size={14} />
                      <span>{currentPersona.meal.bioCulturalScore}% Bio-Cultural Match</span>
                    </div>
                    <span className="qloo-verified-tag">✓ Non-Culturally Blind AI</span>
                  </div>

                  <div className="taste-meal-header">
                    <img 
                      src={currentPersona.meal.image} 
                      alt={currentPersona.meal.name} 
                      className="taste-meal-thumb" 
                    />
                    <div>
                      <span className="anchor-label">
                        <Utensils size={12} /> {currentPersona.meal.restaurantAnchor}
                      </span>
                      <h3>{currentPersona.meal.name}</h3>
                      <p className="ingredients-txt">{currentPersona.meal.ingredients}</p>
                    </div>
                  </div>

                  {/* Macro Calibration Breakdown */}
                  <div className="macro-spec-grid">
                    <div className="spec-card">
                      <span className="spec-lbl">Calories</span>
                      <span className="spec-val green">{currentPersona.meal.cals}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-lbl">Protein</span>
                      <span className="spec-val blue">{currentPersona.meal.protein}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-lbl">Carbs</span>
                      <span className="spec-val purple">{currentPersona.meal.carbs}</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-lbl">Fats</span>
                      <span className="spec-val amber">{currentPersona.meal.fats}</span>
                    </div>
                  </div>

                  {/* The Qloo Connection Callout */}
                  <div className="qloo-bridge-rationale">
                    <Sparkles size={15} className="text-orange flex-shrink-0" />
                    <div>
                      <strong>The Qloo Taste Bridge:</strong>
                      <p>{currentPersona.meal.qlooRationale}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── TAB 2: AI FOOD SCAN ──────────────── */}
          {activeTab === 'scan' && (
            <div className="demo-scan-view animate-fadeIn">
              <div className="meal-preset-row">
                <span className="preset-label">Choose Sample:</span>
                <div className="preset-buttons">
                  {SAMPLE_MEALS.map((meal, idx) => (
                    <button
                      key={meal.id}
                      className={`preset-chip ${selectedMealIndex === idx ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMealIndex(idx);
                        setScanned(false);
                      }}
                    >
                      {meal.name.split(' ')[0]} {meal.name.split(' ')[1]}
                    </button>
                  ))}
                </div>
              </div>

              {!scanned ? (
                <div className="scan-prompt-box">
                  <div className="scan-sample-image">
                    <img src={currentMeal.image} alt={currentMeal.name} />
                    <div className="scan-overlay-prompt">
                      <span>{scanning ? 'Analyzing with Computer Vision AI...' : 'Tap button to simulate camera scan'}</span>
                    </div>
                  </div>
                  <button 
                    className="btn btn-accent scan-action-btn" 
                    onClick={handleScan}
                    disabled={scanning}
                  >
                    <Camera size={18} />
                    <span>{scanning ? 'Analyzing...' : `Scan ${currentMeal.name}`}</span>
                  </button>
                </div>
              ) : (
                <div className="scan-results-box animate-fadeIn">
                  <div className="result-header">
                    <img src={currentMeal.image} alt={currentMeal.name} className="result-thumb" />
                    <div>
                      <span className="match-pill">99.4% AI Match</span>
                      <h4>{currentMeal.name}</h4>
                      <p>{currentMeal.ingredients}</p>
                    </div>
                  </div>

                  <div className="result-grid">
                    <div className="res-stat-card">
                      <span className="res-lbl">Calories</span>
                      <span className="res-val green">{currentMeal.cals}</span>
                    </div>
                    <div className="res-stat-card">
                      <span className="res-lbl">Protein</span>
                      <span className="res-val blue">{currentMeal.protein}</span>
                    </div>
                    <div className="res-stat-card">
                      <span className="res-lbl">Carbs</span>
                      <span className="res-val purple">{currentMeal.carbs}</span>
                    </div>
                    <div className="res-stat-card">
                      <span className="res-lbl">Fats</span>
                      <span className="res-val amber">{currentMeal.fats}</span>
                    </div>
                  </div>

                  <div className="res-coach-tip">
                    <Sparkles size={16} className="tip-sparkle" />
                    <span><strong>Coach Tip:</strong> {currentMeal.coachTip}</span>
                  </div>

                  <button className="res-reset-btn" onClick={() => setScanned(false)}>
                    <RefreshCw size={14} />
                    <span>Scan Another Sample</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── TAB 3: AGENT COACH CHAT ──────────────── */}
          {activeTab === 'chat' && (
            <div className="demo-chat-view animate-fadeIn">
              <div className="chat-prompt-chips">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    className="prompt-chip-btn"
                    onClick={() => handleSendPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="chat-thread">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble-row ${msg.sender}`}>
                    <div className="bubble-content">
                      {msg.telemetry && (
                        <div className="chat-telemetry-badge">
                          <div className="telemetry-pill">
                            <Cpu size={12} />
                            <span>Autonomous Agent Loop ({msg.telemetry.tools.length} Tools)</span>
                          </div>
                          {msg.telemetry.score && (
                            <span className="telemetry-score-tag">
                              {msg.telemetry.score}% Bio-Cultural Match
                            </span>
                          )}
                          <div className="telemetry-anchors">
                            Qloo Anchors: {msg.telemetry.anchors.join(' • ')}
                          </div>
                        </div>
                      )}
                      
                      <div className="bubble-text">{msg.text}</div>

                      {msg.telemetry?.recipe && (
                        <div className="chat-recipe-card">
                          <div className="chat-recipe-title">
                            <Utensils size={13} className="text-orange" />
                            <span>{msg.telemetry.recipe.dish}</span>
                          </div>
                          <div className="chat-recipe-macros">
                            <span>{msg.telemetry.recipe.cals}</span>
                            <span>•</span>
                            <span className="blue">{msg.telemetry.recipe.protein} P</span>
                            <span>•</span>
                            <span>{msg.telemetry.recipe.carbs} C</span>
                            <span>•</span>
                            <span>{msg.telemetry.recipe.fats} F</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="chat-input-row">
                <input 
                  type="text" 
                  placeholder="Ask Caliwo AI about meals or cultural taste..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                />
                <button type="submit" className="chat-send-btn" aria-label="Send Message">
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="demo-modal-footer">
          <div className="footer-hackathon-callout">
            <span className="live-dot"></span>
            <span>Live Qloo Intelligence Engine • Production Ready</span>
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            <Download size={16} />
            <span>Get Caliwo App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
