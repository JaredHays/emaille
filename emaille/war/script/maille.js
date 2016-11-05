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
var radius = 0.1 * scale;
var tube = 10;
var radialSegments = 16;
var tubularSegments = 100;

var duration = 5000; // ms
var currentTime = Date.now();

var raycaster = new THREE.Raycaster();

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
	var data = [{
		"name": "European 4-in-1",
		"sizes": [
			{
				"min": 2.9
			}
		],
		"rings": [
			{
				"size": 0,
				"rotation": -36,
				"links": 4,
				"base": true
			},
			{
				"size": 0,
				"rotation": 36,
				"links": 4
			}
		],
		"structure": {
			"base": {
				"id": "base",
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
	}];
	
	var weaveList = $("#weave");
	for(var i = 0; i < data.length; i++) {
		var weave = data[i];
		weaves[weave.name] = weave;
		weaveList.append("<option value='" + weave.name + "'>" + weave.name + "</option>");
	}
	weaveList.change();
	
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
	var systemList = $("#wire-gauge-system");
	for(var i = 0; i < data.length; i++) {
		var system = data[i];
		wireGauges[system.name] = system;
		systemList.append("<option value='" + system.name + "'>" + system.name + "</option>");
	}
	systemList.change();
}

function Ring(ringID, basePos) {
	this.ringIndex = weave["structure"][ringID]["ring"];
	var ringData = weave["rings"][this.ringIndex];
	this.mesh = new THREE.Mesh(geometries[ringData["size"]], baseMaterial.clone());
	var full_radius = this.mesh.geometry.parameters.radius + (this.mesh.geometry.parameters.tube / 2);
	if(basePos)
		 this.mesh.position.copy(basePos);
	this.mesh.position.x += full_radius * weave["structure"][ringID]["pos"].x;
	this.mesh.position.y += full_radius * weave["structure"][ringID]["pos"].y;
	this.mesh.position.z = -50;
	this.mesh.rotation.y = THREE.Math.degToRad(weave["rings"][this.ringIndex]["rotation"]);
	this.updated = false;
	this.links = new Array(weave["rings"][this.ringIndex]["links"]);	
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
	if(!currentRing.isInCamera(frustum)) {
		return;
	}
	
	var structure = weave["structure"];
	// TODO: refactor out "base"
	var baseID = "base";
	currentRing.ringID = baseID;
	
	// Populate ring map with existing rings
	var rings = {"base": currentRing};
	var addedNewRing = true;
	while(addedNewRing) {
		addedNewRing = false;
		for(var ringID in rings) {
			for(var i = 0; i < rings[ringID].links.length; i++) {
				var linkedRing = rings[ringID].links[i];
				if(linkedRing) {
					// Update ring ID for current base
					linkedRing.ringID = structure[ringID]["links"][i];
					// Add ring to map
					if(linkedRing.ringID && !(linkedRing.ringID in rings)) {
						rings[linkedRing.ringID] = linkedRing;
						addedNewRing = true;
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
	var t0 = performance.now();
	
	// Keep children 0, 1, and 2: camera and lights
	// TODO: store those somewhere instead of using indexes
	for(var i = scene.children.length - 1; i > 2; i--) {
		scene.remove(scene.children[i]);
	}
	
	var oldRadius = radius;
	var oldTube = tube;
	radius = $("#inner-diameter").val() * scale / 2;
	tube = getSelectedWireGauge()[units] * scale;
	if(oldRadius === radius && oldTube === tube)
		return;
	
	var full_radius = radius + (tube / 2);
	var base_x = 0;
	var base_y = 0;
	var x = base_x;
	var y = base_y;
	
	for(var i = 0; i < weave["sizes"].length; i++) {
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

function updateRing(currentRing) {
	if(currentRing.updated)
		return;
	
	currentRing.mesh.geometry = geometries[weave["rings"][currentRing.ringIndex]["size"]];
	currentRing.mesh.geometry.dynamic = true;
	currentRing.mesh.geometry.verticesNeedUpdate = true;
	
	currentRing.updated = true;
	
	for(var i = 0; i < currentRing.links.length; i++) {
		if(currentRing.links[i])
			updateRing(currentRing.links[i]);
	}
}

function updateRings() {
	// No rings to update, create rings
	if(head == null) {
		createRings();
		return;
	}
	
	var currentRing = head;
	var oldRadius = radius;
	var oldTube = tube;
	radius = $("#inner-diameter").val() * scale / 2;
	tube = getSelectedWireGauge()[units] * scale;
	if(oldRadius === radius && oldTube === tube)
		return;
	
	var full_radius = radius + (tube / 2);
	var base_x = 0;
	var base_y = 0;
	var x = base_x;
	var y = base_y;

	
	for(var i = 0; i < weave["sizes"].length; i++) {
		if(geometries[i])
			geometries[i].dispose();
		geometries[i] = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	}
	
	updateRing(currentRing);
	
	resetRingFlag(currentRing);
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

function getSelectedWireGauge() {
	return wireGauges[$("#wire-gauge-system").val()]["sizes"][$("#wire-gauge").val()];
}

function createWireGaugeList(systemName) {
	var system = wireGauges[systemName];
	var gaugeList = $("#wire-gauge");
	var selectedGauge = gaugeList.val();
	gaugeList.html("");
	for(var gauge in system["sizes"]) {
		gaugeList.append("<option value='" + gauge + "'" + (gauge == selectedGauge ? "selected" : "") + ">" + gauge + " - " + system["sizes"][gauge][units] + " " + units + ".</option>");
	}
}

function updateAR() {
	$("#aspect-ratio").val($("#inner-diameter").val() / getSelectedWireGauge()[units]);
}

$(document).ready(function() {
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
	
	$("#wire-gauge-system").change(function() {
		createWireGaugeList($(this).val());
		$("#wire-gauge").change();
	});
	
	$("#wire-gauge").change(function() {
		updateAR();
		updateRings();
	});
	
	$("#weave").change(function() {
		weave = weaves[$(this).val()];
	});
	
	$("#inner-diameter").change(function() {
		updateAR();
		updateRings();
	});
	
	$("#aspect-ratio").change(function() {
		$("#inner-diameter").val($(this).val() * getSelectedWireGauge()[units]);
		updateRings();
	});
	
	// Switch unit-based inputs between in. and mm.
	$("input[name='units'][type='radio']").change(function() {
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
