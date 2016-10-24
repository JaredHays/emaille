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

var rows = 10;
var cols = 10;

var rings = [];

var wireCoefficient = 50;
var radius = 50;
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

	var full_radius = radius + (tube / 2);
	var base_x = canvas.width / -2 + full_radius + (tube / 2);
	var base_y = canvas.height / 2 - (full_radius + (tube / 2));
	var x = base_x;
	var y = base_y;

	for(var i = 0; i < rows; i++) {
		var odd = i % 2 == 1;

		x = base_x;
		if(odd)
			x += full_radius / 1.3;

		rings[i] = [];
		for(var j = 0; j < cols; j++) {
			var geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
			var material = new THREE.MeshStandardMaterial({
				color: "magenta"
			});
			rings[i][j] = new THREE.Mesh(geometry, material);
			rings[i][j].position.x = x;
			rings[i][j].position.y = y;
			rings[i][j].position.z = -50;

			rings[i][j].rotation.y = Math.PI * 2 * (odd ? 0.1 : -0.1);

			scene.add(rings[i][j]);

			x += full_radius;
		}

		y -= full_radius * (odd ? 1.15 : 1.0);
	}

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
	
	// Switch unit-based inputs between in. and mm.
	$("input[name='units'][type='radio']").change(function() {
		if($(this).val() === "in") {
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

	run();
});
