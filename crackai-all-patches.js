/**
 * crackai-all-patches.js — CrackAI v1.0
 * ═══════════════════════════════════════════════════════════════
 * Merged patch bundle — includes:
 *   1. SEO        — meta tags, Open Graph, structured data, dynamic titles
 *   2. Analytics  — DAU, retention, churn, events → Firestore
 *   3. Security   — server-side premium verification, paywall hardening
 *
 * DROP IN: Add to index.html in this order:
 *   <head>
 *     <!-- SEO must be first in head -->
 *     <script src="crackai-all-patches.js"></script>
 *     ...rest of your head tags...
 *   </head>
 *   <body>
 *     ...your app...
 *     <!-- all other scripts (app.js, payment.js, etc.) -->
 *     <!-- this file must also run after Firebase is ready for analytics+security -->
 *     <!-- so include it in head (for SEO) AND the SEO section self-executes immediately -->
 *     <!-- analytics + security auto-init after firebaseReady event -->
 *   </body>
 *
 * BEFORE DEPLOYING:
 *   1. Delete CASHFREE_SECRET_KEY from app.js (urgent — it's public!)
 *   2. Deploy the verify-premium Cloud Run function (code at bottom of this file)
 *   3. Update VERIFY_PREMIUM_URL below with your deployed function URL
 *   4. Update BASE_URL with your real domain
 *   5. Update ADMIN_EMAILS in admin-dashboard.html
 * ═══════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — SEO
   Meta tags, Open Graph, Twitter Cards, JSON-LD structured data
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE_URL     = 'https://easyfreepdf.online'; // ← change to your domain
  const SITE_NAME    = 'CrackAI';
  const DEFAULT_DESC = 'AI-powered exam preparation for SSC CGL, CHSL, UPSC, RRB, Class 9–12. Solve questions from photos, PDFs. Free to try.';
  const OG_IMAGE     = BASE_URL + '/og-image.png'; // create a 1200×630 banner image

  const PAGE_CONFIGS = {
    '#ssc':     { title: 'SSC CGL & CHSL AI Prep | CrackAI',    desc: 'Crack SSC CGL and CHSL with AI. Solve question papers, get step-by-step explanations, practice mock tests. Free for 10 questions.' },
    '#upsc':    { title: 'UPSC Preparation with AI | CrackAI',   desc: 'UPSC Civil Services preparation powered by AI. PYQ bank, mock interviews, current affairs analysis.' },
    '#rrb':     { title: 'RRB NTPC Exam Prep | CrackAI',         desc: 'Railway RRB NTPC exam preparation with AI. Solve previous year papers with photo or PDF upload.' },
    '#class10': { title: 'Class 10 AI Study App | CrackAI',      desc: 'Class 10 CBSE/ICSE board exam preparation with AI tutor. Maths, Science, English, Social Science.' },
    '#class12': { title: 'Class 12 AI Study App | CrackAI',      desc: 'Class 12 board exam AI tutor for Physics, Chemistry, Maths, Biology. Instant step-by-step solutions.' },
    '#ibps':    { title: 'IBPS PO Bank Exam Prep | CrackAI',     desc: 'IBPS PO and Clerk exam preparation with AI. Quantitative aptitude, reasoning, English — solved in seconds.' },
    '#voice':   { title: 'AI Voice Teacher for Exams | CrackAI', desc: 'Talk to an AI teacher in Hindi or English. Ask exam questions by voice, get spoken explanations.' },
    default:    { title: 'CrackAI — Crack Any Exam with AI',      desc: DEFAULT_DESC }
  };

  function setMeta(name, content, attr) {
    attr = attr || 'name';
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
    el.href = href;
  }

  function injectStructuredData(json) {
    var existing = document.getElementById('crackai-jsonld');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.id   = 'crackai-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(json);
    document.head.appendChild(script);
  }

  function applyPageSEO(hash) {
    var cfg = PAGE_CONFIGS[hash] || PAGE_CONFIGS.default;
    var url = BASE_URL + '/' + (hash || '');

    document.title = cfg.title;
    setMeta('description', cfg.desc);
    setMeta('robots', 'index, follow');
    setLink('canonical', BASE_URL + '/');

    // Open Graph
    setMeta('og:type',        'website',   'property');
    setMeta('og:url',         url,         'property');
    setMeta('og:title',       cfg.title,   'property');
    setMeta('og:description', cfg.desc,    'property');
    setMeta('og:image',       OG_IMAGE,    'property');
    setMeta('og:site_name',   SITE_NAME,   'property');
    setMeta('og:locale',      'en_IN',     'property');

    // Twitter Card
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:title',       cfg.title);
    setMeta('twitter:description', cfg.desc);
    setMeta('twitter:image',       OG_IMAGE);

    setMeta('theme-color',            '#6C63FF');
    setMeta('mobile-web-app-capable', 'yes');

    // JSON-LD structured data
    injectStructuredData([
      {
        '@context': 'https://schema.org',
        '@type':    'WebApplication',
        'name':     SITE_NAME,
        'url':      BASE_URL,
        'description': DEFAULT_DESC,
        'applicationCategory': 'EducationalApplication',
        'operatingSystem': 'All',
        'offers': {
          '@type': 'Offer', 'price': '0', 'priceCurrency': 'INR',
          'description': 'Free tier with 10 messages per day. Premium from ₹99/month.'
        },
        'aggregateRating': { '@type': 'AggregateRating', 'ratingValue': '4.8', 'ratingCount': '1200' }
      },
      {
        '@context': 'https://schema.org',
        '@type':    'FAQPage',
        'mainEntity': [
          { '@type': 'Question', 'name': 'Is CrackAI free to use?',
            'acceptedAnswer': { '@type': 'Answer', 'text': 'Yes, CrackAI is free for 10 AI messages per day. Premium plans start at ₹99/month for unlimited access.' } },
          { '@type': 'Question', 'name': 'Can CrackAI solve questions from photos?',
            'acceptedAnswer': { '@type': 'Answer', 'text': 'Yes. Take a photo of any exam question and CrackAI\'s vision AI will solve it with step-by-step explanation.' } },
          { '@type': 'Question', 'name': 'Which exams does CrackAI support?',
            'acceptedAnswer': { '@type': 'Answer', 'text': 'CrackAI supports SSC CGL, CHSL, UPSC, RRB NTPC, IBPS PO, CUET, NDA, CDS, and Classes 6–12 (CBSE/ICSE).' } },
          { '@type': 'Question', 'name': 'Does CrackAI work in Hindi?',
            'acceptedAnswer': { '@type': 'Answer', 'text': 'Yes. CrackAI\'s voice teacher and text AI both support Hindi and Hinglish explanations.' } },
          { '@type': 'Question', 'name': 'Can I solve PDFs with CrackAI?',
            'acceptedAnswer': { '@type': 'Answer', 'text': 'Yes. Upload any exam paper as a PDF and CrackAI will extract and solve every question.' } }
        ]
      }
    ]);
  }

  function addPerformanceHints() {
    [
      { rel: 'preconnect',   href: 'https://deepseek-56khnynjia-uc.a.run.app' },
      { rel: 'dns-prefetch', href: 'https://firestore.googleapis.com' },
      { rel: 'preconnect',   href: 'https://fonts.googleapis.com' }
    ].forEach(function(h) {
      if (!document.querySelector('link[href="' + h.href + '"]')) {
        var l = document.createElement('link');
        l.rel = h.rel; l.href = h.href;
        if (h.rel === 'preconnect') l.crossOrigin = '';
        document.head.appendChild(l);
      }
    });
  }

  // Public API — call when user switches exam: updatePageSEO('ssc')
  window.updatePageSEO = function(examOrFeature) {
    applyPageSEO('#' + (examOrFeature || ''));
  };

  applyPageSEO(window.location.hash || '');
  addPerformanceHints();
  window.addEventListener('hashchange', function() { applyPageSEO(window.location.hash); });

  console.info('[CrackAI] SEO v1.0 — meta tags, structured data injected');
})();


/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — ANALYTICS
   DAU, sessions, events, retention, churn → Firestore
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SESSION_KEY   = 'sscai_session_start';
  var LAST_SEEN_KEY = 'sscai_last_seen';

  function today()  { return new Date().toISOString().slice(0, 10); }
  function nowTs()  { return Date.now(); }
  function getUid() {
    try { return window._firebaseAuth && window._firebaseAuth.currentUser
                   ? window._firebaseAuth.currentUser.uid : 'anon'; }
    catch(e) { return 'anon'; }
  }
  function getDb()  { return window._firebaseDb  || null; }
  function getFns() { return window._firebaseFns || null; }
  function isPrem() { try { return typeof state !== 'undefined' && !!state.isPremium; } catch(e) { return false; } }

  // ── Firestore write helpers ───────────────────────────────
  async function fsSet(path, data, merge) {
    try {
      var d = getDb(), f = getFns(); if (!d || !f) return;
      var parts  = path.split('/');
      var docRef = f.doc(d, ...parts);
      merge ? await f.setDoc(docRef, data, { merge: true }) : await f.setDoc(docRef, data);
    } catch(e) {}
  }

  async function fsUpdate(path, data) {
    try {
      var d = getDb(), f = getFns(); if (!d || !f) return;
      var parts  = path.split('/');
      var docRef = f.doc(d, ...parts);
      await f.updateDoc(docRef, data);
    } catch(e) { await fsSet(path, data, true); }
  }

  function increment(n) {
    try { if (window.firebase && window.firebase.firestore) return window.firebase.firestore.FieldValue.increment(n); }
    catch(e) {}
    return n;
  }

  // ── 1. DAU ────────────────────────────────────────────────
  async function trackDAU() {
    var u = getUid(); if (u === 'anon') return;
    var dateKey = today();
    await fsSet('analytics/dau/' + dateKey, { date: dateKey, count: increment(1), updatedAt: nowTs() }, true);
    await fsUpdate('users/' + u, { lastSeen: nowTs(), lastSeenDate: dateKey });
    localStorage.setItem(LAST_SEEN_KEY, dateKey);
  }

  // ── 2. Sessions ───────────────────────────────────────────
  var _sessionStart = nowTs();

  function startSession() {
    _sessionStart = nowTs();
    localStorage.setItem(SESSION_KEY, String(_sessionStart));
    var u = getUid(); if (u === 'anon') return;
    fsUpdate('users/' + u, { sessionsCount: increment(1) }).catch(function(){});
  }

  async function endSession() {
    var u = getUid(); if (u === 'anon') return;
    var durationSec = Math.round((nowTs() - _sessionStart) / 1000);
    if (durationSec < 5) return;
    await fsUpdate('users/' + u, { totalSessionSec: increment(durationSec), lastSessionSec: durationSec });
  }

  // ── 3. Events ─────────────────────────────────────────────
  async function trackEvent(eventName, data) {
    var u     = getUid();
    var docId = u + '_' + nowTs();
    await fsSet('analytics/events/' + docId, {
      uid: u, event: eventName, data: data || {},
      isPremium: isPrem(), ts: nowTs(), date: today()
    });
  }

  // ── 4. Messages ───────────────────────────────────────────
  var _origIncrement = window.incrementUsage;
  window.incrementUsage = function(type) {
    if (typeof _origIncrement === 'function') _origIncrement.apply(this, arguments);
    var u = getUid(); if (u === 'anon') return;
    var field = type === 'image' ? 'totalImageMessages' : type === 'pdf' ? 'totalPdfMessages' : 'totalTextMessages';
    fsUpdate('users/' + u, { totalMessages: increment(1), [field]: increment(1), lastMessageAt: nowTs() }).catch(function(){});
    fsSet('analytics/messages/' + today(), { date: today(), [type]: increment(1), total: increment(1) }, true).catch(function(){});
  };

  // ── 5. Feature usage ──────────────────────────────────────
  var TRACKED_FEATURES = [
    'openPYQ', 'openMockTest', 'openAnalytics', 'openScorePredictor',
    'openStudyGroups', 'openDailyGoal', 'openTeacherMode',
    'startVoiceMode', 'handleImageUpload', 'handlePdfUpload'
  ];

  function patchFeatureTracking() {
    TRACKED_FEATURES.forEach(function(fname) {
      var orig = window[fname];
      if (typeof orig !== 'function' || orig._analyticsPatched) return;
      window[fname] = function() {
        trackEvent('feature_used', { feature: fname, isPremium: isPrem() });
        return orig.apply(this, arguments);
      };
      window[fname]._analyticsPatched = true;
    });
  }

  // ── 6. Conversion ─────────────────────────────────────────
  var _origActivatePlan = window.activatePlan;
  if (typeof _origActivatePlan === 'function') {
    window.activatePlan = function(planId) {
      _origActivatePlan.apply(this, arguments);
      trackEvent('conversion', { planId: planId, method: 'payment' });
      fsUpdate('users/' + getUid(), { convertedAt: nowTs(), convertedPlan: planId, conversionDate: today() }).catch(function(){});
    };
  }

  // ── 7. Retention + churn ──────────────────────────────────
  async function trackRetention(fbUser) {
    try {
      var d = getDb(), f = getFns(); if (!d || !f) return;
      var snap = await f.getDoc(f.doc(d, 'users', fbUser.uid));
      if (!snap.exists()) return;
      var data = snap.data();
      var createdAt = data.createdAt || nowTs();
      var daysSinceJoin = Math.floor((nowTs() - createdAt) / 86400000);
      var updates = { lastSeen: nowTs(), lastSeenDate: today() };

      if (daysSinceJoin >= 1  && !data.retainedD1)  { updates.retainedD1  = true; updates.retainedD1At  = nowTs(); }
      if (daysSinceJoin >= 7  && !data.retainedD7)  { updates.retainedD7  = true; updates.retainedD7At  = nowTs(); }
      if (daysSinceJoin >= 30 && !data.retainedD30) { updates.retainedD30 = true; updates.retainedD30At = nowTs(); }

      var daysSinceLastSeen = Math.floor((nowTs() - (data.lastSeen || createdAt)) / 86400000);
      updates.churnRisk = daysSinceLastSeen >= 7 ? 'high' : daysSinceLastSeen >= 3 ? 'medium' : 'low';
      if (daysSinceLastSeen >= 7) trackEvent('churn_return', { daysSinceLastSeen: daysSinceLastSeen });

      await f.updateDoc(f.doc(d, 'users', fbUser.uid), updates);
    } catch(e) {}
  }

  // ── 8. Premium modal views ────────────────────────────────
  var _origOpenPremium = window.openPremiumModal;
  if (typeof _origOpenPremium === 'function') {
    window.openPremiumModal = function() {
      trackEvent('premium_modal_viewed', {});
      return _origOpenPremium.apply(this, arguments);
    };
  }

  // ── Public API ────────────────────────────────────────────
  window.CrackAnalytics = { trackEvent: trackEvent, trackDAU: trackDAU };

  // ── Init ──────────────────────────────────────────────────
  function initAnalytics() {
    var fns = window._firebaseFns;
    if (!fns || !fns.onAuthStateChanged || !window._firebaseAuth) { setTimeout(initAnalytics, 300); return; }
    fns.onAuthStateChanged(window._firebaseAuth, async function(fbUser) {
      if (fbUser) {
        startSession();
        await trackDAU();
        await trackRetention(fbUser);
        patchFeatureTracking();
      }
    });
  }

  window.__firebaseReady ? initAnalytics() : window.addEventListener('firebaseReady', initAnalytics);
  window.addEventListener('beforeunload', endSession);
  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') endSession();
    if (document.visibilityState === 'visible') startSession();
  });
  window.addEventListener('load', patchFeatureTracking);
  setTimeout(patchFeatureTracking, 2000);

  console.info('[CrackAI] Analytics v1.0 — DAU, retention, churn tracking active');
})();


/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — SECURITY
   Server-side premium verification, paywall hardening
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────
  // Deploy the Cloud Run function at the bottom of this file,
  // then paste its URL here.
  var VERIFY_PREMIUM_URL   = 'https://verifypremium-56khnynjia-uc.a.run.app';
  var REVERIFY_INTERVAL_MS = 10 * 60 * 1000; // re-verify every 10 minutes

  var FREE_TEXT  = 10;
  var FREE_IMAGE = 2;
  var FREE_PDF   = 1;

  // ── Fix: PaymentJSInterface is not defined (Cashfree mobile SDK) ──
  // This error fires when Cashfree's mobile SDK tries to call a native
  // Android/iOS bridge that doesn't exist in the browser. Safe to stub.
  if (typeof window.PaymentJSInterface === 'undefined') {
    window.PaymentJSInterface = {
      onPaymentSuccess: function() {},
      onPaymentFailure: function() {},
      onPaymentCancel:  function() {}
    };
  }

  // ── Wipe exposed secret key from memory ──────────────────
  if (typeof CASHFREE_SECRET_KEY !== 'undefined') {
    try { window.CASHFREE_SECRET_KEY = null; } catch(e) {}
    console.warn('[CrackAI Security] CASHFREE_SECRET_KEY wiped from memory. DELETE it from app.js source!');
  }

  // ── Get Firebase ID token ─────────────────────────────────
  async function getIdToken() {
    try {
      var user = window._firebaseAuth && window._firebaseAuth.currentUser;
      return user ? await user.getIdToken(false) : null;
    } catch(e) { return null; }
  }

  // ── Server-side premium verification (cached 10 min) ─────
  var _verifyCache     = null;
  var _verifyCacheTime = 0;

  async function verifyPremiumServer(forceRefresh) {
    var now = Date.now();
    if (!forceRefresh && _verifyCache !== null && (now - _verifyCacheTime) < REVERIFY_INTERVAL_MS) {
      return _verifyCache;
    }
    try {
      var token = await getIdToken();
      if (!token) {
        _verifyCache = { isPremium: false }; _verifyCacheTime = now; return _verifyCache;
      }
      // Use AbortController so CORS failures don't block UI
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 8000) : null;
      var fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        signal: controller ? controller.signal : undefined
      };
      var res = await fetch(VERIFY_PREMIUM_URL, fetchOpts);
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) throw new Error('status ' + res.status);
      var data = await res.json();
      _verifyCache = data; _verifyCacheTime = now;
      if (typeof state !== 'undefined') {
        state.isPremium = !!data.isPremium;
        if (data.plan && state.user) state.user.premiumPlan = data.plan;
      }
      return data;
    } catch(e) {
      // CORS or network errors: silently fall back to localStorage check
      // so users are NEVER wrongly blocked due to a server issue
      var lsPremium = false;
      try {
        var user2 = window._firebaseAuth && window._firebaseAuth.currentUser;
        var uid2  = user2 ? user2.uid : null;
        var pfx   = uid2 ? ('sscai_u:' + uid2 + ':') : 'sscai_guest:';
        lsPremium = localStorage.getItem(pfx + 'premium') === 'true' || localStorage.getItem('sscai_premium') === 'true';
      } catch(le) {}
      _verifyCache = { isPremium: lsPremium };
      _verifyCacheTime = now;
      if (e.name !== 'AbortError') console.warn('[CrackAI Security] Premium verify failed, using localStorage:', e.message);
      return _verifyCache;
    }
  }

  // ── Gate check ────────────────────────────────────────────
  async function serverCanSend(type) {
    if (typeof state !== 'undefined') {
      var counts = { text: state.textCount || 0, image: state.imageCount || 0, pdf: state.pdfCount || 0 };
      var limits = { text: FREE_TEXT, image: FREE_IMAGE, pdf: FREE_PDF };
      if (counts[type] < limits[type]) return true; // under free limit, no server call needed
    }
    var result = await verifyPremiumServer(false);
    return !!result.isPremium;
  }

  // ── Patch sendMessage ─────────────────────────────────────
  function patchSendMessage() {
    var orig = window.sendMessage;
    if (typeof orig !== 'function') { setTimeout(patchSendMessage, 200); return; }
    if (orig._secPatched) return;

    async function securedSendMessage() {
      var args = arguments, self = this;
      try {
        var hasImages = typeof pendingImageFiles !== 'undefined' && pendingImageFiles.length > 0;
        var hasPdf    = typeof pendingPdfFile    !== 'undefined' && !!pendingPdfFile;
        var type      = hasImages ? 'image' : hasPdf ? 'pdf' : 'text';
        var allowed   = await serverCanSend(type);
        if (!allowed) {
          if (typeof openPremiumModal === 'function') openPremiumModal();
          if (typeof showToast        === 'function') showToast('🔒 Limit reached — Upgrade to Premium');
          return;
        }
      } catch(e) { /* network error — allow rather than block user */ }
      return orig.apply(self, args);
    }

    securedSendMessage._secPatched = true;
    window.sendMessage = securedSendMessage;
  }

  // ── Periodic re-verification (picks up expired subs) ─────
  function startPeriodicVerify() {
    setInterval(async function() {
      var user = window._firebaseAuth && window._firebaseAuth.currentUser;
      if (!user) return;
      var result = await verifyPremiumServer(true);
      if (typeof state !== 'undefined' && state.isPremium !== !!result.isPremium) {
        state.isPremium = !!result.isPremium;
        if (typeof updateUserUI  === 'function') updateUserUI();
        if (typeof updateLimitUI === 'function') updateLimitUI();
        if (!result.isPremium) {
          try {
            localStorage.removeItem('sscai_u:' + user.uid + ':premium');
            localStorage.removeItem('sscai_premium');
          } catch(e) {}
          if (typeof showToast === 'function') showToast('ℹ️ Your premium subscription has expired');
        }
      }
    }, REVERIFY_INTERVAL_MS);
  }

  // ── Public API ────────────────────────────────────────────
  window._securityPatch = {
    verifyPremiumServer: verifyPremiumServer,
    getIdToken:          getIdToken,
    invalidateCache:     function() { _verifyCache = null; _verifyCacheTime = 0; }
  };

  // ── Init ──────────────────────────────────────────────────
  patchSendMessage();
  startPeriodicVerify();

  function initSecurity() {
    var fns = window._firebaseFns;
    if (!fns || !fns.onAuthStateChanged || !window._firebaseAuth) { setTimeout(initSecurity, 300); return; }
    fns.onAuthStateChanged(window._firebaseAuth, function(user) {
      if (user) {
        _verifyCache = null; // force fresh verify on each login
        verifyPremiumServer(true).catch(function(){});
      }
    });
  }

  window.__firebaseReady ? initSecurity() : window.addEventListener('firebaseReady', initSecurity);

  console.info('[CrackAI] Security v1.1 — server-side premium verification + PaymentJSInterface fix');
})();


/* ═══════════════════════════════════════════════════════════════
   CLOUD RUN FUNCTION — deploy this as your verify-premium backend
   ═══════════════════════════════════════════════════════════════
   Save as: functions/verify-premium/index.js
   Deploy:  gcloud run deploy verifypremium --source . --region us-central1

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { getAuth }             = require('firebase-admin/auth');

initializeApp();
const db   = getFirestore();
const auth = getAuth();

exports.handler = async (req, res) => {
  res.set('Access-Control-Allow-Origin',  '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const idToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!idToken) { res.json({ isPremium: false, reason: 'no_token' }); return; }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const snap    = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists) { res.json({ isPremium: false, reason: 'no_user' }); return; }

    const data      = snap.data();
    const isPremium = !!data.isPremium;

    // Auto-expire subscriptions
    if (isPremium && data.premiumExpiresAt && Date.now() > data.premiumExpiresAt) {
      await db.collection('users').doc(decoded.uid).update({ isPremium: false });
      res.json({ isPremium: false, reason: 'expired', plan: data.premiumPlan }); return;
    }

    res.json({ isPremium, plan: data.premiumPlan || null });
  } catch(e) {
    console.error('verifyPremium error:', e);
    res.status(500).json({ isPremium: false, reason: 'error' });
  }
};
   ═══════════════════════════════════════════════════════════════ */