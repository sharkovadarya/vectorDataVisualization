varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 textureSize; // previous texture size
void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec4 prev00 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 0), 0);
    vec4 prev01 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 1), 0);
    vec4 prev10 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 0), 0);
    vec4 prev11 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 1), 0);
    float min_value = prev00.x;
    float max_value = prev00.y;
    ivec2 prev01coord = 2 * coord + ivec2(0, 1);
    ivec2 textureSizeInt = ivec2(textureSize);
    if ((2 * coord + ivec2(0, 1)).y <= textureSizeInt.y - 1) {
        min_value = min(min_value, prev01.x);
        max_value = max(max_value, prev01.y);
    }
    if ((2 * coord + ivec2(1, 0)).x <= textureSizeInt.x - 1) {
        min_value = min(min_value, prev10.x);
        max_value = max(max_value, prev10.y);
    }
    if (((2 * coord + ivec2(0, 1)).y <= textureSizeInt.y - 1) && ((2 * coord + ivec2(1, 0)).x <= textureSizeInt.x - 1)) {
        min_value = min(min_value, prev11.x);
        max_value = max(max_value, prev11.y);
    }
    gl_FragColor = vec4(min_value, max_value, 0, 1);
}
