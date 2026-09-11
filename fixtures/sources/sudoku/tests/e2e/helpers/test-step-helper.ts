import { expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Verification {
  spec: string;
  check: () => Promise<void>;
}

interface DocStep {
  title: string;
  image: string;
  specs: string[];
}

export class TestStepHelper {
  private count = 0;
  private steps: DocStep[] = [];
  private title = '';
  private description = '';

  constructor(
    private page: Page,
    private readonly testInfo: TestInfo
  ) {}

  usePage(page: Page): void {
    this.page = page;
  }

  setMetadata(title: string, description: string): void {
    this.title = title;
    this.description = description;
  }

  async step(
    id: string,
    options: { description: string; verifications: Verification[]; persistenceStatus?: 'local' | 'memory-only' }
  ): Promise<void> {
    await this.page.waitForFunction(() => document.documentElement.dataset.eventStorePending !== 'true');
    for (const verification of options.verifications) await verification.check();

    await expect(this.page.locator('[data-app-ready="true"]')).toBeVisible();
    await expect(this.page.locator(`[data-persistence-status="${options.persistenceStatus ?? 'local'}"]`)).toBeVisible();
    await this.page.mouse.move(0, 0);
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      const root = document.documentElement;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const scrollingElement = document.scrollingElement ?? root;
      for (const surface of [root, document.body, document.querySelector<HTMLElement>('.app-shell')]) {
        if (surface && getComputedStyle(surface).touchAction !== 'manipulation') {
          throw new Error(`${surface.tagName.toLowerCase()} permits double-tap zoom`);
        }
      }
      const viewportPolicy = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? '';
      if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?(?:\s|,|$)/i.test(viewportPolicy)) {
        throw new Error('viewport policy disables deliberate user zoom');
      }
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        throw new Error(`page is scrolled to ${window.scrollX},${window.scrollY}`);
      }
      if (
        scrollingElement.scrollWidth > viewport.width + 1 ||
        scrollingElement.scrollHeight > viewport.height + 1
      ) {
        throw new Error(
          `page requires scrolling: ${scrollingElement.scrollWidth}×${scrollingElement.scrollHeight} ` +
          `inside ${viewport.width}×${viewport.height}`
        );
      }

      for (const element of document.querySelectorAll<HTMLElement>('body *')) {
        if (element.matches('.sr-live, .sr-live *, #svelte-announcer, #svelte-announcer *') || !element.checkVisibility()) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1) {
          throw new Error(
            `${element.tagName.toLowerCase()} escapes or is clipped by the viewport at ` +
            `${rect.left},${rect.top}–${rect.right},${rect.bottom}`
          );
        }
        const style = getComputedStyle(element);
        const clipsWidth = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible';
        const clipsHeight = element.scrollHeight > element.clientHeight + 1 && style.overflowY !== 'visible';
        if (element.clientWidth > 0 && element.clientHeight > 0 && (clipsWidth || clipsHeight)) {
          throw new Error(
            `${element.tagName.toLowerCase()} clips ${element.scrollWidth}×${element.scrollHeight} ` +
            `inside ${element.clientWidth}×${element.clientHeight}`
          );
        }
      }

      for (const control of document.querySelectorAll<HTMLElement>('button:not([disabled]):not([data-e2e-board-cell]), a[href]')) {
        if (!control.checkVisibility()) continue;
        const rect = control.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          throw new Error(`${control.tagName.toLowerCase()} target is ${rect.width}×${rect.height}`);
        }
      }
    });

    const index = String(this.count++).padStart(3, '0');
    const filename = `${index}-${id}-${this.testInfo.project.name}-macos.png`;
    await expect(this.page).toHaveScreenshot(filename);
    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`,
      specs: options.verifications.map(({ spec }) => spec)
    });
  }

  generateDocs(): void {
    const canonicalProject = this.testInfo.project.name === 'phone' || this.testInfo.project.name === 'offline';
    if (process.env.UPDATE_E2E_DOCS !== '1' || !canonicalProject) return;

    let content = `# ${this.title}\n\n${this.description}\n\n`;
    for (const step of this.steps) {
      content += `## ${step.title}\n\n![${step.title}](${step.image})\n\n`;
      content += `**Verifications:**\n\n${step.specs.map((spec) => `- [x] ${spec}`).join('\n')}\n\n`;
    }
    fs.writeFileSync(
      path.join(path.dirname(this.testInfo.file), 'README.md'),
      `${content.trimEnd()}\n`
    );
  }
}
