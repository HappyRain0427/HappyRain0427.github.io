(function () {
  'use strict';

  var selector = '#hexo-blog-encrypt';
  var originalAlert = window.alert;

  function container() {
    return document.querySelector(selector);
  }

  function statusElement(root) {
    return root && root.querySelector('[data-hbe-status]');
  }

  function setStatus(root, message, type) {
    var status = statusElement(root);
    if (!status) return;

    root.classList.remove('is-error');
    status.classList.remove('is-error', 'is-success');
    status.textContent = message || '';

    if (type) {
      status.classList.add('is-' + type);
      if (type === 'error') root.classList.add('is-error');
    }
  }

  function setChecking(root, checking) {
    var button = root.querySelector('[data-hbe-unlock]');
    root.classList.toggle('is-checking', checking);
    root.setAttribute('aria-busy', checking ? 'true' : 'false');
    if (button) {
      button.disabled = checking;
      button.textContent = checking ? '正在验证...' : '解锁文章';
    }
  }

  function translateRelockButton() {
    var button = document.querySelector(selector + ' .hbe-button');
    if (!button) return;
    if (/Encrypt again/i.test(button.textContent || '')) {
      button.textContent = '重新加密';
    }
    button.classList.add('hbe-relock-button');
  }

  function showError(root, message) {
    if (!root) return;
    enhance(root);
    setChecking(root, false);
    setStatus(root, message || '密码不正确，请重新输入。', 'error');

    var input = root.querySelector('#hbePass');
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      input.select();
    }
  }

  window.alert = function (message) {
    var root = container();
    var wrongPassMessage = root && root.dataset ? root.dataset.wpm : '';

    if (root && String(message) === String(wrongPassMessage)) {
      showError(root, message || '密码不正确，请重新输入。');
      return;
    }

    return originalAlert.apply(window, arguments);
  };

  function dispatchEnter(root) {
    var event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter'
    });

    try {
      Object.defineProperty(event, 'keyCode', { get: function () { return 13; } });
      Object.defineProperty(event, 'which', { get: function () { return 13; } });
    } catch (error) {
      // Some browsers expose keyCode as a read-only legacy field. The key value still reaches modern handlers.
    }

    root.dispatchEvent(event);
  }

  function unlock(root) {
    var input = root.querySelector('#hbePass');
    if (!input) return;

    if (!input.value.trim()) {
      showError(root, '请先输入访问密码。');
      return;
    }

    input.removeAttribute('aria-invalid');
    setStatus(root, '正在验证...', '');
    setChecking(root, true);
    dispatchEnter(root);
  }

  function enhance(root) {
    if (!root || !root.querySelector('#hbePass')) {
      translateRelockButton();
      return;
    }

    if (root.classList.contains('hbe-enhanced')) return;

    var input = root.querySelector('#hbePass');
    var currentValue = input.value || '';
    var content = root.querySelector('.hbe-content');
    if (!content) return;

    root.classList.add('hbe-enhanced');
    content.className = 'hbe hbe-content hbe-lock-panel';
    content.innerHTML = [
      '<div class="hbe-lock-header">',
      '  <span class="hbe-lock-mark" aria-hidden="true"></span>',
      '  <div class="hbe-lock-copy">',
      '    <p class="hbe-lock-kicker">PRIVATE POST</p>',
      '    <h2 class="hbe-lock-title">这篇记录已加密</h2>',
      '    <p class="hbe-lock-desc">输入访问密码后即可继续阅读。</p>',
      '  </div>',
      '</div>',
      '<div class="hbe-lock-controls">',
      '  <label class="hbe-password-label" for="hbePass">访问密码</label>',
      '  <div class="hbe-password-row">',
      '    <div class="hbe-password-field">',
      '      <input class="hbe hbe-input-field hbe-input-field-default hbe-password-input" type="password" id="hbePass" autocomplete="current-password" placeholder="请输入访问密码" aria-describedby="hbeStatus">',
      '      <button class="hbe-password-toggle" type="button" data-hbe-toggle aria-label="显示密码" title="显示密码"><i class="iconfont icon-eye" aria-hidden="true"></i><span class="hbe-sr-only">显示密码</span></button>',
      '    </div>',
      '    <button class="hbe-unlock-button" type="button" data-hbe-unlock>解锁文章</button>',
      '  </div>',
      '  <p class="hbe-status" id="hbeStatus" data-hbe-status aria-live="polite"></p>',
      '</div>'
    ].join('');

    input = root.querySelector('#hbePass');
    input.value = currentValue;

    var unlockButton = root.querySelector('[data-hbe-unlock]');
    var toggleButton = root.querySelector('[data-hbe-toggle]');
    var toggleLabel = toggleButton.querySelector('.hbe-sr-only');

    unlockButton.addEventListener('click', function () {
      unlock(root);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        if (!input.value.trim()) {
          event.preventDefault();
          event.stopPropagation();
          showError(root, '请先输入访问密码。');
          return;
        }
        input.removeAttribute('aria-invalid');
        setStatus(root, '正在验证...', '');
        setChecking(root, true);
      }
    });

    input.addEventListener('input', function () {
      if (root.classList.contains('is-error')) {
        input.removeAttribute('aria-invalid');
        setStatus(root, '', '');
      }
    });

    toggleButton.addEventListener('click', function () {
      var visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggleButton.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
      toggleButton.setAttribute('title', visible ? '显示密码' : '隐藏密码');
      toggleLabel.textContent = visible ? '显示密码' : '隐藏密码';
      input.focus();
    });
  }

  function init() {
    var root = container();
    if (!root) return;
    enhance(root);
    translateRelockButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hexo-blog-decrypt', function () {
    var root = container();
    if (root) {
      root.classList.remove('is-checking', 'is-error');
      root.classList.add('hbe-decrypted');
      root.removeAttribute('aria-busy');
    }
    translateRelockButton();
  });
})();
