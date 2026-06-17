/* Roost loyalty widget — zero-dependency vanilla JS.
   Inline launcher + panel. No forced popup portal (guardrail 2).
   State/redeem talk to the App Proxy (/apps/loop). */
(function () {
  "use strict";

  var root = document.getElementById("loop-loyalty-root");
  if (!root) return;
  var PROXY = root.getAttribute("data-loop-proxy") || "/apps/loop";

  var state = null;
  var open = false;
  // Discount codes redeemed in this session — kept so they survive a panel re-render
  // (close/reopen) instead of vanishing right after redemption.
  var issuedCodes = [];

  // ── DOM skeleton ───────────────────────────────────────────
  var launcher = el("button", "loop-launcher", { type: "button", "aria-label": "Open loyalty points" });
  launcher.innerHTML = '<span class="loop-launcher__icon">★</span><span class="loop-launcher__label">Points</span>';
  var panel = el("div", "loop-panel", { role: "dialog", "aria-label": "Loyalty" });
  panel.hidden = true;
  var wrap = el("div", "loop-widget");
  wrap.appendChild(panel);
  wrap.appendChild(launcher);
  root.appendChild(wrap);

  launcher.addEventListener("click", function () {
    open = !open;
    panel.hidden = !open;
    if (open) render();
  });

  // ── Load data ──────────────────────────────────────────────
  fetchJSON(PROXY + "/state")
    .then(function (data) {
      if (!data || !data.ok) return;
      state = data;
      applyTheme(data.settings);
      render();
      maybeRecordRef();
    })
    .catch(function () {
      /* Fail quietly on the storefront — never break the shop page */
    });

  function applyTheme(settings) {
    if (!settings) return;
    if (settings.color) wrap.style.setProperty("--loop-color", settings.color);
    wrap.setAttribute("data-position", settings.position || "bottom-right");
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    if (!state) {
      panel.innerHTML = '<div class="loop-panel__body"><p class="loop-muted">Loading…</p></div>';
      return;
    }
    var parts = [];
    parts.push('<div class="loop-panel__head"><strong>Rewards</strong>' +
      '<button type="button" class="loop-close" aria-label="Close">×</button></div>');
    parts.push('<div class="loop-panel__body">');

    if (state.loggedIn) {
      parts.push('<div class="loop-points"><span class="loop-points__num">' +
        num(state.points) + '</span><span class="loop-points__unit">points</span></div>');
    } else {
      parts.push('<p class="loop-muted">Log in to earn points and redeem rewards.</p>');
    }

    if (state.rewards && state.rewards.length) {
      parts.push('<ul class="loop-rewards">');
      state.rewards.forEach(function (r) {
        var affordable = state.loggedIn && state.points >= r.pointsCost;
        parts.push('<li class="loop-reward">' +
          '<div class="loop-reward__info"><span class="loop-reward__title">' + esc(r.title) + '</span>' +
          '<span class="loop-reward__cost">' + num(r.pointsCost) + ' pt</span></div>' +
          '<button type="button" class="loop-btn" data-reward="' + esc(r.id) + '"' +
          (affordable ? '' : ' disabled') + '>Redeem</button></li>');
      });
      parts.push('</ul>');
    } else {
      parts.push('<p class="loop-muted">No rewards available yet.</p>');
    }

    if (state.loggedIn && state.referralCode) {
      var link = window.location.origin + "/?ref=" + encodeURIComponent(state.referralCode);
      var reward = state.referralReward
        ? "You and your friend each get " + num(state.referralReward) + " pt"
        : "Invite a friend";
      parts.push('<div class="loop-referral"><div class="loop-referral__head">Refer a friend</div>' +
        '<p class="loop-muted">' + esc(reward) + '</p>' +
        '<div class="loop-referral__row"><input class="loop-referral__link" readonly value="' +
        esc(link) + '"><button type="button" class="loop-btn loop-copy">Copy</button></div></div>');
    }

    if (issuedCodes.length) {
      parts.push('<div class="loop-codes"><div class="loop-codes__head">Your discount codes</div><ul class="loop-codes__list">');
      issuedCodes.forEach(function (c) {
        parts.push('<li><code>' + esc(c) + '</code></li>');
      });
      parts.push('</ul></div>');
    }

    parts.push('<div class="loop-result" hidden></div>');
    parts.push('</div>');
    parts.push('<div class="loop-panel__foot">Powered by Roost</div>');
    panel.innerHTML = parts.join("");

    panel.querySelector(".loop-close").addEventListener("click", function () {
      open = false; panel.hidden = true;
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-reward]"), function (btn) {
      btn.addEventListener("click", function () { redeem(btn.getAttribute("data-reward"), btn); });
    });
    var copyBtn = panel.querySelector(".loop-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var input = panel.querySelector(".loop-referral__link");
        if (!input) return;
        input.select();
        try { document.execCommand("copy"); } catch (e) { /* noop */ }
        if (navigator.clipboard) navigator.clipboard.writeText(input.value).catch(function () {});
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
      });
    }
  }

  // ── Record referral (detect ?ref=CODE) ─────────────────────
  function maybeRecordRef() {
    if (!state || !state.loggedIn) return;
    var m = window.location.search.match(/[?&]ref=([^&]+)/);
    if (!m) return;
    var code = decodeURIComponent(m[1]);
    if (!code) return;
    fetchJSON(PROXY + "/refer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: code }),
    }).catch(function () { /* fail quietly */ });
  }

  // ── Redeem ─────────────────────────────────────────────────
  function redeem(rewardId, btn) {
    var result = panel.querySelector(".loop-result");
    btn.disabled = true;
    btn.textContent = "Processing…";
    fetchJSON(PROXY + "/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId: rewardId }),
    })
      .then(function (data) {
        if (data && data.ok) {
          state.points -= data.reward.pointsCost;
          // Persist the code so it stays visible across re-renders / panel close-reopen.
          if (data.code) issuedCodes.push(data.code);
          render();
        } else {
          btn.disabled = false;
          btn.textContent = "Redeem";
          showResult(result, false, (data && data.error) || "Redemption failed.");
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Redeem";
        showResult(result, false, "Network error.");
      });
  }

  function showResult(node, ok, msg) {
    if (!node) return;
    node.hidden = false;
    node.className = "loop-result " + (ok ? "is-ok" : "is-err");
    node.textContent = msg;
  }

  // ── Utils ──────────────────────────────────────────────────
  function fetchJSON(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers.Accept = "application/json";
    opts.credentials = "same-origin";
    return fetch(url, opts).then(function (r) { return r.json(); });
  }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return (Number(n) || 0).toLocaleString(); }
})();
