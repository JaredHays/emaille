/**
 * Rotate tool
 */

function Rotate() {
}

Rotate.prototype = {		
	onMouseDown: function() {
		return {
			execute: function() {
				camera.rotation.z += THREE.Math.degToRad(30);
				//camera.updateMatrixWorld();
				//camera.updateProjectionMatrix();
				expandSheet();
			},
			undo: function() {
				camera.rotation.z -= THREE.Math.degToRad(30);
				//camera.updateMatrixWorld();
				//camera.updateProjectionMatrix();
				//expandSheet();
			}
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
	}
};
