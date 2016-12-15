/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {	
	paintRing: function(clicked) {
		var newColor = $("#ring-color").val();
		var oldColor = "#" + clicked.mesh.material.color.getHexString();
		if(oldColor === newColor)
			return null;
		return {
			execute: function() {
				clicked.changeColor(newColor);
			},
			undo: function() {
				clicked.changeColor(oldColor);
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