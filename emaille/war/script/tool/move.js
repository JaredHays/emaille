/**
 * Camera move tool
 */

function Move() {
}

Move.prototype = {
	startPos: null,
	currentPos: null,
	
	onMouseDown: function() {
		startPos = mouse.pos.clone();
		currentPos = mouse.pos.clone();
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			camera.position.x -= (mouse.pos.x - currentPos.x) * canvas.width / 2;
			camera.position.y -= (mouse.pos.y - currentPos.y) * canvas.height / 2;
			currentPos.copy(mouse.pos);
		}
	}
};