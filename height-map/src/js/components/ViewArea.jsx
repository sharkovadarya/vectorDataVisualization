import React, {Component} from "react";
import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import * as dat from 'dat.gui'
import $ from 'jquery';

// this is stats-js but with an additional public field
import Stats from './FPSStats';

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

import DEMTexture from '../../textures/bumpTexture.jpg';
import terrainTexture from '../../textures/terrainTexture.jpg'

import {connect} from 'react-redux'

import './ZCoordinateEffectsComposer';
import {calculatePassesCount, setUpZCoordEffectsComposer} from "./ZCoordinateEffectsComposer";
import './CSMFrustumSplit'
import {
    calculateMaxSplitDistances,
    getOrthographicCameraForPerspectiveCamera, getPerspectiveTransformForLiSPSM,
    getStableOrthographicCameraForPerspectiveCamera
} from "./CSMFrustumSplit";
import {loadSVGToScene} from "./SVGLoader";

// import {log} from 'log';

const mapUrl = 'src/images/map.svg';

const eps = 0.00001;

class ViewArea extends Component {
    constructor(props) {
        super(props);
        this.state = {};

        this.constants = {
            maxSplitCount: 10,
            terrainBumpScale: 400.0,
        };

        this.CSMParameters = {
            enabled: true,
            splitCount: 4,
            splitLambda: 0.0,
            maxSplitDistances: [],
            near: 1,
            far: 10000,
            textureResolution: 512,
            cascadesBlendingFactor: 0.1,
            pushFar: 500,
            passesCount: 5,
            passesFactor: 2,
            displayPixelAreas: false,
            pixelAreaFactor: 100000
        };

        this.stableCSMParameters = {
            enabled: true,
            firstTextureSize: 50,
            projectedAreaSide: 5000
        };

        this.LiSPSMParameters = {
            enabled: false,
            near: 1
        };



        this.canvasRef = React.createRef();
        this.divRef = React.createRef();

        this.orthographicCameras = [];
        this.bufferTextures = new Array(this.constants.maxSplitCount).fill(null);
        this.lightSpacePerspectiveMatrices = [];

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
        this.terrain = this.createMeshes();

        this.debugScene = new THREE.Scene();

        this.performanceTestParameters = {
            running: false,
            testCameraData: {
                positions: [],
                rotations: []
            },
            testCameraDataIndex: 0,
            passesParameters: []
        }

        const DataDisplayParameters = function () {
            this.CSMEnabled = true;

            this.splitCount = 4;
            this.splitType = "linear";
            this.splitLambda = 0.0;

            this.displayBorders = true;
            this.displayTextures = true;

            this.textureResolution = 512;

            this.stable = true;
            this.firstTextureSize = 50;
            this.projectedAreaSide = 5000;

            this.cascadesBlendingFactor = 0.1;

            this.pushFar = 500;

            this.passesCount = refs.CSMParameters.passesCount;
            this.passesFactor = refs.CSMParameters.passesFactor;

            this.addFrustum = function() {
                refs.scene.add(new THREE.CameraHelper(refs.camera.clone()));
                for (let i = 0; i < refs.CSMParameters.splitCount; i++) {
                    refs.scene.add(new THREE.CameraHelper(refs.orthographicCameras[i].clone()));
                }
            };

            this.addPerspectiveFrustum = function() {
                let camera = getPerspectiveTransformForLiSPSM(refs.camera, 1);
                refs.scene.add(new THREE.CameraHelper(camera.clone()));
                refs.scene.add(new THREE.CameraHelper(refs.camera.clone()));
            }

            this.runPerformanceTest = function() {
                $.getJSON("src/json/camera.json", function(json) {
                    // we know its format
                    // threejs doesn't have vector parsing apparently
                    function parseVector3JSON(v) {
                        if (v._x !== undefined) {
                            return new THREE.Vector3(v._x, v._y, v._z);
                        } else if (v.x !== undefined) {
                            return new THREE.Vector3(v.x, v.y, v.z);
                        }
                    }

                    refs.performanceTestParameters.testCameraDataIndex = 0;
                    if (refs.performanceTestParameters.testCameraData.rotations.length === 0 || refs.performanceTestParameters.testCameraData.positions.length === 0) {
                        let data = json.data;
                        for (let i = 0; i < data.length; i += 2) {
                            refs.performanceTestParameters.testCameraData.rotations.push(parseVector3JSON(data[i]));
                            refs.performanceTestParameters.testCameraData.positions.push(parseVector3JSON(data[i + 1]));
                        }
                    }

                    refs.CSMParameters.passesCount = refs.performanceTestParameters.passesParameters[0].passesCount;
                    refs.CSMParameters.passesFactor = refs.performanceTestParameters.passesParameters[0].passesFactor;

                    refs.performanceTestParameters.running = true;
                });
            }

            this.setCameraForPrecisionTest = function () {
                refs.camera.position.set(0, 3000, 0);
                refs.camera.rotation.set(-Math.PI / 2, 0, 0);
            }

            this.runResolutionPrecisionTest = function () {
                this.setCameraForPrecisionTest()
                if (this.precisionTestParameters.textureResolution.length === 0) {
                    for (let i = 512; i <= 2048; i++) {
                        this.precisionTestParameters.textureResolution.push(i);
                    }
                }
                this.precisionTestParameters.textureResolutionIndex = 0;
                this.precisionTestParameters.running = true;
                console.log("running precision test for resolution");
            }

            this.runCascadesPrecisionTest = function () {
                this.setCameraForPrecisionTest()
                if (this.precisionTestParameters.splitCount.length === 0) {
                    for (let i = 1; i <= 10; i++) {
                        this.precisionTestParameters.splitCount.push(i);
                    }
                }
                this.precisionTestParameters.splitCountIndex = 0;
                this.precisionTestParameters.running = true;
                console.log("running precision test for cascades");
            }

            this.runSplitPrecisionTest = function () {
                this.setCameraForPrecisionTest()
                if (this.precisionTestParameters.splitLambda.length === 0) {
                    for (let i = 0; i <= 1; i += 0.01) {
                        this.precisionTestParameters.splitLambda.push(i);
                    }
                }
                this.precisionTestParameters.splitLambdaIndex = 0;
                this.precisionTestParameters.running = true;
                console.log("running precision test for splits");
            }

            this.runProjectionAreaPrecisionTest = function () {
                this.setCameraForPrecisionTest()
                if (this.precisionTestParameters.projectedAreaSide.length === 0) {
                    for (let i = 5000; i <= 30000; i += 100) {
                        this.precisionTestParameters.projectedAreaSide.push(i);
                    }
                }
                this.precisionTestParameters.projectedAreaSideIndex = 0;
                this.precisionTestParameters.running = true;
                console.log("running precision test for projection area");
            }

            this.precisionTestParameters = {
                running: false,
                textureResolution: [],
                splitCount: [],
                projectedAreaSide: [],
                splitLambda: [],
                textureResolutionIndex: -1,
                splitLambdaIndex: -1,
                splitCountIndex: -1,
                projectedAreaSideIndex: -1
            }

            this.displayPixelAreas = false;
            this.pixelAreaFactor = 100000;

            this.LiSPSMEnabled = false;
            this.LiSPSMNear = 1;


            this.runPrecisionTest = function(name) {
                if (this.precisionTestParameters.running) {
                    if (this.precisionTestParameters[`${name}Index`] !== -1) {
                        this[name] = this.precisionTestParameters[name][this.precisionTestParameters[`${name}Index`]++];
                        if (this.precisionTestParameters[`${name}Index`] === this.precisionTestParameters[name].length) {
                            this.precisionTestParameters.running = false;
                            this.precisionTestParameters[[`${name}Index`]] = 0;
                            console.log(`precision test for ${name} finished`);
                            saveText( JSON.stringify(refs.testResults), `${name}.json`);
                            refs.testResults = [];
                        }
                    }
                }
            }
        };

        this.debugCount = 0;

        this.testResults = [];

        let refs = this;
        window.onload = function() {
            let parameters = new DataDisplayParameters();
            let gui = new dat.GUI();

            gui.add(parameters, 'CSMEnabled');
            gui.add(parameters, 'splitCount').min(1).max(refs.constants.maxSplitCount).step(1);
            gui.add(parameters, 'splitType', ["logarithmic", "linear", "mixed"]);
            gui.add(parameters, 'splitLambda').min(0.0).max(1.0).step(0.001);
            gui.add(parameters, 'cascadesBlendingFactor').min(0.0).max(1.0).step(0.001);
            gui.add(parameters, 'displayBorders');
            gui.add(parameters, 'displayTextures');
            gui.add(parameters, 'addFrustum');
            gui.add(parameters, 'addPerspectiveFrustum');
            gui.add(parameters, 'runPerformanceTest');
            gui.add(parameters, 'textureResolution').min(512).max(4096).step(1);
            gui.add(parameters, 'pushFar').min(0).max(4000).step(1);
            gui.add(parameters, 'passesCount').min(1).max(refs.CSMParameters.passesCount).step(1);
            gui.add(parameters, 'passesFactor').min(2).max(5).step(1);
            gui.add(parameters, 'stable');
            const stableCSMFolder = gui.addFolder('Stable CSM Parameters');
            stableCSMFolder.add(parameters, 'firstTextureSize').min(50).max(10000).step(1);
            stableCSMFolder.add(parameters, 'projectedAreaSide').min(5000).max(30000).step(100);
            gui.add(parameters, 'displayPixelAreas');
            gui.add(parameters, 'pixelAreaFactor').min(1000.0).max(1000000.0);
            const LiSPSMFolder = gui.addFolder('Light Space PSM Parameters');
            LiSPSMFolder.add(parameters, 'LiSPSMEnabled');
            // TODO figure out the actual parameters
            LiSPSMFolder.add(parameters, 'LiSPSMNear').min(0.1).max(4000);
            const precisionTestFolder = gui.addFolder('Precision Test');
            precisionTestFolder.add(parameters, 'runResolutionPrecisionTest');
            precisionTestFolder.add(parameters, 'runCascadesPrecisionTest');
            precisionTestFolder.add(parameters, 'runSplitPrecisionTest');
            precisionTestFolder.add(parameters, 'runProjectionAreaPrecisionTest');



            let PassParameters = function(factor = -1, count = -1) {
                this.passesFactor = factor;
                this.passesCount = count;
            };
            for (let i = 2; i <= 5; i++) {
                const maxSize = calculatePassesCount(window.innerWidth, window.innerHeight, i);
                for (let j = 1; j <= maxSize; j++) {
                    refs.performanceTestParameters.passesParameters.push(new PassParameters(i, j));
                }
            }
            refs.performanceTestParameters.passesParametersIndex = 0;

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

                parameters.runPrecisionTest('textureResolution');
                if (parameters.stable) {
                    parameters.runPrecisionTest('projectedAreaSide');
                } else {
                    parameters.runPrecisionTest('splitLambda');
                }
                parameters.runPrecisionTest('splitCount');

                for (let i in gui.__controllers) {
                    gui.__controllers[i].updateDisplay();
                }

                refs.CSMParameters.splitCount = parameters.splitCount;
                refs.CSMParameters.splitLambda = parameters.splitLambda;
                refs.CSMParameters.cascadesBlendingFactor = parameters.cascadesBlendingFactor;
                refs.displayBorders = parameters.displayBorders;
                refs.displayTextures = parameters.displayTextures;

                if (!parameters.stable) {
                    stableCSMFolder.close();
                } else {
                    stableCSMFolder.open();
                }

                refs.stableCSMParameters.enabled = parameters.stable;
                refs.stableCSMParameters.firstTextureSize = parameters.firstTextureSize;
                refs.stableCSMParameters.projectedAreaSide = parameters.projectedAreaSide;
                if (parameters.textureResolution !== refs.CSMParameters.textureResolution) {
                    refs.CSMParameters.textureResolution = parameters.textureResolution;
                    refs.shaderMaterial.uniforms.resolution.value = parameters.textureResolution;
                    for (let i = 0; i < refs.CSMParameters.splitCount; i++) {
                        refs.bufferTextures[i].setSize(parameters.textureResolution, parameters.textureResolution);
                    }
                }
                refs.CSMParameters.pushFar = parameters.pushFar;
                refs.CSMParameters.enabled = parameters.CSMEnabled;
                if (!refs.performanceTestParameters.running && (parameters.passesCount !== refs.CSMParameters.passesCount || parameters.passesFactor !== refs.CSMParameters.passesFactor)) {
                    const size = new THREE.Vector2();
                    refs.composer.renderer.getSize(size);
                    let passesCount = Math.min(parameters.passesCount, calculatePassesCount(size.width, size.height, parameters.passesFactor));
                    refs.composer = setUpZCoordEffectsComposer(refs.composer.renderer, size.width, size.height, refs.zScene, refs.camera, passesCount, parameters.passesFactor);
                    refs.CSMParameters.passesCount = passesCount;
                    parameters.passesCount = passesCount;
                    refs.CSMParameters.passesFactor = parameters.passesFactor;
                }
                if (parameters.displayPixelAreas !== refs.CSMParameters.displayPixelAreas) {
                    refs.CSMParameters.displayPixelAreas = parameters.displayPixelAreas;
                    refs.shaderMaterial.uniforms.displayPixelAreas.value = parameters.displayPixelAreas ? 1 : 0;
                }
                if (parameters.pixelAreaFactor !== refs.CSMParameters.pixelAreaFactor) {
                    refs.CSMParameters.pixelAreaFactor = parameters.pixelAreaFactor;
                    refs.shaderMaterial.uniforms.pixelAreaFactor.value = parameters.pixelAreaFactor;
                }
                refs.LiSPSMParameters.enabled = parameters.LiSPSMEnabled;
                refs.LiSPSMParameters.near = parameters.LiSPSMNear;

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
        this.CSMParameters.passesCount = calculatePassesCount(canvas.width, canvas.height, this.CSMParameters.passesFactor);
        this.composer = setUpZCoordEffectsComposer(renderer, canvas.width, canvas.height, this.zScene, this.camera, this.CSMParameters.passesCount, this.CSMParameters.passesFactor);

        let stats = new Stats();
        document.body.appendChild(stats.domElement);

        let debugTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {type: THREE.FloatType});

        let then = 0;
        let fpsSum = 0, fpsCount = 0;
        const renderLoopTick = (now) => {
            this.debugCount++;
            now *= 0.001;
            const deltaTime = now - then;
            then = now;

            if (this.performanceTestParameters.running) {
                let pos = this.performanceTestParameters.testCameraData.positions[this.performanceTestParameters.testCameraDataIndex];
                let rotation = this.performanceTestParameters.testCameraData.rotations[this.performanceTestParameters.testCameraDataIndex]

                fpsSum += stats.fps;
                fpsCount++;
                this.camera.position.set(pos.x, pos.y, pos.z);
                this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
                this.performanceTestParameters.testCameraDataIndex++;
                if (this.performanceTestParameters.testCameraDataIndex === this.performanceTestParameters.testCameraData.positions.length) {
                    this.performanceTestParameters.passesParametersIndex++;
                    console.log("Average FPS for factor ", this.CSMParameters.passesFactor, ", count ", this.CSMParameters.passesCount, " : ", fpsSum / fpsCount);
                    if (this.performanceTestParameters.passesParametersIndex >= this.performanceTestParameters.passesParameters.length) {
                        this.performanceTestParameters.running = false;
                    } else {
                        let param = this.performanceTestParameters.passesParameters[this.performanceTestParameters.passesParametersIndex];
                        this.CSMParameters.passesFactor = param.passesFactor;
                        this.CSMParameters.passesCount = param.passesCount;
                        this.composer = setUpZCoordEffectsComposer(this.composer.renderer, canvas.width, canvas.height, this.zScene, this.camera, this.CSMParameters.passesCount, this.CSMParameters.passesFactor);
                    }
                    fpsSum = 0;
                    fpsCount = 0;
                    this.performanceTestParameters.testCameraDataIndex = 0;
                }
            }

            if (this.CSMParameters.enabled) {
                if (!this.stableCSMParameters.enabled) {
                    // set composer renderer parameters
                    this.composer.renderer.setClearColor(new THREE.Color(1e9, -1e9, 0), 1);
                    this.composer.renderer.setViewport(0, 0, Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));

                    this.composer.render(deltaTime);
                    let lastPass = this.composer.passes[this.composer.passes.length - 1];
                    let textureSize = lastPass.uniforms.textureSize.value.clone().divideScalar(this.CSMParameters.passesFactor).ceil();
                    let pixels = new Float32Array(4 * textureSize.width * textureSize.height);
                    this.composer.renderer.readRenderTargetPixels(this.composer.readBuffer, 0, 0, textureSize.width, textureSize.height, pixels);
                    this.calculateNearAndFar(pixels);

                    // restore default renderer parameters
                    renderer.setViewport(0, 0, canvas.width, canvas.height);
                    renderer.setClearColor(clearColor, clearAlpha);
                }

                this.createOrthographicCameras();
                this.createTextureMatrices();

                this.shaderMaterial.uniforms.displayBorders.value = this.displayBorders ? 1 : 0;
                this.shaderMaterial.uniforms.splitCount.value = this.CSMParameters.splitCount;
                this.shaderMaterial.uniforms.cascadesBlendingFactor.value = this.CSMParameters.cascadesBlendingFactor;

                //renderer.render(this.bufferScene, this.orthographicCameras[0]);
                for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
                    renderer.setRenderTarget(this.bufferTextures[i]);
                    renderer.render(this.bufferScene, this.orthographicCameras[i]);
                }
            }

            this.shaderMaterial.uniforms.enableCSM.value = this.CSMParameters.enabled ? 1 : 0;

            if (this.CSMParameters.displayPixelAreas) {
                let color = this.scene.background;
                renderer.setRenderTarget(debugTarget);
                renderer.render(this.scene, this.camera);
                let pixels = new Float32Array(4 * debugTarget.width * debugTarget.height);
                renderer.readRenderTargetPixels(debugTarget, 0, 0, debugTarget.width, debugTarget.height, pixels);
                let sum = 0;
                let cnt = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (compareFloatsWithEpsilon(pixels[i], color.r, eps) &&
                        compareFloatsWithEpsilon(pixels[i + 1], color.g, eps) &&
                        compareFloatsWithEpsilon(pixels[i + 2], color.b, eps)) {
                        continue;
                    }
                    sum += pixels[i];
                    cnt++;
                }
                this.testResults.push({
                    resolution: this.CSMParameters.textureResolution,
                    splitCount: this.CSMParameters.splitCount,
                    splitLambda: this.CSMParameters.splitLambda,
                    projectedAreaSide: this.stableCSMParameters.projectedAreaSide,
                    avg: sum / cnt});
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

            stats.update();

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
        const near = 1;
        const far = 10000;

        let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.set(positionX, positionY, positionZ);

        return camera;
    }

    createControls(canvas, camera) {
        const controls = new OrbitControls(camera, canvas);
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

        const bumpTexture = textureLoader.load(DEMTexture);
        bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
        const terrain = textureLoader.load(terrainTexture)
        terrain.wrapS = terrain.wrapT = THREE.RepeatWrapping;

        this.shaderMaterial.uniforms = {
            bumpTexture: {type: "t", value: bumpTexture},
            bumpScale: {type: "f", value: this.constants.terrainBumpScale},
            terrainTexture: {type: "t", value: terrain},
            splitCount: {type: "i", value: this.CSMParameters.splitCount},
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
            cascadesBlendingFactor: {type: "f", value: this.CSMParameters.cascadesBlendingFactor},
            enableCSM: {type: "i", value: 1},
            displayPixelAreas: {type: "i", value: 0},
            pixelAreaFactor: {type: "f", value: this.CSMParameters.pixelAreaFactor},
            resolution: {type: "f", value: this.CSMParameters.textureResolution} // it doubles as both width and height of the texture
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

        plane.matrixAutoUpdate = false;
        renderPlane.matrixAutoUpdate = false;
        plane.updateMatrix();
        renderPlane.updateMatrix();

        this.scene.add(plane);
        this.zScene.add(renderPlane);

        return plane;
    }

    initBufferTexture() {
        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
            this.bufferTextures[i] = new THREE.WebGLRenderTarget(this.CSMParameters.textureResolution, this.CSMParameters.textureResolution, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter
            });
        }
        loadSVGToScene(mapUrl, this.bufferScene, -2900, 0, -3700, -Math.PI / 2, 0, 0, 2);
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
        this.CSMParameters.maxSplitDistances = calculateMaxSplitDistances(
            this.CSMParameters.maxSplitDistances,
            this.CSMParameters.splitCount,
            this.CSMParameters.splitLambda,
            this.CSMParameters.near,
            this.CSMParameters.far
        );

        const textureSizes = this.calculateTextureSizes(
            this.CSMParameters.splitCount,
            this.CSMParameters.splitLambda,
            this.stableCSMParameters.firstTextureSize,
            this.stableCSMParameters.projectedAreaSide
        );

        let centerPosition = new THREE.Vector3();
        this.terrain.getWorldPosition(centerPosition);
        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
            let currentCamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, this.CSMParameters.maxSplitDistances[i], this.CSMParameters.maxSplitDistances[i + 1]);
            currentCamera.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            currentCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            currentCamera.updateMatrixWorld(true);
            if (this.stableCSMParameters.enabled) {
                this.orthographicCameras[i] = getStableOrthographicCameraForPerspectiveCamera(currentCamera, textureSizes[i], this.CSMParameters.textureResolution, centerPosition);
            } else {
                this.orthographicCameras[i] = getOrthographicCameraForPerspectiveCamera(currentCamera);
            }

            if (this.LiSPSMParameters.enabled) {
                //this.lightSpacePerspectiveMatrices[i] = getPerspectiveTransformForLiSPSM(currentCamera, this.LiSPSMParameters.near);
            }
        }
    }

    createTextureMatrices() {
        let matrices = new Array(this.constants.maxSplitCount).fill(new THREE.Matrix4());
        for (let i = 0; i < this.orthographicCameras.length; ++i) {
            let m = this.orthographicCameras[i].projectionMatrix.clone();
            // TODO is this order correct
            /*if (this.LiSPSMParameters.enabled) {
                m.multiply(this.lightSpacePerspectiveMatrices[i]);
            }*/
            m.multiply(this.orthographicCameras[i].matrixWorldInverse);
            matrices[i] = m;
        }
        this.shaderMaterial.uniforms['textureMatrices'].value = matrices;
    }

    createDebugMeshes() {
        const debugSize = 150;

        this.debugScene.add(this.camera);
        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
            const textureGeometry = new THREE.PlaneBufferGeometry(debugSize * this.camera.aspect, debugSize, 128, 128);
            const textureMaterial = new THREE.MeshBasicMaterial({map: this.bufferTextures[i].texture, depthTest: false});
            const textureMesh = new THREE.Mesh(textureGeometry, textureMaterial);
            this.debugScene.add(textureMesh);
            this.camera.add(textureMesh);
            textureMesh.position.set(-550 + (textureMesh.geometry.parameters.width + 50) * i, -300, -1000);
        }
    }

    calculateNearAndFar(pixels) {
        let minValue = Number.POSITIVE_INFINITY;
        let maxValue = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < pixels.length; i += 4) {
            minValue = Math.min(minValue, -pixels[i + 1]);
            maxValue = Math.max(maxValue, -pixels[i]);
        }
        this.CSMParameters.near = minValue;
        this.CSMParameters.far = maxValue + this.CSMParameters.pushFar;
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


function compareFloatsWithEpsilon(f1, f2, eps) {
    return Math.abs(f1 - f2) < eps;
}

function saveText(text, filename){
    const a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-8,'+encodeURIComponent(text));
    a.setAttribute('download', filename);
    a.click()
}


