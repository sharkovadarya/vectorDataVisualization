import * as THREE from "three-full";
import terrainPingPongVxShader from "../../shaders/terrain_ping_pong.vert";
import terrainPingPongFragShader from "../../shaders/terrain_ping_pong.frag";

export class ZCoordEffectsComposer extends THREE.EffectComposer {
    swapBuffers() {
        // for debug
        let pixels = new Float32Array(32);
        this.renderer.readRenderTargetPixels(this.readBuffer, 0, 0, 4, 1, pixels);
        this.renderer.readRenderTargetPixels(this.writeBuffer, 0, 0, 4, 1, pixels);

        if (this.currentWidth === -1 || this.currentHeight === -1) {
            let v = new THREE.Vector4();
            this.renderer.getCurrentViewport(v);
            this.currentWidth = v.z;
            this.currentHeight = v.w;
        }

        let newWidth = Math.ceil(this.currentWidth / 2);
        let newHeight = Math.ceil(this.currentHeight / 2);
        this.currentHeight = newHeight;
        this.currentWidth = newWidth;
        this.renderer.setViewport(0, 0, newWidth, newHeight);
        super.swapBuffers();
    }
}

ZCoordEffectsComposer.prototype.currentHeight = -1;
ZCoordEffectsComposer.prototype.currentWidth = -1;

export function setUpZCoordEffectsComposer(renderer, width, height, scene, camera) {
    let composer = new ZCoordEffectsComposer(renderer, new THREE.WebGLRenderTarget(width, height, {type: THREE.FloatType}));
    composer.currentHeight = height;
    composer.currentWidth = width;
    composer.renderToScreen = false;
    composer.addPass(new THREE.RenderPass(scene, camera));
    let n = Math.ceil(Math.max(Math.log2(width), Math.log2(height)));
    // do n passes
    for (let i = 1; i <= n; i++) {
        const currentWidth = Math.ceil(width / Math.pow(2, i));
        const currentHeight = Math.ceil(height / Math.pow(2, i));
        const shader = {
            uniforms: {
                tDiffuse: null,
                textureSize: {value: new THREE.Vector2(currentWidth, currentHeight)}
            },
            vertexShader: terrainPingPongVxShader,
            fragmentShader: terrainPingPongFragShader
        };
        composer.addPass(new THREE.ShaderPass(shader));
    }
    return composer;
}
