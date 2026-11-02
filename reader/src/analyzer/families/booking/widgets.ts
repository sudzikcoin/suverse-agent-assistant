export type ReadableThing = 'services' | 'prices' | 'durations' | 'staff' | 'slots';
export type Proof = 'fixture' | 'public_unverified' | 'login';
export type BookingProvider = {
    name: string;
    label: string;
    patterns: RegExp[];
    idFrom?: {
        pattern: RegExp;
        parts: readonly string[];
    };
    readable: Readonly<Record<ReadableThing, Proof>>;
    note: string;
};
export const BOOKING_PROVIDERS: readonly BookingProvider[] = [
    {
        name: 'square_appointments',
        label: 'Square Appointments',
        patterns: [
            /squareup\.com\/appointments/i,
            /app\.squareup\.com\/appointments/i,
            /book\.squareup\.com/i,
            /square\.site\/book/i,
            /squareupsandbox\.com\/appointments/i,
            /\bsquare-?appointments\b/i,
        ],
        idFrom: {
            pattern: /squareup\.com\/appointments\/(?:book|buyer\/widget)\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?/i,
            parts: ['merchant_id', 'location_id'],
        },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Square publishes the whole menu — service, price, duration, staff and the next open times — on an open buyer page. Not one Tampa fixture uses it, so every cell here is documentation and not a reading.',
    },
    {
        name: 'vagaro',
        label: 'Vagaro',
        patterns: [/\bvagaro\.com/i, /www\.vagaro\.com\/[a-z0-9]/i, /vagaro\.com\/us\d+/i, /\bvagaroWidget\b/i, /data-vagaro/i],
        idFrom: { pattern: /vagaro\.com\/(?:us\d+\/)?([a-z0-9][a-z0-9._-]{2,})/i, parts: ['merchant_slug'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Vagaro\'s business page lists services with price and length and a staff picker, all without an account. Absent from the Tampa fixtures.',
    },
    {
        name: 'booksy',
        label: 'Booksy',
        patterns: [/\bbooksy\.com/i, /[a-z0-9-]+\.booksy\.com/i, /booksy\.com\/en-us\/\d+_/i, /\bBooksyWidget\b/i],
        idFrom: {
            pattern: /booksy\.com\/[a-z-]+\/(\d+)_([a-z0-9-]+)_([a-z0-9-]+)_(\d+)_([a-z0-9-]+)/i,
            parts: ['merchant_id', 'merchant_slug', 'booksy_trade', 'city_id', 'city'],
        },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'fixture', slots: 'public_unverified' },
        note: 'Staff is `fixture`: exotic-cutz links THREE Booksy merchants from one shop page, one per barber renting a chair, so the staff list is readable from the salon\'s own HTML without touching Booksy. The menu itself is on Booksy\'s open business page, which we did not fetch.',
    },
    {
        name: 'fresha',
        label: 'Fresha',
        patterns: [/\bfresha\.com/i, /www\.fresha\.com\/book-now/i, /\bfreshaWidget\b/i, /partners\.fresha\.com/i],
        idFrom: {
            pattern: /fresha\.com\/(?:book-now|a)\/([a-z0-9-]+?)-([a-z0-9]{6,})(?:\/|\?|$)/i,
            parts: ['merchant_slug', 'merchant_id'],
        },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'One Tampa fixture (nini-nails) links `fresha.com/book-now/nini-nails-salon-rbi5b4z9/services?lid=544564&pId=509106` — the slug, the merchant id, a location id and a partner id, all from the href. Fresha\'s booking page is open; we did not read it.',
    },
    {
        name: 'mindbody',
        label: 'Mindbody',
        patterns: [/mindbodyonline\.com/i, /clients\.mindbodyonline\.com/i, /\bhealcode\b/i, /widgets\.mindbodyonline\.com/i, /brandedweb\.mindbodyonline\.com/i, /\bmindbody-widget\b/i],
        idFrom: { pattern: /(?:studioid|site_?id)[=:]\s*"?(\d+)/i, parts: ['studio_id'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Mindbody\'s Healcode widgets embed a `studioid` in the page, which is the merchant key. Absent from the Tampa fixtures.',
    },
    {
        name: 'glossgenius',
        label: 'GlossGenius',
        patterns: [/glossgenius\.com/i, /\bglossgenius\.app/i, /book\.glossgenius\.com/i, /\bGlossGeniusWidget\b/i],
        idFrom: { pattern: /glossgenius\.(?:com|app)\/(?:book\/)?([a-z0-9][a-z0-9._-]{2,})/i, parts: ['merchant_slug'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'login', slots: 'public_unverified' },
        note: 'GlossGenius is a single-practitioner tool, so `staff` is `login` by construction: there is no staff list to read, the merchant IS the staff. Absent from the Tampa fixtures.',
    },
    {
        name: 'calendly',
        label: 'Calendly',
        patterns: [/\bcalendly\.com/i, /assets\.calendly\.com/i, /\bCalendly\b\s*\./, /calendly-inline-widget/i, /data-url="[^"]*calendly/i],
        idFrom: { pattern: /calendly\.com\/([a-z0-9][a-z0-9._-]+)(?:\/([a-z0-9][a-z0-9._-]+))?/i, parts: ['account', 'event_type'] },
        readable: { services: 'public_unverified', prices: 'login', durations: 'public_unverified', staff: 'login', slots: 'public_unverified' },
        note: 'A Calendly event type has a name and a length and no price — `prices: login` means «this system has no price to give», not «it is hidden». Absent from the Tampa fixtures.',
    },
    {
        name: 'acuity',
        label: 'Acuity Scheduling',
        patterns: [/acuityscheduling\.com/i, /app\.acuityscheduling\.com/i, /squarespacescheduling\.com/i, /embed\.acuityscheduling\.com/i, /\bAcuityEmbed\b/i],
        idFrom: { pattern: /(?:acuityscheduling|squarespacescheduling)\.com\/schedule\.php\?owner=(\d+)/i, parts: ['owner_id'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Acuity (now Squarespace Scheduling) puts the owner id in the embed query string. Absent from the Tampa fixtures.',
    },
    {
        name: 'styleseat',
        label: 'StyleSeat',
        patterns: [/styleseat\.com/i, /www\.styleseat\.com\/m\//i, /\bStyleSeatWidget\b/i],
        idFrom: { pattern: /styleseat\.com\/m\/[a-z]\/([a-z0-9-]+)/i, parts: ['pro_slug'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'login', slots: 'public_unverified' },
        note: 'StyleSeat is per-professional, so like GlossGenius there is no staff list. Absent from the Tampa fixtures.',
    },
    {
        name: 'zenoti',
        label: 'Zenoti',
        patterns: [/[a-z0-9-]+\.zenoti\.com/i, /\bzenoti\.com\/webstore/i, /\bZenotiWidget\b/i, /zenoti\.com\/OnlineBooking/i],
        idFrom: {
            pattern: /([a-z0-9-]+)\.zenoti\.com\/webstore(?:New)?\/services(?:\/([0-9a-f-]{36}))?/i,
            parts: ['merchant_subdomain', 'service_id'],
        },
        readable: { services: 'fixture', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'monaco-hair-salon links `monacosalon.zenoti.com/webstoreNew/services/<guid>` with the service name as the anchor text — a named, identified service without leaving the salon\'s site.',
    },
    {
        name: 'phorest',
        label: 'Phorest',
        patterns: [/booking-widget\.phorestcdn\.com/i, /phorest\.com\/salons?\//i, /\bphorest\.com/i, /\bPhorestWidget\b/i, /obwidget\.bundle\.js/i],
        idFrom: { pattern: /phorest\.com\/salons?\/([a-z0-9-]+)/i, parts: ['salon_slug'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'mystichair loads `obwidget.bundle.js` from Phorest\'s CDN and links a gift-card page carrying the salon slug. The widget renders in JavaScript, so nothing of the menu is in the HTML we hold.',
    },
    {
        name: 'bookedby',
        label: 'BookedBy',
        patterns: [/[a-z0-9-]+\.bookedby\.com/i, /\bbookedby\.com/i, /\bBookedByWidget\b/i],
        idFrom: { pattern: /([a-z0-9-]+)\.bookedby\.com\/new-order\/select-service\?storeUid(?:%3D|=)([0-9a-f-]{36})/i, parts: ['merchant_subdomain', 'store_uid'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'the-heritage-club links three distinct `storeUid`s from one page — three locations, readable from the href. The menu itself is behind the widget.',
    },
    {
        name: 'boulevard',
        label: 'Boulevard',
        patterns: [/joinblvd\.com/i, /getboulevard\.com/i, /dashboard\.boulevard\.io/i, /\bblvd-?widget\b/i],
        idFrom: { pattern: /(?:joinblvd|boulevard)\.com\/(?:b\/)?([a-z0-9][a-z0-9._-]{2,})/i, parts: ['merchant_slug'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Not in the Tampa fixtures; included because Boulevard is the system the larger US salons move to from Mindbody, and its link shape is the same question as Zenoti\'s.',
    },
    {
        name: 'schedulicity',
        label: 'Schedulicity',
        patterns: [/schedulicity\.com/i, /\bSchedulicityWidget\b/i],
        idFrom: { pattern: /schedulicity\.com\/scheduling\/([a-z0-9]+)/i, parts: ['merchant_id'] },
        readable: { services: 'public_unverified', prices: 'public_unverified', durations: 'public_unverified', staff: 'public_unverified', slots: 'public_unverified' },
        note: 'Not in the Tampa fixtures.',
    },
];
export type WidgetSignal = {
    provider: string;
    evidence: string;
    where: string | null;
    ids: Record<string, string>;
    url: string | null;
};
export type WidgetDetection = {
    provider: string | null;
    signals: WidgetSignal[];
    book_url: string | null;
    merchants: {
        provider: string;
        ids: Record<string, string>;
        url: string;
    }[];
};
const MAX_EVIDENCE = 160;
export function detectBookingWidgets(pages: {
    url: string;
    html: string;
}[]): WidgetDetection {
    const signals: WidgetSignal[] = [];
    const merchants: WidgetDetection['merchants'] = [];
    const seenMerchant = new Set<string>();
    for (const provider of BOOKING_PROVIDERS) {
        let matched: WidgetSignal | null = null;
        for (const page of pages) {
            for (const pattern of provider.patterns) {
                const hit = pattern.exec(page.html);
                if (!hit)
                    continue;
                if (!matched) {
                    matched = {
                        provider: provider.name,
                        evidence: hit[0].slice(0, MAX_EVIDENCE),
                        where: page.url,
                        ids: {},
                        url: null,
                    };
                }
                break;
            }
            if (provider.idFrom) {
                const providerIsHere = !!matched && matched.where === page.url;
                for (const candidate of urlsIn(page.html)) {
                    if (!providerIsHere && !provider.patterns.some((rx) => rx.test(candidate)))
                        continue;
                    if (isAsset(candidate))
                        continue;
                    const m = provider.idFrom.pattern.exec(candidate);
                    if (!m)
                        continue;
                    const ids: Record<string, string> = {};
                    provider.idFrom.parts.forEach((part, i) => { const v = m[i + 1]; if (v)
                        ids[part] = v; });
                    if (!Object.keys(ids).length)
                        continue;
                    if (!matched) {
                        matched = { provider: provider.name, evidence: m[0].slice(0, MAX_EVIDENCE), where: page.url, ids, url: candidate };
                    }
                    else if (!matched.url) {
                        matched.url = candidate;
                        matched.ids = ids;
                    }
                    const key = `${provider.name}:${Object.values(ids).join('|')}`;
                    if (!seenMerchant.has(key)) {
                        seenMerchant.add(key);
                        merchants.push({ provider: provider.name, ids, url: candidate });
                    }
                }
            }
        }
        if (matched)
            signals.push(matched);
    }
    const provider = signals.length ? signals[0].provider : null;
    const book_url = signals.find((s) => s.url)?.url ?? null;
    return { provider, signals, book_url, merchants };
}
export function isAsset(url: string): boolean {
    try {
        const path = new URL(url).pathname.toLowerCase();
        return /\.(js|mjs|cjs|css|map|json|png|jpe?g|gif|svg|webp|woff2?|ttf|ico)$/.test(path);
    }
    catch {
        return /\.(js|mjs|cjs|css|map|json)(\?|$)/i.test(url);
    }
}
export function urlsIn(html: string): string[] {
    const out = new Set<string>();
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>()\\]+/gi)) {
        out.add(m[0].replace(/[.,;:!?]+$/, '').replace(/&amp;/g, '&'));
    }
    for (const m of html.matchAll(/(?:src|href)\s*=\s*["']\/\/([^\s"'<>]+)["']/gi))
        out.add(`https://${m[1]}`);
    return [...out];
}
export function providerByName(name: string | null): BookingProvider | null {
    if (!name)
        return null;
    return BOOKING_PROVIDERS.find((p) => p.name === name) ?? null;
}
export function readableFor(detection: WidgetDetection): Record<ReadableThing, Proof> | null {
    const provider = providerByName(detection.provider);
    return provider ? provider.readable : null;
}
