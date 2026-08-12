// dashboard.js - Multi-Tenant Authentication and Dynamic Board Management

let useFallback = false;
let currentToken = localStorage.getItem('khatm_token') || '';
let currentUser = null; // { name, email, businessName, permissions }

// Default isolated initial state for LocalStorage fallback DB
const DEFAULT_STATE = {
  merchants: [
    {
      id: "merchant_default",
      businessName: "محمصة السنبلة",
      ownerName: "عبدالله محمد",
      email: "owner@sonbola.com",
      phone: "0501234567"
    }
  ],
  merchant_staff: [
    {
      id: "staff_default",
      merchantId: "merchant_default",
      name: "عبدالله محمد",
      email: "owner@sonbola.com",
      isOwner: true,
      canStamp: true,
      canEnrollCustomer: true,
      canViewReports: true,
      canManageSettings: true
    }
  ],
  branches: [
    {
      id: "branch_default",
      merchantId: "merchant_default",
      name: "الفرع الرئيسي",
      address: "الرياض، المملكة العربية السعودية",
      qr_code_value: "qr_merchant_default_main"
    }
  ],
  loyalty_cards: [
    {
      id: "card_default",
      merchantId: "merchant_default",
      brandName: "محمصة السنبلة",
      programName: "بطاقة قهوة السنبلة",
      logoUrl: "https://example.com/logo.png",
      hexBackgroundColor: "#1E3050",
      stampsGoal: 10,
      stampEmoji: "☕",
      rewardName: "القهوة العاشرة مجاناً",
      cooldownMinutes: 1
    }
  ],
  customers: [
    {
      id: "cust_001",
      merchantId: "merchant_default",
      name: "عبدالله محمد",
      phone: "0501234567",
      stampsCollected: 3,
      stampsGoal: 10,
      lastStampedTime: null,
      rewardsClaimed: 0
    }
  ],
  stamps_log: [
    {
      id: "log_001",
      merchantId: "merchant_default",
      customerId: "cust_001",
      customerName: "عبدالله محمد",
      type: "stamp",
      timestamp: new Date().toISOString(),
      details: "تم إضافة ختم. المجموع الحالي: 3"
    }
  ],
  notifications_log: [
    {
      id: "push_001",
      merchantId: "merchant_default",
      title: "عرض خاص من محمصة السنبلة ☕",
      body: "احصل على ضعف الأختام اليوم عند طلب أي نوع من القهوة المختصة!",
      timestamp: new Date().toISOString()
    }
  ]
};

// Mode & session detection
async function detectModeAndSession() {
  try {
    const res = await fetch('/api/public/cards/cust_001'); // Check if standard backend works
    if (res.ok) {
      useFallback = false;
    } else {
      throw new Error();
    }
  } catch (err) {
    useFallback = true;
    if (!localStorage.getItem('khatm_db_v2')) {
      localStorage.setItem('khatm_db_v2', JSON.stringify(DEFAULT_STATE));
    }
  }

  // Parse query string plan parameter if any
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan') || 'free';

  if (currentToken) {
    if (!useFallback) {
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) {
          currentUser = await res.json();
          document.getElementById('auth-overlay').style.display = 'none';
          showAppAndSetup();
        } else {
          handleLogout();
        }
      } catch (e) {
        handleLogout();
      }
    } else {
      // Offline fallback token verification mock
      const mockSession = JSON.parse(localStorage.getItem('khatm_session_v2'));
      if (mockSession) {
        currentUser = mockSession;
        document.getElementById('auth-overlay').style.display = 'none';
        showAppAndSetup();
      } else {
        handleLogout();
      }
    }
  } else {
    document.getElementById('auth-overlay').style.display = 'flex';
    if (planParam) {
      let pInput = document.getElementById('reg-plan-id');
      if (!pInput) {
        pInput = document.createElement('input');
        pInput.type = 'hidden';
        pInput.id = 'reg-plan-id';
        pInput.value = planParam;
        document.getElementById('register-form').appendChild(pInput);
      } else {
        pInput.value = planParam;
      }
    }
  }
}

// Get fallback DB helper
function getLocalDB() {
  return JSON.parse(localStorage.getItem('khatm_db_v2')) || DEFAULT_STATE;
}

// Save fallback DB helper
function saveLocalDB(data) {
  localStorage.setItem('khatm_db_v2', JSON.stringify(data));
}

// Auth Tabs switches
function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.remove('active');
  document.getElementById('tab-register').classList.remove('active');
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'none';

  if (tab === 'login') {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('login-form').style.display = 'block';
  } else {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('register-form').style.display = 'block';
  }
}

// Register
async function handleRegister(e) {
  e.preventDefault();
  const businessName = document.getElementById('reg-bizname').value;
  const ownerName = document.getElementById('reg-ownername').value;
  const phone = document.getElementById('reg-phone').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const planId = document.getElementById('reg-plan-id') ? document.getElementById('reg-plan-id').value : 'free';

  if (!useFallback) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, ownerName, email, phone, password, planId })
      });
      const data = await res.json();
      if (res.ok) {
        currentToken = data.token;
        localStorage.setItem('khatm_token', currentToken);
        alert('🎉 تم إنشاء حساب التاجر بنجاح وتوليد الهوية والفرع الرئيسي!');
        await detectModeAndSession();
      } else {
        alert(`خطأ: ${data.error}`);
      }
    } catch (err) {
      alert('فشل في الاتصال بالسيرفر لإتمام عملية التسجيل.');
    }
  } else {
    // LocalStorage Register
    const db = getLocalDB();
    const existing = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      alert('خطأ: هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
      return;
    }

    const merchantId = `merchant_${Date.now()}`;
    const staffId = `staff_${Date.now()}`;
    const cardId = `card_${Date.now()}`;
    const branchId = `branch_${Date.now()}`;

    db.merchants.push({
      id: merchantId,
      businessName,
      ownerName,
      email,
      phone,
      planId
    });

    if (!db.branches) db.branches = [];
    db.branches.push({
      id: branchId,
      merchantId,
      name: 'الفرع الرئيسي',
      address: 'الرياض، المملكة العربية السعودية',
      qr_code_value: `qr_${merchantId}_main`
    });

    const permissions = {
      isOwner: true,
      canStamp: true,
      canEnrollCustomer: true,
      canViewReports: true,
      canManageSettings: true
    };

    db.merchant_staff.push({
      id: staffId,
      merchantId,
      branchId,
      name: ownerName,
      email: email.toLowerCase(),
      ...permissions
    });

    db.loyalty_cards.push({
      id: cardId,
      merchantId,
      brandName: businessName,
      programName: `بطاقة ولاء ${businessName}`,
      logoUrl: 'https://example.com/logo.png',
      hexBackgroundColor: '#1E3050',
      stampsGoal: 10,
      stampEmoji: '☕',
      rewardName: 'القهوة العاشرة مجاناً',
      cooldownMinutes: 1
    });

    saveLocalDB(db);

    currentUser = {
      id: staffId,
      merchantId,
      name: ownerName,
      email,
      businessName,
      permissions,
      planId
    };

    localStorage.setItem('khatm_session_v2', JSON.stringify(currentUser));
    localStorage.setItem('khatm_token', `offline_token_${staffId}`);
    currentToken = `offline_token_${staffId}`;

    document.getElementById('auth-overlay').style.display = 'none';
    showAppAndSetup();
    alert('🎉 تم إنشاء حساب التاجر بنجاح (وضع ديمو غير متصل)!');
  }
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!useFallback) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        currentToken = data.token;
        localStorage.setItem('khatm_token', currentToken);
        await detectModeAndSession();
      } else {
        alert(`خطأ: ${data.error}`);
      }
    } catch (err) {
      alert('فشل تسجيل الدخول. يرجى التحقق من اتصالك بالإنترنت.');
    }
  } else {
    // Offline local storage login
    const db = getLocalDB();
    const staff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!staff) {
      alert('خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    const merchant = db.merchants.find(m => m.id === staff.merchantId);
    currentUser = {
      id: staff.id,
      merchantId: staff.merchantId,
      name: staff.name,
      email: staff.email,
      businessName: merchant ? merchant.businessName : 'متجر افتراضي',
      permissions: {
        isOwner: staff.isOwner || false,
        canStamp: staff.canStamp || false,
        canEnrollCustomer: staff.canEnrollCustomer || false,
        canViewReports: staff.canViewReports || false,
        canManageSettings: staff.canManageSettings || false
      }
    };

    localStorage.setItem('khatm_session_v2', JSON.stringify(currentUser));
    localStorage.setItem('khatm_token', `offline_token_${staff.id}`);
    currentToken = `offline_token_${staff.id}`;

    document.getElementById('auth-overlay').style.display = 'none';
    showAppAndSetup();
    alert('🔐 تم الدخول بنجاح للوحة التحكم ديمو!');
  }
}

// Logout
function handleLogout() {
  localStorage.removeItem('khatm_token');
  localStorage.removeItem('khatm_session_v2');
  currentToken = '';
  currentUser = null;
  document.getElementById('auth-overlay').style.display = 'flex';
}

// Set permissions visibility in navigation
function showAppAndSetup() {
  document.getElementById('user-display-name').innerText = `👤 ${currentUser.name} (${currentUser.businessName})`;

  const p = currentUser.permissions;
  // Manage settings permission
  if (!p.canManageSettings) {
    document.getElementById('btn-customizer').style.display = 'none';
    document.getElementById('btn-branches').style.display = 'none';
    document.getElementById('btn-push').style.display = 'none';
    switchSection('customers');
  } else {
    document.getElementById('btn-customizer').style.display = 'flex';
    document.getElementById('btn-branches').style.display = 'flex';
    document.getElementById('btn-push').style.display = 'flex';
    switchSection('customizer');
  }

  // Enrollment permission
  if (!p.canEnrollCustomer) {
    document.getElementById('btn-customers').style.display = 'none';
  } else {
    document.getElementById('btn-customers').style.display = 'flex';
  }

  // Owner only sidebar view
  if (!p.isOwner) {
    document.getElementById('btn-staff').style.display = 'none';
  } else {
    document.getElementById('btn-staff').style.display = 'flex';
  }

  // Reports
  if (!p.canViewReports) {
    document.getElementById('btn-logs').style.display = 'none';
  } else {
    document.getElementById('btn-logs').style.display = 'flex';
  }

  loadMerchantSettings();
}

// Switch dashboard sections
function switchSection(sectionId) {
  document.querySelectorAll('.dash-section').forEach(sec => sec.style.display = 'none');
  document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));

  const sectionEl = document.getElementById(`section-${sectionId}`);
  if (sectionEl) sectionEl.style.display = 'block';

  const btnEl = document.getElementById(`btn-${sectionId}`);
  if (btnEl) btnEl.classList.add('active');

  if (sectionId === 'customizer') {
    loadMerchantSettings();
  } else if (sectionId === 'branches') {
    loadBranches();
  } else if (sectionId === 'customers') {
    loadCustomers();
  } else if (sectionId === 'staff') {
    loadStaff();
  } else if (sectionId === 'logs') {
    loadLogsAndStats();
  }
}

// ----------------------------------------
// 1.5) Branches Management Logic
// ----------------------------------------
async function loadBranches() {
  let list = [];
  if (!useFallback) {
    try {
      const res = await fetch('/api/branches', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) list = await res.json();
    } catch (e) {}
  } else {
    const db = getLocalDB();
    list = db.branches ? db.branches.filter(b => b.merchantId === currentUser.merchantId) : [];
  }

  const tbody = document.getElementById('branches-table-body');
  tbody.innerHTML = '';

  list.forEach(b => {
    const tr = document.createElement('tr');
    const joinUrl = `${window.location.origin}/join.html?branch=${b.qr_code_value}`;
    tr.innerHTML = `
      <td style="font-weight:700;">${b.name}</td>
      <td>${b.address || '—'}</td>
      <td class="mono" style="color: var(--stamp); font-weight:700;">${b.qr_code_value}</td>
      <td>
        <a href="${joinUrl}" target="_blank" class="btn btn-ghost" style="padding:4px 10px; font-size:0.8rem; border:1px solid var(--ink);">فتح صفحة التسجيل الذاتي للعميل 🔗</a>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Populate branch selections in staff form dynamically
  const select = document.getElementById('staffBranchSelect');
  if (select) {
    select.innerHTML = '<option value="">كل الفروع (عام)</option>';
    list.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.innerText = b.name;
      select.appendChild(opt);
    });
  }
}

async function addBranch(e) {
  e.preventDefault();
  const name = document.getElementById('branchNameInput').value;
  const address = document.getElementById('branchAddressInput').value;

  if (!useFallback) {
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ name, address })
      });
      if (res.ok) {
        document.getElementById('branch-form').reset();
        loadBranches();
        alert('✅ تم إضافة الفرع الجديد بنجاح!');
      } else {
        const err = await res.json();
        alert(`خطأ: ${err.error}`);
      }
    } catch (e) {
      alert('خطأ اتصال بالإنترنت.');
    }
  } else {
    const db = getLocalDB();
    if (!db.branches) db.branches = [];

    // Check branch quota
    const maxBranches = currentUser.planId === 'free' ? 1 : (currentUser.planId === 'growth' ? 3 : -1);
    const currentCount = db.branches.filter(b => b.merchantId === currentUser.merchantId).length;
    if (maxBranches !== -1 && currentCount >= maxBranches) {
      alert(`خطأ: لقد تجاوزت الحد الأقصى للفروع في خطتك الحالية (${maxBranches} فرع). يرجى الترقية.`);
      return;
    }

    const branchId = `branch_${Date.now()}`;
    db.branches.push({
      id: branchId,
      merchantId: currentUser.merchantId,
      name,
      address,
      qr_code_value: `qr_${currentUser.merchantId}_${Date.now()}`
    });

    saveLocalDB(db);
    document.getElementById('branch-form').reset();
    loadBranches();
    alert('✅ تم إضافة الفرع الجديد ديمو بنجاح!');
  }
}

// ----------------------------------------
// 1) Template Design Logic
// ----------------------------------------
function updateLivePreview(card) {
  document.getElementById('preview-brand').innerText = card.brandName;
  document.getElementById('preview-program').innerText = card.programName;
  document.getElementById('preview-reward').innerText = card.rewardName;
  document.getElementById('preview-card-merchant-id').innerText = `#${currentUser.merchantId.substring(0, 8)}`;

  const previewCard = document.getElementById('live-card-preview');
  previewCard.style.backgroundColor = card.hexBackgroundColor;

  const goal = parseInt(card.stampsGoal) || 10;
  const emoji = card.stampEmoji || '☕';

  const filledCount = Math.floor(goal * 0.7);
  document.getElementById('preview-sub').innerText = `${filledCount} من ${goal} أختام`;

  const stampRow = document.getElementById('preview-stamp-row');
  stampRow.innerHTML = '';
  for (let i = 1; i <= goal; i++) {
    const dot = document.createElement('div');
    dot.className = 'stamp-dot' + (i <= filledCount ? ' filled' : '');
    dot.innerText = i <= filledCount ? emoji : '·';
    stampRow.appendChild(dot);
  }
}

async function loadMerchantSettings() {
  let card;
  if (!useFallback) {
    try {
      const res = await fetch('/api/loyalty-cards', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        card = await res.json();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!card) {
    const db = getLocalDB();
    card = db.loyalty_cards.find(c => c.merchantId === currentUser.merchantId);
    if (!card) {
      card = DEFAULT_STATE.loyalty_cards[0];
    }
  }

  document.getElementById('brandName').value = card.brandName;
  document.getElementById('programName').value = card.programName;
  document.getElementById('logoUrl').value = card.logoUrl;
  document.getElementById('hexBackgroundColor').value = card.hexBackgroundColor;
  document.getElementById('stampsGoal').value = card.stampsGoal;
  document.getElementById('stampEmoji').value = card.stampEmoji;
  document.getElementById('cooldownMinutes').value = card.cooldownMinutes;
  document.getElementById('rewardName').value = card.rewardName;

  updateLivePreview(card);
}

async function saveMerchantSettings(e) {
  e.preventDefault();
  const cardData = {
    brandName: document.getElementById('brandName').value,
    programName: document.getElementById('programName').value,
    logoUrl: document.getElementById('logoUrl').value,
    hexBackgroundColor: document.getElementById('hexBackgroundColor').value,
    stampsGoal: parseInt(document.getElementById('stampsGoal').value),
    stampEmoji: document.getElementById('stampEmoji').value,
    cooldownMinutes: parseInt(document.getElementById('cooldownMinutes').value),
    rewardName: document.getElementById('rewardName').value
  };

  if (!useFallback) {
    try {
      const res = await fetch('/api/loyalty-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify(cardData)
      });
      if (res.ok) {
        alert('✅ تم تصميم وحفظ بطاقة الولاء بنجاح!');
        loadMerchantSettings();
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم لحفظ الإعدادات.');
    }
  } else {
    const db = getLocalDB();
    let card = db.loyalty_cards.find(c => c.merchantId === currentUser.merchantId);
    if (!card) {
      card = { id: `card_${Date.now()}`, merchantId: currentUser.merchantId };
      db.loyalty_cards.push(card);
    }
    Object.assign(card, cardData);
    saveLocalDB(db);
    alert('✅ تم تصميم وحفظ بطاقة الولاء ديمو بنجاح!');
    updateLivePreview(card);
  }
}

// ----------------------------------------
// 2) Customer enrollment
// ----------------------------------------
async function loadCustomers() {
  let customers = [];
  if (!useFallback) {
    try {
      const res = await fetch('/api/customers', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) customers = await res.json();
    } catch (e) {}
  } else {
    const db = getLocalDB();
    customers = db.customers.filter(c => c.merchantId === currentUser.merchantId);
  }

  const tbody = document.getElementById('customers-table-body');
  tbody.innerHTML = '';

  customers.forEach(c => {
    const tr = document.createElement('tr');
    const passUrl = `${window.location.origin}/card.html?id=${c.id}`;
    const scanUrl = `${window.location.origin}/scanner.html?id=${c.id}`;

    tr.innerHTML = `
      <td style="font-weight:700;">${c.name}</td>
      <td class="mono">${c.phone}</td>
      <td style="font-weight:700;"><span style="color:var(--stamp);">${c.stampsCollected}</span> / ${c.stampsGoal}</td>
      <td class="mono">${c.rewardsClaimed || 0}</td>
      <td>
        <a href="${passUrl}" target="_blank" class="btn btn-ghost" style="padding:4px 8px; font-size:0.8rem; border:1px solid var(--ink);">عرض البطاقة 📱</a>
      </td>
      <td>
        <a href="${scanUrl}" target="_blank" class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem;">رابط الختم ➕</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function enrollCustomer(e) {
  e.preventDefault();
  const name = document.getElementById('custName').value;
  const phone = document.getElementById('custPhone').value;

  if (!useFallback) {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ name, phone })
      });
      if (res.ok) {
        document.getElementById('customer-form').reset();
        loadCustomers();
        alert('✅ تم تسجيل العميل الجديد وتوليد بطاقته بنجاح!');
      } else {
        const err = await res.json();
        alert(`خطأ: ${err.error}`);
      }
    } catch (err) {
      alert('خطأ اتصال بالإنترنت.');
    }
  } else {
    const db = getLocalDB();

    // Check client limits
    const limit = currentUser.planId === 'free' ? 100 : -1;
    const count = db.customers.filter(c => c.merchantId === currentUser.merchantId).length;
    if (limit !== -1 && count >= limit) {
      alert('خطأ: تجاوزت هذه المنشأة الحد الأقصى للمشتركين في الخطة الحالية (100 عميل). يرجى الترقية.');
      return;
    }

    const card = db.loyalty_cards.find(c => c.merchantId === currentUser.merchantId) || DEFAULT_STATE.loyalty_cards[0];

    const customerId = `cust_${Date.now()}`;
    const newCust = {
      id: customerId,
      merchantId: currentUser.merchantId,
      name,
      phone,
      stampsCollected: 0,
      stampsGoal: card.stampsGoal || 10,
      lastStampedTime: null,
      rewardsClaimed: 0
    };

    db.customers.push(newCust);
    db.stamps_log.unshift({
      id: `log_${Date.now()}`,
      merchantId: currentUser.merchantId,
      customerId,
      customerName: name,
      type: 'enroll',
      timestamp: new Date().toISOString(),
      details: 'تم تسجيل عميل جديد في البرنامج.'
    });

    saveLocalDB(db);
    document.getElementById('customer-form').reset();
    loadCustomers();
    alert('✅ تم تسجيل العميل الجديد وتوليد بطاقته ديمو بنجاح!');
  }
}

// ----------------------------------------
// 3) Staff Management (Owner only)
// ----------------------------------------
async function loadStaff() {
  let staffList = [];
  if (!useFallback) {
    try {
      const res = await fetch('/api/staff', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) staffList = await res.json();
    } catch (err) {}
  } else {
    const db = getLocalDB();
    staffList = db.merchant_staff.filter(s => s.merchantId === currentUser.merchantId);
  }

  const tbody = document.getElementById('staff-table-body');
  tbody.innerHTML = '';

  staffList.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:700;">${s.name}</td>
      <td class="mono">${s.email}</td>
      <td>${s.isOwner ? '<span class="badge-status enroll">المالك</span>' : '<span class="badge-status stamp">موظف فرع</span>'}</td>
      <td>${s.canStamp ? '✅' : '❌'}</td>
      <td>${s.canEnrollCustomer ? '✅' : '❌'}</td>
      <td>${s.canManageSettings ? '✅' : '❌'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function addStaffMember(e) {
  e.preventDefault();
  const name = document.getElementById('staffName').value;
  const email = document.getElementById('staffEmail').value;
  const password = document.getElementById('staffPassword').value;
  const branchId = document.getElementById('staffBranchSelect').value;

  const canStamp = document.getElementById('permStamp').checked;
  const canEnrollCustomer = document.getElementById('permEnroll').checked;
  const canViewReports = document.getElementById('permReports').checked;
  const canManageSettings = document.getElementById('permSettings').checked;

  const staffData = { name, email, password, branchId, canStamp, canEnrollCustomer, canViewReports, canManageSettings };

  if (!useFallback) {
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify(staffData)
      });
      if (res.ok) {
        document.getElementById('staff-form').reset();
        loadStaff();
        alert('✅ تم إضافة الموظف الجديد للفريق بنجاح!');
      } else {
        const err = await res.json();
        alert(`خطأ: ${err.error}`);
      }
    } catch (err) {
      alert('خطأ اتصال بالشبكة.');
    }
  } else {
    const db = getLocalDB();
    const existing = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      alert('خطأ: هذا البريد الإلكتروني مسجل بالفعل لموظف آخر');
      return;
    }

    // Check staff quota
    const maxStaff = currentUser.planId === 'free' ? 1 : (currentUser.planId === 'growth' ? 5 : -1);
    const count = db.merchant_staff.filter(s => s.merchantId === currentUser.merchantId && !s.isOwner).length;
    if (maxStaff !== -1 && count >= maxStaff) {
      alert(`خطأ: لقد تجاوزت الحد الأقصى للموظفين في خطتك الحالية (${maxStaff} موظفين). يرجى الترقية.`);
      return;
    }

    db.merchant_staff.push({
      id: `staff_${Date.now()}`,
      merchantId: currentUser.merchantId,
      branchId,
      name,
      email: email.toLowerCase(),
      isOwner: false,
      canStamp,
      canEnrollCustomer,
      canViewReports,
      canManageSettings
    });

    saveLocalDB(db);
    document.getElementById('staff-form').reset();
    loadStaff();
    alert('✅ تم إضافة الموظف للفريق ديمو بنجاح!');
  }
}

// ----------------------------------------
// 4) Push Simulator
// ----------------------------------------
async function sendPushNotification(e) {
  e.preventDefault();
  const title = document.getElementById('pushTitle').value;
  const body = document.getElementById('pushBody').value;

  if (!useFallback) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ title, body })
      });
      if (res.ok) {
        alert('🚀 تم بث إشعار الدفع الفوري بنجاح!');
      }
    } catch (err) {
      alert('خطأ اتصال.');
    }
  } else {
    const db = getLocalDB();
    db.notifications_log.unshift({
      id: `push_${Date.now()}`,
      merchantId: currentUser.merchantId,
      title,
      body,
      timestamp: new Date().toISOString()
    });
    db.stamps_log.unshift({
      id: `log_${Date.now()}`,
      merchantId: currentUser.merchantId,
      customerId: 'all',
      customerName: 'جميع المشتركين',
      type: 'push',
      timestamp: new Date().toISOString(),
      details: `تم إرسال إشعار دفع جماعي: ${title}`
    });
    saveLocalDB(db);
    alert('🚀 تم بث إشعار الدفع الفوري ديمو بنجاح!');
  }
}

// Lockscreen real-time simulator
function setupPushFormRealtimePreview() {
  const titleInput = document.getElementById('pushTitle');
  const bodyInput = document.getElementById('pushBody');
  const notiTitle = document.getElementById('noti-title-preview');
  const notiBody = document.getElementById('noti-body-preview');
  const notiBox = document.getElementById('lockscreen-notification');

  function updatePreview() {
    notiTitle.innerText = titleInput.value || "عنوان التنبيه";
    notiBody.innerText = bodyInput.value || "محتوى الرسالة سيظهر هنا...";
    notiBox.classList.add('show');
  }

  titleInput.addEventListener('input', updatePreview);
  bodyInput.addEventListener('input', updatePreview);

  setTimeout(updatePreview, 1000);
}

// ----------------------------------------
// 5) Logs and Analytics reports
// ----------------------------------------
async function loadLogsAndStats() {
  let stats = { totalCustomers: 0, totalStamps: 0, totalRewards: 0, totalPushes: 0 };
  let logs = [];

  if (!useFallback) {
    try {
      const resStats = await fetch('/api/reports/overview', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (resStats.ok) stats = await resStats.json();

      const resLogs = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (resLogs.ok) logs = await resLogs.json();
    } catch (e) {}
  } else {
    const db = getLocalDB();
    const customers = db.customers.filter(c => c.merchantId === currentUser.merchantId);
    const pushes = db.notifications_log.filter(p => p.merchantId === currentUser.merchantId);

    let totalStamps = 0;
    let totalRewards = 0;
    customers.forEach(c => {
      totalStamps += c.stampsCollected;
      totalRewards += c.rewardsClaimed;
    });

    stats = {
      totalCustomers: customers.length,
      totalStamps,
      totalRewards,
      totalPushes: pushes.length
    };
    logs = db.stamps_log.filter(l => l.merchantId === currentUser.merchantId);
  }

  document.getElementById('stat-total-customers').innerText = stats.totalCustomers;
  document.getElementById('stat-total-stamps').innerText = stats.totalStamps;
  document.getElementById('stat-total-rewards').innerText = stats.totalRewards;
  document.getElementById('stat-total-pushes').innerText = stats.totalPushes;

  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = '';

  logs.forEach(l => {
    const tr = document.createElement('tr');
    const timeStr = new Date(l.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(l.timestamp).toLocaleDateString('ar-SA');

    let typeClass = 'stamp';
    let typeText = 'ختم بطاقة';
    if (l.type === 'enroll') { typeClass = 'enroll'; typeText = 'تسجيل عميل'; }
    else if (l.type === 'redeem') { typeClass = 'redeem'; typeText = 'استرداد جائزة'; }
    else if (l.type === 'push') { typeClass = 'push'; typeText = 'إشعار جماعي'; }

    tr.innerHTML = `
      <td class="mono" style="font-size:0.85rem; color:var(--ink-soft);">${timeStr}</td>
      <td><span class="badge-status ${typeClass}">${typeText}</span></td>
      <td style="font-weight:700;">${l.customerName}</td>
      <td>${l.details}</td>
    `;
    tbody.appendChild(tr);
  });
}

// DOM Setup
document.addEventListener('DOMContentLoaded', async () => {
  await detectModeAndSession();
  setupPushFormRealtimePreview();

  const previewInputs = ['brandName', 'programName', 'rewardName', 'hexBackgroundColor', 'stampsGoal', 'stampEmoji'];
  previewInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const card = {
        brandName: document.getElementById('brandName').value,
        programName: document.getElementById('programName').value,
        rewardName: document.getElementById('rewardName').value,
        hexBackgroundColor: document.getElementById('hexBackgroundColor').value,
        stampsGoal: parseInt(document.getElementById('stampsGoal').value),
        stampEmoji: document.getElementById('stampEmoji').value
      };
      updateLivePreview(card);
    });
  });
});
