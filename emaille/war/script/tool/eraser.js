/**
 * Eraser tool
 */

function Eraser() {
}

Eraser.prototype = {
	eraseRing: function(clicked) {
		var oldColor = "#" + clicked.mesh.material.color.getHexString();;
		var baseColor = "#" + baseMaterials[clicked.geometryIndex].color.getHexString();
		if(oldColor === baseColor)
			return null;
		return {
			execute: function() {
				// Switch back to default material
				clicked.mesh.material = baseMaterials[clicked.geometryIndex];
			},
			undo: function() {
				clicked.mesh.material = getMaterial(oldColor);
			}
		}
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			return this.eraseRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				return this.eraseRing(clicked);
		}
	}
};