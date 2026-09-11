'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { computeDashboardState, DashboardState, SessionWithGroup } from '../lib/time-engine';
import { Clock, MapPin, Video, CheckCircle, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [allSessions, setAllSessions] = useState<SessionWithGroup[]>([]);
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = async () => {
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
          location_type,
          location_detail
        )
      `);

    if (data && !error) {
      const mapped: SessionWithGroup[] = data.map((item: any) => ({
        id: item.id,
        groupId: item.group_id,
        groupName: item.groups?.name ?? 'Group',
        subject: item.groups?.subject ?? '',
        locationType: item.groups?.location_type ?? 'ONLINE',
        locationDetail: item.groups?.location_detail ?? null,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time.slice(0, 5),
        endTime: item.end_time.slice(0, 5),
      }));
      setAllSessions(mapped);
    }
    setLoading(false);
  };

  const refreshState = useCallback(() => {
    if (allSessions.length > 0) {
      setDashboard(computeDashboardState(allSessions));
    }
  }, [allSessions]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 60000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshState();
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refreshState);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refreshState);
    };
  }, [refreshState]);

  if (loading) return <div className="p-8 text-neutral-500">Loading schedule...</div>;

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TutorPulse</h1>
          <p className="text-sm text-neutral-500">
            {dashboard?.mode === 'FLIPPED_TOMORROW'
              ? 'Showing Tomorrow (Today Complete)'
              : dashboard?.mode === 'NEXT_UPCOMING'
              ? 'Showing Next Teaching Day'
              : 'Showing Today'}
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-neutral-200 text-neutral-800">
          {dashboard?.targetDate}
        </span>
      </header>

      {dashboard?.activeSession && (
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 animate-pulse">
              ● Ongoing Class
            </span>
            <span className="text-sm font-medium text-blue-800">
              {dashboard.activeSession.startTime} - {dashboard.activeSession.endTime}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-2 text-neutral-900">{dashboard.activeSession.groupName}</h2>
          <p className="text-sm text-neutral-600">{dashboard.activeSession.subject}</p>

          {dashboard.activeSession.locationDetail && (
            <div className="mt-4 flex items-center gap-2">
              {dashboard.activeSession.locationType === 'ONLINE' ? (
                <a
                  href={dashboard.activeSession.locationDetail}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Video className="w-3.5 h-3.5" /> Join Meeting
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                  <MapPin className="w-3.5 h-3.5" /> {dashboard.activeSession.locationDetail}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
          Classes ({dashboard?.sessions.length ?? 0})
        </h3>
        {dashboard?.sessions.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 bg-white rounded-xl border">
            No classes scheduled for this day.
          </div>
        ) : (
          dashboard?.sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-xl border flex items-center justify-between ${
                session.status === 'COMPLETED'
                  ? 'bg-neutral-100 opacity-60 border-neutral-200'
                  : session.status === 'IN_PROGRESS'
                  ? 'bg-blue-50/50 border-blue-300'
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900">{session.groupName}</span>
                  {session.status === 'COMPLETED' && <CheckCircle className="w-4 h-4 text-neutral-400" />}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {session.startTime} - {session.endTime}
                  </span>
                  <span>•</span>
                  <span>{session.locationType}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-300" />
            </div>
          ))
        )}
      </section>
    </main>
  );
}