uniform sampler2D bumpTexture;
uniform float bumpScale;
varying float vAmount;
varying vec2 vUV;
varying vec3 pos;

varying vec4 view_space_pos;

void main()
{
    vUV = uv;
    vec4 bumpData = texture2D(bumpTexture, uv);

    vAmount = bumpData.r;

    // position comes from geometry.vertices[i].position and is in local space
    vec3 newPosition = position + normal * bumpScale * vAmount;

    pos = newPosition;
    vec4 pos4 = vec4(newPosition, 1.0);

    view_space_pos = viewMatrix * modelMatrix * pos4;


    //gl_Position = projectionMatrix * modelViewMatrix * pos4;
    // modelMatrix corresponds to plane.matrixWorld
    // starts out as an identity matrix, then gets its values set when the scene is rendered
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * pos4;
}
