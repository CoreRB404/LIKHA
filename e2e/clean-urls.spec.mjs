import { test, expect } from '@playwright/test';

test('clean routes preserve bookmarks and restrict login return destinations', async ({page,request},info)=>{
  const old=await request.get('/studio.html?lab=fashion&challenge=textile-fashion',{maxRedirects:0});
  expect(old.status()).toBe(301);
  expect(old.headers().location).toBe('/studio/?lab=fashion&challenge=textile-fashion');
  const username=`routes-${info.project.name}-${Date.now()}`,password='V7!q2R#x';
  await page.goto('/accounts/signup/');
  await expect(page.locator('#accountForm')).toHaveAttribute('method','post');
  await page.getByLabel('Display name').fill('Clean URL Artist');
  await page.getByLabel('Username',{exact:true}).fill(username);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#accountMessage')).toContainText('Account created');
  async function login(next) {
    await page.goto('/accounts/login/?next='+encodeURIComponent(next));
    await page.getByLabel('Username',{exact:true}).fill(username);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
  }
  await login('/studio.html?lab=fashion#main');
  await expect(page).toHaveURL(url=>url.pathname==='/studio/' && url.searchParams.get('lab')==='fashion' && url.hash==='#main');
  await expect(page.locator('#artCanvas')).toBeVisible();
  expect(await page.locator('a[href]').evaluateAll(links=>links.every(a=>!new URL(a.href).pathname.endsWith('.html')))).toBe(true);
  await login('//evil.invalid');
  await expect(page).toHaveURL(url=>url.pathname==='/dashboard/');
  await expect(page.locator('#welcomeName')).toHaveText('Clean URL Artist');
  await page.goto('/dashboard.html#progress');
  await expect(page).toHaveURL(url=>url.pathname==='/dashboard/' && url.hash==='#progress');
  await expect(page.locator('#view-progress')).toBeVisible();
  await page.evaluate(password=>LikhaAPI.request('/api/v1/me',{method:'DELETE',body:{password,confirmation:'DELETE'}}),password);
});
