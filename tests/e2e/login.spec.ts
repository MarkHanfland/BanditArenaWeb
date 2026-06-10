import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';

test('login form validates required fields and allows sign in', async ({ page }) => {
  const operator = getTestAdministratorUser('operator');

  await page.goto('/?e2eAuthBypass=true');

  await expect(page.getByRole('heading', { name: 'Bandit Arena Login' })).toBeVisible();

  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toHaveText('Username and password are required.');

  await page.getByTestId('login-username').fill(operator.username);
  await page.getByTestId('login-password').fill(operator.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: operator.label }).click();

  await page.getByTestId('login-submit').click();

  await expect(page.getByText('BANDIT ARENA', { exact: true })).toBeVisible();
  await expect(page.getByTestId('menu-dashboard')).toBeVisible();
  await expect(page.getByTestId('sign-out')).toBeVisible();

  await page.getByTestId('sign-out').click();
  await expect(page.getByRole('heading', { name: 'Bandit Arena Login' })).toBeVisible();
});
