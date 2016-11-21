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
			background-image: linear-gradient(top, #444444, #999999); \
		}")
		.appendTo("head");
	
	var BoundedSlider = function(elem, options) {
		var self = this;
		this.elem = elem;
		this.options = $.extend({
			"decimals": 2
		}, options);
		
		self.min = elem.attr("min");// ? elem.attr("min") : "0";
		this.minSpan = $("<input readonly type='number' class='bounded-slider-input'></input>").val(self.min);
		self.elem.before(self.minSpan);
		if("minClass" in self.options)
			self.minSpan.addClass(self.options.minClass);

		self.max = elem.attr("max");// ? elem.attr("max") : "∞";
		this.maxSpan = $("<input readonly type='number' class='bounded-slider-input'></input>").val(self.max);
		self.elem.after(self.maxSpan);
		if("maxClass" in self.options)
			self.maxSpan.addClass(self.options.maxClass);
		
		this.valueSpan = $("<input readonly type='number' class='bounded-slider-input bounded-slider-value'></input>").val(Number(self.elem.val()).toFixed(self.options.decimals));
		self.maxSpan.after(self.valueSpan);
		if("valueClass" in self.options) 
			self.valueSpan.addClass(self.options.valueClass);
		
		var valuePos = function() {
			var pos = self.elem.position();
			var offset = self.valueSpan.width();// / 2;
			var left = (self.elem.val() - self.elem.attr("min")) / (self.elem.attr("max") - self.elem.attr("min"));
			left = Math.clamp(left, 0, 1) * self.elem.width() + offset;
			// offset -= left;
			return left;
		};
		self.valueSpan.css("left", valuePos());
		
		self.elem.on("change", function() {
			self.valueSpan.val(Number($(this).val()).toFixed(self.options.decimals)).css("left", valuePos());
		});
		self.elem.on("input", function() {
			self.valueSpan.val(Number($(this).val()).toFixed(self.options.decimals)).css("left", valuePos());
		});
		self.elem.on("update", function() {
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