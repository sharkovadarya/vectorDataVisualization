import React, {Component} from "react";
import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import * as dat from 'dat.gui'
import $ from 'jquery';
import rangeInclusive from 'range-inclusive';

// this is stats-js but with additional public fields
import Stats from './FPSStats';

import vxShader from '../../shaders/main.vert';
import fragShader from '../../shaders/main.frag';

import terrainZVxShader from '../../shaders/terrain_z_coord.vert'
import terrainZFragShader from '../../shaders/terrain_z_coord.frag'

import DEMTexture from '../../textures/bumpTexture.jpg';
import terrainTexture from '../../textures/terrainTexture.jpg'

import {connect} from 'react-redux'

import './ZCoordinateEffectsComposer';
import {calculatePassesCount, setUpZCoordEffectsComposer} from "./ZCoordinateEffectsComposer";
import './CSMFrustumSplit'
import {
    calculateSplits,
    getOrthographicCameraForPerspectiveCamera, getLightSpacePerspectiveCamera,
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
            // terrainBumpScale: 1.0,
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
            passesCount: 5,
            passesFactor: 2,
            displayPixelAreas: false,
            displayBorders: true,
            displayTextures: false,
            displayPixels: false
        };

        this.stableCSMParameters = {
            enabled: false,
            firstTextureSize: 50,
            projectedAreaSide: 5000
        };

        this.LiSPSMParameters = {
            enabled: false
        };



        this.canvasRef = React.createRef();
        this.divRef = React.createRef();

        this.splitCameras = [];
        this.bufferTextures = new Array(this.constants.maxSplitCount).fill(null);


        // for zMin - zMax calculations
        this.zScene = new THREE.Scene();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('lightblue');
        //this.scene.fog = new THREE.Fog('lightblue', 1, 6000);

        this.bufferScene = new THREE.Scene();
        this.initBufferTextures();

        this.createLights();

        this.shaderMaterial = new THREE.ShaderMaterial({uniforms: {transparent: true}, vertexShader: vxShader, fragmentShader: fragShader});
        this.terrain = this.createMeshes();

        this.debugScene = new THREE.Scene();

        this.performanceTestParameters = {
            running: false,
            testCameraData: {
                positions: [],
                rotations: []
            },
            testCameraDataIndex: 0,
            fpsSum: 0,
            timeSum: 0,
            fpsCount: 0,
        }

        const runPerformanceTestFromJSON = (json) => {
            function parseVector3JSON(v) {
                if (v._x !== undefined) {
                    return new THREE.Vector3(v._x, v._y, v._z);
                } else if (v.x !== undefined) {
                    return new THREE.Vector3(v.x, v.y, v.z);
                }
            }

            this.performanceTestParameters.testCameraDataIndex = 0;
            if (this.performanceTestParameters.testCameraData.rotations.length === 0) {
                let data = json.data;
                for (let i = 0; i < data.length; i += 2) {
                    this.performanceTestParameters.testCameraData.rotations.push(parseVector3JSON(data[i]));
                    this.performanceTestParameters.testCameraData.positions.push(parseVector3JSON(data[i + 1]));
                }
            }

            this.performanceTestParameters.running = true;
        };

        const addFrustum = () => {
            this.scene.add(new THREE.CameraHelper(this.camera.clone()));
            for (let i = 0; i < this.CSMParameters.splitCount; i++) {
                this.scene.add(new THREE.CameraHelper(this.splitCameras[i].clone()));
            }
        };

        const runPrecisionTest = () => {
            this.generateParameters();
            this.CSMParameters.displayPixelAreas = true;
        }

        const DataDisplayParameters = function () {
            this.CSMEnabled = true;

            this.splitCount = 4;
            this.splitType = "linear";
            this.splitLambda = 0.0;

            this.displayBorders = true;
            this.displayTextures = true;

            this.textureResolution = 512;

            this.stable = false;
            this.firstTextureSize = 50;
            this.projectedAreaSide = 5000;

            this.cascadesBlendingFactor = 0.1;

            this.passesCount = 11;
            this.passesFactor = 2;

            this.displayPixels = false;
            this.displayPixelAreas = false;
            this.LiSPSMEnabled = false;

            this.addFrustum = function() {
                addFrustum();
            };

            this.runPerformanceTest = function() {
                $.getJSON("src/json/camera.json", function(json) {
                    runPerformanceTestFromJSON(json);
                });
            };

            this.runPrecisionTest = function() {
                runPrecisionTest();
            }
        };

        this.debugCount = 0;

        this.testResults = [];
        this.dynamicData = true;

        // TODO remove this later
        let refs = this;
        let updateParametersValue = (parametersGroup, parameterName, value) => {
            this[parametersGroup][parameterName] = value;
        };
        let updateCSMParametersValue = (parameterName, value) => {
            this.CSMParameters[parameterName] = value;
        };
        let updateStableCSMParametersValue = (parameterName, value) => {
            this.stableCSMParameters[parameterName] = value;
        };
        let updateComposer = (passesCount, passesFactor) => {
            if (passesFactor === null) {
                passesFactor = this.CSMParameters.passesFactor;
            }
            if (passesCount === null) {
                passesCount = Number.POSITIVE_INFINITY;
            }
            if (passesFactor !== this.CSMParameters.passesFactor || passesCount !== this.CSMParameters.passesCount) {
                const size = new THREE.Vector2();
                this.composer.renderer.getSize(size);
                passesCount = Math.min(passesCount, calculatePassesCount(size.width, size.height, passesFactor));
                this.composer = setUpZCoordEffectsComposer(this.composer.renderer, size.width, size.height, this.zScene, this.camera, passesCount, passesFactor);
                this.CSMParameters.passesCount = passesCount;
                this.CSMParameters.passesFactor = passesFactor;
            }
        }
        window.onload = function() {
            let parameters = new DataDisplayParameters();
            let gui = new dat.GUI();

            let CSMEnabled = gui.add(parameters, 'CSMEnabled');
            CSMEnabled.onFinishChange((value) => {
                updateCSMParametersValue('enabled', value);
            });
            let splitCount = gui.add(parameters, 'splitCount').min(1).max(10).step(1);
            splitCount.onChange((value) => {
                updateCSMParametersValue('splitCount', value);
            });
            let splitType = gui.add(parameters, 'splitType', ["logarithmic", "linear", "mixed"]);
            splitType.onFinishChange((value) => {
                if (value === "logarithmic") {
                    updateCSMParametersValue('splitLambda', 1.0);
                } else if (value === "linear") {
                    updateCSMParametersValue('splitLambda', 0.0);
                }
            });
            let splitLambda = gui.add(parameters, 'splitLambda').min(0.0).max(1.0).step(0.001);
            splitLambda.onChange((value) => {
                updateCSMParametersValue('splitLambda', value);
            });

            //gui.add(parameters, 'cascadesBlendingFactor').min(0.0).max(1.0).step(0.001);

            let displayBorders = gui.add(parameters, 'displayBorders');
            displayBorders.onFinishChange((value) => {
                updateCSMParametersValue('displayBorders', value);
            });
            let displayTextures = gui.add(parameters, 'displayTextures');
            displayTextures.onFinishChange((value) => {
                updateCSMParametersValue('displayTextures', value);
            });
            let displayPixels = gui.add(parameters, 'displayPixels');
            displayPixels.onFinishChange((value) => {
                updateCSMParametersValue('displayPixels', value);
            });
            gui.add(parameters, 'addFrustum');
            gui.add(parameters, 'runPrecisionTest');

            gui.add(parameters, 'runPerformanceTest');

            let textureResolution = gui.add(parameters, 'textureResolution').min(128).max(2048).step(1);
            textureResolution.onChange((value) => {
                updateCSMParametersValue('textureResolution', value);
            });

            let passesCount = gui.add(parameters, 'passesCount').min(1).max(11).step(1);
            passesCount.onChange((value) => {
                updateComposer(value, null);
            });
            let passesFactor = gui.add(parameters, 'passesFactor').min(2).max(5).step(1);
            passesFactor.onChange((value) => {
                updateComposer(null, value);
            });

            let stableEnabled = gui.add(parameters, 'stable');
            stableEnabled.onFinishChange((value) => {
                updateStableCSMParametersValue('enabled', value);
            });

            const stableCSMFolder = gui.addFolder('Stable CSM Parameters');
            let firstTextureSize = stableCSMFolder.add(parameters, 'firstTextureSize').min(50).max(10000).step(1);
            firstTextureSize.onChange((value) => {
                updateStableCSMParametersValue('firstTextureSize', value);
            });
            let projectedAreaSide = stableCSMFolder.add(parameters, 'projectedAreaSide').min(5000).max(30000).step(100);
            projectedAreaSide.onChange((value) => {
                updateStableCSMParametersValue('projectedAreaSide', value);
            });

            let displayPixelAreas = gui.add(parameters, 'displayPixelAreas');
            displayPixelAreas.onFinishChange((value) => {
                updateCSMParametersValue('displayPixelAreas', value);
            });

            const LiSPSMFolder = gui.addFolder('Light Space PSM Parameters');
            let LiSPSMEnabled = LiSPSMFolder.add(parameters, 'LiSPSMEnabled');
            LiSPSMEnabled.onFinishChange((value) => {
                updateParametersValue('LiSPSMParameters', 'enabled', value);
            });
        };
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        this.camera = this.createCamera(canvas, 1000, 1000, 800);
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

        let lispsmMatrix = new THREE.Matrix4().fromArray([
            1, 0, 0, 0,
            0, 0, 1, 0,
            0, 1, 0, 0,
            0, 0, 0, 1
        ]);

        let then = 0;
        const renderLoopTick = (now) => {
            this.debugCount++;
            now *= 0.001;
            const deltaTime = now - then;
            then = now;

            if (this.testIdx !== undefined) {
                switch (this.currentAlgorithm) {
                    case "USM":
                        if (this.testIdx === this.USMTestParameters.length) {
                            this.currentAlgorithm = "CSM";
                            this.testIdx = 0;
                        } else {
                            this.stableCSMParameters.enabled = false;
                            this.LiSPSMParameters.enabled = false;
                            this.CSMParameters.splitCount = 1;
                            this.CSMParameters.textureResolution = this.USMTestParameters[this.testIdx].textureResolution;
                            let pos = this.USMTestParameters[this.testIdx].position;
                            this.camera.position.set(pos.x, pos.y, pos.z);
                            let rot = this.USMTestParameters[this.testIdx].rotation;
                            this.camera.rotation.set(rot.x, rot.y, rot.z);
                            this.testIdx++;
                        }
                        break;
                    case "CSM":
                        if (this.testIdx === this.CSMTestParameters.length) {
                            this.currentAlgorithm = "StableCSM";
                            this.testIdx = 0;
                        } else {
                            // yes code duplication is Bad. i know.
                            this.stableCSMParameters.enabled = false;
                            this.LiSPSMParameters.enabled = false;
                            this.CSMParameters.textureResolution = this.CSMTestParameters[this.testIdx].textureResolution;
                            this.CSMParameters.splitCount = this.CSMTestParameters[this.testIdx].splitCount;
                            this.CSMParameters.splitLambda = this.CSMTestParameters[this.testIdx].splitLambda;
                            let pos = this.CSMTestParameters[this.testIdx].position;
                            this.camera.position.set(pos.x, pos.y, pos.z);
                            let rot = this.CSMTestParameters[this.testIdx].rotation;
                            this.camera.rotation.set(rot.x, rot.y, rot.z);
                            this.testIdx++;
                        }
                        break;
                    case "StableCSM":
                        if (this.testIdx === this.stableCSMTestParameters.length) {
                            this.currentAlgorithm = "LiSPSM";
                            this.testIdx = 0;
                        } else {
                            this.stableCSMParameters.enabled = true;
                            this.LiSPSMParameters.enabled = false;
                            this.CSMParameters.textureResolution = this.stableCSMTestParameters[this.testIdx].textureResolution;
                            this.CSMParameters.splitCount = this.stableCSMTestParameters[this.testIdx].splitCount;
                            this.CSMParameters.splitLambda = this.stableCSMTestParameters[this.testIdx].splitLambda;
                            this.stableCSMParameters.firstTextureSize = this.stableCSMTestParameters[this.testIdx].firstTextureSize;
                            this.stableCSMParameters.projectedAreaSide = this.stableCSMTestParameters[this.testIdx].projectedAreaSide;
                            let pos = this.stableCSMTestParameters[this.testIdx].position;
                            this.camera.position.set(pos.x, pos.y, pos.z);
                            let rot = this.stableCSMTestParameters[this.testIdx].rotation;
                            this.camera.rotation.set(rot.x, rot.y, rot.z);
                            this.testIdx++;
                        }
                        break;
                    case "LiSPSM":
                        if (this.testIdx === this.LiSPSMTestParameters.length) {
                            this.currentAlgorithm = undefined;
                            this.testIdx = undefined;
                            saveText(JSON.stringify(this.testResults), `res.json`);
                            this.testResults = [];
                        } else {
                            this.stableCSMParameters.enabled = false;
                            this.LiSPSMParameters.enabled = true;
                            this.CSMParameters.splitCount = 1;
                            this.CSMParameters.textureResolution = this.LiSPSMTestParameters[this.testIdx].textureResolution;
                            let pos = this.LiSPSMTestParameters[this.testIdx].position;
                            this.camera.position.set(pos.x, pos.y, pos.z);
                            let rot = this.LiSPSMTestParameters[this.testIdx].rotation;
                            this.camera.rotation.set(rot.x, rot.y, rot.z);
                            this.testIdx++;
                        }
                        break;
                }
            }

            this.resizeTextures();
            this.updateMaterialUniformsFromParameters();

            if (this.dynamicData && this.objects !== undefined) {
                for (let i = 0; i < this.objects.length; i++) {
                    this.objects[i].position.add(this.directions[i]);
                }
            }

            if (this.performanceTestParameters.running) {
                this.runPerformanceTest(stats);
            }

            if (this.precisionTestParameters.running) {
                this.runPrecisionTest(this.precisionTestParameters.currentAttribute);
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
                this.createSplitCameras();
                this.createTextureMatrices();

                this.stableCSMParameters.enabled = false;

                for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
                    if (this.LiSPSMParameters.enabled) {
                        this.splitCameras[i].projectionMatrix.premultiply(lispsmMatrix);
                    }
                    renderer.setRenderTarget(this.bufferTextures[i]);
                    renderer.render(this.bufferScene, this.splitCameras[i]);
                }

            }

            if (this.CSMParameters.displayPixelAreas) {
                let color = this.scene.background;
                renderer.setRenderTarget(debugTarget);
                renderer.render(this.scene, this.camera);
                let pxs = new Float32Array(4 * debugTarget.width * debugTarget.height);
                renderer.readRenderTargetPixels(debugTarget, 0, 0, debugTarget.width, debugTarget.height, pxs);
                let sum = 0;
                let cnt = 0;
                let vals = [];
                for (let i = 0; i < pxs.length; i += 4) {
                    if (!compareFloatsWithEpsilon(pxs[i + 3], 0.42, eps)) {
                        continue;
                    }
                    sum += pxs[i];
                    cnt++;
                    vals.push(pxs[i]);
                }
                if (this.stableCSMParameters.enabled) {
                    this.testResults.push({
                        type: "stableCSM",
                        resolution: this.CSMParameters.textureResolution,
                        splitCount: this.CSMParameters.splitCount,
                        splitLambda: this.CSMParameters.splitLambda,
                        projectedAreaSide: this.stableCSMParameters.projectedAreaSide,
                        firstTextureSize: this.stableCSMParameters.firstTextureSize,
                        avg: sum / cnt});

                } else if (this.LiSPSMParameters.enabled) {
                    this.testResults.push({
                        type: "LiSPSM",
                        resolution: this.CSMParameters.textureResolution,
                        avg: sum / cnt
                    });
                } else if (this.CSMParameters.splitCount > 1) {
                    this.testResults.push({
                        type: "CSM",
                        resolution: this.CSMParameters.textureResolution,
                        splitCount: this.CSMParameters.splitCount,
                        splitLambda: this.CSMParameters.splitLambda,
                        avg: sum / cnt
                    });
                } else if (this.CSMParameters.splitCount === 1) {
                    this.testResults.push({
                        type: "USM",
                        resolution: this.CSMParameters.textureResolution,
                        avg: sum / cnt
                    });
                }

                console.log(sum / cnt, JSON.stringify(this.camera.position), JSON.stringify(this.camera.rotation));
            }

            renderer.setRenderTarget(null);
            renderer.render(this.scene, this.camera);


            if (this.CSMParameters.displayTextures) {
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
            vectorsTextures: {
                type: "tv", value: this.bufferTextures.map(function (bt) {
                    if (bt !== null) {
                        return bt.texture;
                    }
                    return null;
                })
            },
            textureMatrices: {type: "m4v", value: new Array(this.constants.maxSplitCount).fill(new THREE.Matrix4())},

            //cascadesBlendingFactor: {type: "f", value: this.CSMParameters.cascadesBlendingFactor},
            // uniforms that need updates from GUI
            splitCount: {type: "i", value: this.CSMParameters.splitCount},displayBorders: {type: "i", value: 0},
            enableCSM: {type: "i", value: 1},
            displayPixelAreas: {type: "i", value: 0},
            resolution: {type: "f", value: this.CSMParameters.textureResolution}, // it doubles as both width and height of the texture
            enableLiSPSM: {type: "i", value: 0},
            displayPixels: {type: "i", value: 0}
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

    initBufferTextures() {
        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
            this.bufferTextures[i] = new THREE.WebGLRenderTarget(this.CSMParameters.textureResolution, this.CSMParameters.textureResolution, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter
            });
        }
        this.loadBufferTexture();
        //this.generateBufferTextureObjects(2000);
    }

    loadBufferTexture() {
        loadSVGToScene(mapUrl, this.bufferScene, -2900, 0, -3700, -Math.PI / 2, 0, 0, 2);
    }

    generateBufferTextureObjects(objCount, minSize = 50, maxSize = 300) {
        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        this.objects = []; // change in runtime if necessary
        this.directions = [];
        for (let i = 0; i < objCount; i++) {
            let x = getRandomInt(-3000, 3000);
            let y = getRandomInt(-3000, 3000);
            let width = getRandomInt(minSize, maxSize);
            let geom;
            if (Math.random() > 0.5) {
                geom = new THREE.CircleGeometry(width, 128);
            } else {
                geom = new THREE.PlaneGeometry(width, width);
            }
            let mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({color: new THREE.Color(Math.random() * 0xffffff)}));
            mesh.position.set(x, 0, y);
            mesh.rotation.set(-Math.PI / 2, 0, 0);
            this.objects.push(mesh);
            // add a direction for each object
            this.directions.push(new THREE.Vector3(Math.random() > 0.5 ? 1 : -1, Math.random() > 0.5 ? 1 : -1, Math.random() > 0.5 ? 1 : -1))
            this.bufferScene.add(mesh);
        }
    }

    createSplitCameras() {
        this.CSMParameters.maxSplitDistances = calculateSplits(
            this.CSMParameters.splitCount,
            this.CSMParameters.splitLambda,
            this.CSMParameters.near,
            this.CSMParameters.far
        );

        const textureSizes = calculateSplits(
            this.CSMParameters.splitCount,
            this.CSMParameters.splitLambda,
            this.stableCSMParameters.firstTextureSize,
            this.stableCSMParameters.projectedAreaSide
        );

        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
            let currentCamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, this.CSMParameters.maxSplitDistances[i], this.CSMParameters.maxSplitDistances[i + 1]);
            /*currentCamera.near = 1;
            currentCamera.updateProjectionMatrix();*/
            currentCamera.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            currentCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            currentCamera.updateMatrixWorld(true);
            if (this.LiSPSMParameters.enabled) {
                this.splitCameras[i] = getLightSpacePerspectiveCamera(currentCamera);
            } else {
                if (this.stableCSMParameters.enabled) {
                    this.splitCameras[i] = getStableOrthographicCameraForPerspectiveCamera(currentCamera, textureSizes[i], this.CSMParameters.textureResolution);
                } else {
                    this.splitCameras[i] = getOrthographicCameraForPerspectiveCamera(currentCamera);
                }
            }
        }
    }

    createTextureMatrices() {
        let matrices = new Array(this.constants.maxSplitCount).fill(new THREE.Matrix4());
        for (let i = 0; i < this.splitCameras.length; ++i) {
            let m = this.splitCameras[i].projectionMatrix.clone();
            m.multiply(this.splitCameras[i].matrixWorldInverse);
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
        this.CSMParameters.far = maxValue;
    }

    updateMaterialUniformsFromParameters() {
        let updateUniform = (uniform, value) => {
            if (value !== this.shaderMaterial.uniforms[uniform].value) {
                this.shaderMaterial.uniforms[uniform].value = value;
            }
        }

        updateUniform('enableCSM', this.CSMParameters.enabled);
        updateUniform('splitCount', this.CSMParameters.splitCount);
        updateUniform('resolution', this.CSMParameters.textureResolution);
        updateUniform('enableLiSPSM', this.LiSPSMParameters.enabled);
        updateUniform('displayPixels', this.CSMParameters.displayPixels);
        updateUniform('displayPixelAreas', this.CSMParameters.displayPixelAreas);
        updateUniform('displayBorders', this.CSMParameters.displayBorders);
    }

    resizeTextures() {
        if (this.CSMParameters.textureResolution !== this.shaderMaterial.uniforms.resolution.value) {
            for (let i = 0; i < this.CSMParameters.splitCount; i++) {
                if (this.bufferTextures[i] !== null) {
                    this.bufferTextures[i].setSize(this.CSMParameters.textureResolution, this.CSMParameters.textureResolution);
                }
            }
        }
    }

    runPerformanceTest(stats) {
        let pos = this.performanceTestParameters.testCameraData.positions[this.performanceTestParameters.testCameraDataIndex];
        let rotation = this.performanceTestParameters.testCameraData.rotations[this.performanceTestParameters.testCameraDataIndex]

        this.performanceTestParameters.fpsSum += stats.fps;
        this.performanceTestParameters.timeSum += stats.time;
        this.performanceTestParameters.fpsCount++;

        this.camera.position.set(pos.x, pos.y, pos.z);
        this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
        this.performanceTestParameters.testCameraDataIndex++;
        if (this.performanceTestParameters.testCameraDataIndex === this.performanceTestParameters.testCameraData.positions.length) {
            console.log("Average FPS ", this.performanceTestParameters.fpsSum / this.performanceTestParameters.fpsCount);
            console.log("Average time ", this.performanceTestParameters.timeSum / this.performanceTestParameters.fpsCount);
            this.performanceTestParameters.running = false;
            this.performanceTestParameters.fpsSum = 0;
            this.performanceTestParameters.timeSum = 0;
            this.performanceTestParameters.fpsCount = 0;
            this.performanceTestParameters.testCameraDataIndex = 0;
        }
    }



    precisionTestParameters = {
        running: false,
        textureResolution: [],
        splitCount: [],
        projectedAreaSide: [],
        splitLambda: [],
        textureResolutionIndex: -1,
        splitLambdaIndex: -1,
        splitCountIndex: -1,
        projectedAreaSideIndex: -1,
        currentAttribute: null
    }

    generateParameters() {
        const resolutions = [512, 768, 1024, 1536, 2048];
        const positions = [
            new THREE.Vector3(1000, 1000, 800),
            new THREE.Vector3(11.15, 1600.56, 279.46),
            new THREE.Vector3(-10, 91.3, -1622.2)
        ];
        const rotations = [
            new THREE.Euler(-0.896, 0.663, 0.656),
            new THREE.Euler(-1.398, 0.007, 0.039),
            new THREE.Euler(-3.085 , 0.006, -3.141)
        ];
        const splits = [3, 4, 5, 7, 10];
        const splitLambdas = [0, 0.25, 0.5, 0.75, 1];
        const projectedAreaSides = [8000, 10000, 12500, 15000, 17500, 20000, 25000, 30000];
        const firstTextureSizeProportions = [1 / 16, 1 / 8, 1 / 4, 1 / 2];

        this.USMTestParameters = [];
        this.CSMTestParameters = [];
        this.stableCSMTestParameters = [];
        this.LiSPSMTestParameters = [];

        // USM parameters
        for (let res of resolutions) {
            for (let i = 0; i < positions.length; i++) {
                this.USMTestParameters.push({
                    textureResolution: res,
                    position: positions[i],
                    rotation: rotations[i]
                });
            }
        }

        // CSM parameters
        for (let res of resolutions) {
            for (let split of splits) {
                for (let lambda of splitLambdas) {
                    for (let i = 0; i < positions.length; i++) {
                        this.CSMTestParameters.push({
                            textureResolution: res,
                            position: positions[i],
                            rotation: rotations[i],
                            splitCount: split,
                            splitLambda: lambda
                        });
                    }
                }
            }
        }

        // stable CSM parameters
        for (let res of resolutions) {
            for (let split of splits) {
                for (let lambda of splitLambdas) {
                    for (let side of projectedAreaSides) {
                        for (let prop of firstTextureSizeProportions) {
                            for (let i = 0; i < positions.length; i++) {
                                this.stableCSMTestParameters.push({
                                    textureResolution: res,
                                    position: positions[i],
                                    rotation: rotations[i],
                                    splitCount: split,
                                    splitLambda: lambda,
                                    projectedAreaSide: side,
                                    firstTextureSize: prop * side
                                });
                            }
                        }
                    }
                }
            }
        }

        // LiSPSM parameters are so far exactly the same. test LiSPSM + CSM later
        this.LiSPSMTestParameters = this.USMTestParameters;

        this.testIdx = 0;
        this.currentAlgorithm = 'USM';

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


