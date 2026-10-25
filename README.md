# 🏙️ Three.js Procedural City Simulation & Stress Benchmark Suite

🌐 **Live Demo**: [https://threejs.phantasm.biz](https://threejs.phantasm.biz)

A high-performance, interactive 3D procedural metropolis inspired by architectural maps like [era.estate/3d-map](https://era.estate/3d-map). Built with **Three.js** and **Vite**, featuring procedural modern architecture, road systems, autonomous pedestrian walkers, driving traffic, dynamic camera presets, and a comprehensive real-time diagnostic and automated stress-testing suite for benchmarking across multiple PCs.

---

## 🚀 Quick Start

### 1. Installation & Run
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
# The application will be available at http://localhost:5173

# Or build for production
npm run build
npm run preview
```

---

## 🌟 Key Features

### 1. Procedural 3D Metropolis
- **Modern Architectural Variety**: Skyscraper mega-towers with antennas, helipads, mechanical penthouse units, twin towers connected by skybridges, stepped terraced blocks, and commercial mid-rises.
- **Urban Details**: Asphalt avenues with solid & dashed lane dividers, pedestrian zebra crossings, sidewalks, lush parks with trees, plazas, central canal/river, and streetlights.
- **Optimized Geometry Merging**: Building geometry is batched using `BufferGeometryUtils.mergeGeometries`, rendering an entire 6x6 or 12x12 city in **only ~25 draw calls**.
- **Time of Day Modes**:
  - ☀️ **Day**: Crisp sunlight, sky blue atmosphere, architectural reflections.
  - 🌅 **Sunset**: Warm golden hour tones with long shadows.
  - 🌙 **Night**: Midnight sky with glowing skyscraper window textures and illuminated streetlamps.

### 2. Pedestrian & Traffic Simulations
- **Pedestrian Simulation**:
  - Stylized low-poly pedestrian figures with colored clothing.
  - Procedural walking stride animations with path-following along sidewalks and crosswalks.
  - Rendered via `THREE.InstancedMesh` scaling from hundreds to **15,000+ pedestrians at 60 FPS**.
- **Traffic Simulation**:
  - Multi-lane road network with directional vehicle traffic (sedans, taxis, SUVs, buses).
  - Continuous lane driving, intersection turning, and collision avoidance.
  - Scalable from 50 to **3,000+ cars**.

### 3. Mouse Navigation & Interactive Camera Controls
- **MapControls Navigation**:
  - **Left Mouse Drag**: Orbit and rotate view.
  - **Right Mouse Drag / Middle Click**: Pan smoothly across the city.
  - **Scroll Wheel**: Smooth zoom in/out with ground clamp protection.
- **Camera Presets**:
  - 📐 **Isometric**: Classic elevated architectural isometric perspective.
  - 🚶 **Street**: Ground-level sidewalk viewpoint looking down the bustling avenue.
  - 🏢 **Rooftop**: High skyscraper vantage point overlooking traffic below.
  - 🛰️ **Top-Down**: Overhead satellite masterplan layout.
  - 🎬 **Tour**: Smooth cinematic orbit flying around the metropolis.
- **Target Tracking**:
  - Click any walking citizen or driving vehicle in the city to lock the camera to track and follow them!

### 4. 📦 3D Model Viewer & Assets Browser
- **Dedicated Model Viewer Tab**:
  - Switch between the **🏙️ City Simulation** and **📦 Model Viewer** via top tabs.
  - Automatically discovers and lists all 3D models in the `models/` directory (`.obj`, `.gltf`, `.glb`, `.fbx`).
  - **Drag & Drop / Local File Upload**: Drop any 3D asset directly onto the viewer.
  - **Inspection Modes**: Shaded (PBR), Wireframe, Clay Matte, and Surface Normals.
  - **Model Diagnostics**: Real-time polygon count, vertex count, mesh components, and physical dimensions.
  - **Interactive 3D Studio**: OrbitControls, camera auto-rotate, floor grid toggle, and "Fit to View".
  - **Use in City**: One-click action to inject and place the viewed model directly into the city simulation.

### 5. 🏢 Custom Building Model Integration (`Building_1.glb`)
- Loads and normalizes `models/Building_1.glb` with automatic pivot centering and ground alignment.
- Refined architectural materials with realistic glass reflectivity, metal trim, and night window glow.
- Integrates seamlessly onto city blocks with customizable density:
  - **Prominent**: Placed across prime city blocks.
  - **Landmark**: Placed as the central skyscraper monument.
  - **All Blocks**: Populates all blocks in the metropolis.
- **Focus Camera**: One-click camera button (`🏢 Building 1`) to smoothly fly to and frame the custom building.

### 6. 💡 Comprehensive Lighting Studio & Atmosphere
- **Floating Lighting Studio Drawer**: Interactive atmosphere and lighting controls.
- **24-Hour Timeline & Animated Cycle**: Continuous scrub slider with Play/Pause 24h cycle and speed options.
- **Sun Directional Controls**: Real-time Elevation (0°–90°), Azimuth rotation (0°–360°), and Sun intensity.
- **Skylight & Tone Mapping**: Ambient intensity, Sky tint, Ground tint, Fog density, and Camera exposure.
- **Night Window & Street Glow**: Adjustable emissive glow intensity and color for night city scenes.
- **Atmosphere Presets**: Daylight, Golden Hour Sunset, Cyber Night, Overcast Studio, and Sunrise Dawn.

### 7. Diagnostic Performance HUD & Stress Testing Suite
- **Real-Time Performance Monitor**:
  - Instant FPS, Average FPS, Minimum FPS, and **1% Low FPS**.
  - Frame time in milliseconds (ms) with a rolling canvas waveform graph.
  - Total rendered triangles / polygons count (`renderer.info.render.triangles`).
  - WebGL draw call counter (`renderer.info.render.calls`).
  - Active pedestrian and vehicle counters.
  - GPU hardware model and unmasked renderer detection.
- **Live Stress Testing Controls**:
  - **Pedestrian Slider**: 0 to 15,000+ pedestrians.
  - **Vehicle Slider**: 0 to 3,000+ vehicles.
  - **City Size**: Small (4x4), Medium (6x6), Large (8x8), Mega (12x12 blocks).
  - **Shadows**: Off, Soft (2048px), High Res (4096px).
  - **DPR Scaling**: 0.75x, 1.0x, 1.5x, 2.0x.
  - **Draw Mode Toggle**: Compare GPU `InstancedMesh` (25 draw calls) vs `Individual Meshes` (stressing draw calls).
- **Automated Multi-Phase Stress Test (Benchmark)**:
  - Click **⚡ RUN STRESS TEST** to execute an automated 25-second standardized benchmark.
  - Phase 1: Baseline load.
  - Phase 2: High-speed camera sweep (culling & vertex throughput).
  - Phase 3: Dynamic load ramp-up.
  - Phase 4: Maximum hardware saturation (12,000+ agents, 1.2M+ polygons).
  - Generates a **Scorecard Report Card** with score, avg FPS, 1% low, peak polygons, and hardware info.
  - Includes **📋 Copy Report** and **💾 Export JSON** buttons to test and compare performance across multiple PCs!
