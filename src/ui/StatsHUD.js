export class StatsHUD {
  constructor(renderer) {
    this.renderer = renderer;

    // DOM Elements
    this.elFps = document.getElementById('val-fps');
    this.elFpsAvg = document.getElementById('val-fps-avg');
    this.elFpsMin = document.getElementById('val-fps-min');
    this.elFpsLow = document.getElementById('val-fps-low');
    this.elFrameTime = document.getElementById('val-frame-time');

    this.elTriangles = document.getElementById('val-triangles');
    this.elDrawcalls = document.getElementById('val-drawcalls');
    this.elPedestrians = document.getElementById('val-pedestrians');
    this.elVehicles = document.getElementById('val-vehicles');
    this.elGeometries = document.getElementById('val-geometries');
    this.elTextures = document.getElementById('val-textures');

    this.elGpu = document.getElementById('val-gpu-renderer');
    this.elScreenRes = document.getElementById('val-screen-res');

    this.graphCanvas = document.getElementById('fps-graph-canvas');
    this.graphCtx = this.graphCanvas ? this.graphCanvas.getContext('2d') : null;

    // History for rolling stats
    this.frameTimes = [];
    this.maxHistory = 120;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.lastUpdate = performance.now();

    this.instantFps = 60;
    this.minFps = 999;
    this.totalFps = 0;
    this.totalFramesSampled = 0;

    this.detectHardware();
  }

  detectHardware() {
    try {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (this.elGpu) this.elGpu.textContent = renderer || 'Standard WebGL2 GPU';
      } else {
        if (this.elGpu) this.elGpu.textContent = 'WebGL2 Graphics Device';
      }
    } catch (e) {
      if (this.elGpu) this.elGpu.textContent = 'Generic WebGL Device';
    }

    this.updateResolutionDisplay();
  }

  updateResolutionDisplay() {
    if (this.elScreenRes) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      this.elScreenRes.textContent = `Res: ${w}x${h} (DPR: ${dpr.toFixed(2)})`;
    }
  }

  update(pedestrianCount = 0, vehicleCount = 0) {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    if (delta > 0) {
      this.frameTimes.push(delta);
      if (this.frameTimes.length > this.maxHistory) {
        this.frameTimes.shift();
      }
    }

    this.frameCount++;

    // Update HUD text every 250ms
    if (now - this.lastUpdate > 250) {
      let fps = 60;
      if (this.frameTimes.length > 0) {
        // Use average of last 5 frames for smooth, stable instant FPS
        const recent = this.frameTimes.slice(-5);
        const avgDelta = recent.reduce((a, b) => a + b, 0) / recent.length;
        fps = avgDelta > 0 ? 1000 / avgDelta : 60;
      }
      this.instantFps = Math.min(240, Math.max(1, fps));

      this.totalFps += this.instantFps;
      this.totalFramesSampled++;
      const avgFps = Math.round(this.totalFps / this.totalFramesSampled);

      if (this.instantFps < this.minFps && this.totalFramesSampled > 5) {
        this.minFps = Math.round(this.instantFps);
      }

      // Calculate 1% low from frameTimes
      const sorted = [...this.frameTimes].sort((a, b) => b - a);
      const lowIndex = Math.min(Math.floor(sorted.length * 0.01), sorted.length - 1);
      const low1PercentFrameTime = sorted[lowIndex] || 16.6;
      const fpsLow = Math.round(1000 / low1PercentFrameTime);

      const rFps = Math.round(fps);
      if (this.elFps) {
        this.elFps.textContent = rFps;
        this.elFps.className = 'fps-value' + (rFps >= 45 ? '' : rFps >= 25 ? ' warn' : ' danger');
      }

      if (this.elFpsAvg) this.elFpsAvg.textContent = avgFps;
      if (this.elFpsMin) this.elFpsMin.textContent = this.minFps === 999 ? rFps : this.minFps;
      if (this.elFpsLow) this.elFpsLow.textContent = fpsLow;
      if (this.elFrameTime) this.elFrameTime.textContent = delta.toFixed(1);

      // Render Info stats
      const render = this.renderer.info.render;
      const memory = this.renderer.info.memory;

      if (this.elTriangles) this.elTriangles.textContent = render.triangles.toLocaleString();
      if (this.elDrawcalls) this.elDrawcalls.textContent = render.calls.toLocaleString();
      if (this.elPedestrians) this.elPedestrians.textContent = pedestrianCount.toLocaleString();
      if (this.elVehicles) this.elVehicles.textContent = vehicleCount.toLocaleString();
      if (this.elGeometries) this.elGeometries.textContent = memory.geometries.toLocaleString();
      if (this.elTextures) this.elTextures.textContent = memory.textures.toLocaleString();

      this.lastUpdate = now;
      this.drawGraph();
    }
  }

  drawGraph() {
    if (!this.graphCtx || !this.graphCanvas) return;
    const ctx = this.graphCtx;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 60 FPS line (16.6ms)
    const y60 = h - (60 / 120) * h;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    // 30 FPS line (33.3ms)
    const y30 = h - (30 / 120) * h;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, y30);
    ctx.lineTo(w, y30);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.frameTimes.length < 2) return;

    // Draw FPS plot line
    ctx.beginPath();
    const step = w / (this.maxHistory - 1);

    for (let i = 0; i < this.frameTimes.length; i++) {
      const ft = this.frameTimes[i];
      const fps = Math.min(120, Math.max(0, 1000 / ft));
      const y = h - (fps / 120) * h;
      const x = i * step;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  resetStats() {
    this.totalFps = 0;
    this.totalFramesSampled = 0;
    this.minFps = 999;
    this.frameTimes = [];
  }
}
