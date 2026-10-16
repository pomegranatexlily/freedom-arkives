
    (function () {
      var data;
      try { data = JSON.parse(document.getElementById("catalogData").textContent); }
      catch (error) { return; }

      var bookGrid = document.getElementById("bookGrid");
      var bookSearch = document.getElementById("bookSearch");
      var bookFormat = document.getElementById("bookFormat");
      var bookCount = document.getElementById("bookCount");
      var bookEmpty = document.getElementById("bookEmpty");
      var catalogView = document.getElementById("catalogView");
      var bookDetail = document.getElementById("bookDetail");
      var articleGrid = document.getElementById("articleGrid");
      var articleSearch = document.getElementById("articleSearch");
      var articleTag = document.getElementById("articleTag");
      var articleCount = document.getElementById("articleCount");
      var articleEmpty = document.getElementById("articleEmpty");

      function make(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (typeof text === "string") node.textContent = text;
        return node;
      }

      function normalize(value) { return String(value || "").toLowerCase(); }
      function twoDigit(number) { return String(number).padStart(2, "0"); }

      Array.from(new Set(data.books.reduce(function (all, book) {
        return all.concat(book.editions.map(function (edition) { return edition.format; }));
      }, []))).sort().forEach(function (format) {
        var option = make("option", "", format);
        option.value = format;
        bookFormat.appendChild(option);
      });

      Array.from(new Set(data.articles.reduce(function (all, article) { return all.concat(article.tags); }, []))).sort().forEach(function (tag) {
        var option = make("option", "", tag);
        option.value = tag;
        articleTag.appendChild(option);
      });

      function renderBooks() {
        var query = normalize(bookSearch.value).trim();
        var format = bookFormat.value;
        var books = data.books.filter(function (book) {
          var searchable = [book.title, book.author, book.series, book.readingRole].concat(book.subjects).join(" ").toLowerCase();
          var matchesQuery = !query || searchable.indexOf(query) !== -1;
          var matchesFormat = format === "all" || book.editions.some(function (edition) { return edition.format === format; });
          return matchesQuery && matchesFormat;
        });
        bookGrid.replaceChildren();
        books.forEach(function (book) {
          var card = make("article", "catalog-book");
          var cover = make("img", "catalog-cover");
          cover.src = book.cover;
          cover.alt = "Book cover for " + book.title + " by " + book.author;
          cover.loading = "eager";
          cover.decoding = "sync";
          var order = make("span", "order", twoDigit(book.order) + " · " + book.readingRole);
          var title = make("h3", "", book.title);
          var author = make("p", "author", book.author + (book.series ? " · " + book.series : ""));
          var formats = make("p", "book-meta-line", book.editions.map(function (edition) { return edition.format; }).join(" · "));
          var trigger = make("button", "detail-trigger", "View details →");
          trigger.type = "button";
          trigger.setAttribute("data-book", book.id);
          trigger.setAttribute("aria-label", "View details for " + book.title);
          card.append(cover, order, title, author, formats, trigger);
          var sampleLink=make("a","detail-trigger","Listen to free introduction →");
          sampleLink.href="reader/?sample="+encodeURIComponent(book.id);
          sampleLink.setAttribute("aria-label","Listen to free promotional introduction for "+book.title);
          card.appendChild(sampleLink);
          bookGrid.appendChild(card);
        });
        bookCount.textContent = "14 books";
        bookEmpty.hidden = books.length !== 0;
      }

      function openBook(id, updateHash) {
        var book = data.books.find(function (entry) { return entry.id === id; });
        if (!book) return;
        bookDetail.replaceChildren();
        var back = make("button", "detail-back", "← Back to the library");
        back.type = "button";
        back.addEventListener("click", closeBook);
        var grid = make("div", "detail-grid");
        var cover = make("img", "detail-cover");
        cover.src = book.cover;
        cover.alt = "Book cover for " + book.title + " by " + book.author;
        cover.loading = "eager";
        cover.decoding = "sync";
        var copy = make("div", "detail-copy");
        copy.appendChild(make("p", "serial", "Book " + twoDigit(book.order) + " · " + book.readingRole));
        copy.appendChild(make("h2", "", book.title));
        copy.appendChild(make("p", "detail-author", book.author + (book.series ? " · " + book.series : "")));
        copy.appendChild(make("p", "detail-description", book.description || "An official catalog description has not yet been supplied. The confirmed publication metadata and buying options appear below."));
        copy.appendChild(make("p", "detail-note", "Subjects: " + book.subjects.join(" · ") + ". Identifiers shown are ASINs supplied with the live catalog; no ISBN is listed without a confirmed ISBN."));
        var editions = make("div", "edition-list");
        book.editions.forEach(function (edition) {
          var row = make("div", "edition-row");
          var label = make("strong", "", edition.format + " · List price " + edition.price);
          var asin = make("span", "", "ASIN " + edition.asin);
          var link = make("a", "", "Check current price on Amazon →");
          link.href = edition.url;
          row.append(label, asin, link);
          editions.appendChild(row);
        });
        if (book.relatedUrl) {
          var related = make("div", "edition-row");
          related.append(make("strong", "", book.relatedLabel), make("span", "", "Official article"));
          var relatedLink = make("a", "", "Open on Medium →");
          relatedLink.href = book.relatedUrl;
          related.appendChild(relatedLink);
          editions.appendChild(related);
        }
        var previewRow=make("div","edition-row");
        previewRow.append(make("strong","","Free listening introduction"),make("span","","Promotional catalog copy — not a book excerpt"));
        var previewLink=make("a","","Listen to free introduction →");
        previewLink.href="reader/?sample="+encodeURIComponent(book.id);
        previewRow.appendChild(previewLink);editions.appendChild(previewRow);
        copy.appendChild(editions);
        grid.append(cover, copy);
        bookDetail.append(back, grid);
        catalogView.hidden = true;
        bookDetail.hidden = false;
        if (updateHash) history.pushState({book: book.id}, "", "#book-" + book.id);
        requestAnimationFrame(function () {
          var root = document.documentElement;
          var previousBehavior = root.style.scrollBehavior;
          root.style.scrollBehavior = "auto";
          window.scrollTo(0, Math.max(0, bookDetail.getBoundingClientRect().top + window.scrollY - 88));
          back.focus({preventScroll: true});
          requestAnimationFrame(function () { root.style.scrollBehavior = previousBehavior; });
        });
      }

      function closeBook() {
        bookDetail.hidden = true;
        catalogView.hidden = false;
        history.replaceState(null, "", "#library");
        document.getElementById("library").scrollIntoView({behavior: "smooth", block: "start"});
      }

      var svgNS = "http://www.w3.org/2000/svg";
      function svgNode(tag, className, attrs) {
        var node = document.createElementNS(svgNS, tag);
        if (className) node.setAttribute("class", className);
        Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        return node;
      }

      function thumbnailTheme(article) {
        var terms = article.tags.map(normalize);
        if (terms.some(function (tag) { return ["ai", "technology", "python", "programming", "chatgpt", "coding practice", "tutorials"].indexOf(tag) !== -1; })) return "technology";
        if (terms.some(function (tag) { return ["politics", "power", "empire", "courts", "international law", "self-determination", "nation building", "leadership", "organization"].indexOf(tag) !== -1; })) return "power";
        if (terms.some(function (tag) { return ["history", "black history", "family history", "rome", "migration", "confederacy", "kkk", "erasure", "inheritance"].indexOf(tag) !== -1; })) return "history";
        if (terms.some(function (tag) { return ["identity", "race", "language", "aave", "hebrew israelites", "black hebrew israelites", "black america", "culture"].indexOf(tag) !== -1; })) return "identity";
        return "covenant";
      }

      function makeArticleThumbnail(article) {
        var theme = thumbnailTheme(article);
        var descriptions = {
          technology: "a terminal window connected to a network of learning nodes",
          power: "ascending institutional blocks beside a structural column",
          history: "layered archival documents on a dated timeline",
          identity: "interlocking forms gathered around a common center",
          covenant: "an open text framed by a covenantal arch"
        };
        var frame = make("div", "article-thumb article-thumb-" + theme);
        var svg = svgNode("svg", "", {viewBox: "0 0 640 360", role: "img", "aria-label": "Editorial thumbnail for “" + article.title + ",” depicting " + descriptions[theme] + "."});
        var title = svgNode("title", "", {});
        title.textContent = "Editorial thumbnail for " + article.title;
        svg.appendChild(title);
        svg.appendChild(svgNode("rect", "thumb-paper", {width: "640", height: "360"}));
        svg.appendChild(svgNode("rect", "thumb-copper", {x: "0", y: "0", width: "22", height: "360"}));
        svg.appendChild(svgNode("rect", "thumb-green", {x: "522", y: "34", width: "86", height: "18"}));

        if (theme === "technology") {
          svg.appendChild(svgNode("rect", "thumb-line", {x: "92", y: "74", width: "394", height: "218"}));
          svg.appendChild(svgNode("path", "thumb-fine", {d: "M92 122H486 M132 168H252 M132 206H350 M132 244H302"}));
          svg.appendChild(svgNode("circle", "thumb-copper", {cx: "536", cy: "168", r: "28"}));
          svg.appendChild(svgNode("circle", "thumb-green", {cx: "574", cy: "238", r: "22"}));
          svg.appendChild(svgNode("path", "thumb-line", {d: "M486 188H528 M550 190L566 220"}));
        } else if (theme === "power") {
          svg.appendChild(svgNode("path", "thumb-line", {d: "M92 292H548 M124 292V224H236V174H348V122H460V70"}));
          svg.appendChild(svgNode("rect", "thumb-copper", {x: "132", y: "232", width: "96", height: "52"}));
          svg.appendChild(svgNode("rect", "thumb-green", {x: "244", y: "182", width: "96", height: "102"}));
          svg.appendChild(svgNode("rect", "thumb-ink", {x: "356", y: "130", width: "96", height: "154"}));
          svg.appendChild(svgNode("path", "thumb-fine", {d: "M492 84V284 M520 84V284 M476 84H536 M476 284H536"}));
        } else if (theme === "history") {
          svg.appendChild(svgNode("rect", "thumb-line", {x: "116", y: "70", width: "292", height: "202"}));
          svg.appendChild(svgNode("rect", "thumb-fine", {x: "150", y: "96", width: "292", height: "202"}));
          svg.appendChild(svgNode("path", "thumb-line", {d: "M92 316H566 M154 316V286 M284 316V286 M414 316V286 M544 316V286"}));
          svg.appendChild(svgNode("path", "thumb-fine", {d: "M202 144H388 M202 184H360 M202 224H404"}));
        } else if (theme === "identity") {
          svg.appendChild(svgNode("circle", "thumb-line", {cx: "320", cy: "182", r: "104"}));
          svg.appendChild(svgNode("circle", "thumb-fine", {cx: "320", cy: "182", r: "58"}));
          svg.appendChild(svgNode("circle", "thumb-copper", {cx: "178", cy: "182", r: "54"}));
          svg.appendChild(svgNode("circle", "thumb-green", {cx: "462", cy: "182", r: "54"}));
          svg.appendChild(svgNode("rect", "thumb-ink", {x: "302", y: "164", width: "36", height: "36"}));
        } else {
          svg.appendChild(svgNode("path", "thumb-line", {d: "M112 276V140Q112 72 180 72H320V292H180Q112 292 112 276ZM528 276V140Q528 72 460 72H320V292H460Q528 292 528 276Z"}));
          svg.appendChild(svgNode("path", "thumb-fine", {d: "M160 130H276 M160 174H276 M160 218H276 M364 130H480 M364 174H480 M364 218H480"}));
          svg.appendChild(svgNode("rect", "thumb-copper", {x: "300", y: "52", width: "40", height: "240"}));
        }
        frame.appendChild(svg);
        return frame;
      }

      function renderArticles() {
        var query = normalize(articleSearch.value).trim();
        var tag = articleTag.value;
        var articles = data.articles.filter(function (article) {
          var searchable = [article.title, article.excerpt].concat(article.tags).join(" ").toLowerCase();
          return (!query || searchable.indexOf(query) !== -1) && (tag === "all" || article.tags.indexOf(tag) !== -1);
        });
        articleGrid.replaceChildren();
        articles.forEach(function (article, index) {
          var card = make("a", "article-card");
          card.href = article.url;
          card.setAttribute("aria-label", "Read " + article.title + " on Medium");
          var thumb;
          if (article.thumbnail) {
            thumb = make("div", "article-thumb");
            var thumbImg = document.createElement("img");
            thumbImg.src = (/^https?:\/\//i.test(article.thumbnail) && !(window.FreedomPrivacy && window.FreedomPrivacy.allowed("externalMedia"))) ? "assets/fa-article-fallback.jpg" : article.thumbnail;
            thumbImg.alt = "Thumbnail for " + article.title;
            thumbImg.loading = "lazy";
            thumb.appendChild(thumbImg);
          } else {
            thumb = makeArticleThumbnail(article);
          }
          var body = make("div", "article-body");
          body.appendChild(make("h3", "", article.title));
          body.appendChild(make("p", "", article.excerpt));
          var meta = make("div", "article-meta");
          meta.appendChild(make("span", "", article.date ? article.date : article.dateLabel));
          article.tags.forEach(function (item) { meta.appendChild(make("span", "tag", item)); });
          meta.appendChild(make("span", "", "Medium ↗"));
          body.appendChild(meta);
          card.append(thumb, body);
          articleGrid.appendChild(card);
        });
        articleCount.textContent = articles.length + (articles.length === 1 ? " article" : " articles");
        articleEmpty.hidden = articles.length !== 0;
      }

      bookSearch.addEventListener("input", renderBooks);
      bookFormat.addEventListener("change", renderBooks);
      articleSearch.addEventListener("input", renderArticles);
      articleTag.addEventListener("change", renderArticles);
      bookGrid.addEventListener("click", function (event) {
        var trigger = event.target.closest("[data-book]");
        if (trigger) openBook(trigger.getAttribute("data-book"), true);
      });
      window.addEventListener("popstate", function () {
        if (location.hash.indexOf("#book-") === 0) openBook(location.hash.slice(6), false);
        else { bookDetail.hidden = true; catalogView.hidden = false; }
      });

      window.addEventListener("fa-privacy-change", renderArticles);
      renderBooks();
      renderArticles();
      if (location.hash.indexOf("#book-") === 0) openBook(location.hash.slice(6), false);
    }());
  