/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {
	paintRing: function(clicked) {
		// Using default material, create new
		if(clicked.mesh.material === materials[clicked.geometryIndex])
			clicked.mesh.material = materials[clicked.geometryIndex].clone();
		clicked.mesh.material.color.setStyle(ringColor);
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			// console.log(clicked.nodeID);
			// scene.remove(clicked);
			this.paintRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				// scene.remove(clicked);
				this.paintRing(clicked);
		}
	}
};