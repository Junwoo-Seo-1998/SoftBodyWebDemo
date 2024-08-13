import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Timer } from "three/addons/misc/Timer.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
const camControls = new OrbitControls(camera, renderer.domElement);
const timer = new Timer();
let pickingControls;
let numSubsteps = 10;
let mainObj;

let sky, sun;

//helper class for vector math
class Vector3 {
  constructor(verts, ith) {
    this.verts = verts;
    this.start = ith * 3;
  }
  getIndex() {
    return this.start / 3;
  }
  getX() {
    return this.verts[this.start];
  }
  getY() {
    return this.verts[this.start + 1];
  }
  getZ() {
    return this.verts[this.start + 2];
  }
  setX(val) {
    this.verts[this.start] = val;
  }
  setY(val) {
    this.verts[this.start + 1] = val;
  }
  setZ(val) {
    this.verts[this.start + 2] = val;
  }

  set(vec) {
    this.verts[this.start] = vec.verts[vec.start];
    this.verts[this.start + 1] = vec.verts[vec.start + 1];
    this.verts[this.start + 2] = vec.verts[vec.start + 2];
  }

  add(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] + vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] + vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] + vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  sub(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] - vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] - vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] - vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  mul(val) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] * val;
    result[1] = this.verts[this.start + 1] * val;
    result[2] = this.verts[this.start + 2] * val;
    return new Vector3(result, 0);
  }

  addSet(vec) {
    this.verts[this.start] += vec.verts[vec.start];
    this.verts[this.start + 1] += vec.verts[vec.start + 1];
    this.verts[this.start + 2] += vec.verts[vec.start + 2];
  }

  subSet(vec) {
    this.verts[this.start] -= vec.verts[vec.start];
    this.verts[this.start + 1] -= vec.verts[vec.start + 1];
    this.verts[this.start + 2] -= vec.verts[vec.start + 2];
  }

  mulSet(val) {
    this.verts[this.start] *= val;
    this.verts[this.start + 1] *= val;
    this.verts[this.start + 2] *= val;
  }

  dot(vec) {
    return (
      this.verts[this.start] * vec.verts[vec.start] +
      this.verts[this.start + 1] * vec.verts[vec.start + 1] +
      this.verts[this.start + 2] * vec.verts[vec.start + 2]
    );
  }

  cross(vec) {
    let result = [0, 0, 0];
    result[0] =
      this.verts[this.start + 1] * vec.verts[vec.start + 2] -
      this.verts[this.start + 2] * vec.verts[vec.start + 1];
    result[1] =
      this.verts[this.start + 2] * vec.verts[vec.start] -
      this.verts[this.start] * vec.verts[vec.start + 2];
    result[2] =
      this.verts[this.start] * vec.verts[vec.start + 1] -
      this.verts[this.start + 1] * vec.verts[vec.start];
    return new Vector3(result, 0);
  }

  squareLen() {
    return (
      this.verts[this.start] * this.verts[this.start] +
      this.verts[this.start + 1] * this.verts[this.start + 1] +
      this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }

  len() {
    return Math.sqrt(
      this.verts[this.start] * this.verts[this.start] +
        this.verts[this.start + 1] * this.verts[this.start + 1] +
        this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }
}

//for event
function onMouseDown(event) {
  event.preventDefault();
  pickingControls.onMouseDown(event);
}

function onMouseMove(event) {
  event.preventDefault();
  pickingControls.onMouseMove(event);
}
function onMouseUp(event) {
  event.preventDefault();
  pickingControls.onMouseUp(event);
}

class PickingControls {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);
    this.raycaster.params.Line.threshold = 0.1;
    this.isMouseDown = false;
    this.selectedObject = null;
    this.distance = 0.0;
    this.mousePos = new THREE.Vector2();
    this.prevPos = new THREE.Vector2();
    this.grabedPosition = null;
    this.grabedMass = 0.0;
  }
  onMouseDown(event) {
    if (event.button != 0) return;
    this.isMouseDown = true;

    this.updateRaycaster(event.clientX, event.clientY);
    const intersects = this.raycaster.intersectObjects(scene.children);

    if (intersects.length < 1) return;

    let body = intersects[0].object.userData;
    if (!body) return;

    this.selectedObject = body;
    this.distance = intersects[0].distance;
    let pos = this.raycaster.ray.origin.clone();
    pos.addScaledVector(this.raycaster.ray.direction, this.distance);
    this.prevPos = pos;
    this.grabedPosition = this.selectedObject.getNearestPointReference(
      pos.x,
      pos.y,
      pos.z
    );
    this.grabedMass =
      this.selectedObject.invMass[this.grabedPosition.getIndex()];
    this.selectedObject.invMass[this.grabedPosition.getIndex()] = 0.0;

    camControls.enabled = false;
  }

  onMouseMove(event) {
    if (!this.isMouseDown) return;
    if (!this.selectedObject) return;

    this.updateRaycaster(event.clientX, event.clientY);
    var pos = this.raycaster.ray.origin.clone();
    pos.addScaledVector(this.raycaster.ray.direction, this.distance);

    this.grabedPosition.set(new Vector3([pos.x, pos.y, pos.z], 0));
  }

  onMouseUp(event) {
    if (event.button != 0) return;
    this.isMouseDown = false;
    if (this.selectedObject) {
      camControls.enabled = true;

      this.selectedObject.invMass[this.grabedPosition.getIndex()] =
        this.grabedMass;
      this.grabedMass = 0.0;
      this.selectedObject = null;
    }
  }

  updateRaycaster(x, y) {
    //https://threejs.org/docs/#api/en/core/Raycaster
    var rect = renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((x - rect.left) / window.innerWidth) * 2 - 1;
    this.mousePos.y = -((y - rect.top) / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePos, camera);
  }
}

const gravity = new Vector3([0, -10, 0], 0);

class Body {
  constructor(scene, tetMesh) {
    this.numParticles = tetMesh.verts.length / 3;
    this.numTets = tetMesh.tetIds.length / 4;
    this.pos = new Float32Array(tetMesh.verts);
    this.prevPos = tetMesh.verts.slice();
    this.vel = new Float32Array(3 * this.numParticles);

    this.tetIds = tetMesh.tetIds;
    this.edgeIds = tetMesh.tetEdgeIds;
    this.restVol = new Float32Array(this.numTets);
    this.edgeLengths = new Float32Array(this.edgeIds.length / 2);
    this.invMass = new Float32Array(this.numParticles);
    this.grabInvMass = 0.0;
    this.initPhysics();
    let geometry = new THREE.BufferGeometry();
    let buffer = new THREE.BufferAttribute(this.pos, 3);
    buffer.setUsage(THREE.StreamDrawUsage);
    geometry.setAttribute("position", buffer);
    geometry.setIndex(tetMesh.tetSurfaceTriIds);
    let material = new THREE.MeshPhysicalMaterial({color: 0xc9ffa1,  sample: 10, resolution:2048, roughness: 0.0, 
      transmission: 1.0, thickness: 3.5, clearcoat: 1.0, attenuationDistance: 0.5, attenuationColor: 0xffffff, temporalDistortion: 0.5,
      distortionScale: 0.2, distortion: 0.01, chromaticAberration: 0.06, ior: 1.5, anisotropy: 0.0});

    material.flatShading = false;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.geometry.computeVertexNormals();

    //for laycast
    this.mesh.userData = this;
    this.mesh.layers.enable(1);
    scene.add(this.mesh);
  }

  getNearestPointReference(x, y, z) {
    let toCompare = new Vector3([x, y, z], 0);

    let PosFound = null;
    let minDistSquared = Number.MAX_VALUE;
    let minDistIndex = -1;
    for (let i = 0; i < this.numParticles; i++) {
      let pos = new Vector3(this.pos, i);
      let distSquared = toCompare.sub(pos).squareLen();
      if (distSquared < minDistSquared) {
        minDistSquared = distSquared;
        minDistIndex = i;
      }
    }
    if (minDistIndex >= 0) {
      PosFound = new Vector3(this.pos, minDistIndex);
    }
    return PosFound;
  }

  getTetVolume(ith) {
    let a = new Vector3(this.pos, this.tetIds[4 * ith]);
    let b = new Vector3(this.pos, this.tetIds[4 * ith + 1]);
    let c = new Vector3(this.pos, this.tetIds[4 * ith + 2]);
    let d = new Vector3(this.pos, this.tetIds[4 * ith + 3]);

    let ab = b.sub(a);
    let ac = c.sub(a);
    let ad = d.sub(a);
    let volume = ab.cross(ac).dot(ad); //scalar triple product
    return volume / 6.0; //since tet div 6
  }

  initPhysics() {
    this.invMass.fill(0.0);
    this.restVol.fill(0.0);

    for (let i = 0; i < this.numTets; i++) {
      let vol = this.getTetVolume(i);
      this.restVol[i] = vol;
      let pInvMass = vol > 0.0 ? 1.0 / (vol / 4.0) : 0.0;
      this.invMass[this.tetIds[4 * i]] += pInvMass;
      this.invMass[this.tetIds[4 * i + 1]] += pInvMass;
      this.invMass[this.tetIds[4 * i + 2]] += pInvMass;
      this.invMass[this.tetIds[4 * i + 3]] += pInvMass;
    }
    for (let i = 0; i < this.edgeLengths.length; i++) {
      let leftPos = new Vector3(this.pos, this.edgeIds[2 * i]);
      let rightPos = new Vector3(this.pos, this.edgeIds[2 * i + 1]);
      this.edgeLengths[i] = rightPos.sub(leftPos).len();
    }
  }

  solveEdges(dt) {
    let alphadtSquared = 100 / (dt * dt);

    for (let i = 0; i < this.edgeLengths.length; i++) {
      let wL = this.invMass[this.edgeIds[2 * i]];
      let wR = this.invMass[this.edgeIds[2 * i + 1]];
      let w = wL + wR;
      if (w == 0.0) continue;

      let leftPos = new Vector3(this.pos, this.edgeIds[2 * i]);
      let rightPos = new Vector3(this.pos, this.edgeIds[2 * i + 1]);
      let currentLen = rightPos.sub(leftPos).len();

      if (currentLen == 0.0) continue;

      let errorOfConstrain = currentLen - this.edgeLengths[i];

      let grad = leftPos.sub(rightPos);
      let gradLeft = grad.mul(1.0 / currentLen);
      let gradRight = grad.mul(-1.0 / currentLen);

      let denominator = w + alphadtSquared;
      let lambda = -errorOfConstrain / denominator;
      let delPosLeft = gradLeft.mul(lambda * wL);
      let delPosRight = gradRight.mul(lambda * wR);

      leftPos.addSet(delPosLeft);
      rightPos.addSet(delPosRight);
    }
  }

  solveVolumes(dt) {
    let alphadtSquared = 0 / (dt * dt);

    //c=v-v0
    //delC is cross products
    for (let i = 0; i < this.numTets; i++) {
      let grads = [];
      let denominator = 0.0;
      for (let [top, triangles] of [
        [1, 3, 2],
        [0, 2, 3],
        [0, 3, 1],
        [0, 1, 2],
      ].entries()) {
        let a = new Vector3(this.pos, this.tetIds[4 * i + triangles[0]]);
        let b = new Vector3(this.pos, this.tetIds[4 * i + triangles[1]]);
        let c = new Vector3(this.pos, this.tetIds[4 * i + triangles[2]]);
        let ab = b.sub(a);
        let ac = c.sub(a);
        grads.push(ab.cross(ac).mul(1.0 / 6.0));
        denominator +=
          this.invMass[this.tetIds[4 * i + top]] * grads[top].squareLen();
      }

      if (denominator == 0.0) continue;
      denominator += alphadtSquared;

      let currentVolume = this.getTetVolume(i);

      let errorOfConstrain = currentVolume - this.restVol[i];

      let lambda = -errorOfConstrain / denominator;

      for (let [j, grad] of grads.entries()) {
        let pos = new Vector3(this.pos, this.tetIds[4 * i + j]);
        pos.addSet(grad.mul(lambda * this.invMass[this.tetIds[4 * i + j]]));
      }
    }
  }

  solve(dt) {
    for (let i = 0; i < this.numParticles; i++) {
      if (this.invMass[i] == 0.0) continue;
      let vel = new Vector3(this.vel, i);
      let prevPos = new Vector3(this.prevPos, i);
      let currentPos = new Vector3(this.pos, i);

      //vel+=grav*dt
      vel.addSet(gravity.mul(dt));
      //prev=pos
      prevPos.set(currentPos);
      //pos+=vel*dt
      currentPos.addSet(vel.mul(dt));

      //ground
      let y = currentPos.getY();
      if (y < 0.0) {
        currentPos.set(prevPos);
        currentPos.setY(0.0);
      }
    }

    //solve constrains
    this.solveEdges(dt);
    this.solveVolumes(dt);

    //update vel
    for (let i = 0; i < this.numParticles; i++) {
      if (this.invMass[i] == 0.0) continue;
      let vel = new Vector3(this.vel, i);
      let prevPos = new Vector3(this.prevPos, i);
      let currentPos = new Vector3(this.pos, i);
      let diff = currentPos.sub(prevPos);
      vel.set(diff.mul(1.0 / dt));
    }

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}

function awake() {
  window.addEventListener("resize", onWindowResize, false);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderWindow.appendChild(renderer.domElement);
  pickingControls = new PickingControls();
  renderWindow.addEventListener("pointerdown", onMouseDown, false);
  renderWindow.addEventListener("pointermove", onMouseMove, false);
  renderWindow.addEventListener("pointerup", onMouseUp, false);
}

function start() {
  const effectController = {
    turbidity: 0.1,
    rayleigh: 1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 20,
    azimuth: 135,
    exposure: renderer.toneMappingExposure,
  };

  // Add Sky
  sky = new Sky();
  sky.scale.setScalar(4000);
  scene.add(sky);
  sun = new THREE.Vector3();

  const uniforms = sky.material.uniforms;
  uniforms["turbidity"].value = effectController.turbidity;
  uniforms["rayleigh"].value = effectController.rayleigh;
  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms["sunPosition"].value.copy(sun);
  renderer.toneMappingExposure = effectController.exposure;

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
  hemiLight.color.setHSL(0.6, 1, 0.6);
  hemiLight.groundColor.setHSL(0.095, 1, 0.75);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.setFromSphericalCoords(5, phi, theta);
  dirLight.position.multiplyScalar(30);
  scene.add(dirLight);

  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;

  // GROUND
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  groundMat.color.setHSL(0.095, 1, 0.75);

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.0001;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let body = new Body(scene, bunnyMesh);
  mainObj = body;

  camera.position.z = 2;
  camera.position.y = 2;
  camera.position.x = 2;
  camControls.update();
}

function Update(dt) {
  let sdt = dt / numSubsteps;
  for (let step = 0; step < numSubsteps; step++) {
    mainObj.solve(sdt);
  }
}

function UpdateLoop(timestamp) {
  requestAnimationFrame(UpdateLoop);
  timer.update(timestamp);
  camControls.update();
  Update(1.0 / 60.0);
  renderer.render(scene, camera);
}

function main() {
  awake();
  start();
  UpdateLoop();
}

let bunnyMesh = {
  name: "bunny",
  verts: [
    0.1667, 0.032, 0.0191, 0.1474, 0.0432, 0.1918, 0.2237, 0.0267, 0.1427,
    -0.0349, 0.0627, 0.1842, -0.1422, 0.0246, 0.1666, -0.1443, 0.0308, 0.2591,
    -0.152, 0.0275, 0.0863, -0.1235, 0.0481, -0.023, -0.1631, 0.0197, 0.0288,
    -0.0744, 0.0422, 0.0948, -0.4601, 0.6411, 0.0977, -0.4277, 0.4754, 0.0296,
    -0.0827, 0.5775, 0.0648, -0.0923, 0.5318, 0.1807, -0.2836, 0.0971, 0.2413,
    0.1341, 0.6095, 0.1176, -0.2581, 0.7327, 0.1967, -0.41, 0.2577, 0.0661,
    -0.4343, 0.3047, 0.0676, -0.4551, 0.3656, 0.1178, 0.4151, 0.2519, 0.1277,
    0.4491, 0.2292, 0.1095, -0.194, 0.8358, -0.0275, -0.3391, 0.8015, -0.0768,
    -0.2984, 0.8024, -0.1404, -0.316, 0.9027, -0.3508, -0.0417, 0.4064, -0.1505,
    -0.1574, 0.3687, -0.1378, 0.0323, 0.5834, 0.1839, 0.0338, 0.5955, 0.0061,
    -0.3273, 0.0257, -0.0413, -0.4664, 0.5217, 0.1674, -0.412, 0.3103, 0.1827,
    -0.1099, 0.1349, -0.0605, -0.3218, 0.5167, -0.0584, -0.4631, 0.7279, 0.1017,
    -0.375, 0.7551, 0.1656, 0.1495, 0.4153, 0.2908, 0.1748, 0.5951, 0.0094,
    0.1752, 0.4043, -0.1377, -0.3367, 0.7533, 0.0104, -0.3748, 0.742, -0.0116,
    -0.4539, 0.4183, 0.0711, -0.4126, 0.8414, -0.2392, -0.2191, 0.7253, 0.0756,
    -0.2496, 0.7527, 0.0699, -0.4853, 0.5303, 0.1071, -0.4073, 0.5958, 0.3147,
    -0.37, 0.6586, 0.2969, -0.3641, 0.9011, -0.3114, -0.1031, 0.0686, 0.3093,
    -0.208, 0.2314, -0.0886, -0.3452, 0.6647, -0.0477, -0.2959, 0.7275, -0.0203,
    -0.2195, 0.0993, 0.1067, -0.2204, 0.15, 0.1047, -0.3431, 0.505, 0.3132,
    -0.0204, 0.3329, -0.2352, 0.0602, 0.3103, -0.2269, -0.1341, 0.7232, -0.0019,
    -0.3155, 0.5402, 0.3149, -0.2808, 0.8625, -0.3723, -0.0523, 0.8637, -0.1265,
    -0.1483, 0.7646, -0.0696, 0.35, 0.4151, 0.0209, 0.3799, 0.1483, -0.0381,
    0.4126, 0.1121, 0.0225, -0.2962, 0.6754, -0.0449, 0.0689, 0.4841, 0.2612,
    -0.217, 0.6736, 0.017, -0.3089, 0.3594, 0.2701, -0.3657, 0.4575, 0.2191,
    0.065, 0.1457, 0.3302, 0.3456, 0.0605, 0.0104, 0.3414, 0.3522, -0.0423,
    -0.2886, 0.0332, 0.1229, -0.2998, 0.4872, 0.2276, 0.1421, 0.3457, 0.3352,
    0.1154, 0.1785, 0.333, -0.4515, 0.6367, 0.1707, -0.4721, 0.5464, 0.2503,
    -0.2863, 0.7957, -0.2558, -0.2152, 0.6694, 0.0676, 0.185, 0.1528, 0.2982,
    0.1498, 0.0871, 0.2724, 0.4507, 0.1932, 0.0397, -0.2929, 0.7929, -0.3524,
    0.2004, 0.4327, 0.2715, -0.2914, 0.731, 0.2138, -0.2698, 0.2782, 0.2583,
    -0.3454, 0.2597, 0.2157, 0.3642, 0.247, 0.0231, 0.1806, 0.2881, 0.3214,
    -0.1371, 0.7865, 0.0047, -0.256, 0.1605, 0.036, 0.3461, 0.1195, 0.1971,
    0.2736, 0.5334, 0.1387, 0.3035, 0.1373, 0.1947, -0.2574, 0.7019, -0.0082,
    0.2107, 0.0318, -0.0122, -0.2548, 0.1799, -0.0281, -0.3592, 0.8459, -0.3151,
    -0.321, 0.7476, -0.3192, -0.2232, 0.5181, 0.2013, -0.3563, 0.7122, -0.2072,
    0.0494, 0.431, 0.2676, -0.1898, 0.2528, 0.2488, -0.2085, 0.0248, -0.0803,
    -0.2518, 0.0684, 0.2804, -0.2076, 0.3639, 0.2738, 0.4042, 0.188, 0.181,
    0.367, 0.258, 0.1204, -0.1638, 0.0816, -0.1354, -0.1625, 0.4547, 0.2408,
    0.0641, 0.2601, 0.3494, 0.1908, 0.5486, 0.2023, -0.3569, 0.0314, 0.0316,
    -0.2098, 0.1214, 0.2193, -0.1434, 0.1082, 0.2369, -0.1786, 0.5669, 0.1469,
    0.0156, 0.8858, -0.1638, 0.2624, 0.3563, -0.1269, 0.2944, 0.3039, -0.1066,
    -0.1524, 0.3434, 0.2601, -0.0977, 0.8827, -0.0246, -0.1062, 0.3266, 0.255,
    -0.074, 0.4453, 0.2546, -0.081, 0.1479, 0.2159, 0.0428, 0.3958, 0.332,
    -0.0657, 0.3922, 0.2721, 0.4248, 0.2452, 0.0328, -0.0601, 0.0972, 0.3182,
    0.076, 0.4956, -0.1222, -0.0136, 0.1156, 0.2928, -0.0193, 0.9447, -0.1214,
    -0.2288, 0.12, 0.1634, -0.1335, 0.3173, -0.1318, -0.1521, 0.0218, -0.1868,
    -0.0544, 0.1042, -0.1688, -0.0486, 0.3108, 0.3412, -0.0191, 0.2128, 0.3181,
    -0.4362, 0.632, 0.0098, 0.2887, 0.3767, 0.2443, -0.0336, 0.7787, -0.0261,
    0.2502, 0.1172, -0.1113, 0.1954, 0.0824, -0.1357, 0.3129, 0.2146, -0.0761,
    0.3037, 0.1433, -0.0441, -0.0711, 0.0353, 0.3273, 0.2883, 0.4618, -0.0612,
    -0.2626, 0.1112, 0.0419, 0.4238, 0.119, 0.1237, -0.2952, 0.6381, 0.2271,
    -0.2766, 0.5595, 0.2573, 0.2983, 0.1897, 0.2281, 0.3458, 0.3828, 0.153,
    -0.1021, 0.4839, -0.1137, 0.2589, 0.2605, 0.2631, -0.0429, 0.4487, -0.1384,
    0.0322, 0.8266, -0.1303, 0.1893, 0.0358, 0.2597, 0.0138, 0.7992, -0.0826,
    -0.2432, 0.6588, 0.1768, -0.2864, 0.0307, 0.271, -0.3452, 0.6849, -0.0928,
    -0.0865, 0.1189, -0.1409, -0.3716, 0.3747, -0.0853, 0.1722, 0.0326, -0.1287,
    -0.4131, 0.4687, 0.1715, -0.4471, 0.6731, 0.2197, -0.4554, 0.4954, 0.2326,
    -0.4376, 0.5458, -0.012, 0.0521, 0.0236, -0.1437, -0.3329, 0.0807, 0.0345,
    -0.318, 0.0391, 0.1693, -0.0631, 0.3676, -0.2114, -0.3939, 0.4969, 0.2861,
    0.2089, 0.1629, -0.1624, 0.1427, 0.0261, -0.0882, 0.0602, 0.0469, -0.0274,
    0.1069, 0.3825, -0.1983, -0.2828, 0.7494, 0.0235, -0.1715, 0.5951, 0.0794,
    -0.086, 0.2864, -0.2215, 0.2796, 0.5242, 0.0345, 0.2034, 0.4408, -0.119,
    -0.2493, 0.1088, -0.0287, -0.2133, 0.5922, -0.0207, -0.2524, 0.3879,
    -0.1285, -0.4372, 0.5181, 0.2856, -0.2468, 0.4735, -0.1103, -0.0688, 0.1837,
    -0.1905, 0.1823, 0.5376, -0.0745, 0.2589, 0.0243, 0.0765, -0.3756, 0.7147,
    -0.0322, -0.3913, 0.2707, -0.0285, -0.2942, 0.2725, -0.1139, 0.1176, 0.0286,
    0.0569, -0.4241, 0.358, -0.0278, -0.1085, 0.5496, -0.0465, 0.0431, 0.5686,
    -0.0526, -0.1765, 0.5626, -0.0652, 0.0887, 0.1117, -0.1823, 0.1388, 0.2287,
    -0.1969, -0.0065, 0.2046, -0.2236, -0.2223, 0.197, 0.2025, 0.0543, 0.0479,
    0.0927, -0.2713, 0.0196, 0.1024, -0.3406, 0.1901, 0.0982, -0.1317, 0.0228,
    -0.1243, -0.0647, 0.0442, -0.0624, -0.392, 0.3003, 0.0961, -0.392, 0.3936,
    0.0025, -0.392, 0.3936, 0.0962, -0.392, 0.4877, 0.0962, -0.392, 0.4877,
    0.1897, -0.392, 0.5813, 0.096, -0.392, 0.5813, 0.1893, -0.392, 0.6747,
    0.096, -0.392, 0.6747, 0.1893, -0.298, 0.3003, 0.0022, -0.298, 0.3003,
    0.0961, -0.298, 0.3003, 0.1897, -0.298, 0.3941, 0.0022, -0.298, 0.3941,
    0.0961, -0.298, 0.3941, 0.1897, -0.298, 0.4877, 0.0026, -0.298, 0.4877,
    0.0962, -0.298, 0.581, 0.0024, -0.298, 0.581, 0.0959, -0.298, 0.581, 0.1895,
    -0.298, 0.6747, 0.0023, -0.298, 0.6747, 0.0959, -0.2048, 0.1131, 0.0959,
    -0.2048, 0.2069, 0.0023, -0.2048, 0.2069, 0.0962, -0.2048, 0.3003, 0.0025,
    -0.2048, 0.3003, 0.0961, -0.2048, 0.3003, 0.1894, -0.2048, 0.3939, 0.0024,
    -0.2048, 0.3939, 0.096, -0.2048, 0.3939, 0.1893, -0.2048, 0.4872, 0.0021,
    -0.2048, 0.4872, 0.0958, -0.2048, 0.5813, 0.0958, -0.1108, 0.113, 0.0023,
    -0.1108, 0.113, 0.096, -0.1108, 0.113, 0.1895, -0.1108, 0.2068, 0.0023,
    -0.1108, 0.2068, 0.0957, -0.1108, 0.2068, 0.1894, -0.1108, 0.3004, -0.0915,
    -0.1108, 0.3004, 0.0023, -0.1108, 0.3004, 0.0957, -0.1108, 0.3004, 0.1898,
    -0.1108, 0.3941, -0.0912, -0.1108, 0.3941, 0.0026, -0.1108, 0.3941, 0.0959,
    -0.1108, 0.3941, 0.1898, -0.1108, 0.4873, 0.0022, -0.1108, 0.4873, 0.0958,
    -0.0174, 0.1129, -0.0915, -0.0174, 0.1129, 0.0026, -0.0174, 0.1129, 0.0959,
    -0.0174, 0.1129, 0.1896, -0.0174, 0.2067, -0.091, -0.0174, 0.2067, 0.0026,
    -0.0174, 0.2067, 0.096, -0.0174, 0.2067, 0.1896, -0.0174, 0.3002, -0.0911,
    -0.0174, 0.3002, 0.0025, -0.0174, 0.3002, 0.0959, -0.0174, 0.3002, 0.1897,
    -0.0174, 0.3002, 0.2829, -0.0174, 0.3939, -0.0911, -0.0174, 0.3939, 0.0026,
    -0.0174, 0.3939, 0.0957, -0.0174, 0.3939, 0.1893, -0.0174, 0.4875, 0.0023,
    -0.0174, 0.4875, 0.096, -0.0174, 0.4875, 0.1896, 0.0763, 0.1132, -0.0912,
    0.0763, 0.1132, 0.0021, 0.0763, 0.1132, 0.0957, 0.0763, 0.1132, 0.1893,
    0.0763, 0.2068, -0.0915, 0.0763, 0.2068, 0.0026, 0.0763, 0.2068, 0.0959,
    0.0763, 0.2068, 0.1898, 0.0763, 0.2068, 0.2832, 0.0763, 0.3003, -0.0913,
    0.0763, 0.3003, 0.0022, 0.0763, 0.3003, 0.0962, 0.0763, 0.3003, 0.1895,
    0.0763, 0.3003, 0.2831, 0.0763, 0.3941, -0.0914, 0.0763, 0.3941, 0.0021,
    0.0763, 0.3941, 0.0961, 0.0763, 0.3941, 0.1897, 0.0763, 0.4877, 0.0021,
    0.0763, 0.4877, 0.096, 0.0763, 0.4877, 0.1893, 0.1701, 0.1133, -0.091,
    0.1701, 0.1133, 0.0024, 0.1701, 0.1133, 0.0962, 0.1701, 0.1133, 0.1897,
    0.1701, 0.2066, -0.0914, 0.1701, 0.2066, 0.0024, 0.1701, 0.2066, 0.0958,
    0.1701, 0.2066, 0.1894, 0.1701, 0.3004, -0.0913, 0.1701, 0.3004, 0.0024,
    0.1701, 0.3004, 0.0962, 0.1701, 0.3004, 0.1896, 0.1701, 0.3939, -0.091,
    0.1701, 0.3939, 0.0026, 0.1701, 0.3939, 0.0961, 0.1701, 0.3939, 0.1897,
    0.1701, 0.4877, 0.0023, 0.1701, 0.4877, 0.0959, 0.1701, 0.4877, 0.1897,
    0.2634, 0.1132, 0.0026, 0.2634, 0.1132, 0.096, 0.2634, 0.2064, 0.0023,
    0.2634, 0.2064, 0.0961, 0.2634, 0.2064, 0.1896, 0.2634, 0.3001, 0.0022,
    0.2634, 0.3001, 0.096, 0.2634, 0.3001, 0.1898, 0.2634, 0.3941, 0.0026,
    0.2634, 0.3941, 0.0958, 0.2634, 0.3941, 0.1895, 0.3571, 0.2069, 0.0957,
  ],
  tetIds: [
    233, 6, 8, 245, 100, 51, 33, 186, 287, 283, 286, 308, 206, 1, 197, 283, 5,
    3, 4, 247, 9, 4, 3, 247, 197, 0, 179, 282, 163, 14, 108, 174, 50, 5, 3, 148,
    281, 167, 202, 302, 71, 70, 32, 225, 245, 6, 9, 246, 75, 4, 54, 135, 265,
    251, 248, 269, 210, 172, 138, 261, 9, 7, 8, 245, 107, 7, 8, 209, 276, 275,
    260, 279, 50, 3, 5, 247, 158, 156, 26, 255, 234, 100, 220, 236, 45, 36, 40,
    232, 187, 12, 182, 199, 228, 216, 226, 229, 198, 195, 166, 220, 9, 6, 4,
    246, 233, 8, 186, 245, 237, 236, 221, 240, 286, 283, 282, 303, 290, 265,
    285, 291, 252, 236, 249, 253, 108, 5, 4, 117, 124, 93, 63, 143, 115, 28, 15,
    301, 158, 26, 132, 295, 215, 76, 71, 227, 208, 32, 90, 211, 150, 30, 8, 207,
    221, 220, 212, 223, 196, 195, 100, 220, 216, 10, 79, 218, 32, 17, 18, 211,
    169, 47, 80, 217, 152, 88, 16, 162, 297, 293, 292, 316, 291, 290, 274, 296,
    148, 1, 84, 160, 304, 2, 193, 322, 157, 154, 83, 325, 285, 281, 202, 306,
    115, 87, 96, 142, 41, 40, 35, 218, 91, 66, 85, 332, 226, 171, 216, 228, 43,
    23, 41, 194, 28, 13, 12, 279, 141, 35, 10, 218, 195, 18, 17, 211, 248, 33,
    51, 251, 136, 51, 27, 188, 257, 253, 256, 276, 265, 33, 262, 266, 93, 22,
    63, 98, 29, 15, 28, 300, 128, 37, 77, 294, 93, 59, 63, 143, 299, 278, 296,
    300, 87, 37, 68, 320, 54, 8, 6, 207, 183, 57, 175, 269, 196, 166, 195, 220,
    170, 31, 80, 217, 214, 46, 31, 216, 168, 32, 19, 213, 32, 18, 19, 211, 176,
    76, 71, 215, 196, 188, 166, 220, 208, 100, 195, 220, 251, 183, 136, 269, 49,
    25, 24, 81, 208, 90, 205, 222, 225, 224, 168, 227, 69, 59, 44, 82, 53, 40,
    41, 194, 88, 48, 36, 219, 43, 23, 24, 49, 169, 35, 36, 219, 228, 52, 141,
    231, 194, 40, 41, 231, 262, 245, 246, 266, 249, 246, 245, 266, 124, 62, 22,
    134, 115, 87, 68, 320, 291, 275, 276, 297, 38, 15, 29, 300, 96, 15, 38, 319,
    296, 278, 275, 300, 192, 149, 184, 318, 40, 36, 35, 218, 53, 41, 23, 194,
    41, 23, 40, 53, 81, 24, 43, 104, 213, 42, 168, 214, 198, 11, 42, 212, 217,
    79, 169, 219, 168, 46, 31, 214, 80, 31, 79, 217, 93, 44, 45, 98, 45, 44, 16,
    232, 98, 44, 45, 232, 45, 16, 36, 232, 218, 35, 79, 219, 169, 80, 79, 217,
    169, 48, 47, 217, 79, 31, 46, 216, 152, 47, 48, 217, 216, 79, 31, 217, 49,
    24, 43, 81, 206, 3, 1, 284, 205, 118, 117, 250, 150, 55, 54, 233, 247, 127,
    246, 250, 246, 9, 245, 262, 224, 212, 214, 226, 43, 24, 23, 104, 228, 141,
    216, 231, 82, 44, 69, 98, 69, 59, 63, 98, 231, 218, 216, 232, 218, 194, 41,
    231, 274, 156, 259, 278, 107, 7, 33, 186, 54, 6, 4, 207, 135, 117, 4, 247,
    246, 233, 4, 247, 150, 94, 55, 233, 186, 7, 33, 245, 54, 6, 8, 233, 260,
    259, 12, 278, 236, 221, 235, 237, 188, 51, 27, 236, 114, 77, 92, 294, 221,
    212, 213, 224, 42, 19, 18, 213, 109, 89, 70, 222, 191, 183, 136, 251, 210,
    165, 33, 261, 58, 26, 57, 269, 180, 26, 58, 295, 251, 51, 248, 252, 180, 39,
    132, 295, 291, 285, 290, 306, 147, 146, 144, 306, 69, 44, 59, 98, 259, 156,
    199, 278, 219, 36, 88, 232, 229, 227, 103, 230, 158, 132, 156, 200, 313, 87,
    142, 317, 308, 303, 307, 321, 184, 149, 64, 329, 193, 151, 73, 322, 151, 21,
    85, 332, 304, 193, 303, 321, 53, 23, 24, 164, 67, 52, 53, 164, 215, 168,
    214, 227, 93, 45, 22, 181, 181, 53, 98, 231, 227, 226, 214, 229, 67, 52, 34,
    228, 271, 253, 254, 277, 279, 28, 13, 280, 192, 132, 185, 314, 269, 252,
    248, 270, 234, 94, 55, 235, 220, 211, 17, 221, 288, 284, 287, 309, 198, 42,
    18, 212, 60, 47, 48, 153, 60, 56, 47, 176, 275, 260, 256, 276, 240, 224,
    237, 241, 131, 50, 3, 148, 130, 91, 85, 332, 306, 302, 144, 323, 155, 111,
    142, 328, 110, 95, 97, 332, 146, 74, 122, 326, 285, 204, 269, 290, 185, 39,
    121, 314, 168, 71, 32, 213, 215, 71, 168, 227, 162, 119, 103, 230, 187, 69,
    67, 231, 153, 119, 103, 162, 227, 224, 226, 243, 211, 195, 18, 212, 90, 70,
    89, 222, 263, 3, 206, 264, 114, 92, 78, 289, 298, 37, 294, 317, 92, 77, 37,
    313, 245, 7, 210, 262, 84, 78, 83, 289, 218, 79, 217, 219, 215, 214, 31,
    217, 98, 69, 82, 231, 189, 80, 47, 217, 153, 47, 152, 217, 189, 170, 80,
    217, 81, 25, 61, 101, 81, 43, 49, 101, 104, 67, 24, 164, 187, 182, 82, 244,
    272, 268, 267, 292, 322, 73, 321, 332, 92, 37, 87, 317, 157, 83, 92, 309,
    84, 72, 78, 289, 304, 1, 2, 305, 85, 65, 66, 91, 91, 85, 65, 130, 81, 49,
    25, 101, 115, 15, 96, 319, 162, 103, 153, 230, 88, 36, 16, 232, 153, 103,
    76, 230, 231, 98, 181, 232, 139, 125, 129, 273, 131, 3, 127, 133, 190, 34,
    166, 223, 243, 103, 119, 244, 90, 32, 70, 222, 73, 66, 65, 147, 285, 203,
    58, 290, 142, 87, 96, 331, 130, 20, 111, 332, 63, 62, 22, 124, 221, 208, 94,
    235, 173, 75, 116, 207, 233, 94, 55, 234, 186, 150, 8, 233, 150, 54, 8, 233,
    205, 90, 89, 222, 208, 17, 32, 211, 208, 205, 55, 235, 271, 266, 270, 286,
    275, 253, 270, 276, 323, 321, 147, 332, 302, 99, 144, 321, 325, 111, 154,
    332, 151, 85, 66, 332, 282, 266, 262, 286, 160, 2, 1, 305, 160, 83, 97, 305,
    67, 53, 52, 231, 181, 40, 53, 231, 93, 59, 44, 98, 93, 63, 59, 98, 321, 304,
    193, 322, 202, 145, 177, 302, 327, 111, 155, 328, 208, 94, 100, 220, 173,
    30, 150, 207, 100, 33, 51, 234, 234, 186, 33, 245, 107, 30, 8, 186, 107, 8,
    7, 186, 86, 81, 61, 101, 101, 81, 43, 102, 101, 86, 81, 102, 102, 81, 43,
    104, 196, 100, 51, 220, 214, 31, 168, 215, 217, 76, 215, 230, 230, 162, 229,
    232, 215, 189, 176, 217, 152, 48, 47, 153, 109, 70, 76, 225, 76, 70, 71,
    225, 123, 106, 109, 238, 166, 34, 11, 212, 126, 113, 13, 258, 104, 24, 23,
    164, 164, 23, 104, 194, 214, 11, 46, 216, 274, 132, 158, 278, 248, 245, 33,
    266, 264, 3, 206, 284, 245, 9, 7, 262, 114, 78, 72, 289, 128, 77, 114, 294,
    239, 224, 221, 240, 233, 54, 4, 247, 205, 106, 118, 250, 266, 249, 263, 267,
    179, 0, 178, 303, 112, 7, 107, 209, 173, 150, 30, 186, 150, 8, 30, 186, 174,
    75, 163, 207, 135, 75, 4, 174, 108, 4, 5, 163, 221, 94, 220, 234, 222, 109,
    89, 238, 211, 19, 32, 213, 213, 211, 212, 221, 324, 97, 322, 332, 322, 95,
    151, 332, 110, 20, 21, 332, 325, 324, 111, 332, 324, 321, 323, 332, 274,
    259, 256, 275, 326, 311, 308, 327, 91, 64, 74, 326, 155, 142, 96, 331, 112,
    33, 7, 209, 107, 33, 7, 112, 302, 282, 178, 303, 165, 112, 137, 209, 199,
    12, 182, 259, 123, 109, 113, 241, 113, 76, 103, 241, 256, 243, 240, 257,
    214, 212, 11, 226, 126, 68, 105, 280, 300, 296, 299, 315, 313, 294, 37, 317,
    150, 54, 75, 207, 163, 4, 75, 174, 117, 108, 14, 174, 117, 108, 5, 118, 117,
    5, 4, 118, 118, 4, 117, 247, 246, 55, 233, 247, 127, 3, 50, 247, 140, 72,
    133, 289, 247, 118, 127, 250, 113, 103, 13, 260, 226, 224, 223, 243, 190,
    188, 27, 239, 242, 226, 239, 243, 243, 226, 229, 244, 182, 119, 162, 244,
    134, 62, 120, 159, 147, 91, 146, 323, 309, 289, 92, 313, 155, 96, 64, 330,
    180, 132, 26, 295, 269, 248, 265, 270, 324, 323, 308, 327, 180, 121, 39,
    203, 237, 221, 224, 240, 234, 221, 94, 235, 272, 250, 268, 273, 129, 105,
    128, 273, 125, 106, 123, 254, 234, 55, 233, 235, 212, 198, 166, 220, 109,
    106, 89, 238, 124, 63, 62, 143, 93, 63, 22, 124, 93, 22, 45, 124, 140, 125,
    139, 273, 136, 27, 51, 236, 235, 233, 234, 249, 241, 113, 123, 258, 251,
    239, 236, 252, 245, 234, 233, 249, 238, 205, 235, 250, 129, 123, 113, 258,
    247, 127, 3, 264, 126, 28, 68, 280, 239, 236, 27, 251, 275, 274, 259, 278,
    206, 179, 9, 262, 266, 248, 249, 270, 133, 3, 127, 264, 264, 206, 263, 284,
    92, 83, 78, 289, 127, 50, 118, 247, 205, 117, 135, 247, 118, 117, 106, 205,
    129, 125, 123, 258, 139, 128, 114, 273, 266, 265, 248, 270, 258, 125, 254,
    277, 129, 113, 126, 258, 130, 85, 21, 332, 127, 118, 50, 131, 127, 50, 3,
    131, 133, 131, 3, 148, 133, 1, 3, 284, 200, 192, 38, 299, 274, 270, 269,
    291, 58, 57, 26, 180, 143, 63, 62, 161, 133, 3, 1, 148, 133, 1, 84, 148,
    133, 72, 84, 284, 135, 4, 54, 247, 117, 4, 108, 174, 208, 195, 17, 220, 208,
    55, 94, 235, 220, 208, 94, 221, 205, 135, 55, 250, 203, 180, 58, 290, 204,
    58, 57, 269, 175, 26, 136, 269, 243, 241, 240, 257, 243, 240, 239, 256, 236,
    27, 188, 239, 136, 26, 27, 255, 250, 237, 238, 254, 234, 220, 221, 236, 175,
    57, 26, 269, 178, 167, 172, 202, 209, 172, 138, 210, 282, 178, 281, 302,
    273, 140, 268, 289, 268, 140, 133, 289, 250, 140, 127, 268, 250, 125, 140,
    273, 140, 139, 114, 273, 272, 129, 125, 273, 218, 41, 40, 231, 216, 141, 10,
    218, 171, 11, 34, 226, 256, 252, 255, 274, 282, 206, 197, 283, 302, 178, 99,
    303, 270, 265, 269, 291, 281, 179, 178, 282, 178, 0, 99, 303, 326, 308, 323,
    327, 321, 147, 144, 323, 193, 73, 99, 321, 193, 99, 0, 321, 321, 66, 147,
    332, 91, 65, 66, 332, 173, 116, 30, 207, 186, 33, 100, 234, 151, 2, 95, 193,
    111, 20, 110, 332, 130, 111, 91, 332, 215, 176, 76, 217, 152, 60, 48, 153,
    218, 36, 35, 219, 76, 71, 56, 176, 76, 56, 60, 176, 197, 2, 0, 304, 325,
    154, 111, 328, 322, 305, 97, 325, 282, 197, 0, 303, 284, 84, 1, 305, 312,
    292, 297, 315, 306, 144, 147, 323, 327, 155, 64, 330, 111, 64, 91, 327, 236,
    136, 27, 251, 182, 12, 119, 260, 227, 225, 224, 241, 183, 175, 136, 269,
    304, 287, 284, 309, 142, 92, 87, 313, 240, 239, 224, 243, 251, 27, 239, 255,
    291, 276, 271, 292, 160, 1, 84, 305, 159, 62, 63, 161, 159, 134, 62, 161,
    162, 44, 82, 232, 229, 216, 217, 232, 227, 76, 103, 230, 182, 162, 82, 244,
    171, 46, 11, 216, 226, 216, 214, 229, 228, 187, 82, 244, 217, 216, 79, 218,
    163, 75, 4, 207, 135, 4, 117, 174, 135, 117, 14, 174, 171, 52, 141, 228,
    164, 52, 53, 194, 67, 53, 24, 164, 199, 182, 187, 259, 210, 138, 165, 261,
    165, 137, 138, 209, 210, 179, 172, 261, 212, 166, 34, 223, 188, 136, 51,
    196, 179, 178, 172, 281, 281, 178, 167, 302, 168, 19, 42, 213, 176, 153, 76,
    217, 217, 214, 216, 229, 216, 31, 214, 217, 217, 48, 152, 219, 152, 48, 88,
    219, 169, 36, 48, 219, 189, 176, 170, 215, 141, 10, 46, 216, 214, 171, 11,
    216, 202, 138, 172, 261, 210, 7, 9, 262, 163, 108, 4, 174, 175, 26, 57, 180,
    189, 47, 176, 217, 153, 76, 60, 176, 153, 60, 47, 217, 177, 145, 144, 302,
    203, 121, 39, 310, 265, 248, 33, 266, 261, 172, 202, 281, 202, 167, 145,
    302, 167, 99, 145, 302, 179, 178, 0, 197, 251, 33, 191, 265, 328, 155, 327,
    331, 282, 265, 266, 286, 270, 269, 252, 274, 245, 210, 33, 262, 251, 248,
    33, 265, 231, 82, 98, 232, 98, 53, 67, 231, 232, 162, 229, 244, 181, 45, 40,
    232, 98, 45, 93, 181, 98, 93, 22, 181, 223, 190, 34, 226, 190, 27, 156, 255,
    115, 96, 87, 320, 192, 184, 38, 318, 185, 132, 39, 314, 149, 121, 74, 329,
    149, 74, 64, 329, 329, 64, 184, 330, 287, 267, 268, 292, 285, 265, 282, 286,
    186, 8, 7, 245, 186, 94, 150, 245, 218, 216, 141, 231, 231, 181, 40, 232,
    226, 187, 34, 228, 242, 190, 156, 255, 98, 69, 67, 187, 188, 27, 136, 196,
    220, 94, 100, 234, 211, 90, 208, 221, 201, 156, 199, 259, 156, 27, 26, 255,
    201, 190, 156, 242, 212, 34, 11, 226, 119, 13, 103, 243, 239, 223, 226, 242,
    190, 166, 188, 223, 302, 177, 202, 306, 191, 165, 138, 265, 204, 57, 183,
    269, 204, 138, 202, 261, 299, 296, 295, 314, 275, 270, 274, 291, 97, 95, 2,
    322, 193, 95, 151, 322, 164, 53, 23, 194, 104, 23, 43, 194, 194, 52, 53,
    231, 194, 41, 141, 218, 196, 51, 188, 236, 223, 34, 212, 226, 198, 18, 195,
    212, 283, 262, 266, 286, 282, 0, 179, 303, 305, 2, 304, 322, 246, 3, 9, 263,
    270, 266, 265, 291, 198, 166, 11, 212, 199, 29, 12, 278, 200, 156, 158, 278,
    226, 223, 190, 242, 223, 220, 188, 239, 220, 51, 196, 236, 119, 12, 13, 260,
    259, 12, 182, 260, 200, 132, 192, 299, 200, 38, 29, 299, 201, 34, 190, 242,
    191, 33, 165, 265, 204, 203, 58, 285, 204, 202, 203, 285, 204, 191, 138,
    265, 177, 146, 122, 306, 177, 122, 121, 203, 127, 118, 106, 250, 211, 17,
    195, 220, 206, 197, 179, 282, 326, 91, 64, 327, 267, 263, 266, 283, 140,
    133, 127, 268, 284, 264, 133, 289, 304, 284, 1, 305, 193, 0, 2, 304, 283,
    266, 267, 287, 197, 1, 2, 304, 75, 54, 4, 207, 150, 8, 54, 207, 173, 150,
    75, 207, 205, 89, 106, 238, 211, 208, 17, 221, 212, 211, 195, 220, 220, 188,
    166, 223, 212, 11, 42, 213, 172, 138, 137, 209, 209, 138, 165, 210, 165, 33,
    112, 209, 209, 33, 7, 210, 137, 112, 107, 209, 210, 9, 179, 262, 209, 165,
    33, 210, 212, 195, 198, 220, 220, 17, 208, 221, 212, 42, 18, 213, 211, 18,
    19, 213, 212, 18, 211, 213, 211, 32, 90, 222, 221, 213, 211, 222, 220, 212,
    211, 221, 213, 32, 211, 222, 220, 166, 212, 223, 213, 11, 42, 214, 213, 168,
    71, 225, 214, 213, 212, 224, 213, 212, 11, 214, 216, 214, 171, 226, 176, 71,
    170, 215, 228, 67, 52, 231, 216, 171, 141, 228, 79, 46, 10, 216, 171, 141,
    46, 216, 171, 34, 52, 228, 218, 217, 216, 232, 230, 217, 219, 232, 217, 153,
    76, 230, 229, 228, 216, 232, 176, 60, 153, 217, 176, 47, 60, 217, 215, 170,
    189, 217, 215, 31, 170, 217, 219, 217, 218, 232, 79, 10, 35, 218, 141, 41,
    35, 218, 194, 141, 52, 231, 162, 152, 88, 232, 162, 88, 16, 232, 162, 16,
    44, 232, 169, 79, 35, 219, 217, 169, 48, 219, 230, 152, 162, 232, 219, 218,
    36, 232, 234, 51, 100, 236, 239, 190, 223, 242, 224, 221, 223, 239, 235,
    234, 221, 236, 226, 214, 224, 227, 236, 51, 136, 251, 249, 235, 55, 250,
    223, 212, 221, 224, 221, 211, 90, 222, 224, 213, 222, 225, 222, 205, 221,
    235, 224, 222, 221, 241, 253, 241, 237, 254, 113, 109, 76, 241, 222, 221,
    213, 224, 213, 71, 32, 225, 221, 90, 208, 222, 221, 208, 205, 222, 222, 70,
    109, 225, 225, 71, 76, 227, 214, 168, 213, 224, 224, 214, 168, 227, 243,
    182, 242, 244, 224, 223, 212, 226, 201, 187, 34, 242, 236, 220, 221, 239,
    223, 188, 190, 239, 227, 103, 225, 241, 241, 103, 113, 243, 237, 224, 221,
    241, 225, 222, 224, 241, 225, 76, 103, 227, 224, 168, 213, 225, 225, 168,
    71, 227, 222, 213, 32, 225, 222, 32, 70, 225, 214, 11, 171, 226, 229, 226,
    228, 244, 187, 67, 34, 228, 204, 183, 191, 269, 242, 228, 226, 244, 242,
    187, 228, 244, 217, 215, 214, 230, 226, 34, 171, 228, 231, 228, 82, 232, 98,
    67, 69, 231, 187, 82, 69, 228, 229, 214, 227, 230, 217, 152, 153, 230, 229,
    82, 228, 232, 230, 229, 217, 232, 219, 152, 217, 230, 229, 103, 227, 244,
    243, 119, 182, 244, 230, 162, 119, 244, 230, 103, 229, 244, 162, 153, 152,
    230, 229, 217, 214, 230, 227, 214, 215, 230, 227, 215, 76, 230, 218, 141,
    194, 231, 194, 53, 40, 231, 231, 40, 218, 232, 181, 98, 45, 232, 228, 82,
    69, 231, 228, 69, 187, 231, 228, 187, 67, 231, 231, 216, 228, 232, 218, 40,
    36, 232, 98, 82, 44, 232, 219, 88, 152, 232, 230, 219, 152, 232, 235, 55,
    233, 249, 135, 54, 55, 233, 54, 4, 6, 233, 223, 221, 220, 239, 236, 235,
    234, 249, 245, 233, 6, 246, 234, 94, 186, 245, 186, 100, 94, 234, 220, 100,
    51, 236, 221, 205, 208, 235, 236, 234, 51, 252, 237, 235, 236, 249, 235,
    221, 222, 238, 250, 106, 125, 254, 240, 237, 236, 253, 220, 196, 188, 236,
    258, 129, 125, 277, 239, 221, 236, 240, 249, 248, 236, 252, 245, 33, 234,
    248, 255, 239, 252, 256, 225, 109, 222, 241, 241, 224, 227, 243, 235, 222,
    205, 238, 238, 235, 237, 250, 242, 156, 201, 259, 259, 182, 243, 260, 240,
    236, 239, 253, 129, 126, 105, 277, 313, 312, 293, 317, 237, 221, 235, 238,
    222, 89, 205, 238, 225, 76, 109, 241, 236, 188, 220, 239, 241, 240, 224,
    243, 241, 227, 103, 243, 225, 103, 76, 241, 241, 123, 238, 254, 241, 237,
    240, 257, 252, 239, 236, 253, 252, 251, 239, 255, 238, 221, 222, 241, 238,
    237, 221, 241, 238, 222, 109, 241, 272, 271, 254, 277, 254, 241, 123, 258,
    238, 109, 123, 241, 243, 239, 242, 256, 255, 242, 239, 256, 226, 190, 34,
    242, 226, 34, 187, 242, 201, 199, 187, 242, 229, 227, 226, 243, 243, 242,
    226, 244, 228, 226, 187, 242, 243, 113, 241, 260, 239, 223, 224, 243, 239,
    226, 223, 243, 243, 227, 103, 244, 243, 229, 227, 244, 230, 119, 103, 244,
    230, 229, 162, 244, 229, 228, 82, 244, 242, 182, 187, 244, 232, 82, 162,
    244, 232, 229, 82, 244, 249, 245, 248, 266, 247, 246, 55, 250, 269, 204, 58,
    290, 262, 9, 206, 263, 261, 210, 179, 262, 210, 33, 7, 245, 234, 233, 94,
    245, 233, 150, 94, 245, 233, 186, 150, 245, 9, 8, 6, 245, 233, 4, 6, 246,
    233, 55, 135, 247, 246, 245, 233, 249, 246, 233, 55, 249, 234, 33, 51, 248,
    206, 9, 3, 263, 247, 3, 246, 264, 249, 246, 127, 250, 235, 205, 55, 250,
    233, 135, 54, 247, 246, 4, 9, 247, 246, 9, 3, 247, 118, 50, 5, 247, 118, 5,
    4, 247, 253, 237, 241, 257, 29, 28, 12, 279, 306, 285, 290, 310, 252, 249,
    248, 270, 263, 206, 262, 283, 267, 127, 264, 268, 254, 125, 250, 273, 280,
    277, 279, 301, 249, 55, 246, 250, 238, 106, 205, 250, 248, 236, 234, 249,
    248, 234, 245, 249, 262, 246, 9, 263, 249, 127, 246, 267, 249, 236, 237,
    253, 251, 236, 51, 252, 248, 51, 234, 252, 250, 127, 249, 267, 262, 33, 245,
    266, 253, 250, 249, 271, 250, 235, 237, 253, 247, 135, 205, 250, 247, 55,
    135, 250, 247, 117, 118, 250, 247, 205, 117, 250, 203, 39, 180, 310, 200,
    158, 132, 278, 265, 204, 191, 269, 255, 251, 26, 274, 256, 240, 253, 257,
    253, 239, 240, 256, 256, 253, 252, 275, 253, 252, 239, 256, 252, 248, 251,
    269, 262, 261, 33, 265, 203, 177, 122, 310, 253, 249, 252, 270, 294, 77, 92,
    313, 266, 263, 262, 283, 277, 276, 257, 279, 254, 253, 241, 257, 241, 238,
    237, 254, 254, 250, 253, 271, 250, 249, 235, 253, 271, 254, 250, 272, 283,
    267, 263, 284, 271, 267, 266, 287, 271, 270, 253, 276, 263, 246, 249, 266,
    105, 68, 37, 298, 283, 206, 1, 284, 257, 254, 253, 277, 258, 254, 257, 277,
    257, 241, 254, 258, 253, 237, 250, 254, 254, 123, 125, 258, 238, 123, 106,
    254, 250, 238, 106, 254, 259, 199, 12, 278, 255, 26, 158, 274, 251, 26, 136,
    255, 251, 136, 27, 255, 239, 27, 190, 255, 242, 239, 190, 255, 260, 256,
    259, 278, 256, 242, 243, 259, 255, 158, 156, 274, 255, 156, 242, 259, 278,
    274, 132, 299, 260, 257, 256, 276, 257, 256, 243, 260, 258, 113, 13, 260,
    259, 243, 256, 260, 253, 240, 237, 257, 279, 276, 275, 300, 311, 291, 296,
    314, 260, 258, 257, 277, 258, 257, 241, 260, 257, 243, 241, 260, 278, 260,
    275, 279, 259, 255, 156, 274, 259, 256, 255, 274, 256, 255, 242, 259, 242,
    201, 199, 259, 200, 29, 199, 278, 243, 242, 182, 259, 242, 187, 182, 259,
    242, 199, 187, 259, 292, 291, 276, 297, 278, 12, 260, 279, 258, 241, 113,
    260, 243, 103, 113, 260, 243, 13, 103, 260, 258, 13, 126, 280, 258, 126,
    129, 277, 243, 182, 119, 260, 243, 119, 13, 260, 262, 179, 261, 282, 261,
    202, 204, 265, 263, 262, 246, 266, 270, 253, 249, 271, 203, 202, 177, 306,
    261, 33, 210, 262, 247, 246, 127, 264, 264, 263, 127, 267, 267, 266, 249,
    271, 269, 251, 252, 274, 268, 264, 267, 284, 325, 97, 324, 332, 133, 84, 1,
    284, 268, 267, 250, 272, 263, 246, 3, 264, 263, 127, 246, 264, 251, 191,
    183, 269, 281, 261, 179, 282, 265, 262, 261, 282, 266, 262, 265, 282, 265,
    261, 202, 285, 261, 204, 138, 265, 261, 138, 165, 265, 261, 165, 33, 265,
    263, 246, 127, 267, 263, 249, 246, 267, 267, 264, 263, 284, 283, 263, 206,
    284, 289, 83, 84, 305, 268, 133, 264, 289, 264, 127, 133, 268, 267, 250,
    127, 268, 264, 133, 3, 284, 272, 267, 271, 292, 157, 92, 142, 313, 265, 191,
    251, 269, 251, 136, 26, 269, 269, 265, 204, 285, 255, 252, 251, 274, 290,
    274, 269, 291, 274, 252, 270, 275, 283, 282, 262, 286, 285, 269, 265, 290,
    279, 275, 278, 300, 304, 283, 287, 308, 122, 74, 121, 329, 291, 286, 285,
    307, 270, 249, 266, 271, 267, 249, 250, 271, 292, 276, 277, 297, 297, 277,
    293, 298, 280, 279, 28, 301, 276, 270, 275, 291, 276, 271, 270, 291, 280,
    68, 105, 301, 329, 184, 319, 330, 296, 295, 274, 299, 271, 250, 267, 272,
    288, 268, 272, 293, 294, 293, 273, 298, 139, 129, 128, 273, 273, 114, 140,
    289, 273, 268, 272, 288, 277, 105, 273, 298, 273, 105, 128, 294, 288, 272,
    273, 293, 298, 294, 293, 313, 272, 125, 254, 273, 272, 254, 250, 273, 268,
    250, 140, 273, 269, 26, 251, 274, 269, 58, 26, 274, 290, 58, 274, 295, 274,
    269, 58, 290, 296, 291, 290, 314, 275, 256, 253, 276, 270, 252, 253, 275,
    274, 256, 252, 275, 293, 292, 277, 297, 288, 287, 268, 292, 260, 13, 258,
    280, 280, 105, 277, 298, 297, 292, 291, 315, 295, 274, 290, 296, 286, 270,
    271, 291, 277, 271, 276, 292, 279, 277, 276, 297, 277, 257, 260, 279, 276,
    260, 257, 279, 276, 257, 253, 277, 276, 253, 271, 277, 272, 125, 129, 277,
    272, 254, 125, 277, 273, 129, 105, 277, 273, 272, 129, 277, 278, 275, 274,
    296, 274, 158, 156, 278, 200, 199, 156, 278, 275, 256, 260, 278, 279, 278,
    29, 300, 278, 29, 12, 279, 260, 12, 13, 279, 279, 13, 260, 280, 277, 260,
    258, 280, 299, 38, 29, 300, 115, 68, 28, 301, 280, 28, 68, 301, 126, 13, 28,
    280, 277, 126, 105, 280, 277, 258, 126, 280, 279, 260, 277, 280, 306, 285,
    282, 307, 284, 267, 268, 287, 262, 206, 179, 282, 281, 265, 261, 282, 261,
    179, 172, 281, 202, 172, 178, 281, 202, 178, 167, 281, 145, 99, 144, 302,
    303, 99, 302, 321, 177, 144, 146, 306, 282, 281, 265, 285, 154, 97, 83, 305,
    292, 287, 286, 311, 284, 283, 267, 287, 282, 262, 206, 283, 305, 284, 288,
    309, 309, 304, 308, 324, 287, 268, 284, 288, 284, 133, 72, 289, 284, 1, 283,
    304, 287, 284, 283, 304, 305, 304, 284, 309, 303, 0, 99, 321, 265, 202, 204,
    285, 281, 261, 265, 285, 281, 202, 261, 285, 291, 274, 275, 296, 295, 180,
    39, 314, 203, 122, 121, 310, 285, 282, 281, 306, 286, 282, 285, 307, 303,
    282, 286, 307, 290, 269, 265, 291, 287, 286, 271, 292, 323, 147, 91, 332,
    277, 272, 271, 292, 304, 303, 283, 308, 286, 265, 266, 291, 292, 286, 291,
    311, 286, 271, 266, 287, 286, 266, 283, 287, 309, 92, 157, 313, 293, 288,
    292, 309, 292, 288, 287, 309, 284, 268, 264, 288, 140, 114, 72, 289, 312,
    311, 292, 315, 292, 277, 272, 293, 289, 284, 288, 305, 305, 288, 289, 309,
    288, 268, 264, 289, 288, 264, 284, 289, 294, 92, 289, 313, 289, 288, 273,
    294, 288, 273, 268, 289, 305, 289, 83, 309, 289, 92, 83, 309, 284, 72, 84,
    289, 286, 285, 265, 291, 286, 266, 270, 291, 285, 58, 204, 290, 290, 285,
    203, 310, 310, 306, 146, 326, 307, 306, 291, 310, 185, 121, 149, 329, 278,
    200, 29, 299, 323, 91, 146, 326, 291, 271, 286, 292, 287, 271, 267, 292,
    295, 290, 180, 310, 300, 279, 297, 301, 297, 291, 296, 315, 311, 307, 310,
    326, 306, 146, 122, 310, 277, 273, 272, 298, 294, 273, 105, 298, 293, 273,
    288, 294, 289, 273, 114, 294, 294, 288, 293, 313, 292, 268, 288, 293, 292,
    272, 268, 293, 273, 128, 114, 294, 128, 105, 37, 294, 289, 114, 92, 294,
    311, 292, 308, 312, 296, 290, 295, 314, 310, 295, 290, 314, 278, 132, 200,
    299, 295, 132, 274, 299, 290, 180, 58, 295, 274, 58, 26, 295, 274, 26, 158,
    295, 274, 158, 132, 295, 296, 274, 278, 299, 310, 290, 291, 314, 192, 185,
    149, 318, 315, 300, 297, 319, 300, 297, 296, 315, 318, 38, 300, 319, 300,
    299, 38, 318, 296, 275, 291, 297, 298, 293, 297, 317, 312, 292, 293, 316,
    301, 298, 297, 317, 301, 15, 115, 320, 298, 277, 280, 301, 293, 272, 273,
    298, 293, 277, 272, 298, 294, 105, 37, 298, 299, 29, 278, 300, 319, 315,
    318, 329, 184, 96, 38, 319, 299, 132, 192, 318, 314, 299, 296, 318, 299,
    295, 132, 314, 279, 29, 28, 300, 300, 15, 28, 301, 301, 297, 300, 319, 297,
    296, 275, 300, 297, 276, 279, 300, 297, 275, 276, 300, 300, 28, 279, 301,
    297, 279, 277, 301, 298, 297, 277, 301, 298, 105, 68, 301, 298, 280, 105,
    301, 320, 316, 319, 331, 301, 37, 298, 320, 298, 68, 37, 301, 303, 302, 282,
    307, 302, 144, 177, 306, 178, 99, 167, 302, 309, 292, 293, 312, 282, 179,
    178, 303, 307, 303, 302, 323, 307, 302, 306, 323, 283, 197, 282, 303, 303,
    283, 197, 304, 303, 197, 0, 304, 303, 0, 193, 304, 308, 304, 303, 321, 303,
    286, 283, 308, 160, 97, 2, 305, 324, 309, 304, 325, 283, 1, 197, 304, 303,
    193, 0, 321, 321, 193, 73, 322, 160, 84, 83, 305, 289, 84, 284, 305, 322,
    304, 305, 325, 305, 83, 154, 325, 310, 146, 122, 326, 306, 290, 291, 310,
    306, 282, 302, 307, 306, 147, 146, 323, 302, 202, 281, 306, 302, 281, 282,
    306, 285, 202, 203, 306, 306, 291, 285, 307, 310, 291, 307, 311, 305, 154,
    97, 325, 307, 291, 286, 311, 308, 307, 286, 311, 312, 308, 311, 327, 321,
    308, 304, 322, 314, 310, 121, 326, 311, 308, 307, 326, 317, 312, 316, 331,
    155, 64, 111, 327, 307, 286, 303, 308, 309, 287, 292, 312, 294, 289, 288,
    313, 309, 308, 287, 312, 313, 309, 312, 327, 308, 287, 304, 309, 312, 309,
    308, 327, 324, 322, 97, 325, 290, 203, 180, 310, 306, 177, 203, 310, 306,
    122, 177, 310, 306, 203, 285, 310, 315, 296, 299, 318, 314, 296, 311, 315,
    310, 122, 121, 326, 311, 310, 291, 314, 326, 314, 315, 329, 315, 314, 185,
    329, 308, 287, 292, 311, 308, 286, 287, 311, 329, 327, 64, 330, 315, 312,
    311, 330, 318, 300, 315, 319, 315, 297, 312, 316, 312, 293, 309, 313, 317,
    313, 312, 331, 325, 324, 309, 327, 309, 83, 305, 325, 309, 288, 289, 313,
    309, 293, 288, 313, 313, 293, 298, 317, 294, 37, 77, 313, 295, 39, 132, 314,
    315, 311, 314, 326, 310, 121, 39, 314, 310, 180, 295, 314, 310, 39, 180,
    314, 314, 311, 310, 326, 311, 291, 292, 315, 311, 296, 291, 315, 299, 192,
    38, 318, 314, 185, 192, 318, 315, 185, 149, 329, 329, 319, 315, 330, 316,
    312, 315, 330, 330, 316, 312, 331, 326, 64, 74, 329, 317, 316, 301, 320,
    317, 298, 37, 320, 317, 142, 313, 328, 319, 316, 315, 330, 316, 293, 312,
    317, 316, 297, 293, 317, 316, 301, 297, 317, 320, 317, 316, 331, 320, 319,
    96, 331, 317, 37, 87, 320, 313, 298, 294, 317, 313, 37, 92, 317, 313, 92,
    87, 317, 315, 299, 300, 318, 318, 184, 38, 319, 300, 38, 15, 319, 318, 149,
    184, 329, 315, 149, 185, 318, 315, 185, 314, 318, 315, 314, 296, 318, 314,
    132, 299, 318, 314, 192, 132, 318, 316, 315, 297, 319, 316, 297, 301, 319,
    319, 96, 115, 320, 301, 300, 15, 319, 319, 301, 316, 320, 317, 301, 298,
    320, 301, 68, 37, 320, 301, 115, 68, 320, 317, 87, 142, 331, 330, 319, 316,
    331, 319, 15, 301, 320, 319, 115, 15, 320, 321, 307, 308, 323, 322, 66, 73,
    332, 151, 66, 73, 322, 147, 73, 66, 321, 321, 73, 66, 332, 324, 322, 321,
    332, 309, 305, 304, 325, 305, 97, 2, 322, 193, 2, 95, 322, 324, 304, 322,
    325, 324, 323, 91, 332, 322, 321, 308, 324, 323, 308, 321, 324, 327, 111,
    324, 332, 326, 323, 91, 327, 146, 91, 74, 326, 310, 307, 306, 326, 321, 144,
    302, 323, 321, 303, 307, 323, 321, 302, 303, 323, 324, 91, 323, 327, 325,
    111, 324, 327, 324, 308, 309, 327, 313, 157, 309, 328, 322, 151, 66, 332,
    325, 154, 97, 332, 151, 110, 21, 332, 322, 308, 304, 324, 309, 157, 83, 325,
    327, 309, 325, 328, 313, 142, 157, 328, 328, 313, 317, 331, 323, 307, 308,
    326, 323, 146, 306, 326, 323, 306, 307, 326, 326, 121, 314, 329, 327, 326,
    311, 329, 326, 315, 311, 329, 327, 64, 326, 329, 328, 142, 155, 331, 327,
    325, 111, 328, 157, 142, 110, 328, 325, 157, 154, 328, 327, 313, 309, 328,
    325, 309, 157, 328, 327, 311, 312, 330, 330, 312, 327, 331, 329, 315, 311,
    330, 319, 184, 96, 330, 319, 318, 184, 329, 318, 315, 149, 329, 326, 74,
    122, 329, 326, 122, 121, 329, 314, 121, 185, 329, 329, 311, 327, 330, 328,
    317, 142, 331, 330, 155, 96, 331, 184, 64, 96, 330, 330, 96, 319, 331, 330,
    327, 155, 331, 327, 312, 313, 331, 328, 327, 313, 331, 320, 96, 87, 331,
    320, 87, 317, 331, 147, 65, 91, 332, 147, 66, 65, 332, 130, 21, 20, 332,
    151, 95, 110, 332, 322, 97, 95, 332, 327, 91, 111, 332, 327, 324, 91, 332,
  ],
  tetEdgeIds: [
    0, 2, 0, 99, 0, 178, 0, 179, 0, 193, 0, 197, 0, 282, 0, 303, 0, 304, 0, 321,
    1, 2, 1, 3, 1, 84, 1, 133, 1, 148, 1, 160, 1, 197, 1, 206, 1, 283, 1, 284,
    1, 304, 1, 305, 2, 95, 2, 97, 2, 151, 2, 160, 2, 193, 2, 197, 2, 304, 2,
    305, 2, 322, 3, 4, 3, 5, 3, 9, 3, 50, 3, 127, 3, 131, 3, 133, 3, 148, 3,
    206, 3, 246, 3, 247, 3, 263, 3, 264, 3, 284, 4, 5, 4, 6, 4, 9, 4, 54, 4, 75,
    4, 108, 4, 117, 4, 118, 4, 135, 4, 163, 4, 174, 4, 207, 4, 233, 4, 246, 4,
    247, 5, 50, 5, 108, 5, 117, 5, 118, 5, 148, 5, 163, 5, 247, 6, 8, 6, 9, 6,
    54, 6, 207, 6, 233, 6, 245, 6, 246, 7, 8, 7, 9, 7, 33, 7, 107, 7, 112, 7,
    186, 7, 209, 7, 210, 7, 245, 7, 262, 8, 9, 8, 30, 8, 54, 8, 107, 8, 150, 8,
    186, 8, 207, 8, 209, 8, 233, 8, 245, 9, 179, 9, 206, 9, 210, 9, 245, 9, 246,
    9, 247, 9, 262, 9, 263, 10, 35, 10, 46, 10, 79, 10, 141, 10, 216, 10, 218,
    11, 34, 11, 42, 11, 46, 11, 166, 11, 171, 11, 198, 11, 212, 11, 213, 11,
    214, 11, 216, 11, 226, 12, 13, 12, 28, 12, 29, 12, 119, 12, 182, 12, 187,
    12, 199, 12, 259, 12, 260, 12, 278, 12, 279, 13, 28, 13, 103, 13, 113, 13,
    119, 13, 126, 13, 243, 13, 258, 13, 260, 13, 279, 13, 280, 14, 108, 14, 117,
    14, 135, 14, 163, 14, 174, 15, 28, 15, 29, 15, 38, 15, 96, 15, 115, 15, 300,
    15, 301, 15, 319, 15, 320, 16, 36, 16, 44, 16, 45, 16, 88, 16, 152, 16, 162,
    16, 232, 17, 18, 17, 32, 17, 195, 17, 208, 17, 211, 17, 220, 17, 221, 18,
    19, 18, 32, 18, 42, 18, 195, 18, 198, 18, 211, 18, 212, 18, 213, 19, 32, 19,
    42, 19, 168, 19, 211, 19, 213, 20, 21, 20, 110, 20, 111, 20, 130, 20, 332,
    21, 85, 21, 110, 21, 130, 21, 151, 21, 332, 22, 45, 22, 62, 22, 63, 22, 93,
    22, 98, 22, 124, 22, 134, 22, 181, 23, 24, 23, 40, 23, 41, 23, 43, 23, 49,
    23, 53, 23, 104, 23, 164, 23, 194, 24, 25, 24, 43, 24, 49, 24, 53, 24, 67,
    24, 81, 24, 104, 24, 164, 25, 49, 25, 61, 25, 81, 25, 101, 26, 27, 26, 57,
    26, 58, 26, 132, 26, 136, 26, 156, 26, 158, 26, 175, 26, 180, 26, 251, 26,
    255, 26, 269, 26, 274, 26, 295, 27, 51, 27, 136, 27, 156, 27, 188, 27, 190,
    27, 196, 27, 236, 27, 239, 27, 251, 27, 255, 28, 29, 28, 68, 28, 115, 28,
    126, 28, 279, 28, 280, 28, 300, 28, 301, 29, 38, 29, 199, 29, 200, 29, 278,
    29, 279, 29, 299, 29, 300, 30, 107, 30, 116, 30, 150, 30, 173, 30, 186, 30,
    207, 31, 46, 31, 79, 31, 80, 31, 168, 31, 170, 31, 214, 31, 215, 31, 216,
    31, 217, 32, 70, 32, 71, 32, 90, 32, 168, 32, 208, 32, 211, 32, 213, 32,
    222, 32, 225, 33, 51, 33, 100, 33, 107, 33, 112, 33, 165, 33, 186, 33, 191,
    33, 209, 33, 210, 33, 234, 33, 245, 33, 248, 33, 251, 33, 261, 33, 262, 33,
    265, 33, 266, 34, 52, 34, 67, 34, 166, 34, 171, 34, 187, 34, 190, 34, 201,
    34, 212, 34, 223, 34, 226, 34, 228, 34, 242, 35, 36, 35, 40, 35, 41, 35, 79,
    35, 141, 35, 169, 35, 218, 35, 219, 36, 40, 36, 45, 36, 48, 36, 88, 36, 169,
    36, 218, 36, 219, 36, 232, 37, 68, 37, 77, 37, 87, 37, 92, 37, 105, 37, 128,
    37, 294, 37, 298, 37, 301, 37, 313, 37, 317, 37, 320, 38, 96, 38, 184, 38,
    192, 38, 200, 38, 299, 38, 300, 38, 318, 38, 319, 39, 121, 39, 132, 39, 180,
    39, 185, 39, 203, 39, 295, 39, 310, 39, 314, 40, 41, 40, 45, 40, 53, 40,
    181, 40, 194, 40, 218, 40, 231, 40, 232, 41, 43, 41, 53, 41, 141, 41, 194,
    41, 218, 41, 231, 42, 168, 42, 198, 42, 212, 42, 213, 42, 214, 43, 49, 43,
    81, 43, 101, 43, 102, 43, 104, 43, 194, 44, 45, 44, 59, 44, 69, 44, 82, 44,
    93, 44, 98, 44, 162, 44, 232, 45, 93, 45, 98, 45, 124, 45, 181, 45, 232, 46,
    79, 46, 141, 46, 168, 46, 171, 46, 214, 46, 216, 47, 48, 47, 56, 47, 60, 47,
    80, 47, 152, 47, 153, 47, 169, 47, 176, 47, 189, 47, 217, 48, 60, 48, 88,
    48, 152, 48, 153, 48, 169, 48, 217, 48, 219, 49, 81, 49, 101, 50, 118, 50,
    127, 50, 131, 50, 148, 50, 247, 51, 100, 51, 136, 51, 186, 51, 188, 51, 196,
    51, 220, 51, 234, 51, 236, 51, 248, 51, 251, 51, 252, 52, 53, 52, 67, 52,
    141, 52, 164, 52, 171, 52, 194, 52, 228, 52, 231, 53, 67, 53, 98, 53, 164,
    53, 181, 53, 194, 53, 231, 54, 55, 54, 75, 54, 135, 54, 150, 54, 207, 54,
    233, 54, 247, 55, 94, 55, 135, 55, 150, 55, 205, 55, 208, 55, 233, 55, 234,
    55, 235, 55, 246, 55, 247, 55, 249, 55, 250, 56, 60, 56, 71, 56, 76, 56,
    176, 57, 58, 57, 175, 57, 180, 57, 183, 57, 204, 57, 269, 58, 180, 58, 203,
    58, 204, 58, 269, 58, 274, 58, 285, 58, 290, 58, 295, 59, 63, 59, 69, 59,
    82, 59, 93, 59, 98, 59, 143, 60, 76, 60, 152, 60, 153, 60, 176, 60, 217, 61,
    81, 61, 86, 61, 101, 62, 63, 62, 120, 62, 124, 62, 134, 62, 143, 62, 159,
    62, 161, 63, 69, 63, 93, 63, 98, 63, 124, 63, 143, 63, 159, 63, 161, 64, 74,
    64, 91, 64, 96, 64, 111, 64, 149, 64, 155, 64, 184, 64, 326, 64, 327, 64,
    329, 64, 330, 65, 66, 65, 73, 65, 85, 65, 91, 65, 130, 65, 147, 65, 332, 66,
    73, 66, 85, 66, 91, 66, 147, 66, 151, 66, 321, 66, 322, 66, 332, 67, 69, 67,
    98, 67, 104, 67, 164, 67, 187, 67, 228, 67, 231, 68, 87, 68, 105, 68, 115,
    68, 126, 68, 280, 68, 298, 68, 301, 68, 320, 69, 82, 69, 98, 69, 187, 69,
    228, 69, 231, 70, 71, 70, 76, 70, 89, 70, 90, 70, 109, 70, 222, 70, 225, 71,
    76, 71, 168, 71, 170, 71, 176, 71, 213, 71, 215, 71, 225, 71, 227, 72, 78,
    72, 84, 72, 114, 72, 133, 72, 140, 72, 284, 72, 289, 73, 99, 73, 147, 73,
    151, 73, 193, 73, 321, 73, 322, 73, 332, 74, 91, 74, 121, 74, 122, 74, 146,
    74, 149, 74, 326, 74, 329, 75, 116, 75, 135, 75, 150, 75, 163, 75, 173, 75,
    174, 75, 207, 76, 103, 76, 109, 76, 113, 76, 153, 76, 176, 76, 215, 76, 217,
    76, 225, 76, 227, 76, 230, 76, 241, 77, 92, 77, 114, 77, 128, 77, 294, 77,
    313, 78, 83, 78, 84, 78, 92, 78, 114, 78, 289, 79, 80, 79, 169, 79, 216, 79,
    217, 79, 218, 79, 219, 80, 169, 80, 170, 80, 189, 80, 217, 81, 86, 81, 101,
    81, 102, 81, 104, 82, 98, 82, 162, 82, 182, 82, 187, 82, 228, 82, 229, 82,
    231, 82, 232, 82, 244, 83, 84, 83, 92, 83, 97, 83, 154, 83, 157, 83, 160,
    83, 289, 83, 305, 83, 309, 83, 325, 84, 133, 84, 148, 84, 160, 84, 284, 84,
    289, 84, 305, 85, 91, 85, 130, 85, 151, 85, 332, 86, 101, 86, 102, 87, 92,
    87, 96, 87, 115, 87, 142, 87, 313, 87, 317, 87, 320, 87, 331, 88, 152, 88,
    162, 88, 219, 88, 232, 89, 90, 89, 106, 89, 109, 89, 205, 89, 222, 89, 238,
    90, 205, 90, 208, 90, 211, 90, 221, 90, 222, 91, 111, 91, 130, 91, 146, 91,
    147, 91, 323, 91, 324, 91, 326, 91, 327, 91, 332, 92, 114, 92, 142, 92, 157,
    92, 289, 92, 294, 92, 309, 92, 313, 92, 317, 93, 98, 93, 124, 93, 143, 93,
    181, 94, 100, 94, 150, 94, 186, 94, 208, 94, 220, 94, 221, 94, 233, 94, 234,
    94, 235, 94, 245, 95, 97, 95, 110, 95, 151, 95, 193, 95, 322, 95, 332, 96,
    115, 96, 142, 96, 155, 96, 184, 96, 319, 96, 320, 96, 330, 96, 331, 97, 110,
    97, 154, 97, 160, 97, 305, 97, 322, 97, 324, 97, 325, 97, 332, 98, 181, 98,
    187, 98, 231, 98, 232, 99, 144, 99, 145, 99, 167, 99, 178, 99, 193, 99, 302,
    99, 303, 99, 321, 100, 186, 100, 195, 100, 196, 100, 208, 100, 220, 100,
    234, 100, 236, 101, 102, 102, 104, 103, 113, 103, 119, 103, 153, 103, 162,
    103, 225, 103, 227, 103, 229, 103, 230, 103, 241, 103, 243, 103, 244, 103,
    260, 104, 164, 104, 194, 105, 126, 105, 128, 105, 129, 105, 273, 105, 277,
    105, 280, 105, 294, 105, 298, 105, 301, 106, 109, 106, 117, 106, 118, 106,
    123, 106, 125, 106, 127, 106, 205, 106, 238, 106, 250, 106, 254, 107, 112,
    107, 137, 107, 186, 107, 209, 108, 117, 108, 118, 108, 163, 108, 174, 109,
    113, 109, 123, 109, 222, 109, 225, 109, 238, 109, 241, 110, 111, 110, 142,
    110, 151, 110, 157, 110, 328, 110, 332, 111, 130, 111, 142, 111, 154, 111,
    155, 111, 324, 111, 325, 111, 327, 111, 328, 111, 332, 112, 137, 112, 165,
    112, 209, 113, 123, 113, 126, 113, 129, 113, 241, 113, 243, 113, 258, 113,
    260, 114, 128, 114, 139, 114, 140, 114, 273, 114, 289, 114, 294, 115, 142,
    115, 301, 115, 319, 115, 320, 116, 173, 116, 207, 117, 118, 117, 135, 117,
    174, 117, 205, 117, 247, 117, 250, 118, 127, 118, 131, 118, 205, 118, 247,
    118, 250, 119, 153, 119, 162, 119, 182, 119, 230, 119, 243, 119, 244, 119,
    260, 120, 134, 120, 159, 121, 122, 121, 149, 121, 177, 121, 180, 121, 185,
    121, 203, 121, 310, 121, 314, 121, 326, 121, 329, 122, 146, 122, 177, 122,
    203, 122, 306, 122, 310, 122, 326, 122, 329, 123, 125, 123, 129, 123, 238,
    123, 241, 123, 254, 123, 258, 124, 134, 124, 143, 125, 129, 125, 139, 125,
    140, 125, 250, 125, 254, 125, 258, 125, 272, 125, 273, 125, 277, 126, 129,
    126, 258, 126, 277, 126, 280, 127, 131, 127, 133, 127, 140, 127, 246, 127,
    247, 127, 249, 127, 250, 127, 263, 127, 264, 127, 267, 127, 268, 128, 129,
    128, 139, 128, 273, 128, 294, 129, 139, 129, 258, 129, 272, 129, 273, 129,
    277, 130, 332, 131, 133, 131, 148, 132, 156, 132, 158, 132, 180, 132, 185,
    132, 192, 132, 200, 132, 274, 132, 278, 132, 295, 132, 299, 132, 314, 132,
    318, 133, 140, 133, 148, 133, 264, 133, 268, 133, 284, 133, 289, 134, 159,
    134, 161, 135, 174, 135, 205, 135, 233, 135, 247, 135, 250, 136, 175, 136,
    183, 136, 188, 136, 191, 136, 196, 136, 236, 136, 251, 136, 255, 136, 269,
    137, 138, 137, 165, 137, 172, 137, 209, 138, 165, 138, 172, 138, 191, 138,
    202, 138, 204, 138, 209, 138, 210, 138, 261, 138, 265, 139, 140, 139, 273,
    140, 250, 140, 268, 140, 273, 140, 289, 141, 171, 141, 194, 141, 216, 141,
    218, 141, 228, 141, 231, 142, 155, 142, 157, 142, 313, 142, 317, 142, 328,
    142, 331, 143, 161, 144, 145, 144, 146, 144, 147, 144, 177, 144, 302, 144,
    306, 144, 321, 144, 323, 145, 167, 145, 177, 145, 202, 145, 302, 146, 147,
    146, 177, 146, 306, 146, 310, 146, 323, 146, 326, 147, 306, 147, 321, 147,
    323, 147, 332, 148, 160, 149, 184, 149, 185, 149, 192, 149, 315, 149, 318,
    149, 329, 150, 173, 150, 186, 150, 207, 150, 233, 150, 245, 151, 193, 151,
    322, 151, 332, 152, 153, 152, 162, 152, 217, 152, 219, 152, 230, 152, 232,
    153, 162, 153, 176, 153, 217, 153, 230, 154, 157, 154, 305, 154, 325, 154,
    328, 154, 332, 155, 327, 155, 328, 155, 330, 155, 331, 156, 158, 156, 190,
    156, 199, 156, 200, 156, 201, 156, 242, 156, 255, 156, 259, 156, 274, 156,
    278, 157, 309, 157, 313, 157, 325, 157, 328, 158, 200, 158, 255, 158, 274,
    158, 278, 158, 295, 159, 161, 160, 305, 162, 182, 162, 229, 162, 230, 162,
    232, 162, 244, 163, 174, 163, 207, 164, 194, 165, 191, 165, 209, 165, 210,
    165, 261, 165, 265, 166, 188, 166, 190, 166, 195, 166, 196, 166, 198, 166,
    212, 166, 220, 166, 223, 167, 172, 167, 178, 167, 202, 167, 281, 167, 302,
    168, 213, 168, 214, 168, 215, 168, 224, 168, 225, 168, 227, 169, 217, 169,
    219, 170, 176, 170, 189, 170, 215, 170, 217, 171, 214, 171, 216, 171, 226,
    171, 228, 172, 178, 172, 179, 172, 202, 172, 209, 172, 210, 172, 261, 172,
    281, 173, 186, 173, 207, 174, 207, 175, 180, 175, 183, 175, 269, 176, 189,
    176, 215, 176, 217, 177, 202, 177, 203, 177, 302, 177, 306, 177, 310, 178,
    179, 178, 197, 178, 202, 178, 281, 178, 282, 178, 302, 178, 303, 179, 197,
    179, 206, 179, 210, 179, 261, 179, 262, 179, 281, 179, 282, 179, 303, 180,
    203, 180, 290, 180, 295, 180, 310, 180, 314, 181, 231, 181, 232, 182, 187,
    182, 199, 182, 242, 182, 243, 182, 244, 182, 259, 182, 260, 183, 191, 183,
    204, 183, 251, 183, 269, 184, 192, 184, 318, 184, 319, 184, 329, 184, 330,
    185, 192, 185, 314, 185, 315, 185, 318, 185, 329, 186, 233, 186, 234, 186,
    245, 187, 199, 187, 201, 187, 226, 187, 228, 187, 231, 187, 242, 187, 244,
    187, 259, 188, 190, 188, 196, 188, 220, 188, 223, 188, 236, 188, 239, 189,
    215, 189, 217, 190, 201, 190, 223, 190, 226, 190, 239, 190, 242, 190, 255,
    191, 204, 191, 251, 191, 265, 191, 269, 192, 200, 192, 299, 192, 314, 192,
    318, 193, 303, 193, 304, 193, 321, 193, 322, 194, 218, 194, 231, 195, 196,
    195, 198, 195, 208, 195, 211, 195, 212, 195, 220, 196, 220, 196, 236, 197,
    206, 197, 282, 197, 283, 197, 303, 197, 304, 198, 212, 198, 220, 199, 200,
    199, 201, 199, 242, 199, 259, 199, 278, 200, 278, 200, 299, 201, 242, 201,
    259, 202, 203, 202, 204, 202, 261, 202, 265, 202, 281, 202, 285, 202, 302,
    202, 306, 203, 204, 203, 285, 203, 290, 203, 306, 203, 310, 204, 261, 204,
    265, 204, 269, 204, 285, 204, 290, 205, 208, 205, 221, 205, 222, 205, 235,
    205, 238, 205, 247, 205, 250, 206, 262, 206, 263, 206, 264, 206, 282, 206,
    283, 206, 284, 208, 211, 208, 220, 208, 221, 208, 222, 208, 235, 209, 210,
    210, 245, 210, 261, 210, 262, 211, 212, 211, 213, 211, 220, 211, 221, 211,
    222, 212, 213, 212, 214, 212, 220, 212, 221, 212, 223, 212, 224, 212, 226,
    213, 214, 213, 221, 213, 222, 213, 224, 213, 225, 214, 215, 214, 216, 214,
    217, 214, 224, 214, 226, 214, 227, 214, 229, 214, 230, 215, 217, 215, 227,
    215, 230, 216, 217, 216, 218, 216, 226, 216, 228, 216, 229, 216, 231, 216,
    232, 217, 218, 217, 219, 217, 229, 217, 230, 217, 232, 218, 219, 218, 231,
    218, 232, 219, 230, 219, 232, 220, 221, 220, 223, 220, 234, 220, 236, 220,
    239, 221, 222, 221, 223, 221, 224, 221, 234, 221, 235, 221, 236, 221, 237,
    221, 238, 221, 239, 221, 240, 221, 241, 222, 224, 222, 225, 222, 235, 222,
    238, 222, 241, 223, 224, 223, 226, 223, 239, 223, 242, 223, 243, 224, 225,
    224, 226, 224, 227, 224, 237, 224, 239, 224, 240, 224, 241, 224, 243, 225,
    227, 225, 241, 226, 227, 226, 228, 226, 229, 226, 239, 226, 242, 226, 243,
    226, 244, 227, 229, 227, 230, 227, 241, 227, 243, 227, 244, 228, 229, 228,
    231, 228, 232, 228, 242, 228, 244, 229, 230, 229, 232, 229, 243, 229, 244,
    230, 232, 230, 244, 231, 232, 232, 244, 233, 234, 233, 235, 233, 245, 233,
    246, 233, 247, 233, 249, 234, 235, 234, 236, 234, 245, 234, 248, 234, 249,
    234, 252, 235, 236, 235, 237, 235, 238, 235, 249, 235, 250, 235, 253, 236,
    237, 236, 239, 236, 240, 236, 248, 236, 249, 236, 251, 236, 252, 236, 253,
    237, 238, 237, 240, 237, 241, 237, 249, 237, 250, 237, 253, 237, 254, 237,
    257, 238, 241, 238, 250, 238, 254, 239, 240, 239, 242, 239, 243, 239, 251,
    239, 252, 239, 253, 239, 255, 239, 256, 240, 241, 240, 243, 240, 253, 240,
    256, 240, 257, 241, 243, 241, 253, 241, 254, 241, 257, 241, 258, 241, 260,
    242, 243, 242, 244, 242, 255, 242, 256, 242, 259, 243, 244, 243, 256, 243,
    257, 243, 259, 243, 260, 245, 246, 245, 248, 245, 249, 245, 262, 245, 266,
    246, 247, 246, 249, 246, 250, 246, 262, 246, 263, 246, 264, 246, 266, 246,
    267, 247, 250, 247, 264, 248, 249, 248, 251, 248, 252, 248, 265, 248, 266,
    248, 269, 248, 270, 249, 250, 249, 252, 249, 253, 249, 263, 249, 266, 249,
    267, 249, 270, 249, 271, 250, 253, 250, 254, 250, 267, 250, 268, 250, 271,
    250, 272, 250, 273, 251, 252, 251, 255, 251, 265, 251, 269, 251, 274, 252,
    253, 252, 255, 252, 256, 252, 269, 252, 270, 252, 274, 252, 275, 253, 254,
    253, 256, 253, 257, 253, 270, 253, 271, 253, 275, 253, 276, 253, 277, 254,
    257, 254, 258, 254, 271, 254, 272, 254, 273, 254, 277, 255, 256, 255, 259,
    255, 274, 256, 257, 256, 259, 256, 260, 256, 274, 256, 275, 256, 276, 256,
    278, 257, 258, 257, 260, 257, 276, 257, 277, 257, 279, 258, 260, 258, 277,
    258, 280, 259, 260, 259, 274, 259, 275, 259, 278, 260, 275, 260, 276, 260,
    277, 260, 278, 260, 279, 260, 280, 261, 262, 261, 265, 261, 281, 261, 282,
    261, 285, 262, 263, 262, 265, 262, 266, 262, 282, 262, 283, 262, 286, 263,
    264, 263, 266, 263, 267, 263, 283, 263, 284, 264, 267, 264, 268, 264, 284,
    264, 288, 264, 289, 265, 266, 265, 269, 265, 270, 265, 281, 265, 282, 265,
    285, 265, 286, 265, 290, 265, 291, 266, 267, 266, 270, 266, 271, 266, 282,
    266, 283, 266, 286, 266, 287, 266, 291, 267, 268, 267, 271, 267, 272, 267,
    283, 267, 284, 267, 287, 267, 292, 268, 272, 268, 273, 268, 284, 268, 287,
    268, 288, 268, 289, 268, 292, 268, 293, 269, 270, 269, 274, 269, 285, 269,
    290, 269, 291, 270, 271, 270, 274, 270, 275, 270, 276, 270, 286, 270, 291,
    271, 272, 271, 276, 271, 277, 271, 286, 271, 287, 271, 291, 271, 292, 272,
    273, 272, 277, 272, 288, 272, 292, 272, 293, 272, 298, 273, 277, 273, 288,
    273, 289, 273, 293, 273, 294, 273, 298, 274, 275, 274, 278, 274, 290, 274,
    291, 274, 295, 274, 296, 274, 299, 275, 276, 275, 278, 275, 279, 275, 291,
    275, 296, 275, 297, 275, 300, 276, 277, 276, 279, 276, 291, 276, 292, 276,
    297, 276, 300, 277, 279, 277, 280, 277, 292, 277, 293, 277, 297, 277, 298,
    277, 301, 278, 279, 278, 296, 278, 299, 278, 300, 279, 280, 279, 297, 279,
    300, 279, 301, 280, 298, 280, 301, 281, 282, 281, 285, 281, 302, 281, 306,
    282, 283, 282, 285, 282, 286, 282, 302, 282, 303, 282, 306, 282, 307, 283,
    284, 283, 286, 283, 287, 283, 303, 283, 304, 283, 308, 284, 287, 284, 288,
    284, 289, 284, 304, 284, 305, 284, 309, 285, 286, 285, 290, 285, 291, 285,
    306, 285, 307, 285, 310, 286, 287, 286, 291, 286, 292, 286, 303, 286, 307,
    286, 308, 286, 311, 287, 288, 287, 292, 287, 304, 287, 308, 287, 309, 287,
    311, 287, 312, 288, 289, 288, 292, 288, 293, 288, 294, 288, 305, 288, 309,
    288, 313, 289, 294, 289, 305, 289, 309, 289, 313, 290, 291, 290, 295, 290,
    296, 290, 306, 290, 310, 290, 314, 291, 292, 291, 296, 291, 297, 291, 306,
    291, 307, 291, 310, 291, 311, 291, 314, 291, 315, 292, 293, 292, 297, 292,
    308, 292, 309, 292, 311, 292, 312, 292, 315, 292, 316, 293, 294, 293, 297,
    293, 298, 293, 309, 293, 312, 293, 313, 293, 316, 293, 317, 294, 298, 294,
    313, 294, 317, 295, 296, 295, 299, 295, 310, 295, 314, 296, 297, 296, 299,
    296, 300, 296, 311, 296, 314, 296, 315, 296, 318, 297, 298, 297, 300, 297,
    301, 297, 312, 297, 315, 297, 316, 297, 317, 297, 319, 298, 301, 298, 313,
    298, 317, 298, 320, 299, 300, 299, 314, 299, 315, 299, 318, 300, 301, 300,
    315, 300, 318, 300, 319, 301, 316, 301, 317, 301, 319, 301, 320, 302, 303,
    302, 306, 302, 307, 302, 321, 302, 323, 303, 304, 303, 307, 303, 308, 303,
    321, 303, 323, 304, 305, 304, 308, 304, 309, 304, 321, 304, 322, 304, 324,
    304, 325, 305, 309, 305, 322, 305, 325, 306, 307, 306, 310, 306, 323, 306,
    326, 307, 308, 307, 310, 307, 311, 307, 321, 307, 323, 307, 326, 308, 309,
    308, 311, 308, 312, 308, 321, 308, 322, 308, 323, 308, 324, 308, 326, 308,
    327, 309, 312, 309, 313, 309, 324, 309, 325, 309, 327, 309, 328, 310, 311,
    310, 314, 310, 326, 311, 312, 311, 314, 311, 315, 311, 326, 311, 327, 311,
    329, 311, 330, 312, 313, 312, 315, 312, 316, 312, 317, 312, 327, 312, 330,
    312, 331, 313, 317, 313, 327, 313, 328, 313, 331, 314, 315, 314, 318, 314,
    326, 314, 329, 315, 316, 315, 318, 315, 319, 315, 326, 315, 329, 315, 330,
    316, 317, 316, 319, 316, 320, 316, 330, 316, 331, 317, 320, 317, 328, 317,
    331, 318, 319, 318, 329, 319, 320, 319, 329, 319, 330, 319, 331, 320, 331,
    321, 322, 321, 323, 321, 324, 321, 332, 322, 324, 322, 325, 322, 332, 323,
    324, 323, 326, 323, 327, 323, 332, 324, 325, 324, 327, 324, 332, 325, 327,
    325, 328, 325, 332, 326, 327, 326, 329, 327, 328, 327, 329, 327, 330, 327,
    331, 327, 332, 328, 331, 329, 330, 330, 331,
  ],
  tetSurfaceTriIds: [
    2, 0, 193, 0, 2, 197, 99, 0, 178, 0, 99, 193, 178, 0, 197, 1, 2, 160, 2, 1,
    197, 3, 1, 148, 1, 3, 206, 148, 1, 160, 197, 1, 206, 2, 95, 97, 95, 2, 151,
    2, 97, 160, 151, 2, 193, 4, 3, 5, 3, 4, 9, 5, 3, 148, 3, 9, 206, 4, 5, 163,
    4, 6, 9, 6, 4, 207, 4, 163, 207, 5, 50, 118, 50, 5, 148, 108, 5, 118, 5,
    108, 163, 6, 8, 9, 8, 6, 207, 8, 7, 9, 7, 8, 209, 9, 7, 210, 7, 209, 210, 8,
    30, 107, 30, 8, 207, 8, 107, 209, 9, 179, 206, 179, 9, 210, 35, 10, 79, 10,
    35, 141, 10, 46, 79, 46, 10, 141, 11, 34, 166, 34, 11, 171, 42, 11, 198, 11,
    42, 214, 11, 46, 171, 46, 11, 214, 11, 166, 198, 12, 13, 28, 13, 12, 119,
    12, 28, 29, 12, 29, 199, 119, 12, 182, 182, 12, 187, 187, 12, 199, 28, 13,
    126, 13, 103, 113, 103, 13, 119, 13, 113, 126, 14, 108, 117, 108, 14, 163,
    14, 117, 135, 14, 135, 174, 163, 14, 174, 28, 15, 29, 15, 28, 115, 29, 15,
    38, 38, 15, 96, 96, 15, 115, 36, 16, 45, 16, 36, 88, 16, 44, 45, 44, 16,
    162, 16, 88, 152, 16, 152, 162, 18, 17, 32, 17, 18, 195, 32, 17, 208, 17,
    195, 208, 19, 18, 32, 18, 19, 42, 18, 42, 198, 195, 18, 198, 19, 32, 168,
    42, 19, 168, 21, 20, 110, 20, 21, 130, 110, 20, 111, 111, 20, 130, 21, 85,
    130, 85, 21, 151, 21, 110, 151, 22, 45, 124, 45, 22, 181, 22, 62, 63, 62,
    22, 134, 22, 63, 98, 22, 98, 181, 22, 124, 134, 23, 24, 49, 24, 23, 53, 40,
    23, 41, 23, 40, 53, 41, 23, 43, 43, 23, 49, 24, 25, 49, 25, 24, 81, 24, 53,
    67, 24, 67, 104, 81, 24, 104, 49, 25, 101, 61, 25, 81, 25, 61, 101, 27, 26,
    136, 26, 27, 156, 132, 26, 158, 26, 132, 180, 136, 26, 175, 26, 156, 158,
    175, 26, 180, 27, 136, 196, 156, 27, 190, 27, 188, 190, 188, 27, 196, 28,
    68, 115, 68, 28, 126, 29, 38, 200, 199, 29, 200, 107, 30, 186, 30, 116, 173,
    116, 30, 207, 30, 173, 186, 46, 31, 79, 31, 46, 168, 79, 31, 80, 80, 31,
    170, 31, 168, 215, 170, 31, 215, 32, 70, 71, 70, 32, 90, 32, 71, 168, 90,
    32, 208, 51, 33, 186, 33, 51, 251, 107, 33, 112, 33, 107, 186, 112, 33, 165,
    165, 33, 191, 191, 33, 251, 34, 52, 67, 52, 34, 171, 34, 67, 187, 166, 34,
    190, 34, 187, 201, 190, 34, 201, 35, 36, 40, 36, 35, 169, 35, 40, 41, 35,
    41, 141, 35, 79, 169, 40, 36, 45, 36, 48, 88, 48, 36, 169, 68, 37, 87, 37,
    68, 105, 37, 77, 92, 77, 37, 128, 87, 37, 92, 37, 105, 128, 38, 96, 184, 38,
    184, 192, 38, 192, 200, 39, 121, 180, 121, 39, 185, 132, 39, 180, 39, 132,
    185, 40, 45, 181, 53, 40, 181, 41, 43, 194, 141, 41, 194, 42, 168, 214, 43,
    49, 101, 43, 101, 102, 43, 102, 104, 43, 104, 194, 45, 44, 93, 59, 44, 82,
    44, 59, 93, 82, 44, 162, 45, 93, 124, 46, 141, 171, 168, 46, 214, 48, 47,
    60, 47, 48, 169, 47, 56, 60, 56, 47, 176, 80, 47, 169, 47, 80, 189, 176, 47,
    189, 48, 60, 152, 88, 48, 152, 118, 50, 131, 131, 50, 148, 100, 51, 186, 51,
    100, 196, 136, 51, 196, 51, 136, 251, 67, 52, 164, 141, 52, 171, 52, 141,
    194, 164, 52, 194, 67, 53, 98, 98, 53, 181, 55, 54, 135, 54, 55, 150, 54,
    75, 135, 75, 54, 150, 55, 94, 150, 94, 55, 208, 55, 135, 205, 55, 205, 208,
    60, 56, 76, 56, 71, 76, 71, 56, 176, 58, 57, 180, 57, 58, 204, 57, 175, 180,
    175, 57, 183, 183, 57, 204, 58, 180, 203, 58, 203, 204, 63, 59, 69, 59, 63,
    143, 69, 59, 82, 93, 59, 143, 60, 76, 153, 152, 60, 153, 61, 81, 86, 61, 86,
    101, 63, 62, 159, 120, 62, 134, 62, 120, 159, 124, 62, 134, 62, 124, 143,
    134, 62, 161, 62, 143, 161, 63, 69, 98, 143, 63, 161, 63, 159, 161, 74, 64,
    91, 64, 74, 149, 91, 64, 111, 64, 96, 155, 96, 64, 184, 111, 64, 155, 64,
    149, 184, 65, 66, 73, 66, 65, 85, 65, 73, 147, 85, 65, 130, 65, 91, 130, 91,
    65, 147, 73, 66, 151, 66, 85, 151, 67, 98, 187, 104, 67, 164, 68, 87, 115,
    105, 68, 126, 69, 82, 187, 98, 69, 187, 71, 70, 76, 76, 70, 109, 89, 70, 90,
    70, 89, 109, 168, 71, 215, 170, 71, 176, 71, 170, 215, 78, 72, 84, 72, 78,
    114, 84, 72, 133, 72, 114, 140, 133, 72, 140, 99, 73, 193, 73, 99, 321, 147,
    73, 321, 73, 151, 193, 74, 91, 146, 121, 74, 122, 74, 121, 149, 122, 74,
    146, 116, 75, 173, 75, 116, 207, 135, 75, 174, 75, 150, 173, 174, 75, 207,
    103, 76, 113, 76, 103, 153, 76, 109, 113, 92, 77, 114, 114, 77, 128, 83, 78,
    84, 78, 83, 92, 78, 92, 114, 79, 80, 169, 80, 170, 189, 86, 81, 102, 102,
    81, 104, 82, 162, 182, 82, 182, 187, 83, 84, 160, 92, 83, 157, 83, 97, 154,
    97, 83, 160, 83, 154, 157, 84, 133, 148, 84, 148, 160, 101, 86, 102, 87, 92,
    142, 115, 87, 142, 89, 90, 205, 89, 106, 109, 106, 89, 205, 205, 90, 208,
    91, 111, 130, 146, 91, 147, 142, 92, 157, 124, 93, 143, 94, 100, 186, 100,
    94, 208, 150, 94, 186, 97, 95, 110, 110, 95, 151, 96, 115, 142, 96, 142,
    155, 97, 110, 332, 154, 97, 332, 144, 99, 145, 99, 144, 321, 145, 99, 167,
    167, 99, 178, 100, 195, 196, 195, 100, 208, 103, 119, 153, 104, 164, 194,
    105, 126, 129, 128, 105, 129, 109, 106, 123, 106, 117, 118, 117, 106, 205,
    106, 118, 127, 123, 106, 125, 125, 106, 250, 106, 127, 250, 107, 112, 137,
    107, 137, 209, 117, 108, 118, 113, 109, 123, 110, 111, 332, 110, 142, 157,
    142, 110, 328, 110, 157, 328, 142, 111, 155, 111, 142, 328, 154, 111, 328,
    111, 154, 332, 137, 112, 165, 113, 123, 129, 126, 113, 129, 114, 128, 139,
    114, 139, 140, 135, 117, 205, 127, 118, 131, 153, 119, 162, 162, 119, 182,
    120, 134, 159, 121, 122, 177, 149, 121, 185, 121, 177, 203, 180, 121, 203,
    122, 146, 177, 123, 125, 129, 129, 125, 139, 139, 125, 140, 140, 125, 250,
    127, 131, 133, 127, 133, 140, 127, 140, 250, 128, 129, 139, 133, 131, 148,
    156, 132, 158, 132, 156, 200, 185, 132, 192, 192, 132, 200, 159, 134, 161,
    136, 175, 183, 136, 183, 191, 136, 191, 251, 138, 137, 165, 137, 138, 172,
    137, 172, 209, 138, 165, 191, 172, 138, 202, 138, 191, 204, 202, 138, 204,
    144, 145, 177, 144, 146, 147, 146, 144, 177, 144, 147, 321, 145, 167, 202,
    177, 145, 202, 184, 149, 192, 149, 185, 192, 173, 150, 186, 152, 153, 162,
    157, 154, 328, 156, 190, 201, 156, 199, 200, 199, 156, 201, 163, 174, 207,
    188, 166, 190, 166, 188, 196, 195, 166, 196, 166, 195, 198, 172, 167, 178,
    167, 172, 202, 170, 176, 189, 172, 178, 179, 172, 179, 210, 209, 172, 210,
    177, 202, 203, 179, 178, 197, 179, 197, 206, 191, 183, 204, 187, 199, 201,
    203, 202, 204, 234, 236, 248, 236, 234, 252, 234, 248, 252, 237, 235, 249,
    235, 237, 253, 249, 235, 253, 248, 236, 252, 237, 249, 253, 259, 256, 275,
    256, 259, 278, 275, 256, 278, 259, 275, 278, 292, 287, 308, 287, 292, 312,
    308, 287, 312, 297, 292, 312, 292, 297, 316, 292, 308, 312, 312, 292, 316,
    297, 312, 316,
  ],
};

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

main();
