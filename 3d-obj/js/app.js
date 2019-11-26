// source: https://www.turbosquid.com/FullPreview/Index.cfm/ID/1375909
const modelUrl = 'models/fbx/seahorse.fbx';

let camera;
let controls;
let renderer;
let scene;

let materialShader;

let delta = 0.001;

function createCamera() {
    camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
    camera.position.set(250, 0, -300);
}

function createControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
}

function createRenderer() {
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
}

function loadModel() {
    let loader = new THREE.FBXLoader();
    loader.load(modelUrl, function (object) {
        console.log("model loaded");

        object.children[0].material.blending = THREE.NormalBlending;
        object.children[0].material.transparent = true;
        object.children[0].material.onBeforeCompile = function (shader) {
            shader.uniforms.u_texture = {value: THREE.ImageUtils.loadTexture('textures/noise.jpg')};
            shader.uniforms.burn_texture = {value: THREE.ImageUtils.loadTexture('textures/burngradient.png')};
            shader.uniforms.time = {value: 0};
            shader.uniforms.dissolve = {value: 0.15};
            shader.uniforms.Ka = {value: new THREE.Vector3(0.4, 0.5, 0.3)};
            shader.uniforms.Kd = {value: new THREE.Vector3(0.9, 0.7, 0.3)};
            shader.uniforms.Ks = {value: new THREE.Vector3(0.8, 0.8, 0.6)};
            shader.uniforms.LightIntensity = {value: new THREE.Vector4(0.4, 0.7, 0.65, 1.0)};
            shader.uniforms.LightPosition = {value: new THREE.Vector4(0.0, 2000.0, 0.0, 1.0)};
            shader.uniforms.Shininess = {value: 2.0};
            shader.vertexShader = document.getElementById('phongLightingVertexShader').textContent;
            shader.fragmentShader = document.getElementById('phongLightingFragmentShader').textContent;

            materialShader = shader;

        };
        scene.add(object);
        console.log(object);

    });
}

function resize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }

    return needResize;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8FBCD4);

    const ambientLight = new THREE.HemisphereLight( 0xddeeff, 0x0f0e0d, 5 );

    const mainLight = new THREE.DirectionalLight( 0xffffff, 5 );
    mainLight.position.set( 10, 10, 10 );

    scene.add( ambientLight, mainLight );

    createCamera();
    createRenderer();
    createControls();
    loadModel();

    renderer.setAnimationLoop(() => {
        update();
        render();
    });
}

init();


function render() {
    if (resize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }

    if (materialShader) {
        materialShader.uniforms.time.value = performance.now() / 1000;
        let new_dissolve = materialShader.uniforms.dissolve.value + delta;
        if (new_dissolve >= 1.0 || new_dissolve < 0.0) {
            delta *= -1;
            new_dissolve = materialShader.uniforms.dissolve.value + delta;
        }
        materialShader.uniforms.dissolve.value = new_dissolve;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

// good practice
function update() {

}
