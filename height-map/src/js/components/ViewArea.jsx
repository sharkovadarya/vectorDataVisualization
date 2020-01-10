import React, {Component} from "react";
import * as THREE from 'three-full';
import vxShader from '../../shaders/main.vert';
import fragShader from '../../shaders/main.frag';

import sandTexture from '../../textures/sand-512.jpg';
import rockTexture from '../../textures/rock-512.jpg';
import snowTexture from '../../textures/snow-512.jpg';
import waterTexture from '../../textures/water512.jpg';
import heightMapTexture from '../../textures/height_map.png';
import meadowTexture from '../../textures/grass-512.jpg';

import {connect} from 'react-redux'

// import {log} from 'log';

class ViewArea extends Component {

    constructor(props) {
        super(props);
        this.state = {};

        this.canvasRef = React.createRef();
        this.divRef = React.createRef();

        this.splitCount = 4;
        this.splitLambda = 0.5;
        this.maxSplitDistances = [];
        this.currentSplitType = "log";
        this.mixParameter = 0.5;

        this.orthographicCameras = [];
        this.bufferTextures = [];


        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('lightblue');
        this.scene.fog = new THREE.Fog('lightblue', 1, 6000);

        this.bufferScene = new THREE.Scene();
        this.initBufferTexture();

        this.createLights();

        this.shaderMaterial = new THREE.ShaderMaterial({uniforms: {}, vertexShader: vxShader, fragmentShader: fragShader});

        this.createMeshes();

        this.debugScene = new THREE.Scene();

        // trace camera parameters
        this.cameraControlsTriggered = false;
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        this.camera = this.createCamera(canvas, 1000, 1000, 200);
        this.controls = this.createControls(canvas, this.camera);

        this.createDebugMeshes();

        const renderer = this.createRenderer(canvas);

        const renderLoopTick = () => {
            this.createOrthographicCameras();
            this.createTextureMatrices();

            renderer.render(this.bufferScene, this.orthographicCameras[0]);
            for (let i = 0; i < this.bufferTextures.length; ++i) {
                renderer.setRenderTarget(this.bufferTextures[i]);
                renderer.render(this.bufferScene, this.orthographicCameras[i]);
            }
            renderer.setRenderTarget(null);
            renderer.render(this.scene, this.camera);
            renderer.autoClear = false;
            renderer.render(this.debugScene, this.camera);
            renderer.autoClear = true;

            requestAnimationFrame(renderLoopTick);
        };

        requestAnimationFrame(renderLoopTick);

    }

    render() {
        return (
            <div ref={this.divRef}>
                <canvas
                    ref={this.canvasRef}
                    onMouseMove={this.onMouseMove}
                    width={window.innerWidth}
                    height={window.innerHeight}
                />
            </div>
        );
    }

    createCamera(canvas, positionX, positionY, positionZ) {
        const fov = 45;
        const aspect = canvas.width / canvas.height;
        const near = 0.1;
        const far = 20000;

        let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.set(positionX, positionY, positionZ);

        return camera;
    }

    createControls(canvas, camera) {
        const controls = new THREE.OrbitControls(camera, canvas);
        const obj = this;
        function onControlsChange(o) {
            obj.cameraControlsTriggered = true;
            obj.createOrthographicCameras();
            console.log("world matrix", obj.camera.matrixWorld);
            console.log("projection matrix", obj.camera.projectionMatrix);
            console.log("position", obj.camera.position);

            obj.cameraControlsTriggered = false;

        }
        controls.addEventListener('change', onControlsChange);
        /*controls.maxDistance = 4500;
        controls.maxPolarAngle = Math.PI / 2 - Math.PI / 8;
        controls.minDistance = 300;
        controls.keyPanSpeed = 21.0;
        controls.update();*/
        return controls;
    }

    createLights() {
        const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x202020, 5);

        const mainLight = new THREE.DirectionalLight(0xffffff, 5);
        mainLight.position.set(10, 10, 10);

        this.scene.add(ambientLight, mainLight);
    }

    createRenderer(canvas) {
        let renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true, canvas: canvas});

        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        return renderer;
    }

    createMeshes() {
        const geometry = new THREE.PlaneBufferGeometry(16000, 16000, 256, 256);
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        const textureLoader = new THREE.TextureLoader();

        const bumpTexture = textureLoader.load(heightMapTexture);
        bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
        const oceanTexture = textureLoader.load(waterTexture);
        oceanTexture.wrapS = oceanTexture.wrapT = THREE.RepeatWrapping;
        const sandyTexture = textureLoader.load(sandTexture);
        sandyTexture.wrapS = sandyTexture.wrapT = THREE.RepeatWrapping;
        const grassTexture = textureLoader.load(grassTexture);
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        const rockyTexture = textureLoader.load(rockTexture);
        rockyTexture.wrapS = rockyTexture.wrapT = THREE.RepeatWrapping;
        const snowyTexture = textureLoader.load(snowTexture);
        snowyTexture.wrapS = snowyTexture.wrapT = THREE.RepeatWrapping;
        const greenTexture = textureLoader.load(meadowTexture);
        greenTexture.wrapS = greenTexture.wrapT = THREE.RepeatWrapping;
        // magnitude of normal displacement
        const bumpScale = 400.0;

        this.shaderMaterial.uniforms = {
            bumpTexture: {type: "t", value: bumpTexture},
            bumpScale: {type: "f", value: bumpScale},
            oceanTexture: {type: "t", value: oceanTexture},
            sandyTexture: {type: "t", value: sandyTexture},
            grassTexture: {type: "t", value: greenTexture},
            rockyTexture: {type: "t", value: rockyTexture},
            snowyTexture: {type: "t", value: snowyTexture},
            fogColor: {type: "c", value: this.scene.fog.color},
            fogNear: {type: "f", value: this.scene.fog.near},
            fogFar: {type: "f", value: this.scene.fog.far},
            splitCount: {type: "i", value: this.splitCount},
            vectorsTextures: {
                type: "tv", value: this.bufferTextures.map(function (bt) {
                    return bt.texture;
                })
            },
            textureMatrices: {type: "m4v", value: new Array(4).fill(new THREE.Matrix4())}
        };

        const plane = new THREE.Mesh(geometry, this.shaderMaterial);
        plane.position.set(0, -150, 0);
        plane.rotation.x = -Math.PI / 2;
        this.scene.add(plane);
    }

    initBufferTexture() {
        for (let i = 0; i < this.splitCount; ++i) {
            this.bufferTextures[i] = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.NearestFilter
            });
        }

        for (let i = 0; i < 5; ++i) {
            for (let j = 0; j < 3; ++j) {
                const geometry = new THREE.CircleGeometry(100, 256);
                let color = new THREE.Color(0xffffff);
                color.setHex(Math.random() * 0xffffff);
                const material = new THREE.MeshBasicMaterial({color: color});
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(-600 + 300 * i, -300 + 300 * j, 0);
                this.bufferScene.add(mesh);
            }
        }
    }

    calculateLogarithmicMaxSplitDistance(near, far, splitCount, splitLambda, maxSplitDistances) {
        for (let i = 1; i < splitCount + 1; i++) {
            let f = i / (splitCount + 1);
            let l = near * Math.pow(far / near, f);
            let u = near + (far - near) * f;
            maxSplitDistances[i] = l * splitLambda + u * (1 - splitLambda);
        }
    }

    calculateLinearMaxSplitDistance(near, far, splitCount, maxSplitDistances) {
        const distance = far - near;
        for (let i = 1; i < splitCount + 1; i++) {
            maxSplitDistances[i] = maxSplitDistances[i - 1] + distance / (splitCount - 1);
        }
    }

    calculateMaxSplitDistances(camera) {
        const near = camera.near;
        const far = camera.far;
        this.maxSplitDistances[0] = near;

        switch (this.currentSplitType) {
            case "log":
                this.calculateLogarithmicMaxSplitDistance(near, far, this.splitCount, this.splitLambda, this.maxSplitDistances);
                break;
            case "lin":
                this.calculateLinearMaxSplitDistance(near, far, this.splitCount, this.maxSplitDistances);
                break;
            case "mixed":
                let distancesLinear = [...this.maxSplitDistances];
                let distancesLogarithmic = [...this.maxSplitDistances];
                this.calculateLinearMaxSplitDistance(near, far, this.splitCount, distancesLinear);
                this.calculateLogarithmicMaxSplitDistance(near, far, this.splitCount, this.splitLambda, distancesLogarithmic);
                this.maxSplitDistances = distancesLinear.map(function (elem, index) {
                    return elem * this.mixParameter + distancesLogarithmic[index] * (1 - this.mixParameter);
                });
                break;

        }
    }

    calculateCameraFrustumCorners(camera) {
        let ndc_corners = [
            [-1,-1,-1], [1,-1,-1], [-1,1,-1], [1,1,-1],
            [-1,-1, 1], [1,-1, 1], [-1,1, 1], [1,1, 1]];

        let world_corners = [];
        for (let i = 0; i < ndc_corners.length; ++i) {
            let ndc_v = new THREE.Vector3(...ndc_corners[i]);
            let v_cam = ndc_v.unproject(camera);
            // let v_cam_4 = new THREE.Vector4(v_cam.x, v_cam.y, v_cam.z, 1);
            world_corners.push(v_cam);
        }
        return world_corners.map(function (p) {
            return new THREE.Vector3(p.x * -1, p.y * -1, p.z * -1);
        });
    }

    getProjectionMatrixForFrustum(camera) {
        const frustumCorners = this.calculateCameraFrustumCorners(camera);

        if (this.cameraControlsTriggered) {
            console.log("frustum corners", frustumCorners);
        }

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

    createOrthographicCameras() {
        this.calculateMaxSplitDistances(this.camera);

        for (let i = 0; i < this.splitCount; ++i) {
            let currentCamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, this.maxSplitDistances[i], this.maxSplitDistances[i + 1]);
            currentCamera.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            currentCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            currentCamera.updateMatrixWorld( true );
            this.orthographicCameras[i] = this.getProjectionMatrixForFrustum(currentCamera);
            this.orthographicCameras[i].position.z = currentCamera.near + 1;
        }
    }

    createTextureMatrices() {
        let matrices = [];
        for (let i = 0; i < this.orthographicCameras.length; ++i) {
            matrices[i] = this.orthographicCameras[i].projectionMatrix;
        }
        this.shaderMaterial.uniforms['textureMatrices'].value = matrices;
    }

    createDebugMeshes() {
        const debugSize = 150;

        this.debugScene.add(this.camera);
        for (let i = 0; i < this.bufferTextures.length; ++i) {
            const textureGeometry = new THREE.PlaneBufferGeometry(debugSize * this.camera.aspect, debugSize, 128, 128);
            const textureMaterial = new THREE.MeshBasicMaterial({map: this.bufferTextures[i].texture, depthTest: false});
            const textureMesh = new THREE.Mesh(textureGeometry, textureMaterial);
            this.debugScene.add(textureMesh);
            this.camera.add(textureMesh);
            textureMesh.position.set(-550 + (textureMesh.geometry.parameters.width + 50) * i, -300, -1000);
        }
    }
}

const mapStateToProps = (state /*, ownProps*/) => {
    return {
    }
};

const mapDispatchToProps = {};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ViewArea)
