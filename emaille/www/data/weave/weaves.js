var weaves = {
	"euro-4-in-1": {
		"name": "European 4-in-1",
		"geometries": [
			{
				"minAR": 2.9
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
		"values": {
			"fullOffset": 1.1,
			"leftOffset": -0.7,
			"rightOffset": 0.4
		},
		"structure": {
			"base": {
				"base": true,
				"ring": 0,
				"pos": {"x": 0, "y": 0},
				"links": [
					"top-left",
					"top-right",
					"bottom-right",
					"bottom-left",
					"left",
					"right",
					"top",
					"bottom"
				]
			},
			"top-left": {
				"ring": 1,
				"pos": {"x": "leftOffset", "y": "fullOffset"}
			},
			"top-right": {
				"ring": 1,
				"pos": {"x": "rightOffset", "y": "fullOffset"}
			},
			"bottom-right": {
				"ring": 1,
				"pos": {"x": "rightOffset", "y": "-fullOffset"}
			},
			"bottom-left": {
				"ring": 1,
				"pos": {"x": "leftOffset", "y": "-fullOffset"}
			},
			"left": {
				"ring": 0,
				"pos": {"x": "-fullOffset", "y": 0},
				"links": [
					{"id": "top-left", "as": "top-right"},
					{"id": "bottom-left", "as": "bottom-right"},
					{"id": "base", "as": "right"}
				]
			},
			"right": {
				"ring": 0,
				"pos": {"x": "fullOffset", "y": 0},
				"links": [
					{"id": "top-right", "as": "top-left"},
					{"id": "bottom-right", "as": "bottom-left"},
					{"id": "base", "as": "left"}
				]
			},
			"top": {
				"ring": 0,
				"pos": {"x": 0, "y": "fullOffset * 2"},
				"links": [
					{"id": "top-right", "as": "bottom-right"},
					{"id": "top-left", "as": "bottom-left"},
					{"id": "base", "as": "bottom"}
				]
			},
			"bottom": {
				"ring": 0,
				"pos": {"x": 0, "y": "-fullOffset * 2"},
				"links": [
					{"id": "bottom-left", "as": "top-left"},
					{"id": "bottom-right", "as": "top-right"},
					{"id": "base", "as": "top"}
				]
			}
		},
		"linkPaths": {
			"left": [
				["top", "left", "bottom"],
				["bottom", "left", "top"]
			],
			"right": [
				["top", "right", "bottom"],
				["bottom", "right", "top"]
			],
			"top": [
				["right", "top", "left"],
				["left", "top", "right"]
			],
			"bottom": [
				["right", "bottom", "left"],
				["left", "bottom", "right"]
			],
			"top-left": [
				["left", "top-right"],
				["top", "bottom-left"]
			],
			"top-right": [
				["right", "top-left"],
				["top", "bottom-right"]
			],
			"bottom-right": [
				["right", "bottom-left"],
				["bottom", "top-right"]
			],
			"bottom-left": [
				["left", "bottom-right"],
				["bottom", "top-left"]
			]
		}
	},
	"jap-6-in-1": {
		"name": "Japanese 6-in-1",
		"geometries": [
			{
				"minAR": 2.9,
				"defaults": {
					"wireSystem": "AWG",
					"wireGauge": 16,
					"innerDiameter": 0.75
				}
			},
			{
				"minAR": 2.9,
				"defaults": {
					"wireSystem": "SWG",
					"wireGauge": 16,
					"innerDiameter": 0.5
				}
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
		"values": {
			"radius": 1.5,
			"largeOffset": 1.5
		},
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
					"small-5",
					"large-0",
					"large-1",
					"large-2",
					"large-3",
					"large-4",
					"large-5"
				]
			},
			"small-0": {
				"ring": 1,
				"pos": {"x": 0, "y": "radius", "z": 0.5}
			},
			"small-1": {
				"ring": 1,
				"pos": {"x": "radius * cos(30 * PI / 180)", "y": "radius * sin(30 * PI / 180)", "z": 0.5},
				"rot": {"z": -60}
			},
			"small-2": {
				"ring": 1,
				"pos": {"x": "radius * cos(-30 * PI / 180)", "y": "radius * sin(-30 * PI / 180)", "z": 0.5},
				"rot": {"z": 60}
			},
			"small-3": {
				"ring": 1,
				"pos": {"x": 0, "y": "-radius", "z": 0.5},
				"rot": {"z": 0}
			},
			"small-4": {
				"ring": 1,
				"pos": {"x": "radius * cos(-150 * PI / 180)", "y": "radius * sin(-150 * PI / 180)", "z": 0.5},
				"rot": {"z": -60}
			},
			"small-5": {
				"ring": 1,
				"pos": {"x": "radius * cos(150 * PI / 180)", "y": "radius * sin(150 * PI / 180)", "z": 0.5},
				"rot": {"z": -120}
			},
			"large-0": {
				"ring": 0,
				"pos": {"x": 0, "y": "largeOffset * radius"},
				"links": [
					{"id": "small-0", "as": "small-3"},
					{"id": "base", "as": "large-3"}
				]
			},
			"large-1": {
				"ring": 0,
				"pos": {"x": "largeOffset * radius * cos(30 * PI / 180)", "y": "largeOffset * radius * sin(30 * PI / 180)"},
				"rot": {"z": -30},
				"links": [
					{"id": "small-1", "as": "small-4"},
					{"id": "base", "as": "large-4"}
				]
			},
			"large-2": {
				"ring": 0,
				"pos": {"x": "largeOffset * radius * cos(-30 * PI / 180)", "y": "largeOffset * radius * sin(-30 * PI / 180)"},
				"rot": {"z": 30},
				"links": [
					{"id": "small-2", "as": "small-5"},
					{"id": "base", "as": "large-5"}
				]
			},
			"large-3": {
				"ring": 0,
				"pos": {"x": 0, "y": "-largeOffset * radius"},
				"rot": {"z": 0},
				"links": [
					{"id": "small-3", "as": "small-0"},
					{"id": "base", "as": "large-0"}
				]
			},
			"large-4": {
				"ring": 0,
				"pos": {"x": "largeOffset * radius * cos(-150 * PI / 180)", "y": "largeOffset * radius * sin(-150 * PI / 180)"},
				"rot": {"z": -30},
				"links": [
					{"id": "small-4", "as": "small-1"},
					{"id": "base", "as": "large-1"}
				]
			},
			"large-5": {
				"ring": 0,
				"pos": {"x": "largeOffset * radius * cos(150 * PI / 180)", "y": "largeOffset * radius * sin(150 * PI / 180)"},
				"rot": {"z": 30},
				"links": [
					{"id": "small-5", "as": "small-2"},
					{"id": "base", "as": "large-2"}
				]
			}
		},
		"linkPaths": {
			"large-0": [
				["large-5", "large-1"],
				["large-1", "large-5"],
				["large-4", "large-0", "large-1"],
				["large-2", "large-0", "large-5"],
				["large-1", "large-0", "large-4"],
				["large-5", "large-0", "large-2"]
			],
			"large-1": [
				["large-0", "large-2"],
				["large-2", "large-0"],
				["large-5", "large-1", "large-2"],
				["large-3", "large-1", "large-0"],
				["large-2", "large-1", "large-5"],
				["large-0", "large-1", "large-3"]
			],
			"large-2": [
				["large-1", "large-3"],
				["large-3", "large-1"],
				["large-0", "large-2", "large-3"],
				["large-4", "large-2", "large-1"],
				["large-3", "large-2", "large-0"],
				["large-1", "large-2", "large-4"]
			],
			"large-3": [
				["large-2", "large-4"],
				["large-4", "large-2"],
				["large-1", "large-3", "large-4"],
				["large-5", "large-3", "large-2"],
				["large-4", "large-3", "large-1"],
				["large-2", "large-3", "large-5"]
			],
			"large-4": [
				["large-5", "large-3"],
				["large-3", "large-5"],
				["large-0", "large-4", "large-3"],
				["large-2", "large-4", "large-5"],
				["large-3", "large-4", "large-0"],
				["large-5", "large-4", "large-2"]
			],
			"large-5": [
				["large-0", "large-4"],
				["large-4", "large-0"],
				["large-1", "large-5", "large-4"],
				["large-3", "large-5", "large-0"],
				["large-4", "large-5", "large-1"],
				["large-0", "large-5", "large-3"]
			],
			"small-0": [
				["large-0", "small-3"]
			],
			"small-1": [
				["large-1", "small-4"]
			],
			"small-2": [
				["large-2", "small-5"]
			],
			"small-3": [
				["large-3", "small-0"]
			],
			"small-4": [
				["large-4", "small-1"]
			],
			"small-5": [
				["large-5", "small-2"]
			]
		}
	}
}