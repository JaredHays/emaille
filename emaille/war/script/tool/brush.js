/**
 * Brush tool
 */

function Brush() {
	this.materials = {};
}

Brush.prototype = {
	// Fetch a shared material or create it if it doesn't exist
	getMaterial: function(color) {
		if(!(color in this.materials)) {
			this.materials[color] = baseMaterials[0].clone();
			this.materials[color].color.setStyle(color);
		}
		return this.materials[color];
	},
	
	paintRing: function(clicked) {
		clicked.mesh.material = this.getMaterial(ringColor);
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