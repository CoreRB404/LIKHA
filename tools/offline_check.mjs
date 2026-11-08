// Real-browser smoke check. Requires Chrome and Node 22+; no npm dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.LIKHA_OFFLINE_URL || new URL('../', import.meta.url).href.replace(/\/$/, '');
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

  // Block all internet access: these checks must work from ordinary file URLs.
  await send('Network.setBlockedURLs',{urls:['http://*','https://*']});
  async function readyFile(path) {
    const expected=new URL(path,base+'/').href;
    for(let i=0;i<150;i++){
      await delay(100);
      try { if(await evaluate(`document.readyState==='complete' && location.href===${JSON.stringify(expected)}`))return; }catch{}
    }
    throw Error('Local page did not load: '+expected);
  }
  async function openFile(path,expected=path){
    errors.length=0;
    await send('Page.navigate',{url:new URL(path,base+'/').href});await readyFile(expected);
    await evaluate(`Promise.all([...document.images].map(async image=>{image.loading='eager';try{await image.decode()}catch{}}))`);
    await evaluate(`window.LikhaPetArt ? Promise.all([...document.querySelectorAll('img[data-pet-art-key]')].map(image=>{const [type,stage]=image.dataset.petArtKey.split(':');return LikhaPetArt.apply(image,type,stage)})) : undefined`);
    const broken=await evaluate(`[...document.images].filter(image=>image.getAttribute('src')&&(!image.complete||!image.naturalWidth)).map(image=>image.src)`);
    assert.deepEqual(broken,[],'Missing local pictures on '+path);assert.deepEqual(errors,[],'Local file errors on '+path);
    console.log('PASS file:// '+path);
  }
  async function petArt(selector,key){
    for(let i=0;i<100;i++){
      if(await evaluate(`document.querySelector('${selector}')?.dataset.petArtState==='ready' && document.querySelector('${selector}').dataset.petArtKey==='${key}'`))return;
      await delay(50);
    }
    throw Error('Local pet artwork failed: '+key);
  }
  await openFile('index.html');await evaluate(`localStorage.clear();localStorage.setItem('LIKHA_OFFLINE_TEST','preserved');document.querySelector('.nav-start').click()`);await readyFile('dashboard.html');
  for(const lab of ['fashion','festival','craft','art']){
    await openFile('dashboard.html#choose-lab');await evaluate(`document.querySelector('#studioLabs [data-open-lab="${lab}"]').click()`);await readyFile('studio.html?lab='+lab);
    assert.equal(await evaluate(`document.body.classList.contains('lab-${lab}')`),true);
    await evaluate(`document.querySelector('.back-link').click()`);await readyFile('dashboard.html#choose-lab');
    assert.equal(await evaluate(`document.getElementById('view-studio').classList.contains('active')`),true);
  }
  // Local media playback, seeking and returning to the preserved canvas.
  for(const [lab,template]of [['craft','basket'],['craft','banig'],['craft','fan'],['craft','pot'],['festival','parol']]){
    await openFile('studio.html?lab='+lab);await evaluate(`document.querySelector('[data-template="${template}"]').click()`);
    const picture=await evaluate(`document.getElementById('artCanvas').toDataURL()`);
    await evaluate(`document.getElementById('referenceNext').click()`);
    const duration=await evaluate(`new Promise((resolve,reject)=>{const v=document.getElementById('referenceVideo');if(v.readyState>=1)return resolve(v.duration);v.onloadedmetadata=()=>resolve(v.duration);v.onerror=()=>reject(Error('Local video cannot play'));setTimeout(()=>reject(Error('Local video timed out')),15000);})`);assert.ok(duration>0);
    await evaluate(`(async()=>{const v=document.getElementById('referenceVideo');v.muted=true;await v.play();await new Promise(resolve=>{v.onseeked=resolve;v.currentTime=Math.min(1,v.duration/2)});document.getElementById('tutorialBack').click();})()`);
    assert.equal(await evaluate(`document.getElementById('referenceVideo').paused`),true);assert.equal(await evaluate(`document.getElementById('artCanvas').toDataURL()`),picture);
    console.log('PASS offline '+template+' tutorial playback, seeking, materials and Back');
  }
  // Saving real canvas work from a file URL must not taint the artist's canvas.
  for(const [i,lab,template]of [[1,'craft','basket'],[2,'festival','parol'],[3,'festival','mask']]){
    await openFile('studio.html?lab='+lab);await evaluate(`document.querySelector('[data-template="${template}"]').click()`);
    if(template==='mask'){
      for(let tries=0;tries<100;tries++){if(await evaluate(`document.getElementById('referenceCanvas').dataset.maskDesign==='blue-gold'`))break;await delay(50)}
      assert.equal(await evaluate(`document.getElementById('referenceCanvas').dataset.maskDesign`),'blue-gold');
    }
    await evaluate(`document.getElementById('artCanvas').getContext('2d').fillRect(700,400,20,20);document.getElementById('saveArtworkBtn').click();document.getElementById('artworkTitle').value='Offline artwork ${i}';document.getElementById('artworkDetailsForm').requestSubmit()`);await readyFile('gallery.html');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaArtworks')).length`),i);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`),[20,35,50][i-1]);
  }
  await openFile('pet.html');assert.equal(await evaluate(`document.getElementById('petStage').textContent`),'Growing Pet');await petArt('#petPreview','cat:growing');
  await openFile('dashboard.html#pet');assert.equal(await evaluate(`document.getElementById('petLargeStage').textContent`),'Growing Pet');
  assert.equal(await evaluate(`localStorage.getItem('LIKHA_OFFLINE_TEST')`),'preserved');
  // New avatar and name persist between the two local pages.
  await openFile('avatar.html');await evaluate(`document.querySelector('[data-avatar="avatar-filipino-artist-6"]').click();document.getElementById('avatarNameInput').value='Offline Artist';document.getElementById('saveAvatarBtn').click()`);
  await openFile('dashboard.html#avatar');assert.equal(await evaluate(`document.getElementById('avatarFaceInput').value`),'avatar-filipino-artist-6');assert.equal(await evaluate(`document.getElementById('avatarNameInput').value`),'Offline Artist');
  // Complete a quiz offline and confirm its rewards reach the pet and dashboard.
  const quizSource=await readFile(new URL('quiz.js',base+'/'),'utf8');
  const block=quizSource.match(/const questions = ([\s\S]*?\n  \]);/);
  const {runInNewContext}=await import('node:vm');const answers=Object.fromEntries(runInNewContext(block[0]+'\nquestions').map(question=>[question.id,question.answer]));
  await openFile('quiz.html');await evaluate(`document.getElementById('startQuizBtn').click()`);
  for(let i=0;i<5;i++){
    const question=await evaluate(`JSON.parse(localStorage.getItem('likhaQuizDataV1')).activeAttempt.questions[${i}]`);const choice=question.choices.indexOf(answers[question.id]);assert.ok(choice>=0);
    await evaluate(`document.querySelectorAll('#answerOptions button')[${choice}].click();document.getElementById('nextQuestionBtn').click()`);
  }
  assert.equal(await evaluate(`document.getElementById('resultCorrect').textContent`),'5');
  assert.equal(await evaluate(`document.getElementById('quizResultsSection').hidden`),false);
  await openFile('pet.html');assert.equal(await evaluate(`document.getElementById('petStage').textContent`),'Fully Grown Companion');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('likhaDashboardPrototype_v1')).stars`),100);
  console.log('PASS offline artwork saving, star rewards, quiz completion, pet growth and shared avatar/progress persistence');
  // All 24 distinct age images load from ordinary local files.
  const stageInfo=[['baby',0],['growing',2],['young',5],['grown',8]];
  for(const type of ['rabbit','cat','dog','lion','panda','tiger']){
    const sources=[];
    for(const [stage,units]of stageInfo){await evaluate(`localStorage.setItem('likhaDashboardPrototype_v1',JSON.stringify({pet:{type:'${type}',name:'Offline pet',growthPoints:${units*2}},completedActivities:[],artworks:[]}));localStorage.removeItem('likhaArtworks');renderPet()`);await petArt('#petPreview',type+':'+stage);sources.push(await evaluate(`document.getElementById('petPreview').src`));}
    assert.equal(new Set(sources).size,4);assert.ok(sources.every(src=>src.startsWith('file:')));console.log('PASS all four '+type+' ages offline');
  }
  // File-mode PNG downloads use an origin-clean drawing canvas.
  await openFile('studio.html?lab=craft');const downloads=await mkdtemp(join(tmpdir(),'likha-offline-download-'));await send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await evaluate(`document.getElementById('downloadButton').click()`);
  let downloaded;for(let i=0;i<100;i++){try{downloaded=await readFile(join(downloads,'likha-craft-artwork.png'));break}catch{await delay(100)}}assert.ok(downloaded?.length>1000);
  for(const page of ['index','dashboard','studio','quiz','avatar','gallery'])await openFile('.vscode/'+page+'.html',page+'.html');
  assert.equal(await evaluate(`localStorage.getItem('LIKHA_OFFLINE_TEST')`),'preserved');
  console.log('PASS offline PNG download and legacy page links');
  console.log('ALL OFFLINE CHECKS PASSED with http and https blocked; no local server used.');
}finally{socket?.close();chrome.kill();}
