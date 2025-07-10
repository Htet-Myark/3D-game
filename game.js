// Game variables
let scene, camera, renderer, player, collectibles = [];
let keys = {};
let score = 0;
let gameWon = false;
let gameOver = false;
let timeLeft = 20;
let gameTimer;
let startTime;

// Mobile touch controls
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
let joystickInput = { x: 0, y: 0 };
let touchStartPos = { x: 0, y: 0 };

// Game constants
const PLAYER_SPEED = 0.1;
const WORLD_SIZE = 20;
const NUM_COLLECTIBLES = 10;
const GAME_TIME = 20;

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
    startGameTimer();
    animate();
}

// Create the 3D scene
function createScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
}

// Create the camera
function createCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
}

// Create the renderer
function createRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('gameContainer').appendChild(renderer.domElement);
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
    const playerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
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
            color: new THREE.Color().setHSL(Math.random(), 1, 0.5)
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
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    // Mobile touch events
    setupMobileControls();
    
    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Setup mobile touch controls
function setupMobileControls() {
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystickKnob');
    
    if (!joystick) return;
    
    // Get joystick center position
    function updateJoystickCenter() {
        const rect = joystick.getBoundingClientRect();
        joystickCenter.x = rect.left + rect.width / 2;
        joystickCenter.y = rect.top + rect.height / 2;
    }
    
    // Touch start
    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        updateJoystickCenter();
        
        const touch = e.touches[0];
        touchStartPos.x = touch.clientX;
        touchStartPos.y = touch.clientY;
    });
    
    // Touch move
    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - joystickCenter.x;
        const deltaY = touch.clientY - joystickCenter.y;
        
        // Limit joystick movement to circle
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 40; // Half of joystick radius
        
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            joystickInput.x = Math.cos(angle) * maxDistance;
            joystickInput.y = Math.sin(angle) * maxDistance;
        } else {
            joystickInput.x = deltaX;
            joystickInput.y = deltaY;
        }
        
        // Update knob position
        joystickKnob.style.transform = `translate(${joystickInput.x - 20}px, ${joystickInput.y - 20}px)`;
        
        // Normalize input (-1 to 1)
        joystickInput.x = joystickInput.x / maxDistance;
        joystickInput.y = joystickInput.y / maxDistance;
    });
    
    // Touch end
    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        joystickInput.x = 0;
        joystickInput.y = 0;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
    });
    
    // Prevent context menu on long press
    joystick.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Handle player input
function handleInput() {
    if (gameWon || gameOver) return;
    
    const moveVector = new THREE.Vector3();
    
    // Keyboard input
    if (keys['KeyW'] || keys['ArrowUp']) {
        moveVector.z -= PLAYER_SPEED;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        moveVector.z += PLAYER_SPEED;
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
        moveVector.x -= PLAYER_SPEED;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        moveVector.x += PLAYER_SPEED;
    }
    
    // Mobile joystick input
    if (joystickActive || (joystickInput.x !== 0 || joystickInput.y !== 0)) {
        moveVector.x += joystickInput.x * PLAYER_SPEED;
        moveVector.z += joystickInput.y * PLAYER_SPEED;
    }
    
    // Apply movement
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
                document.getElementById('gameOverTitle').textContent = 'Congratulations!';
                document.getElementById('gameOverMessage').textContent = 'You collected all items in time!';
                document.getElementById('gameOver').style.display = 'block';
            }
        }
    }
}

// Update UI elements
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('itemsLeft').textContent = collectibles.length;
    document.getElementById('timeLeft').textContent = timeLeft;
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
    const timerElement = document.getElementById('timer');
    if (timeLeft <= 5) {
        timerElement.style.color = '#ff3333';
    } else if (timeLeft <= 10) {
        timerElement.style.color = '#ff9933';
    } else {
        timerElement.style.color = '#ff6b6b';
    }
    
    updateUI();
    
    // Check if time is up
    if (timeLeft <= 0) {
        gameOver = true;
        clearInterval(gameTimer);
        document.getElementById('gameOverTitle').textContent = 'Time\'s Up!';
        document.getElementById('gameOverMessage').textContent = `You collected ${score} out of ${NUM_COLLECTIBLES} items.`;
        document.getElementById('gameOver').style.display = 'block';
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
    document.getElementById('gameOver').style.display = 'none';
    
    // Remove existing collectibles
    collectibles.forEach(collectible => scene.remove(collectible));
    
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