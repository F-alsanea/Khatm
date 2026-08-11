const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(__dirname));

// Helper: read db
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { merchant: {}, customers: [], logs: [], pushes: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db:', err);
    return { merchant: {}, customers: [], logs: [], pushes: [] };
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
// Merchant API
// ----------------------------------------
app.get('/api/merchant', (req, res) => {
  const db = readDB();
  res.json(db.merchant);
});

app.post('/api/merchant', (req, res) => {
  const db = readDB();
  db.merchant = { ...db.merchant, ...req.body };
  writeDB(db);
  res.json({ success: true, merchant: db.merchant });
});

// ----------------------------------------
// Customer Pass API
// ----------------------------------------
app.get('/api/customers', (req, res) => {
  const db = readDB();
  res.json(db.customers);
});

app.get('/api/customers/:id', (req, res) => {
  const db = readDB();
  const customer = db.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }
  res.json(customer);
});

app.post('/api/customers', (req, res) => {
  const db = readDB();
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الجوال مطلوبان' });
  }

  // Create unique customer id
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

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    customerId,
    customerName: name,
    type: 'enroll',
    timestamp: new Date().toISOString(),
    details: 'تم تسجيل عميل جديد في البرنامج.'
  });

  writeDB(db);
  res.json({ success: true, customer: newCustomer });
});

// ----------------------------------------
// Stamp & Cooldown API (Fraud Prevention)
// ----------------------------------------
app.post('/api/customers/:id/stamp', (req, res) => {
  const db = readDB();
  const customer = db.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  const cooldownMinutes = db.merchant.cooldownMinutes || 1;
  const now = new Date();

  if (customer.lastStampedTime) {
    const lastStamped = new Date(customer.lastStampedTime);
    const diffMs = now - lastStamped;
    const diffMins = diffMs / (1000 * 60);

    if (diffMins < cooldownMinutes) {
      const waitSeconds = Math.ceil((cooldownMinutes - diffMins) * 60);
      return res.status(429).json({
        error: `حماية ضد الاحتيال: يرجى الانتظار ${waitSeconds} ثانية قبل الختم التالي.`
      });
    }
  }

  // Add stamp
  customer.stampsCollected += 1;
  customer.lastStampedTime = now.toISOString();

  // Log stamp
  db.logs.unshift({
    id: `log_${Date.now()}`,
    customerId: customer.id,
    customerName: customer.name,
    type: 'stamp',
    timestamp: now.toISOString(),
    details: `تم إضافة ختم. المجموع الحالي: ${customer.stampsCollected}/${customer.stampsGoal}`
  });

  writeDB(db);
  res.json({ success: true, customer });
});

// ----------------------------------------
// Reward Redemption API
// ----------------------------------------
app.post('/api/customers/:id/redeem', (req, res) => {
  const db = readDB();
  const customer = db.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'العميل غير موجود' });
  }

  const stampsGoal = customer.stampsGoal || db.merchant.stampsGoal || 10;
  if (customer.stampsCollected < stampsGoal) {
    return res.status(400).json({ error: 'العميل لم يجمع أختام كافية بعد للمكافأة!' });
  }

  customer.stampsCollected -= stampsGoal;
  customer.rewardsClaimed += 1;

  // Log redemption
  db.logs.unshift({
    id: `log_${Date.now()}`,
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
// Logs API
// ----------------------------------------
app.get('/api/logs', (req, res) => {
  const db = readDB();
  res.json(db.logs);
});

// ----------------------------------------
// Push Notification API (Simulate)
// ----------------------------------------
app.get('/api/pushes', (req, res) => {
  const db = readDB();
  res.json(db.pushes);
});

app.post('/api/pushes', (req, res) => {
  const db = readDB();
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'العنوان ومحتوى الإشعار مطلوبان' });
  }

  const newPush = {
    id: `push_${Date.now()}`,
    title,
    body,
    timestamp: new Date().toISOString()
  };

  db.pushes.unshift(newPush);

  // Log notification push
  db.logs.unshift({
    id: `log_${Date.now()}`,
    customerId: 'all',
    customerName: 'جميع المشتركين',
    type: 'push',
    timestamp: new Date().toISOString(),
    details: `تم إرسال إشعار دفع: ${title}`
  });

  writeDB(db);
  res.json({ success: true, push: newPush });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running locally at http://localhost:${PORT}`);
});
