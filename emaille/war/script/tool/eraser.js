/**
 * Eraser tool
 */

function Eraser() {
}

Eraser.prototype = {
	eraseRing: function(clicked) {
		// Switch back to default material
		clicked.mesh.material = baseMaterials[clicked.geometryIndex];
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			this.eraseRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				this.eraseRing(clicked);
		}
	}
};