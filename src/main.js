import * as THREE from 'three';
import { CityGenerator } from './city/CityGenerator.js';
import { PedestrianManager } from './simulation/PedestrianManager.js';
import { TrafficManager } from './simulation/TrafficManager.js';
import { CameraController } from './controls/CameraController.js';
import { StatsHUD } from './ui/StatsHUD.js';
import { StressPanel } from './ui/StressPanel.js';
import { BenchmarkSuite } from './ui/BenchmarkSuite.js';

class CityApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Time & Lighting presets
    this.lightingModes = {
      day: {
        skyColor: 0xdbeafe,
        fogColor: 0xdbeafe,
        ambient: 0x94a3b8,
        ambientIntensity: 0.85,
        sun: 0xfffbeb,
        sunIntensity: 2.2,
        sunPos: [180, 260, 140]
      },
      sunset: {
        skyColor: 0xfdba74,
        fogColor: 0xfdba74,
        ambient: 0x7c2d12,
        ambientIntensity: 1.1,
        sun: 0xf97316,
        sunIntensity: 3.0,
        sunPos: [260, 60, -200]
      },
      night: {
        skyColor: 0x090d16,
        fogColor: 0x090d16,
        ambient: 0x334155,
        ambientIntensity: 0.9,
        sun: 0x60a5fa,
        sunIntensity: 0.9,
        sunPos: [140, 220, 100]
      }
    };

    this.currentMode = 'day';
    this.lastFrameTime = performance.now();
    this.elapsedTime = 0;

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initLighting();

    // Managers
    this.city = new CityGenerator(this.scene, { gridSize: 6 });
    this.city.generate();

    this.pedestrians = new PedestrianManager(this.scene, this.city);
    this.traffic = new TrafficManager(this.scene, this.city);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.scene);

    this.statsHUD = new StatsHUD(this.renderer);
    this.benchmarkSuite = new BenchmarkSuite(this);
    this.stressPanel = new StressPanel(this);

    this.initInteraction();
    this.setupResizeListener();

    // Kick off animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Shadow mapping
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    const cfg = this.lightingModes.day;
    this.scene.background = new THREE.Color(cfg.skyColor);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, 0.0016);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1.0,
      2500
    );
    this.camera.position.set(340, 300, 340);
  }

  initLighting() {
    const cfg = this.lightingModes.day;

    this.ambientLight = new THREE.HemisphereLight(cfg.ambient, 0x1e293b, cfg.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(cfg.sun, cfg.sunIntensity);
    this.sunLight.position.set(...cfg.sunPos);
    this.sunLight.castShadow = true;

    // Optimize shadow frustum coverage
    const d = 420;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 1000;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);
  }

  setTimeOfDay(mode) {
    if (!this.lightingModes[mode]) return;
    this.currentMode = mode;
    const cfg = this.lightingModes[mode];

    this.scene.background.set(cfg.skyColor);
    this.scene.fog.color.set(cfg.fogColor);

    this.ambientLight.color.set(cfg.ambient);
    this.ambientLight.intensity = cfg.ambientIntensity;

    this.sunLight.color.set(cfg.sun);
    this.sunLight.intensity = cfg.sunIntensity;
    this.sunLight.position.set(...cfg.sunPos);

    this.city.setLightingMode(mode);
  }

  setShadowQuality(quality) {
    if (quality === 'off') {
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      const size = quality === 'high' ? 4096 : 2048;
      this.sunLight.shadow.mapSize.width = size;
      this.sunLight.shadow.mapSize.height = size;
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null;
      }
    }
  }

  setDprScale(dpr) {
    this.renderer.setPixelRatio(dpr);
    this.statsHUD.updateResolutionDisplay();
  }

  rebuildCity(size) {
    this.city.generate(size);
    this.pedestrians.initPool();
    this.traffic.initPool();
    this.statsHUD.resetStats();
  }

  initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    let mouseDownPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e) => {
      mouseDownPos.x = e.clientX;
      mouseDownPos.y = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      // Check if this was a tap/click rather than a drag/pinch
      const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      const isUiElement = e.target.closest('button, input, select, .glass-panel, #benchmark-modal');
      if (dist < 12 && !isUiElement) {
        this.handleClick(e.clientX, e.clientY);
      }
    });
  }

  handleClick(clientX, clientY) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check hit against pedestrians or cars
    const hits = [];
    if (this.pedestrians.instancedMesh) hits.push(this.pedestrians.instancedMesh);
    if (this.traffic.instancedMesh) hits.push(this.traffic.instancedMesh);

    const intersects = this.raycaster.intersectObjects(hits, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const instanceId = hit.instanceId;

      if (hit.object === this.pedestrians.instancedMesh && instanceId !== undefined) {
        const ped = this.pedestrians.getPedestrian(instanceId);
        if (ped) {
          this.cameraController.setTrackingTarget(ped, new THREE.Vector3(0, 4, 8));
          this.showTargetTracker(`Citizen #${ped.id}`, `Speed: ${ped.speed.toFixed(1)} m/s | Walking`);
        }
      } else if (hit.object === this.traffic.instancedMesh && instanceId !== undefined) {
        const car = this.traffic.getVehicle(instanceId);
        if (car) {
          this.cameraController.setTrackingTarget(car, new THREE.Vector3(0, 6, 14));
          this.showTargetTracker(`Vehicle #${car.id}`, `Speed: ${(car.speed * 3.6).toFixed(0)} km/h | Cruising`);
        }
      }
    }
  }

  showTargetTracker(title, info) {
    const tracker = document.getElementById('target-tracker');
    const tTitle = document.getElementById('target-title');
    const tInfo = document.getElementById('target-info');
    if (tracker && tTitle && tInfo) {
      tTitle.textContent = title;
      tInfo.textContent = info;
      tracker.classList.add('visible');
    }
  }

  hideTargetTracker() {
    const tracker = document.getElementById('target-tracker');
    if (tracker) tracker.classList.remove('visible');
  }

  setupResizeListener() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.statsHUD.updateResolutionDisplay();
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    this.elapsedTime += delta;

    // Update simulations
    this.pedestrians.update(delta, this.elapsedTime);
    this.traffic.update(delta);
    this.cameraController.update(delta);

    // Update benchmark if active
    this.benchmarkSuite.update();

    // Render WebGL frame
    this.renderer.render(this.scene, this.camera);

    // Update diagnostic stats HUD
    this.statsHUD.update(this.pedestrians.activeCount, this.traffic.activeCount);
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new CityApp();
});
