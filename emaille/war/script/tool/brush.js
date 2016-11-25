/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {	
	paintRing: function(clicked) {
		var newColor = ringColor;
		var oldColor = "#" + clicked.mesh.material.color.getHexString();
		if(oldColor === newColor)
			return null;
		return {
			execute: function() {
				clicked.mesh.material = getMaterial(newColor);
			},
			undo: function() {
				clicked.mesh.material = getMaterial(oldColor);
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