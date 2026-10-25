import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CityGenerator } from './city/CityGenerator.js';
import { PedestrianManager } from './simulation/PedestrianManager.js';
import { TrafficManager } from './simulation/TrafficManager.js';
import { CameraController } from './controls/CameraController.js';
import { StatsHUD } from './ui/StatsHUD.js';
import { StressPanel } from './ui/StressPanel.js';
import { BenchmarkSuite } from './ui/BenchmarkSuite.js';
import { ModelManager } from './models/ModelManager.js';
import { ModelViewer } from './viewer/ModelViewer.js';
import { LightingController } from './lighting/LightingController.js';

class CityApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.currentTab = 'city'; // 'city' | 'viewer'

    this.lastFrameTime = performance.now();
    this.elapsedTime = 0;

    // 3D Asset & Model Manager
    this.modelManager = new ModelManager();

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initLighting();

    // Lighting & Atmosphere Controller
    this.lightingController = new LightingController(this);

    // City Generator
    this.city = new CityGenerator(this.scene, { gridSize: 6 });

    // Model Viewer Tab Component
    this.modelViewer = new ModelViewer(this);

    // Simulations & Controllers
    this.pedestrians = new PedestrianManager(this.scene, this.city);
    this.traffic = new TrafficManager(this.scene, this.city);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.scene);

    this.statsHUD = new StatsHUD(this.renderer);
    this.benchmarkSuite = new BenchmarkSuite(this);
    this.stressPanel = new StressPanel(this);

    this.initInteraction();
    this.initViewTabs();
    this.setupResizeListener();

    // Load custom building model and generate initial city
    this.initBuildingModel();

    // Kick off animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  async initBuildingModel() {
    try {
      const { model, info } = await this.modelManager.loadModel('/models/Building_1.glb', 'Building_1.glb');
      this.city.setCustomBuilding(model, info, 'prominent');
    } catch (e) {
      console.warn('Initial load of Building_1.glb failed:', e);
    } finally {
      this.rebuildCity(this.city.gridSize);
    }
  }

  initViewTabs() {
    const btnCity = document.getElementById('btn-tab-city');
    const btnViewer = document.getElementById('btn-tab-viewer');
    if (btnCity) btnCity.addEventListener('click', () => this.switchTab('city'));
    if (btnViewer) btnViewer.addEventListener('click', () => this.switchTab('viewer'));
  }

  switchTab(tab) {
    if (this.currentTab === tab) return;
    this.currentTab = tab;

    const btnCity = document.getElementById('btn-tab-city');
    const btnViewer = document.getElementById('btn-tab-viewer');
    if (btnCity) btnCity.classList.toggle('active', tab === 'city');
    if (btnViewer) btnViewer.classList.toggle('active', tab === 'viewer');

    const isCity = tab === 'city';
    const hud = document.getElementById('stats-hud');
    const bottomBar = document.getElementById('bottom-controls-bar');
    const mobileTouchBar = document.getElementById('mobile-touch-bar');
    const targetTracker = document.getElementById('target-tracker');
    const cityCameraBar = document.getElementById('city-camera-bar');

    if (hud) hud.style.display = isCity ? '' : 'none';
    if (bottomBar) bottomBar.style.display = isCity ? '' : 'none';
    if (mobileTouchBar) mobileTouchBar.style.display = isCity ? '' : 'none';
    if (targetTracker) targetTracker.style.display = isCity ? '' : 'none';
    if (cityCameraBar) cityCameraBar.style.display = isCity ? '' : 'none';

    this.cameraController.controls.enabled = isCity;
    this.modelViewer.setActive(!isCity);
  }

  useModelInCity(modelName, customScale = 1.0) {
    if (this.modelManager.activeModel) {
      this.city.setCustomBuilding(
        this.modelManager.activeModel,
        this.modelManager.activeModelInfo,
        'prominent',
        customScale
      );
      this.rebuildCity(this.city.gridSize);
      this.switchTab('city');
      setTimeout(() => {
        this.focusCustomBuilding();
      }, 350);
      this.showToast(`Placed ${modelName} (${(customScale * 100).toFixed(0)}% scale) into city simulation!`);
    }
  }

  setCustomBuildingPlacement(placement) {
    this.city.customBuildingPlacement = placement;
    this.rebuildCity(this.city.gridSize);
  }

  focusCustomBuilding() {
    if (this.city.customBuildingInstances && this.city.customBuildingInstances.length > 0) {
      this.cameraController.focusObject(this.city.customBuildingInstances[0]);
    } else {
      this.showToast('No Building 1 instances are placed in current density mode.');
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 3000);
    }
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = null; // No fog: maximum clarity across the metropolis

    // Generate real-time Image-Based Lighting environment map for natural glass & metal reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1.0,
      4000
    );
    this.camera.position.set(340, 300, 340);
  }

  initLighting() {
    this.ambientLight = new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.85);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    this.sunLight.position.set(180, 260, 140);
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
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);
  }

  setTimeOfDay(mode) {
    if (this.lightingController) {
      this.lightingController.applyPreset(mode);
    }
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
      if (this.currentTab !== 'city') return;
      const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      const isUiElement = e.target.closest('button, input, select, .glass-panel, #benchmark-modal, .lighting-drawer');
      if (dist < 12 && !isUiElement) {
        this.handleClick(e.clientX, e.clientY);
      }
    });
  }

  handleClick(clientX, clientY) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check hit against pedestrians or cars
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
          return;
        }
      } else if (hit.object === this.traffic.instancedMesh && instanceId !== undefined) {
        const car = this.traffic.getVehicle(instanceId);
        if (car) {
          this.cameraController.setTrackingTarget(car, new THREE.Vector3(0, 6, 14));
          this.showTargetTracker(`Vehicle #${car.id}`, `Speed: ${(car.speed * 3.6).toFixed(0)} km/h | Cruising`);
          return;
        }
      }
    }

    // 2. Check hit against custom building instances
    if (this.city.customBuildingInstances && this.city.customBuildingInstances.length > 0) {
      const bHits = this.raycaster.intersectObjects(this.city.customBuildingInstances, true);
      if (bHits.length > 0) {
        let parentInstance = bHits[0].object;
        while (parentInstance.parent && parentInstance.parent !== this.city.cityGroup) {
          parentInstance = parentInstance.parent;
        }
        this.cameraController.focusObject(parentInstance, 80);
        this.showTargetTracker(
          '🏢 Building 1 (Custom Model)',
          'Commercial Mid-Rise | 17 Meshes | 19.6k Triangles'
        );
        return;
      }
    }

    // 3. Check hit against general city blocks
    const cityHits = this.raycaster.intersectObjects(this.city.cityGroup.children, false);
    if (cityHits.length > 0) {
      const hit = cityHits[0];
      const point = hit.point;
      if (point.y > 5) {
        this.showTargetTracker('🏢 Metropolis Architecture', `Elevation: ${point.y.toFixed(0)}m | Batch Geometry`);
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

      if (this.modelViewer && this.modelViewer.camera) {
        this.modelViewer.camera.aspect = window.innerWidth / window.innerHeight;
        this.modelViewer.camera.updateProjectionMatrix();
      }

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

    if (this.currentTab === 'city') {
      // Update simulations
      this.pedestrians.update(delta, this.elapsedTime);
      this.traffic.update(delta);
      this.cameraController.update(delta);
      this.benchmarkSuite.update();
      this.lightingController.update(delta);

      // Render WebGL frame
      this.renderer.render(this.scene, this.camera);

      // Update diagnostic stats HUD
      this.statsHUD.update(this.pedestrians.activeCount, this.traffic.activeCount);
    } else {
      // Model Viewer tab
      this.lightingController.update(delta);
      this.modelViewer.update(delta);
    }
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new CityApp();
});
