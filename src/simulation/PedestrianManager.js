import * as THREE from 'three';

export class PedestrianManager {
  constructor(scene, cityGenerator) {
    this.scene = scene;
    this.city = cityGenerator;

    this.pedestrians = [];
    this.maxCount = 25000;
    this.activeCount = 1500;
    this.mode = 'instanced'; // 'instanced' or 'stress-calls'

    this.group = new THREE.Group();
    this.group.name = 'PedestrianSimulation';
    this.scene.add(this.group);

    // Human Geometry: stylized low-poly figure
    // Base height ~ 1.8m
    this.humanGeometry = this.createHumanGeometry();
    this.humanMaterial = this.createHumanMaterial();

    this.instancedMesh = null;
    this.individualMeshes = [];

    // Color palette for casual pedestrians
    this.palette = [
      new THREE.Color('#3b82f6'), // Blue
      new THREE.Color('#ef4444'), // Red
      new THREE.Color('#10b981'), // Green
      new THREE.Color('#f59e0b'), // Amber
      new THREE.Color('#8b5cf6'), // Purple
      new THREE.Color('#ec4899'), // Pink
      new THREE.Color('#f8fafc'), // White
      new THREE.Color('#1e293b'), // Charcoal
      new THREE.Color('#06b6d4'), // Cyan
      new THREE.Color('#f97316')  // Orange
    ];

    this.dummy = new THREE.Object3D();
    this.initPool();
  }

  createHumanGeometry() {
    // Stylized low-poly human: head + torso + legs combined
    // Total height = 1.8m
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.75, 0.3);
    torsoGeo.translate(0, 1.15, 0);

    const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35);
    headGeo.translate(0, 1.7, 0);

    const leftLegGeo = new THREE.BoxGeometry(0.2, 0.8, 0.22);
    leftLegGeo.translate(-0.14, 0.4, 0);

    const rightLegGeo = new THREE.BoxGeometry(0.2, 0.8, 0.22);
    rightLegGeo.translate(0.14, 0.4, 0);

    // Merge into single buffer geometry for instanced rendering
    const geo = new THREE.BufferGeometry();
    
    // We can merge using basic attributes
    const geos = [torsoGeo, headGeo, leftLegGeo, rightLegGeo];
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

    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    geo.computeVertexNormals();
    return geo;
  }

  createHumanMaterial() {
    return new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.1
    });
  }

  initPool() {
    this.clear();

    const maxAlloc = Math.max(this.maxCount, this.activeCount);
    this.instancedMesh = new THREE.InstancedMesh(this.humanGeometry, this.humanMaterial, maxAlloc);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = false;
    this.group.add(this.instancedMesh);

    // Generate pedestrian agents
    this.pedestrians = [];
    const waypoints = this.city.pedestrianWaypoints;
    const hasGraph = waypoints && waypoints.length > 0;

    for (let i = 0; i < maxAlloc; i++) {
      let pos = new THREE.Vector3();
      let targetNode = 0;

      if (hasGraph) {
        targetNode = Math.floor(Math.random() * waypoints.length);
        pos.copy(waypoints[targetNode]);
        // Slight sidewalk lane offset
        pos.x += (Math.random() - 0.5) * 1.8;
        pos.z += (Math.random() - 0.5) * 1.8;
      } else {
        pos.set((Math.random() - 0.5) * 300, 0.35, (Math.random() - 0.5) * 300);
      }

      const speed = 1.2 + Math.random() * 0.8; // 1.2 - 2.0 m/s
      const color = this.palette[Math.floor(Math.random() * this.palette.length)];
      this.instancedMesh.setColorAt(i, color);

      this.pedestrians.push({
        id: i,
        pos: pos,
        targetNode: targetNode,
        targetPos: new THREE.Vector3().copy(pos),
        speed: speed,
        rotY: Math.random() * Math.PI * 2,
        walkPhase: Math.random() * 10,
        color: color,
        active: i < this.activeCount
      });

      this.updateAgentMatrix(i);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.count = this.activeCount;
  }

  setCount(count) {
    this.activeCount = Math.min(count, this.maxCount);
    for (let i = 0; i < this.pedestrians.length; i++) {
      this.pedestrians[i].active = i < this.activeCount;
    }
    if (this.mode === 'instanced' && this.instancedMesh) {
      this.instancedMesh.count = this.activeCount;
    } else if (this.mode === 'stress-calls') {
      this.rebuildIndividualMeshes();
    }
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;

    if (this.mode === 'stress-calls') {
      // Hide instanced mesh and create individual meshes for draw-call stress testing
      if (this.instancedMesh) this.instancedMesh.visible = false;
      this.rebuildIndividualMeshes();
    } else {
      // Instanced mode
      this.clearIndividualMeshes();
      if (this.instancedMesh) {
        this.instancedMesh.visible = true;
        this.instancedMesh.count = this.activeCount;
      }
    }
  }

  rebuildIndividualMeshes() {
    this.clearIndividualMeshes();
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pedestrians[i];
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.7
      });
      const mesh = new THREE.Mesh(this.humanGeometry, mat);
      mesh.position.copy(p.pos);
      mesh.rotation.y = p.rotY;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.individualMeshes.push(mesh);
    }
  }

  clearIndividualMeshes() {
    for (const m of this.individualMeshes) {
      if (m.material) m.material.dispose();
      this.group.remove(m);
    }
    this.individualMeshes = [];
  }

  update(delta, time) {
    const waypoints = this.city.pedestrianWaypoints;
    const navGraph = this.city.navGraph;
    const hasGraph = waypoints && waypoints.length > 0 && navGraph;

    const count = this.activeCount;

    for (let i = 0; i < count; i++) {
      const p = this.pedestrians[i];
      if (!p.active) continue;

      // Waypoint navigation
      if (hasGraph) {
        const target = waypoints[p.targetNode];
        const dx = target.x - p.pos.x;
        const dz = target.z - p.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.5) {
          // Reached waypoint: pick connected neighbor
          const neighbors = navGraph[p.targetNode];
          if (neighbors && neighbors.length > 0) {
            p.targetNode = neighbors[Math.floor(Math.random() * neighbors.length)];
          } else {
            p.targetNode = Math.floor(Math.random() * waypoints.length);
          }
        } else {
          // Move toward target
          const angle = Math.atan2(dx, dz);
          p.rotY = angle;
          p.pos.x += Math.sin(angle) * p.speed * delta;
          p.pos.z += Math.cos(angle) * p.speed * delta;
        }
      } else {
        // Fallback random stroll
        p.pos.x += Math.sin(p.rotY) * p.speed * delta;
        p.pos.z += Math.cos(p.rotY) * p.speed * delta;
      }

      // Procedural walking stride bobbing
      p.walkPhase += delta * p.speed * 6;
      p.pos.y = 0.35 + Math.abs(Math.sin(p.walkPhase)) * 0.08;

      if (this.mode === 'instanced') {
        this.updateAgentMatrix(i);
      } else if (this.individualMeshes[i]) {
        const mesh = this.individualMeshes[i];
        mesh.position.copy(p.pos);
        mesh.rotation.y = p.rotY;
      }
    }

    if (this.mode === 'instanced' && this.instancedMesh) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  updateAgentMatrix(i) {
    const p = this.pedestrians[i];
    this.dummy.position.copy(p.pos);
    this.dummy.rotation.set(0, p.rotY, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
  }

  getPedestrian(index) {
    if (index >= 0 && index < this.pedestrians.length) {
      return this.pedestrians[index];
    }
    return null;
  }

  getRandomActive() {
    if (this.activeCount === 0) return null;
    const idx = Math.floor(Math.random() * this.activeCount);
    return this.pedestrians[idx];
  }

  clear() {
    if (this.instancedMesh) {
      this.group.remove(this.instancedMesh);
      this.instancedMesh.dispose();
      this.instancedMesh = null;
    }
    this.clearIndividualMeshes();
  }
}
