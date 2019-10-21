#include <GLFW/glfw3.h>
#include <nanogui/nanogui.h>
#include <iostream>

#include "image.h"
#include "sdr.h"

struct mandelbrot_parameters {
    int window_width = 1920;
    int window_height = 1080;

    int iterations = 299;
    float scale = 2.0;
    const float zoom = 0.02;

    unsigned int program = 0;

    float center_x = 0.7;
    float center_y = 0.0;

    float pos_x = 0.0;
    float pos_y = 0.0;
};

mandelbrot_parameters m;

bool button_pressed = false;

void mouse_button_callback(GLFWwindow* window, int button, int action, int mods) {
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        double x, y;
        glfwGetCursorPos(window, &x, &y);

        auto window_width = (float) m.window_width;
        auto window_height = (float) m.window_height;

        if (action == GLFW_PRESS) {
            m.pos_x = 2.0 * (static_cast<float>(x) / window_width - 0.5);
            m.pos_y = 2.0 * (static_cast<float>(y) / window_height - 0.5);
            button_pressed = true;
        } else if (action == GLFW_RELEASE) {
            button_pressed = false;
        }
    }
}

void mouse_drag(GLFWwindow* window) {
    double x, y;
    glfwGetCursorPos(window, &x, &y);

    int width, height;
    glfwGetWindowSize(window, &width, &height);
    auto window_width = (float) width;
    auto window_height = (float) height;

    float fx = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    float fy = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    float speed = m.scale / 2.0;
    m.center_x += (fx - m.pos_x) * speed;
    m.center_y -= (fy - m.pos_y) * speed;

    m.pos_x = fx;
    m.pos_y = fy;
}

void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    double x, y;
    glfwGetCursorPos(window, &x, &y);
    int width, height;
    glfwGetWindowSize(window, &width, &height);
    auto window_width = (float) width;
    auto window_height = (float) height;
    float aspect_ratio = window_width / window_height;
    m.pos_x = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    m.pos_y = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    if (yoffset > 0) { // zoom out
        m.center_x = m.center_x - aspect_ratio * (static_cast<float>(x) / window_width - 0.5) * m.scale * m.zoom;
        m.center_y = m.center_y + (static_cast<float>(y) / window_height - 0.5) * m.scale * m.zoom;
        m.scale *= (1 - m.zoom);
    } else if (yoffset < 0) { // zoom in
        m.center_x = m.center_x + aspect_ratio * (static_cast<float>(x) / window_width - 0.5) * m.scale * m.zoom;
        m.center_y = m.center_y - (static_cast<float>(y) / window_height - 0.5) * m.scale * m.zoom;
        m.scale *= (1 + m.zoom);
    }
}

nanogui::Screen *screen = nullptr;

void load_texture(const char* path_to_texture) {
    glBindTexture(GL_TEXTURE_1D, 1);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_1D, GL_TEXTURE_WRAP_S, GL_REPEAT);

    image i{};
    i.load_image(path_to_texture);
    glTexImage1D(GL_TEXTURE_1D, 0, GL_RGBA, 256, 0, GL_BGRA, GL_UNSIGNED_BYTE, (GLvoid*) i.get_data());
    i.free_image();

    glEnable(GL_TEXTURE_1D);
}

void create_slider(nanogui::ref<nanogui::Window> nanogui_window,
        float initial_pos,
        const std::string& initial_value,
        const std::function<std::function<void(float)>(nanogui::TextBox*)> &callback) {
    auto *panel = new nanogui::Widget(nanogui_window);
    panel->set_layout(new nanogui::BoxLayout(nanogui::Orientation::Horizontal,
                                             nanogui::Alignment::Middle, 0, 20));

    auto *slider = new nanogui::Slider(panel);
    slider->set_value(initial_pos);
    slider->set_fixed_width(280);

    auto *text_box = new nanogui::TextBox(panel);
    text_box->set_fixed_size(nanogui::Vector2i(100, 25));
    text_box->set_value(initial_value);
    text_box->set_font_size(20);
    text_box->set_alignment(nanogui::TextBox::Alignment::Right);

    slider->set_callback(callback(text_box));
}

std::function<void(float)> iterations_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        int iterations = (int)(value * (600 - 2)) + 2;
        text_box->set_value(std::to_string(iterations));
        m.iterations = iterations;
    };
}

std::function<void(float)> center_x_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        float center = 2 * (value - 0.5);
        std::string str = std::to_string(center);
        text_box->set_value(str);
        m.center_x = center;
    };
}

// TODO refactor
std::function<void(float)> center_y_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        float center = 2 * (value - 0.5);
        std::string str = std::to_string(center);
        text_box->set_value(str);
        m.center_y = center;
    };
}

GLFWwindow* setup_sliders_window() {
#if defined(NANOGUI_USE_OPENGL)
    glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_API);

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#endif

    glfwWindowHint(GLFW_SAMPLES, 0);
    glfwWindowHint(GLFW_RED_BITS, 8);
    glfwWindowHint(GLFW_GREEN_BITS, 8);
    glfwWindowHint(GLFW_BLUE_BITS, 8);
    glfwWindowHint(GLFW_ALPHA_BITS, 8);
    glfwWindowHint(GLFW_STENCIL_BITS, 8);
    glfwWindowHint(GLFW_DEPTH_BITS, 24);
    glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);

    GLFWwindow* window = glfwCreateWindow(475, 200, "Mandelbrot Set Options", nullptr, nullptr);
    if (window == nullptr) {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return nullptr;
    }
    glfwMakeContextCurrent(window);
    glfwSetWindowPos(window, 80, 90);

    screen = new nanogui::Screen();
    screen->initialize(window, true);

#if defined(NANOGUI_USE_OPENGL) || defined(NANOGUI_USE_GLES)
    int width1, height1;
    glfwGetFramebufferSize(window, &width1, &height1);
    glViewport(0, 0, width1, height1);
    glfwSwapInterval(0);
    glfwSwapBuffers(window);
#endif

    auto *gui = new nanogui::FormHelper(screen);
    auto nanogui_window = gui->add_window(nanogui::Vector2i(10, 10), "Set values");
    nanogui_window->set_layout(new nanogui::GroupLayout());
    new nanogui::Label(nanogui_window, "Iterations", "sans-bold");

    create_slider(nanogui_window, 0.5, "299", iterations_slider_callback);
    create_slider(nanogui_window, 0.85, "0.7", center_x_slider_callback);
    create_slider(nanogui_window, 0.5, "0.0", center_y_slider_callback);

    glfwSetCursorPosCallback(window,
                             [](GLFWwindow *, double x, double y) {
                                 screen->cursor_pos_callback_event(x, y);
                             }
    );
    glfwSetMouseButtonCallback(window,
                               [](GLFWwindow *, int button, int action, int modifiers) {
                                   screen->mouse_button_callback_event(button, action, modifiers);
                               }
    );
    glfwSetScrollCallback(window,
                          [](GLFWwindow *, double x, double y) {
                              screen->scroll_callback_event(x, y);
                          }
    );
    glfwSetFramebufferSizeCallback(window,
                                   [](GLFWwindow *, int width, int height) {
                                       screen->resize_callback_event(width, height);
                                   }
    );

    screen->set_visible(true);
    screen->perform_layout();
    nanogui_window->center();
    screen->clear();
    screen->draw_all();

    return window;
}

int main(int argc, char **argv) {
    GLFWwindow* window;

    if (!glfwInit())
        return -1;

    window = glfwCreateWindow(m.window_width, m.window_height, "Mandelbrot Set", NULL, NULL);
    if (!window) {
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    load_texture("../ppl.ppm");

    m.program = load_shader("../mandelbrot.glsl");

    glfwSetMouseButtonCallback(window, mouse_button_callback);
    glfwSetScrollCallback(window, scroll_callback);

    auto window1 = setup_sliders_window();
    // Game loop
    while (!glfwWindowShouldClose(window1) && !glfwWindowShouldClose(window)) {
        set_uniform1i(m.program, "iterations", m.iterations);
        glfwMakeContextCurrent(window1);
        glfwPollEvents();

        screen->clear(); // glClear
        screen->draw_contents();
        screen->draw_widgets();

        glfwSwapBuffers(window1);

        glfwMakeContextCurrent(window);
        set_uniform2f(m.program, "center", m.center_x, m.center_y);
        set_uniform1f(m.program, "scale", m.scale);

        int width, height;
        glfwGetWindowSize(window, &width, &height);
        set_uniform1f(m.program, "window_height", (float) height);
        set_uniform1f(m.program, "window_width", (float) width);

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

        if (button_pressed) {
            mouse_drag(window);
        }

        glfwSwapBuffers(window);

        glfwPollEvents();
    }

    glfwTerminate();


    return 0;
}