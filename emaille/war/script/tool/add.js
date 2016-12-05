/**
 * Add tool
 */

function Add() {
}

Add.prototype = {
	relinkRing: function(clicked) {
		var hiddenRings = [];
		var geometryIndexes = new Set();
		return {
			execute: function() {
				hiddenRings = [];
				geometryIndexes = new Set();
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
					var ring = ringGraph.node(edge.w);
					if(!ring.mesh.visible) {
						ring.mesh.visible = true;
						ringColorCounts[ring.geometryIndex]["#" + ring.mesh.material.color.getHexString()]++;
						hiddenRings.push(ring);
						geometryIndexes.add(ring.geometryIndex);
					}
				}
				
				for(var geometryIndex in geometryIndexes)
					updateRingStats(geometryIndex);
			},
			undo: function() {
				for(var ring of hiddenRings) {
					ring.mesh.visible = false;
					ringColorCounts[ring.geometryIndex]["#" + ring.mesh.material.color.getHexString()]--;
				}
				
				for(var geometryIndex in geometryIndexes)
					updateRingStats(geometryIndex);
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