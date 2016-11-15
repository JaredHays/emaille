/**
 * Brush tool
 */

function Brush() {
}

Brush.prototype = {
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			// console.log(clicked.nodeID);
			// scene.remove(clicked);
			clicked.material.color = new THREE.Color(ringColor);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				// scene.remove(clicked);
				clicked.material.color = new THREE.Color(ringColor);
		}
	}
};