let container;
let camera;
let renderer;
let scene;
let mesh;
let controls;

function createCamera() {
    const fov = 45; // fov = Field Of View
    const aspect = container.clientWidth / container.clientHeight;
    const near = 0.1;
    const far = 10000;

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    camera.position.set(1000, 1000, 200);
}

function createMeshes() {
    const geometry = new THREE.PlaneBufferGeometry(8000, 8000, 256, 256);
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    const textureLoader = new THREE.TextureLoader();

    const bumpTexture = textureLoader.load('textures/height_map.png');
    bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
    const oceanTexture = textureLoader.load('textures/water512.jpg');
    oceanTexture.wrapS = oceanTexture.wrapT = THREE.RepeatWrapping;
    const sandyTexture = textureLoader.load('textures/sand-512.jpg');
    sandyTexture.wrapS = sandyTexture.wrapT = THREE.RepeatWrapping;
    const grassTexture = textureLoader.load('textures/grass-512.jpg');
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    const rockyTexture = textureLoader.load('textures/rock-512.jpg');
    rockyTexture.wrapS = rockyTexture.wrapT = THREE.RepeatWrapping;
    const snowyTexture = textureLoader.load('textures/snow-512.jpg');
    snowyTexture.wrapS = snowyTexture.wrapT = THREE.RepeatWrapping;
    // magnitude of normal displacement
    const bumpScale = 400.0;

    let customUniforms = {
        bumpTexture: {type: "t", value: bumpTexture},
        bumpScale: {type: "f", value: bumpScale},
        oceanTexture: {type: "t", value: oceanTexture},
        sandyTexture: {type: "t", value: sandyTexture},
        grassTexture: {type: "t", value: grassTexture},
        rockyTexture: {type: "t", value: rockyTexture},
        snowyTexture: {type: "t", value: snowyTexture},
        fogColor: {type: "c", value: scene.fog.color},
        fogNear: {type: "f", value: scene.fog.near},
        fogFar: {type: "f", value: scene.fog.far}
    };


    const customMaterial = new THREE.ShaderMaterial(
        {
            uniforms: customUniforms,
            vertexShader: document.getElementById('vertexShader').textContent,
            fragmentShader: document.getElementById('fragmentShader').textContent,
            fog: true
        });

    const plane = new THREE.Mesh(geometry, customMaterial);
    plane.position.set(0, -150, 0);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

}

function createLights() {
    const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x202020, 5);

    const mainLight = new THREE.DirectionalLight(0xffffff, 5);
    mainLight.position.set(10, 10, 10);

    scene.add(ambientLight, mainLight);
}

function createRenderer() {
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.gammaFactor = 2.2;
    renderer.gammaOutput = true;

    renderer.physicallyCorrectLights = true;

    container.appendChild(renderer.domElement);
}

function createControls() {
    controls = new THREE.OrbitControls(camera, container);
    controls.maxDistance = 4500;
    controls.maxPolarAngle = Math.PI / 2 - Math.PI / 8;
    controls.minDistance = 300;
    controls.keyPanSpeed = 21.0;
    controls.update();

}

function init() {
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('lightblue', 1, 6000);
    scene.background = new THREE.Color('lightblue');

    createCamera();
    createMeshes();
    createLights();
    createControls();
    createRenderer();

    renderer.setAnimationLoop(() => {
        update();
        render();
    });

}
function update() { }

function render() {
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);

}

window.addEventListener('resize', onWindowResize);

init();
