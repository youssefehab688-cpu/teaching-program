'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Plus, 
  FolderPlus, 
  UserPlus, 
  Trash2, 
  Pencil, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Send,
  UserCheck
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  subject: string;
}

interface Student {
  id: string;
  full_name: string;
  parent_phone?: string | null;
  group_id: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // نوافذ المودال
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');

  // نافذة إضافة طالب واحد
  const [isSingleStudentModalOpen, setIsSingleStudentModalOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [singleStudentName, setSingleStudentName] = useState('');
  const [singleStudentPhone, setSingleStudentPhone] = useState('');
  const [singleStudentAmount, setSingleStudentAmount] = useState('300');

  // نافذة الإضافة الجماعية لعدة طلاب معاً (Bulk Add)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkNamesText, setBulkNamesText] = useState('');
  const [bulkAmount, setBulkAmount] = useState('300');

  // نافذة تعديل بيانات الطالب
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');
  const [editStudentGroupId, setEditStudentGroupId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const currentBillingPeriod = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: groupsData, error: groupsErr }, { data: studentsData, error: studentsErr }] =
        await Promise.all([
          supabase.from('groups').select('*').order('name'),
          supabase.from('students').select('*').order('full_name'),
        ]);

      if (groupsErr) throw groupsErr;
      if (studentsErr) throw studentsErr;

      setGroups(groupsData || []);
      setStudents(studentsData || []);
      
      // فتح أول مجموعة افتراضياً إن وجدت
      if (groupsData && groupsData.length > 0 && !expandedGroupId) {
        setExpandedGroupId(groupsData[0].id);
      }
    } catch (err: any) {
      console.error('خطأ في تحميل المجموعات والطلاب:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. إضافة مجموعة جديدة
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupSubject.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .insert([{ name: newGroupName.trim(), subject: newGroupSubject.trim() }])
        .select()
        .single();

      if (error) throw error;
      setGroups((prev) => [...prev, data]);
      setExpandedGroupId(data.id);
      setIsGroupModalOpen(false);
      setNewGroupName('');
      setNewGroupSubject('');
    } catch (err: any) {
      alert('خطأ أثناء إنشاء المجموعة: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. حذف مجموعة بالكامل
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const groupStudents = students.filter((s) => s.group_id === groupId);
    const confirmMsg =
      groupStudents.length > 0
        ? `تنبيه: المجموعة (${groupName}) تحتوي على ${groupStudents.length} طلاب. حذف المجموعة سيحذف طلابها واشتراكاتهم نهائياً. هل أنت متأكد؟`
        : `هل أنت متأكد من حذف المجموعة (${groupName})؟`;

    if (!confirm(confirmMsg)) return;

    try {
      // حذف مدفوعات الطلاب التابعين للمجموعة أولاً
      const studentIds = groupStudents.map((s) => s.id);
      if (studentIds.length > 0) {
        await supabase.from('monthly_payments').delete().in('student_id', studentIds);
        await supabase.from('students').delete().in('id', studentIds);
      }

      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setStudents((prev) => prev.filter((s) => s.group_id !== groupId));
    } catch (err: any) {
      alert('خطأ أثناء حذف المجموعة: ' + err.message);
    }
  };

  // 3. إضافة طالب فردي لمجموعة محددة
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentName.trim() || !targetGroupId) return;

    setSubmitting(true);
    try {
      const { data: student, error: stErr } = await supabase
        .from('students')
        .insert([
          {
            full_name: singleStudentName.trim(),
            parent_phone: singleStudentPhone.trim() || null,
            group_id: targetGroupId,
          },
        ])
        .select()
        .single();

      if (stErr) throw stErr;

      // إنشاء فاتورة اشتراك للشهر الحالي تلقائياً
      await supabase.from('monthly_payments').insert([
        {
          student_id: student.id,
          expected_amount: Number(singleStudentAmount) || 300,
          status: 'PENDING',
          billing_period: currentBillingPeriod,
        },
      ]);

      setStudents((prev) => [...prev, student]);
      setIsSingleStudentModalOpen(false);
      setSingleStudentName('');
      setSingleStudentPhone('');
    } catch (err: any) {
      alert('خطأ أثناء إضافة الطالب: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 4. ميزة الإضافة الجماعية السريعة (Bulk Add)
  const handleBulkAddStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNamesText.trim() || !targetGroupId) return;

    // فصل الأسماء بالأسطر
    const names = bulkNamesText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      alert('يرجى كتابة اسم طالب واحد على الأقل.');
      return;
    }

    setSubmitting(true);
    try {
      const studentsToInsert = names.map((name) => ({
        full_name: name,
        group_id: targetGroupId,
        parent_phone: null,
      }));

      const { data: insertedStudents, error: stErr } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select();

      if (stErr) throw stErr;

      // إنشاء فواتير اشتراك لكل طالب أُضيف
      if (insertedStudents && insertedStudents.length > 0) {
        const paymentsToInsert = insertedStudents.map((st) => ({
          student_id: st.id,
          expected_amount: Number(bulkAmount) || 300,
          status: 'PENDING',
          billing_period: currentBillingPeriod,
        }));

        await supabase.from('monthly_payments').insert(paymentsToInsert);
        setStudents((prev) => [...prev, ...insertedStudents]);
      }

      alert(`تمت إضافة (${names.length}) طلاب بنجاح إلى المجموعة!`);
      setIsBulkModalOpen(false);
      setBulkNamesText('');
    } catch (err: any) {
      alert('خطأ أثناء الإضافة الجماعية: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 5. تعديل بيانات طالب
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          full_name: editStudentName.trim(),
          parent_phone: editStudentPhone.trim() || null,
          group_id: editStudentGroupId,
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingStudent.id
            ? {
                ...s,
                full_name: editStudentName.trim(),
                parent_phone: editStudentPhone.trim() || null,
                group_id: editStudentGroupId,
              }
            : s
        )
      );

      setEditingStudent(null);
    } catch (err: any) {
      alert('خطأ أثناء تحديث بيانات الطالب: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 6. حذف طالب نهائياً
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب (${studentName}) نهائياً؟`)) return;

    try {
      await supabase.from('monthly_payments').delete().eq('student_id', studentId);
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;

      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (err: any) {
      alert('خطأ أثناء حذف الطالب: ' + err.message);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-36 pt-8 px-4 sm:px-6 max-w-4xl mx-auto">
      
      {/* الترويسة الرئيسية */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Users size={16} />
            <span>الهيكل التعليمي</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">إدارة المجموعات والطلاب</h1>
        </div>

        <button
          onClick={() => setIsGroupModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
        >
          <FolderPlus size={18} />
          <span>إنشاء مجموعة جديدة</span>
        </button>
      </header>

      {/* شريط الإحصائيات السريعة */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <FolderPlus size={22} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">عدد المجموعات</p>
            <p className="text-xl font-bold text-zinc-100">{groups.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">إجمالي الطلاب</p>
            <p className="text-xl font-bold text-zinc-100">{students.length} طالب</p>
          </div>
        </div>
      </section>

      {/* البحث في المجموعات */}
      <div className="relative mb-6">
        <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="بحث عن مجموعة أو مادة (مثلاً: ثانية ثانوي، فيزياء)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* قائمة المجموعات */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
          <div className="h-28 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-800/80 p-10 text-center bg-zinc-900/20">
          <Users size={36} className="mx-auto text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-400">لا توجد مجموعات بعد</p>
          <p className="text-xs text-zinc-600 mt-1">اضغط على زر "إنشاء مجموعة جديدة" للبدء.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const groupStudents = students.filter((s) => s.group_id === group.id);
            const isExpanded = expandedGroupId === group.id;

            return (
              <div
                key={group.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                {/* رأس كارت المجموعة */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/50 text-indigo-400">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                        {group.name}
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                          {group.subject}
                        </span>
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {groupStudents.length} طلاب مسجلين في هذه المجموعة
                      </p>
                    </div>
                  </div>

                  {/* إجراءات المجموعة */}
                  <div className="flex items-center gap-1.5">
                    {/* زر الإضافة السريعة الجماعية */}
                    <button
                      onClick={() => {
                        setTargetGroupId(group.id);
                        setIsBulkModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-semibold transition active:scale-95"
                      title="إضافة عدة طلاب دفعة واحدة"
                    >
                      <UserPlus size={14} />
                      <span className="hidden sm:inline">إضافة متعددة</span>
                    </button>

                    {/* زر إضافة طالب فردي */}
                    <button
                      onClick={() => {
                        setTargetGroupId(group.id);
                        setIsSingleStudentModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm"
                      title="إضافة طالب واحد"
                    >
                      <Plus size={14} />
                      <span className="hidden sm:inline">طالب</span>
                    </button>

                    {/* زر حذف المجموعة */}
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                      title="حذف المجموعة"
                    >
                      <Trash2 size={16} />
                    </button>

                    {/* زر الفتح والطي */}
                    <button
                      onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                      className="p-2 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* قائمة الطلاب داخل المجموعة (قابلة للطي) */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
                    {groupStudents.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-zinc-500">لا يوجد طلاب في هذه المجموعة بعد.</p>
                        <div className="flex justify-center gap-2 mt-3">
                          <button
                            onClick={() => {
                              setTargetGroupId(group.id);
                              setIsBulkModalOpen(true);
                            }}
                            className="text-xs text-amber-400 hover:underline font-semibold"
                          >
                            + إضافة عدة طلاب معاً
                          </button>
                          <span className="text-zinc-600">•</span>
                          <button
                            onClick={() => {
                              setTargetGroupId(group.id);
                              setIsSingleStudentModalOpen(true);
                            }}
                            className="text-xs text-indigo-400 hover:underline font-semibold"
                          >
                            + إضافة طالب واحد
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {groupStudents.map((student, idx) => (
                          <div
                            key={student.id}
                            className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 text-center text-xs font-mono text-zinc-500">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="text-xs sm:text-sm font-semibold text-zinc-200">
                                  {student.full_name}
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                  {student.parent_phone || 'بدون هاتف'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {student.parent_phone && (
                                <a
                                  href={`https://wa.me/${student.parent_phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                                  title="مراسلة ولي الأمر واتساب"
                                >
                                  <Send size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  setEditingStudent(student);
                                  setEditStudentName(student.full_name);
                                  setEditStudentPhone(student.parent_phone || '');
                                  setEditStudentGroupId(student.group_id);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition"
                                title="تعديل بيانات الطالب"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id, student.full_name)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                title="حذف الطالب نهائياً"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة: إنشاء مجموعة جديدة */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsGroupModalOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">إنشاء مجموعة دراسية جديدة</h3>
            <p className="text-xs text-zinc-400 mb-4">أدخل اسم المجموعة والصف أو المادة الدراسية.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم المجموعة</label>
                <input
                  type="text"
                  placeholder="مثال: مجموعة السبت والأربعاء أو ثانية ثانوي (أ)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">المادة / الصف الدراسي</label>
                <input
                  type="text"
                  placeholder="مثال: فيزياء 2ث أو لغة عربية"
                  value={newGroupSubject}
                  onChange={(e) => setNewGroupSubject(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25"
              >
                {submitting ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: إضافة طالب فردي لمجموعة */}
      {isSingleStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSingleStudentModalOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">إضافة طالب إلى المجموعة</h3>
            <p className="text-xs text-zinc-400 mb-4">
              المجموعة: <span className="text-indigo-400 font-bold">{groups.find((g) => g.id === targetGroupId)?.name}</span>
            </p>

            <form onSubmit={handleAddSingleStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم الطالب</label>
                <input
                  type="text"
                  placeholder="مثال: كريم هاني"
                  value={singleStudentName}
                  onChange={(e) => setSingleStudentName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">رقم هاتف ولي الأمر (واتساب)</label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  value={singleStudentPhone}
                  onChange={(e) => setSingleStudentPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">قيمة الاشتراك الشهري (ج.م)</label>
                <input
                  type="number"
                  value={singleStudentAmount}
                  onChange={(e) => setSingleStudentAmount(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25"
              >
                {submitting ? 'جاري الحفظ...' : 'إضافة الطالب'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: الإضافة الجماعية لعدة طلاب دفعة واحدة (Bulk Add) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">إضافة عدة طلاب دفعة واحدة</h3>
            <p className="text-xs text-zinc-400 mb-4">
              إلى مجموعة: <span className="text-amber-400 font-bold">{groups.find((g) => g.id === targetGroupId)?.name}</span>
            </p>

            <form onSubmit={handleBulkAddStudents} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  قائمة الأسماء (ضع كل اسم طالب في سطر منفصل)
                </label>
                <textarea
                  rows={6}
                  placeholder={`أحمد محمد على\nإبراهيم سامي\nزياد إيهاب\nعمر طارق`}
                  value={bulkNamesText}
                  onChange={(e) => setBulkNamesText(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  يمكنك نسخ قائمة الأسماء من الواتساب ولصقها هنا مباشرة.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  قيمة اشتراك الشهر الافتراضية لكل طالب (ج.م)
                </label>
                <input
                  type="number"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-amber-600/25"
              >
                {submitting ? 'جاري تسجيل الطلاب...' : 'تسجيل كافة الطلاب دفعة واحدة'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: تعديل بيانات طالب */}
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
            <p className="text-xs text-zinc-400 mb-4">تعديل الاسم أو الهاتف أو نقله لمجموعة ثانية.</p>

            <form onSubmit={handleSaveStudentEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم الطالب</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">هاتف ولي الأمر</label>
                <input
                  type="tel"
                  value={editStudentPhone}
                  onChange={(e) => setEditStudentPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">المجموعة</label>
                <select
                  value={editStudentGroupId}
                  onChange={(e) => setEditStudentGroupId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-sm transition"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl text-sm transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
