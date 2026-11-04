import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export class CarModelFactory {
  static getCarList() {
    return [
      {
        id: 'sedan',
        name: 'Modern Executive Sedan',
        filename: 'Modern_Sedan.car',
        category: 'car',
        icon: '🚗',
        desc: 'Aerodynamic executive sedan with alloy rims & LED optics',
        specs: 'Length: 4.5m | Width: 2.0m | Height: 1.45m',
        ext: 'car'
      },
      {
        id: 'sports',
        name: 'Cyber Sports GT',
        filename: 'Cyber_Sports_GT.car',
        category: 'car',
        icon: '🏎️',
        desc: 'Low-slung twin-turbo coupe with widebody stance & GT wing',
        specs: 'Length: 4.6m | Width: 2.1m | Height: 1.25m',
        ext: 'car'
      },
      {
        id: 'suv',
        name: 'Urban SUV & City Taxi',
        filename: 'Urban_SUV_Taxi.car',
        category: 'car',
        icon: '🚕',
        desc: 'High-clearance crossover with roof rails & taxi topper',
        specs: 'Length: 4.7m | Width: 2.2m | Height: 1.85m',
        ext: 'car'
      },
      {
        id: 'truck',
        name: 'Futuristic CyberTruck',
        filename: 'Cyber_Truck.car',
        category: 'car',
        icon: '🚙',
        desc: 'Angular faceted exoskeleton with continuous horizon LED lightbars',
        specs: 'Length: 5.2m | Width: 2.2m | Height: 1.85m',
        ext: 'car'
      },
      {
        id: 'van',
        name: 'Electric Delivery Van',
        filename: 'Electric_Delivery_Van.car',
        category: 'car',
        icon: '🚐',
        desc: 'High-capacity electric logistics van with cargo panels',
        specs: 'Length: 5.0m | Width: 2.1m | Height: 2.30m',
        ext: 'car'
      }
    ];
  }

  /**
   * Builds an interactive, hierarchical THREE.Group for the Model Viewer
   * Contains individual sub-meshes with PBR materials for part inspection and color tinting.
   */
  static createViewerCar(type = 'sedan', options = {}) {
    const group = new THREE.Group();
    group.name = `Car_${type}`;

    const bodyColor = options.bodyColor || 0x2563eb;
    const glassColor = options.glassColor || 0x38bdf8;
    const trimColor = options.trimColor || 0x1e293b;
    const wheelColor = options.wheelColor || 0x0f172a;
    const rimColor = options.rimColor || 0xd1d5db;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.3,
      metalness: 0.8,
      name: 'Mat_CarBody'
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: glassColor,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.75,
      name: 'Mat_CarGlass'
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.6,
      metalness: 0.3,
      name: 'Mat_CarTrim'
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: wheelColor,
      roughness: 0.85,
      metalness: 0.1,
      name: 'Mat_CarTire'
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      roughness: 0.25,
      metalness: 0.85,
      name: 'Mat_CarRim'
    });

    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      name: 'Mat_Headlight'
    });

    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.0,
      roughness: 0.2,
      name: 'Mat_Taillight'
    });

    const submeshes = [];

    const addMesh = (geo, mat, name, isBody = false, isGlass = false, isWheel = false) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        isBody,
        isGlass,
        isWheel,
        partName: name
      };
      group.add(mesh);
      submeshes.push({
        name,
        mesh,
        material: mat.name,
        vertices: geo.attributes.position ? geo.attributes.position.count : 0,
        triangles: geo.index ? geo.index.count / 3 : (geo.attributes.position ? geo.attributes.position.count / 3 : 0)
      });
      return mesh;
    };

    // Helper for 4 wheels
    const addWheels = (wRadius, wWidth, xSpan, zFront, zRear, yHeight) => {
      const wheelGeo = new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 18);
      wheelGeo.rotateZ(Math.PI / 2);

      const rimGeo = new THREE.CylinderGeometry(wRadius * 0.65, wRadius * 0.65, wWidth + 0.02, 12);
      rimGeo.rotateZ(Math.PI / 2);

      const wheels = [
        { name: 'Wheel_Front_Left', x: -xSpan, z: zFront },
        { name: 'Wheel_Front_Right', x: xSpan, z: zFront },
        { name: 'Wheel_Rear_Left', x: -xSpan, z: zRear },
        { name: 'Wheel_Rear_Right', x: xSpan, z: zRear }
      ];

      wheels.forEach(w => {
        const tire = wheelGeo.clone();
        tire.translate(w.x, yHeight, w.z);
        addMesh(tire, tireMat, `${w.name}_Tire`, false, false, true);

        const rim = rimGeo.clone();
        rim.translate(w.x, yHeight, w.z);
        addMesh(rim, rimMat, `${w.name}_Rim`, false, false, true);
      });
    };

    switch (type) {
      case 'sports': {
        // Low slung sports coupe
        const chassisGeo = new THREE.BoxGeometry(2.1, 0.55, 4.6);
        chassisGeo.translate(0, 0.45, 0);
        addMesh(chassisGeo, bodyMat, 'Chassis_Body', true);

        // Front splitter
        const splitterGeo = new THREE.BoxGeometry(2.14, 0.08, 0.5);
        splitterGeo.translate(0, 0.22, 2.3);
        addMesh(splitterGeo, trimMat, 'Aero_FrontSplitter');

        // Aerodynamic fastback cockpit
        const cabinGeo = new THREE.BoxGeometry(1.65, 0.55, 2.2);
        cabinGeo.translate(0, 0.95, -0.3);
        addMesh(cabinGeo, bodyMat, 'Cabin_Roof', true);

        // Windshield & fastback glass
        const windshieldGeo = new THREE.BoxGeometry(1.58, 0.48, 1.3);
        windshieldGeo.translate(0, 0.98, 0.2);
        addMesh(windshieldGeo, glassMat, 'Windshield_Glass', false, true);

        const rearGlassGeo = new THREE.BoxGeometry(1.52, 0.42, 1.0);
        rearGlassGeo.translate(0, 0.92, -0.9);
        addMesh(rearGlassGeo, glassMat, 'Rear_Glass', false, true);

        // Rear Racing GT Wing
        const wingPlank = new THREE.BoxGeometry(2.0, 0.06, 0.4);
        wingPlank.translate(0, 1.25, -2.1);
        addMesh(wingPlank, trimMat, 'Rear_GT_Wing');

        const strutL = new THREE.BoxGeometry(0.06, 0.35, 0.2);
        strutL.translate(-0.6, 0.98, -2.1);
        addMesh(strutL, trimMat, 'Wing_Strut_Left');

        const strutR = new THREE.BoxGeometry(0.06, 0.35, 0.2);
        strutR.translate(0.6, 0.98, -2.1);
        addMesh(strutR, trimMat, 'Wing_Strut_Right');

        // Dual headlights
        const hlL = new THREE.BoxGeometry(0.35, 0.12, 0.15);
        hlL.translate(-0.75, 0.55, 2.28);
        addMesh(hlL, hlMat, 'Headlight_Left');

        const hlR = new THREE.BoxGeometry(0.35, 0.12, 0.15);
        hlR.translate(0.75, 0.55, 2.28);
        addMesh(hlR, hlMat, 'Headlight_Right');

        // Neon rear taillight bar
        const tlBar = new THREE.BoxGeometry(1.9, 0.1, 0.1);
        tlBar.translate(0, 0.62, -2.28);
        addMesh(tlBar, tlMat, 'Taillight_Bar');

        addWheels(0.38, 0.32, 1.02, 1.4, -1.4, 0.38);
        break;
      }

      case 'suv': {
        // High-riding Urban SUV / Taxi
        const chassisGeo = new THREE.BoxGeometry(2.2, 0.85, 4.7);
        chassisGeo.translate(0, 0.72, 0);
        addMesh(chassisGeo, bodyMat, 'Chassis_Body', true);

        // Skid plate / lower bumper
        const skidGeo = new THREE.BoxGeometry(2.1, 0.25, 0.6);
        skidGeo.translate(0, 0.32, 2.2);
        addMesh(skidGeo, trimMat, 'Bumper_SkidPlate');

        // Upright cabin
        const cabinGeo = new THREE.BoxGeometry(1.85, 0.8, 2.8);
        cabinGeo.translate(0, 1.45, -0.2);
        addMesh(cabinGeo, bodyMat, 'Cabin_Roof', true);

        // Panoramic windows
        const winGeo = new THREE.BoxGeometry(1.8, 0.7, 2.7);
        winGeo.translate(0, 1.48, -0.2);
        addMesh(winGeo, glassMat, 'Cabin_Windows', false, true);

        // Roof rails
        const railL = new THREE.BoxGeometry(0.08, 0.08, 2.4);
        railL.translate(-0.75, 1.9, -0.2);
        addMesh(railL, trimMat, 'Roof_Rail_Left');

        const railR = new THREE.BoxGeometry(0.08, 0.08, 2.4);
        railR.translate(0.75, 1.9, -0.2);
        addMesh(railR, trimMat, 'Roof_Rail_Right');

        // Taxi Topper Sign (Illuminated)
        const taxiSignGeo = new THREE.BoxGeometry(0.6, 0.2, 0.28);
        taxiSignGeo.translate(0, 1.98, -0.1);
        const taxiMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.8,
          roughness: 0.3,
          name: 'Mat_TaxiSign'
        });
        addMesh(taxiSignGeo, taxiMat, 'Taxi_Roof_Topper');

        // Dual projector headlights
        const hlL = new THREE.BoxGeometry(0.4, 0.2, 0.15);
        hlL.translate(-0.8, 0.85, 2.32);
        addMesh(hlL, hlMat, 'Headlight_Left');

        const hlR = new THREE.BoxGeometry(0.4, 0.2, 0.15);
        hlR.translate(0.8, 0.85, 2.32);
        addMesh(hlR, hlMat, 'Headlight_Right');

        // High vertical taillights
        const tlL = new THREE.BoxGeometry(0.18, 0.6, 0.12);
        tlL.translate(-0.85, 1.2, -2.32);
        addMesh(tlL, tlMat, 'Taillight_Left');

        const tlR = new THREE.BoxGeometry(0.18, 0.6, 0.12);
        tlR.translate(0.85, 1.2, -2.32);
        addMesh(tlR, tlMat, 'Taillight_Right');

        addWheels(0.45, 0.35, 1.05, 1.45, -1.45, 0.45);
        break;
      }

      case 'truck': {
        // Geometric Cyber Truck
        const lowerGeo = new THREE.BoxGeometry(2.2, 0.8, 5.2);
        lowerGeo.translate(0, 0.68, 0);
        addMesh(lowerGeo, bodyMat, 'Chassis_Exoskeleton', true);

        // Angular cabin roof
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.8, 2.8);
        cabinGeo.translate(0, 1.42, 0.1);
        addMesh(cabinGeo, bodyMat, 'Angular_Cabin', true);

        // Angular canopy glass
        const glassGeo = new THREE.BoxGeometry(1.76, 0.72, 2.6);
        glassGeo.translate(0, 1.44, 0.15);
        addMesh(glassGeo, glassMat, 'Canopy_Glass', false, true);

        // Bed tonneau cover
        const bedCover = new THREE.BoxGeometry(1.8, 0.12, 1.8);
        bedCover.translate(0, 1.1, -1.6);
        addMesh(bedCover, trimMat, 'Bed_Tonneau_Cover');

        // Continuous horizon front LED lightbar
        const frontBar = new THREE.BoxGeometry(2.15, 0.1, 0.15);
        frontBar.translate(0, 0.95, 2.58);
        addMesh(frontBar, hlMat, 'Horizon_Front_Lightbar');

        // Continuous horizon rear red LED lightbar
        const rearBar = new THREE.BoxGeometry(2.15, 0.1, 0.15);
        rearBar.translate(0, 0.95, -2.58);
        addMesh(rearBar, tlMat, 'Horizon_Rear_Lightbar');

        addWheels(0.46, 0.36, 1.06, 1.6, -1.6, 0.46);
        break;
      }

      case 'van': {
        // Commercial electric delivery van
        const bodyGeo = new THREE.BoxGeometry(2.1, 1.8, 5.0);
        bodyGeo.translate(0, 1.2, 0);
        addMesh(bodyGeo, bodyMat, 'Van_Cargo_Body', true);

        // Cab front windshield
        const cabGlassGeo = new THREE.BoxGeometry(1.95, 0.65, 0.9);
        cabGlassGeo.translate(0, 1.55, 1.8);
        addMesh(cabGlassGeo, glassMat, 'Cab_Windshield', false, true);

        // Side cargo accent panels
        const panelL = new THREE.BoxGeometry(0.04, 1.1, 3.0);
        panelL.translate(-1.06, 1.2, -0.6);
        addMesh(panelL, trimMat, 'Cargo_Panel_Left');

        const panelR = new THREE.BoxGeometry(0.04, 1.1, 3.0);
        panelR.translate(1.06, 1.2, -0.6);
        addMesh(panelR, trimMat, 'Cargo_Panel_Right');

        // Rear twin doors divider
        const rearDiv = new THREE.BoxGeometry(0.06, 1.6, 0.1);
        rearDiv.translate(0, 1.2, -2.51);
        addMesh(rearDiv, trimMat, 'Rear_Doors_Trim');

        // Headlights
        const hlL = new THREE.BoxGeometry(0.35, 0.25, 0.15);
        hlL.translate(-0.8, 0.75, 2.48);
        addMesh(hlL, hlMat, 'Headlight_Left');

        const hlR = new THREE.BoxGeometry(0.35, 0.25, 0.15);
        hlR.translate(0.8, 0.75, 2.48);
        addMesh(hlR, hlMat, 'Headlight_Right');

        // High rear utility lights
        const tlL = new THREE.BoxGeometry(0.15, 0.45, 0.12);
        tlL.translate(-0.9, 1.7, -2.49);
        addMesh(tlL, tlMat, 'Taillight_Left');

        const tlR = new THREE.BoxGeometry(0.15, 0.45, 0.12);
        tlR.translate(0.9, 1.7, -2.49);
        addMesh(tlR, tlMat, 'Taillight_Right');

        addWheels(0.42, 0.32, 1.02, 1.5, -1.5, 0.42);
        break;
      }

      case 'sedan':
      default: {
        // Modern Executive Sedan
        const chassisGeo = new THREE.BoxGeometry(2.0, 0.65, 4.5);
        chassisGeo.translate(0, 0.55, 0);
        addMesh(chassisGeo, bodyMat, 'Chassis_Body', true);

        // Aerodynamic cabin & pillars
        const cabinGeo = new THREE.BoxGeometry(1.7, 0.6, 2.4);
        cabinGeo.translate(0, 1.15, -0.2);
        addMesh(cabinGeo, bodyMat, 'Cabin_Roof', true);

        // Windshield and windows
        const windshieldGeo = new THREE.BoxGeometry(1.64, 0.52, 2.2);
        windshieldGeo.translate(0, 1.15, -0.2);
        addMesh(windshieldGeo, glassMat, 'Windshield_Glass', false, true);

        // Front dual projector headlights
        const hlL = new THREE.BoxGeometry(0.35, 0.16, 0.12);
        hlL.translate(-0.72, 0.65, 2.22);
        addMesh(hlL, hlMat, 'Headlight_Left');

        const hlR = new THREE.BoxGeometry(0.35, 0.16, 0.12);
        hlR.translate(0.72, 0.65, 2.22);
        addMesh(hlR, hlMat, 'Headlight_Right');

        // Rear LED taillight bar
        const tlL = new THREE.BoxGeometry(0.38, 0.15, 0.12);
        tlL.translate(-0.7, 0.68, -2.22);
        addMesh(tlL, tlMat, 'Taillight_Left');

        const tlR = new THREE.BoxGeometry(0.38, 0.15, 0.12);
        tlR.translate(0.7, 0.68, -2.22);
        addMesh(tlR, tlMat, 'Taillight_Right');

        // Front radiator grille
        const grilleGeo = new THREE.BoxGeometry(0.8, 0.25, 0.12);
        grilleGeo.translate(0, 0.52, 2.23);
        addMesh(grilleGeo, trimMat, 'Radiator_Grille');

        addWheels(0.4, 0.3, 0.98, 1.35, -1.35, 0.4);
        break;
      }
    }

    // Compute bounding box & dimensions
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    let totalTris = 0;
    let totalVerts = 0;
    submeshes.forEach(s => {
      totalTris += s.triangles;
      totalVerts += s.vertices;
    });

    const info = {
      filename: `${type.toUpperCase()}_Model.car`,
      carType: type,
      isCar: true,
      fileSize: 'Procedural 3D Mesh',
      vertices: Math.round(totalVerts),
      triangles: Math.round(totalTris),
      meshes: submeshes.length,
      submeshes: submeshes,
      dimensions: {
        x: size.x,
        y: size.y,
        z: size.z
      },
      rawBounds: {
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2)
      }
    };

    return { model: group, info };
  }

  /**
   * Generates a single merged BufferGeometry optimized for InstancedMesh in TrafficManager
   */
  static createTrafficGeometry(type = 'sedan') {
    const geos = [];

    const addBox = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      geos.push(g);
    };

    const addWheels = (r, w, x, zF, zR, y) => {
      const wGeo = new THREE.CylinderGeometry(r, r, w, 10);
      wGeo.rotateZ(Math.PI / 2);

      const wFL = wGeo.clone(); wFL.translate(-x, y, zF);
      const wFR = wGeo.clone(); wFR.translate(x, y, zF);
      const wRL = wGeo.clone(); wRL.translate(-x, y, zR);
      const wRR = wGeo.clone(); wRR.translate(x, y, zR);
      geos.push(wFL, wFR, wRL, wRR);
    };

    switch (type) {
      case 'sports':
        addBox(2.1, 0.55, 4.6, 0, 0.45, 0); // Chassis
        addBox(1.65, 0.55, 2.2, 0, 0.95, -0.3); // Cabin
        addBox(2.0, 0.06, 0.4, 0, 1.25, -2.1); // Wing
        addBox(0.06, 0.35, 0.2, -0.6, 0.98, -2.1); // Strut L
        addBox(0.06, 0.35, 0.2, 0.6, 0.98, -2.1); // Strut R
        addBox(0.35, 0.12, 0.15, -0.75, 0.55, 2.28); // HL L
        addBox(0.35, 0.12, 0.15, 0.75, 0.55, 2.28); // HL R
        addBox(1.9, 0.1, 0.1, 0, 0.62, -2.28); // TL Bar
        addWheels(0.38, 0.32, 1.02, 1.4, -1.4, 0.38);
        break;

      case 'suv':
        addBox(2.2, 0.85, 4.7, 0, 0.72, 0); // Chassis
        addBox(1.85, 0.8, 2.8, 0, 1.45, -0.2); // Cabin
        addBox(0.08, 0.08, 2.4, -0.75, 1.9, -0.2); // Roof rail L
        addBox(0.08, 0.08, 2.4, 0.75, 1.9, -0.2); // Roof rail R
        addBox(0.6, 0.2, 0.28, 0, 1.98, -0.1); // Taxi Sign
        addBox(0.4, 0.2, 0.15, -0.8, 0.85, 2.32); // HL L
        addBox(0.4, 0.2, 0.15, 0.8, 0.85, 2.32); // HL R
        addWheels(0.45, 0.35, 1.05, 1.45, -1.45, 0.45);
        break;

      case 'truck':
        addBox(2.2, 0.8, 5.2, 0, 0.68, 0); // Exoskeleton
        addBox(1.8, 0.8, 2.8, 0, 1.42, 0.1); // Cabin
        addBox(2.15, 0.1, 0.15, 0, 0.95, 2.58); // Horizon front
        addBox(2.15, 0.1, 0.15, 0, 0.95, -2.58); // Horizon rear
        addWheels(0.46, 0.36, 1.06, 1.6, -1.6, 0.46);
        break;

      case 'van':
        addBox(2.1, 1.8, 5.0, 0, 1.2, 0); // Cargo Body
        addBox(0.35, 0.25, 0.15, -0.8, 0.75, 2.48); // HL L
        addBox(0.35, 0.25, 0.15, 0.8, 0.75, 2.48); // HL R
        addBox(0.15, 0.45, 0.12, -0.9, 1.7, -2.49); // TL L
        addBox(0.15, 0.45, 0.12, 0.9, 1.7, -2.49); // TL R
        addWheels(0.42, 0.32, 1.02, 1.5, -1.5, 0.42);
        break;

      case 'sedan':
      default:
        addBox(2.0, 0.7, 4.4, 0, 0.55, 0); // Chassis
        addBox(1.7, 0.65, 2.3, 0, 1.2, -0.2); // Cabin
        addBox(0.3, 0.15, 0.1, -0.7, 0.65, 2.2); // HL L
        addBox(0.3, 0.15, 0.1, 0.7, 0.65, 2.2); // HL R
        addBox(0.3, 0.15, 0.1, -0.7, 0.68, -2.2); // TL L
        addBox(0.3, 0.15, 0.1, 0.7, 0.68, -2.2); // TL R
        addWheels(0.38, 0.3, 0.95, 1.3, -1.3, 0.38);
        break;
    }

    const merged = BufferGeometryUtils.mergeGeometries(geos, false);
    merged.computeVertexNormals();
    return merged;
  }
}
