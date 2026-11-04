import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const GLB_CAR_DEFS = [
  { id: 'car1', name: 'Phantom Cruiser (Car 1)', file: '/models/Car1.glb', targetLength: 4.5, icon: '🚗' },
  { id: 'car2', name: 'Apex GT Coupe (Car 2)', file: '/models/Car2.glb', targetLength: 4.5, icon: '🏎️' },
  { id: 'car3', name: 'Vanguard SUV (Car 3)', file: '/models/Car3.glb', targetLength: 5.1, icon: '🚙' },
  { id: 'car4', name: 'Atlas CyberTruck (Car 4)', file: '/models/Car4.glb', targetLength: 5.1, icon: '🛻' },
  { id: 'car5', name: 'Velocity Sport (Car 5)', file: '/models/Car5.glb', targetLength: 4.5, icon: '🏎️' }
];

export class TrafficManager {
  constructor(scene, cityGenerator) {
    this.scene = scene;
    this.city = cityGenerator;

    this.vehicles = [];
    this.maxCount = 5000;
    this.activeCount = 300;
    this.currentVehicleType = 'mixed'; // 'mixed' | 'car1' | 'car2' | 'car3' | 'car4' | 'car5'
    this.carScale = 1.0;

    this.group = new THREE.Group();
    this.group.name = 'TrafficSimulation';
    this.scene.add(this.group);

    this.dummy = new THREE.Object3D();
    this.gltfLoader = new GLTFLoader();

    this.carTemplates = []; // [{ id, name, icon, primitives: [{ geometry, material }], instancedMeshes: [] }]
    this.isGlbLoaded = false;

    this.palette = [
      new THREE.Color('#e11d48'),
      new THREE.Color('#2563eb'),
      new THREE.Color('#475569'),
      new THREE.Color('#f8fafc'),
      new THREE.Color('#0f172a'),
      new THREE.Color('#eab308'),
      new THREE.Color('#059669'),
      new THREE.Color('#ea580c'),
      new THREE.Color('#8b5cf6')
    ];

    this.initVehiclesState();

    // Asynchronously load the 5 GLB cars and build authentic 3D traffic meshes
    this.loadGlbCars();
  }

  initVehiclesState() {
    this.vehicles = [];
    const maxAlloc = Math.max(this.maxCount, this.activeCount);
    const lanes = this.city.roadLanes;
    const hasLanes = lanes && lanes.length > 0;

    for (let i = 0; i < maxAlloc; i++) {
      let laneIndex = hasLanes ? Math.floor(Math.random() * lanes.length) : 0;
      let lane = hasLanes ? lanes[laneIndex] : null;

      let pos = new THREE.Vector3();
      let rotY = 0;
      let dir = new THREE.Vector3(0, 0, 1);

      if (lane) {
        dir.copy(lane.direction);
        rotY = Math.atan2(dir.x, dir.z);
        const t = Math.random();
        pos.lerpVectors(lane.start, lane.end, t);
      } else {
        pos.set(0, -999, 0); // Hide off-world if lanes not ready yet
      }

      const speed = 10 + Math.random() * 8; // 36 - 65 km/h
      const color = this.palette[i % this.palette.length];

      this.vehicles.push({
        id: i,
        pos: pos,
        laneIndex: laneIndex,
        dir: dir,
        rotY: rotY,
        speed: speed,
        baseSpeed: speed,
        color: color,
        active: i < this.activeCount,
        activeTemplateIdx: 0,
        localInstanceIdx: 0,
        carName: 'Car 1'
      });
    }
  }

  async loadGlbCars() {
    try {
      const results = await Promise.all(GLB_CAR_DEFS.map(def => this.loadSingleCar(def)));
      this.carTemplates = results;
      this.isGlbLoaded = true;

      // Transition to authentic GLB instanced meshes
      this.rebuildInstancedMeshes();
      console.log('✅ Loaded and initialized all 5 GLB cars into traffic simulation!');
    } catch (err) {
      console.warn('Could not load all GLB cars for traffic:', err);
    }
  }

  loadSingleCar(def) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        def.file,
        (gltf) => {
          const rawScene = gltf.scene || gltf.scenes[0];

          // Compute exact bounding box of the whole model
          const box = new THREE.Box3().setFromObject(rawScene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const minY = box.min.y;

          // Scale so length matches realistic target (4.5m - 5.1m)
          const scale = def.targetLength / (size.z || 18.0);

          const primitives = [];
          rawScene.traverse((child) => {
            if (child.isMesh && child.geometry) {
              const geo = child.geometry.clone();
              // Bake centering, grounding (wheels at y=0), and real-world scale into geometry
              geo.translate(-center.x, -minY, -center.z);
              geo.scale(scale, scale, scale);
              geo.computeVertexNormals();

              let mat = child.material.clone();
              mat.side = THREE.DoubleSide;
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }

              primitives.push({
                geometry: geo,
                material: mat,
                name: child.name
              });
            }
          });

          resolve({
            id: def.id,
            name: def.name,
            icon: def.icon,
            primitives: primitives,
            instancedMeshes: []
          });
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  rebuildInstancedMeshes() {
    // 1. Wipe out any previous meshes to guarantee no standing dummy cars
    this.clear();

    if (!this.isGlbLoaded || !this.carTemplates || this.carTemplates.length === 0) {
      return;
    }

    // 2. Build instanced meshes for each primitive of each of the 5 car templates
    const maxAlloc = Math.max(this.maxCount, this.activeCount);

    for (const tpl of this.carTemplates) {
      for (const prim of tpl.primitives) {
        const instMesh = new THREE.InstancedMesh(prim.geometry, prim.material, maxAlloc);
        instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instMesh.castShadow = true;
        instMesh.receiveShadow = true;
        instMesh.count = 0; // Starts at 0 until instances are positioned
        instMesh.userData = {
          isTrafficCar: true,
          carId: tpl.id,
          carName: tpl.name
        };
        this.group.add(instMesh);
        tpl.instancedMeshes.push(instMesh);
      }
    }

    // 3. Update initial positions
    this.update(0);
  }

  setCarScale(scale) {
    this.carScale = Math.max(0.2, Math.min(5.0, parseFloat(scale) || 1.0));
    if (this.isGlbLoaded) {
      this.update(0);
    }
  }

  setVehicleType(type = 'mixed') {
    this.currentVehicleType = type;
    if (this.isGlbLoaded) {
      this.update(0);
    }
  }

  setCount(count) {
    this.activeCount = Math.min(count, this.maxCount);
    for (let i = 0; i < this.vehicles.length; i++) {
      this.vehicles[i].active = i < this.activeCount;
    }
    if (this.isGlbLoaded) {
      this.update(0);
    }
  }

  update(delta) {
    if (!this.isGlbLoaded || !this.carTemplates || this.carTemplates.length === 0) {
      return;
    }

    const lanes = this.city.roadLanes;
    const hasLanes = lanes && lanes.length > 0;
    const count = this.activeCount;

    // Instance count trackers for each of the 5 car templates
    const tplCounts = this.carTemplates.map(() => 0);

    for (let i = 0; i < count; i++) {
      const v = this.vehicles[i];
      if (!v.active) continue;

      if (delta > 0) {
        if (hasLanes) {
          const lane = lanes[v.laneIndex];
          if (lane) {
            v.pos.x += lane.direction.x * v.speed * delta;
            v.pos.z += lane.direction.z * v.speed * delta;

            // Check if car reached lane end
            const distToEnd = v.pos.distanceTo(lane.end);
            if (distToEnd < 6.0) {
              if (Math.random() > 0.4) {
                v.pos.copy(lane.start);
              } else {
                const newLaneIdx = Math.floor(Math.random() * lanes.length);
                v.laneIndex = newLaneIdx;
                const newLane = lanes[newLaneIdx];
                if (newLane) {
                  v.dir.copy(newLane.direction);
                  v.rotY = Math.atan2(v.dir.x, v.dir.z);
                  v.pos.copy(newLane.start);
                }
              }
            }
          }
        } else {
          v.pos.z += v.speed * delta;
          if (v.pos.z > 300) v.pos.z = -300;
        }
      }

      // Choose car model: 'mixed' (alternates Car 1 to 5) or specific 'car1'...'car5'
      let tplIdx = 0;
      if (this.currentVehicleType === 'mixed') {
        tplIdx = v.id % this.carTemplates.length;
      } else if (this.currentVehicleType.startsWith('car')) {
        const num = parseInt(this.currentVehicleType.replace('car', ''), 10) - 1;
        tplIdx = (num >= 0 && num < this.carTemplates.length) ? num : 0;
      }

      const tpl = this.carTemplates[tplIdx];
      const localIdx = tplCounts[tplIdx]++;
      v.activeTemplateIdx = tplIdx;
      v.localInstanceIdx = localIdx;
      v.carName = tpl.name;

      this.dummy.position.copy(v.pos);
      this.dummy.rotation.set(0, v.rotY, 0);
      this.dummy.scale.set(this.carScale, this.carScale, this.carScale);
      this.dummy.updateMatrix();

      for (let m = 0; m < tpl.instancedMeshes.length; m++) {
        tpl.instancedMeshes[m].setMatrixAt(localIdx, this.dummy.matrix);
      }
    }

    // Flush updates to GPU and set visible instance counts
    for (let c = 0; c < this.carTemplates.length; c++) {
      const tpl = this.carTemplates[c];
      const cCount = tplCounts[c] || 0;
      if (tpl.instancedMeshes) {
        for (let m = 0; m < tpl.instancedMeshes.length; m++) {
          const mesh = tpl.instancedMeshes[m];
          mesh.count = cCount;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }

  getRaycastTargets() {
    const targets = [];
    if (this.isGlbLoaded && this.carTemplates) {
      for (const tpl of this.carTemplates) {
        if (tpl.instancedMeshes) {
          for (const m of tpl.instancedMeshes) {
            if (m.count > 0) targets.push(m);
          }
        }
      }
    }
    return targets;
  }

  getVehicleFromHit(mesh, instanceId) {
    if (!this.isGlbLoaded || !this.carTemplates) {
      return this.getVehicle(instanceId);
    }

    // Find which vehicle corresponds to this template & local instance index
    for (let i = 0; i < this.activeCount; i++) {
      const v = this.vehicles[i];
      if (v.localInstanceIdx === instanceId) {
        const tpl = this.carTemplates[v.activeTemplateIdx];
        if (tpl && tpl.instancedMeshes.includes(mesh)) {
          return v;
        }
      }
    }
    return this.vehicles[instanceId] || null;
  }

  getVehicle(index) {
    if (index >= 0 && index < this.vehicles.length) {
      return this.vehicles[index];
    }
    return null;
  }

  getRandomActive() {
    if (this.activeCount === 0) return null;
    const idx = Math.floor(Math.random() * this.activeCount);
    return this.vehicles[idx];
  }

  clear() {
    // Thoroughly remove and dispose all instanced meshes from this.group
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      if (obj.dispose) obj.dispose();
    }
    if (this.carTemplates) {
      for (const tpl of this.carTemplates) {
        tpl.instancedMeshes = [];
      }
    }
  }
}
