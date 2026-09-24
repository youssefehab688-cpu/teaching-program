'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  CheckCircle2, 
  Sparkles 
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
  groups?: Group;
}

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

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTodaySchedule();
  }, []);

  const fetchTodaySchedule = async () => {
    setLoading(true);
    const today = new Date().getDay();

    try {
      const { data, error } = await supabase
        .from('recurring_sessions')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          groups (
            id,
            name,
            subject,
            grade_level,
            location_type
          )
        `)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Supabase Error:', error.message);
      } else {
        setSessions((data as any) || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const currentMinutes = currentTime 
    ? currentTime.getHours() * 60 + currentTime.getMinutes() 
    : 0;

  const activeSession = sessions.find((s) => {
    const start = parseMinutes(s.start_time);
    const end = parseMinutes(s.end_time);
    return currentMinutes >= start && currentMinutes <= end;
  });

  const nextSession = sessions.find((s) => parseMinutes(s.start_time) > currentMinutes);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32 pt-8 px-4 sm:px-6 max-w-4xl mx-auto">
      
      {/* الترويسة العلوية */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1 font-medium">
            <Calendar size={15} />
            <span>
              {currentTime 
                ? currentTime.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'جاري التحميل...'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">لوحة المتابعة</h1>
        </div>

        {/* عرض التوقيت الحالي بنظام 12 ساعة ودون ثواني */}
        <div className="bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono font-medium text-zinc-300">
          <Clock size={14} className="text-indigo-400" />
          <span>
            {currentTime 
              ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
              : '--:--'}
          </span>
        </div>
      </header>

      {/* 1. البطاقة التفاعلية الذكية */}
      <section className="mb-8">
        {loading ? (
          <div className="h-44 rounded-3xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
        ) : activeSession ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/70 via-zinc-900 to-zinc-900 border border-emerald-500/30 p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              حصة جارية الآن
            </div>
            
            <h2 className="text-2xl font-bold mb-1">{activeSession.groups?.name || 'مجموعة بدون اسم'}</h2>
            <p className="text-zinc-400 text-sm mb-4">
              {activeSession.groups?.subject} • {activeSession.groups?.grade_level}
            </p>

            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800 w-fit">
              <Clock size={14} className="text-emerald-400" />
              <span>ينتهي عند {formatTime12h(activeSession.end_time)}</span>
            </div>
          </div>
        ) : nextSession ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-zinc-900 border border-indigo-500/20 p-6 shadow-xl">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={14} />
              الحصة القادمة
            </div>
            <h2 className="text-xl font-bold mb-1">{nextSession.groups?.name || 'مجموعة بدون اسم'}</h2>
            <p className="text-zinc-400 text-sm mb-4">
              {nextSession.groups?.subject} • {nextSession.groups?.grade_level}
            </p>

            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 w-fit">
              <Clock size={14} className="text-indigo-400" />
              <span>
                يبدأ {formatTime12h(nextSession.start_time)} - {formatTime12h(nextSession.end_time)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800 p-6 text-center">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2 opacity-80" />
            <h3 className="font-semibold text-zinc-200">انتهت جميع حصص اليوم</h3>
            <p className="text-zinc-500 text-xs mt-1">يمكنك مراجعة جدول باقي الأسبوع أو تفقد المدفوعات.</p>
          </div>
        )}
      </section>

      {/* 2. شريط الإحصائيات */}
      <section className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">حصص اليوم</p>
            <p className="text-lg font-bold">{sessions.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">المجموعات المجدولة</p>
            <p className="text-lg font-bold">
              {new Set(sessions.map((s) => s.groups?.id).filter(Boolean)).size}
            </p>
          </div>
        </div>
      </section>

      {/* 3. جدول حصص اليوم */}
      <section>
        <h3 className="text-base font-semibold mb-4 text-zinc-300 flex items-center gap-2">
          <span>جدول حصص اليوم</span>
          <span className="text-xs text-zinc-500 font-normal">({sessions.length})</span>
        </h3>

        {sessions.length === 0 && !loading ? (
          <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
            لا توجد أي حصص مسجلة لهذا اليوم.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const start = parseMinutes(session.start_time);
              const end = parseMinutes(session.end_time);
              const isPast = currentMinutes > end;
              const isCurrent = currentMinutes >= start && currentMinutes <= end;

              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isCurrent
                      ? 'bg-zinc-900/90 border-emerald-500/40 shadow-lg'
                      : isPast
                      ? 'bg-zinc-950/40 border-zinc-800 opacity-50'
                      : 'bg-zinc-900/40 border-zinc-800/70 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* عرض التوقيت بنظام 12 ساعة وبدون ثواني */}
                    <div className="text-center font-mono bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl min-w-[90px]">
                      <div className="text-xs font-bold text-zinc-200">
                        {formatTime12h(session.start_time)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {formatTime12h(session.end_time)}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                        {session.groups?.name || 'مجموعة'}
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                            جارية
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {session.groups?.subject} • {session.groups?.grade_level}
                      </p>
                    </div>
                  </div>

                  {/* نوع المكان أونلاين أم حضوري */}
                  <div className="flex items-center gap-2">
                    {session.groups?.location_type === 'ONLINE' ? (
                      <span className="p-2 rounded-xl bg-zinc-800/60 text-indigo-400" title="أونلاين">
                        <Video size={16} />
                      </span>
                    ) : (
                      <span className="p-2 rounded-xl bg-zinc-800/60 text-amber-400" title="حضوري">
                        <MapPin size={16} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
