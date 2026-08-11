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
        merchants: [],
        merchant_staff: [],
        loyalty_cards: [],
        customers: [],
        stamps_log: [],
        notifications_log: []
      };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db:', err);
    return {
      merchants: [],
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
// Auth endpoints: Register & Login
// ----------------------------------------

// 1) Register Merchant & Default Owner/Staff & loyalty template
app.post('/api/auth/register', async (req, res) => {
  const db = readDB();
  const { businessName, ownerName, email, phone, password } = req.body;

  if (!businessName || !ownerName || !email || !phone || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال كافة البيانات المطلوبة' });
  }

  // Check if email already registered
  const existingStaff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existingStaff) {
    return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
  }

  const merchantId = `merchant_${Date.now()}`;
  const staffId = `staff_${Date.now()}`;
  const cardId = `card_${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 10);

  // Create Merchant record
  const newMerchant = {
    id: merchantId,
    businessName,
    ownerName,
    email,
    phone,
    planId: 'free',
    status: 'trial',
    createdAt: new Date().toISOString()
  };
  db.merchants.push(newMerchant);

  // Create Default Owner Staff record
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
    name: ownerName,
    email: email.toLowerCase(),
    passwordHash,
    ...permissions,
    createdAt: new Date().toISOString()
  };
  db.merchant_staff.push(newStaff);

  // Create Default Loyalty Card template for this merchant
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
    cooldownMinutes: 1
  };
  db.loyalty_cards.push(newCard);

  // Log action
  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId,
    customerId: 'system',
    customerName: 'النظام',
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: `تم تسجيل حساب تاجر جديد بنجاح: ${businessName}`
  });

  writeDB(db);

  // Generate JWT token
  const token = jwt.sign(
    { merchantId, staffId, permissions },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ success: true, token, permissions, user: { name: ownerName, email } });
});

// 2) Login Staff/Owner
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

// 3) Get current authenticated user
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

// Public metadata fetching for customer view (Dynamic Pass Card)
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
// Customers API (With Isolation & Permissions)
// ----------------------------------------

// Fetch all customers for current logged-in merchant
app.get('/api/customers', requireAuth, (req, res) => {
  const db = readDB();
  const customers = db.customers.filter(c => c.merchantId === req.merchantId);
  res.json(customers);
});

// Fetch search customers
app.get('/api/customers/search', requireAuth, (req, res) => {
  const db = readDB();
  const query = (req.query.q || '').toLowerCase();
  const customers = db.customers.filter(c =>
    c.merchantId === req.merchantId &&
    (c.name.toLowerCase().includes(query) || c.phone.includes(query))
  );
  res.json(customers);
});

// Register new customer by merchant staff
app.post('/api/customers', requireAuth, requirePermission('canEnrollCustomer'), (req, res) => {
  const db = readDB();
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال مطلوبان لتسجيل العميل' });
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
    createdAt: new Date().toISOString()
  };

  db.customers.push(newCustomer);

  // Log action
  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: req.merchantId,
    customerId,
    customerName: name,
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: 'تم تسجيل عميل جديد في البرنامج عبر الموظف.'
  });

  writeDB(db);
  res.json({ success: true, customer: newCustomer });
});

// Public Self-Enrollment (Customer scans a QR in branch to register themselves)
app.post('/api/customers/self-enroll', (req, res) => {
  const db = readDB();
  const { name, phone, merchantId } = req.body;

  if (!name || !phone || !merchantId) {
    return res.status(400).json({ error: 'البيانات المرسلة غير مكتملة' });
  }

  const merchantExists = db.merchants.find(m => m.id === merchantId);
  if (!merchantExists) {
    return res.status(404).json({ error: 'المنشأة التجارية غير مسجلة لدينا' });
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
    createdAt: new Date().toISOString()
  };

  db.customers.push(newCustomer);

  // Log action
  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId,
    customerId,
    customerName: name,
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: 'تم التسجيل الذاتي للعميل عبر مسح QR الفرع.'
  });

  writeDB(db);
  res.json({ success: true, customer: newCustomer });
});

// ----------------------------------------
// Stamping Action (Multi-Tenant Secure)
// ----------------------------------------
app.post('/api/stamps', requireAuth, requirePermission('canStamp'), (req, res) => {
  const db = readDB();
  const { customerId } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'معرّف العميل مطلوب لإتمام العملية' });
  }

  // Find and isolate customer belonging to this merchant only
  const customer = db.customers.find(c => c.id === customerId && c.merchantId === req.merchantId);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على هذا العميل ضمن قائمتك' });
  }

  const card = db.loyalty_cards.find(c => c.merchantId === req.merchantId);
  const cooldownMinutes = card ? card.cooldownMinutes : 1;
  const now = new Date();

  // Cooldown / Anti-Fraud Check
  if (customer.lastStampedTime) {
    const lastStamped = new Date(customer.lastStampedTime);
    const diffMs = now - lastStamped;
    const diffMins = diffMs / (1000 * 60);

    if (diffMins < cooldownMinutes) {
      const waitSeconds = Math.ceil((cooldownMinutes - diffMins) * 60);
      return res.status(429).json({
        error: `حماية ضد الاحتيال مفعّلة: الرجاء الانتظار ${waitSeconds} ثانية قبل ختم العميل مجدداً`
      });
    }
  }

  // Update customer stamps count
  customer.stampsCollected += 1;
  customer.lastStampedTime = now.toISOString();

  // Log stamp
  db.stamps_log.unshift({
    id: `log_${Date.now()}`,
    merchantId: req.merchantId,
    customerId: customer.id,
    customerName: customer.name,
    type: 'stamp',
    timestamp: now.toISOString(),
    details: `تم إضافة ختم. المجموع الحالي: ${customer.stampsCollected} / ${customer.stampsGoal}`
  });

  writeDB(db);
  res.json({ success: true, customer });
});

// Customer Reward Redemption
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

  // Log redemption
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
  // Hide password hashes
  const safeStaffList = staffList.map(s => {
    const { passwordHash, ...rest } = s;
    return rest;
  });
  res.json(safeStaffList);
});

app.post('/api/staff', requireAuth, requirePermission('isOwner'), async (req, res) => {
  const db = readDB();
  const { name, email, password, canStamp, canEnrollCustomer, canViewReports, canManageSettings } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'البيانات الأساسية للموظف (الاسم، البريد، كلمة المرور) مطلوبة' });
  }

  const existingStaff = db.merchant_staff.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existingStaff) {
    return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل لموظف آخر' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newStaff = {
    id: `staff_${Date.now()}`,
    merchantId: req.merchantId,
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
// Reports & Push Logs API
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

  // Log action
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

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running locally at http://localhost:${PORT}`);
});

module.exports = app;
