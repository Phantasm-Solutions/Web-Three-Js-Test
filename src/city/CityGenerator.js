import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export class CityGenerator {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.gridSize = options.gridSize || 6; // default 6x6 blocks
    this.blockSize = 72; // size of buildable parcel
    this.sidewalkWidth = 4.5; // width of sidewalk
    this.roadWidth = 24; // width of roadway
    this.step = this.blockSize + (this.sidewalkWidth * 2) + this.roadWidth; // total block-to-block pitch ~105m

    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'ProceduralCity';
    this.scene.add(this.cityGroup);

    this.windowTexture = this.createWindowTexture();
    this.materials = this.createMaterials();
    this.pedestrianWaypoints = [];
    this.roadLanes = [];
    this.buildingBoxes = [];
    this.treePositions = [];
    this.streetLightPositions = [];
    this.stats = {
      buildingCount: 0,
      treeCount: 0,
      propCount: 0,
      totalPolys: 0
    };
  }

  createWindowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#242e3f';
    ctx.fillRect(0, 0, 256, 256);

    const cols = 8;
    const rows = 16;
    const w = 256 / cols;
    const h = 256 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLit = Math.random() > 0.45;
        ctx.fillStyle = isLit ? (Math.random() > 0.6 ? '#fef08a' : '#bae6fd') : '#111827';
        ctx.fillRect(c * w + 3, r * h + 3, w - 6, h - 6);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 10);
    return texture;
  }

  createMaterials() {
    // Architectural, modern materials
    return {
      asphalt: new THREE.MeshStandardMaterial({
        color: 0x22262c,
        roughness: 0.85,
        metalness: 0.1,
        name: 'mat_asphalt'
      }),
      roadMarkingWhite: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.5,
        metalness: 0.1,
        name: 'mat_marking_white'
      }),
      roadMarkingYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.6,
        metalness: 0.1,
        name: 'mat_marking_yellow'
      }),
      sidewalk: new THREE.MeshStandardMaterial({
        color: 0xd6d9dc,
        roughness: 0.9,
        metalness: 0.05,
        name: 'mat_sidewalk'
      }),
      curb: new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        roughness: 0.8,
        metalness: 0.1,
        name: 'mat_curb'
      }),
      concreteBase: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.7,
        metalness: 0.15,
        name: 'mat_concrete'
      }),
      facadeDark: new THREE.MeshStandardMaterial({
        color: 0x334155,
        map: this.windowTexture,
        roughness: 0.4,
        metalness: 0.4,
        name: 'mat_facade_dark'
      }),
      facadeWarm: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.8,
        metalness: 0.05,
        name: 'mat_facade_warm'
      }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        map: this.windowTexture,
        roughness: 0.2,
        metalness: 0.85,
        envMapIntensity: 1.2,
        name: 'mat_glass'
      }),
      glassNight: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        map: this.windowTexture,
        emissiveMap: this.windowTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.0, // toggled in night mode
        roughness: 0.2,
        metalness: 0.8,
        name: 'mat_glass_night'
      }),
      roofDark: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.9,
        metalness: 0.2,
        name: 'mat_roof'
      }),
      metalTrim: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.3,
        metalness: 0.8,
        name: 'mat_metal'
      }),
      grass: new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        roughness: 0.95,
        metalness: 0.0,
        name: 'mat_grass'
      }),
      water: new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.1,
        metalness: 0.8,
        name: 'mat_water'
      }),
      treeTrunk: new THREE.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.9,
        metalness: 0.0,
        name: 'mat_trunk'
      }),
      treeFoliage: new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.85,
        metalness: 0.05,
        name: 'mat_foliage'
      }),
      treeFoliageLight: new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.85,
        metalness: 0.05,
        name: 'mat_foliage_light'
      }),
      streetLampPole: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.4,
        metalness: 0.8,
        name: 'mat_pole'
      }),
      streetLampLight: new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xffaa44,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        name: 'mat_lamp_light'
      })
    };
  }

  generate(gridSize = null) {
    if (gridSize) this.gridSize = gridSize;
    this.clear();

    const half = (this.gridSize - 1) / 2;
    const geometries = {
      asphalt: [],
      roadMarkingWhite: [],
      roadMarkingYellow: [],
      sidewalk: [],
      concreteBase: [],
      facadeDark: [],
      facadeWarm: [],
      glass: [],
      roofDark: [],
      metalTrim: [],
      grass: [],
      water: [],
      treeTrunk: [],
      treeFoliage: [],
      treeFoliageLight: [],
      streetLampPole: [],
      streetLampLight: []
    };

    // Overall ground base
    const totalSpan = this.gridSize * this.step + 120;
    const baseGeo = new THREE.PlaneGeometry(totalSpan, totalSpan);
    baseGeo.rotateX(-Math.PI / 2);
    baseGeo.translate(0, -0.05, 0);
    geometries.asphalt.push(baseGeo);

    // River across the middle (if grid >= 4)
    const hasRiver = this.gridSize >= 4;
    const riverRow = Math.floor(this.gridSize / 2);
    const riverWidth = this.roadWidth * 1.5;
    const riverZ = (riverRow - half - 0.5) * this.step;

    if (hasRiver) {
      const riverGeo = new THREE.PlaneGeometry(totalSpan, riverWidth);
      riverGeo.rotateX(-Math.PI / 2);
      riverGeo.translate(0, -0.01, riverZ);
      geometries.water.push(riverGeo);
    }

    // Generate Blocks & Interstitial Roads
    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gz = 0; gz < this.gridSize; gz++) {
        const cx = (gx - half) * this.step;
        const cz = (gz - half) * this.step;

        // Check if block overlaps river
        const isRiverBlock = hasRiver && Math.abs(cz - riverZ) < (this.step * 0.4);

        if (!isRiverBlock) {
          // Generate Sidewalk & Block Perimeter
          this.buildBlockGround(cx, cz, geometries);

          // Generate Content inside block
          const isPark = (gx === 1 && gz === 1) || (gx === this.gridSize - 2 && gz === this.gridSize - 2);
          if (isPark) {
            this.buildParkBlock(cx, cz, geometries);
          } else {
            this.buildBuildingBlock(cx, cz, gx, gz, geometries);
          }

          // Generate Sidewalk nodes for pedestrians
          this.createSidewalkWaypointsForBlock(cx, cz);
        }

        // Generate streetlights around the block
        this.buildStreetLights(cx, cz, geometries);
      }
    }

    // Generate Road Markings and Crosswalks
    this.buildRoadNetwork(half, geometries, hasRiver, riverZ);

    // Merge Geometries for top-tier WebGL rendering performance
    for (const [key, geoArray] of Object.entries(geometries)) {
      if (geoArray.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geoArray, false);
        if (merged) {
          merged.computeBoundingSphere();
          const mesh = new THREE.Mesh(merged, this.materials[key]);
          mesh.castShadow = (key.includes('facade') || key.includes('concrete') || key.includes('roof') || key.includes('trunk') || key.includes('foliage'));
          mesh.receiveShadow = (key === 'asphalt' || key === 'sidewalk' || key === 'grass' || key.includes('facade') || key.includes('concrete'));
          this.cityGroup.add(mesh);
        }
      }
    }

    // Connect Pedestrian Crosswalks across intersections
    this.connectCrosswalks();

    // Setup Traffic Road Lanes
    this.setupTrafficLanes(half, hasRiver, riverZ);

    return this.stats;
  }

  buildBlockGround(cx, cz, geos) {
    const totalBlockSize = this.blockSize + this.sidewalkWidth * 2;
    // Sidewalk slab
    const slabGeo = new THREE.BoxGeometry(totalBlockSize, 0.3, totalBlockSize);
    slabGeo.translate(cx, 0.15, cz);
    geos.sidewalk.push(slabGeo);
  }

  buildParkBlock(cx, cz, geos) {
    const innerSize = this.blockSize;
    const grassGeo = new THREE.BoxGeometry(innerSize - 2, 0.35, innerSize - 2);
    grassGeo.translate(cx, 0.18, cz);
    geos.grass.push(grassGeo);

    // Central fountain / pool
    const poolGeo = new THREE.CylinderGeometry(10, 10, 0.4, 16);
    poolGeo.translate(cx, 0.22, cz);
    geos.concreteBase.push(poolGeo);

    const waterGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.45, 16);
    waterGeo.translate(cx, 0.25, cz);
    geos.water.push(waterGeo);

    // Trees in park
    const treeOffsets = [
      [-22, -22], [22, -22], [-22, 22], [22, 22],
      [-12, -24], [12, -24], [-12, 24], [12, 24],
      [-24, -12], [-24, 12], [24, -12], [24, 12]
    ];
    for (const [ox, oz] of treeOffsets) {
      this.addTree(cx + ox, cz + oz, geos);
    }
  }

  buildBuildingBlock(cx, cz, gx, gz, geos) {
    // Determine style based on location (Center = mega towers, Outer = mid-rises)
    const distFromCenter = Math.sqrt(Math.pow(gx - (this.gridSize - 1) / 2, 2) + Math.pow(gz - (this.gridSize - 1) / 2, 2));
    const isCenter = distFromCenter < 1.8;

    const blockType = Math.floor(Math.abs(Math.sin(gx * 12.9898 + gz * 78.233) * 100)) % 4;

    if (isCenter || blockType === 0) {
      // 1 Monumental Skyscraper
      this.buildMegaTower(cx, cz, isCenter ? 140 + Math.random() * 80 : 90 + Math.random() * 50, geos);
    } else if (blockType === 1) {
      // Dual Twin Towers connected with skybridge
      this.buildTwinTowers(cx, cz, 60 + Math.random() * 40, geos);
    } else if (blockType === 2) {
      // 4 Corner Commercial/Residential mid-rises with inner plaza
      this.buildQuadBuildings(cx, cz, geos);
    } else {
      // Modern stepped terraced building with roof gardens
      this.buildTerracedBuilding(cx, cz, geos);
    }
  }

  buildMegaTower(cx, cz, height, geos) {
    this.stats.buildingCount++;
    const width = 46 + Math.random() * 8;
    const depth = 46 + Math.random() * 8;

    // Podium Base
    const podiumHeight = 12;
    const podiumGeo = new THREE.BoxGeometry(width + 8, podiumHeight, depth + 8);
    podiumGeo.translate(cx, podiumHeight / 2, cz);
    geos.concreteBase.push(podiumGeo);

    // Main Tower Body (Glass facade)
    const mainHeight = height - podiumHeight;
    const towerGeo = new THREE.BoxGeometry(width, mainHeight, depth);
    towerGeo.translate(cx, podiumHeight + mainHeight / 2, cz);
    geos.glass.push(towerGeo);

    // Structural Pillars / Corner Trims
    const pWidth = 1.2;
    const pillarPositions = [
      [cx - width / 2, cz - depth / 2],
      [cx + width / 2, cz - depth / 2],
      [cx - width / 2, cz + depth / 2],
      [cx + width / 2, cz + depth / 2]
    ];
    for (const [px, pz] of pillarPositions) {
      const pGeo = new THREE.BoxGeometry(pWidth, height, pWidth);
      pGeo.translate(px, height / 2, pz);
      geos.metalTrim.push(pGeo);
    }

    // Roof Mech Unit & Helipad
    const roofY = height;
    const mechGeo = new THREE.BoxGeometry(width * 0.6, 6, depth * 0.6);
    mechGeo.translate(cx, roofY + 3, cz);
    geos.roofDark.push(mechGeo);

    // Antenna Mast
    const mastHeight = 18 + Math.random() * 12;
    const mastGeo = new THREE.CylinderGeometry(0.4, 0.8, mastHeight, 8);
    mastGeo.translate(cx, roofY + 6 + mastHeight / 2, cz);
    geos.metalTrim.push(mastGeo);

    // Perimeter Trees along sidewalk
    this.addSidewalkTrees(cx, cz, geos);
  }

  buildTwinTowers(cx, cz, height, geos) {
    this.stats.buildingCount += 2;
    const w = 22;
    const d = 34;
    const offset = 18;

    // Tower A & B
    [-offset, offset].forEach(dx => {
      const bGeo = new THREE.BoxGeometry(w, height, d);
      bGeo.translate(cx + dx, height / 2, cz);
      geos.facadeDark.push(bGeo);

      const glassGeo = new THREE.BoxGeometry(w - 2, height - 6, d + 0.5);
      glassGeo.translate(cx + dx, height / 2, cz);
      geos.glass.push(glassGeo);
    });

    // Skybridge between towers
    const bridgeY = height * 0.65;
    const bridgeGeo = new THREE.BoxGeometry(offset * 2 - w, 5, 10);
    bridgeGeo.translate(cx, bridgeY, cz);
    geos.glass.push(bridgeGeo);

    this.addSidewalkTrees(cx, cz, geos);
  }

  buildQuadBuildings(cx, cz, geos) {
    this.stats.buildingCount += 4;
    const w = 24;
    const d = 24;
    const offsets = [
      [-18, -18], [18, -18], [-18, 18], [18, 18]
    ];

    offsets.forEach(([ox, oz], i) => {
      const h = 32 + (i * 12) + (Math.random() * 10);
      const mat = (i % 2 === 0) ? geos.facadeWarm : geos.facadeDark;

      const bGeo = new THREE.BoxGeometry(w, h, d);
      bGeo.translate(cx + ox, h / 2, cz + oz);
      mat.push(bGeo);

      // Glass windows inset
      const winGeo = new THREE.BoxGeometry(w + 0.4, h * 0.75, d * 0.7);
      winGeo.translate(cx + ox, h * 0.55, cz + oz);
      geos.glass.push(winGeo);

      // Roof cap
      const capGeo = new THREE.BoxGeometry(w * 0.7, 3, d * 0.7);
      capGeo.translate(cx + ox, h + 1.5, cz + oz);
      geos.roofDark.push(capGeo);
    });

    // Central courtyard tree
    this.addTree(cx, cz, geos);
    this.addSidewalkTrees(cx, cz, geos);
  }

  buildTerracedBuilding(cx, cz, geos) {
    this.stats.buildingCount += 1;
    const baseW = 54;
    const baseD = 54;

    // Tier 1
    const h1 = 18;
    const t1 = new THREE.BoxGeometry(baseW, h1, baseD);
    t1.translate(cx, h1 / 2, cz);
    geos.facadeWarm.push(t1);

    // Tier 2
    const h2 = 24;
    const t2 = new THREE.BoxGeometry(baseW - 12, h2, baseD - 12);
    t2.translate(cx, h1 + h2 / 2, cz);
    geos.glass.push(t2);

    // Tier 3
    const h3 = 18;
    const t3 = new THREE.BoxGeometry(baseW - 24, h3, baseD - 24);
    t3.translate(cx, h1 + h2 + h3 / 2, cz);
    geos.facadeDark.push(t3);

    // Roof garden on Tier 1
    this.addTree(cx - 20, cz - 20, geos, h1);
    this.addTree(cx + 20, cz + 20, geos, h1);
    this.addSidewalkTrees(cx, cz, geos);
  }

  addTree(x, z, geos, yBase = 0) {
    this.stats.treeCount++;
    this.treePositions.push(new THREE.Vector3(x, yBase, z));

    const trunkHeight = 3.5 + Math.random() * 1.5;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, trunkHeight, 6);
    trunkGeo.translate(x, yBase + trunkHeight / 2, z);
    geos.treeTrunk.push(trunkGeo);

    // Stylized faceted canopy
    const folHeight = 4.5 + Math.random() * 2;
    const folRadius = 2.4 + Math.random() * 1.2;
    const folGeo = new THREE.ConeGeometry(folRadius, folHeight, 7);
    folGeo.translate(x, yBase + trunkHeight + folHeight / 2 - 0.5, z);

    if (Math.random() > 0.5) {
      geos.treeFoliage.push(folGeo);
    } else {
      geos.treeFoliageLight.push(folGeo);
    }
  }

  addSidewalkTrees(cx, cz, geos) {
    const half = (this.blockSize + this.sidewalkWidth) / 2;
    const positions = [
      [cx - half, cz - 16], [cx - half, cz + 16],
      [cx + half, cz - 16], [cx + half, cz + 16],
      [cx - 16, cz - half], [cx + 16, cz - half],
      [cx - 16, cz + half], [cx + 16, cz + half]
    ];
    for (const [x, z] of positions) {
      if (Math.random() > 0.3) {
        this.addTree(x, z, geos, 0.3);
      }
    }
  }

  buildStreetLights(cx, cz, geos) {
    const offset = (this.blockSize + this.sidewalkWidth * 2) / 2 - 1.2;
    const lampCoords = [
      [cx - offset, cz - offset],
      [cx + offset, cz - offset],
      [cx - offset, cz + offset],
      [cx + offset, cz + offset]
    ];

    for (const [lx, lz] of lampCoords) {
      this.stats.propCount++;
      this.streetLightPositions.push(new THREE.Vector3(lx, 0.3, lz));

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
      poleGeo.translate(lx, 3.5 + 0.3, lz);
      geos.streetLampPole.push(poleGeo);

      // Light head fixture
      const headGeo = new THREE.BoxGeometry(0.6, 0.3, 1.2);
      headGeo.translate(lx, 7 + 0.3, lz);
      geos.streetLampLight.push(headGeo);
    }
  }

  createSidewalkWaypointsForBlock(cx, cz) {
    // Generate perimeter walking nodes along sidewalk for this block
    const radius = (this.blockSize + this.sidewalkWidth) / 2;
    const y = 0.35; // sidewalk walking surface height

    // Corner nodes
    const c1 = new THREE.Vector3(cx - radius, y, cz - radius);
    const c2 = new THREE.Vector3(cx + radius, y, cz - radius);
    const c3 = new THREE.Vector3(cx + radius, y, cz + radius);
    const c4 = new THREE.Vector3(cx - radius, y, cz + radius);

    // Intermediate nodes along edges
    const mN = new THREE.Vector3(cx, y, cz - radius);
    const mE = new THREE.Vector3(cx + radius, y, cz);
    const mS = new THREE.Vector3(cx, y, cz + radius);
    const mW = new THREE.Vector3(cx - radius, y, cz);

    const blockNodes = [c1, mN, c2, mE, c3, mS, c4, mW];
    this.pedestrianWaypoints.push(...blockNodes);
  }

  buildRoadNetwork(half, geos, hasRiver, riverZ) {
    // Road dividers and pedestrian crosswalk zebra markings
    const totalSpan = this.gridSize * this.step + 60;
    const laneWidth = this.roadWidth / 4;

    for (let i = 0; i <= this.gridSize; i++) {
      const coord = (i - half - 0.5) * this.step;

      // Dashed lane lines along Z (North-South)
      const numDashes = Math.floor(totalSpan / 8);
      for (let d = 0; d < numDashes; d++) {
        const z = -totalSpan / 2 + d * 8;
        if (hasRiver && Math.abs(z - riverZ) < this.roadWidth) continue;

        // Yellow center line
        const yellGeo = new THREE.PlaneGeometry(0.35, 4.5);
        yellGeo.rotateX(-Math.PI / 2);
        yellGeo.translate(coord, 0.02, z);
        geos.roadMarkingYellow.push(yellGeo);

        // White lane divider - Left lane
        const w1 = new THREE.PlaneGeometry(0.25, 3.5);
        w1.rotateX(-Math.PI / 2);
        w1.translate(coord - laneWidth, 0.02, z);
        geos.roadMarkingWhite.push(w1);

        // White lane divider - Right lane
        const w2 = new THREE.PlaneGeometry(0.25, 3.5);
        w2.rotateX(-Math.PI / 2);
        w2.translate(coord + laneWidth, 0.02, z);
        geos.roadMarkingWhite.push(w2);
      }

      // Dashed lane lines along X (East-West)
      for (let d = 0; d < numDashes; d++) {
        const x = -totalSpan / 2 + d * 8;

        const yellGeo = new THREE.PlaneGeometry(4.5, 0.35);
        yellGeo.rotateX(-Math.PI / 2);
        yellGeo.translate(x, 0.02, coord);
        geos.roadMarkingYellow.push(yellGeo);

        const w1 = new THREE.PlaneGeometry(3.5, 0.25);
        w1.rotateX(-Math.PI / 2);
        w1.translate(x, 0.02, coord - laneWidth);
        geos.roadMarkingWhite.push(w1);

        const w2 = new THREE.PlaneGeometry(3.5, 0.25);
        w2.rotateX(-Math.PI / 2);
        w2.translate(x, 0.02, coord + laneWidth);
        geos.roadMarkingWhite.push(w2);
      }

      // Crosswalks at intersections
      for (let j = 0; j <= this.gridSize; j++) {
        const otherCoord = (j - half - 0.5) * this.step;
        this.addCrosswalkMarkings(coord, otherCoord, geos);
      }
    }
  }

  addCrosswalkMarkings(ix, iz, geos) {
    const rw = this.roadWidth;
    const stripeCount = 6;
    const stripeLen = 4.0;
    const stripeW = 0.6;
    const offset = rw / 2 + 2.5;

    // North crosswalk
    for (let s = -stripeCount / 2; s < stripeCount / 2; s++) {
      const g = new THREE.PlaneGeometry(stripeW, stripeLen);
      g.rotateX(-Math.PI / 2);
      g.translate(ix + s * 1.6, 0.03, iz - offset);
      geos.roadMarkingWhite.push(g);
    }
    // South crosswalk
    for (let s = -stripeCount / 2; s < stripeCount / 2; s++) {
      const g = new THREE.PlaneGeometry(stripeW, stripeLen);
      g.rotateX(-Math.PI / 2);
      g.translate(ix + s * 1.6, 0.03, iz + offset);
      geos.roadMarkingWhite.push(g);
    }
    // East crosswalk
    for (let s = -stripeCount / 2; s < stripeCount / 2; s++) {
      const g = new THREE.PlaneGeometry(stripeLen, stripeW);
      g.rotateX(-Math.PI / 2);
      g.translate(ix + offset, 0.03, iz + s * 1.6);
      geos.roadMarkingWhite.push(g);
    }
    // West crosswalk
    for (let s = -stripeCount / 2; s < stripeCount / 2; s++) {
      const g = new THREE.PlaneGeometry(stripeLen, stripeW);
      g.rotateX(-Math.PI / 2);
      g.translate(ix - offset, 0.03, iz + s * 1.6);
      geos.roadMarkingWhite.push(g);
    }
  }

  connectCrosswalks() {
    // Pedestrians use this network to navigate across roads and around blocks
    this.navGraph = [];
    const maxNeighborDist = this.step * 0.65;

    for (let i = 0; i < this.pedestrianWaypoints.length; i++) {
      const nodeA = this.pedestrianWaypoints[i];
      const neighbors = [];

      for (let j = 0; j < this.pedestrianWaypoints.length; j++) {
        if (i === j) continue;
        const nodeB = this.pedestrianWaypoints[j];
        const dist = nodeA.distanceTo(nodeB);

        // Connected if on same block perimeter or directly across street
        if (dist < maxNeighborDist) {
          neighbors.push(j);
        }
      }
      this.navGraph.push(neighbors);
    }
  }

  setupTrafficLanes(half, hasRiver, riverZ) {
    this.roadLanes = [];
    const totalSpan = this.gridSize * this.step + 60;
    const laneOffset = this.roadWidth * 0.25;

    // North-South Roads
    for (let i = 0; i <= this.gridSize; i++) {
      const x = (i - half - 0.5) * this.step;

      // Southbound Lane (X + offset, moving from -Z to +Z)
      this.roadLanes.push({
        id: `NS_${i}_S`,
        start: new THREE.Vector3(x + laneOffset, 0.1, -totalSpan / 2),
        end: new THREE.Vector3(x + laneOffset, 0.1, totalSpan / 2),
        direction: new THREE.Vector3(0, 0, 1),
        type: 'NS'
      });

      // Northbound Lane (X - offset, moving from +Z to -Z)
      this.roadLanes.push({
        id: `NS_${i}_N`,
        start: new THREE.Vector3(x - laneOffset, 0.1, totalSpan / 2),
        end: new THREE.Vector3(x - laneOffset, 0.1, -totalSpan / 2),
        direction: new THREE.Vector3(0, 0, -1),
        type: 'NS'
      });
    }

    // East-West Roads
    for (let j = 0; j <= this.gridSize; j++) {
      const z = (j - half - 0.5) * this.step;

      // Skip if right inside river
      if (hasRiver && Math.abs(z - riverZ) < this.roadWidth * 0.4) continue;

      // Eastbound Lane (Z - offset, moving from -X to +X)
      this.roadLanes.push({
        id: `EW_${j}_E`,
        start: new THREE.Vector3(-totalSpan / 2, 0.1, z - laneOffset),
        end: new THREE.Vector3(totalSpan / 2, 0.1, z - laneOffset),
        direction: new THREE.Vector3(1, 0, 0),
        type: 'EW'
      });

      // Westbound Lane (Z + offset, moving from +X to -X)
      this.roadLanes.push({
        id: `EW_${j}_W`,
        start: new THREE.Vector3(totalSpan / 2, 0.1, z + laneOffset),
        end: new THREE.Vector3(-totalSpan / 2, 0.1, z + laneOffset),
        direction: new THREE.Vector3(-1, 0, 0),
        type: 'EW'
      });
    }
  }

  setLightingMode(mode) {
    if (mode === 'night') {
      this.materials.glass.emissiveMap = this.windowTexture;
      this.materials.glass.emissive.setHex(0xfcd34d);
      this.materials.glass.emissiveIntensity = 0.45;
      this.materials.glass.color.setHex(0x0f172a);

      this.materials.facadeDark.emissiveMap = this.windowTexture;
      this.materials.facadeDark.emissive.setHex(0xfef08a);
      this.materials.facadeDark.emissiveIntensity = 0.35;
      this.materials.facadeDark.color.setHex(0x1e293b);

      this.materials.streetLampLight.emissiveIntensity = 3.5;
      this.materials.streetLampLight.color.setHex(0xffaa33);
    } else if (mode === 'sunset') {
      this.materials.glass.emissiveMap = this.windowTexture;
      this.materials.glass.emissive.setHex(0xffd166);
      this.materials.glass.emissiveIntensity = 0.2;
      this.materials.glass.color.setHex(0x2563eb);

      this.materials.facadeDark.emissiveMap = this.windowTexture;
      this.materials.facadeDark.emissive.setHex(0xffd166);
      this.materials.facadeDark.emissiveIntensity = 0.15;
      this.materials.facadeDark.color.setHex(0x334155);

      this.materials.streetLampLight.emissiveIntensity = 1.2;
      this.materials.streetLampLight.color.setHex(0xffd166);
    } else {
      // Day
      this.materials.glass.emissiveIntensity = 0.0;
      this.materials.glass.color.setHex(0x38bdf8);

      this.materials.facadeDark.emissiveIntensity = 0.0;
      this.materials.facadeDark.color.setHex(0x334155);

      this.materials.streetLampLight.emissiveIntensity = 0.2;
      this.materials.streetLampLight.color.setHex(0xffedd5);
    }
  }

  clear() {
    while (this.cityGroup.children.length > 0) {
      const obj = this.cityGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.cityGroup.remove(obj);
    }
    this.pedestrianWaypoints = [];
    this.roadLanes = [];
    this.navGraph = [];
    this.treePositions = [];
    this.streetLightPositions = [];
    this.stats = {
      buildingCount: 0,
      treeCount: 0,
      propCount: 0,
      totalPolys: 0
    };
  }
}
