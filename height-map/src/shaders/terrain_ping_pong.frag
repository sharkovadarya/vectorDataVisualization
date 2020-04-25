const int maxDirections = 25;

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 textureSize; // previous texture size
uniform vec2 directions[maxDirections];
uniform int previousTextureFactor;
void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    vec4 prev[maxDirections];
    for (int i = 0; i < maxDirections; i++) {
        if (i > previousTextureFactor * previousTextureFactor) {
            break;
        }
        prev[i] = texelFetch(tDiffuse, previousTextureFactor * coord + ivec2(directions[i]), 0);
    }
    float minValue = prev[0].x;
    float maxValue = prev[0].y;
    ivec2 textureSizeInt = ivec2(textureSize);
    for (int i = 1; i < maxDirections; i++) {
        if (i > previousTextureFactor * previousTextureFactor) {
            break;
        }
        ivec2 c = previousTextureFactor * coord + ivec2(directions[i]);
        if ((c.x <= textureSizeInt.x - 1) && (c.y <= textureSizeInt.y - 1)) {
            minValue = min(minValue, prev[i].x);
            maxValue = max(maxValue, prev[i].y);
        }
    }
    gl_FragColor = vec4(minValue, maxValue, 0, 1);
}
