export type IntakeAbility = 'request_quote' | 'book' | 'instant_quote' | 'call' | 'none';
export type IntakeSystem = 'jobber' | 'housecall_pro' | 'servicetitan' | 'service_fusion' | 'workiz' | 'servicem8' | 'fieldedge' | 'zenbooker' | 'launch27' | 'bookingkoala' | 'maidcentral' | 'responsibid' | 'chariot' | 'smartmoving' | 'moveitpro' | 'supermove' | 'elromco' | 'scheduledrop' | 'calendly' | 'acuity' | 'square_appointments' | 'setmore' | 'schedulicity' | 'typeform' | 'jotform' | 'hubspot_forms' | 'thumbtack' | 'angi' | 'yelp' | 'porch' | 'own_form' | 'phone' | 'servicetitan_dni' | 'review_widget' | 'service_area_checker' | 'call_tracking' | 'marketplace_profile';
export type IntakeHit = {
    system: IntakeSystem;
    ability: IntakeAbility;
    third_party: boolean;
    evidence: string;
    url: string | null;
    needs_account: boolean | null;
};
export type IntakeEvidence = {
    pages: {
        url: string;
        html: string;
    }[];
};
type Detector = {
    system: IntakeSystem;
    ability: IntakeAbility;
    third_party: boolean;
    needs_account: boolean | null;
    test: (html: string, pageUrl: string) => {
        evidence: string;
        url?: string | null;
    } | null;
};
const found = (rx: RegExp) => (html: string): {
    evidence: string;
} | null => {
    const m = rx.exec(html);
    return m ? { evidence: m[0].slice(0, 160) } : null;
};
const foundUrl = (rx: RegExp) => (html: string): {
    evidence: string;
    url: string;
} | null => {
    const m = rx.exec(html);
    if (!m)
        return null;
    const raw = m[0].replace(/&amp;/g, '&').replace(/&#0?38;/g, '&');
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return { evidence: raw.slice(0, 200), url: url.slice(0, 500) };
};
export const DETECTORS: Detector[] = [
    {
        system: 'jobber', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/clienthub\.getjobber\.com\/(?:client_hubs|booking)\/[A-Za-z0-9-]+[^"'\s<>)]*/i),
    },
    {
        system: 'jobber', ability: 'request_quote', third_party: false, needs_account: false,
        test: found(/(?:work_request_embed|getjobber\.com\/assets[^"'\s]*work[_-]request|data-jobber-[a-z-]+)/i),
    },
    {
        system: 'housecall_pro', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/book\.housecallpro\.com\/book\/[^"'\s<>)]+/i),
    },
    {
        system: 'servicetitan', ability: 'book', third_party: false, needs_account: false,
        test: (html) => {
            const m = /<script\b[^>]*embed\.scheduler\.servicetitan\.com[^>]*>/i.exec(html);
            if (!m)
                return null;
            const id = /data-schedulerid\s*=\s*["']([^"']+)/i.exec(m[0])?.[1] ?? null;
            const key = /data-api-key\s*=\s*["']([^"']+)/i.exec(m[0])?.[1] ?? null;
            return {
                evidence: `embed.scheduler.servicetitan.com${id ? ` schedulerId=${id}` : ''}${key ? ` apiKey=${key.slice(0, 8)}…` : ''}`,
                url: id ? `https://scheduler.servicetitan.com/#/?id=${id}` : null,
            };
        },
    },
    {
        system: 'servicetitan_dni', ability: 'none', third_party: false, needs_account: null,
        test: found(/static\.servicetitan\.com\/marketing-ads\/dni\.js|ServiceTitanDniObject/i),
    },
    {
        system: 'chariot', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]+\.chariotmove\.com\/customer\/[^"'\s<>)]*/i),
    },
    {
        system: 'scheduledrop', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/app\.scheduledrop\.com\/public\/forms\/\d+[^"'\s<>)]*/i),
    },
    {
        system: 'service_fusion', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]*\.?servicefusion\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'workiz', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:[a-z0-9-]+\.)?workiz\.com\/[^"'\s<>)]*|https?:\/\/book\.workiz\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'servicem8', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:[a-z0-9-]+\.)?servicem8\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'fieldedge', ability: 'book', third_party: false, needs_account: false,
        test: found(/fieldedge\.com|fieldedge-booking/i),
    },
    {
        system: 'zenbooker', ability: 'instant_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:[a-z0-9-]+\.)?zenbooker\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'launch27', ability: 'instant_quote', third_party: false, needs_account: false,
        test: found(/launch27\.com|l27-booking|data-l27/i),
    },
    {
        system: 'bookingkoala', ability: 'instant_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]+\.bookingkoala\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'maidcentral', ability: 'instant_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]*\.?maidcentral\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'responsibid', ability: 'instant_quote', third_party: false, needs_account: false,
        test: found(/responsibid\.com|responsibid-widget/i),
    },
    {
        system: 'smartmoving', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]*\.?smartmoving(?:app)?\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'moveitpro', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]+\.moveitpro\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'supermove', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:[a-z0-9-]+\.)?supermove\.(?:com|co)\/[^"'\s<>)]*/i),
    },
    {
        system: 'elromco', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]*\.?elromco\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'calendly', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/calendly\.com\/[A-Za-z0-9._-]+(?:\/[^"'\s<>)]*)?/i),
    },
    {
        system: 'acuity', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:app\.)?(?:squarespacescheduling|acuityscheduling)\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'square_appointments', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:squareup\.com\/appointments|[a-z0-9-]+\.square\.site)\/[^"'\s<>)]*/i),
    },
    {
        system: 'setmore', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:my|booking)\.setmore\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'schedulicity', ability: 'book', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:www\.)?schedulicity\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'typeform', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/[a-z0-9-]+\.typeform\.com\/to\/[^"'\s<>)]*/i),
    },
    {
        system: 'jotform', ability: 'request_quote', third_party: false, needs_account: false,
        test: foundUrl(/https?:\/\/(?:form|www)\.jotform\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'hubspot_forms', ability: 'request_quote', third_party: false, needs_account: false,
        test: found(/js\.hsforms\.net|hbspt\.forms\.create/i),
    },
    {
        system: 'thumbtack', ability: 'request_quote', third_party: true, needs_account: true,
        test: foundUrl(/https?:\/\/(?:www\.)?thumbtack\.com\/[a-z]{2}\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+\/service\/\d+/i),
    },
    {
        system: 'angi', ability: 'request_quote', third_party: true, needs_account: true,
        test: foundUrl(/https?:\/\/(?:www\.)?(?:angi|angieslist|homeadvisor)\.com\/[^"'\s<>)]*(?:request|get-?quote|book|lead-?form|sr\/)[^"'\s<>)]*/i),
    },
    {
        system: 'yelp', ability: 'request_quote', third_party: true, needs_account: true,
        test: foundUrl(/https?:\/\/(?:www\.)?yelp\.com\/(?:biz\/[^"'\s<>)]*(?:request|quote)[^"'\s<>)]*|rfq\/[^"'\s<>)]*)/i),
    },
    {
        system: 'marketplace_profile', ability: 'none', third_party: true, needs_account: null,
        test: foundUrl(/https?:\/\/(?:www\.)?(?:yelp\.com\/biz|angi\.com\/companylist|angieslist\.com\/companylist|homeadvisor\.com\/rated)[^"'\s<>)]*/i),
    },
    {
        system: 'porch', ability: 'request_quote', third_party: true, needs_account: true,
        test: foundUrl(/https?:\/\/(?:www\.)?porch\.com\/[^"'\s<>)]*/i),
    },
    {
        system: 'service_area_checker', ability: 'none', third_party: false, needs_account: null,
        test: foundUrl(/https?:\/\/v\d\.serviceareawizard\.com\/embed\/\d+/i),
    },
    {
        system: 'review_widget', ability: 'none', third_party: false, needs_account: null,
        test: found(/cdn\.trustindex\.io|static\.elfsight\.com|nicejob\.com|birdeye\.com|trustedsite\.com/i),
    },
    {
        system: 'call_tracking', ability: 'none', third_party: false, needs_account: null,
        test: found(/cdn\.callrail\.com|callrail\.com\/companies|whatconverts\.com|calltrackingmetrics\.com/i),
    },
];
export function isOnline(hit: IntakeHit): boolean {
    return hit.ability !== 'call' && hit.ability !== 'none';
}
export function onlineChannels(hits: IntakeHit[]): IntakeHit[] {
    return hits.filter((h) => isOnline(h) && !h.third_party);
}
export function telLinks(html: string): string[] {
    const out = new Set<string>();
    for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']{4,40})["']/gi)) {
        const digits = m[1].replace(/[^\d+]/g, '');
        if (digits.replace(/\D/g, '').length >= 7)
            out.add(digits);
    }
    return [...out];
}
export function detectIntake(e: IntakeEvidence): IntakeHit[] {
    const byKey = new Map<string, IntakeHit>();
    for (const page of e.pages) {
        for (const d of DETECTORS) {
            let r: {
                evidence: string;
                url?: string | null;
            } | null = null;
            try {
                r = d.test(page.html, page.url);
            }
            catch {
                r = null;
            }
            if (!r)
                continue;
            const hit: IntakeHit = {
                system: d.system, ability: d.ability, third_party: d.third_party,
                evidence: r.evidence, url: r.url ?? null, needs_account: d.needs_account,
            };
            const key = `${hit.system}|${hit.ability}|${hit.url ?? ''}`;
            if (!byKey.has(key))
                byKey.set(key, hit);
        }
        for (const tel of telLinks(page.html)) {
            const key = `phone|call|${tel}`;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    system: 'phone', ability: 'call', third_party: false,
                    evidence: `tel:${tel}`, url: `tel:${tel}`, needs_account: false,
                });
            }
        }
    }
    return [...byKey.values()];
}
