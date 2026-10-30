import React from "react";
import "./MarqueeTicker.css";

export default function MarqueeTicker() {
  const words = [
    "Qloo Cultural Intelligence",
    "Non-Culturally Blind AI",
    "Bio-Cultural Alignment Score",
    "Autonomous Agent Tool Loops",
    "6-Domain Taste DNA",
    "Computer Vision Macro Tracking",
    "Film & Music Grounded Dining",
    "Tokyo to Positano Recipes",
    "Real-Time Qloo V2 Endpoints",
  ];

  return (
    <div className="marquee-wrapper">
      <div className="marquee-track">
        {[...words, ...words, ...words, ...words].map((word, idx) => (
          <React.Fragment key={idx}>
            <span className="marquee-item">{word}</span>
            <span className="marquee-dot">•</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
