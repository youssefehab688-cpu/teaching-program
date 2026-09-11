'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Clock, MapPin, Video, X } from 'lucide-react';

interface SessionItem {
  id: string;
  groupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  group: {
    name: string;
    subject: string;
    gradeLevel: string;
    locationType: string;
    locationDetail: string | null;
    defaultMonthlyFee: number;
  };
}

const DAYS = [
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
  { id: 7, label: 'Sun', full: 'Sunday' },
];

export default function SchedulePage() {
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 7 : today;
  });

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState('100');
  const [locationType, setLocationType] = useState('ONLINE');
  const [locationDetail, setLocationDetail] = useState('');
  const [formDay, setFormDay] = useState(selectedDay);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_sessions')
      .select(`
        id,
        group_id,
        day_of_week,
        start_time,
        end_time,
        groups (
          name,
          subject,
          grade_level,
          location_type,
          location_detail,
          default_monthly_fee
        )
      `)
      .order('start_time', { ascending: true });

    if (data && !error) {
      const formatted: SessionItem[] = data.map((item: any) => ({
        id: item.id,
        groupId: item.group_id,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time.slice(0, 5),
        endTime: item.end_time.slice(0, 5),
        group: {
          name: item.groups?.name ?? 'Untitled Group',
          subject: item.groups?.subject ?? '',
          gradeLevel: item.groups?.grade_level ?? '',
          locationType: item.groups?.location_type ?? 'ONLINE',
          locationDetail: item.groups?.location_detail ?? null,
          defaultMonthlyFee: item.groups?.default_monthly_fee ?? 0,
        },
      }));
      setSessions(formatted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subject) return;
    setSubmitting(true);

    try {
      // 1. Create the Group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          subject,
          grade_level: gradeLevel,
          default_monthly_fee: parseFloat(defaultMonthlyFee) || 0,
          location_type: locationType,
          location_detail: locationDetail,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Attach the Recurring Session
      const { error: sessionError } = await supabase
        .from('recurring_sessions')
        .insert({
          group_id: groupData.id,
          day_of_week: formDay,
          start_time: startTime + ':00',
          end_time: endTime + ':00',
        });

      if (sessionError) throw sessionError;

      // Reset & Refresh
      setName('');
      setSubject('');
      setGradeLevel('');
      setLocationDetail('');
      setIsModalOpen(false);
      await fetchSessions();
    } catch (err: any) {
      alert('Error creating class: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, groupId: string) => {
    if (!confirm('Remove this class from the schedule?')) return;

    await supabase.from('recurring_sessions').delete().eq('id', sessionId);
    await supabase.from('groups').delete().eq('id', groupId);
    fetchSessions();
  };

  const filteredSessions = sessions.filter((s) => s.dayOfWeek === selectedDay);

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Schedule</h1>
          <p className="text-sm text-neutral-500">Manage recurring timetable</p>
        </div>
        <button
          onClick={() => {
            setFormDay(selectedDay);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </header>

      {/* 7-Day Selector Bar */}
      <div className="grid grid-cols-7 gap-1.5 bg-neutral-200/60 p-1.5 rounded-xl">
        {DAYS.map((day) => {
          const isSelected = selectedDay === day.id;
          const count = sessions.filter((s) => s.dayOfWeek === day.id).length;

          return (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex flex-col items-center py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>{day.label}</span>
              {count > 0 && (
                <span
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-blue-600' : 'bg-neutral-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule for Selected Day */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
            {DAYS.find((d) => d.id === selectedDay)?.full} ({filteredSessions.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading slots...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-neutral-300">
            <p className="text-neutral-500 font-medium">No classes scheduled</p>
            <button
              onClick={() => {
                setFormDay(selectedDay);
                setIsModalOpen(true);
              }}
              className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
            >
              + Create a class for this day
            </button>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-start justify-between"
            >
              <div className="space-y-2">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">
                    {session.group.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {session.group.gradeLevel} • {session.group.subject}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                  <span className="flex items-center gap-1 font-medium text-neutral-800">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    {session.startTime} - {session.endTime}
                  </span>

                  <span>•</span>

                  {session.group.locationType === 'ONLINE' ? (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Video className="w-3.5 h-3.5" /> Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      {session.group.locationType}
                    </span>
                  )}

                  <span>•</span>
                  <span className="font-medium text-neutral-700">
                    ${session.group.defaultMonthlyFee}/mo
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteSession(session.id, session.groupId)}
                className="p-2 text-neutral-400 hover:text-red-600 active:scale-95 transition-colors"
                aria-label="Delete class"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </section>

      {/* Add Class Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-neutral-900">Add New Class</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Group / Class Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Grade 11 Advanced"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Grade Level
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 11"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Day
                  </label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Start
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2 py-2 border rounded-lg text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    End
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2 py-2 border rounded-lg text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Location Type
                  </label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="ONLINE">Online (Zoom/Meet)</option>
                    <option value="HOME_STUDIO">Home Studio</option>
                    <option value="EDUCATION_CENTER">Education Center</option>
                    <option value="STUDENT_HOME">Student Home</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Monthly Fee ($)
                  </label>
                  <input
                    type="number"
                    value={defaultMonthlyFee}
                    onChange={(e) => setDefaultMonthlyFee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Location Link or Room Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://meet.google.com/xyz or Room 4"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
              >
                {submitting ? 'Saving Class...' : 'Save Class to Schedule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}