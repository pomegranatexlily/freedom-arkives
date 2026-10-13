/* Register Freedom Arkives' scoped offline shell only after a visitor
 * has made either privacy choice. No external requests or tracking involved. */
(function() {
  "use strict";
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  var script = document.currentScript;
  if (!script || !script.src) return;
  var sw = new URL("sw.js", script.src);
  var scope = new URL("./", script.src);
  function register() {
    if (!window.FreedomPrivacy || !window.FreedomPrivacy.hasChoice()) return;
    navigator.serviceWorker.register(sw.href, {scope:scope.pathname})
      .catch(function(error) {
        console.warn("Freedom Arkives offline support unavailable:", error);
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", register, {once:true});
  } else register();
  window.addEventListener("fa-privacy-change", register);
})();
