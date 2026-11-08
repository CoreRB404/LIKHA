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

  // Build static copies of the existing rendered artwork; no image generation or redesign.
  await visit('/');
  const manifest=JSON.parse(await readFile(new URL('../images/pets/growth-manifest.json',import.meta.url),'utf8'));
  const {writeFile}=await import('node:fs/promises');
  for(const [type,entry] of Object.entries(manifest)){
    const frames=await evaluate(`(async()=>{const entry=${JSON.stringify(entry)};const source=new Image();source.src=entry.sheet;await source.decode();const frames={};for(const [level,[x,y,width,height]] of Object.entries(entry.stages)){const canvas=document.createElement('canvas');canvas.width=canvas.height=384;const scale=352/Math.max(width,height);canvas.getContext('2d').drawImage(source,x,y,width,height,(384-width*scale)/2,368-height*scale,width*scale,height*scale);frames[level]=canvas.toDataURL('image/webp',.92);}return frames;})()`);
    for(const [level,uri]of Object.entries(frames))await writeFile(new URL(`../images/pets/${type}-${level}-v1.webp`,import.meta.url),Buffer.from(uri.split(',')[1],'base64'));
    console.log('Exported '+type+': four existing age illustrations');
  }
}finally{socket?.close();chrome.kill();}
