import * as THREE from "three";
import {SVGLoader} from "three/examples/jsm/loaders/SVGLoader";

export function loadSVGToScene(url, scene,
                               posX = 0, posY = 0, posZ = 0,
                               rotationX = 0, rotationY = 0, rotationZ = 0,
                               scale) {
    const loader = new SVGLoader();

    loader.load(
        url,
        function (data) {
            const paths = data.paths;

            const group = new THREE.Group();
            group.scale.multiplyScalar(scale);
            group.position.set(posX, posY, posZ);
            group.scale.y *= - 1;
            group.rotation.set(rotationX, rotationY, rotationZ);

            for (let i = 0; i < paths.length; i ++ ) {

                const path = paths[i];

                const fillColor = path.userData.style.fill;
                if ( fillColor !== undefined && fillColor !== 'none' ) {

                    var material = new THREE.MeshBasicMaterial( {
                        color: new THREE.Color().setStyle( fillColor ),
                        opacity: path.userData.style.fillOpacity,
                        transparent: path.userData.style.fillOpacity < 1,
                        side: THREE.DoubleSide,
                        depthWrite: false
                    } );

                    var shapes = path.toShapes( true );

                    for ( var j = 0; j < shapes.length; j ++ ) {

                        var shape = shapes[ j ];

                        var geometry = new THREE.ShapeBufferGeometry( shape );
                        var mesh = new THREE.Mesh( geometry, material );

                        group.add( mesh );

                    }

                }

                var strokeColor = path.userData.style.stroke;

                if ( strokeColor !== undefined && strokeColor !== 'none' ) {

                    var material = new THREE.MeshBasicMaterial( {
                        color: new THREE.Color().setStyle( strokeColor ),
                        opacity: path.userData.style.strokeOpacity,
                        transparent: path.userData.style.strokeOpacity < 1,
                        side: THREE.DoubleSide,
                        depthWrite: false
                    } );

                    for ( var j = 0, jl = path.subPaths.length; j < jl; j ++ ) {

                        var subPath = path.subPaths[ j ];

                        var geometry = SVGLoader.pointsToStroke( subPath.getPoints(), path.userData.style );

                        if ( geometry ) {

                            var mesh = new THREE.Mesh( geometry, material );

                            group.add( mesh );

                        }

                    }

                }

            }

            scene.add( group );

        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.log('An error happened', error);
        }
    );
}
