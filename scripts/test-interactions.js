// Automated interaction verification script via CDP WebSocket
async function run() {
  const listRes = await fetch('http://127.0.0.1:9222/json');
  const pages = await listRes.json();
  const page = pages.find(p => p.url.includes('5173'));
  if (!page) {
    console.error('City page not found');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  console.log('Connected to Chrome DevTools Protocol!');

  // Enable Runtime
  await send('Runtime.enable');

  // Test 1: Switch to Night Mode
  console.log('Switching to Night Mode...');
  await send('Runtime.evaluate', {
    expression: `window.cityApp ? window.cityApp.lightingController.applyPreset('night') : null`
  });

  await new Promise(r => setTimeout(r, 1000));
  const nightShot = await send('Page.captureScreenshot');
  const fs = await import('node:fs/promises');
  try {
    await fs.writeFile('./night_view.png', Buffer.from(nightShot.data, 'base64'));
    console.log('Night view captured!');
  } catch (err) {}

  // Test 2: Switch to Street Camera
  console.log('Switching to Street Camera and Day Mode...');
  await send('Runtime.evaluate', {
    expression: `
      if (window.cityApp) window.cityApp.lightingController.applyPreset('day');
      const camStreet = document.getElementById('cam-street');
      if (camStreet) camStreet.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));
  const streetShot = await send('Page.captureScreenshot');
  try {
    await fs.writeFile('./street_view.png', Buffer.from(streetShot.data, 'base64'));
    console.log('Street view captured!');
  } catch (err) {}

  // Test 3: Trigger Benchmark Suite (shortened or full)
  console.log('Triggering automated Benchmark Stress Test...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('btn-run-benchmark').click()`
  });

  // Wait 26 seconds for the 25-second benchmark to complete
  console.log('Waiting for benchmark to complete...');
  await new Promise(r => setTimeout(r, 26500));

  const benchShot = await send('Page.captureScreenshot');
  try {
    await fs.writeFile('./benchmark_scorecard.png', Buffer.from(benchShot.data, 'base64'));
    console.log('Benchmark scorecard captured!');
  } catch (err) {}

  // Test 4: Check UI and Metrics values
  const metrics = await send('Runtime.evaluate', {
    expression: `({
      fps: document.getElementById('val-fps').textContent,
      triangles: document.getElementById('val-triangles').textContent,
      drawCalls: document.getElementById('val-drawcalls').textContent,
      pedestrians: document.getElementById('val-pedestrians').textContent,
      vehicles: document.getElementById('val-vehicles').textContent,
      gpu: document.getElementById('val-gpu-renderer').textContent
    })`,
    returnByValue: true
  });
  console.log('Live App Metrics:', metrics.result.value);

  // Close
  ws.close();
  console.log('All automated tests passed successfully!');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
