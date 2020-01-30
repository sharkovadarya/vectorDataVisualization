import React, {Component} from "react";
import * as THREE from 'three-full';
import * as dat from 'dat.gui'

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

        // TODO where to store constants?
        this.maxSplitCount = 16;

        this.canvasRef = React.createRef();
        this.divRef = React.createRef();

        this.splitCount = 8;
        this.splitLambda = 1.0;
        // TODO
        this.near = 0.1;
        this.far = 10000;
        this.maxSplitDistances = [];

        this.orthographicCameras = [];
        this.bufferTextures = new Array(this.maxSplitCount).fill(null);

        this.displayBorders = false;
        this.displayTextures = true;


        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('lightblue');
        //this.scene.fog = new THREE.Fog('lightblue', 1, 6000);

        this.terrainBumpScale = 400.0;

        this.bufferScene = new THREE.Scene();
        this.initBufferTexture();

        this.createLights();

        this.shaderMaterial = new THREE.ShaderMaterial({uniforms: {}, vertexShader: vxShader, fragmentShader: fragShader});

        this.terrain = this.createMeshes();

        this.debugScene = new THREE.Scene();

        this.lowerPlane = null;
        this.upperPlane = null;
        this.near = 1;
        this.far = 20000;

        const CSMParameters = function () {
            this.splitCount = 4;
            this.splitType = "linear";
            this.splitLambda = 1.0;
            this.displayBorders = true;
            this.displayTextures = true;
        };

        this.debugCount = 0;

        let refs = this;
        window.onload = function() {
            let parameters = new CSMParameters();
            let gui = new dat.GUI();
            gui.add(parameters, 'splitCount').min(1).max(refs.maxSplitCount).step(1);
            gui.add(parameters, 'splitType', ["logarithmic", "linear", "mixed"]);
            gui.add(parameters, 'splitLambda').min(0.0).max(1.0).step(0.001);
            gui.add(parameters, 'displayBorders');
            gui.add(parameters, 'displayTextures');

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

                refs.splitCount = parameters.splitCount;
                refs.currentSplitType = parameters.splitType;
                refs.splitLambda = parameters.splitLambda;
                refs.displayBorders = parameters.displayBorders;
                refs.displayTextures = parameters.displayTextures;
            };
            update();
        };
    }

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        this.camera = this.createCamera(canvas, 1000, 1000, 200);
        this.camera.name = "camera";
        this.controls = this.createControls(canvas, this.camera);

        this.createDebugMeshes();

        this.createTerrainBorderPlanes(canvas);

        const renderer = this.createRenderer(canvas);

        const renderLoopTick = () => {
            this.debugCount++;
            /*if (this.debugCount === 200) {
                let fakeCamera = this.createCamera(canvas, this.camera.position.x, this.camera.position.y, this.camera.position.z);
                fakeCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
                let v = new THREE.Vector3();
                this.camera.getWorldDirection(v);
                fakeCamera.lookAt(v);
                let helper = new THREE.CameraHelper(fakeCamera);
                helper.material.linewidth = 4;
                helper.material.color = new THREE.Color('black');
                this.scene.add(helper);
            }*/

            this.createOrthographicCameras();
            this.createTextureMatrices();

            this.shaderMaterial.uniforms.displayBorders.value = this.displayBorders ? 1 : 0;
            this.shaderMaterial.uniforms.splitCount.value = this.splitCount;

            //renderer.render(this.bufferScene, this.orthographicCameras[0]);
            for (let i = 0; i < this.splitCount; ++i) {
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
        const rockyTexture = textureLoader.load(rockTexture);
        rockyTexture.wrapS = rockyTexture.wrapT = THREE.RepeatWrapping;
        const snowyTexture = textureLoader.load(snowTexture);
        snowyTexture.wrapS = snowyTexture.wrapT = THREE.RepeatWrapping;
        const greenTexture = textureLoader.load(meadowTexture);
        greenTexture.wrapS = greenTexture.wrapT = THREE.RepeatWrapping;

        this.shaderMaterial.uniforms = {
            bumpTexture: {type: "t", value: bumpTexture},
            bumpScale: {type: "f", value: this.terrainBumpScale},
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
            splitCount: {type: "i", value: this.splitCount},
            vectorsTextures: {
                type: "tv", value: this.bufferTextures.map(function (bt) {
                    if (bt !== null) {
                        return bt.texture;
                    }
                    return null;
                })
            },
            textureMatrices: {type: "m4v", value: new Array(this.maxSplitCount).fill(new THREE.Matrix4())},
            displayBorders: {type: "i", value: 0}
        };

        const plane = new THREE.Mesh(geometry, this.shaderMaterial);
        plane.position.set(0, -150, 0);
        plane.rotation.x = -Math.PI / 2;
        this.scene.add(plane);

        return plane;
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
                mesh.position.set(-600 + 300 * i, 0, -300 + 300 * j);
                mesh.rotation.set(-Math.PI / 2, 0, 0);
                this.bufferScene.add(mesh);
              }
        }
    }



    calculateMaxSplitDistances(camera) {
        const near = this.near;
        const far = this.far;
        this.maxSplitDistances[0] = near;

        for (let i = 1; i < this.splitCount + 1; i++) {
            let f = i / (this.splitCount + 1);
            let l = near * Math.pow(far / near, f);
            let u = near + (far - near) * f;
            this.maxSplitDistances[i] = l * this.splitLambda + u * (1 - this.splitLambda);
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
            return new THREE.Vector3(p.x, p.y, p.z);
        });
    }

    calculateBoundingBox(points) {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;
        for (const point of points) {
            minX = Math.min(point.x, minX);
            maxX = Math.max(point.x, maxX);
            minY = Math.min(point.y, minY);
            maxY = Math.max(point.y, maxY);
            minZ = Math.min(point.z, minZ);
            maxZ = Math.max(point.z, maxZ);
        }

        return {minX: minX, minY: minY, minZ: minZ, maxX: maxX, maxY: maxY, maxZ: maxZ};
    }

    getOrthographicCameraForPerspectiveCamera(camera) {
        const frustumCorners = this.calculateCameraFrustumCorners(camera);

        // format: minX, minY, minZ, maxX, maxY, maxZ
        const boundingBox = this.calculateBoundingBox(frustumCorners);

        let rangeX = boundingBox.maxX - boundingBox.minX;
        let centerX = (boundingBox.maxX + boundingBox.minX) / 2;
        let rangeY = boundingBox.maxZ - boundingBox.minZ;
        let centerY = (boundingBox.maxZ + boundingBox.minZ) / 2;

        let cam = new THREE.OrthographicCamera(
            -rangeX / 2,
            rangeX / 2,
            rangeY / 2,
            -rangeY / 2,
            -1000,
            2000
        );
        cam.position.set(centerX, 500, centerY);
        cam.rotation.set(-Math.PI / 2, 0, 0);
        cam.updateMatrixWorld( true );

        return cam;
    }

    createOrthographicCameras() {
        this.calculateMaxSplitDistances(this.camera);

        for (let i = 0; i < this.splitCount; ++i) {
            let currentCamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, this.maxSplitDistances[i], this.maxSplitDistances[i + 1]);
            currentCamera.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
            currentCamera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            currentCamera.updateMatrixWorld( true );
            this.orthographicCameras[i] = this.getOrthographicCameraForPerspectiveCamera(currentCamera);
        }
    }

    createTextureMatrices() {
        let matrices = new Array(this.maxSplitCount).fill(new THREE.Matrix4());
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
        for (let i = 0; i < this.splitCount; ++i) {
            const textureGeometry = new THREE.PlaneBufferGeometry(debugSize * this.camera.aspect, debugSize, 128, 128);
            const textureMaterial = new THREE.MeshBasicMaterial({map: this.bufferTextures[i].texture, depthTest: false});
            const textureMesh = new THREE.Mesh(textureGeometry, textureMaterial);
            this.debugScene.add(textureMesh);
            this.camera.add(textureMesh);
            textureMesh.position.set(-550 + (textureMesh.geometry.parameters.width + 50) * i, -300, -1000);
        }
    }

    createTerrainBorderPlanes() {
        const heightMapImage = new Image();
        heightMapImage.src = heightMapTexture;
        const ref = this;
        heightMapImage.onload = function (img) {
            // TODO why is the value lower than it should be?
            // image is stored in RGBA -> every ith element for which (i % 4 == 0) is for R
            // but heightMax is 146
            // and you can see the resulting plane intersecting the terrain, which should not happen
            // which means that the value in vertex shader is higher than the value i get here
            // how is this possible?

            /*const canvas = document.createElement("canvas");
            const context = canvas.getContext('2d');
            context.drawImage(heightMapImage, 0, 0);
            const info = context.getImageData(0, 0, heightMapImage.width, heightMapImage.height);
            const heightInfo = info.data.filter(function (value, index) {
                return index % 4 === 0;
            });
            let heightMax = Number.NEGATIVE_INFINITY;
            heightInfo.forEach(elem => {
                heightMax = Math.max(heightMax, elem);
            });*/


            // TODO refactor
            const terrain = ref.terrain;
            const terrainGeometry = terrain.geometry;
            ref.lowerPlane = new THREE.Mesh(new THREE.PlaneGeometry(terrainGeometry.parameters.width, terrainGeometry.parameters.height), new THREE.MeshBasicMaterial({
                color: "green",
                wireframe: true
            }));
            ref.upperPlane = new THREE.Mesh(new THREE.PlaneGeometry(terrainGeometry.parameters.width, terrainGeometry.parameters.height), new THREE.MeshBasicMaterial({
                color: "green",
                wireframe: true
            }));

            let debugGeometry = new THREE.Geometry().fromBufferGeometry(terrainGeometry);
            debugGeometry.computeFaceNormals();
            debugGeometry.computeFlatVertexNormals();
            debugGeometry.computeMorphNormals();
            debugGeometry.computeVertexNormals();
            console.log(debugGeometry);

            ref.lowerPlane.rotation.set(terrain.rotation.x, terrain.rotation.y, terrain.rotation.z);
            ref.lowerPlane.position.set(terrain.position.x, terrain.position.y, terrain.position.z);
            ref.lowerPlane.position.y -= ref.terrainBumpScale;
            ref.upperPlane.rotation.set(terrain.rotation.x, terrain.rotation.y, terrain.rotation.z);
            ref.upperPlane.position.set(terrain.position.x, terrain.position.y, terrain.position.z);
            ref.upperPlane.position.y += ref.terrainBumpScale;
            ref.calculateNearAndFar()
        };
    }

    createFrustumFromCamera(camera) {
        return new THREE.Frustum().setFromMatrix(
            new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        );
    }

    setPointOfIntersection(plane, line, intersectionPoints) {
        let pointOfIntersection = plane.intersectLine(line);
        if (pointOfIntersection) {
            intersectionPoints.push(pointOfIntersection)
        }
    }

    findPlaneIntersection(mathPlane, meshPlane) {
        let a = new THREE.Vector3();
        let b = new THREE.Vector3();
        let c = new THREE.Vector3();

        let intersectionPoints = [];
        let obj = this;
        meshPlane.geometry.faces.forEach(function (face) {
            meshPlane.localToWorld(a.copy(meshPlane.geometry.vertices[face.a]));
            meshPlane.localToWorld(b.copy(meshPlane.geometry.vertices[face.b]));
            meshPlane.localToWorld(c.copy(meshPlane.geometry.vertices[face.c]));
            let lineAB = new THREE.Line3(a, b);
            let lineBC = new THREE.Line3(b, c);
            let lineCA = new THREE.Line3(c, a);
            obj.setPointOfIntersection(mathPlane, lineAB, intersectionPoints);
            obj.setPointOfIntersection(mathPlane, lineBC, intersectionPoints);
            obj.setPointOfIntersection(mathPlane, lineCA, intersectionPoints);
        });
        return intersectionPoints;
    }

    findFrustumAndPlaneIntersections(frustum, plane) {
        let intersectionPoints = [];
        frustum.planes.forEach(fp => intersectionPoints = intersectionPoints.concat(this.findPlaneIntersection(fp, plane)));
        return intersectionPoints;
    }

    // order:
    // 1 ------ 2
    // |        |
    // |        |
    // 3 ------ 4
    // first upper plane, then lower plane
    // vertices[0] -> upper 1
    // vertices[7] -> lower 4
    getBoundingBoxSidePlanes(vertices) {
        return [
            new THREE.Plane().setFromCoplanarPoints(vertices.upper[0], vertices.upper[2], vertices.lower[0]),
            new THREE.Plane().setFromCoplanarPoints(vertices.upper[2], vertices.upper[3], vertices.lower[2]),
            new THREE.Plane().setFromCoplanarPoints(vertices.upper[3], vertices.upper[1], vertices.lower[3]),
            new THREE.Plane().setFromCoplanarPoints(vertices.upper[1], vertices.upper[0], vertices.lower[1]),
        ];
    }

    calculateNearAndFar() {
        this.scene.add(this.lowerPlane);
        this.scene.add(this.upperPlane);

        let cameraFrustum = this.createFrustumFromCamera(this.camera);
        this.lowerPlane.updateMatrixWorld(true);
        this.upperPlane.updateMatrixWorld(true);

        let lowerPlaneIntersectionPoints = this.findFrustumAndPlaneIntersections(cameraFrustum, this.lowerPlane);
        let upperPlaneIntersectionPoints = this.findFrustumAndPlaneIntersections(cameraFrustum, this.upperPlane);

        const canvas = this.canvasRef.current;
        const vectorTextureBoundingBoxCoordinates = {
            upper: [
                new THREE.Vector3(canvas.width /  2, this.camera.position.y,     canvas.height /  2),
                new THREE.Vector3(canvas.width / -2, this.camera.position.y,     canvas.height /  2),
                new THREE.Vector3(canvas.width / -2, this.camera.position.y,     canvas.height / -2),
                new THREE.Vector3(canvas.width /  2, this.camera.position.y,     canvas.height / -2),
            ],
            lower: [
                new THREE.Vector3(canvas.width /  2, this.lowerPlane.position.y, canvas.height /  2),
                new THREE.Vector3(canvas.width / -2, this.lowerPlane.position.y, canvas.height /  2),
                new THREE.Vector3(canvas.width / -2, this.lowerPlane.position.y, canvas.height / -2),
                new THREE.Vector3(canvas.width /  2, this.lowerPlane.position.y, canvas.height / -2),
            ]
        };
        let planes = this.getBoundingBoxSidePlanes(vectorTextureBoundingBoxCoordinates);

        let texturesBoxIntersectionPoints = [];
        planes.forEach(plane => {
            for (let i = 1; i < upperPlaneIntersectionPoints.length; i++) {
                const line = new THREE.Line3(upperPlaneIntersectionPoints[i - 1], upperPlaneIntersectionPoints[i]);
                this.setPointOfIntersection(plane, line, texturesBoxIntersectionPoints);
            }
        });

        let intersectionPointsInViewSpace = texturesBoxIntersectionPoints.map(it => it.applyMatrix4(this.camera.matrixWorldInverse))

        /*this.near = Math.max(this.camera.near, Math.min(...intersectionPointsInViewSpace.map(it => it.z)));
        this.far = Math.min(this.camera.far, Math.max(...intersectionPointsInViewSpace.map(it => it.z)));
        console.log(this.near, this.far);*/


        // debug display
        let textureBoxAndBoundingPlanesIntersectionsGeometry = new THREE.Geometry();
        texturesBoxIntersectionPoints.forEach(it => textureBoxAndBoundingPlanesIntersectionsGeometry.vertices.push(it));
        let frustumAndBoundingPlanesIntersectionGeometry = new THREE.Geometry();
        lowerPlaneIntersectionPoints.forEach(it => frustumAndBoundingPlanesIntersectionGeometry.vertices.push(it));
        upperPlaneIntersectionPoints.forEach(it => frustumAndBoundingPlanesIntersectionGeometry.vertices.push(it));
        let points1 = new THREE.Points(textureBoxAndBoundingPlanesIntersectionsGeometry, new THREE.PointsMaterial({
            size: 100,
            color: 0xffff00
        }));
        this.scene.add(points1);

        let points2 = new THREE.Points(frustumAndBoundingPlanesIntersectionGeometry, new THREE.PointsMaterial({
            size: 100,
            color: 0x34eba1
        }));
        this.scene.add(points2);

        let boxGeometry = new THREE.BoxGeometry(window.innerWidth, 10000, window.innerHeight);
        let boxMesh = new THREE.Mesh(boxGeometry, new THREE.MeshBasicMaterial({
            wireframe: true,
            color: new THREE.Color("blue")
        }));
        this.scene.add(boxMesh);
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
