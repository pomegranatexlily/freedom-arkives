/* Freedom Arkives reader: recorded-audio narration, local documents, SVG transport.
 *
 * AUDIO ENGINE (replaces the old system-voice engine completely):
 * Playback is HTMLAudio MP3 files driven by an audio manifest — no system voice,
 * no speech synthesis anywhere in this file. A chapter plays only when the
 * manifest has an entry for it; otherwise the player says so plainly and
 * reading continues without audio. Sync is honest, in three modes:
 *   - "timed": one chapter file + a segments timing map (passage -> start/end).
 *     The reading highlight follows the audio exactly.
 *   - "files": one audio file per passage. The highlight follows the file playing.
 *   - "chapter": one chapter file, no timing map. No per-passage claim is made:
 *     the highlight stays on the reader's position and the seek bar is time.
 * Local documents, chapters, passage chunking, seek, previous/next, saved
 * position (same localStorage keys), font size, and rate are preserved from
 * the previous reader; only the audio engine and the voice UI changed.
 */
(function(){
"use strict";
function passages(text){
  var out=[];
  String(text).replace(/\r\n?/g,"\n").trim().split(/\n\s*\n/).forEach(function(p,n){
    var rest=p.replace(/\s+/g," ").trim();
    while(rest){var cut=rest.length>240?rest.lastIndexOf(" ",240):rest.length;if(cut<80&&rest.length>240)cut=240;out.push({text:rest.slice(0,cut),paragraph:n});rest=rest.slice(cut).trim();}
  });return out;
}
function parseDocument(raw,filename,title){
  if(typeof raw!=="string"||raw.length>500000)throw Error("Use text of 500,000 characters or fewer.");
  var doc={title:title||filename||"Untitled",chapters:[{title:title||"Text",text:raw}]};
  if(/\.json$/i.test(filename||"")){var data=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("JSON needs a title and text, or a chapters array.");doc.title=typeof data.title==="string"?data.title:doc.title;doc.chapters=Array.isArray(data.chapters)?data.chapters:[{title:doc.title,text:data.text}];}
  if(!doc.chapters.length||doc.chapters.length>500||doc.chapters.some(function(c){return !c||typeof c.text!=="string"||!c.text.trim();}))throw Error("Every chapter must contain nonempty text.");
  doc.chapters=doc.chapters.map(function(c,i){return {title:typeof c.title==="string"?c.title:"Chapter "+(i+1),text:c.text};});return doc;
}
/* Manifest helpers (pure; unit-tested from Node). */
function normalizeDocKey(title){
  return String(title||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"untitled";
}
function findAudioEntry(manifest,docKey,chapterIndex,chapterTitle){
  if(!manifest||!Array.isArray(manifest.entries))return null;
  for(var i=0;i<manifest.entries.length;i++){
    var e=manifest.entries[i];
    if(!e||e.document!==docKey)continue;
    if(typeof e.chapterIndex==="number"&&e.chapterIndex===chapterIndex)return e;
    if(typeof e.chapterTitle==="string"&&chapterTitle&&e.chapterTitle===chapterTitle)return e;
  }
  return null;
}
function resolveAudioUrl(manifest,entry){
  if(!entry)return null;
  if(entry.url)return entry.url;
  if(!entry.file)return null;
  if(/^https?:\/\//i.test(entry.file))return entry.file;
  var base=(manifest&&manifest.baseUrl)||"";
  if(base&&base.charAt(base.length-1)!=="/")base+="/";
  return base+entry.file;
}
function entryMode(entry){
  if(!entry)return "none";
  if(Array.isArray(entry.segments)&&entry.segments.length){
    var hasFiles=entry.segments.some(function(s){return !!s.url;});
    return hasFiles?"files":"timed";
  }
  return entry.file||entry.url?"chapter":"none";
}
if(typeof module!=="undefined"&&module.exports){module.exports={passages:passages,parseDocument:parseDocument,normalizeDocKey:normalizeDocKey,findAudioEntry:findAudioEntry,resolveAudioUrl:resolveAudioUrl,entryMode:entryMode};return;}
var $=function(id){return document.getElementById(id);};
var doc=null,chapter=0,index=0,parts=[],nodes=[],activeNode=null,playing=false,starting=false,previewMode=false,previewId=null;
var audio=null,audioEntry=null,audioMode="none",audioFailed=false,pendingTime=0,manifest=null,manifestLoaded=false;
var PREVIEWS=Array.isArray(window.FreedomBookPreviews)?window.FreedomBookPreviews:[];
var DOC_KEY="fa.reader.document.v1",POS_KEY="fa.reader.position.v1",PREF_KEY="fa.reader.preferences.v1";
var MANIFEST_URL="audio-manifest.json";
function message(t){$("status").textContent=t;}
function read(key){try{return JSON.parse(localStorage.getItem(key)||"null");}catch(_){return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
function savePosition(){
  if(!doc||previewMode)return false;
  var pos={chapter:chapter,index:index};
  if(audioMode==="chapter"&&audio&&isFinite(audio.currentTime))pos.time=audio.currentTime;
  return write(POS_KEY,pos);
}
function savePreferences(){write(PREF_KEY,{rate:$("rate").value,size:$("font-size").value});}
function fmtTime(s){
  if(!isFinite(s)||s<0)s=0;
  var m=Math.floor(s/60),sec=Math.floor(s%60);
  return m+":"+(sec<10?"0":"")+sec;
}
function docKey(){
  if(previewMode&&previewId)return previewId;
  return normalizeDocKey(doc?doc.title:"");
}
function failedKey(entry){return (entry&&entry.document||"")+"|"+(typeof entry.chapterIndex==="number"?entry.chapterIndex:entry.chapterTitle||"");}
var failedEntries={};
function currentEntry(){
  if(!doc||!manifest)return null;
  return findAudioEntry(manifest,docKey(),chapter,doc.chapters[chapter].title);
}
function setAudioForChapter(){
  stopAudioOnly();
  audioEntry=currentEntry();
  audioMode=entryMode(audioEntry);
  audioFailed=!!(audioEntry&&failedEntries[failedKey(audioEntry)]);
  if(!audio){
    audio=new Audio();
    audio.preload="metadata";
    audio.addEventListener("timeupdate",onTimeUpdate);
    audio.addEventListener("ended",onAudioEnded);
    audio.addEventListener("error",onAudioError);
    audio.addEventListener("playing",function(){starting=false;update();});
    audio.addEventListener("waiting",function(){starting=true;update();});
    audio.addEventListener("loadedmetadata",function(){
      if(pendingTime>0&&audioMode==="chapter"){try{audio.currentTime=pendingTime;}catch(_){}}
      pendingTime=0;update();
    });
  }
  if(audioMode==="timed"||audioMode==="chapter"){
    var url=resolveAudioUrl(manifest,audioEntry);
    if(audio.getAttribute("src")!==url)audio.setAttribute("src",url);
    audio.load();
  } else if(audioMode==="files"){
    loadPassageFile(index);
  } else {
    audio.removeAttribute("src");audio.load();
  }
  audio.playbackRate=Number($("rate").value)||1;
  update();
}
function loadPassageFile(passageIndex){
  if(audioMode!=="files"||!audioEntry)return;
  var seg=null;
  for(var i=0;i<audioEntry.segments.length;i++){if(audioEntry.segments[i].passage===passageIndex){seg=audioEntry.segments[i];break;}}
  if(!seg||!seg.url){audioFailed=true;update();return;}
  var url=/^https?:\/\//i.test(seg.url)?seg.url:((manifest.baseUrl||"")+seg.url);
  if(audio.getAttribute("src")!==url)audio.setAttribute("src",url);
  audio.load();
}
function onTimeUpdate(){
  if(!audio)return;
  if(audioMode==="timed"&&audioEntry&&audioEntry.segments){
    var t=audio.currentTime,found=-1;
    for(var i=0;i<audioEntry.segments.length;i++){
      var s=audioEntry.segments[i];
      if(t>=s.start&&(typeof s.end!=="number"||t<s.end)){found=s.passage;break;}
    }
    if(found>=0&&found!==index){index=found;update();savePosition();}
  }
  if(audioMode==="chapter")update();
}
function onAudioEnded(){
  if(audioMode==="files"){
    if(index+1<parts.length){
      index++;update();savePosition();
      if(playing){loadPassageFile(index);var pr=null;try{pr=audio.play();}catch(_){pr=null;}if(pr&&pr.catch)pr.catch(function(){stop();message("Recorded audio could not play. Press Play to retry.");});}
    }
    else advanceChapterAfterAudio();
    return;
  }
  advanceChapterAfterAudio();
}
function advanceChapterAfterAudio(){
  if(chapter+1<doc.chapters.length){
    var wasPlaying=playing;
    showChapter(chapter+1,0);
    if(wasPlaying){
      if(audioMode!=="none"&&!audioFailed)playAudio();
      else{playing=false;update();message("Audio not yet available for this chapter.");}
    }
  } else {
    playing=false;starting=false;update();savePosition();message("Listening complete.");
  }
}
function onAudioError(){
  if(audioEntry)failedEntries[failedKey(audioEntry)]=true;
  audioFailed=true;
  if(playing){playing=false;starting=false;savePosition();message("Audio not yet available for this chapter.");}
  update();
}
function stopAudioOnly(){
  if(audio){try{audio.pause();}catch(_){}}
  playing=false;starting=false;
}
function stop(){stopAudioOnly();savePosition();update();}
function playAudio(){
  if(!parts.length)return;
  if(audioMode==="none"){message("Audio not yet available for this chapter.");return;}
  if(audioFailed){message("Audio not yet available for this chapter.");return;}
  if(audioMode==="files")loadPassageFile(index);
  audio.playbackRate=Number($("rate").value)||1;
  starting=true;update();
  var p=null;
  try{p=audio.play();}catch(_){p=null;}
  if(p&&p.catch)p.catch(function(){starting=false;playing=false;message("Recorded audio could not play. Press Play to retry.");update();});
  else{playing=true;starting=false;}
  audio.addEventListener("playing",function once(){playing=true;starting=false;update();},{once:true});
  message("Playing recorded narration.");
}
function play(){
  if(!parts.length)return;
  if(audioMode==="none"||audioFailed){message("Audio not yet available for this chapter.");return;}
  playing=true;playAudio();
}
function update(){
  var exists=!!parts.length;
  $("play").disabled=!exists||audioMode==="none"||audioFailed;
  $("previous").disabled=!exists||(index===0&&chapter===0);
  $("next").disabled=!exists||(index===parts.length-1&&chapter===doc.chapters.length-1);
  $("save").disabled=!exists||previewMode;
  $("return-saved").hidden=!previewMode||!read(DOC_KEY);
  $("seek").disabled=!exists;
  var note=$("narration-note");
  if(note){
    if(!exists)note.textContent="Load text to see narration availability.";
    else if(audioMode==="none")note.textContent="Audio not yet available for this chapter. Reading still works.";
    else if(audioFailed)note.textContent="The recorded file for this chapter could not be played.";
    else note.textContent="Recorded narration available for this chapter.";
    note.classList.toggle("danger",exists&&(audioMode==="none"||audioFailed));
  }
  if(audioMode==="chapter"&&audio&&isFinite(audio.duration)&&audio.duration>0){
    $("seek").max=String(Math.floor(audio.duration));
    $("seek").value=String(Math.floor(audio.currentTime||0));
    $("position").textContent=fmtTime(audio.currentTime||0)+" / "+fmtTime(audio.duration);
  } else {
    $("seek").max=String(Math.max(0,parts.length-1));
    $("seek").value=String(index);
    $("position").textContent=exists?(index+1)+" / "+parts.length:"0 / 0";
  }
  $("play").dataset.state=starting?"starting":playing?"playing":"paused";
  $("play").setAttribute("aria-label",playing?"Pause narration":"Play narration");
  $("play").title=playing?"Pause":"Play";
  if(activeNode)activeNode.classList.remove("active");
  activeNode=nodes[index]||null;
  if(activeNode)activeNode.classList.add("active");
}
function showChapter(number,startIndex){
  chapter=Math.max(0,Math.min(doc.chapters.length-1,Number(number)||0));
  parts=passages(doc.chapters[chapter].text);
  index=Math.max(0,Math.min(parts.length-1,Number(startIndex)||0));
  $("chapter").value=String(chapter);
  $("document-title").textContent=doc.title;
  $("track-title").textContent=previewMode?doc.title.replace(/ — Free Introduction$/,""):doc.title+(doc.chapters.length>1?" · "+doc.chapters[chapter].title:"");
  $("reading-text").replaceChildren();nodes=[];activeNode=null;
  var last=-1,p;
  parts.forEach(function(part,i){
    if(part.paragraph!==last){p=document.createElement("p");$("reading-text").appendChild(p);last=part.paragraph;}
    var span=document.createElement("span");span.textContent=part.text+" ";span.dataset.passage=String(i);p.appendChild(span);nodes.push(span);
  });
  setAudioForChapter();
  update();savePosition();
}
function openDocument(value,position,restoring,isPreview,isPreviewId){
  stop();doc=value;previewMode=!!isPreview;previewId=isPreviewId||null;
  $("chapter").replaceChildren();
  doc.chapters.forEach(function(c,i){var option=document.createElement("option");option.value=String(i);option.textContent=c.title;$("chapter").appendChild(option);});
  $("chapter-label").hidden=doc.chapters.length<2;
  showChapter(position&&position.chapter,position&&position.index);
  if(position&&position.time&&audioMode==="chapter")pendingTime=position.time;
  $("import-panel").open=false;
  var saved=restoring||previewMode||write(DOC_KEY,doc);
  message(previewMode?"Free introduction loaded. Press Play for recorded narration when audio is available; your personal text stays saved.":saved?"Ready. Your place is saved on this device.":"Text opened for this session. Browser storage is unavailable or full.");
}
function seek(number){
  var resume=playing;stop();
  if(audioMode==="chapter"){
    if(audio&&isFinite(audio.duration)&&audio.duration>0){
      try{audio.currentTime=Math.max(0,Math.min(audio.duration,Number(number)||0));}catch(_){}
      update();
      if(resume)play();
      return;
    }
  }
  index=Math.max(0,Math.min(parts.length-1,Number(number)||0));
  if(audioMode==="timed"&&audioEntry&&audioEntry.segments){
    var seg=null;
    for(var i=0;i<audioEntry.segments.length;i++){if(audioEntry.segments[i].passage===index){seg=audioEntry.segments[i];break;}}
    if(seg&&audio){try{audio.currentTime=seg.start;}catch(_){}}
  }
  if(audioMode==="files")loadPassageFile(index);
  update();savePosition();
  if(resume)play();
}
function seekPassage(number){
  var resume=playing;stop();
  index=Math.max(0,Math.min(parts.length-1,Number(number)||0));
  if(audioMode==="timed"&&audioEntry&&audioEntry.segments){
    var seg=null;
    for(var i=0;i<audioEntry.segments.length;i++){if(audioEntry.segments[i].passage===index){seg=audioEntry.segments[i];break;}}
    if(seg&&audio){try{audio.currentTime=seg.start;}catch(_){}}
  }
  if(audioMode==="files")loadPassageFile(index);
  update();savePosition();
  if(resume)play();
}
function restorePersonalText(){
  var saved=read(DOC_KEY);
  if(!saved){message("No saved personal text found in this browser.");return;}
  try{openDocument(parseDocument(JSON.stringify(saved),"saved.json",""),read(POS_KEY),true,false);}
  catch(_){message("Saved text could not be opened. Import it again.");}
}
function selectedPreview(){return PREVIEWS.find(function(item){return item.id===$("featured-book").value;})||PREVIEWS[0]||null;}
function refreshPreviewInfo(){
  var item=selectedPreview();if(!item)return;
  $("featured-preview-title").textContent=item.title;
  $("featured-preview-description").textContent=(item.source==="published catalog description"?"Published catalog description":"Original catalog-themed promotional introduction")+". Not a book excerpt or complete chapter.";
  $("preview-purchase").href=item.purchaseUrl;
  $("preview-purchase").textContent="Shop "+item.purchaseFormat+" on Amazon →";
  $("preview-details").href="../#book-"+encodeURIComponent(item.id);
}
function loadPreview(item){
  if(!item){message("No public previews are available.");return;}
  $("featured-book").value=item.id;
  refreshPreviewInfo();
  openDocument({title:item.title+" — Free Introduction",chapters:[{title:item.source==="published catalog description"?"Published catalog description":"Catalog-themed promotional introduction",text:item.text}]},null,false,true,item.id);
}
function loadManifest(){
  var url=MANIFEST_URL;
  try{
    var override=new URLSearchParams(window.location.search).get("manifest");
    if(override)url=override;
  }catch(_){}
  fetch(url).then(function(r){if(!r.ok)throw Error("no manifest");return r.json();}).then(function(data){
    manifest=data;manifestLoaded=true;
    if(doc)setAudioForChapter();
    update();
  }).catch(function(){manifest=null;manifestLoaded=true;if(doc)setAudioForChapter();update();});
}
PREVIEWS.forEach(function(item){
  var option=document.createElement("option");option.value=item.id;option.textContent=item.title;$("featured-book").appendChild(option);
});
$("featured-book").addEventListener("change",function(){loadPreview(selectedPreview());});
$("load-sample").addEventListener("click",function(){loadPreview(selectedPreview());});
refreshPreviewInfo();
$("return-saved").addEventListener("click",restorePersonalText);
$("open-settings").addEventListener("click",function(){var panel=$("reader-settings");panel.open=true;panel.scrollIntoView({block:"center",behavior:"auto"});panel.querySelector("summary").focus({preventScroll:true});});
$("load-text").addEventListener("click",function(){try{openDocument(parseDocument($("input-text").value,"",$("input-title").value.trim()));}catch(error){message(error.message);}});
$("file").addEventListener("change",async function(){var file=this.files[0];if(!file)return;try{if(!/\.(txt|md|json)$/i.test(file.name))throw Error("Choose TXT, Markdown, or JSON. PDF import is not included yet.");if(file.size>2000000)throw Error("Choose a file smaller than 2 MB.");openDocument(parseDocument(await file.text(),file.name,""));}catch(error){message(error.message);}this.value="";});
$("play").addEventListener("click",function(){if(playing){stop();message("Paused. Press Play to continue.");}else play();});
$("seek").addEventListener("change",function(){
  if(audioMode==="chapter")seek(this.value);
  else seekPassage(this.value);
});
$("previous").addEventListener("click",function(){if(index>0)seekPassage(index-1);else if(chapter>0){var resume=playing;stop();showChapter(chapter-1,999999);if(resume)play();}});
$("next").addEventListener("click",function(){if(index+1<parts.length)seekPassage(index+1);else if(chapter+1<doc.chapters.length){var resume=playing;stop();showChapter(chapter+1,0);if(resume)play();}});
$("chapter").addEventListener("change",function(){var resume=playing;stop();showChapter(this.value,0);if(resume)play();});
$("reading-text").addEventListener("click",function(event){var node=event.target.closest("[data-passage]");if(node&&parts.length)seekPassage(node.dataset.passage);});
$("save").addEventListener("click",function(){message(savePosition()?"Reading place saved on this device.":"Could not save your place in this browser.");});
$("rate").addEventListener("change",function(){if(audio)audio.playbackRate=Number($("rate").value)||1;savePreferences();});
$("font-size").addEventListener("input",function(){document.documentElement.style.setProperty("--size",this.value+"px");savePreferences();});
$("forget").addEventListener("click",function(){if(!window.confirm("Clear this reader's saved text and position from this browser?"))return;stop();try{localStorage.removeItem(DOC_KEY);localStorage.removeItem(POS_KEY);}catch(_){}doc=null;previewMode=false;previewId=null;parts=[];nodes=[];activeNode=null;$("reading-text").replaceChildren();$("document-title").textContent="Your reading space";$("track-title").textContent="No text loaded";$("chapter-label").hidden=true;$("input-text").value="";$("input-title").value="";$("import-panel").open=true;update();message("Saved text cleared.");});
window.addEventListener("pagehide",function(){stop();});
var preferences=read(PREF_KEY)||{};if(["0.75","1","1.25","1.5","1.75","2"].indexOf(preferences.rate)!==-1)$("rate").value=preferences.rate;var size=Math.max(16,Math.min(28,Number(preferences.size)||20));$("font-size").value=String(size);document.documentElement.style.setProperty("--size",size+"px");
loadManifest();
var saved=read(DOC_KEY),position=read(POS_KEY),sampleId=(new URLSearchParams(window.location.search)).get("sample"),requestedPreview=PREVIEWS.find(function(item){return item.id===sampleId;})||null;if(requestedPreview)$("featured-book").value=requestedPreview.id;refreshPreviewInfo();if(saved&&!requestedPreview){try{openDocument(parseDocument(JSON.stringify(saved),"saved.json",""),position,true,false);}catch(_){loadPreview(selectedPreview());message("Saved text could not be opened. A public preview is available.");}}else{loadPreview(requestedPreview||PREVIEWS[0]);}update();
})();
