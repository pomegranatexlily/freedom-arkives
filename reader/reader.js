/* Freedom Arkives read-aloud player. No upload endpoint or third-party library. */
(function () {
"use strict";
function passages(text) {
  var output = [];
  String(text).replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).forEach(function (paragraph, number) {
    var rest = paragraph.replace(/\s+/g, " ").trim();
    while (rest) {
      var cut = rest.length > 240 ? rest.lastIndexOf(" ", 240) : rest.length;
      if (cut < 80 && rest.length > 240) cut = 240;
      output.push({text:rest.slice(0, cut), paragraph:number});
      rest = rest.slice(cut).trim();
    }
  });
  return output;
}
function parseDocument(raw, filename, title) {
  if (typeof raw !== "string" || raw.length > 500000) throw Error("Use text of 500,000 characters or fewer.");
  var doc = {title:title || filename || "Untitled", chapters:[{title:title || "Text", text:raw}]};
  if (/\.json$/i.test(filename || "")) {
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("JSON must contain a title and text, or a chapters array.");
    doc.title = typeof data.title === "string" ? data.title : doc.title;
    doc.chapters = Array.isArray(data.chapters) ? data.chapters : [{title:doc.title, text:data.text}];
  }
  if (!doc.chapters.length || doc.chapters.length > 500 || doc.chapters.some(function (c) { return !c || typeof c.text !== "string" || !c.text.trim(); })) throw Error("Every chapter must contain nonempty text.");
  doc.chapters = doc.chapters.map(function (c, i) { return {title:typeof c.title === "string" ? c.title : "Chapter " + (i + 1), text:c.text}; });
  return doc;
}
if (typeof module !== "undefined" && module.exports) { module.exports = {passages:passages, parseDocument:parseDocument}; return; }
var $ = function (id) { return document.getElementById(id); };
var synth = window.speechSynthesis;
var supported = !!(synth && window.SpeechSynthesisUtterance);
var doc = null, chapter = 0, index = 0, offset = 0, parts = [], nodes = [], voices = [], playing = false, generation = 0, utterance = null, activeNode = null, acceptedVoice = null;
var DOC_KEY = "fa.reader.document.v1", POS_KEY = "fa.reader.position.v1", PREF_KEY = "fa.reader.preferences.v1";
function message(text) { $("status").textContent = text; }
function readStorage(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
function savePosition() { if (doc) return writeStorage(POS_KEY, {chapter:chapter, index:index, offset:offset}); return false; }
function savePreferences() { writeStorage(PREF_KEY, {voice:$("voice").value, rate:$("rate").value, size:$("font-size").value}); }
function update() {
  var exists = !!parts.length;
  $("play").disabled = !exists || !supported;
  $("previous").disabled = !exists || (index === 0 && chapter === 0);
  $("next").disabled = !exists || (index === parts.length - 1 && chapter === doc.chapters.length - 1);
  $("save").disabled = !exists;
  $("seek").disabled = !exists;
  $("seek").max = String(Math.max(0, parts.length - 1));
  $("seek").value = String(index);
  $("position").textContent = exists ? (index + 1) + " / " + parts.length : "0 / 0";
  $("play").textContent = playing ? "Pause" : "Play";
  $("play").setAttribute("aria-label", playing ? "Pause reading" : "Read aloud");
  if (activeNode) activeNode.classList.remove("active");
  activeNode = nodes[index] || null;
  if (activeNode) activeNode.classList.add("active");
}
function stop() {
  generation += 1; playing = false;
  if (supported) synth.cancel();
  utterance = null; savePosition(); update();
}
function showChapter(number, startIndex, startOffset) {
  chapter = Math.max(0, Math.min(doc.chapters.length - 1, Number(number) || 0));
  parts = passages(doc.chapters[chapter].text);
  index = Math.max(0, Math.min(parts.length - 1, Number(startIndex) || 0));
  offset = Math.max(0, Math.min(parts[index] ? parts[index].text.length : 0, Number(startOffset) || 0));
  $("chapter").value = String(chapter);
  $("document-title").textContent = doc.title;
  $("track-title").textContent = doc.chapters[chapter].title;
  $("reading-text").replaceChildren(); nodes = []; activeNode = null;
  var last = -1, paragraph;
  parts.forEach(function (part, i) {
    if (part.paragraph !== last) { paragraph = document.createElement("p"); $("reading-text").appendChild(paragraph); last = part.paragraph; }
    var span = document.createElement("span"); span.textContent = part.text + " "; span.dataset.passage = String(i); paragraph.appendChild(span); nodes.push(span);
  });
  update(); savePosition();
}
function openDocument(value, position, restoring) {
  stop(); doc = value;
  $("chapter").replaceChildren();
  doc.chapters.forEach(function (c, i) { var option = document.createElement("option"); option.value = String(i); option.textContent = c.title; $("chapter").appendChild(option); });
  $("chapter-label").hidden = doc.chapters.length < 2;
  showChapter(position && position.chapter, position && position.index, position && position.offset);
  $("import-panel").open = false;
  var saved = restoring || writeStorage(DOC_KEY, doc);
  message(!supported ? "Text opened. This browser does not provide read-aloud speech." : saved ? "Text opened. Press Play to listen. Your place is saved on this device." : "Text opened for this session. Browser storage is unavailable or full.");
}
function selectedVoice() { return voices.find(function (v) { return v.voiceURI === $("voice").value; }) || null; }
function consentForVoice() {
  var voice = selectedVoice();
  var key = voice ? voice.voiceURI : "device-default";
  if ((!voice || !voice.localService) && acceptedVoice !== key) {
    if (!window.confirm("This voice is online or has not been identified as local. Your browser may send the reading text to its speech provider. Continue?")) return false;
    acceptedVoice = key;
  }
  return true;
}
function speakPart() {
  if (!playing || !parts[index]) return;
  if (offset >= parts[index].text.length) offset = 0;
  var token = ++generation, start = offset;
  utterance = new SpeechSynthesisUtterance(parts[index].text.slice(start));
  var voice = selectedVoice();
  if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
  else utterance.lang = document.documentElement.lang || "en";
  utterance.rate = Number($("rate").value) || 1;
  utterance.onboundary = function (event) { if (token === generation) offset = start + (event.charIndex || 0); };
  utterance.onend = function () {
    if (token !== generation || !playing) return;
    offset = 0;
    if (index + 1 < parts.length) index += 1;
    else if (chapter + 1 < doc.chapters.length) showChapter(chapter + 1, 0, 0);
    else { playing = false; offset = parts[index].text.length; savePosition(); update(); message("Reading complete."); return; }
    update(); savePosition(); speakPart();
  };
  utterance.onerror = function (event) { if (token !== generation) return; playing = false; savePosition(); update(); message("Speech stopped: " + (event.error || "voice unavailable") + ". Choose a voice and press Play to retry."); };
  synth.speak(utterance);
}
function play() {
  if (!supported || !parts.length || !consentForVoice()) return;
  synth.cancel(); synth.resume(); playing = true; update(); message("Reading aloud."); speakPart();
}
function seek(number) { var resume = playing; stop(); index = Math.max(0, Math.min(parts.length - 1, Number(number) || 0)); offset = 0; update(); savePosition(); if (resume) play(); }
function loadVoices() {
  if (!supported) return;
  var preferences = readStorage(PREF_KEY) || {};
  var previous = $("voice").value || preferences.voice;
  voices = synth.getVoices();
  $("voice").replaceChildren();
  var fallback = document.createElement("option"); fallback.value = ""; fallback.textContent = "Device default"; $("voice").appendChild(fallback);
  voices.forEach(function (voice) { var option = document.createElement("option"); option.value = voice.voiceURI; option.textContent = voice.name + " · " + voice.lang + (voice.localService ? " · device" : " · online"); $("voice").appendChild(option); });
  var preferred = voices.find(function (v) { return v.voiceURI === previous; }) || voices.find(function (v) { return v.localService && /^en/i.test(v.lang); }) || voices.find(function (v) { return v.localService; });
  $("voice").value = preferred ? preferred.voiceURI : "";
}
$("load-text").addEventListener("click", function () { try { openDocument(parseDocument($("input-text").value, "", $("input-title").value.trim())); } catch (error) { message(error.message); } });
$("file").addEventListener("change", async function () {
  var file = this.files[0]; if (!file) return;
  try {
    if (!/\.(txt|md|json)$/i.test(file.name)) throw Error("Choose a TXT, Markdown, or JSON text file. PDF import is not included in this version.");
    if (file.size > 2000000) throw Error("Choose a file smaller than 2 MB.");
    openDocument(parseDocument(await file.text(), file.name, ""));
  } catch (error) { message(error.message); }
  this.value = "";
});
$("play").addEventListener("click", function () { if (playing) { stop(); message("Paused. Press Play to continue from the saved passage position."); } else play(); });
$("seek").addEventListener("change", function () { seek(this.value); });
$("previous").addEventListener("click", function () { if (index > 0) seek(index - 1); else if (chapter > 0) { var resume = playing; stop(); showChapter(chapter - 1, 999999, 0); if (resume) play(); } });
$("next").addEventListener("click", function () { if (index + 1 < parts.length) seek(index + 1); else if (chapter + 1 < doc.chapters.length) { var resume = playing; stop(); showChapter(chapter + 1, 0, 0); if (resume) play(); } });
$("chapter").addEventListener("change", function () { var resume = playing; stop(); showChapter(this.value, 0, 0); if (resume) play(); });
$("reading-text").addEventListener("click", function (event) { var node = event.target.closest("[data-passage]"); if (node && parts.length) seek(node.dataset.passage); });
$("save").addEventListener("click", function () { message(savePosition() ? "Reading place saved on this device." : "Could not save the reading place in this browser."); });
["voice", "rate"].forEach(function (id) { $(id).addEventListener("change", function () { var resume = playing; stop(); savePreferences(); if (resume) play(); }); });
$("font-size").addEventListener("input", function () { document.documentElement.style.setProperty("--size", this.value + "px"); savePreferences(); });
$("forget").addEventListener("click", function () { if (!window.confirm("Clear this reader's saved text and position from this browser?")) return; stop(); try { localStorage.removeItem(DOC_KEY); localStorage.removeItem(POS_KEY); } catch (_) {} doc = null; parts = []; nodes = []; activeNode = null; $("reading-text").replaceChildren(); $("document-title").textContent = "Your reading space"; $("track-title").textContent = "No text loaded"; $("chapter-label").hidden = true; $("input-text").value = ""; $("input-title").value = ""; $("import-panel").open = true; update(); message("Saved text cleared."); });
window.addEventListener("pagehide", function () { savePosition(); if (supported) synth.cancel(); });
var preferences = readStorage(PREF_KEY) || {};
if (["0.75", "1", "1.25", "1.5", "1.75", "2"].indexOf(preferences.rate) !== -1) $("rate").value = preferences.rate;
var size = Math.max(16, Math.min(28, Number(preferences.size) || 20)); $("font-size").value = String(size); document.documentElement.style.setProperty("--size", size + "px");
loadVoices(); if (supported) synth.addEventListener("voiceschanged", loadVoices);
var saved = readStorage(DOC_KEY), position = readStorage(POS_KEY);
if (saved) { try { openDocument(parseDocument(JSON.stringify(saved), "saved.json", ""), position, true); } catch (_) { message("Saved text could not be opened. Import it again."); } }
if (!supported) message("This browser does not provide speech synthesis. You can still open and read text.");
update();
})();
