/**
 * chat-widget.js — Learning Hub floating agent chat widget
 *
 * Drop one <script src="./chat-widget.js" defer></script> on any page.
 * The widget injects its own shadow-DOM-free styles and builds the full UI.
 *
 * Config (optional window globals set BEFORE this script loads):
 *   window.AGENT_URL  — backend URL, default http://localhost:3030
 */

(function () {
  'use strict';

  var AGENT_URL   = (window.AGENT_URL || 'http://localhost:3030').replace(/\/$/, '');
  var STORAGE_KEY = 'learningHub.chatSession.v1';

  // ── Topic-page detection ────────────────────────────────────────────────────
  // If we're on a topic detail page (.page class present), scope the agent to
  // that article only. We derive:
  //   topicRel   — relative path under the hub root (e.g. "topics/20-ai-concepts…html")
  //   topicTitle — the page's <h1> text
  //   topicSuggestions — generated from the page's <h2> headings

  var topicRel   = null;   // null = hub home → global mode
  var topicTitle = null;

  (function detectTopicPage() {
    if (!document.querySelector('.page')) return;  // not a detail page

    // Build rel path: strip leading slash, keep everything after the origin
    var path = window.location.pathname.replace(/^\/+/, '');
    // Normalise: if served from file://, location.pathname is absolute on disk;
    // extract the part starting with "topics/" or "projects/"
    var m = path.match(/((?:topics|projects)\/.+)/);
    topicRel = m ? m[1] : path || null;

    var h1 = document.querySelector('h1');
    topicTitle = h1 ? h1.textContent.trim() : null;
  }());

  // Generate suggestion chips from <h2> headings on the current page.
  // Returns up to 5 question strings.
  function buildTopicSuggestions() {
    var headings = Array.prototype.slice.call(document.querySelectorAll('.content-card h2, .story-card h2'));
    var seen = {};
    var questions = [];
    headings.forEach(function (h) {
      var text = h.textContent.trim().replace(/\s+/g, ' ');
      // Skip very short or duplicate headings
      if (text.length < 6 || seen[text]) return;
      seen[text] = true;
      // Turn "The agent loop — think, act, observe, repeat" → "Explain the agent loop"
      var short = text.split(/[—–:]/)[0].trim();
      questions.push('Explain: ' + short);
    });
    // Pad with a couple of generic article-level questions if headings are sparse
    if (topicTitle) {
      questions.unshift('Summarise this article in 3 bullet points');
      questions.push('What are the key takeaways from "' + topicTitle + '"?');
    }
    return questions.slice(0, 5);
  }

  // ── Session ID ──────────────────────────────────────────────────────────────

  function getSessionId() {
    try {
      var id = sessionStorage.getItem(STORAGE_KEY);
      if (id) return id;
      id = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch (_) {
      return 'sess-' + Math.random().toString(36).slice(2);
    }
  }

  var sessionId = getSessionId();

  // ── Inject styles ───────────────────────────────────────────────────────────

  var CSS = `
/* ── Chat widget ─────────────────────────────────────────────── */
#lh-chat-fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 10000;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #0f766e;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(15,118,110,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
#lh-chat-fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(15,118,110,.55); }
#lh-chat-fab .lh-fab-icon-open  { display: flex; }
#lh-chat-fab .lh-fab-icon-close { display: none; }
#lh-chat-fab.is-open .lh-fab-icon-open  { display: none; }
#lh-chat-fab.is-open .lh-fab-icon-close { display: flex; }

#lh-chat-panel {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  z-index: 9999;
  width: min(420px, calc(100vw - 2rem));
  height: min(560px, calc(100vh - 7rem));
  border: 1px solid #e7e5df;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(15,23,42,.18);
  display: none;
  flex-direction: column;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
}
#lh-chat-panel.is-open { display: flex; }

/* Header */
.lh-chat-header {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .8rem 1rem;
  background: #0f766e;
  color: #fff;
  flex-shrink: 0;
}
.lh-chat-header-icon {
  font-size: 1.15rem;
  line-height: 1;
}
.lh-chat-header-title {
  flex: 1;
  font-weight: 700;
  font-size: .95rem;
}
.lh-chat-header-sub {
  font-size: .72rem;
  opacity: .8;
  white-space: nowrap;
}
.lh-chat-clear {
  background: transparent;
  border: 1px solid rgba(255,255,255,.4);
  border-radius: 6px;
  color: #fff;
  font-size: .72rem;
  font-weight: 700;
  padding: .22rem .5rem;
  cursor: pointer;
  transition: background 120ms;
}
.lh-chat-clear:hover { background: rgba(255,255,255,.15); }

/* Messages */
.lh-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: .9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
  scroll-behavior: smooth;
}

.lh-msg {
  max-width: 88%;
  padding: .6rem .85rem;
  border-radius: 14px;
  font-size: .875rem;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
.lh-msg-user {
  align-self: flex-end;
  background: #0f766e;
  color: #fff;
  border-bottom-right-radius: 4px;
}
.lh-msg-agent {
  align-self: flex-start;
  background: #f4f4f1;
  color: #222;
  border-bottom-left-radius: 4px;
}
.lh-msg-agent strong { color: #0f766e; }

/* Sources */
.lh-sources {
  align-self: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: .3rem;
  max-width: 100%;
  padding: 0 .1rem;
}
.lh-source-chip {
  display: inline-flex;
  align-items: center;
  gap: .25rem;
  padding: .15rem .5rem;
  border: 1px solid #d1fae5;
  border-radius: 999px;
  background: #ecfdf5;
  color: #065f46;
  font-size: .7rem;
  font-weight: 700;
  text-decoration: none;
  transition: background 120ms;
  cursor: pointer;
}
.lh-source-chip:hover { background: #d1fae5; }
.lh-source-label {
  margin-right: .1rem;
  opacity: .6;
  font-weight: 400;
}

/* Typing indicator */
.lh-typing {
  align-self: flex-start;
  display: flex;
  gap: 5px;
  padding: .55rem .7rem;
  background: #f4f4f1;
  border-radius: 14px;
  border-bottom-left-radius: 4px;
}
.lh-typing span {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #0f766e;
  animation: lh-bounce 1.1s infinite ease-in-out;
}
.lh-typing span:nth-child(2) { animation-delay: .18s; }
.lh-typing span:nth-child(3) { animation-delay: .36s; }
@keyframes lh-bounce {
  0%,80%,100% { transform: translateY(0); opacity: .5; }
  40%         { transform: translateY(-6px); opacity: 1; }
}

/* Empty state */
.lh-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  color: #5f5f5b;
  font-size: .88rem;
  text-align: center;
  padding: 1rem;
}
.lh-empty-icon { font-size: 2.2rem; }

/* Suggestions */
.lh-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
  justify-content: center;
  padding: 0 .5rem;
}
.lh-suggestion {
  padding: .3rem .7rem;
  border: 1px solid #e7e5df;
  border-radius: 999px;
  background: #fff;
  color: #0f766e;
  font-size: .78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.lh-suggestion:hover { background: #f0fdfa; border-color: #0f766e; }

/* Input bar */
.lh-chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: .5rem;
  padding: .7rem .9rem;
  border-top: 1px solid #e7e5df;
  background: #fff;
  flex-shrink: 0;
}
.lh-chat-textarea {
  flex: 1;
  resize: none;
  border: 1px solid #e7e5df;
  border-radius: 10px;
  padding: .5rem .7rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: .875rem;
  color: #222;
  background: #f8fafc;
  max-height: 120px;
  line-height: 1.5;
  transition: border-color 120ms, box-shadow 120ms;
  outline: none;
}
.lh-chat-textarea:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15,118,110,.12);
  background: #fff;
}
.lh-chat-send {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: none;
  border-radius: 9px;
  background: #0f766e;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms, transform 120ms;
}
.lh-chat-send:hover  { background: #0d6860; transform: scale(1.05); }
.lh-chat-send:disabled { background: #cbd5e1; cursor: default; transform: none; }

/* Error bubble */
.lh-msg-error {
  align-self: flex-start;
  background: #fff1f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 14px;
  border-bottom-left-radius: 4px;
  font-size: .85rem;
  padding: .6rem .85rem;
  max-width: 88%;
}

/* Unread badge on FAB */
.lh-fab-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #dc2626;
  border: 2px solid #fff;
  font-size: .58rem;
  font-weight: 800;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 480px) {
  #lh-chat-panel {
    bottom: 5rem;
    right: .75rem;
    width: calc(100vw - 1.5rem);
    height: calc(100vh - 6.5rem);
  }
  #lh-chat-fab { bottom: 1rem; right: 1rem; }
}
`;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Build DOM ───────────────────────────────────────────────────────────────

  // FAB button
  var fab = document.createElement('button');
  fab.id = 'lh-chat-fab';
  fab.setAttribute('aria-label', 'Open Learning Hub chat');
  fab.innerHTML =
    '<span class="lh-fab-icon-open" aria-hidden="true">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
    '</span>' +
    '<span class="lh-fab-icon-close" aria-hidden="true">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
    '</span>';

  // Panel
  var panel = document.createElement('div');
  panel.id = 'lh-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Learning Hub agent chat');

  var headerSub  = topicRel
    ? 'Focused on this article only'
    : 'Ask anything about the topics';
  var emptyIcon  = topicRel ? '🔍' : '📚';
  var emptyText  = topicRel
    ? 'Ask me anything about <strong style="color:#0f766e">' +
        (topicTitle || 'this article') + '</strong>.'
    : 'Ask me anything about the topics in this hub.';

  panel.innerHTML =
    '<div class="lh-chat-header">' +
      '<span class="lh-chat-header-icon" aria-hidden="true">🤖</span>' +
      '<span class="lh-chat-header-title">Hub Agent</span>' +
      '<span class="lh-chat-header-sub" id="lh-chat-header-sub">' + headerSub + '</span>' +
      '<button class="lh-chat-clear" id="lh-chat-clear" title="Clear conversation">Clear</button>' +
    '</div>' +
    '<div class="lh-chat-messages" id="lh-chat-messages">' +
      '<div class="lh-empty" id="lh-empty">' +
        '<span class="lh-empty-icon">' + emptyIcon + '</span>' +
        '<span>' + emptyText + '</span>' +
        '<div class="lh-suggestions" id="lh-suggestions"></div>' +
      '</div>' +
    '</div>' +
    '<div class="lh-chat-input-bar">' +
      '<textarea class="lh-chat-textarea" id="lh-chat-textarea" rows="1" ' +
        'placeholder="Ask a question…" aria-label="Your message"></textarea>' +
      '<button class="lh-chat-send" id="lh-chat-send" aria-label="Send">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
      '</button>' +
    '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var messagesEl = document.getElementById('lh-chat-messages');
  var emptyEl    = document.getElementById('lh-empty');
  var textarea   = document.getElementById('lh-chat-textarea');
  var sendBtn    = document.getElementById('lh-chat-send');
  var clearBtn   = document.getElementById('lh-chat-clear');
  var suggestEl  = document.getElementById('lh-suggestions');

  // ── Suggestion chips ────────────────────────────────────────────────────────

  var GLOBAL_SUGGESTIONS = [
    'What is MCP and how does it work?',
    'Explain RAG in simple terms',
    'What is a discriminated union in TypeScript?',
    'What are Salesforce governor limits?',
    'How does Docker multi-stage build work?',
    'How does BM25 differ from vector search?',
  ];

  var suggestions = topicRel ? buildTopicSuggestions() : GLOBAL_SUGGESTIONS;

  suggestions.forEach(function (s) {
    var btn = document.createElement('button');
    btn.className = 'lh-suggestion';
    btn.textContent = s;
    btn.addEventListener('click', function () { sendMessage(s); });
    suggestEl.appendChild(btn);
  });

  // ── Toggle open / close ────────────────────────────────────────────────────

  var isOpen = false;

  function openPanel() {
    isOpen = true;
    fab.classList.add('is-open');
    panel.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    removeBadge();
    textarea.focus();
  }

  function closePanel() {
    isOpen = false;
    fab.classList.remove('is-open');
    panel.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', function () {
    if (isOpen) closePanel(); else openPanel();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // ── Unread badge ───────────────────────────────────────────────────────────

  function showBadge() {
    if (fab.querySelector('.lh-fab-badge')) return;
    var b = document.createElement('span');
    b.className = 'lh-fab-badge';
    b.textContent = '1';
    fab.appendChild(b);
  }

  function removeBadge() {
    var b = fab.querySelector('.lh-fab-badge');
    if (b) fab.removeChild(b);
  }

  // ── Message rendering ──────────────────────────────────────────────────────

  function hideEmpty() {
    if (emptyEl) emptyEl.style.display = 'none';
  }

  function appendMessage(role, text) {
    hideEmpty();
    var div = document.createElement('div');
    div.className = role === 'user' ? 'lh-msg lh-msg-user' : 'lh-msg lh-msg-agent';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendError(text) {
    hideEmpty();
    var div = document.createElement('div');
    div.className = 'lh-msg-error';
    div.textContent = '⚠ ' + text;
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function appendTyping() {
    hideEmpty();
    var div = document.createElement('div');
    div.className = 'lh-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendSources(sources) {
    if (!sources || sources.length === 0) return;
    var wrap = document.createElement('div');
    wrap.className = 'lh-sources';
    var label = document.createElement('span');
    label.className = 'lh-source-label';
    label.style.cssText = 'font-size:.68rem;color:#5f5f5b;align-self:center;';
    label.textContent = 'Sources:';
    wrap.appendChild(label);
    sources.forEach(function (s) {
      var chip = document.createElement('span');
      chip.className = 'lh-source-chip';
      chip.textContent = s.title;
      chip.title = s.rel;
      // Navigate to the article carrying the last query
      chip.addEventListener('click', function () {
        var q = textarea.value.trim() || '';
        var sep = s.rel.indexOf('?') === -1 ? '?' : '&';
        var href = '/' + s.rel + (q ? sep + 'q=' + encodeURIComponent(q) : '');
        // Resolve relative to hub root
        window.open(href, '_blank', 'noopener');
      });
      wrap.appendChild(chip);
    });
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Auto-grow textarea ─────────────────────────────────────────────────────

  textarea.addEventListener('input', function () {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // ── Send logic ─────────────────────────────────────────────────────────────

  var busy = false;

  function setInputLocked(locked) {
    busy = locked;
    sendBtn.disabled = locked;
    textarea.readOnly = locked;
  }

  async function sendMessage(text) {
    text = (text || textarea.value).trim();
    if (!text || busy) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    appendMessage('user', text);
    var typingEl = appendTyping();
    setInputLocked(true);

    var agentDiv = null;
    var buffer   = '';

    try {
      var res = await fetch(AGENT_URL + '/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, sessionId: sessionId, topicRel: topicRel || undefined })
      });

      if (!res.ok) {
        var err = await res.json().catch(function () { return { error: res.statusText }; });
        throw new Error(err.error || res.statusText);
      }

      var reader  = res.body.getReader();
      var decoder = new TextDecoder();
      var partial = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        partial += decoder.decode(result.value, { stream: true });

        // SSE lines
        var lines = partial.split('\n');
        partial = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data:')) continue;
          var json;
          try { json = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }

          if (json.error) throw new Error(json.error);

          if (json.delta) {
            if (!agentDiv) {
              // First token — remove typing indicator, create agent bubble
              if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
              typingEl = null;
              agentDiv = appendMessage('agent', '');
            }
            buffer += json.delta;
            agentDiv.textContent = buffer;
            scrollBottom();
          }

          if (json.done) {
            appendSources(json.sources);
            if (!isOpen) showBadge();
          }
        }
      }

    } catch (err) {
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      appendError(err.message || 'Something went wrong. Is the agent server running?');
    } finally {
      setInputLocked(false);
      textarea.focus();
    }
  }

  sendBtn.addEventListener('click', function () { sendMessage(); });

  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ── Clear conversation ─────────────────────────────────────────────────────

  clearBtn.addEventListener('click', function () {
    messagesEl.innerHTML = '';
    messagesEl.appendChild(emptyEl);
    emptyEl.style.display = '';
    fetch(AGENT_URL + '/session/' + sessionId, { method: 'DELETE' }).catch(function () {});
    // Fresh session ID
    sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem(STORAGE_KEY, sessionId); } catch (_) {}
  });

}());
