import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('original landing, sidebar views and saved profile retain their design', async ({page}, info) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.hero-logo')).toBeVisible();
  await expect(page.locator('.hero h1')).toContainText('Wonderful');
  await page.screenshot({path:`var/original-home-${info.project.name}.png`,fullPage:true});
  const password='V7!q2R#x',username=`original-${info.project.name}-${Date.now()}`;
  await page.goto('/accounts/signup/');
  await page.getByLabel('Display name').fill('Original Artist');
  await page.getByLabel('Username',{exact:true}).fill(username);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('#accountMessage')).toContainText('Account created');
  await page.goto('/accounts/login/');
  await page.getByLabel('Username',{exact:true}).fill(username);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#welcomeName')).toHaveText('Original Artist');
  await expect(page.locator('.sidebar .brand img')).toHaveAttribute('src','/static/assets/likha-logo.webp');
  await expect(page.locator('#dashboardLabs > .lab-card')).toHaveCount(4);
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('dashboard-design.webp');
  await page.screenshot({path:`var/original-dashboard-${info.project.name}.png`,fullPage:true});
  if (info.project.name.startsWith('mobile-')) {
    await page.locator('#dashboardMenuToggle').click();
    await expect(page.locator('#dashboardSidebar')).toBeVisible();
    await page.locator('[data-view=studio]').click();
    await expect(page.locator('#view-studio')).toBeVisible();
    await expect(page.locator('#dashboardSidebar')).toBeHidden();
    await page.locator('#dashboardMenuToggle').click();
    await page.locator('#dashboardMenuClose').click();
    await expect(page.locator('#dashboardMenuToggle')).toBeFocused();
  }
  const accessibility=[];
  for(const view of ['studio','gallery','avatar','pet','assessments','progress']) {
    await page.goto('/dashboard/#'+view);
    await expect(page.locator('#view-'+view)).toBeVisible();
    const findings=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    accessibility.push(...findings.violations.map(v=>({view,id:v.id,nodes:v.nodes.map(n=>n.target)})));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),view+' overflow').toBe(true);
  }
  expect(accessibility).toEqual([]);
  await page.goto('/dashboard/#avatar');
  await page.locator('#avatarFaceInput').selectOption('avatar-filipino-artist-6');
  await page.locator('#avatarNameInput').fill('Original Artist Saved');
  await page.locator('#saveAvatar').click();
  await expect(page.locator('#welcomeName')).toHaveText('Original Artist Saved');
  await page.goto('/dashboard/#pet');
  await page.locator('[data-pet=panda]').click();
  await page.locator('#petNameInput').fill('Kidlat');
  await page.locator('#savePet').click();
  await expect(page.locator('#petLargeName')).toHaveText('Kidlat');
  await page.reload();
  await expect(page.locator('#petLargeName')).toHaveText('Kidlat');
  await page.goto('/quiz/?assessment=week1');
  await page.locator('#startQuizBtn').click();
  for(let index=0;index<5;index++) {
    await expect(page.locator('#questionCounter')).toContainText('Question '+(index+1));
    await page.locator('#answerOptions .answer-option').first().click();
    await page.locator('#nextQuestionBtn').click();
  }
  await expect(page.locator('#quizResultsSection')).toBeVisible();
  await expect(page.locator('#resultHeading')).toContainText('You scored');
  await page.goto('/dashboard/#progress');
  await expect(page.locator('#progressQuizzes')).toHaveText('1');
  await expect(page.locator('#quizScoreChart circle')).toHaveCount(1);
  expect(errors).toEqual([]);
  await page.evaluate(password=>LikhaAPI.request('/api/v1/me',{method:'DELETE',body:{password,confirmation:'DELETE'}}),password);
});
