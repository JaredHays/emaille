/*jshint esversion: 6 */

/*
 * TODO:
 * 1. Quality slider
 * 2. Auto quality?
 * 3. Print
 * 4. Sizes and ring counts
 * 5. Undo
 */

var renderer = null;
var scene = null;
var camera = null;
var canvas = null;
var ringColor = null;

var units = "in";

var wireGauges = {};

var weave = null;

var baseGeometries = [];
var baseMaterials = [];
var materials = {};
var ringEnabledFlags;

var ringRotations;
var structureRotations;

var head = null;

var scale = 100;
var radialSegments = 8;
var tubularSegments = 64;

var raycaster = new THREE.Raycaster();

var ringDiv;

var geometryUpdates = new Set();
var positionUpdate = false;

var ringGraph;
var nodeIndex;
var edgeRings;

var mouse = {
	down: false,
	pos: new THREE.Vector2()
};
var tool;

var commandQueue;
var commandIndex;

var logPerformance = true;

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
	
	requestAnimationFrame(run);

	renderer.render(scene, camera);
}

/**
 * Raycast from the cursor to fetch the clicked ring.
 * Raycast results are cached, so this is surprisingly not slow.
 */
function getClickedRing() {
	// var t0 = performance.now();	
	raycaster.setFromCamera(mouse.pos, camera);
	var result = raycaster.intersectObjects(scene.children);
	result = result.length > 0 && ringEnabledFlags[ringGraph.node(result[0].object.nodeID).geometryIndex] ? ringGraph.node(result[0].object.nodeID) : null;
	// console.log("raycast time: " + (performance.now() - t0).toFixed(2));
	return result;
}

/**
 * Load static data from the server (wire sizes, weaves, etc.)
 */
function loadStaticData() {
	$.ajax({
		url: "https://e-maille.appspot.com/data/getwires",
		dataType: "json",
		success: function(data) {
			for(var i = 0; i < data.length; i++) {
				var system = data[i];
				wireGauges[system.name] = system;
			}
			setupRingDivs();
			$.ajax({
				url: "https://e-maille.appspot.com/data/getweaveslist",
				dataType: "json",
				success: function(data) {
					var weaveList = $("#weave");
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

function Ring(ringID, basePos) {
	var structureData = weave.structure[ringID];
	this.ringIndex = structureData.ring;
	var ringData = weave.rings[this.ringIndex];
	this.geometryIndex = ringData.geometry;
	this.mesh = new THREE.Mesh(baseGeometries[this.geometryIndex], baseMaterials[this.geometryIndex]);
	var full_radius = this.mesh.geometry.parameters.radius + (this.mesh.geometry.parameters.tube / 2);
	if(basePos)
		 this.mesh.position.copy(basePos);
	this.mesh.position.x += full_radius * structureData.pos.x;
	this.mesh.position.y += full_radius * structureData.pos.y;
	this.mesh.position.z = -50;
	this.mesh.position.z += full_radius * (structureData.pos.z ? structureData.pos.z : 0);
	
	var setQuaternion = false;
	if(ringID in structureRotations) {
		this.mesh.quaternion.copy(structureRotations[ringID]);
		setQuaternion = true;
	}
	if(ringRotations[this.ringIndex])
		if(setQuaternion)
			this.mesh.quaternion.multiply(ringRotations[this.ringIndex]);
		else
			this.mesh.quaternion.copy(ringRotations[this.ringIndex]);
		
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
	
	scene.add(this.mesh);
	
	this.nodeIndex = nodeIndex;
	this.nodeID = "ring-" + nodeIndex;
	this.mesh.nodeID = this.nodeID;
	ringGraph.setNode(this.nodeID, this);
	nodeIndex++;
}

var linkTime;
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
	var addedNewRing = false;
	for(ringID in structure) {
		// Ring missing from current set
		if(!(ringID in rings)) {
			var ring = new Ring(ringID, currentRing.mesh.position);
			rings[ringID] = ring;
			addedNewRing = true;
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
	if(!addedNewRing)
		return;
	
	edgeRings.delete(currentRing);
	
	// Find new base rings and recurse
	for(ringID in rings) {		
		var ringIndex = rings[ringID].ringIndex;
		if(ringID !== baseID && weave.rings[ringIndex].base) {
			linkRings(rings[ringID], frustum);
		}
	}
	
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
		baseGeometries[i] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
		baseMaterials[i] = new THREE.MeshPhongMaterial({color: $("div#ring-div-" + i).find(".default-color").val(), specular: 0xffffff, shininess: 60});
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
	
	var currentRing = new Ring("base");
	
	head = currentRing;
	
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();

	// Make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	linkRings(currentRing, frustum);
	
	if(logPerformance) {
		console.log("children: " + scene.children.length);
		console.log("creation time: " + (performance.now() - t0).toFixed(2));
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
	if(head === null) {
		createRings();
		return;
	}
	
	var t0 = performance.now();	
	
	var currentRing = head;

	if(baseGeometries[geometryIndex])
		baseGeometries[geometryIndex].dispose();
	var radius = $("div#ring-div-" + geometryIndex + " .inner-diameter").val() * scale / 2;
	var tube = getSelectedWireGauge(geometryIndex) * scale;
	baseGeometries[geometryIndex] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	
	updateGeometry(currentRing, geometryIndex);
	
	resetRingFlag(currentRing);
	
	
	var t1 = performance.now();
	if(logPerformance) {
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
	var currentRing = head;
	
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
		// Wire gauge system
		var wireGaugeSystem = $(this).find(".wire-gauge-system");
		var selected = "";
		var geometryIndex = $(this).data("geometry");
		var geometry = weave.geometries[geometryIndex];
		if(geometry.defaults && geometry.defaults.wireSystem) {
			selected = geometry.defaults.wireSystem;
		}
		for(var systemName in wireGauges) {
			var system = wireGauges[systemName];
			wireGaugeSystem.append("<option value='" + system.name + "'" + (system.name === selected ? "selected" : "") + ">" + system.name + "</option>");
		}
		wireGaugeSystem.change();
		
		// Wire gauge
		if(geometry.defaults && geometry.defaults.wireGauge) {
			$(this).find(".wire-gauge").val(geometry.defaults.wireGauge).change();
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
			"valueClass": "slider-value unit-field"};
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
	return wireGauges[$(".wire-gauge-system").val()].sizes[$("div#ring-div-" + geometryIndex + " .wire-gauge").val()][units];
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
	
	commandQueue = [];
	commandIndex = 0;
	
	ringGraph = new graphlib.Graph({"directed": true, "multigraph": true});
	nodeIndex = 0;
	edgeRings = new Set();
	geometryUpdates = new Set();
	
	// Delete all children except camera and lights
	for(var i = scene.children.length - 1; i >= 0; i--) {
		if(!(scene.children[i] instanceof THREE.Camera) && !(scene.children[i] instanceof THREE.Light)) {
			scene.remove(scene.children[i]);
		}
	}
	
	head = null;
	
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
	}
	setupRingDivs();
}

function executeCommand(command) {
	command.execute();
	commandQueue[commandIndex] = command;
	commandIndex++;
	// Delete any commands that were ahead of this one in the queue
	if(commandQueue.length > commandIndex)
		commandQueue.splice(commandIndex, commandQueue.length - commandIndex);
}

function undo() {
	if(commandIndex <= 0)
		return;
	
	commandIndex--;
	commandQueue[commandIndex].undo();
}

function redo() {
	if(commandIndex >= commandQueue.length)
		return;
	
	commandQueue[commandIndex].execute();
	commandIndex++;
}

$(document).ready(function() {
	ringDiv = $("div.ring-div");
	ringDiv.remove();
	
	canvas = document.getElementById("canvas");
	
	var canvasPos = $(canvas).position();

	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true
	});

	renderer.setSize(canvas.clientWidth, canvas.height);

	scene = new THREE.Scene();

	camera = new THREE.OrthographicCamera(canvas.clientWidth / -2, canvas.clientWidth / 2, canvas.height / 2, canvas.height / -2, 1, 10000);
	camera.position.z = 50;
	camera.minZoom = 1 / 3;
	camera.maxZoom = 2;
	scene.add(camera);

	var light = new THREE.DirectionalLight(0xffffff, 1.0);
	light.position.set(0, 0, 1);

	scene.add(light);

	canvas.onmousedown = function(e) {
		e.preventDefault();
		mouse.down = true;
		var command = tool.onMouseDown();
		if(command) {
			executeCommand(command);
		}
	};
	canvas.onmouseup = function(e) {
		e.preventDefault();
		mouse.down = false;
		var command = tool.onMouseUp();
		if(command) {
			executeCommand(command);
		}
	
		// console.log(JSON.stringify(ringGraph.nodes().reduce(function(o, v, i) {
			// o[i] = ringGraph.node(v);
			// return o;
		// }, {})));
	};
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.pos.x = ((e.pageX - canvasPos.left) / canvas.width) * 2 - 1;
		mouse.pos.y = -((e.pageY - canvasPos.top) / canvas.height) * 2 + 1;
		var command = tool.onMouseMove();
		if(command) {
			executeCommand(command);
		}
	};
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
	};
	
	document.onkeyup = function(e) {
		if(e.ctrlKey) {
			if(e.key === "z")
				undo();
			else if(e.key === "y")
				redo();
		}
	};
	
	// $(canvas).focusout(function() {
		// mouse.down = false;
		// tool.onMouseUp();
	// });
	
	$("#ring-color").change(function() {
		ringColor = $(this).val();
	});
	$("#ring-color").change();
	
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
	
	$("button.tool-button").click(function() {
		$("button.tool-button").removeClass("selected");
		$(this).addClass("selected");
	});
	$("#brush-button").click();
	
	$(document).on("change", ".wire-gauge-system", function() {
		var ringDiv = $(this).closest("div.ring-div");
		createWireGaugeList(ringDiv.data("geometry"), $(this).val());
		ringDiv.find(".wire-gauge").change();
	});
	
	$(document).on("change", ".wire-gauge", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		geometryUpdates.add(ringDiv.data("geometry"));
		ringDiv.find(".aspect-ratio").change();
	});
	
	$(document).on("change", ".default-color", function() {
		var ringDiv = $(this).closest("div.ring-div");
		baseMaterials[ringDiv.data("geometry")].color.setStyle($(this).val());
	});
	
	// Weave change: basically recreate the entire thing
	$(document).on("change", "#weave", function() {
		// $.ajax({
			// url: "https://e-maille.appspot.com/data/getweave?name=" + $(this).val(),
			// dataType: "json",
			// success: function(data) {
				// weave = data;
				weave = weaves[$(this).val()];
				setupWeave();
			// }
		// });
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
	
	// Switch unit-based inputs between in. and mm.
	$(document).on("change", "input[name='units'][type='radio']", function() {
		units = $(this).val();
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
	});
	
	// Enable/disable rings
	$(document).on("change", ".ring-enable", function() {
		var ringDiv = $(this).closest("div.ring-div");
		ringEnabledFlags[ringDiv.data("geometry")] = $(this).prop("checked");
		for(var nodeID of ringGraph.nodes()) {
			if(ringGraph.node(nodeID).geometryIndex === ringDiv.data("geometry")) {
				// ringGraph.node(nodeID).mesh.material.blending = $(this).prop("checked") ? THREE.NormalBlending : THREE.CustomBlending;
				ringGraph.node(nodeID).mesh.material.transparent = !$(this).prop("checked");
				ringGraph.node(nodeID).mesh.material.opacity = $(this).prop("checked") ? 1 : 0.5;
				// ringGraph.node(nodeID).mesh.material.needsUpdate = true;
			}
		}
	});
	
	loadStaticData();	

	run();
});
