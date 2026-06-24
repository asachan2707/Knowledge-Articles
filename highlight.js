// highlight.js — shared keyword-highlight utility for the Learning Hub.
//
// Feature 1 — Index page: SearchHighlight.apply(el, originalText, query)
//   Wraps matches in <mark class="search-match"> inside a single element.
//   Called on every visible card's title and summary as the user types.
//
// Feature 2 — Detail pages: in-page search bar
//   Injected automatically on any page with class .page (all topic pages).
//   • Floating bar fixed to the top-right corner (Ctrl/Cmd+F or click to open)
//   • Live highlights as the user types, bold amber marks
//   • Match counter  "3 / 11"
//   • Prev / Next buttons to jump between matches, auto-scrolls into view
//   • Esc or ✕ clears and closes
//   • ?q= in the URL pre-fills the bar on page load (click-through from index)
//
// XSS-safe: all DOM mutations use textContent / createElement, never innerHTML.

(function (global) {
  'use strict';

  // ── Skip list for tree-walker ─────────────────────────────────────────────
  // PRE and CODE are intentionally NOT skipped — code examples are valid
  // search targets and users expect to find function names, keywords, etc.
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, MARK: 1, INPUT: 1, TEXTAREA: 1 };

  // ── 1. Single-element highlighter (used by index.html) ────────────────────

  function apply(element, originalText, query) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
    if (!query || !originalText) {
      element.textContent = originalText || '';
      return;
    }
    var text   = originalText;
    var lower  = text.toLowerCase();
    var lowerQ = query.toLowerCase();
    var idx    = 0;
    while (idx < text.length) {
      var found = lower.indexOf(lowerQ, idx);
      if (found === -1) { element.appendChild(document.createTextNode(text.slice(idx))); break; }
      if (found > idx)    element.appendChild(document.createTextNode(text.slice(idx, found)));
      var m = document.createElement('mark');
      m.className = 'search-match';
      m.textContent = text.slice(found, found + lowerQ.length);
      element.appendChild(m);
      idx = found + lowerQ.length;
    }
  }

  // ── 2. Tree-walker: collect all text nodes we are allowed to touch ─────────

  function collectTextNodes(root) {
    var nodes  = [];
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var p = node.parentElement;
          while (p && p !== root) {
            if (SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
            p = p.parentElement;
          }
          return (node.nodeValue && node.nodeValue.trim())
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      },
      false
    );
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  // ── 3. Highlight engine ───────────────────────────────────────────────────
  //
  // State kept in a closure so multiple calls stay coordinated.

  var _currentQuery  = '';
  var _markEls       = [];      // live <mark> elements in DOM order
  var _activeIdx     = -1;      // which mark is "current" (for prev/next)
  var _savedNodes    = [];      // { mark, origText } snapshot for restore
  var _highlightRoot = null;    // root node last passed to highlightInTree

  // Restore all previously highlighted text nodes to plain text.
  // After replacing each <mark> with its plain-text equivalent we call
  // root.normalize() to merge the resulting adjacent text nodes back into
  // single nodes — without this, the next search walk sees fragments like
  // ["p", "y", "thon"] instead of "python" and matches nothing.
  function clearHighlights() {
    _savedNodes.forEach(function (entry) {
      var parent = entry.mark ? entry.mark.parentNode : null;
      if (parent) {
        parent.replaceChild(document.createTextNode(entry.origText), entry.mark);
      }
    });
    // Merge adjacent text nodes produced by the replacements above.
    if (_highlightRoot) {
      _highlightRoot.normalize();
      _highlightRoot = null;
    }
    _savedNodes   = [];
    _markEls      = [];
    _activeIdx    = -1;
    _currentQuery = '';
  }

  // Highlight all occurrences of `query` in the content root.
  // Returns the array of <mark> elements created.
  function highlightInTree(root, query) {
    clearHighlights();
    _highlightRoot = root || null;
    if (!query) return [];

    _currentQuery = query;
    var lowerQ    = query.toLowerCase();
    var textNodes = collectTextNodes(root);
    var marks     = [];

    textNodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      if (text.toLowerCase().indexOf(lowerQ) === -1) return;

      var frag  = document.createDocumentFragment();
      var lower = text.toLowerCase();
      var i     = 0;
      var localMarks = [];

      while (i < text.length) {
        var pos = lower.indexOf(lowerQ, i);
        if (pos === -1) { frag.appendChild(document.createTextNode(text.slice(i))); break; }
        if (pos > i)      frag.appendChild(document.createTextNode(text.slice(i, pos)));
        var m = document.createElement('mark');
        m.className = 'search-match';
        m.textContent = text.slice(pos, pos + lowerQ.length);
        frag.appendChild(m);
        localMarks.push(m);
        i = pos + lowerQ.length;
      }

      // Save enough info to restore later without re-walking the tree.
      var parent = textNode.parentNode;
      var origNodes = Array.prototype.slice.call(frag.childNodes).map(function (n) { return n; });
      // We replace the single text node with the fragment; record which marks
      // were inserted so clearHighlights() can undo each one individually.
      parent.replaceChild(frag, textNode);

      localMarks.forEach(function (mk) {
        _savedNodes.push({ mark: mk, origText: mk.textContent });
        marks.push(mk);
      });
    });

    _markEls   = marks;
    _activeIdx = marks.length > 0 ? 0 : -1;
    return marks;
  }

  // Activate a specific mark (scroll + accent class).
  function activateMark(idx) {
    _markEls.forEach(function (m) { m.classList.remove('search-match-active'); });
    if (idx < 0 || idx >= _markEls.length) return;
    _activeIdx = idx;
    var target = _markEls[idx];
    target.classList.add('search-match-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function goNext() { activateMark((_activeIdx + 1) % _markEls.length); }
  function goPrev() { activateMark((_activeIdx - 1 + _markEls.length) % _markEls.length); }

  // ── 4. URL helper ─────────────────────────────────────────────────────────

  function getUrlQuery() {
    try {
      return (new URLSearchParams(window.location.search).get('q') || '').trim();
    } catch (e) {
      var m = window.location.search.match(/[?&]q=([^&]*)/);
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    }
  }

  // ── 5. In-page search bar (detail pages only) ─────────────────────────────

  function buildSearchBar() {
    // Container
    var bar = document.createElement('div');
    bar.className = 'page-search-bar';
    bar.setAttribute('role', 'search');
    bar.setAttribute('aria-label', 'Search within page');

    // Input
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'page-search-input';
    input.placeholder = 'Search on this page…';
    input.setAttribute('aria-label', 'Search within page');
    input.autocomplete = 'off';
    input.spellcheck = false;

    // Counter  "3 / 11"
    var counter = document.createElement('span');
    counter.className = 'page-search-counter';
    counter.setAttribute('aria-live', 'polite');
    counter.textContent = '';

    // Prev button
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'page-search-btn';
    prevBtn.setAttribute('aria-label', 'Previous match');
    prevBtn.title = 'Previous (Shift+Enter)';
    prevBtn.textContent = '↑';

    // Next button
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'page-search-btn';
    nextBtn.setAttribute('aria-label', 'Next match');
    nextBtn.title = 'Next (Enter)';
    nextBtn.textContent = '↓';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'page-search-btn page-search-close';
    closeBtn.setAttribute('aria-label', 'Close search');
    closeBtn.title = 'Close (Esc)';
    closeBtn.textContent = '✕';

    bar.appendChild(input);
    bar.appendChild(counter);
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    bar.appendChild(closeBtn);

    // Content root (skip the <header> so the back-link area stays clean)
    var contentRoot = document.querySelector('main') || document.body;

    function updateCounter() {
      var total = _markEls.length;
      if (total === 0) {
        counter.textContent = input.value.trim() ? '0 / 0' : '';
        counter.classList.toggle('page-search-counter-empty', !!input.value.trim());
      } else {
        counter.textContent = (_activeIdx + 1) + ' / ' + total;
        counter.classList.remove('page-search-counter-empty');
      }
      prevBtn.disabled = total === 0;
      nextBtn.disabled = total === 0;
    }

    function runSearch() {
      var q = input.value.trim();
      highlightInTree(contentRoot, q);
      if (_markEls.length > 0) activateMark(0);
      updateCounter();
    }

    function openBar() {
      bar.classList.add('is-open');
      input.focus();
      input.select();
    }

    function closeBar() {
      bar.classList.remove('is-open');
      clearHighlights();
      input.value = '';
      counter.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }

    // Wire events
    input.addEventListener('input', function () { runSearch(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) goPrev(); else goNext();
        updateCounter();
      } else if (e.key === 'Escape') {
        closeBar();
      }
    });

    prevBtn.addEventListener('click', function () { goPrev(); updateCounter(); });
    nextBtn.addEventListener('click', function () { goNext(); updateCounter(); });
    closeBtn.addEventListener('click', function () { closeBar(); });

    // Global Ctrl/Cmd+F → open bar (only on detail pages so we don't steal
    // the browser shortcut on the index page where the real search input lives).
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (document.querySelector('.page')) {
          e.preventDefault();
          openBar();
        }
      }
      if (e.key === 'Escape' && bar.classList.contains('is-open')) {
        closeBar();
      }
    });

    return { bar: bar, input: input, openBar: openBar, runSearch: runSearch, updateCounter: updateCounter };
  }

  // ── 6. Auto-init on detail pages ──────────────────────────────────────────

  function initDetailPage() {
    if (!document.querySelector('.page')) return;

    var parts = buildSearchBar();
    document.body.appendChild(parts.bar);

    // Pre-fill from ?q= (click-through from hub search).
    var urlQ = getUrlQuery();
    if (urlQ) {
      parts.input.value = urlQ;
      parts.openBar();
      parts.runSearch();
    }
  }

  // ── 7. Public API ─────────────────────────────────────────────────────────

  global.SearchHighlight = {
    apply:           apply,
    highlightInTree: highlightInTree,
    clearHighlights: clearHighlights,
    getUrlQuery:     getUrlQuery
  };

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(initDetailPage);

}(window));
