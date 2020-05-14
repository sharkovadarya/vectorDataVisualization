precision highp float;


uniform sampler2D depthTexture;
uniform float W;
uniform float H;

uniform vec2 triangleVertices[3];

uniform vec2 quadVertices[4];
uniform sampler2D quadTexture;

uniform vec2 circleCenter;
uniform float circleRadius;

uniform vec4 color;

uniform int mode; // 0 -> triangle, 1 -> colored quad, 2 -> patterned quad, 3 -> circle

uniform mat4 projectionMatrixInverse;
uniform mat4 viewMatrixInverse;

varying vec3 pp;
varying vec2 vUv;


float sign(vec2 p1, vec2 p2, vec2 p3)
{
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

bool pointInTriangle(vec2 pt, vec2 v1, vec2 v2, vec2 v3)
{
    float d1, d2, d3;
    bool has_neg, has_pos;

    d1 = sign(pt, v1, v2);
    d2 = sign(pt, v2, v3);
    d3 = sign(pt, v3, v1);

    has_neg = (d1 < 0.0) || (d2 < 0.0) || (d3 < 0.0);
    has_pos = (d1 > 0.0) || (d2 > 0.0) || (d3 > 0.0);

    return !(has_neg && has_pos);
}

void main() {
    vec2 screenPos = vec2((gl_FragCoord.x) / W, (gl_FragCoord.y) / H);
    float pixelDepth = texture2D(depthTexture, screenPos).x;

    vec4 clipSpacePosition = vec4(screenPos * 2.0 - vec2(1.0), 2.0 * pixelDepth - 1.0, 1.0);

    vec4 pos4 = projectionMatrixInverse * clipSpacePosition;
    pos4 /= pos4.w;
    vec3 worldSpacePos = (viewMatrixInverse * pos4).xyz;

    bool drawPoint = false;
    if (mode == 0) {
        drawPoint = pointInTriangle(vec2(worldSpacePos.x, worldSpacePos.z), triangleVertices[0], triangleVertices[1], triangleVertices[2]);
    } else if (mode == 1 || mode == 2) {
        drawPoint = pointInTriangle(vec2(worldSpacePos.x, worldSpacePos.z), quadVertices[0], quadVertices[1], quadVertices[2]) ||
                    pointInTriangle(vec2(worldSpacePos.x, worldSpacePos.z), quadVertices[0], quadVertices[3], quadVertices[2]);
    } else if (mode == 3) {
        drawPoint = (worldSpacePos.x - circleCenter.x) * (worldSpacePos.x - circleCenter.x) + (worldSpacePos.z - circleCenter.y) * (worldSpacePos.z - circleCenter.y) <= circleRadius * circleRadius;
    }

    if (drawPoint) {
        gl_FragColor = color;
    } else {
        gl_FragColor = vec4(0, 0, 0, 0);
    }
}
