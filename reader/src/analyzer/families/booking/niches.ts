export type BookingNiche = {
    key: string;
    types: readonly string[];
    allied: readonly string[];
    query: string;
    aliases: readonly string[];
};
export const BOOKING_NICHES: readonly BookingNiche[] = [
    {
        key: 'hair salon',
        query: 'hair salon',
        aliases: ['salon', 'hair', 'hairdresser', 'hair studio', 'hair stylist', 'colourist', 'colorist'],
        types: ['hair_salon', 'hair_care', 'beauty_salon'],
        allied: ['barber_shop', 'nail_salon', 'spa', 'skin_care_clinic', 'makeup_artist', 'tanning_studio'],
    },
    {
        key: 'nail salon',
        query: 'nail salon',
        aliases: ['nails', 'nail studio', 'nail bar', 'nail tech', 'manicure', 'pedicure'],
        types: ['nail_salon'],
        allied: ['beauty_salon', 'hair_salon', 'spa', 'skin_care_clinic', 'hair_care'],
    },
    {
        key: 'barbershop',
        query: 'barbershop',
        aliases: ['barber', 'barber shop', 'barbers', 'mens grooming', 'mens haircut'],
        types: ['barber_shop'],
        allied: ['hair_salon', 'hair_care', 'beauty_salon'],
    },
    {
        key: 'beauty salon',
        query: 'beauty salon',
        aliases: ['beauty', 'esthetician', 'aesthetician', 'skin care', 'facials', 'lashes', 'brows', 'waxing'],
        types: ['beauty_salon', 'skin_care_clinic'],
        allied: ['hair_salon', 'nail_salon', 'spa', 'massage', 'makeup_artist', 'hair_care', 'tanning_studio'],
    },
    {
        key: 'spa',
        query: 'day spa',
        aliases: ['day spa', 'massage', 'massage therapist', 'wellness'],
        types: ['spa', 'massage'],
        allied: ['beauty_salon', 'skin_care_clinic', 'physiotherapist', 'chiropractor', 'yoga_studio'],
    },
    {
        key: 'photographer',
        query: 'photographer',
        aliases: ['photography', 'photo studio', 'wedding photographer', 'portrait photographer', 'headshots'],
        types: ['photographer', 'photography_studio'],
        allied: ['wedding_venue', 'event_planner', 'photo_lab', 'art_gallery'],
    },
    {
        key: 'beauty_professional',
        query: 'beauty professional',
        aliases: [
            'beauty professional', 'beauty professionals', 'beauty pro',
            'lash tech', 'lash technician', 'lash artist', 'brow artist', 'brow tech',
            'makeup artist', 'mua', 'tattoo artist', 'tattooist', 'piercer',
            'tattoo', 'tattoo shop', 'tattoo studio', 'tattoo parlor', 'tattoo parlour',
            'personal trainer', 'pt', 'mobile barber', 'mobile hairdresser', 'mobile stylist',
        ],
        types: [
            'hair_salon', 'hair_care', 'barber_shop', 'nail_salon', 'beauty_salon', 'skin_care_clinic',
            'makeup_artist', 'massage', 'spa', 'tattoo_parlor', 'tattoo_shop', 'body_art_service',
            'personal_trainer', 'photographer', 'photography_studio', 'tanning_studio',
        ],
        allied: ['yoga_studio', 'fitness_center', 'physiotherapist', 'chiropractor', 'event_planner', 'wedding_venue'],
    },
];
export function looseNiche(text: string): string {
    return (text ?? '').toLowerCase().trim().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function bookingNicheKey(niche: string): BookingNiche | null {
    const text = looseNiche(niche);
    if (!text)
        return null;
    const forms = new Set([text, text.replace(/s$/, ''), text.replace(/ies$/, 'y'), `${text}s`]);
    for (const n of BOOKING_NICHES) {
        const keys = new Set([looseNiche(n.key), ...n.aliases.map(looseNiche)]);
        for (const form of forms)
            if (keys.has(form))
                return n;
    }
    for (const n of BOOKING_NICHES) {
        for (const raw of [n.key, ...n.aliases]) {
            const key = looseNiche(raw);
            if (!key)
                continue;
            if (text === key || text.endsWith(` ${key}`) || text.startsWith(`${key} `) || text.includes(` ${key} `))
                return n;
        }
    }
    return null;
}