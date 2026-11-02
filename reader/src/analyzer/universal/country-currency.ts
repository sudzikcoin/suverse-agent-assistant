const BY_COUNTRY: Record<string, string> = {
    usa: 'USD', 'united states': 'USD', 'puerto rico': 'USD', canada: 'CAD', mexico: 'MXN', 'méxico': 'MXN', brazil: 'BRL', argentina: 'ARS',
    colombia: 'COP', chile: 'CLP', peru: 'PEN', uruguay: 'UYU', 'costa rica': 'CRC', 'dominican republic': 'DOP', guatemala: 'GTQ',
    uk: 'GBP', 'united kingdom': 'GBP', ireland: 'EUR', germany: 'EUR', austria: 'EUR', france: 'EUR', italy: 'EUR', spain: 'EUR', portugal: 'EUR',
    netherlands: 'EUR', belgium: 'EUR', luxembourg: 'EUR', finland: 'EUR', greece: 'EUR', croatia: 'EUR', slovenia: 'EUR', slovakia: 'EUR',
    estonia: 'EUR', latvia: 'EUR', lithuania: 'EUR', malta: 'EUR', cyprus: 'EUR', switzerland: 'CHF', sweden: 'SEK', norway: 'NOK',
    denmark: 'DKK', poland: 'PLN', czechia: 'CZK', 'czech republic': 'CZK', hungary: 'HUF', romania: 'RON', bulgaria: 'BGN', serbia: 'RSD',
    'bosnia and herzegovina': 'BAM', montenegro: 'EUR', turkey: 'TRY', 'türkiye': 'TRY', russia: 'RUB', ukraine: 'UAH', israel: 'ILS',
    'united arab emirates': 'AED', 'saudi arabia': 'SAR', qatar: 'QAR', egypt: 'EGP', 'south africa': 'ZAR', nigeria: 'NGN', kenya: 'KES',
    india: 'INR', china: 'CNY', 'hong kong': 'HKD', taiwan: 'TWD', japan: 'JPY', 'south korea': 'KRW', korea: 'KRW', vietnam: 'VND',
    thailand: 'THB', indonesia: 'IDR', malaysia: 'MYR', singapore: 'SGD', philippines: 'PHP', australia: 'AUD', 'new zealand': 'NZD',
};
export function currencyOfAddress(address: string | null | undefined): string | null {
    const parts = String(address ?? '').split(',').map((p) => p.trim().toLowerCase().replace(/\s*\d[\d\s-]*$/, '').trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i -= 1) {
        const hit = BY_COUNTRY[parts[i]];
        if (hit)
            return hit;
    }
    return null;
}
