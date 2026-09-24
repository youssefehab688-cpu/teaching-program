'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  CalendarDays, 
  Clock, 
  Plus, 
  BookOpen, 
  GraduationCap, 
  Trash2, 
  X,
  AlertCircle,
  FolderPlus,
  Layers,
  MapPin,
  Video
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  subject: string;
  grade_level: string;
  location_type?: string;
}

interface Session {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  group_id: string;
  groups?: Group;
}

const DAYS = [
  { id: 6, name: 'السبت' },
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
];

// دالة تحويل الوقت إلى دقائق لحساب التداخل بدقة
const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// دالة تنسيق الوقت بنظام 12 ساعة (ساعات ودقائق فقط + AM/PM)
const formatTime12h = (timeStr: string) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.slice(0, 2) : '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const paddedH = h < 10 ? `0${h}` : `${h}`;
  return `${paddedH}:${m} ${period}`;
};

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // وضع الإضافة
  const [isNewGroupMode, setIsNewGroupMode] = useState(false);

  // بيانات الحصة والمجموعة الحالية
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [existingGroupLocation, setExistingGroupLocation] = useState('HOME_STUDIO');
  const [newDay, setNewDay] = useState(new Date().getDay());
  const [newStartTime, setNewStartTime] = useState('16:00');
  const [newEndTime, setNewEndTime] = useState('17:30');

  // بيانات المجموعة الجديدة
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [newGroupGrade, setNewGroupGrade] = useState('');
  const [newLocationType, setNewLocationType] = useState('HOME_STUDIO');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. جلب المجموعات
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name, subject, grade_level, location_type')
        .order('name');

      if (groupsData && groupsData.length > 0) {
        setGroups(groupsData);
        setSelectedGroupId(groupsData[0].id);
        setExistingGroupLocation(groupsData[0].location_type || 'HOME_STUDIO');
      } else {
        setIsNewGroupMode(true);
      }

      // 2. جلب الحصص
      const { data: sessionsData, error } = await supabase
        .from('recurring_sessions')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          group_id,
          groups (
            id,
            name,
            subject,
            grade_level,
            location_type
          )
        `)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions((sessionsData as any) || []);
    } catch (err: any) {
      console.error('خطأ في تحميل الجدول:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSelectionChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g) => g.id === groupId);
    if (grp?.location_type) {
      setExistingGroupLocation(grp.location_type);
    }
  };

  // حفظ الحصة مع فحص التعارض
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const startMin = timeToMinutes(newStartTime);
    const endMin = timeToMinutes(newEndTime);

    // 1. فحص صحة المواعيد
    if (startMin >= endMin) {
      alert('وقت الانتهاء يجب أن يكون بعد وقت البدء.');
      return;
    }

    // 2. فحص تداخل المواعيد (Overlap Detection)
    const conflictSession = sessions.find((s) => {
      if (s.day_of_week !== Number(newDay)) return false;
      const existingStart = timeToMinutes(s.start_time);
      const existingEnd = timeToMinutes(s.end_time);

      // شرط التداخل: يبدأ قبل نهاية الحصة المسجلة وينتهي بعد بدايتها
      return startMin < existingEnd && endMin > existingStart;
    });

    if (conflictSession) {
      const conflictName = conflictSession.groups?.name || 'مجموعة أخرى';
      const conflictStart = formatTime12h(conflictSession.start_time);
      const conflictEnd = formatTime12h(conflictSession.end_time);

      alert(
        `عذراً! يوجد تعارض في المواعيد:\nالوقت المطلوب محجوز بالفعل أو يتداخل مع (${conflictName}) من الساعة ${conflictStart} إلى ${conflictEnd}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      let targetGroupId = selectedGroupId;

      if (isNewGroupMode) {
        if (!newGroupName.trim() || !newGroupSubject.trim()) {
          alert('يرجى ملء اسم المجموعة والمادة');
          setSubmitting(false);
          return;
        }

        const { data: createdGroup, error: groupErr } = await supabase
          .from('groups')
          .insert([
            {
              name: newGroupName.trim(),
              subject: newGroupSubject.trim(),
              grade_level: newGroupGrade.trim() || 'عام',
              location_type: newLocationType,
            },
          ])
          .select()
          .single();

        if (groupErr) throw groupErr;

        targetGroupId = createdGroup.id;
        setGroups((prev) => [...prev, createdGroup]);
        setSelectedGroupId(createdGroup.id);
      } else {
        const currentGroup = groups.find((g) => g.id === targetGroupId);
        if (currentGroup && currentGroup.location_type !== existingGroupLocation) {
          await supabase
            .from('groups')
            .update({ location_type: existingGroupLocation })
            .eq('id', targetGroupId);

          setGroups((prev) =>
            prev.map((g) => (g.id === targetGroupId ? { ...g, location_type: existingGroupLocation } : g))
          );
        }
      }

      // حفظ الحصة في الجدول
      const { data: createdSession, error: sessionErr } = await supabase
        .from('recurring_sessions')
        .insert([
          {
            group_id: targetGroupId,
            day_of_week: Number(newDay),
            start_time: newStartTime,
            end_time: newEndTime,
          },
        ])
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          group_id,
          groups (
            id,
            name,
            subject,
            grade_level,
            location_type
          )
        `)
        .single();

      if (sessionErr) throw sessionErr;

      setSessions((prev) => [...prev, createdSession as any]);
      setSelectedDay(Number(newDay));
      setIsModalOpen(false);

      // تصفير البيانات
      setNewGroupName('');
      setNewGroupSubject('');
      setNewGroupGrade('');
      setIsNewGroupMode(false);
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // حذف حصة
  const handleDeleteSession = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الحصة؟')) return;

    try {
      const { error } = await supabase.from('recurring_sessions').delete().eq('id', id);
      if (error) throw error;
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  const filteredSessions = sessions.filter((s) => s.day_of_week === selectedDay);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32 pt-8 px-4 sm:px-6 max-w-4xl mx-auto">
      
      {/* الترويسة */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CalendarDays size={16} />
            <span>تنظيم المواعيد</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">الجدول الأسبوعي</h1>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
        >
          <Plus size={18} />
          <span>إضافة حصة</span>
        </button>
      </header>

      {/* شريط الأيام */}
      <section className="mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {DAYS.map((day) => {
            const count = sessions.filter((s) => s.day_of_week === day.id).length;
            const isSelected = selectedDay === day.id;

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`flex-1 min-w-[76px] py-3 px-2 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-850 hover:text-zinc-200'
                }`}
              >
                <span className="text-xs font-semibold">{day.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected
                      ? 'bg-indigo-700/60 text-indigo-100'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* قائمة الحصص */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
            <span>حصص يوم {DAYS.find((d) => d.id === selectedDay)?.name}</span>
            <span className="text-xs text-zinc-500 font-normal">({filteredSessions.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
            <div className="h-20 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800/80 p-10 text-center bg-zinc-900/20">
            <CalendarDays size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-zinc-400">لا توجد حصص مسجلة في هذا اليوم</p>
            <p className="text-xs text-zinc-600 mt-1">اضغط على زر "إضافة حصة" في الأعلى لجدولة حصة جديدة.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-4 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3.5">
                  {/* عرض التوقيت بنظام 12 ساعة وبدون ثواني */}
                  <div className="text-center font-mono bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl min-w-[90px]">
                    <div className="text-xs font-bold text-indigo-400">
                      {formatTime12h(session.start_time)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {formatTime12h(session.end_time)}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-zinc-100 mb-1">
                      {session.groups?.name || 'مجموعة بدون اسم'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} className="text-zinc-500" />
                        {session.groups?.subject}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <GraduationCap size={12} className="text-zinc-500" />
                        {session.groups?.grade_level}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        {session.groups?.location_type === 'ONLINE' ? (
                          <><Video size={12} className="text-indigo-400" /> أونلاين</>
                        ) : (
                          <><MapPin size={12} className="text-amber-400" /> حضوري</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                  title="حذف الحصة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* نافذة الإضافة التفاعلية */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 left-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-zinc-100 mb-1">إضافة حصة إلى الجدول</h3>
            <p className="text-xs text-zinc-400 mb-4">لن يُسمح بجدولة موعد يتعارض مع حصة أخرى في نفس اليوم.</p>

            {/* أزرار التبديل */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 mb-5">
              <button
                type="button"
                onClick={() => setIsNewGroupMode(false)}
                disabled={groups.length === 0}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                  !isNewGroupMode
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-40'
                }`}
              >
                <Layers size={14} />
                <span>مجموعة حالية</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewGroupMode(true)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                  isNewGroupMode
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FolderPlus size={14} />
                <span>+ مجموعة جديدة</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {!isNewGroupMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">اختر المجموعة</label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => handleGroupSelectionChange(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.subject} - {group.grade_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">مكان التدريس</label>
                    <select
                      value={existingGroupLocation}
                      onChange={(e) => setExistingGroupLocation(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="HOME_STUDIO">استوديو / مقر حضوري</option>
                      <option value="ONLINE">أونلاين (Online)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">اسم المجموعة</label>
                    <input
                      type="text"
                      placeholder="مثال: دفعة الأوائل - سنتر النور"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required={isNewGroupMode}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">المادة</label>
                      <input
                        type="text"
                        placeholder="فيزياء / كيمياء"
                        value={newGroupSubject}
                        onChange={(e) => setNewGroupSubject(e.target.value)}
                        required={isNewGroupMode}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">المرحلة</label>
                      <input
                        type="text"
                        placeholder="3 ثانوي"
                        value={newGroupGrade}
                        onChange={(e) => setNewGroupGrade(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">نوع المكان / التدريس</label>
                    <select
                      value={newLocationType}
                      onChange={(e) => setNewLocationType(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="HOME_STUDIO">استوديو / مقر حضوري</option>
                      <option value="ONLINE">أونلاين (Online)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* تحديد اليوم والمواعيد */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">يوم الحصة</label>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {DAYS.map((day) => (
                    <option key={day.id} value={day.id}>
                      يوم {day.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">وقت البدء</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">وقت الانتهاء</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25"
                >
                  {submitting ? 'جاري الحفظ...' : isNewGroupMode ? 'إنشاء المجموعة وحفظ الحصة' : 'حفظ في الجدول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
