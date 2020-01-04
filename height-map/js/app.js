let container;
let camera;
let renderer;
let scene;
let mesh;
let controls;
let shaderMaterial; // for update
let bufferScene;
let bufferTexture1;
let bufferTexture2;

let debugScene;
let orthographicCamera1;
let orthographicCamera2;

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

function createDebugMeshes() {
    const debugSize = 150;
    const textureGeometry1 = new THREE.PlaneBufferGeometry(debugSize * camera.aspect, debugSize, 128, 128);
    const textureMaterial1 = new THREE.MeshBasicMaterial({map: bufferTexture1.texture, depthTest: false});
    const textureMesh1 = new THREE.Mesh(textureGeometry1, textureMaterial1);

    const textureGeometry2 = new THREE.PlaneBufferGeometry(debugSize * camera.aspect, debugSize, 128, 128);
    const textureMaterial2 = new THREE.MeshBasicMaterial({map: bufferTexture2.texture, depthTest: false});
    const textureMesh2 = new THREE.Mesh(textureGeometry2, textureMaterial2);

    debugScene.add(camera);
    camera.add(textureMesh1);
    textureMesh1.position.set(-550, -300, -1000);
    camera.add(textureMesh2);
    textureMesh2.position.set(-550 + textureMesh1.geometry.parameters.width + 50, -300, -1000);
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
        textureMatrix1: {type: "m4", value: new THREE.Matrix4()},
        textureMatrix2: {type: "m4", value: new THREE.Matrix4()},
        farPlane1: {type: "f", value: farPlane1.z},
        farPlane2: {type: "f", value: farPlane2.z}
    };


    shaderMaterial = new THREE.ShaderMaterial(
        {
            uniforms: customUniforms,
            vertexShader: document.getElementById('vertexShader').textContent,
            fragmentShader: document.getElementById('fragmentShader').textContent,
            // TODO Uncomment fog
            //fog: true
        });

    const plane = new THREE.Mesh(geometry, shaderMaterial);
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

    renderer.outputEncoding = THREE.sRGBEncoding;

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
    //bufferScene.background = new THREE.Color('green');

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
            const geometry = new THREE.CircleGeometry(100, 256);
            let color = new THREE.Color(0xffffff);
            color.setHex(Math.random() * 0xffffff);
            const material1 = new THREE.MeshBasicMaterial({color: color});
            const mesh1 = new THREE.Mesh(geometry, material1);
            mesh1.position.set(-600 + 300 * i, -300 + 300 * j, 0);
            bufferScene.add(mesh1);
        }
    }
}

function cameraToWorld(point, camera) {
    camera.updateWorldMatrix();
    return point.applyMatrix4(camera.matrixWorldInverse);
}

function calculateCameraFrustumCorners(camera) {
    const hFOV = 2 * Math.atan(Math.tan(THREE.Math.degToRad(camera.fov) / 2) * camera.aspect);
    const xNear = Math.tan(hFOV / 2) * camera.near;
    const xFar = Math.tan(hFOV / 2) * camera.far;

    const yNear = Math.tan(THREE.Math.degToRad(camera.fov) / 2) * camera.near;
    const yFar = Math.tan(THREE.Math.degToRad(camera.fov) / 2) * camera.far;

    let arr = [new THREE.Vector3(xNear, yNear, camera.near),
        new THREE.Vector3(xNear * -1, yNear, camera.near),
        new THREE.Vector3(xNear, yNear * -1, camera.near),
        new THREE.Vector3(xNear * -1, yNear * -1, camera.near),
        new THREE.Vector3(xFar, yFar, camera.far),
        new THREE.Vector3(xFar * -1, yFar, camera.far),
        new THREE.Vector3(xFar, yFar * -1, camera.far),
        new THREE.Vector3(xFar * -1, yFar * -1, camera.far)];


    return arr.map(function (val) {
        return cameraToWorld(val, camera);
    });
}

function getProjectionMatrixForFrustum(camera) {
    //return new THREE.OrthographicCamera(container.clientWidth / -2, container.clientWidth / 2, container.clientHeight / 2, container.clientHeight / -2, 1, 10000);
    const frustumCorners = calculateCameraFrustumCorners(camera);

    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxZ = Number.MIN_VALUE;
    for (let i = 0; i < frustumCorners.length; i++) {
        let corner = frustumCorners[i];
        // a transformation is not needed here? we go from view space to world space to light space
        // but light space and view space are the same thing?
        minX = Math.min(corner.x, minX);
        maxX = Math.max(corner.x, maxX);
        minY = Math.min(corner.y, minY);
        maxY = Math.max(corner.y, maxY);
        minZ = Math.min(corner.z, minZ);
        maxZ = Math.max(corner.z, maxZ);
    }

    return new THREE.OrthographicCamera(minX / 8, maxX / 8, maxY / 8, minY / 8, minZ, maxZ);
}


function createTextureMatrices() {
    shaderMaterial.uniforms.textureMatrix1.value = orthographicCamera1.projectionMatrix;
    shaderMaterial.uniforms.textureMatrix2.value = orthographicCamera2.projectionMatrix;
}

function init() {
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('lightblue', 1, 6000);
    scene.background = new THREE.Color('lightblue');

    debugScene = new THREE.Scene();

    camera = createCamera(1000, 1000, 200);
    initBufferTexture();
    createMeshes();
    createDebugMeshes();
    createLights();
    createControls();
    createRenderer();

    renderer.setAnimationLoop(() => {
        update();
        render();
    });

}

function update() {
}

function createOrthographicCameras() {
    const nearCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.near, camera.far / split);
    nearCamera.position.set(camera.position.x, camera.position.y, camera.position.z);
    const farCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.far / split, camera.far);
    farCamera.position.set(camera.position.x, camera.position.y, camera.position.z);

    orthographicCamera1 = getProjectionMatrixForFrustum(nearCamera);
    orthographicCamera1.position.z = nearCamera.near + 1;
    orthographicCamera2 = getProjectionMatrixForFrustum(farCamera);
    orthographicCamera2.position.z = farCamera.near + 1;
}

function render() {
    createOrthographicCameras();
    createTextureMatrices();

    renderer.setRenderTarget(bufferTexture1);
    renderer.render(bufferScene, orthographicCamera1);
    renderer.setRenderTarget(bufferTexture2);
    renderer.render(bufferScene, orthographicCamera2);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.render(debugScene, camera);
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener('resize', onWindowResize);


init();

