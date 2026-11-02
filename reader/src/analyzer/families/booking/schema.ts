import type { Proof, ReadableThing } from './widgets';
import type { MenuService } from './menu';
import type { StaffMember } from './staff';
export type BookingFieldSource = 'places' | 'jsonld' | 'html_menu' | 'html_team' | 'widget_link' | 'widget' | 'ai';
export type BookingEvidence = {
    source: BookingFieldSource;
    quote: string | null;
    url: string | null;
};
export type CardService = {
    name: string;
    price_from: number | null;
    price_to: number | null;
    from: boolean;
    currency: string | null;
    duration_min: number | null;
    category: string | null;
    tiers: string[] | null;
    provider_service_id: string | null;
    book_url: string | null;
    quote: string;
    source: BookingFieldSource;
};
export type CardStaff = {
    name: string;
    role: string | null;
    tier: string | null;
    location: string | null;
    quote: string;
};
export type BookCapability = {
    name: 'book';
    available: true;
    doors: {
        url: string;
        via: string;
        merchant_id: string | null;
        name_from_slug: string | null;
    }[];
    proof: Proof;
};
export type CheckAvailabilityCapability = {
    name: 'check_availability';
    available: boolean;
    proof: Proof;
    why: string;
    url: string | null;
};
export type ShowServicesCapability = {
    name: 'show_services';
    available: true;
    count: number;
    priced: number;
    timed: number;
    source: BookingFieldSource;
    url: string | null;
};
export type ContactCapability = {
    name: 'contact';
    available: true;
    phone: string | null;
    email: string | null;
    form: string | null;
};
export type RequestDateCapability = {
    name: 'request_date';
    available: true;
    channels: string[];
    url: string | null;
    action: string | null;
    asks_date: boolean;
    date_evidence: string | null;
    fields: string[];
    phrases: string[];
    proof: Proof;
};
export type BookingCapability = BookCapability | CheckAvailabilityCapability | ShowServicesCapability | ContactCapability | RequestDateCapability;
export type BookingCard = {
    ucp: '0.1';
    family: 'booking';
    status: 'unverified';
    business: {
        name: string;
        address: string | null;
        locations: string[];
        location: {
            lat: number;
            lng: number;
        } | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        place_id: string | null;
        google_type: string | null;
        provider_trade: string | null;
        niche: string | null;
    };
    booking: {
        provider: string | null;
        signals: {
            provider: string;
            evidence: string;
            url: string | null;
            where: string | null;
        }[];
        merchants: {
            provider: string;
            ids: Record<string, string>;
            url: string;
        }[];
        readable: Record<ReadableThing, Proof> | null;
    };
    services: {
        items: CardService[];
        count: number;
        prices_seen: number;
        categories: string[];
        price_range: {
            min: number;
            max: number;
            currency: string | null;
        } | null;
        price_on_request: {
            quote: string;
            url: string;
            via: string;
        } | null;
    };
    staff: {
        people: CardStaff[];
        count: number;
        tiered: number;
    };
    capabilities: BookingCapability[];
    hours: Record<string, string> | null;
    timezone: string | null;
    support_chat: {
        provider: string | null;
        has_ai: boolean | null;
    } | null;
    freshness: {
        read_at: string | null;
        pages_read: number;
    };
    evidence: Record<string, BookingEvidence>;
};
export type BookingCardVerdict = {
    verdict: 'add' | 'reject';
    reason: string;
};
export function bookingVerdict(card: BookingCard): BookingCardVerdict {
    const canBook = card.capabilities.some((c) => c.name === 'book');
    const services = card.services.count;
    const priced = card.services.items.filter((s) => s.price_from !== null).length;
    const withPrices = priced === services ? 'with prices' : priced ? `(${priced} with prices)` : 'with their length, prices in the booking system';
    const requestDate = card.capabilities.find((c) => c.name === 'request_date');
    if (!canBook && requestDate && requestDate.name === 'request_date') {
        if (requestDate.asks_date) {
            return { verdict: 'add', reason: `an enquiry form that takes a date${card.services.price_on_request ? ', and the price comes on request in their own words' : ''}` };
        }
        if (services >= 3)
            return { verdict: 'add', reason: `${services} service(s) ${withPrices}, and an enquiry form` };
        if (card.services.price_on_request) {
            return { verdict: 'add', reason: 'no published price, said in their own words, and an enquiry form to ask through' };
        }
    }
    if (canBook && services > 0)
        return { verdict: 'add', reason: `${services} service(s) and a booking door` };
    if (canBook)
        return { verdict: 'add', reason: 'a booking door, with the menu behind it' };
    if (services >= 3)
        return { verdict: 'add', reason: `${services} service(s) ${withPrices}, bookable by telephone` };
    if (services > 0) {
        return {
            verdict: 'reject',
            reason: `only ${services} service(s) read and no booking door — too little to act on, and a card with one service misrepresents a salon`,
        };
    }
    return {
        verdict: 'reject',
        reason: 'no service list and no booking door: everything on this card is what Google already told the buyer',
    };
}
export function servicePriceRange(items: readonly CardService[]): {
    min: number;
    max: number;
    currency: string | null;
} | null {
    const priced = items.filter((s) => typeof s.price_from === 'number' && (s.price_from as number) > 0);
    if (!priced.length)
        return null;
    const lows = priced.map((s) => s.price_from as number);
    const highs = priced.map((s) => s.price_to ?? (s.price_from as number));
    return {
        min: Math.round(Math.min(...lows) * 100) / 100,
        max: Math.round(Math.max(...highs) * 100) / 100,
        currency: priced.find((s) => s.currency)?.currency ?? null,
    };
}
export function toCardService(s: MenuService, extra?: {
    provider_service_id?: string | null;
    book_url?: string | null;
}): CardService {
    return {
        name: s.name,
        price_from: s.price_from,
        price_to: s.price_to,
        from: s.from,
        currency: s.currency,
        duration_min: s.duration_min,
        category: s.category,
        tiers: s.tiers,
        provider_service_id: extra?.provider_service_id ?? null,
        book_url: extra?.book_url ?? null,
        quote: s.quote,
        source: 'html_menu',
    };
}
export function toCardStaff(s: StaffMember): CardStaff {
    return { name: s.name, role: s.role, tier: s.tier, location: s.location, quote: s.quote };
}
