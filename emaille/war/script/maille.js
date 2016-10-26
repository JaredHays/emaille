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

function addNewPairToStack(stack, row, col) {
	if(row < 0 || row >= rows || col < 0 || col >= cols)
		return;

	if(row in stack && col in stack[row])
		return;

	if(!rings[row] || !rings[row][col])
		return;

	if(!(row in stack))
		stack[row] = {};

	stack[row][col] = null;
}

function loadStaticData() {
	$.ajax({
		url: "data/getwires",
		dataType: "json",
		success: function(data) {
			var systemList = $("#wire-gauge-system");
			for(var i = 0; i < data.length; i++) {
				var system = data[i];
				wireGauges[system.name] = system;
				systemList.append("<option value='" + system.name + "'>" + system.name + "</option>");
			}
			systemList.change();
		}
	});
	$.ajax({
		url: "data/getweaves",
		dataType: "json",
		success: function(data) {
			weaves = data;
		}
	});
}

function createRings() {
	var full_radius = radius + (tube / 2);
	var base_x = canvas.width / -2 + full_radius + (tube / 2);
	var base_y = canvas.height / 2 - (full_radius + (tube / 2));
	var x = base_x;
	var y = base_y;
	
	var start = scene.children.length < 5;

	for(var i = 0; i < rows; i++) {
		var odd = i % 2 == 1;

		x = base_x;
		if(odd)
			x += full_radius / 1.3;

		// horrible hack for now
		if(start)
			rings[i] = [];
		for(var j = 0; j < cols; j++) {
			var geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
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
	}
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

//	createRings();

	var light = new THREE.DirectionalLight(0xffffff, 1.5);
	light.position.set(0, 0, 1);

	scene.add(light);
	scene.add(new THREE.AmbientLight(0xf0f0f0, 0.25));

	canvas.onmousedown = function(e) {
		e.preventDefault();
		mouse.down = true;
		console.log(e.button);
		tool.onMouseDown();
	}
	canvas.onmouseup = function(e) {
		e.preventDefault();
		mouse.down = false;
		tool.onMouseUp();
	}
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.pos.x = ((e.clientX - canvasPos.left) / canvas.width) * 2 - 1;
		mouse.pos.y = -((e.clientY - canvasPos.top) / canvas.height) * 2 + 1;
		tool.onMouseMove();
	}
	canvas.oncontextmenu = function(e) {
		e.preventDefault();
//		tool.onMouseDown();
	}
	
	ringColor.change(function() {
		
	});
	
	$("#wire-gauge-system").change(function() {
		var system = wireGauges[$(this).val()];
		$("#wire-gauge").html("");
		for(var gauge in system["sizes"]) {
			$("#wire-gauge").append("<option value='" + gauge + "'>" + gauge + " - " + system["sizes"][gauge][units] + " " + units + ".</option>");
		}
		$("#wire-gauge").change();
	});
	
	$("#wire-gauge").change(function() {
		tube = wireGauges[$("#wire-gauge-system").val()]["sizes"][$(this).val()][units] * scale;
		var t0 = performance.now();
		createRings();
		var t1 = performance.now();
		console.log(t1 - t0);
	});
	
	$("#inner-diameter").change(function() {
		radius = $(this).val() * scale / 2;
		var t0 = performance.now();
		createRings();
		var t1 = performance.now();
		console.log(t1 - t0);
	});
	
	// Switch unit-based inputs between in. and mm.
	$("input[name='units'][type='radio']").change(function() {
		units = $(this).val();
		if(units === "in") {
			$("input.unit-field").each(function() {
				$(this).val($(this).val() / 25.4);
			});
		}
		else {
			$("input.unit-field").each(function() {
				$(this).val($(this).val() * 25.4);
			});
		}
	});
	
	loadStaticData();

	run();
});
