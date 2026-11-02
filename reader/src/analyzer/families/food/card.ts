import type { FoodCapability } from './adapters/handoff';
import type { FoodHours } from './hours';
import type { Menu } from './menu';
import type { FoodPlatformHit } from './platforms';
export type FoodCardPlatform = {
    platform: string;
    kind: 'ordering' | 'reservation' | 'marketplace';
    capability: string;
    url: string | null;
    external_id: string | null;
    chosen_by: string;
    alternatives: string[];
    locations?: number;
};
export type FoodCard = {
    ucp: '0.1';
    status: 'unverified';
    family: 'food';
    business: {
        name: string;
        address: string | null;
        location: {
            lat: number;
            lng: number;
        } | null;
        phone: string | null;
        website: string | null;
        site_platform: string | null;
        place_id: string | null;
        primary_type: string | null;
    };
    menu: Menu;
    capabilities: FoodCapability[];
    hours: FoodHours;
    platforms: FoodCardPlatform[];
    timezone: string | null;
    freshness: {
        read_at: string;
        pages_read: number;
    };
    evidence: Record<string, {
        source: string;
        quote: string | null;
        url: string | null;
    }>;
    verdict: {
        add: boolean;
        reason: string;
    };
};
export type FoodCardInput = {
    business: FoodCard['business'];
    menu: Menu;
    capabilities: FoodCapability[];
    hours: FoodHours;
    hits: FoodPlatformHit[];
    timezone: string | null;
    pagesRead: number;
    hoursConflict: string | null;
    readAt?: string;
};
export function foodCardVerdict(input: {
    menu: Menu;
    capabilities: FoodCapability[];
}): {
    add: boolean;
    reason: string;
} {
    const menu = input.menu;
    const reserve = input.capabilities.find((c) => c.name === 'reserve');
    const pickup = input.capabilities.find((c) => c.name === 'order_pickup');
    const delivery = input.capabilities.find((c) => c.name === 'order_delivery');
    if (menu.dishes > 0 && menu.priced > 0) {
        return { add: true, reason: `a menu of ${menu.dishes} dishes in ${menu.sections.length} sections, ${menu.priced} with a price, read from ${menu.url}` };
    }
    const ordering = [pickup, delivery].find((c) => c && 'platform' in c && c.platform && c.external_id);
    if (ordering && 'platform' in ordering) {
        return { add: true, reason: `no menu we can read, but ordering is handed to ${ordering.platform} as «${ordering.external_id}», which an agent can act on` };
    }
    if (reserve && 'platform' in reserve && reserve.platform && reserve.external_id) {
        return { add: true, reason: `no menu and no ordering, but a table can be booked through ${reserve.platform} as «${reserve.external_id}»` };
    }
    if (menu.unreadable.length) {
        const why = menu.unreadable.map((u) => u.reason).join(', ');
        return { add: false, reason: `this restaurant publishes a menu we cannot read (${why}) and hands ordering to nobody we can name — the website is the only door and it is not machine-readable` };
    }
    return { add: false, reason: 'no menu, no ordering platform and no reservation platform on any page we read: there is nothing here an agent could do' };
}
export function buildFoodCard(input: FoodCardInput): FoodCard {
    const evidence: Record<string, {
        source: string;
        quote: string | null;
        url: string | null;
    }> = {};
    if (input.menu.source !== 'none') {
        evidence.menu = {
            source: input.menu.source,
            quote: `${input.menu.dishes} dishes, ${input.menu.priced} priced, ${input.menu.sections.length} sections`,
            url: input.menu.url,
        };
    }
    if (input.menu.locationConflict) {
        evidence['menu.location'] = { source: input.menu.source, quote: input.menu.locationConflict, url: input.menu.url };
    }
    if (input.hoursConflict) {
        evidence['hours.conflict'] = { source: 'page_text', quote: input.hoursConflict, url: null };
    }
    for (const set of [input.hours.business, input.hours.kitchen] as const) {
        if (!set)
            continue;
        const key = set === input.hours.kitchen ? 'hours.kitchen' : 'hours.business';
        evidence[key] = { source: set.source, quote: set.quote, url: null };
    }
    for (const capability of input.capabilities) {
        evidence[capability.name] = {
            source: 'platform' in capability && capability.platform ? capability.platform : 'page',
            quote: capability.evidence,
            url: capability.url,
        };
    }
    for (const u of input.menu.unreadable) {
        evidence[`menu_unreadable.${u.reason}`] = { source: 'page', quote: u.detail, url: u.url };
    }
    return {
        ucp: '0.1',
        status: 'unverified',
        family: 'food',
        business: input.business,
        menu: input.menu,
        capabilities: input.capabilities,
        hours: input.hours,
        platforms: input.hits.map((h) => ({
            platform: h.platform,
            kind: h.kind,
            capability: h.capability,
            url: h.url,
            external_id: h.external_id,
            chosen_by: h.chosen_by,
            alternatives: h.alternatives,
            locations: h.locations,
        })),
        timezone: input.timezone,
        freshness: { read_at: input.readAt ?? new Date().toISOString(), pages_read: input.pagesRead },
        evidence,
        verdict: foodCardVerdict({ menu: input.menu, capabilities: input.capabilities }),
    };
}
function slug(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'x';
}