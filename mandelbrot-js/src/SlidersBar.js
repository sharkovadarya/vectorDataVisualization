import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import React from 'react';
import Tooltip from 'rc-tooltip';
import Slider from 'rc-slider';

class SlidersBarComponent extends React.Component {
    componentDidMount() {
        this.updateCanvas();
    }

    updateCanvas() {
        // TODO???
        /*const ctx = this.refs.canvas.getContext('2d');
        ctx.fillRect(0,0, 100, 100);*/
    }

    sliderValueToCenterCoordinates = (value) => {
        return value * 1 / 400 - 1;
    };

    render() {
        const Handle = Slider.Handle;

        const iterationsHandle = (props) => {
            const { value, dragging, index, ...restProps } = props;
            return (
                <Tooltip
                    prefixCls="rc-slider-tooltip"
                    overlay={value}
                    visible={dragging}
                    placement="top"
                    key={index}
                >
                    <Handle value={value} {...restProps} />
                </Tooltip>
            );
        };

        const centerHandle = (props) => {
            const { value, dragging, index, ...restProps } = props;
            return (
                <Tooltip
                    prefixCls="rc-slider-tooltip"
                    overlay={this.sliderValueToCenterCoordinates(value).toFixed(2)}
                    visible={dragging}
                    placement="top"
                    key={index}
                >
                    <Handle value={value} {...restProps} />
                </Tooltip>
            );
        };

        const wrapperStyle = {width: 500, marginLeft: 100, marginTop: 100};
        const sliderStyle = {width: 400, margin: 50};
        const textStyle = {margin: 50};

        return (
            <div style={wrapperStyle}>
                <div style={sliderStyle}>
                    <div>Iterations</div>
                    <Slider min={2} max={1000} defaultValue={300}
                            marks={{ 2: 2, 300: 300, 1000: 1000 }} step={1} handle={iterationsHandle}
                            onChange={value => this.props.callbackFromParent(value, 'iterations')}/>
                </div>
                <div style={sliderStyle}>
                    <div>Center: X</div>
                    <Slider min={0} max={800} defaultValue={680}
                            marks={{ 0: -1, 680: 0.7,  800: 1 }} step={1} handle={centerHandle}
                            onChange={value =>
                                this.props.callbackFromParent(this.sliderValueToCenterCoordinates(value), 'centerX')}/>
                </div>
                <div style={sliderStyle}>
                    <div>Center: Y</div>
                    <Slider min={0} max={800} defaultValue={400}
                            marks={{ 0: -1, 400: 0, 800: 1 }} step={1} handle={centerHandle}
                            onChange={value =>
                                this.props.callbackFromParent(this.sliderValueToCenterCoordinates(value), 'centerY')}/>
                </div>
            </div>
        );
    }
}

export default SlidersBarComponent;
