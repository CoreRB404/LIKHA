// Real-browser smoke check. Requires Chrome and Node 22+; no npm dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const lab = process.argv[2] || 'fashion';
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
  await send('Page.navigate', {url: base + '/studio.html?lab=' + lab});
  for(let i=0;i<100;i++){await delay(100);if(await evaluate("document.readyState === 'complete' && !!document.getElementById('patternGallery')?.children.length"))break;}
  const expectedTemplates={fashion:['shirt','dress','barong','malong'],festival:['parol','mask'],craft:['basket','banig','fan','pot'],art:['blank','flower','house','mountain']}[lab];
  assert.deepEqual(await evaluate("[...document.getElementById('templateSelect').options].map(option=>option.value)"),expectedTemplates,'Dropdown only contains this lab designs');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-template]')].map(card=>card.dataset.template)"),expectedTemplates,'Dropdown matches visible design cards');
  assert.equal(await evaluate("getComputedStyle(document.getElementById('applyPatternBtn')).display"),'none');
  const result = await evaluate(`(() => {
    const canvas = document.getElementById('artCanvas');
    const ctx = canvas.getContext('2d');
    const reference = document.getElementById('referenceCanvas').toDataURL();
    const click = (x,y) => {const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+x*r.width/canvas.width,clientY:r.top+y*r.height/canvas.height,bubbles:true}));};
    const initial = () => {document.getElementById('clearButton').click();ctx.strokeStyle='#111111';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(180,140);ctx.lineTo(450,180);ctx.lineTo(400,400);ctx.lineTo(150,350);ctx.closePath();ctx.stroke();};
    const results=[];
    for(const choice of document.querySelectorAll('[data-pattern]')) {
      initial();const before=canvas.toDataURL();choice.click();click(270,250);
      const after=canvas.toDataURL();const inside=Array.from(ctx.getImageData(270,250,1,1).data);const outside=Array.from(ctx.getImageData(20,20,1,1).data);const outline=Array.from(ctx.getImageData(180,140,1,1).data);
      document.getElementById('undoButton').click();
      results.push({id:choice.dataset.pattern,changed:after!==before,inside,outside,outline,undo:canvas.toDataURL()===before});
    }
    initial();const before=canvas.toDataURL();document.querySelector('[data-pattern].selected').click();click(20,20);const outsideSafe=canvas.toDataURL()===before;
    document.getElementById('clearButton').click();const blank=canvas.toDataURL();document.querySelector('[data-pattern].selected').click();click(300,300);const blankSafe=canvas.toDataURL()===blank;
    document.getElementById('drawMode').click();
    return {results,outsideSafe,blankSafe,referenceUnchanged:document.getElementById('referenceCanvas').toDataURL()===reference};
  })()`);
  for(const row of result.results){assert.ok(row.changed,row.id);assert.ok(row.undo,'Undo '+row.id);assert.deepEqual(row.outside,[255,255,255,255]);assert.deepEqual(row.outline,[17,17,17,255]);assert.notDeepEqual(row.inside,[255,255,255,255]);}
  assert.ok(result.outsideSafe);assert.ok(result.blankSafe);assert.ok(result.referenceUnchanged);assert.deepEqual(errors,[]);
  await evaluate("document.getElementById('artCanvas').scrollIntoView({block:'center'})");
  const pos=await evaluate(`(() => {const r=document.getElementById('artCanvas').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  const beforeDraw=await evaluate("document.getElementById('artCanvas').toDataURL()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x+30,y:pos.y+20,buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x+30,y:pos.y+20,button:'left',clickCount:1});
  assert.ok(await evaluate("document.getElementById('artCanvas').toDataURL()") !== beforeDraw, "Draw works after pattern fill");
  // Reproduce the complete user flow using actual mouse events, not injected pixels.
  await evaluate("document.getElementById('clearButton').click();document.getElementById('artCanvas').scrollIntoView({block:'center'})");
  const rect=await evaluate(`(() => {const r=document.getElementById('artCanvas').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};})()`);
  const mouse=async(type,x,y,buttons=0)=>send('Input.dispatchMouseEvent',{type,x:rect.x+x*rect.w/1000,y:rect.y+y*rect.h/700,button:type==='mouseMoved'?'none':'left',buttons,clickCount:type==='mouseMoved'?0:1});
  await mouse('mousePressed',350,260,1);
  for(const [x,y]of [[650,260],[650,480],[350,480],[350,260]])await mouse('mouseMoved',x,y,1);
  await mouse('mouseReleased',350,260);
  const drawn=await evaluate("document.getElementById('artCanvas').toDataURL()");
  await evaluate("document.querySelector('[data-pattern].selected').click()");
  assert.equal(await evaluate("document.getElementById('applyPatternBtn').getAttribute('aria-pressed')"),'true');
  await mouse('mousePressed',500,370,1);await mouse('mouseReleased',500,370);
  assert.ok(await evaluate("document.getElementById('artCanvas').toDataURL()")!==drawn,'Actual freehand drawing fills');
  assert.equal(await evaluate("document.getElementById('drawMode').getAttribute('aria-pressed')"),'true');
  const filled=await evaluate("document.getElementById('artCanvas').toDataURL()");
  await mouse('mousePressed',700,400,1);await mouse('mouseMoved',760,450,1);await mouse('mouseReleased',760,450);
  assert.ok(await evaluate("document.getElementById('artCanvas').toDataURL()")!==filled,'Can immediately draw after fill');
  await evaluate("document.getElementById('undoButton').click()");
  assert.equal(await evaluate("document.getElementById('artCanvas').toDataURL()"),filled,'Undo removes only latest stroke');
  await evaluate("document.getElementById('undoButton').click()");
  assert.equal(await evaluate("document.getElementById('artCanvas').toDataURL()"),drawn,'Second undo restores original outline');
  assert.deepEqual(errors,[]);
  const matches = await evaluate(`(async () => {
    const canvas=document.getElementById('artCanvas'),ctx=canvas.getContext('2d');
    const results=[];
    for(const choice of document.querySelectorAll('[data-pattern]')) {
      document.getElementById('clearButton').click();ctx.strokeStyle='#111';ctx.lineWidth=6;ctx.strokeRect(820,510,100,100);
      choice.click();const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+860*r.width/1000,clientY:r.top+550*r.height/700,bubbles:true}));
      const url=choice.querySelector('.pattern-preview').style.backgroundImage.slice(5,-2);
      const image=new Image();image.src=url;await image.decode();
      const expected=document.createElement('canvas');expected.width=1000;expected.height=700;const ink=expected.getContext('2d');
      const tile=document.createElement('canvas');tile.width=tile.height=64;tile.getContext('2d').drawImage(image,0,0);const repeat=ink.createPattern(tile,'repeat');repeat.setTransform(new DOMMatrix().translate(823,513).scale((94/3)/64));ink.fillStyle=repeat;ink.fillRect(823,513,94,94);
      const actual=ctx.getImageData(830,520,80,80).data,reference=ink.getImageData(830,520,80,80).data;
      results.push({pattern:choice.dataset.pattern,exact:actual.every((value,index)=>value===reference[index]),max:actual.reduce((max,value,index)=>Math.max(max,Math.abs(value-reference[index])),0)});
    }
    return results;
  })()`);
  for(const row of matches)assert.ok(row.exact,'Preview pixel match '+JSON.stringify(row));
  console.log(lab+': PASS all selected pattern fills match preview tiles pixel for pixel.');
  if (lab !== 'fashion') {
    const small = await evaluate(`(() => {
      const canvas=document.getElementById('artCanvas'),ctx=canvas.getContext('2d');
      return [...document.querySelectorAll('[data-pattern]')].map(choice=>{
        document.getElementById('clearButton').click();ctx.strokeStyle='#111';ctx.lineWidth=6;ctx.strokeRect(820,510,100,100);
        choice.click();const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+860*r.width/1000,clientY:r.top+550*r.height/700,bubbles:true}));
        const counts=[];
        for(const [x,y]of [[830,520],[870,520],[830,560],[870,560]]){
          const pixels=ctx.getImageData(x,y,40,40).data;let colored=0;
          for(let i=0;i<pixels.length;i+=4)if(pixels[i]<245||pixels[i+1]<245||pixels[i+2]<245)colored++;
          counts.push(colored);
        }
        return {pattern:choice.dataset.pattern,counts};
      });
    })()`);
    for(const row of small)assert.ok(row.counts.every(count=>count>10),JSON.stringify(row));
    console.log(lab + ': PASS every pattern repeats throughout all quadrants of a small 100px drawing near the canvas edge.');
  }
  console.log(lab + ': PASS actual mouse draw -> select pattern directly -> fill -> automatic Draw -> another stroke -> exact Undo.');
  console.log('PASS four patterns, outlines/background/reference preserved, blank/outside rejected.');
} finally {if(socket)socket.close();chrome.kill();}
