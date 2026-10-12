import * as THREE from 'three';

export class TrafficManager {
  constructor(scene, cityGenerator) {
    this.scene = scene;
    this.city = cityGenerator;

    this.vehicles = [];
    this.maxCount = 5000;
    this.activeCount = 300;

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
    this.carGeometry = this.createCarGeometry();
    this.carMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.7
    });

    this.instancedMesh = null;
    this.initPool();
  }

  createCarGeometry() {
    // Stylized modern car: Chassis + Cabin + Wheels + Lights
    const chassisGeo = new THREE.BoxGeometry(2.0, 0.7, 4.4);
    chassisGeo.translate(0, 0.55, 0);

    const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.3);
    cabinGeo.translate(0, 1.2, -0.2);

    // Front headlights
    const hlLeft = new THREE.BoxGeometry(0.3, 0.15, 0.1);
    hlLeft.translate(-0.7, 0.65, 2.2);

    const hlRight = new THREE.BoxGeometry(0.3, 0.15, 0.1);
    hlRight.translate(0.7, 0.65, 2.2);

    // Wheels (4 cylinders)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);

    const wFL = wheelGeo.clone(); wFL.translate(-0.95, 0.38, 1.3);
    const wFR = wheelGeo.clone(); wFR.translate(0.95, 0.38, 1.3);
    const wRL = wheelGeo.clone(); wRL.translate(-0.95, 0.38, -1.3);
    const wRR = wheelGeo.clone(); wRR.translate(0.95, 0.38, -1.3);

    const geos = [chassisGeo, cabinGeo, hlLeft, hlRight, wFL, wFR, wRL, wRR];
    let totalVerts = 0;
    geos.forEach(g => totalVerts += g.attributes.position.count);

    const posArray = new Float32Array(totalVerts * 3);
    const normArray = new Float32Array(totalVerts * 3);
    let offset = 0;

    geos.forEach(g => {
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      posArray.set(p, offset * 3);
      normArray.set(n, offset * 3);
      offset += g.attributes.position.count;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    geo.computeVertexNormals();
    return geo;
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
