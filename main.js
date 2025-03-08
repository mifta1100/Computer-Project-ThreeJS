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

// RGB Lighting Shader
const rgbLightingVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rgbLightingFragmentShader = `
  uniform float time;
  uniform vec3 baseColor;
  uniform sampler2D baseTexture;
  uniform bool useTexture;
  uniform float intensity;
  uniform float speed;
  uniform float pulseFrequency;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  vec3 hsvToRgb(vec3 hsv) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsv.y);
  }
  
  void main() {
    // Get base color
    vec3 color = baseColor;
    if(useTexture) {
      color = texture2D(baseTexture, vUv).rgb;
    }
    
    // Create RGB wave effect based on position and time
    float hue = fract((vPosition.x * 0.1 + vPosition.y * 0.1) + time * speed);
    float saturation = 1.0;
    float brightness = 0.5 + 0.5 * sin(time * pulseFrequency);
    
    // Mix RGB effect with base color
    vec3 rgbColor = hsvToRgb(vec3(hue, saturation, 1.0));
    color = mix(color, rgbColor, intensity * brightness);
    
    // Add edge glow effect
    float edgeIntensity = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    color = mix(color, rgbColor, edgeIntensity * intensity * 1.5);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Create RGB shader material
function createRGBShaderMaterial(baseTexture = null, baseColor = new THREE.Color(0x333333), intensity = 0.8) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseTexture: { value: baseTexture },
      useTexture: { value: baseTexture !== null },
      baseColor: { value: baseColor },
      intensity: { value: intensity },
      speed: { value: 0.5 },
      pulseFrequency: { value: 3.0 }
    },
    vertexShader: rgbLightingVertexShader,
    fragmentShader: rgbLightingFragmentShader,
    side: THREE.DoubleSide
  });
}

// GLTF Loader for gaming desk, monitor, CPU, headset, and mouse
const gltfLoader = new GLTFLoader();
let monitorMesh = null;
let cpuMeshes = [];
let cpuLeftSideMesh = null;
let desktopModel = null;
let headsetMeshes = [];
let mouseMeshes = [];

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

// Function to identify headset and mouse meshes
function identifyPeripherals(node, parentName) {
  // Simple checks based on naming - adjust based on your model's structure
  const nodeName = node.name.toLowerCase();
  
  if (nodeName.includes('headset') || nodeName.includes('headphone') || 
      (parentName && parentName.toLowerCase().includes('headset'))) {
    if (node.isMesh) {
      headsetMeshes.push(node);
      console.log("Headset mesh found:", node.name);
      return true;
    }
  }
  
  if (nodeName.includes('mouse') || 
      (parentName && parentName.toLowerCase().includes('mouse'))) {
    if (node.isMesh) {
      mouseMeshes.push(node);
      console.log("Mouse mesh found:", node.name);
      return true;
    }
  }
  
  return false;
}

// Load Monitor, CPU, Headset, and Mouse
gltfLoader.load('./models/scene.gltf', (gltf) => {
  const model = gltf.scene;
  model.position.set(0, 0, 0);
  model.scale.set(1.5, 1.5, 1.5);
  
  // Add the model to our container
  desktopContainer.add(model);
  desktopModel = model;
  
  console.log("Full model structure:", model);
  
  // Find all components
  model.traverse((child) => {
    const parentName = child.parent ? child.parent.name : '';
    
    // Find and apply texture to monitor screen
    if (child?.children[0]?.isMesh && child.name === 'monitor_3') {
      monitorMesh = child.children[0];
      monitorMesh.material = new THREE.MeshStandardMaterial({
        map: monitorTextures[currentTextureIndex], 
      });
    }
    
    // Store CPU-related meshes
    if (child.isMesh && (
        child.name.toLowerCase().includes('cpu') || 
        child.name.toLowerCase().includes('computer') || 
        child.name.toLowerCase().includes('tower') ||
        (child.parent && child.parent.name.toLowerCase().includes('cpu')) ||
        (child.parent && child.parent.name.toLowerCase().includes('computer')))) {
      
      cpuMeshes.push(child);
      
      // Check left side of CPU
      if (isLeftSideOfCPU(child, parentName)) {
        cpuLeftSideMesh = child;
        
        // Apply custom texture to left side of CPU
        cpuLeftSideMesh.material = new THREE.MeshStandardMaterial({
          map: cpuLeftTexture,
          metalness: 0.5,
          roughness: 0.2
        });
      }
    }
    
    // Identify headset and mouse meshes
    identifyPeripherals(child, parentName);
  });
  
  // If no headset or mouse found in the model naming, we'll search based on position
  if (headsetMeshes.length === 0 || mouseMeshes.length === 0) {
    console.log("Looking for peripherals based on position...");
    
    // Identify potential peripherals by position (example logic, adjust based on your model)
    model.traverse((child) => {
      if (child.isMesh) {
        // Example: If a mesh is in a certain position relative to the desk, it might be a headset
        if (child.position.y > 0.5 && !headsetMeshes.includes(child) && 
            !identifyPeripherals(child, child.parent?.name)) {
          headsetMeshes.push(child);
          console.log("Potential headset found by position:", child.name, child.position);
        }
        
        // Example: If a mesh is at desk level and small, it might be a mouse
        if (child.position.y < 0.3 && child.scale.x < 0.5 && child.scale.z < 0.5 && 
            !mouseMeshes.includes(child) && !cpuMeshes.includes(child) && 
            !identifyPeripherals(child, child.parent?.name)) {
          mouseMeshes.push(child);
          console.log("Potential mouse found by position:", child.name, child.position);
        }
      }
    });
  }
  
  // If still no headset or mouse found, we'll manually create some placeholder meshes
  if (headsetMeshes.length === 0) {
    console.log("Creating placeholder headset");
    const headsetGeometry = new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8);
    const headsetMesh = new THREE.Mesh(headsetGeometry);
    headsetMesh.position.set(1.5, 1.0, 0);
    headsetMesh.scale.set(0.3, 0.3, 0.3);
    headsetMesh.name = "headset_placeholder";
    desktopContainer.add(headsetMesh);
    headsetMeshes.push(headsetMesh);
  }
  
  if (mouseMeshes.length === 0) {
    console.log("Creating placeholder mouse");
    const mouseGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.5);
    const mouseMesh = new THREE.Mesh(mouseGeometry);
    mouseMesh.position.set(0.7, 0.05, 0.5);
    mouseMesh.name = "mouse_placeholder";
    desktopContainer.add(mouseMesh);
    mouseMeshes.push(mouseMesh);
  }
  
  // Apply RGB shader to headset
  if (headsetMeshes.length > 0) {
    headsetMeshes.forEach(mesh => {
      if (!mesh.originalMaterial) {
        mesh.originalMaterial = mesh.material?.clone() || new THREE.MeshStandardMaterial({ color: 0x333333 });
      }
      
      // Create RGB shader material for headset with a different pattern
      const headsetMaterial = createRGBShaderMaterial(
        null, 
        new THREE.Color(0x222222), 
        0.9  // Higher intensity for headset
      );
      headsetMaterial.uniforms.speed.value = 0.3;  // Slower color cycle
      headsetMaterial.uniforms.pulseFrequency.value = 2.0;  // Different pulse frequency
      
      mesh.material = headsetMaterial;
      console.log("Applied RGB shader to headset:", mesh.name);
    });
  }
  
  // Apply RGB shader to mouse
  if (mouseMeshes.length > 0) {
    mouseMeshes.forEach(mesh => {
      if (!mesh.originalMaterial) {
        mesh.originalMaterial = mesh.material?.clone() || new THREE.MeshStandardMaterial({ color: 0x333333 });
      }
      
      // Create RGB shader material for mouse with a different pattern
      const mouseMaterial = createRGBShaderMaterial(
        null, 
        new THREE.Color(0x111111), 
        0.8
      );
      mouseMaterial.uniforms.speed.value = 0.7;  // Faster color cycle for mouse
      mouseMaterial.uniforms.pulseFrequency.value = 4.0;  // Different pulse frequency
      
      mesh.material = mouseMaterial;
      console.log("Applied RGB shader to mouse:", mesh.name);
    });
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

// Keyboard interaction - RGB Effect Control
document.addEventListener('keydown', (event) => {
  // Number keys to select CPU mesh (original functionality)
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
  
  // New controls for RGB effects
  
  // 'H' to toggle RGB effect on headset
  if (event.code === 'KeyH') {
    headsetMeshes.forEach(mesh => {
      if (mesh.material.type === 'ShaderMaterial') {
        // Turn off RGB effect - restore original material
        if (mesh.originalMaterial) {
          mesh.material = mesh.originalMaterial;
          console.log("Turned off RGB effect on headset");
        }
      } else {
        // Turn on RGB effect
        const headsetMaterial = createRGBShaderMaterial(
          null, 
          new THREE.Color(0x222222), 
          0.9
        );
        headsetMaterial.uniforms.speed.value = 0.3;
        headsetMaterial.uniforms.pulseFrequency.value = 2.0;
        
        mesh.material = headsetMaterial;
        console.log("Turned on RGB effect on headset");
      }
      mesh.material.needsUpdate = true;
    });
  }
  
  // 'M' to toggle RGB effect on mouse
  if (event.code === 'KeyM') {
    mouseMeshes.forEach(mesh => {
      if (mesh.material.type === 'ShaderMaterial') {
        // Turn off RGB effect - restore original material
        if (mesh.originalMaterial) {
          mesh.material = mesh.originalMaterial;
          console.log("Turned off RGB effect on mouse");
        }
      } else {
        // Turn on RGB effect
        const mouseMaterial = createRGBShaderMaterial(
          null, 
          new THREE.Color(0x111111), 
          0.8
        );
        mouseMaterial.uniforms.speed.value = 0.7;
        mouseMaterial.uniforms.pulseFrequency.value = 4.0;
        
        mesh.material = mouseMaterial;
        console.log("Turned on RGB effect on mouse");
      }
      mesh.material.needsUpdate = true;
    });
  }
  
  
  if (event.shiftKey && !isNaN(key) && key >= 1 && key <= 5) {
    const patterns = [
      { speed: 0.3, pulse: 2.0, intensity: 0.8 }, 
      { speed: 0.7, pulse: 4.0, intensity: 0.9 },  
      { speed: 0.1, pulse: 0.5, intensity: 1.0 },  
      { speed: 1.2, pulse: 1.0, intensity: 0.7 },  
      { speed: 0.5, pulse: 8.0, intensity: 0.85 }  
    ];
    
    const pattern = patterns[key - 1];
    
    // Apply pattern to headset and mouse
    [...headsetMeshes, ...mouseMeshes].forEach(mesh => {
      if (mesh.material.type === 'ShaderMaterial') {
        mesh.material.uniforms.speed.value = pattern.speed;
        mesh.material.uniforms.pulseFrequency.value = pattern.pulse;
        mesh.material.uniforms.intensity.value = pattern.intensity;
        console.log(`Applied RGB pattern ${key} to ${mesh.name}`);
      }
    });
  }
  
  // 'R' to reset all textures (original functionality)
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

// Keyboard interaction - Movement (original functionality)
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
  const elapsedTime = clock.getElapsedTime();
  const delta = clock.getDelta();

  // Update shader uniforms for RGB effects
  [...headsetMeshes, ...mouseMeshes].forEach(mesh => {
    if (mesh.material.type === 'ShaderMaterial') {
      mesh.material.uniforms.time.value = elapsedTime;
    }
  });

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