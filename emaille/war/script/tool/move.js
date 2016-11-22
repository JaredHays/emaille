/**
 * Camera move tool
 */

function Move() {
	this.startPos = null;
	this.currentPos = null;
	this.updateTime = null;
	this.updateInterval = 100;
}

Move.prototype = {
	
	onMouseDown: function() {
		this.startPos = mouse.pos.clone();
		this.currentPos = mouse.pos.clone();
		this.updateTime = performance.now();
	},

	onMouseUp: function() {
		expandSheet();
	},

	onMouseMove: function () {
		if(mouse.down) {
			camera.position.x -= (mouse.pos.x - this.currentPos.x) * canvas.width / 2;
			camera.position.y -= (mouse.pos.y - this.currentPos.y) * canvas.height / 2;
			this.currentPos.copy(mouse.pos);
			
			// Add new rings
			if(performance.now() - this.updateTime > this.updateInterval) {
				expandSheet();
				this.updateTime = performance.now();
			}
		}
	}
};