/**
 * Cut tool
 */

function Cut() {
}

Cut.prototype = {	
	removeRing: function(clicked) {
		return {
			execute: function() {
				clicked.visible = false;
			},
			undo: function() {
				clicked.visible = true;
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