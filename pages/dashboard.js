import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import CustomSelect from '@/components/CustomSelect';
import logoImg from '../img.png';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CURRENCY_LABELS = { usd: '$', try: 'TR', syp: 'جنيه سوري' };
function getCurrencyLabel(code) {
  return CURRENCY_LABELS[code] || code || '—';
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [adminName, setAdminName] = useState('');
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc | date_asc | name_asc | name_desc | amount_desc | amount_asc
  const EXPORT_FIELD_OPTIONS = [
    { key: 'donor_name', label: 'الاسم' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'currency', label: 'العملة' },
    { key: 'receipt', label: 'صورة الحوالة' },
    { key: 'date', label: 'التاريخ' },
  ];
  const [exportFields, setExportFields] = useState({
    donor_name: true,
    amount: true,
    currency: true,
    receipt: true,
    date: true,
  });
  const [exportModalType, setExportModalType] = useState(null); // 'excel' | 'pdf' | null
  const [imageModalUrl, setImageModalUrl] = useState(null);
  const [modalClosing, setModalClosing] = useState(false);
  const toggleExportField = (key) => {
    setExportFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const closeImageModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setImageModalUrl(null);
      setModalClosing(false);
    }, 220);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) {
        router.replace('/login');
        setLoading(false);
        return;
      }
    });
  }, [router]);

  useEffect(() => {
    if (!session?.user?.id) return;
    async function fetchAdminName() {
      try {
        const metaName =
          session?.user?.user_metadata?.display_name ||
          session?.user?.user_metadata?.name ||
          '';
        if (metaName) {
          setAdminName(metaName);
          return;
        }
        const { data, error: err } = await supabase
          .from('admins')
          .select('display_name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (err) throw err;
        setAdminName(data?.display_name || '');
      } catch {
        setAdminName('');
      }
    }
    async function fetchDonations() {
      setLoading(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('donations')
          .select('id, donor_name, amount, currency, receipt_url, created_at')
          .eq('admin_id', session.user.id)
          .order('created_at', { ascending: false });
        if (err) throw err;
        setDonations(data || []);
      } catch (e) {
        setError('تعذر تحميل التبرعات. يرجى المحاولة لاحقاً.');
      } finally {
        setLoading(false);
      }
    }
    fetchAdminName();
    fetchDonations();
  }, [session?.user?.id]);

  const filteredDonations = (() => {
    let list = donations;
    if (monthFilter) {
      list = list.filter((d) => d.created_at?.slice(0, 7) === monthFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const name = (d.donor_name || '').toLowerCase();
        const amountStr = String(Number(d.amount) || '').toLowerCase();
        return name.includes(q) || amountStr.includes(q);
      });
    }
    // Sort
    const nameA = (a) => (a.donor_name || '').trim().toLowerCase();
    const amountN = (a) => Number(a.amount) || 0;
    const dateN = (a) => new Date(a.created_at || 0).getTime();
    if (sortBy === 'date_desc') list = [...list].sort((a, b) => dateN(b) - dateN(a));
    else if (sortBy === 'date_asc') list = [...list].sort((a, b) => dateN(a) - dateN(b));
    else if (sortBy === 'name_asc') list = [...list].sort((a, b) => nameA(a).localeCompare(nameA(b), 'ar'));
    else if (sortBy === 'name_desc') list = [...list].sort((a, b) => nameA(b).localeCompare(nameA(a), 'ar'));
    else if (sortBy === 'amount_desc') list = [...list].sort((a, b) => amountN(b) - amountN(a));
    else if (sortBy === 'amount_asc') list = [...list].sort((a, b) => amountN(a) - amountN(b));
    return list;
  })();

  useEffect(() => {
    if (!imageModalUrl) return;
    const onEscape = (e) => { if (e.key === 'Escape') closeImageModal(); };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [imageModalUrl]);

  const hasActiveFilters = Boolean(monthFilter || searchQuery.trim());
  const clearFilters = () => {
    setMonthFilter('');
    setSearchQuery('');
  };

  const totalAmount = filteredDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const donorCount = new Set(filteredDonations.map((d) => d.donor_name?.trim()).filter(Boolean)).size;
  const months = [...new Set(donations.map((d) => d.created_at?.slice(0, 7)).filter(Boolean))].sort().reverse();

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const selected = EXPORT_FIELD_OPTIONS.filter((f) => exportFields[f.key]);
      if (selected.length === 0) {
        setError('اختر حقل واحد على الأقل للتصدير.');
        setExporting('');
        return;
      }
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('تبرعات', { views: [{ rightToLeft: true }] });
      const colConfig = {
        donor_name: { header: 'الاسم', key: 'donor_name', width: 22 },
        amount: { header: 'المبلغ', key: 'amount', width: 14 },
        currency: { header: 'العملة', key: 'currency', width: 14 },
        receipt: { header: 'صورة الحوالة', key: 'receipt', width: 18 },
        date: { header: 'التاريخ', key: 'date', width: 20 },
      };
      ws.columns = selected.map((f) => colConfig[f.key]);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0F4' } };

      for (const d of filteredDonations) {
        const row = {};
        if (exportFields.donor_name) row.donor_name = d.donor_name || '—';
        if (exportFields.amount) row.amount = Number(d.amount) || 0;
        if (exportFields.currency) row.currency = getCurrencyLabel(d.currency);
        if (exportFields.receipt) row.receipt = d.receipt_url ? 'رابط' : '—';
        if (exportFields.date) row.date = formatDate(d.created_at);
        ws.addRow(row);
      }
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'donations.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError('تعذر تصدير Excel. يرجى المحاولة لاحقاً.');
    } finally {
      setExporting('');
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const selected = EXPORT_FIELD_OPTIONS.filter((f) => exportFields[f.key]);
      if (selected.length === 0) {
        setError('اختر حقل واحد على الأقل للتصدير.');
        setExporting('');
        return;
      }
      const headers = selected.map((f) => `<th style="padding:10px;text-align:right;border:1px solid #ddd;">${f.label}</th>`).join('');
      const cell = (d, key) => {
        if (key === 'donor_name') return (d.donor_name || '—').replace(/</g, '&lt;');
        if (key === 'amount') return Number(d.amount).toLocaleString('ar-EG');
        if (key === 'currency') return getCurrencyLabel(d.currency);
        if (key === 'receipt') return d.receipt_url ? 'رابط' : '—';
        if (key === 'date') return formatDate(d.created_at);
        return '—';
      };
      const rows = filteredDonations.map((d) => `
        <tr style="background:#f8fafc;">
          ${selected.map((f) => `<td style="padding:8px;text-align:right;border:1px solid #ddd;">${cell(d, f.key)}</td>`).join('')}
        </tr>
      `).join('');

      const html2canvas = (await import('html2canvas')).default;
      const div = document.createElement('div');
      div.dir = 'rtl';
      div.lang = 'ar';
      const reportDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const periodText = monthFilter
        ? new Date(monthFilter + '-01').toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })
        : '';
      div.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;padding:24px;background:#fff;font-family:Segoe UI,Tahoma,sans-serif;font-size:14px;';
      div.innerHTML = `
        <h1 style="text-align:center;font-size:18px;margin:0 0 8px;color:#0f172a;">تقرير التبرعات</h1>
        <p style="text-align:center;margin:0 0 16px;color:#64748b;font-size:13px;">تاريخ التقرير: ${reportDate}${periodText ? ' &nbsp;|&nbsp; الفترة: ' + periodText : ''}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#2980b9;color:#fff;">${headers}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      document.body.appendChild(div);
      const canvas = await html2canvas(div, { scale: 2, useCORS: true, logging: false });
      document.body.removeChild(div);
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      let imgW = (canvas.width * maxH) / canvas.height;
      let imgH = maxH;
      if (imgW > maxW) {
        imgW = maxW;
        imgH = (canvas.height * maxW) / canvas.width;
      }
      doc.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
      doc.save('donations.pdf');
    } catch (e) {
      setError('تعذر تصدير PDF. يرجى المحاولة لاحقاً.');
    } finally {
      setExporting('');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!session && !loading) return null;

  return (
    <>
      <Head>
        <title>لوحة المسؤول</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="bg-slate-50 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white">
                <Image src={logoImg} alt="شعار المؤسسة" className="w-full h-full object-cover" />
              </div>
              <div className="leading-tight">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">لوحة المسؤول</h1>
                {adminName && <p className="mt-1 text-sm text-slate-500">مرحباً، {adminName}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition"
              >
                تسجيل الخروج
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm text-center border border-red-100">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-12 text-center text-slate-500">
              <div className="inline-block w-8 h-8 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <p>جاري التحميل…</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
                  <p className="text-sm text-slate-500 mb-1">إجمالي التبرعات</p>
                  <p className="text-2xl font-bold text-slate-800">{totalAmount.toLocaleString('ar-EG')}</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
                  <p className="text-sm text-slate-500 mb-1">عدد المتبرعين</p>
                  <p className="text-2xl font-bold text-slate-800">{donorCount}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-semibold text-slate-800">الفلاتر والبحث</h2>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm text-slate-500 hover:text-slate-700 underline"
                    >
                      مسح الفلاتر
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="search_donors" className="block text-sm font-medium text-slate-700 mb-1.5">
                      بحث (الاسم أو المبلغ)
                    </label>
                    <input
                      id="search_donors"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث بالاسم أو المبلغ..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                      aria-label="بحث بالاسم أو المبلغ"
                    />
                  </div>
                  <div>
                    <label htmlFor="month_filter" className="block text-sm font-medium text-slate-700 mb-1.5">
                      الشهر
                    </label>
                    <CustomSelect
                      id="month_filter"
                      value={monthFilter}
                      onChange={setMonthFilter}
                      options={months.map((m) => ({ value: m, label: m }))}
                      placeholder="كل الأشهر"
                    />
                  </div>
                  <div>
                    <label htmlFor="sort_by" className="block text-sm font-medium text-slate-700 mb-1.5">
                      الترتيب
                    </label>
                    <CustomSelect
                      id="sort_by"
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { value: 'date_desc', label: 'الأحدث تاريخاً' },
                        { value: 'date_asc', label: 'الأقدم تاريخاً' },
                        { value: 'name_asc', label: 'الاسم (أ–ي)' },
                        { value: 'name_desc', label: 'الاسم (ي–أ)' },
                        { value: 'amount_desc', label: 'المبلغ (الأعلى أولاً)' },
                        { value: 'amount_asc', label: 'المبلغ (الأقل أولاً)' },
                      ]}
                      placeholder="الترتيب"
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    {hasActiveFilters
                      ? `عرض ${filteredDonations.length} من ${donations.length} تبرع`
                      : `إجمالي ${filteredDonations.length} تبرع`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExportModalType('excel')}
                      disabled={!!exporting}
                      className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {exporting === 'excel' ? 'جاري التصدير…' : 'تصدير Excel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportModalType('pdf')}
                      disabled={!!exporting}
                      className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition"
                    >
                      {exporting === 'pdf' ? 'جاري التصدير…' : 'تصدير PDF'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">الاسم</th>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">المبلغ</th>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">العملة</th>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">صورة الحوالة</th>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDonations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                            لا توجد تبرعات
                          </td>
                        </tr>
                      ) : (
                        filteredDonations.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-5 py-3.5 text-sm text-slate-800">{d.donor_name || '—'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-800 font-medium">{Number(d.amount).toLocaleString('ar-EG')}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700">{getCurrencyLabel(d.currency)}</td>
                            <td className="px-5 py-3.5 text-sm">
                              {d.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => setImageModalUrl(d.receipt_url)}
                                  className="text-emerald-600 hover:underline font-medium"
                                >
                                  عرض
                                </button>
                              ) : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-slate-700">{formatDate(d.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredDonations.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-500">لا توجد تبرعات</div>
                  ) : (
                    filteredDonations.map((d) => (
                      <div key={d.id} className="p-5">
                        <p className="font-semibold text-slate-800">{d.donor_name || '—'}</p>
                        <p className="text-sm text-slate-600 mt-0.5">المبلغ: {Number(d.amount).toLocaleString('ar-EG')} {getCurrencyLabel(d.currency)}</p>
                        <p className="text-sm text-slate-600">التاريخ: {formatDate(d.created_at)}</p>
                        {d.receipt_url && (
                          <button
                            type="button"
                            onClick={() => setImageModalUrl(d.receipt_url)}
                            className="inline-block mt-2 text-sm text-emerald-600 font-medium"
                          >
                            صورة الحوالة — عرض
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {exportModalType && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 animate-modal-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-label="إعدادات التصدير"
          onClick={() => setExportModalType(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-5 animate-modal-content-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-800">الحقول في التصدير</h2>
              <button
                type="button"
                onClick={() => setExportModalType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
                aria-label="إغلاق"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">اختر الأعمدة التي تريد تضمينها في الملف.</p>
            <div className="flex flex-wrap gap-3 mb-4">
              {EXPORT_FIELD_OPTIONS.map((f) => (
                <label key={f.key} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!exportFields[f.key]}
                    onChange={() => toggleExportField(f.key)}
                    className="w-4 h-4 rounded border-slate-300 accent-emerald-600 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-700">{f.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportModalType(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (exportModalType === 'excel') {
                    handleExportExcel();
                  } else if (exportModalType === 'pdf') {
                    handleExportPDF();
                  }
                  setExportModalType(null);
                }}
                className="py-2 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
              >
                {exportModalType === 'excel' ? 'تصدير Excel' : 'تصدير PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModalUrl && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 ${modalClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`}
          role="dialog"
          aria-modal="true"
          aria-label="صورة الحوالة"
          onClick={closeImageModal}
        >
          <div
            className={`relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center bg-white rounded-2xl shadow-xl overflow-hidden ${modalClosing ? 'animate-modal-content-out' : 'animate-modal-content-in'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeImageModal}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
              aria-label="إغلاق"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={imageModalUrl}
              alt="صورة الحوالة"
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            />
            <a
              href={imageModalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 left-3 right-3 sm:left-auto sm:w-auto py-2 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium text-center hover:bg-emerald-700 transition"
            >
              فتح في نافذة جديدة
            </a>
          </div>
        </div>
      )}
    </>
  );
}
