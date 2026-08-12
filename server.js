const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'khatm-super-secure-secret-key-1337-pass';

app.use(express.json());
app.use(express.static(__dirname));

// Serve index.html on root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper: read db
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return {
        plans: [],
        merchants: [],
        branches: [],
        merchant_staff: [],
        loyalty_cards: [],
        customers: [],
        stamps_log: [],
        notifications_log: []
      };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(data);

    // Ensure essential tables exist
    if (!db.plans) db.plans = [];
    if (!db.branches) db.branches = [];
    return db;
  } catch (err) {
    console.error('Error reading db:', err);
    return {
      plans: [],
      merchants: [],
      branches: [],
      merchant_staff: [],
      loyalty_cards: [],
      customers: [],
      stamps_log: [],
      notifications_log: []
    };
  }
}

// Helper: write db
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing db:', err);
  }
}

// ----------------------------------------
// Authentication Middleware
// ----------------------------------------
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.merchantId = payload.merchantId;
    req.staffId = payload.staffId;
    req.permissions = payload.permissions; // { isOwner, canStamp, canEnrollCustomer, canViewReports, canManageSettings }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة العمل منتهية أو غير صالحة. الرجاء تسجيل الدخول مجدداً' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.permissions || !req.permissions[permission]) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية الكافية لإتمام هذا الإجراء' });
    }
    next();
  };
}

// ----------------------------------------
// Simulated PostgreSQL Functions
// ----------------------------------------
function canAddCustomer(merchantId, db) {
  const merchant = db.merchants.find(m => m.id === merchantId);
  if (!merchant) return false;

  const planId = merchant.planId || 'free';
  const planLimits = {
    'free': { max_customers: 100 },
    'growth': { max_customers: -1 }, // -1 means unlimited
    'premium': { max_customers: -1 }
  };

  const limit = planLimits[planId] ? planLimits[planId].max_customers : 100;
  if (limit === -1) return true;

  const count = db.customers.filter(c => c.merchantId === merchantId).length;
  return count < limit;
}

function addStampSimulated(customerId, staffId, branchId, db) {
  const customer = db.customers.find(c => c.id === customerId);
  if (!customer) return { success: false, error: 'العميل غير موجود' };

  const staff = db.merchant_staff.find(s => s.id === staffId);
  if (!staff) return { success: false, error: 'الموظف غير موجود' };

  if (customer.merchantId !== staff.merchantId) {
    return { success: false, error: 'العميل لا ينتمي إلى منشأة الموظف' };
  }

  const card = db.loyalty_cards.find(c => c.merchantId === customer.merchantId);
  const stampsGoal = card ? card.stampsGoal : 10;
  const cooldownMinutes = card ? card.cooldownMinutes : 1;
  const now = new Date();

  if (customer.lastStampedTime) {
    const lastStamped = new Date(customer.lastStampedTime);
    const diffMs = now - lastStamped;
    const diffMins = diffMs / (1000 * 60);

    if (diffMins < cooldownMinutes) {
      const waitSeconds = Math.ceil((cooldownMinutes - diffMins) * 60);
      return {
        success: false,
        error: `حماية ضد الاحتيال مفعّلة: يرجى الانتظار ${waitSeconds} ثانية قبل ختم العميل مجدداً`,
        seconds_remaining: waitSeconds
      };
    }
  }

  customer.stampsCollected += 1;
  customer.lastStampedTime = now.toISOString();

  let isReward = false;
  if (customer.stampsCollected >= stampsGoal) {
    isReward = true;
  }

  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: customer.merchantId,
    customerId: customer.id,
    staffId: staff.id,
    branchId: branchId || null,
    customerName: customer.name,
    type: 'stamp',
    timestamp: now.toISOString(),
    details: `تم إضافة ختم بنجاح. المجموع الحالي: ${customer.stampsCollected} / ${stampsGoal}`
  });

  return {
    success: true,
    stamps_collected: customer.stampsCollected,
    stamps_goal: stampsGoal,
    is_reward: isReward,
    customer_name: customer.name
  };
}

// ----------------------------------------
// Auth endpoints: Register & Login
// ----------------------------------------

// SignUp with default auto provisioning
app.post('/api/auth/register', async (req, res) => {
  const db = readDB();
  const { businessName, ownerName, email, phone, password, planId } = req.body;

  if (!businessName || !ownerName || !email || !phone || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال كافة البيانات المطلوبة' });
  }

  const existingStaff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existingStaff) {
    return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
  }

  const merchantId = `merchant_${Date.now()}`;
  const branchId = `branch_${Date.now()}`;
  const staffId = `staff_${Date.now()}`;
  const cardId = `card_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Create Merchant
  const selectedPlan = planId || 'free';
  const newMerchant = {
    id: merchantId,
    businessName,
    ownerName,
    email,
    phone,
    planId: selectedPlan,
    status: 'trial',
    createdAt: new Date().toISOString()
  };
  db.merchants.push(newMerchant);

  // 2. Create Default "Main Branch"
  const newBranch = {
    id: branchId,
    merchantId,
    name: 'الفرع الرئيسي',
    address: 'الرياض، المملكة العربية السعودية',
    qr_code_value: `qr_${merchantId}_main`,
    createdAt: new Date().toISOString()
  };
  db.branches.push(newBranch);

  // 3. Create Default Owner Staff
  const permissions = {
    isOwner: true,
    canStamp: true,
    canEnrollCustomer: true,
    canViewReports: true,
    canManageSettings: true
  };
  const newStaff = {
    id: staffId,
    merchantId,
    branchId,
    name: ownerName,
    email: email.toLowerCase(),
    passwordHash,
    ...permissions,
    createdAt: new Date().toISOString()
  };
  db.merchant_staff.push(newStaff);

  // 4. Create Default Loyalty Card
  const newCard = {
    id: cardId,
    merchantId,
    brandName: businessName,
    programName: `بطاقة ولاء ${businessName}`,
    logoUrl: 'https://example.com/logo.png',
    hexBackgroundColor: '#1E3050',
    stampsGoal: 10,
    stampEmoji: '☕',
    rewardName: 'القهوة العاشرة مجاناً',
    cooldownMinutes: 1,
    createdAt: new Date().toISOString()
  };
  db.loyalty_cards.push(newCard);

  // Log onboarding
  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId,
    customerId: 'system',
    customerName: 'النظام',
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: `تم تهيئة المتجر والفرع الرئيسي وبطاقة الولاء بنجاح: ${businessName}`
  });

  writeDB(db);

  const token = jwt.sign(
    { merchantId, staffId, permissions },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ success: true, token, permissions, user: { name: ownerName, email } });
});

// Alias signup route
app.post('/api/auth/signup', async (req, res) => {
  return app._router.handle(req, res); // delegates to /api/auth/register internally
});

app.post('/api/auth/login', async (req, res) => {
  const db = readDB();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبة' });
  }

  const staff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (!staff) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }

  const isPasswordValid = await bcrypt.compare(password, staff.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }

  const permissions = {
    isOwner: staff.isOwner || false,
    canStamp: staff.canStamp || false,
    canEnrollCustomer: staff.canEnrollCustomer || false,
    canViewReports: staff.canViewReports || false,
    canManageSettings: staff.canManageSettings || false
  };

  const token = jwt.sign(
    { merchantId: staff.merchantId, staffId: staff.id, permissions },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ success: true, token, permissions, user: { name: staff.name, email: staff.email } });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const staff = db.merchant_staff.find(s => s.id === req.staffId);
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  if (!staff || !merchant) {
    return res.status(404).json({ error: 'لم يتم العثور على حسابك' });
  }
  res.json({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    businessName: merchant.businessName,
    permissions: req.permissions
  });
});

// ----------------------------------------
// Loyalty Card API
// ----------------------------------------
app.get('/api/loyalty-cards', requireAuth, (req, res) => {
  const db = readDB();
  const card = db.loyalty_cards.find(c => c.merchantId === req.merchantId);
  if (!card) {
    return res.status(404).json({ error: 'لم يتم العثور على بطاقة ولاء لهذا التاجر' });
  }
  res.json(card);
});

app.post('/api/loyalty-cards', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const db = readDB();
  let card = db.loyalty_cards.find(c => c.merchantId === req.merchantId);

  const updateData = {
    brandName: req.body.brandName,
    programName: req.body.programName,
    logoUrl: req.body.logoUrl,
    hexBackgroundColor: req.body.hexBackgroundColor,
    stampsGoal: parseInt(req.body.stampsGoal) || 10,
    stampEmoji: req.body.stampEmoji,
    rewardName: req.body.rewardName,
    cooldownMinutes: parseInt(req.body.cooldownMinutes) || 1
  };

  if (!card) {
    card = {
      id: `card_${Date.now()}`,
      merchantId: req.merchantId,
      ...updateData
    };
    db.loyalty_cards.push(card);
  } else {
    Object.assign(card, updateData);
  }

  writeDB(db);
  res.json({ success: true, card });
});

// ----------------------------------------
// Branches Management API
// ----------------------------------------
app.get('/api/branches', requireAuth, (req, res) => {
  const db = readDB();
  const list = db.branches.filter(b => b.merchantId === req.merchantId);
  res.json(list);
});

app.post('/api/branches', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const db = readDB();
  const { name, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'اسم الفرع مطلوب' });
  }

  // Check Branch Limit according to plan
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  const planId = merchant ? merchant.planId : 'free';
  const maxBranches = planId === 'free' ? 1 : (planId === 'growth' ? 3 : -1);

  const currentCount = db.branches.filter(b => b.merchantId === req.merchantId).length;
  if (maxBranches !== -1 && currentCount >= maxBranches) {
    return res.status(403).json({ error: `لقد تجاوزت الحد المسموح به لخطة اشتراكك الحالية (${maxBranches} فرع). يرجى الترقية لإضافة فروع إضافية.` });
  }

  const branchId = `branch_${Date.now()}`;
  const newBranch = {
    id: branchId,
    merchantId: req.merchantId,
    name,
    address: address || '',
    qr_code_value: `qr_${req.merchantId}_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  db.branches.push(newBranch);
  writeDB(db);
  res.json({ success: true, branch: newBranch });
});

// ----------------------------------------
// Customers Self-Enrollment & Fetch
// ----------------------------------------
app.get('/api/public/cards/:id', (req, res) => {
  const db = readDB();
  const customer = db.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  const card = db.loyalty_cards.find(c => c.merchantId === customer.merchantId);
  if (!card) {
    return res.status(404).json({ error: 'البطاقة غير موجودة' });
  }

  res.json({ customer, card });
});

// Public Self-Enrollment via Scanning Branch QR
app.post('/api/customers/self-enroll', (req, res) => {
  const db = readDB();
  const { name, phone, branchQrCode } = req.body;

  if (!name || !phone || !branchQrCode) {
    return res.status(400).json({ error: 'الرجاء إدخال الاسم، رقم الجوال ورمز الفرع' });
  }

  // Find branch matching qr_code_value
  const branch = db.branches.find(b => b.qr_code_value === branchQrCode);
  if (!branch) {
    return res.status(404).json({ error: 'كود الفرع الممسوح غير صحيح أو لم يعد فعالاً' });
  }

  const merchantId = branch.merchantId;

  // Plan limit check via canAddCustomer
  if (!canAddCustomer(merchantId, db)) {
    return res.status(403).json({ error: 'تجاوزت هذه المنشأة التجارية الحد الأقصى للمشتركين في الخطة الحالية. يرجى إشعار المتجر للترقية.' });
  }

  // Avoid duplicate enrolments in the same merchant
  let customer = db.customers.find(c => c.merchantId === merchantId && c.phone === phone);
  if (customer) {
    return res.json({ success: true, customer, message: 'أنت مسجل بالفعل في هذا البرنامج!' });
  }

  const card = db.loyalty_cards.find(c => c.merchantId === merchantId);
  const stampsGoal = card ? card.stampsGoal : 10;

  const customerId = `cust_${Date.now()}`;
  const newCustomer = {
    id: customerId,
    merchantId,
    name,
    phone,
    stampsCollected: 0,
    stampsGoal,
    lastStampedTime: null,
    rewardsClaimed: 0,
    enrollment_source: 'self_qr',
    createdAt: new Date().toISOString()
  };

  db.customers.push(newCustomer);

  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId,
    customerId,
    branchId: branch.id,
    customerName: name,
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: `تم التسجيل الذاتي للعميل بنجاح عبر فرع: ${branch.name}`
  });

  writeDB(db);
  res.json({ success: true, customer: newCustomer });
});

// ----------------------------------------
// Core Stamping API with anti-fraud & quotas
// ----------------------------------------
app.post('/api/stamps/add', requireAuth, requirePermission('canStamp'), (req, res) => {
  const db = readDB();
  const { customerId, branchId } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'معرّف العميل مطلوب لإتمام عملية الختم' });
  }

  const result = addStampSimulated(customerId, req.staffId, branchId, db);
  if (!result.success) {
    return res.status(result.seconds_remaining ? 429 : 400).json({ error: result.error, seconds_remaining: result.seconds_remaining });
  }

  writeDB(db);
  res.json(result);
});

// Existing compatibility routes
app.get('/api/customers', requireAuth, (req, res) => {
  const db = readDB();
  const customers = db.customers.filter(c => c.merchantId === req.merchantId);
  res.json(customers);
});

app.post('/api/customers', requireAuth, requirePermission('canEnrollCustomer'), (req, res) => {
  const db = readDB();
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال مطلوبان لتسجيل العميل' });
  }

  if (!canAddCustomer(req.merchantId, db)) {
    return res.status(403).json({ error: 'تجاوزت هذه المنشأة التجارية الحد الأقصى للمشتركين في الخطة الحالية. يرجى ترقية الاشتراك لإضافة عملاء جدد.' });
  }

  const card = db.loyalty_cards.find(c => c.merchantId === req.merchantId);
  const stampsGoal = card ? card.stampsGoal : 10;

  const customerId = `cust_${Date.now()}`;
  const newCustomer = {
    id: customerId,
    merchantId: req.merchantId,
    name,
    phone,
    stampsCollected: 0,
    stampsGoal,
    lastStampedTime: null,
    rewardsClaimed: 0,
    enrollment_source: 'manual',
    createdAt: new Date().toISOString()
  };

  db.customers.push(newCustomer);

  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: req.merchantId,
    customerId,
    customerName: name,
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: 'تم تسجيل عميل جديد في البرنامج عبر لوحة التحكم.'
  });

  writeDB(db);
  res.json({ success: true, customer: newCustomer });
});

app.post('/api/customers/:id/redeem', requireAuth, requirePermission('canStamp'), (req, res) => {
  const db = readDB();
  const customer = db.customers.find(c => c.id === req.params.id && c.merchantId === req.merchantId);

  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  const stampsGoal = customer.stampsGoal || 10;
  if (customer.stampsCollected < stampsGoal) {
    return res.status(400).json({ error: 'العميل لم يجمع أختام كافية بعد للمكافأة!' });
  }

  customer.stampsCollected -= stampsGoal;
  customer.rewardsClaimed += 1;

  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: req.merchantId,
    customerId: customer.id,
    customerName: customer.name,
    type: 'redeem',
    timestamp: new Date().toISOString(),
    details: `تم استبدال مكافأة بنجاح! الأختام المتبقية: ${customer.stampsCollected}`
  });

  writeDB(db);
  res.json({ success: true, customer });
});

// ----------------------------------------
// Staff Management API (Owner Only)
// ----------------------------------------
app.get('/api/staff', requireAuth, requirePermission('isOwner'), (req, res) => {
  const db = readDB();
  const staffList = db.merchant_staff.filter(s => s.merchantId === req.merchantId);
  const safeStaffList = staffList.map(s => {
    const { passwordHash, ...rest } = s;
    return rest;
  });
  res.json(safeStaffList);
});

app.post('/api/staff', requireAuth, requirePermission('isOwner'), async (req, res) => {
  const db = readDB();
  const { name, email, password, branchId, canStamp, canEnrollCustomer, canViewReports, canManageSettings } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'البيانات الأساسية للموظف مطلوبة' });
  }

  const existingStaff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existingStaff) {
    return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل لموظف آخر' });
  }

  // Check Staff Quota Limits
  const merchant = db.merchants.find(m => m.id === req.merchantId);
  const planId = merchant ? merchant.planId : 'free';
  const maxStaff = planId === 'free' ? 1 : (planId === 'growth' ? 5 : -1);

  const currentStaffCount = db.merchant_staff.filter(s => s.merchantId === req.merchantId && !s.isOwner).length;
  if (maxStaff !== -1 && currentStaffCount >= maxStaff) {
    return res.status(403).json({ error: `لقد تجاوزت الحد الأقصى للموظفين المتاحين لخطة اشتراكك الحالية (${maxStaff} موظفين). يرجى الترقية لتفعيل حسابات إضافية.` });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newStaff = {
    id: `staff_${Date.now()}`,
    merchantId: req.merchantId,
    branchId: branchId || null,
    name,
    email: email.toLowerCase(),
    passwordHash,
    isOwner: false,
    canStamp: canStamp === true,
    canEnrollCustomer: canEnrollCustomer === true,
    canViewReports: canViewReports === true,
    canManageSettings: canManageSettings === true,
    createdAt: new Date().toISOString()
  };

  db.merchant_staff.push(newStaff);
  writeDB(db);

  const { passwordHash: ph, ...safeStaff } = newStaff;
  res.json({ success: true, staff: safeStaff });
});

// ----------------------------------------
// Reports & Logs API
// ----------------------------------------
app.get('/api/reports/overview', requireAuth, requirePermission('canViewReports'), (req, res) => {
  const db = readDB();
  const customers = db.customers.filter(c => c.merchantId === req.merchantId);
  const pushes = db.notifications_log.filter(p => p.merchantId === req.merchantId);

  const totalCustomers = customers.length;
  let totalStamps = 0;
  let totalRewards = 0;
  customers.forEach(c => {
    totalStamps += c.stampsCollected;
    totalRewards += (c.rewardsClaimed || 0);
  });

  res.json({
    totalCustomers,
    totalStamps,
    totalRewards,
    totalPushes: pushes.length
  });
});

app.get('/api/logs', requireAuth, requirePermission('canViewReports'), (req, res) => {
  const db = readDB();
  const logs = db.stamps_log.filter(l => l.merchantId === req.merchantId);
  res.json(logs);
});

app.get('/api/pushes', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const db = readDB();
  const pushes = db.notifications_log.filter(p => p.merchantId === req.merchantId);
  res.json(pushes);
});

app.post('/api/notifications', requireAuth, requirePermission('canManageSettings'), (req, res) => {
  const db = readDB();
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'عنوان التنبيه ومحتوى الرسالة مطلوبان' });
  }

  const newPush = {
    id: `push_${Date.now()}`,
    merchantId: req.merchantId,
    title,
    body,
    timestamp: new Date().toISOString()
  };

  db.notifications_log.unshift(newPush);

  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: req.merchantId,
    customerId: 'all',
    customerName: 'جميع المشتركين',
    type: 'push',
    timestamp: new Date().toISOString(),
    details: `تم إرسال إشعار دفع جماعي: ${title}`
  });

  writeDB(db);
  res.json({ success: true, push: newPush });
});

// Fetch Public Branch Metadata for customer view
app.get('/api/public/branches/:qr', (req, res) => {
  const db = readDB();
  const branch = db.branches.find(b => b.qr_code_value === req.params.qr);
  if (!branch) {
    return res.status(404).json({ error: 'الفرع غير موجود' });
  }

  const merchant = db.merchants.find(m => m.id === branch.merchantId);
  const card = db.loyalty_cards.find(c => c.merchantId === branch.merchantId);

  res.json({
    branch: { id: branch.id, name: branch.name, address: branch.address },
    merchant: { businessName: merchant ? merchant.businessName : '' },
    card: card ? { programName: card.programName, hexBackgroundColor: card.hexBackgroundColor, stampEmoji: card.stampEmoji, stampsGoal: card.stampsGoal, rewardName: card.rewardName } : null
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running locally at http://localhost:${PORT}`);
});

module.exports = app;
