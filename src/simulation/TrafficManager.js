import * as THREE from 'three';
import { CarModelFactory } from '../models/CarModelFactory.js';

export class TrafficManager {
  constructor(scene, cityGenerator) {
    this.scene = scene;
    this.city = cityGenerator;

    this.vehicles = [];
    this.maxCount = 5000;
    this.activeCount = 300;
    this.currentVehicleType = 'sedan';

    this.group = new THREE.Group();
    this.group.name = 'TrafficSimulation';
    this.scene.add(this.group);

    this.palette = [
      new THREE.Color('#e11d48'), // Crimson
      new THREE.Color('#2563eb'), // Royal Blue
      new THREE.Color('#475569'), // Slate
      new THREE.Color('#f8fafc'), // Pearl White
      new THREE.Color('#0f172a'), // Black
      new THREE.Color('#eab308'), // Taxi Yellow
      new THREE.Color('#059669'), // Emerald
      new THREE.Color('#ea580c'), // Burnt Orange
      new THREE.Color('#8b5cf6')  // Purple
    ];

    this.dummy = new THREE.Object3D();
    this.carGeometry = this.createCarGeometry(this.currentVehicleType);
    this.carMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.7
    });

    this.instancedMesh = null;
    this.initPool();
  }

  createCarGeometry(type = 'sedan') {
    return CarModelFactory.createTrafficGeometry(type);
  }

  /**
   * Switch the entire traffic fleet geometry to a new vehicle type
   * @param {string} type - 'sedan' | 'sports' | 'suv' | 'truck' | 'van'
   */
  setVehicleType(type = 'sedan') {
    this.currentVehicleType = type;
    const newGeo = this.createCarGeometry(type);
    if (this.instancedMesh) {
      const oldGeo = this.instancedMesh.geometry;
      this.instancedMesh.geometry = newGeo;
      if (oldGeo && oldGeo !== newGeo) {
        oldGeo.dispose();
      }
      this.carGeometry = newGeo;
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Set custom car geometry (e.g. from imported GLB/OBJ)
   */
  setCustomGeometry(geometry) {
    if (!geometry || !this.instancedMesh) return;
    this.currentVehicleType = 'custom';
    const oldGeo = this.instancedMesh.geometry;
    this.instancedMesh.geometry = geometry;
    if (oldGeo && oldGeo !== geometry) {
      oldGeo.dispose();
    }
    this.carGeometry = geometry;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  initPool() {
    this.clear();

    const maxAlloc = Math.max(this.maxCount, this.activeCount);
    this.instancedMesh = new THREE.InstancedMesh(this.carGeometry, this.carMaterial, maxAlloc);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.group.add(this.instancedMesh);

    this.vehicles = [];
    const lanes = this.city.roadLanes;
    const hasLanes = lanes && lanes.length > 0;

    for (let i = 0; i < maxAlloc; i++) {
      let laneIndex = hasLanes ? Math.floor(Math.random() * lanes.length) : 0;
      let lane = hasLanes ? lanes[laneIndex] : null;

      let pos = new THREE.Vector3();
      let rotY = 0;
      let dir = new THREE.Vector3(0, 0, 1);
      let laneLength = 500;

      if (lane) {
        dir.copy(lane.direction);
        rotY = Math.atan2(dir.x, dir.z);
        laneLength = lane.start.distanceTo(lane.end);
        // Distribute along lane
        const t = Math.random();
        pos.lerpVectors(lane.start, lane.end, t);
      } else {
        pos.set((Math.random() - 0.5) * 300, 0.1, (Math.random() - 0.5) * 300);
      }

      const speed = 10 + Math.random() * 8; // 10 - 18 m/s (36 - 65 km/h)
      const color = this.palette[Math.floor(Math.random() * this.palette.length)];
      this.instancedMesh.setColorAt(i, color);

      this.vehicles.push({
        id: i,
        pos: pos,
        laneIndex: laneIndex,
        dir: dir,
        rotY: rotY,
        speed: speed,
        baseSpeed: speed,
        color: color,
        active: i < this.activeCount
      });

      this.updateCarMatrix(i);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.count = this.activeCount;
  }

  setCount(count) {
    this.activeCount = Math.min(count, this.maxCount);
    for (let i = 0; i < this.vehicles.length; i++) {
      this.vehicles[i].active = i < this.activeCount;
    }
    if (this.instancedMesh) {
      this.instancedMesh.count = this.activeCount;
    }
  }

  update(delta) {
    const lanes = this.city.roadLanes;
    const hasLanes = lanes && lanes.length > 0;
    const count = this.activeCount;

    for (let i = 0; i < count; i++) {
      const v = this.vehicles[i];
      if (!v.active) continue;

      if (hasLanes) {
        const lane = lanes[v.laneIndex];
        v.pos.x += lane.direction.x * v.speed * delta;
        v.pos.z += lane.direction.z * v.speed * delta;

        // Check if car reached lane end
        const distToEnd = v.pos.distanceTo(lane.end);
        if (distToEnd < 6.0) {
          // Either loop back or change to intersecting lane
          if (Math.random() > 0.4) {
            // Respawn at lane start
            v.pos.copy(lane.start);
          } else {
            // Find another lane
            const newLaneIdx = Math.floor(Math.random() * lanes.length);
            v.laneIndex = newLaneIdx;
            const newLane = lanes[newLaneIdx];
            v.dir.copy(newLane.direction);
            v.rotY = Math.atan2(v.dir.x, v.dir.z);
            v.pos.copy(newLane.start);
          }
        }
      } else {
        v.pos.z += v.speed * delta;
        if (v.pos.z > 300) v.pos.z = -300;
      }

      this.updateCarMatrix(i);
    }

    if (this.instancedMesh) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  updateCarMatrix(i) {
    const v = this.vehicles[i];
    this.dummy.position.copy(v.pos);
    this.dummy.rotation.set(0, v.rotY, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
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
    if (this.instancedMesh) {
      this.group.remove(this.instancedMesh);
      this.instancedMesh.dispose();
      this.instancedMesh = null;
    }
  }
}
