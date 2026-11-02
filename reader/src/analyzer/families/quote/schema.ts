import { normalizeForQuote } from '../../profile/schema';
import type { FieldRole, FoundForm } from './adapters/forms';
import type { HostedDoor } from './adapters/hosted';
import type { IntakeHit } from './intake';
import type { QuoteTrade, QuoteUnit } from './niches';
export type QuoteFieldSource = 'places' | 'jsonld' | 'page' | 'form' | 'hosted' | 'vendor' | 'ai';
export type QuoteEvidence = {
    source: QuoteFieldSource;
    quote: string | null;
    url: string | null;
};
export const MAX_QUOTE = 300;
export type ServicePrice = {
    amount: number;
    amount_max: number | null;
    currency: string;
    unit: QuoteUnit;
    from: boolean;
    minimum: string | null;
};
export type QuoteService = {
    name: string;
    price: ServicePrice | null;
    quote: string | null;
    url: string | null;
};
export type ServiceArea = {
    kind: 'counties';
    counties: string[];
} | {
    kind: 'cities';
    cities: string[];
} | {
    kind: 'zips';
    zips: string[];
} | {
    kind: 'radius_miles';
    radius_miles: number;
};
export type RequestQuoteAbility = {
    url: string | null;
    via: string;
    third_party: boolean;
    needs: FieldRole[];
    needs_source: 'page' | 'vendor_known';
    needs_account: boolean | null;
    accepts_photos: boolean;
};
export type BookAbility = {
    url: string | null;
    via: string;
    needs: FieldRole[];
    needs_source: 'page' | 'vendor_known';
    needs_account: boolean | null;
};
export type Credential = {
    kind: 'fl_plumbing' | 'fl_contractor' | 'fl_electrical' | 'fl_hvac' | 'fl_mover' | 'usdot' | 'mc' | 'insurance' | 'bond' | 'other';
    number: string | null;
    label: string;
    quote: string | null;
    url: string | null;
};
export type QuoteCardFields = {
    trade: QuoteTrade | null;
    services: QuoteService[];
    service_area: ServiceArea | null;
    request_quote: RequestQuoteAbility | null;
    book: BookAbility | null;
    credentials: Credential[];
    phone: string | null;
    email: string | null;
    hours: Record<string, string> | null;
    timezone: string | null;
};
export const QUOTE_CARD_FIELDS: readonly (keyof QuoteCardFields)[] = [
    'trade', 'services', 'service_area', 'request_quote', 'book', 'credentials',
    'phone', 'email', 'hours', 'timezone',
];
export type QuoteCard = {
    fields: QuoteCardFields;
    evidence: Record<string, QuoteEvidence>;
    intake: IntakeHit[];
    forms: FoundForm[];
    hosted: HostedDoor[];
};
export function emptyCard(): QuoteCard {
    return {
        fields: {
            trade: null, services: [], service_area: null, request_quote: null, book: null,
            credentials: [], phone: null, email: null, hours: null, timezone: null,
        },
        evidence: {},
        intake: [],
        forms: [],
        hosted: [],
    };
}
export function fieldKnown(fields: QuoteCardFields, name: keyof QuoteCardFields): boolean {
    const value = fields[name];
    if (value === null || value === undefined)
        return false;
    if (Array.isArray(value))
        return value.length > 0;
    return true;
}
export function missingFields(card: QuoteCard): (keyof QuoteCardFields)[] {
    return QUOTE_CARD_FIELDS.filter((f) => !fieldKnown(card.fields, f));
}
export function fieldsBySource(card: QuoteCard): Record<QuoteFieldSource, number> {
    const tally: Record<QuoteFieldSource, number> = { places: 0, jsonld: 0, page: 0, form: 0, hosted: 0, vendor: 0, ai: 0 };
    for (const field of QUOTE_CARD_FIELDS) {
        if (!fieldKnown(card.fields, field))
            continue;
        const source = card.evidence[field]?.source;
        if (source)
            tally[source] += 1;
    }
    return tally;
}
export type AuditProblem = {
    field: string;
    why: string;
};
export function auditCard(card: QuoteCard): AuditProblem[] {
    const problems: AuditProblem[] = [];
    for (const field of QUOTE_CARD_FIELDS) {
        const known = fieldKnown(card.fields, field);
        const evidence = card.evidence[field];
        if (known && !evidence) {
            problems.push({ field, why: 'has a value and no evidence' });
            continue;
        }
        if (!known && evidence) {
            problems.push({ field, why: 'has evidence and no value' });
            continue;
        }
        if (!known || !evidence)
            continue;
        const needsQuote = evidence.source === 'page' || evidence.source === 'ai';
        if (needsQuote && !evidence.quote)
            problems.push({ field, why: `source ${evidence.source} with no quote` });
        if (needsQuote && !evidence.url)
            problems.push({ field, why: `source ${evidence.source} with no page` });
        if (evidence.quote && evidence.quote.length > MAX_QUOTE)
            problems.push({ field, why: `quote longer than ${MAX_QUOTE}` });
    }
    const q = card.fields.request_quote;
    if (q && q.needs_source === 'vendor_known' && card.evidence.request_quote?.source === 'form') {
        problems.push({ field: 'request_quote', why: 'a vendor field list recorded as read from the page' });
    }
    return problems;
}
export type QuotePage = {
    url: string;
    text: string;
};
export function valueInQuote(field: keyof QuoteCardFields, value: unknown, quote: string | null): {
    ok: true;
} | {
    ok: false;
    why: string;
} {
    const hay = normalizeForQuote(quote ?? '');
    if (!hay)
        return { ok: true };
    const has = (needle: string): boolean => hay.includes(normalizeForQuote(needle));
    if (field === 'service_area') {
        const area = value as ServiceArea | null;
        if (!area)
            return { ok: true };
        if (area.kind === 'counties') {
            const missing = area.counties.filter((c) => !has(c));
            if (missing.length)
                return { ok: false, why: `the quoted sentence does not name ${missing.slice(0, 3).join(', ')}` };
        }
        if (area.kind === 'cities') {
            const missing = area.cities.filter((c) => !has(c));
            if (missing.length)
                return { ok: false, why: `the quoted sentence does not name ${missing.slice(0, 3).join(', ')}` };
        }
        if (area.kind === 'zips') {
            const missing = area.zips.filter((z) => !has(z));
            if (missing.length)
                return { ok: false, why: `${missing.length} of the ${area.zips.length} postcodes are not in the quoted sentence (${missing.slice(0, 3).join(', ')}…)` };
        }
        if (area.kind === 'radius_miles' && !has(String(area.radius_miles))) {
            return { ok: false, why: `the quoted sentence does not contain the number ${area.radius_miles}` };
        }
        return { ok: true };
    }
    if (field === 'services') {
        const service = value as QuoteService | null;
        if (!service?.price)
            return { ok: true };
        const numbers = [service.price.amount, ...(service.price.amount_max !== null ? [service.price.amount_max] : [])];
        const missing = numbers.filter((n) => !has(String(n)) && !has(n.toFixed(2)) && !has(n.toLocaleString('en-US')));
        if (missing.length)
            return { ok: false, why: `«${service.name}» is priced ${missing.join('–')} and the quoted sentence does not contain it` };
        return { ok: true };
    }
    if (field === 'credentials') {
        const cred = value as Credential | null;
        if (!cred?.number)
            return { ok: true };
        const bare = cred.number.replace(/[^A-Za-z0-9]/gi, '').toLowerCase();
        const hayBare = hay.replace(/[^a-z0-9]/gi, '');
        if (!bare)
            return { ok: true };
        if (!has(cred.number) && !hayBare.includes(bare))
            return { ok: false, why: `the quoted sentence does not contain ${cred.number}` };
        return { ok: true };
    }
    if (field === 'phone') {
        const digits = String(value ?? '').replace(/\D/g, '');
        if (!digits)
            return { ok: true };
        if (!hay.replace(/\D/g, '').includes(digits))
            return { ok: false, why: `the quoted sentence does not contain ${value}` };
        return { ok: true };
    }
    if (field === 'email') {
        const text = String(value ?? '');
        if (text && !has(text))
            return { ok: false, why: `the quoted sentence does not contain ${text}` };
        return { ok: true };
    }
    return { ok: true };
}
export type DroppedField = {
    field: string;
    why: string;
};
export function verifyCard(card: QuoteCard, pages: QuotePage[]): {
    card: QuoteCard;
    dropped: DroppedField[];
} {
    const haystacks = pages.map((p) => ({ url: p.url, text: normalizeForQuote(p.text) }));
    const out: QuoteCard = { ...card, fields: { ...card.fields }, evidence: { ...card.evidence } };
    const dropped: DroppedField[] = [];
    const blank = emptyCard();
    const drop = (field: keyof QuoteCardFields, why: string): void => {
        out.fields[field] = blank.fields[field] as never;
        delete out.evidence[field];
        dropped.push({ field, why });
    };
    if (out.fields.services.length) {
        const kept: QuoteService[] = [];
        for (const service of out.fields.services) {
            const quote = normalizeForQuote(service.quote ?? '');
            if (quote.length < 3) {
                dropped.push({ field: `services[${service.name}]`, why: 'no quote was given for it' });
                continue;
            }
            const hit = haystacks.find((h) => h.text.includes(quote));
            if (!hit) {
                dropped.push({ field: `services[${service.name}]`, why: `the quote «${(service.quote ?? '').slice(0, 80)}» is on none of the pages we read` });
                continue;
            }
            const supported = valueInQuote('services', service, service.quote);
            if (!supported.ok) {
                dropped.push({ field: `services[${service.name}]`, why: `the quote is real but does not support the value: ${supported.why}` });
                continue;
            }
            kept.push(hit.url !== service.url ? { ...service, url: hit.url } : service);
        }
        out.fields.services = kept;
        if (!kept.length)
            delete out.evidence.services;
    }
    if (out.fields.credentials.length) {
        const kept: Credential[] = [];
        for (const cred of out.fields.credentials) {
            const quote = normalizeForQuote(cred.quote ?? '');
            if (quote.length < 3) {
                dropped.push({ field: `credentials[${cred.number ?? cred.kind}]`, why: 'no quote was given for it' });
                continue;
            }
            const hit = haystacks.find((h) => h.text.includes(quote));
            if (!hit) {
                dropped.push({ field: `credentials[${cred.number ?? cred.kind}]`, why: `the quote «${(cred.quote ?? '').slice(0, 80)}» is on none of the pages we read` });
                continue;
            }
            const supported = valueInQuote('credentials', cred, cred.quote);
            if (!supported.ok) {
                dropped.push({ field: `credentials[${cred.number ?? cred.kind}]`, why: `the quote is real but does not support the value: ${supported.why}` });
                continue;
            }
            kept.push(hit.url !== cred.url ? { ...cred, url: hit.url } : cred);
        }
        out.fields.credentials = kept;
        if (!kept.length)
            delete out.evidence.credentials;
    }
    for (const field of QUOTE_CARD_FIELDS) {
        if (field === 'services' || field === 'credentials')
            continue;
        const evidence = out.evidence[field];
        if (!evidence)
            continue;
        if (evidence.source !== 'page' && evidence.source !== 'ai')
            continue;
        if (!fieldKnown(out.fields, field)) {
            delete out.evidence[field];
            continue;
        }
        const quote = normalizeForQuote(evidence.quote ?? '');
        if (quote.length < 3) {
            drop(field, 'no quote was given for it');
            continue;
        }
        const hit = haystacks.find((h) => h.text.includes(quote));
        if (!hit) {
            drop(field, `the quote «${(evidence.quote ?? '').slice(0, 80)}» is on none of the pages we read`);
            continue;
        }
        const supported = valueInQuote(field, out.fields[field], evidence.quote);
        if (!supported.ok) {
            drop(field, `the quote is real but does not support the value: ${supported.why}`);
            continue;
        }
        if (hit.url !== evidence.url)
            out.evidence[field] = { ...evidence, url: hit.url };
    }
    return { card: out, dropped };
}