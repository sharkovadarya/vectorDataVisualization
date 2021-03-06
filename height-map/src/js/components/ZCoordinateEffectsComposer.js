import * as THREE from "three";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass";

import terrainPingPongVxShader from "../../shaders/terrain_ping_pong.vert";
import terrainPingPongFragShader from "../../shaders/terrain_ping_pong.frag";

class ShaderPassWithViewport extends ShaderPass {
    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
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

const maxFactor = 5;

export function setUpZCoordEffectsComposer(renderer, width, height, scene, camera, passesCount, factor) {
    let composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width, height, {type: THREE.FloatType}));
    composer.renderToScreen = false;
    composer.addPass(new RenderPass(scene, camera));
    let n = passesCount === undefined ? calculatePassesCount(width, height, factor) : passesCount;
    // do n passes
    for (let i = 1; i <= n; i++) {
        const viewportWidth = Math.ceil(width / Math.pow(factor, i));
        const viewportHeight = Math.ceil(height / Math.pow(factor, i));
        const textureWidth = Math.ceil(width / Math.pow(factor, i - 1));
        const textureHeight = Math.ceil(height / Math.pow(factor, i - 1));

        let directions = new Array(maxFactor * maxFactor).fill(new THREE.Vector2());
        for (let i = 0; i < factor; i++) {
            for (let j = 0; j < factor; j++) {
                directions[i * factor + j] = new THREE.Vector2(i, j);
            }
        }

        const shader = {
            uniforms: {
                tDiffuse: null,
                textureSize: {value: new THREE.Vector2(textureWidth, textureHeight)},
                directions: {value: directions},
                previousTextureFactor: {value: factor}
            },
            vertexShader: terrainPingPongVxShader,
            fragmentShader: terrainPingPongFragShader
        };
        const pass = new ShaderPassWithViewport(shader);
        pass.width = viewportWidth;
        pass.height = viewportHeight;
        composer.addPass(pass);
    }
    return composer;
}

export function calculatePassesCount(width, height, factor) {
    return Math.ceil(Math.max(log(width, factor), log(height, factor)))
}

function log(value, base) {
    return Math.log(value) / Math.log(base);
}

