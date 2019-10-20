#include <GL/glut.h>

#include "image.h"
#include "sdr.h"

struct mandelbrot_parameters {
    int window_width = 1920;
    int window_height = 1080;

    int iterations = 1000;
    float scale = 2.0;
    const float zoom = 0.02;

    unsigned int program = 0;

    float center_x = 0.7;
    float center_y = 0.0;

    float pos_x = 0.0;
    float pos_y = 0.0;
};

mandelbrot_parameters m;

void draw() {
    set_uniform2f(m.program, "center", m.center_x, m.center_y);
    set_uniform1f(m.program, "scale", m.scale);

    // TODO
    set_uniform1f(m.program, "window_height", (float) m.window_height);
    set_uniform1f(m.program, "window_width", (float) m.window_width);

    glBegin(GL_QUADS);
    glTexCoord2f(0, 0);
    glVertex2f(-1, -1);
    glTexCoord2f(1, 0);
    glVertex2f(1, -1);
    glTexCoord2f(1, 1);
    glVertex2f(1, 1);
    glTexCoord2f(0, 1);
    glVertex2f(-1, 1);
    glEnd();

    glutSwapBuffers();
}

void idle_handler() {
    glutPostRedisplay();
}

void mouse_handler(int button, int state, int x, int y) {
    /*auto window_width = static_cast<float>(glutGet(GLUT_WINDOW_WIDTH));
    auto window_height = static_cast<float>(glutGet(GLUT_WINDOW_HEIGHT));*/
    auto window_width = (float) m.window_width;
    auto window_height = (float) m.window_height;
    float aspect_ratio = window_width / window_height;
    m.pos_x = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    m.pos_y = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    if (button == 3) { // zoom out
        m.center_x = m.center_x - aspect_ratio * (static_cast<float>(x) / window_width - 0.5) * m.scale * m.zoom;
        m.center_y = m.center_y + (static_cast<float>(y) / window_height - 0.5) * m.scale * m.zoom;
        m.scale *= (1 - m.zoom);
    } else if (button == 4) { // zoom in
        m.center_x = m.center_x + aspect_ratio * (static_cast<float>(x) / window_width - 0.5) * m.scale * m.zoom;
        m.center_y = m.center_y - (static_cast<float>(y) / window_height - 0.5) * m.scale * m.zoom;
        m.scale *= (1 + m.zoom);
    }
}

void movement_handler(int x, int y) {
    /*auto window_width = static_cast<float>(glutGet(GLUT_WINDOW_WIDTH));
    auto window_height = static_cast<float>(glutGet(GLUT_WINDOW_HEIGHT));*/
    auto window_width = (float) m.window_width;
    auto window_height = (float) m.window_height;
    float fx = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    float fy = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    float speed = m.scale / 2.0;
    m.center_x += (fx - m.pos_x) * speed;
    m.center_y -= (fy - m.pos_y) * speed;

    m.pos_x = fx;
    m.pos_y = fy;
}

int main(int argc, char **argv) {
    glutInitWindowSize(m.window_width, m.window_height);

    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_RGBA | GLUT_DOUBLE);
    glutCreateWindow("Mandelbrot Set");

    glutDisplayFunc(draw);
    glutIdleFunc(idle_handler);
    glutMouseFunc(mouse_handler);
    glutMotionFunc(movement_handler);

    glBindTexture(GL_TEXTURE_1D, 1);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_WRAP_S, GL_REPEAT);

    image i{};
    i.load_image("../ppl.ppm");
    glTexImage1D(GL_TEXTURE_1D, 0, GL_RGBA, 256, 0, GL_BGRA, GL_UNSIGNED_BYTE, (GLvoid*) i.get_data());
    i.free_image();

    glEnable(GL_TEXTURE_1D);

    m.program = load_shader("../mandelbrot.glsl");
    set_uniform1i(m.program, "iterations", m.iterations);
    glutMainLoop();


    return 0;
}