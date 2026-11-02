export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];
const DAY_OF: Readonly<Record<string, Day>> = {
    monday: 'mon', mon: 'mon', tuesday: 'tue', tue: 'tue', tues: 'tue',
    wednesday: 'wed', wed: 'wed', thursday: 'thu', thu: 'thu', thur: 'thu', thurs: 'thu',
    friday: 'fri', fri: 'fri', saturday: 'sat', sat: 'sat', sunday: 'sun', sun: 'sun',
};
export type DayHours = {
    opens: string;
    closes: string;
    periods?: {
        opens: string;
        closes: string;
    }[];
} | {
    closed: true;
};
export type HoursSet = {
    days: Partial<Record<Day, DayHours>>;
    source: 'places' | 'jsonld' | 'page_text';
    quote: string | null;
};
export type FoodHours = {
    business: HoursSet | null;
    kitchen: HoursSet | null;
    ordering: HoursSet | null;
};
export function parseTime(text: string): string | null {
    const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*$/i.exec(text);
    if (!m)
        return null;
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (!Number.isFinite(hour) || hour < 0 || hour > 24 || minute > 59)
        return null;
    const suffix = (m[3] ?? '').toLowerCase().replace(/\./g, '');
    if (suffix === 'pm' && hour < 12)
        hour += 12;
    if (suffix === 'am' && hour === 12)
        hour = 0;
    if (hour > 24)
        return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export function hoursFromJsonLd(spec: unknown, quote: string | null = null): HoursSet | null {
    const entries = Array.isArray(spec) ? spec : spec ? [spec] : [];
    const days: Partial<Record<Day, DayHours>> = {};
    for (const raw of entries) {
        if (!raw || typeof raw !== 'object')
            continue;
        const e = raw as {
            dayOfWeek?: unknown;
            opens?: unknown;
            closes?: unknown;
        };
        const opens = typeof e.opens === 'string' ? parseTime(e.opens.slice(0, 5)) : null;
        const closes = typeof e.closes === 'string' ? parseTime(e.closes.slice(0, 5)) : null;
        const names = Array.isArray(e.dayOfWeek) ? e.dayOfWeek : e.dayOfWeek ? [e.dayOfWeek] : [];
        for (const n of names) {
            if (typeof n !== 'string')
                continue;
            const word = n.split('/').pop()!.toLowerCase().trim();
            const day = DAY_OF[word];
            if (!day)
                continue;
            if (opens && closes)
                days[day] = { opens, closes };
        }
    }
    return Object.keys(days).length ? { days, source: 'jsonld', quote } : null;
}
export function hoursFromPlaces(weekdayDescriptions: unknown): HoursSet | null {
    const lines = Array.isArray(weekdayDescriptions) ? weekdayDescriptions : [];
    const days: Partial<Record<Day, DayHours>> = {};
    const quotes: string[] = [];
    for (const raw of lines) {
        if (typeof raw !== 'string')
            continue;
        const m = /^([A-Za-z]+)\s*:\s*(.+)$/.exec(raw.trim());
        if (!m)
            continue;
        const day = DAY_OF[m[1].toLowerCase()];
        if (!day)
            continue;
        quotes.push(raw.trim());
        const rest = m[2].trim();
        if (/^closed$/i.test(rest)) {
            days[day] = { closed: true };
            continue;
        }
        if (/^open 24 hours$/i.test(rest)) {
            days[day] = { opens: '00:00', closes: '24:00' };
            continue;
        }
        const periods: {
            opens: string;
            closes: string;
        }[] = [];
        for (const part of rest.replace(/[   ]/g, ' ').split(/\s*,\s*/)) {
            const span = /^(.+?)\s*(?:[–—-]|\bto\b)\s*(.+)$/.exec(part);
            if (!span)
                continue;
            const suffix = /\b([ap])\.?m\.?\s*$/i.exec(span[2]);
            const first = !/[ap]\.?m\.?\s*$/i.test(span[1]) && suffix ? `${span[1].trim()} ${suffix[1]}m` : span[1];
            let opens = parseTime(first);
            const closes = parseTime(span[2]);
            if (opens && closes && opens > closes && first !== span[1])
                opens = parseTime(span[1]);
            if (opens && closes)
                periods.push({ opens, closes });
        }
        if (periods.length === 1)
            days[day] = periods[0];
        else if (periods.length > 1)
            days[day] = { opens: periods[0].opens, closes: periods[periods.length - 1].closes, periods };
    }
    return Object.keys(days).length ? { days, source: 'places', quote: quotes.join(' · ').slice(0, 300) || null } : null;
}
export function kitchenHoursFromText(text: string): HoursSet | null {
    const flat = text.replace(/\s+/g, ' ');
    const span = /kitchen(?:\s+hours)?\s*:?\s*(?:is\s+)?(?:open\s+)?(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:[–—-]|\bto\b|\buntil\b)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i.exec(flat);
    if (span) {
        const opens = parseTime(span[1]);
        const closes = parseTime(span[2]);
        if (opens && closes) {
            const days: Partial<Record<Day, DayHours>> = {};
            for (const day of DAYS)
                days[day] = { opens, closes };
            return { days, source: 'page_text', quote: quoteAround(flat, span.index, span[0].length) };
        }
    }
    const closing = /kitchen\s+(?:closes|is\s+open\s+until|closing)\s*(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i.exec(flat);
    if (closing) {
        const closes = parseTime(closing[1]);
        if (closes) {
            const days: Partial<Record<Day, DayHours>> = {};
            for (const day of DAYS)
                days[day] = { opens: '00:00', closes };
            return { days, source: 'page_text', quote: quoteAround(flat, closing.index, closing[0].length) };
        }
    }
    return null;
}
function quoteAround(text: string, at: number, length: number): string {
    return text.slice(Math.max(0, at - 50), Math.min(text.length, at + length + 50)).trim();
}
export function hoursConflict(hours: FoodHours): string | null {
    const business = hours.business;
    const kitchen = hours.kitchen;
    if (!business || !kitchen)
        return null;
    for (const day of DAYS) {
        const b = business.days[day];
        const k = kitchen.days[day];
        if (!b || !k || 'closed' in b || 'closed' in k)
            continue;
        if (k.closes > b.closes) {
            return `on ${day} the kitchen is recorded as closing at ${k.closes} and the restaurant at ${b.closes}, which cannot both be right`;
        }
    }
    return null;
}