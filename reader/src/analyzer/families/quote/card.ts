import { detectIntake, onlineChannels, telLinks, type IntakeHit } from './intake';
import { bestQuoteForm, readForms, type FoundForm } from './adapters/forms';
import { hostedDoors, type HostedDoor } from './adapters/hosted';
import { readServices } from './services';
import { onlyVagueArea, readServiceArea } from './area';
import { readCredentials } from './licences';
import { tradeOfNiche, type QuoteTrade } from './niches';
import { pageText } from './text';
import { auditCard, emptyCard, verifyCard, MAX_QUOTE, type AuditProblem, type BookAbility, type DroppedField, type QuoteCard, type RequestQuoteAbility, } from './schema';
export type CardInput = {
    niche: string;
    pages: {
        url: string;
        html: string;
    }[];
    places?: {
        phone?: string | null;
        address?: string | null;
        opening_hours?: unknown;
        timezone?: string | null;
    };
};
export type BuiltCard = {
    card: QuoteCard;
    dropped: DroppedField[];
    problems: AuditProblem[];
    gaps: {
        field: string;
        why: string;
    }[];
};
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
export function dedupeForms(forms: FoundForm[]): FoundForm[] {
    const out = new Map<string, FoundForm>();
    for (const form of forms) {
        const key = [form.builder, form.handle ?? '', form.purpose, form.fields.map((f) => `${f.name}:${f.role}`).join(',')].join('|');
        if (!out.has(key))
            out.set(key, form);
    }
    return [...out.values()];
}
const NOT_A_BUSINESS_EMAIL = /@(?:example|sentry|wixpress|godaddy|squarespace|shopify|googlemail|gravatar|sentry\.io|2x|w3\.org)\b|\.(?:png|jpe?g|gif|webp|svg)$/i;
export function buildCard(input: CardInput): BuiltCard {
    const card = emptyCard();
    const gaps: {
        field: string;
        why: string;
    }[] = [];
    const trade: QuoteTrade | null = tradeOfNiche(input.niche);
    card.intake = detectIntake({ pages: input.pages });
    card.forms = dedupeForms(input.pages.flatMap((p) => readForms(p.html, p.url)));
    card.hosted = hostedDoors(card.intake);
    for (const form of card.forms) {
        if (form.purpose !== 'quote' && form.purpose !== 'book')
            continue;
        card.intake.push({
            system: 'own_form',
            ability: form.purpose === 'book' ? 'book' : 'request_quote',
            third_party: false,
            evidence: `${form.builder} form on ${new URL(form.page_url).pathname}: ${form.fields.length} field(s)`,
            url: form.page_url,
            needs_account: false,
        });
    }
    if (trade) {
        card.fields.trade = trade;
        card.evidence.trade = { source: 'places', quote: `the campaign's niche «${input.niche}» is the ${trade} trade`, url: null };
    }
    else {
        gaps.push({ field: 'trade', why: `«${input.niche}» is not a trade of the quote family` });
    }
    const ownForm = bestQuoteForm(card.forms.filter((f) => f.purpose === 'quote' || f.purpose === 'contact'));
    const ownHosted = card.hosted.filter((h) => !h.third_party && (h.ability === 'request_quote' || h.ability === 'instant_quote'));
    const marketplace = card.hosted.filter((h) => h.third_party);
    const requestQuote = ((): {
        ability: RequestQuoteAbility;
        source: 'form' | 'hosted';
        quote: string | null;
        url: string | null;
    } | null => {
        if (ownForm && ownForm.purpose === 'quote') {
            return {
                ability: {
                    url: ownForm.page_url,
                    via: `own_form:${ownForm.builder}`,
                    third_party: false,
                    needs: [...new Set(ownForm.fields.filter((f) => f.role !== 'consent' && f.role !== 'referral').map((f) => f.role))],
                    needs_source: 'page',
                    needs_account: false,
                    accepts_photos: ownForm.fields.some((f) => f.role === 'photos'),
                },
                source: 'form',
                quote: null,
                url: ownForm.page_url,
            };
        }
        const hosted = ownHosted[0];
        if (hosted) {
            return {
                ability: {
                    url: hosted.url,
                    via: hosted.system,
                    third_party: false,
                    needs: hosted.needs,
                    needs_source: 'vendor_known',
                    needs_account: hosted.needs_account,
                    accepts_photos: hosted.needs.includes('photos'),
                },
                source: 'hosted',
                quote: null,
                url: hosted.url,
            };
        }
        if (ownForm) {
            return {
                ability: {
                    url: ownForm.page_url,
                    via: `own_form:${ownForm.builder}`,
                    third_party: false,
                    needs: [...new Set(ownForm.fields.filter((f) => f.role !== 'consent' && f.role !== 'referral').map((f) => f.role))],
                    needs_source: 'page',
                    needs_account: false,
                    accepts_photos: ownForm.fields.some((f) => f.role === 'photos'),
                },
                source: 'form',
                quote: null,
                url: ownForm.page_url,
            };
        }
        const market = marketplace[0];
        if (market) {
            return {
                ability: {
                    url: market.url,
                    via: market.system,
                    third_party: true,
                    needs: market.needs,
                    needs_source: 'vendor_known',
                    needs_account: market.needs_account,
                    accepts_photos: market.needs.includes('photos'),
                },
                source: 'hosted',
                quote: null,
                url: market.url,
            };
        }
        return null;
    })();
    if (requestQuote) {
        card.fields.request_quote = requestQuote.ability;
        card.evidence.request_quote = { source: requestQuote.source, quote: null, url: requestQuote.url };
    }
    else {
        const phones = card.intake.filter((h) => h.system === 'phone');
        gaps.push({
            field: 'request_quote',
            why: phones.length
                ? 'no form and no booking widget on any page we read — the only door is the telephone'
                : 'no form, no widget and no telephone link on any page we read',
        });
    }
    const bookHosted = card.hosted.filter((h) => !h.third_party && h.ability === 'book');
    const bookForm = card.forms.find((f) => f.purpose === 'book');
    const book: {
        ability: BookAbility;
        source: 'form' | 'hosted';
        url: string | null;
    } | null = bookHosted[0]
        ? {
            ability: {
                url: bookHosted[0].url, via: bookHosted[0].system, needs: bookHosted[0].needs,
                needs_source: 'vendor_known', needs_account: bookHosted[0].needs_account,
            },
            source: 'hosted', url: bookHosted[0].url,
        }
        : bookForm
            ? {
                ability: {
                    url: bookForm.page_url, via: `own_form:${bookForm.builder}`,
                    needs: [...new Set(bookForm.fields.filter((f) => f.role !== 'consent').map((f) => f.role))],
                    needs_source: 'page', needs_account: false,
                },
                source: 'form', url: bookForm.page_url,
            }
            : null;
    if (book) {
        card.fields.book = book.ability;
        card.evidence.book = { source: book.source, quote: null, url: book.url };
    }
    else {
        gaps.push({ field: 'book', why: 'nothing on these pages takes a slot without a conversation first' });
    }
    if (trade) {
        const services = readServices(input.pages, trade);
        if (services.length) {
            card.fields.services = services;
            const priced = services.filter((s) => s.price).length;
            card.evidence.services = {
                source: 'page',
                quote: services[0].quote,
                url: services[0].url,
            };
            if (!priced)
                gaps.push({ field: 'services.price', why: `${services.length} service(s) named and not one price published` });
        }
        else {
            gaps.push({ field: 'services', why: 'no service of this trade is named in words on any page we read' });
        }
    }
    const area = readServiceArea(input.pages);
    if (area) {
        card.fields.service_area = area.area;
        card.evidence.service_area = { source: 'page', quote: area.quote.slice(0, MAX_QUOTE), url: area.url };
    }
    else {
        const checker = card.intake.find((h) => h.system === 'service_area_checker');
        const vague = onlyVagueArea(input.pages);
        gaps.push({
            field: 'service_area',
            why: checker
                ? `no page names a county, a town list, three postcodes or a radius — but the site embeds a postcode checker (${checker.url ?? checker.evidence}), which answers one postcode at a time`
                : vague
                    ? `the only thing said about the area has no boundary in it: «${vague.slice(0, 120)}»`
                    : 'no page names a county, a town list, three postcodes or a radius',
        });
    }
    const creds = readCredentials(input.pages);
    if (creds.length) {
        card.fields.credentials = creds.map(({ kind, number, label, quote, url }) => ({
            kind, number, label, quote: quote.slice(0, MAX_QUOTE), url,
        }));
        card.evidence.credentials = { source: 'page', quote: creds[0].quote.slice(0, MAX_QUOTE), url: creds[0].url };
    }
    else {
        gaps.push({ field: 'credentials', why: 'no licence number and no claim of being licensed or insured' });
    }
    if (input.places?.phone) {
        card.fields.phone = input.places.phone;
        card.evidence.phone = { source: 'places', quote: 'the telephone number Google publishes for this place', url: null };
    }
    else {
        const tel = input.pages.flatMap((p) => telLinks(p.html))[0] ?? null;
        if (tel) {
            card.fields.phone = tel;
            card.evidence.phone = { source: 'form', quote: null, url: input.pages[0]?.url ?? null };
        }
        else {
            gaps.push({ field: 'phone', why: 'Places published no number and no page carries a tel: link' });
        }
    }
    for (const page of input.pages) {
        const m = EMAIL.exec(pageText(page.html));
        if (m && !NOT_A_BUSINESS_EMAIL.test(m[0])) {
            card.fields.email = m[0].toLowerCase();
            card.evidence.email = { source: 'page', quote: m[0], url: page.url };
            break;
        }
    }
    if (!card.fields.email)
        gaps.push({ field: 'email', why: 'no email address in the text of any page we read' });
    const weekly = (input.places?.opening_hours as {
        weekdayDescriptions?: unknown;
    } | null | undefined)?.weekdayDescriptions;
    if (!card.fields.hours && Array.isArray(weekly)) {
        const hours: Record<string, string> = {};
        for (const line of weekly) {
            const m = typeof line === 'string' ? /^([A-Za-z]+)\s*:\s*(.+)$/.exec(line.trim()) : null;
            if (m)
                hours[m[1].toLowerCase()] = m[2].replace(/[   ]/g, ' ').trim();
        }
        if (Object.keys(hours).length) {
            card.fields.hours = hours;
            card.evidence.hours = { source: 'places', quote: 'the opening hours Google publishes for this place', url: null };
        }
    }
    if (input.places?.timezone) {
        card.fields.timezone = input.places.timezone;
        card.evidence.timezone = { source: 'places', quote: 'derived from the postal address Google gave us', url: null };
    }
    const pages = input.pages.map((p) => ({ url: p.url, text: pageText(p.html) }));
    const verified = verifyCard(card, pages);
    return { card: verified.card, dropped: verified.dropped, problems: auditCard(verified.card), gaps };
}
export type { FoundForm, HostedDoor, IntakeHit };