import React from 'react';
import ReactDOM from 'react-dom';

import { Provider } from 'react-redux';
import { createStore } from 'redux'
import { rootReducer } from './js/reducers/RootReducer.jsx'
// import * as MATERIAL from '@material-ui/core';
// import { composeWithDevTools } from 'redux-devtools-extension';
import { devToolsEnhancer } from 'redux-devtools-extension';

const store = createStore(rootReducer, devToolsEnhancer(
));

import ViewArea from "./js/components/ViewArea.jsx";

const rootElement = document.getElementById("root");
ReactDOM.render(
  <Provider store={store}>
    <ViewArea />
    {/* <MATERIAL.Button variant="contained" color="primary">
      Test button
    </MATERIAL.Button>
    <MATERIAL.Slider
            // value={typeof value === 'number' ? value : 0}
            aria-labelledby="input-slider"
    /> */}
  </Provider>,
  rootElement
);

