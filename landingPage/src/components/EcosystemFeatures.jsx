import React, { useState } from 'react';
import { 
  Camera, MessageSquare, Mic, Calendar, ChefHat, ShoppingCart, 
  BarChart3, Heart, Droplets, FileText, 
  Sparkles, Users, ScanLine, Target, TrendingUp 
} from 'lucide-react';
import './EcosystemFeatures.css';

export default function EcosystemFeatures() {
  const [filter, setFilter] = useState('all');

  const features = [
    {
      id: 1,
      category: 'ai',
      tag: 'Visual AI',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80',
      icon: <Camera className="feat-icon text-teal" />,
      title: 'AI Food Recognition',
      desc: 'Snap any meal and get instant, accurate nutrition breakdown in seconds.'
    },
    {
      id: 2,
      category: 'ai',
      tag: '1-on-1 Guidance',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&q=80',
      icon: <MessageSquare className="feat-icon text-indigo" />,
      title: 'AI Nutrition Coach',
      desc: 'Chat with a coach that understands your goals, tastes, and lifestyle.'
    },
    {
      id: 3,
      category: 'ai',
      tag: 'Hands-Free',
      image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=700&q=80',
      icon: <Mic className="feat-icon text-sky" />,
      title: 'Voice Logging',
      desc: 'Just say what you ate. Caliwo logs it hands-free, instantly.'
    },
    {
      id: 4,
      category: 'planning',
      tag: 'Prep & Balance',
      image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80',
      icon: <Calendar className="feat-icon text-emerald" />,
      title: 'Smart Meal Planning',
      desc: 'Personalized weekly plans that adapt to your progress automatically.'
    },
    {
      id: 5,
      category: 'planning',
      tag: 'Custom Cooking',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=700&q=80',
      icon: <ChefHat className="feat-icon text-orange" />,
      title: 'AI Recipes',
      desc: 'Generate delicious recipes from what you have and what you love.'
    },
    {
      id: 6,
      category: 'planning',
      tag: 'Smart Shopping',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80',
      icon: <ShoppingCart className="feat-icon text-green" />,
      title: 'Grocery Intelligence',
      desc: 'Auto-built shopping lists optimized for your nutrition goals.'
    },
    {
      id: 9,
      category: 'tracking',
      tag: 'Macro Insights',
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=700&q=80',
      icon: <BarChart3 className="feat-icon text-blue" />,
      title: 'Nutrition Analytics',
      desc: 'Beautiful dashboards for macros, calories, and trends over time.'
    },
    {
      id: 10,
      category: 'tracking',
      tag: 'Vital Signs',
      image: 'https://images.unsplash.com/photo-1510519138161-58446c623304?auto=format&fit=crop&w=700&q=80',
      icon: <Heart className="feat-icon text-red" />,
      title: 'Health Tracking',
      desc: 'Connect the dots between food, energy, sleep, and mood.'
    },
    {
      id: 11,
      category: 'tracking',
      tag: 'Daily Hydration',
      image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=700&q=80',
      icon: <Droplets className="feat-icon text-cyan" />,
      title: 'Water Tracking',
      desc: 'Smart hydration reminders that keep you feeling your best.'
    },
    {
      id: 12,
      category: 'tracking',
      tag: 'Milestones',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=700&q=80',
      icon: <FileText className="feat-icon text-emerald" />,
      title: 'Progress Reports',
      desc: 'Comprehensive weekly & monthly reports sent right to you.'
    },
    {
      id: 13,
      category: 'ai',
      tag: 'Smart Patterns',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=80',
      icon: <Sparkles className="feat-icon text-purple" />,
      title: 'AI Weekly Insights',
      desc: 'Proactive coaching that spots patterns before you do.'
    },
    {
      id: 14,
      category: 'lifestyle',
      tag: 'Household',
      image: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=700&q=80',
      icon: <Users className="feat-icon text-teal" />,
      title: 'Family Mode',
      desc: 'Manage nutrition for the whole household in one place.'
    },
    {
      id: 15,
      category: 'tracking',
      tag: 'Instant Scan',
      image: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=700&q=80',
      icon: <ScanLine className="feat-icon text-slate" />,
      title: 'Barcode Scanner',
      desc: 'Scan packaged foods for verified nutrition data instantly.'
    },
    {
      id: 16,
      category: 'ai',
      tag: 'Tailored Diet',
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=700&q=80',
      icon: <Target className="feat-icon text-amber" />,
      title: 'Personalized Recommendations',
      desc: 'Guidance that gets smarter with every meal you log.'
    },
    {
      id: 17,
      category: 'lifestyle',
      tag: 'Daily Habits',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=700&q=80',
      icon: <TrendingUp className="feat-icon text-emerald" />,
      title: 'Habit Coaching',
      desc: 'Build sustainable habits with science-backed nudges.'
    }
  ];

  const filteredFeatures = filter === 'all' 
    ? features 
    : features.filter(f => f.category === filter);

  return (
    <section id="features" className="section-padding ecosystem-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header text-center">
          <span className="badge-tag">EVERYTHING YOU NEED</span>
          <h2 className="section-title">A complete health ecosystem</h2>
          <p className="section-subtitle">
            Fifteen intelligent features working together to make healthy living effortless.
          </p>

          {/* Filter Pills */}
          <div className="filter-tabs">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Features ({features.length})
            </button>
            <button 
              className={`filter-btn ${filter === 'ai' ? 'active' : ''}`}
              onClick={() => setFilter('ai')}
            >
              AI & Vision
            </button>
            <button 
              className={`filter-btn ${filter === 'tracking' ? 'active' : ''}`}
              onClick={() => setFilter('tracking')}
            >
              Tracking & Analytics
            </button>
            <button 
              className={`filter-btn ${filter === 'planning' ? 'active' : ''}`}
              onClick={() => setFilter('planning')}
            >
              Planning & Recipes
            </button>
            <button 
              className={`filter-btn ${filter === 'lifestyle' ? 'active' : ''}`}
              onClick={() => setFilter('lifestyle')}
            >
              Lifestyle & Security
            </button>
          </div>
        </div>

        {/* 15 Features Grid */}
        <div className="features-grid">
          {filteredFeatures.map((feat) => (
            <div key={feat.id} className="feature-card">
              <div className="feature-card-media">
                <img 
                  src={feat.image} 
                  alt={feat.title} 
                  className="feature-card-img" 
                  loading="lazy" 
                />
                <div className="feature-card-overlay"></div>
                <span className="feature-category-badge">{feat.tag}</span>
                <div className="feature-icon-wrapper">
                  {feat.icon}
                </div>
              </div>
              <div className="feature-card-body">
                <h3 className="feature-card-title">{feat.title}</h3>
                <p className="feature-card-desc">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
