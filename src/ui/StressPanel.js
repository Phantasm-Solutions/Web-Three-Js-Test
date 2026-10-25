export class StressPanel {
  constructor(app) {
    this.app = app;
    this.initControls();
  }

  initControls() {
    // Pedestrian Slider
    const sliderPeds = document.getElementById('slider-pedestrians');
    const lblPeds = document.getElementById('lbl-pedestrians');
    if (sliderPeds && lblPeds) {
      sliderPeds.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        lblPeds.textContent = val.toLocaleString();
        this.app.pedestrians.setCount(val);
      });
    }

    // Vehicle Slider
    const sliderVehicles = document.getElementById('slider-vehicles');
    const lblVehicles = document.getElementById('lbl-vehicles');
    if (sliderVehicles && lblVehicles) {
      sliderVehicles.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        lblVehicles.textContent = val.toLocaleString();
        this.app.traffic.setCount(val);
      });
    }

    // City Grid Size
    const pillCitySize = document.getElementById('pill-city-size');
    if (pillCitySize) {
      pillCitySize.querySelectorAll('.pill-option').forEach(btn => {
        btn.addEventListener('click', () => {
          pillCitySize.querySelectorAll('.pill-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const size = parseInt(btn.dataset.size, 10);
          this.app.rebuildCity(size);
        });
      });
    }

    // Shadow Quality
    const pillShadows = document.getElementById('pill-shadows');
    if (pillShadows) {
      pillShadows.querySelectorAll('.pill-option').forEach(btn => {
        btn.addEventListener('click', () => {
          pillShadows.querySelectorAll('.pill-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.app.setShadowQuality(btn.dataset.val);
        });
      });
    }

    // DPR Scale
    const pillDpr = document.getElementById('pill-dpr');
    if (pillDpr) {
      pillDpr.querySelectorAll('.pill-option').forEach(btn => {
        btn.addEventListener('click', () => {
          pillDpr.querySelectorAll('.pill-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const dpr = parseFloat(btn.dataset.val);
          this.app.setDprScale(dpr);
        });
      });
    }

    // Draw Mode (Instanced vs Individual Meshes)
    const pillMode = document.getElementById('pill-mode');
    if (pillMode) {
      pillMode.querySelectorAll('.pill-option').forEach(btn => {
        btn.addEventListener('click', () => {
          pillMode.querySelectorAll('.pill-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.dataset.mode;
          this.app.pedestrians.setMode(mode);
        });
      });
    }

    // Lighting Studio Drawer Button
    const btnNavLighting = document.getElementById('btn-nav-lighting');
    if (btnNavLighting) {
      btnNavLighting.addEventListener('click', () => {
        if (this.app.lightingController) {
          this.app.lightingController.togglePanel();
        }
      });
    }

    // Camera Presets
    const camCustomBuilding = document.getElementById('cam-custom-building');
    const camIso = document.getElementById('cam-iso');
    const camStreet = document.getElementById('cam-street');
    const camRooftop = document.getElementById('cam-rooftop');
    const camAerial = document.getElementById('cam-aerial');
    const camOrbit = document.getElementById('cam-orbit');
    const camBtns = [camCustomBuilding, camIso, camStreet, camRooftop, camAerial, camOrbit];

    const setCam = (btn, preset) => {
      camBtns.forEach(b => b && b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      if (preset === 'custom-building') {
        this.app.focusCustomBuilding();
      } else {
        this.app.cameraController.setPreset(preset);
      }
      this.app.hideTargetTracker();
    };

    if (camCustomBuilding) camCustomBuilding.addEventListener('click', () => setCam(camCustomBuilding, 'custom-building'));
    if (camIso) camIso.addEventListener('click', () => setCam(camIso, 'iso'));
    if (camStreet) camStreet.addEventListener('click', () => setCam(camStreet, 'street'));
    if (camRooftop) camRooftop.addEventListener('click', () => setCam(camRooftop, 'rooftop'));
    if (camAerial) camAerial.addEventListener('click', () => setCam(camAerial, 'aerial'));
    if (camOrbit) camOrbit.addEventListener('click', () => setCam(camOrbit, 'orbit'));

    // Custom Building 1 Placement in City Selector
    const pillCustomBuilding = document.getElementById('pill-custom-building');
    if (pillCustomBuilding) {
      pillCustomBuilding.querySelectorAll('.pill-option').forEach(btn => {
        btn.addEventListener('click', () => {
          pillCustomBuilding.querySelectorAll('.pill-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const placement = btn.dataset.val;
          this.app.setCustomBuildingPlacement(placement);
        });
      });
    }

    // Target tracking cancellation button
    const btnCancelTrack = document.getElementById('btn-cancel-track');
    if (btnCancelTrack) {
      btnCancelTrack.addEventListener('click', () => {
        this.app.cameraController.clearTracking();
        this.app.hideTargetTracker();
      });
    }

    // Benchmark button
    const btnBenchmark = document.getElementById('btn-run-benchmark');
    if (btnBenchmark) {
      btnBenchmark.addEventListener('click', () => {
        this.app.benchmarkSuite.start();
      });
    }

    // Mobile Touch Bar Controls
    const btnZoomIn = document.getElementById('btn-touch-zoomin');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.app.cameraController.zoomIn());
    }

    const btnZoomOut = document.getElementById('btn-touch-zoomout');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.app.cameraController.zoomOut());
    }

    const btnTouchMode = document.getElementById('btn-touch-mode');
    if (btnTouchMode) {
      btnTouchMode.addEventListener('click', () => {
        const isPan = this.app.cameraController.touchMode === 'pan';
        const newMode = isPan ? 'orbit' : 'pan';
        this.app.cameraController.setTouchMode(newMode);
        btnTouchMode.textContent = newMode === 'pan' ? '👆 Pan' : '🔄 Orbit';
        if (newMode === 'pan') {
          btnTouchMode.classList.add('active');
        } else {
          btnTouchMode.classList.remove('active');
        }
      });
    }

    const btnTouchReset = document.getElementById('btn-touch-reset');
    if (btnTouchReset) {
      btnTouchReset.addEventListener('click', () => {
        setCam(camIso, 'iso');
      });
    }

    // --- Collapsible Performance Monitor HUD ---
    const statsHud = document.getElementById('stats-hud');
    const btnCollapseHud = document.getElementById('btn-collapse-hud');
    const hudHeader = document.getElementById('hud-header-toggle');

    if (statsHud) {
      const toggleHud = (e) => {
        if (e) e.stopPropagation();
        statsHud.classList.toggle('collapsed');
        const isCollapsed = statsHud.classList.contains('collapsed');
        if (btnCollapseHud) btnCollapseHud.textContent = isCollapsed ? '+' : '−';
      };
      if (btnCollapseHud) btnCollapseHud.addEventListener('click', toggleHud);
      if (hudHeader) hudHeader.addEventListener('click', toggleHud);
    }

    // --- Collapsible Bottom Simulation Controls Bar ---
    const bottomBar = document.getElementById('bottom-controls-bar');
    const btnCollapseControls = document.getElementById('btn-collapse-controls');
    const controlsHeader = document.getElementById('controls-bar-header');
    const summarySpan = document.getElementById('collapsed-controls-summary');

    const updateControlsSummary = () => {
      if (!summarySpan) return;
      const peds = document.getElementById('lbl-pedestrians')?.textContent || '1,500';
      const cars = document.getElementById('lbl-vehicles')?.textContent || '300';
      const sizeActive = document.querySelector('#pill-city-size .pill-option.active');
      const sizeText = sizeActive ? sizeActive.textContent.split(' ')[0] : 'Medium';
      summarySpan.textContent = `${peds} Peds • ${cars} Cars • ${sizeText}`;
    };

    if (bottomBar) {
      const toggleControls = (e) => {
        if (e) e.stopPropagation();
        bottomBar.classList.toggle('collapsed');
        const isCollapsed = bottomBar.classList.contains('collapsed');
        if (btnCollapseControls) btnCollapseControls.textContent = isCollapsed ? '+' : '−';
        if (isCollapsed) updateControlsSummary();
      };
      if (btnCollapseControls) btnCollapseControls.addEventListener('click', toggleControls);
      if (controlsHeader) controlsHeader.addEventListener('click', toggleControls);
    }
  }
}
