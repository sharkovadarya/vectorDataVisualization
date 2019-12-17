let container;
let camera;
let renderer;
let scene;
let mesh;
let controls;
let bufferScene;
let bufferTexture;
let bufferCamera;
let bufferRenderer;
let textureMatrix;


const svgs = ['svgs/Svg_example3.svg', 'svgs/Svg_example3b.svg']; //, 'svgs/SVG_example7.svg'

function createCamera(positionX, positionY, positionZ) {
    const fov = 45; // fov = Field Of View
    const aspect = container.clientWidth / container.clientHeight;
    const near = 0.1;
    //const far = 10000;
    const far = 20000;

    let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(positionX, positionY, positionZ);

    //camera.position.set(1000, 1000, 200);
    //camera.position.set(0, 0, 500);

    return camera
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
    const vectorsTexture = bufferTexture.texture;
    // magnitude of normal displacement
    const bumpScale = 400.0;

    textureMatrix = new THREE.Matrix4();

    let customUniforms = {
        bumpTexture: {type: "t", value: bumpTexture},
        bumpScale: {type: "f", value: bumpScale},
        oceanTexture: {type: "t", value: oceanTexture},
        sandyTexture: {type: "t", value: sandyTexture},
        grassTexture: {type: "t", value: grassTexture},
        rockyTexture: {type: "t", value: rockyTexture},
        snowyTexture: {type: "t", value: snowyTexture},
        vectorTexture: {type: "t", value: vectorsTexture},
        fogColor: {type: "c", value: scene.fog.color},
        fogNear: {type: "f", value: scene.fog.near},
        fogFar: {type: "f", value: scene.fog.far},
        N: {type: "f", value: 2000.0},
        textureMatrix: {type: "m4", value: textureMatrix}
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
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
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

function initBufferTexture() {
    bufferScene = new THREE.Scene();

    bufferTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });

    for (let i = 0; i < 5; ++i) {
        for (let j = 0; j < 3; ++j) {
            const plane1 = new THREE.PlaneBufferGeometry(50, 50, 256, 256);
            let color = new THREE.Color( 0xffffff );
            color.setHex( Math.random() * 0xffffff );
            const material1 = new THREE.MeshBasicMaterial( { color: color } );
            const mesh1 = new THREE.Mesh(plane1, material1);
            mesh1.position.set(-300 + 150 * i, -150 + 150 * j, 0);
            bufferScene.add(mesh1);
        }
    }
}

function createTextureMatrix() {
    const orthographicCamera = new THREE.OrthographicCamera(
        container.clientWidth / -2, container.clientWidth / 2,
        container.clientHeight / -2, container.clientHeight / 2,
        1, 10000
    );
    textureMatrix = textureMatrix.makeTranslation(0.5, 0.5, 0.5);
    textureMatrix = textureMatrix.makeScale(0.5, 0.5, 0.5);
    textureMatrix = textureMatrix.multiply(orthographicCamera.projectionMatrix);
    textureMatrix = textureMatrix.multiply(camera.matrixWorld.inverse());
}

function init() {
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('lightblue', 1, 6000);
    scene.background = new THREE.Color('lightblue');

    camera = createCamera(1000, 1000, 200);
    //camera = createCamera(0, 0, 500);
    bufferCamera = createCamera(0, 0, 500);
    initBufferTexture();
    createMeshes();
    createLights();
    createControls();
    createRenderer();

    renderer.setAnimationLoop(() => {
        update();
        render();
    });

    createTextureMatrix();
}

function update() {
}

function render() {
    renderer.setRenderTarget(bufferTexture);
    renderer.render(bufferScene, bufferCamera);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);

}

window.addEventListener('resize', onWindowResize);

init();
