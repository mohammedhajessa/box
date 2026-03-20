# تطبيق إدارة التبرعات — Donation Management App

تطبيق ويب بسيط لإدارة التبرعات باستخدام Next.js و Supabase (عربي، RTL).

## المتطلبات

- Node.js 18+
- حساب [Supabase](https://supabase.com)

## الإعداد

### 1. تثبيت الحزم

```bash
npm install
```

### 2. إعداد Supabase

1. أنشئ مشروعاً جديداً في [Supabase](https://app.supabase.com).
2. من **SQL Editor** نفّذ محتوى الملف `supabase/schema.sql` لإنشاء الجداول وسياسات RLS.
3. من **Storage** أنشئ bucket جديد (إلا ستظهر "Bucket not found" في صفحة التبرع):
   - اضغط **New bucket**، الاسم بالضبط: **`receipts`**
   - فعّل **Public bucket**
   - أضف سياسة **INSERT** للدور `anon` حتى يتمكن الزوار من رفع صور الحوالات (تفاصيل أكثر في `supabase/SETUP_INSTRUCTIONS.md`).
4. **حسابات المسؤولين**: من **Authentication → Users** أنشئ مستخدماً (مسؤولاً)، ثم أضفه في جدول `admins` من **SQL Editor**:
   ```sql
   insert into public.admins (user_id, display_name) values ('USER_UUID_HERE', 'اسم المسؤول');
   ```
   (انسخ `user_id` من صفحة المستخدم في Supabase. إذا ظهرت رسالة "new row violates row-level security policy" عند إضافة مستخدم أو عند إرسال تبرع، نفّذ `supabase/migration_fix_rls_trigger.sql` في SQL Editor.)

### 3. متغيرات البيئة

انسخ `.env.local.example` إلى `.env.local` واملأ القيم من لوحة Supabase (Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

بدون هذه القيم يعمل البناء (build) لكن التطبيق لن يتصل بـ Supabase فعلياً. يجب تعبئة القيم قبل التشغيل أو البناء للإنتاج.

**إذا ظهرت رسالة "email rate limit exceeded" (تجاوز حد البريد):** Supabase يحدّ عدد رسائل البريد. للتطوير يمكن تعطيل تأكيد البريد: **Authentication** → **Providers** → **Email** → أوقف **Confirm email**. لن يُرسل بريد تأكيد وسيعمل التسجيل فوراً. للإنتاج يمكن استخدام **Custom SMTP** في Supabase أو الانتظار حتى يُعاد ضبط الحد.

### 4. تشغيل التطبيق

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) لصفحة التبرع، و `/login` لتسجيل الدخول، و `/dashboard` للوحة المسؤول بعد تسجيل الدخول.

## الصفحات

- **/** — صفحة التبرع (عامة): نموذج إرسال تبرع مع رفع صورة الحوالة واختيار المسؤول.
- **/login** — تسجيل الدخول (البريد + كلمة المرور).
- **/dashboard** — لوحة المسؤول (محمية): عرض التبرعات، فلترة حسب الشهر، إحصائيات، تصدير Excel.

## هيكل Supabase

- **الجداول**: `donations`، `admins` (انظر `supabase/schema.sql`).
- **التخزين**: bucket باسم `receipts` (عام) لصور الحوالات.

## التصدير إلى Excel

من لوحة المسؤول استخدم زر «تصدير إلى Excel» لتحميل ملف `donations.xlsx` بناءً على التبرعات المعروضة (بعد تطبيق فلتر الشهر إن وجد).

---

**هذا العمل من إنجاز المهندس محمد عماد حاج عيسى.**  
للاستفسارات: [+306970757123](tel:+306970757123)
