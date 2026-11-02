import { bestHit, FOOD_PLATFORMS, orderingHits, reservationHits, type FoodPlatformHit } from '../platforms';
import type { MenuUnreadable } from '../menu';
export type FoodCapability = {
    name: 'show_menu';
    available: boolean;
    url: string | null;
    sections: number;
    dishes: number;
    priced: number;
    evidence: string;
} | {
    name: 'order_pickup';
    available: boolean | null;
    url: string | null;
    platform: string | null;
    external_id: string | null;
    evidence: string;
    choose_location?: boolean;
} | {
    name: 'order_delivery';
    available: boolean | null;
    url: string | null;
    platform: string | null;
    external_id: string | null;
    evidence: string;
    choose_location?: boolean;
} | {
    name: 'reserve';
    available: boolean | null;
    url: string | null;
    platform: string | null;
    external_id: string | null;
    evidence: string;
    choose_location?: boolean;
};
const PICKUP_YES = /\b(?:pick[\s-]?up available|order for pick[\s-]?up|pickup only|takeout available|take[\s-]?out available|curbside pick[\s-]?up|ready for pick[\s-]?up|order ahead for pick[\s-]?up)\b/i;
const PICKUP_NO = /\b(?:no (?:in[\s-]?(?:shop|store) )?pick[\s-]?up|pick[\s-]?up (?:is )?not available|delivery only|no takeout|we do not offer pick[\s-]?up)\b/i;
const DELIVERY_YES = /\b(?:we deliver|delivery available|order (?:for )?delivery|free delivery|local delivery|delivery within|we offer delivery|now delivering)\b/i;
const DELIVERY_NO = /\b(?:no delivery|we do not deliver|delivery (?:is )?not available|pick[\s-]?up only|takeout only|no delivery service)\b/i;
export type OwnPageWords = {
    pickup: boolean | null;
    delivery: boolean | null;
    pickupQuote: string | null;
    deliveryQuote: string | null;
};
export function readOwnPageWords(text: string): OwnPageWords {
    const quote = (rx: RegExp): string | null => {
        const m = rx.exec(text);
        if (!m)
            return null;
        const at = m.index;
        return text.slice(Math.max(0, at - 60), Math.min(text.length, at + m[0].length + 60)).trim();
    };
    const pickupNo = quote(PICKUP_NO);
    const pickupYes = pickupNo ? null : quote(PICKUP_YES);
    const deliveryNo = quote(DELIVERY_NO);
    const deliveryYes = deliveryNo ? null : quote(DELIVERY_YES);
    return {
        pickup: pickupNo ? false : pickupYes ? true : null,
        delivery: deliveryNo ? false : deliveryYes ? true : null,
        pickupQuote: pickupNo ?? pickupYes,
        deliveryQuote: deliveryNo ?? deliveryYes,
    };
}
export function capabilitiesFrom(input: {
    hits: FoodPlatformHit[];
    words: OwnPageWords;
    menu: {
        url: string | null;
        sections: number;
        dishes: number;
        priced: number;
    };
}): FoodCapability[] {
    const ordering = orderingHits(input.hits);
    const booking = reservationHits(input.hits);
    const marketplace = bestHit(ordering.filter((h) => h.kind === 'marketplace'));
    const ownOrdering = bestHit(ordering.filter((h) => h.kind === 'ordering')) ?? null;
    const reserveHit = bestHit(booking);
    const choose = (hit: FoodPlatformHit | null | undefined): {
        choose_location?: true;
    } => (hit && !hit.url ? { choose_location: true } : {});
    const platformSentence = (hit: FoodPlatformHit | undefined | null): string => hit && !hit.url ? hit.evidence : hit ? `${FOOD_PLATFORMS[hit.platform].label} (${hit.capability}, id ${hit.external_id ?? 'unknown'}), seen ${hit.seen_times}x and chosen by ${hit.chosen_by}` : 'no ordering platform on the page';
    const out: FoodCapability[] = [
        {
            name: 'show_menu',
            available: input.menu.dishes > 0,
            url: input.menu.url,
            sections: input.menu.sections,
            dishes: input.menu.dishes,
            priced: input.menu.priced,
            evidence: input.menu.dishes > 0
                ? `${input.menu.dishes} dishes in ${input.menu.sections} sections, ${input.menu.priced} priced, read from ${input.menu.url}`
                : 'no menu this family can read',
        },
        {
            name: 'order_pickup',
            available: input.words.pickup ?? null,
            url: ownOrdering?.url ?? null,
            platform: ownOrdering?.platform ?? null,
            external_id: ownOrdering?.external_id ?? null,
            ...choose(ownOrdering),
            evidence: input.words.pickupQuote
                ? `the site says «${input.words.pickupQuote}»`
                : ownOrdering
                    ? platformSentence(ownOrdering)
                    : 'no ordering platform on any page we read, and no sentence about pickup: unknown, not absent',
        },
        {
            name: 'order_delivery',
            available: input.words.delivery ?? (marketplace ? true : null),
            url: marketplace?.url ?? ownOrdering?.url ?? null,
            platform: marketplace?.platform ?? ownOrdering?.platform ?? null,
            external_id: marketplace?.external_id ?? ownOrdering?.external_id ?? null,
            ...choose(marketplace ?? ownOrdering),
            evidence: input.words.deliveryQuote
                ? `the site says «${input.words.deliveryQuote}»`
                : marketplace
                    ? marketplace.url
                        ? `a ${FOOD_PLATFORMS[marketplace.platform].label} storefront link (${marketplace.url}) — somebody else's door, and the restaurant's own terms are not on our page`
                        : marketplace.evidence
                    : platformSentence(ownOrdering),
        },
        {
            name: 'reserve',
            available: booking.length ? true : null,
            url: reserveHit?.url ?? null,
            platform: reserveHit?.platform ?? null,
            external_id: reserveHit?.external_id ?? null,
            ...choose(reserveHit),
            evidence: reserveHit && !reserveHit.url
                ? reserveHit.evidence
                : booking.length
                    ? `${booking.filter((b) => b.url).map((b) => `${FOOD_PLATFORMS[b.platform].label} id ${b.external_id ?? 'unknown'}`).join(' and ')}; availability is behind their own app and we never asked it`
                    : 'no reservation platform on the page, which is not proof there are no tables',
        },
    ];
    return out;
}
export function platformUnreadable(hits: FoodPlatformHit[], menuWasRead: boolean): MenuUnreadable[] {
    if (menuWasRead)
        return [];
    const out: MenuUnreadable[] = [];
    for (const hit of orderingHits(hits).filter((h) => h.url)) {
        out.push({
            url: hit.url,
            reason: 'platform_refused',
            detail: `the menu is on ${FOOD_PLATFORMS[hit.platform].label} (${hit.url}); ${FOOD_PLATFORMS[hit.platform].without_login.plain_get === 'not_probed' ? 'that page has never been probed' : `a plain GET of it came back ${FOOD_PLATFORMS[hit.platform].without_login.plain_get}`}`,
        });
    }
    return out;
}
