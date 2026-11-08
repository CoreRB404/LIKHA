import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

let accessibilityIssues=[];
test.beforeEach(()=>{accessibilityIssues=[];});
test.afterEach(()=>expect(accessibilityIssues,'WCAG accessibility findings').toEqual([]));
const password = 'V7!q2R#x';
async function signIn(page, name) {
  await page.goto('/accounts/signup/');
  await page.getByLabel('Display name').fill('Engineering Artist');
  await page.locator('input[name=username]').fill(name);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#accountMessage')).toContainText('Account created');
  await page.goto('/accounts/login/');
  await page.locator('input[name=username]').fill(name);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#dashboardStars')).toHaveText('0');
}
async function accessible(page, label) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  accessibilityIssues.push(...results.violations.map(v => ({page:label,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), label + ' horizontal overflow').toBe(true);
}

test('accessible screens, keyboard dialog, private save and failure recovery', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await accessible(page, 'Welcome');
  await page.goto('/accounts/login/');
  await accessible(page, 'Login');
  await page.goto('/accounts/signup/');
  await accessible(page, 'Signup');
  await signIn(page, `${info.project.name}-${Date.now()}`);
  await accessible(page, 'Dashboard');
  for (const path of ['/avatar.html', '/pet.html', '/quiz.html', '/settings.html']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await accessible(page, path);
  }
  await page.goto('/studio.html?lab=fashion');
  await page.locator('#canvasToolStatus').waitFor();
  await accessible(page, 'Fashion drawing');
  const canvas = page.locator('#artCanvas');
  await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.evaluate(c => c.toDataURL());
  await canvas.focus();await page.keyboard.press('Shift+ArrowRight');expect(await canvas.evaluate(c=>c.toDataURL())).not.toBe(before);await page.keyboard.press('Control+z');expect(await canvas.evaluate(c=>c.toDataURL())).toBe(before);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7, { steps: 6 });
  await page.mouse.up();
  expect(await canvas.evaluate(c => c.toDataURL())).not.toBe(before);
  if(info.project.name.startsWith('mobile-')) {
    const beforeTouch=await canvas.evaluate(c=>c.toDataURL());
    await page.locator('#addStar').click();await canvas.tap({position:{x:box.width/2,y:box.height/2}});
    expect(await canvas.evaluate(c=>c.toDataURL())).not.toBe(beforeTouch);
  }
  const drawing = await canvas.evaluate(c => c.toDataURL());
  await page.getByRole('button', { name: /Save Artwork/ }).click();
  const modal = page.getByRole('dialog', { name: 'Save artwork' });
  await expect(page.locator('#artworkTitle')).toBeFocused();
  await accessible(page, 'Save dialog');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#cancelSaveBtn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#artworkTitle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.locator('#saveArtworkBtn')).toBeFocused();
  await page.locator('#saveArtworkBtn').click();
  await page.locator('#artworkTitle').fill('A safe <script>title</script>');
  let calls = 0;
  const ids = [];
  await page.route('**/api/v1/artworks', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++;
    const body = route.request().postDataBuffer().toString();
    ids.push(body.match(/name="client_id"\r\n\r\n([^\r]+)/)?.[1]);
    if (calls === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Storage is temporarily unavailable.' } }) });
    return route.continue();
  });
  await page.locator('#confirmSaveBtn').click();
  await expect(page.locator('#hostStatus')).toContainText('Storage is temporarily unavailable');
  expect(await canvas.evaluate(c => c.toDataURL())).toBe(drawing);
  await page.locator('#confirmSaveBtn').click();
  await expect(page).toHaveURL(/gallery.html/);
  expect(ids[0]).toBeTruthy();
  expect(ids[1]).toBe(ids[0]);
  await expect(page.locator('[data-artwork-id]')).toHaveCount(1);
  await expect(page.locator('[data-artwork-id] h3')).toHaveText('A safe <script>title</script>');
  await accessible(page, 'Gallery');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.locator('#closeArtworkPreview')).toBeFocused();
  await accessible(page, 'Preview dialog');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
  await page.evaluate(password => LikhaAPI.request('/api/v1/me', { method:'DELETE', body:{password,confirmation:'DELETE'} }), password);
});

test('lab-specific choices and touch-safe layouts', async ({ page }, info) => {
  await signIn(page, `labs-${info.project.name}-${Date.now()}`);
  const expected = { fashion:['shirt','dress','barong','malong'], festival:['parol','mask'], craft:['basket','banig','fan','pot'], art:['blank','flower','house','mountain'] };
  for (const [lab, choices] of Object.entries(expected)) {
    await page.goto('/studio.html?lab='+lab);
    await expect(page.locator('#templateGallery button')).toHaveCount(choices.length);
    expect(await page.locator('#templateSelect option').evaluateAll(options => options.map(o => o.value))).toEqual(choices);
    await accessible(page, lab);
  }
  await page.evaluate(password => LikhaAPI.request('/api/v1/me', { method:'DELETE', body:{password,confirmation:'DELETE'} }), password);
});
