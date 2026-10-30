import React from 'react';
import { Star, Quote, Sparkles } from 'lucide-react';
import './Testimonials.css';

export default function Testimonials() {
  const reviews = [
    {
      id: 1,
      quote: "Other apps gave me plain boiled chicken and broccoli. Caliwo's Qloo Taste DNA suggested Positano-style lemon herb chicken that fit my exact 44g protein target with a 95% Bio-Cultural score.",
      name: "Sofia Martinez",
      location: "Mediterranean Cuisine Enthusiast",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "Amalfi Coast & Jazz Lover"
    },
    {
      id: 2,
      quote: "The connection between my favorite Tokyo omakase spots, sci-fi cinema, and daily macros is unreal. It synthesized Miso Black Cod with forbidden rice that matched my remaining calorie budget.",
      name: "Kenji Sato",
      location: "Omakase & Film Aficionado",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "Tokyo & Synthwave Taste DNA"
    },
    {
      id: 3,
      quote: "I love Oaxacan smoke and street tacos. Caliwo didn't tell me to abandon my culture — it calibrated portion sizes of braised beef barbacoa to hit 54g protein. No more culturally blind diet advice.",
      name: "Marcus Vance",
      location: "Strength Athlete & Traveler",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "Oaxaca & Hip-Hop DNA"
    },
    {
      id: 4,
      quote: "The autonomous agent tool loop is visible in the chat. You can watch Caliwo call Qloo's taste graph, inspect your macro gaps, and calculate a verified score. Total game changer.",
      name: "Elena Rostova",
      location: "Tech Architect & Marathoner",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "Verified Hackathon Tester"
    },
    {
      id: 5,
      quote: "I've tried MyFitnessPal and Noom. Neither of them understood that food is culture and lifestyle. Caliwo makes hitting my macro deficit feel exciting and delicious.",
      name: "Liam O'Brien",
      location: "Culinary Explorer",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "Bistro & Indie Cinema DNA"
    },
    {
      id: 6,
      quote: "Computer vision instantly scans my complex traditional dishes, recognizing lentils and paneer while Qloo aligns my dinner recipes with my personal music and travel vibes.",
      name: "Priya Sharma",
      location: "Health & Culture Advocate",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      stars: 5,
      tag: "South Asian Spice & Classical"
    }
  ];

  return (
    <section className="section-padding testimonials-section">
      <div className="container">
        <div className="section-header text-center">
          <div className="badge-tag">
            <Sparkles size={14} />
            <span>CULTURAL TASTE STORIES</span>
          </div>
          <h2 className="section-title">Nutrition that honors who you are</h2>
          <p className="section-subtitle">
            See how real people hit strict calorie and protein goals without sacrificing cultural heritage, dining vibes, or the joy of eating.
          </p>
        </div>

        <div className="testimonials-grid">
          {reviews.map((rev) => (
            <div key={rev.id} className="testimonial-card">
              <div className="quote-icon">
                <Quote size={28} />
              </div>
              <p className="testimonial-text">"{rev.quote}"</p>
              
              <div className="testimonial-footer">
                <div className="user-profile">
                  <img src={rev.avatar} alt={rev.name} className="user-avatar" />
                  <div className="user-info">
                    <span className="user-name">{rev.name}</span>
                    <span className="user-location">{rev.location}</span>
                    {rev.tag && <span className="user-taste-pill">{rev.tag}</span>}
                  </div>
                </div>

                <div className="stars-wrapper">
                  {[...Array(rev.stars)].map((_, i) => (
                    <Star key={i} size={14} fill="#f59e0b" stroke="#f59e0b" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
