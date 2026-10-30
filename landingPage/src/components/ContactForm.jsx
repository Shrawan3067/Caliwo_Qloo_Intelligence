import React, { useState } from 'react';
import { Mail, LifeBuoy, Send, CheckCircle, MessageSquare } from 'lucide-react';
import './ContactForm.css';

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'General', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: 'General', message: '' });
    }, 4000);
  };

  return (
    <section id="contact" className="section-padding contact-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-header text-center">
          <span className="badge-tag">CONTACT</span>
          <h2 className="section-title">Let's talk</h2>
          <p className="section-subtitle">
            Questions, feedback, or partnership ideas? We'd love to hear from you.
          </p>
        </div>

        <div className="contact-grid">
          {/* Left Contact Info Cards */}
          <div className="info-cards-stack">
              <div className="info-card">
                <div className="info-icon-box teal"><Mail size={20} /></div>
                <div className="info-text">
                  <span className="info-label">Email us</span>
                  <a href="mailto:hello@caliwo.com" className="info-val">hello@caliwo.com</a>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon-box green"><LifeBuoy size={20} /></div>
                <div className="info-text">
                  <span className="info-label">Support</span>
                  <a href="mailto:support@caliwo.com" className="info-val">support@caliwo.com</a>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon-box emerald"><MessageSquare size={20} /></div>
                <div className="info-text">
                  <span className="info-label">Press &amp; partnerships</span>
                  <a href="mailto:press@caliwo.com" className="info-val">press@caliwo.com</a>
                </div>
              </div>
            </div>

          {/* Right Form Card */}
          <div className="contact-form-card">
            {submitted ? (
              <div className="form-success-state">
                <CheckCircle size={48} className="success-check-icon" />
                <h3>Message Sent!</h3>
                <p>Thank you for reaching out. The Caliwo team will get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="actual-form">
                <div className="form-row split">
                  <div className="form-group">
                    <label>Name *</label>
                    <input 
                      type="text" 
                      placeholder="Jane Doe" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input 
                      type="email" 
                      placeholder="jane@email.com" 
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Subject</label>
                  <select 
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  >
                    <option value="General">General Inquiry</option>
                    <option value="Support">Product Support</option>
                    <option value="Partnership">Partnership / Press</option>
                    <option value="Feedback">Feature Feedback</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea 
                    rows={4} 
                    placeholder="How can we help?" 
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary submit-btn">
                  <span>Send message</span>
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
