#!/usr/bin/env bash

# uncomment to install gcc-9
# sudo add-apt-repository ppa:jonathonf/gcc-9.0
# sudo apt-get install gcc-9

# set up libraries

GCC_compiler=gcc-9
GPP_compiler=g++-9

# nanogui
mkdir ext
cd ext || exit
git clone --recursive https://github.com/mitsuba-renderer/nanogui.git
cd nanogui || exit
mkdir build
cd build || exit
cmake -D CMAKE_C_COMPILER=$GCC_compiler -D CMAKE_CXX_COMPILER=$GPP_compiler ..
make -j 4
cd ../../../ || exit

# freeimage
apt-get install libfreeimage3

# glew
apt-get install libglew-dev

# build project
mkdir build
cd build || exit
cmake -D CMAKE_C_COMPILER=$GCC_compiler -D CMAKE_CXX_COMPILER=$GPP_compiler ..
make






