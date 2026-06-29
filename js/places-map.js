(function () {
  var dataNode = document.getElementById('places-map-data');
  var mainMapEl = document.getElementById('places-main-map');
  var modalMapEl = document.getElementById('places-modal-map');
  if (!dataNode || !mainMapEl || !modalMapEl) return;

  function showMapLoadError() {
    mainMapEl.textContent = '地图组件加载失败';
    modalMapEl.textContent = '地图组件加载失败';
  }

  function loadEchartsScript() {
    return new Promise(function (resolve, reject) {
      if (window.echarts) {
        resolve();
        return;
      }

      var existing = document.querySelector('script[src="/js/vendor/echarts.min.js"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = '/js/vendor/echarts.min.js';
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initPlacesMap() {
    if (!window.echarts) {
      showMapLoadError();
      return;
    }

  var PROVINCE_NAMES = {
    '110000': '北京',
    '120000': '天津',
    '130000': '河北',
    '140000': '山西',
    '150000': '内蒙古',
    '210000': '辽宁',
    '220000': '吉林',
    '230000': '黑龙江',
    '310000': '上海',
    '320000': '江苏',
    '330000': '浙江',
    '340000': '安徽',
    '350000': '福建',
    '360000': '江西',
    '370000': '山东',
    '410000': '河南',
    '420000': '湖北',
    '430000': '湖南',
    '440000': '广东',
    '450000': '广西',
    '460000': '海南',
    '500000': '重庆',
    '510000': '四川',
    '520000': '贵州',
    '530000': '云南',
    '540000': '西藏',
    '610000': '陕西',
    '620000': '甘肃',
    '630000': '青海',
    '640000': '宁夏',
    '650000': '新疆',
    '710000': '台湾',
    '810000': '香港',
    '820000': '澳门'
  };

  var CHINA_MAP = 'happyrain-china-places';
  var payload = JSON.parse(dataNode.textContent || '{}');
  var provinces = payload.provinces || [];
  var cities = payload.cities || [];
  var provinceById = {};
  var citiesById = {};
  var mapGeoJson = null;
  var provinceMapRegistered = {};

  provinces.forEach(function (province) {
    province.id = String(province.id);
    provinceById[province.id] = province;
  });

  cities.forEach(function (city) {
    city.provinceId = String(city.provinceId);
    citiesById[city.id] = city;
  });

  var modal = document.getElementById('places-map-modal');
  var modalTitle = document.querySelector('[data-places-modal-title]');
  var modalSubtitle = document.querySelector('[data-places-modal-subtitle]');
  var modalKicker = document.querySelector('[data-places-modal-kicker]');
  var provincePanel = document.querySelector('[data-places-province-panel]');
  var backButton = document.querySelector('[data-places-map-back]');

  function cssVar(name, fallback) {
    var root = document.querySelector('.places-shell') || document.documentElement;
    var value = window.getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  function colors() {
    return {
      surface: cssVar('--places-surface', '#ffffff'),
      mapBg: cssVar('--places-map-bg-solid', '#edf4fb'),
      area: cssVar('--places-map-area', '#f8fbff'),
      visited: cssVar('--places-map-visited', '#8ea5dd'),
      visitedHover: cssVar('--places-map-visited-hover', '#6f8ed8'),
      border: cssVar('--places-map-border', '#b7c3d2'),
      text: cssVar('--places-text', '#1e2022'),
      muted: cssVar('--places-muted', '#6d819c'),
      accent: cssVar('--places-accent', '#4f7bd9'),
      labelBg: cssVar('--places-label-bg', 'rgba(255,255,255,0.92)')
    };
  }

  function provinceIdOfFeature(feature) {
    var props = feature && feature.properties ? feature.properties : {};
    var parent = props.parent || {};
    if (parent.adcode && String(parent.adcode) !== '100000') return String(parent.adcode);
    if (props.level === 'province' && props.adcode) return String(props.adcode);
    if (props.adcode && /^\d{6}$/.test(String(props.adcode))) {
      return String(props.adcode).slice(0, 2) + '0000';
    }
    return '';
  }

  function provinceName(provinceId) {
    return (provinceById[provinceId] && provinceById[provinceId].name) || PROVINCE_NAMES[provinceId] || provinceId;
  }

  function cityNames(province) {
    return (province.cities || []).map(function (city) {
      return city.name;
    });
  }

  function mainMapData() {
    return (mapGeoJson.features || []).map(function (feature) {
      var props = feature.properties || {};
      var provinceId = provinceIdOfFeature(feature);
      var province = provinceById[provinceId];
      var visited = Boolean(province);
      var palette = colors();
      return {
        name: props.name || '',
        value: visited ? 1 : 0,
        provinceId: provinceId,
        provinceName: provinceName(provinceId),
        cityNames: province ? cityNames(province) : [],
        visited: visited,
        itemStyle: {
          areaColor: visited ? palette.visited : palette.area,
          borderColor: palette.border,
          borderWidth: visited ? 0.9 : 0.55
        },
        emphasis: {
          disabled: !visited,
          itemStyle: {
            areaColor: visited ? palette.visitedHover : palette.area
          }
        }
      };
    });
  }

  function baseTooltip(params) {
    var data = params.data || {};
    if (data.visited) {
      return '<strong>' + data.provinceName + '</strong><br>已记录：' + data.cityNames.join('、') + '<br>点击查看省内足迹';
    }
    return '<strong>' + (data.provinceName || params.name || '未命名区域') + '</strong><br>暂未记录旅行文章';
  }

  function makeMainOption(context) {
    var palette = colors();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: baseTooltip
      },
      series: [{
        id: context.role + '-main-map',
        name: '足迹省份',
        type: 'map',
        map: CHINA_MAP,
        roam: true,
        zoom: context.zoom,
        scaleLimit: { min: 0.8, max: 8 },
        label: { show: false },
        selectedMode: false,
        data: mainMapData(),
        itemStyle: {
          areaColor: palette.area,
          borderColor: palette.border,
          borderWidth: 0.55
        },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: palette.visitedHover }
        }
      }]
    };
  }

  function makeProvinceGeoJson(provinceId) {
    return {
      type: 'FeatureCollection',
      features: (mapGeoJson.features || []).filter(function (feature) {
        return provinceIdOfFeature(feature) === provinceId;
      })
    };
  }

  function registerProvinceMap(provinceId) {
    var mapName = 'happyrain-province-' + provinceId;
    if (!provinceMapRegistered[mapName]) {
      window.echarts.registerMap(mapName, makeProvinceGeoJson(provinceId));
      provinceMapRegistered[mapName] = true;
    }
    return mapName;
  }

  function provinceScatterData(province) {
    return (province.cities || []).filter(function (city) {
      return Array.isArray(city.coord) && city.coord.length === 2;
    }).map(function (city) {
      return {
        name: city.name,
        cityId: city.id,
        value: [Number(city.coord[0]), Number(city.coord[1]), 1],
        summary: city.summary || '',
        posts: city.posts || []
      };
    });
  }

  function makeProvinceOption(context, provinceId) {
    var palette = colors();
    var province = provinceById[provinceId];
    var mapName = registerProvinceMap(provinceId);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: function (params) {
          if (params.seriesType === 'scatter') {
            var posts = params.data.posts || [];
            return '<strong>' + params.name + '</strong><br>' + (params.data.summary || '') + (posts.length ? '<br>关联文章：' + posts.length + ' 篇' : '');
          }
          return params.name || province.name;
        }
      },
      geo: {
        id: context.role + '-province-geo',
        map: mapName,
        roam: true,
        zoom: context.zoom,
        scaleLimit: { min: 0.8, max: 10 },
        label: { show: false },
        itemStyle: {
          areaColor: palette.area,
          borderColor: palette.border,
          borderWidth: 0.8
        },
        emphasis: {
          label: { show: false },
          itemStyle: {
            areaColor: palette.visited
          }
        }
      },
      series: [{
        id: context.role + '-city-points',
        name: '已去过城市',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: provinceScatterData(province),
        symbolSize: 12,
        itemStyle: {
          color: palette.accent,
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(67, 110, 190, 0.28)'
        },
        label: {
          show: true,
          formatter: '{b}',
          position: 'right',
          color: palette.text,
          backgroundColor: palette.labelBg,
          borderRadius: 6,
          padding: [3, 6],
          fontWeight: 700
        },
        emphasis: {
          scale: 1.25,
          label: {
            color: palette.accent
          }
        }
      }]
    };
  }

  function ChartContext(role, element) {
    this.role = role;
    this.element = element;
    this.chart = window.echarts.init(element, null, { renderer: 'canvas' });
    this.mode = 'main';
    this.provinceId = null;
    this.zoom = 1;
  }

  ChartContext.prototype.renderMain = function () {
    this.mode = 'main';
    this.provinceId = null;
    this.zoom = 1;
    this.chart.clear();
    this.chart.setOption(makeMainOption(this), true);
  };

  ChartContext.prototype.renderProvince = function (provinceId) {
    this.mode = 'province';
    this.provinceId = provinceId;
    this.zoom = 1;
    this.chart.clear();
    this.chart.setOption(makeProvinceOption(this, provinceId), true);
  };

  ChartContext.prototype.zoomBy = function (factor) {
    this.zoom = Math.max(0.8, Math.min(10, this.zoom * factor));
    if (this.mode === 'province') {
      this.chart.setOption({ geo: { id: this.role + '-province-geo', zoom: this.zoom } });
      return;
    }
    this.chart.setOption({ series: [{ id: this.role + '-main-map', zoom: this.zoom }] });
  };

  ChartContext.prototype.reset = function () {
    if (this.mode === 'province' && this.provinceId) {
      this.renderProvince(this.provinceId);
      return;
    }
    this.renderMain();
  };

  var mainContext = new ChartContext('main', mainMapEl);
  var modalContext = new ChartContext('modal', modalMapEl);

  function openModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('places-map-modal-open');
    window.setTimeout(function () {
      modalContext.chart.resize();
    }, 40);
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('places-map-modal-open');
  }

  function renderPanelEmpty() {
    provincePanel.innerHTML = '<p class="places-panel-empty">选择一个省份，查看那里的城市和记录。</p>';
  }

  function cityPostLinks(city) {
    if (!city.posts || !city.posts.length) {
      return '<span class="places-empty">暂无关联文章</span>';
    }
    return city.posts.map(function (post) {
      return '<a href="' + post.url + '"><span>' + post.title + '</span><time>' + post.date + '</time></a>';
    }).join('');
  }

  function renderProvincePanel(province) {
    var cityHtml = (province.cities || []).map(function (city) {
      return '<article class="places-province-city">' +
        '<button type="button" data-places-city-target="' + city.id + '">' + city.name + '</button>' +
        '<p>' + (city.summary || '') + '</p>' +
        '<div class="places-province-posts">' + cityPostLinks(city) + '</div>' +
      '</article>';
    }).join('');
    provincePanel.innerHTML = '<div class="places-province-heading">' +
      '<span>' + province.name + '</span>' +
      '<strong>' + (province.cities || []).length + ' 个城市</strong>' +
      '</div>' + cityHtml;
  }

  function updateModalHeader(mode, province) {
    if (mode === 'province' && province) {
      modalKicker.textContent = 'Province Map';
      modalTitle.textContent = province.name + '足迹';
      modalSubtitle.textContent = '已记录城市：' + cityNames(province).join('、');
      backButton.hidden = false;
      return;
    }
    modalKicker.textContent = 'Travel Map';
    modalTitle.textContent = '足迹地图';
    modalSubtitle.textContent = '选择点亮的省份，看看那里的城市足迹。';
    backButton.hidden = true;
  }

  function showModalMain() {
    openModal();
    updateModalHeader('main');
    renderPanelEmpty();
    modalContext.renderMain();
  }

  function showProvince(provinceId) {
    var province = provinceById[provinceId];
    if (!province) return;
    openModal();
    updateModalHeader('province', province);
    renderProvincePanel(province);
    modalContext.renderProvince(provinceId);
  }

  function scrollToCity(cityId) {
    var target = document.getElementById('place-' + cityId);
    if (!target) return;
    closeModal();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (history.pushState) {
      history.pushState(null, '', '#place-' + cityId);
    } else {
      window.location.hash = 'place-' + cityId;
    }
  }

  function bindChartEvents(context) {
    context.chart.on('click', function (params) {
      if (context.role === 'main') {
        if (params.data && params.data.visited) {
          showProvince(params.data.provinceId);
          return;
        }
        showModalMain();
        return;
      }

      if (params.seriesType === 'scatter' && params.data && params.data.cityId) {
        scrollToCity(params.data.cityId);
        return;
      }
      if (!params.data || !params.data.visited) return;
      showProvince(params.data.provinceId);
    });

    if (context.role === 'main') {
      context.chart.getZr().on('click', function (event) {
        if (!event.target) {
          showModalMain();
        }
      });
    }
  }

  function currentContextFromControl(control) {
    var scope = control.closest('.places-map-modal-panel, .places-map-card');
    if (!scope) return null;
    return scope.classList.contains('places-map-modal-panel') ? modalContext : mainContext;
  }

  document.addEventListener('click', function (event) {
    var control = event.target.closest('[data-places-map-control]');
    if (control) {
      var context = currentContextFromControl(control);
      if (!context) return;
      var action = control.getAttribute('data-places-map-control');
      if (action === 'zoom-in') context.zoomBy(1.25);
      if (action === 'zoom-out') context.zoomBy(0.8);
      if (action === 'reset') context.reset();
      return;
    }

    if (event.target.closest('[data-places-map-open]')) {
      showModalMain();
      return;
    }

    if (event.target.closest('[data-places-map-back]')) {
      showModalMain();
      return;
    }

    if (event.target.closest('[data-places-map-close]')) {
      closeModal();
      return;
    }

    var cityButton = event.target.closest('[data-places-city-target]');
    if (cityButton) {
      scrollToCity(cityButton.getAttribute('data-places-city-target'));
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
  });

  function rerenderCurrent() {
    if (!mapGeoJson) return;
    mainContext.mode === 'province' && mainContext.provinceId
      ? mainContext.renderProvince(mainContext.provinceId)
      : mainContext.renderMain();
    modalContext.mode === 'province' && modalContext.provinceId
      ? modalContext.renderProvince(modalContext.provinceId)
      : modalContext.renderMain();
  }

  function resizeCharts() {
    mainContext.chart.resize();
    modalContext.chart.resize();
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeCharts, 120);
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      rerenderCurrent();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-user-color-scheme']
    });
  }

  fetch(payload.geojsonUrl)
    .then(function (response) {
      if (!response.ok) throw new Error('GeoJSON request failed');
      return response.json();
    })
    .then(function (geoJson) {
      mapGeoJson = geoJson;
      window.echarts.registerMap(CHINA_MAP, mapGeoJson);
      mainContext.renderMain();
      modalContext.renderMain();
      bindChartEvents(mainContext);
      bindChartEvents(modalContext);
    })
    .catch(function () {
      mainMapEl.textContent = '地图数据加载失败';
      modalMapEl.textContent = '地图数据加载失败';
    });

  }

  if (window.echarts) {
    initPlacesMap();
    return;
  }

  loadEchartsScript()
    .then(initPlacesMap)
    .catch(showMapLoadError);
})();
