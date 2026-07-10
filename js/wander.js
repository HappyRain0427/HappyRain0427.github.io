(function () {
  'use strict';

  var dataNode = document.getElementById('wander-data');
  var resultNode = document.querySelector('[data-wander-result]');
  if (!dataNode || !resultNode) return;

  var payload;
  try {
    payload = JSON.parse(dataNode.textContent);
  } catch (error) {
    resultNode.setAttribute('aria-busy', 'false');
    return;
  }

  var groups = payload.groups || {};
  var groupNames = ['posts', 'places', 'cats'];
  var fallbackImage = payload.fallbackImage || '/img/big04.jpg';
  var storageKey = 'happyrain:wander-history:v1';
  var historyLimit = 5;
  var selectedMode = 'all';
  var currentId = '';
  var memoryHistory = [];
  var storageAvailable = true;
  var isChanging = false;

  var imageNode = document.querySelector('[data-wander-image]');
  var labelNode = document.querySelector('[data-wander-label]');
  var titleNode = document.querySelector('[data-wander-title]');
  var metaNode = document.querySelector('[data-wander-meta]');
  var descriptionNode = document.querySelector('[data-wander-description]');
  var tagsNode = document.querySelector('[data-wander-tags]');
  var startButton = document.querySelector('[data-wander-start]');
  var openLink = document.querySelector('[data-wander-open]');
  var againButton = document.querySelector('[data-wander-again]');
  var emptyNode = document.querySelector('[data-wander-empty]');
  var historySection = document.querySelector('[data-wander-history-section]');
  var historyNode = document.querySelector('[data-wander-history]');
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-wander-mode]'));

  var itemMap = {};
  groupNames.forEach(function (groupName) {
    if (!Array.isArray(groups[groupName])) groups[groupName] = [];
    groups[groupName].forEach(function (item) {
      if (item && item.id) itemMap[item.id] = item;
    });
  });

  function readHistory() {
    if (!storageAvailable) return memoryHistory.slice();
    try {
      var stored = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) {
        return stored.filter(function (id) { return Boolean(itemMap[id]); }).slice(0, historyLimit);
      }
    } catch (error) {
      storageAvailable = false;
      return memoryHistory.slice();
    }
    return [];
  }

  function writeHistory(ids) {
    memoryHistory = ids.slice(0, historyLimit);
    if (!storageAvailable) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(memoryHistory));
    } catch (error) {
      storageAvailable = false;
    }
  }

  function randomItem(items) {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function poolForMode(mode) {
    if (mode !== 'all') return groups[mode] || [];
    var availableGroups = groupNames.filter(function (groupName) {
      return groups[groupName].length > 0;
    });
    var chosenGroup = randomItem(availableGroups);
    return chosenGroup ? groups[chosenGroup] : [];
  }

  function chooseNext() {
    var pool = poolForMode(selectedMode);
    if (!pool.length) return null;

    var recentIds = readHistory();
    var candidates = pool.filter(function (item) {
      return recentIds.indexOf(item.id) === -1;
    });
    if (!candidates.length) {
      candidates = pool.filter(function (item) { return item.id !== currentId; });
    }
    if (!candidates.length) candidates = pool.slice();
    return randomItem(candidates);
  }

  function fillPills(container, values) {
    container.replaceChildren();
    (values || []).filter(Boolean).forEach(function (value) {
      var pill = document.createElement('span');
      pill.textContent = value;
      container.appendChild(pill);
    });
    container.hidden = container.children.length === 0;
  }

  function updateHistory(item) {
    var ids = readHistory().filter(function (id) { return id !== item.id; });
    ids.unshift(item.id);
    writeHistory(ids.slice(0, historyLimit));
    renderHistory();
  }

  function renderItem(item, addToHistory) {
    if (!item || isChanging) return;
    isChanging = true;
    resultNode.classList.add('is-changing');
    resultNode.setAttribute('aria-busy', 'true');
    startButton.disabled = true;
    againButton.disabled = true;

    window.setTimeout(function () {
      currentId = item.id;
      imageNode.dataset.fallbackApplied = '';
      imageNode.src = item.image || fallbackImage;
      imageNode.alt = item.title || item.label || '随机漫游';
      labelNode.textContent = item.label || '';
      titleNode.textContent = item.title || '';
      descriptionNode.textContent = item.description || '';
      descriptionNode.hidden = !item.description;
      fillPills(metaNode, item.meta);
      fillPills(tagsNode, item.tags);
      openLink.href = item.url || '#';
      openLink.hidden = !item.url;
      startButton.hidden = true;
      againButton.hidden = false;
      emptyNode.hidden = true;

      if (addToHistory !== false) updateHistory(item);

      window.requestAnimationFrame(function () {
        resultNode.classList.remove('is-changing');
        resultNode.setAttribute('aria-busy', 'false');
        startButton.disabled = false;
        againButton.disabled = false;
        window.setTimeout(function () { isChanging = false; }, 90);
      });
    }, 90);
  }

  function draw() {
    var item = chooseNext();
    if (item) renderItem(item, true);
  }

  function createHistoryButton(item) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wander-history-item';
    button.setAttribute('aria-label', '重新查看：' + item.title);

    var image = document.createElement('img');
    image.src = item.image || fallbackImage;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', function () {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = 'true';
      image.src = fallbackImage;
    });

    var copy = document.createElement('span');
    var label = document.createElement('small');
    var title = document.createElement('strong');
    label.textContent = item.label;
    title.textContent = item.title;
    copy.append(label, title);
    button.append(image, copy);
    button.addEventListener('click', function () { renderItem(item, false); });
    return button;
  }

  function renderHistory() {
    var ids = readHistory();
    historyNode.replaceChildren();
    ids.forEach(function (id) {
      if (itemMap[id]) historyNode.appendChild(createHistoryButton(itemMap[id]));
    });
    historySection.hidden = historyNode.children.length === 0;
  }

  function updateModeAvailability() {
    var hasAny = groupNames.some(function (groupName) { return groups[groupName].length > 0; });
    modeButtons.forEach(function (button) {
      var mode = button.dataset.wanderMode;
      button.disabled = mode === 'all' ? !hasAny : !(groups[mode] && groups[mode].length);
    });
    if (!hasAny) {
      startButton.disabled = true;
      emptyNode.hidden = false;
      labelNode.textContent = 'EMPTY';
      titleNode.textContent = '暂时没有可漫游的内容';
      descriptionNode.textContent = '';
    }
  }

  modeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.disabled) return;
      selectedMode = button.dataset.wanderMode;
      modeButtons.forEach(function (candidate) {
        var active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
    });
  });

  imageNode.addEventListener('error', function () {
    if (imageNode.dataset.fallbackApplied) return;
    imageNode.dataset.fallbackApplied = 'true';
    imageNode.src = fallbackImage;
  });
  startButton.addEventListener('click', draw);
  againButton.addEventListener('click', draw);

  updateModeAvailability();
  renderHistory();
})();
