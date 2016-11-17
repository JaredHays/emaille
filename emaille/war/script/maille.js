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

var geometries = [];
var materials = [];
var baseMaterial = new THREE.MeshStandardMaterial({color: "magenta"});
var ringEnabledFlags;

var head = null;

var scale = 100;
var radialSegments = 8;
var tubularSegments = 64;

var raycaster = new THREE.Raycaster();

var ringDiv;

var updates = new Set();

var ringGraph;
var nodeIndex;
var edgeRings;

var mouse = {
	down: false,
	pos: new THREE.Vector2()
};
var tool;

Math.clamp = function(num, min, max) {
  return Math.min(Math.max(num, min), max);
};

function run() {
	for(var geometryIndex of updates) {
		updateRings(geometryIndex);
	}
	updates.clear();
	
	requestAnimationFrame(run);

	renderer.render(scene, camera);
}

function getClickedRing() {
	var t0 = performance.now();	
	raycaster.setFromCamera(mouse.pos, camera);
	var result = raycaster.intersectObjects(scene.children);
	result = result.length > 0 && ringEnabledFlags[ringGraph.node(result[0].object.nodeID).geometryIndex] ? result[0].object : null;
	console.log("raycast time: " + (performance.now() - t0).toFixed(2));
	return result;
}

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
	this.mesh = new THREE.Mesh(geometries[this.geometryIndex], materials[this.geometryIndex].clone());
	var full_radius = this.mesh.geometry.parameters.radius + (this.mesh.geometry.parameters.tube / 2);
	if(basePos)
		 this.mesh.position.copy(basePos);
	this.mesh.position.x += full_radius * structureData.pos.x;
	this.mesh.position.y += full_radius * structureData.pos.y;
	this.mesh.position.z = -50;
	this.mesh.position.z += full_radius * (structureData.pos.z ? structureData.pos.z : 0);
	if(structureData.rot) {
		if(structureData.rot.x)
			this.mesh.rotateX(THREE.Math.degToRad(structureData.rot.x));
		if(structureData.rot.y)
			this.mesh.rotateY(THREE.Math.degToRad(structureData.rot.y));
		if(structureData.rot.z) 
			this.mesh.rotateZ(THREE.Math.degToRad(structureData.rot.z));
	}
	this.mesh.rotateY(THREE.Math.degToRad(ringData.rotation));
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

var linkTime = 0;
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
				var edges = ringGraph.outEdges(rings[ringID].nodeID).filter(function(edge) {return edge.name === as;});
				if(edges.length > 0) {
					var linkedRing = ringGraph.node(edges[0].w);
					rings[as] = linkedRing;
				}
			}
		}
	}
		
	// Find distant rings that are actually linked
	var t0 = performance.now();
	for(var linkID in linkPaths) {
		// Skip existing links
		if(linkID in rings) 
			continue;
		
		// Try each path to potential links
		for(var path of linkPaths[linkID]) {
			if(path.length == 0)
				continue;
			var validPath = true;
			var lastRing = currentRing;
			// Check each step in the path
			for(var i = 0; validPath && i < path.length; i++) {
				var edges = ringGraph.outEdges(lastRing.nodeID).filter(function(edge) {return edge.name === path[i];});
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
	linkTime += (performance.now() - t0);
	
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

function createRings() {
	if(!weave || Object.keys(wireGauges).length === 0)
		return;
	
	var t0 = performance.now();
	
	for(var i = 0; i < weave.geometries.length; i++) {
		var radius = $("div#ring-div-" + i + " .inner-diameter").val() * scale / 2;
		var tube = getSelectedWireGauge(i)[units] * scale;
		geometries[i] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
		materials[i] = new THREE.MeshStandardMaterial({color: $("div#ring-div-" + i).find(".default-color").val()});
	}
	
	var currentRing = new Ring("base");
	
	head = currentRing;
	
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();

	// Make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	linkTime = 0;
	linkRings(currentRing, frustum);
	
	var t1 = performance.now();
	console.log("children: " + scene.children.length);
	console.log("link time: " + linkTime.toFixed(2));
	console.log("creation time: " + (t1 - t0).toFixed(2));
}

function updateRing(currentRing, geometryIndex) {
	if(currentRing.updated)
		return;
	
	if(!geometryIndex || currentRing.geometryIndex === geometryIndex) {	
		currentRing.mesh.geometry = geometries[currentRing.geometryIndex];
		currentRing.mesh.geometry.dynamic = true;
		currentRing.mesh.geometry.verticesNeedUpdate = true;
	}
	
	currentRing.updated = true;
	
	var edges = ringGraph.outEdges(currentRing.nodeID);
	if(edges) {
		for(var i = 0; i < edges.length; i++) {
			updateRing(ringGraph.node(edges[i].w), geometryIndex);
		}
	}
}

function updateRings(geometryIndex) {
	if(!weave || Object.keys(wireGauges).length === 0)
		return;
	
	// No rings to update, create rings instead
	if(head === null) {
		createRings();
		return;
	}
	
	var t0 = performance.now();	
	
	var currentRing = head;

	if(geometries[geometryIndex])
		geometries[geometryIndex].dispose();
	var radius = $("div#ring-div-" + geometryIndex + " .inner-diameter").val() * scale / 2;
	var tube = getSelectedWireGauge(geometryIndex)[units] * scale;
	geometries[geometryIndex] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	
	updateRing(currentRing, geometryIndex);
	
	resetRingFlag(currentRing);
	
	console.log("children: " + scene.children.length);
	
	var t1 = performance.now();
	console.log("update time: " + (t1 - t0).toFixed(2));
}

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

function setupRingDivs() {
	$("div.ring-div").each(function() {
		// Wire gauge system
		var wireGaugeSystem = $(this).find(".wire-gauge-system");
		var selected = "";
		var geometryIndex = $(this).data("geometry");
		if(weave.geometries[geometryIndex].defaults && weave.geometries[geometryIndex].defaults.wireSystem) {
			selected = weave.geometries[geometryIndex].defaults.wireSystem;
		}
		for(var systemName in wireGauges) {
			var system = wireGauges[systemName];
			wireGaugeSystem.append("<option value='" + system.name + "'" + (system.name === selected ? "selected" : "") + ">" + system.name + "</option>");
		}
		wireGaugeSystem.change();
		
		// Wire gauge
		if(weave.geometries[geometryIndex].defaults && weave.geometries[geometryIndex].defaults.wireGauge) {
			$(this).find(".wire-gauge").val(weave.geometries[geometryIndex].defaults.wireGauge).change();
		}
		
		// ID
		var innerDiameter = $(this).find(".inner-diameter");
		if(weave.geometries[geometryIndex].defaults && weave.geometries[geometryIndex].defaults.innerDiameter) {
			innerDiameter.val(weave.geometries[geometryIndex].defaults.innerDiameter);
		}
		innerDiameter.val((innerDiameter.val() * 1).toFixed(2)).change();
	});
}

function getSelectedWireGauge(geometryIndex) {
	return wireGauges[$(".wire-gauge-system").val()].sizes[$("div#ring-div-" + geometryIndex + " .wire-gauge").val()];
}

function createWireGaugeList(geometryIndex, systemName) {
	var system = wireGauges[systemName];
	var gaugeList = $("div#ring-div-" + geometryIndex + " .wire-gauge");
	var selectedGauge = gaugeList.val();
	gaugeList.html("");
	for(var gauge in system.sizes) {
		gaugeList.append("<option value='" + gauge + "'" + (gauge === selectedGauge ? "selected" : "") + ">" + gauge + " - " + system.sizes[gauge][units] + " " + units + ".</option>");
	}
}

function updateAR(geometryIndex) {
	var ringDiv = $("div#ring-div-" + geometryIndex);
	ringDiv.find(".aspect-ratio").val((ringDiv.find(".inner-diameter").val() / getSelectedWireGauge(geometryIndex)[units]).toFixed(3));
}
	
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

function setupWeave() {
	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 50;
	camera.zoom = 1;
	camera.updateMatrixWorld(); 
	camera.updateProjectionMatrix();
	
	ringGraph = new graphlib.Graph({"directed": true, "multigraph": true});
	nodeIndex = 0;
	edgeRings = new Set();
	updates = new Set();
	
	// Keep children 0, 1, and 2: camera and lights
	// TODO: store those somewhere instead of using indexes
	for(var i = scene.children.length - 1; i > 2; i--) {
		scene.remove(scene.children[i]);
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
		// updates.add(i);
	}
	setupRingDivs();
	// createRings();
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

	camera = new THREE.OrthographicCamera(canvas.clientWidth / -2, canvas.clientWidth / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
	camera.position.z = 50;
	camera.minZoom = 1 / 3;
	camera.maxZoom = 2;
	scene.add(camera);

	var light = new THREE.DirectionalLight(0xffffff, 1.5);
	light.position.set(0, 0, 1);

	scene.add(light);
	scene.add(new THREE.AmbientLight(0xf0f0f0, 0.25));

	canvas.onmousedown = function(e) {
		e.preventDefault();
		mouse.down = true;
		tool.onMouseDown();
	};
	canvas.onmouseup = function(e) {
		e.preventDefault();
		mouse.down = false;
		tool.onMouseUp();
	};
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.pos.x = ((e.pageX - canvasPos.left) / canvas.width) * 2 - 1;
		mouse.pos.y = -((e.pageY - canvasPos.top) / canvas.height) * 2 + 1;
		tool.onMouseMove();
	};
	canvas.oncontextmenu = function(e) {
		e.preventDefault();
//		tool.onMouseDown();
	};
	canvas.onwheel = function(e) {
		e.preventDefault();
		// wheelDelta is +/- 120, so scale that by a factor of 6
		camera.zoom = Math.clamp(camera.zoom + (e.wheelDelta / 720), camera.minZoom, camera.maxZoom);
		// console.log(camera.zoom);
		camera.updateProjectionMatrix();
		expandSheet();
	};
	
	$("#ring-color").change(function() {
		ringColor = $(this).val();
	});
	$("#ring-color").change();
	
	$("#brush-button").click(function() {
		if(!(tool instanceof Brush))
			tool = new Brush();
	});
	
	$("#move-button").click(function() {
		if(!(tool instanceof Move)) 
			tool = new Move();
	});
	
	$("button.tool-button").click(function() {
		$("button.tool-button").removeClass("selected");
		$(this).addClass("selected");
	});
	$("#move-button").click();
	
	$(document).on("change", ".wire-gauge-system", function() {
		var ringDiv = $(this).closest("div.ring-div");
		createWireGaugeList(ringDiv.data("geometry"), $(this).val());
		ringDiv.find(".wire-gauge").change();
	});
	
	$(document).on("change", ".wire-gauge", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		updates.add(ringDiv.data("geometry"));
	});
	
	$(document).on("change", ".default-color", function() {
		var ringDiv = $(this).closest("div.ring-div");
		var oldColor = materials[ringDiv.data("geometry")].color;
		var newColor = new THREE.Color($(this).val());
		materials[ringDiv.data("geometry")].color = newColor;
		for(var nodeID of ringGraph.nodes()) {
			if(ringGraph.node(nodeID).geometryIndex === ringDiv.data("geometry") && ringGraph.node(nodeID).mesh.material.color.getHex() === oldColor.getHex()) {
				ringGraph.node(nodeID).mesh.material.color = newColor;
			}
		}
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
	
	$(document).on("change", ".inner-diameter", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		updates.add(ringDiv.data("geometry"));
	});
	
	$(document).on("change", ".aspect-ratio", function() {
		var ringDiv = $(this).closest("div.ring-div");
		ringDiv.find(".inner-diameter").val($(this).val() * getSelectedWireGauge()[units]);
		updates.add(ringDiv.data("geometry"));
	});
	
	// Switch unit-based inputs between in. and mm.
	$(document).on("change", "input[name='units'][type='radio']", function() {
		units = $(this).val();
		if(units === "in") {
			$("input.unit-field").each(function() {
				$(this).val(($(this).val() / 25.4).toFixed(2));
			});
			scale *= 25.4;
		}
		else {
			$("input.unit-field").each(function() {
				$(this).val(($(this).val() * 25.4).toFixed(2));
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
