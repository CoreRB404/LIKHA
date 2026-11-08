// Real-browser smoke check. Requires Chrome and Node 22+; no npm dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.LIKHA_URL || 'http://127.0.0.1:8000';
const profile = await mkdtemp(join(tmpdir(), 'likha-browser-audit-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Chrome did not start');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const requests = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
      else callback.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Network.requestWillBeSent') requests.set(message.params.requestId, message.params.request.url);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(`${message.params.response.status} ${message.params.response.url}`);
    if (message.method === 'Network.loadingFailed') {
      const url = requests.get(message.params.requestId) || '';
      if (url.startsWith(base) && message.params.errorText !== 'net::ERR_ABORTED') errors.push(`${message.params.errorText} ${url}`);
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true });
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  if (base.includes('.devtunnels.ms')) {
    await send('Network.setExtraHTTPHeaders', { headers: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' } });
  }
  // Check the application's local resources independently of third-party font availability.
  await send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] });
  async function visit(path, expected = path.split(/[?#]/)[0]) {
    errors.length = 0;
    await send('Page.navigate', { url: base + path });
    for (let i = 0; i < 100; i++) {
      await delay(100);
      const ready = await evaluate(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(expected)}`);
      if (ready) break;
    }
    assert.equal(await evaluate('location.pathname'), expected, `Navigation failed: ${path}`);
    assert.equal(await evaluate('document.readyState'), 'complete', `Page never finished loading: ${path}`);
    await evaluate(`Promise.all([...document.images].map(async img => { img.loading = 'eager'; try { await img.decode(); } catch {} }))`);
    await evaluate(`window.LikhaPetArt ? Promise.all([...document.querySelectorAll('img[data-pet-art-key]')].map(image => { const [type,level]=image.dataset.petArtKey.split(':');return LikhaPetArt.apply(image,type,level); })) : undefined`);
    const broken = await evaluate(`[...document.images].filter(img => img.getAttribute('src') && !img.hidden && getComputedStyle(img).display !== 'none' && (!img.complete || !img.naturalWidth)).map(img => img.src)`);
    assert.deepEqual(broken, [], `Broken images on ${path}`);
    assert.deepEqual(errors, [], `Browser errors on ${path}`);
    console.log(`PASS ${path}`);
  }
  async function chooseMask(design) {
    await evaluate(`document.getElementById('maskReferenceSelect').value = '${design}'; document.getElementById('maskReferenceSelect').dispatchEvent(new Event('change'))`);
    for (let i = 0; i < 150; i++) {
      if (await evaluate(`document.getElementById('referenceCanvas').dataset.maskDesign === '${design}'`)) return evaluate(`document.getElementById('referenceCanvas').toDataURL()`);
      await delay(100);
    }
    throw new Error(`Mask image did not render: ${design}`);
  }
  if (!process.argv.includes('--craft-only') && !process.argv.includes('--mask-only') && !process.argv.includes('--pet-visuals-only')) {
  for (const page of ['/', '/dashboard.html', '/studio.html', '/quiz.html', '/avatar.html', '/gallery.html', '/pet.html']) await visit(page);
  for (const page of ['index', 'dashboard', 'studio', 'quiz', 'avatar', 'gallery']) {
    await visit(`/.vscode/${page}.html?check=1#choose-lab`, `/${page}.html`);
    assert.equal(await evaluate('location.search + location.hash'), '?check=1#choose-lab');
  }
  await visit('/.vscode/grow-a-pet.html', '/pet.html');
  await visit('/challenges.html', '/dashboard.html');
  assert.equal(await evaluate('location.hash'), '#dailyChallenge');
  await visit('/.vscode/weekly-quiz.html/', '/quiz.html');
  await visit('/dashboard.html#choose-lab');
  assert.equal(await evaluate(`document.getElementById('view-studio').classList.contains('active')`), true);
  for (const lab of ['fashion', 'festival', 'craft', 'art']) {
    await evaluate(`localStorage.setItem('selectedLab', ${JSON.stringify(lab)})`);
    await visit('/studio.html');
    assert.equal(await evaluate(`document.body.classList.contains('lab-${lab}')`), true);
    const templates = await evaluate(`[...document.querySelectorAll('[data-template]')].map(button => button.dataset.template)`);
    for (const template of templates) {
      await evaluate(`document.querySelector('[data-template="${template}"]').click()`);
      const onMainCanvas = lab === 'craft' || (lab === 'festival' && template === 'parol');
      assert.equal(await evaluate(`document.getElementById('referencePanel').hidden`), onMainCanvas || template === 'blank');
      assert.equal(await evaluate(`document.getElementById('artCanvas').getContext('2d').getImageData(0, 0, 1000, 700).data.every(value => value === 255)`), !onMainCanvas || template === 'blank');
      if (lab === 'festival' && template === 'mask') {
        const designs = [];
        for (const design of ['blue-gold', 'purple-gold', 'turquoise-stars', 'coral-gold']) {
          designs.push(await chooseMask(design));
        }
        assert.equal(new Set(designs).size, 4, 'Mask variants must have distinct references');
      }
    }
    console.log(`PASS ${lab}: ${templates.join(', ')}`);
  }
  async function waitForNavigation(expression) {
    for (let i = 0; i < 150; i++) {
      await delay(100);
      try { if (await evaluate(`document.readyState === 'complete' && (${expression})`)) return; }
      catch { /* The execution context changes during navigation. */ }
    }
    throw new Error(`Navigation did not finish: ${expression}`);
  }
  for (const lab of ['fashion', 'festival', 'craft', 'art']) {
    await visit('/dashboard.html#choose-lab');
    const href = await evaluate(`document.querySelector('#studioLabs [data-open-lab="${lab}"]').getAttribute('href')`);
    assert.equal(href, `studio.html?lab=${lab}`);
    // Selecting a lab must work even if storage rejects the saved preference.
    await evaluate(`(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'selectedLab') throw new DOMException('Storage full', 'QuotaExceededError'); return original.call(this, key, value); }; document.querySelector('#studioLabs [data-open-lab="${lab}"]').click(); })()`);
    await waitForNavigation(`location.pathname === '/studio.html' && location.search === '?lab=${lab}' && document.body.classList.contains('lab-${lab}')`);
    await evaluate(`document.querySelector('.back-link').click()`);
    await waitForNavigation(`location.pathname === '/dashboard.html' && document.getElementById('view-studio').classList.contains('active')`);
    console.log(`PASS actual ${lab} link and Choose Another Lab with unavailable storage`);
  }
  await visit('/dashboard.html');
  for (const section of ['dashboard', 'studio', 'gallery', 'avatar', 'pet', 'assessments', 'progress']) {
    await evaluate(`document.querySelector('[data-view="${section}"]').click()`);
    assert.equal(await evaluate(`document.getElementById('view-${section}').classList.contains('active')`), true);
    await evaluate(`Promise.all([...document.querySelectorAll('#view-${section} img')].map(async img => { if(img.dataset.petArtKey){const [type,level]=img.dataset.petArtKey.split(':');await LikhaPetArt.apply(img,type,level);}await img.decode(); }))`);
  }
  for (const pet of ['rabbit', 'cat', 'dog', 'lion', 'panda', 'tiger']) {
    await evaluate(`document.querySelector('[data-view="pet"]').click(); document.querySelector('[data-pet="${pet}"]').click()`);
    assert.equal(await evaluate(`(async () => { const img = document.querySelector('#petLargeEmoji img');const [type,level]=img.dataset.petArtKey.split(':');await LikhaPetArt.apply(img,type,level);return img.dataset.petArtState==='ready' && img.naturalWidth>0; })()`), true);
    await evaluate(`Promise.all([...document.querySelectorAll('#petGrowthJourney img')].map(img => {const [type,level]=img.dataset.petArtKey.split(':');return LikhaPetArt.apply(img,type,level);}))`);
  }
  console.log('PASS every dashboard section and all six dashboard pet previews and growth images');
  await visit('/pet.html');
  for (const pet of ['rabbit', 'cat', 'dog', 'lion', 'panda', 'tiger']) {
    await evaluate(`document.querySelector('[data-pet="${pet}"]').click()`);
    assert.equal(await evaluate(`(async () => { const img = document.getElementById('petPreview');const [type,level]=img.dataset.petArtKey.split(':');await LikhaPetArt.apply(img,type,level);return img.dataset.petArtState==='ready' && img.naturalWidth>0; })()`), true);
  }
  console.log('PASS all six standalone pet previews');
  for (const pet of ['cat', 'tiger']) {
    await evaluate(`document.querySelector('[data-pet="${pet}"]').click()`);
    const fallback = await evaluate(`(async () => { const img = document.querySelector('[data-pet=\"${pet}\"] img'); await img.decode(); img.dispatchEvent(new Event('error')); await img.decode(); return { src: img.src, width: img.naturalWidth }; })()`);
    assert.ok(fallback.width > 0 && !fallback.src.endsWith('.webp'), `Original image fallback failed for ${pet}`);
  }
  console.log('PASS PNG and JPEG fallbacks after repeated pet selection');
  // Each scenario uses this test browser's isolated local storage.
  for (const [count, name, level] of [[2, 'Growing Pet', 'growing'], [5, 'Young Companion', 'young'], [8, 'Fully Grown Companion', 'grown']]) {
    await evaluate(`localStorage.clear(); localStorage.setItem('likhaDashboardPrototype_v1', JSON.stringify({ pet: { name: 'Progress test', type: 'cat', growthPoints: 0 }, completedActivities: [] })); localStorage.setItem('likhaArtworks', JSON.stringify(Array.from({length:${count}}, (_, i) => ({id:'growth-test-'+i, title:'Test', lab:'art'})))); localStorage.setItem('likhaPet', JSON.stringify({points:${count}}));`);
    await visit('/pet.html');
    assert.equal(await evaluate(`document.getElementById('petStage').textContent`), name);
    assert.equal(await evaluate(`LikhaPetProgress.metrics(JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1'))).units`), count);
    await evaluate(`document.getElementById('petNameInput').value = 'Saved companion'; document.querySelector('[data-pet="dog"]').click(); document.getElementById('savePetBtn').click()`);
    await visit('/pet.html');
    assert.equal(await evaluate(`document.getElementById('petStage').textContent`), name);
    assert.equal(await evaluate(`document.getElementById('petNameDisplay').textContent`), 'Saved companion');
    await visit('/dashboard.html#pet');
    assert.equal(await evaluate(`document.getElementById('petLargeStage').textContent`), name);
    assert.equal(await evaluate(`document.querySelector('#petGrowthJourney .is-current').dataset.stage`), level);
    await evaluate(`document.getElementById('savePet').click()`);
    await visit('/pet.html');
    assert.equal(await evaluate(`document.getElementById('petStage').textContent`), name);
  }
  console.log('PASS recovered 2/5/8 artwork stages across both pet screens, saving and reloading without duplicate credit');
  await evaluate(`localStorage.clear()`);
  for (let i = 0; i < 4; i++) {
    await visit(`/studio.html?lab=${['fashion', 'festival', 'craft', 'art'][i]}`);
    await evaluate(`document.getElementById('saveArtworkBtn').click(); document.getElementById('artworkTitle').value = 'Growth artwork ${i}'; document.getElementById('artworkDetailsForm').requestSubmit();`);
    await waitForNavigation(`location.pathname === '/gallery.html'`);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`), [20, 35, 50, 75][i]);
  }
  await visit('/pet.html');
  assert.equal(await evaluate(`document.getElementById('petStage').textContent`), 'Growing Pet');
  assert.equal(await evaluate(`LikhaPetProgress.metrics(JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1'))).units`), 4);
  await visit('/dashboard.html#pet');
  assert.equal(await evaluate(`document.getElementById('petLargeStage').textContent`), 'Growing Pet');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`), 75);
  await evaluate(`openCreateForm('Art Lab'); for (const id of ['artworkTitle','artworkSubject','artworkTheme','artworkFormConcept','artworkStyle','artworkSymbolism','artworkMedium','artworkPreview']) document.getElementById(id).value = 'Reward test'; document.getElementById('artworkForm').requestSubmit();`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`), 90);
  await visit('/dashboard.html');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`), 90);
  console.log('PASS all four lab saves earn 75 stars with bonuses; fifth dashboard artwork adds 15 once; growth and stars persist after reload');
  }
  if (!process.argv.includes('--mask-only') && !process.argv.includes('--pet-visuals-only')) {
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await visit('/studio.html?lab=craft');
  for (const [lab, template, path] of [['craft', 'basket', 'craftlab/Basket.mp4'], ['craft', 'banig', 'craftlab/Banig_v3.mp4'], ['craft', 'fan', 'craftlab/Fan.mp4'], ['craft', 'pot', 'craftlab/claypot.mp4'], ['festival', 'parol', 'festival_lab/paper%20parol.mov']]) {
    if (lab === 'festival') await visit('/studio.html?lab=festival');
    await evaluate(`document.querySelector('[data-template="${template}"]').click()`);
    const picture = await evaluate(`document.getElementById('artCanvas').toDataURL()`);
    const bounds = await evaluate(`(() => { const pixels = document.getElementById('artCanvas').getContext('2d').getImageData(0,0,1000,700).data; let left=1000,right=0,top=700,bottom=0; for(let y=0;y<700;y++) for(let x=0;x<1000;x++){const i=(y*1000+x)*4;if(pixels[i]<245||pixels[i+1]<245||pixels[i+2]<245){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}return {left,right,top,bottom};})()`);
    assert.ok(Math.abs((bounds.left + bounds.right) / 2 - 500) < 25 && Math.abs((bounds.top + bounds.bottom) / 2 - 350) < 25, `${template} must be centered`);
    assert.ok(bounds.bottom - bounds.top > 350, `${template} must be large`);
    assert.equal(await evaluate(`document.getElementById('referenceVideo').hasAttribute('src')`), false, 'Videos must not download before Next');
    assert.equal(await evaluate(`document.getElementById('referenceNext').hidden`), false);
    await evaluate(`document.getElementById('referenceNext').click()`);
    assert.equal(await evaluate(`document.getElementById('referenceVideo').getAttribute('src')`), path);
    assert.equal(await evaluate(`document.getElementById('craftWorkspace').hidden`), true);
    assert.ok(await evaluate(`document.querySelectorAll('#craftMaterialsList li').length >= 4`));
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tool-panel')).display`), 'none');
    assert.equal(await evaluate(`document.getElementById('referenceVideo').getBoundingClientRect().right <= document.querySelector('.craft-materials').getBoundingClientRect().left`), true);
    const duration = await evaluate(`new Promise((resolve, reject) => { const video = document.getElementById('referenceVideo'); if (video.readyState >= 1) return resolve(video.duration); const timer = setTimeout(() => reject(new Error('Tutorial metadata timed out: ${template}')), 20000); video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(video.duration); }, {once:true}); video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Tutorial cannot play: ${template}')); }, {once:true}); })`);
    assert.ok(duration > 0, `No duration for ${template}`);
    await evaluate(`(async () => { const video = document.getElementById('referenceVideo'); video.muted = true; await video.play(); })()`);
    await evaluate(`document.getElementById('tutorialBack').click()`);
    assert.equal(await evaluate(`document.getElementById('referenceVideo').paused`), true);
    assert.equal(await evaluate(`document.getElementById('craftWorkspace').hidden`), false);
    assert.equal(await evaluate(`document.getElementById('artCanvas').toDataURL()`), picture, 'Tutorial navigation must preserve the drawing');
    assert.equal(await evaluate(`document.getElementById('referenceTutorial').hidden`), true);
    console.log(`PASS ${template}: large centered canvas, correct video (${duration.toFixed(1)}s) on left, materials on right, Back preserves drawing and pauses video`);
  }
  await evaluate(`document.getElementById('referenceNext').click(); document.querySelector('[data-template="mask"]').click()`);
  assert.equal(await evaluate(`document.getElementById('referenceVideo').hasAttribute('src')`), false);
  assert.equal(await evaluate(`document.getElementById('referenceTutorial').hidden`), true);
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  for (const lab of ['craft', 'festival']) {
    await visit(`/studio.html?lab=${lab}`);
    await evaluate(`document.getElementById('referenceNext').click()`);
    assert.equal(await evaluate(`document.querySelector('.craft-materials').getBoundingClientRect().top >= document.getElementById('referenceVideo').getBoundingClientRect().bottom`), true);
    assert.equal(await evaluate(`document.body.scrollWidth <= innerWidth + 1`), true);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  console.log('PASS mobile tutorial stacks video and materials without horizontal overflow');
  await visit('/studio.html?lab=festival');
  assert.equal(await evaluate(`document.getElementById('referenceNext').hidden`), false);
  await evaluate(`document.querySelector('[data-template="mask"]').click()`);
  assert.equal(await evaluate(`document.getElementById('referenceNext').hidden`), true);
  }
  if (!process.argv.includes('--pet-visuals-only')) {
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await visit('/studio.html?lab=festival');
  await evaluate(`document.querySelector('[data-template="mask"]').click()`);
  const maskImages = [];
  for (const design of ['blue-gold', 'purple-gold', 'turquoise-stars', 'coral-gold']) maskImages.push(await chooseMask(design));
  assert.equal(new Set(maskImages).size, 4);
  assert.equal(await evaluate(`document.querySelectorAll('#maskReferenceChoices [data-mask-design]').length`), 4);
  await evaluate(`document.getElementById('artCanvas').getContext('2d').fillRect(700,490,20,20)`);
  const maskDrawing = await evaluate(`document.getElementById('artCanvas').toDataURL()`);
  await evaluate(`document.querySelector('#maskReferenceChoices [data-mask-design="blue-gold"]').click()`);
  await chooseMask('blue-gold');
  const originalWidth = await evaluate(`document.getElementById('referencePanel').offsetWidth`);
  await evaluate(`document.getElementById('referenceLarger').click()`);
  const largerWidth = await evaluate(`document.getElementById('referencePanel').offsetWidth`);
  assert.ok(largerWidth > originalWidth);
  await evaluate(`document.getElementById('referenceSmaller').click()`);
  assert.ok(await evaluate(`document.getElementById('referencePanel').offsetWidth < ${largerWidth}`));
  await evaluate(`document.getElementById('referenceHide').click()`);
  assert.equal(await evaluate(`document.getElementById('referencePanel').hidden`), true);
  assert.equal(await evaluate(`document.getElementById('referenceToggle').textContent`), 'Show mask');
  await evaluate(`document.getElementById('referenceToggle').click(); document.getElementById('referenceReset').click(); document.getElementById('referencePanel').scrollIntoView({block:'center'})`);
  async function pointerDrag(selector, dx, dy) {
    const point = await evaluate(`(() => { const r=document.querySelector('${selector}').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', {type:'mouseMoved',...point});
    await send('Input.dispatchMouseEvent', {type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:point.x+dx,y:point.y+dy,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:point.x+dx,y:point.y+dy,button:'left',clickCount:1});
  }
  const fixedPosition = await evaluate(`document.getElementById('referencePanel').style.left + ',' + document.getElementById('referencePanel').style.top`);
  await pointerDrag('#referenceCanvas', 70, 45);
  assert.equal(await evaluate(`document.getElementById('referencePanel').style.left + ',' + document.getElementById('referencePanel').style.top`), fixedPosition);
  const beforeResize = await evaluate(`document.getElementById('referencePanel').offsetWidth`);
  await pointerDrag('#referenceResize', 60, 60);
  assert.ok(await evaluate(`document.getElementById('referencePanel').offsetWidth > ${beforeResize}`));
  assert.equal(await evaluate(`document.getElementById('referencePanel').style.left + ',' + document.getElementById('referencePanel').style.top`), fixedPosition);
  assert.equal(await evaluate(`document.getElementById('artCanvas').toDataURL()`), maskDrawing);
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(200);
  assert.equal(await evaluate(`(() => { const p=document.getElementById('referencePanel').getBoundingClientRect(), c=document.querySelector('.canvas-wrap').getBoundingClientRect(); return p.left>=c.left && p.top>=c.top && p.right<=c.right && p.bottom<=c.bottom; })()`), true, 'Mask reference must stay inside the canvas on mobile');
  assert.equal(await evaluate(`document.body.scrollWidth <= innerWidth+1`), true);
  assert.equal(await evaluate(`document.getElementById('artCanvas').toDataURL()`), maskDrawing);
  await send('Emulation.clearDeviceMetricsOverride');
  console.log('PASS four uploaded mask crops, Hide/Show, resizing, fixed position while dragging and resizing, mobile bounds, and preserved artwork');
  }
  if (!process.argv.includes('--craft-only') && !process.argv.includes('--mask-only')) {
    await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const types = ['rabbit','cat','dog','lion','panda','tiger'];
    const stages = [['baby',0],['growing',2],['young',5],['grown',8]];
    const seed = (type,units) => `localStorage.clear();localStorage.setItem('likhaDashboardPrototype_v1',JSON.stringify({pet:{type:'${type}',name:'Visual test',growthPoints:${units*2}},completedActivities:[],artworks:[]}));`;
    async function waitForArt(selector, key) {
      for (let i=0;i<200;i++) {
        const ready = await evaluate(`(() => {const image=document.querySelector('${selector}');return image?.dataset.petArtState==='ready' && image.dataset.petArtKey==='${key}';})()`);
        if (ready) return evaluate(`document.querySelector('${selector}').getAttribute('src')`);
        await delay(100);
      }
      throw new Error(`Stage artwork did not load: ${key}`);
    }
    await visit('/pet.html');
    for (const type of types) {
      const artwork = [], sizes = [];
      for (const [level,units] of stages) {
        await evaluate(`${seed(type,units)}renderPet()`);
        artwork.push(await waitForArt('#petPreview',`${type}:${level}`));
        sizes.push(await evaluate(`document.getElementById('petPreview').getBoundingClientRect().width`));
      }
      assert.equal(new Set(artwork).size,4, `${type} must have four different age illustrations`);
      assert.ok(artwork.every((src,i)=>src.endsWith(`${type}-${stages[i][0]}-v1.webp`)), `${type} must use the correct bundled age artwork`);
      assert.ok(sizes.every(size=>Math.abs(size-sizes[0])<1), 'Growth must change the artwork, not resize the same picture');
      const previews=await evaluate(`[...document.querySelectorAll('#petGrowthJourney img')].map(image=>({key:image.dataset.petArtKey,src:image.getAttribute('src')}))`);
      assert.equal(new Set(previews.map(p=>p.src)).size,4);
      assert.deepEqual(previews.map(p=>p.key),stages.map(([stage])=>`${type}:${stage}`));
      console.log(`PASS ${type}: four different age illustrations in the same display frame and correct journey previews`);
    }
    await visit('/dashboard.html#pet');
    for (const type of types) {
      const compact=[],large=[];
      for (const [level,units] of stages) {
        await evaluate(`${seed(type,units)}state=loadState();refreshDashboard();openView('dashboard')`);
        compact.push(await waitForArt('#dashboardPetEmoji img',`${type}:${level}`));
        await evaluate(`openView('pet')`);
        large.push(await waitForArt('#petLargeEmoji img',`${type}:${level}`));
      }
      assert.equal(new Set(compact).size,4);
      assert.deepEqual(large,compact, 'Both dashboard views must show the same animal and age');
    }
    console.log('PASS all 24 species-and-age illustrations across dashboard and standalone pet screens');
    await visit('/pet.html');
    await waitForArt('#petPreview','tiger:grown');
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await visit('/pet.html');
    await waitForArt('#petPreview','tiger:grown');
    assert.equal(await evaluate(`(() => {const image=document.getElementById('petPreview').getBoundingClientRect(),frame=document.querySelector('.pet-preview-image').getBoundingClientRect();return image.left>=frame.left&&image.right<=frame.right&&image.top>=frame.top&&image.bottom<=frame.bottom&&document.body.scrollWidth<=innerWidth+1;})()`),true);
    await visit('/dashboard.html#pet');
    await waitForArt('#petLargeEmoji img','tiger:grown');
    assert.equal(await evaluate(`document.body.scrollWidth <= innerWidth+1`),true);
    console.log('PASS adult artwork persists after reload and fits mobile without cropping or horizontal overflow');
  }
  console.log('All browser checks passed.');
} finally {
  socket?.close();
  chrome.kill();
}
