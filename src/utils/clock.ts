// שעון מרכזי: מאפשר לבדיקות לקבוע זמן קבוע
const TIME_ZONE = 'Asia/Jerusalem';

export const clock = {
  now: (): Date => new Date()
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** התאריך כפי שהוא בישראל, בפורמט YYYY-MM-DD */
export function israelDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** התאריך והיום בשבוע (0 = ראשון) כפי שהם עכשיו בישראל */
export function israelToday(): { date: Date; dateString: string; dayOfWeek: number } {
  const now = clock.now();
  const dateString = israelDateString(now);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(now);
  return {
    date: new Date(`${dateString}T00:00:00.000Z`),
    dateString,
    dayOfWeek: WEEKDAYS.indexOf(weekday)
  };
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
