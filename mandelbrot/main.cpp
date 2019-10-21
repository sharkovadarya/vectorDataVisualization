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

mandelbrot_parameters m_params;

struct sliders_parameters {
    int iterations_min = 2;
    int iterations_max = 600;
    int iterations_default_actual = (iterations_max - iterations_min) / 2;
    float iterations_default_relative = 0.5;

    float center_min = -1.0;
    float center_max = 1.0;
    float center_x_default_relative = (m_params.center_x + 1) / 2;
    float center_y_default_relative = (m_params.center_y + 1) / 2;
    float center_x_default_actual = m_params.center_x;
    float center_y_default_actual = m_params.center_y;
};

sliders_parameters s_params;

bool button_pressed = false;


nanogui::Screen *screen = nullptr;
nanogui::Slider *center_x_slider, *center_y_slider;
nanogui::TextBox *center_x_text_box, *center_y_text_box;

void mouse_button_callback(GLFWwindow* window, int button, int action, int mods) {
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        double x, y;
        glfwGetCursorPos(window, &x, &y);

        auto window_width = static_cast<float>(m_params.window_width);
        auto window_height = static_cast<float>(m_params.window_height);

        if (action == GLFW_PRESS) {
            m_params.pos_x = 2.0 * (static_cast<float>(x) / window_width - 0.5);
            m_params.pos_y = 2.0 * (static_cast<float>(y) / window_height - 0.5);
            button_pressed = true;
        } else if (action == GLFW_RELEASE) {
            button_pressed = false;
        }
    }
}

void update_sliders() {
    center_x_slider->set_value((m_params.center_x + 1) / 2);
    center_x_text_box->set_value(std::to_string(m_params.center_x));
    center_y_slider->set_value((m_params.center_y + 1) / 2);
    center_y_text_box->set_value(std::to_string(m_params.center_y));
}

void mouse_drag(GLFWwindow* window) {
    double x, y;
    glfwGetCursorPos(window, &x, &y);

    int width, height;
    glfwGetWindowSize(window, &width, &height);
    auto window_width = static_cast<float>(width);
    auto window_height = static_cast<float>(height);

    float fx = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    float fy = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    float speed = m_params.scale / 2.0;
    m_params.center_x += (fx - m_params.pos_x) * speed;
    m_params.center_y -= (fy - m_params.pos_y) * speed;

    m_params.pos_x = fx;
    m_params.pos_y = fy;
}

void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    double x, y;
    glfwGetCursorPos(window, &x, &y);
    int width, height;
    glfwGetWindowSize(window, &width, &height);
    auto window_width = static_cast<float>(width);
    auto window_height = static_cast<float>(height);
    float aspect_ratio = window_width / window_height;
    m_params.pos_x = 2.0 * (static_cast<float>(x) / window_width - 0.5);
    m_params.pos_y = 2.0 * (static_cast<float>(y) / window_height - 0.5);

    if (yoffset > 0) { // zoom out
        m_params.center_x = m_params.center_x -
                aspect_ratio * (static_cast<float>(x) / window_width - 0.5) *
                m_params.scale * m_params.zoom;
        m_params.center_y = m_params.center_y +
                (static_cast<float>(y) / window_height - 0.5) * m_params.scale * m_params.zoom;
        m_params.scale *= (1 - m_params.zoom);
    } else if (yoffset < 0) { // zoom in
        m_params.center_x = m_params.center_x +
                aspect_ratio * (static_cast<float>(x) / window_width - 0.5) *
                m_params.scale * m_params.zoom;
        m_params.center_y = m_params.center_y -
                (static_cast<float>(y) / window_height - 0.5) * m_params.scale * m_params.zoom;
        m_params.scale *= (1 + m_params.zoom);
    }
}

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

std::pair<nanogui::Slider*, nanogui::TextBox*> create_slider(nanogui::ref<nanogui::Window> nanogui_window,
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

    return std::make_pair(slider, text_box);
}

std::function<void(float)> iterations_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        int iterations =
                static_cast<int>(value * (s_params.iterations_max - s_params.iterations_min)) + s_params.iterations_min;
        text_box->set_value(std::to_string(iterations));
        m_params.iterations = iterations;
    };
}

std::function<void(float)> center_x_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        float center = (s_params.center_max - s_params.center_min) * value + s_params.center_min;
        text_box->set_value(std::to_string(center));
        m_params.center_x = center;
    };
}

// TODO refactor
std::function<void(float)> center_y_slider_callback(nanogui::TextBox* text_box) {
    return [text_box](float value) {
        float center = (s_params.center_max - s_params.center_min) * value + s_params.center_min;
        text_box->set_value(std::to_string(center));
        m_params.center_y = center;
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
    glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);

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

    create_slider(nanogui_window,
            s_params.iterations_default_relative,
            std::to_string(s_params.iterations_default_actual),
            iterations_slider_callback);
    auto center_x_entities = create_slider(nanogui_window,
            s_params.center_x_default_relative,
            std::to_string(s_params.center_x_default_actual),
            center_x_slider_callback);
    center_x_slider = center_x_entities.first;
    center_x_text_box = center_x_entities.second;
    auto center_y_entities = create_slider(nanogui_window,
            s_params.center_y_default_relative,
            std::to_string(s_params.center_y_default_actual),
            center_y_slider_callback);
    center_y_slider = center_y_entities.first;
    center_y_text_box = center_y_entities.second;

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
    if (!glfwInit())
        return -1;

    glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);

    GLFWwindow* window = glfwCreateWindow(m_params.window_width, m_params.window_height, "Mandelbrot Set", NULL, NULL);
    if (!window) {
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    load_texture("../ppl.ppm");

    m_params.program = load_shader("../mandelbrot.glsl");

    glfwSetMouseButtonCallback(window, mouse_button_callback);
    glfwSetScrollCallback(window, scroll_callback);

    auto window1 = setup_sliders_window();
    while (!glfwWindowShouldClose(window1) && !glfwWindowShouldClose(window)) {
        // render sliders
        set_uniform1i(m_params.program, "iterations", m_params.iterations);
        glfwMakeContextCurrent(window1);

        update_sliders();
        screen->clear();
        screen->draw_contents();
        screen->draw_widgets();

        glfwSwapBuffers(window1);

        // render the Mandelbrot set
        glfwMakeContextCurrent(window);
        set_uniform2f(m_params.program, "center", m_params.center_x, m_params.center_y);
        set_uniform1f(m_params.program, "scale", m_params.scale);

        int width, height;
        glfwGetWindowSize(window, &width, &height);
        set_uniform1f(m_params.program, "window_height", static_cast<float>(height));
        set_uniform1f(m_params.program, "window_width", static_cast<float>(width));

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