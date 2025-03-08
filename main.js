import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ShaderMaterial, Vector3 } from 'three';
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
  textureLoader.load('./textures/screen2.png'),
  textureLoader.load('./textures/screen3.png'),
  textureLoader.load('./textures/screen4.png'), 
  textureLoader.load('./textures/screen5.png'), 
  textureLoader.load('./textures/screen6.png')  
];

// Load CPU textures for different sides
const cpuLeftTexture = textureLoader.load('./textures/gray.png');

let currentTextureIndex = 0;

// GLTF Loader for gaming desk, monitor, and CPU
const gltfLoader = new GLTFLoader();
let monitorMesh = null;
let cpuMeshes = [];
let cpuLeftSideMesh = null;
let desktopModel = null;

// Create a container for the desktop model
const desktopContainer = new THREE.Group();
scene.add(desktopContainer);


// Adjustment based on your specific model
function isLeftSideOfCPU(mesh, parentName) {
  if (mesh.name.toLowerCase().includes('left') && parentName.toLowerCase().includes('cpu')) {
    return true;
  }
  
  // Method 2: Check by position Center
  if (parentName.toLowerCase().includes('cpu') || parentName.toLowerCase().includes('computer')) {
    if (mesh.position.x < 0) {
      return true;
    }
  }
  
  return false;
}

// Load Monitor and CPU
gltfLoader.load('./models/scene.gltf', (gltf) => {
  const monitor = gltf.scene;
  monitor.position.set(0, 0, 0);
  monitor.scale.set(1.5, 1.5, 1.5);
  
  // Add the model to our container
  desktopContainer.add(monitor);
  desktopModel = monitor;
  
  console.log("Full model structure:", monitor);
  
  // Find all CPU components and the monitor screen
  monitor.traverse((child) => {
    const parentName = child.parent ? child.parent.name : '';
    console.log("Child object:", child.name, "Parent:", parentName, "Position:", child.position);
    
    // Find and apply texture to monitor screen
    if (child?.children[0]?.isMesh && child.name === 'monitor_3') {
      monitorMesh = child.children[0];
      monitorMesh.material = new THREE.MeshStandardMaterial({
        map: monitorTextures[currentTextureIndex], 
      });
    }
    
    // Store all CPU-related meshes
    if (child.isMesh && (
        child.name.toLowerCase().includes('cpu') || 
        child.name.toLowerCase().includes('computer') || 
        child.name.toLowerCase().includes('tower') ||
        (child.parent && child.parent.name.toLowerCase().includes('cpu')) ||
        (child.parent && child.parent.name.toLowerCase().includes('computer')))) {
      
      cpuMeshes.push(child);
      console.log("CPU-related mesh found:", child.name, "Position:", child.position);
      
      // Check left side of CPU
      if (isLeftSideOfCPU(child, parentName)) {
        console.log("Left side of CPU found:", child.name);
        cpuLeftSideMesh = child;
        
        // Apply custom texture to left side of CPU
        cpuLeftSideMesh.material = new THREE.MeshStandardMaterial({
          map: cpuLeftTexture,
          metalness: 0.5,
          roughness: 0.2
        });
      }
    }
  });
  
  if (!cpuLeftSideMesh && cpuMeshes.length > 0) {
    console.log("Available CPU meshes:", cpuMeshes.length);
  }
});

// Mouse interaction - Change monitor texture
window.addEventListener('click', () => {
  if (monitorMesh) {
    currentTextureIndex = (currentTextureIndex + 1) % monitorTextures.length;
    monitorMesh.material.map = monitorTextures[currentTextureIndex];
    monitorMesh.material.needsUpdate = true;
    console.log("Texture changed to: ", monitorTextures[currentTextureIndex]);
    renderer.render(scene, camera);
  }
});

// Manually Test the Left Side
document.addEventListener('keydown', (event) => {
  const key = parseInt(event.key);
  if (!isNaN(key) && key >= 1 && key <= 9 && key <= cpuMeshes.length) {
    const selectedMesh = cpuMeshes[key - 1];
    console.log("Applying texture to mesh:", selectedMesh.name);
    
    // Reset all CPU meshes to original material
    cpuMeshes.forEach(mesh => {
      if (mesh.originalMaterial) {
        mesh.material = mesh.originalMaterial;
      }
    });
    
    // Apply texture to selected mesh
    if (!selectedMesh.originalMaterial) {
      selectedMesh.originalMaterial = selectedMesh.material.clone();
    }
    
    selectedMesh.material = new THREE.MeshStandardMaterial({
      map: cpuLeftTexture,
      metalness: 0.5,
      roughness: 0.2
    });
    selectedMesh.material.needsUpdate = true;
    cpuLeftSideMesh = selectedMesh;
    
    console.log("Texture applied to mesh", key);
    renderer.render(scene, camera);
  }
  
  // Press 'R' to reset all textures
  if (event.code === 'KeyR') {
    cpuMeshes.forEach(mesh => {
      if (mesh.originalMaterial) {
        mesh.material = mesh.originalMaterial;
        mesh.material.needsUpdate = true;
      }
    });
    console.log("Reset all CPU textures");
    renderer.render(scene, camera);
  }
});

// Keyboard interaction - Move and rotate
const movement = { forward: false, backward: false, left: false, right: false };
const speed = 0.1;
const rotationSpeed = 0.03;

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

  // Handle forward-backward movement
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  if (movement.forward) camera.position.addScaledVector(direction, speed);
  if (movement.backward) camera.position.addScaledVector(direction, -speed);
  
  // Rotate the desktop container
  if (movement.left) desktopContainer.rotation.y += rotationSpeed;
  if (movement.right) desktopContainer.rotation.y -= rotationSpeed;

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