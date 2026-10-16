/* Freedom Arkives: corner-menu navigation; preserve the original home screen. */
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
    var home = panels.find(function (panel) { return panel.id === "home" || panel.querySelector("#home"); });
    if (!home) return;
    var labels = {home:"Home", ecosystem:"Ecosystem", library:"Books", articles:"Articles", mission:"The Mission", doctrine:"Doctrine", capacities:"Capacities", assignment:"Mission Finder", "for-whom":"Who This Is For", connect:"Connect"};
    var oldLinks = Array.from(slot.querySelectorAll('a[href^="#"]'));
    var records = panels.map(function (panel) {
      var matching = oldLinks.find(function (a) {
        var target = document.getElementById(a.hash.slice(1));
        return target && (panel === target || panel.contains(target));
      });
      var heading = panel.querySelector("h1,h2");
      var label = labels[panel.id] || (matching ? matching.textContent.trim() : heading ? heading.textContent.trim() : "");
      return {panel:panel, label:label, hash:panel.id ? "#" + panel.id : ""};
    });
    var menu = document.createElement("details"); menu.id = "fa-section-menu";
    var toggle = document.createElement("summary"); toggle.textContent = "☰"; toggle.setAttribute("aria-label", "Open navigation menu"); menu.appendChild(toggle);
    var list = document.createElement("nav"); list.className = "fa-menu-links"; list.setAttribute("aria-label", "App sections"); menu.appendChild(list);
    records.forEach(function (r) {
      if (!r.label || !r.hash) return;
      var a = document.createElement("a"); a.href = r.hash; a.textContent = r.label; list.appendChild(a);
    });
    Array.from(slot.querySelectorAll("a[href]")).filter(function (a) { return a.getAttribute("href").charAt(0) !== "#"; }).forEach(function (a) { list.appendChild(a.cloneNode(true)); });
    var readerLink = document.createElement("a"); readerLink.href = "reader/"; readerLink.textContent = "Read & Listen"; list.appendChild(readerLink);
    slot.appendChild(menu);
    function render(scroll) {
      var hash = location.hash;
      var id;
      try { id = decodeURIComponent(hash.slice(1)); } catch (_) { id = hash.slice(1); }
      var target = (!id || id === "fa-home") ? home : document.getElementById(id);
      if (!target && id.indexOf("book-") === 0) target = document.getElementById("bookDetail");
      var active = target ? records.find(function (r) { return r.panel === target || r.panel.contains(target); }) : null;
      records.forEach(function (r) { r.panel.toggleAttribute("data-fa-view-hidden", !!active && r !== active); });
      list.querySelectorAll("a").forEach(function (a) {
        if (active && a.hash === active.hash) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      menu.open = false;
      if (scroll && active) {
        var heading = active.panel.querySelector("h1,h2");
        if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({preventScroll:true}); }
        if (hash && active.hash !== hash && target && id !== "fa-home") target.scrollIntoView({block:"start"});
        else window.scrollTo({top:0, behavior:"auto"});
      }
    }
    list.addEventListener("click", function (event) { if (event.target.closest("a")) menu.open = false; });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && menu.open) { menu.open = false; toggle.focus(); } });
    document.addEventListener("click", function (event) { if (menu.open && !menu.contains(event.target)) menu.open = false; });
    window.addEventListener("hashchange", function () { render(true); });
    document.documentElement.classList.add("fa-section-navigation");
    render(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true}); else init();
})();
