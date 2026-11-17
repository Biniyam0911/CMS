const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const tempProfile = path.join(process.env.TEMP || 'C:\\Temp', 'edge_temp_profile_' + Date.now());
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  console.log('Launching Edge...');
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + tempProfile,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  // Wait for Edge CDP port to open
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) {
        wsUrl = data.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('Failed to connect to Edge CDP');
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

  // Set viewport to 1440x900
  const target = await send('Target.createTarget', { url: 'http://localhost:3000' });
  const targetWsUrl = `ws://127.0.0.1:9222/devtools/page/${target.targetId}`;
  
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

  console.log('Logging in via form...');
  await pageSend('Runtime.evaluate', {
    expression: `
      (() => {
        const textInput = document.querySelector('input[type="text"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (textInput && passInput && submitBtn) {
          // React synthetic events require setting value via prototype or dispatching input
          const setNativeValue = (element, value) => {
            const valueSetter = Object.getOwnPropertyDescriptor(element.__proto__, 'value')?.set ||
                                Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            valueSetter.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
          };

          setNativeValue(textInput, 'admin');
          setNativeValue(passInput, 'Admin@123');
          setTimeout(() => submitBtn.click(), 300);
          return 'SUBMITTED';
        }
        return 'INPUTS_NOT_FOUND';
      })()
    `
  });

  console.log('Waiting for Dashboard & Sidebar render...');
  await new Promise(r => setTimeout(r, 4000));

  console.log('Capturing bottom of sidebar...');
  await pageSend('Runtime.evaluate', {
    expression: `
      const sidebar = document.querySelector('.healthcare-sidebar');
      if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
    `
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing screenshot...');
  const screenshotResult2 = await pageSend('Page.captureScreenshot', { format: 'png' });
  const outputPath2 = path.join(__dirname, '..', 'sidebar_bottom_preview.png');
  fs.writeFileSync(outputPath2, Buffer.from(screenshotResult2.data, 'base64'));
  console.log('Saved bottom screenshot to:', outputPath2);

  pageWs.close();
  ws.close();
  edgeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
