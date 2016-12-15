
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
	
	$("#undo-button").click(function() {
		undo();
	});
	
	$("#redo-button").click(function() {
		redo();
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
	
	$("button.tool-button").click(function() {
		$("button.tool-button").removeClass("selected");
		$(this).addClass("selected");
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