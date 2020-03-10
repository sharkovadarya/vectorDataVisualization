import * as THREE from "three-full";


export function calculateMaxSplitDistances(maxSplitDistances, splitCount, splitLambda, near, far) {
    maxSplitDistances[0] = near;

    for (let i = 1; i < splitCount + 1; i++) {
        let f = i / (splitCount + 1);
        let l = near * Math.pow(far / near, f);
        let u = near + (far - near) * f;
        maxSplitDistances[i] = l * splitLambda + u * (1 - splitLambda);
    }
    return maxSplitDistances
}

function calculateCameraFrustumCorners(camera) {
    let ndc_corners = [
        [-1,-1,-1], [1,-1,-1], [-1,1,-1], [1,1,-1],
        [-1,-1, 1], [1,-1, 1], [-1,1, 1], [1,1, 1]];

    let world_corners = [];
    for (let i = 0; i < ndc_corners.length; ++i) {
        let ndc_v = new THREE.Vector3(...ndc_corners[i]);
        let v_cam = ndc_v.unproject(camera);
        // let v_cam_4 = new THREE.Vector4(v_cam.x, v_cam.y, v_cam.z, 1);
        world_corners.push(v_cam);
    }
    return world_corners.map(function (p) {
        return new THREE.Vector3(p.x, p.y, p.z);
    });
}

function calculateBoundingBox(points) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const point of points) {
        minX = Math.min(point.x, minX);
        maxX = Math.max(point.x, maxX);
        minY = Math.min(point.y, minY);
        maxY = Math.max(point.y, maxY);
        minZ = Math.min(point.z, minZ);
        maxZ = Math.max(point.z, maxZ);
    }

    return {minX: minX, minY: minY, minZ: minZ, maxX: maxX, maxY: maxY, maxZ: maxZ};
}

export function getOrthographicCameraForPerspectiveCamera(camera) {
    const frustumCorners = calculateCameraFrustumCorners(camera);

    // format: minX, minY, minZ, maxX, maxY, maxZ
    const boundingBox = calculateBoundingBox(frustumCorners);

    let rangeX = boundingBox.maxX - boundingBox.minX;
    let centerX = (boundingBox.maxX + boundingBox.minX) / 2;
    let rangeY = boundingBox.maxZ - boundingBox.minZ;
    let centerY = (boundingBox.maxZ + boundingBox.minZ) / 2;

    let cam = new THREE.OrthographicCamera(
        -rangeX / 2,
        rangeX / 2,
        rangeY / 2,
        -rangeY / 2,
        -1000,
        2000
    );
    cam.position.set(centerX, 500, centerY);
    cam.rotation.set(-Math.PI / 2, 0, 0);
    cam.updateMatrixWorld( true );

    return cam;
}
