/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null)
			clicked.material.color = new THREE.Color(ringColor.val());
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				clicked.material.color = new THREE.Color(ringColor.val());
		}
	}
};