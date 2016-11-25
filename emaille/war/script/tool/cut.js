/**
 * Cut tool
 */

function Cut() {
}

Cut.prototype = {	
	removeRing: function(clicked) {
		var edges = ringGraph.nodeEdges(clicked.nodeID);
		return {
			execute: function() {
				if(!ringGraph.hasNode(clicked.nodeID))
					return;
				
				ringGraph.removeNode(clicked.nodeID);
				scene.remove(clicked.mesh);
			},
			undo: function() {
				if(ringGraph.hasNode(clicked.nodeID))
					return;
				
				ringGraph.setNode(clicked.nodeID, clicked);
				for(var edge of edges)
					ringGraph.setEdge(edge);
				scene.add(clicked.mesh);
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