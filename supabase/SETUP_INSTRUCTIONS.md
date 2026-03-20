# إعداد Supabase (مشروع جديد)

استخدم **ملف واحد فقط** للقاعدة: `schema.sql`. باقي ملفات SQL القديمة تم حذفها.

## الخطوات

1. افتح مشروعك في [Supabase Dashboard](https://app.supabase.com).
2. من القائمة الجانبية اختر **SQL Editor**.
3. انسخ محتوى الملف **`schema.sql`** (في نفس مجلد supabase) والصقه في المحرر.
4. اضغط **Run** (أو Ctrl+Enter).

بعد التنفيذ بنجاح ستظهر الجداول `public.admins` و `public.donations` مع سياسات RLS. يمكنك بعدها استخدام التسجيل وتسجيل الدخول وصفحة التبرع.

## إنشاء bucket التخزين (صور الحوالات) — مطلوب لصفحة التبرع

بدون هذا الـ bucket ستظهر رسالة "Bucket not found" عند رفع صورة الحوالة.

1. في [Supabase Dashboard](https://app.supabase.com) اختر مشروعك.
2. من القائمة الجانبية: **Storage**.
3. اضغط **New bucket**.
4. **Name:** اكتب بالضبط: `receipts` (بدون تغيير الحروف).
5. فعّل **Public bucket** (مهم لظهور روابط الصور).
6. اضغط **Create bucket**.

### السماح برفع الملفات (للمتبرعين بدون حساب)

1. بعد إنشاء الـ bucket اضغط على اسم **receipts** لفتحه.
2. ادخل إلى **Policies** (أو **New policy**).
3. **New policy** → **For full customization** (أو استخدم القالب المناسب).
4. Policy name: `Allow public uploads`
5. **Allowed operation:** اختر **INSERT** (INSERT فقط كافٍ للرفع).
6. **Target roles:** اختر `anon` (لأن صفحة التبرع عامة ولا يتسجل الدخول المستخدم).
7. **Policy definition:** استخدم شرط بسيط مثل `true` (أو اترك الافتراضي إن كان يسمح بالرفع).
8. احفظ السياسة.

بعد ذلك جرّب رفع صورة من صفحة التبرع مرة أخرى.

---

## إذا ظهرت: «new row violates row-level security policy» عند التبرع

1. نفّذ **`supabase/fix_donation_rls.sql`** (سياسات التبرع والتخزين).  
2. ثم نفّذ **`supabase/submit_donation_rpc.sql`** — التطبيق يستخدم دالة `submit_donation` لحفظ التبرع وتتجاوز مشاكل RLS على الجدول.
