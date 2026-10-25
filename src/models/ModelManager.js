import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
  constructor() {
    this.objLoader = new OBJLoader();
    this.gltfLoader = new GLTFLoader();
    this.cache = new Map(); // url -> parsed model metadata & template
    this.activeModel = null;
    this.activeModelInfo = null;
  }

  /**
   * Fetch the list of models from /api/models with static fallback
   */
  async listAvailableModels() {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    } catch (e) {
      // Try static models index for deployed static builds
      try {
        const res2 = await fetch('/models/index.json');
        if (res2.ok) {
          const list2 = await res2.json();
          if (Array.isArray(list2) && list2.length > 0) return list2;
        }
      } catch (err2) {}
      console.warn('API /api/models unavailable, using fallback', e);
    }

    return [
      {
        name: 'Building_1.glb',
        filename: 'Building_1.glb',
        url: '/models/Building_1.glb',
        size: 1459512,
        ext: 'glb'
      }
    ];
  }

  /**
   * Load a 3D model by URL or File object
   */
  async loadModel(source, name = '') {
    const isFile = source instanceof File || source instanceof Blob;
    const url = isFile ? URL.createObjectURL(source) : source;
    const modelName = name || (isFile ? source.name : source.split('/').pop().split('?')[0]);
    const ext = modelName.split('.').pop().toLowerCase();

    if (!isFile && this.cache.has(url)) {
      const cached = this.cache.get(url);
      this.activeModel = cached.template;
      this.activeModelInfo = cached.info;
      return { model: cached.template.clone(true), info: cached.info };
    }

    let rawGroup;
    if (ext === 'obj') {
      rawGroup = await this.loadOBJ(url);
    } else if (ext === 'gltf' || ext === 'glb') {
      rawGroup = await this.loadGLTF(url);
    } else {
      throw new Error(`Unsupported model format: .${ext}`);
    }

    // Enhance materials, geometry & compute metadata
    const { model, info } = this.processModel(rawGroup, modelName, isFile ? source.size : null);

    if (!isFile) {
      this.cache.set(url, { template: model, info });
    }

    this.activeModel = model;
    this.activeModelInfo = info;

    return { model: model.clone(true), info };
  }

  loadOBJ(url) {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (obj) => resolve(obj),
        undefined,
        (err) => reject(err)
      );
    });
  }

  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf.scene || gltf.scenes[0]),
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Normalize geometries, assign high quality PBR materials, compute bounding box & stats
   */
  processModel(rawGroup, filename, fileSize = null) {
    let triangleCount = 0;
    let vertexCount = 0;
    let meshCount = 0;
    const meshNames = [];

    // Distinct materials palette for architectural styling
    const materials = {
      glass: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.85,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
        envMapIntensity: 2.0,
        name: 'custom_glass'
      }),
      concreteLight: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.7,
        metalness: 0.12,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
        name: 'custom_concrete_light'
      }),
      facadeDark: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.35,
        side: THREE.DoubleSide,
        envMapIntensity: 1.0,
        name: 'custom_facade_dark'
      }),
      metalTrim: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.3,
        metalness: 0.85,
        side: THREE.DoubleSide,
        envMapIntensity: 1.6,
        name: 'custom_metal_trim'
      }),
      roof: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.85,
        metalness: 0.2,
        side: THREE.DoubleSide,
        name: 'custom_roof'
      }),
      accent: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.6,
        side: THREE.DoubleSide,
        envMapIntensity: 1.5,
        name: 'custom_accent'
      })
    };

    const submeshes = [];

    rawGroup.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        const meshName = child.name || `Mesh_${meshCount}`;
        meshNames.push(meshName);
        submeshes.push({
          id: meshCount,
          name: meshName,
          mesh: child
        });

        const geo = child.geometry;
        if (geo) {
          if (!geo.attributes.normal) {
            geo.computeVertexNormals();
          }
          if (geo.attributes.position) {
            vertexCount += geo.attributes.position.count;
          }
          if (geo.index) {
            triangleCount += geo.index.count / 3;
          } else if (geo.attributes.position) {
            triangleCount += geo.attributes.position.count / 3;
          }
        }

        // Configure shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Upgrade or refine materials
        const nameLower = (child.name || '').toLowerCase();
        const parentNameLower = (child.parent?.name || '').toLowerCase();
        const matNameLower = (child.material?.name || '').toLowerCase();
        const combinedName = `${nameLower} ${parentNameLower} ${matNameLower}`;

        const isGlass = combinedName.includes('glass') || matNameLower.includes('2147445770');
        const isTrim = combinedName.includes('line') || combinedName.includes('trim') || combinedName.includes('frame');
        const isRoof = combinedName.includes('roof') || combinedName.includes('top');
        const isAccent = combinedName.includes('accent') || combinedName.includes('2767') || combinedName.includes('2770');

        const mat = child.material;
        const isPlaceholderMat = !mat ||
          mat.name?.startsWith('Empty') ||
          mat.name?.startsWith('Material #') ||
          mat.name?.startsWith('default') ||
          mat.type === 'MeshPhongMaterial' ||
          (!mat.map && mat.color && mat.color.r < 0.05 && mat.color.g < 0.05 && mat.color.b < 0.05);

        if (isGlass) {
          child.material = materials.glass.clone();
          child.userData.isGlass = true;
        } else if (isTrim) {
          child.material = materials.metalTrim.clone();
          child.userData.isTrim = true;
        } else if (isRoof) {
          child.material = materials.roof.clone();
          child.userData.isRoof = true;
        } else if (isAccent) {
          child.material = materials.accent.clone();
          child.userData.isAccent = true;
        } else if (combinedName.includes('shape2768') || combinedName.includes('object1787')) {
          child.material = materials.concreteLight.clone();
          child.userData.isFacade = true;
        } else if (isPlaceholderMat) {
          child.material = (meshCount % 2 === 0) ? materials.facadeDark.clone() : materials.concreteLight.clone();
          child.userData.isFacade = true;
        }
      }
    });

    // Compute raw bounds
    const box = new THREE.Box3().setFromObject(rawGroup);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Create a centered, ground-aligned wrapper container
    // Pivot at bottom center (x=0, y=0, z=0)
    const normalizedGroup = new THREE.Group();
    normalizedGroup.name = `Normalized_${filename}`;

    // Center internal group
    rawGroup.position.set(-center.x, -box.min.y, -center.z);
    normalizedGroup.add(rawGroup);

    // Recompute normalized box
    const finalBox = new THREE.Box3().setFromObject(normalizedGroup);
    const finalSize = new THREE.Vector3();
    finalBox.getSize(finalSize);

    const info = {
      filename,
      fileSize: fileSize ? (fileSize / (1024 * 1024)).toFixed(2) + ' MB' : '~1.74 MB',
      vertices: vertexCount,
      triangles: Math.round(triangleCount),
      meshes: meshCount,
      meshNames,
      submeshes,
      dimensions: {
        x: finalSize.x,
        y: finalSize.y,
        z: finalSize.z
      },
      rawBounds: {
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2)
      }
    };

    return { model: normalizedGroup, info };
  }

  /**
   * Create a scaled instance suitable for city blocks
   * Target block footprint width is ~45m to 55m
   */
  createCityInstance(targetWidth = 52) {
    if (!this.activeModel) return null;

    const clone = this.activeModel.clone(true);
    const baseWidth = Math.max(this.activeModelInfo.dimensions.x, this.activeModelInfo.dimensions.z) || 5.8;
    const scaleFactor = targetWidth / baseWidth;

    clone.scale.set(scaleFactor, scaleFactor, scaleFactor);
    clone.userData = {
      isBuilding1: true,
      originalName: this.activeModelInfo.filename,
      scaleFactor,
      height: this.activeModelInfo.dimensions.y * scaleFactor
    };

    return clone;
  }

  /**
   * Set night window glow on custom building instances
   */
  applyLightingToModel(modelGroup, mode = 'day', emissiveIntensity = 0.5, emissiveColor = 0xfef08a) {
    if (!modelGroup) return;

    modelGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.userData.isGlass) {
          if (mode === 'night') {
            child.material.emissive = new THREE.Color(emissiveColor);
            child.material.emissiveIntensity = emissiveIntensity * 1.5;
            child.material.color.setHex(0x1e293b);
          } else if (mode === 'sunset') {
            child.material.emissive = new THREE.Color(0xf59e0b);
            child.material.emissiveIntensity = emissiveIntensity * 0.4;
            child.material.color.setHex(0x0284c7);
          } else {
            child.material.emissiveIntensity = 0;
            child.material.color.setHex(0x38bdf8);
          }
        }
      }
    });
  }
}
