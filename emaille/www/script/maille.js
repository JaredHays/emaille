/*jshint esversion: 6 */

/*
 * TODO:
 * . Quality slider
 * . Auto quality?
 * . Fixed sheet size option
 * . Measure tool
 * . Touch controls - two finger move, move not working in general
 * . Weave selection page
 * Suppress initial weave creation
 * Canvas renderer?
 * Hide scroll bar on control panel, up/down arrows on slider bounds
 * Rotate sheet (camera) 90 deg (save rotation?)
 */

var key;

var renderer = null;
var scene = null;
var camera = null;
var canvas = null;

var units = "in";

var wireGauges = {};

var weave = null;

var baseGeometries = [];
var baseMaterials = [];
var materials = {};
var ringEnabledFlags;

if(!wireMaterials)
	var wireMaterials;

var ringRotations;
var structureRotations;

var scale = 100;
var radialSegments = 8;
var tubularSegments = 64;

var raycaster = new THREE.Raycaster();

var ringDiv;

var geometryUpdates = new Set();
var positionUpdate = false;
var statsUpdate = false;

var ringGraph;
var nodeIndex;
var edgeRings;

var mouse = {
	down: false,
	pos: new THREE.Vector2()
};
var tool;
var previousTool;

var commandQueue = [];
var commandIndex = 0;

var envSettings = $.extend({
	logPerformance: false,
	host: "https://e-maille.appspot.com/"
}, localEnvSettings ? localEnvSettings : {});

Math.clamp = function(num, min, max) {
  return Math.min(Math.max(num, min), max);
};

THREE.Vector3.x_axis = new THREE.Vector3(1, 0, 0);
THREE.Vector3.y_axis = new THREE.Vector3(0, 1, 0);
THREE.Vector3.z_axis = new THREE.Vector3(0, 0, 1);

function run() {
	for(var geometryIndex of geometryUpdates) {
		updateGeometries(geometryIndex);
	}
	geometryUpdates.clear();
	if(positionUpdate) {
		updatePositions();
		expandSheet();
		positionUpdate = false;
	}
	if(statsUpdate) {
		updateRingStats();
		statsUpdate = false;
	}
	
	requestAnimationFrame(run);

	renderer.render(scene, camera);
}

function start() {
    $("#weave").on("change", function(e) {
    	if(!$(this).val()) {
    		e.preventDefault();
    		return;
    	}
    	
    	$.featherlight.close();
    	$("div#weave-select").remove();
    });
    $.featherlight($("div#weave-select").css("display", "block"), {
    	closeOnClick: false,
    	closeOnEsc: false
    });
}

/**
 * Raycast from the cursor to fetch the clicked ring.
 * Raycast results are cached, so this is surprisingly not slow.
 */
function getClickedRing() {	
	raycaster.setFromCamera(mouse.pos, camera);
	var result = raycaster.intersectObjects(scene.children);
	result = result.length > 0 && ringEnabledFlags[ringGraph.node(result[0].object.nodeID).geometryIndex] ? ringGraph.node(result[0].object.nodeID) : null;
	return result;
}

/**
 * Load static data from the server (wire sizes, weaves, etc.)
 */
function loadStaticData() {
	if(envSettings.useLocalData) {
		// Wire gauges
		var names = ["awg.json", "swg.json"]
		var wires = [];
		var reqs = [];
		$(names).each(function() {
			var name = this;
			reqs.push($.ajax({
				url: "/data/wire/" + name,
				success: function(wire) {
                    if(typeof wire === "string")
    					wire = JSON.parse(wire); 
					if(wire.name && wire.sizes) 
						wireGauges[wire.name] = wire;
				}
			}));
		});
		($.when.apply(this, reqs)).done(function() {
			setupRingDivs();
		});
		
		// Metals/materials
		$.ajax({
			url: "/data/wire/materials.json",
			success: function(data) {
				wireMaterials = typeof data === "string" ? JSON.parse(data) : data;
			}
		});
	
		// Weaves
		names = ["euro-4-in-1.json", "jap-6-in-1.json", "euro-6-in-1.json"];
		var weaves = [];
		reqs = [];
		$(names).each(function() {
			var name = this;
			reqs.push($.ajax({
				url: "/data/weave/" + name,
				success: function(weave) {
                    if(typeof weave === "string")
    					weave = JSON.parse(weave); 
					weaves.push({"name": weave.name, "file": name.replace(".json", "")});
				}
			}));
		});
		($.when.apply(this, reqs)).done(function() {
			var weaveList = $("#weave");
			weaves.sort(function(a, b) {return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;});
			weaveList.append("<option value=''>----</option>");
			for(var i = 0; i < weaves.length; i++) {
				var weave = weaves[i];
				weaveList.append("<option value='" + weave.file + "'>" + weave.name + "</option>");
			}
			start();
			
			// Load sheet data if a key is specified
			var split = window.location.pathname.split("/").filter(s => s);
			if(split.length > 1)
				key = split[1]
			if(key)
				loadSheetData(key);
		});
	}
	else {
		$.ajax({
			url: envSettings.host + "/data/getwires",
			dataType: "json",
			success: function(data) {
				for(var i = 0; i < data.length; i++) {
					var system = data[i];
					wireGauges[system.name] = system;
				}
				setupRingDivs();
				$.ajax({
					url: envSettings.host + "/data/getweaveslist",
					dataType: "json",
					success: function(data) {
						var weaveList = $("#weave");						
						data.sort(function(a, b) {return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;});
						weaveList.append("<option value=''>----</option>");
						for(var i = 0; i < data.length; i++) {
							var weave = data[i];
							weaveList.append("<option value='" + weave.file + "'>" + weave.name + "</option>");
						}
						weaveList.change();
					},
					error: function(data) {
						console.log(data);
					}
				});
			}
		});
	}
}

function loadSheetData(key) {
	// Suppress initial sheet creation
	geometryUpdates = new Set();
	
	// Load sheet data for given key
	var sheet;
	$.ajax({
		url: "/datastore/load",
		data: {key: key},
		success: function(data) {
			nodeIndex = 0;
			edgeRings = new Set();
			geometryUpdates = new Set();
			
			// Delete all children except camera and lights
			for(var i = scene.children.length - 1; i >= 0; i--) {
				if(!(scene.children[i] instanceof THREE.Camera) && !(scene.children[i] instanceof THREE.Light)) {
					scene.remove(scene.children[i]);
				}
			}
			
			data = JSON.parse(data);
			
			var parsedGraph = JSON.parse(data.Graph);
			for(var nodeID in parsedGraph._nodes) {
				var ring = new Ring(parsedGraph._nodes[nodeID]);
				ring.mesh.position.copy(parsedGraph._nodes[nodeID].position);
				ring.mesh.rotation.copy(parsedGraph._nodes[nodeID].rotation);
				ring.changeColor(parsedGraph._nodes[nodeID].color);
			}
			if(units !== data.Units) {
				units = data.Units;
				changeUnits();
			}
			for(var nodeID of data.EdgeRings) {
				edgeRings.add(ringGraph.node(nodeID));
			}
		},
		error: function(data) {
			console.log(data);
		}
	});
}

function Ring(params) {
	if(params.ringID) {
		var structureData = weave.structure[params.ringID];
		this.ringIndex = structureData.ring;
	}
	else if(params.ringIndex) {
		this.ringIndex = params.ringIndex;
	}
	
	var ringData = weave.rings[this.ringIndex];
	this.geometryIndex = ringData.geometry;
	this.mesh = new THREE.Mesh(baseGeometries[this.geometryIndex], baseMaterials[this.geometryIndex]);
	
	var r = this.mesh.geometry.parameters.radius;
	var R = this.mesh.geometry.parameters.tube / 2;
	
	if(params.ringID) {
		var full_radius = r + R;
		if(params.basePos)
			 this.mesh.position.copy(params.basePos);
		this.mesh.position.x += full_radius * structureData.pos.x;
		this.mesh.position.y += full_radius * structureData.pos.y;
		this.mesh.position.z = -50;
		this.mesh.position.z += full_radius * (structureData.pos.z ? structureData.pos.z : 0);
		
		var setQuaternion = false;
		if(params.ringID in structureRotations) {
			this.mesh.quaternion.copy(structureRotations[params.ringID]);
			setQuaternion = true;
		}
		if(ringRotations[this.ringIndex])
			if(setQuaternion)
				this.mesh.quaternion.multiply(ringRotations[this.ringIndex]);
			else
				this.mesh.quaternion.copy(ringRotations[this.ringIndex]);
	}
		
	this.mesh.material.transparent = !ringEnabledFlags[this.geometryIndex];
	this.mesh.material.opacity = ringEnabledFlags[this.geometryIndex] ? 1 : 0.5;
	
	this.updated = false;
	
	this.isInCamera = function(frustum) {
		if(!frustum) {
			frustum = new THREE.Frustum();
			camera.updateMatrixWorld(); 
			frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		}
		return frustum.intersectsObject(this.mesh);
	};
	
	this.toJSON = function() {
		var json = {};
		
		for(var prop in this) {
			// Don't bother serializing the mesh since it can't be deserialized
			if(prop === "mesh")
				continue;
			else if(typeof this[prop] === "string")
				json[prop] = this[prop];
			else if(typeof this[prop].toJSON === "function")
				json[prop] = this[prop].toJSON();
			else
				json[prop] = JSON.stringify(this[prop]);
		}
		
		json.color = "#" + this.mesh.material.color.getHexString();
		json.position = this.mesh.position;
		json.rotation = this.mesh.rotation;
		
		return json;
	};
	
	this.changeColor = function(color) {
		var oldColor = "#" + this.mesh.material.color.getHexString();
		// Revert to default
		if(!color) {
			this.mesh.material = baseMaterials[this.geometryIndex];
			var baseColor = "#" + this.mesh.material.color.getHexString();
			Ring.colorCounts[this.geometryIndex][oldColor]--;
			Ring.colorCounts[this.geometryIndex][baseColor]++;
		}
		// Color string
		else if(typeof color === "string") {
			// Add # if missing
			color = (color[0] !== "#" ? "#" : "") + color;
			
			this.mesh.material = getMaterial(color);
			Ring.colorCounts[this.geometryIndex][color]++;
			Ring.colorCounts[this.geometryIndex][oldColor]--;
		}
		// Color object
		else if(color instanceof THREE.Color) {
			this.changeColor(color.getHexString());
		}
		
		statsUpdate = true;
	};
	
	Object.defineProperties(this, {
		"volume": {
			// πr^2 * 2πR
			"get": function() {return Math.PI * r * r * 2 * Math.PI * R / (units === "mm" ? 1000000000 : 1) / (scale * scale * scale);}
		},
		"visible": {
			"set": function(visible) {
				this.mesh.visible = visible;
				
				Ring.colorCounts[this.geometryIndex]["#" + this.mesh.material.color.getHexString()] += (visible ? 1 : -1);
				statsUpdate = true;
			}
		}
	});
	
	scene.add(this.mesh);
	
	this.nodeIndex = nodeIndex;
	this.nodeID = "ring-" + nodeIndex;
	this.mesh.nodeID = this.nodeID;
	ringGraph.setNode(this.nodeID, this);
	nodeIndex++;
	
	Ring.colorCounts[this.geometryIndex]["#" + this.mesh.material.color.getHexString()]++;
	statsUpdate = true;
}

Ring.colorCounts = [];

/**
 * Link a base ring with the rest of the rings in a pattern chunk.
 * Searches for pre-existing rings and connects them before creating
 * any rings that do not exist yet.
 * Continues creating pattern chunks until they are out of camera view.
 */
function linkRings(currentRing, frustum) {
	// Stop once current ring is no longer visible on the canvas
	currentRing.mesh.updateMatrixWorld();
	// if(scene.children.length > 2048)
		// return;
	
	if(!currentRing.isInCamera(frustum)) {
		edgeRings.add(currentRing);
		return;
	}
	
	var ringID;
	var structure = weave.structure;
	var linkPaths = weave.linkPaths;
	// Get ID of base ring in pattern
	var baseID;
	for(ringID in structure) {
		if(structure[ringID].base) {
			baseID = ringID;
			break;
		}
	}
	if(!baseID)
		return;
	
	// Populate ring map with existing rings
	var rings = {"base": currentRing};
	var filter = function(edge) {return edge.name === as;};
	for(ringID in rings) {
		if(!("links" in structure[ringID]))
			continue;
		
		// Search for linked rings
		for(var i = 0; i < structure[ringID].links.length; i++) {
			var linkedRingID = structure[ringID].links[i];
			
			if(!linkedRingID)
				continue;
			
			var id = typeof linkedRingID === "object" ? linkedRingID.id : linkedRingID;
			var as = typeof linkedRingID === "object" ? linkedRingID.as : linkedRingID;

			// Add ring to map
			if(!(as in rings)) {
				var edges = ringGraph.outEdges(rings[ringID].nodeID).filter(filter);
				if(edges.length > 0) {
					var linkedRing = ringGraph.node(edges[0].w);
					rings[as] = linkedRing;
				}
			}
		}
	}
	
	// Find distant rings that are actually linked
	filter = function(edge) {return edge.name === path[i];};
	for(var linkID in linkPaths) {
		// Skip existing links
		if(linkID in rings) 
			continue;
		
		// Try each path to potential links
		for(var path of linkPaths[linkID]) {
			if(path.length === 0)
				continue;
			var validPath = true;
			var lastRing = currentRing;
			// Check each step in the path
			for(var i = 0; validPath && i < path.length; i++) {
				var edges = ringGraph.outEdges(lastRing.nodeID).filter(filter);
				validPath = validPath && edges.length > 0;
				if(validPath) {
					lastRing = ringGraph.node(edges[0].w);
				}
			}
			// Followed path to the end, establish link
			if(validPath) {
				ringGraph.setEdge(currentRing.nodeID, lastRing.nodeID, linkID, linkID);
				rings[linkID] = lastRing;
			}
		}
	}
	
	// Search for rings that need to be created
	var addedRings = [];
	for(ringID in structure) {
		// Ring missing from current set
		if(!(ringID in rings)) {
			var ring = new Ring({ringID: ringID, basePos: currentRing.mesh.position});
			rings[ringID] = ring;
			addedRings.push(ring);
		}
	}

	// Establish any missing links
	for(ringID in rings) {
		if(!("links" in structure[ringID]))
			continue;
			
		for(var i = 0; i < structure[ringID].links.length; i++) {
			var linkedRingID = structure[ringID].links[i];
			if(!linkedRingID)
				continue;
			var id = typeof linkedRingID === "object" ? linkedRingID.id : linkedRingID;
			var as = typeof linkedRingID === "object" ? linkedRingID.as : linkedRingID;
			// Found the ring that should be in links[i]
			if(id in rings && !ringGraph.hasEdge(rings[ringID].nodeID, rings[id].nodeID, as)) {
				// Add graph edge
				ringGraph.setEdge(rings[ringID].nodeID, rings[id].nodeID, as, as);
			}
		}
	}
	
	// Don't recurse if no new rings were added this pass
	if(addedRings.length === 0)
		return;
	
	edgeRings.delete(currentRing);
	
	// Find new base rings and recurse
	for(ringID in rings) {		
		var ringIndex = rings[ringID].ringIndex;
		if(ringID !== baseID && weave.rings[ringIndex].base) {
			var result = linkRings(rings[ringID], frustum);
			if(result && result.length > 0)
				addedRings = addedRings.concat(result);
		}
	}
	
	return addedRings;
}

/**
 * Create a ring sheet for the selected weave
 */
function createRings() {
	if(!weave || Object.keys(wireGauges).length === 0)
		return;
	
	var t0 = performance.now();
	
	for(var i = 0; i < weave.geometries.length; i++) {
		var radius = $("div#ring-div-" + i + " .inner-diameter").val() * scale / 2;
		var tube = getSelectedWireGauge(i) * scale;
		var color = $("div#ring-div-" + i).find(".default-color").val();
		baseGeometries[i] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
		baseMaterials[i] = new THREE.MeshPhongMaterial({color: color, specular: color, shininess: 60, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
		Ring.colorCounts[i][color] = 0;
	}
	// Ring-defined rotations (all around y axis)
	ringRotations = [];
	for(var i = 0; i < weave.rings.length; i++) {
		if(weave.rings[i].rotation) {
			ringRotations[i] = new THREE.Quaternion()
				.setFromAxisAngle(THREE.Vector3.y_axis, THREE.Math.degToRad(weave.rings[i].rotation));
		}
		else {
			ringRotations[i] = null;
		}
	}
	// Structure-defined rotations (any/all 3 axes)
	structureRotations = {};
	for(var ringID in weave.structure) {
		var structureData = weave.structure[ringID];
		if(structureData.rot) {
			var q = new THREE.Quaternion();
			
			if(structureData.rot.x)
				q.multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Vector3.x_axis, THREE.Math.degToRad(structureData.rot.x)));
			if(structureData.rot.y)
				q.multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Vector3.y_axis, THREE.Math.degToRad(structureData.rot.y)));
			if(structureData.rot.z) 
				q.multiply(new THREE.Quaternion().setFromAxisAngle(THREE.Vector3.z_axis, THREE.Math.degToRad(structureData.rot.z)));
			
			structureRotations[ringID] = q; 
		}
	}
	
	var currentRing = new Ring({ringID: "base"});
	
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();

	// Make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	linkRings(currentRing, frustum);
	
	if(envSettings.logPerformance) {
		console.log("children: " + scene.children.length);
		console.log("creation time: " + (performance.now() - t0).toFixed(2));
	}
	
	for(var i = 0; i < weave.geometries.length; i++) {
		updateRingStats(i);
	}
}

function updateGeometry(currentRing, geometryIndex) {
	if(currentRing.updated)
		return;
	
	if(!geometryIndex || currentRing.geometryIndex === geometryIndex) {	
		currentRing.mesh.geometry = baseGeometries[currentRing.geometryIndex];
		currentRing.mesh.geometry.dynamic = true;
		currentRing.mesh.geometry.verticesNeedUpdate = true;
	}
	
	currentRing.updated = true;
	
	var edges = ringGraph.outEdges(currentRing.nodeID);
	if(edges) {
		for(var i = 0; i < edges.length; i++) {
			updateGeometry(ringGraph.node(edges[i].w), geometryIndex);
		}
	}
}

/**
 * Update the geometry for a ring type and then tell three.js to redraw them
 */
function updateGeometries(geometryIndex) {
	if(!weave || Object.keys(wireGauges).length === 0)
		return;
	
	// No rings to update, create rings instead
	if(ringGraph === null || ringGraph.nodeCount() === 0) {
		createRings();
		return;
	}
	
	var t0 = performance.now();	
	
	var currentRing = ringGraph.node(ringGraph.nodes()[0]);

	if(baseGeometries[geometryIndex])
		baseGeometries[geometryIndex].dispose();
	var radius = $("div#ring-div-" + geometryIndex + " .inner-diameter").val() * scale / 2;
	var tube = getSelectedWireGauge(geometryIndex) * scale;
	baseGeometries[geometryIndex] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	
	updateGeometry(currentRing, geometryIndex);
	
	resetRingFlag(currentRing);
	
	
	var t1 = performance.now();
	if(envSettings.logPerformance) {
		console.log("children: " + scene.children.length);
		console.log("update geometry time: " + (t1 - t0).toFixed(2));
	}
}

function updatePosition(currentRing, ringID, basePos) {	
	if(currentRing.updated)
		return;
	
	var structureData = weave.structure[ringID];
	var full_radius = currentRing.mesh.geometry.parameters.radius + (currentRing.mesh.geometry.parameters.tube / 2);
	if(basePos)
		 currentRing.mesh.position.copy(basePos);
	currentRing.mesh.position.x += full_radius * structureData.pos.x;
	currentRing.mesh.position.y += full_radius * structureData.pos.y;
	currentRing.mesh.position.z = -50;
	currentRing.mesh.position.z += full_radius * (structureData.pos.z ? structureData.pos.z : 0);
	
	currentRing.updated = true;
	
	var edges = ringGraph.outEdges(currentRing.nodeID);
	if(edges) {
		for(var i = 0; i < edges.length; i++) {
			updatePosition(ringGraph.node(edges[i].w), edges[i].name, currentRing.mesh.position);
		}
	}
}

/**
 * Update the positions of all rings, fanning out from the center
 */
function updatePositions() {
	var currentRing = ringGraph.node(ringGraph.nodes()[0]);
	
	// Get ID of base ring in pattern
	var structure = weave.structure;
	var baseID;
	for(var ringID in structure) {
		if(structure[ringID].base) {
			baseID = ringID;
			break;
		}
	}
	if(!baseID)
		return;
	
	updatePosition(currentRing, "base");
	
	resetRingFlag(currentRing);
}

/**
 * Reset the rings' update flags after a recursive function
 */
function resetRingFlag(currentRing) {
	if(!currentRing.updated)
		return;
	
	currentRing.updated = false;
	
	var edges = ringGraph.outEdges(currentRing.nodeID);
	if(edges) {
		for(var i = 0; i < edges.length; i++) {
			resetRingFlag(ringGraph.node(edges[i].w));
		}
	}
}

/**
 * Set up the control divs for each type of ring in the weave
 */
function setupRingDivs() {
	$("div.ring-div").each(function() {
		var geometryIndex = $(this).data("geometry");
		
		$(this).prepend("<h4>Ring type #" + (geometryIndex + 1) + "</h4>");
		
		// Lock/unlock checkbox
		var ringEnable = $(this).find(".ring-enable").attr("id", "ring-enable-" + geometryIndex);
		ringEnable.next("label").attr("for", "ring-enable-" + geometryIndex).css("width", ringEnable.css("width")).css("height", ringEnable.css("height"));
		
		// Wire gauge system
		var wireGaugeSystem = $(this).find(".wire-gauge-system");
		var selected = "";
		var geometry = weave.geometries[geometryIndex];
		if(geometry.defaults && geometry.defaults.wireSystem) {
			selected = geometry.defaults.wireSystem;
		}
		for(var systemName in wireGauges) {
			var system = wireGauges[systemName];
			wireGaugeSystem.append("<option value='" + system.name + "'" + (system.name === selected ? "selected" : "") + ">" + system.name + "</option>");
		}
		wireGaugeSystem.data("value", wireGaugeSystem.val()).change();
		
		// Wire gauge
		var wireGauge = $(this).find(".wire-gauge");
		wireGauge.data("value", wireGauge.val());
		if(geometry.defaults && geometry.defaults.wireGauge) {
			wireGauge.val(geometry.defaults.wireGauge).change();
		}
		
		// Material
		var material = $(this).find(".wire-material");
		for(var key of Object.keys(wireMaterials).sort(function(a, b) {return a.localeCompare(b);})) {
			material.append("<option value='" + key + "'>" + key + "</option>");
		}
		
		// ID
		var innerDiameter = $(this).find(".inner-diameter");
		if(geometry.defaults && geometry.defaults.innerDiameter) {
			innerDiameter.val(geometry.defaults.innerDiameter);
		}
		
		// AR
		var aspectRatio = $(this).find(".aspect-ratio");
		var min = Math.max(geometry.minAR ? geometry.minAR : Number.NEGATIVE_INFINITY, innerDiameter.attr("min") / getSelectedWireGauge(geometryIndex));
		aspectRatio.attr("min", min);
		innerDiameter.attr("min", min * getSelectedWireGauge(geometryIndex));

		var max = Math.min(geometry.maxAR ? geometry.maxAR : Number.POSITIVE_INFINITY, innerDiameter.attr("max") / getSelectedWireGauge(geometryIndex));
		aspectRatio.attr("max", max);
		innerDiameter.attr("max", max * getSelectedWireGauge(geometryIndex));
		
		var options = {
			"minClass": "slider-min unit-field", 
			"maxClass": "slider-max unit-field", 
			"valueClass": "slider-value unit-field",
			"bubble": false
		};
		innerDiameter.boundedSlider(options);
		aspectRatio.boundedSlider(options);
		innerDiameter.val(Number(innerDiameter.val()).toFixed(2)).change();
		aspectRatio.change();
	});
}

/**
 * Get the selected wire gauge for a given ring type in the currently
 * selected units
 */
function getSelectedWireGauge(geometryIndex) {
	return wireGauges[$("div#ring-div-" + geometryIndex + " .wire-gauge-system").val()].sizes[$("div#ring-div-" + geometryIndex + " .wire-gauge").val()][units];
}

/**
 * Create the lists of wire gauge types and wire gauges for a given ring type
 */
function createWireGaugeList(geometryIndex, systemName) {
	var system = wireGauges[systemName];
	var gaugeList = $("div#ring-div-" + geometryIndex + " .wire-gauge");
	var selectedGauge = gaugeList.val();
	gaugeList.html("");
	for(var gauge in system.sizes) {
		gaugeList.append("<option value='" + gauge + "'" + (gauge === selectedGauge ? "selected" : "") + ">" + gauge + " - " + system.sizes[gauge][units] + " " + units + ".</option>");
	}
}

/**
 * Update the ID of a given ring type and enforce any mins/maxes
 * in the weave definition.
 */
function updateID(geometryIndex) {
	var ringDiv = $("div#ring-div-" + geometryIndex);
	var aspectRatio = ringDiv.find(".aspect-ratio");
	var innerDiameter = aspectRatio.val() * getSelectedWireGauge(geometryIndex);
	ringDiv.find(".inner-diameter").val(innerDiameter).trigger("update");
	positionUpdate = true;
}

/**
 * Update the AR of a given ring type and enforce any mins/maxes
 * in the weave definition.
 */
function updateAR(geometryIndex) {
	var ringDiv = $("div#ring-div-" + geometryIndex);
	var innerDiameter = ringDiv.find(".inner-diameter");
	var aspectRatio = innerDiameter.val() / getSelectedWireGauge(geometryIndex);
	var geometry = weave.geometries[geometryIndex];
	var min = Math.max(geometry.minAR ? geometry.minAR : Number.NEGATIVE_INFINITY, innerDiameter.attr("min") / getSelectedWireGauge(geometryIndex));
	var max = Math.min(geometry.maxAR ? geometry.maxAR : Number.POSITIVE_INFINITY, innerDiameter.attr("max") / getSelectedWireGauge(geometryIndex));
	// AR went below minimum
	if(aspectRatio < min) {
		aspectRatio = min;
		innerDiameter.val(aspectRatio * getSelectedWireGauge(geometryIndex)).change();
	}
	// AR went above maximum
	if(aspectRatio > max) {
		aspectRatio = max;
		innerDiameter.val(aspectRatio * getSelectedWireGauge(geometryIndex)).change();
	}
	ringDiv.find(".aspect-ratio").attr("min", min).attr("max", max).val(aspectRatio).trigger("update");
	positionUpdate = true;
}
	
/**
 * Grow the sheet out from the edges to cover the visible area
 */
function expandSheet() {
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();

	// Make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	for(var edgeRing of edgeRings) {
		linkRings(edgeRing, frustum);
	}
	
	statsUpdate = true;
}

/**
 * Perform initial setup after a weave is selected
 */
function setupWeave() {
	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 1000;
	camera.zoom = 1;
	camera.updateMatrixWorld(); 
	camera.updateProjectionMatrix();
	
	ringGraph = new graphlib.Graph({"directed": true, "multigraph": true});
	nodeIndex = 0;
	edgeRings = new Set();
	geometryUpdates = new Set();
	Ring.colorCounts = [];
	
	// Delete all children except camera and lights
	for(var i = scene.children.length - 1; i >= 0; i--) {
		if(!(scene.children[i] instanceof THREE.Camera) && !(scene.children[i] instanceof THREE.Light)) {
			scene.remove(scene.children[i]);
		}
	}
	
	ringEnabledFlags = [];
	// Parse coordinate values in case they are expressions
	var values = "values" in weave ? weave.values : {};
	for(var ringID in weave.structure) {
		for(var coord in weave.structure[ringID].pos) {
			weave.structure[ringID].pos[coord] = Parser.evaluate("" + weave.structure[ringID].pos[coord], values);
		}
		for(var coord in weave.structure[ringID].rot) {
			weave.structure[ringID].rot[coord] = Parser.evaluate("" + weave.structure[ringID].rot[coord], values);
		}
	}
	$("div.ring-div").remove();
	var outerDiv = $("div#ring-div-div");
	for(var i = 0; i < weave.geometries.length; i++) {
		outerDiv.append(ringDiv.clone(true).attr("id", "ring-div-" + i).data("geometry", i));
		ringEnabledFlags[i] = true;
		Ring.colorCounts[i] = {};
	}
	setupRingDivs();
	
	commandQueue = [];
	commandIndex = 0;
	updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
	if(commandQueue.length > 0 && commandIndex > 0) {
		$("#undo-button").removeClass("disabled").attr("disabled", false);
	}
	else {
		$("#undo-button").addClass("disabled").attr("disabled", true);
	}
	
	if(commandQueue.length > 0 && commandIndex < commandQueue.length) {
		$("#redo-button").removeClass("disabled").attr("disabled", false);
	}
	else {
		$("#redo-button").addClass("disabled").attr("disabled", true);
	}
}

function executeCommand(command) {
	command.execute();
	commandQueue[commandIndex] = command;
	commandIndex++;
	// Delete any commands that were ahead of this one in the queue
	if(commandQueue.length > commandIndex)
		commandQueue.splice(commandIndex, commandQueue.length - commandIndex);
	updateUndoRedoButtons();
}

function undo() {
	if(commandIndex <= 0)
		return;
	
	commandIndex--;
	commandQueue[commandIndex].undo();
	updateUndoRedoButtons();
}

function redo() {
	if(commandIndex >= commandQueue.length)
		return;
	
	commandQueue[commandIndex].execute();
	commandIndex++;
	updateUndoRedoButtons();
}

/**
 * Render the scene to an image for printing
 */
function print() {
	var zoom = camera.zoom;
	var lambertMaterials = {};
	
	// Switch rings over to a Lambert material for flat coloring
	for(var nodeID of ringGraph.nodes()) {
		var ring = ringGraph.node(nodeID);
		var color = "#" + ring.mesh.material.color.getHexString();
		console.log(color);
		
		if(!(color in lambertMaterials)) {
			lambertMaterials[color] = new THREE.MeshLambertMaterial({color: color});
		}
		
		ring.mesh.material = lambertMaterials[color];
	}
	
	// Create set of all rings not currently in camera
	var outOfCamera = new Set(edgeRings);
	for(var i = 0; i < 2; i++) {
		for(var ring of outOfCamera) {
			for(var edge of ringGraph.outEdges(ring.nodeID)) {
				outOfCamera.add(ringGraph.node(edge.w));
			}
		}
	}
	
	// Zoom out incrementally until all rings are in camera
	while(camera.zoom > 0.1 && outOfCamera.size > 0) {
		camera.zoom *= 0.9;
		camera.updateProjectionMatrix();
		
		var frustum = new THREE.Frustum();
		camera.updateMatrixWorld(); 
		frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		for(var ring of outOfCamera)
			if(ring.isInCamera(frustum))
				outOfCamera.delete(ring);
	}
	
	// Zoom out a bit more to make sure each entire ring is in camera
	camera.zoom *= 0.8;
	camera.updateProjectionMatrix();
	
	// Render zoomed-out scene
	renderer.render(scene, camera);
	var data = canvas.toDataURL();
	
	// Create window for print image
	var windowContent = '<!DOCTYPE html>';
    windowContent += '<html>';
    windowContent += '<head><title>Print canvas</title></head>';
    windowContent += '<body>';
    windowContent += '<img src="' + data + '">';
    windowContent += '</body>';
    windowContent += '</html>';
    var printWin = window.open('','','width=340,height=260');
    printWin.document.open();
    printWin.document.write(windowContent);
    printWin.document.close();
    printWin.focus();
    printWin.print();
    printWin.close();
	
	// Switch rings back to Phong materials
	for(var nodeID of ringGraph.nodes()) {
		var ring = ringGraph.node(nodeID);
		var color = "#" + ring.mesh.material.color.getHexString();
		
		ring.mesh.material = getMaterial(color);
	}
	
	// Restore camera zoom and re-render scene
	camera.zoom = zoom;
	camera.updateProjectionMatrix();
	renderer.render(scene, camera);
}

// Fetch a shared material or create it if it doesn't exist
function getMaterial(color) {
	if(!(color in materials)) {
		materials[color] = baseMaterials[0].clone();
		materials[color].color.setStyle(color);
		if(materials[color].specular)
			materials[color].specular.setStyle(color);
	}	
		
	// Add color to ring color counts
	for(var i = 0; i < weave.geometries.length; i++) {
		if(!(color in Ring.colorCounts[i]))
			Ring.colorCounts[i][color] = 0;
	}
	return materials[color];
}

function updateRingStats() {
	$("div.ring-div").each(function() {
		var geometryIndex = $(this).data("geometry");
		
		// Color counts
		var table = $(this).find("table.ring-stats-table tbody");
		var counts = Ring.colorCounts[geometryIndex];
		table.find("tr").remove();
		for(var key of Object.keys(counts).sort(function(a, b) {return counts[b] - counts[a];})) {
			// Stop once colors have zero rings
			if(Ring.colorCounts[geometryIndex][key] === 0)
				break;
			
			table.append("<tr><td class='ring-color-button-cell'><input type='color' class='ring-color-button' value='" + key + "'/></td><td class='ring-color-text-cell'>" + key + "</td><td class='ring-count-cell'>" + counts[key] + "</td></tr>");
		}
		
		// Weight
		var values;
		if(!Object.values) {
			values = [];
			for(var count of Ring.colorCounts[geometryIndex]) {
				values.push(count);
			}
		}
		else {
			values = Object.values(Ring.colorCounts[geometryIndex]);
		}
		var numRings = values.reduce(function(a, b) {return a + b;});
		var sampleRing;
		var nodes = ringGraph.nodes();
		for(var i = 0; !sampleRing && i < nodes.length; i++) {
			if(ringGraph.node(nodes[i]).geometryIndex === geometryIndex)
				sampleRing = ringGraph.node(nodes[i]);
		}			
		var volume = sampleRing.volume * numRings;
		var material = $(this).find(".wire-material").val();
		var weight = wireMaterials[material][units] * volume;
		$(this).find(".weight-span").html(weight.toFixed(2) + " " + (units === "mm" ? "kg." : "lbs."));
	});
}

function changeUnits() {
	if(units === "in") {
		$("input.unit-field").each(function() {
			$(this).val(($(this).val() / 25.4).toFixed(2));
			$(this).attr("min", $(this).attr("min") / 25.4);
			$(this).attr("max", $(this).attr("max") / 25.4);
		});
		scale *= 25.4;
	}
	else {
		$("input.unit-field").each(function() {
			$(this).val(($(this).val() * 25.4).toFixed(2));
			$(this).attr("min", $(this).attr("min") * 25.4);
			$(this).attr("max", $(this).attr("max") * 25.4);
		});
		scale /= 25.4;
	}
	$("div.ring-div").each(function() {
		createWireGaugeList($(this).data("geometry"), $(this).find(".wire-gauge-system").val());
	});	
	statsUpdate = true;	
}

$(document).ready(function() {
	ringDiv = $("div.ring-div");
	ringDiv.remove();
	
	canvas = document.getElementById("canvas");
	
	var canvasPos = $(canvas).position();
	
	if(canvas.getContext("webgl") === null) {
		$("body").html("<p>WebGL is required to diplay e-maille. Try updating your graphics card drivers.</p>");
		return;
	}

	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true
	});
	
	var controlPanel = $("div#control-panel");
	var width = ($(window).width() - controlPanel.width() - controlPanel.css("margin-left").replace("px", "")) * 0.975;
	var height = width * 9 / 16;
	
	controlPanel.css("max-height", $(window).height());

	renderer.setSize(width, height);

	scene = new THREE.Scene();
	
	scene.background = new THREE.Color("white");

	camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 10000);
	camera.position.z = 50;
	camera.minZoom = 1 / 3;
	camera.maxZoom = 2;
	scene.add(camera);
	
	var zoomInput = $("#zoom-input");
	zoomInput.attr("min", camera.minZoom).attr("max", camera.maxZoom).val(camera.zoom);

	var light = new THREE.DirectionalLight(0xffffff, 1.0);
	light.position.set(0, 0, 1);

	scene.add(light);
	
	window.onresize = function(e) {
		var width = ($(window).width() - $("div#control-panel").width() - $("div#control-panel").css("margin-left").replace("px", "")) * 0.975;
		var height = width * 9 / 16;

		renderer.setSize(width, height);
		camera.left = width / -2;
		camera.right = width / 2;
		camera.top = height / 2;
		camera.bottom = height / -2;
		camera.updateProjectionMatrix();
		expandSheet();
	};

	canvas.onmousedown = function(e) {
		e.preventDefault();
		mouse.down = true;
		var command = tool.onMouseDown();
		if(command) {
			executeCommand(command);
		}
	};
	//canvas.ontouchstart = canvas.onmousedown;
	canvas.onmouseup = function(e) {
		e.preventDefault();
		mouse.down = false;
		var command = tool.onMouseUp();
		if(command) {
			executeCommand(command);
		}
	};
	//canvas.ontouchend = canvas.onmouseup;
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.pos.x = ((e.pageX - canvasPos.left) / canvas.width) * 2 - 1;
		mouse.pos.y = -((e.pageY - canvasPos.top) / canvas.height) * 2 + 1;
		var command = tool.onMouseMove();
		if(command) {
			executeCommand(command);
		}
	};
	//canvas.ontouchmove = canvas.onmousemove;
	canvas.onmouseleave = (function() {
		mouse.down = false;
		tool.onMouseUp();
	});
	canvas.oncontextmenu = function(e) {
		e.preventDefault();
//		tool.onMouseDown();
	};
	canvas.onwheel = function(e) {
		e.preventDefault();
		// wheelDelta is +/- 120, so scale that by a factor of 6
		camera.zoom = Math.clamp(camera.zoom + (e.wheelDelta / 720), camera.minZoom, camera.maxZoom);
		camera.updateProjectionMatrix();
		expandSheet();
		zoomInput.val(camera.zoom);
	};
	
	zoomInput.on("input", function() {
		camera.zoom = Math.clamp($(this).val(), camera.minZoom, camera.maxZoom);
		camera.updateProjectionMatrix();
		expandSheet();
	});
	
	var scrollZoom = function(e) {
		e.preventDefault();
		// wheelDelta is +/- 120, so scale that by a factor of 6
		zoomInput.val(Math.clamp(camera.zoom + (e.originalEvent.wheelDelta / 720), camera.minZoom, camera.maxZoom));
		zoomInput.trigger("input");
	};
	
	zoomInput.on("mouseenter", function() {
		zoomInput.on("mousewheel", scrollZoom);
	});
	zoomInput.on("mouseleave", function() {
		zoomInput.off("mousewheel", scrollZoom);
	});
	
	document.onkeydown = function(e) {
		if(e.altKey && e.key === "Alt") {
			if(!(tool instanceof Move) && !mouse.down) {
				previousTool = $(tool).data("button-id");
				$("#move-button").click();
			}
			else {
				e.preventDefault();
			}
		}
	};
	
	document.onkeyup = function(e) {
		if(e.ctrlKey) {
			if(e.key === "z")
				undo();
			else if(e.key === "y")
				redo();
		}
		else if(e.key === "Alt") {
			if(previousTool) {
				$("#" + previousTool).click();
			}
			else {
				e.preventDefault();		
			}
			
			previousTool = null;
		}
		else if(!(e.ctrlKey || e.shiftKey || e.altKey)) {
			if(e.key === "b") {
				$("#brush-button").click();
			}
			else if(e.key === "m") {
				$("#move-button").click();
			}
			else if(e.key === "e") {
				$("#eraser-button").click();
			}
			else if(e.key === "p") {
				e.preventDefault();
				print();
			}
			else if(e.key === "x") {
				$("#cut-button").click();
			}
			else if(e.key === "a") {
				$("#add-button").click();
			}
		}
	};
	
	$("#undo-button").click(function() {
		undo();
	});
	
	$("#redo-button").click(function() {
		redo();
	});
	
	$("#print-button").click(function() {
		print();
	});
	
	$("#brush-button").click(function() {
		if(!(tool instanceof Brush))
			tool = new Brush();
	});
	
	$("#eraser-button").click(function() {
		if(!(tool instanceof Eraser)) 
			tool = new Eraser();
	});
	
	$("#move-button").click(function() {
		if(!(tool instanceof Move)) 
			tool = new Move();
	});
	
	$("#cut-button").click(function() {
		if(!(tool instanceof Cut)) 
			tool = new Cut();
	});
	
	$("#add-button").click(function() {
		if(!(tool instanceof Add)) 
			tool = new Add();
	});
	
	$("button.tool-button").click(function() {
		$("button.tool-button").removeClass("selected");
		$(this).addClass("selected");
		$(".sub-tool-div").css("display", "none").removeClass("selected");
		$("#" + $(this).attr("id") + "-sub-tool-div").addClass("selected").css("display", "");
		$("#sub-tool-div-div").css("display", $(".sub-tool-div.selected").length > 0 ? "" : "none");
		$(canvas).css("cursor", tool.cursor ? tool.cursor : "default");
		$(tool).data("button-id", $(this).attr("id"));
	});
	
	$("#brush-button").click();
	
	$(document).on("change", ".wire-gauge-system", function() {
		var ringDiv = $(this).closest("div.ring-div");
		createWireGaugeList(ringDiv.data("geometry"), $(this).val());
		ringDiv.find(".wire-gauge").change();
		// $(this).data("value", $(this).val());
	});
	
	$(document).on("change", ".wire-gauge", function() {
		var ringDiv = $(this).closest("div.ring-div");
		$(this).val($(this).val());
		updateAR(ringDiv.data("geometry"));
		geometryUpdates.add(ringDiv.data("geometry"));
		ringDiv.find(".aspect-ratio").change();
	});
	
	$(document).on("change", ".default-color", function() {
		var ringDiv = $(this).closest("div.ring-div");
		baseMaterials[ringDiv.data("geometry")].color.setStyle($(this).val());
		if(baseMaterials[ringDiv.data("geometry")].specular)
			baseMaterials[ringDiv.data("geometry")].specular.setStyle($(this).val());
	});
	
	// Weave change: basically recreate the entire thing
	$(document).on("change", "#weave", function(e) {
		if(!$(this).val()) {
			e.preventDefault();
			return;
		}
		
		$.ajax({
			url: envSettings.useLocalData ? "/data/weave/" + $(this).val() + ".json" : envSettings.host + "/data/getweave?name=" + $(this).val(),
			dataType: "json",
			success: function(data) {
				weave = data;
				setupWeave();
			}
		});
	});
	
	$(document).on("change", ".inner-diameter, .aspect-ratio", function() {
		if($(this).data("value")) {
			var elem = $(this);
			var ringDiv = $(this).closest("div.ring-div");
			var oldValue = $(this).data("value");
			var newValue = $(this).val();
			var wireGaugeSystem = ringDiv.find(".wire-gauge-system");
			var oldWireGaugeSystemValue = wireGaugeSystem.data("value");
			var newWireGaugeSystemValue = wireGaugeSystem.val();
			var wireGauge = ringDiv.find(".wire-gauge");
			var oldWireGaugeValue = wireGauge.data("value");
			var newWireGaugeValue = wireGauge.val();
			executeCommand({
				execute: function() {
					if(elem.val() !== newValue) {
						if(wireGaugeSystem.val() !== newWireGaugeSystemValue)
							wireGaugeSystem.val(newWireGaugeSystemValue).change();
						if(wireGauge.val() !== newWireGaugeValue)
							wireGauge.val(newWireGaugeValue);
						elem.val(newValue);
						updateAR(ringDiv.data("geometry"));
					}
				},
				undo: function() {
					if(elem.val() !== oldValue) {
						if(wireGaugeSystem.val() !== oldWireGaugeSystemValue)
							wireGaugeSystem.val(oldWireGaugeSystemValue).change();
						if(wireGauge.val() !== oldWireGaugeValue)
							wireGauge.val(oldWireGaugeValue);
						elem.val(oldValue);
						updateAR(ringDiv.data("geometry"));
					}
				}
			});
		}
		$(this).data("value", $(this).val());
	});
	
	$(document).on("input", ".inner-diameter", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		geometryUpdates.add(ringDiv.data("geometry"));
	});	
	
	$(document).on("input", ".aspect-ratio", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateID(ringDiv.data("geometry"));
		geometryUpdates.add(ringDiv.data("geometry"));
	});
	
	$(document).on("change", ".wire-material", function() {
		statsUpdate = true;
	});
	
	// Switch unit-based inputs between in. and mm.
	$(document).on("change", "input[name='units'][type='radio']", function() {
		units = $(this).val();
		changeUnits();	
	});
	
	// Enable/disable rings
	$(document).on("change", ".ring-enable", function() {
		var ringDiv = $(this).closest("div.ring-div");
		var checked = $(this).prop("checked");
		ringEnabledFlags[ringDiv.data("geometry")] = checked;
		for(var nodeID of ringGraph.nodes()) {
			if(ringGraph.node(nodeID).geometryIndex === ringDiv.data("geometry")) {
				// ringGraph.node(nodeID).mesh.material.blending = $(this).prop("checked") ? THREE.NormalBlending : THREE.CustomBlending;
				ringGraph.node(nodeID).mesh.material.transparent = !checked;
				ringGraph.node(nodeID).mesh.material.opacity = checked ? 1 : 0.5;
			}
		}
		$(this).next("label").removeClass(checked ? "fa-lock" : "fa-unlock").addClass(checked ? "fa-unlock" : "fa-lock");
	});
	
	$(document).on("click", "input.ring-color-button", function(e) {
		e.preventDefault();
		$("input#ring-color").val($(this).val());
	});
	
	$("#save-button").click(function(e) {
		e.preventDefault();
		$.post("/datastore/save", {
			graph: JSON.stringify(ringGraph),
			weave: weave.name,
			units: units,
			edgeRings: JSON.stringify(Array.from(edgeRings, function(ring) {return ring.nodeID;})),
            key: key ? key : ""
		}, function(data) {
			console.log(data);
            if(!window.location.pathname.endsWith(data))
    			window.location.pathname += data
		});
	});
	
	loadStaticData();

	run();
});
