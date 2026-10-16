/* Freedom Arkives — first-party offline shell.
 * Scope: /freedom-arkives/ only; never intercepts sibling GitHub projects.
 * HTML is NETWORK-FIRST to keep the daily article catalog fresh online.
 * Images/icons are CACHE-FIRST; scripts/styles use NETWORK-FIRST so
 * security and consent updates arrive online without waiting for a version bump.
 * Bump VERSION to invalidate old cached files after future changes.
 * No external (Medium/Google) requests or private visitor data are cached.
 */
"use strict";
const VERSION = "fa-offline-2026-10-16-v1";
const HTML_CACHE = VERSION + "-pages";
const ASSET_CACHE = VERSION + "-assets";
const ORIGIN = self.location.origin;
const BASE = new URL(self.registration.scope);
const OFFLINE_URL = new URL("offline.html", BASE).href;
const SHELL_PAGES = [
  "./", "privacy.html", "workshop/", "workshop/engine/",
  "workshop/nurah/", "workshop/registry/"
];
const SHELL_ASSETS = [
  "privacy-consent.js", "privacy-consent.css", "offline-register.js",
  "assets/fa-article-fallback.jpg", "assets/fa-icon.jpg",
  "assets/fa-hero.jpg", "favicon-32.png", "icon-192.png",
  "icon-512.png", "apple-touch-icon.png", "social-preview.png",
  "manifest.webmanifest"
];
function urlFor(path) { return new URL(path, BASE).href; }
function inScope(url) {
  return url.origin === ORIGIN && url.pathname.startsWith(BASE.pathname);
}
function cacheKey(url) {
  // Ignore tracking/search query strings; application routing is static.
  return new URL(url.pathname, ORIGIN).href;
}
function valid(response) {
  return !!response && response.ok && response.type !== "opaque";
}
self.addEventListener("install", function(event) {
  event.waitUntil((async function() {
    const pages = await caches.open(HTML_CACHE);
    // Critical offline fallback. A transient outage should not block
    // registration; other known pages are best-effort cached.
    await pages.add(OFFLINE_URL);
    await Promise.allSettled(SHELL_PAGES.map(async function(path) {
      const url = urlFor(path);
      const response = await fetch(url, {credentials:"same-origin"});
      if (valid(response)) await pages.put(cacheKey(new URL(url)), response);
    }));
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled(SHELL_ASSETS.map(async function(path) {
      const url = urlFor(path);
      const response = await fetch(url, {credentials:"same-origin"});
      if (valid(response)) await assets.put(url, response);
    }));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", function(event) {
  event.waitUntil((async function() {
    const names = await caches.keys();
    await Promise.all(names.filter(function(name) {
      return name.startsWith("fa-offline-") && name !== HTML_CACHE && name !== ASSET_CACHE;
    }).map(function(name) { return caches.delete(name); }));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", function(event) {
  const request = event.request;
  if (request.method !== "GET" || (request.cache === "only-if-cached" && request.mode !== "same-origin")) return;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (!inScope(url)) return; // Never cache/intercept other project paths or external media.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith((async function() {
      const cache = await caches.open(HTML_CACHE);
      const key = cacheKey(url);
      try {
        const response = await fetch(request);
        if (valid(response)) await cache.put(key, response.clone());
        // Live network response wins, even for 404 and server errors.
        return response;
      } catch (_) {
        return (await cache.match(key)) || (await cache.match(OFFLINE_URL)) ||
          Response.error();
      }
    })());
    return;
  }
  // Executable scripts and styles receive security fixes online first.
  // Cached versions are used only when offline.
  if (request.destination === "script" || request.destination === "style" ||
      /\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith((async function() {
      const cache = await caches.open(ASSET_CACHE);
      try {
        const response = await fetch(request);
        if (valid(response)) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request, {ignoreSearch:true})) || Response.error();
      }
    })());
    return;
  }
  // Same-origin images, fonts and other versioned static assets: cache first.
  event.respondWith((async function() {
    const cache = await caches.open(ASSET_CACHE);
    const hit = await cache.match(request, {ignoreSearch:true});
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (valid(response)) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
