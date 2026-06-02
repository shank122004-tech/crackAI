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
        code = 'CRACK' + uid().substring(0,6).toUpperCase();
        lsSet('ref_code', code);
      }
      return code;
    },
    getReferralCount() { return lsGet('ref_count', '0') || 0; },
    applyReferral(code) {
      if (lsGet('ref_used', 'null')) { toast('⚠️ You have already used a referral code.'); return; }
      const myCode = this.getCode();
      if (code === myCode) { toast('⚠️ You cannot use your own code!'); return; }
      lsSet('ref_used', code);
      toast('✅ Referral code applied! Your friend gets credit.', 3000);
    },
    registerReferral() {
      const n = (lsGet('ref_count','0')||0) + 1;
      lsSet('ref_count', n);
      if (n >= this.REFS_NEEDED) {
        // Grant limited referral unlock: only PYQ Bank + Mock Test (NOT full premium)
        lsSet('ref_tools_unlocked', true);
        toast('🎉 3 referrals complete! PYQ Bank & Mock Test unlocked for free! 🏆', 4000);
        confetti();
      } else {
        toast('👥 Referral registered! ' + n + '/' + this.REFS_NEEDED + ' done.', 3000);
      }
    },
    getShareText() {
      return 'Join CrackAI — India\'s smartest SSC prep app! Use code ' + this.getCode() + ' for bonus access 🚀\nhttps://easyfreepdf.online/?ref=' + this.getCode();
    },
    getShareUrl() {
      return 'https://easyfreepdf.online/?ref=' + this.getCode();
    },
    inviteViaWhatsApp() {
      const text = encodeURIComponent(this.getShareText());
      window.open('https://wa.me/?text=' + text, '_blank');
    },
    copyInviteLink() {
      const url = this.getShareUrl();
      const text = this.getShareText();
      const toCopy = url; // copy just the clean URL
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(toCopy)
            .then(() => toast('📋 Invite link copied!'))
            .catch(() => {
              // fallback if clipboard permission denied
              const ta = document.createElement('textarea');
              ta.value = toCopy;
              ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
              document.body.appendChild(ta);
              ta.focus(); ta.select();
              document.execCommand('copy');
              ta.remove();
              toast('📋 Invite link copied!');
            });
        } else {
          const ta = document.createElement('textarea');
          ta.value = toCopy;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          document.execCommand('copy');
          ta.remove();
          toast('📋 Invite link copied!');
        }
      } catch (e) {
        toast('⚠️ Could not copy — please copy manually: ' + toCopy, 4000);
      }
    }
  };

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
   * SECTION 9 — STUDY GROUPS (Full Screen)
   * ───────────────────────────────────────────────────────────── */
  const StudyGroups = {
    // Use a SHARED key (no UID prefix) so groups created by one user
    // can be found by another user joining via code on the same device/browser.
    // For cross-device support, the code is shown to the creator so they can
    // share it; the join lookup searches both shared and user-specific stores.
    _sharedKey: 'sscai_shared_groups',
    _getShared() { try { return JSON.parse(localStorage.getItem(this._sharedKey) || '[]') || []; } catch { return []; } },
    _setShared(v) { try { localStorage.setItem(this._sharedKey, JSON.stringify(v)); } catch {} },
    getAll() {
      // Return groups where current user is a member
      const all = this._getShared();
      const me = uid();
      return all.filter(g => g.members.includes(me));
    },
    create(name, exam) {
      const all = this._getShared();
      const group = {
        id: 'grp_' + Date.now(),
        name, exam,
        code: Math.random().toString(36).substring(2,8).toUpperCase(),
        members: [uid()],
        messages: [],
        createdAt: Date.now()
      };
      all.push(group);
      this._setShared(all);
      toast('✅ Study group "' + name + '" created! Code: ' + group.code, 4000);
      return group;
    },
    join(code) {
      const all = this._getShared();
      const group = all.find(g => g.code === code.toUpperCase());
      if (!group) { toast('❌ Group not found. Check the code and try again.'); return null; }
      const me = uid();
      if (!group.members.includes(me)) group.members.push(me);
      this._setShared(all);
      toast('✅ Joined group "' + group.name + '"!', 3000);
      return group;
    },
    addMessage(groupId, text) {
      const all = this._getShared();
      const g = all.find(g => g.id === groupId);
      if (!g) return;
      g.messages.push({ uid: uid(), name: (typeof state!=='undefined'?state.user?.displayName:'Student')||'Student', text, ts: Date.now() });
      if (g.messages.length > 200) g.messages.splice(0, g.messages.length - 200);
      this._setShared(all);
    }
  };

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
      const groups = StudyGroups.getAll();
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <button class="cf-btn cf-btn-primary" onclick="CF._showCreateGroup()">➕ Create Group</button>
          <button class="cf-btn cf-btn-ghost" onclick="CF._showJoinGroup()">🔗 Join Group</button>
        </div>
        <div id="cf-group-form"></div>
        ${groups.length ? `
          <div class="cf-section-label">Your Groups</div>
          ${groups.map(g=>CF._renderGroupCard(g)).join('')}
        ` : '<div class="cf-empty-state">💬 No groups yet. Create or join a study group!</div>'}`;
    },
    _renderGroupCard(g) {
      return `
        <div class="cf-group-card">
          <div class="cf-group-info">
            <strong>${g.name}</strong> <span class="cf-topic-tag">${EXAM_CONFIGS[g.exam]?.label||g.exam}</span>
            <div class="cf-group-meta">👥 ${g.members.length} members · Code: <code>${g.code}</code></div>
          </div>
          <button class="cf-btn cf-btn-sm cf-btn-primary" onclick="CF._openGroupChat('${g.id}')">Open Chat</button>
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
          <button class="cf-btn cf-btn-primary" style="width:100%" onclick="CF._createGroup()">Create</button>
        </div>`;
    },
    _createGroup() {
      const name = document.getElementById('cf-grp-name')?.value?.trim();
      const exam = document.getElementById('cf-grp-exam')?.value;
      if (!name) { toast('Please enter a group name'); return; }
      StudyGroups.create(name, exam);
      CF._renderGroups();
    },
    _showJoinGroup() {
      const el = document.getElementById('cf-group-form');
      if (!el) return;
      el.innerHTML = `
        <div class="cf-form-card">
          <input class="cf-input" id="cf-join-code" placeholder="Enter 6-digit group code" maxlength="6" style="text-transform:uppercase;letter-spacing:0.15em" />
          <button class="cf-btn cf-btn-primary" style="width:100%" onclick="CF._joinGroup()">Join</button>
        </div>`;
    },
    _joinGroup() {
      const code = document.getElementById('cf-join-code')?.value?.trim();
      if (!code) { toast('Please enter a group code'); return; }
      const g = StudyGroups.join(code);
      if (g) CF._renderGroups();
    },
    _openGroupChat(groupId) {
      const groups = StudyGroups.getAll();
      const g = groups.find(g=>g.id===groupId);
      if (!g) return;
      const body = document.getElementById('cf-groups-modal_body');
      body.innerHTML = `
        <button class="cf-btn cf-btn-ghost" style="margin-bottom:12px" onclick="CF._renderGroups()">← Back to Groups</button>
        <div class="cf-chat-header"><strong>${g.name}</strong> <span class="cf-topic-tag">${EXAM_CONFIGS[g.exam]?.label||g.exam}</span> · 👥 ${g.members.length}</div>
        <div class="cf-chat-messages cf-chat-fullscreen" id="cf-chat-msgs">
          ${g.messages.length ? g.messages.map(m=>`
            <div class="cf-chat-msg ${m.uid===uid()?'cf-chat-mine':''}">
              <div class="cf-chat-name">${m.name}</div>
              <div class="cf-chat-bubble">${m.text.replace(/</g,'&lt;')}</div>
              <div class="cf-chat-time">${new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>`).join('') : '<div class="cf-muted" style="text-align:center;padding:24px">No messages yet. Say hello! 👋</div>'}
        </div>
        <div class="cf-chat-input-row">
          <input class="cf-input" id="cf-chat-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter')CF._sendGroupMsg('${groupId}')" />
          <button class="cf-btn cf-btn-primary" onclick="CF._sendGroupMsg('${groupId}')">Send</button>
        </div>`;
      const msgs = document.getElementById('cf-chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    },
    _sendGroupMsg(groupId) {
      const input = document.getElementById('cf-chat-input');
      if (!input || !input.value.trim()) return;
      StudyGroups.addMessage(groupId, input.value.trim());
      input.value = '';
      CF._openGroupChat(groupId);
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

      // Determine exam/class label from state.sscMode
      const sscMode = (typeof state !== 'undefined' && state.sscMode) || 'cgl';
      const modeConf = EXAM_CONFIGS[sscMode];
      const modeLabel = modeConf ? modeConf.label : (sscMode.startsWith('class') ? ('Class ' + sscMode.replace('class','')) : sscMode.toUpperCase());
      const isClass = modeConf && modeConf.type === 'class';
      const goalLabel = isClass ? (modeLabel + ' Practice') : (modeLabel + ' Prep');

      // Class-specific daily recommended topics
      const CLASS_TOPICS = {
        class9:  ['Triangles (Geometry)', 'Laws of Motion (Physics)', 'Democratic Politics', 'The French Revolution', 'Matter in Our Surroundings'],
        class10: ['Trigonometry', 'Carbon & its Compounds', 'Nationalism in India', 'Electricity (Physics)', 'Real Numbers'],
        class11: ['Complex Numbers', 'Laws of Thermodynamics', 'Organic Chemistry Basics', 'Indian Constitution', 'Kinematics'],
        class12: ['Integration (Maths)', 'Electrochemistry', 'Human Reproduction', 'Electromagnetic Induction', 'Probability'],
      };
      const SSC_TOPICS = {
        cgl:  ['Quantitative Aptitude — Percentage', 'English — Reading Comprehension', 'General Awareness — Current Affairs', 'Reasoning — Syllogism'],
        chsl: ['English — Fill in the Blanks', 'Maths — Speed, Time & Distance', 'GK — History of India', 'Reasoning — Series'],
        gd:   ['Maths — Number System', 'GK — Indian Polity', 'English — Vocabulary', 'Reasoning — Analogy'],
        mts:  ['Maths — Simple Interest', 'GK — Geography', 'English — Grammar', 'Reasoning — Coding-Decoding'],
        cpo:  ['Maths — Profit & Loss', 'GK — Science & Technology', 'English — Error Detection', 'Reasoning — Direction Sense'],
      };
      const todayDayIdx = new Date().getDay(); // 0-6
      const allRec = (isClass ? (CLASS_TOPICS[sscMode] || CLASS_TOPICS['class10']) : (SSC_TOPICS[sscMode] || SSC_TOPICS['cgl']));
      // Pick 3 topics rotating daily
      const recommendedTopics = [allRec[todayDayIdx % allRec.length], allRec[(todayDayIdx+1) % allRec.length], allRec[(todayDayIdx+2) % allRec.length]];

      body.innerHTML = `
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--primary,#6C63FF);margin-bottom:10px;text-align:center">📚 ${goalLabel}</div>
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
          <div style="font-weight:700;margin-bottom:8px;color:var(--primary,#6C63FF)">📅 Recommended for Today — ${modeLabel}</div>
          ${recommendedTopics.map((t,i)=>`<div style="margin:5px 0;display:flex;align-items:center;gap:6px"><span style="font-size:13px">${['🎯','📖','⚡'][i]}</span> <strong>${t}</strong></div>`).join('')}
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
          <input class="cf-input" id="cf-ref-input" placeholder="Enter referral code" maxlength="12" style="text-transform:uppercase"/>
          <button class="cf-btn cf-btn-ghost" style="width:100%" onclick="Referral.applyReferral(document.getElementById('cf-ref-input').value.trim())">Apply Code</button>
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
      .cf-group-card { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-radius:14px;background:var(--surface,#1a1a26);border:1px solid var(--border,rgba(255,255,255,0.08));margin-bottom:10px; }
      .cf-group-info strong { font-size:14px;font-weight:700;color:var(--text-primary,#f0f0f5); }
      .cf-group-meta { font-size:11px;color:var(--text-muted,rgba(240,240,245,0.35));margin-top:4px; }
      .cf-group-meta code { background:rgba(108,99,255,0.15);color:#a78bfa;padding:1px 6px;border-radius:6px;font-family:'Space Grotesk',sans-serif;font-weight:700;letter-spacing:0.1em; }
      .cf-chat-header { font-size:14px;font-weight:600;padding:10px 0 12px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));margin-bottom:10px;display:flex;align-items:center;gap:8px; }
      .cf-chat-messages { height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0;margin-bottom:12px; }
      .cf-chat-msg { max-width:80%; }
      .cf-chat-mine { align-self:flex-end; }
      .cf-chat-name { font-size:10px;font-weight:600;color:var(--text-muted,rgba(240,240,245,0.35));margin-bottom:2px;padding-left:4px; }
      .cf-chat-mine .cf-chat-name { text-align:right;padding-right:4px;padding-left:0; }
      .cf-chat-bubble { padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.4;background:var(--surface,#1a1a26);color:var(--text-primary,#f0f0f5); }
      .cf-chat-mine .cf-chat-bubble { background:linear-gradient(135deg,#6C63FF,#5752d1);color:#fff; }
      .cf-chat-time { font-size:9px;color:var(--text-muted,rgba(240,240,245,0.35));margin-top:2px;padding-left:4px; }
      .cf-chat-input-row { display:flex;gap:8px;padding-top:8px;flex-shrink:0; }
      .cf-chat-input-row .cf-input { margin-bottom:0;flex:1; }
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