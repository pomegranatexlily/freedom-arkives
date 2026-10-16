/* Freedom Arkives reader: Samantha-only speech, local documents, SVG transport. */
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
function isSamantha(v){return !!v&&/^en(?:[-_]|$)/i.test(v.lang||"")&&/(^|[^a-z])samantha([^a-z]|$)/i.test(v.name||"");}
if(typeof module!=="undefined"&&module.exports){module.exports={passages:passages,parseDocument:parseDocument,isSamantha:isSamantha};return;}
var $=function(id){return document.getElementById(id);},synth=window.speechSynthesis,supported=!!(synth&&window.SpeechSynthesisUtterance);
var doc=null,chapter=0,index=0,offset=0,parts=[],nodes=[],voices=[],playing=false,generation=0,utterance=null,activeNode=null,acceptedVoice=null,previewMode=false;
// Promotional catalog introductions only; the full manuscripts are never loaded from this data.
var PREVIEWS=Array.isArray(window.FreedomBookPreviews)?window.FreedomBookPreviews:[];
var DOC_KEY="fa.reader.document.v1",POS_KEY="fa.reader.position.v1",PREF_KEY="fa.reader.preferences.v1";
function message(t){$("status").textContent=t;}
function read(key){try{return JSON.parse(localStorage.getItem(key)||"null");}catch(_){return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
function savePosition(){return doc&&!previewMode?write(POS_KEY,{chapter:chapter,index:index,offset:offset}):false;}
function savePreferences(){write(PREF_KEY,{voice:$("voice").value,rate:$("rate").value,size:$("font-size").value});}
function selectedVoice(){return voices.find(function(v){return v.voiceURI===$("voice").value;})||null;}
function update(){
  var exists=!!parts.length;
  $("play").disabled=!exists||!supported||!selectedVoice();$("previous").disabled=!exists||(index===0&&chapter===0);$("next").disabled=!exists||(index===parts.length-1&&chapter===doc.chapters.length-1);$("save").disabled=!exists||previewMode;$("return-saved").hidden=!previewMode||!read(DOC_KEY);$("seek").disabled=!exists;
  $("seek").max=String(Math.max(0,parts.length-1));$("seek").value=String(index);$("position").textContent=exists?(index+1)+" / "+parts.length:"0 / 0";
  $("play").dataset.state=playing?"playing":"paused";$("play").setAttribute("aria-label",playing?"Pause reading":"Read aloud");$("play").title=playing?"Pause":"Play";
  if(activeNode)activeNode.classList.remove("active");activeNode=nodes[index]||null;if(activeNode)activeNode.classList.add("active");
}
function stop(){generation++;playing=false;if(supported)synth.cancel();utterance=null;savePosition();update();}
function showChapter(number,startIndex,startOffset){
  chapter=Math.max(0,Math.min(doc.chapters.length-1,Number(number)||0));parts=passages(doc.chapters[chapter].text);index=Math.max(0,Math.min(parts.length-1,Number(startIndex)||0));offset=Math.max(0,Math.min(parts[index]?parts[index].text.length:0,Number(startOffset)||0));
  $("chapter").value=String(chapter);$("document-title").textContent=doc.title;$("track-title").textContent=previewMode?doc.title.replace(/ — Free Introduction$/,""):doc.title+(doc.chapters.length>1?" · "+doc.chapters[chapter].title:"");$("reading-text").replaceChildren();nodes=[];activeNode=null;
  var last=-1,p;parts.forEach(function(part,i){if(part.paragraph!==last){p=document.createElement("p");$("reading-text").appendChild(p);last=part.paragraph;}var span=document.createElement("span");span.textContent=part.text+" ";span.dataset.passage=String(i);p.appendChild(span);nodes.push(span);});update();savePosition();
}
function openDocument(value,position,restoring,isPreview){
  stop();doc=value;previewMode=!!isPreview;$("chapter").replaceChildren();doc.chapters.forEach(function(c,i){var option=document.createElement("option");option.value=String(i);option.textContent=c.title;$("chapter").appendChild(option);});$("chapter-label").hidden=doc.chapters.length<2;showChapter(position&&position.chapter,position&&position.index,position&&position.offset);$("import-panel").open=false;
  var saved=restoring||previewMode||write(DOC_KEY,doc);message(previewMode?"Free introduction loaded. Press Play for Samantha narration; your personal text stays saved.":!supported?"Text opened. This browser does not provide speech.":!selectedVoice()?"Text opened. Samantha is unavailable here; read-aloud is off.":saved?"Ready to listen. Your place is saved on this device.":"Text opened for this session. Browser storage is unavailable or full.");
}
function loadVoices(){
  if(!supported)return;var wasAvailable=!!selectedVoice(),previous=$("voice").value||(read(PREF_KEY)||{}).voice,candidates=synth.getVoices().filter(isSamantha);
  var preferred=candidates.find(function(v){return v.voiceURI===previous;})||candidates.find(function(v){return v.localService&&/enhanced|premium/i.test(v.name);})||candidates.find(function(v){return v.localService;})||candidates[0];
  voices=preferred?[preferred]:[];$("voice").replaceChildren();var option=document.createElement("option");option.value=preferred?preferred.voiceURI:"";option.textContent=preferred?preferred.name+" · "+preferred.lang:"Samantha unavailable";$("voice").appendChild(option);$("voice").value=option.value;$("voice").disabled=true;
  if(!preferred){if(playing)stop();message("Samantha is unavailable on this device/browser. No other voice will be used.");}else if(!wasAvailable&&!playing)message("Samantha is ready.");update();
}
function consentForVoice(){var voice=selectedVoice();if(!isSamantha(voice))return false;if(!voice.localService&&acceptedVoice!==voice.voiceURI){if(!window.confirm("Your browser has not identified this Samantha voice as local. It may send reading text to its speech provider. Continue?"))return false;acceptedVoice=voice.voiceURI;}return true;}
function speakPart(){
  if(!playing||!parts[index])return;var voice=selectedVoice();if(!isSamantha(voice)){stop();message("Samantha is unavailable. No other voice will be used.");return;}if(offset>=parts[index].text.length)offset=0;
  var token=++generation,start=offset;utterance=new SpeechSynthesisUtterance(parts[index].text.slice(start));utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=Number($("rate").value)||1;
  utterance.onboundary=function(event){if(token===generation)offset=start+(event.charIndex||0);};
  utterance.onend=function(){if(token!==generation||!playing)return;offset=0;if(index+1<parts.length)index++;else if(chapter+1<doc.chapters.length)showChapter(chapter+1,0,0);else{playing=false;offset=parts[index].text.length;savePosition();update();message("Reading complete.");return;}update();savePosition();speakPart();};
  utterance.onerror=function(event){if(token!==generation)return;playing=false;savePosition();update();message("Speech stopped: "+(event.error||"voice unavailable")+". Press Play to retry Samantha.");};synth.speak(utterance);
}
function play(){if(!supported||!parts.length)return;loadVoices();if(!selectedVoice()){message("Samantha is unavailable. No other voice will be used.");return;}if(!consentForVoice())return;synth.cancel();synth.resume();playing=true;update();message("Reading aloud with Samantha.");speakPart();}
function seek(number){var resume=playing;stop();index=Math.max(0,Math.min(parts.length-1,Number(number)||0));offset=0;update();savePosition();if(resume)play();}
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
  openDocument({title:item.title+" — Free Introduction",chapters:[{title:item.source==="published catalog description"?"Published catalog description":"Catalog-themed promotional introduction",text:item.text}]},null,false,true);
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
$("seek").addEventListener("change",function(){seek(this.value);});
$("previous").addEventListener("click",function(){if(index>0)seek(index-1);else if(chapter>0){var resume=playing;stop();showChapter(chapter-1,999999,0);if(resume)play();}});
$("next").addEventListener("click",function(){if(index+1<parts.length)seek(index+1);else if(chapter+1<doc.chapters.length){var resume=playing;stop();showChapter(chapter+1,0,0);if(resume)play();}});
$("chapter").addEventListener("change",function(){var resume=playing;stop();showChapter(this.value,0,0);if(resume)play();});
$("reading-text").addEventListener("click",function(event){var node=event.target.closest("[data-passage]");if(node&&parts.length)seek(node.dataset.passage);});
$("save").addEventListener("click",function(){message(savePosition()?"Reading place saved on this device.":"Could not save your place in this browser.");});
["voice","rate"].forEach(function(id){$(id).addEventListener("change",function(){var resume=playing;stop();savePreferences();if(resume)play();});});
$("font-size").addEventListener("input",function(){document.documentElement.style.setProperty("--size",this.value+"px");savePreferences();});
$("forget").addEventListener("click",function(){if(!window.confirm("Clear this reader's saved text and position from this browser?"))return;stop();try{localStorage.removeItem(DOC_KEY);localStorage.removeItem(POS_KEY);}catch(_){}doc=null;previewMode=false;parts=[];nodes=[];activeNode=null;$("reading-text").replaceChildren();$("document-title").textContent="Your reading space";$("track-title").textContent="No text loaded";$("chapter-label").hidden=true;$("input-text").value="";$("input-title").value="";$("import-panel").open=true;update();message("Saved text cleared.");});
window.addEventListener("pagehide",function(){savePosition();if(supported)synth.cancel();});
var preferences=read(PREF_KEY)||{};if(["0.75","1","1.25","1.5","1.75","2"].indexOf(preferences.rate)!==-1)$("rate").value=preferences.rate;var size=Math.max(16,Math.min(28,Number(preferences.size)||20));$("font-size").value=String(size);document.documentElement.style.setProperty("--size",size+"px");
loadVoices();if(supported)synth.addEventListener("voiceschanged",loadVoices);var saved=read(DOC_KEY),position=read(POS_KEY),sampleId=(new URLSearchParams(window.location.search)).get("sample"),requestedPreview=PREVIEWS.find(function(item){return item.id===sampleId;})||null;if(requestedPreview)$("featured-book").value=requestedPreview.id;refreshPreviewInfo();if(saved&&!requestedPreview){try{openDocument(parseDocument(JSON.stringify(saved),"saved.json",""),position,true,false);}catch(_){loadPreview(selectedPreview());message("Saved text could not be opened. A public preview is available.");}}else{loadPreview(requestedPreview||PREVIEWS[0]);}if(!supported)message("This browser does not provide speech. You can still read text.");update();
})();
