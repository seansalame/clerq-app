/**
 * clerq — Core Module v1.0
 * Production Grade | Startup Standard
 *
 * Responsibilities:
 * - Firebase initialization
 * - Auth state management
 * - Navigation utilities
 * - Toast notifications
 * - Input sanitization
 * - Error handling
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, get, remove,
  onValue, update, push, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Firebase Config ──
// Note: Firebase web config is public by design.
// Security is enforced via Firebase Security Rules, not key secrecy.
// See: https://firebase.google.com/docs/projects/api-keys
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBWYEntIaNdQio86BGVREmBAAqUo0F6sIw",
  authDomain:        "clerq-1145a.firebaseapp.com",
  databaseURL:       "https://clerq-1145a-default-rtdb.firebaseio.com",
  projectId:         "clerq-1145a",
  storageBucket:     "clerq-1145a.firebasestorage.app",
  messagingSenderId: "426819964309",
  appId:             "1:426819964309:web:adf96da249d35d5d823a9c"
};

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(firebaseApp);

export { db, ref, set, get, remove, onValue, update, push, serverTimestamp };

// ── Constants ──
export const STORAGE_KEYS = {
  USER:    'clerq:user:v1',
  SESSION: 'clerq:session:v1',
};

export const ROUTES = {
  HOME:    '/home.html',
  SCAN:    '/scan.html',
  JOIN:    '/join.html',
  SESSION: '/session.html',
  SUMMARY: '/summary.html',
  PROFILE: '/profile.html',
  LOGIN:   '/index.html',
};

export const CODE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Auth ──
export function saveUser(user) {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (e) {
    console.warn('[clerq] Could not save user to localStorage:', e);
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Auth guard — call at top of every protected page.
 * Redirects to login if no authenticated user.
 */
export function requireAuth() {
  const user = getUser();
  if (!user) {
    navigate(ROUTES.LOGIN);
    return null;
  }
  return user;
}

// ── Session ──
export function saveSession(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data));
  } catch (e) {
    console.warn('[clerq] Could not save session:', e);
  }
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ── Navigation ──
export function navigate(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  window.location.href = url.toString();
}

export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ── Code Utils ──
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatCode(code) {
  if (!code || code.length !== 6) return '--- ---';
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function parseCode(formatted) {
  return formatted.replace(/\s/g, '');
}

// ── Input Sanitization ──
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

export function sanitizeName(name) {
  return name
    .trim()
    .slice(0, 30)
    .replace(/[<>]/g, '');
}

export function sanitizePhone(phone) {
  return phone.replace(/\D/g, '').slice(0, 10);
}

// ── Validation ──
export function validateName(name) {
  const clean = name.trim();
  if (!clean) return 'הכנס שם';
  if (clean.length < 2) return 'השם קצר מדי';
  if (clean.length > 30) return 'השם ארוך מדי';
  return null;
}

export function validatePhone(phone) {
  const clean = sanitizePhone(phone);
  if (!clean) return 'הכנס מספר טלפון';
  if (clean.length < 9) return 'מספר טלפון לא תקין';
  if (!clean.startsWith('05')) return 'מספר צריך להתחיל ב-05';
  return null;
}

// ── Currency ──
export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return '₪' + num.toFixed(2);
}

export function parseCurrency(str) {
  return parseFloat(str.replace(/[₪,]/g, '')) || 0;
}

// ── Date ──
export function formatDate(timestamp) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

export function formatDateShort(timestamp) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit'
  }).format(new Date(timestamp));
}

// ── Toast ── 
let _toastTimer = null;

export function showToast(message, type = '', duration = 3000) {
  const el = document.getElementById('clerq-toast');
  if (!el) return;

  el.textContent = message;
  el.className = `toast visible${type ? ' ' + type : ''}`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, duration);
}

// ── Screen Manager ──
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });

  const target = document.getElementById(id);
  if (!target) return;

  target.classList.add('active');
  target.removeAttribute('aria-hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Loading State ──
export function setLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.classList.add('loading');
    button.textContent = '';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    button.textContent = button.dataset.originalText || '';
  }
}

// ── Firebase Error Handler ──
export function handleFirebaseError(error, fallback = 'אירעה שגיאה — נסה שוב') {
  const messages = {
    'PERMISSION_DENIED':       'אין הרשאות גישה',
    'NETWORK_ERROR':           'בעיית רשת — בדוק חיבור אינטרנט',
    'DISCONNECTED':            'התנתק מהשרת',
  };

  const msg = messages[error?.code] || fallback;
  showToast(msg, 'error');
  console.error('[clerq:firebase]', error);
  return msg;
}

// ── PWA Install Prompt ──
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
  document.dispatchEvent(new CustomEvent('clerq:installable'));
});

export async function promptInstall() {
  if (!_installPrompt) return false;
  const result = await _installPrompt.prompt();
  _installPrompt = null;
  return result.outcome === 'accepted';
}

export function isInstallable() {
  return !!_installPrompt;
}

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// ── Service Worker Registration ──
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.info('[clerq] SW registered:', reg.scope);
  } catch (e) {
    console.warn('[clerq] SW registration failed:', e);
  }
}

// ── Analytics (stub — replace with real analytics) ──
export function track(event, properties = {}) {
  // Replace with: Mixpanel, Amplitude, PostHog, etc.
  console.info('[clerq:track]', event, properties);
}
