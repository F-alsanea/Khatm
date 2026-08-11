// dashboard.js - Complete Logic with Hybrid Backend Support (API + LocalStorage fallback)

let API_BASE = ''; // Auto detected relative to root
let useFallback = false;

// Default initial state for local storage fallback
const DEFAULT_STATE = {
  merchant: {
    brandName: "محمصة السنبلة",
    programName: "بطاقة قهوة السنبلة",
    logoUrl: "https://example.com/logo.png",
    hexBackgroundColor: "#1E3050",
    stampsGoal: 10,
    stampEmoji: "☕",
    rewardName: "القهوة العاشرة مجاناً",
    cooldownMinutes: 1
  },
  customers: [
    {
      id: "cust_001",
      name: "عبدالله محمد",
      phone: "0501234567",
      stampsCollected: 3,
      stampsGoal: 10,
      lastStampedTime: null,
      rewardsClaimed: 0
    }
  ],
  logs: [
    {
      id: "log_001",
      customerId: "cust_001",
      customerName: "عبدالله محمد",
      type: "stamp",
      timestamp: new Date().toISOString(),
      details: "تم إضافة ختم. المجموع الحالي: 3"
    }
  ],
  pushes: [
    {
      id: "push_001",
      title: "عرض خاص من محمصة السنبلة ☕",
      body: "احصل على ضعف الأختام اليوم عند طلب أي نوع من القهوة المختصة!",
      timestamp: new Date().toISOString()
    }
  ]
};

// Detect fallback
async function detectMode() {
  try {
    const res = await fetch('/api/merchant');
    if (res.ok) {
      console.log("Connected to dynamic JSON DB Express server.");
      useFallback = false;
    } else {
      throw new Error("API responded with error");
    }
  } catch (err) {
    console.warn("Express server not detected. Falling back to static browser LocalStorage db for offline demo.");
    useFallback = true;
    if (!localStorage.getItem('khatm_db')) {
      localStorage.setItem('khatm_db', JSON.stringify(DEFAULT_STATE));
    }
  }
}

// Get fallback DB helper
function getLocalDB() {
  return JSON.parse(localStorage.getItem('khatm_db')) || DEFAULT_STATE;
}

// Save fallback DB helper
function saveLocalDB(data) {
  localStorage.setItem('khatm_db', JSON.stringify(data));
}

// Switch Sections in dashboard
function switchSection(sectionId) {
  document.querySelectorAll('.dash-section').forEach(sec => sec.style.display = 'none');
  document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));

  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) targetSection.style.display = 'block';

  // Find button and make active
  const btns = Array.from(document.querySelectorAll('.sidebar-btn'));
  const targetBtn = btns.find(btn => btn.innerText.includes(
    sectionId === 'customizer' ? 'تصميم' :
    sectionId === 'customers' ? 'المشتركين' :
    sectionId === 'push' ? 'الإشعارات' : 'سجلات'
  ));
  if (targetBtn) targetBtn.classList.add('active');

  if (sectionId === 'logs') {
    loadLogsAndStats();
  } else if (sectionId === 'customers') {
    loadCustomers();
  }
}

// 1. Live Customizer Setup & Refresh Mockup
function updateLivePreview(merchant) {
  document.getElementById('preview-brand').innerText = merchant.brandName;
  document.getElementById('preview-program').innerText = merchant.programName;
  document.getElementById('preview-reward').innerText = merchant.rewardName;

  const colorPicker = document.getElementById('hexBackgroundColor');
  const previewCard = document.getElementById('live-card-preview');
  previewCard.style.backgroundColor = merchant.hexBackgroundColor || colorPicker.value;

  const goal = parseInt(merchant.stampsGoal) || 10;
  const emoji = merchant.stampEmoji || '☕';

  // Simulate active stamps for visualization
  const activeCount = Math.floor(goal * 0.7); // 70% filled
  document.getElementById('preview-sub').innerText = `${activeCount} من ${goal} أختام`;

  const stampRow = document.getElementById('preview-stamp-row');
  stampRow.innerHTML = '';
  for (let i = 1; i <= goal; i++) {
    const dot = document.createElement('div');
    dot.className = 'stamp-dot' + (i <= activeCount ? ' filled' : '');
    dot.innerText = i <= activeCount ? emoji : '·';
    stampRow.appendChild(dot);
  }
}

// Load merchant settings
async function loadMerchantSettings() {
  let merchant;
  if (!useFallback) {
    try {
      const res = await fetch('/api/merchant');
      merchant = await res.json();
    } catch (e) {
      merchant = getLocalDB().merchant;
    }
  } else {
    merchant = getLocalDB().merchant;
  }

  // Populate form
  document.getElementById('brandName').value = merchant.brandName || '';
  document.getElementById('programName').value = merchant.programName || '';
  document.getElementById('logoUrl').value = merchant.logoUrl || '';
  document.getElementById('hexBackgroundColor').value = merchant.hexBackgroundColor || '#1E3050';
  document.getElementById('stampsGoal').value = merchant.stampsGoal || '10';
  document.getElementById('stampEmoji').value = merchant.stampEmoji || '☕';
  document.getElementById('cooldownMinutes').value = merchant.cooldownMinutes || '1';
  document.getElementById('rewardName').value = merchant.rewardName || '';

  updateLivePreview(merchant);
}

// Save merchant settings
async function saveMerchantSettings(e) {
  e.preventDefault();
  const merchant = {
    brandName: document.getElementById('brandName').value,
    programName: document.getElementById('programName').value,
    logoUrl: document.getElementById('logoUrl').value,
    hexBackgroundColor: document.getElementById('hexBackgroundColor').value,
    stampsGoal: parseInt(document.getElementById('stampsGoal').value),
    stampEmoji: document.getElementById('stampEmoji').value,
    cooldownMinutes: parseInt(document.getElementById('cooldownMinutes').value),
    rewardName: document.getElementById('rewardName').value,
  };

  if (!useFallback) {
    try {
      await fetch('/api/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merchant)
      });
    } catch (err) {
      console.error(err);
    }
  } else {
    const db = getLocalDB();
    db.merchant = merchant;
    // update all existing customers stamp goal as well
    db.customers.forEach(c => c.stampsGoal = merchant.stampsGoal);
    saveLocalDB(db);
  }

  updateLivePreview(merchant);
  alert('✅ تم حفظ إعدادات قالب بطاقة الولاء وتحديثها بنجاح!');
}

// 2. Customers Enrollment
async function loadCustomers() {
  let customers = [];
  if (!useFallback) {
    try {
      const res = await fetch('/api/customers');
      customers = await res.json();
    } catch (e) {
      customers = getLocalDB().customers;
    }
  } else {
    customers = getLocalDB().customers;
  }

  const tbody = document.getElementById('customers-table-body');
  tbody.innerHTML = '';

  customers.forEach(c => {
    const tr = document.createElement('tr');

    // Pass links
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
        headers: { 'Content-Type': 'application/json' },
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
      console.error(err);
    }
  } else {
    const db = getLocalDB();
    const customerId = `cust_${Date.now()}`;
    const newCustomer = {
      id: customerId,
      name,
      phone,
      stampsCollected: 0,
      stampsGoal: db.merchant.stampsGoal || 10,
      lastStampedTime: null,
      rewardsClaimed: 0
    };
    db.customers.push(newCustomer);

    db.logs.unshift({
      id: `log_${Date.now()}`,
      customerId,
      customerName: name,
      type: 'enroll',
      timestamp: new Date().toISOString(),
      details: 'تم تسجيل عميل جديد في البرنامج.'
    });

    saveLocalDB(db);
    document.getElementById('customer-form').reset();
    loadCustomers();
    alert('✅ تم تسجيل العميل الجديد وتوليد بطاقته بنجاح!');
  }
}

// 3. Push notifications Simulator
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

  // Initial slide in
  setTimeout(updatePreview, 1000);
}

async function sendPushNotification(e) {
  e.preventDefault();
  const title = document.getElementById('pushTitle').value;
  const body = document.getElementById('pushBody').value;

  if (!useFallback) {
    try {
      const res = await fetch('/api/pushes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (res.ok) {
        alert('🚀 تم بث إشعار الدفع الفوري لجميع الهواتف بنجاح!');
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    const db = getLocalDB();
    const newPush = {
      id: `push_${Date.now()}`,
      title,
      body,
      timestamp: new Date().toISOString()
    };
    db.pushes.unshift(newPush);
    db.logs.unshift({
      id: `log_${Date.now()}`,
      customerId: 'all',
      customerName: 'جميع المشتركين',
      type: 'push',
      timestamp: new Date().toISOString(),
      details: `تم إرسال إشعار دفع: ${title}`
    });
    saveLocalDB(db);
    alert('🚀 تم بث إشعار الدفع الفوري لجميع الهواتف بنجاح!');
  }
}

// 4. Logs and Analytics Panel
async function loadLogsAndStats() {
  let logs = [];
  let customers = [];
  let pushes = [];

  if (!useFallback) {
    try {
      const resLogs = await fetch('/api/logs');
      logs = await resLogs.json();
      const resCusts = await fetch('/api/customers');
      customers = await resCusts.json();
      const resPushes = await fetch('/api/pushes');
      pushes = await resPushes.json();
    } catch (e) {
      const db = getLocalDB();
      logs = db.logs;
      customers = db.customers;
      pushes = db.pushes;
    }
  } else {
    const db = getLocalDB();
    logs = db.logs;
    customers = db.customers;
    pushes = db.pushes;
  }

  // Calculate statistics
  const totalCustomers = customers.length;
  let totalStamps = 0;
  let totalRewards = 0;
  customers.forEach(c => {
    totalStamps += c.stampsCollected;
    totalRewards += (c.rewardsClaimed || 0);
  });
  const totalPushNotifications = pushes.length;

  document.getElementById('stat-total-customers').innerText = totalCustomers;
  document.getElementById('stat-total-stamps').innerText = totalStamps;
  document.getElementById('stat-total-rewards').innerText = totalRewards;
  document.getElementById('stat-total-pushes').innerText = totalPushNotifications;

  // Render logs table
  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = '';

  logs.forEach(l => {
    const tr = document.createElement('tr');
    const timeStr = new Date(l.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(l.timestamp).toLocaleDateString('ar-SA');

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

// Initialization on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  await detectMode();
  await loadMerchantSettings();
  setupPushFormRealtimePreview();

  // Real-time customizer inputs update preview instantly
  const inputs = ['brandName', 'programName', 'rewardName', 'hexBackgroundColor', 'stampsGoal', 'stampEmoji'];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const tempMerchant = {
        brandName: document.getElementById('brandName').value,
        programName: document.getElementById('programName').value,
        rewardName: document.getElementById('rewardName').value,
        hexBackgroundColor: document.getElementById('hexBackgroundColor').value,
        stampsGoal: parseInt(document.getElementById('stampsGoal').value),
        stampEmoji: document.getElementById('stampEmoji').value,
      };
      updateLivePreview(tempMerchant);
    });
  });
});
