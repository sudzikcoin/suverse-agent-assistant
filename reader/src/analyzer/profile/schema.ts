export type FieldSource = 'places' | 'jsonld' | 'policy' | 'ai' | 'catalog';
export type Evidence = {
    source: FieldSource;
    quote: string | null;
    url: string | null;
};
export type DeliveryZone = {
    kind: 'zips';
    zips: string[];
} | {
    kind: 'cities';
    cities: string[];
} | {
    kind: 'radius_miles';
    radius_miles: number;
};
export type DeliveryFee = {
    kind: 'fixed';
    min: number;
    currency: string | null;
} | {
    kind: 'range';
    min: number;
    max: number;
    currency: string | null;
};
export type OrderMethod = 'online_cart' | 'phone' | 'form' | 'email';
export const DAYS: readonly string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export type ProfileFields = {
    delivers: boolean | null;
    delivery_zone: DeliveryZone | null;
    delivery_fee: DeliveryFee | null;
    same_day: boolean | null;
    same_day_delivery_cutoff: string | null;
    cutoff_zone_basis: 'shop' | 'recipient' | null;
    pickup_cutoff: string | null;
    timezone: string | null;
    no_delivery_days: string[];
    pickup: boolean | null;
    hours: Record<string, string> | null;
    phone: string | null;
    email: string | null;
    order_form_url: string | null;
    order_methods: OrderMethod[];
};
export const PROFILE_FIELDS: readonly (keyof ProfileFields)[] = [
    'delivers', 'delivery_zone', 'delivery_fee', 'same_day', 'same_day_delivery_cutoff', 'cutoff_zone_basis',
    'pickup_cutoff', 'timezone', 'no_delivery_days', 'pickup', 'hours', 'phone', 'email', 'order_form_url',
    'order_methods',
];
export type Profile = {
    fields: ProfileFields;
    evidence: Record<string, Evidence>;
};
export function fieldKnown(fields: ProfileFields, name: keyof ProfileFields): boolean {
    const value = fields[name];
    if (value === null || value === undefined)
        return false;
    if (Array.isArray(value))
        return value.length > 0;
    return true;
}
export function missingFields(profile: Profile): (keyof ProfileFields)[] {
    return PROFILE_FIELDS.filter((f) => !fieldKnown(profile.fields, f));
}
export function fieldsBySource(profile: Profile): Record<FieldSource, number> {
    const tally: Record<FieldSource, number> = { places: 0, jsonld: 0, policy: 0, ai: 0, catalog: 0 };
    for (const field of PROFILE_FIELDS) {
        if (!fieldKnown(profile.fields, field))
            continue;
        const source = profile.evidence[field]?.source;
        if (source)
            tally[source] += 1;
    }
    return tally;
}
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
export const MAX_QUOTE = 1200;
export function normalizeForQuote(text: string): string {
    return text
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/[‘’‛′]/g, "'")
        .replace(/[“”‟″]/g, '"')
        .replace(/[‐-―−]/g, '-')
        .replace(/[   ]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
export type QuotePage = {
    url: string;
    text: string;
};
export type DroppedField = {
    field: string;
    why: string;
};