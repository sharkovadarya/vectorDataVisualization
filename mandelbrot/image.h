#ifndef MANDELBROT_IMAGE_H
#define MANDELBROT_IMAGE_H

#include <FreeImage.h>

class image {
    FIBITMAP *bitmap;

public:
    void load_image(const char *fname);
    void free_image();
    BYTE* get_data();
};



#endif //MANDELBROT_IMAGE_H
