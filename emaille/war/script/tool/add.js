/**
 * Add tool
 */

function Add() {
}

Add.prototype = {
	relinkRing: function(clicked) {
		var hiddenRings = [];
		return {
			execute: function() {
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
				
				// Re-enable invisible rings linked to base ring
				for(var edge of ringGraph.outEdges(base.nodeID)) {
					if(!ringGraph.node(edge.w).mesh.visible) {
						ringGraph.node(edge.w).mesh.visible = true;
						hiddenRings.push(ringGraph.node(edge.w));
					}
				}
			},
			undo: function() {
				for(var ring of hiddenRings) {
					ring.mesh.visible = false;
				}
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