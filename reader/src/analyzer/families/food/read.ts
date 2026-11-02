import { capabilitiesFrom, platformUnreadable, readOwnPageWords, type FoodCapability } from './adapters/handoff';
import { readSemanticMenu } from './adapters/semantic-html';
import { readWixMenu } from './adapters/wix-restaurants';
import { buildFoodCard, type FoodCard } from './card';
import { hoursConflict, hoursFromJsonLd, hoursFromPlaces, kitchenHoursFromText, type FoodHours } from './hours';
import { EMPTY_MENU, menuIsUsable, plainText, type Menu, type MenuUnreadable } from './menu';
import { detectFoodPlatforms, type BusinessHint, type FoodPlatformHit } from './platforms';
export type FoodPageRead = {
    kind: 'home' | 'menu' | 'order' | 'reserve' | 'hours' | 'about';
    url: string;
    html: string;
};
export type FoodReadInput = {
    business: FoodCard['business'];
    hint: BusinessHint;
    pages: FoodPageRead[];
    openingHours?: unknown;
    pdfMenus?: string[];
    imageMenus?: string[];
    timezone?: string | null;
    currency?: string | null;
    readAt?: string;
    extraMenus?: Menu[];
    readDocs?: string[];
};
export function jsonLdOf(html: string): unknown[] {
    const out: unknown[] = [];
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            out.push(JSON.parse(m[1].trim()));
        }
        catch { }
    }
    return out;
}
function jsonLdHours(pages: FoodPageRead[]): ReturnType<typeof hoursFromJsonLd> {
    for (const page of pages) {
        for (const doc of jsonLdOf(page.html)) {
            const nodes = Array.isArray(doc) ? doc : [doc];
            for (const node of nodes) {
                if (!node || typeof node !== 'object')
                    continue;
                const spec = (node as {
                    openingHoursSpecification?: unknown;
                }).openingHoursSpecification;
                if (!spec)
                    continue;
                const hours = hoursFromJsonLd(spec, `openingHoursSpecification on ${page.url}`);
                if (hours)
                    return hours;
            }
        }
    }
    return null;
}
export function readMenu(input: FoodReadInput): Menu {
    const ordered = [...input.pages].sort((a, b) => rank(a.kind) - rank(b.kind));
    for (const page of ordered) {
        const wix = readWixMenu({ html: page.html, url: page.url, hint: input.hint, currency: input.currency ?? null });
        if (wix)
            return wix;
    }
    for (const page of ordered) {
        const semantic = readSemanticMenu({ html: page.html, url: page.url, currency: input.currency ?? null });
        if (semantic)
            return semantic;
    }
    return { ...EMPTY_MENU };
}
function rank(kind: FoodPageRead['kind']): number {
    return { menu: 0, order: 1, reserve: 2, hours: 3, about: 4, home: 5 }[kind];
}
export function unreadableMenus(input: {
    menu: Menu;
    pdfMenus: string[];
    imageMenus: string[];
    hits: FoodPlatformHit[];
    sawAMenuPage: boolean;
}): MenuUnreadable[] {
    const out: MenuUnreadable[] = [];
    for (const url of input.pdfMenus) {
        out.push({ url, reason: 'pdf', detail: 'a PDF menu, found on the page and never requested or parsed' });
    }
    for (const url of input.imageMenus) {
        out.push({ url, reason: 'image', detail: 'the menu is published as an image, which this family does not read' });
    }
    if (input.menu.dishes > 0)
        return out;
    out.push(...platformUnreadable(input.hits, false));
    if (input.sawAMenuPage && !out.some((u) => u.reason === 'platform_refused')) {
        out.push({
            url: input.menu.url,
            reason: 'no_parser',
            detail: 'there is a menu page and nothing in its HTML that either reader recognised — most likely built by JavaScript',
        });
    }
    return out;
}
export function readFoodBusiness(input: FoodReadInput): FoodCard {
    const allHtml = input.pages.map((p) => p.html).join('\n');
    const hits = detectFoodPlatforms(allHtml, input.hint);
    const htmlMenu = readMenu(input);
    const extras = input.extraMenus ?? [];
    const menu = menuIsUsable(htmlMenu) ? htmlMenu
        : extras.find(menuIsUsable)
            ?? [htmlMenu, ...extras].reduce((best, m) => (m.dishes > best.dishes ? m : best), htmlMenu);
    const read = new Set(input.readDocs ?? []);
    menu.unreadable = unreadableMenus({
        menu,
        pdfMenus: (input.pdfMenus ?? []).filter((u) => !read.has(u)),
        imageMenus: (input.imageMenus ?? []).filter((u) => !read.has(u)),
        hits,
        sawAMenuPage: input.pages.some((p) => p.kind === 'menu'),
    });
    const text = input.pages.map((p) => plainText(p.html)).join('\n');
    const words = readOwnPageWords(text);
    const hours: FoodHours = {
        business: hoursFromPlaces((input.openingHours as {
            weekdayDescriptions?: unknown;
        } | null)?.weekdayDescriptions) ?? jsonLdHours(input.pages),
        kitchen: kitchenHoursFromText(text),
        ordering: null,
    };
    const capabilities: FoodCapability[] = capabilitiesFrom({
        hits,
        words,
        menu: { url: menu.url, sections: menu.sections.length, dishes: menu.dishes, priced: menu.priced },
    });
    return buildFoodCard({
        business: input.business,
        menu,
        capabilities,
        hours,
        hits,
        timezone: input.timezone ?? null,
        pagesRead: input.pages.length,
        hoursConflict: hoursConflict(hours),
        readAt: input.readAt,
    });
}
