import type { Browser, BrowserContext, Page } from '@playwright/test';
/** Every actor gets independent storage. Service workers blocked so HTTP routing is observable. */
export declare function actor(browser: Browser, options: {
    name: string;
    viewport: {
        width: number;
        height: number;
    };
    origins: string[];
    allowRequest?: (url: URL) => boolean;
    clock?: number;
    seed?: number;
}): Promise<{
    context: BrowserContext;
    page: Page;
    assertNetwork: () => void;
    close: () => Promise<void>;
}>;
/** Caller must first assert app-specific semantics/readiness. Screenshot disables finite animations. */
export declare function capture(page: Page, directory: string, index: number, actorName: string): Promise<import("./index.js").Capture>;
