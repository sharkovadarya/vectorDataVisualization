import React, {Component} from "react";
import * as THREE from 'three-full';
import * as dat from 'dat.gui'

import vxShader from '../../shaders/main.vert';
import fragShader from '../../shaders/main.frag';

import terrainZVxShader from '../../shaders/terrain_z_coord.vert'
import terrainZFragShader from '../../shaders/terrain_z_coord.frag'

import sandTexture from '../../textures/sand-512.jpg';
import rockTexture from '../../textures/rock-512.jpg';
import snowTexture from '../../textures/snow-512.jpg';
import waterTexture from '../../textures/water512.jpg';
import heightMapTexture from '../../textures/height_map.png';
import meadowTexture from '../../textures/grass-512.jpg';

import {connect} from 'react-redux'

import './ZCoordinateEffectsComposer';
import {setUpZCoordEffectsComposer} from "./ZCoordinateEffectsComposer";
import './CSMFrustumSplit'
import {calculateMaxSplitDistances, getOrthographicCameraForPerspectiveCamera} from "./CSMFrustumSplit";
import {loadSVGToScene} from "./SVGLoader";

const SVGSources = [
    'https://raw.githubusercontent.com/openstreetmap/map-icons/master/svg/misc/landmark/mine.svg',
    'https://raw.githubusercontent.com/openstreetmap/map-icons/master/svg/misc/landmark.svg',
    'https://raw.githubusercontent.com/openstreetmap/map-icons/master/svg/misc/landmark/glacier.svg',
    'https://raw.githubusercontent.com/openstreetmap/map-icons/master/svg/misc/landmark/peak_small.svg',
    'https://raw.githubusercontent.com/openstreetmap/map-icons/master/svg/misc/landmark/works.svg'
];

// import {log} from 'log';

class ViewArea extends Component {
    constructor(props) {
        super(props);
        this.state = {};

        this.constants = {
            maxSplitCount: 16,
            terrainBumpScale: 400.0,
        };

        this.CSMparameters = {
            splitCount: 4,
            splitLambda: 0.0,
            maxSplitDistances: [],
            near: 1,
            far: 20000,
            cascadesBlendingFactor: 0.1
        };

        this.stableCSMParameters = {
            enabled: true,
            textureResolution: 512,
            firstTextureSize: 50,
            projectedAreaSide: 5000
        };

        this.canvasRef = React.createRef();
        this.divRef = React.createRef();

        this.orthographicCameras = [];
        this.bufferTextures = new Array(this.constants.maxSplitCount).fill(null);

        this.displayBorders = false;
        this.displayTextures = true;

        // for zMin - zMax calculations
        this.zScene = new THREE.Scene();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('lightblue');
        //this.scene.fog = new THREE.Fog('lightblue', 1, 6000);

        this.bufferScene = new THREE.Scene();
        this.initBufferTexture();

        this.createLights();

        this.shaderMaterial = new THREE.ShaderMaterial({uniforms: {}, vertexShader: vxShader, fragmentShader: fragShader});
        this.createMeshes();

        this.debugScene = new THREE.Scene();

        const CSMParameters = function () {
            this.splitCount = 4;
            this.splitType = "linear";
            this.splitLambda = 0.0;
            this.displayBorders = true;
            this.displayTextures = true;
            this.stable = true;
            this.textureResolution = 512;
            this.firstTextureSize = 50;
            this.projectedAreaSide = 5000;
            this.cascadesBlendingFactor = 0.1;
        };

        this.debugCount = 0;

        let refs = this;
        window.onload = function() {
            let parameters = new CSMParameters();
            let gui = new dat.GUI();
            gui.add(parameters, 'splitCount').min(1).max(refs.constants.maxSplitCount).step(1);
            gui.add(parameters, 'splitType', ["logarithmic", "linear", "mixed"]);
            gui.add(parameters, 'splitLambda').min(0.0).max(1.0).step(0.001);
            gui.add(parameters, 'cascadesBlendingFactor').min(0.0).max(1.0).step(0.001);
            gui.add(parameters, 'displayBorders');
            gui.add(parameters, 'displayTextures');
            gui.add(parameters, 'stable');
            const stableCSMFolder = gui.addFolder('Stable CSM Parameters');
            stableCSMFolder.add(parameters, 'textureResolution').min(512).max(2048).step(1);
            stableCSMFolder.add(parameters, 'firstTextureSize').min(50).max(1000).step(1);
            stableCSMFolder.add(parameters, 'projectedAreaSide').min(5000).max(30000).step(100);

            let update = function () {
                requestAnimationFrame(update);
                switch (parameters.splitType) {
                    case "logarithmic":
                        parameters.splitLambda = 1.0;
                        break;
                    case "linear":
                        parameters.splitLambda = 0.0;
                        break;
                }

                for (let i in gui.__controllers) {
                    gui.__controllers[i].updateDisplay();
                }

                refs.CSMparameters.splitCount = parameters.splitCount;
                refs.CSMparameters.splitLambda = parameters.splitLambda;
                refs.CSMparameters.cascadesBlendingFactor = parameters.cascadesBlendingFactor;
                refs.displayBorders = parameters.displayBorders;
                refs.displayTextures = parameters.displayTextures;

                if (!parameters.stable) {
                    stableCSMFolder.close();
                } else {
                    stableCSMFolder.open();
                }

                refs.stableCSMParameters.enabled = parameters.stable;
                refs.stableCSMParameters.textureResolution = parameters.textureResolution;
                refs.stableCSMParameters.firstTextureSize = parameters.firstTextureSize;
                refs.stableCSMParameters.projectedAreaSide = parameters.projectedAreaSide;
                refs.bufferTextures.forEach(function (t) {
                    t.setSize(parameters.textureResolution, parameters.textureResolution);
                })
            };
            update();
        };
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        this.camera = this.createCamera(canvas, 4000, 2500, 800);
        this.camera.name = "camera";
        this.controls = this.createControls(canvas, this.camera);

        this.createDebugMeshes();


        const renderer = this.createRenderer(canvas);
        const clearColor = renderer.getClearColor();
        const clearAlpha = renderer.getClearAlpha();
        let composer = setUpZCoordEffectsComposer(renderer, canvas.width, canvas.height, this.zScene, this.camera);

        let then = 0;
        const renderLoopTick = (now) => {
            this.debugCount++;
            now *= 0.001;
            const deltaTime = now - then;
            then = now;

            // set composer renderer parameters
            composer.renderer.setClearColor(new THREE.Color(1e9, -1e9, 0), 1);
            composer.renderer.setViewport(0, 0, Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));

            composer.render(deltaTime);
            let pixels = new Float32Array(4);
            composer.renderer.readRenderTargetPixels(composer.readBuffer, 0, 0, 1, 1, pixels);
            this.calculateNearAndFar(pixels[0], pixels[1], this.camera);

            // restore default renderer parameters
            renderer.setViewport(0, 0, canvas.width, canvas.height);
            renderer.setClearColor(clearColor, clearAlpha);

            this.createOrthographicCameras();
            this.createTextureMatrices();

            this.shaderMaterial.uniforms.displayBorders.value = this.displayBorders ? 1 : 0;
            this.shaderMaterial.uniforms.splitCount.value = this.CSMparameters.splitCount;
            this.shaderMaterial.uniforms.cascadesBlendingFactor.value = this.CSMparameters.cascadesBlendingFactor;

            //renderer.render(this.bufferScene, this.orthographicCameras[0]);
            for (let i = 0; i < this.CSMparameters.splitCount; ++i) {
                renderer.setRenderTarget(this.bufferTextures[i]);
                renderer.render(this.bufferScene, this.orthographicCameras[i]);
            }

            renderer.setRenderTarget(null);
            renderer.render(this.scene, this.camera);


            if (this.displayTextures) {
                this.debugScene.add(this.camera);
                renderer.autoClear = false;
                renderer.render(this.debugScene, this.camera);
                renderer.autoClear = true;
            } else {
                this.debugScene.remove(this.camera);
            }

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
        const context = canvas.getContext('webgl2');
        let renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            canvas: canvas,
            context: context
        });

        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        return renderer;
    }

    createMeshes() {
        const geometry = new THREE.PlaneBufferGeometry(4000, 4000, 256, 256);
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        const textureLoader = new THREE.TextureLoader();

        const bumpTexture = textureLoader.load(heightMapTexture);
        bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
        const oceanTexture = textureLoader.load(waterTexture);
        oceanTexture.wrapS = oceanTexture.wrapT = THREE.RepeatWrapping;
        const sandyTexture = textureLoader.load(sandTexture);
        sandyTexture.wrapS = sandyTexture.wrapT = THREE.RepeatWrapping;
        const rockyTexture = textureLoader.load(rockTexture);
        rockyTexture.wrapS = rockyTexture.wrapT = THREE.RepeatWrapping;
        const snowyTexture = textureLoader.load(snowTexture);
        snowyTexture.wrapS = snowyTexture.wrapT = THREE.RepeatWrapping;
        const greenTexture = textureLoader.load(meadowTexture);
        greenTexture.wrapS = greenTexture.wrapT = THREE.RepeatWrapping;

        this.shaderMaterial.uniforms = {
            bumpTexture: {type: "t", value: bumpTexture},
            bumpScale: {type: "f", value: this.constants.terrainBumpScale},
            oceanTexture: {type: "t", value: oceanTexture},
            sandyTexture: {type: "t", value: sandyTexture},
            grassTexture: {type: "t", value: greenTexture},
            rockyTexture: {type: "t", value: rockyTexture},
            snowyTexture: {type: "t", value: snowyTexture},
            //fogColor: {type: "c", value: this.scene.fog.color},
            //fogNear: {type: "f", value: this.scene.fog.near},
            //fogFar: {type: "f", value: this.scene.fog.far},
            fogColor: {type: "c", value: null},
            fogNear: {type: "f", value: 0},
            fogFar: {type: "f", value: 0},
            splitCount: {type: "i", value: this.CSMparameters.splitCount},
            vectorsTextures: {
                type: "tv", value: this.bufferTextures.map(function (bt) {
                    if (bt !== null) {
                        return bt.texture;
                    }
                    return null;
                })
            },
            textureMatrices: {type: "m4v", value: new Array(this.constants.maxSplitCount).fill(new THREE.Matrix4())},
            displayBorders: {type: "i", value: 0},
            cascadesBlendingFactor: {type: "f", value: this.CSMparameters.cascadesBlendingFactor}
        };

        const plane = new THREE.Mesh(geometry, this.shaderMaterial);
        plane.position.set(0, -150, 0);
        plane.rotation.x = -Math.PI / 2;

        const renderPlane = plane.clone();
        renderPlane.material = new THREE.ShaderMaterial({
            vertexShader: terrainZVxShader, fragmentShader: terrainZFragShader, uniforms: {
                bumpTexture: {type: "t", value: bumpTexture},
                bumpScale: {type: "f", value: this.constants.terrainBumpScale}
            }
        });
        this.scene.add(plane);
        this.zScene.add(renderPlane);

        return plane;
    }

    initBufferTexture() {
        for (let i = 0; i < this.CSMparameters.splitCount; ++i) {
            this.bufferTextures[i] = new THREE.WebGLRenderTarget(this.stableCSMParameters.textureResolution, this.stableCSMParameters.textureResolution, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter
            });
        }

        // add various points
        loadSVGToScene(SVGSources[0], this.bufferScene, 300, 0, -900, -Math.PI / 2, 0, 0, 0.2, 0.2, 0.2);
        loadSVGToScene(SVGSources[1], this.bufferScene, 100, 0, -600, -Math.PI / 2);
        loadSVGToScene(SVGSources[2], this.bufferScene, -400, 0, 900, -Math.PI / 2, 0, 0, 5.0, 5.0, 5.0);
        loadSVGToScene(SVGSources[3], this.bufferScene, -900, 0, 20, -Math.PI / 2);
        loadSVGToScene(SVGSources[4], this.bufferScene, 500, 0, -600, -Math.PI / 2);

        // add a line
        const lineMaterial = new THREE.LineBasicMaterial({color: 0x0000ff, linewidth: 10});
        const points = [];
        points.push(new THREE.Vector3(2000, -500, 0));
        points.push(new THREE.Vector3(0, -2000, 0));
        points.push(new THREE.Vector3(-2000, 1300, 0));

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        let line = new THREE.Line(lineGeometry, lineMaterial);
        line.rotation.set(-Math.PI / 2, 0, 0);
        this.bufferScene.add(line);


        // add a polygon
        let shape = new THREE.Shape(), vertices = [], x, n = 7;

        // Calculate the vertices of the n-gon.
        for (x = 1; x <= n; x++) {
            vertices.push([
                700 * Math.sin((Math.PI / n) + (x * ((2 * Math.PI) / n))),
                700 * Math.cos((Math.PI / n) + (x * ((2 * Math.PI) / n)))
            ]);
        }

        // Start at the last vertex.
        shape.moveTo.apply(shape, vertices[n - 1]);

        // Connect each vertex to the next in sequential order.
        for (x = 0; x < n; x++) {
            shape.lineTo.apply(shape, vertices[x]);
        }

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(700, 0, -1700);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        this.bufferScene.add( mesh );

        // add circles
        for (let i = 0; i < 5; ++i) {
            for (let j = 0; j < 3; ++j) {
                const geometry = new THREE.CircleGeometry(100, 256);
                let color = new THREE.Color(0xffffff);
                color.setHex(Math.random() * 0xffffff);
                const material = new THREE.MeshBasicMaterial({color: color});
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(-600 + 300 * i, 0, -300 + 300 * j);
                mesh.rotation.set(-Math.PI / 2, 0, 0);
                this.bufferScene.add(mesh);
            }
        }

        const bigCircleGeometry = new THREE.CircleGeometry(900, 64);
        const bigCircleMesh = new THREE.Mesh(bigCircleGeometry, new THREE.MeshBasicMaterial({color: new THREE.Color('magenta')}));
        bigCircleMesh.position.set(-1000, 0, 2000);
        bigCircleMesh.rotation.set(-Math.PI / 2, 0, 0);
        this.bufferScene.add(bigCircleMesh);
    }

    // same as CSM split, refactoring possible
    calculateTextureSizes(splitCount, splitLambda, initMin, initMax) {
        let arr = [initMin];

        for (let i = 1; i < splitCount; i++) {
            let f = i / (splitCount - 1);
            let l = initMin * Math.pow(initMax / initMin, f);
            let u = initMin + (initMax - initMin) * f;
            arr[i] = l * splitLambda + u * (1 - splitLambda);
        }
        return arr
    }

    createOrthographicCameras() {
        this.CSMparameters.maxSplitDistances = calculateMaxSplitDistances(
            this.CSMparameters.maxSplitDistances,
            this.CSMparameters.splitCount,
            this.CSMparameters.splitLambda,
            this.CSMparameters.near,
            this.CSMparameters.far
        );

        const textureSizes = this.calculateTextureSizes(
            this.CSMparameters.splitCount,
            this.CSMparameters.splitLambda,
            this.stableCSMParameters.firstTextureSize,
            this.stableCSMParameters.projectedAreaSide
        );

        for (let i = 0; i < this.CSMparameters.splitCount; ++i) {
            let currentCamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, this.CSMparameters.maxSplitDistances[i], this.CSMparameters.maxSplitDistances[i + 1]);
            currentCamera.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            currentCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            currentCamera.updateMatrixWorld(true);
            this.orthographicCameras[i] = getOrthographicCameraForPerspectiveCamera(
                currentCamera,
                this.stableCSMParameters.enabled,
                this.stableCSMParameters.textureResolution / textureSizes[i]
            );
        }
    }

    createTextureMatrices() {
        let matrices = new Array(this.constants.maxSplitCount).fill(new THREE.Matrix4());
        for (let i = 0; i < this.orthographicCameras.length; ++i) {

            let m = this.orthographicCameras[i].projectionMatrix.clone();
            m.multiply(this.orthographicCameras[i].matrixWorldInverse);
            matrices[i] = m;
        }
        this.shaderMaterial.uniforms['textureMatrices'].value = matrices;
    }

    createDebugMeshes() {
        const debugSize = 150;

        this.debugScene.add(this.camera);
        for (let i = 0; i < this.CSMparameters.splitCount; ++i) {
            const textureGeometry = new THREE.PlaneBufferGeometry(debugSize * this.camera.aspect, debugSize, 128, 128);
            const textureMaterial = new THREE.MeshBasicMaterial({map: this.bufferTextures[i].texture, depthTest: false});
            const textureMesh = new THREE.Mesh(textureGeometry, textureMaterial);
            this.debugScene.add(textureMesh);
            this.camera.add(textureMesh);
            textureMesh.position.set(-550 + (textureMesh.geometry.parameters.width + 50) * i, -300, -1000);
        }
    }

    calculateNearAndFar(zMinValue, zMaxValue, camera) {
        this.CSMparameters.near = Math.max(camera.near, -zMaxValue);
        this.CSMparameters.far = Math.min(camera.far, -zMinValue);
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




