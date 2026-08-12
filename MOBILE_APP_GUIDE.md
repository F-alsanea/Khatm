# دليل تحويل موقع "ختم" إلى تطبيق جوال كامل ومثالي 📱

أهلاً بك! لقد تم تصميم هذا الدليل الشامل ليجيب عن طلبك بدقة، حيث يحتوي على:
1. **البرومبت السحري والكامل (The Ultimate Prompt)**: لإنشاء نفس الموقع بالتفصيل وبنفس التصميم الفاخر والميزات التفاعلية (لوحة التحكم، بوابة الموظف، نظام الأختام، الأمان، والتحليلات).
2. **الكود الكامل والخطوات** لتحويل الموقع الحالي إلى تطبيق جوال أصلي (Android & iOS) باستخدام **CapacitorJS** (التقنية الأحدث والأسرع).
3. **الكود الكامل** لإنشاء تطبيق جوال بـ **Flutter (WebView)** لعرض الموقع داخل التطبيق.
4. **دليل تثبيت وتشغيل التطبيق** كـ **PWA (تطبيق ويب تقدمي)** مباشرة من المتصفح (تم تفعيل هذه الميزة في الكود وتجد ملفاتها في المستودع).

---

## 📑 القسم الأول: البرومبت السحري والكامل (The Ultimate Prompt)

انسخ البرومبت التالي وضعه في أي نموذج ذكاء اصطناعي متطور (مثل Claude 3.5 Sonnet, ChatGPT-4o, Cursor, v0.dev, أو Bolt.new) للحصول على تطبيق وموقع متكامل يطابق نظام "ختم" الحالي بالكامل:

```text
تصميم وبرمجة تطبيق ويب كامل (Single-Page أو Multi-Page متكامل) باسم "ختم - Khatm" لبطاقات الولاء الرقمية المخصصة لمحفظتي Apple Wallet و Google Wallet. التطبيق يستهدف المتاجر والمنشآت في السعودية والخليج، ويجب أن يتميز بتصميم بريميوم فخم بلمسات عربية أصيلة (مستوحى من ألوان الورق العتيق Parchment، النحاس الدافئ Brass، والحبر الداكن Ink، والختم العنابي الفاخر Stamp).

الموقع يحتوي على 3 أقسام رئيسية تفاعلية بالكامل مع دعم للـ Offline Fallback (باستخدام LocalStorage في حال غياب السيرفر) وسيرفر حقيقي Node.js/Express:

1. الصفحة الرئيسية (Landing Page):
- تصميم رائع واحترافي مستجيب بالكامل (Responsive).
- قسم Hero يعرض بطاقة ولاء تفاعلية مميزة (تحتوي على شعار المتجر، اسم البرنامج، الرموز التعبيرية للأختام مثل أكواب القهوة، وعداد الأختام).
- أقسام: "كيف يعمل"، "الاستخدامات"، "المزايا"، "الأسعار"، و"الأسئلة الشائعة FAQ" التفاعلية بالكامل.

2. لوحة تحكم التاجر (Merchant Dashboard):
- نظام تسجيل دخول وإنشاء حساب للتاجر الجديد (Multi-Tenant) مع حماية أمنية وعزل كامل للبيانات.
- قسم تصميم بطاقة الولاء (Customizer): تغيير اسم المنشأة، البرنامج، الرموز التعبيرية للأختام (مثلاً: ☕, 💇, 🍕)، لون الخلفية، وتحديد الهدف (مثلاً: 10 أختام) مع معاينة حية (Live Preview) لحظية للبطاقة.
- قسم إدارة المشتركين (Customers): لتسجيل عميل جديد، توليد رابط بطاقته الفريد، وعرض كود QR المخصص للختم.
- قسم إدارة الموظفين (Staff): يتيح لمالك المتجر إضافة موظفين وتحديد صلاحياتهم (صلاحية الختم، صلاحية التسجيل، رؤية التقارير).
- قسم إرسال الإشعارات الجماعية (Push Notifications) مع محاكاة فورية مذهلة لشاشة قفل الهاتف وتلقي الإشعار عليها.
- قسم التحليلات والسجلات (Analytics & Logs): لعرض إحصائيات المشتركين، الأختام الموزعة، المكافآت المستردة، وسجل تفصيلي بالوقت والتاريخ لكل حركة.

3. بوابة مسح وختم الموظف (Staff Scanner):
- صفحة مخصصة للموظفين لختم بطاقات العملاء واستبدال جوائزهم.
- تحتوي على محاكاة لكاميرا الفحص ومربع لإدخال معرّف العميل يدوياً أو عبر الرابط.
- زر "ختم" تفاعلي يصدر صوتاً مميزاً وحركة ختم حقيقية على الشاشة (Ink Seal) مع حماية ضد الاحتيال (Cooldown) تمنع الختم المتكرر قبل مرور وقت محدد.
- زر "استرداد المكافأة 🎁" يظهر فقط عندما يكمل العميل عدد الأختام المطلوبة لتصفير العداد واحتساب جائزة مستردة.

المتطلبات التقنية والهندسة البرمجية:
- الواجهة الأمامية: HTML5, CSS3 مخصص مع استخدام متغيرات الألوان الفخمة، و JavaScript نقي وتفاعلي بدون تعقيدات.
- الخلفية (Backend): سيرفر Node.js مع Express.js وقاعدة بيانات ملفات db.json بسيطة، تدعم توثيق JWT (JSON Web Tokens) وتشفير كلمات المرور بـ bcryptjs.
- الأمان: عزل تام بين بيانات التجار؛ الموظف لا يرى إلا عملاء متجره ولا يستطيع الختم لعميل متجر آخر، والمالك فقط من يدير الموظفين والتقارير.
- يرجى كتابة الكود كاملاً لجميع الملفات (index.html, styles.css, dashboard.html, dashboard.js, scanner.html, server.js, db.json) بحيث تكون متناسقة وتعمل معاً بسلاسة تامة وتدعم التشغيل الفوري والـ PWA لتثبيته كتطبيق جوال.
```

---

## 📱 القسم الثاني: تحويل الموقع الحالي إلى تطبيق جوال أصلي (Android & iOS)

لتحويل موقعك الحالي "ختم" إلى تطبيق جوال حقيقي يثبته المستخدمون من متجري Google Play و App Store، فإن أفضل وأقوى تقنية هي **CapacitorJS** من شركة Ionic. تقوم هذه التقنية بلف (Wrap) ملفات الويب الخاصة بك وتوليد مشروع Android (بـ Java/Kotlin) ومشروع iOS (بـ Swift) أصليين.

### 🛠️ خطوات العمل خطوة بخطوة:

#### 1. تهيئة بيئة العمل وتثبيت الأدوات:
تأكد من تثبيت [Node.js](https://nodejs.org/) على جهازك، ثم افتح ترمينال (Terminal) في مجلد المشروع ونفذ الأمر التالي لتثبيت الـ CLI الخاص بـ Capacitor:
```bash
npm install @capacitor/core @capacitor/cli
```

#### 2. تهيئة مشروع Capacitor:
نفذ الأمر التالي لبدء الإعداد:
```bash
npx cap init Khatm sa.khatm.app --web-dir=.
```
*ملاحظة: سيطلب منك اسم التطبيق (Khatm) ومعرّف الحزمة الفريد (مثال: `sa.khatm.app`).*

#### 3. إضافة منصات الجوال (Android & iOS):
قم بتثبيت حزم المنصات أولاً:
```bash
npm install @capacitor/android @capacitor/ios
```
ثم قم بإنشاء مجلدات المشاريع الأصلية:
```bash
npx cap add android
npx cap add ios
```

#### 4. مزامنة الملفات وتحديث التطبيق:
في كل مرة تقوم فيها بتعديل ملفات الويب الخاصة بك (HTML, CSS, JS)، قم بتشغيل هذا الأمر لنقل التعديلات إلى مشاريع الجوال:
```bash
npx cap sync
```

#### 5. فتح المشروع وبناء التطبيق:
* **للأندرويد (تطلب تثبيت Android Studio):**
  ```bash
  npx cap open android
  ```
  سيفتح لك برنامج Android Studio تلقائياً، ومن هناك يمكنك تشغيل التطبيق على محاكي (Emulator) أو ربط جوالك وتثبيت التطبيق عليه، ثم عمل Build لملف الـ APK أو AAB لرفعه للمتجر.

* **للآيفون (يتطلب جهاز Mac وبرنامج Xcode):**
  ```bash
  npx cap open ios
  ```
  سيفتح لك برنامج Xcode، حيث يمكنك تشغيل التطبيق على جهازك أو محاكي الآيفون، ورفع التطبيق إلى App Store.

---

## 📱 القسم الثالث: كود تطبيق الجوال باستخدام Flutter (WebView)

إذا كنت تفضل بناء تطبيق الجوال باستخدام إطار عمل **Flutter** ليعمل كـ WebView يعرض موقعك السحابي مع ميزات أصلية، فإليك الكود الكامل للتطبيق.

### 1. إضافة الاعتمادات (Dependencies):
افتح ملف `pubspec.yaml` في مشروع الفلاتر وأضف حزمة الـ WebView:
```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_inappwebview: ^6.0.0 # أو webview_flutter
```

### 2. الكود البرمجي الكامل لملف `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KhatmApp());
}

class KhatmApp extends StatelessWidget {
  const KhatmApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ختم — بطاقات الولاء الرقمية',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF1E3050), // لون الحبر الداكن الداعم للموقع
        fontFamily: 'Cairo', // نفس خط الموقع
      ),
      home: const KhatmWebViewScreen(),
    );
  }
}

class KhatmWebViewScreen extends StatefulWidget {
  const KhatmWebViewScreen({Key? key}) : super(key: key);

  @override
  State<KhatmWebViewScreen> createState() => _KhatmWebViewScreenState();
}

class _KhatmWebViewScreenState extends State<KhatmWebViewScreen> {
  InAppWebViewController? webViewController;
  double progress = 0;

  // استبدل هذا الرابط برابط موقعك الحقيقي بعد نشره على الإنترنت (مثلاً على Vercel أو GitHub Pages)
  final String targetUrl = "https://F-alsanea.github.io/Khatm";

  @override
  Widget build(BuildContext context) {
    // دعم اتجاه النص من اليمين لليوم (عربي)
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF7F4EF), // لون الورق العتيق للموقع
        body: SafeArea(
          child: Stack(
            children: [
              InAppWebView(
                initialUrlRequest: URLRequest(url: WebUri(targetUrl)),
                initialSettings: InAppWebViewSettings(
                  useShouldOverrideUrlLoading: true,
                  mediaPlaybackRequiresUserGesture: false,
                  javaScriptEnabled: true,
                  domStorageEnabled: true, // مهم جداً لتشغيل الـ LocalStorage والحسابات
                  supportZoom: false,
                  allowsBackForwardNavigationGestures: true,
                ),
                onWebViewCreated: (controller) {
                  webViewController = controller;
                },
                onProgressChanged: (controller, progressVal) {
                  setState(() {
                    progress = progressVal / 100;
                  });
                },
              ),
              // شريط تحميل تفاعلي فخم أعلى الشاشة
              if (progress < 1.0)
                LinearProgressIndicator(
                  value: progress,
                  color: const Color(0xFF9E2A2B), // لون الختم العنابي المميز لـ ختم
                  backgroundColor: const Color(0xFFEBE6DD),
                  minHeight: 4,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## ⚡ القسم الرابع: ميزة PWA (تطبيق الويب التقدمي) - مدمجة ومفعلة حالياً!

لقد قمنا بتوفير ميزة **تطبيق الويب التقدمي (Progressive Web App - PWA)** مباشرة داخل ملفات هذا المشروع!

### كيف يستفيد العميل والتاجر منها؟
عند فتح موقع "ختم" من متصفح الجوال (Safari على الآيفون أو Chrome على الأندرويد):
1. سيظهر للعميل أو التاجر خيار **"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)**.
2. بمجرد الضغط عليه، سينزل الموقع كأنه تطبيق جوال كامل على شاشة الهاتف وله أيقونة مميزة ويفتح في شاشة كاملة بدون أشرطة المتصفح المزعجة.
3. يدعم العمل في الوضع غير المتصل بالإنترنت (Offline Mode) بشكل كامل بفضل تقنية الـ LocalStorage والـ Service Worker المبرمجة بالكامل في المشروع.

**أنت الآن تملك الحل المتكامل: موقع رائع، برومبت للتطوير، ميزة PWA جاهزة ومثبتة، وتعليمات بناء تطبيق أصلي بكل سهولة!** 🎉
