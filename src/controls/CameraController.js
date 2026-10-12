import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

export class CameraController {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;

    this.controls = new MapControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 1200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06; // never clip below ground

    // Mobile touch configuration: 1 finger pan or orbit, 2 finger dolly + rotate
    this.touchMode = 'pan'; // 'pan' or 'orbit'
    this.setTouchMode('pan');

    this.trackingTarget = null;
    this.targetOffset = new THREE.Vector3(0, 8, 16);
    this.isCinematicTour = false;
    this.tourAngle = 0;

    // Transition state
    this.isTransitioning = false;
    this.transitionStartCam = new THREE.Vector3();
    this.transitionEndCam = new THREE.Vector3();
    this.transitionStartTarget = new THREE.Vector3();
    this.transitionEndTarget = new THREE.Vector3();
    this.transitionProgress = 0;
    this.transitionDuration = 0.8;

    this.setPreset('iso');
  }

  setTouchMode(mode) {
    this.touchMode = mode;
    if (mode === 'orbit') {
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    } else {
      // Default map mode: 1 finger pan, 2 fingers dolly/rotate
      this.controls.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE
      };
    }
  }

  zoomIn(factor = 0.75) {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const newLen = Math.max(this.controls.minDistance, offset.length() * factor);
    offset.setLength(newLen);
    this.camera.position.addVectors(this.controls.target, offset);
    this.controls.update();
  }

  zoomOut(factor = 1.33) {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const newLen = Math.min(this.controls.maxDistance, offset.length() * factor);
    offset.setLength(newLen);
    this.camera.position.addVectors(this.controls.target, offset);
    this.controls.update();
  }

  setPreset(preset) {
    this.trackingTarget = null;
    this.isCinematicTour = false;

    let targetCamPos = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3(0, 0, 0);

    switch (preset) {
      case 'iso':
        // Classic architectural isometric view (like era.estate)
        targetCamPos.set(340, 300, 340);
        targetLookAt.set(0, 10, 0);
        break;
      case 'street':
        // Ground pedestrian perspective on avenue sidewalk
        targetCamPos.set(15, 3.0, 20);
        targetLookAt.set(15, 2.5, 120);
        break;
      case 'rooftop':
        // High skyscraper viewpoint looking down at traffic
        targetCamPos.set(52.5, 175, 52.5);
        targetLookAt.set(0, 15, 0);
        break;
      case 'aerial':
        // Top-down overhead map
        targetCamPos.set(0, 560, 0.1);
        targetLookAt.set(0, 0, 0);
        break;
      case 'orbit':
        // Cinematic rotating view
        this.isCinematicTour = true;
        targetCamPos.set(320, 220, 320);
        targetLookAt.set(0, 20, 0);
        break;
    }

    this.transitionDuration = 0.8;
    this.startTransition(targetCamPos, targetLookAt);
  }

  startTransition(camPos, lookAtPos) {
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.transitionStartCam.copy(this.camera.position);
    this.transitionEndCam.copy(camPos);
    this.transitionStartTarget.copy(this.controls.target);
    this.transitionEndTarget.copy(lookAtPos);
  }

  setTrackingTarget(target, offset = null) {
    this.trackingTarget = target;
    this.isCinematicTour = false;
    this.isTransitioning = false;
    if (offset) this.targetOffset.copy(offset);
  }

  clearTracking() {
    this.trackingTarget = null;
  }

  update(delta) {
    if (this.isTransitioning) {
      this.transitionProgress += delta / this.transitionDuration;
      const t = Math.min(1.0, this.transitionProgress);
      // Smooth easeInOutCubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.transitionStartCam, this.transitionEndCam, ease);
      this.controls.target.lerpVectors(this.transitionStartTarget, this.transitionEndTarget, ease);

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else if (this.trackingTarget && this.trackingTarget.pos) {
      // Smooth follow camera
      const tPos = this.trackingTarget.pos;
      const desiredCamPos = new THREE.Vector3(
        tPos.x + this.targetOffset.x,
        tPos.y + this.targetOffset.y,
        tPos.z + this.targetOffset.z
      );

      this.camera.position.lerp(desiredCamPos, 0.08);
      this.controls.target.lerp(tPos, 0.1);
    } else if (this.isCinematicTour) {
      this.tourAngle += delta * 0.15;
      const radius = 260;
      const height = 150 + Math.sin(this.tourAngle * 0.5) * 40;
      this.camera.position.x = Math.sin(this.tourAngle) * radius;
      this.camera.position.z = Math.cos(this.tourAngle) * radius;
      this.camera.position.y = height;
      this.controls.target.set(0, 15, 0);
    }

    this.controls.update();
  }
}
