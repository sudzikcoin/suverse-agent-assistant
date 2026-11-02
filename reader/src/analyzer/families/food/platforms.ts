import { chooseLocation, CHOOSE_LOCATION_NOTE, type PlaceChoice } from '../../universal/place-match';
export type FoodPlatformKey = 'toast' | 'square_online' | 'chownow' | 'olo' | 'clover' | 'bentobox' | 'popmenu' | 'owner_com' | 'spothopper' | 'incentivio' | 'opentable' | 'resy' | 'tock' | 'sevenrooms' | 'doordash' | 'ubereats' | 'grubhub';
export type FoodPlatformKind = 'ordering' | 'reservation' | 'marketplace';
export type WithoutLogin = {
    menu_with_prices: boolean | null;
    order_hours: boolean | null;
    pickup: boolean | null;
    delivery: boolean | null;
    reserve: boolean | null;
    how: string;
    plain_get: 'readable' | 'js_only' | 'refused' | 'not_probed';
    plain_get_detail: string | null;
};
export type FoodPlatformSpec = {
    key: FoodPlatformKey;
    kind: FoodPlatformKind;
    label: string;
    seen: boolean;
    without_login: WithoutLogin;
};
export const FOOD_PLATFORMS: Readonly<Record<FoodPlatformKey, FoodPlatformSpec>> = {
    toast: {
        key: 'toast', kind: 'ordering', label: 'Toast', seen: true,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: null, reserve: false,
            how: 'order.toasttab.com/online/<slug> renders the whole menu server-side with prices, a pickup/delivery switch and the next available slot; the same data is behind ws-api.toasttab.com. /catering/<slug> is the catering menu. /egiftcards/<slug> is a gift card and carries no menu at all.',
            plain_get: 'refused',
            plain_get_detail: 'order.toasttab.com/online/halelife-tampa and /catering/alessi-bakery-new-... both 403',
        },
    },
    square_online: {
        key: 'square_online', kind: 'ordering', label: 'Square Online', seen: true,
        without_login: {
            menu_with_prices: true, order_hours: null, pickup: true, delivery: null, reserve: false,
            how: '<shop>.square.site renders sections and item prices; /s/order is the ordering entry and ?location=<id> selects the location. Fulfilment choices appear at checkout, so pickup is visible and delivery often is not until an address is given.',
            plain_get: 'refused',
            plain_get_detail: 'thecakegirlllc.square.site/s/order 403',
        },
    },
    chownow: {
        key: 'chownow', kind: 'ordering', label: 'ChowNow', seen: false,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: null, reserve: false,
            how: 'direct.chownow.com/order/<id>/locations/<id> and the embedded iframe both render the menu with prices; ordering hours are shown as «opens at …».',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    olo: {
        key: 'olo', kind: 'ordering', label: 'Olo', seen: true,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: true, reserve: false,
            how: '<brand>.olo.com/menu/<location> lists categories and prices; the handoff mode (pickup / delivery / curbside) is chosen before the menu and is in the URL.',
            plain_get: 'refused',
            plain_get_detail: 'cameronmitchellrest.olo.com/menu/pearl-tampa/ 403',
        },
    },
    clover: {
        key: 'clover', kind: 'ordering', label: 'Clover', seen: true,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: null, reserve: false,
            how: 'clover.com/online-ordering/<merchant-slug> renders the menu with prices and the store\'s ordering hours.',
            plain_get: 'js_only',
            plain_get_detail: 'www.clover.com/online-ordering/stateflourbakery 200, 3 458 bytes, a React shell with no menu in it',
        },
    },
    bentobox: {
        key: 'bentobox', kind: 'ordering', label: 'BentoBox', seen: false,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: null,
            how: 'BentoBox builds the whole site (cdn.getbento.com assets), so the menu is a normal page of the restaurant\'s own domain and is read like any other — which is why its capabilities are «it depends»: BentoBox sells ordering and reservations as add-ons and a site may have neither.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    popmenu: {
        key: 'popmenu', kind: 'ordering', label: 'Popmenu', seen: false,
        without_login: {
            menu_with_prices: true, order_hours: null, pickup: null, delivery: null, reserve: null,
            how: 'Popmenu also builds the site (popmenucloud.com images, a `popmenu` global); its menus are per-dish pages under /menu-item/<slug> with prices, which is why the page chooser refuses to walk them one at a time.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    owner_com: {
        key: 'owner_com', kind: 'ordering', label: 'Owner.com', seen: false,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: true, reserve: false,
            how: 'Owner.com builds the site and the ordering on the restaurant\'s own domain; the menu is a Next.js page with prices and both fulfilment modes.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    spothopper: {
        key: 'spothopper', kind: 'ordering', label: 'SpotHopper', seen: false,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: null,
            how: 'SpotHopper builds marketing sites (spothopperapp.com assets) and resells somebody else\'s ordering, so finding it says who built the page and nothing about who takes the order.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    incentivio: {
        key: 'incentivio', kind: 'ordering', label: 'Incentivio', seen: true,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: false,
            how: 'order.incentivio.com/c/<brand>/locations/<location> is a client-rendered app: the 718 bytes we are served carry no menu, and the prices arrive over its own API afterwards. Buddy Brew links five Tampa locations this way, so the per-location slug is the useful part.',
            plain_get: 'js_only',
            plain_get_detail: 'order.incentivio.com/c/buddybrew/ 200, 718 bytes, a React shell',
        },
    },
    opentable: {
        key: 'opentable', kind: 'reservation', label: 'OpenTable', seen: true,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: true,
            how: 'opentable.com/r/<slug> and the restref widget identify the restaurant by a stable numeric `restref`; availability is loaded by the widget and the booking itself needs an account.',
            plain_get: 'refused',
            plain_get_detail: 'www.opentable.com/r/rooster-and-the-till-reservations-tampa timed out after 15 s',
        },
    },
    resy: {
        key: 'resy', kind: 'reservation', label: 'Resy', seen: true,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: true,
            how: 'resy.com/cities/<city>/venues/<venue> is the venue page; the slug is the stable identifier. Slots come from its own API and booking needs an account.',
            plain_get: 'js_only',
            plain_get_detail: 'resy.com/cities/tampa-bay-fl/venues/rocca 200, 5 250 bytes, an Angular shell titled «Resy | Right This Way»',
        },
    },
    tock: {
        key: 'tock', kind: 'reservation', label: 'Tock', seen: false,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: true,
            how: 'exploretock.com/<venue> is the venue page; Tock also sells prepaid experiences, so a «reservation» there can carry a price.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    sevenrooms: {
        key: 'sevenrooms', kind: 'reservation', label: 'SevenRooms', seen: false,
        without_login: {
            menu_with_prices: null, order_hours: null, pickup: null, delivery: null, reserve: true,
            how: 'sevenrooms.com/reservations/<venue> (or /explore/<venue>/reservations/create/search) is the booking page; the venue slug is the stable identifier. Availability is loaded by its own API.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    doordash: {
        key: 'doordash', kind: 'marketplace', label: 'DoorDash', seen: true,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: true, reserve: false,
            how: 'doordash.com/store/<slug>, and — the case that actually turned up — `order.online/store/<id>`, which is DoorDash\'s white-label Storefront on a domain that does not say DoorDash anywhere in its name.',
            plain_get: 'refused',
            plain_get_detail: 'order.online/store/-40248/ (DoorDash Storefront) 403',
        },
    },
    ubereats: {
        key: 'ubereats', kind: 'marketplace', label: 'Uber Eats', seen: false,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: true, reserve: false,
            how: 'ubereats.com/store/<slug>/<uuid>; the menu and marketplace prices are public, and marketplace prices are usually HIGHER than the restaurant\'s own.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
    grubhub: {
        key: 'grubhub', kind: 'marketplace', label: 'Grubhub', seen: false,
        without_login: {
            menu_with_prices: true, order_hours: true, pickup: true, delivery: true, reserve: false,
            how: 'grubhub.com/restaurant/<slug>/<id>; same caveat about marketplace prices.',
            plain_get: 'not_probed',
            plain_get_detail: null,
        },
    },
};
export type FoodPlatformHit = {
    platform: FoodPlatformKey;
    kind: FoodPlatformKind;
    capability: 'order' | 'order_catering' | 'reserve' | 'gift_card' | 'loyalty' | 'site_builder';
    url: string | null;
    external_id: string | null;
    evidence: string;
    seen_times: number;
    alternatives: string[];
    chosen_by: 'only' | 'location' | 'frequency' | 'ambiguous' | 'foreign';
    locations: number;
};
type Matcher = {
    platform: FoodPlatformKey;
    capability: FoodPlatformHit['capability'];
    url: RegExp;
    idGroup?: number;
};
const MATCHERS: Matcher[] = [
    { platform: 'toast', capability: 'gift_card', url: /toasttab\.com\/(?:egiftcards|giftcards)\/([^/?#"'\s\\]+)/i, idGroup: 1 },
    { platform: 'toast', capability: 'loyalty', url: /toasttab\.com\/([^/?#"'\s\\]+)\/rewardsSignup/i, idGroup: 1 },
    { platform: 'toast', capability: 'order_catering', url: /toasttab\.com\/catering\/([^/?#"'\s\\]+)/i, idGroup: 1 },
    { platform: 'toast', capability: 'order', url: /toasttab\.com\/(?:online\/)?([^/?#"'\s\\]+)/i, idGroup: 1 },
    { platform: 'toast', capability: 'order', url: /toastwebstore\.com\/([^/?#"'\s\\]+)/i, idGroup: 1 },
    { platform: 'square_online', capability: 'order', url: /([a-z0-9-]+)\.square\.site\/s\/order/i, idGroup: 1 },
    { platform: 'square_online', capability: 'gift_card', url: /([a-z0-9-]+)\.square\.site\/s\/gift-cards?/i, idGroup: 1 },
    { platform: 'square_online', capability: 'order', url: /([a-z0-9-]+)\.square\.site/i, idGroup: 1 },
    { platform: 'chownow', capability: 'order', url: /(?:direct|ordering)\.chownow\.com\/order\/(\d+)/i, idGroup: 1 },
    { platform: 'chownow', capability: 'order', url: /chownow\.com\/[^"'\s]*/i },
    { platform: 'olo', capability: 'order', url: /[a-z0-9-]*\.?olo\.com\/menu\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'olo', capability: 'order', url: /(?:olo\.com|olocdn\.net|ordering-api\.olo\.com)[^"'\s]*/i },
    { platform: 'clover', capability: 'order', url: /clover\.com\/online-ordering\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'clover', capability: 'order', url: /(?:order|www)\.clover\.com\/[^"'\s]*/i },
    { platform: 'incentivio', capability: 'order', url: /order\.incentivio\.com\/c\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'owner_com', capability: 'order', url: /(?:cdn|order|www)\.owner\.com\/[^"'\s]*/i },
    { platform: 'bentobox', capability: 'site_builder', url: /(?:cdn\.)?getbento\.com[^"'\s]*/i },
    { platform: 'popmenu', capability: 'site_builder', url: /popmenu(?:cloud)?\.com[^"'\s]*/i },
    { platform: 'spothopper', capability: 'site_builder', url: /spothopper(?:app)?\.com[^"'\s]*/i },
    { platform: 'opentable', capability: 'reserve', url: /opentable\.(?:com|[a-z]{2})(?:\.[a-z]{2})?\/[^"'\s]*?\brestref=(\d+)/i, idGroup: 1 },
    { platform: 'opentable', capability: 'reserve', url: /opentable\.(?:com|[a-z]{2})(?:\.[a-z]{2})?\/[^"'\s]*?\brid=(\d+)/i, idGroup: 1 },
    { platform: 'opentable', capability: 'reserve', url: /opentable\.(?:com|[a-z]{2})(?:\.[a-z]{2})?\/r\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'opentable', capability: 'reserve', url: /opentable\.(?:com|[a-z]{2})(?:\.[a-z]{2})?\/[^"'\s]*/i },
    { platform: 'resy', capability: 'reserve', url: /resy\.com\/cities\/[a-z0-9-]+\/venues\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'resy', capability: 'reserve', url: /(?:widgets\.)?resy\.com\/[^"'\s]*/i },
    { platform: 'tock', capability: 'reserve', url: /exploretock\.com\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'tock', capability: 'reserve', url: /(?:exploretock|tocktix)\.com[^"'\s]*/i },
    { platform: 'sevenrooms', capability: 'reserve', url: /sevenrooms\.com\/(?:reservations|explore)\/([a-z0-9_-]+)/i, idGroup: 1 },
    { platform: 'sevenrooms', capability: 'reserve', url: /sevenrooms\.com\/[^"'\s]*/i },
    { platform: 'doordash', capability: 'order', url: /order\.online\/store\/(-?\d+)/i, idGroup: 1 },
    { platform: 'doordash', capability: 'order', url: /doordash\.com\/store\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'doordash', capability: 'order', url: /(?:www\.)?doordash\.com[^"'\s]*/i },
    { platform: 'ubereats', capability: 'order', url: /ubereats\.com\/store\/([a-z0-9%-]+)/i, idGroup: 1 },
    { platform: 'ubereats', capability: 'order', url: /ubereats\.com[^"'\s]*/i },
    { platform: 'grubhub', capability: 'order', url: /grubhub\.com\/restaurant\/([a-z0-9-]+)/i, idGroup: 1 },
    { platform: 'grubhub', capability: 'order', url: /(?:www\.)?grubhub\.com[^"'\s]*/i },
];
export type BusinessHint = {
    name?: string | null;
    address?: string | null;
    city?: string | null;
};
export function hintTokens(hint: BusinessHint | undefined): string[] {
    const text = [hint?.name, hint?.address, hint?.city].filter(Boolean).join(' ').toLowerCase();
    const stop = new Set(['restaurant', 'cafe', 'bakery', 'bistro', 'kitchen', 'coffee', 'united', 'states', 'suite', 'north', 'south', 'east', 'west', 'street', 'avenue', 'boulevard', 'drive', 'road']);
    const out: string[] = [];
    for (const word of text.split(/[^a-z0-9]+/)) {
        if (word.length < 4 || stop.has(word))
            continue;
        if (!out.includes(word))
            out.push(word);
    }
    return out;
}
type Found = {
    url: string;
    id: string | null;
    count: number;
    at?: number[];
};
export function chooseAmong(found: Found[], hint?: BusinessHint, html?: string): PlaceChoice<Found> | null {
    return chooseLocation(found, hint, html);
}
const URL_CONTINUES = /[A-Za-z0-9/._~-]/;
function endsCleanly(text: string, at: number): boolean {
    if (at >= text.length)
        return true;
    const next = text[at];
    if (next === '/')
        return at + 1 >= text.length || !URL_CONTINUES.test(text[at + 1]);
    return !URL_CONTINUES.test(next);
}
function unescapeSlashes(text: string): string {
    return text.replace(/\\\//g, '/');
}
export function detectFoodPlatforms(html: string, hint?: BusinessHint): FoodPlatformHit[] {
    const text = unescapeSlashes(html);
    const out = new Map<string, FoodPlatformHit>();
    const claimed = new Set<string>();
    for (const matcher of MATCHERS) {
        const key = `${matcher.platform}:${matcher.capability}`;
        if (out.has(key))
            continue;
        const rx = new RegExp(matcher.url.source, matcher.url.flags.includes('g') ? matcher.url.flags : `${matcher.url.flags}g`);
        const byUrl = new Map<string, Found>();
        for (const m of text.matchAll(rx)) {
            const url = m[0];
            if (claimed.has(url))
                continue;
            if (!endsCleanly(text, m.index + url.length))
                continue;
            const existing = byUrl.get(url);
            if (existing) {
                existing.count += 1;
                existing.at!.push(m.index);
                continue;
            }
            byUrl.set(url, { url, id: matcher.idGroup ? (m[matcher.idGroup] ?? null) : null, count: 1, at: [m.index] });
        }
        const chosen = chooseAmong([...byUrl.values()], hint, text);
        if (!chosen)
            continue;
        for (const url of byUrl.keys())
            claimed.add(url);
        const all = [...byUrl.values()];
        const pickKey = chosen.pick ? (chosen.pick.id ?? chosen.pick.url) : null;
        const alternatives = all
            .map((f) => f.id ?? f.url)
            .filter((v, i, a) => v !== pickKey && a.indexOf(v) === i)
            .slice(0, 8);
        const locations = new Set(all.map((f) => (f.id ?? f.url.replace(/[?#].*$/, '').replace(/\/+$/, '')).toLowerCase())).size;
        const pick = chosen.pick;
        out.set(key, {
            platform: matcher.platform,
            kind: FOOD_PLATFORMS[matcher.platform].kind,
            capability: matcher.capability,
            url: pick ? (pick.url.startsWith('http') ? pick.url : `https://${pick.url}`) : null,
            external_id: pick?.id ?? null,
            evidence: pick
                ? pick.url.slice(0, 160)
                : chosen.by === 'foreign'
                    ? `${FOOD_PLATFORMS[matcher.platform].label}: the only link names another city (${(all[0].id ?? all[0].url).slice(0, 80)}); ${CHOOSE_LOCATION_NOTE}`
                    : `${FOOD_PLATFORMS[matcher.platform].label}: ${locations} locations linked (${alternatives.slice(0, 4).join(', ')}), none at this address; ${CHOOSE_LOCATION_NOTE}`,
            seen_times: pick ? pick.count : all.reduce((n, f) => n + f.count, 0),
            alternatives,
            chosen_by: chosen.by,
            locations,
        });
    }
    const order = out.get('toast:order');
    if (order && /^(?:egiftcards|giftcards|rewardsSignup|catering|online|checkout)$/i.test(order.external_id ?? '')) {
        out.delete('toast:order');
    }
    return [...out.values()];
}
export function bestHit(hits: FoodPlatformHit[]): FoodPlatformHit | undefined {
    const rank = (h: FoodPlatformHit): number => (h.url ? 0 : 10) + ({ location: 0, only: 1, frequency: 2, ambiguous: 3, foreign: 4 } as const)[h.chosen_by];
    return [...hits].sort((a, b) => rank(a) - rank(b))[0];
}
export function orderingHits(hits: FoodPlatformHit[]): FoodPlatformHit[] {
    return hits.filter((h) => h.capability === 'order' || h.capability === 'order_catering');
}
export function reservationHits(hits: FoodPlatformHit[]): FoodPlatformHit[] {
    return hits.filter((h) => h.capability === 'reserve');
}