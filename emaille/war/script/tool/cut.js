/**
 * Cut tool
 */

function Cut() {
}

Cut.prototype = {	
	removeRing: function(clicked) {
		return {
			execute: function() {
				clicked.mesh.visible = false;
				ringColorCounts[clicked.geometryIndex]["#" + clicked.mesh.material.color.getHexString()]--;
				updateRingStats(clicked.geometryIndex);
			},
			undo: function() {
				clicked.mesh.visible = true;
				ringColorCounts[clicked.geometryIndex]["#" + clicked.mesh.material.color.getHexString()]++;
				updateRingStats(clicked.geometryIndex);
			}
		}
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			return this.removeRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				return this.removeRing(clicked);
		}
	}
};