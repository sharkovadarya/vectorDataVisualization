uniform sampler1D tex;

uniform vec2 center;
uniform float scale;
uniform int iterations;

uniform float window_height;
uniform float window_width;

void main() {
    vec2 c;

    c.x = window_width / window_height * (gl_TexCoord[0].x - 0.5) * scale - center.x;
    c.y = (gl_TexCoord[0].y - 0.5) * scale - center.y;

    vec2 z = c;

    int i = 0;
    for (; i < iterations; ++i) {
        float x = (z.x * z.x - z.y * z.y) + c.x;
        float y = (z.y * z.x + z.x * z.y) + c.y;

        if ((x * x + y * y) > 4.0) {
            break;
        }
        z.x = x;
        z.y = y;
    }

    gl_FragColor = texture1D(tex, (i == iterations ? 0.0 : float(i)) / 100.0);
}
