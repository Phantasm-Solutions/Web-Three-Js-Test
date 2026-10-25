import * as THREE from 'three';

export class LightingController {
  constructor(app) {
    this.app = app;
    this.scene = app.scene;
    this.renderer = app.renderer;

    // Presets
    this.presets = {
      day: {
        name: '☀️ Daylight',
        time: 12.0,
        elevation: 65,
        azimuth: 145,
        sunIntensity: 2.4,
        sunColor: '#fffbeb',
        ambientIntensity: 0.9,
        skyColor: '#dbeafe',
        groundColor: '#334155',
        exposure: 1.05,
        emissiveIntensity: 0.0,
        emissiveColor: '#fef08a'
      },
      sunset: {
        name: '🌅 Golden Hour',
        time: 18.5,
        elevation: 14,
        azimuth: 240,
        sunIntensity: 3.2,
        sunColor: '#f97316',
        ambientIntensity: 1.1,
        skyColor: '#fdba74',
        groundColor: '#7c2d12',
        exposure: 1.15,
        emissiveIntensity: 0.8,
        emissiveColor: '#fed7aa'
      },
      night: {
        name: '🌙 Cyber Night',
        time: 23.0,
        elevation: 45,
        azimuth: 60,
        sunIntensity: 0.8,
        sunColor: '#60a5fa',
        ambientIntensity: 0.65,
        skyColor: '#090d16',
        groundColor: '#1e293b',
        exposure: 1.25,
        emissiveIntensity: 3.0,
        emissiveColor: '#fef08a'
      },
      overcast: {
        name: '⛅ Overcast Studio',
        time: 10.0,
        elevation: 80,
        azimuth: 180,
        sunIntensity: 1.2,
        sunColor: '#f1f5f9',
        ambientIntensity: 1.6,
        skyColor: '#94a3b8',
        groundColor: '#475569',
        exposure: 1.0,
        emissiveIntensity: 0.2,
        emissiveColor: '#fef08a'
      },
      dawn: {
        name: '🌄 Sunrise Dawn',
        time: 6.2,
        elevation: 8,
        azimuth: 85,
        sunIntensity: 2.6,
        sunColor: '#f43f5e',
        ambientIntensity: 0.95,
        skyColor: '#fbcfe8',
        groundColor: '#831843',
        exposure: 1.1,
        emissiveIntensity: 0.9,
        emissiveColor: '#fef08a'
      }
    };

    // Current State
    this.current = { ...this.presets.day };
    this.isCycleRunning = false;
    this.cycleSpeed = 1.0; // hours per 10 seconds
    this.sunDistance = 450;

    // References to lights
    this.sunLight = app.sunLight;
    this.ambientLight = app.ambientLight;

    // UI elements container
    this.panelElement = null;
    this.listeners = [];

    this.initUI();
    this.applyCurrentLighting();
  }

  setLightReferences(sunLight, ambientLight) {
    this.sunLight = sunLight;
    this.ambientLight = ambientLight;
    this.applyCurrentLighting();
  }

  /**
   * Apply all current lighting settings to the Three.js scene
   */
  applyCurrentLighting() {
    if (!this.sunLight || !this.ambientLight) return;

    // 1. Sun Direction (Spherical Coordinates)
    const phi = (90 - Math.max(0.1, this.current.elevation)) * (Math.PI / 180);
    const theta = this.current.azimuth * (Math.PI / 180);
    const x = this.sunDistance * Math.sin(phi) * Math.sin(theta);
    const y = this.sunDistance * Math.cos(phi);
    const z = this.sunDistance * Math.sin(phi) * Math.cos(theta);

    this.sunLight.position.set(x, y, z);
    this.sunLight.intensity = this.current.sunIntensity;
    this.sunLight.color.set(this.current.sunColor);

    // 2. Ambient / Hemisphere Light
    this.ambientLight.intensity = this.current.ambientIntensity;
    this.ambientLight.color.set(this.current.skyColor);
    this.ambientLight.groundColor.set(this.current.groundColor);

    // 3. Sky / Scene Background (Fog removed for crisp architectural clarity)
    if (this.scene) {
      if (this.scene.background && this.scene.background.isColor) {
        this.scene.background.set(this.current.skyColor);
      } else {
        this.scene.background = new THREE.Color(this.current.skyColor);
      }
      this.scene.fog = null;
    }

    // 4. Renderer Tone Mapping Exposure
    if (this.renderer) {
      this.renderer.toneMappingExposure = this.current.exposure;
    }

    // 5. City & Models Emissive Glow
    if (this.app.city) {
      const mode = this.current.elevation < 20 ? (this.current.elevation < 8 ? 'night' : 'sunset') : 'day';
      if (this.app.city.setLightingMode) {
        this.app.city.setLightingMode(mode);
      }
      if (this.app.city.setEmissiveIntensity) {
        this.app.city.setEmissiveIntensity(this.current.emissiveIntensity, this.current.emissiveColor);
      }
    }

    if (this.app.modelManager && this.app.city && this.app.city.customBuildingInstances) {
      const mode = this.current.elevation < 20 ? (this.current.elevation < 8 ? 'night' : 'sunset') : 'day';
      this.app.city.customBuildingInstances.forEach(inst => {
        this.app.modelManager.applyLightingToModel(
          inst,
          mode,
          this.current.emissiveIntensity,
          this.current.emissiveColor
        );
      });
    }

    this.notifyListeners();
  }

  applyPreset(presetKey) {
    if (!this.presets[presetKey]) return;
    this.current = { ...this.presets[presetKey] };
    this.syncUI();
    this.applyCurrentLighting();
  }

  /**
   * Set continuous time of day (0.0 to 24.0)
   */
  setTimeOfDay(hours) {
    this.current.time = ((hours % 24) + 24) % 24;

    // Smoothly calculate sun elevation & azimuth
    const t = this.current.time;
    if (t >= 5 && t <= 20) {
      // Daylight / Dusk
      const dayProgress = (t - 5) / 15; // 0 to 1
      this.current.azimuth = 70 + dayProgress * 200; // 70 to 270
      this.current.elevation = Math.sin(dayProgress * Math.PI) * 75; // 0 -> 75 -> 0
    } else {
      // Night / Moon
      const nightProgress = t > 20 ? (t - 20) / 9 : (t + 4) / 9; // 0 to 1
      this.current.azimuth = 270 + nightProgress * 160;
      this.current.elevation = Math.sin(nightProgress * Math.PI) * 35;
    }

    // Blend colors based on sun elevation
    if (this.current.elevation > 30) {
      // High day
      this.current.skyColor = '#dbeafe';
      this.current.sunColor = '#fffbeb';
      this.current.sunIntensity = 2.4;
      this.current.ambientIntensity = 0.9;
      this.current.emissiveIntensity = 0.0;
    } else if (this.current.elevation > 6) {
      // Golden Hour
      this.current.skyColor = '#fdba74';
      this.current.sunColor = '#f97316';
      this.current.sunIntensity = 3.0;
      this.current.ambientIntensity = 1.05;
      this.current.emissiveIntensity = 0.6;
    } else {
      // Night
      this.current.skyColor = '#090d16';
      this.current.sunColor = '#60a5fa';
      this.current.sunIntensity = 0.8;
      this.current.ambientIntensity = 0.6;
      this.current.emissiveIntensity = 2.8;
    }

    this.syncUI();
    this.applyCurrentLighting();
  }

  update(delta) {
    if (this.isCycleRunning) {
      const hoursAdvance = (delta / 8) * this.cycleSpeed;
      this.setTimeOfDay(this.current.time + hoursAdvance);
    }
  }

  toggleDayNightCycle() {
    this.isCycleRunning = !this.isCycleRunning;
    const btn = document.getElementById('btn-light-playcycle');
    if (btn) {
      btn.innerHTML = this.isCycleRunning ? '⏸ Pause Cycle' : '▶ Play 24h Cycle';
      btn.classList.toggle('active', this.isCycleRunning);
    }
  }

  onLightingChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    for (const cb of this.listeners) {
      try { cb(this.current); } catch (e) { console.error(e); }
    }
  }

  /**
   * Initialize Lighting Controls DOM
   */
  initUI() {
    // Check if lighting drawer already exists
    let panel = document.getElementById('lighting-studio-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'lighting-studio-panel';
      panel.className = 'glass-panel lighting-drawer';
      panel.innerHTML = `
        <div class="lighting-panel-header">
          <div class="panel-title">
            <span class="lighting-dot"></span>
            <span>💡 Lighting Studio & Atmosphere</span>
          </div>
          <button id="btn-close-lighting-panel" class="icon-close-btn" title="Close Panel">✕</button>
        </div>

        <!-- Quick Atmospheric Presets -->
        <div class="light-section">
          <div class="section-label">Presets</div>
          <div class="light-preset-row">
            <button class="light-pill-btn active" data-preset="day">☀️ Day</button>
            <button class="light-pill-btn" data-preset="sunset">🌅 Sunset</button>
            <button class="light-pill-btn" data-preset="night">🌙 Night</button>
            <button class="light-pill-btn" data-preset="overcast">⛅ Overcast</button>
            <button class="light-pill-btn" data-preset="dawn">🌄 Dawn</button>
          </div>
        </div>

        <!-- 24-Hour Interactive Timeline -->
        <div class="light-section">
          <div class="section-label-split">
            <span>24-Hour Time of Day</span>
            <span id="lbl-light-clock" class="mono-badge">12:00 PM</span>
          </div>
          <div class="slider-row">
            <input type="range" id="slider-light-time" min="0" max="24" step="0.1" value="12" />
          </div>
          <div class="timeline-actions">
            <button id="btn-light-playcycle" class="btn-subtle">▶ Play 24h Cycle</button>
            <div class="cycle-speed-wrap">
              <span style="font-size: 10px; color: #94a3b8;">Speed:</span>
              <button class="speed-pill active" data-speed="1">1x</button>
              <button class="speed-pill" data-speed="2.5">2.5x</button>
              <button class="speed-pill" data-speed="5">5x</button>
            </div>
          </div>
        </div>

        <!-- Sun & Shadows -->
        <div class="light-section">
          <div class="section-label">Sun & Shadows</div>
          
          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Sun Elevation (Altitude)</span>
              <span id="lbl-sun-elevation" class="mono-val">65°</span>
            </div>
            <input type="range" id="slider-sun-elevation" min="0" max="90" step="1" value="65" />
          </div>

          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Sun Azimuth (Rotation)</span>
              <span id="lbl-sun-azimuth" class="mono-val">145°</span>
            </div>
            <input type="range" id="slider-sun-azimuth" min="0" max="360" step="1" value="145" />
          </div>

          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Sun Intensity</span>
              <span id="lbl-sun-intensity" class="mono-val">2.4x</span>
            </div>
            <input type="range" id="slider-sun-intensity" min="0.0" max="5.0" step="0.1" value="2.4" />
          </div>

          <div class="color-picker-row">
            <label for="color-sun">Sun Tint:</label>
            <input type="color" id="color-sun" value="#fffbeb" />
            <label style="margin-left: 12px;">Cast Shadows:</label>
            <input type="checkbox" id="chk-sun-shadows" checked />
          </div>
        </div>

        <!-- Ambient & Sky -->
        <div class="light-section">
          <div class="section-label">Ambient Skylight & Fog</div>
          
          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Ambient Intensity</span>
              <span id="lbl-ambient-intensity" class="mono-val">0.9x</span>
            </div>
            <input type="range" id="slider-ambient-intensity" min="0.0" max="3.0" step="0.1" value="0.9" />
          </div>

          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Camera Exposure</span>
              <span id="lbl-scene-exposure" class="mono-val">1.05</span>
            </div>
            <input type="range" id="slider-scene-exposure" min="0.2" max="2.5" step="0.05" value="1.05" />
          </div>

          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Shadow Softness / Quality</span>
            </div>
            <div class="light-preset-row" id="light-shadow-pills" style="grid-template-columns: 1fr 1fr 1fr;">
              <button class="shadow-pill-btn" data-quality="off">Off</button>
              <button class="shadow-pill-btn active" data-quality="soft">Soft 2K</button>
              <button class="shadow-pill-btn" data-quality="high">High 4K</button>
            </div>
          </div>

          <div class="color-picker-row">
            <label for="color-sky">Sky Color:</label>
            <input type="color" id="color-sky" value="#dbeafe" />
            <label for="color-ground" style="margin-left: 12px;">Ground Tint:</label>
            <input type="color" id="color-ground" value="#334155" />
          </div>
        </div>

        <!-- City Emissive & Windows Glow -->
        <div class="light-section">
          <div class="section-label">Night Windows & Emissive Glow</div>
          <div class="ctrl-slider-group">
            <div class="ctrl-header">
              <span>Window Glow Intensity</span>
              <span id="lbl-emissive-intensity" class="mono-val">0.0x</span>
            </div>
            <input type="range" id="slider-emissive-intensity" min="0.0" max="5.0" step="0.1" value="0.0" />
          </div>
          <div class="color-picker-row">
            <label for="color-emissive">Window Color:</label>
            <input type="color" id="color-emissive" value="#fef08a" />
          </div>
        </div>
      `;
      document.body.appendChild(panel);
    }
    this.panelElement = panel;
    this.bindEvents();
  }

  bindEvents() {
    const p = this.panelElement;
    if (!p) return;

    // Close button
    const btnClose = p.querySelector('#btn-close-lighting-panel');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.togglePanel(false));
    }

    // Presets
    p.querySelectorAll('.light-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        p.querySelectorAll('.light-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyPreset(btn.dataset.preset);
      });
    });

    // Time of day slider
    const sliderTime = p.querySelector('#slider-light-time');
    if (sliderTime) {
      sliderTime.addEventListener('input', (e) => {
        this.setTimeOfDay(parseFloat(e.target.value));
      });
    }

    // Play/Pause cycle
    const btnPlayCycle = p.querySelector('#btn-light-playcycle');
    if (btnPlayCycle) {
      btnPlayCycle.addEventListener('click', () => this.toggleDayNightCycle());
    }

    // Speed buttons
    p.querySelectorAll('.speed-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        p.querySelectorAll('.speed-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cycleSpeed = parseFloat(btn.dataset.speed);
      });
    });

    // Sun sliders
    const sliderElevation = p.querySelector('#slider-sun-elevation');
    const lblElevation = p.querySelector('#lbl-sun-elevation');
    if (sliderElevation) {
      sliderElevation.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.elevation = val;
        if (lblElevation) lblElevation.textContent = `${val.toFixed(0)}°`;
        this.applyCurrentLighting();
      });
    }

    const sliderAzimuth = p.querySelector('#slider-sun-azimuth');
    const lblAzimuth = p.querySelector('#lbl-sun-azimuth');
    if (sliderAzimuth) {
      sliderAzimuth.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.azimuth = val;
        if (lblAzimuth) lblAzimuth.textContent = `${val.toFixed(0)}°`;
        this.applyCurrentLighting();
      });
    }

    const sliderSunInt = p.querySelector('#slider-sun-intensity');
    const lblSunInt = p.querySelector('#lbl-sun-intensity');
    if (sliderSunInt) {
      sliderSunInt.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.sunIntensity = val;
        if (lblSunInt) lblSunInt.textContent = `${val.toFixed(1)}x`;
        this.applyCurrentLighting();
      });
    }

    const colorSun = p.querySelector('#color-sun');
    if (colorSun) {
      colorSun.addEventListener('input', (e) => {
        this.current.sunColor = e.target.value;
        this.applyCurrentLighting();
      });
    }

    const chkShadows = p.querySelector('#chk-sun-shadows');
    if (chkShadows) {
      chkShadows.addEventListener('change', (e) => {
        if (this.sunLight) this.sunLight.castShadow = e.target.checked;
      });
    }

    // Ambient sliders
    const sliderAmbInt = p.querySelector('#slider-ambient-intensity');
    const lblAmbInt = p.querySelector('#lbl-ambient-intensity');
    if (sliderAmbInt) {
      sliderAmbInt.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.ambientIntensity = val;
        if (lblAmbInt) lblAmbInt.textContent = `${val.toFixed(1)}x`;
        this.applyCurrentLighting();
      });
    }

    const sliderExposure = p.querySelector('#slider-scene-exposure');
    const lblExposure = p.querySelector('#lbl-scene-exposure');
    if (sliderExposure) {
      sliderExposure.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.exposure = val;
        if (lblExposure) lblExposure.textContent = val.toFixed(2);
        this.applyCurrentLighting();
      });
    }

    // Shadow quality buttons in lighting panel
    p.querySelectorAll('#light-shadow-pills .shadow-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        p.querySelectorAll('#light-shadow-pills .shadow-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.app.setShadowQuality) {
          this.app.setShadowQuality(btn.dataset.quality);
        }
      });
    });

    const colorSky = p.querySelector('#color-sky');
    if (colorSky) {
      colorSky.addEventListener('input', (e) => {
        this.current.skyColor = e.target.value;
        this.applyCurrentLighting();
      });
    }

    const colorGround = p.querySelector('#color-ground');
    if (colorGround) {
      colorGround.addEventListener('input', (e) => {
        this.current.groundColor = e.target.value;
        this.applyCurrentLighting();
      });
    }

    // Emissive
    const sliderEmissive = p.querySelector('#slider-emissive-intensity');
    const lblEmissive = p.querySelector('#lbl-emissive-intensity');
    if (sliderEmissive) {
      sliderEmissive.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.current.emissiveIntensity = val;
        if (lblEmissive) lblEmissive.textContent = `${val.toFixed(1)}x`;
        this.applyCurrentLighting();
      });
    }

    const colorEmissive = p.querySelector('#color-emissive');
    if (colorEmissive) {
      colorEmissive.addEventListener('input', (e) => {
        this.current.emissiveColor = e.target.value;
        this.applyCurrentLighting();
      });
    }
  }

  syncUI() {
    const p = this.panelElement;
    if (!p) return;

    // Time & Clock format
    const sTime = p.querySelector('#slider-light-time');
    const lClock = p.querySelector('#lbl-light-clock');
    if (sTime) sTime.value = this.current.time;
    if (lClock) {
      const h = Math.floor(this.current.time);
      const m = Math.floor((this.current.time - h) * 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      lClock.textContent = `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    // Sun values
    const sElev = p.querySelector('#slider-sun-elevation');
    const lElev = p.querySelector('#lbl-sun-elevation');
    if (sElev) sElev.value = this.current.elevation;
    if (lElev) lElev.textContent = `${this.current.elevation.toFixed(0)}°`;

    const sAzim = p.querySelector('#slider-sun-azimuth');
    const lAzim = p.querySelector('#lbl-sun-azimuth');
    if (sAzim) sAzim.value = this.current.azimuth;
    if (lAzim) lAzim.textContent = `${this.current.azimuth.toFixed(0)}°`;

    const sSunInt = p.querySelector('#slider-sun-intensity');
    const lSunInt = p.querySelector('#lbl-sun-intensity');
    if (sSunInt) sSunInt.value = this.current.sunIntensity;
    if (lSunInt) lSunInt.textContent = `${this.current.sunIntensity.toFixed(1)}x`;

    const cSun = p.querySelector('#color-sun');
    if (cSun && this.current.sunColor.startsWith('#')) cSun.value = this.current.sunColor;

    // Ambient
    const sAmb = p.querySelector('#slider-ambient-intensity');
    const lAmb = p.querySelector('#lbl-ambient-intensity');
    if (sAmb) sAmb.value = this.current.ambientIntensity;
    if (lAmb) lAmb.textContent = `${this.current.ambientIntensity.toFixed(1)}x`;

    const sExp = p.querySelector('#slider-scene-exposure');
    const lExp = p.querySelector('#lbl-scene-exposure');
    if (sExp) sExp.value = this.current.exposure;
    if (lExp) lExp.textContent = this.current.exposure.toFixed(2);

    const cSky = p.querySelector('#color-sky');
    if (cSky && this.current.skyColor.startsWith('#')) cSky.value = this.current.skyColor;

    const cGnd = p.querySelector('#color-ground');
    if (cGnd && this.current.groundColor.startsWith('#')) cGnd.value = this.current.groundColor;

    // Emissive
    const sEmi = p.querySelector('#slider-emissive-intensity');
    const lEmi = p.querySelector('#lbl-emissive-intensity');
    if (sEmi) sEmi.value = this.current.emissiveIntensity;
    if (lEmi) lEmi.textContent = `${this.current.emissiveIntensity.toFixed(1)}x`;
  }

  togglePanel(forceState = null) {
    if (!this.panelElement) return;
    const isVisible = forceState !== null ? forceState : !this.panelElement.classList.contains('open');
    this.panelElement.classList.toggle('open', isVisible);

    const toggleBtn = document.getElementById('btn-nav-lighting');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isVisible);
    }
  }
}
