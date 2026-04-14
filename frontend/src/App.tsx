import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
} from 'lucide-react';
import logo from './assert/2.png';
import './App.css';

function App() {
  const stats = [
    { value: '42K+', label: 'Patients supported' },
    { value: '1,200+', label: 'Verified doctors' },
    { value: '98.7%', label: 'Patient satisfaction' },
  ];

  const features = [
    {
      icon: Video,
      title: 'Telemedicine built for trust',
      description: 'Secure video consults, live chat, and calm waiting-room flows designed for real care delivery.',
    },
    {
      icon: CalendarDays,
      title: 'Fast appointment booking',
      description: 'Intuitive scheduling with availability, reminders, and clear step-by-step confirmation.',
    },
    {
      icon: ShieldCheck,
      title: 'Enterprise-grade security',
      description: 'Role-aware access patterns and privacy-first UI patterns that support a healthcare workflow.',
    },
  ];

  const highlights = [
    'Medical-blue brand system with premium gradients',
    'Glassmorphism cards with responsive layout tuning',
    'Real-time feel with motion-driven micro-interactions',
    'Logo visible in the branded asset area and hero header',
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__background" aria-hidden="true">
          <span className="hero__orb hero__orb--one" />
          <span className="hero__orb hero__orb--two" />
          <span className="hero__grid" />
        </div>

        <nav className="topbar">
          <div className="brand">
            <img className="brand__logo" src={logo} alt="MediFlow logo" />
            <div>
              <p className="brand__name">SUWAPIYASA</p>
              <p className="brand__tag">AI-powered telemedicine platform</p>
            </div>
          </div>

          <div className="topbar__actions">
            <span className="topbar__pill">
              <Sparkles size={14} />
              Premium experience
            </span>
            <button className="ghost-button" type="button">
              Explore product
            </button>
          </div>
        </nav>

        <div className="hero__content">
          <motion.div
            className="hero__copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span className="eyebrow">Healthcare, redesigned for speed and clarity</span>
            <h1>
              A beautiful digital clinic for modern patient journeys.
            </h1>
            <p className="hero__lede">
              MediFlow brings scheduling, consultations, prescriptions, and health insights into one polished experience that feels calm, fast, and dependable.
            </p>

            <div className="hero__cta-row">
              <button className="primary-button" type="button">
                Book a consultation
                <ArrowRight size={18} />
              </button>
              <button className="secondary-button" type="button">
                View dashboard
              </button>
            </div>

            <div className="trust-row">
              <div className="trust-row__item">
                <CheckCircle2 size={16} />
                Secure patient data
              </div>
              <div className="trust-row__item">
                <CheckCircle2 size={16} />
                Verified clinicians
              </div>
              <div className="trust-row__item">
                <CheckCircle2 size={16} />
                Live care support
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero__visual"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          >
            <div className="glass-card glass-card--feature">
              <div className="glass-card__header">
                <div>
                  <p className="glass-card__label">Today’s care flow</p>
                  <h2>Seamless patient engagement</h2>
                </div>
                <span className="status-badge status-badge--live">Live</span>
              </div>

              <div className="care-stack">
                <div className="care-card care-card--accent">
                  <HeartPulse size={18} />
                  <div>
                    <strong>AI health triage</strong>
                    <p>Symptoms analyzed in seconds</p>
                  </div>
                </div>
                <div className="care-card">
                  <MessageSquare size={18} />
                  <div>
                    <strong>Doctor chat</strong>
                    <p>Real-time support during consults</p>
                  </div>
                </div>
                <div className="care-card">
                  <Stethoscope size={18} />
                  <div>
                    <strong>Specialist routing</strong>
                    <p>Matched to the right care path</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card glass-card--metrics">
              <p className="glass-card__label">Platform performance</p>
              <div className="metrics-grid">
                {stats.map((stat) => (
                  <div key={stat.label} className="metric">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section section--cards">
        <div className="section__heading">
          <span className="eyebrow">Built for product excellence</span>
          <h2>Everything is arranged to feel premium, legible, and fast.</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.article
                key={feature.title}
                className="glass-card feature-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <div className="feature-card__icon">
                  <Icon size={20} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="section section--split">
        <div className="glass-card asset-card">
          <p className="glass-card__label">Website asset</p>
          <div className="asset-card__content">
            <img className="asset-card__logo" src={logo} alt="Website logo" />
            <div>
              <h2>Brand logo included in the asset area</h2>
              <p>
                The site logo is surfaced prominently so the product identity is visible in the design system and asset section.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card checklist-card">
          <p className="glass-card__label">Design system</p>
          <h2>Polished by default.</h2>
          <ul>
            {highlights.map((item) => (
              <li key={item}>
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--footer-cta">
        <div>
          <span className="eyebrow">Ready for deployment</span>
          <h2>Ship a front end that looks and feels enterprise-ready.</h2>
        </div>
        <button className="primary-button" type="button">
          Launch MediFlow
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

export default App;
