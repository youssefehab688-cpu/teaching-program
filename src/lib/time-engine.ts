import { format, addDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export interface SessionWithGroup {
  id: string;
  groupId: string;
  groupName: string;
  subject: string;
  locationType: string;
  locationDetail: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
}

export interface DashboardState {
  mode: 'TODAY' | 'FLIPPED_TOMORROW' | 'NEXT_UPCOMING';
  targetDate: string;
  dayOfWeek: number;
  sessions: SessionWithGroup[];
  activeSession: SessionWithGroup | null;
  nextSession: SessionWithGroup | null;
}

export function computeDashboardState(
  allSessions: SessionWithGroup[],
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  manualDateOverride: string | null = null
): DashboardState {
  const localNow = toZonedTime(new Date(), timeZone);
  const currentTimeStr = format(localNow, 'HH:mm');
  const todayIso = format(localNow, 'yyyy-MM-dd');
  const todayDayOfWeek = localNow.getDay() === 0 ? 7 : localNow.getDay();

  if (manualDateOverride && manualDateOverride !== todayIso) {
    const overrideDate = parseISO(manualDateOverride);
    const overrideDay = overrideDate.getDay() === 0 ? 7 : overrideDate.getDay();
    const sessions = annotate(filterByDay(allSessions, overrideDay), '00:00');
    return {
      mode: 'TODAY',
      targetDate: manualDateOverride,
      dayOfWeek: overrideDay,
      sessions,
      activeSession: null,
      nextSession: sessions[0] ?? null,
    };
  }

  const todaySessions = filterByDay(allSessions, todayDayOfWeek);
  if (todaySessions.length > 0) {
    const latestEndTime = todaySessions.reduce((max, s) => (s.endTime > max ? s.endTime : max), '00:00');
    if (currentTimeStr <= latestEndTime) {
      const annotated = annotate(todaySessions, currentTimeStr);
      return {
        mode: 'TODAY',
        targetDate: todayIso,
        dayOfWeek: todayDayOfWeek,
        sessions: annotated,
        activeSession: annotated.find((s) => s.status === 'IN_PROGRESS') ?? null,
        nextSession: annotated.find((s) => s.status === 'UPCOMING') ?? null,
      };
    }
  }

  const tomorrowDate = addDays(localNow, 1);
  const tomorrowDayOfWeek = tomorrowDate.getDay() === 0 ? 7 : tomorrowDate.getDay();
  const tomorrowSessions = filterByDay(allSessions, tomorrowDayOfWeek);

  if (tomorrowSessions.length > 0) {
    const annotated = annotate(tomorrowSessions, '00:00');
    return {
      mode: 'FLIPPED_TOMORROW',
      targetDate: format(tomorrowDate, 'yyyy-MM-dd'),
      dayOfWeek: tomorrowDayOfWeek,
      sessions: annotated,
      activeSession: null,
      nextSession: annotated[0] ?? null,
    };
  }

  for (let offset = 2; offset <= 7; offset++) {
    const futureDate = addDays(localNow, offset);
    const futureDayOfWeek = futureDate.getDay() === 0 ? 7 : futureDate.getDay();
    const futureSessions = filterByDay(allSessions, futureDayOfWeek);

    if (futureSessions.length > 0) {
      const annotated = annotate(futureSessions, '00:00');
      return {
        mode: 'NEXT_UPCOMING',
        targetDate: format(futureDate, 'yyyy-MM-dd'),
        dayOfWeek: futureDayOfWeek,
        sessions: annotated,
        activeSession: null,
        nextSession: annotated[0] ?? null,
      };
    }
  }

  return {
    mode: 'TODAY',
    targetDate: todayIso,
    dayOfWeek: todayDayOfWeek,
    sessions: [],
    activeSession: null,
    nextSession: null,
  };
}

function filterByDay(sessions: SessionWithGroup[], day: number) {
  return sessions.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function annotate(sessions: SessionWithGroup[], currentTime: string): SessionWithGroup[] {
  return sessions.map((s) => {
    let status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
    if (currentTime > s.endTime) status = 'COMPLETED';
    else if (currentTime >= s.startTime && currentTime <= s.endTime) status = 'IN_PROGRESS';
    else status = 'UPCOMING';
    return { ...s, status };
  });
}