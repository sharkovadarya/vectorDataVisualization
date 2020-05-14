const int MAX_VERTICES = 3;

uniform sampler2D depthTexture;
uniform float bumpScale;

uniform sampler2D heightMap;
uniform vec2 vertices[MAX_VERTICES];

varying vec3 pp;

varying vec2 vUv;

void main()
{
    pp = position;
    vUv = uv;
    // TODO get actual position
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
