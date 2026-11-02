const BY_STATE: Readonly<Record<string, string>> = {
    CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', GA: 'America/New_York',
    ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York', NH: 'America/New_York',
    NJ: 'America/New_York', NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York',
    PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York', VT: 'America/New_York',
    VA: 'America/New_York', WV: 'America/New_York',
    AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago', IA: 'America/Chicago',
    LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
    OK: 'America/Chicago', WI: 'America/Chicago',
    CO: 'America/Denver', MT: 'America/Denver', NM: 'America/Denver', UT: 'America/Denver',
    WY: 'America/Denver',
    CA: 'America/Los_Angeles', WA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
    AZ: 'America/Phoenix',
    HI: 'Pacific/Honolulu',
    AK: 'America/Anchorage',
};
const SPLIT_BY_LONGITUDE: Readonly<Record<string, {
    meridian: number;
    west: string;
    east: string;
}>> = {
    FL: { meridian: -85.0, west: 'America/Chicago', east: 'America/New_York' },
    TX: { meridian: -104.9, west: 'America/Denver', east: 'America/Chicago' },
    MI: { meridian: -90.0, west: 'America/Chicago', east: 'America/New_York' },
    IN: { meridian: -87.4, west: 'America/Chicago', east: 'America/New_York' },
    KY: { meridian: -85.6, west: 'America/Chicago', east: 'America/New_York' },
    TN: { meridian: -85.3, west: 'America/Chicago', east: 'America/New_York' },
    KS: { meridian: -101.0, west: 'America/Denver', east: 'America/Chicago' },
    NE: { meridian: -101.0, west: 'America/Denver', east: 'America/Chicago' },
    ND: { meridian: -100.8, west: 'America/Denver', east: 'America/Chicago' },
    SD: { meridian: -100.0, west: 'America/Denver', east: 'America/Chicago' },
    OR: { meridian: -117.2, west: 'America/Los_Angeles', east: 'America/Boise' },
};
const IDAHO_PACIFIC_NORTH_OF = 45.8;
const BY_CITY: Readonly<Record<string, string>> = {
    'pensacola,fl': 'America/Chicago',
    'panama city,fl': 'America/Chicago',
    'destin,fl': 'America/Chicago',
    'fort walton beach,fl': 'America/Chicago',
    'tallahassee,fl': 'America/New_York',
    'el paso,tx': 'America/Denver',
    'phoenix,az': 'America/Phoenix',
    'tucson,az': 'America/Phoenix',
    'coeur d\'alene,id': 'America/Los_Angeles',
    'boise,id': 'America/Boise',
    'louisville,ky': 'America/New_York',
    'bowling green,ky': 'America/Chicago',
    'nashville,tn': 'America/Chicago',
    'knoxville,tn': 'America/New_York',
    'indianapolis,in': 'America/New_York',
    'evansville,in': 'America/Chicago',
};
export type ZoneGuess = {
    timezone: string | null;
    why: string;
};
export function placeOfAddress(address: string | null | undefined): {
    city: string | null;
    state: string | null;
} {
    const text = String(address ?? '').trim();
    if (!text)
        return { city: null, state: null };
    const state = /(?:^|,\s*)([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/.exec(text)?.[1]
        ?? /(?:^|,\s*)([A-Z]{2})\s*(?:,\s*USA)?\s*$/.exec(text)?.[1]
        ?? null;
    const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
    let city: string | null = null;
    for (let i = 0; i < parts.length; i += 1) {
        if (state && new RegExp(`^${state}\\b`).test(parts[i]) && i > 0) {
            city = parts[i - 1];
            break;
        }
    }
    return { city: city ? city.replace(/\s+/g, ' ') : null, state };
}
export function timezoneOf(input: {
    address: string | null | undefined;
    lat?: number | null;
    lng?: number | null;
}): ZoneGuess {
    const { city, state } = placeOfAddress(input.address);
    if (!state)
        return { timezone: null, why: 'the address does not name a US state, so no time zone was derived' };
    const key = `${(city ?? '').toLowerCase()},${state.toLowerCase()}`;
    if (BY_CITY[key]) {
        return { timezone: BY_CITY[key], why: `the address says ${city}, ${state}, which keeps ${BY_CITY[key]}` };
    }
    if (state === 'ID') {
        if (typeof input.lat === 'number') {
            const zone = input.lat > IDAHO_PACIFIC_NORTH_OF ? 'America/Los_Angeles' : 'America/Boise';
            return { timezone: zone, why: `the address says ${state} and the shop is at latitude ${input.lat.toFixed(2)}, which is ${zone}` };
        }
        return { timezone: null, why: 'Idaho is split north to south and this listing has no coordinates' };
    }
    const split = SPLIT_BY_LONGITUDE[state];
    if (split) {
        if (typeof input.lng !== 'number') {
            return { timezone: null, why: `${state} straddles a time-zone boundary and this listing has no coordinates, so no zone was derived` };
        }
        const zone = input.lng < split.meridian ? split.west : split.east;
        return {
            timezone: zone,
            why: `the address says ${city ? `${city}, ` : ''}${state} and the shop is at longitude ${input.lng.toFixed(2)}, which is ${zone}`,
        };
    }
    const zone = BY_STATE[state];
    if (!zone)
        return { timezone: null, why: `no time zone is known for the state «${state}»` };
    return { timezone: zone, why: `the address says ${city ? `${city}, ` : ''}${state}, which is ${zone}` };
}