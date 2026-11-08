// Real-browser smoke check. Requires Chrome and Node 22+; no npm dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.LIKHA_HOSTED_URL || 'http://127.0.0.1:8001';
const profile = await mkdtemp(join(tmpdir(), 'likha-browser-audit-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
let chromeErrors='';chrome.stderr.on('data',chunk=>{chromeErrors+=chunk.toString();});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Chrome did not start: '+chromeErrors.slice(0,1500));
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
  async function until(expression, message='browser condition') {
    for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await delay(100);}
    throw new Error('Timed out: '+message+' errors='+JSON.stringify(errors));
  }
  async function visit(path){await send('Page.navigate',{url:base+path});await until(`document.readyState==='complete' && location.pathname===${JSON.stringify(path.split('?')[0].split('#')[0])}`,'navigate '+path);await until('!!window.LikhaAPI','API ready');await evaluate('window.LikhaAPI.ready');}
  async function form(id, values){await evaluate(`(() => {const form=document.getElementById(${JSON.stringify(id)});for(const [name,value] of Object.entries(${JSON.stringify(values)})){const field=form.elements.namedItem(name);if(field.type==='checkbox')field.checked=value;else field.value=value;}form.requestSubmit();})()`);}
  const suffix=Date.now();const username=`browser-${suffix}`;const password='A browser test creative passphrase';
  await visit('/accounts/signup/');
  assert.equal(await evaluate("!!document.querySelector('input[type=email]')"),false);
  await form('accountForm',{username,password,confirmation:password,display_name:'Browser Artist'});
  await until("document.getElementById('accountMessage').textContent.includes('Account created')",'signup without email');
  await visit('/accounts/login/');await form('accountForm',{username,password});await until("location.pathname==='/dashboard/' && document.getElementById('starBalance')?.textContent==='0'",'immediate username login/dashboard');
  console.log('PASS username-only signup -> immediate login/dashboard; no email or verification step.');
  assert.deepEqual(errors,[]);
  // Account data is never accepted from legacy browser stores.
  await evaluate(`localStorage.setItem('likhaDashboardPrototype_v1',JSON.stringify({stars:999999,pet:{growthPoints:999999}}))`);
  await visit('/studio/?lab=fashion');await until("!!document.querySelector('[data-pattern]') && !!document.getElementById('canvasToolStatus')",'studio');
  await evaluate("document.getElementById('artCanvas').scrollIntoView({block:'center'})");
  const rect=await evaluate(`(() => {const r=document.getElementById('artCanvas').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};})()`);
  const mouse=async(type,x,y,buttons=0)=>send('Input.dispatchMouseEvent',{type,x:rect.left+x*rect.width/1000,y:rect.top+y*rect.height/700,button:type==='mouseMoved'?'none':'left',buttons,clickCount:type==='mouseMoved'?0:1});
  await mouse('mousePressed',350,260,1);for(const[x,y]of[[650,260],[650,480],[350,480],[350,260]])await mouse('mouseMoved',x,y,1);await mouse('mouseReleased',350,260);
  await evaluate("document.querySelector('[data-pattern]').click()");await mouse('mousePressed',500,370,1);await mouse('mouseReleased',500,370);
  await evaluate("document.getElementById('saveArtworkBtn').click()");await form('artworkDetailsForm',{}).catch(()=>{});
  await evaluate("document.getElementById('artworkTitle').value='My hosted creation';document.getElementById('artworkDetailsForm').requestSubmit()");
  await until("location.pathname==='/gallery/' && document.querySelector('[data-artwork-id]')",'save/gallery');
  const artId=await evaluate("document.querySelector('[data-artwork-id]').dataset.artworkId");
  await until("document.querySelector('[data-artwork-id] img').complete && document.querySelector('[data-artwork-id] img').naturalWidth>0",'private image');
  assert.equal(await evaluate("document.querySelector('[data-artwork-id] img').complete && document.querySelector('[data-artwork-id] img').naturalWidth>0"),true);
  const own=await evaluate("LikhaAPI.request('/api/v1/progress')");assert.equal(own.progress.stars,20);assert.equal(own.progress.stage,'baby');
  console.log('PASS actual canvas draw/pattern -> private server save/gallery; forged localStorage totals ignored.');
  await visit('/avatar/');await until("document.getElementById('avatarNameInput').value==='Browser Artist'",'avatar');await evaluate("document.querySelector('[data-avatar=\"avatar-filipino-artist-6\"]').click();document.getElementById('saveAvatarBtn').click()");await until("document.getElementById('saveMessage').textContent.includes('saved')",'save avatar');
  await visit('/pet/');await until("document.getElementById('petStage').textContent==='baby'",'pet');await evaluate("document.querySelector('[data-pet=\"tiger\"]').click();document.getElementById('petNameInput').value='Tala';document.getElementById('savePetBtn').click()");await until("document.getElementById('hostStatus')?.textContent.includes('saved')",'save pet');
  await visit('/quiz/?assessment=week1');await until("document.getElementById('weeklyQuizTitle').textContent.includes('Week 1')",'quiz');await evaluate("document.getElementById('startQuizBtn').click()");await until("document.querySelector('#answerOptions .answer-option')",'quiz questions');
  for(let index=0;index<5;index++) {
    await evaluate("document.querySelector('#answerOptions .answer-option').click();document.getElementById('nextQuestionBtn').click()");
  }
  await until("!document.getElementById('quizResultsSection').hidden && document.getElementById('resultHeading').textContent.includes('You scored')",'quiz grade');
  console.log('PASS avatar/pet saves and server-graded quiz through real screens.');
  await visit('/dashboard/');await until("Number(document.getElementById('starBalance').textContent)>=20",'dashboard reload');assert.ok(await evaluate("Number(document.getElementById('starBalance').textContent)>=20"));
  await evaluate("document.querySelector('[data-logout]').click()");await until("location.pathname==='/accounts/login/'",'logout');
  assert.equal(await evaluate(`fetch('/api/v1/artworks/${artId}/image').then(r=>r.status)`),401);
  await delay(100);const denied=errors.indexOf('401 '+base+'/api/v1/artworks/'+artId+'/image');if(denied>=0)errors.splice(denied,1);
  await form('accountForm',{username,password});await until("location.pathname==='/dashboard/' && document.getElementById('artworksSavedCount')?.textContent==='1'",'account persisted');
  const savedProfile=await evaluate("LikhaAPI.request('/api/v1/me')");assert.equal(savedProfile.profile.avatar,6);
  const saved=await evaluate("LikhaAPI.request('/api/v1/progress')");assert.equal(saved.progress.pet.species,'tiger');assert.equal(saved.progress.pet.name,'Tala');
  // Switch users in the same browser and verify the previous account cannot leak.
  await evaluate("document.querySelector('[data-logout]').click()");await until("location.pathname==='/accounts/login/'",'A logout');
  const usernameB=`browser-b-${suffix}`;
  await visit('/accounts/signup/');await form('accountForm',{username:usernameB,password,confirmation:password,display_name:'Second Artist'});await until("document.getElementById('accountMessage').textContent.includes('Account created')",'B signup');
  await visit('/accounts/login/');await form('accountForm',{username:usernameB,password});await until("location.pathname==='/dashboard/' && document.getElementById('starBalance')?.textContent==='0'",'B login');
  await visit('/gallery/');await until("document.getElementById('galleryResultCount').textContent.includes('0 of 0')",'B empty gallery');
  assert.equal(await evaluate(`fetch('/api/v1/artworks/${artId}/image').then(r=>r.status)`),404);await delay(100);const blocked=errors.indexOf('404 '+base+'/api/v1/artworks/'+artId+'/image');if(blocked>=0)errors.splice(blocked,1);
  await evaluate(`LikhaAPI.request('/api/v1/me',{method:'DELETE',body:{password:${JSON.stringify(password)},confirmation:'DELETE'}})`);
  await visit('/accounts/login/');await form('accountForm',{username,password});await until("location.pathname==='/dashboard/' && document.getElementById('artworksSavedCount')?.textContent==='1'",'A restored after B');
  console.log('PASS two-account browser handoff: B sees no A gallery or private image; A retains its artwork.');
  // Verify tutorials and small-canvas controls still work in hosted pages.
  for(const [lab,template]of [['craft','basket'],['craft','banig'],['craft','fan'],['craft','pot'],['festival','parol']]){
    await visit('/studio/?lab='+lab);await until("!!document.querySelector('[data-template]')",'lab');await evaluate(`document.querySelector('[data-template="${template}"]').click();document.getElementById('referenceNext').click()`);await until("!document.getElementById('referenceTutorial').hidden && document.getElementById('referenceVideo').readyState>=1",'video '+template);await evaluate("document.getElementById('tutorialBack').click()");assert.equal(await evaluate("document.getElementById('referenceVideo').paused"),true);
  }
  await visit('/studio/?lab=festival');await evaluate("document.querySelector('[data-template=mask]').click()");await until("document.getElementById('referenceCanvas').dataset.maskDesign && document.getElementById('referenceCanvas').dataset.maskDesign!=='loading'",'mask');
  const broken=await evaluate("[...document.images].filter(i=>i.getAttribute('src')&&!i.hidden&&(!i.complete||!i.naturalWidth)).map(i=>i.src)");assert.deepEqual(broken,[]);
  assert.deepEqual(errors,[]);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../var/hosted-browser.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
  const report={date:new Date().toISOString(),result:'passed',checks:['username-signup','immediate-login','canvas-pattern-save','private-gallery','server-progress','avatar6','pet-settings','quiz','logout-image-protection','reload-persistence','five-tutorials','mask-reference','two-account-handoff'],runtimeErrors:errors};await writeFile(new URL('../var/browser-report.json',import.meta.url),JSON.stringify(report,null,2));
  // Remove synthetic account and its private artwork after proof.
  await evaluate(`LikhaAPI.request('/api/v1/me',{method:'DELETE',body:{password:${JSON.stringify(password)},confirmation:'DELETE'}})`);
  console.log('PASS reload persistence, logout image protection, all tutorials and mask; synthetic account cleaned.');
} finally {if(socket)socket.close();chrome.kill();}
