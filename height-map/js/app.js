let container;
let camera;
let renderer;
let scene;
let mesh;
let controls;
let bufferScene;
let bufferTexture1;
let bufferTexture2;
let bufferCamera1;
let bufferCamera2;
let textureMatrix1;
let textureMatrix2;

const split = 10;

function createCamera(positionX, positionY, positionZ) {
    const fov = 45;
    const aspect = container.clientWidth / container.clientHeight;
    const near = 0.1;
    const far = 20000;

    let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(positionX, positionY, positionZ);

    return camera
}

function createMeshes() {
    const geometry = new THREE.PlaneBufferGeometry(16000, 16000, 256, 256);
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
    const vectorsTexture1 = bufferTexture1.texture;
    const vectorsTexture2 = bufferTexture2.texture;
    // magnitude of normal displacement
    const bumpScale = 400.0;

    textureMatrix1 = new THREE.Matrix4();
    textureMatrix2 = new THREE.Matrix4();

    let farPlane1 = new THREE.Vector4(0, 0, camera.far / split, 1);
    farPlane1.applyMatrix4(camera.matrixWorldInverse);
    let farPlane2 = new THREE.Vector4(0, 0, camera.far, 1);
    farPlane2.applyMatrix4(camera.matrixWorldInverse);


    let customUniforms = {
        bumpTexture: {type: "t", value: bumpTexture},
        bumpScale: {type: "f", value: bumpScale},
        oceanTexture: {type: "t", value: oceanTexture},
        sandyTexture: {type: "t", value: sandyTexture},
        grassTexture: {type: "t", value: grassTexture},
        rockyTexture: {type: "t", value: rockyTexture},
        snowyTexture: {type: "t", value: snowyTexture},
        vectorsTexture1: {type: "t", value: vectorsTexture1},
        vectorsTexture2: {type: "t", value: vectorsTexture2},
        fogColor: {type: "c", value: scene.fog.color},
        fogNear: {type: "f", value: scene.fog.near},
        fogFar: {type: "f", value: scene.fog.far},
        textureMatrix1: {type: "m4", value: textureMatrix1},
        textureMatrix2: {type: "m4", value: textureMatrix2},
        farPlane1: {type: "f", value: farPlane1.z},
        farPlane2: {type: "f", value: farPlane2.z}
    };


    const customMaterial = new THREE.ShaderMaterial(
        {
            uniforms: customUniforms,
            vertexShader: document.getElementById('vertexShader').textContent,
            fragmentShader: document.getElementById('fragmentShader').textContent,
            // TODO Uncomment fog
            //fog: true
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
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.gammaFactor = 2.2;
    renderer.gammaOutput = true;

    renderer.physicallyCorrectLights = true;

    container.appendChild(renderer.domElement);
}

function createControls() {
    controls = new THREE.OrbitControls(camera, container);
    /*controls.maxDistance = 4500;
    controls.maxPolarAngle = Math.PI / 2 - Math.PI / 8;
    controls.minDistance = 300;
    controls.keyPanSpeed = 21.0;
    controls.update();*/

}

function initBufferTexture() {
    bufferScene = new THREE.Scene();
    // the following line is for debug purposes
    bufferScene.background = new THREE.Color('green');

    bufferTexture1 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });
    bufferTexture2 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });

    for (let i = 0; i < 5; ++i) {
        for (let j = 0; j < 3; ++j) {
            const geometry   = new THREE.CircleGeometry(25, 256);
            let color = new THREE.Color( 0xffffff );
            color.setHex( Math.random() * 0xffffff );
            const material1 = new THREE.MeshBasicMaterial( { color: color } );
            const mesh1 = new THREE.Mesh(geometry, material1);
            mesh1.position.set(-300 + 150 * i, -150 + 150 * j, 0);
            bufferScene.add(mesh1);
        }
    }
}

function cameraToWorld(point, camera) {
    camera.updateWorldMatrix();
    return point.applyMatrix4(camera.matrixWorld);
}

function calculateCameraFrustumCorners(camera) {
    const hNear = 2 * Math.tan(THREE.Math.degToRad(camera.fov) / 2) * camera.near;
    const wNear = hNear * camera.aspect;

    const hFar = 2 * Math.tan(THREE.Math.degToRad(camera.fov) / 2) * camera.far;
    const wFar = hFar * camera.aspect;

    let arr = [new THREE.Vector3(wNear / 2, hNear / 2, camera.near),
               new THREE.Vector3(wNear / -2, hNear / 2, camera.near),
               new THREE.Vector3(wNear / 2, hNear / -2, camera.near),
               new THREE.Vector3(wNear / -2, hNear / -2, camera.near),
               new THREE.Vector3(wFar / 2, hFar / 2, camera.far),
               new THREE.Vector3(-wFar / -2, hFar / 2, camera.far),
               new THREE.Vector3(-wFar / 2, -hFar / -2, camera.far),
               new THREE.Vector3(wFar / -2, hFar / -2, camera.far)];

    return arr.map(function (val, index) {
        return cameraToWorld(val, camera);
    });
}

function getOrthographicProjectionMatrix(minX, maxX, minY, maxY, near, far) {
    const camera = new THREE.OrthographicCamera(minX, maxX, minY, maxY, near, far);
    return camera.projectionMatrix;
}

function getProjectionMatrixForFrustum(frustumCorners) {
    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxZ = Number.MIN_VALUE;
    for (let i = 0; i < frustumCorners.length; i++) {
        let corner = frustumCorners[i];
        let vec = new THREE.Vector4(corner.x, corner.y, corner.z, 1);
        // a transformation is not needed here? we go from view space to world space to light space
        // but light space and view space are the same thing?
        minX = Math.min(vec.x, minX);
        maxX = Math.max(vec.x, maxX);
        minY = Math.min(vec.y, minY);
        maxY = Math.max(vec.y, maxY);
        minZ = Math.min(vec.z, minZ);
        maxZ = Math.max(vec.z, maxZ);
    }

    return getOrthographicProjectionMatrix(minX, maxX, minY, maxY, minZ, maxZ);
}


function createTextureMatrices() {
    // two cascades
    // TODO optimize split
    const nearCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.near, camera.far / split);
    const farCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.far / split, camera.far);

    const nearProjectionMatrix = getProjectionMatrixForFrustum(calculateCameraFrustumCorners(nearCamera));
    const farProjectionMatrix = getProjectionMatrixForFrustum(calculateCameraFrustumCorners(farCamera));

    //textureMatrix1 = textureMatrix1.makeScale(0.5, 0.5, 0.5);
    textureMatrix1 = textureMatrix1.multiply(nearProjectionMatrix);

    //textureMatrix2 = textureMatrix2.makeScale(0.5, 0.5, 0.5);
    textureMatrix2 = textureMatrix2.multiply(farProjectionMatrix);
}

function init() {
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('lightblue', 1, 6000);
    scene.background = new THREE.Color('lightblue');

    camera = createCamera(1000, 1000, 200);
    bufferCamera1 = createCamera(0, 0, 500);
    bufferCamera2 = createCamera(0, 0, 500 * split);
    initBufferTexture();
    createMeshes();
    createLights();
    createControls();
    createRenderer();

    renderer.setAnimationLoop(() => {
        update();
        render();
    });

    createTextureMatrices();
}

function update() {
}

function render() {
    renderer.setRenderTarget(bufferTexture1);
    renderer.render(bufferScene, bufferCamera1);
    renderer.setRenderTarget(bufferTexture2);
    renderer.render(bufferScene, bufferCamera2);
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
