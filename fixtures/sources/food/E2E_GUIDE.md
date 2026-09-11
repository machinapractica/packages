# E2E Testing Guide

This project uses [Playwright](https://playwright.dev/) for End-to-End testing. Our E2E tests are the primary source of truth for application correctness.

## 1. The Philosophy: "Zero-Pixel Tolerance"

We enforce a strict **Zero-Pixel Tolerance** policy for visual regression. Since visual state is the primary feedback mechanism for the user, any deviation is considered a bug.

*   **Software Rendering**: We use software rendering (browsers launched with specific flags) to ensure 100% consistent snapshots across CI and local environments.
*   **Determinism**: Tests must be perfectly deterministic. Random seeds must be fixed.

## 2. Test Structure

All E2E tests live in `tests/e2e/`. Each test case gets its own directory.

```
tests/e2e/
├── helpers/                   # Shared utilities (TestStepHelper)
├── 001-game-start/            # Scenario Directory
│   ├── 001-game-start.spec.ts # Main test file
│   ├── README.md              # Auto-generated verification doc
│   └── screenshots/           # Committed baseline images
```

## 3. The "Unified Step Pattern"

To prevent synchronization errors between documentation and screenshots, we use a **Unified Step API**. You must **NEVER** manually manage filenames or counters.

### The `TestStepHelper`

We use a helper class `TestStepHelper` that combines documentation, verification, and capturing into a single atomic operation: `step()`.

#### Usage

```typescript
import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User logs food', async ({ page }, testInfo) => {
  // 1. Initialize
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Food Logging', 'As a user, I want to log my meal.');

  // 2. Perform Action & Verify
  await page.goto('/');
  await tester.step('initial-load', {
    description: 'Dashboard is visible',
    verifications: [
      { spec: 'Title is correct', check: async () => await expect(page).toHaveTitle('Food') }
    ]
  });

  // 3. Conclude
  tester.generateDocs();
});
```

This automatically:
1.  Generates numbered screenshots (e.g., `000-initial-load.png`).
2.  Runs verifications.
3.  Generates a documentation markdown file for the test run.

## 4. Playwright Configuration

-   **Browsers**: Tests run in Chromium by default.
-   **Flags**: We use flags like `--disable-gpu`, `--font-render-hinting=none` to ensure consistent rendering.
-   **Timeouts**: The maximum acceptable timeout for any condition is **2000ms**.
-   **Waits**: `waitForTimeout` and other arbitrary waits are not allowed; always wait on real UI conditions like `expect().toBeVisible()` or `waitForSelector`.
