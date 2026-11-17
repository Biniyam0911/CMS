const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const tempProfile = path.join(process.env.TEMP || 'C:\\Temp', 'edge_temp_profile_derma_' + Date.now());
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  console.log('Launching Edge headless...');
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--user-data-dir=' + tempProfile,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch('http://127.0.0.1:9224/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) {
        wsUrl = data.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('Failed to connect to Edge CDP on 9224');
    edgeProc.kill();
    process.exit(1);
  }

  console.log('Connected to CDP at', wsUrl);
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const callbacks = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
  };

  await new Promise(r => ws.onopen = r);

  const target = await send('Target.createTarget', { url: 'http://localhost:3000' });
  const targetWsUrl = `ws://127.0.0.1:9224/devtools/page/${target.targetId}`;
  
  const pageWs = new WebSocket(targetWsUrl);
  await new Promise(r => pageWs.onopen = r);

  let pageId = 1;
  const pageCallbacks = new Map();
  function pageSend(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = pageId++;
      pageCallbacks.set(msgId, resolve);
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  pageWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pageCallbacks.has(data.id)) {
      pageCallbacks.get(data.id)(data.result);
      pageCallbacks.delete(data.id);
    }
  };

  await pageSend('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await pageSend('Page.enable');
  await pageSend('Runtime.enable');

  console.log('Navigating to http://localhost:3000...');
  await pageSend('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clearing local storage & reloading...');
  await pageSend('Runtime.evaluate', {
    expression: `
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 2800));

  console.log('Capturing Assembled Radiant Derma Gem & Cellular Matrix...');
  const screenshot1 = await pageSend('Page.captureScreenshot', { format: 'png' });
  const out1 = path.join(__dirname, '..', 'login_derma_assembled.png');
  fs.writeFileSync(out1, Buffer.from(screenshot1.data, 'base64'));
  console.log('Saved to:', out1);

  // Click stage to trigger interactive laser resurfacing / break phase
  console.log('Clicking arena stage to trigger laser resurfacing & exfoliation break phase...');
  await pageSend('Runtime.evaluate', {
    expression: `
      const stage = document.querySelector('.beat-svg-stage');
      if (stage) stage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    `
  });
  await new Promise(r => setTimeout(r, 300));

  console.log('Capturing Laser Resurfacing & Micro-Exfoliation Phase...');
  const screenshot2 = await pageSend('Page.captureScreenshot', { format: 'png' });
  const out2 = path.join(__dirname, '..', 'login_derma_resurfacing.png');
  fs.writeFileSync(out2, Buffer.from(screenshot2.data, 'base64'));
  console.log('Saved to:', out2);

  pageWs.close();
  ws.close();
  edgeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
