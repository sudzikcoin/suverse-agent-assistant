import { config } from '../config';
import { collectFromJsonLd, looksLikeProductUrl } from './jsonld';
import { collectProducts, type ScanProduct } from './products';
import { sitemapUrls } from './sitemap';
import { parseSquarespaceStore, storePagesFromSitemap } from './squarespace';
import { parseWixProducts } from './wix';
export type ProductsSource = 'shopify_api' | 'woo_store_api' | 'squarespace_json' | 'wix_warmup' | 'jsonld_sitemap' | 'recipe' | 'none';
export type CatalogueResult = {
    products: ScanProduct[];
    source: ProductsSource;
    reason: string | null;
    pagesRead: number;
    recipeId?: string | null;
    noStore?: boolean;
};
export type CatalogueLadder = (origin: string, io: CatalogueIo, knownUrls?: string[]) => Promise<CatalogueResult>;
export type CatalogueIo = {
    fetchPath: (path: string) => Promise<{
        ok: boolean;
        body?: string;
        status?: number;
        reason?: string;
    }>;
    fetchUrl: (url: string) => Promise<{
        ok: boolean;
        body?: string;
    }>;
    robotsTxt: string | null;
    html: string;
    productPageCap?: number;
};
export const NO_SOURCE_REASON: Readonly<Record<string, string>> = {
    none: 'the Places listing has no website',
};
export function sourceForPlatform(platform: string): Exclude<ProductsSource, 'recipe'> {
    switch (platform) {
        case 'shopify': return 'shopify_api';
        case 'woocommerce': return 'woo_store_api';
        case 'squarespace': return 'squarespace_json';
        case 'wix': return 'wix_warmup';
        case 'none': return 'none';
        default: return 'jsonld_sitemap';
    }
}
export async function squarespaceCatalogue(origin: string, io: CatalogueIo, ladder: CatalogueLadder = jsonLdCatalogue): Promise<CatalogueResult> {
    const { urls } = await sitemapUrls({ origin, fetchText: io.fetchUrl, robotsTxt: io.robotsTxt });
    const pages = storePagesFromSitemap(urls);
    let pagesRead = 1;
    if (pages.length === 0) {
        return { products: [], source: 'none', noStore: true, reason: 'no /p/ product URLs in the sitemap — this Squarespace site has no store page', pagesRead };
    }
    const products: ScanProduct[] = [];
    const seen = new Set<string>();
    let stores = 0;
    let robotsRefused = false;
    for (const page of pages) {
        if (products.length >= config.maxProductsPerStore)
            break;
        const path = `${page === '/' ? '' : page}?format=json`;
        const r = await io.fetchPath(path);
        pagesRead += 1;
        if (!r.ok && r.reason === 'robots') {
            robotsRefused = true;
            break;
        }
        if (!r.ok || !r.body)
            continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(r.body);
        }
        catch {
            continue;
        }
        const batch = parseSquarespaceStore(parsed, origin);
        if (batch === null)
            continue;
        stores += 1;
        for (const p of batch) {
            if (seen.has(p.external_id))
                continue;
            seen.add(p.external_id);
            products.push(p);
            if (products.length >= config.maxProductsPerStore)
                break;
        }
    }
    if (stores === 0) {
        const fallback = await ladder(origin, io, urls);
        const instead = fallback.source === 'recipe' ? 'so a recipe read the catalogue instead'
            : fallback.source === 'jsonld_sitemap' ? "so the catalogue was read from the product pages' schema.org markup instead"
                : 'so the product pages were read instead';
        const why = robotsRefused
            ? `robots.txt disallows ?format=json on Squarespace, ${instead}`
            : `no page answered as a products collection, ${instead}`;
        return {
            ...fallback,
            pagesRead: pagesRead + fallback.pagesRead,
            reason: fallback.products.length > 0 ? `${why}${fallback.reason ? ` — ${fallback.reason}` : ''}` : `${why}, and they carry none either`,
        };
    }
    return {
        products, source: 'squarespace_json', pagesRead,
        reason: products.length >= config.maxProductsPerStore ? `capped at ${config.maxProductsPerStore}` : null,
    };
}
export async function wixCatalogue(origin: string, io: CatalogueIo, ladder: CatalogueLadder = jsonLdCatalogue): Promise<CatalogueResult> {
    const fromHome = parseWixProducts(io.html, origin);
    if (fromHome.length > 0) {
        return { products: fromHome.slice(0, config.maxProductsPerStore), source: 'wix_warmup', reason: null, pagesRead: 0 };
    }
    const { urls } = await sitemapUrls({ origin, fetchText: io.fetchUrl, robotsTxt: io.robotsTxt });
    let pagesRead = 1;
    const candidates = urls.filter((u) => /\/(shop|store|flowers|products?)\/?$/i.test(u)).slice(0, 3);
    for (const url of candidates) {
        const r = await io.fetchUrl(url);
        pagesRead += 1;
        if (!r.ok || !r.body)
            continue;
        const batch = parseWixProducts(r.body, origin);
        if (batch.length > 0) {
            return { products: batch.slice(0, config.maxProductsPerStore), source: 'wix_warmup', reason: null, pagesRead };
        }
    }
    const fallback = await ladder(origin, io, urls);
    return { ...fallback, pagesRead: pagesRead + fallback.pagesRead };
}
export async function jsonLdCatalogue(origin: string, io: CatalogueIo, knownUrls?: string[]): Promise<CatalogueResult> {
    let pagesRead = 0;
    let urls = knownUrls;
    if (!urls) {
        const found = await sitemapUrls({ origin, fetchText: io.fetchUrl, robotsTxt: io.robotsTxt });
        urls = found.urls;
        pagesRead += 1;
    }
    if (urls.length === 0) {
        return { products: [], source: 'none', reason: 'no sitemap answered, so there is no list of product pages to read', pagesRead };
    }
    const ordered = [...urls.filter(looksLikeProductUrl), ...urls.filter((u) => !looksLikeProductUrl(u))];
    const walk = await collectFromJsonLd({ urls: ordered, fetchPage: io.fetchUrl, maxPages: io.productPageCap });
    pagesRead += walk.pagesRead;
    if (walk.products.length === 0) {
        return {
            products: [], source: 'none', pagesRead,
            reason: `no schema.org Product markup on the first ${walk.pagesRead} page(s) of the sitemap`,
        };
    }
    return {
        products: walk.products, source: 'jsonld_sitemap', pagesRead,
        reason: walk.stopped === 'pages'
            ? `a sample: ${walk.products.length} products from the first ${walk.pagesRead} pages, one request each${io.productPageCap && io.productPageCap < config.jsonLdMaxProductPages ? ` — this shop's robots.txt asks us to go slowly, so the budget was ${io.productPageCap} pages` : ''}`
            : walk.stopped === 'cap' ? `capped at ${config.maxProductsPerStore}`
                : walk.stopped === 'refused' ? `partial: the shop stopped answering after ${walk.pagesRead} pages, so the walk stopped too`
                    : null,
    };
}
export async function apiCatalogue(kind: 'shopify' | 'woocommerce', origin: string, io: CatalogueIo, ladder: CatalogueLadder = jsonLdCatalogue): Promise<CatalogueResult> {
    const walk = await collectProducts({
        kind, origin,
        fetchPage: async (path) => {
            const r = await io.fetchPath(path);
            if (!r.ok)
                return { ok: false, reason: r.reason };
            if (r.status !== undefined && (r.status < 200 || r.status >= 300))
                return { ok: false, reason: `http_${r.status}` };
            return { ok: true, body: r.body };
        },
    });
    const source: ProductsSource = kind === 'shopify' ? 'shopify_api' : 'woo_store_api';
    if (walk.pages === 0) {
        const fallback = await ladder(origin, io);
        if (fallback.products.length > 0)
            return fallback;
        return {
            products: [], source: 'none', pagesRead: 1 + fallback.pagesRead,
            reason: `the ${kind} catalogue API answered ${walk.stopped}${fallback.reason ? `, and ${fallback.reason}` : ', and no page carries schema.org Product markup'}`,
        };
    }
    return {
        products: walk.products, source, pagesRead: walk.pages,
        ...(walk.products.length === 0 ? { noStore: true } : {}),
        reason: walk.stopped === 'cap' ? `capped at ${config.maxProductsPerStore}` : walk.stopped === 'pages' ? `stopped at ${config.maxProductPages} pages` : null,
    };
}
export type CatalogueHooks = {
    recipe?: (origin: string, platform: string, io: CatalogueIo, knownUrls?: string[]) => Promise<CatalogueResult | null>;
    forge?: (origin: string, platform: string, io: CatalogueIo) => Promise<CatalogueResult | null>;
};
export async function readCatalogueFor(platform: string, origin: string, io: CatalogueIo, hooks: CatalogueHooks = {}): Promise<CatalogueResult> {
    const ladder: CatalogueLadder = async (o, i, knownUrls) => {
        let urls = knownUrls;
        let sitemapCost = 0;
        const pageList = async (): Promise<string[]> => {
            if (urls)
                return urls;
            const found = await sitemapUrls({ origin: o, fetchText: i.fetchUrl, robotsTxt: i.robotsTxt });
            urls = found.urls;
            sitemapCost = 1;
            return urls;
        };
        if (hooks.recipe) {
            const byRecipe = await hooks.recipe(o, platform, i, await pageList());
            if (byRecipe && byRecipe.products.length > 0)
                return { ...byRecipe, pagesRead: byRecipe.pagesRead + sitemapCost };
        }
        const markup = await jsonLdCatalogue(o, i, await pageList());
        if (markup.products.length > 0)
            return { ...markup, pagesRead: markup.pagesRead + sitemapCost };
        if (hooks.forge) {
            const forged = await hooks.forge(o, platform, i);
            if (forged) {
                if (forged.products.length > 0)
                    return { ...forged, pagesRead: markup.pagesRead + forged.pagesRead + sitemapCost };
                return {
                    ...forged,
                    pagesRead: markup.pagesRead + forged.pagesRead + sitemapCost,
                    reason: [markup.reason, forged.reason].filter(Boolean).join('; ').slice(0, 300),
                };
            }
        }
        return { ...markup, pagesRead: markup.pagesRead + sitemapCost };
    };
    switch (sourceForPlatform(platform)) {
        case 'shopify_api': return apiCatalogue('shopify', origin, io, ladder);
        case 'woo_store_api': return apiCatalogue('woocommerce', origin, io, ladder);
        case 'squarespace_json': return squarespaceCatalogue(origin, io, ladder);
        case 'wix_warmup': return wixCatalogue(origin, io, ladder);
        case 'jsonld_sitemap': return ladder(origin, io);
        case 'none': return { products: [], source: 'none', reason: NO_SOURCE_REASON.none, pagesRead: 0 };
    }
}
