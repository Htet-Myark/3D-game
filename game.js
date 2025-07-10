// Game variables
let scene, camera, renderer, player, collectibles = [];
let keys = {};
let score = 0;
let gameWon = false;
let gameOver = false;
let timeLeft = 20;
let gameTimer;
let startTime;
let leaderboard = [];

// Mobile controls
let joystickActive = false;
let joystickDirection = { x: 0, y: 0 };

// Game constants
const PLAYER_SPEED = 0.1;
const WORLD_SIZE = 20;
const NUM_COLLECTIBLES = 10;
const GAME_TIME = 20;

// Simple shared leaderboard using localStorage
const LEADERBOARD_KEY = 'game_leaderboard_v1';

// Initialize the game
function init() {
  createScene();
  createCamera();
  createRenderer();
  addLights();
  createGround();
  createPlayer();
  createCollectibles();
  setupEventListeners();
  setupMobileControls();
  loadLeaderboard();
  startGameTimer();
  animate();
}

// Leaderboard functions
function submitScore() {
  const name = document.getElementById("playerName").value.trim();
  if (!name) return;

  const newEntry = { 
    name: name, 
    score: score, 
    timestamp: Date.now(),
    finalTime: GAME_TIME - timeLeft 
  };

  // Add to leaderboard
  leaderboard.push(newEntry);
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.finalTime - b.finalTime; // If same score, faster time wins
  });
  
  // Keep top 10
  if (leaderboard.length > 10) leaderboard = leaderboard.slice(0, 10);

  // Save to localStorage (simulating shared storage)
  saveLeaderboard();
  
  updateLeaderboardUI();
  document.getElementById("nameInput").style.display = "none";
  document.getElementById("leaderboard").style.display = "block";
}

function saveLeaderboard() {
  try {
    const existingData = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
    const allEntries = [...existingData, ...leaderboard];
    
    // Remove duplicates and sort
    const uniqueEntries = allEntries.filter((entry, index, self) => 
      index === self.findIndex(e => e.name === entry.name && e.score === entry.score && e.timestamp === entry.timestamp)
    );
    
    uniqueEntries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.finalTime - b.finalTime;
    });
    
    const topEntries = uniqueEntries.slice(0, 10);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(topEntries));
    leaderboard = topEntries;
  } catch (e) {
    console.log('Could not save leaderboard');
  }
}

function loadLeaderboard() {
  try {
    const saved = localStorage.getItem(LEADERBOARD_KEY);
    if (saved) {
      leaderboard = JSON.parse(saved);
    }
  } catch (e) {
    console.log('Could not load leaderboard');
    leaderboard = [];
  }
}

function updateLeaderboardUI() {
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";
  
  if (leaderboard.length === 0) {
    const noScores = document.createElement("li");
    noScores.textContent = "No scores yet - be the first!";
    noScores.className = "no-scores";
    list.appendChild(noScores);
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    const timeText = entry.finalTime ? ` (${entry.finalTime.toFixed(1)}s)` : '';
    item.textContent = `${index + 1}. ${entry.name} - ${entry.score} points${timeText}`;
    list.appendChild(item);
  });
}

// Setup mobile controls
function setupMobileControls() {
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystickKnob');
  
  function getDistance(touch, element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return {
      x: touch.clientX - centerX,
      y: touch.clientY - centerY
    };
  }

  function updateJoystick(distance) {
    const maxDistance = 40;
    const length = Math.sqrt(distance.x * distance.x + distance.y * distance.y);
    
    if (length > maxDistance) {
      distance.x = (distance.x / length) * maxDistance;
      distance.y = (distance.y / length) * maxDistance;
    }
    
    knob.style.transform = `translate(-50%, -50%) translate(${distance.x}px, ${distance.y}px)`;
    
    // Update direction for game movement
    joystickDirection.x = distance.x / maxDistance;
    joystickDirection.y = distance.y / maxDistance;
  }

  joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const touch = e.touches[0];
    const distance = getDistance(touch, joystick);
    updateJoystick(distance);
  });

  joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystickActive) return;
    const touch = e.touches[0];
    const distance = getDistance(touch, joystick);
    updateJoystick(distance);
  });

  joystick.addEventListener('touchend', (e) => {
    e.preventDefault();
    joystickActive = false;
    knob.style.transform = 'translate(-50%, -50%)';
    joystickDirection.x = 0;
    joystickDirection.y = 0;
  });

  // Prevent scrolling on mobile
  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}

// Create the 3D scene
function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
}

// Create the camera
function createCamera() {
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
}

// Create the renderer
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("gameContainer").appendChild(renderer.domElement);
}

// Add lighting to the scene
function addLights() {
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);
}

// Create the ground
function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

// Create the player
function createPlayer() {
  const playerGeometry = new THREE.BoxGeometry(2, 1, 0.5);
  const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.set(0, 0.5, 0);
  player.castShadow = true;
  scene.add(player);
}

// Create collectible items
function createCollectibles() {
  collectibles = [];
  for (let i = 0; i < NUM_COLLECTIBLES; i++) {
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
    });
    const collectible = new THREE.Mesh(geometry, material);

    collectible.position.set(
      (Math.random() - 0.5) * WORLD_SIZE * 1.5,
      0.4,
      (Math.random() - 0.5) * WORLD_SIZE * 1.5
    );

    collectible.castShadow = true;
    collectible.userData = { originalY: collectible.position.y };
    scene.add(collectible);
    collectibles.push(collectible);
  }
  updateUI();
}

// Setup event listeners
function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
  });

  document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Handle player input
function handleInput() {
  if (gameWon || gameOver) return;

  const moveVector = new THREE.Vector3();

  // Keyboard controls
  if (keys["KeyW"] || keys["ArrowUp"]) {
    moveVector.z -= PLAYER_SPEED;
  }
  if (keys["KeyS"] || keys["ArrowDown"]) {
    moveVector.z += PLAYER_SPEED;
  }
  if (keys["KeyA"] || keys["ArrowLeft"]) {
    moveVector.x -= PLAYER_SPEED;
  }
  if (keys["KeyD"] || keys["ArrowRight"]) {
    moveVector.x += PLAYER_SPEED;
  }

  // Mobile joystick controls
  if (joystickActive || Math.abs(joystickDirection.x) > 0.1 || Math.abs(joystickDirection.y) > 0.1) {
    moveVector.x += joystickDirection.x * PLAYER_SPEED;
    moveVector.z += joystickDirection.y * PLAYER_SPEED;
  }

  player.position.add(moveVector);

  // Keep player within bounds
  player.position.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, player.position.x));
  player.position.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, player.position.z));

  // Update camera to follow player
  camera.position.x = player.position.x;
  camera.position.z = player.position.z + 10;
  camera.lookAt(player.position.x, 0, player.position.z);
}

// Update collectibles animation and collision
function updateCollectibles() {
  const time = Date.now() * 0.001;

  for (let i = collectibles.length - 1; i >= 0; i--) {
    const collectible = collectibles[i];

    // Animate collectible
    collectible.rotation.y += 0.02;
    collectible.position.y = collectible.userData.originalY + Math.sin(time + i) * 0.2;

    // Check collision with player
    const distance = player.position.distanceTo(collectible.position);
    if (distance < 1) {
      scene.remove(collectible);
      collectibles.splice(i, 1);
      score++;
      updateUI();

      // Check win condition
      if (collectibles.length === 0) {
        gameWon = true;
        clearInterval(gameTimer);
        document.getElementById("gameOverTitle").textContent = "Congratulations!";
        document.getElementById("gameOverMessage").textContent = "You collected all items in time!";
        document.getElementById("gameOver").style.display = "block";
        document.getElementById("nameInput").style.display = "block";
      }
    }
  }
}

// Update UI elements
function updateUI() {
  document.getElementById("score").textContent = score;
  document.getElementById("itemsLeft").textContent = collectibles.length;
  document.getElementById("timeLeft").textContent = timeLeft;
}

// Start the game timer
function startGameTimer() {
  startTime = Date.now();
  gameTimer = setInterval(updateTimer, 100);
}

// Update the timer
function updateTimer() {
  if (gameWon || gameOver) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  timeLeft = Math.max(0, GAME_TIME - elapsed);

  // Change color when time is running out
  const timerElement = document.getElementById("timer");
  if (timeLeft <= 5) {
    timerElement.style.color = "#ff3333";
  } else if (timeLeft <= 10) {
    timerElement.style.color = "#ff9933";
  } else {
    timerElement.style.color = "#ff6b6b";
  }

  updateUI();

  // Check if time is up
  if (timeLeft <= 0) {
    gameOver = true;
    clearInterval(gameTimer);
    document.getElementById("gameOverTitle").textContent = "Time's Up!";
    document.getElementById("gameOverMessage").textContent = `You collected ${score} out of ${NUM_COLLECTIBLES} items.`;
    document.getElementById("gameOver").style.display = "block";
    document.getElementById("nameInput").style.display = "block";
  }
}

// Main game loop
function animate() {
  requestAnimationFrame(animate);
  handleInput();
  updateCollectibles();
  renderer.render(scene, camera);
}

// Restart the game
function restartGame() {
  score = 0;
  gameWon = false;
  gameOver = false;
  timeLeft = GAME_TIME;
  clearInterval(gameTimer);
  document.getElementById("gameOver").style.display = "none";
  document.getElementById("nameInput").style.display = "block";
  document.getElementById("leaderboard").style.display = "none";

  // Reset input field
  document.getElementById("playerName").value = "";

  // Remove existing collectibles
  collectibles.forEach((collectible) => scene.remove(collectible));

  // Reset player position
  player.position.set(0, 0.5, 0);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  // Create new collectibles
  createCollectibles();

  // Restart timer
  startGameTimer();
}

// Start the game when page loads
init();