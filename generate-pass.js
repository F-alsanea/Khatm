/**
 * ختم — Google Wallet Loyalty Pass Generator
 * ---------------------------------------------------
 * سكريبت مبسّط يسوي لك:
 *  1) "Loyalty Class"  = قالب البطاقة (شعارك، لونك، اسم المكافأة) — تسويه مرة وحدة فقط
 *  2) "Loyalty Object" = بطاقة عميل واحد (كم ختم عنده، رقمه) — تسويه لكل عميل جديد
 *  3) رابط "Add to Google Wallet" جاهز ترسله للعميل (واتساب / QR)
 *
 * قبل ما تشغّل هذا الملف، لازم يكون عندك:
 *  - مشروع في Google Cloud Console
 *  - تفعيل "Google Wallet API" في المشروع
 *  - Issuer ID من Google Pay & Wallet Console: https://pay.google.com/business/console
 *  - Service Account + ملف JSON للمفتاح (Keys > Add Key > JSON)
 *  - أضِف بريد الـ Service Account كـ "Admin" في Wallet Console (نفس الصفحة أعلاه)
 *
 * التثبيت:
 *   npm install google-auth-library jsonwebtoken
 *
 * التشغيل:
 *   node generate-pass.js
 */

const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// ==== إعدادات لازم تعبيها أنت ====
const KEY_FILE_PATH = './service-account-key.json'; // ملف الـ JSON اللي نزلته من Google Cloud
const ISSUER_ID = 'ضع_رقم_الـ_Issuer_ID_هنا';        // من Google Pay & Wallet Console
const CLASS_SUFFIX = 'khatm_coffee_card';              // معرف قالب البطاقة (حروف/أرقام إنجليزية فقط)
// ===================================

if (!fs.existsSync(KEY_FILE_PATH)) {
  console.error('خطأ: ملف مفاتيح الخدمة غير موجود:', KEY_FILE_PATH);
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(KEY_FILE_PATH, 'utf8'));
const CLASS_ID = `${ISSUER_ID}.${CLASS_SUFFIX}`;

const httpClient = new GoogleAuth({
  credentials,
  scopes: 'https://www.googleapis.com/auth/wallet_object.issuer',
});

// -------------------------------------------------------
// 1) إنشاء أو تحديث قالب البطاقة (Loyalty Class)
// -------------------------------------------------------
async function createOrUpdateClass() {
  const client = await httpClient.getClient();

  const loyaltyClass = {
    id: CLASS_ID,
    issuerName: 'ختم',
    programName: 'محمصة السنبلة — بطاقة قهوة',
    programLogo: {
      sourceUri: {
        // رابط شعارك، لازم يكون رابط عام (مو ملف محلي)
        uri: 'https://example.com/logo.png',
      },
    },
    hexBackgroundColor: '#1E3050', // نفس لون الهوية (كحلي)
    reviewStatus: 'UNDER_REVIEW',
  };

  try {
    // نحاول نجيب القالب أولاً، إذا موجود نحدّثه، إذا مو موجود نسويه
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${CLASS_ID}`,
      method: 'GET',
    });
    console.log('القالب موجود بالفعل، جاري التحديث...');
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${CLASS_ID}`,
      method: 'PUT',
      data: loyaltyClass,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('القالب غير موجود، جاري الإنشاء...');
      await client.request({
        url: 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',
        method: 'POST',
        data: loyaltyClass,
      });
    } else {
      throw err;
    }
  }
  console.log('✅ قالب البطاقة جاهز:', CLASS_ID);
}

// -------------------------------------------------------
// 2) إنشاء بطاقة لعميل محدد (Loyalty Object)
// -------------------------------------------------------
async function createCustomerObject(customerId, customerName, stampsCollected, stampsGoal) {
  const client = await httpClient.getClient();
  const objectId = `${ISSUER_ID}.customer_${customerId}`;

  const loyaltyObject = {
    id: objectId,
    classId: CLASS_ID,
    state: 'ACTIVE',
    accountId: customerId,
    accountName: customerName,
    loyaltyPoints: {
      label: 'الأختام',
      balance: { string: `${stampsCollected} / ${stampsGoal}` },
    },
    textModulesData: [
      {
        header: 'المكافأة',
        body: stampsCollected >= stampsGoal
          ? 'مبروك! مكافأتك جاهزة للاستبدال 🎉'
          : `باقي ${stampsGoal - stampsCollected} ختم للمكافأة المجانية`,
      },
    ],
    barcode: {
      type: 'QR_CODE',
      value: objectId, // نفس القيمة اللي بيمسحها الموظف عند الختم
    },
  };

  try {
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
      method: 'POST',
      data: loyaltyObject,
    });
    console.log('✅ بطاقة العميل جاهزة:', objectId);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log('البطاقة موجودة مسبقاً، جاري التحديث بدل الإنشاء...');
      await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
        method: 'PUT',
        data: loyaltyObject,
      });
    } else {
      throw err;
    }
  }

  return objectId;
}

// -------------------------------------------------------
// 3) توليد رابط "أضف إلى Google Wallet"
// -------------------------------------------------------
function generateAddToWalletLink(objectId) {
  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    payload: {
      loyaltyObjects: [{ id: objectId }],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// -------------------------------------------------------
// 4) تحديث عدد الأختام (تناديها كل ما الموظف يختم للعميل)
// -------------------------------------------------------
async function addStamp(customerId, newStampCount, stampsGoal) {
  const client = await httpClient.getClient();
  const objectId = `${ISSUER_ID}.customer_${customerId}`;

  await client.request({
    url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objectId}`,
    method: 'PATCH',
    data: {
      loyaltyPoints: {
        label: 'الأختام',
        balance: { string: `${newStampCount} / ${stampsGoal}` },
      },
      textModulesData: [
        {
          header: 'المكافأة',
          body: newStampCount >= stampsGoal
            ? 'مبروك! مكافأتك جاهزة للاستبدال 🎉'
            : `باقي ${stampsGoal - newStampCount} ختم للمكافأة المجانية`,
        },
      ],
    },
  });
  console.log(`✅ تم تحديث بطاقة ${customerId} إلى ${newStampCount} أختام`);
}

// -------------------------------------------------------
// تجربة كاملة: قالب + عميل تجريبي + رابط
// -------------------------------------------------------
async function main() {
  await createOrUpdateClass();

  const objectId = await createCustomerObject(
    'cust_001',      // معرف فريد للعميل عندك بقاعدة بياناتك
    'عبدالله',        // اسم العميل
    3,                // كم ختم جمع
    10                // الهدف
  );

  const link = generateAddToWalletLink(objectId);
  console.log('\n🔗 رابط "أضف إلى المحفظة" — أرسله للعميل عبر واتساب أو حطه في QR:\n');
  console.log(link);

  // مثال: بعد ما يجي العميل ويطلب ختم جديد
  // await addStamp('cust_001', 4, 10);
}

main().catch(console.error);
