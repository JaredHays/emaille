/**
 * Camera move tool
 */

function Move() {
}

Move.prototype = {
	startPos: null,
	currentPos: null,
	updateTime: null,
	updateInterval: 100,
	
	onMouseDown: function() {
		startPos = mouse.pos.clone();
		currentPos = mouse.pos.clone();
		updateTime = performance.now();
	},

	onMouseUp: function() {
		expandSheet();
	},

	onMouseMove: function () {
		if(mouse.down) {
			camera.position.x -= (mouse.pos.x - currentPos.x) * canvas.width / 2;
			camera.position.y -= (mouse.pos.y - currentPos.y) * canvas.height / 2;
			currentPos.copy(mouse.pos);
			
			// Add new rings
			if(performance.now() - this.updateTime > this.updateInterval) {
				expandSheet();
				this.updateTime = performance.now();
			}
		}
	}
};