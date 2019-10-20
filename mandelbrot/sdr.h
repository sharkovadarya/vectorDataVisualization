#ifndef MANDELBROT_SDR_H
#define MANDELBROT_SDR_H

//unsigned int setup_shader(const char *fname);
void set_uniform1i(unsigned int prog, const char *name, int val);
void set_uniform1f(unsigned int prog, const char *name, float val);
void set_uniform2f(unsigned int prog, const char *name, float v1, float v2);
unsigned int setup_shader(const char *fname);
GLuint load_shader(const char *fragment_path);

#endif //MANDELBROT_SDR_H
