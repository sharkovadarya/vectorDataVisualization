#include <string>
#include <iostream>
#include <vector>
#include <GL/glew.h>
#include <fstream>

std::string readFile(const char *filePath) {
    std::string content;
    std::ifstream fileStream(filePath, std::ios::in);

    if(!fileStream.is_open()) {
        std::cerr << "Could not read file " << filePath << ". File does not exist." << std::endl;
        return "";
    }

    std::string line;
    while(!fileStream.eof()) {
        std::getline(fileStream, line);
        content.append(line + "\n");
    }

    fileStream.close();
    return content;
}


GLuint load_shader(const char *fragment_path) {
    glewInit();

    GLuint fragShader = glCreateShader(GL_FRAGMENT_SHADER);

    std::string fragShaderStr = readFile(fragment_path);
    const char *fragShaderSrc = fragShaderStr.c_str();

    GLint result = GL_FALSE;
    int logLength;

    glShaderSource(fragShader, 1, &fragShaderSrc, nullptr);
    glCompileShader(fragShader);

    glGetShaderiv(fragShader, GL_COMPILE_STATUS, &result);
    glGetShaderiv(fragShader, GL_INFO_LOG_LENGTH, &logLength);
    std::vector<char> fragShaderError((logLength > 1) ? logLength : 1);
    glGetShaderInfoLog(fragShader, logLength, nullptr, &fragShaderError[0]);
    std::cout << &fragShaderError[0] << std::endl;

    GLuint program = glCreateProgram();
    glAttachShader(program, fragShader);
    glLinkProgram(program);

    glUseProgram(program);

    return program;
}

void set_uniform1f(unsigned int prog, const char *name, float val) {
    int loc = glGetUniformLocation(prog, name);
    if(loc != -1) {
        glUniform1f(loc, val);
    }
}

void set_uniform2f(unsigned int prog, const char *name, float v1, float v2) {
    int loc = glGetUniformLocation(prog, name);
    if(loc != -1) {
        glUniform2f(loc, v1, v2);
    }
}

void set_uniform1i(unsigned int prog, const char *name, int val) {
    int loc = glGetUniformLocation(prog, name);
    if(loc != -1) {
        glUniform1i(loc, val);
    }
}