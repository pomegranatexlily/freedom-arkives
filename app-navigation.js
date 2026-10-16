/* Freedom Arkives: progressive-enhancement section navigation. */
(function () {
  "use strict";
  function init() {
    var main = document.querySelector("main");
    var slot = document.querySelector(".site-head .nav");
    if (!main || !slot || document.getElementById("fa-section-menu")) return;
    var container = main;
    function children(node) {
      return Array.from(node.children).filter(function (el) { return !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName); });
    }
    var panels = children(container);
    while (panels.length === 1 && !/^(SECTION|ARTICLE)$/.test(panels[0].tagName)) {
      container = panels[0]; panels = children(container);
    }
    if (panels.length < 2) return;
    var oldLinks = Array.from(slot.querySelectorAll('a[href^="#"]'));
    var records = panels.map(function (panel, i) {
      var matching = oldLinks.find(function (a) {
        var target = document.getElementById(a.hash.slice(1));
        return target && (panel === target || panel.contains(target));
      });
      var heading = panel.querySelector("h1,h2");
      var label = matching ? matching.textContent.trim() : heading ? heading.textContent.trim() : "Section " + (i + 1);
      if (label.length > 65) label = label.slice(0, 62) + "…";
      var route = panel.id;
      if (!route) { route = "fa-section-" + (i + 1); panel.id = route; }
      return {panel:panel, label:label, hash:"#" + route};
    });
    var home = document.createElement("section");
    home.className = "fa-home";
    home.id = "fa-home";
    var title = document.createElement("h1"); title.textContent = "Freedom Arkives"; home.appendChild(title);
    var intro = document.createElement("p"); intro.textContent = "Books, articles, research, and frameworks. Choose a section to explore."; home.appendChild(intro);
    var cards = document.createElement("nav"); cards.className = "fa-home-links"; cards.setAttribute("aria-label", "Explore Freedom Arkives"); home.appendChild(cards);
    var menu = document.createElement("details"); menu.id = "fa-section-menu";
    var toggle = document.createElement("summary"); toggle.textContent = "☰ Menu"; menu.appendChild(toggle);
    var list = document.createElement("nav"); list.className = "fa-menu-links"; list.setAttribute("aria-label", "App sections"); menu.appendChild(list);
    function link(label, hash, parent) {
      var a = document.createElement("a"); a.href = hash; a.textContent = label; parent.appendChild(a); return a;
    }
    link("Home", "#fa-home", list);
    records.forEach(function (r) { link(r.label, r.hash, list); link(r.label, r.hash, cards); });
    Array.from(slot.querySelectorAll("a[href]")).filter(function (a) { return a.getAttribute("href").charAt(0) !== "#"; }).forEach(function (a) {
      var copy = a.cloneNode(true); list.appendChild(copy);
    });
    slot.appendChild(menu);
    container.insertBefore(home, container.firstChild);
    var initialHidden = records.filter(function (r) { return r.panel.hidden; });
    function targetPanel(hash) {
      if (!hash || hash === "#fa-home") return null;
      var id;
      try { id = decodeURIComponent(hash.slice(1)); } catch (_) { id = hash.slice(1); }
      var target = document.getElementById(id);
      if (!target && id.indexOf("book-") === 0) {
        target = Array.from(main.querySelectorAll("[id]")).find(function (el) { return /book.*detail/i.test(el.id); });
        if (!target) return undefined;
      }
      if (!target) return undefined;
      return records.find(function (r) { return r.panel === target || r.panel.contains(target); });
    }
    function render(scroll) {
      var hash = location.hash;
      var active = targetPanel(hash);
      var fallback = active === undefined;
      home.toggleAttribute("data-fa-view-hidden", !!active || fallback);
      records.forEach(function (r) { r.panel.toggleAttribute("data-fa-view-hidden", !fallback && r !== active); });
      if (fallback) initialHidden.forEach(function (r) { if (!r.panel.hidden) r.panel.removeAttribute("data-fa-view-hidden"); });
      list.querySelectorAll("a").forEach(function (a) {
        if ((active && a.hash === active.hash) || (!active && !fallback && a.hash === "#fa-home")) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      menu.open = false;
      if (scroll && !fallback) {
        var heading = (active ? active.panel : home).querySelector("h1,h2");
        if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({preventScroll:true}); }
        if (active && hash !== active.hash) {
          var target = document.getElementById(hash.slice(1)); if (target) target.scrollIntoView({block:"start"});
        } else window.scrollTo({top:0, behavior:"auto"});
      }
    }
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && menu.open) { menu.open = false; toggle.focus(); } });
    document.addEventListener("click", function (event) { if (menu.open && !menu.contains(event.target)) menu.open = false; });
    window.addEventListener("hashchange", function () { render(true); });
    document.documentElement.classList.add("fa-section-navigation");
    render(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
})();
