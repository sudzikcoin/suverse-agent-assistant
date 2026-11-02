import type { IntakeHit, IntakeSystem } from '../intake';
import type { FieldRole } from './forms';
export type FieldListSource = 'page' | 'vendor_known';
export type HostedDoor = {
    system: IntakeSystem;
    tenant: string | null;
    url: string | null;
    ability: IntakeHit['ability'];
    third_party: boolean;
    needs_account: boolean | null;
    fields_source: FieldListSource;
    needs: FieldRole[];
    evidence: string;
    why: string;
};
export const VENDOR_NEEDS: Partial<Record<IntakeSystem, FieldRole[]>> = {
    housecall_pro: ['name', 'phone', 'email', 'address', 'service', 'date'],
    servicetitan: ['name', 'phone', 'email', 'address', 'service', 'date'],
    jobber: ['name', 'phone', 'email', 'address', 'service'],
    chariot: ['name', 'phone', 'email', 'address', 'date', 'volume'],
    scheduledrop: ['name', 'phone', 'email', 'service'],
    service_fusion: ['name', 'phone', 'email', 'address', 'service'],
    workiz: ['name', 'phone', 'address', 'service', 'date'],
    servicem8: ['name', 'phone', 'email', 'address', 'service'],
    zenbooker: ['address', 'service', 'volume', 'date', 'name', 'phone', 'email'],
    launch27: ['zip', 'service', 'volume', 'date', 'name', 'phone', 'email'],
    bookingkoala: ['zip', 'service', 'volume', 'date', 'name', 'phone', 'email'],
    maidcentral: ['zip', 'service', 'volume', 'name', 'phone', 'email'],
    responsibid: ['address', 'service', 'volume', 'name', 'phone', 'email'],
    smartmoving: ['address', 'date', 'volume', 'name', 'phone', 'email'],
    moveitpro: ['address', 'date', 'volume', 'name', 'phone', 'email'],
    supermove: ['address', 'date', 'volume', 'name', 'phone', 'email'],
    elromco: ['address', 'date', 'volume', 'name', 'phone', 'email'],
    calendly: ['name', 'email', 'date', 'time'],
    acuity: ['name', 'email', 'phone', 'date', 'time'],
    square_appointments: ['name', 'email', 'phone', 'date', 'time'],
    setmore: ['name', 'email', 'phone', 'date', 'time'],
    schedulicity: ['name', 'email', 'phone', 'date', 'time'],
    typeform: [],
    jotform: [],
    hubspot_forms: [],
    thumbtack: ['zip', 'service', 'volume', 'date', 'name', 'phone', 'email'],
    angi: ['zip', 'service', 'name', 'phone', 'email'],
    yelp: ['zip', 'service', 'name', 'phone', 'email'],
    porch: ['zip', 'service', 'name', 'phone', 'email'],
};
const TENANT: Partial<Record<IntakeSystem, (hit: IntakeHit) => string | null>> = {
    housecall_pro: (h) => /book\.housecallpro\.com\/book\/([^/?#]+)\/([A-Za-z0-9]+)/i.exec(h.url ?? h.evidence)?.slice(1, 3).join('/') ?? null,
    servicetitan: (h) => /schedulerId=([A-Za-z0-9_-]+)/.exec(h.evidence)?.[1] ?? null,
    chariot: (h) => /https?:\/\/([a-z0-9-]+)\.chariotmove\.com/i.exec(h.url ?? h.evidence)?.[1] ?? null,
    scheduledrop: (h) => /public\/forms\/(\d+)/.exec(h.url ?? h.evidence)?.[1] ?? null,
    jobber: (h) => /clienthub\.getjobber\.com\/(?:client_hubs|booking)\/([A-Za-z0-9-]+)/i.exec(h.url ?? h.evidence)?.[1] ?? null,
    thumbtack: (h) => /thumbtack\.com\/([a-z]{2}\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+)\/service\/(\d+)/i.exec(h.url ?? h.evidence)?.slice(1, 3).join('#') ?? null,
    calendly: (h) => /calendly\.com\/([A-Za-z0-9._-]+)/i.exec(h.url ?? h.evidence)?.[1] ?? null,
    bookingkoala: (h) => /https?:\/\/([a-z0-9-]+)\.bookingkoala\.com/i.exec(h.url ?? h.evidence)?.[1] ?? null,
    moveitpro: (h) => /https?:\/\/([a-z0-9-]+)\.moveitpro\.com/i.exec(h.url ?? h.evidence)?.[1] ?? null,
};
export function isHosted(system: IntakeSystem): boolean {
    return system in VENDOR_NEEDS;
}
export function hostedDoor(hit: IntakeHit): HostedDoor | null {
    if (!isHosted(hit.system))
        return null;
    if (hit.ability === 'none')
        return null;
    const tenant = TENANT[hit.system]?.(hit) ?? null;
    const needs = VENDOR_NEEDS[hit.system] ?? [];
    return {
        system: hit.system,
        tenant,
        url: hit.url,
        ability: hit.ability,
        third_party: hit.third_party,
        needs_account: hit.needs_account,
        fields_source: 'vendor_known',
        needs,
        evidence: hit.evidence,
        why: tenant
            ? `the page carries ${hit.system}'s own marker and names the tenant «${tenant}»; the field list is what ${hit.system} always asks and was NOT read from this page`
            : `the page carries ${hit.system}'s marker but no tenant, so the door is known and its address is not; the field list is the product's, not this page's`,
    };
}
export function hostedDoors(hits: IntakeHit[]): HostedDoor[] {
    const out = new Map<string, HostedDoor>();
    for (const hit of hits) {
        const door = hostedDoor(hit);
        if (!door)
            continue;
        const key = `${door.system}|${door.tenant ?? door.url ?? ''}`;
        if (!out.has(key))
            out.set(key, door);
    }
    return [...out.values()];
}
