#include <iostream>
#include <array>
#include "image.h"

void image::load_image(const char *fname) {
    #ifdef FREEIMAGE_LIB
        FreeImage_Initialise();
    #endif
    FREE_IMAGE_FORMAT fif = FreeImage_GetFileType(fname, 0);

    if (fif == FIF_UNKNOWN) {
        fif = FreeImage_GetFIFFromFilename(fname);
    }

    if (fif != FIF_UNKNOWN && FreeImage_FIFSupportsReading(fif)) {
        bitmap = FreeImage_Load(fif, fname);
        bitmap = FreeImage_ConvertTo32Bits(bitmap);
    }
    else {
        bitmap = nullptr;
    }

    if (!bitmap) {
        std::cerr << "Unable to load the image file " << fname << std::endl;
        exit(-1);
    }
}

void image::free_image() {
    FreeImage_Unload(bitmap);
    #ifdef FREEIMAGE_LIB
        FreeImage_DeInitialise();
    #endif
}

BYTE* image::get_data() {
    return (BYTE*) FreeImage_GetBits(bitmap);
}