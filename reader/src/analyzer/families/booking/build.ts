import { detectBookingWidgets, readableFor, providerByName, urlsIn } from './widgets';
import { readMenuAcross, type MenuService } from './menu';
import { readEnquiry, readPriceOnRequest } from './enquiry';
import { readStaffAcross, matchStaffToTiers } from './staff';
import { readJsonLd } from './adapters/jsonld';
import { readBooksy } from './adapters/booksy';
import { readZenoti } from './adapters/zenoti';
import { readFresha, freshaCapabilities } from './adapters/fresha';
import { linksOf } from '../../profile/pages';
import { detectChat } from '../../chat';
import { timezoneOf } from '../../timezone';
import { bookingNicheKey } from './niches';
import { bookingVerdict, servicePriceRange, toCardService, toCardStaff, type BookingCard, type BookingCapability, type BookingCardVerdict, type CardService, } from './schema';
export type BookingInput = {
    business: {
        name: string;
        place_id?: string | null;
        address?: string | null;
        phone?: string | null;
        website?: string | null;
        lat?: number | null;
        lng?: number | null;
        primary_type?: string | null;
        opening_hours?: unknown;
        niche?: string | null;
    };
    pages: {
        url: string;
        html: string;
        kind?: string;
    }[];
    platformMenus?: {
        provider: string;
        url: string;
        services: MenuService[];
    }[];
    read_at?: string;
};
export type BookingResult = {
    card: BookingCard;
    verdict: BookingCardVerdict;
};
export function buildBookingCard(input: BookingInput): BookingResult {
    const pages = input.pages;
    const evidence: BookingCard['evidence'] = {};
    const home = pages.find((p) => p.kind === 'home') ?? pages[0];
    const ld = home ? readJsonLd(home.html) : null;
    const ldElsewhere = ld && ld.hours ? null : pages.map((p) => ({ page: p, ld: readJsonLd(p.html) })).find((x) => x.ld.hours);
    const detection = detectBookingWidgets(pages.map((p) => ({ url: p.url, html: p.html })));
    const allUrls = [...new Set(pages.flatMap((p) => urlsIn(p.html)))];
    const allLinks = pages.flatMap((p) => linksOf(p.html, p.url));
    const booksy = readBooksy(allUrls);
    const zenoti = readZenoti(allLinks);
    const fresha = readFresha(allUrls);
    const menu = readMenuAcross(pages);
    const enquiry = readEnquiry(pages);
    const onRequest = readPriceOnRequest(pages);
    const team = readStaffAcross(pages, input.business.name);
    const tiers = menu?.services.find((s) => s.tiers)?.tiers ?? [];
    const tiered = team ? matchStaffToTiers(team.staff, tiers) : 0;
    const services: CardService[] = [];
    const platform = (input.platformMenus ?? []).find((m) => m.services.length > 0) ?? null;
    if (platform) {
        for (const item of platform.services)
            services.push({ ...toCardService(item, { book_url: platform.url }), source: 'widget' });
        evidence.services = { source: 'widget', quote: `${platform.provider}: ${platform.services.length} service(s)`, url: platform.url };
    }
    if (menu) {
        const fromPlatform = new Map(services.map((s) => [norm(s.name), s]));
        const byName = new Map(zenoti.services.map((s) => [norm(s.name), s]));
        for (const item of menu.services) {
            const same = fromPlatform.get(norm(item.name));
            if (same) {
                if (same.duration_min === null && item.duration_min !== null)
                    same.duration_min = item.duration_min;
                continue;
            }
            const deep = byName.get(norm(item.name));
            services.push(toCardService(item, { provider_service_id: deep?.service_id ?? null, book_url: deep?.url ?? null }));
        }
        if (!evidence.services)
            evidence.services = { source: 'html_menu', quote: menu.services[0]?.quote ?? null, url: menu.url };
    }
    if (ld?.services.length) {
        const have = new Set(services.map((s) => norm(s.name)));
        for (const service of ld.services) {
            if (have.has(norm(service.name)))
                continue;
            have.add(norm(service.name));
            services.push({
                name: service.name,
                price_from: service.price_from,
                price_to: null,
                from: false,
                currency: service.currency,
                duration_min: null,
                category: null,
                tiers: null,
                provider_service_id: null,
                book_url: service.url,
                quote: `schema.org Service: ${service.name}`,
                source: 'jsonld',
            });
        }
        if (!evidence.services)
            evidence.services = { source: 'jsonld', quote: `schema.org OfferCatalog, ${ld.services.length} service(s)`, url: home?.url ?? null };
    }
    const capabilities: BookingCapability[] = [];
    const doors: BookCapability['doors'] = [];
    for (const m of booksy)
        doors.push({ url: m.url, via: 'booksy', merchant_id: m.merchant_id, name_from_slug: m.name_from_slug });
    for (const l of freshaCapabilities(fresha).book)
        doors.push({ url: l.url, via: 'fresha', merchant_id: fresha.merchant_id, name_from_slug: null });
    if (zenoti.book_url)
        doors.push({ url: zenoti.book_url, via: 'zenoti', merchant_id: zenoti.merchant ?? null, name_from_slug: null });
    for (const merchant of detection.merchants) {
        if (['booksy', 'fresha', 'zenoti'].includes(merchant.provider))
            continue;
        doors.push({
            url: merchant.url,
            via: merchant.provider,
            merchant_id: Object.values(merchant.ids)[0] ?? null,
            name_from_slug: null,
        });
    }
    const ownBooking = pages.find((p) => p.kind === 'book');
    if (!doors.length && ld?.reserve_url)
        doors.push({ url: ld.reserve_url, via: 'own_site', merchant_id: null, name_from_slug: null });
    if (doors.length) {
        capabilities.push({ name: 'book', available: true, doors: dedupeDoors(doors), proof: 'fixture' });
        evidence.book = {
            source: doors[0].via === 'own_site' ? 'html_menu' : 'widget_link',
            quote: detection.signals.find((s) => s.provider === doors[0].via)?.evidence ?? null,
            url: doors[0].url,
        };
    }
    const provider = providerByName(detection.provider);
    if (provider) {
        const slots = provider.readable.slots;
        capabilities.push({
            name: 'check_availability',
            available: false,
            proof: slots,
            why: slots === 'login'
                ? `${provider.label} does not publish open times without an account`
                : `${provider.label} publishes open times on a page that needs no account, but nothing was fetched from its host — so this is documented, not measured`,
            url: detection.book_url,
        });
    }
    if (services.length) {
        capabilities.push({
            name: 'show_services',
            available: true,
            count: services.length,
            priced: services.filter((s) => s.price_from !== null).length,
            timed: services.filter((s) => s.duration_min !== null).length,
            source: platform ? 'widget' : menu ? 'html_menu' : 'jsonld',
            url: platform?.url ?? menu?.url ?? home?.url ?? null,
        });
    }
    if (enquiry.best || enquiry.channels.length) {
        capabilities.push({
            name: 'request_date',
            available: true,
            channels: enquiry.channels,
            url: enquiry.best?.url ?? null,
            action: enquiry.best?.action ?? null,
            asks_date: enquiry.best?.asks_date ?? false,
            date_evidence: enquiry.best?.date_evidence ?? null,
            fields: enquiry.best?.fields ?? [],
            phrases: enquiry.phrases,
            proof: 'fixture',
        });
        if (enquiry.best?.asks_date) {
            evidence.request_date = { source: 'html_menu', quote: enquiry.best.date_evidence, url: enquiry.best.url };
        }
    }
    if (onRequest) {
        evidence.price_on_request = { source: 'html_menu', quote: onRequest.quote, url: onRequest.url };
    }
    const phone = input.business.phone ?? ld?.telephone ?? enquiry.phone ?? null;
    const email = ld?.email ?? emailIn(pages) ?? enquiry.email ?? null;
    const realForm = enquiry.best?.url ?? null;
    if (phone || email || realForm) {
        capabilities.push({ name: 'contact', available: true, phone, email, form: realForm });
    }
    const ldHours = ld?.hours ?? ldElsewhere?.ld.hours ?? null;
    const hours = ldHours ?? googleHours(input.business.opening_hours);
    if (hours) {
        evidence.hours = ldHours
            ? { source: 'jsonld', quote: `openingHoursSpecification: ${Object.entries(ldHours).slice(0, 2).map(([d, h]) => `${d} ${h}`).join(', ')}`, url: (ld?.hours ? home?.url : ldElsewhere?.page.url) ?? null }
            : { source: 'places', quote: null, url: null };
    }
    const address = input.business.address ?? ld?.address ?? null;
    if (address)
        evidence.address = { source: input.business.address ? 'places' : 'jsonld', quote: input.business.address ? null : ld?.address ?? null, url: input.business.address ? null : home?.url ?? null };
    const zone = timezoneOf({ address, lat: input.business.lat ?? ld?.lat ?? null, lng: input.business.lng ?? ld?.lng ?? null });
    if (zone.timezone)
        evidence.timezone = { source: 'places', quote: zone.why, url: null };
    const chat = detectChat(pages.map((p) => p.html).join('\n'));
    if (team?.staff.length) {
        evidence.staff = { source: 'html_team', quote: team.staff[0].quote, url: team.url };
    }
    const niche = input.business.niche ?? null;
    const card: BookingCard = {
        ucp: '0.1',
        family: 'booking',
        status: 'unverified',
        business: {
            name: input.business.name,
            address,
            locations: team?.locations ?? [],
            location: typeof (input.business.lat ?? ld?.lat) === 'number' && typeof (input.business.lng ?? ld?.lng) === 'number'
                ? { lat: (input.business.lat ?? ld?.lat) as number, lng: (input.business.lng ?? ld?.lng) as number }
                : null,
            phone,
            email,
            website: input.business.website ?? null,
            place_id: input.business.place_id ?? null,
            google_type: input.business.primary_type ?? null,
            provider_trade: booksy.find((m) => m.trade)?.trade ?? null,
            niche: niche ? bookingNicheKey(niche)?.key ?? niche : null,
        },
        booking: {
            provider: detection.provider,
            signals: detection.signals.map((s) => ({ provider: s.provider, evidence: s.evidence, url: s.url, where: s.where })),
            merchants: detection.merchants,
            readable: readableFor(detection),
        },
        services: {
            items: services,
            count: services.length,
            prices_seen: menu?.prices_seen ?? 0,
            categories: menu?.categories ?? [],
            price_range: servicePriceRange(services),
            price_on_request: onRequest ? { quote: onRequest.quote, url: onRequest.url, via: onRequest.via } : null,
        },
        staff: {
            people: (team?.staff ?? []).map(toCardStaff),
            count: team?.staff.length ?? 0,
            tiered,
        },
        capabilities,
        hours,
        timezone: zone.timezone,
        support_chat: chat.provider ? { provider: chat.provider, has_ai: chat.has_ai } : null,
        freshness: { read_at: input.read_at ?? null, pages_read: pages.length },
        evidence,
    };
    return { card, verdict: bookingVerdict(card) };
}
type BookCapability = Extract<BookingCapability, {
    name: 'book';
}>;
function dedupeDoors(doors: BookCapability['doors']): BookCapability['doors'] {
    const seen = new Set<string>();
    return doors.filter((d) => {
        const key = `${d.via}|${d.merchant_id ?? d.url}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
export function googleHours(raw: unknown): Record<string, string> | null {
    const descriptions = (raw as {
        weekdayDescriptions?: unknown;
    } | null)?.weekdayDescriptions;
    if (!Array.isArray(descriptions))
        return null;
    const out: Record<string, string> = {};
    for (const line of descriptions) {
        const text = String(line ?? '').trim();
        const m = /^([A-Za-z]+)\s*:\s*(.+)$/.exec(text);
        if (!m)
            continue;
        const day = m[1].toLowerCase();
        if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day))
            continue;
        out[day] = m[2].trim();
    }
    return Object.keys(out).length ? out : null;
}
function emailIn(pages: readonly {
    html: string;
}[]): string | null {
    for (const page of pages) {
        for (const m of page.html.matchAll(/mailto:([^"'\s>?]+@[^"'\s>?]+)/gi)) {
            const email = m[1].toLowerCase();
            if (/\.(?:png|jpe?g|gif|svg)$/.test(email))
                continue;
            if (/^(?:info|hello|no-?reply)@(?:example|test)\./.test(email))
                continue;
            return email;
        }
    }
    return null;
}
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
