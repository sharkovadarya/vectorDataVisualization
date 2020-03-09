import * as THREE from "three-full";
import terrainPingPongVxShader from "../../shaders/terrain_ping_pong.vert";
import terrainPingPongFragShader from "../../shaders/terrain_ping_pong.frag";

class ShaderPassWithViewport extends THREE.ShaderPass {
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        let pixels = new Float32Array(4 * 8 * 4);
        renderer.readRenderTargetPixels(readBuffer, 0, 0, 8, 4, pixels);

        if (this.width === -1 || this.height === -1) {
            let v = new THREE.Vector4();
            renderer.getCurrentViewport(v);
            this.width = v.z;
            this.height = v.w;
        }

        renderer.setViewport(0, 0, this.width, this.height);

        super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    }
}

ShaderPassWithViewport.prototype.width = -1;
ShaderPassWithViewport.prototype.height = -1;

export function setUpZCoordEffectsComposer(renderer, width, height, scene, camera) {
    let composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(width, height, {type: THREE.FloatType}));
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
        const pass = new ShaderPassWithViewport(shader);
        pass.width = currentWidth;
        pass.height = currentHeight;
        composer.addPass(pass);
    }
    return composer;
}
