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

import decalVxShader from '../../shaders/decal.vert'
import decalFragShader from '../../shaders/decal.frag'

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

const objectCount = 1;

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
            splitLambda: 0.5,
            maxSplitDistances: [],
            near: 1,
            far: 10000,
            textureResolution: 1024,
            cascadesBlendingFactor: 0.1,
            passesCount: 5,
            passesFactor: 2,
            displayPixelAreas: false,
            displayBorders: true,
            displayTextures: false,
            displayPixels: false
        };

        this.stableCSMParameters = {
            enabled: true,
            firstTextureSize: 1200,
            projectedAreaSide: 12000
        };

        this.LiSPSMParameters = {
            enabled: false
        };

        this.decalParameters = {
            enabled: false,
            decalScene: new THREE.Scene(),
            decalMaterial: new THREE.ShaderMaterial({
                vertexShader: decalVxShader,
                fragmentShader: decalFragShader,
                transparent: true,
                uniforms: {
                    depthTexture: {value: null},
                    bumpScale: {value: this.constants.terrainBumpScale},
                    heightMap: {value: this.heightMap},
                    mode: {value: 0},
                    triangleVertices: {value: new Array(3).fill(new THREE.Vector2())},
                    quadVertices: {value: new Array(4).fill(new THREE.Vector2())},
                    quadTexture: {value: null},
                    circleCenter: {value: new THREE.Vector2()},
                    circleRadius: {value: 0},
                    W: {value: window.innerWidth},
                    H: {value: window.innerHeight},
                    projectionMatrixInverse: {value: new THREE.Matrix4()},
                    viewMatrixInverse: {value: new THREE.Matrix4()},
                    color: {value: new THREE.Vector4()}
                },
                depthWrite: false
            }),
            decals: []
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

        this.shaderMaterial = new THREE.ShaderMaterial({uniforms: {transparent: true}, vertexShader: vxShader, fragmentShader: fragShader, depthTest: true, depthWrite: true});
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

        const addDecal = () => {
            // let center = new THREE.Vector2(getRandomInt(-2000, 2000), getRandomInt(-2000, 2000));
            let center = new THREE.Vector2(-400, -400);
            // let mode = getRandomInt(0, 3);
            let mode = 0;
            switch (mode) {
                case 0:
                    this.addDecal(center, [
                        center.clone().add(new THREE.Vector2(50, 100)),
                        center.clone().add(new THREE.Vector2(100, -150)),
                        center.clone().add(new THREE.Vector2(-150, -50))
                    ]);
                    break;
                case 1:
                case 2:
                    let side = getRandomInt(50, 300);
                    // let side = 500;
                    let vertices = [
                        center.clone().add(new THREE.Vector2(side / 2, side / 2)),
                        center.clone().add(new THREE.Vector2(-side / 2, side / 2)),
                        center.clone().add(new THREE.Vector2(-side / 2, -side / 2)),
                        center.clone().add(new THREE.Vector2(side / 2, - side / 2))
                    ];
                    if (mode === 2) {
                        this.addDecal(center, vertices, -1, this.decalTexture);
                    } else {
                        this.addDecal(center, vertices);
                    }
                    break;
                case 3:
                    let radius = getRandomInt(50, 300);
                    this.addDecal(center, null, radius);
                    break;
            }
        }

        const setDecalSettings = () => {
            this.decalParameters.decalScene.copy(this.scene, true);
            this.camera.near = 30;
            this.camera.updateProjectionMatrix();
        }

        const resetDecalSettings = () => {
            this.camera.near = 0.1;
            this.camera.updateProjectionMatrix();
        }

        const runPrecisionTest = () => {
            this.generateParameters();
            this.CSMParameters.displayPixelAreas = true;
        }

        refs = this;

        const DataDisplayParameters = function () {
            this.CSMEnabled = true;

            this.splitCount = 4;
            this.splitType = "mixed";
            this.splitLambda = 0.5;

            this.displayBorders = true;
            this.displayTextures = true;

            this.textureResolution = 1024;

            this.stable = true;
            this.firstTextureSize = 1200;
            this.projectedAreaSide = 12000;

            this.cascadesBlendingFactor = 0.1;

            this.passesCount = 11;
            this.passesFactor = 2;

            this.displayPixels = false;
            this.displayPixelAreas = false;
            this.LiSPSMEnabled = false;

            this.decalsEnabled = false;

            this.addFrustum = function() {
                addFrustum();
            };

            this.addDecal = () => {
                // addDecal();
                for (let i = 0; i < objectCount; i++) {
                    addDecal();
                }
            }

            this.runPerformanceTest = function() {
                $.getJSON("src/json/camera.json", function(json) {
                    runPerformanceTestFromJSON(json);
                });
            };

            this.runPrecisionTest = function() {
                runPrecisionTest();
            }

            this.debugStop = function() {
                refs.rolling = true;
                refs.CSMParameters.displayPixelAreas = true;
                console.log(refs.camera.position);
                console.log(refs.camera.rotation);
                console.log('debugStop');
            }

            this.cameraParallel = function() {
                refs.camera.position.set(-281.2751217936437, 145.92038086772592, -1593.6095972060978);
                refs.camera.rotation.set(-3.0502813274673066, -0.17398938616256215, -3.1257427360893026);
            }

            this.cameraVertical = function() {
                refs.camera.position.set(128.995298556282584, 1590.220515894183, 332.2017210835472);
                refs.camera.rotation.set(-Math.PI / 2, 0, -Math.PI);
            }
        };

        let refs = this;

        this.debugCount = 0;

        this.testResults = [];
        this.dynamicData = false;

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

        window.onclick = (mouse) => {
            const vector = new THREE.Vector3(mouse.x, mouse.y, -1).unproject(this.camera);
            console.log(mouse.x, mouse.y, vector);
        };

        window.onload = function() {
            let parameters = new DataDisplayParameters();
            let gui = new dat.GUI();

            let CSMEnabled = gui.add(parameters, 'CSMEnabled');
            CSMEnabled.onFinishChange((value) => {
                updateCSMParametersValue('enabled', value);
            });
            let splitCount = gui.add(parameters, 'splitCount').min(1).max(10).step(1);
            /*splitCount.onChange((value) => {
                updateCSMParametersValue('splitCount', value);
            });*/
            splitCount.onFinishChange((value) => {
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

            gui.add(parameters, 'cascadesBlendingFactor').min(0.0).max(1.0).step(0.001);

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
            gui.add(parameters, 'debugStop');
            gui.add(parameters, 'cameraParallel');
            gui.add(parameters, 'cameraVertical');
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

            let decalsEnabled = gui.add(parameters, 'decalsEnabled');
            decalsEnabled.onFinishChange((value) => {
                updateParametersValue('decalParameters', 'enabled', value);
                if (value) {
                    setDecalSettings();
                } else {
                    resetDecalSettings();
                }
            });
            gui.add(parameters, 'addDecal');
        };
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        this.camera = this.createCamera(canvas, 1000, 1000, 800);
        this.camera.rotation.set(-Math.PI / 2, 0, 0);
        this.camera.name = "camera";
        this.controls = this.createControls(canvas, this.camera);

        this.createDebugMeshes();

        let tl = new THREE.TextureLoader();
        this.decalTexture = tl.load('src/textures/decal.png');
        this.decalTexture.wrapS = this.decalTexture.wrapT = THREE.RepeatWrapping;


        const renderer = this.createRenderer(canvas);
        const clearColor = renderer.getClearColor();
        const clearAlpha = renderer.getClearAlpha();
        this.CSMParameters.passesCount = calculatePassesCount(canvas.width, canvas.height, this.CSMParameters.passesFactor);
        this.composer = setUpZCoordEffectsComposer(renderer, canvas.width, canvas.height, this.zScene, this.camera, this.CSMParameters.passesCount, this.CSMParameters.passesFactor);

        let stats = new Stats();
        document.body.appendChild(stats.domElement);

        let debugTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {type: THREE.FloatType});
        let depthTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {depthBuffer: true, depthTexture: new THREE.DepthTexture(canvas.width, canvas.height)});

        let lispsmMatrix = new THREE.Matrix4().fromArray([
            1, 0, 0, 0,
            0, 0, 1, 0,
            0, 1, 0, 0,
            0, 0, 0, 1
        ]);

        this.angle = Math.PI / 2;

        let then = 0;
        const renderLoopTick = (now) => {
            this.debugCount++;
            now *= 0.001;
            const deltaTime = now - then;
            then = now;

            if (this.testIdx !== undefined) {
                this.runPrecisionTest();
            }

            this.resizeTextures();
            this.updateMaterialUniformsFromParameters();

            if (this.dynamicData && this.objects !== undefined) {
                if (!this.decalParameters.enabled) {
                    for (let i = 0; i < this.objects.length; i++) {
                        this.objects[i].position.add(this.directions[i]);
                    }
                } else {
                    for (let i = 0; i < this.decalParameters.decals.length; i++) {
                        this.decalParameters.decals[i].position.add(this.directions[i]);
                        switch (this.decalParameters.decals[i].material.uniforms.mode.value) {
                            case 0:
                                this.decalParameters.decals[i].material.uniforms.triangleVertices.value.forEach(it => it.add(new THREE.Vector2(this.directions[i].x, this.directions[i].z)));
                                break;
                            case 1:
                            case 2:
                                this.decalParameters.decals[i].material.uniforms.quadVertices.value.forEach(it => it.add(new THREE.Vector2(this.directions[i].x, this.directions[i].z)));
                                break;
                            case 3:
                                this.decalParameters.decals[i].material.uniforms.circleCenter.value.add(new THREE.Vector2(this.directions[i].x, this.directions[i].z));
                                break;

                        }
                    }
                }
            }

            if (this.performanceTestParameters.running) {
                this.runPerformanceTest(stats);
            }

            if (this.rolling) {
                let y = this.camera.position.y;
                let z = this.camera.position.z;
                this.angle -= Math.PI / 400;
                this.camera.position.y = -z * Math.sin(-Math.PI / 400) + y * Math.cos(-Math.PI / 400);
                this.camera.position.z = z * Math.cos(-Math.PI / 400) + y * Math.sin(-Math.PI / 400);
                this.camera.rotation.x -= Math.PI / 400;
                let geom = new THREE.Geometry();
                geom.vertices.push(this.camera.position);
                this.scene.add(new THREE.Points(geom, new THREE.PointsMaterial({size: 50, color: 'magenta'})));
                if (this.camera.rotation.x <= -Math.PI) {
                    this.rolling = false;
                    saveText(JSON.stringify(this.testResults), `res.json`);
                    this.testResults = [];
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
                this.createSplitCameras();
                this.createTextureMatrices();

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
                        angle: THREE.Math.radToDeg(this.angle),
                        avg: sum / cnt});

                } else if (this.LiSPSMParameters.enabled) {
                    this.testResults.push({
                        type: "LiSPSM",
                        resolution: this.CSMParameters.textureResolution,
                        angle: THREE.Math.radToDeg(this.angle),
                        avg: sum / cnt
                    });
                } else if (this.CSMParameters.splitCount > 1) {
                    this.testResults.push({
                        type: "CSM",
                        resolution: this.CSMParameters.textureResolution,
                        splitCount: this.CSMParameters.splitCount,
                        splitLambda: this.CSMParameters.splitLambda,
                        angle: THREE.Math.radToDeg(this.angle),
                        avg: sum / cnt
                    });
                } else if (this.CSMParameters.splitCount === 1) {
                    this.testResults.push({
                        type: "USM",
                        resolution: this.CSMParameters.textureResolution,
                        angle: THREE.Math.radToDeg(this.angle),
                        avg: sum / cnt
                    });
                }

                console.log(sum / cnt, JSON.stringify(this.camera.position), JSON.stringify(this.camera.rotation));
            }


            if (this.decalParameters.enabled) {
                renderer.setRenderTarget(depthTarget);
                renderer.render(this.scene, this.camera);

                this.drawDecals(depthTarget.depthTexture, canvas);


                /*if (this.decalParameters.decals.length > 0) {
                    renderer.setRenderTarget(debugTarget);
                    renderer.render(this.decalParameters.decalScene, this.camera);
                    let pixels1 = new Float32Array(4);
                    renderer.readRenderTargetPixels(debugTarget, canvas.width / 2, canvas.height / 2, 1, 1, pixels1);
                    for (let i = 0; i < pixels1.length; i += 4) {
                        /!*if (pixels1[i + 1] === 0) {
                            console.log(pixels1[i], pixels1[i + 1], pixels1[i + 2]);
                        }*!/
                        console.log(pixels1[i], pixels1[i + 1], pixels1[i + 2]);
                    }
                    console.log("stop");
                }*/


                renderer.setRenderTarget(null);
                renderer.sortObjects = false;
                renderer.render(this.decalParameters.decalScene, this.camera);
                renderer.sortObjects = true;


            } else {

                renderer.setRenderTarget(null);
                renderer.render(this.scene, this.camera);

            }

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
        const near = 0.1;
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

        this.heightMap = textureLoader.load(DEMTexture);
        this.heightMap.wrapS = this.heightMap.wrapT = THREE.RepeatWrapping;
        const terrain = textureLoader.load(terrainTexture)
        terrain.wrapS = terrain.wrapT = THREE.RepeatWrapping;

        this.shaderMaterial.uniforms = {
            bumpTexture: {type: "t", value: this.heightMap},
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

            cascadesBlendingFactor: {type: "f", value: this.CSMParameters.cascadesBlendingFactor},
            // uniforms that need updates from GUI
            splitCount: {type: "i", value: this.CSMParameters.splitCount},
            displayBorders: {type: "i", value: 0},
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
                bumpTexture: {type: "t", value: this.heightMap},
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
        for (let i = 0; i < this.constants.maxSplitCount; ++i) {
            this.bufferTextures[i] = new THREE.WebGLRenderTarget(this.CSMParameters.textureResolution, this.CSMParameters.textureResolution, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter
            });
        }
        this.loadBufferTexture();
        // this.generateBufferTextureObjects(objectCount);
    }

    loadBufferTexture() {
        loadSVGToScene(mapUrl, this.bufferScene, -2900, 0, -3700, -Math.PI / 2, 0, 0, 2);
    }

    generateBufferTextureObjects(objCount, minSize = 50, maxSize = 300) {
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
            this.directions.push(new THREE.Vector3(Math.random() > 0.5 ? 1 : -1, 0, Math.random() > 0.5 ? 1 : -1))
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

        this.splitCameras = [];
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
        for (let i = 0; i < this.CSMParameters.splitCount; ++i) {
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


    drawDecals(depthTexture, canvas) {
        for (let mesh of this.decalParameters.decals) {
            mesh.material.uniforms.depthTexture.value = depthTexture;
            mesh.material.uniforms.W.value = canvas.width;
            mesh.material.uniforms.H.value = canvas.height;
            mesh.material.uniforms.projectionMatrixInverse.value = this.camera.projectionMatrixInverse;
            mesh.material.uniforms.viewMatrixInverse.value = this.camera.matrixWorld;
        }

    }

    addDecal(center, vertices, circleRadius, pattern) {
        let geom = new THREE.BoxBufferGeometry(500, 500, 500);
        let material = this.decalParameters.decalMaterial.clone();

        if (vertices === null) {
            if (circleRadius !== undefined) {
                material.uniforms.mode.value = 3;
                material.uniforms.circleCenter.value = center;
                material.uniforms.circleRadius.value = circleRadius;
            }
        } else if (vertices.length === 3) {
            material.uniforms.mode.value = 0;
            material.uniforms.triangleVertices.value = vertices;
        } else if (vertices.length === 4) {
            material.uniforms.mode.value = 1;
            material.uniforms.quadVertices.value = vertices;
        }

        if (pattern !== undefined) {
            material.uniforms.quadTexture.value = pattern;
        } else {
            // material.uniforms.color.value = new THREE.Vector4(Math.random(), Math.random(), Math.random(), 1);
            material.uniforms.color.value = new THREE.Vector4(0.2, 0.4, 0.2, 1);
        }

        let mesh = new THREE.Mesh(geom, material);
        mesh.position.set(center.x, 0, center.y);
        this.decalParameters.decalScene.add(mesh);
        this.decalParameters.decals.push(mesh);
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
    generateParameters() {
        const resolutions = [512, 768, 1024, 1536, 2048];
        const positions = [
            new THREE.Vector3(1000, 1000, 800),
            // new THREE.Vector3(28.995298556282584, 1590.220515894183, 332.2017210835472),
            // new THREE.Vector3(-281.2751217936437, 145.92038086772592, -1593.6095972060978)
        ];
        const rotations = [
            new THREE.Euler(-0.896, 0.663, 0.656),
            // new THREE.Euler(-1.364855099205966, 0.017846319954118763, 0.0852173507643245),
            // new THREE.Euler(-3.0502813274673066, -0.17398938616256215, -3.1257427360893026)
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
        /*for (let res of resolutions) {
            for (let i = 0; i < positions.length; i++) {
                this.USMTestParameters.push({
                    textureResolution: res,
                    position: positions[i],
                    rotation: rotations[i]
                });
            }
        }*/

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
        /*for (let res of resolutions) {
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
        }*/

        // LiSPSM parameters are so far exactly the same. test LiSPSM + CSM later
        this.LiSPSMTestParameters = this.USMTestParameters;

        this.testIdx = 0;
        this.currentAlgorithm = 'USM';

    }

    runPrecisionTest() {
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

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}



