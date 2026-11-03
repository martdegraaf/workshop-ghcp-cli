import { test, expect, type Page } from '@playwright/test';

async function gameCardCount(page: Page): Promise<number> {
  return page.locator('[data-testid="game-card"]:visible').count();
}

test.describe('Game filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-filters')).toBeVisible();
  });

  test('filters by a single category', async ({ page }) => {
    const total = await gameCardCount(page);
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    await checkbox.check();
    const label = (await checkbox.locator('xpath=..').innerText()).trim();

    const visible = page.locator('[data-testid="game-card"]:visible');
    expect(await visible.count()).toBeLessThan(total);
    for (const category of await visible.getByTestId('game-category').allInnerTexts()) {
      expect(category.trim()).toBe(label);
    }
    await expect(page.getByTestId('filter-result-count')).toContainText('games shown');
  });

  test('filters by multiple categories', async ({ page }) => {
    const boxes = page.locator('[data-testid^="filter-category-"]');
    await boxes.nth(0).check();
    const one = await gameCardCount(page);
    await boxes.nth(1).check();
    expect(await gameCardCount(page)).toBeGreaterThan(one);
  });

  test('filters by publisher', async ({ page }) => {
    const select = page.getByTestId('filter-publisher');
    await select.selectOption({ index: 1 });
    const name = await select.locator('option:checked').innerText();

    const visible = page.locator('[data-testid="game-card"]:visible');
    expect(await visible.count()).toBeGreaterThan(0);
    for (const publisher of await visible.getByTestId('game-publisher').allInnerTexts()) {
      expect(publisher.trim()).toBe(name.trim());
    }
  });

  test('combines category and publisher filters', async ({ page }) => {
    const total = await gameCardCount(page);
    await page.locator('[data-testid^="filter-category-"]').first().check();
    const categoryOnly = await gameCardCount(page);
    await page.getByTestId('filter-publisher').selectOption({ index: 1 });
    const combined = await gameCardCount(page);

    expect(combined).toBeLessThanOrEqual(categoryOnly);
    expect(combined).toBeLessThan(total);
    await expect(page.getByTestId('empty-state')).toBeHidden();
  });

  test('clear button resets filters', async ({ page }) => {
    const total = await gameCardCount(page);
    await page.locator('[data-testid^="filter-category-"]').first().check();
    await page.getByTestId('filter-clear').click();
    await expect.poll(() => gameCardCount(page)).toBe(total);
    await expect(page.getByTestId('filter-result-count')).toBeEmpty();
  });

  test('is operable with the keyboard and persists in the URL', async ({ page }) => {
    const first = page.locator('[data-testid^="filter-category-"]').first();
    await first.focus();
    await page.keyboard.press('Space');
    await expect(first).toBeChecked();
    await expect(page).toHaveURL(/\?category=\d+/);

    await page.reload();
    await expect(first).toBeChecked();
  });
});
