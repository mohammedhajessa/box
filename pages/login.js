import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const err = {};
    if (!email.trim()) err.email = 'يرجى إدخال البريد الإلكتروني';
    if (!password) err.password = 'يرجى إدخال كلمة المرور';
    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      router.push('/dashboard');
      router.replace('/dashboard');
    } catch (err) {
      const msg = err?.message || '';
      const isNetworkError = msg === 'Failed to fetch' || err?.name === 'TypeError';
      const isRateLimit = /rate limit|rate_limit|too many requests/i.test(msg);
      if (isNetworkError) {
        setError(
          'تعذر الاتصال بالخادم. تأكد من إعداد ملف .env.local بقيم Supabase الصحيحة ثم أعد تشغيل التطبيق (npm run dev).'
        );
      } else if (isRateLimit) {
        setError(
          'تم تجاوز حد إرسال البريد. أوقف تأكيد البريد في Supabase (Authentication → Providers → Email) أو انتظر ثم حاول مرة أخرى.'
        );
      } else {
        setError(msg || 'البريد أو كلمة المرور غير صحيحة.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>تسجيل الدخول</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-[80vh] bg-slate-50 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">تسجيل الدخول</h1>
            <p className="mt-2 text-slate-600 text-sm">لوحة المسؤولين</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-center border border-red-100 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="أدخل البريد الإلكتروني"
                className={`w-full px-4 py-2.5 rounded-xl border bg-white text-slate-800 placeholder-slate-400 transition ${
                  fieldErrors.email ? 'border-red-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
                }`}
                disabled={loading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email_error' : undefined}
              />
              {fieldErrors.email && (
                <p id="email_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="أدخل كلمة المرور"
                className={`w-full px-4 py-2.5 rounded-xl border bg-white text-slate-800 placeholder-slate-400 transition ${
                  fieldErrors.password ? 'border-red-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'
                }`}
                disabled={loading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password_error' : undefined}
              />
              {fieldErrors.password && (
                <p id="password_error" className="mt-1.5 text-sm text-red-600 flex items-center gap-1" role="alert">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">!</span>
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
            >
              {loading ? 'جاري تسجيل الدخول…' : 'تسجيل الدخول'}
            </button>
          </form>

          
        </div>
      </div>
    </>
  );
}
