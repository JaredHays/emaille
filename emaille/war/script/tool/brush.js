/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {
	// Fetch a shared material or create it if it doesn't exist
	getMaterial: function(color) {
		if(!(color in materials)) {
			materials[color] = baseMaterials[0].clone();
			materials[color].color.setStyle(color);
		}
		return materials[color];
	},
	
	paintRing: function(clicked) {
		var brush = this;
		var newColor = ringColor;
		var oldColor = "#" + clicked.mesh.material.color.getHexString();
		if(oldColor === newColor)
			return null;
		return {
			execute: function() {
				clicked.mesh.material = brush.getMaterial(newColor);
			},
			undo: function() {
				clicked.mesh.material = brush.getMaterial(oldColor);
			}
		}
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			return this.paintRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				return this.paintRing(clicked);
		}
	}
};