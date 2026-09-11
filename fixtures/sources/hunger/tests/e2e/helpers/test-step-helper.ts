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
    private testInfo: TestInfo
  ) {}

  setMetadata(title: string, description: string) {
    this.title = title;
    this.description = description;
  }

  async step(
    id: string,
    options: { description: string; verifications: Verification[] }
  ) {
    for (const verification of options.verifications) await verification.check();
    await expect(this.page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
    await this.page.evaluate(() => document.fonts.ready);
    await this.page.evaluate(async () => {
      const animations = document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
      await Promise.allSettled(animations.map((animation) => animation.finished));
      window.scrollTo(0, 0);
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.classList.contains('skip-link')) active.blur();
    });
    await this.assertLayout();
    await this.page.mouse.move(0, 0);

    const index = String(this.count++).padStart(3, '0');
    const filename = `${index}-${id}-${this.testInfo.project.name}-${process.platform}.png`;
    await expect(this.page).toHaveScreenshot(filename, { fullPage: true });
    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`,
      specs: options.verifications.map(({ spec }) => spec)
    });
  }

  generateDocs() {
    if (this.testInfo.project.name !== 'phone' || process.platform !== 'darwin') return;
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

  private async assertLayout() {
    await this.page.evaluate(() => {
      const root = document.documentElement;
      if (root.scrollWidth > window.innerWidth + 1) {
        throw new Error(
          `page overflows horizontally: ${root.scrollWidth}px inside ${window.innerWidth}px`
        );
      }

      for (const control of document.querySelectorAll<HTMLElement>('a, button, input')) {
        if (!control.checkVisibility()) continue;
        if (control.tagName === 'A' && getComputedStyle(control).display === 'inline') continue;
        const rect = control.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          throw new Error(
            `${control.tagName} ${JSON.stringify(control.innerText || control.getAttribute('aria-label') || '')} target is ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px`
          );
        }
      }
    });
  }
}
