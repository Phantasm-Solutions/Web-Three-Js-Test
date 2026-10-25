import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class ModelViewer {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
    this.modelManager = app.modelManager;

    this.isActive = false;
    this.currentModelGroup = null;
    this.currentInfo = null;
    this.currentBoxHelper = null;
    this.displayMode = 'shaded'; // 'shaded' | 'wireframe' | 'clay' | 'normals'
    this.showGrid = true;
    this.showBounds = false;
    this.autoRotate = false;
    this.rotateSpeed = 1.5;

    // Scale state
    this.currentScale = 1.0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.scaleZ = 1.0;
    this.isGizmoActive = false;

    this.initScene();
    this.initCameraAndControls();
    this.initTransformControls();
    this.initStudioLighting();
    this.initUI();
    this.initDragAndDrop();
    this.initDoubleClickFocus();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1120);
    this.scene.fog = null; // No fog for crisp, sharp 3D model inspection

    // Infinite studio ground plane (expanded to 6000m for generous zoom-out)
    const groundGeo = new THREE.PlaneGeometry(6000, 6000);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundMaterial = new THREE.ShadowMaterial({ opacity: 0.35 });
    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
    this.groundMesh.position.y = -0.01;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Studio grid helper (expanded to 600m with fine subdivisions)
    this.gridHelper = new THREE.GridHelper(600, 120, 0x38bdf8, 0x1e293b);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);
  }

  initCameraAndControls() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      15000 // Deep camera far clipping plane
    );
    this.camera.position.set(12, 8, 14);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 8000; // Virtually unlimited zoom-out capability
    this.controls.zoomSpeed = 1.3;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going underneath floor
    this.controls.target.set(0, 1.8, 0);
  }

  initTransformControls() {
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('scale');
    this.transformControls.size = 0.85;

    this.transformHelper = this.transformControls.getHelper();
    this.transformHelper.visible = false;
    this.scene.add(this.transformHelper);

    // Temporarily pause OrbitControls while dragging the 3D scale gizmo
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !e.value;
    });

    // Real-time synchronization when user manipulates the 3D gizmo
    this.transformControls.addEventListener('change', () => {
      if (this.currentModelGroup && this.isGizmoActive) {
        this.scaleX = Math.max(0.05, this.currentModelGroup.scale.x);
        this.scaleY = Math.max(0.05, this.currentModelGroup.scale.y);
        this.scaleZ = Math.max(0.05, this.currentModelGroup.scale.z);
        this.currentScale = (this.scaleX + this.scaleY + this.scaleZ) / 3;

        this.syncScaleInputs();
        this.updateDimensionsUI();
        if (this.currentBoxHelper) this.currentBoxHelper.update();
      }
    });
  }

  initStudioLighting() {
    // 3-point Studio Lighting
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.1);
    this.scene.add(this.ambientLight);

    // Key Light (main shadow caster)
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 2.8);
    this.keyLight.position.set(24, 34, 24);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 150;
    const d = 25;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Fill Light (soft cool blue from opposite side)
    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    this.fillLight.position.set(-20, 16, -12);
    this.scene.add(this.fillLight);

    // Rim / Back Light (accent highlight from behind)
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    this.rimLight.position.set(0, 25, -25);
    this.scene.add(this.rimLight);
  }

  initUI() {
    const viewerOverlay = document.createElement('div');
    viewerOverlay.id = 'model-viewer-overlay';
    viewerOverlay.className = 'model-viewer-container';
    viewerOverlay.style.display = 'none';

    viewerOverlay.innerHTML = `
      <!-- Viewer Sidebar: Model List & File Actions -->
      <div class="viewer-sidebar glass-panel" id="viewer-sidebar">
        <div class="viewer-section-title" id="viewer-sidebar-header" style="cursor: pointer;" title="Click to Collapse / Expand Sidebar">
          <span>📁 Models in Project</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="btn-refresh-models" class="btn-icon-tiny" title="Refresh folder">🔄</button>
            <button id="btn-collapse-viewer-sidebar" class="btn-collapse-icon" title="Collapse / Expand Sidebar">−</button>
          </div>
        </div>

        <!-- Models List -->
        <div id="viewer-models-list" class="viewer-models-list">
          <div class="loading-spinner-small">Scanning models...</div>
        </div>

        <!-- Drag & Drop Upload Zone -->
        <div class="drop-zone" id="viewer-drop-zone">
          <span style="font-size: 20px;">📥</span>
          <div style="font-size: 11px; font-weight: 600;">Drop 3D file here</div>
          <div style="font-size: 10px; color: #94a3b8;">Supports .obj, .gltf, .glb</div>
          <input type="file" id="viewer-file-input" accept=".obj,.gltf,.glb" style="display: none;" />
          <button id="btn-browse-file" class="btn-subtle" style="margin-top: 6px; font-size: 10px; padding: 3px 8px;">Browse Local</button>
        </div>

        <!-- Active Model Stats Card -->
        <div class="viewer-stats-card">
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8; margin-bottom: 6px;" id="stat-model-name">Building_1.glb</div>
          <div class="viewer-metric-grid">
            <div class="v-metric">
              <span class="v-label">Triangles:</span>
              <span class="v-val" id="stat-triangles">-</span>
            </div>
            <div class="v-metric">
              <span class="v-label">Vertices:</span>
              <span class="v-val" id="stat-vertices">-</span>
            </div>
            <div class="v-metric">
              <span class="v-label">Meshes:</span>
              <span class="v-val" id="stat-meshes">-</span>
            </div>
            <div class="v-metric">
              <span class="v-label">File Size:</span>
              <span class="v-val" id="stat-filesize">-</span>
            </div>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; font-family: monospace;" id="stat-dimensions">
            Dimensions: -
          </div>
        </div>

        <!-- Interactive Object Scale Controls -->
        <div class="viewer-section-title" style="margin-top: 2px;">
          <span>📏 Object Scale</span>
          <span id="badge-scale-val" class="mono-badge">1.00x (100%)</span>
        </div>
        <div class="scale-ctrl-container">
          <div class="slider-row">
            <input type="range" id="slider-model-scale" min="0.1" max="5.0" step="0.05" value="1.0" />
          </div>
          <div class="scale-presets-row">
            <button class="scale-pill-btn" data-scale="0.5">0.5x</button>
            <button class="scale-pill-btn active" data-scale="1.0">1.0x</button>
            <button class="scale-pill-btn" data-scale="1.5">1.5x</button>
            <button class="scale-pill-btn" data-scale="2.0">2.0x</button>
            <button class="scale-pill-btn" data-scale="3.0">3.0x</button>
            <button class="scale-pill-btn" id="btn-scale-reset">↺ Reset</button>
          </div>
          <!-- Fine-grained Axis Inputs (X, Y, Z) -->
          <div class="axis-scale-row">
            <div class="axis-input-wrap">
              <span class="axis-label" style="color: #ef4444;">X:</span>
              <input type="number" id="input-scale-x" min="0.05" max="20" step="0.1" value="1.0" class="axis-num-input" />
            </div>
            <div class="axis-input-wrap">
              <span class="axis-label" style="color: #22c55e;">Y:</span>
              <input type="number" id="input-scale-y" min="0.05" max="20" step="0.1" value="1.0" class="axis-num-input" />
            </div>
            <div class="axis-input-wrap">
              <span class="axis-label" style="color: #38bdf8;">Z:</span>
              <input type="number" id="input-scale-z" min="0.05" max="20" step="0.1" value="1.0" class="axis-num-input" />
            </div>
          </div>
        </div>

        <!-- Sub-mesh / Component Hierarchy Inspector -->
        <div class="viewer-section-title" style="margin-top: 2px;">
          <span>🧩 Sub-Meshes & Parts</span>
          <span id="badge-parts-count" class="mono-badge">0</span>
        </div>
        <div id="viewer-submesh-list" class="viewer-submesh-list">
          <!-- Populated dynamically -->
        </div>

        <!-- Custom Facade Color Tint -->
        <div class="color-picker-row" style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px;">
          <label for="color-viewer-tint">Glass Tint:</label>
          <input type="color" id="color-viewer-tint" value="#38bdf8" />
          <label for="color-viewer-facade" style="margin-left: 8px;">Facade:</label>
          <input type="color" id="color-viewer-facade" value="#f1f5f9" />
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button id="btn-use-in-city" class="btn-primary" style="flex: 1; font-weight: 700; padding: 8px;">
            🏙️ Use in City
          </button>
          <button id="btn-viewer-snapshot" class="btn-secondary" style="padding: 8px 12px;" title="Save high-res PNG snapshot">
            📸 Snapshot
          </button>
        </div>
      </div>

      <!-- Viewer Floating Controls Toolbar -->
      <div class="viewer-toolbar glass-panel">
        <!-- Display Mode -->
        <div class="viewer-tool-group">
          <span class="v-tool-label">Shading:</span>
          <button class="viewer-tool-btn active" data-mode="shaded" title="PBR Shaded">🎨 Shaded</button>
          <button class="viewer-tool-btn" data-mode="wireframe" title="Wireframe Overlay">🕸️ Wireframe</button>
          <button class="viewer-tool-btn" data-mode="clay" title="Clay Matte">⚪ Clay</button>
          <button class="viewer-tool-btn" data-mode="normals" title="Surface Normals">🌈 Normals</button>
        </div>

        <div class="v-separator"></div>

        <!-- 3D Transform Gizmo & Scaling -->
        <div class="viewer-tool-group">
          <button class="viewer-tool-btn" id="btn-toggle-gizmo" title="Toggle 3D Interactive Scale Gizmo on Model">📏 3D Gizmo</button>
        </div>

        <div class="v-separator"></div>

        <!-- Toggles -->
        <div class="viewer-tool-group">
          <button class="viewer-tool-btn active" id="btn-toggle-grid" title="Toggle Floor Grid">📐 Grid</button>
          <button class="viewer-tool-btn" id="btn-toggle-bounds" title="Toggle Bounding Box">📦 Bounds</button>
          <button class="viewer-tool-btn" id="btn-toggle-autorotate" title="Toggle Turntable Rotation">🔄 Rotate</button>
        </div>

        <div class="v-separator"></div>

        <!-- Zoom & Framing Controls -->
        <div class="viewer-tool-group">
          <button class="viewer-tool-btn" id="btn-viewer-zoomin" title="Zoom In (Scroll wheel or click)">🔍➕</button>
          <button class="viewer-tool-btn" id="btn-viewer-zoomout" title="Zoom Out (Scroll wheel or click)">🔍➖</button>
          <button class="viewer-tool-btn" id="btn-viewer-fithome" title="Frame & Center Model (or double click)">🎯 Fit View</button>
          <button class="viewer-tool-btn" id="btn-viewer-reset" title="Reset Camera">🔄 Reset</button>
        </div>
      </div>
    `;

    document.body.appendChild(viewerOverlay);
    this.overlayElement = viewerOverlay;

    this.bindEvents();
  }

  bindEvents() {
    const o = this.overlayElement;
    if (!o) return;

    // Refresh models button
    const btnRefresh = o.querySelector('#btn-refresh-models');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', (e) => {
        e.stopPropagation();
        this.refreshModelsList();
      });
    }

    // Collapse / Expand sidebar
    const sidebar = o.querySelector('#viewer-sidebar');
    const btnCollapseSidebar = o.querySelector('#btn-collapse-viewer-sidebar');
    const headerSidebar = o.querySelector('#viewer-sidebar-header');
    if (sidebar && btnCollapseSidebar && headerSidebar) {
      const toggleSidebarCollapse = (e) => {
        if (e.target.closest('#btn-refresh-models')) return;
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        btnCollapseSidebar.textContent = isCollapsed ? '+' : '−';
      };
      headerSidebar.addEventListener('click', toggleSidebarCollapse);
      btnCollapseSidebar.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebarCollapse(e);
      });
    }

    // Browse file button
    const btnBrowse = o.querySelector('#btn-browse-file');
    const fileInput = o.querySelector('#viewer-file-input');
    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.loadModelFromSource(e.target.files[0]);
        }
      });
    }

    // Shading mode buttons
    o.querySelectorAll('.viewer-tool-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        o.querySelectorAll('.viewer-tool-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setShadingMode(btn.dataset.mode);
      });
    });

    // 3D Scale Gizmo button
    const btnGizmo = o.querySelector('#btn-toggle-gizmo');
    if (btnGizmo) {
      btnGizmo.addEventListener('click', () => {
        this.toggleGizmo();
      });
    }

    // Zoom In / Zoom Out buttons
    const btnZoomIn = o.querySelector('#btn-viewer-zoomin');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.zoomCamera(0.7));
    }

    const btnZoomOut = o.querySelector('#btn-viewer-zoomout');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.zoomCamera(1.4));
    }

    // Grid toggle
    const btnGrid = o.querySelector('#btn-toggle-grid');
    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        this.showGrid = !this.showGrid;
        btnGrid.classList.toggle('active', this.showGrid);
        this.gridHelper.visible = this.showGrid;
      });
    }

    // Bounds toggle
    const btnBounds = o.querySelector('#btn-toggle-bounds');
    if (btnBounds) {
      btnBounds.addEventListener('click', () => {
        this.showBounds = !this.showBounds;
        btnBounds.classList.toggle('active', this.showBounds);
        if (this.currentBoxHelper) this.currentBoxHelper.visible = this.showBounds;
      });
    }

    // Auto-rotate toggle
    const btnRotate = o.querySelector('#btn-toggle-autorotate');
    if (btnRotate) {
      btnRotate.addEventListener('click', () => {
        this.autoRotate = !this.autoRotate;
        btnRotate.classList.toggle('active', this.autoRotate);
      });
    }

    // Fit View
    const btnFit = o.querySelector('#btn-viewer-fithome');
    if (btnFit) {
      btnFit.addEventListener('click', () => this.fitModelToView());
    }

    // Reset camera
    const btnReset = o.querySelector('#btn-viewer-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetCamera());
    }

    // Snapshot button
    const btnSnapshot = o.querySelector('#btn-viewer-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => this.takeSnapshot());
    }

    // Use in City button (passes customized scale factor)
    const btnUseInCity = o.querySelector('#btn-use-in-city');
    if (btnUseInCity) {
      btnUseInCity.addEventListener('click', () => {
        if (this.currentModelGroup && this.currentInfo) {
          this.app.useModelInCity(this.currentInfo.filename, this.currentScale);
        }
      });
    }

    // Scale Slider & Presets
    const sliderScale = o.querySelector('#slider-model-scale');
    if (sliderScale) {
      sliderScale.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.setUniformScale(val);
      });
    }

    // Scale Presets
    o.querySelectorAll('.scale-pill-btn[data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        const scaleVal = parseFloat(btn.dataset.scale);
        this.setUniformScale(scaleVal);
      });
    });

    const btnScaleReset = o.querySelector('#btn-scale-reset');
    if (btnScaleReset) {
      btnScaleReset.addEventListener('click', () => {
        this.setUniformScale(1.0);
      });
    }

    // Axis inputs (X, Y, Z)
    ['x', 'y', 'z'].forEach(axis => {
      const inp = o.querySelector(`#input-scale-${axis}`);
      if (inp) {
        inp.addEventListener('input', (e) => {
          const val = Math.max(0.05, parseFloat(e.target.value) || 1.0);
          this.setAxisScale(axis, val);
        });
      }
    });

    // Color Tint Pickers
    const tintGlass = o.querySelector('#color-viewer-tint');
    if (tintGlass) {
      tintGlass.addEventListener('input', (e) => {
        const col = new THREE.Color(e.target.value);
        if (this.currentModelGroup) {
          this.currentModelGroup.traverse((c) => {
            if (c.isMesh && c.userData.isGlass) {
              c.material.color.copy(col);
            }
          });
        }
      });
    }

    const tintFacade = o.querySelector('#color-viewer-facade');
    if (tintFacade) {
      tintFacade.addEventListener('input', (e) => {
        const col = new THREE.Color(e.target.value);
        if (this.currentModelGroup) {
          this.currentModelGroup.traverse((c) => {
            if (c.isMesh && c.userData.isFacade) {
              c.material.color.copy(col);
            }
          });
        }
      });
    }
  }

  initDragAndDrop() {
    const dropZone = this.overlayElement.querySelector('#viewer-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        if (!this.isActive) return;
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        if (!this.isActive) return;
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
      }, false);
    });

    window.addEventListener('drop', (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.loadModelFromSource(files[0]);
      }
    });
  }

  initDoubleClickFocus() {
    window.addEventListener('dblclick', (e) => {
      if (!this.isActive || !this.currentModelGroup) return;
      if (e.target.closest('.glass-panel, button, input')) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      const hits = raycaster.intersectObject(this.currentModelGroup, true);

      if (hits.length > 0) {
        const point = hits[0].point;
        this.controls.target.copy(point);
        this.controls.update();
      } else {
        this.fitModelToView();
      }
    });
  }

  // --- Zoom Camera Method ---
  zoomCamera(factor = 0.75) {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const newLen = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() * factor));
    offset.setLength(newLen);
    this.camera.position.addVectors(this.controls.target, offset);
    this.controls.update();
  }

  // --- Scaling Logic ---
  setUniformScale(val) {
    this.currentScale = val;
    this.scaleX = val;
    this.scaleY = val;
    this.scaleZ = val;

    if (this.currentModelGroup) {
      this.currentModelGroup.scale.set(val, val, val);
      if (this.currentBoxHelper) this.currentBoxHelper.update();
    }

    this.syncScaleInputs();
    this.updateDimensionsUI();
  }

  setAxisScale(axis, val) {
    if (axis === 'x') this.scaleX = val;
    if (axis === 'y') this.scaleY = val;
    if (axis === 'z') this.scaleZ = val;
    this.currentScale = (this.scaleX + this.scaleY + this.scaleZ) / 3;

    if (this.currentModelGroup) {
      this.currentModelGroup.scale.set(this.scaleX, this.scaleY, this.scaleZ);
      if (this.currentBoxHelper) this.currentBoxHelper.update();
    }

    this.syncScaleInputs();
    this.updateDimensionsUI();
  }

  syncScaleInputs() {
    const o = this.overlayElement;
    if (!o) return;

    const slider = o.querySelector('#slider-model-scale');
    if (slider) slider.value = this.currentScale.toFixed(2);

    const badge = o.querySelector('#badge-scale-val');
    if (badge) badge.textContent = `${this.currentScale.toFixed(2)}x (${(this.currentScale * 100).toFixed(0)}%)`;

    const inpX = o.querySelector('#input-scale-x');
    const inpY = o.querySelector('#input-scale-y');
    const inpZ = o.querySelector('#input-scale-z');
    if (inpX) inpX.value = this.scaleX.toFixed(2);
    if (inpY) inpY.value = this.scaleY.toFixed(2);
    if (inpZ) inpZ.value = this.scaleZ.toFixed(2);

    // Sync pill active states
    o.querySelectorAll('.scale-pill-btn[data-scale]').forEach(b => {
      const s = parseFloat(b.dataset.scale);
      b.classList.toggle('active', Math.abs(s - this.currentScale) < 0.04);
    });
  }

  updateDimensionsUI() {
    if (!this.currentInfo) return;
    const elDim = this.overlayElement.querySelector('#stat-dimensions');
    if (elDim) {
      const dx = this.currentInfo.dimensions.x * this.scaleX;
      const dy = this.currentInfo.dimensions.y * this.scaleY;
      const dz = this.currentInfo.dimensions.z * this.scaleZ;
      elDim.textContent = `Dimensions: ${dx.toFixed(2)}m × ${dy.toFixed(2)}m × ${dz.toFixed(2)}m`;
    }
  }

  toggleGizmo(forceState = null) {
    this.isGizmoActive = forceState !== null ? forceState : !this.isGizmoActive;
    const btn = this.overlayElement.querySelector('#btn-toggle-gizmo');
    if (btn) btn.classList.toggle('active', this.isGizmoActive);

    if (this.isGizmoActive && this.currentModelGroup) {
      this.transformControls.attach(this.currentModelGroup);
      this.transformHelper.visible = true;
    } else {
      this.transformControls.detach();
      this.transformHelper.visible = false;
    }
  }

  async refreshModelsList() {
    const listContainer = this.overlayElement.querySelector('#viewer-models-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading-spinner-small">Scanning...</div>';
    const models = await this.modelManager.listAvailableModels();

    if (!models || models.length === 0) {
      listContainer.innerHTML = '<div style="font-size: 11px; color: #94a3b8; padding: 8px;">No 3D models found in models/ folder.</div>';
      return;
    }

    listContainer.innerHTML = '';
    models.forEach(m => {
      const item = document.createElement('div');
      item.className = 'viewer-model-item';
      if (this.currentInfo && this.currentInfo.filename === m.filename) {
        item.classList.add('active');
      }

      const sizeStr = m.size ? `${(m.size / (1024 * 1024)).toFixed(1)} MB` : '';
      item.innerHTML = `
        <div class="m-item-icon">🏢</div>
        <div class="m-item-details">
          <div class="m-item-title">${m.filename}</div>
          <div class="m-item-sub">Format: ${m.ext ? m.ext.toUpperCase() : 'OBJ'} ${sizeStr ? `• ${sizeStr}` : ''}</div>
        </div>
        <div class="m-item-badge">${m.ext ? m.ext.toUpperCase() : 'OBJ'}</div>
      `;

      item.addEventListener('click', () => {
        listContainer.querySelectorAll('.viewer-model-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.loadModelFromSource(m.url, m.filename);
      });

      listContainer.appendChild(item);
    });
  }

  async loadModelFromSource(source, name = '') {
    try {
      this.showToast('Loading 3D model...');
      const { model, info } = await this.modelManager.loadModel(source, name);
      this.displayModel(model, info);
      this.showToast(`Loaded ${info.filename} successfully!`);
    } catch (err) {
      console.error('Failed to load model:', err);
      this.showToast(`Error: ${err.message}`);
    }
  }

  displayModel(modelGroup, info) {
    if (this.currentModelGroup) {
      if (this.isGizmoActive) this.transformControls.detach();
      this.scene.remove(this.currentModelGroup);
    }
    if (this.currentBoxHelper) {
      this.scene.remove(this.currentBoxHelper);
      this.currentBoxHelper = null;
    }

    this.currentModelGroup = modelGroup;
    this.currentInfo = info;
    this.scene.add(modelGroup);

    // Apply current scale
    this.currentModelGroup.scale.set(this.scaleX, this.scaleY, this.scaleZ);

    // Box helper
    this.currentBoxHelper = new THREE.BoxHelper(modelGroup, 0x38bdf8);
    this.currentBoxHelper.visible = this.showBounds;
    this.scene.add(this.currentBoxHelper);

    // Reattach gizmo if active
    if (this.isGizmoActive) {
      this.transformControls.attach(modelGroup);
      this.transformHelper.visible = true;
    }

    // Apply shading mode
    this.setShadingMode(this.displayMode);

    // Update stats UI & submesh list
    this.updateStatsUI(info);
    this.populateSubmeshList(info);
    this.syncScaleInputs();
    this.updateDimensionsUI();

    // Frame camera to model
    this.fitModelToView();

    // Sync active item in list
    const listContainer = this.overlayElement.querySelector('#viewer-models-list');
    if (listContainer) {
      listContainer.querySelectorAll('.viewer-model-item').forEach(el => {
        const title = el.querySelector('.m-item-title')?.textContent;
        el.classList.toggle('active', title === info.filename);
      });
    }
  }

  updateStatsUI(info) {
    const o = this.overlayElement;
    if (!o || !info) return;

    const elName = o.querySelector('#stat-model-name');
    const elTri = o.querySelector('#stat-triangles');
    const elVert = o.querySelector('#stat-vertices');
    const elMesh = o.querySelector('#stat-meshes');
    const elSize = o.querySelector('#stat-filesize');
    const elPartsCount = o.querySelector('#badge-parts-count');

    if (elName) elName.textContent = info.filename;
    if (elTri) elTri.textContent = info.triangles.toLocaleString();
    if (elVert) elVert.textContent = info.vertices.toLocaleString();
    if (elMesh) elMesh.textContent = info.meshes.toString();
    if (elSize) elSize.textContent = info.fileSize;
    if (elPartsCount) elPartsCount.textContent = (info.submeshes ? info.submeshes.length : info.meshes).toString();
  }

  populateSubmeshList(info) {
    const list = this.overlayElement.querySelector('#viewer-submesh-list');
    if (!list) return;

    list.innerHTML = '';
    const parts = info.submeshes || [];
    if (parts.length === 0) {
      list.innerHTML = '<div style="font-size: 10px; color: #94a3b8; padding: 4px;">Single unified mesh</div>';
      return;
    }

    parts.forEach(p => {
      const row = document.createElement('div');
      row.className = 'submesh-row';
      row.innerHTML = `
        <span class="submesh-eye" title="Toggle visibility">👁️</span>
        <span class="submesh-name" title="${p.name}">${p.name}</span>
      `;

      const eye = row.querySelector('.submesh-eye');
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        p.mesh.visible = !p.mesh.visible;
        eye.style.opacity = p.mesh.visible ? '1' : '0.35';
      });

      // Hover to highlight
      row.addEventListener('mouseenter', () => {
        if (!p.mesh.userData.savedEmissive) {
          p.mesh.userData.savedEmissive = p.mesh.material.emissive ? p.mesh.material.emissive.clone() : new THREE.Color(0);
          p.mesh.userData.savedIntensity = p.mesh.material.emissiveIntensity || 0;
        }
        if (p.mesh.material.emissive) {
          p.mesh.material.emissive.set(0x38bdf8);
          p.mesh.material.emissiveIntensity = 0.5;
        }
      });

      row.addEventListener('mouseleave', () => {
        if (p.mesh.material.emissive && p.mesh.userData.savedEmissive) {
          p.mesh.material.emissive.copy(p.mesh.userData.savedEmissive);
          p.mesh.material.emissiveIntensity = p.mesh.userData.savedIntensity;
        }
      });

      list.appendChild(row);
    });
  }

  setShadingMode(mode) {
    this.displayMode = mode;
    if (!this.currentModelGroup) return;

    this.currentModelGroup.traverse((child) => {
      if (child.isMesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        if (mode === 'wireframe') {
          // Wireframe Overlay mode
          child.material = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            wireframe: true,
            roughness: 0.2,
            metalness: 0.8
          });
        } else if (mode === 'clay') {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.9,
            metalness: 0.05
          });
        } else if (mode === 'normals') {
          child.material = new THREE.MeshNormalMaterial();
        } else {
          // Shaded original PBR
          child.material = child.userData.originalMaterial;
        }
      }
    });
  }

  fitModelToView() {
    if (!this.currentModelGroup) return;

    const box = new THREE.Box3().setFromObject(this.currentModelGroup);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    cameraZ = Math.max(cameraZ, 4);

    this.controls.target.copy(center);
    this.camera.position.set(center.x + cameraZ * 0.8, center.y + cameraZ * 0.6, center.z + cameraZ * 0.8);
    this.camera.lookAt(center);
    this.controls.update();

    if (this.currentBoxHelper) {
      this.currentBoxHelper.update();
    }
  }

  resetCamera() {
    this.fitModelToView();
  }

  takeSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `${this.currentInfo?.filename || 'model'}_snapshot.png`;
    a.href = dataUrl;
    a.click();
    this.showToast('Snapshot saved as PNG!');
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 3000);
    }
  }

  setActive(active) {
    this.isActive = active;
    if (this.overlayElement) {
      this.overlayElement.style.display = active ? 'block' : 'none';
    }

    if (active) {
      // Connect environment map from app
      if (this.app.envMap && !this.scene.environment) {
        this.scene.environment = this.app.envMap;
      }
      this.controls.enabled = true;
      this.refreshModelsList();
      if (!this.currentModelGroup) {
        this.loadModelFromSource('/models/Building_1.glb', 'Building_1.glb');
      } else {
        this.fitModelToView();
      }
    } else {
      this.controls.enabled = false;
      if (this.transformControls) {
        this.transformControls.detach();
        if (this.transformHelper) this.transformHelper.visible = false;
        this.isGizmoActive = false;
      }
    }
  }

  update(delta) {
    if (!this.isActive) return;

    if (this.autoRotate && this.currentModelGroup) {
      this.currentModelGroup.rotation.y += delta * this.rotateSpeed * 0.4;
      if (this.currentBoxHelper) this.currentBoxHelper.update();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
