export type ChatSignal = {
    name: string;
    evidence: string;
};
export type ChatDetection = {
    provider: string | null;
    has_ai: boolean | null;
    signals: ChatSignal[];
};
type Provider = {
    name: string;
    patterns: RegExp[];
    ai?: RegExp[];
    alwaysAi?: boolean;
};
const PROVIDERS: Provider[] = [
    {
        name: 'intercom',
        patterns: [/widget\.intercom\.io/i, /js\.intercomcdn\.com/i, /\bintercomSettings\b/, /window\.Intercom\b/, /\bIntercom\s*\(/],
        ai: [/\bfin\.ai\b/i, /intercom[^"']{0,40}fin\b/i, /"fin"\s*:/i, /fin_?ai/i, /data-fin/i],
    },
    {
        name: 'zendesk',
        patterns: [/static\.zdassets\.com/i, /\bzEmbed\b/, /\bzE\s*\(/, /ze-snippet/i, /zendesk\.com\/embeddable/i],
        ai: [/answer_?bot/i, /zendesk[^"']{0,30}ai[-_ ]agent/i],
    },
    {
        name: 'tidio',
        patterns: [/code\.tidio\.co/i, /\btidioChatApi\b/, /widget\.tidiochat\.com/i, /tidio-chat/i],
        ai: [/\blyro\b/i],
    },
    {
        name: 'livechat',
        patterns: [/cdn\.livechatinc\.com/i, /\b__lc\b/, /\bLiveChatWidget\b/, /livechat\.com\/chat/i],
        ai: [/\bopenwidget\b.{0,40}\bai\b/i, /livechat[^"']{0,30}ai[-_ ]agent/i],
    },
    {
        name: 'crisp',
        patterns: [/client\.crisp\.chat/i, /\$crisp\b/, /\bCRISP_WEBSITE_ID\b/],
        ai: [/crisp[^"']{0,30}(?:ai|bot)[-_ ]?(?:agent|assist)/i],
    },
    {
        name: 'drift',
        patterns: [/js\.driftt\.com/i, /\bdriftt\b/i, /\bdrift\.load\b/, /\bdriftConfig\b/],
        ai: [/drift[^"']{0,30}(?:bot|ai)\b/i],
    },
    {
        name: 'hubspot_chat',
        patterns: [/js\.usemessages\.com/i, /hubspot-messages-iframe-container/i, /\bHubSpotConversations\b/, /js\.hs-scripts\.com/i],
        ai: [/hubspot[^"']{0,30}(?:chatbot|ai[-_ ]agent)/i, /\bchatflow\b.{0,20}\bbot\b/i],
    },
    {
        name: 'gorgias',
        patterns: [/config\.gorgias\.chat/i, /gorgias\.chat/i, /\bGorgiasChat\b/, /\bgorgiasChatPlatform\b/],
        ai: [/gorgias[^"']{0,30}(?:automate|ai[-_ ]agent)/i],
    },
    {
        name: 'shopify_inbox',
        patterns: [/shopify-chat/i, /chat\.shopify\.com/i, /\bShopifyChat\b/, /shopify_chat/i],
    },
    {
        name: 'ada',
        patterns: [/static\.ada\.support/i, /\badaEmbed\b/, /ada-embed/i, /\badaSettings\b/],
        alwaysAi: true,
    },
    {
        name: 'chatbase',
        patterns: [/chatbase\.co/i, /\bchatbaseConfig\b/, /chatbase-bubble/i, /\bchatbase\b/i],
        alwaysAi: true,
    },
    {
        name: 'tawk_to',
        patterns: [/embed\.tawk\.to/i, /\bTawk_API\b/, /\bTawk_LoadStart\b/],
        ai: [/tawk[^"']{0,30}\bai\b/i],
    },
    {
        name: 'olark',
        patterns: [/static\.olark\.com/i, /\bolark\s*\(/, /\bolarkIdentify\b/],
    },
    {
        name: 'freshchat',
        patterns: [/wchat\.freshchat\.com/i, /\bfcWidget\b/, /freshchat\.com\/js/i, /\bfcSettings\b/],
        ai: [/\bfreddy\b/i, /freshchat[^"']{0,30}bot/i],
    },
];
function evidenceOf(html: string, pattern: RegExp): string {
    const m = pattern.exec(html);
    if (!m)
        return pattern.source;
    const at = m.index;
    return html.slice(Math.max(0, at - 24), at + m[0].length + 24).replace(/\s+/g, ' ').trim().slice(0, 120);
}
export function detectChat(html: string): ChatDetection {
    const signals: ChatSignal[] = [];
    let provider: string | null = null;
    let hasAi: boolean | null = null;
    for (const p of PROVIDERS) {
        const hit = p.patterns.find((pattern) => pattern.test(html));
        if (!hit)
            continue;
        signals.push({ name: p.name, evidence: evidenceOf(html, hit) });
        const ai = p.alwaysAi === true || (p.ai ?? []).some((pattern) => pattern.test(html));
        if (!provider) {
            provider = p.name;
            hasAi = ai;
        }
        else if (ai)
            hasAi = true;
    }
    return { provider, has_ai: provider ? hasAi === true : null, signals };
}