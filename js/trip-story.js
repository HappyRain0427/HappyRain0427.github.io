(function () {
  'use strict';

  function initTripStory() {
    var root = document.querySelector('[data-trip-story]');
    if (!root) return;

    var stops = Array.prototype.slice.call(root.querySelectorAll('[data-trip-stop]'));
    var markers = Array.prototype.slice.call(root.querySelectorAll('[data-trip-marker]'));
    var segments = Array.prototype.slice.call(root.querySelectorAll('[data-trip-segment]'));
    var currentLabel = root.querySelector('[data-trip-current]');
    var progressLabel = root.querySelector('[data-trip-progress]');
    var previousButton = root.querySelector('[data-trip-previous]');
    var nextButton = root.querySelector('[data-trip-next]');
    var mapPanel = root.querySelector('.trip-map-panel');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var mobileViewport = window.matchMedia('(max-width: 768px)');
    var activeIndex = 0;
    var observer = null;
    var observerTimer = null;

    if (!stops.length) return;

    function navbarHeight() {
      var navbar = document.querySelector('#navbar') || document.querySelector('.navbar');
      if (!navbar) return 60;
      return Math.max(0, Math.round(navbar.getBoundingClientRect().height));
    }

    function updateStickyOffset() {
      root.style.setProperty('--trip-sticky-top', navbarHeight() + 12 + 'px');
    }

    function hashForStop(index) {
      return '#stop-' + stops[index].getAttribute('data-trip-city');
    }

    function updateHash(index) {
      var hash = hashForStop(index);
      if (window.location.hash === hash) return;
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
      } catch (error) {
        // Hash state is an enhancement; scrolling still works without it.
      }
    }

    function setActive(index, options) {
      var settings = options || {};
      var nextIndex = Math.max(0, Math.min(stops.length - 1, Number(index) || 0));
      activeIndex = nextIndex;

      stops.forEach(function (stop, stopIndex) {
        stop.classList.toggle('is-active', stopIndex === nextIndex);
        if (stopIndex === nextIndex) stop.setAttribute('aria-current', 'step');
        else stop.removeAttribute('aria-current');
      });

      markers.forEach(function (marker, markerIndex) {
        marker.classList.toggle('is-active', markerIndex === nextIndex);
        marker.classList.toggle('is-complete', markerIndex < nextIndex);
        if (markerIndex === nextIndex) marker.setAttribute('aria-current', 'step');
        else marker.removeAttribute('aria-current');
      });

      segments.forEach(function (segment, segmentIndex) {
        segment.classList.toggle('is-complete', segmentIndex < nextIndex);
      });

      if (currentLabel) currentLabel.textContent = stops[nextIndex].querySelector('h3').textContent;
      if (progressLabel) progressLabel.textContent = (nextIndex + 1) + ' / ' + stops.length;
      if (previousButton) previousButton.disabled = nextIndex === 0;
      if (nextButton) nextButton.disabled = nextIndex === stops.length - 1;
      if (settings.updateHash !== false) updateHash(nextIndex);
    }

    function scrollOffset() {
      var offset = navbarHeight() + 20;
      if (mobileViewport.matches && mapPanel) offset += mapPanel.getBoundingClientRect().height + 12;
      return offset;
    }

    function scrollToStop(index, updateState) {
      var nextIndex = Math.max(0, Math.min(stops.length - 1, index));
      var top = stops[nextIndex].getBoundingClientRect().top + window.pageYOffset - scrollOffset();
      if (updateState !== false) setActive(nextIndex);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    }

    function createObserver() {
      if (observer) observer.disconnect();
      if (!('IntersectionObserver' in window)) return;

      var topMargin = Math.round(scrollOffset());
      observer = new IntersectionObserver(function () {
        syncFromScroll();
      }, {
        root: null,
        rootMargin: '-' + topMargin + 'px 0px -42% 0px',
        threshold: [0, 0.15, 0.45]
      });

      stops.forEach(function (stop) { observer.observe(stop); });
    }

    function syncFromScroll() {
      var focusLine = scrollOffset() + Math.min(window.innerHeight * 0.18, 120);
      var bestIndex = 0;
      var bestDistance = Infinity;
      stops.forEach(function (stop, index) {
        var rect = stop.getBoundingClientRect();
        if (rect.top <= focusLine && rect.bottom >= focusLine) {
          bestIndex = index;
          bestDistance = -1;
          return;
        }
        if (bestDistance === -1) return;
        var distance = Math.abs(rect.top - focusLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      setActive(bestIndex);
    }

    function initialIndex() {
      var match = window.location.hash.match(/^#stop-(.+)$/);
      if (!match) return 0;
      var cityId = decodeURIComponent(match[1]);
      var foundIndex = stops.findIndex(function (stop) {
        return stop.getAttribute('data-trip-city') === cityId;
      });
      return foundIndex >= 0 ? foundIndex : 0;
    }

    function handleResize() {
      updateStickyOffset();
      window.clearTimeout(observerTimer);
      observerTimer = window.setTimeout(createObserver, 120);
    }

    if (previousButton) {
      previousButton.addEventListener('click', function () {
        if (activeIndex > 0) scrollToStop(activeIndex - 1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        if (activeIndex < stops.length - 1) scrollToStop(activeIndex + 1);
      });
    }

    root.querySelectorAll('[data-trip-image]').forEach(function (image) {
      image.addEventListener('error', function () {
        if (image.getAttribute('data-fallback-applied') === 'true') return;
        image.setAttribute('data-fallback-applied', 'true');
        image.src = '/img/big04.jpg';
      });
    });

    updateStickyOffset();
    var startIndex = initialIndex();
    setActive(startIndex, { updateHash: false });
    createObserver();

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        syncFromScroll();
        ticking = false;
      });
    }, { passive: true });

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('hashchange', function () {
      scrollToStop(initialIndex());
    });

    if (window.location.hash.indexOf('#stop-') === 0) {
      window.setTimeout(function () { scrollToStop(startIndex, false); }, 80);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTripStory);
  else initTripStory();
})();
