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
var weaves = {};

var weave = null;

var geometries = [];
var baseMaterial = new THREE.MeshStandardMaterial({color: "magenta"});

var rows = 10;
var cols = 10;

var rings = [];
var head = null;

var scale = 100;
// var radius = 0.1 * scale;
// var tube = 10;
var radialSegments = 16;
var tubularSegments = 100;

var duration = 5000; // ms
var currentTime = Date.now();

var raycaster = new THREE.Raycaster();

var ringDiv;

var mouse = {
	down: false,
	pos: new THREE.Vector2()
};
var tool = new Brush();

function run() {
	requestAnimationFrame(function() {
		run();
	});

	renderer.render(scene, camera);

	// animate();
}

function getClickedRing() {
	raycaster.setFromCamera(mouse.pos, camera);
	var result = raycaster.intersectObjects(scene.children);
	if (result.length > 0) {
		return result[0].object;
	}
	else
		return null;
}

function loadStaticData() {
	var data;
	// $.ajax({
		// url: "https://e-maille.appspot.com/data/getwires",
		// dataType: "json",
		// success: function(data) {
			// var systemList = $("#wire-gauge-system");
			// for(var i = 0; i < data.length; i++) {
				// var system = data[i];
				// wireGauges[system.name] = system;
				// systemList.append("<option value='" + system.name + "'>" + system.name + "</option>");
			// }
			// systemList.change();
		// }
	// });
	// $.ajax({
		// url: "https://e-maille.appspot.com/data/getweaves",
		// dataType: "json",
		// success: function(data) {
			// weaves = data;
		// }
	// });
	
	data = [{
		"name": "AWG",
		"sizes": {
			"12": {
				"mm": 2.05232,
				"in": 0.0808
			},
			"13": {
				"mm": 1.82753,
				"in": 0.07196
			},
			"14": {
				"mm": 1.62712,
				"in": 0.06406
			},
			"15": {
				"mm": 1.44932,
				"in": 0.05706
			},
			"16": {
				"mm": 1.29083,
				"in": 0.05082
			},
			"17": {
				"mm": 1.14935,
				"in": 0.04525
			},
			"18": {
				"mm": 1.02362,
				"in": 0.04030
			},
			"19": {
				"mm": 0.91161,
				"in": 0.03589
			},
			"20": {
				"mm": 0.78892,
				"in": 0.03106
			},
			"21": {
				"mm": 0.72288,
				"in": 0.02846
			},
			"22": {
				"mm": 0.64364,
				"in": 0.02534
			},
			"23": {
				"mm": 0.57328,
				"in": 0.02257
			},
			"24": {
				"mm": 0.51054,
				"in": 0.02010
			}
		}
	},{
		"name": "SWG",
		"sizes": {
			"14": {
				"mm": 2.03200,
				"in": 0.08000
			},
			"15": {
				"mm": 1.82280,
				"in": 0.07200
			},
			"16": {
				"mm": 1.62712,
				"in": 0.06406
			},
			"17": {
				"mm": 1.42240,
				"in": 0.05600
			},
			"18": {
				"mm": 1.21920,
				"in": 0.04800
			},
			"19": {
				"mm": 1.01600,
				"in": 0.04000
			},
			"20": {
				"mm": 0.91440,
				"in": 0.03600
			},
			"21": {
				"mm": 0.81280,
				"in": 0.03200
			},
			"22": {
				"mm": 0.71120,
				"in": 0.02800
			},
			"23": {
				"mm": 0.60960,
				"in": 0.02400
			},
			"24": {
				"mm": 0.55880,
				"in": 0.02200
			},
			"25": {
				"mm": 0.50800,
				"in": 0.02000
			}
		}
	}];
	
	for(var i = 0; i < data.length; i++) {
		var system = data[i];
		wireGauges[system.name] = system;
	}
	setupWireGaugeLists();
	
	data = [
		{
			"name": "European 4-in-1",
			"geometries": [
				{
					"min": 2.9
				}
			],
			"rings": [
				{
					"geometry": 0,
					"rotation": -36,
					"links": 4,
					"base": true
				},
				{
					"geometry": 0,
					"rotation": 36,
					"links": 4
				}
			],
			"structure": {
				"base": {
					"id": "base",
					"base": true,
					"ring": 0,
					"pos": {"x": 0, "y": 0},
					"links": [
						"top-left",
						"top-right",
						"bottom-right",
						"bottom-left"
					]
				},
				"top-left": {
					"id": "top-left",
					"ring": 1,
					"pos": {"x": -0.7, "y": 1.1},
					"links": [
						null,
						"top",
						"base",
						"left"
					]
				},
				"top-right": {
					"id": "top-right",
					"ring": 1,
					"pos": {"x": 0.4, "y": 1.1},
					"links": [
						"top",
						null,
						"right",
						"base"
					]
				},
				"bottom-right": {
					"id": "bottom-right",
					"ring": 1,
					"pos": {"x": 0.4, "y": -1.1},
					"links": [
						"base",
						"right",
						null,
						"bottom"
					]
				},
				"bottom-left": {
					"id": "bottom-left",
					"ring": 1,
					"pos": {"x": -0.7, "y": -1.1},
					"links": [
						"left",
						"base",
						"bottom",
						null
					]
				},
				"left": {
					"id": "left",
					"ring": 0,
					"pos": {"x": -1.1, "y": 0},
					"links": [
						null,
						"top-left",
						"bottom-left",
						null
					]
				},
				"right": {
					"id": "right",
					"ring": 0,
					"pos": {"x": 1.1, "y": 0},
					"links": [
						"top-right",
						null,
						null,
						"bottom-right"
					]
				},
				"top": {
					"id": "top",
					"ring": 0,
					"pos": {"x": 0, "y": 2.2},
					"links": [
						null,
						null,
						"top-right",
						"top-left"
					]
				},
				"bottom": {
					"id": "bottom",
					"ring": 0,
					"pos": {"x": 0, "y": -2.2},
					"links": [
						"bottom-left",
						"bottom-right",
						null,
						null
					]
				}
			}
		},
		{
			"name": "Japanese 6-in-1",
			"geometries": [
				{
					"min": 2.9
				},
				{
					"min": 2.9
				}
			],
			"rings": [
				{
					"geometry": 0,
					"rotation": 0,
					"links": 6,
					"base": true
				},
				{
					"geometry": 1,
					"rotation": 90,
					"links": 2
				}
			],
			"structure": {
				"base": {
					"base": true,
					"ring": 0,
					"pos": {"x": 0, "y": 0},
					"links": [
						"small-0",
						"small-1",
						"small-2",
						"small-3",
						"small-4",
						"small-5"
					]
				},
				"small-0": {
					"ring": 1,
					"pos": {"x": 0, "y": 1.1, "z": 0.5},
					"links": [
						"base",
						"large-0"
					]
				},
				"small-1": {
					"ring": 1,
					"pos": {"x": 0.95, "y": 0.55, "z": 0.5},
					"rot": {"z": -30},
					"links": [
						"base",
						"large-1"
					]
				},
				"small-2": {
					"ring": 1,
					"pos": {"x": 0.95, "y": -0.55, "z": 0.5},
					"rot": {"z": 30},
					"links": [
						"base",
						"large-2"
					]
				},
				"small-3": {
					"ring": 1,
					"pos": {"x": 0, "y": -1.1, "z": 0.5},
					"rot": {"z": 0},
					"links": [
						"base",
						"large-3"
					]
				},
				"small-4": {
					"ring": 1,
					"pos": {"x": -0.95, "y": -0.55, "z": 0.5},
					"rot": {"z": -30},
					"links": [
						"base",
						"large-4"
					]
				},
				"small-5": {
					"ring": 1,
					"pos": {"x": -0.95, "y": 0.55, "z": 0.5},
					"rot": {"z": 30},
					"links": [
						"base",
						"large-5"
					]
				},
				"large-0": {
					"ring": 0,
					"pos": {"x": 0, "y": 2.2},
					"links": [
						null,
						null,
						null,
						"small-0",
						null,
						null
					]
				},
				"large-1": {
					"ring": 0,
					"pos": {"x": 1.9, "y": 1.1},
					"rot": {"z": -30},
					"links": [
						null,
						null,
						null,
						null,
						"small-1",
						null
					]
				},
				"large-2": {
					"ring": 0,
					"pos": {"x": 1.9, "y": -1.1},
					"rot": {"z": 30},
					"links": [
						null,
						null,
						null,
						null,
						null,
						"small-2"
					]
				},
				"large-3": {
					"ring": 0,
					"pos": {"x": 0, "y": -2.2},
					"rot": {"z": 0},
					"links": [
						"small-3",
						null,
						null,
						null,
						null,
						null
					]
				},
				"large-4": {
					"ring": 0,
					"pos": {"x": -1.9, "y": -1.1},
					"rot": {"z": -30},
					"links": [
						null,
						"small-4",
						null,
						null,
						null,
						null
					]
				},
				"large-5": {
					"ring": 0,
					"pos": {"x": -1.9, "y": 1.1},
					"rot": {"z": 30},
					"links": [
						null,
						null,
						"small-5",
						null,
						null,
						null
					]
				}
			}
		}
	];
	
	data = [
		{
			"name": "European 4-in-1",
			"file": "euro-4-in-1"
		},
		{
			"name": "Japanese 6-in-1",
			"file": "jap-6-in-1"
		}
	]
	var weaveList = $("#weave");
	for(var i = 0; i < data.length; i++) {
		var weave = data[i];
		// weaves[weave.name] = weave;
		weaveList.append("<option value='" + weave.file + "'>" + weave.name + "</option>");
	}
	weaveList.change();
	
}

function setupWireGaugeLists() {
	$(".wire-gauge-system").each(function() {
		for(var systemName in wireGauges) {
			var system = wireGauges[systemName];
			$(this).append("<option value='" + system.name + "'>" + system.name + "</option>");
		}
		$(this).change();
	});
}

function Ring(ringID, basePos) {
	var structureData = weave["structure"][ringID];
	this.ringIndex = structureData["ring"];
	var ringData = weave["rings"][this.ringIndex];
	this.geometryIndex = ringData["geometry"];
	this.mesh = new THREE.Mesh(geometries[this.geometryIndex], baseMaterial.clone());
	var full_radius = this.mesh.geometry.parameters.radius + (this.mesh.geometry.parameters.tube / 2);
	if(structureData.rot) {
		if(structureData.rot.x)
			this.mesh.rotateX(THREE.Math.degToRad(structureData.rot.x));
		if(structureData.rot.y)
			this.mesh.rotateY(THREE.Math.degToRad(structureData.rot.y));
		if(structureData.rot.z) 
			this.mesh.rotateZ(THREE.Math.degToRad(structureData.rot.z));
	}
	this.mesh.rotateY(THREE.Math.degToRad(ringData.rotation));
	if(basePos)
		 this.mesh.position.copy(basePos);
	this.mesh.position.x += full_radius * structureData.pos.x;
	this.mesh.position.y += full_radius * structureData.pos.y;
	this.mesh.position.z = -50;
	this.mesh.position.z += full_radius * (structureData.pos.z ? structureData.pos.z : 0);
	this.updated = false;
	this.links = new Array(ringData.links);	
	this.ringID = ringID;
	
	this.isInCamera = function(frustum) {
		if(!frustum) {
			frustum = new THREE.Frustum();
			camera.updateMatrixWorld(); 
			frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		}
		return frustum.intersectsObject(this.mesh);
	};
	
	scene.add(this.mesh);
}

function linkRings(currentRing, frustum) {
	// Stop once current ring is no longer visible on the canvas
	currentRing.mesh.updateMatrixWorld();
	if(!currentRing.isInCamera(frustum) || scene.children.length > 25) {
		return;
	}
	
	var structure = weave["structure"];
	// Get ID of base ring in pattern
	var baseID;
	for(var ringID in structure) {
		if(structure[ringID].base) {
			baseID = ringID;
			break;
		}
	}
	if(!baseID)
		return;
	currentRing.ringID = baseID;
	
	// Populate ring map with existing rings
	var rings = {"base": currentRing};
	var addedNewRing = true;
	while(addedNewRing) {
		addedNewRing = false;
		for(var ringID in rings) {
			console.log("ring: " + ringID);
			for(var i = 0; i < rings[ringID].links.length; i++) {
				var linkedRing = rings[ringID].links[i];
				if(linkedRing) {
					// Update ring ID for current base
					linkedRing.ringID = structure[ringID]["links"][i];
					// Add ring to map
					if(linkedRing.ringID && !(linkedRing.ringID in rings)) {
						rings[linkedRing.ringID] = linkedRing;
						addedNewRing = true;
						console.log("adding ring: " + linkedRing.ringID);
					}
				}
			}
		}
	} 
	// Establish any missing links
	for(var ringID in rings) {
		for(var i = 0; i < rings[ringID].links.length; i++) {
			var linkedRingID = structure[ringID]["links"][i];
			// Found the ring that should be in links[i]
			if(!rings[ringID].links[i] && linkedRingID in rings) {
				rings[ringID].links[i] = rings[linkedRingID];
			}
		}
	}
	
	addedNewRing = false;
	
	// Search for rings that need to be created
	for(var ringID in structure) {
		// Ring missing from current set
		if(!(ringID in rings)) {
			var ring = new Ring(ringID, currentRing.mesh.position);
			rings[ringID] = ring;
			addedNewRing = true;
		}
	}
	// Establish any missing links
	for(var ringID in rings) {
		for(var i = 0; i < rings[ringID].links.length; i++) {
			var linkedRingID = structure[ringID]["links"][i];
			// Found the ring that should be in links[i]
			if(!rings[ringID].links[i] && linkedRingID in rings) {
				rings[ringID].links[i] = rings[linkedRingID];
			}
		}
	}
	
	// Don't recurse if no new rings were added this pass
	if(!addedNewRing)
		return;
	
	// Find new base rings and recurse
	for(var ringID in rings) {		
		var ringIndex = structure[ringID]["ring"];
		if(ringID != baseID && weave["rings"][ringIndex].base) {
			linkRings(rings[ringID], frustum);
		}
	}
}

function createRings() {
	if(!weave || Object.keys(wireGauges).length == 0)
		return;
	
	var t0 = performance.now();
	
	// Keep children 0, 1, and 2: camera and lights
	// TODO: store those somewhere instead of using indexes
	for(var i = scene.children.length - 1; i > 2; i--) {
		scene.remove(scene.children[i]);
	}
	
	for(var i = 0; i < weave.geometries.length; i++) {
		var radius = $("div#ring-div-" + i + " .inner-diameter").val() * scale / 2;
		var tube = getSelectedWireGauge(i)[units] * scale;
		geometries[i] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	}
	
	var currentRing = new Ring("base");
	
	head = currentRing;
	
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();

	// make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	linkRings(currentRing, frustum, 0);
	
	console.log(scene.children.length);
	
	var t1 = performance.now();
	console.log(t1 - t0);
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
	
	for(var i = 0; i < currentRing.links.length; i++) {
		if(currentRing.links[i])
			updateRing(currentRing.links[i]);
	}
}

function updateRings(geometryIndex) {
	if(!weave || Object.keys(wireGauges).length == 0)
		return;
	
	// No rings to update, create rings
	if(head == null) {
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
	
	console.log(scene.children.length);
	
	var t1 = performance.now();
	console.log(t1 - t0);
}

function resetRingFlag(currentRing) {
	if(!currentRing.updated)
		return;
	
	currentRing.updated = false;
	
	for(var i = 0; i < currentRing.links.length; i++) {
		if(currentRing.links[i])
			resetRingFlag(currentRing.links[i]);
	}
}

function getSelectedWireGauge(geometryIndex) {
	return wireGauges[$(".wire-gauge-system").val()]["sizes"][$("div#ring-div-" + geometryIndex + " .wire-gauge").val()];
}

function createWireGaugeList(geometryIndex, systemName) {
	var system = wireGauges[systemName];
	var gaugeList = $("div#ring-div-" + geometryIndex + " .wire-gauge");
	var selectedGauge = gaugeList.val();
	gaugeList.html("");
	for(var gauge in system["sizes"]) {
		gaugeList.append("<option value='" + gauge + "'" + (gauge == selectedGauge ? "selected" : "") + ">" + gauge + " - " + system["sizes"][gauge][units] + " " + units + ".</option>");
	}
}

function updateAR(geometryIndex) {
	$("div#ring-div-" + geometryIndex + " .aspect-ratio").val($("div#ring-div-" + geometryIndex + " .inner-diameter").val() / getSelectedWireGauge(geometryIndex)[units]);
}

$(document).ready(function() {
	ringDiv = $("div.ring-div");
	ringDiv.remove();
	
	canvas = document.getElementById("canvas");
	var canvasPos = $(canvas).position();
	
	ringColor = $("#ring-color");

	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true
	});

	renderer.setSize(canvas.width, canvas.height);

	scene = new THREE.Scene();

	camera = new THREE.OrthographicCamera(canvas.width / -2, canvas.width / 2, canvas.height / 2, canvas.height / -2, 1, 1000);
	camera.position.z = 50;
	scene.add(camera);

	var light = new THREE.DirectionalLight(0xffffff, 1.5);
	light.position.set(0, 0, 1);

	scene.add(light);
	scene.add(new THREE.AmbientLight(0xf0f0f0, 0.25));

	canvas.onmousedown = function(e) {
		e.preventDefault();
		mouse.down = true;
		tool.onMouseDown();
	}
	canvas.onmouseup = function(e) {
		e.preventDefault();
		mouse.down = false;
		tool.onMouseUp();
	}
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.pos.x = ((e.pageX - canvasPos.left) / canvas.width) * 2 - 1;
		mouse.pos.y = -((e.pageY - canvasPos.top) / canvas.height) * 2 + 1;
		tool.onMouseMove();
	}
	canvas.oncontextmenu = function(e) {
		e.preventDefault();
//		tool.onMouseDown();
	}
	
	ringColor.change(function() {
		
	});
	
	$(document).on("change", ".wire-gauge-system", function() {
		var ringDiv = $(this).closest("div.ring-div");
		createWireGaugeList(ringDiv.data("geometry"), $(this).val());
		ringDiv.find(".wire-gauge").change();
	});
	
	$(document).on("change", ".wire-gauge", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		updateRings(ringDiv.data("geometry"));
	});
	
	$(document).on("change", "#weave", function() {
		// weave = weaves[$(this).val()];
		
		$.ajax({
			url: "https://e-maille.appspot.com/data/getweave?name=" + $(this).val(),
			dataType: "json",
			success: function(data) {
				weave = data;
				$("div.ring-div").remove();
				var outerDiv = $("div#ring-div-div");
				for(var i = 0; i < weave.geometries.length; i++) {
					outerDiv.append(ringDiv.clone(true).attr("id", "ring-div-" + i).data("geometry", i));
				}
				setupWireGaugeLists();
				createRings();
			}
		});
	});
	
	$(document).on("change", ".inner-diameter", function() {
		var ringDiv = $(this).closest("div.ring-div");
		updateAR(ringDiv.data("geometry"));
		updateRings(ringDiv.data("geometry"));
	});
	
	$(document).on("change", ".aspect-ratio", function() {
		var ringDiv = $(this).closest("div.ring-div");
		ringDiv.find(".inner-diameter").val($(this).val() * getSelectedWireGauge()[units]);
		updateRings(ringDiv.data("geometry"));
	});
	
	// Switch unit-based inputs between in. and mm.
	$(document).on("change", "input[name='units'][type='radio']", function() {
		units = $(this).val();
		if(units === "in") {
			$("input.unit-field").each(function() {
				$(this).val($(this).val() / 25.4);
			});
			scale *= 25.4;
		}
		else {
			$("input.unit-field").each(function() {
				$(this).val($(this).val() * 25.4);
			});
			scale /= 25.4;
		}
		createWireGaugeList($("#wire-gauge-system").val());
	});
	
	loadStaticData();
	

	run();
});
