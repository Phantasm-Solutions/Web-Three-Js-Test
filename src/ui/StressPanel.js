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

    // Time of Day
    const btnDay = document.getElementById('btn-tod-day');
    const btnSunset = document.getElementById('btn-tod-sunset');
    const btnNight = document.getElementById('btn-tod-night');
    const todBtns = [btnDay, btnSunset, btnNight];

    const setTod = (btn, mode) => {
      todBtns.forEach(b => b && b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      this.app.setTimeOfDay(mode);
    };

    if (btnDay) btnDay.addEventListener('click', () => setTod(btnDay, 'day'));
    if (btnSunset) btnSunset.addEventListener('click', () => setTod(btnSunset, 'sunset'));
    if (btnNight) btnNight.addEventListener('click', () => setTod(btnNight, 'night'));

    // Camera Presets
    const camIso = document.getElementById('cam-iso');
    const camStreet = document.getElementById('cam-street');
    const camRooftop = document.getElementById('cam-rooftop');
    const camAerial = document.getElementById('cam-aerial');
    const camOrbit = document.getElementById('cam-orbit');
    const camBtns = [camIso, camStreet, camRooftop, camAerial, camOrbit];

    const setCam = (btn, preset) => {
      camBtns.forEach(b => b && b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      this.app.cameraController.setPreset(preset);
      this.app.hideTargetTracker();
    };

    if (camIso) camIso.addEventListener('click', () => setCam(camIso, 'iso'));
    if (camStreet) camStreet.addEventListener('click', () => setCam(camStreet, 'street'));
    if (camRooftop) camRooftop.addEventListener('click', () => setCam(camRooftop, 'rooftop'));
    if (camAerial) camAerial.addEventListener('click', () => setCam(camAerial, 'aerial'));
    if (camOrbit) camOrbit.addEventListener('click', () => setCam(camOrbit, 'orbit'));

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

    const btnToggleHud = document.getElementById('btn-toggle-hud');
    const statsHud = document.getElementById('stats-hud');
    if (btnToggleHud && statsHud) {
      btnToggleHud.addEventListener('click', () => {
        statsHud.classList.toggle('collapsed');
        btnToggleHud.classList.toggle('active');
      });
    }

    const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
    const drawerHandle = document.getElementById('drawer-toggle-handle');
    const bottomBar = document.getElementById('bottom-controls-bar');
    const toggleDrawer = () => {
      if (bottomBar) {
        bottomBar.classList.toggle('expanded');
        if (btnToggleDrawer) btnToggleDrawer.classList.toggle('active');
      }
    };

    if (btnToggleDrawer) btnToggleDrawer.addEventListener('click', toggleDrawer);
    if (drawerHandle) drawerHandle.addEventListener('click', toggleDrawer);
  }
}
