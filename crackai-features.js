/**
 * crackai-features.js — CrackAI Feature Engine v2.0
 * ═══════════════════════════════════════════════════════════════════
 *  CHANGES v2.0:
 *  - Invite button in referral modal (WhatsApp + copy link)
 *  - Features section moved INTO sidebar (scrollable), removed from homepage
 *  - messageLimitInfo hidden on homepage
 *  - Mock test questions fetched from DeepSeek API
 *  - Exam expansion includes all classes (6–12) as selectable topics
 *  - PYQ questions fetched from DeepSeek API + cached locally
 *  - Group study opens in full screen
 *  - No message count shown on home page
 * ═══════════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
   * SECTION 0 — UTILITIES
   * ───────────────────────────────────────────────────────────── */
  const DS_URL = 'https://deepseek-56khnynjia-uc.a.run.app';

  function uid()   { return global._firebaseAuth?.currentUser?.uid || 'guest'; }
  function _p()    { return 'sscai_u:' + uid() + ':'; }
  function lsGet(k, def) { try { return JSON.parse(localStorage.getItem(_p()+k) || def || 'null'); } catch { return null; } }
  function lsSet(k, v)   { try { localStorage.setItem(_p()+k, JSON.stringify(v)); } catch {} }
  function toast(msg, ms) { if (typeof showToast === 'function') showToast(msg, ms||2800); }

  /* Reliably get the current user's display name from all possible sources */
  function getMyName() {
    // 1. Firebase currentUser (most authoritative — from Google login)
    try {
      const cu = global._firebaseAuth?.currentUser;
      if (cu && cu.displayName) return cu.displayName;
    } catch(e) {}
    // 2. app.js in-memory state (state.user.name set on login)
    try {
      if (typeof state !== 'undefined' && state.user) {
        return state.user.displayName || state.user.name || null;
      }
    } catch(e) {}
    // 3. localStorage fallback (state saved on previous session)
    try {
      const myUid = uid();
      if (myUid !== 'guest') {
        const saved = JSON.parse(localStorage.getItem('sscai_u:' + myUid + ':user') || 'null');
        if (saved && (saved.displayName || saved.name)) return saved.displayName || saved.name;
      }
    } catch(e) {}
    return 'Student';
  }
  function isPrem()  { try { return localStorage.getItem(_p()+'premium')==='true' || localStorage.getItem('sscai_premium')==='true'; } catch { return false; } }
  function needsPremium(feature) {
    if (isPrem()) return false;
    toast('🔒 '+feature+' requires Premium ₹199/mo');
    if (typeof openPremiumModal === 'function') openPremiumModal();
    return true;
  }

  function isRefToolsUnlocked() {
    try { return lsGet('ref_tools_unlocked', 'false') === true || lsGet('ref_tools_unlocked', 'false') === 'true'; } catch { return false; }
  }
  function canUsePYQMock() { return isPrem() || isRefToolsUnlocked(); }



  /* Generic full-screen modal factory */
  function createModal(id, title, contentHTML, opts = {}) {
    if (document.getElementById(id)) return;
    const m = document.createElement('div');
    m.id = id;
    m.className = 'cf-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', title);
    m.innerHTML = `
      <div class="cf-modal-box ${opts.wide ? 'cf-modal-wide' : ''}">
        <div class="cf-modal-hdr">
          <span class="cf-modal-title">${title}</span>
          <button class="cf-modal-close" onclick="CF.closeModal('${id}')" aria-label="Close">✕</button>
        </div>
        <div class="cf-modal-body" id="${id}_body">${contentHTML}</div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) CF.closeModal(id); });
  }

  /* Fullscreen modal factory — covers 100vw/100vh */
  function createFullscreenModal(id, title, contentHTML) {
    if (document.getElementById(id)) return;
    const m = document.createElement('div');
    m.id = id;
    m.className = 'cf-modal cf-modal-fullscreen';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', title);
    m.innerHTML = `
      <div class="cf-modal-box cf-modal-fs-box">
        <div class="cf-modal-hdr">
          <span class="cf-modal-title">${title}</span>
          <button class="cf-modal-close" onclick="CF.closeModal('${id}')" aria-label="Close">✕</button>
        </div>
        <div class="cf-modal-body" id="${id}_body">${contentHTML}</div>
      </div>`;
    document.body.appendChild(m);
  }

  /* ─────────────────────────────────────────────────────────────
   * SECTION 1 — EXAM & CLASS CONFIGS
   * ───────────────────────────────────────────────────────────── */
  const EXAM_CONFIGS = {
    cgl:    { label:'SSC CGL',      color:'#f59e0b', years:[2024,2023,2022,2021,2020], type:'exam' },
    chsl:   { label:'SSC CHSL',     color:'#6C63FF', years:[2024,2023,2022,2021],      type:'exam' },
    upsc:   { label:'UPSC',         color:'#10b981', years:[2024,2023,2022],            type:'exam' },
    rrb:    { label:'RRB NTPC',     color:'#38bdf8', years:[2024,2023,2022],            type:'exam' },
    ibps:   { label:'IBPS PO',      color:'#a78bfa', years:[2024,2023],                type:'exam' },
    cuet:   { label:'CUET',         color:'#FF6B9D', years:[2024,2023],                type:'exam' },
    cds:    { label:'CDS',          color:'#fb923c', years:[2024,2023],                type:'exam' },
    nda:    { label:'NDA',          color:'#34d399', years:[2024,2023],                type:'exam' },
    // School Classes
    class6:  { label:'Class 6',     color:'#60a5fa', subjects:['Maths','Science','English','Social Science','Hindi'], type:'class' },
    class7:  { label:'Class 7',     color:'#818cf8', subjects:['Maths','Science','English','Social Science','Hindi'], type:'class' },
    class8:  { label:'Class 8',     color:'#c084fc', subjects:['Maths','Science','English','Social Science','Hindi'], type:'class' },
    class9:  { label:'Class 9',     color:'#f472b6', subjects:['Maths','Science','English','Social Science','Hindi'], type:'class' },
    class10: { label:'Class 10',    color:'#fb7185', subjects:['Maths','Science','English','Social Science','Hindi'], type:'class' },
    class11: { label:'Class 11',    color:'#fbbf24', subjects:['Physics','Chemistry','Maths','Biology','English','Economics','Accountancy'], type:'class' },
    class12: { label:'Class 12',    color:'#4ade80', subjects:['Physics','Chemistry','Maths','Biology','English','Economics','Accountancy'], type:'class' },
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 2 — DEEPSEEK AI HELPERS
   * ───────────────────────────────────────────────────────────── */
  async function callDeepSeek(prompt, maxTokens = 800) {
    const res = await fetch(DS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
        model: 'deepseek-chat',
        mode: 'cgl',
        lang: 'hinglish'
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || null;
  }

  /* ── Robust JSON array extractor (handles truncated AI output) ── */
  function extractJsonArray(text) {
    if (!text) return null;
    let s = text.replace(/```json|```/gi, '').trim();
    try { const r = JSON.parse(s); if (Array.isArray(r) && r.length) return r; } catch {}
    const start = s.indexOf('[');
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end !== -1) {
      try { const r = JSON.parse(s.slice(start, end + 1)); if (Array.isArray(r) && r.length) return r; } catch {}
    }
    return null;
  }

  /* Single DeepSeek call with small token budget */
  async function fetchSmallBatch(prompt, maxTokens) {
    try { return extractJsonArray(await callDeepSeek(prompt, maxTokens || 700)) || []; } catch { return []; }
  }

  /* Fetch PYQ questions — 5 Qs, single fast call, cached */
  async function fetchQuestionsFromAI(exam, year, count) {
    count = count || 5;
    const cacheKey = 'pyq_cache_' + exam + '_' + year;
    const cached = lsGet(cacheKey, 'null');
    if (cached && Array.isArray(cached) && cached.length >= count) return cached;
    const conf = EXAM_CONFIGS[exam];
    const context = conf && conf.type === 'class' ? ('Class ' + exam.replace('class','') + ' NCERT') : ((conf ? conf.label : exam) + ' ' + year);
    const prompt = 'Generate exactly ' + count + ' MCQs for ' + context + '. Return ONLY a JSON array, no markdown.\n[{"q":"...","opts":["A","B","C","D"],"ans":0,"topic":"...","exp":"..."}]';
    const qs = await fetchSmallBatch(prompt, 800);
    if (qs.length) { lsSet(cacheKey, qs); return qs; }
    return null;
  }

  /* Fetch mock test questions — 4 parallel calls of 10 each = 40 Qs fast */
  async function fetchMockQuestionsFromAI(exam, count) {
    count = count || 40;
    const cacheKey = 'mock_cache_' + exam + '_' + new Date().toDateString().replace(/ /g,'_');
    const cached = lsGet(cacheKey, 'null');
    if (cached && Array.isArray(cached) && cached.length >= Math.min(count, 20)) return cached;
    const conf = EXAM_CONFIGS[exam];
    const label = conf ? conf.label : exam;
    const PER = 10;
    const sections = ['Quantitative Aptitude','English Language','General Awareness','Reasoning Ability'].slice(0, Math.ceil(count / PER));
    const results = await Promise.all(sections.map(function(sec) {
      const p = 'Generate exactly ' + PER + ' MCQs for ' + label + ' mock test, topic: ' + sec + '. Return ONLY a JSON array, no markdown.\n[{"q":"...","opts":["A","B","C","D"],"ans":0,"topic":"' + sec + '","exp":"..."}]';
      return fetchSmallBatch(p, 900);
    }));
    const allQs = [].concat.apply([], results).slice(0, count);
    if (allQs.length) { lsSet(cacheKey, allQs); return allQs; }
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
   * SECTION 3 — XP & GAMIFICATION ENGINE
   * ───────────────────────────────────────────────────────────── */
  const XP = {
    get() { return lsGet('xp', '0') || 0; },
    add(n) {
      const cur = this.get();
      lsSet('xp', cur + n);
      this._showGain(n);
      return cur + n;
    },
    level() { return Math.floor(Math.sqrt(this.get() / 50)) + 1; },
    _showGain(n) {
      const el = document.createElement('div');
      el.textContent = '+' + n + ' XP';
      el.style.cssText='position:fixed;bottom:130px;right:20px;background:linear-gradient(135deg,#f59e0b,#FF6B9D);color:#fff;font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;z-index:99990;animation:xpPop 1.5s ease forwards;pointer-events:none;';
      if (!document.getElementById('xpPopStyle')) {
        const s = document.createElement('style');
        s.id = 'xpPopStyle';
        s.textContent = '@keyframes xpPop{0%{opacity:0;transform:translateY(0) scale(0.8)}20%{opacity:1;transform:translateY(-10px) scale(1.1)}80%{opacity:1;transform:translateY(-20px) scale(1)}100%{opacity:0;transform:translateY(-35px) scale(0.9)}}';
        document.head.appendChild(s);
      }
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 4 — WEAK TOPIC TRACKER
   * ───────────────────────────────────────────────────────────── */
  const WeakTopics = {
    _key: 'weak_topics',
    get()  { return lsGet(this._key, '{}') || {}; },
    record(topic, correct) {
      const data = this.get();
      if (!data[topic]) data[topic] = { attempts:0, correct:0 };
      data[topic].attempts++;
      if (correct) data[topic].correct++;
      lsSet(this._key, data);
    },
    getSorted() {
      const data = this.get();
      return Object.entries(data)
        .map(([t, d]) => ({ topic:t, accuracy: d.attempts ? Math.round(d.correct/d.attempts*100) : 0, attempts: d.attempts }))
        .sort((a,b) => a.accuracy - b.accuracy);
    },
    getWeakest(n=3) { return this.getSorted().filter(t=>t.attempts>=2).slice(0,n); }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 5 — DAILY GOAL SYSTEM
   * ───────────────────────────────────────────────────────────── */
  const DailyGoal = {
    GOAL: 10,
    todayKey() { return 'daily_' + new Date().toDateString().replace(/ /g,'_'); },
    getTodayCount() { return lsGet(this.todayKey(), '0') || 0; },
    increment() {
      const k = this.todayKey();
      const n = (lsGet(k,'0')||0) + 1;
      lsSet(k, n);
      if (n === this.GOAL) { toast('🎯 Daily goal reached! +50 XP 🔥', 3500); confetti(); XP.add(50); }
      else if (n < this.GOAL) { XP.add(5); }
      this.updateBadge();
      return n;
    },
    updateBadge() {
      const n = this.getTodayCount();
      const el = document.getElementById('cf-daily-badge');
      if (el) el.textContent = n + '/' + this.GOAL;
      const bar = document.getElementById('cf-goal-bar');
      if (bar) bar.style.width = Math.min(100, n/this.GOAL*100) + '%';
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 6 — SCORE PREDICTOR
   * ───────────────────────────────────────────────────────────── */
  const ScorePredictor = {
    CUTOFFS: {
      cgl:  { tier1:{ gen:160, obc:152, sc:142, st:130 }, tier2:{ gen:720, obc:680, sc:620, st:590 } },
      chsl: { ldc:{ gen:175, obc:164, sc:151, st:141 }, jsa:{ gen:177, obc:166, sc:156, st:145 } },
      rrb:  { gen:80, obc:75, sc:68, st:62 },
      ibps: { gen:60, obc:55, sc:50, st:48 },
    },
    predict(exam, score, maxScore, category='gen') {
      const co = this.CUTOFFS[exam];
      if (!co) return null;
      const examCo = co.tier1 || co.ldc || co;
      const cutoff = examCo[category] || examCo.gen || 150;
      const pct = (score / maxScore) * 100;
      const rank = Math.max(1, Math.round((1 - pct/100) * 850000));
      return { score, pct: pct.toFixed(1), rank, cutoff, safe: score >= cutoff, gap: Math.abs(score - cutoff) };
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 7 — REFERRAL SYSTEM
   * ───────────────────────────────────────────────────────────── */
  const Referral = {
    REWARD_DAYS: 7,
    REFS_NEEDED: 3,

    getCode() {
      let code = lsGet('ref_code', 'null');
      if (!code) {
        const base = uid().replace(/[^a-z0-9]/gi,'').substring(0,6).toUpperCase() || Math.random().toString(36).substring(2,8).toUpperCase();
        code = 'CRACK' + base;
        lsSet('ref_code', code);
      }
      return code;
    },

    getReferralCount() { return lsGet('ref_count', '0') || 0; },

    /* Apply a referral code — writes to Firestore for real server-side credit */
    async applyReferral(code) {
      code = (code||'').trim().toUpperCase();
      if (!code || code.length < 5) { toast('⚠️ Enter a valid referral code.'); return; }
      if (lsGet('ref_used', 'null')) { toast('⚠️ You already used a referral code.'); return; }
      const myCode = this.getCode();
      if (code === myCode) { toast('⚠️ You cannot use your own code!'); return; }
      const myUid = uid();
      if (myUid === 'guest') { toast('⚠️ Please login first!'); return; }

      const btn = document.getElementById('cf-ref-apply-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Applying…'; }

      try {
        const db = window._firebaseDb;
        const fns = window._firebaseFns;
        if (!db || !fns) throw new Error('Firebase not ready');
        const { doc, getDoc, updateDoc, setDoc, arrayUnion, collection, query, where, getDocs } = fns;

        // Find referrer by code
        const q = query(collection(db, 'users'), where('referralCode', '==', code));
        const snap = await getDocs(q);
        if (snap.empty) {
          toast('❌ Referral code not found. Double-check and try again.');
          if (btn) { btn.disabled = false; btn.textContent = 'Apply Code'; }
          return;
        }

        const referrerDoc = snap.docs[0];
        const referrerUid = referrerDoc.id;
        const referrerData = referrerDoc.data();

        // Prevent using same person's code twice
        const alreadyReferred = (referrerData.referredUsers||[]).includes(myUid);
        if (alreadyReferred) { toast('⚠️ You already used this person\'s code.'); if (btn) { btn.disabled = false; btn.textContent = 'Apply Code'; } return; }

        // Save usage on current user's doc
        const myName = getMyName();
        await setDoc(doc(db, 'users', myUid), {
          referredBy: referrerUid, referredByCode: code,
          name: myName, uid: myUid, updatedAt: Date.now()
        }, { merge: true });

        // Increment referrer count
        const newCount = (referrerData.referralCount || 0) + 1;
        const unlockTools = newCount >= this.REFS_NEEDED;
        await updateDoc(doc(db, 'users', referrerUid), {
          referralCount: newCount,
          referredUsers: arrayUnion(myUid),
          ...(unlockTools ? { refToolsUnlocked: true } : {})
        });

        lsSet('ref_used', code);
        toast('✅ Referral code applied! Your friend gets credit. Welcome! 🎉', 4000);
        CF._renderReferral();
      } catch(e) {
        console.error('[Referral]', e);
        toast('❌ Could not apply code. Try again shortly.');
        if (btn) { btn.disabled = false; btn.textContent = 'Apply Code'; }
      }
    },

    /* Register this user's referral code in Firestore on login */
    async registerMyCode() {
      const myUid = uid();
      if (myUid === 'guest') return;
      const code = this.getCode();
      try {
        const db = window._firebaseDb;
        const fns = window._firebaseFns;
        if (!db || !fns) return;
        const { doc, setDoc } = fns;
        const myName = getMyName();
        await setDoc(doc(db, 'users', myUid), {
          referralCode: code, name: myName, uid: myUid, updatedAt: Date.now()
        }, { merge: true });
      } catch(e) {}
    },

    /* Sync referral count from Firestore */
    async syncCount() {
      const myUid = uid();
      if (myUid === 'guest') return 0;
      try {
        const db = window._firebaseDb;
        const fns = window._firebaseFns;
        if (!db || !fns) return 0;
        const { doc, getDoc } = fns;
        const snap = await getDoc(doc(db, 'users', myUid));
        if (!snap.exists()) return 0;
        const data = snap.data();
        const count = data.referralCount || 0;
        lsSet('ref_count', count);
        if (data.refToolsUnlocked) lsSet('ref_tools_unlocked', true);
        return count;
      } catch(e) { return 0; }
    },

    registerReferral() {
      const n = (lsGet('ref_count','0')||0) + 1;
      lsSet('ref_count', n);
      if (n >= this.REFS_NEEDED) {
        lsSet('ref_tools_unlocked', true);
        toast('🎉 3 referrals complete! PYQ Bank & Mock Test unlocked! 🏆', 4000);
        if (typeof _doConfetti === 'function') _doConfetti();
      } else {
        toast('👥 Referral registered! ' + n + '/' + this.REFS_NEEDED + ' done.', 3000);
      }
    },

    getShareText() {
      return 'Join CrackAI — India\'s smartest exam prep app! Use my code ' + this.getCode() + ' to get bonus access 🚀\nhttps://easyfreepdf.online/?ref=' + this.getCode();
    },
    getShareUrl() { return 'https://easyfreepdf.online/?ref=' + this.getCode(); },
    inviteViaWhatsApp() {
      window.open('https://wa.me/?text=' + encodeURIComponent(this.getShareText()), '_blank');
    },
    copyInviteLink() {
      const url = this.getShareUrl();
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(url).then(() => toast('📋 Invite link copied!')).catch(() => _fallbackCopy(url));
        } else { _fallbackCopy(url); }
      } catch(e) { toast('⚠️ Copy manually: ' + url, 4000); }
    }
  };

  function _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); ta.remove();
    toast('📋 Invite link copied!');
  }

  // Auto-register referral code & sync count after login
  window.addEventListener('firebaseReady', () => {
    setTimeout(() => {
      if (uid() !== 'guest') {
        Referral.registerMyCode();
        Referral.syncCount();
        // Auto-apply pending ref code from URL
        const pending = lsGet('ref_pending_code', 'null');
        if (pending && !lsGet('ref_used', 'null')) {
          setTimeout(() => Referral.applyReferral(pending), 1500);
          lsSet('ref_pending_code', null);
        }
      }
    }, 2500);
  });

  // Capture ?ref= from URL on page load
  (function() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      if (refCode && refCode.length >= 5) lsSet('ref_pending_code', refCode.toUpperCase());
    } catch(e) {}
  })();

  /* ─────────────────────────────────────────────────────────────
   * SECTION 8 — ANALYTICS ENGINE
   * ───────────────────────────────────────────────────────────── */
  const Analytics = {
    _key: 'analytics_log',
    get() { return lsGet(this._key, '[]') || []; },
    record(event) {
      const log = this.get();
      log.push({ ...event, ts: Date.now(), date: new Date().toDateString() });
      if (log.length > 500) log.splice(0, log.length - 500);
      lsSet(this._key, log);
    },
    getTopicAccuracy() {
      return WeakTopics.getSorted().map(t => ({ ...t, label: t.topic }));
    },
    getWeeklyTrend() {
      const log = this.get();
      const days = {};
      for (let i=6; i>=0; i--) {
        const d = new Date(Date.now() - i*86400000).toDateString();
        days[d] = { correct:0, total:0 };
      }
      log.forEach(e => {
        if (e.type==='answer' && days[e.date] !== undefined) {
          days[e.date].total++;
          if (e.correct) days[e.date].correct++;
        }
      });
      return Object.entries(days).map(([d,v]) => ({
        label: d.split(' ')[0],
        accuracy: v.total ? Math.round(v.correct/v.total*100) : 0,
        total: v.total
      }));
    },
    getAvgTimePerQ() {
      const log = this.get().filter(e=>e.type==='answer'&&e.timeTaken);
      if (!log.length) return 0;
      return Math.round(log.reduce((s,e)=>s+e.timeTaken,0)/log.length);
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 9 — STUDY GROUPS (Full Screen) + BATTLE QUIZ ENGINE
   * ───────────────────────────────────────────────────────────── */
const StudyGroups = {
  async create(name, exam) {
    const db = window._firebaseDb;
    const { doc, setDoc, collection } = window._firebaseFns;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const id = 'grp_' + Date.now();
    const myUid = uid();
    const myName = getMyName();
    const group = {
      id, name, exam, code,
      adminUid: myUid,
      members: [myUid],
      memberNames: { [myUid]: myName },
      messages: [],
      quiz: null, // active quiz state
      createdAt: Date.now()
    };
    await setDoc(doc(collection(db, 'studyGroups'), id), group);
    toast('✅ Group "' + name + '" created! Code: ' + code, 4000);
    return group;
  },
  async join(code) {
    const db = window._firebaseDb;
    const { collection, query, where, getDocs, updateDoc, arrayUnion, doc } = window._firebaseFns;
    const q = query(collection(db, 'studyGroups'), where('code', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) { toast('❌ Group not found. Check the code.'); return null; }
    const docRef = snap.docs[0].ref;
    const group = snap.docs[0].data();
    const myUid = uid();
    const myName = getMyName();
    await updateDoc(docRef, {
      members: arrayUnion(myUid),
      ['memberNames.' + myUid]: myName
    });
    toast('✅ Joined "' + group.name + '"!', 3000);
    return { ...group, id: snap.docs[0].id };
  },
  async getAll() {
    const db = window._firebaseDb;
    const { collection, query, where, getDocs } = window._firebaseFns;
    const q = query(collection(db, 'studyGroups'), where('members', 'array-contains', uid()));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  },
  async addMessage(groupId, text) {
    const db = window._firebaseDb;
    const { doc, updateDoc, arrayUnion } = window._firebaseFns;
    const myUid = uid();
    const myName = getMyName();
    const msg = { uid: myUid, name: myName, text, ts: Date.now() };
    // Also update memberNames so all members always see real Google names
    await updateDoc(doc(db, 'studyGroups', groupId), {
      messages: arrayUnion(msg),
      ['memberNames.' + myUid]: myName
    });
  },
  /* ── Start a quiz battle (admin only) ────────────────────── */
  async startQuiz(groupId, type, exam) {
    toast('🤖 Generating questions with AI...', 3000);
    let questions;
    try {
      questions = await _generateQuizQuestions(exam, 10, type);
    } catch(e) { toast('❌ Could not generate questions. Check connection.'); return; }
    if (!questions || !questions.length) { toast('❌ AI returned no questions. Try again.'); return; }
    const db = window._firebaseDb;
    const { doc, updateDoc } = window._firebaseFns;
    const quiz = {
      type,               // 'pyq' | 'mock'
      exam,
      questions,
      current: 0,         // current question index
      status: 'active',   // 'active' | 'finished'
      answers: {},        // { qIdx: { uid, name, correct, ts } }
      xp: {},             // { uid: totalXP }
      startedAt: Date.now(),
      startedBy: uid()
    };
    await updateDoc(doc(db, 'studyGroups', groupId), { quiz });
    toast('🎯 Quiz started! All members can see the question now!', 3000);
  },
  /* ── Submit an answer in quiz battle ────────────────────── */
  async submitAnswer(groupId, quiz, qIdx, chosenIdx) {
    if (!quiz || quiz.status !== 'active') return;
    if (quiz.answers && quiz.answers[qIdx]) return; // already answered by someone
    const db = window._firebaseDb;
    const { doc, updateDoc } = window._firebaseFns;
    const myUid = uid();
    const myName = getMyName();
    const q = quiz.questions[qIdx];
    const correct = (chosenIdx === q.ans);
    const xpEarned = correct ? 10 : 0;
    const currentXP = (quiz.xp && quiz.xp[myUid]) || 0;
    const nextIdx = qIdx + 1;
    const isLast = nextIdx >= quiz.questions.length;
    const updates = {
      ['quiz.answers.' + qIdx]: { uid: myUid, name: myName, chosen: chosenIdx, correct, ts: Date.now() },
      ['quiz.xp.' + myUid]: currentXP + xpEarned,
      ['quiz.current']: isLast ? qIdx : nextIdx,
      ['quiz.status']: isLast ? 'finished' : 'active',
    };
    await updateDoc(doc(db, 'studyGroups', groupId), updates);
    // XP and toast are handled by the optimistic UI in _submitQuizAnswer
  }
};

/* Fetch quiz questions — shared helper */
async function _generateQuizQuestions(exam, count, type) {
  count = count || 10;
  const conf = EXAM_CONFIGS[exam];
  const label = conf ? conf.label : exam;
  const context = conf && conf.type === 'class' ? ('Class ' + exam.replace('class','') + ' NCERT') : label;
  const typeLabel = type === 'pyq' ? 'Previous Year Questions (PYQ)' : 'Mock Test';
  const prompt = 'Generate exactly ' + count + ' MCQs for ' + context + ' ' + typeLabel + '. Return ONLY a valid JSON array, no markdown, no explanation.\n[{"q":"question text","opts":["A text","B text","C text","D text"],"ans":0,"topic":"Topic Name","exp":"Brief explanation"}]\nans is 0-based index of correct option.';
  const raw = await callDeepSeek(prompt, 1400);
  return extractJsonArray(raw) || [];
}

  /* ─────────────────────────────────────────────────────────────
   * SECTION 10 — MOCK TEST ENGINE (DeepSeek-powered)
   * ───────────────────────────────────────────────────────────── */
  const MockTest = {
    _state: null,
    async loadQuestions(exam, count) {
      // Try AI-generated questions first
      const aiQs = await fetchMockQuestionsFromAI(exam, count);
      if (aiQs && aiQs.length > 0) return aiQs;
      // Fallback: generate basic questions locally
      return Array.from({length: count}, (_, i) => ({
        q: `Loading question ${i+1}... (check your connection)`,
        opts: ['Option A', 'Option B', 'Option C', 'Option D'],
        ans: 0, topic: 'General', exp: 'Please retry.'
      }));
    },
    async start(exam, count=40) {
      this._state = {
        exam, questions: [],
        current: 0, answers: {}, startTime: Date.now(),
        timeLimit: count * 72 * 1000,
        qStartTime: Date.now(),
        loading: true
      };
      CF.openMockTest();
      CF._renderMockLoading();
      const qs = await this.loadQuestions(exam, count);
      this._state.questions = qs;
      this._state.loading = false;
      CF._renderMockQuestion();
    },
    answer(qi, ai) {
      if (!this._state) return;
      const timeTaken = Math.round((Date.now() - this._state.qStartTime) / 1000);
      this._state.answers[qi] = { chosen: ai, timeTaken };
      const q = this._state.questions[qi];
      const correct = ai === q.ans;
      WeakTopics.record(q.topic, correct);
      Analytics.record({ type:'answer', topic:q.topic, correct, timeTaken });
      DailyGoal.increment();
    },
    getResults() {
      if (!this._state) return null;
      const qs = this._state.questions;
      let correct=0, wrong=0, skipped=0;
      qs.forEach((q,i) => {
        const a = this._state.answers[i];
        if (!a) skipped++;
        else if (a.chosen === q.ans) correct++;
        else wrong++;
      });
      const rawScore = correct * 2 - wrong * 0.5;
      const timeTaken = Math.round((Date.now()-this._state.startTime)/1000);
      return { correct, wrong, skipped, total:qs.length, rawScore, timeTaken,
        prediction: ScorePredictor.predict(this._state.exam, rawScore, qs.length*2) };
    },
    async getAIReview(results) {
      try {
        const weak = WeakTopics.getWeakest(3).map(t=>t.topic).join(', ');
        const prompt = `Student completed a mock test. Results: ${results.correct}/${results.total} correct, ${results.wrong} wrong, score=${results.rawScore.toFixed(1)}. Weakest topics: ${weak||'N/A'}. Time taken: ${Math.floor(results.timeTaken/60)} min. Provide a 5-line Hinglish improvement plan with specific tips. Be encouraging.`;
        const text = await callDeepSeek(prompt, 400);
        return text || 'Great effort! Keep practicing daily.';
      } catch { return 'Bahut acha kiya! Weak topics pe focus karo aur daily 10 questions practice karo. 💪'; }
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 11 — GLOBAL CF OBJECT (Public API)
   * ───────────────────────────────────────────────────────────── */
  const CF = global.CF = {
    openModal(id) {
      document.getElementById(id)?.classList.add('cf-active');
      document.body.style.overflow = 'hidden';
    },
    closeModal(id) {
      document.getElementById(id)?.classList.remove('cf-active');
      if (id === 'cf-groups-modal') CF._stopChatPolling();
      const others = document.querySelectorAll('.cf-modal.cf-active');
      if (!others.length) document.body.style.overflow = '';
    },
    openPYQ() {
      if (!canUsePYQMock()) { toast('🔒 PYQ Bank requires Premium or 3 referrals ₹199/mo'); if (typeof openPremiumModal==='function') openPremiumModal(); return; }
      CF.openModal('cf-pyq-modal'); CF._renderPYQHome();
    },
    openMockTest() {
      if (!canUsePYQMock()) { toast('🔒 Mock Test requires Premium or 3 referrals ₹199/mo'); if (typeof openPremiumModal==='function') openPremiumModal(); return; }
      CF.openModal('cf-mock-modal'); CF._renderMockTest();
    },
    openAnalytics() {
      if (needsPremium('Analytics')) return;
      CF.openModal('cf-analytics-modal'); CF._renderAnalytics();
    },
    openStudyGroups() {
      CF.openModal('cf-groups-modal'); CF._renderGroups();
    },
    openReferral() { CF.openModal('cf-referral-modal'); CF._renderReferral(); },
    openDailyGoal() { CF.openModal('cf-daily-modal'); CF._renderDailyGoal(); },
    openScorePredictor() { /* FREE for all users — no premium gate */ CF.openModal('cf-score-modal'); CF._renderScorePredictor(); },
    openExamExpansion() {
      if (needsPremium('Exam & Classes')) return;
      CF.openModal('cf-exam-modal'); CF._renderExamExpansion();
    },

    toast(msg) { toast(msg); },

    /* ── PYQ RENDERING ── */
    _pyqState: { exam:null, year:null },
    _renderPYQHome() {
      const body = document.getElementById('cf-pyq-modal_body');
      if (!body) return;
      const exams = Object.entries(EXAM_CONFIGS).filter(([k,v])=>v.type==='exam');
      body.innerHTML = `
        <div class="cf-section-label">📚 Select Exam</div>
        <div class="cf-exam-grid">
          ${exams.map(([k,v])=>`<button class="cf-exam-chip" style="--ec:${v.color}" onclick="CF._renderPYQYears('${k}')">${v.label}</button>`).join('')}
        </div>
        <div id="cf-pyq-years" style="margin-top:18px"></div>
        <div id="cf-pyq-questions" style="margin-top:12px"></div>`;
    },
    _renderPYQYears(exam) {
      this._pyqState.exam = exam;
      const conf = EXAM_CONFIGS[exam];
      const el = document.getElementById('cf-pyq-years');
      if (!el) return;
      el.innerHTML = `
        <div class="cf-section-label">${conf.label} — Select Year</div>
        <div class="cf-year-row">
          ${conf.years.map(y=>`<button class="cf-year-btn" onclick="CF._loadPYQQuestions('${exam}',${y})">${y}</button>`).join('')}
        </div>`;
      document.getElementById('cf-pyq-questions').innerHTML = '';
    },
    async _loadPYQQuestions(exam, year) {
      const el = document.getElementById('cf-pyq-questions');
      if (!el) return;
      el.innerHTML = `<div class="cf-loading-wrap"><div class="cf-spinner"></div><p class="cf-muted">Fetching ${EXAM_CONFIGS[exam].label} ${year} questions from AI...</p></div>`;
      const qs = await fetchQuestionsFromAI(exam, year, 10);
      if (!qs) {
        el.innerHTML = `<div class="cf-muted" style="padding:16px">❌ Could not load questions. Check your connection and try again.</div>`;
        return;
      }
      this._pyqState = { exam, year, qs };
      el.innerHTML = `
        <div class="cf-section-label">${EXAM_CONFIGS[exam].label} ${year} — ${qs.length} Questions</div>
        ${qs.map((q,i)=>this._renderPYQCard(q,i,exam,year)).join('')}
        <button class="cf-btn cf-btn-primary" style="margin-top:16px;width:100%" onclick="CF._startPYQPractice('${exam}',${year})">⚡ Mock Test with these Questions</button>`;
    },
    _renderPYQCard(q, i, exam, year) {
      const id = `pyq_${exam}_${year}_${i}`;
      return `
        <div class="cf-q-card" id="${id}">
          <div class="cf-q-num">Q${i+1} <span class="cf-topic-tag">${q.topic||'General'}</span></div>
          <div class="cf-q-text">${q.q}</div>
          <div class="cf-opts">
            ${q.opts.map((o,j)=>`<button class="cf-opt" onclick="CF._answerPYQ('${id}',${j},${q.ans},'${(q.exp||'').replace(/'/g,"\\'")}',this)">${String.fromCharCode(65+j)}. ${o}</button>`).join('')}
          </div>
          <div class="cf-exp" id="${id}_exp" style="display:none">💡 ${q.exp||'See explanation above.'}</div>
        </div>`;
    },
    _answerPYQ(cardId, chosen, correct, exp, btn) {
      const card = document.getElementById(cardId);
      if (!card || card.dataset.answered) return;
      card.dataset.answered = '1';
      card.querySelectorAll('.cf-opt').forEach((b,j) => {
        b.disabled = true;
        if (j === correct) b.classList.add('cf-opt-correct');
        else if (b === btn && j !== correct) b.classList.add('cf-opt-wrong');
      });
      const expEl = document.getElementById(cardId+'_exp');
      if (expEl) expEl.style.display = 'block';
      const isCorrect = chosen === correct;
      // Record from pyq state if available
      const ps = this._pyqState;
      if (ps && ps.qs) {
        const parts = cardId.split('_');
        const qi = parseInt(parts[parts.length-1]);
        const q = ps.qs[qi];
        if (q) { WeakTopics.record(q.topic||'General', isCorrect); Analytics.record({type:'answer',topic:q.topic||'General',correct:isCorrect}); DailyGoal.increment(); }
      }
      toast(isCorrect ? '✅ Sahi! +5 XP' : '❌ Galat. Explanation padho!', 2000);
    },
    _startPYQPractice(exam, year) {
      CF.closeModal('cf-pyq-modal');
      MockTest.start(exam, 10);
    },

    /* ── MOCK TEST RENDERING ── */
    _mt: { qi:0, timer:null, elapsed:0 },
    _renderMockLoading() {
      const body = document.getElementById('cf-mock-modal_body');
      if (!body) return;
      body.innerHTML = `
        <div class="cf-loading-wrap" style="min-height:220px">
          <div class="cf-spinner"></div>
          <p class="cf-muted" style="margin-top:16px">Generating questions with AI...<br><small>This takes a few seconds</small></p>
        </div>`;
    },
    _renderMockTest() {
      const body = document.getElementById('cf-mock-modal_body');
      if (!body) return;
      if (!MockTest._state) {
        const exams = Object.entries(EXAM_CONFIGS).filter(([k,v])=>v.type==='exam');
        body.innerHTML = `
          <div class="cf-center-text">
            <div style="font-size:48px;margin-bottom:12px">🎯</div>
            <h3>Timed Mock Test</h3>
            <p class="cf-muted" style="margin:8px 0 20px">AI-generated questions. Marks: +2 correct, −0.5 wrong</p>
            <div class="cf-exam-grid" style="margin-bottom:20px;justify-content:center">
              ${exams.map(([k,v])=>`<button class="cf-exam-chip" style="--ec:${v.color}" onclick="MockTest.start('${k}',40)">${v.label}</button>`).join('')}
            </div>
            <p class="cf-muted" style="font-size:12px">Duration: 48 min • 40 AI-generated Questions • +2/−0.5 marking</p>
          </div>`;
        return;
      }
      if (MockTest._state.loading) {
        this._renderMockLoading();
        return;
      }
      this._renderMockQuestion();
    },
    _renderMockQuestion() {
      const body = document.getElementById('cf-mock-modal_body');
      const s = MockTest._state;
      if (!body || !s) return;
      if (s.loading) { this._renderMockLoading(); return; }
      const q = s.questions[s.current];
      if (!q) { CF._renderMockResults(); return; }
      const remaining = s.timeLimit - (Date.now()-s.startTime);
      const mins = Math.floor(remaining/60000);
      const secs = Math.floor((remaining%60000)/1000);
      clearInterval(this._mt.timer);
      s.qStartTime = Date.now();
      body.innerHTML = `
        <div class="cf-mock-header">
          <span class="cf-mock-progress">${s.current+1}/${s.questions.length}</span>
          <div class="cf-mock-timer" id="cf-mock-timer">⏱ ${mins}:${secs<10?'0':''}${secs}</div>
          <span class="cf-topic-tag" style="font-size:11px">${q.topic||'General'}</span>
        </div>
        <div class="cf-mock-bar-wrap"><div class="cf-mock-bar" style="width:${(s.current/s.questions.length)*100}%"></div></div>
        <div class="cf-q-text" style="margin:16px 0;font-size:16px;font-weight:600">${q.q}</div>
        <div class="cf-opts" id="cf-mock-opts">
          ${q.opts.map((o,j)=>`<button class="cf-opt" onclick="CF._mockAnswer(${j})">${String.fromCharCode(65+j)}. ${o}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="cf-btn cf-btn-ghost" onclick="CF._mockSkip()">Skip →</button>
          <button class="cf-btn cf-btn-danger" onclick="if(confirm('End test?')){CF._renderMockResults()}">End Test</button>
        </div>`;
      this._mt.timer = setInterval(() => {
        const rem = MockTest._state.timeLimit - (Date.now()-MockTest._state.startTime);
        const timerEl = document.getElementById('cf-mock-timer');
        if (!timerEl) { clearInterval(this._mt.timer); return; }
        if (rem <= 0) { clearInterval(this._mt.timer); CF._renderMockResults(); return; }
        const m=Math.floor(rem/60000), ss=Math.floor((rem%60000)/1000);
        timerEl.textContent = '⏱ '+m+':'+(ss<10?'0':'')+ss;
        if (rem < 300000) timerEl.style.color='#ef4444';
      }, 1000);
    },
    _mockAnswer(ai) {
      const s = MockTest._state;
      if (!s) return;
      const qi = s.current;
      const q = s.questions[qi];
      MockTest.answer(qi, ai);
      // Show green/red feedback on all options before advancing
      const optsEl = document.getElementById('cf-mock-opts');
      if (optsEl) {
        optsEl.querySelectorAll('.cf-opt').forEach((b, j) => {
          b.disabled = true;
          if (j === q.ans) b.classList.add('cf-opt-correct');
          else if (j === ai && j !== q.ans) b.classList.add('cf-opt-wrong');
        });
        // Show brief explanation if available
        if (q.exp) {
          const expDiv = document.createElement('div');
          expDiv.className = 'cf-exp';
          expDiv.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:8px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.2);font-size:13px;color:var(--text-secondary,rgba(240,240,245,0.7))';
          expDiv.textContent = '💡 ' + q.exp;
          optsEl.parentNode.insertBefore(expDiv, optsEl.nextSibling);
        }
      }
      setTimeout(function() {
        s.current++;
        if (s.current >= s.questions.length) { clearInterval(CF._mt.timer); CF._renderMockResults(); }
        else CF._renderMockQuestion();
      }, 900);
    },
    _mockSkip() {
      const s = MockTest._state;
      if (!s) return;
      s.current++;
      if (s.current >= s.questions.length) { clearInterval(this._mt.timer); CF._renderMockResults(); }
      else CF._renderMockQuestion();
    },
    _renderMockResults() {
      clearInterval(this._mt.timer);
      const body = document.getElementById('cf-mock-modal_body');
      const r = MockTest.getResults();
      if (!body || !r) return;
      const p = r.prediction;
      XP.add(r.correct * 10);
      body.innerHTML = `
        <div class="cf-results-header">
          <div style="font-size:48px">${r.correct>=r.total*0.7?'🏆':r.correct>=r.total*0.5?'🎯':'📚'}</div>
          <h2 style="margin:8px 0">${r.correct}/${r.total} Correct</h2>
          <div class="cf-score-pill">Score: ${r.rawScore.toFixed(1)}</div>
        </div>
        <div class="cf-results-grid">
          <div class="cf-result-stat" style="--rc:#22c55e"><div>${r.correct}</div><span>Correct</span></div>
          <div class="cf-result-stat" style="--rc:#ef4444"><div>${r.wrong}</div><span>Wrong</span></div>
          <div class="cf-result-stat" style="--rc:#f59e0b"><div>${r.skipped}</div><span>Skipped</span></div>
          <div class="cf-result-stat" style="--rc:#38bdf8"><div>${Math.floor(r.timeTaken/60)}m</div><span>Time</span></div>
        </div>
        ${p ? `<div class="cf-predictor-card ${p.safe?'cf-safe':'cf-danger'}">
          <div>📊 Predicted Rank: <strong>#${p.rank.toLocaleString()}</strong></div>
          <div>Cutoff ${p.safe?'✅ Cleared':'❌ Missed by '+p.gap.toFixed(1)}</div>
        </div>` : ''}
        <div class="cf-ai-review-wrap">
          <div class="cf-section-label">🤖 AI Performance Review</div>
          <div id="cf-ai-review-text" class="cf-ai-review">Loading AI review...</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="cf-btn cf-btn-primary" onclick="MockTest._state=null;CF._renderMockTest()">New Test</button>
          <button class="cf-btn cf-btn-ghost" onclick="CF.closeModal('cf-mock-modal');CF.openAnalytics()">View Analytics</button>
          <button class="cf-btn cf-btn-ghost" onclick="CF.closeModal('cf-mock-modal');CF.openPYQ()">Practice PYQs</button>
        </div>`;
      MockTest._state = null;
      confetti();
      MockTest.getAIReview(r).then(review => {
        const el = document.getElementById('cf-ai-review-text');
        if (el) el.textContent = review;
      });
    },

    /* ── ANALYTICS RENDERING ── */
    _renderAnalytics() {
      const body = document.getElementById('cf-analytics-modal_body');
      if (!body) return;
      const trend = Analytics.getWeeklyTrend();
      const topics = WeakTopics.getSorted();
      const xp = XP.get(), lvl = XP.level();
      const avg = Analytics.getAvgTimePerQ();
      const streak = (typeof state!=='undefined'?state.streakDays:lsGet('streak','0'))||0;

      const topicRows = topics.slice(0,8).map(t=>`
        <div class="cf-topic-row">
          <span class="cf-topic-name">${t.topic}</span>
          <div class="cf-topic-bar-wrap">
            <div class="cf-topic-bar" style="width:${t.accuracy}%;background:${t.accuracy>=70?'#22c55e':t.accuracy>=40?'#f59e0b':'#ef4444'}"></div>
          </div>
          <span class="cf-topic-pct ${t.accuracy<40?'cf-red':''}">${t.accuracy}%</span>
        </div>`).join('') || '<p class="cf-muted">Solve questions to see your topic accuracy here.</p>';

      const chartBars = trend.map(t=>`
        <div class="cf-chart-col">
          <div class="cf-chart-bar-wrap">
            <div class="cf-chart-bar" style="height:${t.total?t.accuracy:0}%;background:linear-gradient(180deg,#6C63FF,#FF6B9D)"></div>
          </div>
          <div class="cf-chart-lbl">${t.label}</div>
          <div class="cf-chart-pct">${t.total?t.accuracy+'%':'-'}</div>
        </div>`).join('');

      body.innerHTML = `
        <div class="cf-stat-row">
          <div class="cf-stat-card"><div class="cf-stat-val" style="color:#f59e0b">⭐ Lv.${lvl}</div><div class="cf-stat-lbl">${xp} XP</div></div>
          <div class="cf-stat-card"><div class="cf-stat-val" style="color:#FF6B9D">🔥 ${streak}</div><div class="cf-stat-lbl">Day Streak</div></div>
          <div class="cf-stat-card"><div class="cf-stat-val" style="color:#38bdf8">⏱ ${avg}s</div><div class="cf-stat-lbl">Avg/Q</div></div>
          <div class="cf-stat-card"><div class="cf-stat-val" style="color:#22c55e">${DailyGoal.getTodayCount()}/${DailyGoal.GOAL}</div><div class="cf-stat-lbl">Today</div></div>
        </div>
        <div class="cf-section-label" style="margin-top:20px">📈 7-Day Accuracy Trend</div>
        <div class="cf-chart-wrap">${chartBars}</div>
        <div class="cf-section-label" style="margin-top:20px">📊 Topic Accuracy</div>
        <div class="cf-topic-list">${topicRows}</div>
        ${WeakTopics.getWeakest(3).length ? `
          <div class="cf-weak-alert">
            ⚠️ Focus Areas: ${WeakTopics.getWeakest(3).map(t=>'<strong>'+t.topic+'</strong>').join(', ')}
            <br><small>Practice these topics to improve your score</small>
            <button class="cf-btn cf-btn-sm cf-btn-primary" style="margin-top:10px" onclick="CF.closeModal('cf-analytics-modal');CF.openPYQ()">Practice Now →</button>
          </div>` : ''}`;
    },

    /* ── EXAM EXPANSION RENDERING ── */
    _renderExamExpansion() {
      const body = document.getElementById('cf-exam-modal_body');
      if (!body) return;
      const exams = Object.entries(EXAM_CONFIGS).filter(([k,v])=>v.type==='exam');
      const classes = Object.entries(EXAM_CONFIGS).filter(([k,v])=>v.type==='class');
      body.innerHTML = `
        <div class="cf-section-label">🏛️ Competitive Exams</div>
        <div class="cf-exam-grid">
          ${exams.map(([k,v])=>`
            <button class="cf-exam-chip" style="--ec:${v.color}" onclick="CF.closeModal('cf-exam-modal');CF._pyqState.exam='${k}';CF.openPYQ();CF._renderPYQYears('${k}')">
              ${v.label}
            </button>`).join('')}
        </div>
        <div class="cf-section-label" style="margin-top:20px">🎒 School Classes (NCERT)</div>
        <div class="cf-class-grid">
          ${classes.map(([k,v])=>`
            <button class="cf-class-card" style="--ec:${v.color}" onclick="CF._openClassStudy('${k}')">
              <div class="cf-class-label">${v.label}</div>
              <div class="cf-class-subjects">${v.subjects.slice(0,3).join(' · ')}${v.subjects.length>3?'...':''}</div>
            </button>`).join('')}
        </div>`;
    },
    _openClassStudy(classKey) {
      const conf = EXAM_CONFIGS[classKey];
      if (!conf) return;
      CF.closeModal('cf-exam-modal');
      // Build a PYQ-like view for the class subject
      const body = document.getElementById('cf-pyq-modal_body');
      CF.openModal('cf-pyq-modal');
      body.innerHTML = `
        <div class="cf-section-label">📖 ${conf.label} — Select Subject</div>
        <div class="cf-exam-grid">
          ${conf.subjects.map(s=>`<button class="cf-exam-chip" style="--ec:${conf.color}" onclick="CF._loadClassQuestions('${classKey}','${s}')">${s}</button>`).join('')}
        </div>
        <div id="cf-pyq-questions" style="margin-top:12px"></div>`;
    },
    async _loadClassQuestions(classKey, subject) {
      const el = document.getElementById('cf-pyq-questions');
      if (!el) return;
      const conf = EXAM_CONFIGS[classKey];
      el.innerHTML = `<div class="cf-loading-wrap"><div class="cf-spinner"></div><p class="cf-muted">Loading ${conf.label} ${subject} questions...</p></div>`;
      const cacheKey = `pyq_cache_${classKey}_${subject}`;
      let qs = lsGet(cacheKey, 'null');
      if (!qs || !Array.isArray(qs)) {
        const prompt = `Generate 10 multiple choice questions for ${conf.label} ${subject} NCERT curriculum as per Google and standard textbooks.
Return ONLY a JSON array. No explanation, no markdown, no backticks.
Format: [{"q":"question text","opts":["A","B","C","D"],"ans":0,"topic":"${subject}","exp":"Brief explanation"}]
- ans is the 0-based index of correct option
- Make questions appropriate for ${conf.label} level students`;
        try {
          const text = await callDeepSeek(prompt, 800);
          qs = extractJsonArray(text);
          if (Array.isArray(qs) && qs.length > 0) lsSet(cacheKey, qs);
          else qs = null;
        } catch(e) { qs = null; }
      }
      if (!qs) {
        el.innerHTML = `<div class="cf-muted" style="padding:16px">❌ Could not load questions. Check your connection.</div>`;
        return;
      }
      this._pyqState = { exam: classKey, year: subject, qs };
      el.innerHTML = `
        <div class="cf-section-label">${conf.label} ${subject} — ${qs.length} Questions</div>
        ${qs.map((q,i)=>this._renderPYQCard(q,i,classKey,subject)).join('')}`;
    },

    /* ── STUDY GROUPS RENDERING (Full Screen) ── */
    _renderGroups() {
      const body = document.getElementById('cf-groups-modal_body');
      if (!body) return;
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <button class="cf-btn cf-btn-primary" onclick="CF._showCreateGroup()">➕ Create Group</button>
          <button class="cf-btn cf-btn-ghost" onclick="CF._showJoinGroup()">🔗 Join Group</button>
        </div>
        <div id="cf-group-form"></div>
        <div id="cf-groups-list"><div class="cf-loading-wrap"><div class="cf-spinner"></div><p class="cf-muted">Loading groups…</p></div></div>`;
      StudyGroups.getAll().then(groups => {
        const el = document.getElementById('cf-groups-list');
        if (!el) return;
        el.innerHTML = groups.length
          ? `<div class="cf-section-label">Your Groups</div>${groups.map(g=>CF._renderGroupCard(g)).join('')}`
          : '<div class="cf-empty-state">💬 No groups yet. Create or join one!</div>';
      }).catch(() => {
        const el = document.getElementById('cf-groups-list');
        if (el) el.innerHTML = '<div class="cf-muted" style="padding:16px">❌ Could not load groups. Check your connection.</div>';
      });
    },
    _renderGroupCard(g) {
      const isAdmin = g.adminUid === uid();
      return `
        <div class="cf-group-card">
          <div class="cf-group-info">
            <strong>${g.name}</strong> <span class="cf-topic-tag">${EXAM_CONFIGS[g.exam]?.label||g.exam}</span>
            ${isAdmin ? '<span style="font-size:9px;background:linear-gradient(135deg,#f59e0b,#FF6B9D);color:#fff;padding:1px 6px;border-radius:8px;font-weight:700;margin-left:4px">ADMIN</span>' : ''}
            <div class="cf-group-meta">👥 ${g.members.length} members · Code: <code>${g.code}</code></div>
          </div>
          <button class="cf-btn cf-btn-sm cf-btn-primary" onclick="CF._openGroupChat('${g.id}')">Open →</button>
        </div>`;
    },
    _showCreateGroup() {
      const el = document.getElementById('cf-group-form');
      if (!el) return;
      const exams = Object.entries(EXAM_CONFIGS);
      el.innerHTML = `
        <div class="cf-form-card">
          <input class="cf-input" id="cf-grp-name" placeholder="Group name (e.g. SSC Warriors 2025)" maxlength="40" />
          <select class="cf-input cf-select" id="cf-grp-exam">
            ${exams.map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <button class="cf-btn cf-btn-primary" style="width:100%" onclick="CF._createGroup()">✅ Create Group</button>
        </div>`;
    },
    async _createGroup() {
      const name = document.getElementById('cf-grp-name')?.value?.trim();
      const exam = document.getElementById('cf-grp-exam')?.value;
      if (!name) { toast('Please enter a group name'); return; }
      await StudyGroups.create(name, exam);
      CF._renderGroups();
    },
    _showJoinGroup() {
      const el = document.getElementById('cf-group-form');
      if (!el) return;
      el.innerHTML = `
        <div class="cf-form-card">
          <input class="cf-input" id="cf-join-code" placeholder="Enter 6-letter group code" maxlength="6" style="text-transform:uppercase;letter-spacing:0.15em" />
          <button class="cf-btn cf-btn-primary" style="width:100%" onclick="CF._joinGroup()">🔗 Join Group</button>
        </div>`;
    },
    async _joinGroup() {
      const code = document.getElementById('cf-join-code')?.value?.trim();
      if (!code || code.length < 4) { toast('Please enter a valid group code'); return; }
      const g = await StudyGroups.join(code);
      if (g) CF._renderGroups();
    },

    /* ═══ CHAT + BATTLE QUIZ SYSTEM ═══ */
    _chatPollInterval: null,
    _chatPollHash: '',
    _currentGroupId: null,
    _currentGroupData: null,

    _stopChatPolling() {
      if (CF._chatPollInterval) { clearInterval(CF._chatPollInterval); CF._chatPollInterval = null; }
      CF._chatPollHash = '';
      CF._currentGroupId = null;
      CF._currentGroupData = null;
    },

    /* Renders all chat messages (styled beautifully) */
    _renderChatMessages(messages) {
      const msgs = document.getElementById('cf-chat-msgs');
      if (!msgs) return;
      const wasAtBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
      if (!messages.length) {
        msgs.innerHTML = `<div style="text-align:center;padding:32px 16px;color:rgba(200,195,255,0.4)">
          <div style="font-size:40px;margin-bottom:8px">👋</div>
          <div style="font-size:14px;font-weight:600">No messages yet</div>
          <div style="font-size:12px;margin-top:4px">Say hello to your study group!</div>
        </div>`;
        return;
      }
      const myUid = uid();
      // memberNames map from group data (has real Google names)
      const memberNames = (CF._currentGroupData && CF._currentGroupData.memberNames) || {};

      let html = '';
      let lastUid = null;
      messages.forEach((m, i) => {
        const isMine = m.uid === myUid;
        const showName = !isMine && m.uid !== lastUid;
        const isLast = i === messages.length - 1 || messages[i+1].uid !== m.uid;
        lastUid = m.uid;
        const timeStr = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Resolve real name: memberNames map > saved in message > fallback
        const resolvedName = memberNames[m.uid] || m.name || (isMine ? getMyName() : 'Student');
        const initial = resolvedName.charAt(0).toUpperCase();
        html += `<div class="cf-chat-row ${isMine ? 'cf-chat-row-mine' : 'cf-chat-row-other'}">
          ${!isMine && showName ? `<div class="cf-chat-avatar">${initial}</div>` : (!isMine ? '<div class="cf-chat-avatar-gap"></div>' : '')}
          <div class="cf-chat-col">
            ${showName ? `<div class="cf-chat-sender">${resolvedName}</div>` : ''}
            <div class="cf-chat-bubble-wrap ${isMine?'cf-mine':''}">
              <div class="cf-chat-bubble2">${m.text.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
              ${isLast ? `<div class="cf-chat-time2">${timeStr}</div>` : ''}
            </div>
          </div>
        </div>`;
      });
      msgs.innerHTML = html;
      if (wasAtBottom) msgs.scrollTop = msgs.scrollHeight;
    },

    /* Renders the XP leaderboard for quiz battles */
    _renderXPBoard(quiz, memberNames) {
      const xp = quiz.xp || {};
      const entries = Object.entries(xp).sort((a,b) => b[1]-a[1]);
      if (!entries.length) return '';
      return `<div class="cf-xp-board">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:rgba(200,195,255,0.5);text-transform:uppercase;margin-bottom:8px">⚡ Live XP Board</div>
        ${entries.map(([u,x],i)=>`
          <div class="cf-xp-row ${u===uid()?'cf-xp-me':''}">
            <span class="cf-xp-rank">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</span>
            <span class="cf-xp-name">${memberNames&&memberNames[u] ? memberNames[u] : (u===uid()?'You':'Player')}</span>
            <span class="cf-xp-val">${x} XP</span>
          </div>`).join('')}
      </div>`;
    },

    /* Renders the quiz question for the battle */
    _renderQuizQuestion(quiz, groupId, memberNames) {
      const body = document.getElementById('cf-quiz-area');
      if (!body) return;
      if (!quiz || quiz.status === 'finished') {
        CF._renderQuizResults(quiz, memberNames);
        return;
      }
      const qi = quiz.current;
      const q = quiz.questions[qi];
      if (!q) return;
      const answered = quiz.answers && quiz.answers[qi];
      const myUid = uid();
      const iAnswered = answered && answered.uid === myUid;
      const someoneAnswered = !!answered;

      body.innerHTML = `
        <div class="cf-quiz-battle-wrap">
          <div class="cf-quiz-progress-row">
            <span class="cf-quiz-qnum">Question ${qi+1} / ${quiz.questions.length}</span>
            <span class="cf-quiz-topic cf-topic-tag">${q.topic||'General'}</span>
          </div>
          <div class="cf-quiz-bar-track"><div class="cf-quiz-bar-fill" style="width:${(qi/quiz.questions.length)*100}%"></div></div>
          <div class="cf-quiz-q">${q.q}</div>
          <div class="cf-quiz-opts" id="cf-quiz-opts">
            ${q.opts.map((o,j)=>{
              let cls = 'cf-quiz-opt';
              if (someoneAnswered) {
                if (j === q.ans) cls += ' cf-quiz-opt-correct';
                else if (answered && j === answered.chosen && j !== q.ans) cls += ' cf-quiz-opt-wrong';
                else cls += ' cf-quiz-opt-dim';
              }
              return `<button class="cf-quiz-opt ${someoneAnswered?'cf-quiz-opt-disabled':''}" 
                data-idx="${j}" 
                onclick="${someoneAnswered ? '' : `CF._submitQuizAnswer('${groupId}',${qi},${j})`}"
                ${someoneAnswered ? 'disabled' : ''}>
                <span class="cf-quiz-opt-letter">${String.fromCharCode(65+j)}</span>
                <span>${o}</span>
              </button>`;
            }).join('')}
          </div>
          ${someoneAnswered ? `
            <div class="cf-quiz-answered-banner ${answered.correct?'cf-correct':'cf-wrong'}">
              ${answered.correct ? '✅ Correct!' : '❌ Wrong!'} 
              <strong>${answered.name}</strong> answered first
              ${answered.correct ? ' — <b>+10 XP</b>' : ''}
            </div>
            <div class="cf-quiz-exp">💡 ${q.exp||'See explanation above.'}</div>
          ` : `<div class="cf-quiz-waiting">⚡ Be first to answer and earn <b>+10 XP</b>!</div>`}
          ${CF._renderXPBoard(quiz, memberNames)}
        </div>`;
    },

    /* Renders quiz final results popup */
    _renderQuizResults(quiz, memberNames) {
      const body = document.getElementById('cf-quiz-area');
      if (!body) return;
      const xp = quiz.xp || {};
      const sorted = Object.entries(xp).sort((a,b)=>b[1]-a[1]);
      const winner = sorted[0];
      const myUid = uid();
      body.innerHTML = `
        <div style="text-align:center;padding:20px 0 10px">
          <div style="font-size:52px">${winner && winner[0]===myUid ? '🏆' : '🎯'}</div>
          <h2 style="margin:8px 0;font-size:20px;background:linear-gradient(135deg,#f59e0b,#FF6B9D);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Quiz Over!</h2>
          ${winner ? `<div style="font-size:14px;color:rgba(200,195,255,0.7);margin-bottom:16px">🥇 Winner: <strong style="color:#f59e0b">${memberNames&&memberNames[winner[0]]?memberNames[winner[0]]:'Someone'}</strong> with ${winner[1]} XP</div>` : ''}
        </div>
        <div class="cf-results-grid" style="margin:0 0 16px">
          ${sorted.map(([u,x],i)=>`
            <div class="cf-result-stat" style="--rc:${i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#f59e0b':'#6C63FF'}">
              <div>${['🥇','🥈','🥉'][i]||'#'+(i+1)} ${x}</div>
              <span>${memberNames&&memberNames[u]?memberNames[u]:(u===myUid?'You':'Player')}</span>
            </div>`).join('')}
        </div>
        <div style="text-align:center">
          <button class="cf-btn cf-btn-ghost" onclick="document.getElementById('cf-quiz-area').innerHTML=''">✕ Close Results</button>
        </div>`;
    },

    /* Opens group chat room with real-time polling */
    async _openGroupChat(groupId) {
      CF._stopChatPolling();
      const db = window._firebaseDb;
      const { doc, getDoc } = window._firebaseFns;
      const body = document.getElementById('cf-groups-modal_body');
      body.innerHTML = `<div class="cf-loading-wrap"><div class="cf-spinner"></div></div>`;

      let snap;
      try { snap = await getDoc(doc(db, 'studyGroups', groupId)); } catch(e) { toast('❌ Could not load group'); return; }
      if (!snap.exists()) { toast('❌ Group not found'); return; }
      const g = snap.data();
      CF._currentGroupId = groupId;
      CF._currentGroupData = g;
      const isAdmin = g.adminUid === uid();
      const examLabel = EXAM_CONFIGS[g.exam]?.label || g.exam;

      body.innerHTML = `
        <div class="cf-chat-topbar">
          <button class="cf-btn cf-btn-ghost cf-chat-back" onclick="CF._stopChatPolling();CF._renderGroups()">← Back</button>
          <div class="cf-chat-topbar-info">
            <span class="cf-chat-gname">${g.name}</span>
            <span class="cf-topic-tag" style="font-size:10px">${examLabel}</span>
          </div>
          <button class="cf-btn cf-btn-ghost cf-chat-code-btn" onclick="navigator.clipboard?.writeText('${g.code}');CF.toast('📋 Code ${g.code} copied!')">📋 ${g.code}</button>
        </div>
        ${isAdmin ? `
        <div class="cf-admin-bar" id="cf-admin-bar">
          <span style="font-size:11px;font-weight:700;color:#f59e0b;margin-right:4px">👑 Admin</span>
          <button class="cf-btn cf-btn-sm cf-btn-primary" onclick="CF._showStartQuiz('${groupId}','${g.exam}')">🎯 Start Quiz Battle</button>
        </div>` : ''}
        <div id="cf-quiz-area"></div>
        <div class="cf-chat-messages cf-chat-fullscreen" id="cf-chat-msgs"></div>
        <div class="cf-chat-input-row">
          <input class="cf-input" id="cf-chat-input" placeholder="Message your group…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();CF._sendGroupMsg('${groupId}')}" />
          <button class="cf-btn cf-btn-primary cf-chat-send-btn" onclick="CF._sendGroupMsg('${groupId}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>`;

      CF._renderChatMessages(g.messages || []);
      if (g.quiz && g.quiz.status === 'active') CF._renderQuizQuestion(g.quiz, groupId, g.memberNames);
      else if (g.quiz && g.quiz.status === 'finished') CF._renderQuizResults(g.quiz, g.memberNames);

      // Start polling every 3s — NO onSnapshot
      CF._chatPollHash = JSON.stringify({ msgs: (g.messages||[]).length, quiz: g.quiz?.current, qstatus: g.quiz?.status, qanswers: Object.keys(g.quiz?.answers||{}).length });
      CF._chatPollInterval = setInterval(async () => {
        if (!CF._currentGroupId) return;
        try {
          const s = await getDoc(doc(db, 'studyGroups', CF._currentGroupId));
          if (!s.exists()) { CF._stopChatPolling(); return; }
          const data = s.data();
          const newHash = JSON.stringify({
            msgs: (data.messages||[]).length,
            quiz: data.quiz?.current,
            qstatus: data.quiz?.status,
            qanswers: Object.keys(data.quiz?.answers||{}).length
          });
          if (newHash !== CF._chatPollHash) {
            CF._chatPollHash = newHash;
            CF._currentGroupData = data;
            CF._renderChatMessages(data.messages || []);
            if (data.quiz && (data.quiz.status === 'active' || data.quiz.status === 'finished')) {
              CF._renderQuizQuestion(data.quiz, CF._currentGroupId, data.memberNames);
            } else {
              const qa = document.getElementById('cf-quiz-area');
              if (qa) qa.innerHTML = '';
            }
          }
        } catch(e) {}
      }, 3000);
    },

    async _sendGroupMsg(groupId) {
      const input = document.getElementById('cf-chat-input');
      if (!input || !input.value.trim()) return;
      const text = input.value.trim();
      input.value = '';
      try {
        await StudyGroups.addMessage(groupId, text);
        const db = window._firebaseDb;
        const { doc, getDoc } = window._firebaseFns;
        const snap = await getDoc(doc(db, 'studyGroups', groupId));
        if (snap.exists()) {
          CF._currentGroupData = snap.data();
          CF._renderChatMessages(snap.data().messages || []);
          CF._chatPollHash = JSON.stringify({
            msgs: (snap.data().messages||[]).length,
            quiz: snap.data().quiz?.current,
            qstatus: snap.data().quiz?.status,
            qanswers: Object.keys(snap.data().quiz?.answers||{}).length
          });
        }
      } catch(e) { toast('❌ Message failed. Check connection.'); }
    },

    /* Admin: show quiz type picker */
    _showStartQuiz(groupId, exam) {
      const bar = document.getElementById('cf-admin-bar');
      if (!bar) return;
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0">
          <span style="font-size:11px;font-weight:700;color:#f59e0b">👑 Start Quiz:</span>
          <button class="cf-btn cf-btn-sm cf-btn-primary" onclick="CF._startQuizBattle('${groupId}','${exam}','pyq')">📚 PYQ Battle</button>
          <button class="cf-btn cf-btn-sm" style="background:rgba(108,99,255,0.2);border:1px solid rgba(108,99,255,0.4);color:#a78bfa;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600" onclick="CF._startQuizBattle('${groupId}','${exam}','mock')">🎯 Mock Battle</button>
          <button class="cf-btn cf-btn-sm cf-btn-ghost" onclick="CF._resetAdminBar('${groupId}','${exam}')">✕</button>
        </div>`;
    },

    _resetAdminBar(groupId, exam) {
      const bar = document.getElementById('cf-admin-bar');
      if (!bar) return;
      bar.innerHTML = `<span style="font-size:11px;font-weight:700;color:#f59e0b;margin-right:4px">👑 Admin</span>
        <button class="cf-btn cf-btn-sm cf-btn-primary" onclick="CF._showStartQuiz('${groupId}','${exam}')">🎯 Start Quiz Battle</button>`;
    },

    async _startQuizBattle(groupId, exam, type) {
      const bar = document.getElementById('cf-admin-bar');
      if (bar) bar.innerHTML = `<span style="font-size:12px;color:rgba(200,195,255,0.5)">⏳ Generating ${type==='pyq'?'PYQ':'Mock'} questions with AI…</span>`;
      await StudyGroups.startQuiz(groupId, type, exam);
      CF._resetAdminBar(groupId, exam);
    },

    async _submitQuizAnswer(groupId, qIdx, chosenIdx) {
      const g = CF._currentGroupData;
      if (!g || !g.quiz) return;
      if (g.quiz.answers && g.quiz.answers[qIdx]) return; // already answered

      const myUid = uid();
      const myName = getMyName();
      const q = g.quiz.questions[qIdx];
      const correct = (chosenIdx === q.ans);
      const nextIdx = qIdx + 1;
      const isLast = nextIdx >= g.quiz.questions.length;

      // ── OPTIMISTIC UPDATE: render immediately, don't wait for server ──
      const optimisticQuiz = JSON.parse(JSON.stringify(g.quiz)); // deep clone
      optimisticQuiz.answers = optimisticQuiz.answers || {};
      optimisticQuiz.answers[qIdx] = { uid: myUid, name: myName, chosen: chosenIdx, correct, ts: Date.now() };
      optimisticQuiz.xp = optimisticQuiz.xp || {};
      optimisticQuiz.xp[myUid] = (optimisticQuiz.xp[myUid] || 0) + (correct ? 10 : 0);
      optimisticQuiz.current = isLast ? qIdx : nextIdx;
      optimisticQuiz.status = isLast ? 'finished' : 'active';

      // Update local data & render RIGHT NOW — user sees result instantly
      CF._currentGroupData = { ...g, quiz: optimisticQuiz };
      CF._renderQuizQuestion(optimisticQuiz, groupId, g.memberNames);
      if (correct) {
        toast('✅ Correct! +10 XP 🔥', 1800);
        if (typeof XP !== 'undefined') XP.add(10);
      } else {
        toast('❌ Wrong answer!', 1800);
      }

      // After a short pause (so user can read result), advance to next question
      if (!isLast) {
        setTimeout(() => {
          CF._renderQuizQuestion(optimisticQuiz, groupId, g.memberNames);
        }, 1800);
      }

      // ── BACKGROUND SYNC: write to Firestore without blocking UI ──
      StudyGroups.submitAnswer(groupId, g.quiz, qIdx, chosenIdx).then(() => {
        // Pull fresh data after write to sync all members' states
        const db = window._firebaseDb;
        const { doc, getDoc } = window._firebaseFns;
        return getDoc(doc(db, 'studyGroups', groupId));
      }).then(snap => {
        if (!snap || !snap.exists()) return;
        const data = snap.data();
        CF._currentGroupData = data;
        CF._renderQuizQuestion(data.quiz, groupId, data.memberNames);
        CF._chatPollHash = JSON.stringify({
          msgs: (data.messages||[]).length,
          quiz: data.quiz?.current,
          qstatus: data.quiz?.status,
          qanswers: Object.keys(data.quiz?.answers||{}).length
        });
      }).catch(() => {});
    },

    /* ── DAILY GOAL RENDERING ── */
    _renderDailyGoal() {
      const body = document.getElementById('cf-daily-modal_body');
      if (!body) return;
      const today = DailyGoal.getTodayCount();
      const goal = DailyGoal.GOAL;
      const pct = Math.min(100, today/goal*100);
      const xp = XP.get(), lvl = XP.level();
      const streak = (typeof state!=='undefined'?state.streakDays:0)||0;
      const weak = WeakTopics.getWeakest(3);

      // Robustly get selected mode from state OR localStorage (multiple fallbacks)
      let sscMode = (typeof state !== 'undefined' && state.sscMode) || '';
      if (!sscMode) {
        // Try common localStorage keys
        try {
          sscMode = localStorage.getItem('sscai_mode') || localStorage.getItem('crackai_mode') || localStorage.getItem('sscai_sscMode') || '';
        } catch(e) {}
      }
      if (!sscMode) sscMode = 'cgl'; // last resort

      const modeConf = EXAM_CONFIGS[sscMode];
      const modeLabel = modeConf ? modeConf.label : (sscMode.startsWith('class') ? ('Class ' + sscMode.replace('class','')) : sscMode.toUpperCase());
      const isClass = modeConf && modeConf.type === 'class';
      const goalLabel = isClass ? (modeLabel + ' — Daily Practice') : (modeLabel + ' — Daily Prep');

      // Rich subject-level topics for each class
      const CLASS_TOPICS = {
        class9: [
          'Triangles & Congruence (Maths)', 'Laws of Motion (Physics)', 'Democratic Politics — Elections',
          'The French Revolution (History)', 'Matter in Our Surroundings (Chemistry)',
          'Coordinate Geometry Basics', 'Sound & Waves (Physics)', 'Tissues (Biology)'
        ],
        class10: [
          'Trigonometry — Heights & Distances', 'Carbon & its Compounds (Chemistry)',
          'Nationalism in India (History)', 'Electricity & Circuits (Physics)',
          'Real Numbers & Euclid\'s Algorithm', 'Quadratic Equations', 'Life Processes (Biology)',
          'Federalism & Democracy (Civics)'
        ],
        class11_sci: [
          'Complex Numbers & Quadratics', 'Laws of Thermodynamics (Physics)', 'Organic Chemistry — Nomenclature',
          'Indian Constitution (Pol. Sci)', 'Kinematics in 2D', 'Sets, Relations & Functions',
          'Equilibrium (Chemistry)', 'Plant Kingdom (Biology)'
        ],
        class11_com: [
          'Business Environment', 'Accounting — Journal Entries', 'Statistics — Measures of Dispersion',
          'Theory of Demand & Supply', 'Financial Statements', 'Business Finance', 'Marketing Mix'
        ],
        class11_arts: [
          'Indian Constitution — Fundamental Rights', 'Mughal Empire (History)', 'Human Geography Basics',
          'Introduction to Sociology', 'Sets & Functions (Maths)', 'Political Theory', 'India — Physical Geography'
        ],
        class12: [
          'Integration by Parts (Maths)', 'Electrochemistry', 'Human Reproduction (Biology)',
          'Electromagnetic Induction', 'Probability — Bayes\' Theorem', 'Coordination Compounds',
          'Genetics & Evolution', 'Current Electricity'
        ],
      };

      // SSC exam specific topics with day rotation
      const SSC_TOPICS = {
        cgl:   ['QA — Percentage & Profit/Loss', 'English — Reading Comprehension', 'GA — Current Affairs (Last 3 months)', 'Reasoning — Syllogism', 'QA — Time, Speed & Distance', 'English — Cloze Test'],
        chsl:  ['English — Fill in the Blanks', 'Maths — Speed, Time & Distance', 'GK — History of India', 'Reasoning — Number Series', 'English — Sentence Improvement', 'Maths — Mensuration'],
        gd:    ['Maths — Number System', 'GK — Indian Polity & Constitution', 'English — Vocabulary', 'Reasoning — Analogy', 'Maths — Average & Percentage', 'GK — Indian Geography'],
        mts:   ['Maths — Simple & Compound Interest', 'GK — Indian Geography', 'English — Grammar Rules', 'Reasoning — Coding-Decoding', 'Maths — Ratio & Proportion', 'GK — Science (Basic)'],
        cpo:   ['Maths — Profit & Loss', 'GK — Science & Technology', 'English — Error Detection', 'Reasoning — Direction Sense', 'Maths — Data Interpretation', 'GK — Indian Polity'],
        cds:   ['Maths — Algebra', 'English — Antonyms & Synonyms', 'GK — Defence Affairs', 'Reasoning — Logical Venn Diagrams'],
        nda:   ['Maths — Trigonometry', 'English — Para Jumbles', 'GK — Science & Technology', 'Reasoning — Mathematical Operations'],
        upsc:  ['Current Affairs — National', 'Indian Polity — Legislature', 'Ancient History — Mauryan Empire', 'Geography — Monsoon System', 'Economy — GDP & National Income'],
        ibps:  ['Quantitative Aptitude — DI', 'English — RC & Para Summary', 'Reasoning — Puzzles', 'GA — Banking Awareness', 'Computer — Basic Terms'],
        sbi:   ['QA — Simplification', 'English — Word Usage', 'Reasoning — Seating Arrangement', 'GA — Financial Awareness', 'Computer Awareness'],
      };

      const todayDayIdx = new Date().getDay(); // 0–6
      // Map class variants (class11_sci etc.) to topics
      let topicKey = sscMode;
      if (isClass && !CLASS_TOPICS[topicKey]) {
        // try base class
        const base = sscMode.replace(/_sci|_com|_arts/, '');
        topicKey = CLASS_TOPICS[base] ? base : 'class10';
      }
      const allRec = isClass ? (CLASS_TOPICS[topicKey] || CLASS_TOPICS['class10']) : (SSC_TOPICS[sscMode] || SSC_TOPICS['cgl']);
      // Pick 3 topics rotating daily
      const recommendedTopics = [
        allRec[todayDayIdx % allRec.length],
        allRec[(todayDayIdx+1) % allRec.length],
        allRec[(todayDayIdx+2) % allRec.length]
      ];

      // Show subjects for class mode
      const subjectBadges = isClass && modeConf && modeConf.subjects
        ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${modeConf.subjects.slice(0,5).map(s=>`<span class="cf-topic-tag">${s}</span>`).join('')}${modeConf.subjects.length>5?`<span class="cf-topic-tag">+${modeConf.subjects.length-5} more</span>`:''}</div>`
        : '';

      body.innerHTML = `
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--primary,#6C63FF);margin-bottom:6px;text-align:center">📚 ${goalLabel}</div>
        ${subjectBadges}
        <div class="cf-goal-hero">
          <div class="cf-goal-circle" style="--pct:${pct}">
            <div class="cf-goal-inner">
              <div class="cf-goal-num">${today}/${goal}</div>
              <div class="cf-goal-sub">Today</div>
            </div>
          </div>
          <div class="cf-goal-stats">
            <div class="cf-goal-stat"><span style="color:#FF6B9D;font-size:22px">🔥 ${streak}</span><small>Day Streak</small></div>
            <div class="cf-goal-stat"><span style="color:#f59e0b;font-size:22px">⭐ Lv.${lvl}</span><small>${xp} XP total</small></div>
          </div>
        </div>
        ${today>=goal ? `<div class="cf-goal-done">🎯 Daily goal complete! Come back tomorrow to keep your streak!</div>` : `
          <div style="margin:16px 0">
            <div class="cf-goal-bar-track"><div class="cf-goal-bar-fill" style="width:${pct}%"></div></div>
            <div class="cf-muted" style="font-size:12px;margin-top:6px">${goal-today} more questions to hit your daily goal</div>
          </div>`}
        ${weak.length ? `
          <div class="cf-weak-alert" style="margin-top:16px">
            <div style="font-weight:600;margin-bottom:8px">⚠️ Needs Improvement</div>
            ${weak.map(t=>`<div style="margin:4px 0">• <strong>${t.topic}</strong> — ${t.accuracy}% accuracy (${t.attempts} attempts)</div>`).join('')}
          </div>` : ''}
        <div class="cf-weak-alert" style="margin-top:16px;background:rgba(108,99,255,0.10);border-color:rgba(108,99,255,0.35);">
          <div style="font-weight:700;margin-bottom:8px;color:var(--primary,#6C63FF)">📅 Today's Focus — ${modeLabel}</div>
          ${recommendedTopics.map((t,i)=>`
            <div style="margin:6px 0;display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(108,99,255,0.06);border-radius:8px;">
              <span style="font-size:16px">${['🎯','📖','⚡'][i]}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary,#f0f0f5)">${t}</div>
                <div style="font-size:10px;color:rgba(200,195,255,0.45);margin-top:2px">${['Start with this first','Build on the first topic','Consolidate your learning'][i]}</div>
              </div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
          <button class="cf-btn cf-btn-primary" onclick="CF.closeModal('cf-daily-modal');CF.openPYQ()">📖 Practice ${isClass ? 'Questions' : 'PYQs'}</button>
          <button class="cf-btn cf-btn-ghost" onclick="CF.closeModal('cf-daily-modal');CF.openMockTest()">🎯 Take Mock Test</button>
        </div>`;
    },

    /* ── SCORE PREDICTOR RENDERING ── */
    _renderScorePredictor() {
      const body = document.getElementById('cf-score-modal_body');
      if (!body) return;
      const exams = Object.entries(EXAM_CONFIGS).filter(([k,v])=>v.type==='exam');
      body.innerHTML = `
        <p class="cf-muted" style="margin-bottom:16px">Enter your expected scores to predict rank and cutoff status</p>
        <div class="cf-form-card">
          <select class="cf-input cf-select" id="sp-exam">
            ${exams.map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <div style="display:flex;gap:8px">
            <input class="cf-input" id="sp-score" type="number" placeholder="Your score (e.g. 155)" min="0" max="400" style="flex:1"/>
            <input class="cf-input" id="sp-max" type="number" placeholder="Max score (e.g. 200)" min="1" max="400" style="flex:1"/>
          </div>
          <select class="cf-input cf-select" id="sp-cat">
            <option value="gen">General</option>
            <option value="obc">OBC</option>
            <option value="sc">SC</option>
            <option value="st">ST</option>
          </select>
          <button class="cf-btn cf-btn-primary" style="width:100%" onclick="CF._calcScore()">📊 Predict My Rank</button>
        </div>
        <div id="sp-result" style="margin-top:16px"></div>`;
    },
    _calcScore() {
      const exam = document.getElementById('sp-exam')?.value;
      const score = parseFloat(document.getElementById('sp-score')?.value);
      const max = parseFloat(document.getElementById('sp-max')?.value);
      const cat = document.getElementById('sp-cat')?.value || 'gen';
      const el = document.getElementById('sp-result');
      if (!el) return;
      if (!score || !max || max <= 0) { el.innerHTML = '<p class="cf-red">Please enter valid scores.</p>'; return; }
      const p = ScorePredictor.predict(exam, score, max, cat);
      if (!p) { el.innerHTML = '<p class="cf-muted">Cutoff data for this exam coming soon.</p>'; return; }
      el.innerHTML = `
        <div class="cf-predictor-card ${p.safe?'cf-safe':'cf-danger'}">
          <div style="font-size:32px;margin-bottom:8px">${p.safe?'🏆':'📚'}</div>
          <div style="font-size:22px;font-weight:700">${p.pct}% Score</div>
          <div style="margin:8px 0">Estimated Rank: <strong>#${p.rank.toLocaleString()}</strong></div>
          <div style="margin:8px 0">Cutoff (${cat.toUpperCase()}): <strong>${p.cutoff}</strong></div>
          <div class="cf-cutoff-status">${p.safe ? '✅ You\'re above the cutoff! Great job!' : '⚠️ '+p.gap.toFixed(1)+' marks below cutoff. Keep practicing!'}</div>
        </div>
        <button class="cf-btn cf-btn-ghost" style="margin-top:12px;width:100%" onclick="CF.closeModal('cf-score-modal');CF.openAnalytics()">View Your Analytics →</button>`;
    },

    /* ── REFERRAL RENDERING ── */
    _renderReferral() {
      const body = document.getElementById('cf-referral-modal_body');
      if (!body) return;
      const refCode = Referral.getCode();
      const refCount = Referral.getReferralCount();
      body.innerHTML = `
        <p class="cf-muted" style="margin-bottom:12px">Refer 3 friends → Unlock <strong>PYQ Bank & Mock Test</strong> free for you both!</p>
        <div class="cf-ref-code">
          <div class="cf-section-label">YOUR CODE</div>
          <div class="cf-ref-code-val">${refCode}</div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center">
            <button class="cf-btn cf-btn-primary" onclick="Referral.inviteViaWhatsApp()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Invite via WhatsApp
            </button>
            <button class="cf-btn cf-btn-ghost" onclick="Referral.copyInviteLink()">📋 Copy Invite Link</button>
          </div>
        </div>
        <div class="cf-section-label" style="margin-top:16px">REFERRAL PROGRESS</div>
        <div class="cf-ref-progress">
          ${[0,1,2].map(i=>`
            <div class="cf-ref-dot ${i<refCount?'cf-ref-dot-done':'cf-ref-dot-open'}">${i<refCount?'✓':(i+1)}</div>
            ${i<2?'<div class="cf-ref-line"></div>':''}`).join('')}
          <span style="font-size:12px;color:var(--text-secondary,rgba(240,240,245,0.55));margin-left:8px">${refCount}/3 referred</span>
        </div>
        <div class="cf-form-card" style="margin-top:16px">
          <div class="cf-section-label">GOT A FRIEND'S CODE?</div>
          <input class="cf-input" id="cf-ref-input" placeholder="Enter referral code (e.g. CRACKABCD12)" maxlength="14" style="text-transform:uppercase" onkeydown="if(event.key==='Enter')document.getElementById('cf-ref-apply-btn').click()"/>
          <button id="cf-ref-apply-btn" class="cf-btn cf-btn-ghost" style="width:100%" onclick="Referral.applyReferral(document.getElementById('cf-ref-input').value.trim())">✅ Apply Code</button>
        </div>`;
    },
  };

  /* ─────────────────────────────────────────────────────────────
   * SECTION 12 — STYLES
   * ───────────────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('cf-styles')) return;
    const s = document.createElement('style');
    s.id = 'cf-styles';
    s.textContent = `
      /* ── Modal Shell ── */
      .cf-modal {
        display:none;position:fixed;inset:0;z-index:10000;
        background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);
        align-items:flex-end;justify-content:center;
        padding:0;
      }
      .cf-modal.cf-active { display:flex; }
      @media(min-width:600px){
        .cf-modal { align-items:center; padding:20px; }
        .cf-modal-box { max-height:90vh; border-radius:24px !important; }
      }
      .cf-modal-box {
        background:var(--bg-secondary,#111118);
        border:1px solid var(--border,rgba(255,255,255,0.08));
        border-radius:24px 24px 0 0;
        width:100%;max-width:560px;
        max-height:92vh;display:flex;flex-direction:column;
        overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,0.5);
        animation:cfSlideUp 0.28s cubic-bezier(0.34,1.2,0.64,1);
      }
      .cf-modal-wide { max-width:720px; }
      /* Fullscreen modal */
      .cf-modal-fullscreen {
        align-items:stretch !important;
        padding:0 !important;
      }
      .cf-modal-fs-box {
        max-width:100% !important;
        max-height:100vh !important;
        height:100vh !important;
        border-radius:0 !important;
        width:100% !important;
      }
      .cf-modal-fullscreen .cf-modal-body {
        flex:1;
        display:flex;
        flex-direction:column;
      }
      .cf-chat-fullscreen {
        flex:1 !important;
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
      }
      @keyframes cfSlideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
      .cf-modal-hdr {
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));
        flex-shrink:0;
      }
      .cf-modal-title { font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;color:var(--text-primary,#f0f0f5); }
      .cf-modal-close { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary,rgba(240,240,245,0.62));background:var(--surface,#1a1a26);font-size:14px;transition:background 0.2s; }
      .cf-modal-close:hover { background:var(--surface-light,#22223a); }
      .cf-modal-body { padding:16px 20px;overflow-y:auto;flex:1; }
      /* ── Common ── */
      .cf-section-label { font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted,rgba(240,240,245,0.35));margin:4px 0 10px; }
      .cf-muted { color:var(--text-secondary,rgba(240,240,245,0.5));font-size:13px; }
      .cf-red { color:#ef4444; }
      .cf-center-text { text-align:center;padding:12px 0; }
      .cf-center-text h3 { font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:var(--text-primary,#f0f0f5);margin-bottom:6px; }
      .cf-input {
        width:100%;padding:12px 14px;border-radius:12px;
        background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));
        color:var(--text-primary,#f0f0f5);font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;
        margin-bottom:10px;box-sizing:border-box;
      }
      .cf-select { cursor:pointer; }
      .cf-form-card { background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:16px;padding:16px; }
      /* ── Buttons ── */
      .cf-btn { padding:11px 18px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;transition:all 0.18s;cursor:pointer; }
      .cf-btn-primary { background:linear-gradient(135deg,#6C63FF,#FF6B9D);color:#fff;border:none; }
      .cf-btn-primary:hover { transform:translateY(-1px);box-shadow:0 4px 16px rgba(108,99,255,0.4); }
      .cf-btn-ghost { background:var(--surface,#1a1a26);color:var(--text-primary,#f0f0f5);border:1px solid var(--border,rgba(255,255,255,0.08)); }
      .cf-btn-danger { background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3); }
      .cf-btn-sm { padding:7px 14px;font-size:12px; }
      /* ── PYQ ── */
      .cf-exam-grid { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px; }
      .cf-exam-chip {
        padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;
        background:rgba(108,99,255,0.12);
        border:1.5px solid rgba(108,99,255,0.3);
        color:var(--text-primary,#f0f0f5);transition:all 0.18s;cursor:pointer;
      }
      .cf-exam-chip:hover { background:rgba(108,99,255,0.22);border-color:var(--ec,#6C63FF); }
      .cf-year-row { display:flex;flex-wrap:wrap;gap:8px; }
      .cf-year-btn { padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));color:var(--text-primary,#f0f0f5);transition:all 0.18s;cursor:pointer; }
      .cf-year-btn:hover { background:var(--surface-light,#22223a);border-color:var(--accent,#6C63FF); }
      /* ── Class Grid ── */
      .cf-class-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px; }
      .cf-class-card {
        padding:14px 12px;border-radius:14px;text-align:center;cursor:pointer;
        background:rgba(108,99,255,0.08);border:1.5px solid rgba(108,99,255,0.2);
        transition:all 0.18s;
      }
      .cf-class-card:hover { background:rgba(108,99,255,0.18);border-color:var(--ec,#6C63FF);transform:translateY(-2px); }
      .cf-class-label { font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:var(--text-primary,#f0f0f5);margin-bottom:4px; }
      .cf-class-subjects { font-size:10px;color:var(--text-muted,rgba(240,240,245,0.4));line-height:1.4; }
      /* ── Question Card ── */
      .cf-q-card { background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:16px;padding:16px;margin-bottom:12px; }
      .cf-q-num { font-size:11px;font-weight:700;color:var(--text-muted,rgba(240,240,245,0.35));margin-bottom:8px;display:flex;align-items:center;gap:6px; }
      .cf-q-text { font-size:14px;font-weight:500;color:var(--text-primary,#f0f0f5);line-height:1.5;margin-bottom:12px; }
      .cf-opts { display:flex;flex-direction:column;gap:8px; }
      .cf-opt { text-align:left;padding:10px 14px;border-radius:10px;background:var(--bg-secondary,#111118);border:1px solid var(--border,rgba(255,255,255,0.08));color:var(--text-primary,#f0f0f5);font-size:13px;transition:all 0.15s;cursor:pointer; }
      .cf-opt:not(:disabled):hover { background:rgba(108,99,255,0.1);border-color:#6C63FF; }
      .cf-opt-correct { background:rgba(34,197,94,0.15) !important;border-color:#22c55e !important;color:#22c55e !important; }
      .cf-opt-wrong   { background:rgba(239,68,68,0.12) !important;border-color:#ef4444 !important;color:#ef4444 !important; }
      .cf-exp { margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.2);font-size:12px;color:var(--text-secondary,rgba(240,240,245,0.62));line-height:1.5; }
      .cf-topic-tag { font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(108,99,255,0.15);color:#a78bfa;font-weight:600; }
      /* ── Loading ── */
      .cf-loading-wrap { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:12px; }
      .cf-spinner { width:36px;height:36px;border:3px solid rgba(108,99,255,0.2);border-top-color:#6C63FF;border-radius:50%;animation:cfSpin 0.8s linear infinite; }
      @keyframes cfSpin { to { transform:rotate(360deg); } }
      /* ── Mock Test ── */
      .cf-mock-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
      .cf-mock-progress { font-size:13px;font-weight:700;color:var(--text-secondary,rgba(240,240,245,0.62)); }
      .cf-mock-timer { font-size:14px;font-weight:700;color:#22c55e;font-family:'Space Grotesk',sans-serif; }
      .cf-mock-bar-wrap { height:3px;background:var(--border,rgba(255,255,255,0.08));border-radius:2px;overflow:hidden;margin-bottom:4px; }
      .cf-mock-bar { height:100%;background:linear-gradient(90deg,#6C63FF,#FF6B9D);transition:width 0.3s; }
      /* ── Results ── */
      .cf-results-header { text-align:center;padding:12px 0 16px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));margin-bottom:16px; }
      .cf-results-header h2 { font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:var(--text-primary,#f0f0f5); }
      .cf-score-pill { display:inline-block;background:linear-gradient(135deg,#6C63FF,#FF6B9D);color:#fff;padding:6px 18px;border-radius:20px;font-weight:700;font-size:15px;margin-top:6px; }
      .cf-results-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px; }
      .cf-result-stat { text-align:center;padding:12px;border-radius:12px;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08)); }
      .cf-result-stat div { font-size:22px;font-weight:800;color:var(--rc,#fff);font-family:'Space Grotesk',sans-serif; }
      .cf-result-stat span { font-size:10px;color:var(--text-muted,rgba(240,240,245,0.35));font-weight:600; }
      .cf-predictor-card { padding:16px;border-radius:14px;text-align:center;font-size:14px;margin:12px 0; }
      .cf-safe { background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:var(--text-primary,#f0f0f5); }
      .cf-danger { background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:var(--text-primary,#f0f0f5); }
      .cf-cutoff-status { margin-top:10px;font-weight:600;font-size:13px; }
      .cf-ai-review-wrap { margin-top:12px; }
      .cf-ai-review { padding:14px;border-radius:12px;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));font-size:13px;line-height:1.6;color:var(--text-secondary,rgba(240,240,245,0.75));min-height:60px; }
      /* ── Analytics ── */
      .cf-stat-row { display:grid;grid-template-columns:repeat(4,1fr);gap:8px; }
      .cf-stat-card { text-align:center;padding:12px 6px;border-radius:14px;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08)); }
      .cf-stat-val { font-size:18px;font-weight:800;font-family:'Space Grotesk',sans-serif;line-height:1.2; }
      .cf-stat-lbl { font-size:10px;color:var(--text-muted,rgba(240,240,245,0.35));font-weight:600;margin-top:2px; }
      .cf-chart-wrap { display:flex;align-items:flex-end;justify-content:space-between;height:100px;gap:4px;padding:8px 0; }
      .cf-chart-col { flex:1;display:flex;flex-direction:column;align-items:center;gap:3px; }
      .cf-chart-bar-wrap { flex:1;width:100%;display:flex;align-items:flex-end;min-height:60px; }
      .cf-chart-bar { width:100%;min-height:3px;border-radius:4px 4px 0 0;transition:height 0.5s; }
      .cf-chart-lbl { font-size:9px;color:var(--text-muted,rgba(240,240,245,0.35));font-weight:600; }
      .cf-chart-pct { font-size:9px;color:var(--accent,#6C63FF);font-weight:700; }
      .cf-topic-list { display:flex;flex-direction:column;gap:8px; }
      .cf-topic-row { display:flex;align-items:center;gap:8px; }
      .cf-topic-name { font-size:12px;font-weight:600;color:var(--text-secondary,rgba(240,240,245,0.62));width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .cf-topic-bar-wrap { flex:1;height:6px;background:var(--border,rgba(255,255,255,0.08));border-radius:3px;overflow:hidden; }
      .cf-topic-bar { height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(0.34,1.3,0.64,1); }
      .cf-topic-pct { font-size:11px;font-weight:700;width:34px;text-align:right; }
      .cf-weak-alert { padding:14px;border-radius:14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);font-size:13px;color:var(--text-primary,#f0f0f5);line-height:1.6; }
      /* ── Groups ── */
      .cf-group-card { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-radius:16px;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));margin-bottom:10px;transition:border-color 0.2s; }
      .cf-group-card:hover { border-color:rgba(108,99,255,0.35); }
      .cf-group-info strong { font-size:14px;font-weight:700;color:var(--text-primary,#f0f0f5); }
      .cf-group-meta { font-size:11px;color:var(--text-muted,rgba(240,240,245,0.35));margin-top:4px; }
      .cf-group-meta code { background:rgba(108,99,255,0.15);color:#a78bfa;padding:1px 7px;border-radius:6px;font-family:'Space Grotesk',sans-serif;font-weight:700;letter-spacing:0.12em; }

      /* ── Chat Topbar ── */
      .cf-chat-topbar { display:flex;align-items:center;gap:8px;padding:8px 0 12px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));flex-shrink:0; }
      .cf-chat-back { padding:7px 12px;font-size:13px;flex-shrink:0; }
      .cf-chat-topbar-info { flex:1;display:flex;flex-direction:column;min-width:0; }
      .cf-chat-gname { font-size:14px;font-weight:700;color:var(--text-primary,#f0f0f5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .cf-chat-code-btn { font-size:11px;padding:6px 10px;border-radius:10px;flex-shrink:0;font-weight:700;font-family:'Space Grotesk',sans-serif;letter-spacing:0.06em; }

      /* ── Admin Bar ── */
      .cf-admin-bar { background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0;margin:8px 0;flex-wrap:wrap; }

      /* ── Chat Messages (new beautiful design) ── */
      .cf-chat-messages { overflow-y:auto;display:flex;flex-direction:column;gap:3px;padding:10px 0 4px;margin-bottom:8px; }
      .cf-chat-fullscreen { flex:1 !important;height:auto !important;min-height:120px !important;max-height:none !important; }
      .cf-chat-row { display:flex;align-items:flex-end;gap:8px;padding:0 2px; }
      .cf-chat-row-mine { flex-direction:row-reverse; }
      .cf-chat-row-other { flex-direction:row; }
      .cf-chat-avatar { width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6C63FF,#FF6B9D);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-bottom:16px; }
      .cf-chat-avatar-gap { width:28px;flex-shrink:0; }
      .cf-chat-col { display:flex;flex-direction:column;max-width:72%;gap:2px; }
      .cf-chat-sender { font-size:10px;font-weight:600;color:rgba(167,139,250,0.8);padding-left:4px;margin-bottom:1px; }
      .cf-chat-bubble-wrap { display:flex;flex-direction:column; }
      .cf-chat-bubble-wrap.cf-mine { align-items:flex-end; }
      .cf-chat-bubble2 { padding:9px 13px;border-radius:18px;font-size:13.5px;line-height:1.45;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:var(--text-primary,#f0f0f5);word-break:break-word; }
      .cf-mine .cf-chat-bubble2 { background:linear-gradient(135deg,#6C63FF,#5752d1);border-color:transparent;color:#fff;border-bottom-right-radius:4px; }
      .cf-chat-row-other .cf-chat-col .cf-chat-bubble2 { border-bottom-left-radius:4px; }
      .cf-chat-time2 { font-size:9px;color:rgba(200,195,255,0.3);margin-top:3px;padding:0 4px; }
      .cf-mine .cf-chat-time2 { text-align:right; }

      /* ── Chat Input ── */
      .cf-chat-input-row { display:flex;gap:8px;padding-top:8px;flex-shrink:0;align-items:center; }
      .cf-chat-input-row .cf-input { margin-bottom:0;flex:1;border-radius:22px;padding:10px 16px; }
      .cf-chat-send-btn { width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(135deg,#6C63FF,#FF6B9D);border:none; }

      /* ── Quiz Battle ── */
      .cf-quiz-battle-wrap { background:rgba(108,99,255,0.06);border:1px solid rgba(108,99,255,0.2);border-radius:16px;padding:16px;margin:8px 0;flex-shrink:0; }
      .cf-quiz-progress-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:6px; }
      .cf-quiz-qnum { font-size:11px;font-weight:700;color:rgba(200,195,255,0.5);text-transform:uppercase;letter-spacing:0.05em; }
      .cf-quiz-bar-track { height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-bottom:12px;overflow:hidden; }
      .cf-quiz-bar-fill { height:100%;background:linear-gradient(90deg,#6C63FF,#FF6B9D);border-radius:2px;transition:width 0.4s; }
      .cf-quiz-q { font-size:15px;font-weight:600;color:var(--text-primary,#f0f0f5);line-height:1.5;margin-bottom:12px; }
      .cf-quiz-opts { display:flex;flex-direction:column;gap:7px; }
      .cf-quiz-opt { display:flex;align-items:center;gap:10px;text-align:left;padding:10px 14px;border-radius:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-primary,#f0f0f5);font-size:13px;transition:all 0.15s;cursor:pointer; }
      .cf-quiz-opt:not(.cf-quiz-opt-disabled):hover { background:rgba(108,99,255,0.15);border-color:#6C63FF;transform:translateX(3px); }
      .cf-quiz-opt-disabled { cursor:default;pointer-events:none; }
      .cf-quiz-opt-correct { background:rgba(34,197,94,0.15) !important;border-color:#22c55e !important;color:#22c55e !important; }
      .cf-quiz-opt-wrong   { background:rgba(239,68,68,0.12) !important;border-color:#ef4444 !important;color:#ef4444 !important; }
      .cf-quiz-opt-dim     { opacity:0.45; }
      .cf-quiz-opt-letter { width:22px;height:22px;border-radius:50%;background:rgba(108,99,255,0.2);color:#a78bfa;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
      .cf-quiz-answered-banner { margin-top:10px;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:600; }
      .cf-quiz-answered-banner.cf-correct { background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e; }
      .cf-quiz-answered-banner.cf-wrong   { background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);color:#f87171; }
      .cf-quiz-exp { margin-top:8px;padding:8px 12px;border-radius:10px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.15);font-size:12px;color:rgba(200,195,255,0.7);line-height:1.5; }
      .cf-quiz-waiting { margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);font-size:12px;color:#fbbf24;text-align:center; }

      /* ── XP Leaderboard ── */
      .cf-xp-board { margin-top:12px;background:rgba(0,0,0,0.2);border-radius:12px;padding:10px 12px; }
      .cf-xp-row { display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05); }
      .cf-xp-row:last-child { border-bottom:none; }
      .cf-xp-me { background:rgba(108,99,255,0.12);border-radius:8px;padding:5px 8px;margin:-2px -4px; }
      .cf-xp-rank { font-size:16px;width:24px;text-align:center;flex-shrink:0; }
      .cf-xp-name { flex:1;font-size:13px;font-weight:600;color:var(--text-primary,#f0f0f5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .cf-xp-val { font-size:13px;font-weight:800;color:#f59e0b;font-family:'Space Grotesk',sans-serif; }

      .cf-empty-state { text-align:center;padding:32px;color:var(--text-muted,rgba(240,240,245,0.35));font-size:14px; }
      /* ── Daily Goal ── */
      .cf-goal-hero { display:flex;align-items:center;gap:20px;padding:8px 0 16px; }
      .cf-goal-circle {
        position:relative;width:90px;height:90px;border-radius:50%;flex-shrink:0;
        background:conic-gradient(#6C63FF calc(var(--pct)*1%),rgba(255,255,255,0.06) 0);
        display:flex;align-items:center;justify-content:center;
      }
      .cf-goal-inner { width:72px;height:72px;border-radius:50%;background:var(--bg-secondary,#111118);display:flex;flex-direction:column;align-items:center;justify-content:center; }
      .cf-goal-num { font-size:16px;font-weight:800;font-family:'Space Grotesk',sans-serif;color:var(--text-primary,#f0f0f5); }
      .cf-goal-sub { font-size:9px;font-weight:600;color:var(--text-muted,rgba(240,240,245,0.35));text-transform:uppercase; }
      .cf-goal-stats { display:flex;flex-direction:column;gap:12px; }
      .cf-goal-stat { display:flex;flex-direction:column; }
      .cf-goal-stat small { font-size:10px;color:var(--text-muted,rgba(240,240,245,0.35));font-weight:600; }
      .cf-goal-bar-track { height:6px;background:var(--border,rgba(255,255,255,0.08));border-radius:3px;overflow:hidden; }
      .cf-goal-bar-fill { height:100%;background:linear-gradient(90deg,#6C63FF,#FF6B9D);border-radius:3px;transition:width 0.5s; }
      .cf-goal-done { text-align:center;padding:16px;border-radius:14px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e;font-weight:600;font-size:14px; }
      /* ── Referral ── */
      .cf-ref-code { background:var(--surface,#1a1a26);border:1px solid rgba(108,99,255,0.4);border-radius:14px;padding:18px;text-align:center;margin:12px 0; }
      .cf-ref-code-val { font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;letter-spacing:0.12em;color:#a78bfa;margin:8px 0; }
      .cf-ref-progress { display:flex;align-items:center;gap:8px;margin:12px 0; }
      .cf-ref-dot { width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700; }
      .cf-ref-dot-done { background:rgba(34,197,94,0.2);border:2px solid #22c55e;color:#22c55e; }
      .cf-ref-dot-open { background:var(--surface,#1a1a26);border:2px solid var(--border,rgba(255,255,255,0.08));color:var(--text-muted,rgba(240,240,245,0.35)); }
      .cf-ref-line { flex:1;height:2px;background:var(--border,rgba(255,255,255,0.08)); }
      /* ── Sidebar Feature Section ── */
      #cf-sidebar-features {
        padding:8px 12px 4px;
        border-bottom:1px solid var(--border,rgba(255,255,255,0.08));
        margin-bottom:4px;
      }
      #cf-sidebar-features .cf-sidebar-title {
        font-size:10px;font-weight:700;text-transform:uppercase;
        letter-spacing:0.1em;color:var(--text-muted,rgba(240,240,245,0.35));
        padding:4px 2px 6px;
      }
      .cf-sidebar-btn {
        display:flex;align-items:center;gap:10px;
        padding:9px 10px;border-radius:10px;
        background:none;border:none;
        color:var(--text-secondary,rgba(240,240,245,0.7));
        font-size:13px;font-weight:600;
        font-family:'Plus Jakarta Sans',sans-serif;
        cursor:pointer;transition:background 0.15s;
        text-align:left;width:100%;
      }
      .cf-sidebar-btn:hover { background:var(--surface,#1a1a26); }
      .cf-sidebar-btn .cf-sb-icon { font-size:16px;flex-shrink:0;width:20px;text-align:center; }
      /* ── Daily progress bar in sidebar ── */
      #cf-daily-bar {
        display:flex;align-items:center;gap:8px;
        padding:6px 10px;margin:2px 0;border-radius:10px;
        background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.06));
        font-size:11px;font-weight:600;color:var(--text-secondary,rgba(240,240,245,0.55));
        cursor:pointer;transition:background 0.18s;
      }
      #cf-daily-bar:hover { background:var(--surface-light,#22223a); }
      #cf-goal-bar-track { flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden; }
      #cf-goal-bar { height:100%;background:linear-gradient(90deg,#6C63FF,#FF6B9D);border-radius:2px;transition:width 0.4s; }
      /* Hide message limit counter on home page */
      #messageLimitInfo { display:none !important; }
      /* Light theme */
      [data-theme="light"] .cf-modal-box { box-shadow:0 -8px 40px rgba(0,0,0,0.15); }
      [data-theme="light"] .cf-exam-chip { color:#1a1a2e; }
      [data-theme="light"] .cf-year-btn { color:#1a1a2e; }
      [data-theme="light"] .cf-sidebar-btn { color:rgba(20,20,40,0.75); }
      /* ── Mobile responsive overrides ── */
      @media(max-width:480px) {
        .cf-results-grid { grid-template-columns:repeat(2,1fr) !important; }
        .cf-stat-row { grid-template-columns:repeat(2,1fr) !important; }
        .cf-goal-hero { flex-direction:column;align-items:center;gap:12px; }
        .cf-goal-stats { display:flex;gap:16px;justify-content:center; }
        .cf-modal-box { border-radius:20px 20px 0 0 !important; }
        .cf-modal-body { padding:12px 14px !important; }
        .cf-class-grid { grid-template-columns:repeat(2,1fr) !important; }
        .cf-group-card { flex-direction:column;align-items:flex-start;gap:8px; }
        .cf-group-card .cf-btn-sm { align-self:stretch;text-align:center; }
        .cf-chat-messages { height:200px; }
        .cf-sidebar-btn { font-size:13px;padding:9px 10px; }
        .cf-q-text { font-size:13px; }
        .cf-opt { font-size:12px;padding:9px 12px; }
        .cf-section-label { font-size:11px; }
        #cf-drawer-scroll { -webkit-overflow-scrolling:touch; }
      }
      @media(max-width:360px) {
        .cf-results-grid { grid-template-columns:repeat(2,1fr) !important; gap:6px !important; }
        .cf-result-stat div { font-size:18px !important; }
        .cf-modal-body { padding:10px 12px !important; }
        .cf-btn { padding:10px 14px;font-size:12px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────────────────────
   * SECTION 13 — DOM INJECTION
   * ───────────────────────────────────────────────────────────── */
  function injectDOM() {
    /* ── 1. PYQ Modal ── */
    createModal('cf-pyq-modal', '📚 PYQ Question Bank', '', { wide: true });

    /* ── 2. Mock Test Modal ── */
    createModal('cf-mock-modal', '🎯 Timed Mock Test', '', { wide: true });

    /* ── 3. Analytics Modal ── */
    createModal('cf-analytics-modal', '📊 Analytics Dashboard', '');

    /* ── 4. Study Groups Modal (FULLSCREEN) ── */
    createFullscreenModal('cf-groups-modal', '👥 Group Study');

    /* ── 5. Daily Goal Modal ── */
    createModal('cf-daily-modal', '🔥 Daily Study Goal', '');

    /* ── 6. Score Predictor Modal ── */
    createModal('cf-score-modal', '🏆 Score Predictor', '');

    /* ── 7. Referral Modal ── */
    createModal('cf-referral-modal', '🎁 Refer & Earn', '');

    /* ── 8. Exam Expansion Modal ── */
    createModal('cf-exam-modal', '📖 Exam & Class Expansion', '', { wide: true });

    /* ── 9. Inject Features section into SIDEBAR with scroll wrapper ── */
    const drawerList = document.getElementById('historyList');
    if (drawerList && !document.getElementById('cf-sidebar-features')) {
      const items = [
        { icon:'📚', label:'PYQ Bank',       cb:'CF.openPYQ()',        premium:true  },
        { icon:'🎯', label:'Mock Test',       cb:'MockTest._state=null;CF.openMockTest()', premium:true },
        { icon:'📊', label:'Analytics',       cb:'CF.openAnalytics()', premium:true  },
        { icon:'🔥', label:'Daily Goal',      cb:'CF.openDailyGoal()', premium:false },
        { icon:'🏆', label:'Rank Predictor',  cb:'CF.openScorePredictor()', premium:false },
        { icon:'👥', label:'Group Study',     cb:'CF.openStudyGroups()', premium:false },
        { icon:'🎁', label:'Refer & Earn',    cb:'CF.openReferral()', premium:false },
      ];

      // Build study tools block
      const featureWrap = document.createElement('div');
      featureWrap.id = 'cf-sidebar-features';
      featureWrap.innerHTML = `
        <div class="cf-sidebar-title">Study Tools</div>
        <div id="cf-daily-bar" title="Daily goal" onclick="CF.openDailyGoal()">
          <span>🎯</span>
          <div id="cf-goal-bar-track"><div id="cf-goal-bar"></div></div>
          <span id="cf-daily-badge">0/${DailyGoal.GOAL}</span>
        </div>
        ${items.map(i=>`
          <button class="cf-sidebar-btn" onclick="${i.cb};document.getElementById('historyDrawer')?.classList.remove('open')" style="${i.premium&&!isPrem()?'opacity:0.85;':''}" title="${i.premium&&!isPrem()?i.label+' — Premium':'i.label'}">
            <span class="cf-sb-icon">${i.icon}</span>
            <span style="flex:1;text-align:left">${i.label}</span>
            ${i.premium && !isPrem() ? '<span style="font-size:9px;font-weight:700;background:linear-gradient(135deg,#6C63FF,#FF6B9D);color:#fff;padding:1px 6px;border-radius:8px;margin-left:auto;flex-shrink:0">PRO</span>' : ''}
          </button>`).join('')}
      `;

      // Create ONE scrollable container for tools + recent chats + history
      // so the bottom nav (Settings) is always pinned and visible
      const scrollWrap = document.createElement('div');
      scrollWrap.id = 'cf-drawer-scroll';

      // Find the "Recent Chats" section label (element before historyList)
      const recentLabel = drawerList.previousElementSibling;
      const parent = drawerList.parentNode;

      // Insert scrollWrap where historyList currently is
      parent.insertBefore(scrollWrap, drawerList);

      // Move "Recent Chats" section label into scrollWrap (if it's the .drawer-section)
      if (recentLabel && recentLabel.classList && recentLabel.classList.contains('drawer-section')) {
        scrollWrap.appendChild(recentLabel);
      }

      // Move historyList into scrollWrap
      scrollWrap.appendChild(drawerList);

      // Prepend Study Tools BEFORE the recent chats label inside scrollWrap
      scrollWrap.insertBefore(featureWrap, scrollWrap.firstChild);
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * SECTION 14 — CHAT INTENT INTERCEPTOR
   * ───────────────────────────────────────────────────────────── */
  function interceptChatForFeatures(userInput) {
    const lower = userInput.toLowerCase();
    const isPYQQuery = /(pyq|previous year|prev year|last year|2024|2023|2022|2021|2020|question bank|cgl question|chsl question)/.test(lower);
    const isMockQuery = /(mock test|full test|practice test|100 question|timed test|exam test)/.test(lower);
    const isGoalQuery = /(daily goal|study goal|streak|today target|how many today)/.test(lower);
    const isAnalyticQuery = /(analytics|my progress|weak topic|performance|accuracy|rank predict|score predict)/.test(lower);
    const isGroupQuery = /(study group|group chat|shared session|group study)/.test(lower);
    const isReferralQuery = /(refer|referral|free premium|invite friend)/.test(lower);
    if (isPYQQuery) setTimeout(()=>CF.openPYQ(), 400);
    else if (isMockQuery) setTimeout(()=>CF.openMockTest(), 400);
    else if (isGoalQuery) setTimeout(()=>CF.openDailyGoal(), 400);
    else if (isAnalyticQuery) setTimeout(()=>CF.openAnalytics(), 400);
    else if (isGroupQuery) setTimeout(()=>CF.openStudyGroups(), 400);
    else if (isReferralQuery) setTimeout(()=>CF.openReferral(), 400);
  }

  function patchSendMessageForFeatures() {
    const _orig = global.sendMessage;
    if (typeof _orig !== 'function') { setTimeout(patchSendMessageForFeatures, 200); return; }
    if (_orig._cfPatched) return;
    function patched() {
      try {
        const input = document.getElementById('messageInput');
        if (input && input.value) interceptChatForFeatures(input.value);
      } catch {}
      return _orig.apply(this, arguments);
    }
    patched._cfPatched = true;
    global.sendMessage = patched;
  }

  /* ─────────────────────────────────────────────────────────────
   * SECTION 15 — INIT
   * ───────────────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    injectDOM();
    patchSendMessageForFeatures();
    DailyGoal.updateBadge();
    global.Referral = Referral;
    global.MockTest = MockTest;
    setInterval(() => DailyGoal.updateBadge(), 10000);
    console.info('[CrackAI Features] v2.0 loaded — AI questions, fullscreen groups, sidebar features, invite button');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }

  global._CrackAI = { MockTest, WeakTopics, Analytics, DailyGoal, ScorePredictor, StudyGroups, Referral, XP, EXAM_CONFIGS };

})(window);