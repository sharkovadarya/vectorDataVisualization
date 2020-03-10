varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 textureSize;
void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec4 prev00 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 0), 0);
    vec4 prev01 = texelFetch(tDiffuse, 2 * coord + ivec2(0, 1), 0);
    vec4 prev10 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 0), 0);
    vec4 prev11 = texelFetch(tDiffuse, 2 * coord + ivec2(1, 1), 0);
    float min_value = min(prev00.x, min(prev01.x, min(prev10.x, prev11.x)));
    float max_value = max(prev00.y, max(prev01.y, max(prev10.y, prev11.y)));
    gl_FragColor = vec4(min_value, max_value, 0, 1);
}
