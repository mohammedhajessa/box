import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import CustomSelect from '@/components/CustomSelect';
import logoImg from '../img.png';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const CURRENCY_OPTIONS = [
  { value: 'usd', label: '$ دولار أمريكي' },
  { value: 'try', label: 'TR ليرة تركية' },
  { value: 'syp', label: 'ليرة سورية' },
];

function YouTubeIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.01 3.01 0 0 0-2.12-2.13C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.378.556A3.01 3.01 0 0 0 .502 6.186 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .502 5.814 3.01 3.01 0 0 0 2.12 2.13C4.495 20.5 12 20.5 12 20.5s7.505 0 9.378-.556a3.01 3.01 0 0 0 2.12-2.13A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.502-5.814ZM9.75 15.5v-7l6.5 3.5-6.5 3.5Z" />
    </svg>
  );
}

function FacebookIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06C2 17.08 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.196 2.238.196v2.476h-1.261c-1.242 0-1.63.776-1.63 1.572v1.886h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.08 22 12.06Z" />
    </svg>
  );
}

export default function DonationPage() {
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [thankModalOpen, setThankModalOpen] = useState(false);
  const [thankModalClosing, setThankModalClosing] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    donor_name: '',
    amount: '',
    currency: 'usd',
    receipt_file: null,
    admin_id: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    async function fetchAdmins() {
      try {
        const { data, error: err } = await supabase
          .from('admins')
          .select('id, user_id, display_name')
          .order('display_name');
        if (err) throw err;
        setAdmins(data || []);
      } catch (e) {
        setError('تعذر تحميل قائمة المسؤولين. يرجى المحاولة لاحقاً.');
      } finally {
        setLoadingAdmins(false);
      }
    }
    fetchAdmins();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'receipt_file') {
      setForm((prev) => ({ ...prev, receipt_file: e.target.files?.[0] ?? null }));
      setFieldErrors((prev) => ({ ...prev, receipt_file: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const err = {};
    if (!form.donor_name?.trim()) err.donor_name = 'يرجى إدخال اسم المتبرع';
    const amount = Number(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) err.amount = 'يرجى إدخال مبلغ صحيح أكبر من صفر';
    if (!form.receipt_file) err.receipt_file = 'يرجى رفع صورة الحوالة';
    else {
      if (!ACCEPTED_IMAGE_TYPES.includes(form.receipt_file.type)) err.receipt_file = 'نوع الملف غير مدعوم (JPEG، PNG، GIF أو WebP)';
      else if (form.receipt_file.size > MAX_FILE_SIZE) err.receipt_file = 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت';
    }
    if (!form.admin_id) err.admin_id = 'يرجى اختيار المسؤول';
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setFieldErrors({});
    if (!validate()) return;

    setSubmitting(true);
    try {
      const adminId = form.admin_id;
      const file = form.receipt_file;
      const path = `${adminId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
      const receipt_url = urlData?.publicUrl || '';

      const { error: insertError } = await supabase.rpc('submit_donation', {
        p_donor_name: form.donor_name.trim(),
        p_amount: Number(form.amount),
        p_currency: form.currency || 'usd',
        p_receipt_url: receipt_url || '',
        p_admin_id: adminId,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setThankModalOpen(true);
      setForm({ donor_name: '', amount: '', currency: form.currency, receipt_file: null, admin_id: form.admin_id });
    } catch (err) {
      const msg = err?.message || '';
      const isBucketNotFound = /bucket not found|Bucket not found|not found/i.test(msg);
      if (isBucketNotFound) {
        setError(
          'لم يتم العثور على مجلد التخزين (receipts). أنشئ bucket باسم «receipts» في Supabase: Storage → New bucket → الاسم: receipts → Public bucket مفعّل.'
        );
      } else {
        setError(msg || 'حدث خطأ، يرجى المحاولة لاحقاً.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const closeThankModal = () => {
    setThankModalClosing(true);
    setTimeout(() => {
      setThankModalOpen(false);
      setThankModalClosing(false);
    }, 220);
  };

  useEffect(() => {
    if (!thankModalOpen) return;
    const onEscape = (e) => { if (e.key === 'Escape') closeThankModal(); };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [thankModalOpen]);

  return (
    <>
      <Head>
        <title>وَقُلِ ٱعْمَلُواْ / للمساهمات الخيرية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 py-10 px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-300/20 blur-3xl" />
        </div>
        <div className="relative max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white">
              <Image src={logoImg} alt="شعار المؤسسة" className="w-full h-full object-cover" priority />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">وَقُلِ ٱعْمَلُواْ / للمساهمات الخيرية</h1>
            <p className="mt-2 text-slate-600 text-sm leading-6">أدخل بيانات التبرع وارفع صورة الحوالة</p>
          </div>

          <div className="mb-6 rounded-2xl bg-white/90 backdrop-blur border border-slate-200/80 shadow-sm p-6">
            <p className="text-slate-800 font-semibold mb-2">تخيَّل أن تعيش بالبركة في حياتك والأجور مضاعفة</p>
            <p className="text-sm text-slate-600 leading-6">
              ليس بصلاتك وصيامك وحجِّك فقط، بل بعطائك وصدقاتك. نضع بين يديك عشرات المشاريع الموصلة لرضى الله—اختر ما تحب وبالقدر الذي تستطيع.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://youtube.com/channel/UCs00mMatBCC8Z8vmkMVjOwA?si=dK4f9stQWBkccKP"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition"
              >
                <YouTubeIcon className="w-5 h-5" />
                <span>قناة YouTube</span>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61556229111666&mibextid=ZbWKwL"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition"
              >
                <FacebookIcon className="w-5 h-5" />
                <span>صفحة Facebook</span>
              </a>
            </div>

            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">
                المشاريع (اضغط للعرض)
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/9owRL9XZ4XU?si=fVvG3knXhFpQEZ4L" target="_blank" rel="noopener noreferrer">حملة توزيع مصاحف — فيديو 1</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/S14jUjNscAI?si=gMDB7GSkLi4SU59B" target="_blank" rel="noopener noreferrer">حملة توزيع مصاحف — فيديو 2</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/zpm4FyousOw?si=H8OpsPxCsHZ6G-I9" target="_blank" rel="noopener noreferrer">مشروع سقيا ماء</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/cH_QNFbHsLI?si=8qBfTsYi5U4x-cak" target="_blank" rel="noopener noreferrer">مشروع رغيف خبز</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/euVTnRRVDqE?si=sa-60vLM5gM2fwzJ" target="_blank" rel="noopener noreferrer">مشروع إطعام الطعام</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/RG_MB7X0m6g?si=zvWNS7XGsASz-DQ0" target="_blank" rel="noopener noreferrer">مشروع إكساء مسلم</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/9okT4lEeDAM?si=7AcUtQsbW9uyFVGk" target="_blank" rel="noopener noreferrer">مشروع إفطار صائم</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/2oyas6NX-6U?si=R9b1oZu0IwMIW0FA" target="_blank" rel="noopener noreferrer">حملة أضاحي العيد</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtube.com/watch?v=2nKLq-kv5c4&si=Tf4utyVDPkX0FIcM" target="_blank" rel="noopener noreferrer">توزيع زكاة الفطر</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/S_zvj1lwxmk?si=EcKrWbVFJSskTrlS" target="_blank" rel="noopener noreferrer">حملة الاستجابة الطارئة للكواثر (الزلزال)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/Wo2bn_HGMC4?si=7hINdtEoDeXkZ5FG" target="_blank" rel="noopener noreferrer">حملة (دفء الشتاء)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/F4GlIgULbNk?si=mJno3QIhSnGUvsPv" target="_blank" rel="noopener noreferrer">مبادرة (هدايا وعيديات العيد)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/z2Y47SeSHPs?si=BQZL0rJR_n1-fwKX" target="_blank" rel="noopener noreferrer">مبادرة (فرحة العيد حلاقة السنة)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/w9EgWdHZwzA?si=TNZyHzkg0RovnCSZ" target="_blank" rel="noopener noreferrer">مبادرة (افطار صائم لطلبة العلم)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/mjTptgeQMOg?si=mxRU8z8-96l7pdgC" target="_blank" rel="noopener noreferrer">مبادرة (توزيع عيديات الأطفال)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/cf8rl6Mxemo?si=8KzP06P8UVyKoRJB" target="_blank" rel="noopener noreferrer">من سنن المولود (العقيقة)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/ByRbaDHLu_Q?si=Tc_3nJGbiGzSMDhX" target="_blank" rel="noopener noreferrer">مبادرة (دفء الشتاء) لطلبة العلم</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/rs1p4inzKoc?si=J2AeVUSdLdkGo-uK" target="_blank" rel="noopener noreferrer">مبادرة (مسابقات رمضانية)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/1PA3F3k8Cn8?si=thFThH_EPMLuSSb8" target="_blank" rel="noopener noreferrer">كفارة يمين</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/_8eNZwL350Y?si=8nnKj58KRPqT2p5r" target="_blank" rel="noopener noreferrer">مبادرة (غرس شجرة)</a>
                <a className="block text-emerald-700 hover:underline" href="https://youtu.be/xG_aBkLJpxI?si=Xkmdt4Cn6mLUQH-K" target="_blank" rel="noopener noreferrer">حملة (ترميم معهد)</a>
              </div>
            </details>
          </div>

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 text-center border border-emerald-200 font-medium">
              تم إرسال التبرع بنجاح
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-center border border-red-100 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-5">
            <div>
              <label htmlFor="donor_name" className="block text-sm font-medium text-slate-700 mb-1.5">
              الاسم
              </label>
              <input
                id="donor_name"
                name="donor_name"
                type="text"
                value={form.donor_name}
                onChange={handleChange}
                placeholder="أدخل اسم المتبرع"
                className={`w-full px-4 py-2.5 rounded-xl border bg-white text-slate-800 placeholder-slate-400 transition ${fieldErrors.donor_name ? 'border-red-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'}`}
                disabled={submitting}
                aria-invalid={!!fieldErrors.donor_name}
                aria-describedby={fieldErrors.donor_name ? 'donor_name_error' : undefined}
              />
              {fieldErrors.donor_name && (
                <p id="donor_name_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                  {fieldErrors.donor_name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                  المبلغ
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="any"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="أدخل المبلغ"
                  className={`w-full px-4 py-2.5 rounded-xl border bg-white text-slate-800 placeholder-slate-400 transition ${
                    fieldErrors.amount ? 'border-red-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
                  }`}
                  disabled={submitting}
                  aria-invalid={!!fieldErrors.amount}
                  aria-describedby={fieldErrors.amount ? 'amount_error' : undefined}
                />
                {fieldErrors.amount && (
                  <p id="amount_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                    <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                    {fieldErrors.amount}
                  </p>
                )}
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="currency" className="block text-sm font-medium text-slate-700 mb-1.5">
                  العملة
                </label>
                <CustomSelect
                  id="currency"
                  name="currency"
                  value={form.currency}
                  onChange={(val) => handleChange({ target: { name: 'currency', value: val } })}
                  options={CURRENCY_OPTIONS}
                  placeholder="اختر العملة"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="receipt_file" className="block text-sm font-medium text-slate-700 mb-1.5">
                صورة الحوالة
              </label>
              <div className={`rounded-2xl border bg-white p-4 transition ${fieldErrors.receipt_file ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800">ارفع صورة واضحة للحوالة</p>
                    <p className="text-slate-500 mt-0.5">JPEG/PNG/GIF/WebP — حتى 5MB</p>
                  </div>
                  <label className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition ${
                    fieldErrors.receipt_file ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}>
                    اختر ملفاً
                    <input
                      id="receipt_file"
                      name="receipt_file"
                      type="file"
                      accept="image/*"
                      onChange={handleChange}
                      className="sr-only"
                      disabled={submitting}
                      aria-invalid={!!fieldErrors.receipt_file}
                      aria-describedby={fieldErrors.receipt_file ? 'receipt_file_error' : undefined}
                    />
                  </label>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  الملف المختار: <span className="font-medium text-slate-800">{form.receipt_file?.name || 'لم يتم اختيار ملف'}</span>
                </p>
              </div>
              {fieldErrors.receipt_file && (
                <p id="receipt_file_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                  {fieldErrors.receipt_file}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="admin_id" className="block text-sm font-medium text-slate-700 mb-1.5">
                اختيار المسؤول
              </label>
              <CustomSelect
                id="admin_id"
                name="admin_id"
                value={form.admin_id}
                onChange={(val) => handleChange({ target: { name: 'admin_id', value: val } })}
                options={admins.map((a) => ({ value: a.user_id, label: a.display_name || a.name || 'مسؤول' }))}
                placeholder={loadingAdmins ? 'جاري التحميل…' : 'اختر المسؤول'}
                disabled={submitting || loadingAdmins}
                hasError={!!fieldErrors.admin_id}
                aria-invalid={!!fieldErrors.admin_id}
                aria-describedby={fieldErrors.admin_id ? 'admin_id_error' : undefined}
              />
              {fieldErrors.admin_id && (
                <p id="admin_id_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                  {fieldErrors.admin_id}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || loadingAdmins}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
            >
              {submitting ? 'جاري الإرسال…' : 'إرسال التبرع'}
            </button>
          </form>

          {thankModalOpen && (
            <div
              className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 ${
                thankModalClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="شكراً لتبرعك"
              onClick={closeThankModal}
            >
              <div
                className={`relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden ${
                  thankModalClosing ? 'animate-modal-content-out' : 'animate-modal-content-in'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeThankModal}
                  className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                  aria-label="إغلاق"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white">
                      <Image src={logoImg} alt="شعار المؤسسة" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">جزاك الله خيراً</p>
                      <p className="text-sm text-slate-500">تم استلام تبرعك بنجاح. شكراً لثقتك ودعمك.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900 leading-6">
                    <span className="font-semibold">هل تريد مشاهدة أحدث المشاريع؟</span> اختر مشروعاً من الروابط أدناه.
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="https://youtube.com/channel/UCs00mMatBCC8Z8vmkMVjOwA?si=dK4f9stQWBkccKP"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition"
                    >
                      <YouTubeIcon className="w-5 h-5" />
                      <span>قناة YouTube</span>
                    </a>
                    <a
                      href="https://www.facebook.com/profile.php?id=61556229111666&mibextid=ZbWKwL"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition"
                    >
                      <FacebookIcon className="w-5 h-5" />
                      <span>صفحة Facebook</span>
                    </a>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-bold text-slate-900 mb-2">مشاريع حديثة</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/Wo2bn_HGMC4?si=7hINdtEoDeXkZ5FG" target="_blank" rel="noopener noreferrer">دفء الشتاء</a>
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/S_zvj1lwxmk?si=EcKrWbVFJSskTrlS" target="_blank" rel="noopener noreferrer">الاستجابة الطارئة (الزلزال)</a>
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/2oyas6NX-6U?si=R9b1oZu0IwMIW0FA" target="_blank" rel="noopener noreferrer">أضاحي العيد</a>
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/zpm4FyousOw?si=H8OpsPxCsHZ6G-I9" target="_blank" rel="noopener noreferrer">سقيا ماء</a>
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/euVTnRRVDqE?si=sa-60vLM5gM2fwzJ" target="_blank" rel="noopener noreferrer">إطعام الطعام</a>
                      <a className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-700" href="https://youtu.be/9okT4lEeDAM?si=7AcUtQsbW9uyFVGk" target="_blank" rel="noopener noreferrer">إفطار صائم</a>
                    </div>
                  </div>
                </div>

                <div className="px-6 sm:px-7 pb-6">
                  <button
                    type="button"
                    onClick={closeThankModal}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
