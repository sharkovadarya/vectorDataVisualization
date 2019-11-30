import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import React from 'react';
import SlidersBarComponent from "./SlidersBar";
import {draw, initBuffers, loadTexture, onMouseDown, onMouseDrag, onZoom, program} from './mandelbrot'
import texture from './ppl.png'
import styles from './App.css'

export class CanvasComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {gl: undefined, prog: undefined}
    }

    componentDidMount() {
        let canvas = this.refs.canvas;
        this.state.gl = canvas.getContext('webgl');
        this.state.prog = program(this.state.gl, this.props.iterations, this.props.centerX, this.props.centerY,
            [initBuffers(this.state.gl)]);
        loadTexture(this.state.gl, this.state.prog, texture);

        canvas.addEventListener("wheel", e => onZoom(this.state.gl, this.state.prog, e));
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mousemove", e => onMouseDrag(this.state.gl, this.state.prog, e));
        this.updateCanvas();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.updateCanvas();
    }

    updateCanvas() {
        this.state.prog.iterations = this.props.iterations;
        this.state.prog.centerX = this.props.centerX;
        this.state.prog.centerY = this.props.centerY;
        draw(this.state.gl, this.state.prog);
    }

    render() {
        return (
            <canvas ref="canvas" width={800} height={800}/>
        );
    }
}



class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {iterations: 300, centerX: 0.7, centerY: 0.0};
    }

    componentDidMount() {
        // TODO
    }

    slidersCallback = (value, type) => {
        switch (type) {
            case 'iterations':
                this.setState({iterations: value, centerX: this.state.centerX, centerY: this.state.centerY});
                break;
            case 'centerX':
                this.setState({iterations: this.state.iterations, centerX: value, centerY: this.state.centerY});
                break;
            case 'centerY':
                this.setState({iterations: this.state.iterations, centerX: this.state.centerX, centerY: value});
                break;
        }
    };

    render() {
        return (
            <div className='rowComponents'>
                <CanvasComponent iterations={this.state.iterations}
                                 centerX={this.state.centerX}
                                 centerY={this.state.centerY}/>
                <SlidersBarComponent callbackFromParent={this.slidersCallback}/>
            </div>
        );
    }
}


export default App;
