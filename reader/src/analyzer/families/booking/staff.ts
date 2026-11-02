export type StaffMember = {
    name: string;
    role: string | null;
    tier: string | null;
    location: string | null;
    quote: string;
    shape: 'name_comma_role' | 'name_dash_role' | 'two_headings' | 'name_only';
    level: number;
};
const MAX_NAME = 48;
const MIN_NAME = 2;
const NOT_A_PERSON: readonly RegExp[] = [
    /^(?:the\s+)?(?:team|staff|our\s+team|our\s+staff|barbers?|stylists?|artists?|crew|providers?|technicians?)$/i,
    /\b(?:book|booking|appointment|schedule|reviews?|social|instagram|facebook|contact|hours|location|menu|gift)\b/i,
    /^(?:welcome|about|home|meet\s+(?:the|our))\b/i,
    /^[^a-z]*$/i,
    /\b(?:llc|inc\.?|salon|spa|barbershop|studio)\b.*\b(?:team|tampa)\b/i,
    /\b(?:team|staff|crew)$/i,
    /\b(?:keep\s+in\s+touch|follow\s+us|find\s+us|(?:e-?mail|call|text)\s+us)\b/i,
    /^this\s+(?:could|can|might)\s+be\b/i,
    /\b(?:now\s+hiring|we(?:'re| are)\s+hiring|join\s+(?:our|the)\s+team)\b/i,
    /\b(?:story|journey|bio|biography|philosophy|approach|process|hobby|soundtrack|playlist)\b/i,
    /^(?:meet|why|how|what|where|when|who)\b/i,
    /\b(?:club|classroom|studio|collection|gallery|portfolio|session|sessions|pricing|investment)\b/i,
];
function capStyle(text: string): 'title' | 'lower' | 'upper' | 'sentence' {
    const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
    if (!words.length)
        return 'sentence';
    if (words.every((w) => w === w.toLowerCase()))
        return 'lower';
    if (words.every((w) => w === w.toUpperCase()))
        return 'upper';
    const particle = /^(?:van|von|de|del|della|di|da|dos|la|le|du|bin|al|ibn|mac|mc|st)$/i;
    if (words.every((w, i) => /^[A-Z]/.test(w) || (i > 0 && particle.test(w))))
        return 'title';
    return 'sentence';
}
function roleOnly(text: string): boolean {
    const words = text.toLowerCase().replace(/[^a-z0-9\s/]/g, ' ').split(/[\s/]+/).filter(Boolean);
    if (!words.length)
        return false;
    return words.every((w) => ROLE_WORDS.test(w) || /^(?:and|the|of|our|team|staff|future)$/.test(w));
}
const ROLE_WORDS = /\b(?:owner|co-?owner|manager|director|master|stylist|barber|cosmetologist|colou?rist|technician|tech|artist|esthetician|aesthetician|therapist|assistant|apprentice|receptionist|shareholder|associate|support|level\s*\d+|senior|junior|premier|elite|specialist|educator|extensionist|lash|brow|nail)\b/i;
export type StaffReading = {
    staff: StaffMember[];
    url: string;
    locations: string[];
};
type Heading = {
    level: number;
    text: string;
    at: number;
};
function headingsOf(html: string): Heading[] {
    const out: Heading[] = [];
    const cleaned = html.replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    for (const m of cleaned.matchAll(/<h([1-4])\b[^>]*>([\s\S]{0,300}?)<\/h\1>/gi)) {
        const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (text)
            out.push({ level: Number(m[1]), text, at: m.index ?? 0 });
    }
    return out;
}
function decode(s: string): string {
    return s
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;|&#38;/gi, '&')
        .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/gi, "'")
        .replace(/&ndash;|&#8211;/gi, '–')
        .replace(/&mdash;|&#8212;/gi, '—')
        .replace(/&#(\d{2,5});/g, (_, d) => { try {
        return String.fromCodePoint(Number(d));
    }
    catch {
        return ' ';
    } });
}
export function plausiblePerson(raw: string): boolean {
    const name = raw.trim();
    if (name.length < MIN_NAME || name.length > MAX_NAME)
        return false;
    if (!/[a-z]/i.test(name))
        return false;
    if (name.split(/\s+/).length > 5)
        return false;
    if (/[$€£]|\d{3,}|@|https?:/.test(name))
        return false;
    for (const rx of NOT_A_PERSON)
        if (rx.test(name))
            return false;
    if (roleOnly(name))
        return false;
    return true;
}
export function readStaff(input: {
    html: string;
    url: string;
    businessName?: string;
}): StaffReading {
    const headings = headingsOf(input.html);
    const staff: StaffMember[] = [];
    const locations: string[] = [];
    let location: string | null = null;
    const businessWords = (input.businessName ?? '')
        .toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
    for (let i = 0; i < headings.length; i += 1) {
        const { text } = headings[i];
        const isLocation = businessWords.length > 0 &&
            businessWords.some((w) => text.toLowerCase().includes(w)) &&
            text.length > 12 &&
            !/[?,]/.test(text) &&
            /\s[-–—|:]\s/.test(text);
        if (isLocation) {
            location = text;
            if (!locations.includes(text))
                locations.push(text);
            continue;
        }
        const comma = /^(.{2,48}?),\s*(.{2,60})$/.exec(text);
        if (comma && plausiblePerson(comma[1]) && ROLE_WORDS.test(comma[2])) {
            staff.push({ name: comma[1].trim(), role: comma[2].trim(), tier: null, location, quote: text, shape: 'name_comma_role', level: headings[i].level });
            continue;
        }
        const dash = /^(.{2,48}?)\s*[–—-]\s*(.{2,60})$/.exec(text);
        if (dash && plausiblePerson(dash[1]) && ROLE_WORDS.test(dash[2])) {
            staff.push({ name: dash[1].trim(), role: dash[2].trim(), tier: null, location, quote: text, shape: 'name_dash_role', level: headings[i].level });
            continue;
        }
        if (ROLE_WORDS.test(text) && text.length <= 60) {
            const previous = staff[staff.length - 1];
            if (previous && !previous.role && headings[i - 1]?.text === previous.name) {
                previous.role = text;
                previous.shape = 'two_headings';
                previous.quote = `${previous.name} — ${text}`;
                continue;
            }
            if (roleOnly(text))
                continue;
        }
        if (!plausiblePerson(text))
            continue;
        const bare = text.trim();
        if (bare.split(/\s+/).length > 3)
            continue;
        if (/[&,\/]|\d/.test(bare))
            continue;
        if (capStyle(bare) === 'sentence')
            continue;
        staff.push({ name: bare, role: null, tier: null, location, quote: text, shape: 'name_only', level: headings[i].level });
    }
    const seen = new Set<string>();
    const unique = staff.filter((s) => {
        const key = s.name.toLowerCase().replace(/[^a-z]/g, '');
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    return { staff: keepHomogeneousBareNames(unique), url: input.url, locations };
}
export function keepHomogeneousBareNames(staff: readonly StaffMember[]): StaffMember[] {
    const bare = staff.filter((s) => !s.role);
    if (bare.length < 3)
        return staff.filter((s) => !!s.role);
    const groups = new Map<string, StaffMember[]>();
    for (const person of bare) {
        const key = `${person.level}|${Math.min(person.name.split(/\s+/).length, 3)}`;
        groups.set(key, [...(groups.get(key) ?? []), person]);
    }
    const modal = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const kept = modal.length >= 3 ? modal : [];
    const keptSet = new Set(kept);
    return staff.filter((s) => !!s.role || keptSet.has(s));
}
export function matchStaffToTiers(staff: StaffMember[], tiers: readonly string[]): number {
    if (!tiers.length)
        return 0;
    const normalised = tiers
        .map((t) => ({ tier: t, key: t.toLowerCase().replace(/\s+(?:i{1,3}|\d+)$/, '').trim() }))
        .filter((t) => t.key.length >= 4)
        .sort((a, b) => b.key.length - a.key.length);
    let matched = 0;
    for (const person of staff) {
        if (!person.role)
            continue;
        const role = person.role.toLowerCase();
        const hit = normalised.find((t) => role.includes(t.key));
        if (hit) {
            person.tier = hit.tier;
            matched += 1;
        }
    }
    return matched;
}
const TEAM_PAGES = new Set(['team', 'about']);
export function readStaffAcross(pages: {
    url: string;
    html: string;
    kind?: string;
}[], businessName?: string): StaffReading | null {
    const readings = pages
        .filter((p) => TEAM_PAGES.has(p.kind ?? ''))
        .map((p) => ({ reading: readStaff({ html: p.html, url: p.url, businessName }), kind: p.kind ?? '' }));
    const best = readings
        .filter((r) => r.reading.staff.length > 0)
        .sort((a, b) => b.reading.staff.length - a.reading.staff.length ||
        (a.kind === 'team' ? -1 : b.kind === 'team' ? 1 : 0))[0];
    return best ? best.reading : null;
}
