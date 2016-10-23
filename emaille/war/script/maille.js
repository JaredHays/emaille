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

var mouseDown = false;

var rows = 10;
var cols = 10;

var rings = [];

var radius = 50;
var tube = 10;
var radialSegments = 16;
var tubularSegments = 100;

var duration = 5000; // ms
var currentTime = Date.now();

Math.cbrt = function(x) {
    var sign = x === 0 ? 0 : x > 0 ? 1 : -1;

    return sign * Math.pow(Math.abs(x), 1 / 3);
};

function solveCubic(a, b, c, d) {
	var f = ((3 * c / a) - (Math.pow(b, 2) / Math.pow(a, 2))) / 3,
		g = ((2 * Math.pow(b, 3) / Math.pow(a, 3)) - (9 * b * c / Math.pow(a, 2)) + (27 * d / a)) / 27,
		h = (Math.pow(g, 2) / 4) + (Math.pow(f, 3) / 27)
		;
	
	// 3 real
	if(h <= 0) {
		// All equal
		if(f == 0 && g == 0 && h == 0) {
			var x = Math.cbrt(d / a) * -1;
			return [x, x, x];
		}
		else {
			var i = Math.sqrt((Math.pow(g, 2) / 4) - h),
				j = Math.cbrt(i),
				k = Math.acos(-g / (2 * i)),
				l = -j,
				m = Math.cos(k / 3),
				n = Math.sqrt(3) * Math.sin(k / 3),
				p = -b / (3 * a)
				x1 = (2 * j * Math.cos(k / 3)) - (b / (3 * a)),
				x2 = l * (m + n) + p,
				x3 = l * (m - n) + p
				;
			return [x1, x2, x3];
		}
	}
	// 1 real, 2 complex
	else {
		var r = (-g / 2) + Math.sqrt(h),
			s = Math.cbrt(r),
			t = (-g / 2) - Math.sqrt(h),
			u = Math.cbrt(t),
			x1 = (s + u) - (b / (3 * a)),
			x23r = (-(s + u) / 2) - (b / (3 * a)),
			x23i = ((s - u) * Math.sqrt(3)) / 2
			;
		return [x1, math.complex(x23r, x23i), math.complex(x23r, -x23i)];
	}
}

function solveQuartic(a, b, c, d, e) {
	b /= a;
	c /= a;
	d /= a;
	e /= a;
	a /= a;
	var f = c - (3 * Math.pow(b, 2) / 8),
		g = d + (Math.pow(b, 3) / 8) - (b * c / 2),
		h = e - (3 * Math.pow(b, 4) / 256) + (Math.pow(b, 2) * c / 16) - (b * d / 4),
		// plug into Y3 + (f/2)*Y2 + ((f2 -4*h)/16)*Y -g2/64 = 0
		a_ = 1,
		b_ = f / 2,
		c_ = (Math.pow(f, 2) - (4 * h)) / 16,
		d_ = -1 * Math.pow(g, 2) / 64
		;
	var cubic_result = solveCubic(a_, b_, c_, d_);
	// console.log("a: " + a + ", b: " + b + ", c: " + c + ", d: " + d + ", e: " + e + ", f: " + f + ", g: " + g + ", h: " + h + ", cr: " + cubic_result);
	var p, q, r, s;
	// 1 real, 2 complex
	if(cubic_result[1] instanceof math.type.Complex && cubic_result[2] instanceof math.type.Complex) {
		p = math.sqrt(cubic_result[1]);
		q = math.sqrt(cubic_result[2]);
		r = math.divide(-g, math.chain(8).multiply(p).multiply(q).done());
		s = math.divide(b, math.multiply(4, a));
		var x1 = math.chain(p).add(q).add(r).subtract(s).done(),
			x2 = math.chain(p).subtract(q).subtract(r).subtract(s).done(),
			x3 = math.chain(math.multiply(-1, p)).add(q).subtract(r).subtract(s).done(),
			x4 = math.chain(math.multiply(-1, p)).subtract(q).add(r).subtract(s).done()
			;
		return [x1, x2, x3, x4];
	}
	// All real
	else {
		p = Math.sqrt(cubic_result[0] !== 0 ? cubic_result[0] : cubic_result[1]);
		q = Math.sqrt(cubic_result[2]);
		r = -g / (8 * p * q);
		s = b / (4 * a);
		var x1 = p + q + r - s,
			x2 = p - q - r - s,
			x3 = -p + q - r - s,
			x4 = -p - q + r - s
			;
		return [x1, x2, x3, x4];
	}
}

// Ray-torus intersection quartic equation: t4 ( xD4 + yD4 + zD4 + 2 xD2 yD2 + 2 xD2 zD2 + 2 yD2 zD2 ) + t3 ( 4 xD3 xE + 4 yD3 yE + 4 zD3 zE + 4 xD2 yD yE + 4 xD2 zD zE + 4 xD xE yD2 + 4 yD2 zD zE + 4 xD xE zD2 + 4 yD yE zD2 ) + t2 ( - 2 R2 xD2 - 2 R2 yD2 + 2 R2 zD2 - 2 r2 xD2 - 2 r2 yD2 - 2 r2 zD2 + 6 xD2 xE2 + 2 xE2 yD2 + 8 xD xE yD yE + 2 xD2 yE2 + 6 yD2 yE2 + 2 xE2 zD2 + 2 yE2 zD2 + 8 xD xE zD zE + 8 yD yE zD zE + 2 xD2 zE2 + 2 yD2 zE2 + 6 zD2 zE2 ) + t ( - 4 R2 xD xE - 4 R2 yD yE + 4 R2 zD zE - 4 r2 xD xE - 4 r2 yD yE - 4 r2 zD zE + 4 xD xE3 + 4 xE2 yD yE + 4 xD xE yE2 + 4 yD yE3 + 4 xE2 zD zE + 4 yE2 zD zE + 4 xD xE zE2 + 4 yD yE zE2 + 4 zD zE3 ) + ( R4 - 2 R2 xE2 - 2 R2 yE2 + 2 R2 zE2 + r4 - 2 r2 R2 - 2 r2 xE2 - 2 r2 yE2 - 2 r2 zE2 + xE4 + yE4 + zE4 + 2 xE2 yE2 + 2 xE2 zE2 + 2 yE2 zE2 ) = 0
// E = eye (origin), D = dir
THREE.Ray.prototype.intersectsTorus = function(torus) {
	var xD = this.direction.x,
		yD = this.direction.y,
		zD = this.direction.z,
		xD2 = Math.pow(xD, 2),
		yD2 = Math.pow(yD, 2),
		zD2 = Math.pow(zD, 2),
		xD3 = Math.pow(xD, 3),
		yD3 = Math.pow(yD, 3),
		zD3 = Math.pow(zD, 3),
		xD4 = Math.pow(xD, 4),
		yD4 = Math.pow(yD, 4),
		zD4 = Math.pow(zD, 4),
		xE = this.origin.x - torus.position.x,
		yE = this.origin.y - torus.position.y,
		zE = this.origin.z - torus.position.z,
		xE2 = Math.pow(xE, 2),
		yE2 = Math.pow(yE, 2),
		zE2 = Math.pow(zE, 2),
		xE3 = Math.pow(xE, 3),
		yE3 = Math.pow(yE, 3),
		zE3 = Math.pow(zE, 3),
		xE4 = Math.pow(xE, 4),
		yE4 = Math.pow(yE, 4),
		zE4 = Math.pow(zE, 4),
		R = torus.geometry.parameters.radius,
		r = torus.geometry.parameters.tube,
		R2 = Math.pow(R, 2),
		r2 = Math.pow(r, 2),
		R4 = Math.pow(R, 4),
		r4 = Math.pow(r, 4),		
		a = xD4 + yD4 + zD4 + (2 * xD2 * yD2) + (2 * xD2 * zD2) + (2 * yD2 * zD2),
		b = (4 * xD3 * xE) + (4 * yD3 * yE) + (4 * zD3 * zE) + (4 * xD2 * yD * yE) + (4 * xD2 * zD * zE) + (4 * xD * xE * yD2) + (4 * yD2 * zD * zE) + (4 * xD * xE * zD2) + (4 * yD * yE * zD2),
		c = (-2 * R2 * xD2) - (2 * R2 * yD2) + (2 * R2 * zD2) - (2 * r2 * xD2) - (2 * r2 * yD2) - (2 * r2 * zD2) + (6 * xD2 * xE2) + (2 * xE2 * yD2) + (8 * xD * xE * yD * yE) + (2 * xD2 * yE2) + (6 * yD2 * yE2) + (2 * xE2 * zD2) + (2 * yE2 * zD2) + (8 * xD * xE * zD * zE) + (8 * yD * yE * zD * zE) + (2 * xD2 * zE2) + (2 * yD2 * zE2) + (6 * zD2 * zE2),
		d = (-4 * R2 * xD * xE) - (4 * R2 * yD * yE) + (4 * R2 * zD * zE) - (4 * r2 * xD * xE) - (4 * r2 * yD * yE) - (4 * r2 * zD * zE) + (4 * xD * xE3) + (4 * xE2 * yD * yE) + (4 * xD * xE * yE2) + (4 * yD * yE3) + (4 * xE2 * zD * zE) + (4 * yE2 * zD * zE) + (4 * xD * xE * zE2) + (4 * yD * yE * zE2) + (4 * zD * zE3),
		e = R4 - (2 * R2 * xE2) - (2 * R2 * yE2) + (2 * R2 * zE2) + r4 - (2 * r2 * R2) - (2 * r2 * xE2) - (2 * r2 * yE2) - (2 * r2 * zE2) + xE4 + yE4 + zE4 + (2 * xE2 * yE2) + (2 * xE2 * zE2) + (2 * yE2 * zE2)
		;
	// console.log("xD: " + xD
		// + ", yD: " + yD
		// + ", zD: " + zD
		// + ", xD2: " + xD2
		// + ", yD2: " + yD2
		// + ", zD2: " + zD2
		// + ", xD3: " + xD3
		// + ", yD3: " + yD3
		// + ", zD3: " + zD3
		// + ", xD4: " + xD4
		// + ", yD4: " + yD4
		// + ", zD4: " + zD4
		// + ", xE: " + xE
		// + ", yE: " + yE
		// + ", zE: " + zE
		// + ", xE2: " + xE2
		// + ", yE2: " + yE2
		// + ", zE2: " + zE2
		// + ", xE3: " + xE3
		// + ", yE3: " + yE3
		// + ", zE3: " + zE3
		// + ", xE4: " + xE4
		// + ", yE4: " + yE4
		// + ", zE4: " + zE4
		// + ", R: " + R
		// + ", r: " + r
		// + ", R2: " + R2
		// + ", r2: " + r2
		// + ", R4: " + R4
		// + ", r4: " + r4
		// + ", a: " + a
		// + ", b: " + b
		// + ", c: " + c
		// + ", d: " + d
		// + ", e: " + e);
	return solveQuartic(a, b, c, d, e);
};

function run() {
	requestAnimationFrame(function() {
		run();
	});

	renderer.render(scene, camera);

	// animate();
}
	var mouse = new THREE.Vector2(); // create once and reuse

function getClickedRing(x, y) {

	// mouse.x = ( x / window.innerWidth ) * 2 - 1;
	// mouse.y = - ( y / window.innerHeight ) * 2 + 1;

	// var l = 0, r = rows - 1;
	// var row = 0, col = 0;

	// // Binary search for approximate best fit 
	// // row
	// while(l <= r) {
		// row = Math.floor((l + r) / 2);

		// // Click within radius of ring center
		// if(Math.abs(rings[row][col].position.y - y) <= radius + tube) {
			// l = r + 1;
		// }
		// // Click below ring
		// else if(y < rings[row][col].position.y) {
			// l = row + 1;
		// }
		// // Click above ring
		// else {
			// r = row - 1;
		// }
	// }

	// // col
	// l = 0;
	// r = cols - 1;
	// while(l <= r) {
		// col = Math.floor((l + r) / 2);

		// // Click within radius of ring center
		// if(Math.abs(rings[row][col].position.x - x) <= radius + tube) {
			// l = r + 1;
		// }
		// // Click right of ring
		// else if(x > rings[row][col].position.x) {
			// l = col + 1;
		// }
		// // Click left of ring
		// else {
			// r = col - 1;
		// }
	// }

	// Find front-most ring near approximate target
	var raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(mouse, camera);
	console.log(raycaster.ray.origin);
	console.log(raycaster.ray.direction);
	// var ray = new THREE.Ray(new THREE.Vector3(x, y, 100), new THREE.Vector3(0, 0, -1));
	// var stack = {}
	// stack[row] = {}
	// stack[row][col] = null;
	// var count = 1;

	// var ring = rings[row][col];
	// if(ring == null)
		// return ring;

	// var count = 0;

	// var colors = ["red", "orange", "yellow", "green", "blue", "purple"];

	// while(ring != null && count < 30) {
		// var normal = new THREE.Vector3(0, 0, 1).applyEuler(ring.rotation);
		// var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, ring.position);

		// var intersect = ray.intersectPlane(plane);

		// Ray intersects ring plane
		// if(intersect) {
			// var dist_sq = intersect.distanceToSquared(ring.position);
			// Ray intersects within torus
			// if(dist_sq <= (radius + tube) * (radius + tube) * 1.1) {
				// Ray intersects on actual torus
				// if(dist_sq >= radius * radius * 0.8) {
					// var dir = ray.direction;
					// dir.applyEuler(ring.rotation);//.multiplyScalar(-1);
					// var origin = ray.origin;
					// origin.reflect(normal);//applyEuler(ring.rotation).multiplyScalar(-1);
					// var filtered = new THREE.Ray(origin, dir).intersectsTorus(ring).filter(function(x){return (math.isNumeric(x) && !math.isNaN(x)) || (math.typeof(x) === "Complex" && math.isZero(x.im) && !math.isNaN(x.re));}).map(function(x){return math.typeof(x) === "Complex" ? x.re : x;});
					// console.log(filtered);
					var result = raycaster.intersectObjects(scene.children);
					if ( result.length > 0 ) {
						return result[0].object;
					}
					else
						return null;
					// stack[row][col] = result.length > 0 ? result[0].distance : false; //intersect.z;
					// console.log(result);
					//;
					// if(filtered.length > 0) {
						// console.log("Pass");
						// ring.material.color = new THREE.Color(colors[0]);
					// }
					// else {
						// console.log("Fail");
					// }
					
					// console.log(dir);
					// console.log(ring.position);
					// console.log(origin);
				// }
				// Ray intersects inside torus
				// else {
					// ring.material.color = new THREE.Color(colors[count]);

					// stack[row][col] = false;
				// }
			// }
			// Not in torus, remove from stack
			// else {
				// ring.material.color = new THREE.Color(colors[count]);

				// stack[row][col] = false;
			// }

			// Add nearby rings to stack
			// var left = col - 1;
			// var right = col + 1;
			// var above = row - 1;
			// var below = row + 1;

			// // Above row
			// if(y > ring.position.y) {
				// // Left
				// if(x < ring.position.x)
					// addNewPairToStack(stack, above, left);
				// // Right
				// else
					// addNewPairToStack(stack, above, right);
				// // Center
				// addNewPairToStack(stack, above, col);
			// }

			// // Below row
			// else if(y < ring.position.y) {
				// // Left
				// if(x < ring.position.x)
					// addNewPairToStack(stack, below, left);
				// // Right
				// else
					// addNewPairToStack(stack, below, right);
				// // Center
				// addNewPairToStack(stack, below, col);
			// }
			// // This row
			// // Left
			// if(x < ring.position.x)
				// addNewPairToStack(stack, row, left);
			// // Right
			// else
				// addNewPairToStack(stack, row, right);
		// // }
		// // else {
			// // ring.material.color = new THREE.Color(colors[count]);
			// // stack[row][col] = false;
		// // }

		// ring = null;
		// row_loop: for(var r in stack) {
			// col_loop: for(var c in stack[r]) {
				// if(stack[r][c] === null) {
					// ring = rings[r][c];
					// row = r;
					// col = c;
					// break row_loop;
				// }
			// }
		// }

		// count++;
	// }

	// // Find ring with z-intersect closest to camera
	// var z = null;
	// ring = null;
	// for(var r in stack) {
		// for(var c in stack[r]) {
			// // console.log("(" + r + ", " + c + "): " + stack[r][c]);
			// if(stack[r][c] !== null && stack[r][c] !== false && (z === null || stack[r][c] > z)) {
				// z = stack[r][c];
				// ring = rings[r][c];				
			// }
		// }
	// }

	// return ring;
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
	canvas = document.getElementById("canvas")

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
		mouseDown = true;
		var clicked = getClickedRing(e.clientX, e.clientY);
		// for(var i = 0; i < clicked.length; i++)
		if(clicked !== null)
			clicked.material.color = new THREE.Color("white");
	}
	canvas.onmouseup = function(e) {
		mouseDown = false;
	}
	canvas.onmousemove = function(e) {
		e.preventDefault();
		mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
		if(mouseDown) {
			var clicked = getClickedRing(e.clientX, e.clientY);
			// for(var i = 0; i < clicked.length; i++)
			if(clicked !== null)
				clicked.material.color = new THREE.Color("white");
		}
	}

	run();
});
