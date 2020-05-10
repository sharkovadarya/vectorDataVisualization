const int MAX_VERTICES = 3;

uniform sampler2D depthTexture;
uniform float width;
uniform float height;

uniform vec2 vertices[MAX_VERTICES];

uniform mat4 projectionMatrixInverse;
uniform mat4 viewMatrixInverse;

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
    vec2 screenPos = vec2((gl_FragCoord.x) / width, (gl_FragCoord.y) / height);
    float pixelDepth = texture2D(depthTexture, screenPos).x;

    vec4 clipSpacePosition = vec4(screenPos * 2.0 - vec2(1.0), 2.0 * pixelDepth - 1.0, 1.0);

    vec4 pos4 = viewMatrixInverse * projectionMatrixInverse * clipSpacePosition;
    vec3 worldSpacePos = pos4.xyz / pos4.w;

    if (pointInTriangle(vec2(worldSpacePos.x, worldSpacePos.z), vertices[0], vertices[1], vertices[2])) {
        gl_FragColor = vec4(0, 1, 0, 1);
    } else {
        gl_FragColor = vec4(0, 0, 0, 0);
    }
}
