const int MAX_VERTICES = 3;

uniform sampler2D depthTexture;
uniform float bumpScale;

uniform sampler2D heightMap;
uniform vec2 vertices[MAX_VERTICES];


void main()
{
    // TODO get actual position
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);

}
