import { expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Verification {
  spec: string;
  check: () => Promise<void>;
}

export interface StepOptions {
  description: string;
  verifications: Verification[];
  status?: string;
  surfaces?: Array<{ id: string; label: string; page: Page }>;
}

interface DocStep {
  id: string;
  title: string;
  specs: string[];
  surfaces?: Array<{ id: string; label: string }>;
}

const documentedProjects = [
  { id: 'phone', label: 'Phone' },
  { id: 'desktop', label: 'Desktop' }
] as const;

const documentedPlatforms = [
  { suffix: '', label: 'macOS development baseline' },
  { suffix: '-linux', label: 'Linux CI baseline' }
] as const;

export class TestStepHelper {
  private stepCount = 0;
  private steps: DocStep[] = [];
  private metadataTitle = '';
  private metadataDescription = '';

  constructor(
    private page: Page,
    private testInfo: TestInfo
  ) {}

  setMetadata(title: string, description: string) {
    this.metadataTitle = title;
    this.metadataDescription = description;
  }

  async step(id: string, options: StepOptions) {
    for (const verification of options.verifications) await verification.check();

    const surfaces = options.surfaces ?? [
      { id: this.testInfo.project.name, label: this.testInfo.project.name, page: this.page }
    ];
    const paddedIndex = String(this.stepCount++).padStart(3, '0');
    const normalizedId = id.replaceAll('_', '-');
    const platform = process.platform === 'linux' ? '-linux' : '';
    for (const surface of surfaces) {
      await this.settle(surface.page, options.status ?? 'ready');
      const filename = `${paddedIndex}-${normalizedId}-${surface.id}${platform}.png`;
      await expect(surface.page).toHaveScreenshot(filename);
    }
    this.steps.push({
      id: `${paddedIndex}-${normalizedId}`,
      title: options.description,
      specs: options.verifications.map(({ spec }) => spec),
      surfaces: options.surfaces?.map(({ id: surfaceId, label }) => ({ id: surfaceId, label }))
    });
  }

  private async settle(page: Page, status: string) {
    await expect(page.locator('[data-status]')).toHaveAttribute('data-status', status);
    await page.mouse.move(0, 0);
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const animation of document.getAnimations()) {
        const timing = animation.effect?.getTiming();
        if (timing?.iterations !== Infinity && timing?.duration !== Infinity) {
          try {
            animation.finish();
          } catch {
            // Detached animations can disappear while the page settles.
          }
        }
      }

      const root = document.documentElement;
      if (root.scrollWidth > window.innerWidth + 1 || root.scrollHeight > window.innerHeight + 1) {
        throw new Error(
          `page scrolls: ${root.scrollWidth}x${root.scrollHeight} inside ` +
            `${window.innerWidth}x${window.innerHeight}`
        );
      }
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        throw new Error(`page is scrolled to ${window.scrollX},${window.scrollY}`);
      }

      for (const element of document.querySelectorAll<HTMLElement>('[data-e2e-layout] *')) {
        if (element.closest('[data-e2e-ignore-layout]')) continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (
          rect.left < -1 ||
          rect.right > window.innerWidth + 1 ||
          rect.top < -1 ||
          rect.bottom > window.innerHeight + 1
        ) {
          throw new Error(
            `${element.tagName}.${element.className} is outside ` +
              `${window.innerWidth}x${window.innerHeight} at ` +
              `${Math.round(rect.left)},${Math.round(rect.top)}-` +
              `${Math.round(rect.right)},${Math.round(rect.bottom)}`
          );
        }
      }
    });
  }

  generateDocs() {
    if (this.testInfo.project.name !== 'desktop') return;

    let content = `# ${this.metadataTitle}\n\n${this.metadataDescription}\n\n`;
    for (const step of this.steps) {
      content += `## ${step.title}\n\n`;
      const projects = step.surfaces ?? documentedProjects;
      for (const project of projects) {
        content += `### ${project.label}\n\n`;
        for (const platform of documentedPlatforms) {
          const filename = `${step.id}-${project.id}${platform.suffix}.png`;
          const image = `./screenshots/${filename}`;
          const alt = `${step.title} - ${project.label} - ${platform.label}`;
          content += `![${alt}](${image})\n\n`;
          content += `[Open full-size ${platform.label}](${image})\n\n`;
        }
      }
      content += '**Verifications:**\n\n';
      content += `${step.specs.map((spec) => `- [x] ${spec}`).join('\n')}\n\n`;
    }

    fs.writeFileSync(path.join(path.dirname(this.testInfo.file), 'README.md'), `${content.trimEnd()}\n`);
  }
}
