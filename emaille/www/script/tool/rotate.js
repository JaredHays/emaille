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
				camera.updateMatrixWorld();
				expandSheet();
			},
			undo: function() {
				camera.rotation.z -= THREE.Math.degToRad(30);
				camera.updateMatrixWorld();
				expandSheet();
			}
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
	}
};
