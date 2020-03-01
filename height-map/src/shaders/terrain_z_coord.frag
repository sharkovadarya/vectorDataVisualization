varying vec4 view_space_pos;

void main() {
    gl_FragColor = vec4(view_space_pos.z);
}
