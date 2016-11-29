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
			},
			undo: function() {
				clicked.mesh.visible = true;
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