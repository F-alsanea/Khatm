# Khatm — موقع وصفحة ثابتة + أدوات توليد بطاقة Google Wallet

مشروع بسيط لصفحة تسويقية لمنتج "ختم"، ومعه سكريبت بداية لتوليد بطاقات الولاء على Google Wallet.

محتويات المستودع:
- index.html — صفحة الواجهة (تم فصل CSS وJS)
- styles.css — أنماط الصفحة
- script.js — سلوك الأسئلة الشائعة (FAQ) مع تحسينات الوصول
- package.json — أدوات التشغيل (google-auth-library و jsonwebtoken)
- generate-pass.js — سكريبت مثال لتوليد بطاقات Google Wallet
- .github/workflows/pages.yml — Workflow لنشر الموقع تلقائياً على GitHub Pages
- .gitignore — استثناء الملفات الحساسة


تشغيل الموقع محلياً
-------------------
الأسهل: افتح index.html مباشرة في المتصفح. للحصول على سلوك أقرب للسيرفر (وللتأكد من أن كل المراجع تعمل):

باستخدام Python 3:

    python -m http.server 8000
    # ثم افتح http://localhost:8000

أو باستخدام http-server (Node.js):

    npx http-server -p 8000


نشر تلقائي (مفعّل)
------------------
أضفت workflow جاهز لنشر GitHub Pages عند كل دفع (push) إلى الفرع `main`.
بعد ضغط الملفات الأخيرة، Action ستُشغّل تلقائياً وتنشر محتويات المستودع كصفحة ثابتة. يمكن أن يستغرق النشر دقيقة أو دقيقتين.
المسار المتوقع للموقع بعد النشر:

https://F-alsanea.github.io/Khatm


Google Wallet — توليد أول بطاقة (generate-pass.js)
-------------------------------------------------
الملف `generate-pass.js` هو سكريبت مثال بسيط يوضح خطوات:
1) إنشاء/تحديث Loyalty Class (قالب البطاقة)
2) إنشاء Loyalty Object لكل عميل
3) توليد رابط "أضف إلى Google Wallet" (Save to Wallet URL)

ملاحظات أمان مهمة:
- لا ترفع أبداً ملف `service-account-key.json` إلى المستودع. هذا ملف سري للغاية.
- أضفت `.gitignore` ليمنع رفع `service-account-key.json` و`node_modules/` و`.env` تلقائياً.
- ضع ملف مفاتيح الخدمة (`service-account-key.json`) محلياً بجانب السكريبت، أو استخدم Secrets في CI عند الحاجة.

تشغيل السكريبت محلياً:

1) ثبت الاعتمادات:

    npm install

2) ضع ملف مفاتيح الخدمة JSON بنفس اسم `service-account-key.json` أو حدّث المسار داخل `generate-pass.js`.
3) افتح `generate-pass.js` وادخل قيمة `ISSUER_ID` (تحصّلها من Google Pay & Wallet Console).
4) شغّل السكريبت:

    node generate-pass.js

إذا كان كل شيء مضبوطًا، سيطبع السكريبت رابطًا بصيغة `https://pay.google.com/gp/v/save/eyJhbGci...` — افتحه من جهاز أندرويد أو شاركه عبر واتساب للعميل لإضافة البطاقة.

المزيد من التحسينات المقترحة:
- إضافة آلية لإرسال الروابط تلقائياً (SMS / WhatsApp / Email) عند إنشاء البطاقة.
- ربط السكريبت بقاعدة بيانات لحفظ objectId وaccountId ومتابعة الأختام.
- وضع السكريبت داخل خدمة/وظيفة سحابية (Cloud Functions) مع سجلات وتفويضات مناسبة.


حقوق وخصوصية
--------------
لا أضع أي مفاتيح أو بيانات حساسة في المستودع. تأكد أنك تخزن مفاتيح الخدمة في مكان آمن.


---
هذا README تم إضافته تلقائياً مع ملفات المشروع. إذا تريد تعديلات (مثلاً إضافة شعار، CNAME لنطاق مخصص، أو تغيير اسم الريبو في URL)، قل لي أعدّلها.
