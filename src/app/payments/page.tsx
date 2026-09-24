'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  WalletCards, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus, 
  Send, 
  X, 
  Users, 
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Pencil,
  Trash2
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  subject: string;
}

interface Student {
  id: string;
  full_name: string;
  parent_phone?: string;
  group_id?: string;
  groups?: Group;
}

interface PaymentRecord {
  id: string;
  student_id: string;
  expected_amount: number;
  status: 'PAID' | 'PENDING';
  billing_period: string;
  paid_at?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  students?: Student;
}

const getMonthKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatArabicMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // اختيار الشهر
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthKey(new Date()));

  // الفلاتر
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // نافذة الإضافة
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentGroupId, setNewStudentGroupId] = useState('');
  const [newPaymentAmount, setNewPaymentAmount] = useState('300');
  const [newPaymentStatus, setNewPaymentStatus] = useState<'PAID' | 'PENDING'>('PENDING');
  const [submitting, setSubmitting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  // نافذة تعديل بيانات الطالب
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  useEffect(() => {
    fetchPaymentsData();
  }, [selectedMonth]);

  const fetchPaymentsData = async () => {
    setLoading(true);
    try {
      const { data: groupsData } = await supabase.from('groups').select('id, name, subject').order('name');
      if (groupsData) {
        setGroups(groupsData);
        if (groupsData.length > 0 && !newStudentGroupId) setNewStudentGroupId(groupsData[0].id);
      }

      const { data: paymentsData, error } = await supabase
        .from('monthly_payments')
        .select(`
          id,
          student_id,
          expected_amount,
          status,
          billing_period,
          paid_at,
          payment_method,
          notes,
          students (
            id,
            full_name,
            parent_phone,
            group_id,
            groups (
              id,
              name,
              subject
            )
          )
        `)
        .eq('billing_period', selectedMonth)
        .order('id', { ascending: false });

      if (error) throw error;
      setPayments((paymentsData as any) || []);
    } catch (err: any) {
      console.error('خطأ في تحميل المدفوعات:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (direction: 'next' | 'prev') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const currentDate = new Date(year, month - 1, 1);
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(getMonthKey(currentDate));
  };

  const togglePaymentStatus = async (paymentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    const paidAtDate = nextStatus === 'PAID' ? new Date().toISOString().split('T')[0] : null;

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, status: nextStatus, paid_at: paidAtDate } : p
      )
    );

    try {
      const { error } = await supabase
        .from('monthly_payments')
        .update({
          status: nextStatus,
          paid_at: paidAtDate,
        })
        .eq('id', paymentId);

      if (error) throw error;
    } catch (err: any) {
      alert('تعذر تحديث الحالة: ' + err.message);
      fetchPaymentsData();
    }
  };

  // حذف اشتراك هذا الشهر فقط
  const handleDeleteOnlyPayment = async (paymentId: string) => {
    if (!confirm('هل تريد حذف اشتراك هذا الطالب لهذا الشهر فقط؟')) return;
    try {
      const { error } = await supabase.from('monthly_payments').delete().eq('id', paymentId);
      if (error) throw error;
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err: any) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  // حذف الطالب نهائياً من قاعدة البيانات (مع كل مدفوعاته)
  const handleDeleteStudentEntirely = async (studentId: string, studentName: string) => {
    const confirmDelete = confirm(
      `تحذير: هل أنت متأكد من حذف الطالب (${studentName}) نهائياً من النظام؟\nسيتم حذف الطالب وجميع فواتيره من قاعدة البيانات ولن يظهر في أي شهر قادم.`
    );
    if (!confirmDelete) return;

    try {
      // 1. حذف مدفوعات الطالب أولاً لتجنب مشاكل القيود
      await supabase.from('monthly_payments').delete().eq('student_id', studentId);
      // 2. حذف الطالب من جدول students
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;

      alert(`تم حذف الطالب (${studentName}) بنجاح.`);
      setPayments((prev) => prev.filter((p) => p.student_id !== studentId));
    } catch (err: any) {
      alert('حدث خطأ أثناء حذف الطالب: ' + err.message);
    }
  };

  // فتح نافذة تعديل بيانات الطالب
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditFullName(student.full_name || '');
    setEditPhone(student.parent_phone || '');
    setEditGroupId(student.group_id || '');
  };

  // حفظ التعديلات على بيانات الطالب
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setIsUpdatingStudent(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          full_name: editFullName.trim(),
          parent_phone: editPhone.trim() || null,
          group_id: editGroupId || null,
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      // تحديث البيانات محلياً
      const updatedGroupName = groups.find((g) => g.id === editGroupId)?.name || '';
      const updatedGroupSub = groups.find((g) => g.id === editGroupId)?.subject || '';

      setPayments((prev) =>
        prev.map((p) => {
          if (p.student_id === editingStudent.id && p.students) {
            return {
              ...p,
              students: {
                ...p.students,
                full_name: editFullName.trim(),
                parent_phone: editPhone.trim() || undefined,
                group_id: editGroupId,
                groups: {
                  id: editGroupId,
                  name: updatedGroupName,
                  subject: updatedGroupSub,
                },
              },
            };
          }
          return p;
        })
      );

      setEditingStudent(null);
    } catch (err: any) {
      alert('خطأ أثناء تحديث بيانات الطالب: ' + err.message);
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  // ترحيل وتجديد الاشتراكات للشهر المختار
  const handleAutoRenewMonth = async () => {
    const monthName = formatArabicMonth(selectedMonth);
    if (!confirm(`هل تريد توليد اشتراكات شهر (${monthName}) لجميع الطلاب الحاليين؟`)) return;

    setIsRenewing(true);
    try {
      const { data: allStudents, error: studentsErr } = await supabase
        .from('students')
        .select('id, full_name');

      if (studentsErr) throw studentsErr;
      if (!allStudents || allStudents.length === 0) {
        alert('لا يوجد طلاب مسجلون حتى الآن.');
        setIsRenewing(false);
        return;
      }

      const existingStudentIds = new Set(payments.map((p) => p.student_id));
      const studentsToRenew = allStudents.filter((s) => !existingStudentIds.has(s.id));

      if (studentsToRenew.length === 0) {
        alert(`جميع الطلاب (${allStudents.length}) لديهم اشتراكات مسجلة بالفعل لشهر ${monthName}.`);
        setIsRenewing(false);
        return;
      }

      const { data: recentPayments } = await supabase
        .from('monthly_payments')
        .select('student_id, expected_amount')
        .order('id', { ascending: false });

      const lastAmountMap = new Map<string, number>();
      recentPayments?.forEach((p) => {
        if (!lastAmountMap.has(p.student_id)) {
          lastAmountMap.set(p.student_id, Number(p.expected_amount));
        }
      });

      const newRecords = studentsToRenew.map((student) => ({
        student_id: student.id,
        expected_amount: lastAmountMap.get(student.id) || 300,
        status: 'PENDING',
        billing_period: selectedMonth,
        paid_at: null,
      }));

      const { error: insertErr } = await supabase.from('monthly_payments').insert(newRecords);
      if (insertErr) throw insertErr;

      alert(`تم بنجاح توليد اشتراكات (${studentsToRenew.length}) طالب لشهر ${monthName}!`);
      fetchPaymentsData();
    } catch (err: any) {
      alert('حدث خطأ أثناء التجديد: ' + err.message);
    } finally {
      setIsRenewing(false);
    }
  };

  const sendWhatsAppReminder = (studentName: string, phone?: string, amount?: number) => {
    if (!phone) {
      alert('رقم هاتف الطالب أو ولي الأمر غير مسجل.');
      return;
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '2' + cleanPhone;

    const message = encodeURIComponent(
      `السلام عليكم ورحمة الله، تذكير باشتراك درس (${studentName}) لشهر ${formatArabicMonth(selectedMonth)} بقيمة ${amount || 0} ج.م. شاكرين لحسن تعاونكم معنا.`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentGroupId) {
      alert('يرجى كتابة اسم الطالب واختيار المجموعة');
      return;
    }

    setSubmitting(true);
    try {
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .insert([
          {
            full_name: newStudentName.trim(),
            parent_phone: newStudentPhone.trim() || null,
            group_id: newStudentGroupId,
          },
        ])
        .select()
        .single();

      if (studentErr) throw studentErr;

      const isPaidNow = newPaymentStatus === 'PAID';
      const { data: paymentRecord, error: payErr } = await supabase
        .from('monthly_payments')
        .insert([
          {
            student_id: studentData.id,
            expected_amount: Number(newPaymentAmount) || 0,
            status: newPaymentStatus,
            billing_period: selectedMonth,
            paid_at: isPaidNow ? new Date().toISOString().split('T')[0] : null,
          },
        ])
        .select(`
          id,
          student_id,
          expected_amount,
          status,
          billing_period,
          paid_at,
          payment_method,
          notes,
          students (
            id,
            full_name,
            parent_phone,
            group_id,
            groups (
              id,
              name,
              subject
            )
          )
        `)
        .single();

      if (payErr) throw payErr;

      setPayments((prev) => [paymentRecord as any, ...prev]);
      setIsModalOpen(false);

      setNewStudentName('');
      setNewStudentPhone('');
      setNewPaymentAmount('300');
    } catch (err: any) {
      alert('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCollected = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + (Number(p.expected_amount) || 0), 0);

  const totalPending = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + (Number(p.expected_amount) || 0), 0);

  const paidCount = payments.filter((p) => p.status === 'PAID').length;

  const filteredPayments = payments.filter((p) => {
    const studentName = p.students?.full_name?.toLowerCase() || '';
    const matchesSearch = studentName.includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchesGroup = selectedGroupId === 'all' || p.students?.group_id === selectedGroupId;

    return matchesSearch && matchesStatus && matchesGroup;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32 pt-8 px-4 sm:px-6 max-w-4xl mx-auto">
      
      {/* الترويسة الرئيسية */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <WalletCards size={16} />
            <span>الماليات والتحصيل</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">إدارة الاشتراكات</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoRenewMonth}
            disabled={isRenewing}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 active:scale-95 text-zinc-200 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition"
            title="توليد اشتراكات الطلاب لهذا الشهر تلقائياً"
          >
            <RefreshCw size={15} className={isRenewing ? 'animate-spin text-amber-400' : 'text-amber-400'} />
            <span>تجديد الشهر</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus size={18} />
            <span>إضافة طالب</span>
          </button>
        </div>
      </header>

      {/* محدد الشهر */}
      <section className="mb-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 flex items-center justify-between">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition"
          title="الشهر السابق"
        >
          <ChevronRight size={20} />
        </button>

        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-200">
          <Calendar size={18} className="text-indigo-400" />
          <span>{formatArabicMonth(selectedMonth)}</span>
          {selectedMonth === getMonthKey(new Date()) && (
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium">
              الحالي
            </span>
          )}
        </div>

        <button
          onClick={() => changeMonth('next')}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition"
          title="الشهر التالي"
        >
          <ChevronLeft size={20} />
        </button>
      </section>

      {/* 1. كروت الإحصائيات */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">تم تحصيله</p>
            <p className="text-xl font-bold text-zinc-100">
              {totalCollected.toLocaleString()} <span className="text-xs font-normal text-zinc-400">ج.م</span>
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">مبالغ معلقة</p>
            <p className="text-xl font-bold text-zinc-100">
              {totalPending.toLocaleString()} <span className="text-xs font-normal text-zinc-400">ج.م</span>
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">الطلاب المسددون</p>
            <p className="text-xl font-bold text-zinc-100">
              {paidCount} <span className="text-xs font-normal text-zinc-500">من {payments.length}</span>
            </p>
          </div>
        </div>
      </section>

      {/* 2. شريط البحث والتصفية */}
      <section className="space-y-3 mb-6">
        <div className="relative">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="بحث باسم الطالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === 'ALL' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400'
              }`}
            >
              الكل ({payments.length})
            </button>
            <button
              onClick={() => setFilterStatus('PAID')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === 'PAID' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400'
              }`}
            >
              مدفوع
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === 'PENDING' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400'
              }`}
            >
              معلق
            </button>
          </div>

          {groups.length > 0 && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">جميع المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* 3. قائمة سجلات الاشتراكات مع خيارات التعديل والحذف */}
      <section>
        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
            <div className="h-20 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800/80 p-10 text-center bg-zinc-900/20">
            <WalletCards size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-zinc-400">
              لا توجد اشتراكات مسجلة لشهر {formatArabicMonth(selectedMonth)}
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              اضغط على زر <span className="text-amber-400 font-semibold">"تجديد الشهر"</span> في الأعلى لتوليد اشتراكات الطلاب تلقائياً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((record) => {
              const isPaid = record.status === 'PAID';

              return (
                <div
                  key={record.id}
                  className={`bg-zinc-900/60 border rounded-2xl p-4 flex items-center justify-between transition-all ${
                    isPaid ? 'border-zinc-800/80' : 'border-amber-500/20 bg-amber-950/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* زر التبديل السريع لحالة الدفع */}
                    <button
                      onClick={() => togglePaymentStatus(record.id, record.status)}
                      className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                        isPaid
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-amber-400'
                      }`}
                      title={isPaid ? 'اضغط للتحويل إلى معلق' : 'اضغط للتأكيد كمدفوع'}
                    >
                      <CheckCircle2 size={20} />
                    </button>

                    <div>
                      <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                        {record.students?.full_name || 'طالب غير مسمى'}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isPaid ? 'تم الدفع' : 'معلق'}
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {record.students?.groups?.name || 'بدون مجموعة'} •{' '}
                        <span className="font-mono text-zinc-300 font-semibold">{record.expected_amount} ج.م</span>
                      </p>
                    </div>
                  </div>

                  {/* أزرار الإجراءات السريعة (واتساب، تعديل، حذف) */}
                  <div className="flex items-center gap-1.5">
                    {/* زر واتساب */}
                    {record.students?.parent_phone && !isPaid && (
                      <button
                        onClick={() =>
                          sendWhatsAppReminder(
                            record.students?.full_name || '',
                            record.students?.parent_phone,
                            record.expected_amount
                          )
                        }
                        className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs transition active:scale-95"
                        title="إرسال تذكير عبر واتساب"
                      >
                        <Send size={15} />
                      </button>
                    )}

                    {/* زر تعديل بيانات الطالب */}
                    {record.students && (
                      <button
                        onClick={() => openEditModal(record.students!)}
                        className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl transition active:scale-95"
                        title="تعديل بيانات الطالب"
                      >
                        <Pencil size={15} />
                      </button>
                    )}

                    {/* زر الحذف الذكي */}
                    <button
                      onClick={() => {
                        const choice = prompt(
                          `خيارات الحذف للطالب (${record.students?.full_name}):\n\n1: حذف اشتراك هذا الشهر فقط.\n2: حذف الطالب نهائياً من قاعدة البيانات.\n\nاكتب 1 أو 2 ثم اضغط OK:`
                        );
                        if (choice === '1') {
                          handleDeleteOnlyPayment(record.id);
                        } else if (choice === '2') {
                          handleDeleteStudentEntirely(
                            record.student_id,
                            record.students?.full_name || 'طالب'
                          );
                        }
                      }}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition active:scale-95"
                      title="حذف الاشتراك أو حذف الطالب"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. نافذة تعديل بيانات الطالب (Edit Modal) */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-zinc-100 mb-1">تعديل بيانات الطالب</h3>
            <p className="text-xs text-zinc-400 mb-4">تعديل بيانات الطالب ومجموعته المسجل بها.</p>

            <form onSubmit={handleSaveStudentEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم الطالب</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">رقم هاتف ولي الأمر</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">المجموعة</label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">بدون مجموعة</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isUpdatingStudent}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25"
                >
                  {isUpdatingStudent ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. نافذة إضافة طالب واشتراك جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-zinc-100 mb-1">تسجيل طالب واشتراك جديد</h3>
            <p className="text-xs text-zinc-400 mb-5">
              سيتم تسجيل الاشتراك لشهر ({formatArabicMonth(selectedMonth)}).
            </p>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم الطالب</label>
                <input
                  type="text"
                  placeholder="مثال: يوسف أحمد"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">رقم هاتف ولي الأمر (واتساب)</label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">المجموعة</label>
                {groups.length === 0 ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertCircle size={14} /> يرجى إنشاء مجموعة أولاً من صفحة الجدول.
                  </p>
                ) : (
                  <select
                    value={newStudentGroupId}
                    onChange={(e) => setNewStudentGroupId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.subject})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">مبلغ الاشتراك (ج.م)</label>
                  <input
                    type="number"
                    value={newPaymentAmount}
                    onChange={(e) => setNewPaymentAmount(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">حالة الدفع</label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PENDING">معلق (لم يدفع)</option>
                    <option value="PAID">تم الدفع</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || groups.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25"
                >
                  {submitting ? 'جاري التسجيل...' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
