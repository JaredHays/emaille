/*
 * TODO:
 * 1. Quality slider
 * 2. Auto quality?
 * 3. Print
 */

var renderer = null;
var scene = null;
var camera = null;
var canvas = null;
var ringColor = null;

var units = "in";

var wireGauges = {};
var weaves = {};

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
	weaves = [{
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
		"structure": [
			{
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
			{
				"id": "top-left",
				"ring": 1,
				"pos": {"x": -0.7, "y": 1.1},
				"links": [
					null,
					null,
					"base",
					"left"
				]
			},
			{
				"id": "top-right",
				"ring": 1,
				"pos": {"x": 0.4, "y": 1.1},
				"links": [
					null,
					null,
					"right",
					"base"
				]
			},
			{
				"id": "bottom-right",
				"ring": 1,
				"pos": {"x": 0.4, "y": -1.1},
				"links": [
					"base",
					"right",
					null,
					null
				]
			},
			{
				"id": "bottom-left",
				"ring": 1,
				"pos": {"x": -0.7, "y": -1.1},
				"links": [
					"left",
					"base",
					null,
					null
				]
			},
			{
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
			{
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
			{
				"id": "top",
				"ring": 0,
				"pos": {"x": 0, "y": 1.1},
				"links": [
					null,
					null,
					"top-right",
					"top-left"
				]
			},
			{
				"id": "bottom",
				"ring": 0,
				"pos": {"x": 0, "y": -1.1},
				"links": [
					"bottom-left",
					"bottom-right",
					null,
					null
				]
			}
		]
	}];
	var systemList = $("#wire-gauge-system");
	for(var i = 0; i < data.length; i++) {
		var system = data[i];
		wireGauges[system.name] = system;
		systemList.append("<option value='" + system.name + "'>" + system.name + "</option>");
	}
	systemList.change();
}

function createRing(baseGeometry, baseMaterial) {
	var ring = {};
	ring.mesh = new THREE.Mesh(baseGeometry, baseMaterial.clone());
	ring.mesh.position.z = -50;
	ring.updated = false;
	ring.links = [null, null, null, null];	
	
	scene.add(ring.mesh);
	
	return ring;
}

function linkRings(currentRing, frustum, full_radius) {
	currentRing.mesh.updateMatrixWorld();
	if(!frustum.intersectsObject(currentRing.mesh)) {
		return;
	}
	
	var x = currentRing.mesh.position.x;
	var y = currentRing.mesh.position.y;
	
	// Go through to fill in missing flags
	// TL present, TR missing
	if(currentRing.links[0] && !currentRing.links[1] && currentRing.links[0].links[1]) {
		currentRing.links[1] = currentRing.links[0].links[1].links[2];
	}
	// TR present, TL missing
	if(currentRing.links[1] && !currentRing.links[0] && currentRing.links[1].links[0]) {
		currentRing.links[0] = currentRing.links[1].links[0].links[3];
	}
	// TR present, BR missing
	if(currentRing.links[1] && !currentRing.links[2] && currentRing.links[1].links[2]) {
		currentRing.links[2] = currentRing.links[1].links[2].links[3];
	}
	// BR present, TR missing
	if(currentRing.links[2] && !currentRing.links[1] && currentRing.links[2].links[1]) {
		currentRing.links[1] = currentRing.links[2].links[1].links[0];
	}
	// BR present, BL missing
	if(currentRing.links[2] && !currentRing.links[3] && currentRing.links[2].links[3]) {
		currentRing.links[3] = currentRing.links[2].links[3].links[0];
	}
	// BL present, BR missing
	if(currentRing.links[3] && !currentRing.links[2] && currentRing.links[3].links[2]) {
		currentRing.links[2] = currentRing.links[3].links[2].links[1];
	}
	// BL present, TL missing
	if(currentRing.links[3] && !currentRing.links[0] && currentRing.links[3].links[0]) {
		currentRing.links[0] = currentRing.links[3].links[0].links[1];
	}
	// TL present, BL missing
 	if(currentRing.links[0] && !currentRing.links[3] && currentRing.links[0].links[3]) {
		currentRing.links[3] = currentRing.links[0].links[3].links[2];
	} 
	
	var flags = currentRing.links.map(function(x) {return !!x;});
	
 	// Top left
	if(!flags[0]) {
		var ring0 = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		y = currentRing.mesh.position.y;
		x -= full_radius * 0.7;
		y += full_radius * 1.1;
		ring0.mesh.position.x = x;
		ring0.mesh.position.y = y;
		ring0.mesh.rotation.y = THREE.Math.degToRad(36);
		currentRing.links[0] = ring0;
		ring0.links[2] = currentRing;
	}		
	// Top right
	if(!flags[1]) {
		var ring1 = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		y = currentRing.mesh.position.y;
		x += full_radius * 0.4;
		y += full_radius * 1.1;
		ring1.mesh.position.x = x;
		ring1.mesh.position.y = y;
		ring1.mesh.rotation.y = THREE.Math.degToRad(36);
		currentRing.links[1] = ring1;
		ring1.links[3] = currentRing;
	}
	// Bottom right
	if(!flags[2]) {
		var ring2 = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		y = currentRing.mesh.position.y;
		x += full_radius * 0.4;
		y -= full_radius * 1.1;
		ring2.mesh.position.x = x;
		ring2.mesh.position.y = y;
		ring2.mesh.rotation.y = THREE.Math.degToRad(36);
		currentRing.links[2] = ring2;
		ring2.links[0] = currentRing;
	}
	// Bottom left
	if(!flags[3]) {
		var ring3 = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		y = currentRing.mesh.position.y;
		x -= full_radius * 0.7;
		y -= full_radius * 1.1;
		ring3.mesh.position.x = x;
		ring3.mesh.position.y = y;
		ring3.mesh.rotation.y = THREE.Math.degToRad(36);
		currentRing.links[3] = ring3;
		ring3.links[1] = currentRing;
	}	 
	
	var newRing = null;
	x = currentRing.mesh.position.x;
	y = currentRing.mesh.position.y;
	
	// Right
	if(!flags[1] || !flags[2]) {
		newRing = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x += full_radius * 1.1;
		newRing.mesh.position.x = x;
		newRing.mesh.position.y = y;
		newRing.mesh.rotation.y = THREE.Math.degToRad(-36);
		newRing.links[0] = currentRing.links[1];
		newRing.links[3] = currentRing.links[2];
		currentRing.links[1].links[2] = newRing;
		currentRing.links[2].links[1] = newRing;
		linkRings(newRing, frustum, full_radius);
	}
 	// Left
 	if(!flags[0] || !flags[3]) {			
		newRing = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		x -= full_radius * 1.1;
		newRing.mesh.position.x = x;
		newRing.mesh.position.y = y;
		newRing.mesh.rotation.y = THREE.Math.degToRad(-36);
		newRing.links[1] = currentRing.links[0];
		newRing.links[2] = currentRing.links[3];
		currentRing.links[0].links[3] = newRing;
		currentRing.links[3].links[0] = newRing;
		linkRings(newRing, frustum, full_radius);
	}
	// Top
	if(!flags[0] && !flags[1]) {
		newRing = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		x = currentRing.mesh.position.x;
		y += full_radius * 1.1;
		y += full_radius * 1.1;
		newRing.mesh.position.x = x;
		newRing.mesh.position.y = y;
		newRing.mesh.rotation.y = THREE.Math.degToRad(-36);
		newRing.links[3] = currentRing.links[0];
		newRing.links[2] = currentRing.links[1];
		currentRing.links[0].links[1] = newRing;
		currentRing.links[1].links[0] = newRing;
		linkRings(newRing, frustum, full_radius);
	}
	// Bottom
	if(!flags[2] && !flags[3]) {
		newRing = createRing(currentRing.mesh.geometry, currentRing.mesh.material);
		y = currentRing.mesh.position.y;
		y -= full_radius * 1.1;
		y -= full_radius * 1.1;
		newRing.mesh.position.x = x;
		newRing.mesh.position.y = y;
		newRing.mesh.rotation.y = THREE.Math.degToRad(-36);
		newRing.links[0] = currentRing.links[3];
		newRing.links[1] = currentRing.links[2];
		currentRing.links[3].links[2] = newRing;
		currentRing.links[2].links[3] = newRing;
		linkRings(newRing, frustum, full_radius); 
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
	tube = wireGauges[$("#wire-gauge-system").val()]["sizes"][$("#wire-gauge").val()][units] * scale;
	if(oldRadius === radius && oldTube === tube)
		return;
	
	var full_radius = radius + (tube / 2);
	var base_x = 0;//canvas.width / -2 + full_radius + (tube / 2);
	var base_y = 0;//canvas.height / 2 - (full_radius + (tube / 2));
	var x = base_x;
	var y = base_y;
	
 	var geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	var material = new THREE.MeshStandardMaterial({
				color: "magenta"//j >= rings[i].length || rings[i][j] === null ? "magenta" : rings[i][j].material.color
			});
	
	var currentRing = createRing(geometry, material);
	currentRing.mesh.position.x = x;
	currentRing.mesh.position.y = y;
	currentRing.mesh.rotation.y = THREE.Math.degToRad(-36);
	
	head = currentRing;
	
	// Setup for the in-camera test
	var frustum = new THREE.Frustum();
	// var cameraViewProjectionMatrix = new THREE.Matrix4();

	// make sure the camera matrix is updated
	camera.updateMatrixWorld(); 
	// camera.matrixWorldInverse.getInverse(camera.matrixWorld);
	// cameraViewProjectionMatrix.multiplyMatrices();
	frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	
	linkRings(currentRing, frustum, full_radius);
	
	console.log(scene.children.length);
	// var ring2 = {};
	// ring2.mesh = new THREE.Mesh(geometry, material.clone());
	// ring2.updated = false;
	// ring2.mesh.position.x = x + full_radius;
	// ring2.mesh.position.y = y;
	// ring2.mesh.position.z = -50;
	// ring2.mesh.rotation.y = THREE.Math.degToRad(-36);
	// scene.add(ring2.mesh);
	
	/* var start = scene.children.length < 5;
	var geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);

	for(var i = 0; i < rows; i++) {
		var odd = i % 2 == 1;

		x = base_x;
		if(odd)
			x += full_radius / 1.3;

		// horrible hack for now
		if(start)
			rings[i] = [];
		for(var j = 0; j < cols; j++) {
			
			var material = new THREE.MeshStandardMaterial({
				color: j >= rings[i].length || rings[i][j] === null ? "magenta" : rings[i][j].material.color
			});
			
			if(j < rings[i].length && rings[i][j] !== null) {
//				rings[i][j].geometry.dispose();
//				rings[i][j].material.dispose();
				rings[i][j].geometry = geometry;
				rings[i][j].geometry.dynamic = true;
				rings[i][j].geometry.verticesNeedUpdate = true;
//				scene.remove(rings[i][j]);
			}
			else {
			rings[i][j] = new THREE.Mesh(geometry, material);

			scene.add(rings[i][j]);
			}
			rings[i][j].position.x = x;
			rings[i][j].position.y = y;
			rings[i][j].position.z = -50;

			rings[i][j].rotation.y = Math.PI * 2 * (odd ? 0.1 : -0.1);

			x += full_radius;
		}

		y -= full_radius * (odd ? 1.15 : 1.0);
	} */
	
	var t1 = performance.now();
	console.log(t1 - t0);
}

function updateRing(currentRing, geometry) {
	if(currentRing.updated)
		return;
	
	currentRing.mesh.geometry = geometry;
	currentRing.mesh.geometry.dynamic = true;
	currentRing.mesh.geometry.verticesNeedUpdate = true;
	
	currentRing.updated = true;
	
	for(var i = 0; i < currentRing.links.length; i++) {
		if(currentRing.links[i])
			updateRing(currentRing.links[i], geometry);
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
	var base_x = 0;//canvas.width / -2 + full_radius + (tube / 2);
	var base_y = 0;//canvas.height / 2 - (full_radius + (tube / 2));
	var x = base_x;
	var y = base_y;
	
 	var geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
	
	updateRing(currentRing, geometry);
	
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
