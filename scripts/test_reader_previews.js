/* Repo-level nonbrowser regression checks for free book listening introductions. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const repo=path.join(__dirname,"..");
const previews=require(path.join(repo,"reader","book-previews.js"));
const home=fs.readFileSync(path.join(repo,"index.html"),"utf8");
const match=home.match(/<script type="application\/json" id="catalogData">([\s\S]*?)<\/script>/);
assert.ok(match,"Catalog JSON present");
const books=JSON.parse(match[1]).books;
assert.equal(books.length,16,"Expected 16 published catalog books");
assert.equal(previews.length,books.length,"A public intro for every listed book");
assert.equal(new Set(previews.map(p=>p.id)).size,books.length,"Unique preview IDs");
for(const [i,book] of books.entries()){
 const p=previews[i];
 assert.equal(p.id,book.id);
 assert.equal(p.title,book.title);
 assert.ok(["catalog-themed introduction","published catalog description"].includes(p.source));
 assert.ok(book.editions.some(e=>e.url===p.purchaseUrl&&e.format===p.purchaseFormat),"Verified purchase URL");
 const words=p.text.trim().split(/\s+/).length;
 assert.ok(words>=45&&words<=90,`${p.id} intro length ${words} outside 45–90`);
 if(p.source==="published catalog description")assert.equal(p.text,book.description);
}
const reader=fs.readFileSync(path.join(repo,"reader","reader.js"),"utf8");
const page=fs.readFileSync(path.join(repo,"reader","index.html"),"utf8");
const catalogJS=fs.readFileSync(path.join(repo,"homepage-script-2.js"),"utf8");
const sw=fs.readFileSync(path.join(repo,"sw.js"),"utf8");
new Function(reader);new Function(catalogJS);
assert.ok(page.indexOf('src="book-previews.js"')<page.indexOf('src="reader.js"'));
assert.ok(reader.includes('doc&&!previewMode?write(POS_KEY'));
assert.ok(reader.includes('restoring||previewMode||write(DOC_KEY,doc)'));
assert.ok(reader.includes("function restorePersonalText()"));
assert.ok(catalogJS.includes('reader/?sample="+encodeURIComponent(book.id)'));
assert.ok(sw.includes('"reader/book-previews.js"'));
console.log("PASS: 16 catalog-backed promotional intros, trusted purchase links, no manuscript excerpts, private position protection, valid JS.");

// Reader header is navigation-only; privacy choices move into the collapsed
// listening panel rather than competing with the back control on an iPhone.
const privacyJS=fs.readFileSync(path.join(repo,"privacy-consent.js"),"utf8");
const readerCSS=fs.readFileSync(path.join(repo,"reader","reader.css"),"utf8");
assert.ok(page.includes('aria-label="Back to Freedom Arkives menu"'));
assert.ok(page.includes('data-site-settings-slot'));
assert.ok(page.indexOf('data-site-settings-slot')>page.indexOf('id="reader-settings"'));
assert.ok(privacyJS.includes('document.querySelector("[data-site-settings-slot]")'));
assert.ok(!readerCSS.includes('.top>.fa-site-settings'));
assert.ok(readerCSS.includes('.reader-privacy-slot .fa-site-settings'));
// The now-playing title must use the actual selected book title, not the
// chapter's generic description. Confirm that all IDs still deep-link.
assert.ok(reader.includes('$("track-title").textContent=previewMode?doc.title.replace'));
assert.ok(reader.includes('title:item.title+" — Free Introduction"'));
assert.ok(reader.includes('PREVIEWS.find(function(item){return item.id===sampleId;}'));
assert.ok(readerCSS.includes('-webkit-line-clamp:2'));
console.log("PASS: header navigation, reader privacy placement, full now-playing titles for all 16 selections.");
