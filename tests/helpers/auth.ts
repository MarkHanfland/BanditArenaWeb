import { getTestAdministratorUser } from './testCredentials';

export async function signInAs(page, roleId: 'operator' | 'technician' | 'venueAdmin') {
  const user = getTestAdministratorUser(roleId);
  await page.goto('/?e2eAuthBypass=true');
  await page.getByTestId('login-username').fill(user.username);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: user.label }).click();
  await page.getByTestId('login-submit').click();
}

export async function signInAsVenueAdmin(page) {
  await signInAs(page, 'venueAdmin');
}
