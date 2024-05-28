import { expect, test } from '@playwright/test';

test('test', async ({ page }) => {
	await page.goto('/');
	expect(true).toBeTruthy();
});
