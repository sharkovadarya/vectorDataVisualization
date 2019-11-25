// source: https://www.turbosquid.com/FullPreview/Index.cfm/ID/1375909
const modelUrl = 'models/fbx/seahorse.fbx';

let camera;
let controls;
let renderer;
let scene;

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

        object.children[0].material.onBeforeCompile = function (shader) {
            shader.uniforms.Ka = {value: new THREE.Vector3(0.4, 0.5, 0.3)};
            shader.uniforms.Kd = {value: new THREE.Vector3(0.9, 0.7, 0.3)};
            shader.uniforms.Ks = {value: new THREE.Vector3(0.8, 0.8, 0.6)};
            shader.uniforms.LightIntensity = {value: new THREE.Vector4(0.4, 0.7, 0.65, 1.0)};
            shader.uniforms.LightPosition = {value: new THREE.Vector4(0.0, 2000.0, 0.0, 1.0)};
            shader.uniforms.Shininess = {value: 2.0};
            shader.vertexShader = document.getElementById('phongLightingVertexShader').textContent;
            shader.fragmentShader = document.getElementById('phongLightingFragmentShader').textContent;

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

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

// good practice
function update() {

}
