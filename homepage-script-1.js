
    (function () {
      var missions = {
        memory: {
          name: "Archive mission · 30 days",
          title: "Build one recoverable family archive.",
          text: "The objective is not to collect everything. It is to prove that your household can preserve and retrieve what matters without depending on one phone, one account, or one person’s memory.",
          steps: ["Gather ten essential family or work records with permission.", "Name them consistently and add dates, people, and context.", "Keep three copies: local, off-site, and offline.", "Teach one other person how to retrieve and maintain them."]
        },
        covenant: {
          name: "Covenant-order mission · 30 days",
          title: "Turn one doctrine into household practice.",
          text: "Changing vocabulary is not the same as changing an operating order. Choose one covenant practice and make its authority, meaning, timing, responsibilities, and teaching plan explicit.",
          steps: ["Choose one practice from Torah that your household will study seriously.", "Write what the text commands, its context, and what you still need to verify.", "Define the household practice without adding custom as commandment.", "Teach the practice and record questions for the next study cycle."]
        },
        skill: {
          name: "Mastery mission · 30 days",
          title: "Convert one talent into verifiable skill.",
          text: "A civilization cannot run on potential. Choose one lawful technical, professional, or craft capacity that can solve a real problem and be taught to someone else.",
          steps: ["Name one useful skill and the standard that proves competence.", "Complete twenty focused hours of study or supervised practice.", "Produce one artifact, assessment, or service that can be reviewed.", "Document the process so a second person can begin behind you."]
        },
        capital: {
          name: "Capital-that-remains mission · 30 days",
          title: "Make one month of money leave an asset behind.",
          text: "The goal is not performative deprivation. It is to prove that income can become security, a productive tool, lawful ownership, or a transferable plan.",
          steps: ["Map one month of income, fixed obligations, leakage, and debt.", "Create or strengthen one emergency reserve, however small.", "Fund one tool, credential, business input, or protective legal step.", "Write how the asset is owned, maintained, transferred, or replaced."]
        },
        institution: {
          name: "Continuity mission · 30 days",
          title: "Make the work survive its founder.",
          text: "Run the continuity test against one project, group, business, ministry, or family function. If it stops when one person disappears, it is still a personality network.",
          steps: ["Write a one-page mission, scope, and decision map.", "List every task and credential known by only one person.", "Create one usable procedure and train a second operator.", "Name how records, money, authority, and disputes are reviewed."]
        },
        household: {
          name: "Household-strength mission · 30 days",
          title: "Remove one recurring burden from the household.",
          text: "Regeneration must reduce the concentration of invisible labor and prevent responsibility from being abandoned to women, elders, or one exhausted caretaker.",
          steps: ["Name one recurring strain in care, food, transport, money, safety, or records.", "Assign clear ownership, timing, backup, and a standard of completion.", "Give the responsible person the tools and authority required.", "Review after four weeks: did the burden shrink, move, or become sustainable?"]
        }
      };

      var buttons = Array.prototype.slice.call(document.querySelectorAll(".gap-btn"));
      var nameEl = document.getElementById("gapName");
      var titleEl = document.getElementById("missionTitle");
      var textEl = document.getElementById("missionText");
      var stepsEl = document.getElementById("missionSteps");
      var copyBtn = document.getElementById("copyMission");
      var copyStatus = document.getElementById("copyStatus");
      var current = "memory";

      function render(key) {
        current = key;
        var item = missions[key];
        nameEl.textContent = item.name;
        titleEl.textContent = item.title;
        textEl.textContent = item.text;
        stepsEl.innerHTML = "";
        item.steps.forEach(function (step) {
          var li = document.createElement("li");
          li.textContent = step;
          stepsEl.appendChild(li);
        });
        buttons.forEach(function (button) {
          button.setAttribute("aria-pressed", String(button.getAttribute("data-gap") === key));
        });
        copyStatus.textContent = "";
      }

      buttons.forEach(function (button) {
        button.addEventListener("click", function () { render(button.getAttribute("data-gap")); });
      });

      copyBtn.addEventListener("click", function () {
        var item = missions[current];
        var content = item.name + "\n" + item.title + "\n\n" + item.text + "\n\n" + item.steps.map(function (step, index) { return (index + 1) + ". " + step; }).join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(content).then(function () { copyStatus.textContent = "Copied."; }, function () { fallbackCopy(content); });
        } else {
          fallbackCopy(content);
        }
      });

      function fallbackCopy(content) {
        var area = document.createElement("textarea");
        area.value = content;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); copyStatus.textContent = "Copied."; }
        catch (error) { copyStatus.textContent = "Select the assignment and copy it manually."; }
        document.body.removeChild(area);
      }
    }());
  