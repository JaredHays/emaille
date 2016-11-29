/**
 * Add tool
 */

function Add() {
}

Add.prototype = {
	relinkRing: function(clicked) {
		var addedRings = [];
		return {
			execute: function() {
				// Already added
				if(addedRings && addedRings.length > 0)
					return;
				
				// Get base ring
				var base;
				// Clicked ring is base ring
				if(weave.rings[clicked.ringIndex].base) {
					base = clicked;
				}
				// Clicked ring is not base ring
				else {
					// Get base ID
					var baseID;
					for(ringID in weave.structure) {
						if(weave.structure[ringID].base) {
							baseID = ringID;
							break;
						}
					}
					if(!baseID)
						return;
					
					// Find edge with base ID
					var edges = ringGraph.inEdges(clicked.nodeID).filter(function(edge) {return edge.name === baseID;});
					if(edges.length === 0)
						return;
					base = ringGraph.node(edges[0].v);
				}
				
				// Re-link from base ring
				addedRings = linkRings(base);
			},
			undo: function() {
				// No added rings
				if(!addedRings || addedRings.length === 0)
					return;
				
				for(var ring of addedRings) {					
					ringGraph.removeNode(ring.nodeID);
					scene.remove(ring.mesh);
				}
				
				addedRings = [];
			}
		}
	},
	
	onMouseDown: function() {
		var clicked = getClickedRing();
		if(clicked !== null) {
			return this.relinkRing(clicked);
		}
	},

	onMouseUp: function() {
	},

	onMouseMove: function () {
		if(mouse.down) {
			var clicked = getClickedRing();
			if(clicked !== null)
				return this.relinkRing(clicked);
		}
	}
};