const DEFAULT_URL = 'https://pjacpgpysrdnotdezxrh.supabase.co';
  // নিচে আপনার Supabase Anon / Publishable Key বসালে নতুন ইউজাররা সেটআপ ছাড়াই সরাসরি সাইন-আপ করতে পারবে:
  const DEFAULT_ANON_KEY = '';
  const AUTO_REFRESH_INTERVAL_SEC = 60;
  const DEFAULT_ASSETS = {
    nifty:    { name: 'Nifty 50 ETF',   type: 'ইক্যুইটি সূচক',        taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    gold:     { name: 'Gold ETF',       type: 'নিরাপদ হেজ',          taxCat: 'GOLD',   isCrypto: false, broker: 'Groww',   isCustom: false },
    silver:   { name: 'Silver ETF',     type: 'কমোডিটি হেজ',        taxCat: 'GOLD',   isCrypto: false, broker: 'Groww',   isCustom: false },
    tcs:      { name: 'TCS',            type: 'আইটি লার্জ-ক্যাপ',    taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    hdfc:     { name: 'HDFC Bank',      type: 'ব্যাংকিং লিডার',      taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    reliance: { name: 'Reliance Ind.',  type: 'ব্লু-চিপ লার্জ-ক্যাপ', taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    infy:     { name: 'Infosys',        type: 'আইটি লার্জ-ক্যাপ',    taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    icici:    { name: 'ICICI Bank',     type: 'ব্যাংকিং লিডার',      taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    sbi:      { name: 'SBI',            type: 'পিএসইউ ব্যাংক',       taxCat: 'EQUITY', isCrypto: false, broker: 'Groww',   isCustom: false },
    btc:      { name: 'Bitcoin (BTC)',  type: 'ক্রিপ্টো (উচ্চ ঝুঁকি)', taxCat: 'CRYPTO', isCrypto: true,  broker: 'Binance', isCustom: false },
    eth:      { name: 'Ethereum (ETH)', type: 'ক্রিপ্টো (উচ্চ ঝুঁকি)', taxCat: 'CRYPTO', isCrypto: true,  broker: 'Binance', isCustom: false },
    sol:      { name: 'Solana (SOL)',   type: 'ক্রিপ্টো (উচ্চ ঝুঁকি)', taxCat: 'CRYPTO', isCrypto: true,  broker: 'Binance', isCustom: false }
  };
  let customAssetsList = [];
  let ASSETS = { ...DEFAULT_ASSETS };

  function syncAssetsFromState() {
    const raw = (stateData && stateData.profile && Array.isArray(stateData.profile.custom_assets))
      ? stateData.profile.custom_assets
      : [];
    customAssetsList = raw;
    const merged = { ...DEFAULT_ASSETS };
    for (const item of raw) {
      if (!item || !item.id) continue;
      const id = String(item.id).toLowerCase();
      if (merged[id]) continue;
      const isCrypto = item.type === 'CRYPTO';
      merged[id] = {
        name: String(item.name || item.symbol || id),
        type: isCrypto ? 'কাস্টম ক্রিপ্টো' : 'কাস্টম স্টক / ETF',
        taxCat: isCrypto ? 'CRYPTO' : (item.taxCat === 'GOLD' ? 'GOLD' : 'EQUITY'),
        isCrypto,
        broker: isCrypto ? 'Binance' : 'Groww',
        symbol: item.symbol || '',
        isCustom: true
      };
    }
    ASSETS = merged;
    refreshAssetDropdowns();
  }

  function refreshAssetDropdowns() {
    const syncSel = document.getElementById('syncAsset');
    if (syncSel) {
      const prev = syncSel.value;
      syncSel.innerHTML = Object.entries(ASSETS).map(([id, info]) =>
        '<option value="' + escapeHtml(id) + '">' + escapeHtml(info.name) + ' (' + escapeHtml(info.broker) + ')</option>'
      ).join('');
      if (prev && ASSETS[prev]) syncSel.value = prev;
    }
    const pbSel = document.getElementById('pbAssetFilter');
    if (pbSel) {
      const prevPb = pbSel.value || 'ALL';
      pbSel.innerHTML = '<option value="ALL">সব অ্যাসেট</option>' + Object.entries(ASSETS).map(([id, info]) =>
        '<option value="' + escapeHtml(id) + '">' + escapeHtml(info.name) + '</option>'
      ).join('');
      pbSel.value = (prevPb === 'ALL' || ASSETS[prevPb]) ? prevPb : 'ALL';
    }
    const btSel = document.getElementById('btAsset');
    if (btSel) {
      const prevBt = btSel.value || 'nifty';
      btSel.innerHTML = Object.entries(ASSETS).map(([id, info]) =>
        '<option value="' + escapeHtml(id) + '">' + escapeHtml(info.name) + ' (' + escapeHtml(info.broker) + ')</option>'
      ).join('');
      btSel.value = (prevBt && ASSETS[prevBt]) ? prevBt : 'nifty';
    }
  }

  let currency = 'INR';
  let USD_RATE = 85.0;
  let goldTaxSlab = Number(localStorage.getItem('sy_tax_slab') ?? 10);
  let autoLiveEnabled = localStorage.getItem('sy_auto_live') !== 'off';
  let isAdminUnlocked = false;
  let authSession = null; // { access_token, refresh_token, user }
  let userProfile = null; // { id, username, email, phone, sync_id, initial_capital }
  let pendingSignUp = null; // { username, email, phone, initial_capital }
  let resendCooldown = 0;
  let forgotCooldown = 0;
  let recoveryAccessToken = '';
  let pendingAdminAction = null;
  let countdownSec = AUTO_REFRESH_INTERVAL_SEC;
  let isFetchingRates = false;
  let isChatSending = false;
  let timerHandle = null;

  let stateData = { cash: 10000, practice_day: 1, holdings: {} };
  let memoryData = { initial_capital: 10000, win_count: 0, loss_count: 0, total_trades: 0, strategy_weights: { dip_buying: 1, smart_sip: 1, gold_hedge: 1, profit_lock: 1 }, lessons: [] };
  let logsData = [];
  let liveMarketOverride = null;
  let liveNewsList = [];
  let newsLoadedOnce = false;
  let activeNewsFilter = 'ALL';
  let activePassbookType = 'ALL';
  let activePassbookAsset = 'ALL';
  let chartInstance = null;
  let allocChartInstance = null;
  let backtestChartInstance = null;
  let chartDisplayMode = 'value'; // 'value' | 'benchmark'
  let benchmarkNiftySeries = null;
  let parsedCsvTrades = [];
  let isDarkMode = localStorage.getItem('sy_dark_mode') === 'on';
  let chatHistory = [];

  try {
    const savedChat = JSON.parse(localStorage.getItem('sy_chat_history') || '[]');
    if (Array.isArray(savedChat) && savedChat.length) chatHistory = savedChat.slice(-20);
  } catch (_) {}

  if (!chatHistory.length) {
    chatHistory = [{
      role: 'ai',
      text: 'নমস্কার! আমি আপনার SafeYield AI অ্যাডভাইজার। লাইভ মার্কেট রেট, RSI, নিউজ ও আপনার পোর্টফোলিও দেখে কোনটা কিনবেন বা বেচবেন—সব স্টেপ-বাই-স্টেপ বলে দেব। আপনি বাস্তবে Groww বা Binance-এ ট্রেড করে এখানে লিখলেই আমি পোর্টফোলিও সিঙ্ক করে দেব।',
      steps: [
        'জিজ্ঞাসা করুন: "আজ কী কিনবো ও বেচবো?"',
        'রিয়েল ট্রেড সিঙ্ক করতে লিখুন: "Groww-এ Nifty ETF ₹650 কিনেছি" বা নিচের সিঙ্ক ফর্ম ব্যবহার করুন।'
      ],
      suggested_sync: null
    }];
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCfg() {
    const ext = (typeof window !== 'undefined' && window.SAFEYIELD_CONFIG && typeof window.SAFEYIELD_CONFIG === 'object') ? window.SAFEYIELD_CONFIG : {};
    const extKey = String(ext.SUPABASE_ANON_KEY || ext.key || '').trim();
    const extUrl = String(ext.SUPABASE_URL || ext.url || '').trim();
    const savedKey = localStorage.getItem('sy_key') || localStorage.getItem('sb_key') || localStorage.getItem('supabase_key') || extKey || DEFAULT_ANON_KEY || '';
    const savedUrl = localStorage.getItem('sy_url') || localStorage.getItem('sb_url') || extUrl || DEFAULT_URL;
    const activeSync = (userProfile && userProfile.sync_id)
      ? userProfile.sync_id
      : (localStorage.getItem('sy_sync') || localStorage.getItem('sync_id') || '');
    return { url: savedUrl.trim(), key: savedKey.trim(), syncId: activeSync.trim() };
  }

  function getAuthToken() {
    return (authSession && authSession.access_token) ? authSession.access_token : '';
  }

  function fmt(inr) {
    const val = Number(inr || 0);
    if (currency === 'USD') return '$' + (val / USD_RATE).toFixed(2);
    return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function toBnNum(n) {
    const d = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(n).replace(/\d/g, x => d[Number(x)]);
  }

  function setCurrency(c) {
    currency = c;
    document.getElementById('btnINR').classList.toggle('active', c === 'INR');
    document.getElementById('btnUSD').classList.toggle('active', c === 'USD');
    renderAll();
  }

  function changeTaxSlab(val) {
    goldTaxSlab = Number(val || 0);
    localStorage.setItem('sy_tax_slab', String(goldTaxSlab));
    renderAll();
  }

  function updateAutoLiveUI() {
    const btn = document.getElementById('autoLiveBtn');
    const badge = document.getElementById('autoTimerBadge');
    if (btn) {
      btn.textContent = autoLiveEnabled ? '⏱️ অটো-লাইভ: ON' : '⏸️ অটো-লাইভ: OFF';
      btn.classList.toggle('auto-on', autoLiveEnabled);
      btn.classList.toggle('auto-off', !autoLiveEnabled);
    }
    if (badge) {
      if (!autoLiveEnabled) badge.textContent = '⏸️ অটো-আপডেট বন্ধ';
      else if (isFetchingRates) badge.textContent = '📡 লাইভ রেট আপডেট হচ্ছে...';
      else badge.textContent = '⏱️ পরের আপডেট: ' + toBnNum(countdownSec) + ' সে.';
    }
  }

  function toggleAutoLive() {
    autoLiveEnabled = !autoLiveEnabled;
    localStorage.setItem('sy_auto_live', autoLiveEnabled ? 'on' : 'off');
    if (autoLiveEnabled) {
      countdownSec = AUTO_REFRESH_INTERVAL_SEC;
      fetchLiveRatesOnly(true);
    }
    updateAutoLiveUI();
  }

  function startAutoLiveTimer() {
    if (timerHandle) clearInterval(timerHandle);
    updateAutoLiveUI();
    timerHandle = setInterval(() => {
      if (!autoLiveEnabled || document.hidden || !authSession || !userProfile) return;
      const c = getCfg();
      if (!c.key || isFetchingRates) return;
      countdownSec--;
      if (countdownSec <= 0) {
        countdownSec = AUTO_REFRESH_INTERVAL_SEC;
        fetchLiveRatesOnly(true);
      }
      updateAutoLiveUI();
    }, 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && autoLiveEnabled && authSession && userProfile && getCfg().key) {
      countdownSec = AUTO_REFRESH_INTERVAL_SEC;
      fetchLiveRatesOnly(true);
    }
  });

  function switchTab(id, btn) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('tab-' + id);
    if (target) target.classList.add('active');
    const navBtn = btn || document.getElementById('nav-' + id);
    if (navBtn) navBtn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'news' && !newsLoadedOnce) fetchLiveNewsOnly();
    if (id === 'chat') {
      renderChatMessages();
      populateReconcileForm();
    }
  }

  function openChatTab(scrollToSync = false) {
    switchTab('chat', document.getElementById('nav-chat'));
    if (scrollToSync) {
      setTimeout(() => {
        const el = document.getElementById('syncPanelTrade');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }

  function switchSyncMode(mode) {
    const map = [
      ['trade', 'syncTabTrade', 'syncPanelTrade'],
      ['reconcile', 'syncTabRecon', 'syncPanelRecon'],
      ['csv', 'syncTabCsv', 'syncPanelCsv'],
      ['binance', 'syncTabBinance', 'syncPanelBinance']
    ];
    for (const [m, tabId, panelId] of map) {
      const tb = document.getElementById(tabId);
      const pn = document.getElementById(panelId);
      if (tb) tb.classList.toggle('active', mode === m);
      if (pn) pn.style.display = (mode === m) ? 'block' : 'none';
    }
    if (mode === 'reconcile') populateReconcileForm();
    if (mode === 'binance') updateBinanceRoUI();
  }

  function autoMatchBroker() {
    const asset = document.getElementById('syncAsset').value;
    const brokerEl = document.getElementById('syncBroker');
    if (ASSETS[asset] && brokerEl) brokerEl.value = ASSETS[asset].broker;
  }

  function setNewsFilter(cat, btn) {
    activeNewsFilter = cat;
    document.querySelectorAll('.nf-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderNewsList();
  }

  function getAdminPin() { return (localStorage.getItem('sy_pin') || '2026').trim(); }

  function updateLockUI() {
    const btn = document.getElementById('lockBtn');
    if (!btn) return;
    if (isAdminUnlocked) {
      btn.textContent = '🔓 আনলকড';
      btn.classList.remove('auto-off');
      btn.classList.add('auto-on');
    } else {
      btn.textContent = '🔒 View-Only';
      btn.classList.remove('auto-on');
      btn.classList.add('auto-off');
    }
  }

  function toggleAdminLock() {
    if (isAdminUnlocked) {
      isAdminUnlocked = false;
      updateLockUI();
    } else {
      requireAdmin(() => {});
    }
  }

  function requireAdmin(callback) {
    if (isAdminUnlocked) { callback(); return; }
    pendingAdminAction = callback;
    document.getElementById('pinInput').value = '';
    document.getElementById('pinErr').textContent = '';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('pinInput').focus(), 100);
  }

  function closePinModal() {
    document.getElementById('pinModal').classList.remove('open');
    pendingAdminAction = null;
  }

  function verifyPin() {
    const entered = document.getElementById('pinInput').value.trim();
    if (entered === getAdminPin()) {
      isAdminUnlocked = true;
      updateLockUI();
      document.getElementById('pinModal').classList.remove('open');
      const act = pendingAdminAction;
      pendingAdminAction = null;
      if (typeof act === 'function') act();
    } else {
      document.getElementById('pinErr').textContent = '❌ ভুল PIN! আবার চেষ্টা করুন।';
    }
  }

  function openSetupPublic() {
    const c = getCfg();
    document.getElementById('cfgUrl').value = c.url;
    document.getElementById('cfgKey').value = c.key;
    document.getElementById('cfgSync').value = c.syncId;
    document.getElementById('cfgPin').value = getAdminPin();
    document.getElementById('setupModal').classList.add('open');
  }

  function openSetup() {
    requireAdmin(() => {
      openSetupPublic();
    });
  }
  function closeSetup() { document.getElementById('setupModal').classList.remove('open'); }
  function saveSetup() {
    localStorage.setItem('sy_url', document.getElementById('cfgUrl').value.trim() || DEFAULT_URL);
    localStorage.setItem('sy_key', document.getElementById('cfgKey').value.trim());
    localStorage.setItem('sy_sync', document.getElementById('cfgSync').value.trim());
    const newPin = document.getElementById('cfgPin').value.trim();
    if (newPin.length >= 4) localStorage.setItem('sy_pin', newPin);
    closeSetup();
    updateAuthServerStatus();
    if (authSession && userProfile) refreshAll(true);
  }

  async function fetchWithTimeout(url, options, ms = 15000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      if (e && e.name === 'AbortError') {
        throw new Error('সার্ভার থেকে উত্তর আসতে নির্ধারিত সময়ের চেয়ে বেশি লেগেছে (Timeout) — আবার চেষ্টা করুন');
      }
      throw e;
    }
  }

  async function callAutopilotApi(payload, timeoutMs = 45000) {
    const c = getCfg();
    if (!c.key) throw new Error('আগে ⚙️ সার্ভার সেটআপে Supabase Key দিন');
    const jwt = getAuthToken();
    const headers = { 'Content-Type': 'application/json', 'apikey': c.key };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    else if (c.key.startsWith('eyJ')) headers['Authorization'] = 'Bearer ' + c.key;
    const bodyObj = { sync_id: c.syncId, ...payload };
    if (jwt && !bodyObj.user_jwt) bodyObj.user_jwt = jwt;
    const r = await fetchWithTimeout(c.url + '/functions/v1/ai-autopilot', {
      method: 'POST', headers, body: JSON.stringify(bodyObj)
    }, timeoutMs);
    const rawTxt = await r.text();
    let data = {};
    try { data = JSON.parse(rawTxt); } catch (_) {
      throw new Error('সার্ভার রেসপন্স ত্রুটি (' + r.status + ') — একটু পর আবার চেষ্টা করুন');
    }
    if (!r.ok || !data.ok) throw new Error(data.error || 'Server error (' + r.status + ')');
    return data;
  }

  async function sbGet(path) {
    const c = getCfg();
    if (!c.key) return { ok: false, status: 401, data: [] };
    const headers = { 'apikey': c.key, 'Content-Type': 'application/json' };
    if (c.key.startsWith('eyJ')) headers['Authorization'] = 'Bearer ' + c.key;
    const r = await fetchWithTimeout(c.url + path, { headers }, 8000);
    if (!r.ok) return { ok: false, status: r.status, data: [] };
    return { ok: true, status: r.status, data: await r.json() };
  }

  async function refreshAll(alsoFetchLive = false) {
    const c = getCfg();
    if (!authSession || !userProfile) return;
    document.getElementById('syncBadge').textContent = '☁️ @' + userProfile.username + ' (' + userProfile.sync_id + ')';
    if (!c.key) {
      document.getElementById('lastUpdated').textContent = '⚠️ ⚙️ সেটআপে Supabase Key দিন';
      renderAll();
      return;
    }
    document.getElementById('lastUpdated').textContent = 'ডেটা সিঙ্ক হচ্ছে...';
    try {
      const dash = await callAutopilotApi({ mode: 'get_dashboard' }, 18000);
      if (dash.profile) {
        userProfile = dash.profile;
        saveAuthLocal();
        updateProfileHeaderUI();
      }
      const defCap = Number((userProfile && userProfile.initial_capital) || 10000);
      stateData = dash.state || { cash: defCap, practice_day: 1, holdings: {} };
      syncAssetsFromState();
      memoryData = dash.memory || { initial_capital: defCap, win_count: 0, loss_count: 0, total_trades: 0, strategy_weights: { dip_buying: 1, smart_sip: 1, gold_hedge: 1, profit_lock: 1 }, lessons: [] };
      logsData = Array.isArray(dash.logs) ? dash.logs : [];
      document.getElementById('lastUpdated').textContent = 'সিঙ্ক: ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      renderAll();
      if (alsoFetchLive) fetchLiveRatesOnly(true);
    } catch (e) {
      document.getElementById('lastUpdated').textContent = '⚠️ ' + (e.message || 'নেটওয়ার্ক ধীর');
      renderAll();
    }
  }

  async function fetchLiveRatesOnly(silent = false) {
    const c = getCfg();
    const msg = document.getElementById('runStatus');
    const liveBtn = document.getElementById('liveRateBtn');
    if (!c.key) { if (!silent) openSetup(); return; }
    if (isFetchingRates) return;
    isFetchingRates = true;
    updateAutoLiveUI();
    if (!silent && liveBtn) { liveBtn.disabled = true; liveBtn.textContent = '⏳ আসছে...'; }
    try {
      const data = await callAutopilotApi({ mode: 'rates_only' }, 15000);
      if (!data.market) throw new Error('লাইভ রেট পাওয়া যায়নি');
      liveMarketOverride = data.market;
      const t = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.getElementById('lastUpdated').textContent = '📡 লাইভ রেট আপডেট: ' + t;
      if (!silent && msg) msg.innerHTML = '📡 <b>সর্বশেষ লাইভ মার্কেট রেট আপডেট হয়েছে (' + t + ')</b> — কোনো ট্রেড বা দিন পরিবর্তন হয়নি।';
      countdownSec = AUTO_REFRESH_INTERVAL_SEC;
      renderAll();
    } catch (e) {
      if (!silent && msg) msg.innerHTML = '<span style="color:#fca5a5;">⚠️ লাইভ রেট এরর: ' + e.message + '</span>';
    } finally {
      isFetchingRates = false;
      if (liveBtn) { liveBtn.disabled = false; liveBtn.textContent = '📡 লাইভ রেট'; }
      updateAutoLiveUI();
    }
  }

  async function fetchLiveNewsOnly() {
    const c = getCfg();
    const btn = document.getElementById('refreshNewsBtn');
    const sub = document.getElementById('newsUpdatedText');
    if (!c.key) { renderNewsList(); return; }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ নিউজ আসছে...'; }
    if (sub) sub.textContent = 'লাইভ ফিন্যান্স ও মার্কেট নিউজ লোড হচ্ছে...';
    try {
      const data = await callAutopilotApi({ mode: 'news_only' }, 15000);
      if (!Array.isArray(data.news)) throw new Error('লাইভ নিউজ পাওয়া যায়নি');
      liveNewsList = data.news;
      newsLoadedOnce = true;
      const t = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
      if (sub) sub.textContent = '✅ লাইভ ফিন্যান্স নিউজ আপডেট হয়েছে (' + t + ') — মোট ' + liveNewsList.length + 'টি খবর';
      renderNewsList();
    } catch (e) {
      if (sub) sub.textContent = '⚠️ আগের সেভ করা নিউজ দেখাচ্ছে।';
      renderNewsList();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 লাইভ নিউজ আনো'; }
    }
  }

  async function runAutopilot() {
    if (!isAdminUnlocked) { requireAdmin(() => runAutopilot()); return; }
    const btn = document.getElementById('runBtn');
    const msg = document.getElementById('runStatus');
    const c = getCfg();
    if (!c.key) {
      msg.innerHTML = '<span style="color:#fde68a;">⚠️ আগে উপরে <b>⚙️ সেটআপ</b> বাটনে গিয়ে Supabase Key সেভ করুন।</span>';
      openSetup();
      return;
    }
    btn.disabled = true;
    btn.textContent = '⏳ লাইভ বাজার, RSI ও কম্পাউন্ডিং বিশ্লেষণ চলছে...';
    msg.textContent = '';
    try {
      const data = await callAutopilotApi({}, 45000);
      liveMarketOverride = null;
      const lockNote = data.same_day_locked ? ' (আজকের দিন আগেই সম্পন্ন — তাই দিন বাড়ানো হয়নি)' : '';
      msg.innerHTML = '✅ <b>দিন ' + data.day_completed + ' সম্পন্ন</b> (' + (data.brain_mode === 'GEMINI_AI' ? 'Gemini AI' : 'Quant AI Engine') + ') — <b>' + data.strategy_used + '</b>' + lockNote;
      await refreshAll(false);
    } catch (e) {
      msg.innerHTML = '<span style="color:#fca5a5;">⚠️ এরর: ' + e.message + '</span>';
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 এখনই AI রিসার্চ ও ট্রেড চালাও';
    }
  }

  // ===== CHATBOX FUNCTIONS =====
  function saveChatHistory() {
    try { localStorage.setItem('sy_chat_history', JSON.stringify(chatHistory.slice(-20))); } catch (_) {}
  }

  function clearChatHistory() {
    chatHistory = [{
      role: 'ai',
      text: 'চ্যাট পরিষ্কার করা হয়েছে। লাইভ মার্কেট রিসার্চ, কিনবেন-বেচবেন পরামর্শ বা রিয়েল পোর্টফোলিও সিঙ্ক নিয়ে যেকোনো প্রশ্ন করুন।',
      steps: [],
      suggested_sync: null
    }];
    saveChatHistory();
    renderChatMessages();
  }

  function renderChatMessages() {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.innerHTML = chatHistory.map((m, idx) => {
      if (m.role === 'user') {
        return '<div class="chat-msg user">' + escapeHtml(m.text) + '</div>';
      }
      const stepsHtml = (Array.isArray(m.steps) && m.steps.length)
        ? '<ol class="chat-steps">' + m.steps.map(s => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>'
        : '';
      let syncHtml = '';
      if (m.suggested_sync && m.suggested_sync.asset_id && m.suggested_sync.amount_inr > 0) {
        const s = m.suggested_sync;
        const aName = (ASSETS[s.asset_id] && ASSETS[s.asset_id].name) || s.asset_id;
        const actBn = s.action === 'SELL' ? 'বিক্রি (SELL)' : 'কেনা (BUY)';
        if (m.synced_done) {
          syncHtml = '<div class="chat-sync-card">✅ <b>SafeYield পোর্টফোলিওতে সফলভাবে সিঙ্ক হয়েছে!</b> (' + escapeHtml(s.broker || 'Broker') + ' • ' + actBn + ' • ' + escapeHtml(aName) + ' • ' + fmt(s.amount_inr) + ')</div>';
        } else {
          syncHtml = '<div class="chat-sync-card">' +
            '<div><b>🔄 রিয়েল ট্রেড শনাক্ত হয়েছে:</b> ' + escapeHtml(s.broker || 'Groww/Binance') + ' — <b>' + actBn + ' ' + escapeHtml(aName) + '</b> (' + fmt(s.amount_inr) + ')</div>' +
            '<button type="button" class="chat-sync-btn" onclick="confirmChatSync(' + idx + ')">✅ SafeYield পোর্টফোলিওতে সিঙ্ক করুন (PIN)</button>' +
          '</div>';
        }
      }
      const modeTag = m.brain_mode ? '<div style="font-size:10.5px;color:var(--muted);margin-bottom:3px;">🤖 ' + (m.brain_mode === 'GEMINI_AI' ? 'Gemini AI Advisor' : 'Quant AI Advisor') + '</div>' : '';
      return '<div class="chat-msg ai">' + modeTag + '<div>' + escapeHtml(m.text).replace(/\n/g, '<br>') + '</div>' + stepsHtml + syncHtml + '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function sendQuickChat(text) {
    document.getElementById('chatInput').value = text;
    sendChatMessage();
  }

  async function sendChatMessage() {
    if (isChatSending) return;
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('chatSendBtn');
    const msgText = (input.value || '').trim();
    if (!msgText) return;

    const c = getCfg();
    if (!c.key) {
      openSetup();
      return;
    }

    const compactHistory = chatHistory.filter(x => !x.loading).slice(-6).map(x => ({ role: x.role, text: x.text }));
    const latestSnap = liveMarketOverride || ((logsData[0] && logsData[0].market_snapshot) ? logsData[0].market_snapshot : null);
    const cachedMarket = (latestSnap && Object.keys(ASSETS).every(k => latestSnap[k] && latestSnap[k].price)) ? latestSnap : undefined;
    let cachedNews = undefined;
    if (liveNewsList.length) {
      cachedNews = liveNewsList.slice(0, 8).map(n => n.title).filter(Boolean);
    } else if (logsData[0] && Array.isArray(logsData[0].news_headlines) && logsData[0].news_headlines.length) {
      cachedNews = logsData[0].news_headlines.slice(0, 8);
    }

    input.value = '';
    chatHistory.push({ role: 'user', text: msgText });
    chatHistory.push({ role: 'ai', text: '⏳ লাইভ রেট ও আপনার পোর্টফোলিও বিশ্লেষণ করছি...', steps: [], suggested_sync: null, loading: true });
    renderChatMessages();

    isChatSending = true;
    btn.disabled = true;
    try {
      const data = await callAutopilotApi({
        mode: 'chat_advisor',
        message: msgText,
        history: compactHistory,
        cached_market: cachedMarket,
        cached_news: cachedNews
      }, 60000);

      chatHistory = chatHistory.filter(x => !x.loading);
      chatHistory.push({
        role: 'ai',
        brain_mode: data.brain_mode || 'QUANT_ENGINE',
        text: data.reply_bn || 'বিশ্লেষণ সম্পন্ন হয়েছে।',
        steps: Array.isArray(data.steps) ? data.steps : [],
        suggested_sync: data.suggested_sync || null,
        synced_done: false
      });
      if (data.market) liveMarketOverride = data.market;
      saveChatHistory();
      renderChatMessages();
      renderAll();
    } catch (e) {
      chatHistory = chatHistory.filter(x => !x.loading);
      chatHistory.push({
        role: 'ai',
        text: '⚠️ চ্যাট রিস্পন্স আনতে সমস্যা হয়েছে: ' + e.message,
        steps: [],
        suggested_sync: null
      });
      saveChatHistory();
      renderChatMessages();
    } finally {
      isChatSending = false;
      btn.disabled = false;
    }
  }

  function confirmChatSync(chatIdx) {
    const item = chatHistory[chatIdx];
    if (!item || !item.suggested_sync) return;
    requireAdmin(async () => {
      const s = item.suggested_sync;
      try {
        await callAutopilotApi({
          mode: 'manual_sync',
          broker: s.broker || (ASSETS[s.asset_id]?.broker || 'Groww'),
          action: s.action || 'BUY',
          asset_id: s.asset_id,
          amount_inr: Number(s.amount_inr || 0),
          actual_price: Number(s.price || 0) || undefined,
          note: s.note || 'চ্যাটবক্স থেকে রিয়েল ট্রেড সিঙ্ক'
        }, 20000);
        chatHistory[chatIdx].synced_done = true;
        saveChatHistory();
        renderChatMessages();
        await refreshAll(true);
      } catch (e) {
        alert('সিঙ্ক এরর: ' + e.message);
      }
    });
  }

  // ===== REAL PORTFOLIO SYNC FUNCTIONS =====
  function submitManualTradeSync() {
    const broker = document.getElementById('syncBroker').value;
    const action = document.getElementById('syncAction').value;
    const asset_id = document.getElementById('syncAsset').value;
    const amount_inr = Number(document.getElementById('syncAmount').value || 0);
    const actual_price = Number(document.getElementById('syncPrice').value || 0);
    const actual_qty = Number(document.getElementById('syncQty').value || 0);
    const note = (document.getElementById('syncNote').value || '').trim();
    const msgEl = document.getElementById('syncTradeMsg');

    if (amount_inr <= 0) {
      msgEl.style.color = '#dc2626';
      msgEl.textContent = '⚠️ সঠিক টাকার পরিমাণ (₹) দিন।';
      return;
    }

    requireAdmin(async () => {
      const btn = document.getElementById('syncTradeBtn');
      btn.disabled = true;
      btn.textContent = '⏳ পোর্টফোলিও সিঙ্ক হচ্ছে...';
      msgEl.style.color = '#0f766e';
      msgEl.textContent = 'Supabase-এ আপডেট হচ্ছে...';
      try {
        const data = await callAutopilotApi({
          mode: 'manual_sync',
          broker, action, asset_id, amount_inr,
          actual_price: actual_price > 0 ? actual_price : undefined,
          actual_qty: actual_qty > 0 ? actual_qty : undefined,
          note: note || (broker + ' রিয়েল ট্রেড সিঙ্ক')
        }, 20000);
        msgEl.style.color = '#15803d';
        msgEl.textContent = '✅ সফলভাবে সিঙ্ক হয়েছে! নতুন ক্যাশ: ' + fmt(data.cash) + ' • মোট পোর্টফোলিও: ' + fmt(data.portfolio_value);
        document.getElementById('syncAmount').value = '';
        document.getElementById('syncPrice').value = '';
        document.getElementById('syncQty').value = '';
        document.getElementById('syncNote').value = '';
        await refreshAll(true);
      } catch (e) {
        msgEl.style.color = '#dc2626';
        msgEl.textContent = '⚠️ এরর: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '✅ রিয়েল ট্রেড SafeYield-এ সিঙ্ক করুন (PIN)';
      }
    });
  }

  function populateReconcileForm() {
    const cashInput = document.getElementById('reconCash');
    const container = document.getElementById('reconAssetRows');
    if (!cashInput || !container) return;
    cashInput.value = Number(stateData.cash ?? 10000).toFixed(2);
    const hold = stateData.holdings || {};
    container.innerHTML = Object.entries(ASSETS).map(([id, info]) => {
      const h = hold[id] || { investedINR: 0, qty: 0 };
      return '<div class="recon-row">' +
        '<div><b>' + info.name + '</b><br><small style="color:var(--muted);">' + info.broker + '</small></div>' +
        '<input id="recon_inv_' + id + '" type="number" step="0.01" value="' + Number(h.investedINR || 0).toFixed(2) + '" />' +
        '<input id="recon_qty_' + id + '" type="number" step="0.000001" value="' + (h.qty ? Number(h.qty).toFixed(6) : '') + '" placeholder="অটো" />' +
      '</div>';
    }).join('');
  }

  function submitReconcilePortfolio() {
    const cash = Number(document.getElementById('reconCash').value || 0);
    const msgEl = document.getElementById('reconMsg');
    if (cash < 0) {
      msgEl.style.color = '#dc2626';
      msgEl.textContent = '⚠️ ক্যাশ ০-এর কম হতে পারবে না।';
      return;
    }
    const holdingsPayload = {};
    for (const id of Object.keys(ASSETS)) {
      const inv = Number(document.getElementById('recon_inv_' + id)?.value || 0);
      const qtyRaw = document.getElementById('recon_qty_' + id)?.value;
      const qty = qtyRaw ? Number(qtyRaw) : 0;
      if (inv > 0 || qty > 0) {
        holdingsPayload[id] = { investedINR: inv, qty };
      }
    }

    requireAdmin(async () => {
      const btn = document.getElementById('reconSaveBtn');
      btn.disabled = true;
      btn.textContent = '⏳ পোর্টফোলিও মিলানো হচ্ছে...';
      msgEl.style.color = '#0f766e';
      msgEl.textContent = 'ডেটা সেভ হচ্ছে...';
      try {
        const data = await callAutopilotApi({
          mode: 'reconcile_portfolio',
          cash,
          holdings: holdingsPayload
        }, 20000);
        msgEl.style.color = '#15803d';
        msgEl.textContent = '✅ এন্ড-অফ-ডে রিকনসাইল সম্পন্ন! SafeYield এখন আপনার Groww ও Binance-এর সাথে মিলে গেছে। মোট মূল্য: ' + fmt(data.portfolio_value);
        await refreshAll(true);
      } catch (e) {
        msgEl.style.color = '#dc2626';
        msgEl.textContent = '⚠️ এরর: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '⚖️ এন্ড-অফ-ডে পোর্টফোলিও মিলিয়ে সেভ করুন (PIN)';
      }
    });
  }

  // ===== PORTFOLIO & TAX ENGINE =====
  function computePortfolioStats() {
    const latest = logsData[0] || null;
    const snap = liveMarketOverride || ((latest && latest.market_snapshot) ? latest.market_snapshot : {});
    if (snap.btc && snap.btc.usdInr > 50) USD_RATE = Number(snap.btc.usdInr);
    const cash = Number(stateData.cash ?? 10000);
    const hold = stateData.holdings || {};
    let invVal = 0, invCost = 0;

    let equityNetPnl = 0;
    let goldNetPnl = 0;
    let cryptoTaxableGain = 0;
    let cryptoSellTurnover = 0;
    let stockTurnover = 0;
    let cryptoTurnover = 0;
    let realizedPnl = 0;

    for (const l of logsData) {
      for (const a of (l.actions_taken || [])) {
        const id = String(a.asset_id || '').toLowerCase();
        const info = ASSETS[id];
        if (!info) continue;
        const amt = Number(a.amount_inr || 0);
        if (a.action === 'BUY' || a.action === 'SELL') {
          if (info.isCrypto) cryptoTurnover += amt;
          else stockTurnover += amt;
        }
        if (a.action === 'SELL') {
          const pnl = Number(a.pnl_inr || 0);
          realizedPnl += pnl;
          if (info.taxCat === 'EQUITY') equityNetPnl += pnl;
          else if (info.taxCat === 'GOLD') goldNetPnl += pnl;
          else if (info.taxCat === 'CRYPTO') {
            cryptoSellTurnover += amt;
            if (pnl > 0) cryptoTaxableGain += pnl;
          }
        }
      }
    }

    for (const [id, h] of Object.entries(hold)) {
      if (!h || !h.qty) continue;
      const info = ASSETS[id] || { taxCat: 'EQUITY', isCrypto: false };
      const p = snap[id] && snap[id].price;
      const cost = Number(h.investedINR || 0);
      const val = p ? h.qty * p : cost;
      const pnl = val - cost;
      invCost += cost;
      invVal += val;

      if (info.isCrypto) {
        cryptoTurnover += val;
        cryptoSellTurnover += val;
        if (pnl > 0) cryptoTaxableGain += pnl;
      } else {
        stockTurnover += val;
        if (info.taxCat === 'EQUITY') equityNetPnl += pnl;
        else if (info.taxCat === 'GOLD') goldNetPnl += pnl;
      }
    }

    const total = cash + invVal;
    const baseInitCap = Number(memoryData.initial_capital || (userProfile && userProfile.initial_capital) || 10000);
    const cashFlows = (stateData && stateData.profile && Array.isArray(stateData.profile.cash_flows)) ? stateData.profile.cash_flows : [];
    let netFlows = 0;
    for (const cf of cashFlows) {
      const a = Number(cf && cf.amount_inr || 0);
      if (cf.type === 'DEPOSIT') netFlows += a;
      else if (cf.type === 'WITHDRAW') netFlows -= a;
    }
    const initCap = Math.max(100, baseInitCap + netFlows);
    const diff = total - initCap;
    const diffPct = (diff / initCap) * 100;
    const unrealizedPnl = invVal - invCost;
    const xirrPct = computeXIRR(baseInitCap, cashFlows, total, logsData);

    const equityTax = equityNetPnl > 0 ? equityNetPnl * 0.20 : 0;
    const goldTax = goldNetPnl > 0 ? goldNetPnl * (goldTaxSlab / 100) : 0;
    const cryptoTax = cryptoTaxableGain * 0.30;
    const baseTax = equityTax + goldTax + cryptoTax;
    const cess = baseTax * 0.04;
    const cryptoTds = cryptoSellTurnover * 0.01;
    const brokerageStt = (stockTurnover * 0.0015) + (cryptoTurnover * 0.002);

    const totalTaxAndCharges = baseTax + cess + cryptoTds + brokerageStt;
    const netTotalAfterTax = total - totalTaxAndCharges;
    const netProfitAfterTax = netTotalAfterTax - initCap;
    const netProfitPct = (netProfitAfterTax / initCap) * 100;

    const stockCap = Math.max(500, Math.round(total * 0.25));
    const cryptoCap = Math.max(200, Math.round(total * 0.08));
    const cashBuffer = Math.max(250, Math.min(2000, Math.round(total * 0.05)));

    return {
      latest, snap, cash, hold, invVal, invCost, total, initCap, baseInitCap, cashFlows, xirrPct, diff, diffPct,
      unrealizedPnl, realizedPnl, stockCap, cryptoCap, cashBuffer,
      tax: {
        equityNetPnl, equityTax, goldNetPnl, goldTax,
        cryptoTaxableGain, cryptoTax, cryptoTds, cess, brokerageStt,
        totalTaxAndCharges, netTotalAfterTax, netProfitAfterTax, netProfitPct
      }
    };
  }

  function renderAll() {
    const st = computePortfolioStats();
    const day = Number(stateData.practice_day || 1);
    const slabEl = document.getElementById('taxSlabSelect');
    if (slabEl) slabEl.value = String(goldTaxSlab);

    document.getElementById('heroTotal').textContent = fmt(st.total);
    const pnlEl = document.getElementById('heroPnl');
    pnlEl.textContent = (st.diff >= 0 ? '+' : '') + fmt(st.diff) + ' (' + (st.diffPct >= 0 ? '+' : '') + st.diffPct.toFixed(2) + '%)';
    pnlEl.classList.toggle('neg', st.diff < 0);

    document.getElementById('dayLabel').textContent = 'দিন ' + day + ' / ৩০';
    const pct = Math.min(100, Math.round((day / 30) * 100));
    document.getElementById('pctLabel').textContent = pct + '% সম্পন্ন';
    document.getElementById('progFill').style.width = pct + '%';

    document.getElementById('heroInvested').textContent = fmt(st.invVal);
    document.getElementById('heroCash').textContent = fmt(st.cash);
    document.getElementById('heroTrades').textContent = (memoryData.total_trades || 0) + ' (' + (memoryData.win_count || 0) + '/' + (memoryData.loss_count || 0) + ')';
    const bMode = st.latest && st.latest.brain_mode;
    document.getElementById('brainBadge').textContent = bMode === 'GEMINI_AI' ? '🧠 Gemini AI সক্রিয়' : (bMode === 'REAL_SYNC' ? '🔄 রিয়েল সিঙ্ক সক্রিয়' : '⚙️ Quant AI Engine সক্রিয়');

    const xirrEl = document.getElementById('heroXirr');
    if (xirrEl) {
      xirrEl.textContent = 'XIRR: ' + (st.xirrPct >= 0 ? '+' : '') + st.xirrPct.toFixed(1) + '%';
    }
    const wXirr = document.getElementById('walletXirrTag');
    if (wXirr) {
      wXirr.textContent = 'XIRR: ' + (st.xirrPct >= 0 ? '+' : '') + st.xirrPct.toFixed(1) + '%';
    }
    const gCur = document.getElementById('goalCurrent');
    if (gCur && !gCur.dataset.userEdited) {
      gCur.value = String(Math.round(st.total));
    }

    updatePortfolioModeUI();
    updateBinanceRoUI();
    renderLatestDecision(st.latest);
    renderAllocationAndRisk(st);
    renderBrainTab(st.snap);
    renderNewsAndPredictions(st.latest, st.snap);
    renderMonthlyReport(st, day);
    renderWallet(st);
    renderCashFlowHistory(st);
    renderChart();
    calculateGoalSip();
  }

  function renderMonthlyReport(st, day) {
    const hero = document.getElementById('reportHeroCard');
    hero.classList.toggle('loss', st.tax.netProfitAfterTax < 0);
    const isDone = day >= 30;
    document.getElementById('reportStatusPill').textContent = isDone
      ? '🎉 ৩০-দিনের মিশন সম্পন্ন • চূড়ান্ত মাসিক রিপোর্ট'
      : '📊 লাইভ মাসিক রিপোর্ট • দিন ' + day + ' / ৩০ চলছে';

    const dirText = st.tax.netProfitAfterTax >= 0 ? 'নেট লাভ' : 'নেট লোকসান';
    document.getElementById('reportVerdictTitle').textContent =
      'ট্যাক্স বাদে হাতে: ' + fmt(st.tax.netTotalAfterTax) + ' (' + dirText + ')';
    document.getElementById('reportVerdictSub').textContent =
      'গ্রস লাভ/লস: ' + (st.diff >= 0 ? '+' : '') + fmt(st.diff) + ' • ট্যাক্স ও চার্জ বাদে: ' + (st.tax.netProfitAfterTax >= 0 ? '+' : '') + fmt(st.tax.netProfitAfterTax) + ' (' + (st.tax.netProfitPct >= 0 ? '+' : '') + st.tax.netProfitPct.toFixed(2) + '%)';

    document.getElementById('repInitCap').textContent = fmt(st.initCap);
    document.getElementById('repCurrVal').textContent = fmt(st.total);
    document.getElementById('repTotalTax').textContent = '-' + fmt(st.tax.totalTaxAndCharges);
    document.getElementById('repNetVal').textContent = fmt(st.tax.netTotalAfterTax);

    document.getElementById('taxSummaryBox').innerHTML =
      '<div style="display:flex;justify-content:space-between;font-size:13.5px;"><span>গ্রস লাভ/লোকসান (Before Tax):</span><b>' + (st.diff >= 0 ? '+' : '') + fmt(st.diff) + '</b></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:4px;color:#b45309;"><span>মোট আনুমানিক ট্যাক্স, TDS ও ব্রোকারেজ:</span><b>-' + fmt(st.tax.totalTaxAndCharges) + '</b></div>' +
      '<div class="tax-net-row">' +
        '<span style="font-weight:700;font-size:14.5px;color:#0f172a;">✅ আসল নেট লাভ (ট্যাক্স বাদে):</span>' +
        '<strong style="font-size:17px;color:' + (st.tax.netProfitAfterTax >= 0 ? '#15803d' : '#b91c1c') + ';">' + (st.tax.netProfitAfterTax >= 0 ? '+' : '') + fmt(st.tax.netProfitAfterTax) + ' (' + (st.tax.netProfitPct >= 0 ? '+' : '') + st.tax.netProfitPct.toFixed(2) + '%)</strong>' +
      '</div>';

    document.getElementById('taxBreakdownBody').innerHTML =
      '<tr><td><b>Equity STCG Tax</b><br><small style="color:var(--muted);">ইক্যুইটি ও স্টক লাভ: ' + fmt(st.tax.equityNetPnl) + '</small></td><td>২০% (Sec 111A)</td><td>' + fmt(st.tax.equityTax) + '</td></tr>' +
      '<tr><td><b>Gold / Silver ETF Tax</b><br><small style="color:var(--muted);">Gold / Silver ETF লাভ: ' + fmt(st.tax.goldNetPnl) + '</small></td><td>স্ল্যাব ' + goldTaxSlab + '%</td><td>' + fmt(st.tax.goldTax) + '</td></tr>' +
      '<tr><td><b>Crypto VDA Tax</b><br><small style="color:var(--muted);">করযোগ্য লাভ: ' + fmt(st.tax.cryptoTaxableGain) + '</small></td><td>ফ্ল্যাট ৩০% (No Set-Off)</td><td>' + fmt(st.tax.cryptoTax) + '</td></tr>' +
      '<tr><td><b>Crypto 1% TDS</b></td><td>বিক্রির ওপর ১%</td><td>' + fmt(st.tax.cryptoTds) + '</td></tr>' +
      '<tr><td><b>Health &amp; Edu Cess</b></td><td>ট্যাক্সের ওপর ৪%</td><td>' + fmt(st.tax.cess) + '</td></tr>' +
      '<tr><td><b>STT ও ব্রোকারেজ চার্জ</b></td><td>~০.১৫% স্টক / ০.২% ক্রিপ্টো</td><td>' + fmt(st.tax.brokerageStt) + '</td></tr>' +
      '<tr style="background:#fef3c7;"><td><b>মোট আনুমানিক কাটা যাবে</b></td><td>—</td><td><b>' + fmt(st.tax.totalTaxAndCharges) + '</b></td></tr>';

    const reinvestedPower = Math.max(0, st.total - st.initCap);
    document.getElementById('compoundingSummaryGrid').innerHTML =
      '<div class="weight-item">' +
        '<strong>💰 লাভ পুনঃবিনিয়োগ (Compounding)</strong>' +
        '<p style="font-size:12.5px;color:var(--muted);margin-top:4px;">মূলধন <b>' + fmt(st.initCap) + '</b> থেকে বেড়ে <b>' + fmt(st.total) + '</b> হয়েছে। বাড়তি <b>' + fmt(reinvestedPower) + '</b> এখন নিজের মূলধন হিসেবেই পরবর্তী ট্রেডে যুক্ত হচ্ছে।</p>' +
      '</div>' +
      '<div class="weight-item">' +
        '<strong>📈 অটো-লিমিট বৃদ্ধি (Dynamic Cap)</strong>' +
        '<p style="font-size:12.5px;color:var(--muted);margin-top:4px;">বর্তমান পোর্টফোলিও অনুযায়ী প্রতি স্টক/ETF-এর সীমা <b>' + fmt(st.stockCap) + '</b> (২৫%) এবং প্রতি ক্রিপ্টো সীমা <b>' + fmt(st.cryptoCap) + '</b> (৮%)।</p>' +
      '</div>';

    const tbody = document.getElementById('reportAssetBody');
    const rows = [];
    for (const [id, info] of Object.entries(ASSETS)) {
      const h = st.hold[id];
      if (!h || !h.qty) continue;
      const p = st.snap[id] && st.snap[id].price;
      const curVal = p ? h.qty * p : h.investedINR;
      const pnl = curVal - h.investedINR;
      const pnlPct = h.investedINR ? (pnl / h.investedINR) * 100 : 0;
      rows.push('<tr>' +
        '<td><b>' + info.name + '</b></td>' +
        '<td>' + fmt(h.investedINR) + '</td>' +
        '<td><b>' + fmt(curVal) + '</b></td>' +
        '<td style="color:' + (pnl >= 0 ? '#15803d' : '#b91c1c') + ';font-weight:700;">' + (pnl >= 0 ? '+' : '') + fmt(pnl) + ' (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%)</td>' +
      '</tr>');
    }
    rows.push('<tr style="background:#ecfdf5;"><td><b>💵 হাতে নগদ (Cash)</b></td><td>—</td><td><b>' + fmt(st.cash) + '</b></td><td>সুরক্ষিত</td></tr>');
    tbody.innerHTML = rows.join('');

    const counts = { 'Buy on Dip': 0, 'Smart SIP': 0, 'Gold Hedge': 0, 'Profit Lock': 0, 'Real Sync': 0 };
    for (const l of logsData) {
      const s = String(l.strategy_used || '');
      for (const k of Object.keys(counts)) {
        if (s.includes(k)) counts[k]++;
      }
    }
    const stratHtml = Object.entries(counts).map(([k, v]) =>
      '<div class="weight-item" style="display:flex;justify-content:space-between;align-items:center;"><span><b>' + k + '</b></span><span class="tag tag-neut">' + v + ' বার</span></div>'
    ).join('');
    document.getElementById('reportStrategyBox').innerHTML = '<div class="grid-2">' + stratHtml + '</div>';
  }

  function copyMonthlyReport() {
    const st = computePortfolioStats();
    const day = Number(stateData.practice_day || 1);
    const text = `SafeYield AI মাসিক রিপোর্ট (দিন ${day}/30)
শুরুর মূলধন: ₹${st.initCap}
মোট গ্রস মূল্য: ₹${st.total.toFixed(2)} (${st.diff >= 0 ? '+' : ''}₹${st.diff.toFixed(2)})
আনুমানিক সরকারি ট্যাক্স ও চার্জ: -₹${st.tax.totalTaxAndCharges.toFixed(2)}
ট্যাক্স বাদে আসল নেট মূল্য: ₹${st.tax.netTotalAfterTax.toFixed(2)}
আসল নেট লাভ/লস: ${st.tax.netProfitAfterTax >= 0 ? '+' : ''}₹${st.tax.netProfitAfterTax.toFixed(2)} (${st.tax.netProfitPct >= 0 ? '+' : ''}${st.tax.netProfitPct.toFixed(2)}%)
মোট ট্রেড: ${memoryData.total_trades || 0} (লাভ: ${memoryData.win_count || 0}, লস: ${memoryData.loss_count || 0})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('ট্যাক্সসহ মাসিক রিপোর্ট কপি হয়ে গেছে!'));
    } else {
      alert(text);
    }
  }

  function renderLatestDecision(latest) {
    const box = document.getElementById('latestDecisionBox');
    if (!latest) {
      box.innerHTML = '<p style="color:var(--muted);font-size:13px;">এখনও কোনো ট্রেড ডেটা লোড হয়নি। উপরে <b>⚙️ সেটআপ</b>-এ Supabase Key দিয়ে <b>আপডেট</b> চাপুন।</p>';
      return;
    }
    const actionsHtml = (latest.actions_taken || []).map(a => {
      const cls = a.action === 'BUY' ? 'tag-buy' : (a.action === 'SELL' ? 'tag-sell' : 'tag-hold');
      const extras = [];
      if (a.confidence) extras.push('🎯 কনফিডেন্স: ' + a.confidence + '%');
      if (a.target_pct) extras.push('📈 টার্গেট: +' + a.target_pct + '%');
      if (a.stop_loss_pct) extras.push('🛡️ স্টপ-লস: -' + Math.abs(a.stop_loss_pct) + '%');
      const extraRow = extras.length ? '<div style="font-size:11.5px;color:var(--primary);margin-top:3px;font-weight:600;">' + extras.join(' • ') + '</div>' : '';
      return '<div class="action-row">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span><span class="tag ' + cls + '">' + escapeHtml(a.action) + '</span> <b>' + escapeHtml(a.asset_name || a.asset_id) + '</b></span>' +
          '<b>' + (a.amount_inr ? fmt(a.amount_inr) : 'হোল্ড/সিঙ্ক') + '</b>' +
        '</div>' +
        extraRow +
        '<div style="color:var(--muted);font-size:12.5px;margin-top:4px;">📌 <b>কারণ:</b> ' + escapeHtml(a.reason_bn || '') + '</div>' +
      '</div>';
    }).join('');

    box.innerHTML = '<div class="log-box" style="margin-bottom:0;">' +
      '<div class="log-head">' +
        '<b>দিন ' + latest.day_number + ' • স্ট্র্যাটেজি: <span style="color:var(--primary);">' + escapeHtml(latest.strategy_used || 'Multi-Strategy') + '</span></b>' +
        '<span style="font-size:12px;color:var(--muted);">' + new Date(latest.created_at).toLocaleString('bn-BD') + '</span>' +
      '</div>' +
      '<p style="font-size:13.5px;margin-bottom:6px;">' + escapeHtml(latest.summary_bn || '') + '</p>' +
      actionsHtml +
      (latest.lesson_bn ? '<div class="lesson-box">💡 <b>AI-এর শিক্ষা:</b> ' + escapeHtml(latest.lesson_bn) + '</div>' : '') +
    '</div>';
  }

  function renderBrainTab(snap) {
    const w = memoryData.strategy_weights || { dip_buying: 1, smart_sip: 1, gold_hedge: 1, profit_lock: 1 };
    const wMap = [
      { k: 'dip_buying', label: '📉 Buy on Dip (ডিসকাউন্টে কেনা)' },
      { k: 'smart_sip', label: '📅 Smart SIP (ধাপে ধাপে বিনিয়োগ)' },
      { k: 'gold_hedge', label: '🥇 Gold Hedge (সুরক্ষা ব্যালেন্স)' },
      { k: 'profit_lock', label: '🔒 Profit Lock (মুনাফা সুরক্ষা)' }
    ];
    document.getElementById('weightsGrid').innerHTML = wMap.map(item => {
      const val = Number(w[item.k] || 1);
      const pct = Math.min(100, Math.round((val / 1.8) * 100));
      return '<div class="weight-item">' +
        '<div class="weight-top"><span>' + item.label + '</span><span>' + val.toFixed(2) + 'x গুরুত্ব</span></div>' +
        '<div class="w-bar"><div class="w-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');

    const tbody = document.getElementById('indicatorBody');
    const keys = Object.keys(ASSETS);
    if (!Object.keys(snap).length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);">ডেটা সিঙ্ক হলে লাইভ RSI, MACD ও AI স্কোর দেখা যাবে।</td></tr>';
    } else {
      tbody.innerHTML = keys.map(id => {
        const m = snap[id] || {};
        const rsi = Number(m.rsi14 || 50);
        const dip = Number(m.dipFromHighPct || 0);
        const macdHist = (typeof m.macdHist === 'number') ? m.macdHist : 0;
        const aiScore = (typeof m.aiScore === 'number') ? m.aiScore : Math.max(20, Math.min(92, Math.round(50 + (50 - rsi) * 0.6 + dip * 2.2)));
        let sig = '<span class="tag tag-neut">নিরপেক্ষ (Hold)</span>';
        if (aiScore >= 74 || (dip >= 4 && rsi < 42)) sig = '<span class="tag tag-strong-buy">🔥 Strong Buy</span>';
        else if (dip >= 2.5 || rsi < 48 || aiScore >= 62) sig = '<span class="tag tag-buy">কেনার সুযোগ (Buy)</span>';
        else if (rsi > 68 || aiScore <= 32) sig = '<span class="tag tag-sell">অতিরিক্ত দাম (Profit Lock)</span>';
        const scoreCls = aiScore >= 65 ? 'tag-score-hi' : (aiScore >= 42 ? 'tag-score-md' : 'tag-score-lo');
        const macdTxt = macdHist > 0 ? '<span style="color:#15803d;font-weight:700;">▲ Bull</span>' : (macdHist < 0 ? '<span style="color:#b91c1c;font-weight:700;">▼ Bear</span>' : '<span style="color:var(--muted);">● Flat</span>');
        const bbNote = (typeof m.bbPos === 'number') ? ('<br><small style="color:var(--muted);">BB ' + Math.round(m.bbPos * 100) + '% • ' + escapeHtml(m.trend || '—') + '</small>') : ('<br><small style="color:var(--muted);">' + escapeHtml(m.trend || '—') + '</small>');
        const chg = Number(m.changePct || 0);
        const customCtrl = ASSETS[id].isCustom
          ? '<span class="tag tag-custom">কাস্টম</span><button type="button" class="asset-del-btn" title="মুছে ফেলুন" onclick="handleRemoveCustomAsset(\'' + escapeHtml(id) + '\')">✕</button>'
          : '';
        return '<tr>' +
          '<td><b>' + escapeHtml(ASSETS[id].name) + '</b>' + customCtrl + '<br><small style="color:var(--muted);">' + escapeHtml(ASSETS[id].type) + (m.source ? ' • ' + escapeHtml(m.source) : '') + '</small></td>' +
          '<td>' + (m.price ? fmt(m.price) : '—') + (m.usdtPrice ? '<br><small style="color:var(--muted);">$' + Number(m.usdtPrice).toLocaleString('en-US', {maximumFractionDigits: 2}) + ' USDT</small>' : '') + '</td>' +
          '<td style="color:' + (chg >= 0 ? '#15803d' : '#b91c1c') + ';font-weight:600;">' + (chg >= 0 ? '+' : '') + chg + '%</td>' +
          '<td><b>' + rsi + '</b></td>' +
          '<td>' + macdTxt + bbNote + '</td>' +
          '<td><span class="tag ' + scoreCls + '">' + aiScore + '/100</span></td>' +
          '<td>' + dip + '% নিচে</td>' +
          '<td>' + sig + '</td>' +
        '</tr>';
      }).join('');
    }

    const allBox = document.getElementById('allLogsBox');
    if (!logsData.length) {
      allBox.innerHTML = '<p style="color:var(--muted);font-size:13px;">এখনও কোনো লগ লোড হয়নি।</p>';
    } else {
      allBox.innerHTML = logsData.slice(0, 15).map(l => {
        const dtStr = l.created_at ? new Date(l.created_at).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const acts = (l.actions_taken || []).map(a => {
          const amtTxt = a.amount_inr ? ' (' + fmt(a.amount_inr) + (a.price ? ' @ ' + fmt(a.price) : '') + ')' : '';
          const pnlTxt = (a.action === 'SELL' && typeof a.pnl_inr === 'number') ? ' • লাভ/লস: ' + (a.pnl_inr >= 0 ? '+' : '') + fmt(a.pnl_inr) : '';
          return '<div style="font-size:12.5px;margin-top:4px;">• <b>' + escapeHtml(a.action) + ' ' + escapeHtml(a.asset_name || a.asset_id) + amtTxt + pnlTxt + ':</b> ' + escapeHtml(a.reason_bn || '') + '</div>';
        }).join('');
        return '<div class="log-box">' +
          '<div class="log-head"><span><b>দিন ' + l.day_number + ' — ' + escapeHtml(l.strategy_used || '') + '</b> <small style="color:var(--muted);">(' + dtStr + ')</small></span><span class="tag tag-neut">মোট মূল্য: ' + fmt(l.portfolio_value) + '</span></div>' +
          '<p style="font-size:13px;">' + escapeHtml(l.summary_bn || '') + '</p>' + acts +
        '</div>';
      }).join('');
    }
  }

  function renderNewsAndPredictions(latest, snap) {
    const niftyChg = Number((snap.nifty && snap.nifty.changePct) || 0);
    const niftyRsi = Number((snap.nifty && snap.nifty.rsi14) || 50);
    const goldChg = Number((snap.gold && snap.gold.changePct) || 0);
    const btcChg = Number((snap.btc && snap.btc.changePct) || 0);

    const sTag = document.getElementById('sentimentTag');
    if (niftyChg > 0.4 && niftyRsi < 65) {
      sTag.className = 'tag tag-bull'; sTag.textContent = 'Bullish (ইতিবাচক বাজার)';
    } else if (niftyChg < -0.5) {
      sTag.className = 'tag tag-bear'; sTag.textContent = 'Cautious / Bearish (সতর্ক অবস্থান)';
    } else {
      sTag.className = 'tag tag-neut'; sTag.textContent = 'Consolidation (স্থিতিশীল)';
    }

    document.getElementById('predictionContainer').innerHTML =
      '<div class="pred-box">' +
        '<div style="font-weight:700;font-size:14.5px;margin-bottom:6px;">🎯 AI স্বল্পমেয়াদী পূর্বাভাস ও কৌশলগত দিকনির্দেশনা</div>' +
        '<ul style="padding-left:18px;font-size:13.5px;display:flex;flex-direction:column;gap:6px;">' +
          '<li><b>ভারতীয় ইক্যুইটি (Nifty 50):</b> বর্তমান RSI <b>' + niftyRsi + '</b>। বড় পতনে <b>Buy on Dip</b> কার্যকর থাকবে।</li>' +
          '<li><b>সোনা (Gold ETF):</b> অস্থির বাজারে সেরা সুরক্ষা কবচ (পরিবর্তন: ' + (goldChg >= 0 ? '+' : '') + goldChg + '%)।</li>' +
          '<li><b>ক্রিপ্টো মার্কেট (BTC &amp; ETH):</b> উচ্চ অস্থিরতা (BTC: ' + (btcChg >= 0 ? '+' : '') + btcChg + '%)—মোট মূলধনের ৮% সীমা ও <b>-৭% Stop-Loss</b> চালু।</li>' +
        '</ul>' +
      '</div>';

    renderNewsList();
  }

  function classifyFallbackTitle(title) {
    const low = String(title).toLowerCase();
    let cat = 'MARKET';
    if (low.includes('rbi') || low.includes('inflation') || low.includes('gdp') || low.includes('rupee') || low.includes('repo') || low.includes('economy')) cat = 'MACRO';
    else if (low.includes('gold') || low.includes('fed') || low.includes('oil') || low.includes('crude') || low.includes('tariff') || low.includes('war') || low.includes('us ')) cat = 'GLOBAL';
    else if (low.includes('bitcoin') || low.includes('btc') || low.includes('eth') || low.includes('crypto')) cat = 'CRYPTO';
    const isBear = /fall|drop|crash|slump|war|loss|selloff|plunge|weak|tariff|hike|fear|crisis/.test(low);
    const isBull = /rally|gain|surge|jump|rise|high|record|cut|inflow|boost|strong|profit/.test(low);
    const isHigh = /rbi|fed|nifty|sensex|crash|rally|oil|crude|inflation|repo|fii|tariff|war|gold|bitcoin/.test(low);
    return {
      title, link: 'https://news.google.com/search?q=' + encodeURIComponent(title) + '&hl=en-IN&gl=IN',
      source: 'Market Feed', pubDate: '', category: cat,
      sentiment: isBear ? 'BEARISH' : (isBull ? 'BULLISH' : 'NEUTRAL'),
      impact: isHigh ? 'HIGH' : 'MEDIUM'
    };
  }

  function renderNewsList() {
    const box = document.getElementById('newsFeedBox');
    if (!box) return;
    const latest = logsData[0] || null;
    let items = [];
    if (liveNewsList.length) items = liveNewsList;
    else if (latest && Array.isArray(latest.news_headlines) && latest.news_headlines.length) items = latest.news_headlines.map(t => typeof t === 'string' ? classifyFallbackTitle(t) : t);
    else items = ['Indian equity benchmarks eye FII inflows and crude oil movement', 'RBI policy outlook and inflation trend remain key triggers', 'Gold ETFs remain preferred portfolio hedge amid global cues'].map(classifyFallbackTitle);

    const filtered = items.filter(it => activeNewsFilter === 'ALL' ? true : (activeNewsFilter === 'HIGH' ? it.impact === 'HIGH' : it.category === activeNewsFilter));
    if (!filtered.length) {
      box.innerHTML = '<p style="color:var(--muted);font-size:13px;">এই ক্যাটাগরিতে এখন কোনো খবর নেই। উপরে <b>সব খবর</b> বা <b>🔄 লাইভ নিউজ আনো</b> চাপুন।</p>';
      return;
    }
    const catLabel = { MARKET: '📈 শেয়ার বাজার', MACRO: '🏛️ RBI ও অর্থনীতি', GLOBAL: '🌍 গ্লোবাল ও গোল্ড', CRYPTO: '₿ ক্রিপ্টো' };
    box.innerHTML = filtered.map(it => {
      const sentBadge = it.sentiment === 'BEARISH' ? '<span class="tag tag-bear">▼ চাপ / সতর্কতা</span>' : (it.sentiment === 'BULLISH' ? '<span class="tag tag-bull">▲ ইতিবাচক</span>' : '<span class="tag tag-neut">● নিরপেক্ষ</span>');
      const impBadge = it.impact === 'HIGH' ? '<span class="tag tag-high">🔥 হাই ইমপ্যাক্ট</span>' : '';
      const catBadge = '<span class="tag tag-cat">' + (catLabel[it.category] || '📊 ফিন্যান্স') + '</span>';
      const impactNote = it.sentiment === 'BEARISH' ? 'মার্কেট প্রভাব: অস্থিরতা বাড়তে পারে—ডিসকাউন্ট ও Gold Hedge জরুরি।' : (it.sentiment === 'BULLISH' ? 'মার্কেট প্রভাব: ইতিবাচক মোমেন্টাম—আগের পজিশনে লাভ বাড়ার সম্ভাবনা।' : 'মার্কেট প্রভাব: স্বাভাবিক গতি—Smart SIP ও RSI দেখে ট্রেড চলবে।');
      const timeStr = it.pubDate ? new Date(it.pubDate).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="news-card ' + (it.impact === 'HIGH' ? 'high-impact' : '') + '">' +
        '<div class="news-badges">' + catBadge + impBadge + sentBadge + '</div>' +
        '<h4><a href="' + escapeHtml(it.link || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(it.title) + ' ↗</a></h4>' +
        '<div class="news-meta"><span>📰 ' + escapeHtml(it.source || 'Finance News') + '</span><span>' + timeStr + '</span></div>' +
        '<div class="news-impact-box">' + impactNote + '</div>' +
      '</div>';
    }).join('');
  }

  function renderWallet(st) {
    document.getElementById('walletCapSub').textContent = 'কম্পাউন্ডিং সীমা: প্রতি স্টক/ETF সর্বোচ্চ ' + fmt(st.stockCap) + ' (২৫%) • প্রতি ক্রিপ্টো সর্বোচ্চ ' + fmt(st.cryptoCap) + ' (৮%) • ন্যূনতম ক্যাশ ' + fmt(st.cashBuffer);
    const entries = Object.entries(st.hold).filter(([, h]) => h && h.qty > 0);
    let html = '<div class="weight-item" style="margin-bottom:10px;background:#ecfdf5;">' +
      '<div style="display:flex;justify-content:space-between;"><b>💵 হাতে নগদ (Cash Buffer)</b><b>' + fmt(st.cash) + '</b></div>' +
      '<small style="color:var(--muted);">Groww + Binance মিলিয়ে হাতে থাকা মোট নগদ টাকা</small>' +
    '</div>';

    if (!entries.length) {
      html += '<p style="color:var(--muted);font-size:13px;">বর্তমানে কোনো অ্যাসেট কেনা নেই।</p>';
    } else {
      html += entries.map(([id, h]) => {
        const info = ASSETS[id] || { name: id, isCrypto: false, broker: 'Broker' };
        const cap = info.isCrypto ? st.cryptoCap : st.stockCap;
        const curPrice = st.snap[id] && st.snap[id].price;
        const curVal = curPrice ? h.qty * curPrice : h.investedINR;
        const pnl = curVal - h.investedINR;
        const pnlPct = h.investedINR ? (pnl / h.investedINR) * 100 : 0;
        return '<div class="weight-item" style="margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span><b>' + info.name + '</b> <span class="tag tag-cat" style="font-size:10px;">' + info.broker + '</span></span>' +
            '<b style="color:' + (pnl >= 0 ? '#15803d' : '#b91c1c') + ';">' + fmt(curVal) + ' (' + (pnl >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%)</b>' +
          '</div>' +
          '<div style="font-size:12.5px;color:var(--muted);margin-top:4px;">বিনিয়োগ: ' + fmt(h.investedINR) + ' / কম্পাউন্ড সীমা ' + fmt(cap) + ' • পরিমাণ: ' + Number(h.qty).toFixed(4) + ' ইউনিট</div>' +
        '</div>';
      }).join('');
    }
    document.getElementById('walletList').innerHTML = html;
    renderTradePassbook();
  }

  function buildTradeHistoryList() {
    const rows = [];
    for (const l of logsData) {
      const ts = l.created_at || '';
      const dayNum = l.day_number || 1;
      const isReal = l.brain_mode === 'REAL_SYNC';
      const sourceLabel = isReal ? 'রিয়েল সিঙ্ক' : (l.brain_mode === 'GEMINI_AI' ? 'Gemini AI' : 'Quant AI');
      for (const a of (l.actions_taken || [])) {
        const act = String(a.action || '').toUpperCase();
        if (act !== 'BUY' && act !== 'SELL') continue;
        const id = String(a.asset_id || '').toLowerCase();
        const info = ASSETS[id] || { name: a.asset_name || id, broker: 'Broker' };
        const amt = Number(a.amount_inr || 0);
        const price = Number(a.price || 0);
        const qty = (amt > 0 && price > 0) ? (amt / price) : 0;
        const pnl = (act === 'SELL' && typeof a.pnl_inr === 'number') ? Number(a.pnl_inr) : null;
        rows.push({
          created_at: ts,
          day_number: dayNum,
          action: act,
          asset_id: id,
          asset_name: a.asset_name || info.name,
          broker: info.broker,
          source: sourceLabel,
          isReal,
          amount_inr: amt,
          price,
          qty,
          pnl_inr: pnl,
          reason_bn: a.reason_bn || ''
        });
      }
    }
    return rows;
  }

  function setPassbookFilter(type, btn) {
    activePassbookType = type;
    ['pbAllBtn', 'pbBuyBtn', 'pbSellBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
    renderTradePassbook();
  }

  function setPassbookAssetFilter(assetId) {
    activePassbookAsset = assetId || 'ALL';
    renderTradePassbook();
  }

  function renderTradePassbook() {
    const body = document.getElementById('tradePassbookBody');
    const sumBox = document.getElementById('passbookSummary');
    if (!body || !sumBox) return;

    const allTrades = buildTradeHistoryList();
    let buySum = 0, buyCnt = 0, sellSum = 0, sellCnt = 0, realizedSum = 0;
    for (const t of allTrades) {
      if (t.action === 'BUY') { buySum += t.amount_inr; buyCnt++; }
      else if (t.action === 'SELL') {
        sellSum += t.amount_inr; sellCnt++;
        if (t.pnl_inr !== null) realizedSum += t.pnl_inr;
      }
    }

    sumBox.innerHTML =
      '<div class="pb-stat" style="background:#f0fdf4;border-color:#bbf7d0;"><small>মোট কেনা (BUY)</small><strong style="color:#166534;">' + fmt(buySum) + ' (' + toBnNum(buyCnt) + 'টি)</strong></div>' +
      '<div class="pb-stat" style="background:#fef2f2;border-color:#fecaca;"><small>মোট বিক্রি (SELL)</small><strong style="color:#991b1b;">' + fmt(sellSum) + ' (' + toBnNum(sellCnt) + 'টি)</strong></div>' +
      '<div class="pb-stat" style="background:#eff6ff;border-color:#bfdbfe;"><small>বুক করা লাভ/লস</small><strong style="color:' + (realizedSum >= 0 ? '#15803d' : '#b91c1c') + ';">' + (realizedSum >= 0 ? '+' : '') + fmt(realizedSum) + '</strong></div>';

    const filtered = allTrades.filter(t => {
      if (activePassbookType !== 'ALL' && t.action !== activePassbookType) return false;
      if (activePassbookAsset !== 'ALL' && t.asset_id !== activePassbookAsset) return false;
      return true;
    });

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:16px;">এই ফিল্টারে কোনো BUY বা SELL ট্রেড পাওয়া যায়নি।</td></tr>';
      return;
    }

    body.innerHTML = filtered.map(t => {
      const d = t.created_at ? new Date(t.created_at) : null;
      const datePart = d ? d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
      const timePart = d ? d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) : '';
      const actTag = t.action === 'BUY'
        ? '<span class="tag tag-buy">কেনা (BUY)</span>'
        : '<span class="tag tag-sell">বিক্রি (SELL)</span>';
      const srcTag = '<div style="margin-top:3px;"><span class="tag ' + (t.isReal ? 'tag-neut' : 'tag-cat') + '" style="font-size:10px;">' + escapeHtml(t.source) + '</span></div>';
      const qtyStr = t.qty > 0 ? (t.qty < 0.01 ? t.qty.toFixed(6) : t.qty.toFixed(4)) + ' ইউনিট' : '—';
      const priceStr = t.price > 0 ? fmt(t.price) : '—';
      let pnlCell = '<span style="color:var(--muted);">—</span>';
      if (t.action === 'SELL' && t.pnl_inr !== null) {
        const col = t.pnl_inr >= 0 ? '#15803d' : '#b91c1c';
        pnlCell = '<b style="color:' + col + ';">' + (t.pnl_inr >= 0 ? '+' : '') + fmt(t.pnl_inr) + '</b>';
      }
      return '<tr>' +
        '<td class="pb-time"><b>' + datePart + '</b><br>' + timePart + '<br><span style="color:#0f766e;">দিন ' + toBnNum(t.day_number) + '</span></td>' +
        '<td>' + actTag + srcTag + '</td>' +
        '<td><b>' + escapeHtml(t.asset_name) + '</b><br><span class="tag tag-cat" style="font-size:10px;">' + escapeHtml(t.broker) + '</span><div class="pb-reason">' + escapeHtml(t.reason_bn) + '</div></td>' +
        '<td style="white-space:nowrap;"><b>' + priceStr + '</b><br><small style="color:var(--muted);">' + qtyStr + '</small></td>' +
        '<td style="white-space:nowrap;"><b>' + fmt(t.amount_inr) + '</b></td>' +
        '<td style="white-space:nowrap;">' + pnlCell + '</td>' +
      '</tr>';
    }).join('');
  }

  function exportTradePassbookCSV() {
    const trades = buildTradeHistoryList();
    if (!trades.length) { alert('এখনও কোনো ট্রেড হিস্ট্রি নেই।'); return; }
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header = ['Date_Time_IST', 'Day', 'Type', 'Source', 'Broker', 'Asset', 'Unit_Price_INR', 'Quantity', 'Total_Amount_INR', 'Realized_PnL_INR', 'Reason'];
    const lines = [header.join(',')];
    for (const t of trades) {
      const dt = t.created_at ? new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
      lines.push([
        esc(dt), t.day_number, t.action, esc(t.source), esc(t.broker), esc(t.asset_name),
        t.price || '', t.qty ? t.qty.toFixed(6) : '', t.amount_inr,
        t.pnl_inr !== null ? t.pnl_inr : '', esc(t.reason_bn)
      ].join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'safeyield-trade-passbook.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  function setChartMode(mode) {
    chartDisplayMode = mode;
    const bVal = document.getElementById('benchBtnVal');
    const bPct = document.getElementById('benchBtnPct');
    if (bVal) bVal.classList.toggle('active', mode === 'value');
    if (bPct) bPct.classList.toggle('active', mode === 'benchmark');
    if (mode === 'benchmark' && !benchmarkNiftySeries) {
      loadBenchmarkSeries();
    }
    renderChart();
  }

  async function loadBenchmarkSeries() {
    try {
      const res = await callAutopilotApi({ mode: 'get_benchmark' }, 14000);
      if (Array.isArray(res.nifty_series) && res.nifty_series.length >= 2) {
        benchmarkNiftySeries = res.nifty_series;
        renderChart();
      }
    } catch (_) {}
  }

  function renderChart() {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('growthChart');
    if (!ctx) return;
    const rev = [...logsData].reverse();
    const baseCap = Number(memoryData.initial_capital || (userProfile && userProfile.initial_capital) || 10000);
    const labels = ['শুরু (দিন ০)', ...rev.map(l => 'দিন ' + l.day_number)];
    const values = [baseCap, ...rev.map(l => Number(l.portfolio_value || baseCap))];
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.07)';
    const subEl = document.getElementById('growthChartSub');

    if (chartInstance) chartInstance.destroy();

    if (chartDisplayMode === 'benchmark') {
      if (subEl) subEl.textContent = 'আপনার পোর্টফোলিও রিটার্ন (%) বনাম Nifty 50 সূচক বনাম ৭% ব্যাংক FD';
      const portPct = values.map(v => Math.round(((v - baseCap) / baseCap) * 10000) / 100);
      const fdPct = labels.map((_, idx) => Math.round((idx * (7 / 365)) * 100) / 100);
      let niftyPct = labels.map((_, idx) => {
        if (idx === 0) return 0;
        if (Array.isArray(benchmarkNiftySeries) && benchmarkNiftySeries.length >= 2) {
          const tail = benchmarkNiftySeries.slice(-labels.length);
          const p0 = tail[0] || 1;
          const pt = tail[Math.min(idx, tail.length - 1)] || p0;
          return Math.round(((pt - p0) / p0) * 10000) / 100;
        }
        const logSnap = rev[idx - 1]?.market_snapshot?.nifty;
        return logSnap && typeof logSnap.changePct === 'number' ? Math.round(logSnap.changePct * 100) / 100 : 0;
      });
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'SafeYield পোর্টফোলিও (%)',
              data: portPct,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.3,
              pointRadius: 3
            },
            {
              label: 'Nifty 50 (%)',
              data: niftyPct,
              borderColor: '#3b82f6',
              borderWidth: 2,
              borderDash: [5, 4],
              fill: false,
              tension: 0.3,
              pointRadius: 2
            },
            {
              label: '7% ব্যাংক FD (%)',
              data: fdPct,
              borderColor: '#f59e0b',
              borderWidth: 1.8,
              borderDash: [2, 3],
              fill: false,
              tension: 0.2,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ticks: { color: tickColor }, grid: { color: gridColor } },
            y: { ticks: { color: tickColor, callback: v => (v >= 0 ? '+' : '') + v + '%' }, grid: { color: gridColor } }
          }
        }
      });
      return;
    }

    if (subEl) subEl.textContent = 'প্রতিদিনের পোর্টফোলিও ভ্যালু ও কম্পাউন্ডিং ফলাফল';
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'মোট পোর্টফোলিও মূল্য (₹)',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tickColor }, grid: { color: gridColor } },
          y: { ticks: { color: tickColor, callback: v => '₹' + v.toLocaleString('en-IN') }, grid: { color: gridColor } }
        }
      }
    });
  }


  // ===== AUTHENTICATION, PROFILE & EMAIL OTP =====
  function saveAuthLocal() {
    try {
      if (authSession) localStorage.setItem('sy_auth_session', JSON.stringify(authSession));
      else localStorage.removeItem('sy_auth_session');
      if (userProfile) localStorage.setItem('sy_user_profile', JSON.stringify(userProfile));
      else localStorage.removeItem('sy_user_profile');
    } catch (_) {}
  }

  function loadAuthLocal() {
    try {
      const s = JSON.parse(localStorage.getItem('sy_auth_session') || 'null');
      const p = JSON.parse(localStorage.getItem('sy_user_profile') || 'null');
      if (s && s.access_token) authSession = s;
      if (p && p.sync_id) userProfile = p;
    } catch (_) {}
  }

  function updateAuthServerStatus() {
    const el = document.getElementById('authServerStatus');
    const fbBtn = document.getElementById('authSetupFallbackBtn');
    if (!el) return;
    const c = getCfg();
    if (c.key) {
      el.style.color = '#15803d';
      el.textContent = '✅ সার্ভার সংযুক্ত (Supabase Auth প্রস্তুত)';
      if (fbBtn) fbBtn.style.display = 'none';
    } else {
      el.style.color = '#b45309';
      el.textContent = '⚠️ সার্ভার কনফিগ পাওয়া যায়নি';
      if (fbBtn) fbBtn.style.display = 'inline-flex';
    }
  }

  function updateProfileHeaderUI() {
    const pill = document.getElementById('profilePillBtn');
    if (pill && userProfile) {
      pill.textContent = '👤 @' + userProfile.username;
    }
    const syncB = document.getElementById('syncBadge');
    if (syncB && userProfile) {
      syncB.textContent = '☁️ @' + userProfile.username + ' (' + userProfile.sync_id + ')';
    }
  }

  function showAuthScreen() {
    document.body.classList.add('auth-active');
    document.getElementById('authShell').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
    updateAuthServerStatus();
    startAuthBgAnimation();
  }

  function showAppShell() {
    document.body.classList.remove('auth-active');
    stopAuthBgAnimation();
    document.getElementById('authShell').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    isAdminUnlocked = true; // Logged-in user owns their own account
    updateLockUI();
    updateProfileHeaderUI();
  }

  function switchAuthTab(tab) {
    const isSi = tab === 'signin';
    document.getElementById('authTabsBar').style.display = 'grid';
    document.getElementById('tabBtnSignin').classList.toggle('active', isSi);
    document.getElementById('tabBtnSignup').classList.toggle('active', !isSi);
    document.getElementById('authSigninPane').style.display = isSi ? 'block' : 'none';
    document.getElementById('authSignupPane').style.display = isSi ? 'none' : 'block';
    document.getElementById('authOtpPane').style.display = 'none';
    document.getElementById('authForgotPane').style.display = 'none';
    document.getElementById('authResetPane').style.display = 'none';
    document.getElementById('siMsg').textContent = '';
    document.getElementById('suMsg').textContent = '';
    document.getElementById('fpMsg').textContent = '';
    document.getElementById('rpMsg').textContent = '';
  }

  function selectCapitalPreset(val, btn) {
    document.getElementById('suCapital').value = String(val);
    document.querySelectorAll('.cap-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  function setAuthMsg(elId, text, isErr) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'auth-msg ' + (isErr ? 'err' : 'ok');
    el.textContent = text;
  }

  async function sbAuthCall(path, bodyObj) {
    const c = getCfg();
    if (!c.key) throw new Error('আগে ⚙️ সার্ভার সেটআপে Supabase Key সেভ করুন।');
    const r = await fetchWithTimeout(c.url + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': c.key },
      body: JSON.stringify(bodyObj)
    }, 18000);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = data.msg || data.error_description || data.message || data.error || ('Auth error ' + r.status);
      throw new Error(m);
    }
    return data;
  }

  async function sbUpdatePasswordWithToken(token, newPassword) {
    const c = getCfg();
    if (!c.key) throw new Error('আগে ⚙️ সার্ভার সেটআপে Supabase Key সেভ করুন।');
    if (!token) throw new Error('ভেরিফিকেশন টোকেন পাওয়া যায়নি—আবার চেষ্টা করুন।');
    const r = await fetchWithTimeout(c.url + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.key,
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ password: newPassword })
    }, 18000);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = data.msg || data.error_description || data.message || data.error || ('Update error ' + r.status);
      throw new Error(m);
    }
    return data;
  }

  function openForgotPasswordPane() {
    const prefill = (document.getElementById('siIdentifier').value || '').trim();
    document.getElementById('authTabsBar').style.display = 'none';
    document.getElementById('authSigninPane').style.display = 'none';
    document.getElementById('authSignupPane').style.display = 'none';
    document.getElementById('authOtpPane').style.display = 'none';
    document.getElementById('authResetPane').style.display = 'none';
    document.getElementById('authForgotPane').style.display = 'block';
    document.getElementById('fpIdentifier').value = prefill;
    document.getElementById('fpMsg').textContent = '';
    setTimeout(() => document.getElementById('fpIdentifier').focus(), 100);
  }

  function startForgotCooldown() {
    forgotCooldown = 45;
    const btn = document.getElementById('fpSubmitBtn');
    const tick = setInterval(() => {
      forgotCooldown--;
      if (!btn || forgotCooldown <= 0) {
        clearInterval(tick);
        if (btn) { btn.disabled = false; btn.textContent = '📧 পাসওয়ার্ড রিসেট লিংক পাঠান'; }
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ অপেক্ষা করুন (' + toBnNum(forgotCooldown) + ' সে.)';
    }, 1000);
  }

  async function handleForgotPassword() {
    const rawId = (document.getElementById('fpIdentifier').value || '').trim().toLowerCase();
    if (!rawId) {
      setAuthMsg('fpMsg', '⚠️ আপনার ইউজারনেম বা ইমেইল আইডি দিন।', true);
      return;
    }
    const btn = document.getElementById('fpSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ লিংক পাঠানো হচ্ছে...';
    setAuthMsg('fpMsg', '', false);
    try {
      let emailToUse = rawId;
      if (!rawId.includes('@')) {
        const resolved = await callAutopilotApi({ mode: 'resolve_login', username: rawId }, 15000);
        if (!resolved.email) throw new Error('এই ইউজারনেম খুঁজে পাওয়া যায়নি।');
        emailToUse = resolved.email;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailToUse)) {
        throw new Error('একটি সঠিক ইমেইল আইডি দিন।');
      }

      const redirectUrl = window.location.origin + window.location.pathname;
      await sbAuthCall('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectUrl), {
        email: emailToUse
      });
      setAuthMsg('fpMsg', '✅ ' + emailToUse + ' ঠিকানায় পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইনবক্স (বা Spam ফোল্ডার) খুলে "Reset Password" লিংকে ক্লিক করে নতুন পাসওয়ার্ড দিন।', false);
      startForgotCooldown();
    } catch (e) {
      let m = e.message || 'লিংক পাঠাতে সমস্যা হয়েছে';
      if (/rate limit|too many/i.test(m)) m = 'কিছুক্ষণ আগে লিংক পাঠানো হয়েছে—১ মিনিট পর আবার চেষ্টা করুন।';
      setAuthMsg('fpMsg', '❌ ' + m, true);
      btn.disabled = false;
      btn.textContent = '📧 পাসওয়ার্ড রিসেট লিংক পাঠান';
    }
  }

  function openResetPasswordPane() {
    showAuthScreen();
    document.getElementById('authTabsBar').style.display = 'none';
    document.getElementById('authSigninPane').style.display = 'none';
    document.getElementById('authSignupPane').style.display = 'none';
    document.getElementById('authOtpPane').style.display = 'none';
    document.getElementById('authForgotPane').style.display = 'none';
    document.getElementById('authResetPane').style.display = 'block';
    document.getElementById('rpNewPassword').value = '';
    document.getElementById('rpConfirmPassword').value = '';
    document.getElementById('rpMsg').textContent = '';
    setTimeout(() => document.getElementById('rpNewPassword').focus(), 100);
  }

  function cancelPasswordReset() {
    recoveryAccessToken = '';
    switchAuthTab('signin');
  }

  async function handleConfirmPasswordReset() {
    const p1 = document.getElementById('rpNewPassword').value || '';
    const p2 = document.getElementById('rpConfirmPassword').value || '';
    if (p1.length < 8) {
      setAuthMsg('rpMsg', '⚠️ নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', true);
      return;
    }
    if (p1 !== p2) {
      setAuthMsg('rpMsg', '⚠️ নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মেলেনি।', true);
      return;
    }
    if (!recoveryAccessToken) {
      setAuthMsg('rpMsg', '⚠️ রিসেট সেশনের মেয়াদ শেষ হয়েছে—আবার Forgot Password থেকে লিংক নিন।', true);
      return;
    }
    const btn = document.getElementById('rpSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ পাসওয়ার্ড সেভ হচ্ছে...';
    setAuthMsg('rpMsg', '', false);
    try {
      const uRes = await sbUpdatePasswordWithToken(recoveryAccessToken, p1);
      recoveryAccessToken = '';
      document.getElementById('rpNewPassword').value = '';
      document.getElementById('rpConfirmPassword').value = '';
      switchAuthTab('signin');
      if (uRes && uRes.email) document.getElementById('siIdentifier').value = uRes.email;
      setAuthMsg('siMsg', '✅ পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।', false);
      setTimeout(() => document.getElementById('siPassword').focus(), 100);
    } catch (e) {
      let m = e.message || 'পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে';
      if (/different from the old password/i.test(m)) m = 'নতুন পাসওয়ার্ডটি পুরোনো পাসওয়ার্ডের চেয়ে আলাদা হতে হবে।';
      setAuthMsg('rpMsg', '❌ ' + m, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ নতুন পাসওয়ার্ড সেভ করুন';
    }
  }

  function toggleProfilePwdForm() {
    const f = document.getElementById('profilePwdForm');
    if (!f) return;
    const isHidden = f.style.display === 'none';
    f.style.display = isHidden ? 'block' : 'none';
    document.getElementById('profNewPwd').value = '';
    document.getElementById('profConfirmPwd').value = '';
    document.getElementById('profPwdMsg').textContent = '';
  }

  async function handleChangePasswordLoggedIn() {
    const p1 = document.getElementById('profNewPwd').value || '';
    const p2 = document.getElementById('profConfirmPwd').value || '';
    if (p1.length < 8) {
      setAuthMsg('profPwdMsg', '⚠️ নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', true);
      return;
    }
    if (p1 !== p2) {
      setAuthMsg('profPwdMsg', '⚠️ দুটি পাসওয়ার্ড মেলেনি।', true);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setAuthMsg('profPwdMsg', '⚠️ সেশন পাওয়া যায়নি—আবার সাইন ইন করুন।', true);
      return;
    }
    const btn = document.getElementById('profPwdBtn');
    btn.disabled = true;
    btn.textContent = '⏳ আপডেট হচ্ছে...';
    setAuthMsg('profPwdMsg', '', false);
    try {
      await sbUpdatePasswordWithToken(token, p1);
      document.getElementById('profNewPwd').value = '';
      document.getElementById('profConfirmPwd').value = '';
      setAuthMsg('profPwdMsg', '✅ পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!', false);
    } catch (e) {
      let m = e.message || 'সমস্যা হয়েছে';
      if (/different from the old password/i.test(m)) m = 'নতুন পাসওয়ার্ডটি পুরোনো পাসওয়ার্ডের চেয়ে আলাদা হতে হবে।';
      setAuthMsg('profPwdMsg', '❌ ' + m, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ পাসওয়ার্ড আপডেট করুন';
    }
  }

  async function handleSignUp() {
    const username = (document.getElementById('suUsername').value || '').trim().toLowerCase();
    const email = (document.getElementById('suEmail').value || '').trim().toLowerCase();
    const phoneDigits = (document.getElementById('suPhone').value || '').replace(/\D/g, '');
    const capital = Number(document.getElementById('suCapital').value || 10000);
    const password = document.getElementById('suPassword').value || '';
    const confirmPassword = document.getElementById('suConfirmPassword').value || '';

    if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
      setAuthMsg('suMsg', '⚠️ ইউজারনেম ৩ থেকে ২০ অক্ষরের হতে হবে (শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, _ বা -)।', true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setAuthMsg('suMsg', '⚠️ একটি সঠিক (Valid) ইমেইল আইডি দিন।', true);
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      setAuthMsg('suMsg', '⚠️ একটি সঠিক ১০-সংখ্যার ভারতীয় মোবাইল নম্বর দিন (৬, ৭, ৮ বা ৯ দিয়ে শুরু)।', true);
      return;
    }
    if (isNaN(capital) || capital < 1000 || capital > 10000000) {
      setAuthMsg('suMsg', '⚠️ শুরুর মূলধন কমপক্ষে ₹1,000 থেকে ₹1,00,00,000-এর মধ্যে দিন।', true);
      return;
    }
    if (password.length < 8) {
      setAuthMsg('suMsg', '⚠️ পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের (Minimum 8 characters) হতে হবে।', true);
      return;
    }
    if (password !== confirmPassword) {
      setAuthMsg('suMsg', '⚠️ Password এবং Confirm Password মেলেনি—আবার মিলিয়ে লিখুন।', true);
      return;
    }

    const btn = document.getElementById('suSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ যাচাই করা হচ্ছে...';
    setAuthMsg('suMsg', '', false);
    try {
      // 1. Check username uniqueness
      const chk = await callAutopilotApi({ mode: 'check_username', username, email }, 15000);
      if (!chk.available) {
        throw new Error(chk.reason || 'এই ইউজারনেম বা ইমেইল ইতিমধ্যেই ব্যবহৃত হয়েছে।');
      }

      // 2. Call Supabase Auth SignUp with redirect_to back to this exact page (Default Email Confirm Link)
      const phoneFull = '+91' + phoneDigits;
      const redirectUrl = window.location.origin + window.location.pathname;
      const suRes = await sbAuthCall('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirectUrl), {
        email,
        password,
        data: { username, phone: phoneFull, initial_capital: capital }
      });

      pendingSignUp = {
        username, email, phone: phoneFull,
        initial_capital: capital
      };
      try { localStorage.setItem('sy_pending_signup', JSON.stringify(pendingSignUp)); } catch (_) {}

      // If Supabase returned an active session directly, finalize right away
      if (suRes.access_token) {
        authSession = { access_token: suRes.access_token, refresh_token: suRes.refresh_token, user: suRes.user };
        await finalizeVerifiedProfile();
        return;
      }

      // Show Email Confirm Link instruction screen
      document.getElementById('otpTargetEmail').textContent = email;
      document.getElementById('otpMsg').textContent = '';
      document.getElementById('authTabsBar').style.display = 'none';
      document.getElementById('authSignupPane').style.display = 'none';
      document.getElementById('authOtpPane').style.display = 'block';
      startResendCooldown();
    } catch (e) {
      setAuthMsg('suMsg', '❌ ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '📧 ভেরিফিকেশন লিংক পাঠান';
    }
  }

  function backToSignUp() {
    document.getElementById('authTabsBar').style.display = 'grid';
    document.getElementById('authOtpPane').style.display = 'none';
    document.getElementById('authSignupPane').style.display = 'block';
  }

  function startResendCooldown() {
    resendCooldown = 45;
    const btn = document.getElementById('resendOtpBtn');
    const tick = setInterval(() => {
      resendCooldown--;
      if (!btn || resendCooldown <= 0) {
        clearInterval(tick);
        if (btn) { btn.disabled = false; btn.textContent = '🔄 আবার লিংক পাঠান'; }
        return;
      }
      btn.disabled = true;
      btn.textContent = '⏳ অপেক্ষা করুন (' + toBnNum(resendCooldown) + ' সে.)';
    }, 1000);
  }

  async function handleResendOtp() {
    if (!pendingSignUp || !pendingSignUp.email) return;
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      await sbAuthCall('/auth/v1/resend?redirect_to=' + encodeURIComponent(redirectUrl), {
        type: 'signup',
        email: pendingSignUp.email
      });
      setAuthMsg('otpMsg', '✅ আপনার ইমেইলে নতুন ভেরিফিকেশন লিংক পাঠানো হয়েছে।', false);
      startResendCooldown();
    } catch (e) {
      setAuthMsg('otpMsg', '❌ লিংক পাঠাতে সমস্যা: ' + e.message, true);
    }
  }

  function goToSignInAfterLink() {
    const emailPrefill = (pendingSignUp && pendingSignUp.email) ? pendingSignUp.email : '';
    switchAuthTab('signin');
    if (emailPrefill) document.getElementById('siIdentifier').value = emailPrefill;
    setAuthMsg('siMsg', '✅ ইমেইল লিংক ক্লিক করা হয়ে থাকলে এখন পাসওয়ার্ড দিয়ে সাইন ইন করুন।', false);
    setTimeout(() => document.getElementById('siPassword').focus(), 100);
  }

  function loadPendingSignUpLocal() {
    if (pendingSignUp) return pendingSignUp;
    try {
      const saved = JSON.parse(localStorage.getItem('sy_pending_signup') || 'null');
      if (saved && saved.email) return saved;
    } catch (_) {}
    return null;
  }

  async function finalizeVerifiedProfile() {
    const p = loadPendingSignUpLocal() || {};
    const res = await callAutopilotApi({
      mode: 'init_user_profile',
      username: p.username || undefined,
      phone: p.phone || undefined,
      initial_capital: p.initial_capital || undefined
    }, 20000);
    userProfile = res.profile;
    pendingSignUp = null;
    try { localStorage.removeItem('sy_pending_signup'); } catch (_) {}
    saveAuthLocal();
    showAppShell();
    await refreshAll(true);
  }

  async function handleSignIn() {
    const rawId = (document.getElementById('siIdentifier').value || '').trim().toLowerCase();
    const password = document.getElementById('siPassword').value || '';
    if (!rawId) { setAuthMsg('siMsg', '⚠️ আপনার ইউজারনেম বা ইমেইল আইডি দিন।', true); return; }
    if (password.length < 8) { setAuthMsg('siMsg', '⚠️ কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।', true); return; }

    const btn = document.getElementById('siSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ সাইন ইন হচ্ছে...';
    setAuthMsg('siMsg', '', false);
    try {
      let emailToUse = rawId;
      if (!rawId.includes('@')) {
        const resolved = await callAutopilotApi({ mode: 'resolve_login', username: rawId }, 15000);
        if (!resolved.email) throw new Error('এই ইউজারনেম খুঁজে পাওয়া যায়নি।');
        emailToUse = resolved.email;
      }

      const tRes = await sbAuthCall('/auth/v1/token?grant_type=password', {
        email: emailToUse,
        password
      });
      if (!tRes.access_token) throw new Error('লগইন সফল হয়নি।');
      authSession = { access_token: tRes.access_token, refresh_token: tRes.refresh_token, user: tRes.user };

      const profRes = await callAutopilotApi({ mode: 'get_my_profile' }, 18000);
      userProfile = profRes.profile;
      try { localStorage.removeItem('sy_pending_signup'); } catch (_) {}
      saveAuthLocal();
      document.getElementById('siPassword').value = '';
      showAppShell();
      await refreshAll(true);
    } catch (e) {
      let m = e.message || 'লগইন ব্যর্থ হয়েছে';
      if (/email not confirmed/i.test(m)) m = 'আপনার ইমেইলের ভেরিফিকেশন লিংকে এখনো ক্লিক করা হয়নি। ইনবক্স বা Spam ফোল্ডার চেক করুন।';
      else if (/invalid login credentials/i.test(m)) m = 'ইউজারনেম/ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।';
      setAuthMsg('siMsg', '❌ ' + m, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔓 সাইন ইন করুন';
    }
  }

  async function restoreSessionOnBoot() {
    // 1. Check if returning from Supabase Email Confirm Link (#access_token=... or #error=...)
    const hashStr = (window.location.hash || '').replace(/^#/, '');
    if (hashStr && (hashStr.includes('access_token=') || hashStr.includes('error='))) {
      const params = new URLSearchParams(hashStr);
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}

      const errDesc = params.get('error_description') || params.get('error');
      if (errDesc) {
        showAuthScreen();
        switchAuthTab('signin');
        setAuthMsg('siMsg', '⚠️ ইমেইল লিংকটির মেয়াদ শেষ হয়েছে বা আগে ব্যবহৃত হয়েছে (' + errDesc + ')। ইতিমধ্যে ভেরিফাই হয়ে থাকলে সরাসরি সাইন ইন করুন।', true);
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      const authType = (params.get('type') || '').toLowerCase();

      if (accessToken && authType === 'recovery') {
        recoveryAccessToken = accessToken;
        openResetPasswordPane();
        return;
      }

      if (accessToken) {
        authSession = { access_token: accessToken, refresh_token: refreshToken, user: null };
        try {
          await finalizeVerifiedProfile();
          return;
        } catch (e) {
          showAuthScreen();
          switchAuthTab('signin');
          setAuthMsg('siMsg', '⚠️ ইমেইল ভেরিফাই হয়েছে, তবে প্রোফাইল লোডে সমস্যা: ' + e.message + ' — অনুগ্রহ করে সাইন ইন করুন।', true);
          return;
        }
      }
    }

    // 2. Normal saved session restore
    loadAuthLocal();
    if (!authSession || !authSession.access_token) {
      showAuthScreen();
      return;
    }
    try {
      const profRes = await callAutopilotApi({ mode: 'get_my_profile' }, 15000);
      userProfile = profRes.profile;
      saveAuthLocal();
      showAppShell();
      await refreshAll(true);
    } catch (e) {
      // Try refreshing expired JWT token using refresh_token
      if (authSession && authSession.refresh_token) {
        try {
          const refRes = await sbAuthCall('/auth/v1/token?grant_type=refresh_token', {
            refresh_token: authSession.refresh_token
          });
          if (refRes.access_token) {
            authSession = { access_token: refRes.access_token, refresh_token: refRes.refresh_token, user: refRes.user };
            const profRes2 = await callAutopilotApi({ mode: 'get_my_profile' }, 15000);
            userProfile = profRes2.profile;
            saveAuthLocal();
            showAppShell();
            await refreshAll(true);
            return;
          }
        } catch (_) {}
      }
      authSession = null;
      userProfile = null;
      saveAuthLocal();
      showAuthScreen();
    }
  }

  function openProfileModal() {
    if (!userProfile) return;
    const p = userProfile;
    document.getElementById('profileDetailsBox').innerHTML =
      '<div class="profile-row"><span style="color:var(--muted);">ইউজারনেম</span><b>@' + escapeHtml(p.username) + '</b></div>' +
      '<div class="profile-row"><span style="color:var(--muted);">ইমেইল</span><span><b>' + escapeHtml(p.email) + '</b> <span class="tag tag-buy">✓ ভেরিফায়েড</span></span></div>' +
      '<div class="profile-row"><span style="color:var(--muted);">মোবাইল নম্বর</span><span><b>' + escapeHtml(p.phone || '—') + '</b> <span class="tag tag-neut">সেভড</span></span></div>' +
      '<div class="profile-row"><span style="color:var(--muted);">শুরুর মূলধন</span><b>' + fmt(p.initial_capital || 10000) + '</b></div>' +
      '<div class="profile-row" style="border-bottom:none;"><span style="color:var(--muted);">পোর্টফোলিও Sync ID</span><span class="tag tag-cat">' + escapeHtml(p.sync_id) + '</span></div>';

    const pf = document.getElementById('profilePwdForm');
    if (pf) pf.style.display = 'none';
    const pm = document.getElementById('profPwdMsg');
    if (pm) pm.textContent = '';
    document.getElementById('profileModal').classList.add('open');
  }

  function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('open');
  }

  function handleSignOut() {
    closeProfileModal();
    authSession = null;
    userProfile = null;
    liveMarketOverride = null;
    logsData = [];
    stateData = { cash: 10000, practice_day: 1, holdings: {} };
    syncAssetsFromState();
    memoryData = { initial_capital: 10000, win_count: 0, loss_count: 0, total_trades: 0, strategy_weights: { dip_buying: 1, smart_sip: 1, gold_hedge: 1, profit_lock: 1 }, lessons: [] };
    saveAuthLocal();
    switchAuthTab('signin');
    showAuthScreen();
  }


  // ===== CUSTOM ASSETS (+ ADD / REMOVE) =====
  function onCustomAssetTypeChange() {
    const t = document.getElementById('caType').value;
    const isCrypto = t === 'CRYPTO';
    document.getElementById('caTaxWrap').style.display = isCrypto ? 'none' : 'block';
    document.getElementById('caSymbolLabel').textContent = isCrypto
      ? 'Binance কয়েন সিম্বল (যেমন: BNB, XRP, DOGE, ADA)'
      : 'NSE সিম্বল (যেমন: ITC, WIPRO, ZOMATO, BANKBEES)';
    document.getElementById('caSymbol').placeholder = isCrypto ? 'যেমন: BNB বা XRP' : 'যেমন: ITC বা TATAMOTORS';
  }

  function prefillCustomAsset(type, sym, name, taxCat) {
    document.getElementById('caType').value = type;
    onCustomAssetTypeChange();
    if (type !== 'CRYPTO' && taxCat) document.getElementById('caTaxCat').value = taxCat;
    document.getElementById('caSymbol').value = sym;
    document.getElementById('caName').value = name;
    setAuthMsg('caMsg', '', false);
  }

  function renderCustomAssetsListInModal() {
    const wrap = document.getElementById('caListWrap');
    const box = document.getElementById('caCustomList');
    if (!wrap || !box) return;
    if (!customAssetsList.length) {
      wrap.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    wrap.style.display = 'block';
    box.innerHTML = customAssetsList.map(item =>
      '<div class="custom-list-item">' +
        '<div><b>' + escapeHtml(item.name || item.id) + '</b> <span class="tag tag-cat" style="font-size:10px;">' + escapeHtml(item.broker || (item.type === 'CRYPTO' ? 'Binance' : 'Groww')) + '</span><br><small style="color:var(--muted);">' + escapeHtml(item.binanceSymbol || item.symbol || item.id) + '</small></div>' +
        '<button type="button" class="asset-del-btn" style="padding:4px 9px;font-size:11.5px;" onclick="handleRemoveCustomAsset(\'' + escapeHtml(item.id) + '\')">🗑️ মুছুন</button>' +
      '</div>'
    ).join('');
  }

  function openAddAssetModal() {
    document.getElementById('caType').value = 'STOCK';
    onCustomAssetTypeChange();
    document.getElementById('caSymbol').value = '';
    document.getElementById('caName').value = '';
    setAuthMsg('caMsg', '', false);
    renderCustomAssetsListInModal();
    document.getElementById('addAssetModal').classList.add('open');
    setTimeout(() => document.getElementById('caSymbol').focus(), 100);
  }

  function closeAddAssetModal() {
    document.getElementById('addAssetModal').classList.remove('open');
  }

  async function handleAddCustomAsset() {
    const type = document.getElementById('caType').value;
    const rawSym = (document.getElementById('caSymbol').value || '').trim().toUpperCase();
    const name = (document.getElementById('caName').value || '').trim();
    const taxCat = type === 'CRYPTO' ? 'CRYPTO' : (document.getElementById('caTaxCat').value || 'EQUITY');

    if (!rawSym || rawSym.length < 2 || rawSym.length > 20) {
      setAuthMsg('caMsg', '⚠️ সঠিক সিম্বল দিন (যেমন: ITC, TATAMOTORS, BANKBEES, BNB, XRP)।', true);
      return;
    }

    const btn = document.getElementById('caSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ লাইভ দাম যাচাই হচ্ছে...';
    setAuthMsg('caMsg', '', false);
    try {
      const data = await callAutopilotApi({
        mode: 'add_custom_asset',
        asset_type: type,
        symbol: rawSym,
        name,
        tax_cat: taxCat
      }, 22000);

      if (!stateData.profile || typeof stateData.profile !== 'object') stateData.profile = {};
      stateData.profile.custom_assets = Array.isArray(data.custom_assets) ? data.custom_assets : [];
      if (data.market) liveMarketOverride = data.market;
      syncAssetsFromState();
      renderCustomAssetsListInModal();
      renderAll();
      document.getElementById('caSymbol').value = '';
      document.getElementById('caName').value = '';
      const addedInfo = data.added || {};
      const liveP = addedInfo.live_price ? ' (বর্তমান দাম: ' + fmt(addedInfo.live_price) + ')' : '';
      setAuthMsg('caMsg', '✅ ' + (addedInfo.name || rawSym) + ' সফলভাবে যোগ হয়েছে!' + liveP, false);
    } catch (e) {
      setAuthMsg('caMsg', '❌ ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ লাইভ রেট যাচাই করে যোগ করুন';
    }
  }

  async function handleRemoveCustomAsset(assetId) {
    const info = ASSETS[assetId];
    const label = info ? info.name : assetId;
    if (!confirm('আপনি কি "' + label + '" তালিকা থেকে মুছে ফেলতে চান?')) return;
    try {
      const data = await callAutopilotApi({
        mode: 'remove_custom_asset',
        asset_id: assetId
      }, 18000);
      if (!stateData.profile || typeof stateData.profile !== 'object') stateData.profile = {};
      stateData.profile.custom_assets = Array.isArray(data.custom_assets) ? data.custom_assets : [];
      if (liveMarketOverride && liveMarketOverride[assetId]) delete liveMarketOverride[assetId];
      syncAssetsFromState();
      renderCustomAssetsListInModal();
      renderAll();
      setAuthMsg('caMsg', '✅ "' + label + '" তালিকা থেকে মুছে ফেলা হয়েছে।', false);
    } catch (e) {
      alert('মুছে ফেলতে সমস্যা: ' + e.message);
    }
  }


  // ===== LOGIN SCREEN ANIMATED AI FINTECH CANVAS BACKGROUND =====
  let authBgRaf = null;
  let authBgNodes = [];
  let authBgParticles = [];
  let authBgResizeBound = false;

  function initAuthBgScene(w, h) {
    authBgNodes = [];
    const nodeCount = w < 720 ? 22 : 38;
    const regionW = w < 720 ? w * 0.95 : w * 0.42;
    const regionH = w < 720 ? h * 0.42 : h * 0.56;
    for (let i = 0; i < nodeCount; i++) {
      authBgNodes.push({
        x: Math.random() * regionW,
        y: Math.random() * regionH + h * 0.04,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.24,
        r: 1.8 + Math.random() * 2.6,
        phase: Math.random() * Math.PI * 2
      });
    }
    authBgParticles = [];
    for (let i = 0; i < 42; i++) {
      authBgParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vy: -0.15 - Math.random() * 0.35,
        r: 0.9 + Math.random() * 1.9,
        alpha: 0.18 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function drawGlowingShield(ctx, cx, cy, scale, t) {
    ctx.save();
    ctx.translate(cx, cy);

    // 3D Isometric Digital Radar / Circuit Rings beneath shield
    ctx.save();
    ctx.translate(0, 74 * scale);
    ctx.scale(1, 0.36);
    for (let ring = 1; ring <= 4; ring++) {
      const rad = (44 + ring * 26) * scale;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.strokeStyle = ring % 2 === 0
        ? 'rgba(45, 212, 191, ' + (0.34 - ring * 0.05) + ')'
        : 'rgba(16, 185, 129, ' + (0.42 - ring * 0.07) + ')';
      ctx.lineWidth = ring === 1 ? 2.2 : 1.3;
      if (ring === 3) ctx.setLineDash([10 * scale, 8 * scale]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Rotating radar sweep arc
    const sweep = (t * 0.55) % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(0, 0, 122 * scale, sweep, sweep + 1.15);
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Radial spokes
    for (let a = 0; a < 12; a++) {
      const ang = (a * Math.PI) / 6 + t * 0.08;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 46 * scale, Math.sin(ang) * 46 * scale);
      ctx.lineTo(Math.cos(ang) * 148 * scale, Math.sin(ang) * 148 * scale);
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Ambient halo behind shield
    const halo = ctx.createRadialGradient(0, -4 * scale, 10 * scale, 0, -4 * scale, 96 * scale);
    halo.addColorStop(0, 'rgba(45, 212, 191, 0.36)');
    halo.addColorStop(0.55, 'rgba(16, 185, 129, 0.14)');
    halo.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, -4 * scale, 96 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Shield Path
    const bob = Math.sin(t * 1.4) * 3.5 * scale;
    ctx.translate(0, bob);
    const s = scale;
    ctx.beginPath();
    ctx.moveTo(0, -68 * s);
    ctx.bezierCurveTo(32 * s, -54 * s, 54 * s, -50 * s, 58 * s, -42 * s);
    ctx.bezierCurveTo(58 * s, 14 * s, 38 * s, 48 * s, 0, 68 * s);
    ctx.bezierCurveTo(-38 * s, 48 * s, -58 * s, 14 * s, -58 * s, -42 * s);
    ctx.bezierCurveTo(-54 * s, -50 * s, -32 * s, -54 * s, 0, -68 * s);
    ctx.closePath();

    const shieldGrad = ctx.createLinearGradient(-50 * s, -65 * s, 50 * s, 65 * s);
    shieldGrad.addColorStop(0, 'rgba(45, 212, 191, 0.28)');
    shieldGrad.addColorStop(0.5, 'rgba(15, 118, 110, 0.38)');
    shieldGrad.addColorStop(1, 'rgba(6, 78, 59, 0.48)');
    ctx.fillStyle = shieldGrad;
    ctx.shadowColor = 'rgba(52, 211, 153, 0.8)';
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.lineWidth = 2.4 * s;
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.88)';
    ctx.stroke();

    // Inner shield rim
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, -56 * s);
    ctx.bezierCurveTo(26 * s, -44 * s, 44 * s, -41 * s, 47 * s, -34 * s);
    ctx.bezierCurveTo(47 * s, 10 * s, 30 * s, 39 * s, 0, 56 * s);
    ctx.bezierCurveTo(-30 * s, 39 * s, -47 * s, 10 * s, -47 * s, -34 * s);
    ctx.bezierCurveTo(-44 * s, -41 * s, -26 * s, -44 * s, 0, -56 * s);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.35)';
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();

    // Padlock Shackle
    ctx.beginPath();
    ctx.arc(0, -14 * s, 13 * s, Math.PI, 0, false);
    ctx.lineTo(13 * s, -2 * s);
    ctx.moveTo(-13 * s, -14 * s);
    ctx.lineTo(-13 * s, -2 * s);
    ctx.strokeStyle = '#d1fae5';
    ctx.lineWidth = 4.2 * s;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(110, 231, 183, 0.85)';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Padlock Body
    const bw = 38 * s, bh = 30 * s, bx = -bw / 2, by = -3 * s, br = 6 * s;
    ctx.beginPath();
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fillStyle = 'rgba(209, 250, 229, 0.92)';
    ctx.fill();

    // Keyhole
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, 9 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-1.8 * s, 10 * s, 3.6 * s, 9 * s);

    ctx.restore();
  }

  function drawHolographicChart(ctx, x, y, w, h, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, -0.055, 0, 1, 0, 0);

    // Glass panel backdrop
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(6, 78, 59, 0.24)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.10)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, w, h, 14) : ctx.rect(0, 0, w, h);
    ctx.fill();
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.11)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const gy = (h / 6) * i;
      ctx.beginPath();
      ctx.moveTo(14, gy);
      ctx.lineTo(w - 14, gy);
      ctx.stroke();
    }
    for (let j = 1; j <= 8; j++) {
      const gx = (w / 9) * j;
      ctx.beginPath();
      ctx.moveTo(gx, 16);
      ctx.lineTo(gx, h - 14);
      ctx.stroke();
    }

    // Subtle SafeYield AI chart header
    ctx.fillStyle = 'rgba(167, 243, 208, 0.55)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('SafeYield AI • Live Quant Feed', 18, 24);

    // Rising candlesticks
    const candles = [
      [0.16, 0.28, 0.12, 0.34, true],
      [0.26, 0.22, 0.18, 0.32, false],
      [0.24, 0.36, 0.20, 0.42, true],
      [0.34, 0.45, 0.30, 0.52, true],
      [0.44, 0.38, 0.34, 0.49, false],
      [0.40, 0.54, 0.36, 0.60, true],
      [0.52, 0.62, 0.48, 0.68, true],
      [0.60, 0.55, 0.50, 0.66, false],
      [0.56, 0.72, 0.52, 0.78, true],
      [0.70, 0.64, 0.60, 0.76, false],
      [0.66, 0.80, 0.61, 0.86, true],
      [0.78, 0.88, 0.73, 0.94, true],
      [0.84, 0.78, 0.74, 0.90, false],
      [0.80, 0.91, 0.76, 0.96, true]
    ];
    const padX = 24, padY = 34;
    const cw = (w - padX * 2) / candles.length;
    const ch = h - padY - 18;
    const linePts = [];

    candles.forEach((c, idx) => {
      const wave = Math.sin(t * 1.1 + idx * 0.45) * 0.015;
      const open = c[0] + wave;
      const close = c[1] + wave;
      const low = Math.min(c[2] + wave, open, close);
      const high = Math.max(c[3] + wave, open, close);
      const bull = c[4];

      const cx = padX + idx * cw + cw * 0.5;
      const yHigh = padY + ch * (1 - high);
      const yLow = padY + ch * (1 - low);
      const yTop = padY + ch * (1 - Math.max(open, close));
      const yBot = padY + ch * (1 - Math.min(open, close));
      linePts.push([cx, (yTop + yBot) * 0.5]);

      ctx.strokeStyle = bull ? 'rgba(52, 211, 153, 0.85)' : 'rgba(45, 212, 191, 0.52)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, yHigh);
      ctx.lineTo(cx, yLow);
      ctx.stroke();

      ctx.fillStyle = bull ? 'rgba(16, 185, 129, 0.85)' : 'rgba(13, 148, 136, 0.45)';
      ctx.shadowColor = bull ? 'rgba(52, 211, 153, 0.65)' : 'transparent';
      ctx.shadowBlur = bull ? 10 : 0;
      ctx.fillRect(cx - cw * 0.28, yTop, cw * 0.56, Math.max(4, yBot - yTop));
      ctx.shadowBlur = 0;
    });

    // Smooth glowing trendline
    ctx.beginPath();
    linePts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.82)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(52, 211, 153, 0.9)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawLeftCandles(ctx, w, h, t) {
    ctx.save();
    const bars = [0.22, 0.30, 0.26, 0.38, 0.44, 0.35, 0.50, 0.58, 0.48, 0.64, 0.72, 0.60];
    const areaW = w < 720 ? w * 0.85 : w * 0.38;
    const step = areaW / bars.length;
    const baseY = h + 8;

    // Subtle rising trend curve behind left candlesticks
    ctx.beginPath();
    bars.forEach((b, i) => {
      const wave = Math.sin(t * 0.9 + i * 0.5) * 0.018;
      const x = 18 + i * step + step * 0.5;
      const y = baseY - (b + wave) * h * 0.44;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    bars.forEach((b, i) => {
      const wave = Math.sin(t * 0.9 + i * 0.5) * 0.018;
      const bh = (b + wave) * h * 0.40;
      const x = 18 + i * step + step * 0.25;
      const bw = Math.max(6, step * 0.42);
      const topY = baseY - bh;

      // Wick
      ctx.strokeStyle = 'rgba(110, 231, 183, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + bw / 2, topY - 26);
      ctx.lineTo(x + bw / 2, baseY);
      ctx.stroke();

      // Glowing bar
      const g = ctx.createLinearGradient(0, topY, 0, baseY);
      g.addColorStop(0, 'rgba(52, 211, 153, 0.72)');
      g.addColorStop(0.45, 'rgba(16, 185, 129, 0.28)');
      g.addColorStop(1, 'rgba(6, 78, 59, 0.02)');
      ctx.fillStyle = g;
      ctx.fillRect(x, topY, bw, bh);
    });
    ctx.restore();
  }

  function renderAuthBgFrame(nowMs) {
    const shell = document.getElementById('authShell');
    const canvas = document.getElementById('authBgCanvas');
    if (!shell || !canvas || shell.style.display === 'none') {
      authBgRaf = null;
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      initAuthBgScene(w, h);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const t = (nowMs || 0) * 0.001;

    // 1. Subtle Cyber Perspective Floor Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)';
    ctx.lineWidth = 1;
    const gridGap = 48;
    for (let gx = 0; gx < w; gx += gridGap) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += gridGap) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Left AI Neural Network Constellation
    const maxDist = w < 720 ? 110 : 145;
    const regionW = w < 720 ? w : w * 0.44;
    const regionH = w < 720 ? h * 0.46 : h * 0.60;
    for (let i = 0; i < authBgNodes.length; i++) {
      const n = authBgNodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 10 || n.x > regionW) n.vx *= -1;
      if (n.y < 14 || n.y > regionH) n.vy *= -1;
    }
    for (let i = 0; i < authBgNodes.length; i++) {
      const a = authBgNodes[i];
      for (let j = i + 1; j < authBgNodes.length; j++) {
        const b = authBgNodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.42;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(45, 212, 191, ' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < authBgNodes.length; i++) {
      const n = authBgNodes[i];
      const pulse = 0.65 + 0.35 * Math.sin(t * 2 + n.phase);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (0.9 + 0.2 * pulse), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(167, 243, 208, ' + (0.55 + 0.4 * pulse).toFixed(2) + ')';
      ctx.shadowColor = 'rgba(45, 212, 191, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 3. Bottom-Left Rising Glowing Candlesticks
    drawLeftCandles(ctx, w, h, t);

    // 4. Right Side Holographic Chart & Glowing Security Shield (Desktop/Tablet)
    if (w >= 860) {
      const chartW = Math.min(430, w * 0.31);
      const chartH = Math.min(250, h * 0.34);
      drawHolographicChart(ctx, w - chartW - 26, Math.max(40, h * 0.14), chartW, chartH, t);
      const shieldScale = Math.min(1.15, Math.max(0.75, w / 1280));
      drawGlowingShield(ctx, w * 0.81, h * 0.66, shieldScale, t);
    } else {
      // Subtle ambient shield on mobile bottom-right
      drawGlowingShield(ctx, w * 0.82, h * 0.85, 0.58, t);
    }

    // 5. Floating Ambient Data Particles
    for (let i = 0; i < authBgParticles.length; i++) {
      const p = authBgParticles[i];
      p.y += p.vy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + p.phase);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(110, 231, 183, ' + (p.alpha * tw).toFixed(2) + ')';
      ctx.fill();
    }

    authBgRaf = requestAnimationFrame(renderAuthBgFrame);
  }

  function startAuthBgAnimation() {
    if (!authBgResizeBound) {
      authBgResizeBound = true;
      window.addEventListener('resize', () => {
        if (authBgRaf) initAuthBgScene(window.innerWidth, window.innerHeight);
      });
    }
    if (!authBgRaf) {
      initAuthBgScene(window.innerWidth, window.innerHeight);
      authBgRaf = requestAnimationFrame(renderAuthBgFrame);
    }
  }

  function stopAuthBgAnimation() {
    if (authBgRaf) {
      cancelAnimationFrame(authBgRaf);
      authBgRaf = null;
    }
  }


  // ===== v6.0 DARK MODE =====
  function applyDarkMode() {
    document.body.classList.toggle('dark-mode', isDarkMode);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = isDarkMode ? '☀️ লাইট' : '🌙 ডার্ক';
  }

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('sy_dark_mode', isDarkMode ? 'on' : 'off');
    applyDarkMode();
    renderChart();
    if (typeof computePortfolioStats === 'function') {
      renderAllocationAndRisk(computePortfolioStats());
    }
  }

  // ===== v6.0 PAPER TRADING vs REAL PORTFOLIO MODE =====
  function getPortfolioMode() {
    const m = stateData && stateData.profile && stateData.profile.portfolio_mode;
    return m === 'REAL' ? 'REAL' : 'PAPER';
  }

  function updatePortfolioModeUI() {
    const mode = getPortfolioMode();
    const btn = document.getElementById('portfolioModeBtn');
    if (btn) {
      btn.textContent = mode === 'REAL' ? '💎 Real Mode' : '🧪 Paper Mode';
      btn.classList.toggle('mode-real', mode === 'REAL');
      btn.classList.toggle('mode-paper', mode !== 'REAL');
    }
  }

  async function togglePortfolioMode() {
    const nextMode = getPortfolioMode() === 'REAL' ? 'PAPER' : 'REAL';
    const msg = nextMode === 'REAL'
      ? 'আপনি কি "💎 Real Mode"-এ যেতে চান? এতে আপনার পোর্টফোলিও আসল Groww/Binance ট্র্যাকিং মোডে দেখাবে (কোনো পুরোনো ডেটা মুছবে না)।'
      : 'আপনি কি "🧪 Paper Mode" (প্র্যাকটিস মোড)-এ যেতে চান?';
    if (!confirm(msg)) return;
    try {
      await callAutopilotApi({ mode: 'set_portfolio_mode', portfolio_mode: nextMode }, 15000);
      if (!stateData.profile || typeof stateData.profile !== 'object') stateData.profile = {};
      stateData.profile.portfolio_mode = nextMode;
      updatePortfolioModeUI();
    } catch (e) {
      alert('মোড পরিবর্তনে সমস্যা: ' + e.message);
    }
  }

  // ===== v6.0 XIRR & CAPITAL DEPOSIT / WITHDRAW =====
  function computeXIRR(baseInitCap, cashFlows, currentVal, logs) {
    try {
      const nowMs = Date.now();
      let startMs = nowMs - 30 * 86400000;
      if (Array.isArray(logs) && logs.length) {
        const oldest = logs[logs.length - 1];
        if (oldest && oldest.created_at) {
          const t = new Date(oldest.created_at).getTime();
          if (!isNaN(t) && t < nowMs) startMs = t;
        }
      }
      const flows = [{ t: startMs, amt: -Math.abs(baseInitCap || 10000) }];
      for (const cf of (cashFlows || [])) {
        const a = Number(cf && cf.amount_inr || 0);
        if (a <= 0) continue;
        const dt = cf.date ? new Date(cf.date).getTime() : nowMs;
        flows.push({ t: isNaN(dt) ? nowMs : dt, amt: cf.type === 'DEPOSIT' ? -a : a });
      }
      flows.push({ t: nowMs, amt: Math.max(0, Number(currentVal || 0)) });

      const totalDays = Math.max(1, (nowMs - startMs) / 86400000);
      const netIn = flows.slice(0, -1).reduce((s, f) => s - f.amt, 0);
      if (netIn <= 0) return 0;
      const simpleRet = (currentVal - netIn) / netIn;
      if (totalDays < 5) {
        return Math.max(-99, Math.min(300, simpleRet * 100));
      }

      // Newton-Raphson XIRR solver
      let rate = Math.max(-0.85, Math.min(2.5, simpleRet * (365 / totalDays)));
      const t0 = flows[0].t;
      for (let iter = 0; iter < 35; iter++) {
        let f = 0, df = 0;
        for (const fl of flows) {
          const yrs = (fl.t - t0) / (365 * 86400000);
          const denom = Math.pow(1 + rate, yrs);
          if (!isFinite(denom) || denom <= 0) break;
          f += fl.amt / denom;
          df -= (yrs * fl.amt) / (denom * (1 + rate));
        }
        if (Math.abs(f) < 1e-4) break;
        if (!df || !isFinite(df)) break;
        const nextR = rate - f / df;
        if (!isFinite(nextR) || nextR <= -0.99 || nextR > 10) break;
        rate = nextR;
      }
      return Math.max(-99, Math.min(500, rate * 100));
    } catch (_) {
      return 0;
    }
  }

  async function submitCapitalFlow() {
    const type = document.getElementById('cfType').value;
    const amount_inr = Number(document.getElementById('cfAmount').value || 0);
    const note = (document.getElementById('cfNote').value || '').trim();
    const msgEl = document.getElementById('cfMsg');
    if (amount_inr < 100) {
      msgEl.style.color = '#dc2626';
      msgEl.textContent = '⚠️ কমপক্ষে ₹100 দিন।';
      return;
    }
    const btn = document.getElementById('cfSubmitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ সেভ হচ্ছে...';
    msgEl.textContent = '';
    try {
      const data = await callAutopilotApi({ mode: 'capital_flow', flow_type: type, amount_inr, note }, 18000);
      msgEl.style.color = '#15803d';
      msgEl.textContent = '✅ ' + (type === 'DEPOSIT' ? 'ডিপোজিট' : 'উইথড্র') + ' সেভ হয়েছে! নতুন ক্যাশ: ' + fmt(data.cash);
      document.getElementById('cfAmount').value = '';
      document.getElementById('cfNote').value = '';
      await refreshAll(false);
    } catch (e) {
      msgEl.style.color = '#dc2626';
      msgEl.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 ক্যাপিটাল এন্ট্রি সেভ করুন';
    }
  }

  function renderCashFlowHistory(st) {
    const box = document.getElementById('cfHistoryBox');
    if (!box) return;
    const flows = Array.isArray(st.cashFlows) ? st.cashFlows : [];
    if (!flows.length) {
      box.innerHTML = '<div style="color:var(--muted);">নেট ইনভেস্টেড মূলধন: <b>' + fmt(st.initCap) + '</b> • এখনও কোনো অতিরিক্ত ডিপোজিট/উইথড্র এন্ট্রি নেই।</div>';
      return;
    }
    const items = [...flows].reverse().slice(0, 6).map(f => {
      const dt = f.date ? new Date(f.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '';
      const isDep = f.type === 'DEPOSIT';
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">' +
        '<span><span class="tag ' + (isDep ? 'tag-buy' : 'tag-sell') + '">' + (isDep ? 'ডিপোজিট' : 'উইথড্র') + '</span> ' + escapeHtml(f.note || '') + ' <small style="color:var(--muted);">(' + dt + ')</small></span>' +
        '<b style="color:' + (isDep ? '#15803d' : '#b91c1c') + ';">' + (isDep ? '+' : '-') + fmt(f.amount_inr) + '</b>' +
      '</div>';
    }).join('');
    box.innerHTML = '<div style="margin-bottom:5px;color:var(--muted);">নেট ইনভেস্টেড মূলধন: <b>' + fmt(st.initCap) + '</b> (শুরুর ' + fmt(st.baseInitCap) + ' + ক্যাশ ফ্লো)</div>' + items;
  }

  // ===== v6.0 ALLOCATION DONUT + RISK METER + AI HEALTH SCORE =====
  function renderAllocationAndRisk(st) {
    let eqVal = 0, goldVal = 0, cryVal = 0;
    let maxSinglePct = 0, maxSingleName = '';
    const total = Math.max(1, st.total);
    let holdingsCount = 0;

    for (const [id, h] of Object.entries(st.hold || {})) {
      if (!h || !h.qty) continue;
      holdingsCount++;
      const info = ASSETS[id] || { name: id, taxCat: 'EQUITY', isCrypto: false };
      const p = st.snap[id] && st.snap[id].price;
      const v = p ? h.qty * p : Number(h.investedINR || 0);
      const pct = (v / total) * 100;
      if (pct > maxSinglePct) { maxSinglePct = pct; maxSingleName = info.name; }
      if (info.isCrypto || info.taxCat === 'CRYPTO') cryVal += v;
      else if (info.taxCat === 'GOLD') goldVal += v;
      else eqVal += v;
    }

    const cashVal = Math.max(0, st.cash);
    const eqPct = (eqVal / total) * 100;
    const goldPct = (goldVal / total) * 100;
    const cryPct = (cryVal / total) * 100;
    const cashPct = (cashVal / total) * 100;

    // Risk score (0 = safest, 100 = highest risk)
    let riskScore = Math.round(eqPct * 0.45 + goldPct * 0.2 + cryPct * 1.45 + Math.max(0, maxSinglePct - 25) * 1.2);
    riskScore = Math.max(5, Math.min(98, riskScore));

    // AI Health score (0-100)
    let health = 72;
    if (holdingsCount >= 3) health += 10;
    else if (holdingsCount === 0) health -= 12;
    if (goldPct >= 8 && goldPct <= 35) health += 8;
    if (cashPct >= 5 && cashPct <= 30) health += 6;
    if (cryPct > 18) health -= 18;
    if (maxSinglePct > 30) health -= 14;
    if (st.diffPct > 0) health += 4;
    health = Math.max(25, Math.min(98, Math.round(health)));

    const healthBadge = document.getElementById('aiHealthBadge');
    if (healthBadge) healthBadge.textContent = '🤖 AI হেলথ স্কোর: ' + health + '/100';

    const riskLbl = document.getElementById('riskMeterLabel');
    const riskMrk = document.getElementById('riskMeterMarker');
    if (riskMrk) riskMrk.style.left = riskScore + '%';
    if (riskLbl) {
      if (riskScore < 35) { riskLbl.textContent = 'নিরাপদ (Low Risk • ' + riskScore + ')'; riskLbl.style.color = '#15803d'; }
      else if (riskScore < 65) { riskLbl.textContent = 'ভারসাম্যপূর্ণ (Balanced • ' + riskScore + ')'; riskLbl.style.color = '#d97706'; }
      else { riskLbl.textContent = 'উচ্চ ঝুঁকি (High Risk • ' + riskScore + ')'; riskLbl.style.color = '#dc2626'; }
    }

    const listEl = document.getElementById('allocBreakdownList');
    if (listEl) {
      const rows = [
        ['#10b981', '📈 ইক্যুইটি ও স্টক', eqVal, eqPct],
        ['#f59e0b', '🥇 গোল্ড / সিলভার হেজ', goldVal, goldPct],
        ['#8b5cf6', '₿ ক্রিপ্টো', cryVal, cryPct],
        ['#3b82f6', '💵 হাতে নগদ (Cash)', cashVal, cashPct]
      ];
      listEl.innerHTML = rows.map(r =>
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + r[0] + ';margin-right:6px;"></span>' + r[1] + '</span>' +
          '<b>' + fmt(r[2]) + ' (' + r[3].toFixed(1) + '%)</b>' +
        '</div>'
      ).join('');
    }

    const warnEl = document.getElementById('allocWarningBox');
    if (warnEl) {
      const warns = [];
      if (cryPct > 15) warns.push('⚠️ ক্রিপ্টো এক্সপোজার ' + cryPct.toFixed(1) + '% (নিরাপদ সীমা ≤ ১৫%)—লাভ থাকলে কিছুটা রিব্যালেন্স করুন।');
      if (maxSinglePct > 28) warns.push('⚠️ ' + maxSingleName + '-এ একা ' + maxSinglePct.toFixed(1) + '% টাকা আছে—অন্য অ্যাসেটে ডাইভার্সিফাই করা নিরাপদ।');
      if (cashPct > 60) warns.push('💡 হাতে ' + cashPct.toFixed(1) + '% ক্যাশ পড়ে আছে—Buy on Dip বা Smart SIP-এ কাজে লাগাতে পারেন।');
      if (!warns.length) warns.push('✅ আপনার পোর্টফোলিও অ্যালোকেশন ও রিস্ক ব্যালেন্স সুন্দর অবস্থানে আছে।');
      warnEl.innerHTML = warns.join('<br>');
    }

    if (typeof Chart !== 'undefined') {
      const ctx = document.getElementById('allocationChart');
      if (ctx) {
        if (allocChartInstance) allocChartInstance.destroy();
        allocChartInstance = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['ইক্যুইটি', 'গোল্ড/সিলভার', 'ক্রিপ্টো', 'ক্যাশ'],
            datasets: [{
              data: [eqVal, goldVal, cryVal, cashVal],
              backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'],
              borderColor: isDarkMode ? '#111827' : '#ffffff',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            plugins: { legend: { display: false } }
          }
        });
      }
    }
  }

  // ===== v6.0 STRATEGY BACKTESTING LAB =====
  async function runStrategyBacktest() {
    const asset_id = document.getElementById('btAsset').value || 'nifty';
    const range = document.getElementById('btRange').value || '6mo';
    const capital = Number(document.getElementById('btCapital').value || 10000);
    const btn = document.getElementById('btRunBtn');
    const msg = document.getElementById('btStatusMsg');
    const wrap = document.getElementById('btResultsWrap');

    btn.disabled = true;
    btn.textContent = '⏳ আসল মার্কেট ডেটা এনে ব্যাকটেস্ট চলছে...';
    msg.textContent = '';
    try {
      const data = await callAutopilotApi({
        mode: 'backtest_strategy',
        asset_id,
        range,
        capital
      }, 28000);
      wrap.style.display = 'block';
      const s = data.summary || {};
      const best = s.winner || 'Buy on Dip + Profit Lock';
      msg.style.color = '#15803d';
      msg.textContent = '✅ ' + escapeHtml(data.asset_name || asset_id) + ' (' + data.days + ' ট্রেডিং দিন) — সেরা স্ট্র্যাটেজি: ' + best;

      const cards = [
        { k: 'dip', title: '📉 Buy on Dip + Profit Lock', d: s.dip_strategy || {} },
        { k: 'sip', title: '📅 Smart SIP', d: s.smart_sip || {} },
        { k: 'bh',  title: '📦 Buy & Hold', d: s.buy_hold || {} }
      ];
      document.getElementById('btMetricsGrid').innerHTML = cards.map(c => {
        const isWin = best === c.title.replace(/^[^\s]+\s/, '');
        const ret = Number(c.d.return_pct || 0);
        return '<div class="bt-card ' + (isWin ? 'winner' : '') + '">' +
          '<small>' + c.title + (isWin ? ' 🏆' : '') + '</small>' +
          '<strong style="color:' + (ret >= 0 ? '#15803d' : '#b91c1c') + ';">' + fmt(c.d.final_value || capital) + ' (' + (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%)</strong>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:3px;">Max Drawdown: -' + Number(c.d.max_drawdown_pct || 0).toFixed(1) + '% • ট্রেড: ' + (c.d.trades || 0) + '</div>' +
        '</div>';
      }).join('');

      if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('backtestChart');
        if (backtestChartInstance) backtestChartInstance.destroy();
        const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
        const gridColor = isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.07)';
        backtestChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels || [],
            datasets: [
              { label: 'Buy on Dip + Profit Lock', data: data.curves?.dip || [], borderColor: '#10b981', borderWidth: 2.3, tension: 0.25, pointRadius: 0 },
              { label: 'Smart SIP', data: data.curves?.sip || [], borderColor: '#3b82f6', borderWidth: 2, borderDash: [4, 3], tension: 0.25, pointRadius: 0 },
              { label: 'Buy & Hold', data: data.curves?.buy_hold || [], borderColor: '#f59e0b', borderWidth: 1.8, tension: 0.25, pointRadius: 0 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } } },
            scales: {
              x: { ticks: { color: tickColor, maxTicksLimit: 7 }, grid: { color: gridColor } },
              y: { ticks: { color: tickColor, callback: v => '₹' + Math.round(v).toLocaleString('en-IN') }, grid: { color: gridColor } }
            }
          }
        });
      }
    } catch (e) {
      msg.style.color = '#dc2626';
      msg.textContent = '❌ ব্যাকটেস্ট এরর: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '▶️ আসল হিস্টোরিক্যাল ডেটায় ব্যাকটেস্ট চালাও';
    }
  }

  // ===== v6.0 GOAL & SIP CALCULATOR =====
  function calculateGoalSip() {
    const out = document.getElementById('goalSipOutput');
    if (!out) return;
    const target = Math.max(1000, Number(document.getElementById('goalTarget')?.value || 100000));
    const years = Math.max(0.5, Number(document.getElementById('goalYears')?.value || 2));
    const annualRet = Math.max(1, Number(document.getElementById('goalReturn')?.value || 14));
    const current = Math.max(0, Number(document.getElementById('goalCurrent')?.value || 0));

    const n = Math.round(years * 12);
    const r = (annualRet / 100) / 12;
    const fvCurrent = current * Math.pow(1 + r, n);
    const gap = Math.max(0, target - fvCurrent);
    const sip = gap > 0 ? (gap * r) / (Math.pow(1 + r, n) - 1) : 0;
    const totalSipInvested = sip * n;
    const totalInvested = current + totalSipInvested;
    const estGain = Math.max(0, target - totalInvested);
    const achievedPct = Math.min(100, Math.round((current / target) * 100));

    out.innerHTML =
      '<div style="display:flex;justify-content:space-between;font-size:13.5px;"><span>প্রতি মাসে প্রয়োজনীয় SIP:</span><strong style="font-size:17px;color:#0f766e;">' + fmt(Math.ceil(sip)) + ' / মাস</strong></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:5px;"><span>মোট সময়: <b>' + n + ' মাস</b> • মোট জমা: <b>' + fmt(totalInvested) + '</b></span><span>আনুমানিক কম্পাউন্ড লাভ: <b style="color:#15803d;">+' + fmt(estGain) + '</b></span></div>' +
      '<div style="margin-top:8px;height:8px;background:rgba(15,23,42,0.12);border-radius:99px;overflow:hidden;"><div style="height:100%;width:' + achievedPct + '%;background:#10b981;border-radius:99px;"></div></div>' +
      '<small style="display:block;margin-top:4px;font-size:11.5px;">বর্তমান অগ্রগতি: ' + achievedPct + '% (আপনার বর্তমান ' + fmt(current) + ' টাকা ' + years + ' বছরে ~' + fmt(fvCurrent) + ' হতে পারে)</small>';
  }

  // ===== v6.0 GROWW / BINANCE CSV AUTO-IMPORT =====
  function parseCsvLine(line) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function matchAssetFromCsvSymbol(raw) {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const map = {
      NIFTYBEES: 'nifty', NIFTY50: 'nifty', GOLDBEES: 'gold', SILVERBEES: 'silver',
      TCS: 'tcs', HDFCBANK: 'hdfc', HDFC: 'hdfc', RELIANCE: 'reliance', INFY: 'infy', INFOSYS: 'infy',
      ICICIBANK: 'icici', ICICI: 'icici', SBIN: 'sbi', SBI: 'sbi',
      BTCUSDT: 'btc', BTCINR: 'btc', BTC: 'btc', ETHUSDT: 'eth', ETHINR: 'eth', ETH: 'eth',
      SOLUSDT: 'sol', SOLINR: 'sol', SOL: 'sol'
    };
    if (map[s]) return map[s];
    for (const [id, info] of Object.entries(ASSETS)) {
      const sym = String(info.symbol || '').toUpperCase().replace(/\.(NS|BO)|-INR|USDT/g, '').replace(/[^A-Z0-9]/g, '');
      if (s === id.toUpperCase() || (sym && s.startsWith(sym))) return id;
    }
    return '';
  }

  function handleCsvFileSelect(ev) {
    const file = ev.target && ev.target.files && ev.target.files[0];
    const msg = document.getElementById('csvMsg');
    const wrap = document.getElementById('csvPreviewWrap');
    parsedCsvTrades = [];
    if (!file) { wrap.style.display = 'none'; return; }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('CSV ফাইলে কোনো ট্রেড ডেটা নেই।');
        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const findCol = (pats) => headers.findIndex(h => pats.some(p => h.includes(p)));

        const idxSym = findCol(['symbol', 'stock', 'market', 'pair', 'asset', 'scrip', 'coin']);
        const idxSide = findCol(['type', 'side', 'action', 'buy/sell', 'order type']);
        const idxQty = findCol(['qty', 'quantity', 'executed', 'amount', 'units']);
        const idxPrice = findCol(['price', 'rate', 'avg']);
        const idxTotal = findCol(['total', 'value', 'net', 'inr']);
        const brokerSel = document.getElementById('csvBrokerType').value;

        for (let i = 1; i < Math.min(lines.length, 105); i++) {
          const cols = parseCsvLine(lines[i]);
          const rawSym = idxSym >= 0 ? cols[idxSym] : cols[0];
          const asset_id = matchAssetFromCsvSymbol(rawSym);
          if (!asset_id) continue;
          const rawSide = String(idxSide >= 0 ? cols[idxSide] : 'BUY').toUpperCase();
          const action = rawSide.includes('SELL') ? 'SELL' : 'BUY';
          const qty = Math.abs(parseFloat(String(idxQty >= 0 ? cols[idxQty] : '0').replace(/[^0-9.\-]/g, '')) || 0);
          let price = Math.abs(parseFloat(String(idxPrice >= 0 ? cols[idxPrice] : '0').replace(/[^0-9.\-]/g, '')) || 0);
          let total = Math.abs(parseFloat(String(idxTotal >= 0 ? cols[idxTotal] : '0').replace(/[^0-9.\-]/g, '')) || 0);

          const isCrypto = ASSETS[asset_id].isCrypto;
          if (isCrypto && String(rawSym).toUpperCase().includes('USDT')) {
            price = price * USD_RATE;
            total = total * USD_RATE;
          }
          if (total <= 0 && qty > 0 && price > 0) total = qty * price;
          if (total <= 0) continue;

          const broker = brokerSel === 'AUTO' ? ASSETS[asset_id].broker : brokerSel;
          parsedCsvTrades.push({
            broker,
            action,
            asset_id,
            qty: qty > 0 ? qty : undefined,
            price: price > 0 ? Math.round(price * 100) / 100 : undefined,
            amount_inr: Math.round(total * 100) / 100
          });
        }

        if (!parsedCsvTrades.length) {
          wrap.style.display = 'none';
          msg.style.color = '#dc2626';
          msg.textContent = '⚠️ CSV থেকে মিলে যাওয়া কোনো ট্রেড পাওয়া যায়নি। নিশ্চিত করুন ফাইলে Symbol, Type (BUY/SELL), Quantity, Price কলাম আছে এবং অ্যাসেটটি তালিকায় যোগ করা আছে।';
          return;
        }
        msg.textContent = '';
        wrap.style.display = 'block';
        document.getElementById('csvPreviewCount').textContent = '✅ ' + parsedCsvTrades.length + 'টি ট্রেড শনাক্ত হয়েছে (প্রিভিউ):';
        document.getElementById('csvPreviewBody').innerHTML = parsedCsvTrades.slice(0, 25).map(t =>
          '<tr><td>' + escapeHtml(t.broker) + '</td><td><span class="tag ' + (t.action === 'BUY' ? 'tag-buy' : 'tag-sell') + '">' + t.action + '</span></td><td><b>' + escapeHtml(ASSETS[t.asset_id].name) + '</b></td><td>' + (t.qty ? Number(t.qty).toFixed(4) : 'অটো') + '</td><td><b>' + fmt(t.amount_inr) + '</b></td></tr>'
        ).join('');
      } catch (e) {
        wrap.style.display = 'none';
        msg.style.color = '#dc2626';
        msg.textContent = '❌ CSV পড়তে সমস্যা: ' + e.message;
      }
    };
    reader.readAsText(file);
  }

  async function submitBulkCsvImport() {
    if (!parsedCsvTrades.length) return;
    const btn = document.getElementById('csvImportBtn');
    const msg = document.getElementById('csvMsg');
    btn.disabled = true;
    btn.textContent = '⏳ বাল্ক ইমপোর্ট হচ্ছে...';
    msg.textContent = '';
    try {
      const res = await callAutopilotApi({ mode: 'bulk_csv_sync', trades: parsedCsvTrades }, 25000);
      msg.style.color = '#15803d';
      msg.textContent = '✅ সফলভাবে ' + (res.imported_count || parsedCsvTrades.length) + 'টি ট্রেড পোর্টফোলিও ও পাসবুকে সিঙ্ক হয়েছে!';
      parsedCsvTrades = [];
      document.getElementById('csvPreviewWrap').style.display = 'none';
      document.getElementById('csvFileInput').value = '';
      await refreshAll(true);
    } catch (e) {
      msg.style.color = '#dc2626';
      msg.textContent = '❌ ইমপোর্ট এরর: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📥 সব ট্রেড SafeYield-এ ইমপোর্ট করুন';
    }
  }

  // ===== v6.0 BINANCE READ-ONLY API SYNC =====
  function updateBinanceRoUI() {
    const stEl = document.getElementById('binanceRoStatus');
    if (!stEl) return;
    const ro = stateData && stateData.profile && stateData.profile.binance_ro;
    if (ro && ro.configured) {
      stEl.style.color = '#15803d';
      stEl.textContent = '✅ Binance Read-Only API সংযুক্ত (Key: ' + (ro.key_hint || '****') + ')';
    } else {
      stEl.style.color = 'var(--muted)';
      stEl.textContent = 'স্ট্যাটাস: কনফিগার করা নেই';
    }
  }

  async function saveBinanceReadOnly() {
    const api_key = (document.getElementById('binApiKey').value || '').trim();
    const api_secret = (document.getElementById('binApiSecret').value || '').trim();
    const msg = document.getElementById('binSyncMsg');
    if (api_key.length < 16 || api_secret.length < 16) {
      msg.style.color = '#dc2626';
      msg.textContent = '⚠️ সঠিক Binance Read-Only API Key ও Secret Key দিন।';
      return;
    }
    const btn = document.getElementById('binSaveBtn');
    btn.disabled = true;
    msg.textContent = '';
    try {
      const res = await callAutopilotApi({ mode: 'save_binance_ro', api_key, api_secret }, 18000);
      if (!stateData.profile || typeof stateData.profile !== 'object') stateData.profile = {};
      stateData.profile.binance_ro = res.binance_ro || { configured: true };
      document.getElementById('binApiKey').value = '';
      document.getElementById('binApiSecret').value = '';
      updateBinanceRoUI();
      msg.style.color = '#15803d';
      msg.textContent = '✅ Binance Read-Only API Key সুরক্ষিতভাবে সেভ হয়েছে। এখন সিঙ্ক বাটনে চাপুন।';
    } catch (e) {
      msg.style.color = '#dc2626';
      msg.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function syncBinanceReadOnlyNow() {
    const btn = document.getElementById('binSyncBtn');
    const msg = document.getElementById('binSyncMsg');
    btn.disabled = true;
    btn.textContent = '⏳ Binance থেকে লাইভ ব্যালেন্স আনা হচ্ছে...';
    msg.textContent = '';
    try {
      const res = await callAutopilotApi({ mode: 'sync_binance_ro' }, 22000);
      msg.style.color = '#15803d';
      msg.textContent = '✅ ' + (res.message_bn || 'Binance স্পট ব্যালেন্স সিঙ্ক সম্পন্ন!');
      await refreshAll(true);
    } catch (e) {
      msg.style.color = '#dc2626';
      msg.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Binance স্পট ব্যালেন্স অটো-সিঙ্ক করুন';
    }
  }

  // ===== v6.0 TELEGRAM DIP & PROFIT-LOCK ALERTS =====
  function openAlertsModal() {
    const tg = (stateData && stateData.profile && stateData.profile.telegram) || {};
    document.getElementById('tgBotToken').value = '';
    document.getElementById('tgBotToken').placeholder = tg.configured ? 'সংরক্ষিত আছে (বদলাতে চাইলে নতুন টোকেন দিন)' : 'যেমন: 7123456:AAH...';
    document.getElementById('tgChatId').value = tg.chat_id || '';
    document.getElementById('tgRsiBelow').value = String(tg.rsi_below ?? 40);
    document.getElementById('tgDipPct').value = String(tg.dip_pct ?? 3);
    document.getElementById('tgProfitPct').value = String(tg.profit_pct ?? 10);
    document.getElementById('tgEnabled').checked = tg.enabled !== false;
    setAuthMsg('tgMsg', tg.configured ? '✅ Telegram অ্যালার্ট কনফিগার করা আছে।' : '', false);
    document.getElementById('alertsModal').classList.add('open');
  }

  function closeAlertsModal() {
    document.getElementById('alertsModal').classList.remove('open');
  }

  async function saveTelegramAlerts() {
    const bot_token = (document.getElementById('tgBotToken').value || '').trim();
    const chat_id = (document.getElementById('tgChatId').value || '').trim();
    const rsi_below = Number(document.getElementById('tgRsiBelow').value || 40);
    const dip_pct = Number(document.getElementById('tgDipPct').value || 3);
    const profit_pct = Number(document.getElementById('tgProfitPct').value || 10);
    const enabled = document.getElementById('tgEnabled').checked;
    if (!chat_id) { setAuthMsg('tgMsg', '⚠️ Telegram Chat ID দিন।', true); return; }

    const btn = document.getElementById('tgSaveBtn');
    btn.disabled = true;
    try {
      const res = await callAutopilotApi({
        mode: 'save_alert_config',
        bot_token: bot_token || undefined,
        chat_id, rsi_below, dip_pct, profit_pct, enabled
      }, 16000);
      if (!stateData.profile || typeof stateData.profile !== 'object') stateData.profile = {};
      stateData.profile.telegram = res.telegram || { configured: true, chat_id, rsi_below, dip_pct, profit_pct, enabled };
      document.getElementById('tgBotToken').value = '';
      setAuthMsg('tgMsg', '✅ Telegram অ্যালার্ট সেটিংস সেভ হয়েছে!', false);
    } catch (e) {
      setAuthMsg('tgMsg', '❌ ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function testTelegramAlert() {
    const btn = document.getElementById('tgTestBtn');
    btn.disabled = true;
    setAuthMsg('tgMsg', '⏳ টেস্ট মেসেজ পাঠানো হচ্ছে...', false);
    try {
      await callAutopilotApi({ mode: 'test_telegram_alert' }, 16000);
      setAuthMsg('tgMsg', '✅ আপনার Telegram-এ টেস্ট নোটিফিকেশন পাঠানো হয়েছে—চেক করুন!', false);
    } catch (e) {
      setAuthMsg('tgMsg', '❌ ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function checkTelegramAlertsNow() {
    const btn = document.getElementById('tgCheckNowBtn');
    btn.disabled = true;
    setAuthMsg('tgMsg', '⏳ লাইভ মার্কেট ও পোর্টফোলিও চেক হচ্ছে...', false);
    try {
      const res = await callAutopilotApi({ mode: 'check_alerts_now' }, 22000);
      setAuthMsg('tgMsg', '✅ ' + (res.message_bn || 'অ্যালার্ট চেক সম্পন্ন!'), false);
    } catch (e) {
      setAuthMsg('tgMsg', '❌ ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    applyDarkMode();
    syncAssetsFromState();
    renderChatMessages();
    calculateGoalSip();
    startAutoLiveTimer();
    updateLockUI();
    updateAuthServerStatus();
    startAuthBgAnimation();
    restoreSessionOnBoot();
    const gCur = document.getElementById('goalCurrent');
    if (gCur) gCur.addEventListener('input', () => { gCur.dataset.userEdited = '1'; });
  });