import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import careersData from './data/careers.json'
import lcaFiles   from './data/lca-files.json'
import logoUrl    from './assets/Logo.png'

/* ── auth context ─────────────────────────────────────────────── */
const AuthCtx = React.createContext(null)
function useAuth() { return React.useContext(AuthCtx) }

/* ── github api ───────────────────────────────────────────────── */
const GH = {
  token : import.meta.env.VITE_GITHUB_TOKEN  || '',
  owner : import.meta.env.VITE_GITHUB_OWNER  || 'rmandava06',
  repo  : import.meta.env.VITE_GITHUB_REPO   || 'CrownITS',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
}
const ghBase    = () => `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents`
const ghHeaders = () => ({ Authorization: `Bearer ${GH.token}`, 'Content-Type': 'application/json' })

function encodeGhPath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}
async function ghGet(path) {
  const r = await fetch(`${ghBase()}/${encodeGhPath(path)}`, { headers: ghHeaders() })
  if (!r.ok) throw new Error(`GitHub GET ${r.status}`)
  return r.json()
}
async function ghPut(path, message, b64, sha) {
  const body = { message, content: b64, branch: GH.branch }
  if (sha) body.sha = sha
  const r = await fetch(`${ghBase()}/${encodeGhPath(path)}`, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}`)
  return r.json()
}
async function ghDel(path, message, sha) {
  const r = await fetch(`${ghBase()}/${encodeGhPath(path)}`, {
    method: 'DELETE', headers: ghHeaders(),
    body: JSON.stringify({ message, sha, branch: GH.branch }),
  })
  if (!r.ok) throw new Error(`GitHub DEL ${r.status}`)
  return r.json()
}
function b64(str) { return btoa(unescape(encodeURIComponent(str))) }
function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function requireGhToken() {
  if (!GH.token) throw new Error('GitHub token not configured. Add VITE_GITHUB_TOKEN and redeploy.')
}

const LCA_PDF_EXT = /\.pdf$/i
const MAX_LCA_MB = 50

function parseLcaFilename(filename) {
  const base = filename
    .replace(/-Certified-LCA\.pdf$/i, '')
    .replace(/\.pdf$/i, '')

  const parts = base.split('_')
  if (parts.length >= 3) {
    const role  = parts[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const state = parts[1].toUpperCase()
    const year  = parts[2].replace(/-.*$/, '')
    return {
      displayName: `${role} \u2014 ${state} ${year}`,
      state,
      year: parseInt(year, 10) || 0,
    }
  }

  return {
    displayName: base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    state: '',
    year: 0,
  }
}

function sortLcaEntries(entries) {
  return [...entries].sort((a, b) => b.year - a.year || a.displayName.localeCompare(b.displayName))
}

async function saveLcaManifest(entries, message) {
  const data = await ghGet('src/data/lca-files.json')
  await ghPut(
    'src/data/lca-files.json',
    message,
    b64(JSON.stringify(sortLcaEntries(entries), null, 2)),
    data.sha,
  )
}

/* ── email (Web3Forms) — disabled for now ─────────────────────── */
/*
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || ''
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'hr@crownits.com'

async function postEmailJson(payload) {
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Unable to send email. Please try again.')
  return data
}

async function postEmailFormData(formData) {
  const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Unable to send email. Please try again.')
  return data
}

async function sendContactEmail({ name, email, phone, message }) {
  if (!WEB3FORMS_KEY) throw new Error('Email is not configured yet. Please email hr@crownits.com directly.')
  return postEmailJson({
    access_key: WEB3FORMS_KEY,
    subject: 'Website Contact — Crown IT Solutions',
    from_name: name.trim(),
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    message: message.trim(),
    to: CONTACT_EMAIL,
  })
}

async function sendJobApplicationEmail({ job, name, email, phone, address, message, resumeFile }) {
  if (!WEB3FORMS_KEY) throw new Error('Email is not configured yet. Please email hr@crownits.com directly.')

  const formData = new FormData()
  formData.append('access_key', WEB3FORMS_KEY)
  formData.append('subject', `Job Application — ${job.title} [${job.id}]`)
  formData.append('from_name', name.trim())
  formData.append('name', name.trim())
  formData.append('email', email.trim())
  formData.append('phone', phone.trim())
  formData.append('to', job.applyEmail || CONTACT_EMAIL)
  formData.append('message', [
    `Job Applied For: ${job.title} (${job.id})`,
    `Name: ${name.trim()}`,
    `Email: ${email.trim()}`,
    `Phone: ${phone.trim()}`,
    `Address: ${address.trim()}`,
    message.trim() ? `\nCover Note:\n${message.trim()}` : '',
  ].filter(Boolean).join('\n'))
  if (resumeFile) formData.append('attachment', resumeFile, resumeFile.name)

  return postEmailFormData(formData)
}
*/

function validateContactForm(form) {
  const errs = {}
  const name = form.name.trim()
  if (!name) errs.name = 'Name is required.'
  else if (name.length < 2) errs.name = 'Please enter at least 2 characters.'

  const email = form.email.trim()
  if (!email) errs.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email address.'

  const phone = form.phone.trim()
  if (phone && phone.replace(/\D/g, '').length < 10) errs.phone = 'Please enter a valid phone number.'

  const message = form.message.trim()
  if (!message) errs.message = 'Message is required.'
  else if (message.length < 10) errs.message = 'Please enter at least 10 characters.'
  else if (message.length > 2000) errs.message = 'Message must be 2,000 characters or fewer.'

  return errs
}

/* ── scroll-reveal hook ───────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('revealed')),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/* ── data ─────────────────────────────────────────────────────── */
const ServiceIcons = {
  StaffAugmentation: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  ContinuousSupport: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10"/>
      <path d="M12 6v6l4 2"/>
      <path d="M19 22v-4h-4"/>
      <path d="M22.83 17.63A9.97 9.97 0 0 1 19 22"/>
    </svg>
  ),
  SoftwareDevelopment: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Consulting: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  ),
  ProjectManagement: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  ),
  ArchitecturalSolutions: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
}

const serviceItems = [
  {
    Icon: ServiceIcons.StaffAugmentation,
    title: 'Staff Augmentation',
    text: 'CrownIT Solutions Staff Augmentation services enables you in getting qualified and experienced personnel to suit your requirements working exclusively for you from our offices. It is a perfect way to accomplish your special or seasonal projects without adding a permanent staff.',
  },
  {
    Icon: ServiceIcons.ContinuousSupport,
    title: 'Continuous Support',
    text: "Consistency in delivering top-notch IT products and services is crucial for your enterprise and your clientele – but to truly stand out, integrating new technologies is essential. CrownIT Solution's IT consulting bridges this gap, ensuring you deliver quality while embracing innovation without compromise.",
  },
  {
    Icon: ServiceIcons.SoftwareDevelopment,
    title: 'Software Development Services',
    text: 'From a single application to an enterprise-wide system, We can deliver the right solutions to address business needs quickly and efficiently.',
  },
  {
    Icon: ServiceIcons.Consulting,
    title: 'Consulting',
    text: "CrownIT Solutions stands at the forefront of technological innovation. With a team steeped in deep tech expertise, we're more than just consultants. We're your partners in shaping a future-ready IT roadmap. Our approach is tailored, ensuring your business not only adapts but thrives. From digitizing operations and optimizing your software portfolio to harnessing the power of mobile solutions, we're here to elevate your journey every step of the way.",
  },
  {
    Icon: ServiceIcons.ProjectManagement,
    title: 'Project Management',
    text: "CrownIT Solutions has the tools and experience required to help enterprises make strategic decisions and take advantage of today's latest technologies.",
  },
  {
    Icon: ServiceIcons.ArchitecturalSolutions,
    title: 'Architectural Solutions',
    text: 'Legacy IT systems can hinder progress. With our enterprise architecture specialists, the transition from cumbersome IT structures to agile, cloud-based solutions becomes seamless. We emphasize streamlined delivery and the integration of pioneering technologies, positioning you at the forefront of innovation.',
  },
]

const values = [
  { label: 'Customer-Centric', desc: 'We put the best interests of our clients at the core of everything we do.' },
  { label: 'Trust', desc: 'We conduct ourselves with integrity and honesty in every engagement.' },
  { label: 'Teamwork', desc: 'We respect individual contributions, yet value partnership and teamwork highly.' },
  { label: 'Accountable', desc: 'We are committed to our customers and take accountability for our actions.' },
  { label: 'Excellence', desc: 'We strive to build on best practices, innovation, and a relentless pursuit of quality.' },
]

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

function parseAdminUsers() {
  const raw = import.meta.env.VITE_ADMIN_USERS
  if (!raw) return []
  try {
    const users = JSON.parse(raw)
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

const adminUsers = parseAdminUsers()

/* ── login modal ──────────────────────────────────────────────── */
function LoginModal({ onClose, onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPw, setShowPw] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function validate() {
    const errs = {}
    if (!form.username.trim()) errs.username = 'Username is required.'
    else if (form.username.trim().length < 3) errs.username = 'Must be at least 3 characters.'
    if (!form.password) errs.password = 'Password is required.'
    else if (form.password.length < 6) errs.password = 'Must be at least 6 characters.'
    return errs
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(err => ({ ...err, [name]: undefined }))
    setAuthError(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const found = adminUsers.find(
        u => u.username === form.username.trim() && u.password === form.password
      )
      if (found) {
        onLogin({ username: found.username, role: found.role })
      } else {
        setAuthError(true)
      }
    }, 700)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Employee Login">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Employee Portal</p>
            <h2 className="modal-title">Sign In</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {authError && (
            <div className="modal-auth-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Invalid username or password. Please try again.
            </div>
          )}

          <div className="modal-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Enter your username"
              value={form.username}
              onChange={handleChange}
              className={errors.username ? 'input-error' : ''}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="modal-field">
            <label htmlFor="login-password">Password</label>
            <div className="pw-wrap">
              <input
                id="login-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                className={errors.password ? 'input-error' : ''}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                )}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button type="submit" className="modal-submit" disabled={loading}>
            {loading ? <span className="modal-spinner" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}


function Layout({ children }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(() => {
    try { return JSON.parse(sessionStorage.getItem('crownit_user')) } catch { return null }
  });
  const location = window.location.pathname;

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => { setMenuOpen(false); }, [location]);
  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function handleLogin(user) {
    setCurrentUser(user);
    sessionStorage.setItem('crownit_user', JSON.stringify(user));
    setLoginOpen(false);
  }
  function handleLogout() {
    setCurrentUser(null);
    sessionStorage.removeItem('crownit_user');
  }

  const navLinks = [
    { to: '/', label: 'Home', end: true },
    { to: '/company', label: 'Company' },
    { to: '/services', label: 'Services' },
    { to: '/careers', label: 'Careers' },
    { to: '/lca-eta-9035', label: 'LCA' },
  ];

  const isAdmin = currentUser?.role === 'admin';

  return (
    <AuthCtx.Provider value={{ currentUser, isAdmin, logout: handleLogout }}>
    <div className="site-shell">
      <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
        <div className="header-accent-line" />
        <div className="header-inner">
          <NavLink to="/" className="brand">
            <img src={logoUrl} alt="CrownIT Solutions" className="brand-logo" />
            <span className="brand-text">
              <span className="brand-title">Crown IT Solutions</span>
              <span className="brand-sub">IT Staffing and Consultancy Services</span>
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="nav-desktop">
            {navLinks.map(l => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
            <NavLink to="/contact-us" className="nav-cta">Let's Talk</NavLink>
            {currentUser ? (
              <div className="nav-user-chip">
                <span className="nav-user-name">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M1 15c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {currentUser.username}
                </span>
                <button className="nav-logout-btn" onClick={handleLogout}>Sign Out</button>
              </div>
            ) : (
              <button className="nav-login-btn" onClick={() => setLoginOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M1 15c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Employee Login
              </button>
            )}
          </nav>

          {/* Hamburger button */}
          <button
            className={`nav-hamburger${menuOpen ? ' nav-hamburger--open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`nav-drawer${menuOpen ? ' nav-drawer--open' : ''}`} aria-hidden={!menuOpen}>
        <div className="nav-drawer-inner">
          {currentUser && (
            <div className="nav-drawer-user">
              <span>Signed in as <strong>{currentUser.username}</strong></span>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="nav-drawer-signout">Sign Out</button>
            </div>
          )}
          {navLinks.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav-drawer-link" onClick={() => setMenuOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/contact-us" className="nav-drawer-cta" onClick={() => setMenuOpen(false)}>
            Let's Talk
          </NavLink>
          {!currentUser && (
            <button className="nav-drawer-login" onClick={() => { setMenuOpen(false); setLoginOpen(true); }}>
              Employee Login
            </button>
          )}
        </div>
      </div>
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={handleLogin} />}

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <NavLink to="/" className="footer-brand-link">
              <img src={logoUrl} alt="CrownIT Solutions" className="footer-logo" />
              <span className="footer-brand-text">
                <span className="footer-brand-name">Crown IT Solutions</span>
                <span className="footer-brand-tag">IT Staffing and Consultancy Services</span>
              </span>
            </NavLink>
            <p className="footer-copy">© Copyright 2025 CrownIT Solutions, LLC. All Rights Reserved.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h5>About</h5>
              <NavLink to="/company">Team</NavLink>
              <NavLink to="/company">History</NavLink>
              <NavLink to="/careers">Careers</NavLink>
            </div>
            <div className="footer-col">
              <h5>Legal</h5>
              <NavLink to="/privacy-policy">Privacy Policy</NavLink>
              <NavLink to="/terms-and-conditions">Terms and Conditions</NavLink>
              <NavLink to="/contact-us">Contact Us</NavLink>
            </div>
            <div className="footer-col">
              <h5>Social</h5>
              <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter / X</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </AuthCtx.Provider>
  )
}

/* ── home ─────────────────────────────────────────────────────── */
function HomePage() {
  useReveal()
  return (
    <>
      {/* Hero */}
      <section className="section-hero">
        <div className="container">
          <p className="eyebrow" data-reveal>IT Consulting &amp; Staff Augmentation</p>
          <h1 data-reveal>A commitment to Innovation<br />and Empowering People</h1>
          <p className="hero-lead" data-reveal>
            'IN-SOURCING' is the key of our success. At CrownIT Solutions, we define our
            success not by quantity, but by the quality of client service and the lasting
            contributions made by the talent that we have referred.
          </p>
          <div className="hero-actions" data-reveal>
            <NavLink to="/services" className="btn-primary">Our Services</NavLink>
            <NavLink to="/contact-us" className="btn-ghost">Get in Touch</NavLink>
          </div>
        </div>
      </section>

      {/* Intro band */}
      <section className="section-light">
        <div className="container section-intro" data-reveal>
          <p className="overline">Why CrownIT</p>
          <h2>We are here to help you SUCCEED</h2>
          <p className="body-lg">
            No matter how big or small, your company can benefit from CrownIT Solutions.
            We specialize in technology solutions, systems integration, rapid application
            development and process automation. Our service offerings help push your
            business to greater heights.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="section-white">
        <div className="container">
          <p className="overline" data-reveal>What we do</p>
          <h2 className="section-heading" data-reveal>Our Core Services</h2>
          <div className="card-grid">
            {serviceItems.map((s, i) => (
              <article className="card" key={s.title} data-reveal style={{ animationDelay: `${i * 0.07}s` }}>
                <span className="card-icon"><s.Icon /></span>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Mission band */}
      <section className="section-dark">
        <div className="container two-col" data-reveal>
          <div>
            <p className="overline-light">Our Purpose</p>
            <h2 className="heading-light">An array of resources</h2>
            <p className="body-light">
              At CrownIT Solutions, we are a family unit powered by diversity, inclusion,
              transparency, respect, integrity and passion for our clients and our people.
              Our business growth depends on our employees' professional development. By
              forging a meaningful partnership with our people, we stay nimble, ahead of
              the competition and on top of our industry. Come see what we're all about!
            </p>
          </div>
          <div className="mission-box">
            <h3>Our Mission</h3>
            <p>
              Our mission is to empower organizations with cutting-edge IT solutions that
              simplify complexity, enhance security, and drive sustainable growth. By
              offering tailored consulting services and strategic guidance, we help
              businesses unlock the full potential of technology to achieve their goals and
              thrive in a rapidly evolving digital landscape. With a commitment to
              innovation, excellence, and customer success, we strive to be the trusted
              partner for transforming challenges into opportunities.
            </p>
            <div className="newsletter-note">
              <span>✓ IT Staff Augmentation</span>
              <span>✓ Project Management</span>
              <span>✓ Software Development</span>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter / CTA band */}
      <section className="section-accent">
        <div className="container cta-band" data-reveal>
          <div>
            <p className="cta-quote">"Your success is our success."</p>
            <p>
              CrownIT Solutions has spent more than a decade helping companies reduce
              costs, strengthen data security, improve the customer and employee
              experience, and boost team productivity. Partner with us so we can help
              you maximize the success of your technology investment.
            </p>
          </div>
          <NavLink to="/contact-us" className="btn-primary">Partner with Us</NavLink>
        </div>
      </section>

      {/* Careers inline callout */}
      <section className="section-white">
        <div className="container cta-band" data-reveal>
          <p>
            If you are interested in joining our growing team, please email your
            resume to: <a className="inline-link" href="mailto:hr@crownits.com">hr@crownits.com</a>
          </p>
          <NavLink to="/careers" className="btn-primary">View Careers</NavLink>
        </div>
      </section>
    </>
  )
}

/* ── company ──────────────────────────────────────────────────── */
function CompanyPage() {
  useReveal()
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Who We Are</p>
          <h1 data-reveal>Company</h1>
        </div>
      </section>

      <section className="section-white">
        <div className="container prose" data-reveal>
          <p>
            CrownIT Solutions, LLC is one of the fastest growing Information Technology
            consulting and implementation firms providing high quality, cost-effective
            and timely system/application software solutions for the business needs of
            its customers in the U.S. marketplace.
          </p>
          <p>
            CrownIT Solutions has rich industry experience and application knowledge
            in e-Commerce, electrical and electronics, manufacturing, financial,
            transportation, health-care, telecommunications, and retail systems.
            This helps it maintain and deliver high quality and satisfaction to its
            clients. Our unprecedented growth has been due to our strong commitment
            toward our customers' satisfaction, cost-effectiveness and timeliness
            of our deliverables.
          </p>
          <p>
            Our mission is to bring value to our customers, our clients, and to the
            global business community by delivering advanced technology solutions that
            enable our clients to operate, interoperate and compete more effectively.
          </p>
          <p>
            CrownIT Solutions provides end-to-end business solutions that leverage
            technology and is experienced in Client Server, Mainframe, Web Development,
            Systems Design, Systems Administration, and Database Design.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container">
          <p className="overline" data-reveal>What drives us</p>
          <h2 className="section-heading" data-reveal>The goals of CITS</h2>
          <ul className="goal-list">
            {[
              'Provide our clients with talented and knowledgeable professionals.',
              'Encourage and promote employee growth and development.',
              "Expand employees' skills by supporting an active training and educational environment.",
              'Seek client assignments that allow employees to use skills required to remain competitive in the marketplace.',
            ].map((g) => (
              <li key={g} data-reveal>{g}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-white">
        <div className="container">
          <p className="overline" data-reveal>What we stand for</p>
          <h2 className="section-heading" data-reveal>Core Values</h2>
          <div className="values-grid">
            {values.map((v, i) => (
              <div className="value-card" key={v.label} data-reveal style={{ animationDelay: `${i * 0.07}s` }}>
                <h4>{v.label}</h4>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/* ── services ─────────────────────────────────────────────────── */
function ServicesPage() {
  useReveal()
  return (
    <>
      {/* Hero */}
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>What We Offer</p>
          <h1 data-reveal>Services</h1>
          <p className="hero-lead" data-reveal>
            CrownIT Solutions provides software applications &amp; services for banking,
            insurance, manufacturing, financial, and biotechnology industries, with a
            special focus on solutions for the clinical research industry.
          </p>
        </div>
      </section>

      {/* Overview */}
      <section className="section-white">
        <div className="container prose" data-reveal>
          <p>
            CrownIT Solutions' Professional Services allow our broad customer base to
            maximize the value of outsourcing technical development. With a range of
            skill sets and a flexible support network, CITS can quickly and
            cost-effectively supply individuals or teams to client-managed projects.
            We brand ourselves by the quality of our services and the quality of our
            deliverables. We spend a great amount of time and resources screening and
            hiring top quality consultants — allowing us to provide premier resources
            that meet and exceed our clients' expectations.
          </p>
          <p>
            Our services address specific needs of enterprise IT programs, communications
            and Internet technology product development, and engineering product design
            and data management. Clients benefit from seamless coordination across
            strategy, implementation, and management of their technology programs.
          </p>
          <p>
            Our vision is to be among the Global Technology Enablers and Service
            Providers — providing the full spectrum of our service model and being an
            integral part of the customer's success. Multiple skills and competencies
            combine to realize technology-driven business transformation.
          </p>
        </div>
      </section>

      {/* Staff Augmentation & Consulting */}
      <section className="section-light">
        <div className="container svc-section" data-reveal>
          <div className="svc-label">
            <p className="overline">Staff Augmentation &amp; Consulting</p>
            <h2 className="section-heading">Skilled Professionals with Industry Expertise</h2>
          </div>
          <div className="svc-body">
            <p>
              CrownIT Solutions Staff Augmentation services enable you to get qualified
              and experienced personnel to suit your requirements, working exclusively for
              you from our offices. It is a perfect way to accomplish your special or
              seasonal projects without adding a permanent staff.
            </p>
            <p>
              CITS is committed to providing customer-centric services that are highly
              effective and provide transparency with no hidden costs, out-of-pocket
              expenses, or additional taxes. CITS has insight, resources, and access to a
              global network of talent across technologies and industries to provide your
              company with the right consultants — just when you need them.
            </p>
            <p>
              CITS's strong proposition is its competent and vast resource pool, an
              extensive proprietary database coupled with the largest referral-based
              network. We leverage this to present multiple qualified applicants for your
              single position. CITS's proven recruitment methodology aids in bringing
              screened candidates on board even on short notice.
            </p>
            <p className="svc-tagline">Our Assets Are Our People</p>
          </div>
        </div>
      </section>

      {/* Project Management */}
      <section className="section-white">
        <div className="container svc-section svc-section--flip" data-reveal>
          <div className="svc-label">
            <p className="overline">Project Management</p>
            <h2 className="section-heading">Leveraging Experience and Technology</h2>
          </div>
          <div className="svc-body">
            <p>
              CrownIT Solutions has the tools and experience required to not only plot
              a clear course to sound business decisions by taking advantage of today's
              latest technologies, but also to implement them and run them on a
              day-to-day basis. These technologies provide solutions that cost-effectively
              increase productivity and create new business opportunities, while our
              outsourcing services give you the chance to lower the overall cost of
              ownership.
            </p>
            <p>
              We work closely with our clients to create, implement, and operate advanced
              business solutions that achieve the full potential of current and emerging
              technologies — as well as integrating these technologies with existing
              systems.
            </p>
            <p>
              CrownIT Solutions has a proven record in outsourcing the technical services
              necessary for businesses to stay ahead of their competitors. We have
              experience with a range of vendors, products, and technologies and are
              ready to provide your organization with a complete outsourcing solution that
              works best within your current system — or moves you ahead to an entirely
              new one. We offer a complete range of outsourcing services that can include
              standard application suites, 24/7/365 help desk, full outsourcing of all
              standard IT operations, and a detailed Service Level Agreement — all
              packaged together.
            </p>
          </div>
        </div>
      </section>

      {/* Software Development */}
      <section className="section-dark">
        <div className="container svc-section" data-reveal>
          <div className="svc-label">
            <p className="overline-light">Software Development Services</p>
            <h2 className="heading-light">Innovative Solutions for Complex Systems</h2>
          </div>
          <div className="svc-body">
            <p className="body-light">
              Adopting an offshore outsourcing model should be about more than seeking
              cost reductions — it should establish a framework to drive continuous
              improvement. CrownIT Solutions enables your business to leverage the
              combined benefits of IT Outsourcing (ITO) and Business Process Outsourcing
              (BPO) by adopting a unified view of your processes and applications.
            </p>
            <p className="body-light">
              Our application development and maintenance methodology helps with
              successful on-time deliverables that exceed expectations. Stringent quality
              procedures combined with benchmarked practices and experienced delivery
              skills help our clients get maximum return on their IT spending.
            </p>
            <p className="body-light">We work with you to:</p>
            <ul className="dark-list">
              {[
                'Outline the solution',
                'Define the solution architecture',
                'Develop prototypes for demos to users',
                'Design a framework for the solution',
                'Build the solution',
                'Validate the solution against requirements',
                'Provide continuous support for the solution',
                'Roll out the solution across your organization',
              ].map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── careers ──────────────────────────────────────────────────── */
function CareersPage() {
  useReveal()
  const subpages = [
    { to: '/careers/jobs', label: 'Current Job Openings', count: `${careersData.jobs.length} open roles`, desc: 'Browse active positions across software engineering, QA, and database administration.' },
    { to: '/careers/benefits', label: 'Employee Benefits', count: 'Comprehensive package', desc: 'Competitive pay, paid holidays, vacation time, and service awards.' },
    { to: '/careers/referral', label: 'Employee Referral Program', count: `Up to ${careersData.referral.bonusRange} bonus`, desc: 'Know someone great? Refer them and earn a bonus when they join the team.' },
  ]
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Join Our Team</p>
          <h1 data-reveal>Your new career starts here</h1>
        </div>
      </section>

      <section className="section-white">
        <div className="container two-col two-col--top" data-reveal>
          <div className="prose">
            <p>
              At CrownIT Solutions, we are always looking for talented individuals who
              share our passion for technology and client success. We are a family unit
              powered by diversity, inclusion, transparency, respect, integrity and
              passion for our clients and our people.
            </p>
            <p>
              If you are interested in joining our growing team, please email your
              resume to:
            </p>
            <a className="email-link" href="mailto:hr@crownits.com">hr@crownits.com</a>
          </div>
          <div>
            <h3 className="checklist-heading">Are you the right fit?</h3>
            <ul className="checklist">
              {[
                'Are you an ambitious IT professional?',
                'Do you want a career with a firm foundation?',
                'Do you want to achieve more and grow with a growing company?',
                'Do you look for lots of excitement at work?',
                'Are you creative and proactive?',
                'Do you possess excellent communication skills in English?',
              ].map((q) => <li key={q}>{q}</li>)}
            </ul>
            <p className="checklist-cta">If you answered yes — join us for your dream job.</p>
          </div>
        </div>
      </section>

      <section className="section-light">
        <div className="container">
          <p className="overline" data-reveal>Explore opportunities</p>
          <h2 className="section-heading" data-reveal>Life at CrownIT</h2>
          <div className="careers-subpage-grid">
            {subpages.map((sp, i) => (
              <NavLink to={sp.to} key={sp.to} className="careers-subpage-card" data-reveal style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="careers-card-count">{sp.count}</span>
                <h3>{sp.label}</h3>
                <p>{sp.desc}</p>
                <span className="careers-card-arrow">View &rarr;</span>
              </NavLink>
            ))}
          </div>
        </div>
      </section>

      <section className="section-accent">
        <div className="container cta-band" data-reveal>
          <p>Ready to take the next step? We'd love to hear from you.</p>
          <a className="btn-primary" href="mailto:hr@crownits.com">Send Your Resume</a>
        </div>
      </section>
    </>
  )
}

/* ── job apply modal ──────────────────────────────────────────── */
function JobApplyModal({ job, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [resumeFile, setResumeFile] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const dutyBullets = job.duties.split(';').map(s => s.trim()).filter(Boolean)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const lines = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.phone ? `Phone: ${form.phone}` : '',
      '',
      form.message ? `Cover Note:\n${form.message}` : '',
      resumeFile ? `\nResume file: ${resumeFile.name}\n(Please attach the file to this email before sending.)` : '',
    ].filter(l => l !== undefined).join('\n')
    window.location.href = `mailto:${job.applyEmail}?subject=${encodeURIComponent(`Application for ${job.title}`)}&body=${encodeURIComponent(lines)}`
    setSubmitted(true)
  }

  return (
    <div className="jm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="jm-panel" role="dialog" aria-modal="true" aria-label={`Apply for ${job.title}`}>

        {/* sticky header */}
        <div className="jm-header">
          <div className="jm-header-info">
            <span className="job-posted">Posted {job.postedOn}</span>
            <h2 className="jm-title">{job.title}</h2>
            <span className="job-location" style={{fontSize:'0.82rem'}}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginRight:'4px',verticalAlign:'middle'}}>
                <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <circle cx="6" cy="4.5" r="1.2" fill="currentColor"/>
              </svg>
              {job.location}
            </span>
          </div>
          <button className="jm-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* scrollable body */}
        <div className="jm-body">

          {/* ── Job Details ── */}
          <div className="jm-details">
            <div className="job-section">
              <h4>Job Duties</h4>
              <ul className="job-duties-list">
                {dutyBullets.map((d, i) => <li key={i}>{d}.</li>)}
              </ul>
            </div>

            <div className="jm-sidebar-cols">
              <div className="job-section">
                <h4>Tools &amp; Technologies</h4>
                <div className="job-tags">
                  {job.tools.map(t => <span className="job-tag" key={t}>{t}</span>)}
                </div>
              </div>

              <div className="job-section">
                <h4>Minimum Qualifications</h4>
                <ul className="job-bullet-list">
                  {[
                    { label: 'Education', value: job.requirements.education },
                    { label: 'Experience', value: job.requirements.experience },
                    { label: 'Other', value: job.requirements.other },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <li key={label}><strong>{label}:</strong> {value}</li>
                  ))}
                </ul>
              </div>

              <div className="job-section">
                <h4>Location</h4>
                <p className="job-hq-info">
                  Headquarters: <strong>{job.headquarters}</strong><br/>
                  Worksites: {job.location}
                </p>
              </div>
            </div>
          </div>

          {/* ── Application Form ── */}
          <div className="jm-apply">
            <h3 className="jm-apply-title">Apply for this Position</h3>
            {submitted ? (
              <div className="jm-success">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="var(--amber)" strokeWidth="1.8"/><path d="M8 12l3 3 5-5" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p><strong>Almost done!</strong> Your email client should now be open with the details pre-filled.</p>
                <p style={{fontSize:'0.85rem',color:'var(--muted)'}}>Please attach your resume to the email before sending.</p>
                <button className="btn-ghost" style={{marginTop:'1rem'}} onClick={onClose}>Close</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="jm-form">
                <div className="jm-row">
                  <div className="jm-field">
                    <label>Full Name <span className="jm-required">*</span></label>
                    <input required value={form.name} onChange={set('name')} placeholder="Jane Smith" />
                  </div>
                  <div className="jm-field">
                    <label>Email Address <span className="jm-required">*</span></label>
                    <input type="email" required value={form.email} onChange={set('email')} placeholder="jane@example.com" />
                  </div>
                </div>

                <div className="jm-row">
                  <div className="jm-field">
                    <label>Phone Number</label>
                    <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="jm-field">
                    <label>Resume <span className="jm-required">*</span></label>
                    <label className={`jm-upload${resumeFile ? ' jm-upload--set' : ''}`}>
                      <input required type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files[0])} />
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4-4 4 4M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {resumeFile ? resumeFile.name : 'Choose PDF or DOC'}
                    </label>
                  </div>
                </div>

                <div className="jm-field">
                  <label>Cover Note <span style={{fontWeight:400,color:'var(--muted)'}}>(optional)</span></label>
                  <textarea rows={4} value={form.message} onChange={set('message')} placeholder="Tell us briefly why you're a great fit for this role…" />
                </div>

                <p className="jm-note">
                  Clicking Submit will open your email client with your details pre-filled. Attach your resume file before sending.
                </p>

                <button type="submit" className="btn-primary jm-submit">
                  Submit Application &rarr;
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

/* ── careers / job openings ───────────────────────────────────── */
function JobOpeningsPage() {
  useReveal()
  const { isAdmin } = useAuth()
  const [jobs, setJobs]         = useState(careersData.jobs)
  const [editJob, setEditJob]   = useState(null)   // job being edited
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  async function saveToRepo(updatedJobs, message) {
    const data = await ghGet('src/data/careers.json')
    const updated = { ...careersData, jobs: updatedJobs }
    await ghPut('src/data/careers.json', message, b64(JSON.stringify(updated, null, 2)), data.sha)
  }

  async function handleDelete(job) {
    if (!window.confirm(`Remove "${job.title}" from the site?`)) return
    try {
      const updated = jobs.filter(j => j.id !== job.id)
      await saveToRepo(updated, `Remove job: ${job.title}`)
      setJobs(updated)
      showToast(`"${job.title}" deleted. Site rebuilds in ~1 min.`)
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error')
    }
  }

  async function handleSaveEdit(updatedJob) {
    setSaving(true)
    try {
      const updated = jobs.map(j => j.id === updatedJob.id ? updatedJob : j)
      await saveToRepo(updated, `Update job: ${updatedJob.title}`)
      setJobs(updated)
      setEditJob(null)
      showToast(`"${updatedJob.title}" updated. Site rebuilds in ~1 min.`)
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {toast && <div className={`admin-toast admin-toast--${toast.type}`} role="alert">{toast.msg}</div>}
      {editJob && <JobEditModal job={editJob} saving={saving} onSave={handleSaveEdit} onClose={() => setEditJob(null)} />}

      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>
            <NavLink to="/careers" className="breadcrumb-link">Careers</NavLink> &nbsp;/&nbsp; Job Openings
          </p>
          <h1 data-reveal>Current Job Openings</h1>
          <p className="hero-sub" data-reveal>
            {jobs.length} open positions &nbsp;·&nbsp; Headquarters: Dayton, OH &nbsp;·&nbsp; Multiple U.S. locations
          </p>
        </div>
      </section>

      <section className="section-white">
        <div className="container" data-reveal>
          <p className="jobs-intro">
            All positions are based at our Dayton, OH headquarters with travel and relocation to client sites throughout the U.S.
            To apply, send your resume to <a className="email-link" href="mailto:hr@crownits.com">hr@crownits.com</a>.
          </p>

          <div className="job-list">
            {jobs.map((job) => (
              <div key={job.id} className="job-card">
                <div className="job-card-badges">
                  <span className="jc-badge jc-badge--id">{job.id}</span>
                  <span className="jc-badge jc-badge--type">{job.type}</span>
                  <span className="jc-badge jc-badge--salary">{job.salary}</span>
                </div>

                <div className="job-card-row">
                  <div className="job-card-info">
                    <h3 className="job-title">{job.title}</h3>
                    <div className="job-card-sub">
                      <span className="job-location">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                          <circle cx="6" cy="4.5" r="1.1" fill="currentColor"/>
                        </svg>
                        {job.headquarters} · Multiple U.S. locations
                      </span>
                      <span className="job-posted">Posted {job.postedOn}</span>
                    </div>
                  </div>

                  <div className="job-card-actions">
                    {isAdmin ? (
                      <>
                        <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setEditJob(job)} aria-label="Edit job">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          Edit
                        </button>
                        <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleDelete(job)} aria-label="Delete job">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2h4v2M13 4l-1 10H4L3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Delete
                        </button>
                      </>
                    ) : (
                      <Link
                        className="btn-primary jc-apply-btn"
                        to={`/careers/jobs/${job.id}`}
                      >
                        Apply Now
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function parseBulletLines(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.replace(/^[\s•\-\*·]+/, '').trim())
    .filter(Boolean)
}

function toBulletText(value) {
  const items = Array.isArray(value)
    ? value
    : value
      ? String(value).split('\n').map(s => s.trim()).filter(Boolean)
      : []
  if (!items.length) return '• '
  return items.map(item => `• ${item.replace(/^[\s•\-\*·]+/, '').trim()}`).join('\n')
}

function fromBulletText(text) {
  const items = parseBulletLines(text)
  return items.length ? items.join('\n') : ''
}

const RESUME_ACCEPT = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const RESUME_EXT = /\.(pdf|doc|docx)$/i
const MAX_RESUME_MB = 5

function validateJobApplication(form, resumeFile) {
  const errs = {}
  const name = form.name.trim()
  if (!name) errs.name = 'Full name is required.'
  else if (name.length < 2) errs.name = 'Please enter at least 2 characters.'
  else if (!/^[a-zA-Z\s'.-]+$/.test(name)) errs.name = 'Name can only contain letters, spaces, hyphens, and apostrophes.'

  const email = form.email.trim()
  if (!email) errs.email = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email address.'

  const phone = form.phone.trim()
  const phoneDigits = phone.replace(/\D/g, '')
  if (!phone) errs.phone = 'Phone number is required.'
  else if (phoneDigits.length < 10) errs.phone = 'Please enter a valid 10-digit phone number.'
  else if (phoneDigits.length > 15) errs.phone = 'Phone number is too long.'

  const address = form.address.trim()
  if (!address) errs.address = 'Address is required.'
  else if (address.length < 10) errs.address = 'Please enter a complete street address.'

  if (!resumeFile) errs.resume = 'Please upload your resume (PDF or DOC).'
  else {
    const okType = RESUME_ACCEPT.includes(resumeFile.type) || RESUME_EXT.test(resumeFile.name)
    if (!okType) errs.resume = 'Resume must be a PDF, DOC, or DOCX file.'
    else if (resumeFile.size > MAX_RESUME_MB * 1024 * 1024) errs.resume = `Resume must be ${MAX_RESUME_MB} MB or smaller.`
  }

  if (form.message.trim().length > 2000) errs.message = 'Cover note must be 2,000 characters or fewer.'

  return errs
}

/* ── job edit modal ────────────────────────────────────────────── */
function JobEditModal({ job, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    title       : job.title,
    postedOn    : job.postedOn,
    location    : job.location,
    headquarters: job.headquarters,
    duties      : job.duties,
    tools       : toBulletText(job.tools),
    edu         : toBulletText(job.requirements.education),
    exp         : toBulletText(job.requirements.experience),
    other       : toBulletText(job.requirements.other),
    applyEmail  : job.applyEmail,
  })

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleSubmit(e) {
    e.preventDefault()
    const updated = {
      ...job,
      title       : form.title.trim(),
      postedOn    : form.postedOn.trim(),
      location    : form.location.trim(),
      headquarters: form.headquarters.trim(),
      duties      : form.duties.trim(),
      tools       : parseBulletLines(form.tools),
      requirements: {
        education : fromBulletText(form.edu),
        experience: fromBulletText(form.exp) || null,
        other     : fromBulletText(form.other),
      },
      applyEmail  : form.applyEmail.trim(),
    }
    onSave(updated)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Admin</p>
            <h2 className="modal-title">Edit Job Posting</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <form className="modal-form edit-form" onSubmit={handleSubmit}>
          <div className="edit-form-grid">
            <div className="modal-field">
              <label>Job Title</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div className="modal-field">
              <label>Posted On</label>
              <input value={form.postedOn} onChange={e => set('postedOn', e.target.value)} placeholder="MM/DD/YYYY" />
            </div>
            <div className="modal-field">
              <label>Apply Email</label>
              <input value={form.applyEmail} onChange={e => set('applyEmail', e.target.value)} />
            </div>
            <div className="modal-field">
              <label>Headquarters</label>
              <input value={form.headquarters} onChange={e => set('headquarters', e.target.value)} />
            </div>
          </div>

          <div className="modal-field">
            <label>Location</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} />
          </div>

          <div className="modal-field">
            <label>Job Duties <span className="field-hint">(separate duties with semicolons)</span></label>
            <textarea rows={6} value={form.duties} onChange={e => set('duties', e.target.value)} />
          </div>

          <div className="modal-field">
            <label>Tools &amp; Technologies <span className="field-hint">(one bullet per line)</span></label>
            <textarea rows={5} value={form.tools} onChange={e => set('tools', e.target.value)} placeholder={'• Oracle\n• DB2\n• SQL'} />
          </div>

          <div className="modal-field">
            <label>Education Requirement <span className="field-hint">(one bullet per line)</span></label>
            <textarea rows={3} value={form.edu} onChange={e => set('edu', e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Experience Requirement <span className="field-hint">(optional, one bullet per line)</span></label>
            <textarea rows={3} value={form.exp} onChange={e => set('exp', e.target.value)} />
          </div>
          <div className="modal-field">
            <label>Other Requirements <span className="field-hint">(one bullet per line)</span></label>
            <textarea rows={3} value={form.other} onChange={e => set('other', e.target.value)} />
          </div>

          <div className="edit-form-actions">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-submit" disabled={saving} style={{width:'auto',padding:'0.7rem 2rem'}}>
              {saving ? <span className="modal-spinner"/> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── careers / job detail ─────────────────────────────────────── */
function JobDetailPage() {
  useReveal()
  const { jobId } = useParams()
  const formRef = useRef(null)
  const job = careersData.jobs.find(j => j.id === jobId)

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', message: '' })
  const [resumeFile, setResumeFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(err => ({ ...err, [name]: undefined }))
  }

  function handleResumeChange(e) {
    setResumeFile(e.target.files?.[0] || null)
    setErrors(err => ({ ...err, resume: undefined }))
  }

  if (!job) {
    return (
      <section className="section-hero">
        <div className="container">
          <p className="eyebrow">404</p>
          <h1>Job Not Found</h1>
          <p className="hero-lead">This position may have been filled or the link is incorrect.</p>
          <NavLink to="/careers/jobs" className="btn-primary">Back to Job Openings</NavLink>
        </div>
      </section>
    )
  }

  const dutyBullets = job.duties.split(';').map(s => s.trim()).filter(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validateJobApplication(form, resumeFile)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setSubmitError(null)
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      // await sendJobApplicationEmail({
      //   job,
      //   name: form.name,
      //   email: form.email,
      //   phone: form.phone,
      //   address: form.address,
      //   message: form.message,
      //   resumeFile,
      // })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Unable to send your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>
            <NavLink to="/careers" className="breadcrumb-link">Careers</NavLink>
            &nbsp;/&nbsp;
            <NavLink to="/careers/jobs" className="breadcrumb-link">Job Openings</NavLink>
            &nbsp;/&nbsp; {job.title}
          </p>
          <h1 data-reveal>{job.title}</h1>
          <div className="job-detail-meta" data-reveal>
            <span className="jd-badge jd-badge--id">ID: {job.id}</span>
            <span className="jd-badge">{job.type}</span>
            <span className="jd-badge jd-badge--salary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{marginRight:'4px',verticalAlign:'middle'}}>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 7v1m0 8v1M9.5 9.5A2.5 2.5 0 0 1 12 8a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 2.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {job.salary}
            </span>
            <span className="jd-badge">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginRight:'4px',verticalAlign:'middle'}}>
                <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <circle cx="6" cy="4.5" r="1.2" fill="currentColor"/>
              </svg>
              {job.location}
            </span>
            <span style={{fontSize:'0.78rem',color:'var(--muted)'}}>Posted {job.postedOn}</span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="section-white">
        <div className="container jd-layout">

          {/* ── Left: Job Details ── */}
          <div className="jd-details">

            <div className="job-section">
              <h4>Job Duties</h4>
              <ul className="job-duties-list">
                {dutyBullets.map((d, i) => <li key={i}>{d}.</li>)}
              </ul>
            </div>

            <div className="job-section">
              <h4>Tools &amp; Technologies</h4>
              <div className="job-tags">
                {job.tools.map(t => <span className="job-tag" key={t}>{t}</span>)}
              </div>
            </div>

            <div className="job-section">
              <h4>Minimum Qualifications</h4>
              <ul className="job-bullet-list">
                {[
                  { label: 'Education', value: job.requirements.education },
                  { label: 'Experience', value: job.requirements.experience },
                  { label: 'Other', value: job.requirements.other },
                ].filter(r => r.value).map(({ label, value }) => (
                  <li key={label}><strong>{label}:</strong> {value}</li>
                ))}
              </ul>
            </div>

            <div className="job-section">
              <h4>Location</h4>
              <p className="job-hq-info">
                Headquarters: <strong>{job.headquarters}</strong><br/>
                Worksites: {job.location}
              </p>
            </div>
          </div>

          {/* ── Right: Application Form ── */}
          <aside className="jd-apply-panel" ref={formRef}>
            <div className="jd-apply-card">
              <div className="jd-apply-card-header">
                <h3>Apply for this Position</h3>
              </div>

              {submitted ? (
                <div className="jd-success">
                  <svg width="44" height="44" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="var(--amber)" strokeWidth="1.8"/>
                    <path d="M8 12l3 3 5-5" stroke="var(--amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p><strong>Application submitted!</strong></p>
                  <p>Thank you for applying. We&apos;ve received your details and will be in touch soon.</p>
                  <NavLink to="/careers/jobs" className="btn-primary" style={{marginTop:'1rem'}}>
                    Back to Jobs
                  </NavLink>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="jd-form" noValidate>
                  <div className="jd-field">
                    <label htmlFor="jd-name">Full Name <span className="jd-req">*</span></label>
                    <input
                      id="jd-name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      className={errors.name ? 'input-error' : ''}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
                  </div>

                  <div className="jd-field">
                    <label htmlFor="jd-email">Email Address <span className="jd-req">*</span></label>
                    <input
                      id="jd-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@example.com"
                      className={errors.email ? 'input-error' : ''}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
                  </div>

                  <div className="jd-field">
                    <label htmlFor="jd-phone">Phone Number <span className="jd-req">*</span></label>
                    <input
                      id="jd-phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000"
                      className={errors.phone ? 'input-error' : ''}
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone && <span className="field-error" role="alert">{errors.phone}</span>}
                  </div>

                  <div className="jd-field">
                    <label htmlFor="jd-address">Address <span className="jd-req">*</span></label>
                    <input
                      id="jd-address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="123 Main St, Dayton, OH 45458"
                      className={errors.address ? 'input-error' : ''}
                      aria-invalid={!!errors.address}
                    />
                    {errors.address && <span className="field-error" role="alert">{errors.address}</span>}
                  </div>

                  <div className="jd-field">
                    <label>Resume <span className="jd-req">*</span></label>
                    <label className={`jd-upload${resumeFile ? ' jd-upload--set' : ''}${errors.resume ? ' jd-upload--error' : ''}`}>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeChange} aria-invalid={!!errors.resume} />
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4-4 4 4M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {resumeFile ? resumeFile.name : 'Upload PDF or DOC'}
                    </label>
                    {errors.resume && <span className="field-error" role="alert">{errors.resume}</span>}
                  </div>

                  <div className="jd-field">
                    <label htmlFor="jd-message">Cover Note <span style={{fontWeight:400,opacity:.6}}>(optional)</span></label>
                    <textarea
                      id="jd-message"
                      name="message"
                      rows={3}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us briefly why you're a great fit…"
                      className={errors.message ? 'input-error' : ''}
                      aria-invalid={!!errors.message}
                    />
                    {errors.message && <span className="field-error" role="alert">{errors.message}</span>}
                  </div>

                  {submitError && (
                    <div className="form-submit-error" role="alert">{submitError}</div>
                  )}

                  <button type="submit" className="btn-primary jd-submit" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Submit Application →'}
                  </button>
                </form>
              )}
            </div>
          </aside>

        </div>
      </section>
    </>
  )
}

/* ── careers / benefits ───────────────────────────────────────── */
function BenefitsPage() {
  useReveal()
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>
            <NavLink to="/careers" className="breadcrumb-link">Careers</NavLink> / Benefits
          </p>
          <h1 data-reveal>Comprehensive Employee Benefits</h1>
        </div>
      </section>

      <section className="section-white">
        <div className="container" data-reveal>
          <div className="prose prose--wide">
            <p className="lead">{careersData.benefits.intro}</p>
            <ul className="benefit-list">
              {careersData.benefits.items.map(item => (
                <li key={item}>
                  <span className="benefit-check">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-accent">
        <div className="container cta-band" data-reveal>
          <p>Join a team that invests in your growth and wellbeing.</p>
          <a className="btn-primary" href="mailto:hr@crownits.com">Get in Touch</a>
        </div>
      </section>
    </>
  )
}

/* ── careers / referral ───────────────────────────────────────── */
function ReferralPage() {
  useReveal()
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>
            <NavLink to="/careers" className="breadcrumb-link">Careers</NavLink> / Referral Program
          </p>
          <h1 data-reveal>Employee Referral Program</h1>
          <p className="hero-sub" data-reveal>Earn {careersData.referral.bonusRange} for every successful referral</p>
        </div>
      </section>

      <section className="section-white">
        <div className="container" data-reveal>
          <div className="prose prose--wide">
            <p className="lead">{careersData.referral.intro}</p>
            <div className="faq-list">
              {careersData.referral.faqs.map((faq, i) => (
                <div className="faq-item" key={i}>
                  <h4 className="faq-q">{faq.question}</h4>
                  <p className="faq-a">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-accent">
        <div className="container cta-band" data-reveal>
          <p>Know someone who'd be a great fit? Refer them today.</p>
          <a className="btn-primary" href="mailto:hr@crownits.com">Submit a Referral</a>
        </div>
      </section>
    </>
  )
}

/* ── lca ──────────────────────────────────────────────────────── */
function LcaPage() {
  useReveal()
  const { isAdmin } = useAuth()
  const [files, setFiles]       = useState(lcaFiles)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast]       = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!LCA_PDF_EXT.test(file.name)) {
      showToast('Only PDF files are allowed.', 'error')
      return
    }
    if (file.size > MAX_LCA_MB * 1024 * 1024) {
      showToast(`File must be ${MAX_LCA_MB} MB or smaller.`, 'error')
      return
    }

    const filename = file.name.trim().replace(/[/\\?%*:|"<>]/g, '-')
    const exists = files.some(f => f.filename.toLowerCase() === filename.toLowerCase())
    if (exists && !window.confirm(`"${filename}" already exists. Replace it?`)) return

    setUploading(true)
    try {
      requireGhToken()

      let existingSha = null
      if (exists) {
        const existing = await ghGet(`public/lca/${filename}`)
        existingSha = existing.sha
      }

      const content = await fileToB64(file)
      await ghPut(`public/lca/${filename}`, `Add LCA: ${filename}`, content, existingSha)

      const entry = { filename, ...parseLcaFilename(filename) }
      const updated = sortLcaEntries([
        ...files.filter(f => f.filename.toLowerCase() !== filename.toLowerCase()),
        entry,
      ])
      await saveLcaManifest(updated, `Update LCA manifest: ${filename}`)

      setFiles(updated)
      showToast(`"${entry.displayName}" uploaded. Site rebuilds in ~1 min.`)
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Remove "${entry.displayName}" from the site?`)) return

    setUploading(true)
    try {
      requireGhToken()

      const data = await ghGet(`public/lca/${entry.filename}`)
      await ghDel(`public/lca/${entry.filename}`, `Remove LCA: ${entry.filename}`, data.sha)

      const updated = files.filter(f => f.filename !== entry.filename)
      await saveLcaManifest(updated, `Remove LCA from manifest: ${entry.filename}`)

      setFiles(updated)
      showToast(`"${entry.displayName}" deleted. Site rebuilds in ~1 min.`)
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {toast && <div className={`admin-toast admin-toast--${toast.type}`} role="alert">{toast.msg}</div>}

      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Compliance &amp; Transparency</p>
          <h1 data-reveal>LCA ETA 9035</h1>
          <p className="hero-sub" data-reveal>{files.length} certified application{files.length !== 1 ? 's' : ''}</p>
        </div>
      </section>

      <section className="section-white">
        <div className="container" data-reveal>
          <div className="lca-page-header">
            <p className="body-lg">H1B Certified Labor Condition Applications (ETA 9035)</p>
          </div>

          {isAdmin && (
            <div className="lca-admin-toolbar">
              <label className={`lca-upload${uploading ? ' lca-upload--busy' : ''}`}>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 11V3M8 3L5 6M8 3l3 3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {uploading ? 'Uploading…' : 'Upload LCA PDF'}
              </label>
              <p className="lca-admin-hint">PDF only · max {MAX_LCA_MB} MB · saved to GitHub</p>
            </div>
          )}

          {files.length === 0 ? (
            <p className="lca-empty">No LCA documents published yet.</p>
          ) : (
            <ul className="lca-list">
              {files.map((entry) => (
                <li key={entry.filename} className="lca-list-item">
                  <a
                    className="lca-list-link"
                    href={`${base}/lca/${encodeURIComponent(entry.filename)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="lca-name">{entry.displayName}</span>
                    <span className="lca-badge">Certified LCA ↗</span>
                  </a>
                  {isAdmin && (
                    <button
                      className="admin-btn admin-btn--danger admin-btn--sm lca-delete-btn"
                      onClick={() => handleDelete(entry)}
                      disabled={uploading}
                      aria-label={`Delete ${entry.displayName}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2 4h12M6 4V2h4v2M13 4l-1 10H4L3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}

/* ── contact ──────────────────────────────────────────────────── */
function ContactPage() {
  useReveal()
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(err => ({ ...err, [name]: undefined }))
    setSubmitError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validateContactForm(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      // await sendContactEmail(form)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Unable to send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Reach Out</p>
          <h1 data-reveal>Contact Us</h1>
        </div>
      </section>

      <section className="section-white">
        <div className="container two-col two-col--top" data-reveal>
          <div className="prose">
            <p>
              Thank you for visiting CrownIT Solutions, LLC. For questions or inquiries
              please send us a message using the form or contact us using the following information.
            </p>
            <div className="contact-block">
              <p><strong>Headquarters</strong></p>
              <p>10552 Success Lane, STE# K<br />Dayton, OH 45458</p>
              <p>Ph: (937) 886-6787<br />Fx: (215) 318-5343</p>
              <p><a href="mailto:hr@crownits.com">hr@crownits.com</a></p>
            </div>
            <div className="contact-block">
              <p><strong>Other Locations</strong></p>
              <p>Tampa, FL &nbsp;·&nbsp; Atlanta, GA</p>
            </div>
            <p className="contact-note">Please allow us 24–48 hours to respond.</p>
          </div>
          <div className="contact-form-placeholder" data-reveal>
            <h3>Send Us a Message</h3>
            <p>Fill in your details below and we&apos;ll get back to you shortly.</p>

            {submitted ? (
              <div className="jd-success contact-form-success">
                <svg width="44" height="44" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="var(--amber)" strokeWidth="1.8"/>
                  <path d="M8 12l3 3 5-5" stroke="var(--amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p><strong>Message sent!</strong></p>
                <p>Thank you for reaching out. We&apos;ve received your message and will respond soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="jd-form contact-form" noValidate>
                <div className="jd-field">
                  <label htmlFor="contact-name">Name <span className="jd-req">*</span></label>
                  <input
                    id="contact-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className={errors.name ? 'input-error' : ''}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
                </div>

                <div className="jd-field">
                  <label htmlFor="contact-email">Email <span className="jd-req">*</span></label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@example.com"
                    className={errors.email ? 'input-error' : ''}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
                </div>

                <div className="jd-field">
                  <label htmlFor="contact-phone">Phone <span style={{fontWeight:400,opacity:.6}}>(optional)</span></label>
                  <input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className={errors.phone ? 'input-error' : ''}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && <span className="field-error" role="alert">{errors.phone}</span>}
                </div>

                <div className="jd-field">
                  <label htmlFor="contact-message">Message <span className="jd-req">*</span></label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="How can we help you?"
                    className={errors.message ? 'input-error' : ''}
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && <span className="field-error" role="alert">{errors.message}</span>}
                </div>

                {submitError && (
                  <div className="form-submit-error" role="alert">{submitError}</div>
                )}

                <button type="submit" className="btn-primary jd-submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Message →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

/* ── terms ────────────────────────────────────────────────────── */
function TermsPage() {
  useReveal()
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Legal</p>
          <h1 data-reveal>Terms and Conditions</h1>
        </div>
      </section>
      <section className="section-white">
        <div className="container prose legal-prose" data-reveal>
          <h3>Who we are</h3>
          <p>Our website address is: https://crownits.com.</p>

          <h3>Tracking Activity on Our Site</h3>
          <p>
            When you browse crownits.com and have not registered for any online services,
            you browse anonymously. Personally identifiable information — such as your
            name, address, phone number, and e-mail address — is not collected as you
            browse. However, we track how our site is used by both anonymous visitors and
            registered customers via cookies, which collect server and browser information
            but cannot access your hard drive or capture personal data without consent.
          </p>

          <h3>Information We Collect</h3>
          <p>
            When you become a registered user on our site, you provide personal
            information such as your e-mail address and account number, enabling you to
            review confidential account information and perform transactions.
          </p>

          <h3>How We Use Personal Information</h3>
          <p>
            Once you are a registered crownits.com user, we use this information to
            deliver products and services you enroll in, process transactions you
            conduct on our website, and to customize your online experience.
          </p>

          <h3>Terms &amp; Conditions</h3>
          <p>
            This website is intended for personal, non-commercial use. Users may not
            modify, copy, distribute, transmit, display, perform, reproduce, publish,
            license, create derivative works from, transfer, or sell any information,
            products or services obtained from this site. CrownITs reserves the right
            to deny access to the website to anyone at any time. As a condition of use,
            the user agrees to indemnify CrownITs and its suppliers from and against
            any and all liabilities and damages arising out of claims resulting from
            use of this website.
          </p>
        </div>
      </section>
    </>
  )
}

/* ── privacy ──────────────────────────────────────────────────── */
function PrivacyPage() {
  useReveal()
  return (
    <>
      <section className="section-hero section-hero--sm">
        <div className="container">
          <p className="eyebrow" data-reveal>Legal</p>
          <h1 data-reveal>Privacy Policy</h1>
        </div>
      </section>
      <section className="section-white">
        <div className="container prose legal-prose" data-reveal>
          <h3>Who we are</h3>
          <p>
            CrownIT Solutions, LLC ("CrownITs") owns the website https://crownits.com.
            We respect your privacy and are committed to protecting it through our
            compliance with this policy. By accessing or using this website, you agree
            to this privacy policy.
          </p>

          <h3>Collection of Information</h3>
          <p>
            We collect personal information such as name, e-mail address, telephone
            number, company name, and title when you provide it to us — via contact
            forms, correspondence, or job applications. We also collect usage details,
            IP addresses, and cookie data automatically as you navigate the website.
          </p>

          <h3>Use of Information</h3>
          <p>We use collected information to:</p>
          <ul>
            <li>Present our website and its contents effectively.</li>
            <li>Provide and support our IT offerings.</li>
            <li>Process job applications.</li>
            <li>Improve website usability and maintenance.</li>
            <li>Prevent fraud and enhance security.</li>
            <li>Contact you with information that may be of interest to you.</li>
            <li>Maintain leads, run marketing campaigns, and create brand awareness.</li>
          </ul>

          <h3>Cookies and Technology</h3>
          <p>
            This website uses Google Analytics to track usage patterns. Cookies collect
            server and browser information but cannot retrieve personal data from your
            device. You may refuse cookies in your browser settings or opt out using the
            Google Analytics opt-out browser add-on.
          </p>

          <h3>How We Protect Personal Information</h3>
          <p>
            We have implemented measures designed to secure your personal information from
            accidental loss and unauthorized access, use, alteration, and disclosure.
            However, transmission of information via the internet is not completely secure.
            Any transmission of personal information is at your own risk.
          </p>

          <h3>Children's Privacy</h3>
          <p>We do not knowingly collect personal information from children under 13.</p>

          <h3>Changes to This Policy</h3>
          <p>
            Changes are posted on this page. Continued use of the website after changes
            are made constitutes acceptance of those changes.
          </p>
        </div>
      </section>
    </>
  )
}

/* ── 404 ──────────────────────────────────────────────────────── */
function NotFoundPage() {
  return (
    <section className="section-hero">
      <div className="container">
        <p className="eyebrow">404</p>
        <h1>Page Not Found</h1>
        <p className="hero-lead">The page you requested does not exist.</p>
        <NavLink to="/" className="btn-primary">Back to Home</NavLink>
      </div>
    </section>
  )
}

/* ── router ───────────────────────────────────────────────────── */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/index.php/crownit-solutions/" element={<CompanyPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/jobs" element={<JobOpeningsPage />} />
        <Route path="/careers/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/careers/benefits" element={<BenefitsPage />} />
        <Route path="/careers/referral" element={<ReferralPage />} />
        <Route path="/index.php/your-new-career-starts-here/" element={<CareersPage />} />
        <Route path="/index.php/current-job-openings/" element={<JobOpeningsPage />} />
        <Route path="/index.php/comprehensive-employee-benefits/" element={<BenefitsPage />} />
        <Route path="/index.php/employee-referral-program/" element={<ReferralPage />} />
        <Route path="/lca-eta-9035" element={<LcaPage />} />
        <Route path="/index.php/lca-eta-9035/" element={<LcaPage />} />
        <Route path="/contact-us" element={<ContactPage />} />
        <Route path="/index.php/crownit-solutions/contact-us/" element={<ContactPage />} />
        <Route path="/terms-and-conditions" element={<TermsPage />} />
        <Route path="/index.php/legal-information/" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/index.php/privacy-policy-2/" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}
