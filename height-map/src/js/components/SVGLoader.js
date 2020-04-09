import * as THREE from "three-full";

export function loadSVGToScene(url, scene,
                               posX = 0, posY = 0, posZ = 0,
                               rotationX = 0, rotationY = 0, rotationZ = 0,
                               scaleX = 1, scaleY = 1, scaleZ = 1) {
    const loader = new THREE.SVGLoader();

    loader.load(
        url,
        function (data) {
            const paths = data.paths === undefined ? data : data.paths;
            const group = new THREE.Group();

            for (let i = 0; i < paths.length; i++) {
                const path = paths[i];

                const material = new THREE.MeshBasicMaterial({
                    color: path.color,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });

                const shapes = path.toShapes(true);

                for (let j = 0; j < shapes.length; j++) {
                    const shape = shapes[j];
                    const geometry = new THREE.ShapeBufferGeometry(shape);
                    const mesh = new THREE.Mesh(geometry, material);
                    group.add(mesh);
                }
            }

            group.rotation.set(rotationX, rotationY, rotationZ);
            group.position.set(posX, posY, posZ);
            group.scale.set(scaleX, scaleY, scaleZ);

            scene.add(group);

        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.log('An error happened', error);
        }
    );
}
