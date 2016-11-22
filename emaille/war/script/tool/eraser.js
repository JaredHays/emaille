/**
 * Eraser tool
 */

function Eraser() {
}

Eraser.prototype = {
	// Fetch a shared material or create it if it doesn't exist
	getMaterial: function(color) {
		if(!(color in materials)) {
			materials[color] = baseMaterials[0].clone();
			materials[color].color.setStyle(color);
		}
		return materials[color];
	},
	
	eraseRing: function(clicked) {
		var eraser = this;
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
				console.log("undo");
				clicked.mesh.material = eraser.getMaterial(oldColor);
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