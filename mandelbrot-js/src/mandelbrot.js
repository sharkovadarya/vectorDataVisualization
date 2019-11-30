let zoom = 0.2;
let scale = 2.0;
let mousePos;

export function loadTexture(gl, prog, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 0, 0]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        width, height, border, srcFormat, srcType,
        pixel);

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            srcFormat, srcType, image);
        gl.enable(gl.TEXTURE_2D);
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        draw(gl, prog)
    };
    image.src = url;

    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

export function onZoom(gl, prog, event) {
    mousePos = getLocalCoordinates(event.clientX, event.clientY);

    if (event.deltaY > 0) {
        prog.centerX = prog.centerX + mousePos[0] * scale * zoom;
        prog.centerY = prog.centerY - mousePos[1] * scale * zoom;
        scale *= (1 + zoom);
    } else if (event.deltaY < 0) {
        prog.centerX = prog.centerX - mousePos[0] * scale * zoom;
        prog.centerY = prog.centerY + mousePos[1] * scale * zoom;
        scale *= (1 - zoom);

    }
    draw(gl, prog);
}


export function onMouseDown(event) {
    mousePos = getLocalCoordinates(event.clientX, event.clientY);
}

export function onMouseDrag(gl, prog, event) {
    if (event.buttons !== 1) return;

    let pos = getLocalCoordinates(event.clientX, event.clientY);
    let deltaX = pos[0] - mousePos[0];
    let deltaY = pos[1] - mousePos[1];
    prog.centerX += deltaX * (scale / 2.0);
    prog.centerY -= deltaY * (scale / 2.0);
    mousePos = pos;
    draw(gl, prog);
}

function getLocalCoordinates(x, y) {
    return [x / 800 * 2 - 1, y / 800 * 2 - 1];
}

export function draw(gl, program) {
    gl.useProgram(program);
    gl.vertexAttribPointer(gl.getAttribLocation(program, "a_vert_coord"), 2, gl.FLOAT, false, 0, 0);

    let iterLoc = gl.getUniformLocation(program, "iterations");
    gl.uniform1i(iterLoc, program.iterations);
    console.log(program.centerX, program.centerY);
    let centerLoc = gl.getUniformLocation(program, "center");
    gl.uniform2f(centerLoc, program.centerX, program.centerY);
    let zoomLoc = gl.getUniformLocation(program, "zoom");
    gl.uniform1f(zoomLoc, scale);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export function initBuffers(gl) {
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);
    return buf;
}

function compile(gl, src, type) {
    let s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
}

export function program(gl, iterations=300, centerX=0.7, centerY=0.0) {
    let shaderProgram = gl.createProgram();

    //let vertexShader = getShader(gl, 'vert');
    //let fragmentShader = getShader(gl, 'frag');

    let vertexShader =
        `attribute vec2 a_vert_coord;
         varying vec2 _pos;
         void main() {
            gl_Position = vec4(_pos = a_vert_coord, 0, 1);
         }`;
    let fragmentShader =
        `
         precision highp float;

         uniform sampler2D u_texture;
         uniform int iterations;        
         uniform vec2 center;        
         uniform float zoom;        
         varying vec2 _pos;        
         const int MAX_ITERATIONS = 1000;
        
         void main() {
             vec2 c, z;
             c.x = _pos.x * zoom - center.x;
             c.y = _pos.y * zoom - center.y;
             z = c;
             for (int i = 0; i < MAX_ITERATIONS; ++i) {
                if (i == iterations) break;
                float x = (z.x * z.x - z.y * z.y) + c.x;
                float y = (z.y * z.x + z.x * z.y) + c.y;
                if ((x * x + y * y) > 4.0) {
                    gl_FragColor = texture2D(u_texture, vec2(float(i) / 100.0, 0));
                    return;
                }
                z.x = x;
                z.y = y;
             }
             gl_FragColor = texture2D(u_texture, vec2(0, 0));
         }
        `;

    gl.attachShader(shaderProgram, compile(gl, fragmentShader, gl.FRAGMENT_SHADER));
    gl.attachShader(shaderProgram, compile(gl, vertexShader, gl.VERTEX_SHADER));

    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialize shaders");
    }

    gl.useProgram(shaderProgram);
    gl.enableVertexAttribArray(gl.getAttribLocation(shaderProgram, "a_vert_coord"));

    shaderProgram.iterations = iterations;
    shaderProgram.centerX = centerX;
    shaderProgram.centerY = centerY;

    return shaderProgram;
}
