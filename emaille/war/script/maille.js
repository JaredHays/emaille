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
var baseMaterial = new THREE.MeshStandardMaterial({color: "magenta"});

var head = null;

var scale = 100;
var radialSegments = 16;
var tubularSegments = 100;

var duration = 5000; // ms
var currentTime = Date.now();

var raycaster = new THREE.Raycaster();

var ringDiv;

var updates = new Set();

var mouse = {
	down: false,
	pos: new THREE.Vector2()
};
var tool = new Brush();

function run() {
	for(var i = 0; i < updates.length; i++)
		updateRings(updates[i]);
	updates.clear();
	
	requestAnimationFrame(function() {
		run();
	});

	renderer.render(scene, camera);
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
	$.ajax({
		url: "https://e-maille.appspot.com/data/getwires",
		dataType: "json",
		success: function(data) {
			for(var i = 0; i < data.length; i++) {
				var system = data[i];
				wireGauges[system.name] = system;
			}
			setupRingDivs();
		}
	});
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
			// console.log("ring: " + ringID);
			for(var i = 0; i < rings[ringID].links.length; i++) {
				var linkedRing = rings[ringID].links[i];
				if(linkedRing) {
					// Update ring ID for current base
					linkedRing.ringID = structure[ringID]["links"][i];
					// Add ring to map
					if(linkedRing.ringID && !(linkedRing.ringID in rings)) {
						rings[linkedRing.ringID] = linkedRing;
						addedNewRing = true;
						// console.log("adding ring: " + linkedRing.ringID);
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
	return wireGauges[$(".wire-gauge-system").val()]["sizes"][$("div#ring-div-" + geometryIndex + " .wire-gauge").val()];
}

function createWireGaugeList(geometryIndex, systemName) {
	var system = wireGauges[systemName];
	var gaugeList = $("div#ring-div-" + geometryIndex + " .wire-gauge");
	var selectedGauge = gaugeList.val();
	gaugeList.html("");
	for(var gauge in system["sizes"]) {
		gaugeList.append("<option value='" + gauge + "'" + (gauge === selectedGauge ? "selected" : "") + ">" + gauge + " - " + system["sizes"][gauge][units] + " " + units + ".</option>");
	}
}

function updateAR(geometryIndex) {
	var ringDiv = $("div#ring-div-" + geometryIndex);
	ringDiv.find(".aspect-ratio").val((ringDiv.find(".inner-diameter").val() / getSelectedWireGauge(geometryIndex)[units]).toFixed(3));
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
		updates.add(ringDiv.data("geometry"));
	});
	
	$(document).on("change", "#weave", function() {
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
				setupRingDivs();
				createRings();
			}
		});
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
	
	loadStaticData();
	

	run();
});
