(function () {
	var root = document.documentElement;
	var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	function markPageReady() {
		if (root.classList.contains('page-ready')) {
			return;
		}

		var applyReadyState = function () {
			root.classList.remove('js-loading');
			root.classList.add('page-ready');
		};

		if (prefersReducedMotion.matches) {
			applyReadyState();
			return;
		}

		window.setTimeout(applyReadyState, 80);
	}

	if (document.readyState === 'complete') {
		markPageReady();
	} else {
		window.addEventListener('load', markPageReady, { once: true });
	}

	prefersReducedMotion.addEventListener('change', function () {
		if (prefersReducedMotion.matches) {
			markPageReady();
		}
	});
})();