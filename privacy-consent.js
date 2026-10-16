/* Freedom Arkives privacy controls, v1. No optional analytics or advertising trackers are installed. */
(function(){
"use strict";
var KEY="fa.privacy.v1", VERSION=1, choice=null, modal=null, manage=null;
var policyUrl=new URL("privacy.html",document.currentScript.src).href;
var stylesUrl=new URL("privacy-consent.css",document.currentScript.src).href;
var fontsUrl="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,650;6..72,750&display=swap";
try {
  var saved=JSON.parse(localStorage.getItem(KEY)||"null");
  if(saved && saved.version===VERSION && typeof saved.externalMedia==="boolean")choice=saved;
} catch(e) {}
function allowed(k){return !!(choice && choice[k]===true);}
function fonts(){
  var link=document.getElementById("fa-external-fonts");
  if(document.querySelector(".site-head") || !allowed("externalMedia")){if(link)link.remove();return;}
  if(!link){link=document.createElement("link");link.id="fa-external-fonts";link.rel="stylesheet";link.href=fontsUrl;document.head.appendChild(link);}
}
function set(media){
  choice={version:VERSION,externalMedia:media===true,updatedAt:new Date().toISOString()};
  try{localStorage.setItem(KEY,JSON.stringify(choice));}catch(e){}
  if(modal){modal.remove();modal=null;}
  fonts();
  window.dispatchEvent(new Event("fa-privacy-change"));
}
function el(tag,text,cls){
  var node=document.createElement(tag);
  if(text)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
function makeButton(label,cls,cb){
  var b=el("button",label,"fa-privacy-btn "+cls);
  b.type="button";b.addEventListener("click",cb);return b;
}
function open(){
  if(modal){modal.remove();modal=null;}
  var shade=el("div",null,"fa-privacy-shade");
  var panel=el("section",null,"fa-privacy-panel");
  panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","fa-privacy-heading");
  var h=el("h2","Freedom Arkives privacy choices");h.id="fa-privacy-heading";panel.appendChild(h);
  panel.appendChild(el("p","We use essential hosting and browser functions to display this site. We do not currently run advertising pixels, behavioral trackers, or optional analytics."));
  panel.appendChild(el("p","Some article thumbnails and fonts come from third-party providers (Medium and Google). These external resources stay blocked until you choose to allow them. Rejecting does not prevent you from reading the catalog."));
  var actions=el("div",null,"fa-privacy-actions");
  actions.appendChild(makeButton("Reject optional","fa-privacy-reject",function(){set(false);}));
  actions.appendChild(makeButton("Accept all","fa-privacy-accept",function(){set(true);}));
  var details=makeButton("Manage choices","fa-privacy-other",function(){
    if(detail.hidden){detail.hidden=false;details.textContent="Hide choices";}else{detail.hidden=true;details.textContent="Manage choices";}
  });
  actions.appendChild(details);panel.appendChild(actions);
  var detail=el("div",null,"fa-privacy-details");detail.hidden=true;
  var label=el("label",null,"fa-privacy-check");
  var check=document.createElement("input");check.type="checkbox";check.checked=allowed("externalMedia");
  label.appendChild(check);label.appendChild(el("span","Allow third-party article thumbnails and web fonts. They can receive connection data such as your IP address."));
  detail.appendChild(label);
  detail.appendChild(makeButton("Save my choice","fa-privacy-accept",function(){set(check.checked);}));
  panel.appendChild(detail);
  var link=el("a","Privacy policy","fa-privacy-policy");link.href=policyUrl;panel.appendChild(link);
  shade.appendChild(panel);document.body.appendChild(shade);modal=shade;
  panel.querySelector("button").focus();
}
function init(){
  var style=document.createElement("link");
  style.rel="stylesheet";style.href=stylesUrl;
  document.head.appendChild(style);
  var slot=document.querySelector("[data-site-settings-slot]") ||
    document.querySelector(".site-head .nav .fa-menu-links") ||
    document.querySelector(".site-head .nav") ||
    document.querySelector("header.top") ||
    document.querySelector(".top") ||
    document.querySelector("header") ||
    document.querySelector("footer");
  manage=makeButton("Settings","fa-site-settings",open);
  manage.setAttribute("aria-label","Site settings, including privacy choices");
  manage.title="Site settings · privacy preferences";
  if(slot)slot.appendChild(manage);
  else document.body.appendChild(manage);
  fonts();if(!choice)open();
}
window.FreedomPrivacy=Object.freeze({allowed:allowed,open:open,hasChoice:function(){return !!choice;}});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
