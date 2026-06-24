// Read-state tracker for Learning Hub detail pages.
// - Keys topics by their relative path under "topics/" or "projects/".
// - Persists to localStorage so the hub can dim/badge read cards.
// - Adds a "Mark as read" / "Mark as unread" button at the top of the page.
(function () {
  var STORAGE_KEY = 'learningHub.readTopics.v1';

  function topicKeyFromLocation() {
    try {
      var path = decodeURIComponent(window.location.pathname);
      var match = path.match(/(topics|projects)\/.+$/);
      return match ? match[0] : null;
    } catch (e) {
      return null;
    }
  }

  function loadReadSet() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveReadSet(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      // localStorage may be disabled; fail silently.
    }
  }

  function init() {
    var key = topicKeyFromLocation();
    if (!key) return;

    var pageHeader = document.querySelector('.page-header');
    var backLink = document.querySelector('.back-link');
    if (!pageHeader && !backLink) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'read-toggle';
    btn.setAttribute('aria-pressed', 'false');

    function render() {
      var set = loadReadSet();
      var isRead = set.has(key);
      btn.classList.toggle('is-read', isRead);
      btn.setAttribute('aria-pressed', isRead ? 'true' : 'false');
      btn.innerHTML = isRead
        ? '<span class="read-toggle-icon" aria-hidden="true">✓</span><span class="read-toggle-label">Read · Mark unread</span>'
        : '<span class="read-toggle-icon" aria-hidden="true">○</span><span class="read-toggle-label">Mark as read</span>';
    }

    btn.addEventListener('click', function () {
      var set = loadReadSet();
      if (set.has(key)) set.delete(key); else set.add(key);
      saveReadSet(set);
      render();
    });

    render();

    // Insert next to the back-link if present, else at top of header.
    if (backLink && backLink.parentNode) {
      var wrap = document.createElement('div');
      wrap.className = 'page-header-actions';
      backLink.parentNode.insertBefore(wrap, backLink);
      wrap.appendChild(backLink);
      wrap.appendChild(btn);
    } else if (pageHeader) {
      pageHeader.insertBefore(btn, pageHeader.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
