export type Platform = 'shopify' | 'woocommerce' | 'wix' | 'squarespace' | 'square_online' | 'bigcommerce' | 'godaddy' | 'webflow' | 'bloomnation' | 'gravityfree' | 'ecwid' | 'wordpress' | 'joomla' | 'showit' | 'miva' | 'custom' | 'none';
export const CMS_PLATFORMS: readonly Platform[] = ['wordpress', 'joomla'];
export type Stack = 'nextjs' | 'vercel' | 'webpack_encore';
export type Widget = 'calendly' | 'square_appointments' | 'booksy' | 'vagaro' | 'opentable' | 'toast';
export type ProbeEvidence = {
    status: number;
    contentType: string;
    body: string;
} | null;
export type Evidence = {
    html: string;
    headers: Record<string, string>;
    finalUrl: string;
    probes: Record<string, ProbeEvidence>;
};
export type Signal = {
    key: string;
    platform: Platform | null;
    weight: number;
    test: (e: Evidence) => string | null;
};
const literal = (needle: string) => (e: Evidence): string | null => {
    const i = e.html.toLowerCase().indexOf(needle.toLowerCase());
    return i < 0 ? null : e.html.slice(i, i + Math.min(80, needle.length + 24));
};
const pattern = (rx: RegExp) => (e: Evidence): string | null => {
    const m = rx.exec(e.html);
    return m ? m[0].slice(0, 120) : null;
};
const headerName = (rx: RegExp) => (e: Evidence): string | null => {
    for (const [k, v] of Object.entries(e.headers))
        if (rx.test(k))
            return `${k}: ${String(v).slice(0, 80)}`;
    return null;
};
const headerValue = (name: string, needle: RegExp) => (e: Evidence): string | null => {
    const v = e.headers[name];
    return v && needle.test(v) ? `${name}: ${v.slice(0, 80)}` : null;
};
const jsonProbe = (path: string, shape: (parsed: unknown) => boolean) => (e: Evidence): string | null => {
    const p = e.probes[path];
    if (!p || p.status < 200 || p.status >= 300)
        return null;
    if (!/json/i.test(p.contentType))
        return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(p.body);
    }
    catch {
        return null;
    }
    if (!shape(parsed))
        return null;
    return `${path} → ${p.status} ${p.contentType.split(';')[0]}`;
};
export const SHOPIFY_PROBE = '/products.json';
export const WOO_PROBE = '/wp-json/wc/store/v1/products';
const hasProductsArray = (v: unknown): boolean => !!v && typeof v === 'object' && Array.isArray((v as {
    products?: unknown;
}).products);
const isProductArray = (v: unknown): boolean => Array.isArray(v);
function squareupNotBooking(e: Evidence): string | null {
    for (const m of e.html.matchAll(/[a-z0-9.-]*squareup\.com[^\s"'<>]*/gi)) {
        const url = m[0];
        if (/^book(ing)?s?\./i.test(url))
            continue;
        if (/\/appointments/i.test(url))
            continue;
        return url.slice(0, 120);
    }
    return null;
}
export const SIGNALS: readonly Signal[] = [
    { key: 'shopify_cdn', platform: 'shopify', weight: 0.65, test: literal('cdn.shopify.com') },
    { key: 'shopify_theme_global', platform: 'shopify', weight: 0.60, test: pattern(/Shopify\.theme\b/) },
    { key: 'shopify_myshopify', platform: 'shopify', weight: 0.40, test: literal('myshopify.com') },
    { key: 'shopify_header', platform: 'shopify', weight: 0.70, test: headerName(/^x-shop(id|ify)/) },
    { key: 'shopify_products_json', platform: 'shopify', weight: 0.90, test: jsonProbe(SHOPIFY_PROBE, hasProductsArray) },
    { key: 'woo_wp_content', platform: 'woocommerce', weight: 0.20, test: literal('wp-content') },
    { key: 'woo_css_class', platform: 'woocommerce', weight: 0.50, test: pattern(/class="[^"]*\bwoocommerce[\w-]*/i) },
    { key: 'woo_plugin_asset', platform: 'woocommerce', weight: 0.70, test: literal('plugins/woocommerce') },
    { key: 'woo_store_api', platform: 'woocommerce', weight: 0.90, test: jsonProbe(WOO_PROBE, isProductArray) },
    { key: 'wix_static', platform: 'wix', weight: 0.70, test: literal('static.wixstatic.com') },
    { key: 'wix_header', platform: 'wix', weight: 0.80, test: headerName(/^x-wix-/) },
    { key: 'wix_runtime', platform: 'wix', weight: 0.45, test: pattern(/wixPerformanceMeasurements|_wixCIDX|wix-warmup-data/) },
    { key: 'squarespace_static', platform: 'squarespace', weight: 0.70, test: literal('static1.squarespace.com') },
    { key: 'squarespace_context', platform: 'squarespace', weight: 0.80, test: literal('SQUARESPACE_CONTEXT') },
    { key: 'squarespace_generator', platform: 'squarespace', weight: 0.40, test: pattern(/<meta[^>]+name="generator"[^>]+Squarespace/i) },
    { key: 'square_site_domain', platform: 'square_online', weight: 0.70, test: literal('square.site') },
    { key: 'square_squareup', platform: 'square_online', weight: 0.45, test: squareupNotBooking },
    { key: 'square_editmysite', platform: 'square_online', weight: 0.55, test: literal('editmysite.com') },
    { key: 'bigcommerce_cdn', platform: 'bigcommerce', weight: 0.80, test: literal('cdn11.bigcommerce.com') },
    { key: 'bigcommerce_stencil', platform: 'bigcommerce', weight: 0.45, test: pattern(/stencil-utils|bigcommerce\.com\/s-/i) },
    { key: 'godaddy_wsimg', platform: 'godaddy', weight: 0.75, test: literal('img1.wsimg.com') },
    { key: 'godaddy_generic_wsimg', platform: 'godaddy', weight: 0.45, test: pattern(/\bwsimg\.com\b/) },
    { key: 'godaddy_header', platform: 'godaddy', weight: 0.50, test: headerValue('server', /DPS\/|GoDaddy/i) },
    { key: 'webflow_js', platform: 'webflow', weight: 0.70, test: literal('webflow.js') },
    { key: 'webflow_site_attr', platform: 'webflow', weight: 0.80, test: literal('data-wf-site') },
    { key: 'webflow_generator', platform: 'webflow', weight: 0.55, test: pattern(/<meta[^>]+content="Webflow"/i) },
    { key: 'bloomnation_assets', platform: 'bloomnation', weight: 0.85, test: literal('promfiles.com/bloom/') },
    { key: 'bloomnation_name', platform: 'bloomnation', weight: 0.60, test: pattern(/bloomnation(?:\.com)?/i) },
    { key: 'gravityfree_generator', platform: 'gravityfree', weight: 0.90, test: pattern(/<meta[^>]+name="generator"[^>]+(?:FlowerManager|GravityFree)[^>]*>/i) },
    { key: 'gravityfree_name', platform: 'gravityfree', weight: 0.50, test: pattern(/FlowerManager|GravityFree/i) },
    { key: 'ecwid_generator', platform: 'ecwid', weight: 0.90, test: pattern(/<meta[^>]+name="generator"[^>]+ec-instant-site[^>]*>/i) },
    { key: 'ecwid_app_host', platform: 'ecwid', weight: 0.55, test: literal('app.ecwid.com') },
    { key: 'ecwid_script', platform: 'ecwid', weight: 0.35, test: pattern(/ecwid\.com\/script\.js|\bEcwid\s*\./) },
    { key: 'wordpress_generator', platform: 'wordpress', weight: 0.85, test: pattern(/<meta[^>]+name="generator"[^>]+content="WordPress[^"]*"/i) },
    { key: 'wordpress_wp_json', platform: 'wordpress', weight: 0.45, test: pattern(/\/wp-json\/|rel="https:\/\/api\.w\.org\//) },
    { key: 'wordpress_includes', platform: 'wordpress', weight: 0.40, test: literal('/wp-includes/') },
    { key: 'joomla_media_system', platform: 'joomla', weight: 0.85, test: pattern(/\/media\/system\/(js|css)\/[a-z0-9.-]*(core|joomla)/i) },
    { key: 'joomla_component', platform: 'joomla', weight: 0.60, test: pattern(/option=com_[a-z]+/i) },
    { key: 'joomla_generator', platform: 'joomla', weight: 0.70, test: pattern(/<meta[^>]+name="generator"[^>]+Joomla/i) },
    { key: 'showit_engine', platform: 'showit', weight: 0.90, test: pattern(/showit\.co\/engine\/[0-9.]+\/showit/i) },
    { key: 'showit_static', platform: 'showit', weight: 0.70, test: literal('static.showit.com') },
    { key: 'miva_merchant_mvc', platform: 'miva', weight: 0.90, test: pattern(/merchant\.mvc\?Screen=/i) },
    { key: 'miva_store_code', platform: 'miva', weight: 0.45, test: pattern(/[?&]Store_Code=/i) },
    { key: 'stack_nextjs', platform: null, weight: 0, test: pattern(/\/_next\/static|__NEXT_DATA__/) },
    { key: 'stack_vercel', platform: null, weight: 0, test: headerValue('server', /^Vercel$/i) },
    { key: 'stack_webpack_encore', platform: null, weight: 0, test: pattern(/\/build\/runtime\.js\?[0-9a-f]{6}/i) },
    { key: 'builder_elementor', platform: null, weight: 0, test: pattern(/<meta[^>]+name="generator"[^>]+Elementor/i) },
    { key: 'widget_calendly', platform: null, weight: 0, test: literal('calendly.com') },
    { key: 'widget_square_appointments', platform: null, weight: 0, test: pattern(/book(ing)?\.squareup\.com|squareup\.com\/appointments|square\.site\/appointments/i) },
    { key: 'widget_booksy', platform: null, weight: 0, test: literal('booksy.com') },
    { key: 'widget_vagaro', platform: null, weight: 0, test: literal('vagaro.com') },
    { key: 'widget_opentable', platform: null, weight: 0, test: literal('opentable.com') },
    { key: 'widget_toast', platform: null, weight: 0, test: pattern(/toasttab\.com|toastwebstore\.com/i) },
];
export const STACK_OF_KEY: Readonly<Record<string, Stack>> = {
    stack_nextjs: 'nextjs',
    stack_vercel: 'vercel',
    stack_webpack_encore: 'webpack_encore',
};
export const WIDGET_OF_KEY: Readonly<Record<string, Widget>> = {
    widget_calendly: 'calendly',
    widget_square_appointments: 'square_appointments',
    widget_booksy: 'booksy',
    widget_vagaro: 'vagaro',
    widget_opentable: 'opentable',
    widget_toast: 'toast',
};