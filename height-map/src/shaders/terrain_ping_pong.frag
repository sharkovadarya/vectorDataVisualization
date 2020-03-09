varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 textureSize;
void main() {
    vec2 texcoord = vUv * textureSize;
    ivec2 coord = ivec2(texcoord);
    vec4 prev00 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 0), 0);
    vec4 prev01 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 1), 0);
    vec4 prev10 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 0), 0);
    vec4 prev11 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 1), 0);
    float cur_value = prev00.x;
    if (prev01.x < cur_value) {
        cur_value = prev01.x;
    }
    if (prev10.x < cur_value) {
        cur_value = prev10.x;
    }
    if (prev11.x < cur_value) {
        cur_value = prev11.x;
    }
    gl_FragColor = vec4(cur_value);
}
