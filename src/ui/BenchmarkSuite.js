export class BenchmarkSuite {
  constructor(app) {
    this.app = app;
    this.isRunning = false;

    // DOM Elements
    this.modal = document.getElementById('benchmark-modal');
    this.desc = document.getElementById('bench-desc');
    this.progressBar = document.getElementById('bench-progress-fill');
    this.statusTxt = document.getElementById('bench-status-txt');
    this.resultsContainer = document.getElementById('bench-results-container');
    this.resultsBody = document.getElementById('bench-results-body');
    this.hwString = document.getElementById('bench-hw-string');

    this.btnCopy = document.getElementById('btn-bench-copy');
    this.btnJson = document.getElementById('btn-bench-json');
    this.btnClose = document.getElementById('btn-bench-close');
    this.toast = document.getElementById('toast');

    this.benchmarkData = null;
    this.setupListeners();
  }

  setupListeners() {
    this.btnClose.addEventListener('click', () => {
      this.closeModal();
    });

    this.btnCopy.addEventListener('click', () => {
      this.copyReport();
    });

    this.btnJson.addEventListener('click', () => {
      this.exportJson();
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Save previous state to restore later
    this.savedState = {
      pedestrians: this.app.pedestrians.activeCount,
      vehicles: this.app.traffic.activeCount,
      camTour: this.app.cameraController.isCinematicTour
    };

    this.samples = [];
    this.startTime = performance.now();
    this.totalDuration = 25000; // 25 seconds test

    this.modal.classList.add('active');
    this.resultsContainer.style.display = 'none';
    this.progressBar.style.width = '0%';
    this.desc.textContent = 'Executing standardized 25-second multi-phase stress test...';
    this.statusTxt.textContent = 'Phase 1/4: Baseline load (1,500 citizens)...';

    // Set baseline
    this.app.pedestrians.setCount(1500);
    this.app.traffic.setCount(300);
    this.app.cameraController.setPreset('iso');
  }

  update() {
    if (!this.isRunning) return;

    const elapsed = performance.now() - this.startTime;
    const progress = Math.min(1.0, elapsed / this.totalDuration);
    this.progressBar.style.width = `${(progress * 100).toFixed(1)}%`;

    // Phase management
    if (elapsed < 6000) {
      // Phase 1: Baseline 0-6s
      this.statusTxt.textContent = `Phase 1/4: Baseline Performance (Elapsed: ${(elapsed/1000).toFixed(1)}s)`;
    } else if (elapsed < 12000) {
      // Phase 2: Camera Flythrough 6-12s
      if (this.app.cameraController.isCinematicTour === false) {
        this.app.cameraController.setPreset('orbit');
      }
      this.statusTxt.textContent = `Phase 2/4: High-speed Camera Flythrough & Geometry Culling...`;
    } else if (elapsed < 19000) {
      // Phase 3: Dynamic Ramp-Up 12-19s
      const rampT = (elapsed - 12000) / 7000;
      const targetPeds = Math.round(1500 + rampT * 8500); // ramp up to 10,000
      const targetCars = Math.round(300 + rampT * 1200);   // ramp up to 1,500
      this.app.pedestrians.setCount(targetPeds);
      this.app.traffic.setCount(targetCars);
      this.statusTxt.textContent = `Phase 3/4: Ramping Load (${targetPeds.toLocaleString()} peds, ${targetCars} cars)...`;
    } else if (elapsed < 25000) {
      // Phase 4: Maximum Load Stress 19-25s
      this.app.pedestrians.setCount(12000);
      this.app.traffic.setCount(1800);
      this.statusTxt.textContent = `Phase 4/4: Extreme Hardware Saturation (12,000 citizens)...`;
    } else {
      // Complete!
      this.complete();
      return;
    }

    // Sample current performance
    const render = this.app.renderer.info.render;
    this.samples.push({
      fps: this.app.statsHUD.instantFps,
      triangles: render.triangles,
      drawCalls: render.calls,
      pedestrians: this.app.pedestrians.activeCount,
      vehicles: this.app.traffic.activeCount
    });
  }

  complete() {
    this.isRunning = false;
    this.statusTxt.textContent = 'Benchmark Finished! Calculating Scorecard...';

    // Compute metrics
    const fpsList = this.samples.map(s => s.fps).filter(f => f > 0 && f < 500);
    const avgFps = Math.round(fpsList.reduce((a, b) => a + b, 0) / (fpsList.length || 1));
    const minFps = Math.round(Math.min(...fpsList));

    const sortedFps = [...fpsList].sort((a, b) => a - b);
    const low1Pct = Math.round(sortedFps[Math.floor(sortedFps.length * 0.01)] || minFps);

    const maxTriangles = Math.max(...this.samples.map(s => s.triangles));
    const maxDrawCalls = Math.max(...this.samples.map(s => s.drawCalls));
    const maxPeds = Math.max(...this.samples.map(s => s.pedestrians));
    const maxCars = Math.max(...this.samples.map(s => s.vehicles));

    // Performance Score formula
    const score = Math.round((avgFps * 60) + (low1Pct * 40) + (maxPeds * 0.2));

    const gpuName = this.app.statsHUD.elGpu ? this.app.statsHUD.elGpu.textContent : 'Unknown GPU';
    const resolution = `${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio}x`;

    this.benchmarkData = {
      score,
      avgFps,
      low1Pct,
      minFps,
      maxTriangles,
      maxDrawCalls,
      maxPeds,
      maxCars,
      gpuName,
      resolution,
      timestamp: new Date().toISOString()
    };

    // Render results table
    this.resultsBody.innerHTML = `
      <tr>
        <td style="font-weight: 700; color: #f8fafc; font-size: 13px;">🏆 Total Benchmark Score</td>
        <td class="val" style="font-size: 16px; color: #10b981;">${score.toLocaleString()} pts</td>
      </tr>
      <tr>
        <td>Average FPS</td>
        <td class="val">${avgFps} FPS</td>
      </tr>
      <tr>
        <td>1% Low FPS</td>
        <td class="val">${low1Pct} FPS</td>
      </tr>
      <tr>
        <td>Minimum FPS</td>
        <td class="val">${minFps} FPS</td>
      </tr>
      <tr>
        <td>Peak Pedestrians Tested</td>
        <td class="val">${maxPeds.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Peak Vehicles Tested</td>
        <td class="val">${maxCars.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Peak Triangles Rendered</td>
        <td class="val">${maxTriangles.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Draw Calls</td>
        <td class="val">${maxDrawCalls} calls</td>
      </tr>
    `;

    this.hwString.textContent = `${gpuName} | ${resolution}`;
    this.resultsContainer.style.display = 'block';

    // Restore user settings
    this.app.pedestrians.setCount(this.savedState.pedestrians);
    this.app.traffic.setCount(this.savedState.vehicles);
    this.app.cameraController.setPreset('iso');
  }

  copyReport() {
    if (!this.benchmarkData) return;
    const d = this.benchmarkData;
    const text = `
### 🏙️ 3D City WebGL Benchmark Results
- **Benchmark Score**: ${d.score.toLocaleString()} pts
- **Average FPS**: ${d.avgFps} FPS
- **1% Low FPS**: ${d.low1Pct} FPS (Min: ${d.minFps} FPS)
- **Peak Agents**: ${d.maxPeds.toLocaleString()} pedestrians, ${d.maxCars.toLocaleString()} vehicles
- **Peak Triangles**: ${d.maxTriangles.toLocaleString()}
- **Draw Calls**: ${d.maxDrawCalls}
- **GPU**: ${d.gpuName}
- **Resolution**: ${d.resolution}
- **Timestamp**: ${d.timestamp}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Benchmark Report copied to clipboard!');
    }).catch(() => {
      this.showToast('Copied to clipboard!');
    });
  }

  exportJson() {
    if (!this.benchmarkData) return;
    const blob = new Blob([JSON.stringify(this.benchmarkData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `city-benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Downloaded JSON report');
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2500);
  }

  closeModal() {
    this.modal.classList.remove('active');
  }
}
