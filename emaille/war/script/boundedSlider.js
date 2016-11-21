(function($) {
	$("<style>")
		.prop("type", "text/css")
		.html("\
		.bounded-slider-input {\
			border-style: none; \
		} \
		.bounded-slider-value { \
			position: absolute; \
			width: 4%; \
			text-align: center; \
			border-radius: 10px; \
			display: inline-block; \
			background-color: white; \
			border-color: black; \
			border-width: 1px; \
			border-style: solid; \
		} \
		")
		.appendTo("head");
	
	var BoundedSlider = function(elem, options) {
		var self = this;
		this.elem = elem;
		this.options = $.extend({
			"decimals": 2
		}, options);
		
		self.min = elem.attr("min");
		this.minSpan = $("<input readonly type='number' class='bounded-slider-input'></input>")
			.val(Number(self.min).toFixed(self.options.decimals));
		self.elem.before(self.minSpan);
		if("minClass" in self.options)
			self.minSpan.addClass(self.options.minClass);

		self.max = elem.attr("max");
		this.maxSpan = $("<input readonly type='number' class='bounded-slider-input'></input>")
			.val(Number(self.max).toFixed(self.options.decimals));
		self.elem.after(self.maxSpan);
		if("maxClass" in self.options)
			self.maxSpan.addClass(self.options.maxClass);
		
		this.valueSpan = $("<output readonly type='number' class='bounded-slider-value'></output>").val(Number(self.elem.val()).toFixed(self.options.decimals));
		self.maxSpan.after(self.valueSpan);
		if("valueClass" in self.options) 
			self.valueSpan.addClass(self.options.valueClass);
		
		var valuePos = function() {
			var pos = self.elem.position();
			var offset = self.minSpan.width() + self.valueSpan.width() / 2;
			var left = (self.elem.val() - self.elem.attr("min")) / (self.elem.attr("max") - self.elem.attr("min"));
			left = Math.clamp(left, 0, 1) * self.elem.width() + offset;
			return left;
		};
		self.valueSpan.css("left", valuePos());
		self.valueSpan.css("top", self.elem.position().top);
		var div = self.elem.closest("div");
		div.height(div.height() + (self.valueSpan.height() / 2))
			.css("padding-top", (div.css("padding-top").replace("px", "") + self.valueSpan.height()) + "px");
		
		self.elem.on("change", function() {
			self.valueSpan.val(Number($(this).val()).toFixed(self.options.decimals)).css("left", valuePos());
		});
		self.elem.on("input", function() {
			self.valueSpan.val(Number($(this).val()).toFixed(self.options.decimals)).css("left", valuePos());
		});
		self.elem.on("update", function() {
			self.minSpan.val(Number($(this).attr("min")).toFixed(self.options.decimals));
			self.maxSpan.val(Number($(this).attr("max")).toFixed(self.options.decimals));
			self.valueSpan.val(Number($(this).val()).toFixed(self.options.decimals)).css("left", valuePos());
		});
	};
 
    $.fn.boundedSlider = function(options) {
		return this.filter("input[type='range']").each(function() {
			if(!$(this).attr("min") || !$(this).attr("max")) {
				console.log("Range input must have max and min to use boundedSlider: " + $(this).attr("id"));
				return;
			}
			new BoundedSlider($(this), options);
		}); 
    };
 
}(jQuery));