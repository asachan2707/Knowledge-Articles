/*
 * academy-map.js — maps actual-portal URLs (Claude Academy / Skilljar / DeepLearning.AI) to local Learning Hub topics.
 *
 * HOW IT WORKS
 *   Any <a> whose href matches a `portal` URL below gets a small "in Hub" marker, and clicking it
 *   opens a chooser: open the ACTUAL portal topic, or open the LOCAL topic. Both open in a new tab.
 *   Links with data-no-chooser are left alone. Without JS the link is just the portal URL.
 *
 * ADDING A FUTURE TOPIC (the /add-topic skill does this for Academy-sourced topics)
 *   Append one object to ENTRIES:
 *     { title: 'Shown in the dialog', portal: 'https://…actual page…', local: 'topics/<file>.html' }
 *   - `portal` may be a string or an array (several portal URLs can map to one local page).
 *   - `local` is relative to the repo root (the folder containing this file).
 *   - Matching ignores protocol, "www.", query, hash and trailing slash.
 */
(function () {
  'use strict';

  var AC = 'https://academy.claude.com/courses/ai-capabilities-and-limitations';
  var CF = 'topics/claude-foundation/';
  var GR = 'https://learn.deeplearning.ai/courses/safe-and-reliable-ai-via-guardrails/lesson/';
  var SG = 'topics/safe-reliable-ai-guardrails/';

  var ENTRIES = [
    // ── Claude Foundation: AI Capabilities and Limitations (academy.claude.com) ──
    { title: 'Claude Foundation — AI Capabilities & Limitations (course hub)',
      portal: [AC, AC + '/intro-to-ai-capabilities-and-limitations'], local: CF + 'index.html' },
    { title: 'Intro & What We Mean by AI (lessons 1–2)',
      portal: [AC + '/intro-to-ai-capabilities-and-limitations', AC + '/what-we-mean-by-ai'], local: CF + '01-intro-and-roadmap.html' },
    { title: 'How AI Gets Its Character (lesson 3)',
      portal: AC + '/how-ai-gets-its-character', local: CF + '02-how-ai-gets-its-character.html' },
    { title: 'Next Token Prediction (lessons 4–5)',
      portal: [AC + '/next-token-prediction', AC + '/try-it-out'], local: CF + '03-next-token-prediction.html' },
    { title: 'Knowledge (lessons 6–7)',
      portal: [AC + '/knowledge', AC + '/try-it-out-31vzkl2dgi907'], local: CF + '04-knowledge.html' },
    { title: 'Working Memory (lessons 8–9)',
      portal: [AC + '/working-memory', AC + '/try-it-out-q7hdjm9twcbt'], local: CF + '05-working-memory.html' },
    { title: 'Steerability (lessons 10–11)',
      portal: [AC + '/steerability', AC + '/try-it-out-y02xgkpa6wa7'], local: CF + '06-steerability.html' },
    { title: 'When Properties Collide & Next Steps (lessons 12–13, quiz)',
      portal: [AC + '/when-properties-collide', AC + '/next-steps', AC + '/course-quiz'], local: CF + '07-when-properties-collide-next-steps.html' },
    // ── Safe and Reliable AI via Guardrails (DeepLearning.AI × GuardrailsAI) ──
    { title: 'Safe and Reliable AI via Guardrails — course hub',
      portal: ['https://www.deeplearning.ai/courses/safe-and-reliable-ai-via-guardrails', 'https://learn.deeplearning.ai/courses/safe-and-reliable-ai-via-guardrails'], local: SG + 'index.html' },
    { title: 'Introduction & Failure Modes in RAG (lessons 1–2)',
      portal: [GR + 'rz5a6/introduction', GR + 'b0qtw/failure-modes-in-rag-applications'], local: SG + '01-introduction-and-failure-modes.html' },
    { title: 'What Are Guardrails & First Guardrail (lessons 3–4)',
      portal: [GR + 'wdss7/what-are-guardrails', GR + 'ph1aa/building-your-first-guardrail'], local: SG + '02-what-are-guardrails-first-guardrail.html' },
    { title: 'Hallucination Detection with NLI (lessons 5–6)',
      portal: [GR + 'p1nyu/checking-for-hallucinations-with-natural-language-inference-', GR + 'j85wm/using-hallucination-guardrail-in-a-chatbot'], local: SG + '03-hallucination-detection-nli.html' },
    { title: 'Keeping a Chatbot on Topic (lesson 7)',
      portal: [GR + 'xi8uo/keeping-a-chatbot-on-topic'], local: SG + '04-keeping-chatbot-on-topic.html' },
    { title: 'Ensuring No PII Is Leaked (lesson 8)',
      portal: [GR + 'wjgpn/ensuring-no-personal-identifiable-information-is-leaked'], local: SG + '05-pii-leakage.html' },
    { title: 'Preventing Competitor Mentions (lesson 9)',
      portal: [GR + 'bc597/preventing-competitor-mentions'], local: SG + '06-preventing-competitor-mentions.html' },
    { title: 'Conclusion, Quiz & Production Stack (lessons 10–11)',
      portal: [GR + 'sk1h0/conclusion', GR + 'kpdk1/quiz'], local: SG + '07-conclusion-quiz-production-stack.html' }
    // ← add future entries above this line
  ];

  // ── implementation ─────────────────────────────────────────────────────────
  var script = document.currentScript;
  var base = new URL('.', script && script.src ? script.src : location.href); // repo root

  function norm(u) {
    try {
      var x = new URL(u, location.href);
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
    } catch (e) { return ''; }
  }

  var INDEX = Object.create(null);
  ENTRIES.forEach(function (e) {
    [].concat(e.portal).forEach(function (p) { INDEX[norm(p)] = e; });
  });
  window.ACADEMY_MAP = { entries: ENTRIES, lookup: function (u) { return INDEX[norm(u)] || null; } };

  var css = document.createElement('style');
  css.textContent =
    '.am-mark{display:inline-block;margin-left:6px;padding:1px 7px;font:600 10px/1.6 system-ui,sans-serif;letter-spacing:.4px;' +
    'color:#065f46;background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;vertical-align:middle;white-space:nowrap}' +
    '.am-dialog{border:0;border-radius:12px;padding:0;max-width:460px;width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.35);font:14px/1.5 system-ui,sans-serif;color:#172b4d}' +
    '.am-dialog::backdrop{background:rgba(15,23,42,.55)}' +
    '.am-box{padding:22px 24px}.am-box h3{margin:0 0 4px;font-size:16px}.am-sub{margin:0 0 14px;color:#5e6c84;font-size:13px}' +
    '.am-opt{display:block;width:100%;text-align:left;margin:0 0 10px;padding:12px 14px;border:1px solid #d0d7de;border-radius:8px;background:#fff;cursor:pointer;font:inherit;color:inherit}' +
    '.am-opt:hover,.am-opt:focus{border-color:#d97706;background:#fffbeb;outline:none}' +
    '.am-opt strong{display:block;font-size:14px}.am-opt span{display:block;font-size:12px;color:#5e6c84;word-break:break-all}' +
    '.am-cancel{background:none;border:0;color:#5e6c84;cursor:pointer;font:inherit;padding:4px 0}';
  document.head.appendChild(css);

  var dlg;
  function open(url) { window.open(url, '_blank', 'noopener'); }

  function choose(entry, portalUrl) {
    var local = new URL(entry.local, base).href;
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'am-dialog';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); }); // backdrop click
    }
    dlg.innerHTML =
      '<div class="am-box"><h3></h3><p class="am-sub">This topic exists on the actual portal and in your Learning Hub. Where do you want to go?</p>' +
      '<button class="am-opt" data-k="portal"><strong>Go to the actual portal topic</strong><span></span></button>' +
      '<button class="am-opt" data-k="local"><strong>Open the Learning Hub topic in a new tab</strong><span></span></button>' +
      '<button class="am-cancel" data-k="x">Cancel</button></div>';
    dlg.querySelector('h3').textContent = entry.title;
    dlg.querySelector('[data-k=portal] span').textContent = portalUrl;
    dlg.querySelector('[data-k=local] span').textContent = entry.local;
    dlg.onclick = function (ev) {
      var b = ev.target.closest('button[data-k]');
      if (!b) return;
      if (b.dataset.k === 'portal') open(portalUrl);
      if (b.dataset.k === 'local') open(local);
      dlg.close();
    };
    dlg.showModal();
    dlg.querySelector('[data-k=local]').focus();
  }

  function decorate(root) {
    (root || document).querySelectorAll('a[href]:not([data-no-chooser]):not([data-am])').forEach(function (a) {
      var e = INDEX[norm(a.href)];
      if (!e) return;
      a.dataset.am = '1';
      var m = document.createElement('span');
      m.className = 'am-mark';
      m.title = 'Also available as a local Learning Hub topic: ' + e.local;
      m.textContent = '● in Hub';
      a.insertAdjacentElement('afterend', m);
    });
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-am]');
    if (!a || typeof HTMLDialogElement === 'undefined') return;
    ev.preventDefault();
    choose(INDEX[norm(a.href)], a.href);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { decorate(); });
  else decorate();
})();
