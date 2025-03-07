import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

// Scene setup
const scene = new THREE.Scene();

// Camera setup
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 1, 5);
scene.add(camera);

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.shadowMap.enabled = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 2, 20);
pointLight.position.set(0, 5, 5);
scene.add(pointLight);

// Light animation
let angle = 0;
function animateLight() {
  angle += 0.01;
  pointLight.position.x = 5 * Math.cos(angle);
  pointLight.position.z = 5 * Math.sin(angle);
}

// Texture loader
const textureLoader = new TextureLoader();
const monitorTextures = [
  textureLoader.load('./textures/screen1.png'), 
  textureLoader.load('./textures/screen2.png') 
];


// textureLoader.load('./textures/screen1.png', (texture) => {
//   console.log('Texture 1 Loaded:', texture);
// });
// textureLoader.load('./textures/screen2.png', (texture) => {
//   console.log('Texture 2 Loaded:', texture);
// });



let currentTextureIndex = 0;

// GLTF Loader for gaming desk, monitor, and CPU
const gltfLoader = new GLTFLoader();
let monitorMesh = null;

// Load Monitor
gltfLoader.load('./models/scene.gltf', (gltf) => {
  const monitor = gltf.scene;
  monitor.position.set(0, 0, 0);
  monitor.scale.set(1.5, 1.5, 1.5);
  scene.add(monitor);
  console.log(monitor);
  monitor.traverse((child) => {
    if (child.isMesh && child.name === 'Screen') {
      monitorMesh = child;
      monitorMesh.material = new THREE.MeshStandardMaterial({
        map: monitorTextures[currentTextureIndex], 
      });
    }
  });
});


// Mouse interaction - Change monitor texture
window.addEventListener('click', () => {
  if (monitorMesh) {
    currentTextureIndex = (currentTextureIndex + 1) % monitorTextures.length;
    monitorMesh.material.map = monitorTextures[currentTextureIndex];
    monitorMesh.material.needsUpdate = true;
    console.log("Texture changed to: ", monitorTextures[currentTextureIndex]);
  }
});




// Keyboard interaction - Move around the desktop
const movement = { forward: false, backward: false, left: false, right: false };
const speed = 0.1;

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyW') movement.forward = true;
  if (event.code === 'KeyS') movement.backward = true;
  if (event.code === 'KeyA') movement.left = true;
  if (event.code === 'KeyD') movement.right = true;
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'KeyW') movement.forward = false;
  if (event.code === 'KeyS') movement.backward = false;
  if (event.code === 'KeyA') movement.left = false;
  if (event.code === 'KeyD') movement.right = false;
});

// Orbit Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Animation loop
const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();

  // Move camera with keyboard input
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  if (movement.forward) camera.position.addScaledVector(direction, speed);
  if (movement.backward) camera.position.addScaledVector(direction, -speed);
  if (movement.left) camera.position.x -= speed;
  if (movement.right) camera.position.x += speed;

  animateLight();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});
