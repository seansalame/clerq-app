# clerq — פיצול חשבון חכם

> AI-powered bill splitting for Israel. Scan a receipt, share a code, everyone pays their share via Bit or Paybox.

[![Netlify Status](https://api.netlify.com/api/v1/badges/xxx/deploy-status)](https://app.netlify.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS — no framework |
| Realtime DB | Firebase Realtime Database |
| AI | Google Gemini 2.5 Flash (via Netlify Function) |
| Hosting | Netlify (CDN + Serverless Functions) |
| PWA | Service Worker + Web App Manifest |

## Project Structure

```
clerq/
├── index.html                  # Auth flow (splash, register, login, OTP)
├── offline.html                # Offline fallback
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker
├── netlify.toml                # Netlify config + security headers
│
├── css/
│   └── design.css              # Design system (tokens, components, utilities)
│
├── js/
│   └── core.js                 # Firebase, auth, utils, validation
│
├── app/
│   ├── home.html               # Home screen (post-login)
│   ├── scan.html               # Camera + AI scan
│   ├── session.html            # Live item selection
│   ├── summary.html            # Summary + payment
│   ├── join.html               # Join with code
│   └── profile.html            # User profile
│
├── assets/
│   ├── icon-*.png              # PWA icons (all sizes)
│   └── logo.svg                # Brand logo
│
└── netlify/
    └── functions/
        └── scan-bill.js        # Gemini AI proxy (keeps key server-side)
```

## Setup

### 1. Clone & Deploy to Netlify

```bash
git clone https://github.com/YOUR_USERNAME/clerq-app
```

Connect to Netlify → set environment variable:
```
GEMINI_API_KEY = your_key_from_aistudio.google.com
```

### 2. Firebase

Firebase config is in `js/core.js`. The web API key is public by design — security is enforced via Firebase Security Rules.

**Important:** Set proper Firebase Security Rules before production:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "sessions": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "codes": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 3. OTP / SMS

Currently using demo mode (code = 1234). For production, integrate:
- **Twilio Verify** — international, $0.05/SMS
- **019mobile** — Israeli SMS, cheaper local rates
- **Vonage** — good Israeli coverage

Replace `sendOTP()` in `index.html` with your SMS provider.

## Standards Met

- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Input validation & sanitization (XSS prevention)
- ✅ Auth guard on all protected pages
- ✅ Error boundaries with user-friendly messages
- ✅ Loading states on all async actions
- ✅ Offline support (Service Worker)
- ✅ PWA installable (manifest + SW)
- ✅ ARIA labels & keyboard navigation
- ✅ Touch targets ≥44px
- ✅ Reduced motion support
- ✅ Safe area insets (iPhone notch)
- ✅ API key server-side only (Netlify Function)
- ✅ CSS custom properties (design tokens)
- ✅ Semantic HTML

## License

Proprietary — Clerq Technologies Ltd.
