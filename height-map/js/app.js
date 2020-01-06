let container;
let camera;
let renderer;
let scene;
let mesh;
let controls;
let shaderMaterial; // for update

let splitCount = 4;
let splitLambda = 0.5;
let maxSplitDistances = new Array(splitCount + 1).fill(0);

let bufferScene;
let bufferTextures = [];

let debugScene;
let orthographicCameras = [];


function calculateMaxSplitDistances() {
    const near = camera.near;
    const far = camera.far;
    maxSplitDistances[0] = near;
    for (let i = 1; i < splitCount + 1; i++) {
        let f = i / (splitCount + 1);
        let l = near * Math.pow(far / near, f);
        let u = near + (far - near) * f;
        maxSplitDistances[i] = l * splitLambda + u * (1 - splitLambda);
    }
}

function createCamera(positionX, positionY, positionZ) {
    const fov = 45;
    const aspect = container.clientWidth / container.clientHeight;
    const near = 0.1;
    const far = 20000;

    let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(positionX, positionY, positionZ);

    return camera;
}

function createDebugMeshes() {
    const debugSize = 150;

    debugScene.add(camera);
    for (let i = 0; i < bufferTextures.length; ++i) {
        const textureGeometry = new THREE.PlaneBufferGeometry(debugSize * camera.aspect, debugSize, 128, 128);
        const textureMaterial = new THREE.MeshBasicMaterial({map: bufferTextures[i].texture, depthTest: false});
        const textureMesh = new THREE.Mesh(textureGeometry, textureMaterial);
        camera.add(textureMesh);
        textureMesh.position.set(-550 + (textureMesh.geometry.parameters.width + 50) * i, -300, -1000);
    }
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
        fogFar: {type: "f", value: scene.fog.far},
        splitCount: {type: "i", value: splitCount},
        vectorsTextures: {type: "tv", value: bufferTextures.map(function (bt) {
                return bt.texture;
            })},
        textureMatrices: {type: "m4v", value: new Array(4).fill(new THREE.Matrix4())}
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

    for (let i = 0; i < splitCount; ++i) {
        bufferTextures[i] = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.NearestFilter
        });
    }

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
    // TODO alternative, shorter way to calculate frustum corners; use this one
    /*let ndc_corners = [
        [-1,-1,-1], [1,-1,-1], [-1,1,-1], [1,1,-1],
        [-1,-1, 1], [1,-1, 1], [-1,1, 1], [1,1, 1]];

    let world_corners = [];
    for (let i=0; i < ndc_corners.length; ++i) {
        let ndc_v = new THREE.Vector3(...ndc_corners[i]);
        world_corners.push(ndc_v.unproject(camera));
    }
    return world_corners.map(function (p) {
        return new THREE.Vector3(p.x * -1, p.y * -1, p.z * -1);
    });*/
}

function getProjectionMatrixForFrustum(camera) {
    const frustumCorners = calculateCameraFrustumCorners(camera);

    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxZ = Number.MIN_VALUE;
    for (let i = 0; i < frustumCorners.length; i++) {
        let corner = frustumCorners[i];
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
    let matrices = [];
    for (let i = 0; i < orthographicCameras.length; ++i) {
        matrices[i] = orthographicCameras[i].projectionMatrix;
    }
    shaderMaterial.uniforms['textureMatrices'].value = matrices;
}

function init() {
    container = document.querySelector('#scene-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('lightblue', 1, 6000);
    scene.background = new THREE.Color('lightblue');

    debugScene = new THREE.Scene();

    camera = createCamera(1000, 1000, 200);
    createOrthographicCameras();
    initBufferTexture();
    createMeshes();
    createTextureMatrices();
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
    calculateMaxSplitDistances();

    for (let i = 0; i < splitCount; ++i) {
        const currentCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, maxSplitDistances[i], maxSplitDistances[i + 1]);
        orthographicCameras[i] = getProjectionMatrixForFrustum(currentCamera);
        orthographicCameras[i].position.z = currentCamera.near + 1;
    }
}

function render() {
    createOrthographicCameras();
    createTextureMatrices();

    for (let i = 0; i < bufferTextures.length; ++i) {
        renderer.setRenderTarget(bufferTextures[i]);
        renderer.render(bufferScene, orthographicCameras[i]);
    }
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.render(debugScene, camera);
    renderer.autoClear = true;
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener('resize', onWindowResize);


init();

