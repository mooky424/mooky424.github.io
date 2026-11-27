(function () {
  "use strict";

  var ladderDemos = {
    "fmap-list": {
      out: "ladder-fmap",
      text: "ghci> fmap (\\x -> x + 1) [1,2,3]\n[2,3,4]\nit :: [Int]\n\nFor a list, fmap is map."
    },
    "fmap-maybe": {
      out: "ladder-fmap",
      text: "ghci> fmap (\\x -> x + 1) (Just 3)\nJust 4\n\nghci> fmap (\\x -> x + 1) Nothing\nNothing\n\nThe function runs on the value inside Just. Nothing stays Nothing."
    },
    "ap-just": {
      out: "ladder-ap",
      text: "ghci> pure 3 :: Maybe Int\nJust 3\n\nghci> Just (\\x -> x + 1) <*> Just 3\nJust 4\n\npure wraps 3. <*> applies the function that is already inside Just."
    },
    "ap-nothing": {
      out: "ladder-ap",
      text: "ghci> Nothing <*> Just 3\nNothing\n\nThere is no function to apply, so the 3 is never used."
    },
    "bind-go": {
      out: "monad-bind",
      text: "ghci> Just 3 >>= next\nJust 30\n\nnext sees 3, and 3 > 2, so it returns Just 30."
    },
    "bind-stop": {
      out: "monad-bind",
      text: "ghci> Just 1 >>= next\nNothing\n\nnext sees 1. 1 is not greater than 2, so it returns Nothing."
    },
    "bind-nothing": {
      out: "monad-bind",
      text: "ghci> Nothing >>= next\nNothing\n\nThere is no number inside Nothing, so next is never called."
    },
    "law-left": {
      out: "monad-law-left",
      text: "ghci> return 3 >>= next\nJust 30\n\nghci> next 3\nJust 30\n\nWrapping 3 with return and binding next does the same thing as next 3."
    },
    "law-right": {
      out: "monad-law-right",
      text: "ghci> Just 3 >>= return\nJust 3\n\nPassing Just 3 into return gives that same Just 3 back."
    },
    "law-assoc": {
      out: "monad-law-assoc",
      text: "ghci> (Just 3 >>= next) >>= step\nJust 31\n\nghci> Just 3 >>= (\\x -> next x >>= step)\nJust 31\n\nBoth groupings unwrap 3, multiply by 10 to get Just 30, and add 1 to reach Just 31."
    }
  };

  var demos = {
    unused: "foo n = n * n\nalways x y = x\nalways 4 (foo 10)",
    share: "foo n = n * n\ndouble x = x + x\ndouble (foo 10)",
    len: "foo n = n * n\nlength (map foo [1..40])",
    take3: "foo n = n * n\ntake 3 (map foo [1..40])",
    foldl: "plus a b = a + b\nfoldl plus 0 [1..12]",
    "foldl'": "plus a b = a + b\nfoldl' plus 0 [1..12]"
  };

  var demoSlots = {
    unused: ["demo-unused", "out-unused"],
    share: ["demo-share", "out-share"],
    len: ["demo-len", "out-len"],
    take3: ["demo-len", "out-len"],
    foldl: ["demo-fold", "out-fold"],
    "foldl'": ["demo-fold", "out-fold"]
  };

  var presets = {
    "add 2 5": "add x y = x + y\nadd 2 5",
    sumList: "sumList xs = if null xs then 0 else head xs + sumList (tail xs)\nsumList [1,2,3,4]",
    factorial: "factorial n = if n <= 1 then 1 else n * factorial (n - 1)\nfactorial 5",
    fibonacci: "fibonacci n = if n == 0 then 0 else if n == 1 then 1 else fibonacci (n - 1) + fibonacci (n - 2)\nfibonacci 6",
    "incrementList": "incrementList xs = map (\\x -> x + 1) xs\nincrementList [1,2,3]",
    "list comprehension": "map (\\x -> x * 2) [1..5]",
    "noto . eveno": "eveno x = if rem x 2 == 0 then True else False\nnoto x = if x == True then \"This is an even Number\" else \"This is an ODD number\"\n(noto . eveno) 16",
    "Unused argument": demos.unused,
    "Shared thunk": demos.share,
    "length ignores elements": demos.len,
    "take demands three": demos.take3,
    "foldl thunks": demos.foldl,
    "foldl' is strict": demos["foldl'"]
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.querySelectorAll("code[data-lang]").forEach(function (block) {
      window.CodeHighlight.paint(block);
    });
    addCopyButtons();
    spyNav();
    applyConfig();
    setupLadder();
    setupLazy();
    setupDemand();
    setupCurry();
    setupZipper();
    setupExamples();
    setupSandbox();
  }

  function addCopyButtons() {
    document.querySelectorAll("pre").forEach(function (pre) {
      var code = pre.querySelector("code[data-source]");
      if (!code) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "copy";
      button.textContent = "Copy";
      button.addEventListener("click", function () {
        var text = code.dataset.source || code.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            button.textContent = "Copied";
            setTimeout(function () { button.textContent = "Copy"; }, 1200);
          }).catch(function () {
            button.textContent = "Select the code";
          });
        }
      });
      pre.appendChild(button);
    });
  }

  function spyNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".site-nav > a[href^='#']"));
    var sections = links.map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    }).filter(Boolean);
    if (!("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) { link.removeAttribute("aria-current"); });
        var active = links.filter(function (link) {
          return link.getAttribute("href") === "#" + entry.target.id;
        })[0];
        if (active) active.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-15% 0px -70% 0px", threshold: 0.01 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  function memberUrl(href) {
    if (!href) return "./";
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.charAt(0) === "/" || href.charAt(0) === "#" || href.charAt(0) === ".") return href;
    return "https://" + href;
  }

  function applyConfig() {
    var config = window.SITE_CONFIG || {};
    var byline = document.getElementById("byline");
    if (byline) {
      var names = (config.members || []).map(function (member) { return member.name; }).filter(Boolean);
      var credit = [config.course || "CSCI 202"].concat(names.length ? names : (config.author ? [config.author] : []));
      byline.textContent = credit.join(" · ");
    }
    if (config.paperHref) {
      var external = /^https?:/i.test(config.paperHref);
      document.querySelectorAll("[data-paper]").forEach(function (link) {
        link.href = config.paperHref;
        if (external) {
          link.removeAttribute("download");
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
      });
    }
    if (config.paperLabel) {
      document.querySelectorAll("[data-paper-label]").forEach(function (link) {
        link.textContent = config.paperLabel;
      });
    }
    var list = document.getElementById("member-list");
    if (!config.members || !list) return;
    list.textContent = "";
    config.members.forEach(function (member) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = memberUrl(member.href);
      if (member.here) {
        link.className = "here";
        link.setAttribute("aria-current", "page");
      }
      var name = document.createElement("strong");
      name.textContent = member.name || "";
      link.appendChild(name);
      var detail = [];
      if (member.role) detail.push(member.role);
      if (member.here) detail.push("this site");
      if (detail.length) link.appendChild(document.createTextNode(" " + detail.join(" · ")));
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function setupLadder() {
    document.querySelectorAll("[data-ladder]").forEach(function (button) {
      button.addEventListener("click", function () {
        var demo = ladderDemos[button.getAttribute("data-ladder")];
        if (!demo) return;
        var out = document.getElementById(demo.out);
        if (!out) return;
        out.textContent = demo.text;
        out.classList.remove("is-error");
        markRan(out, button);
      });
    });
  }

  function setupLazy() {
    var demand = document.getElementById("demand");
    var len = document.getElementById("sourcelen");
    if (!demand || !len) return;
    function paint() {
      var need = Number(demand.value);
      var total = Number(len.value);
      var forced = Math.min(need, total);
      document.getElementById("lazy-work").textContent = String(forced);
      document.getElementById("eager-work").textContent = String(total);
      document.getElementById("lazy-caption").textContent = forced + " square" + (forced === 1 ? "" : "s") + " forced. take " + need + " never asks for the rest.";
      document.getElementById("eager-caption").textContent = total + " squares forced, then " + Math.max(0, total - need) + " discarded.";
      fillCells(document.getElementById("lazy-cells"), total, function (i) {
        if (i <= need) return "forced";
        return "thunk";
      });
      fillCells(document.getElementById("eager-cells"), total, function (i) {
        if (i <= need) return "forced";
        return "dead";
      });
    }
    demand.addEventListener("input", paint);
    len.addEventListener("input", paint);
    paint();
  }

  function fillCells(host, total, classify) {
    host.textContent = "";
    for (var i = 1; i <= total; i++) {
      var cell = document.createElement("span");
      var kind = classify(i);
      cell.className = "cell " + kind;
      cell.textContent = kind === "thunk" ? "·" : String(i * i);
      cell.title = kind === "thunk"
        ? "Thunk for " + i + " squared. Nothing has demanded it."
        : kind === "dead"
          ? i + " squared was computed, then take threw it away."
          : i + " squared, and the result is kept.";
      host.appendChild(cell);
    }
  }

  function setupDemand() {
    document.querySelectorAll("[data-demo]").forEach(function (button) {
      button.addEventListener("click", function () {
        runDemo(button.getAttribute("data-demo"), button);
      });
    });
  }

  function runDemo(name, button) {
    var source = demos[name];
    var slot = demoSlots[name];
    var out = slot ? document.getElementById(slot[1]) : null;
    if (!source || !slot || !out) return;
    if (!window.HaskellSandbox) {
      out.textContent = "The interpreter did not load. Reload the page.";
      out.classList.add("is-error");
      markRan(out, button);
      return;
    }
    var code = document.getElementById(slot[0]);
    code.dataset.source = source;
    window.CodeHighlight.paint(code);
    try {
      paintSandbox(window.HaskellSandbox.run(source), out, null);
    } catch (err) {
      out.textContent = err && err.message ? err.message : String(err);
      out.classList.add("is-error");
    }
    markRan(out, button);
  }

  function setupCurry() {
    var view = document.getElementById("curry-view");
    var apply = document.getElementById("cur-apply");
    var reset = document.getElementById("cur-reset");
    if (!view || !apply) return;
    var stage = 0;
    function value(id) {
      var input = document.getElementById(id);
      var number = Number(input.value);
      return Number.isInteger(number) ? number : null;
    }
    function paint() {
      var x = value("cur-x");
      var y = value("cur-y");
      view.textContent = "";
      if (x === null || y === null) {
        view.textContent = "Both arguments need to be integers.";
        return;
      }
      var cards = [
        ["add :: Integer -> Integer -> Integer", true],
        [stage >= 1 ? "add " + x + " :: Integer -> Integer" : "Waiting for the first integer.", stage >= 1],
        [stage >= 2 ? "add " + x + " " + y + " = " + (x + y) : "Waiting for the second integer.", stage >= 2]
      ];
      cards.forEach(function (card) {
        var el = document.createElement("div");
        el.className = "curry-card" + (card[1] ? " on" : " wait");
        el.textContent = card[0];
        view.appendChild(el);
      });
    }
    apply.addEventListener("click", function () {
      stage = Math.min(2, stage + 1);
      paint();
    });
    reset.addEventListener("click", function () {
      stage = 0;
      paint();
    });
    ["cur-x", "cur-y"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", paint);
    });
    paint();
  }

  function setupZipper() {
    var view = document.getElementById("zip-view");
    if (!view) return;
    var left = [];
    var focus = 1;
    var right = [2, 3, 4, 5];
    function paint() {
      var before = left.slice().reverse();
      view.textContent = "";
      before.concat(["[" + focus + "]"]).concat(right).forEach(function (part, index) {
        var label = String(part);
        var span = document.createElement("span");
        span.className = "cell" + (label.charAt(0) === "[" ? " forced" : "");
        span.textContent = label;
        if (index === before.length) span.title = "Focus. replace changes this cell only.";
        view.appendChild(span);
      });
      var note = document.getElementById("zip-note");
      if (note) {
        note.textContent = "Zipper is ([" + left.join(",") + "], " + focus + ", [" + right.join(",") + "]). The left list is stored reversed, so the nearest neighbor is the head.";
      }
    }
    document.getElementById("zip-right").addEventListener("click", function () {
      if (!right.length) return;
      left = [focus].concat(left);
      focus = right[0];
      right = right.slice(1);
      paint();
    });
    document.getElementById("zip-left").addEventListener("click", function () {
      if (!left.length) return;
      right = [focus].concat(right);
      focus = left[0];
      left = left.slice(1);
      paint();
    });
    document.getElementById("zip-set").addEventListener("click", function () {
      var n = Number(document.getElementById("zip-val").value);
      if (!Number.isInteger(n)) return;
      focus = n;
      paint();
    });
    paint();
  }

  function setupExamples() {
    ["sum-list", "fact-n", "fib-n", "inc-list", "quad-a", "quad-b", "quad-c", "sort-list", "comp-n", "add-x", "add-y", "hello-msg"].forEach(function (id) {
      bindInput(id, paintExamples);
    });
    paintExamples();
  }

  function paintExamples() {
    paintSum();
    paintFact();
    paintFib();
    paintInc();
    paintQuad();
    paintSort();
    paintComp();
    paintAdd();
    paintHello();
  }

  function bindInput(id, fn) {
    var input = document.getElementById(id);
    if (input) input.addEventListener("input", fn);
  }

  function paintSum() {
    var nums = parseInts(valueOf('sum-list'));
    if (!nums) return showResult('sum', { error: 'Type integers separated by spaces or commas.' });
    var total = nums.reduce(function (acc, n) { return acc + n; }, 0);
    showResult('sum', {
      expr: 'sumList ' + showList(nums),
      value: String(total),
      type: 'Int',
      note: nums.length ? 'The (x:xs) equation peels one element at a time until the [] equation returns 0.' : 'The empty-list equation returns 0. There is nothing to add.'
    });
  }

  function paintFact() {
    var n = integerValue('fact-n');
    if (n === null) return showResult('fact', { error: 'factorial expects an Integer.' });
    if (n > 20 || n < -20) return showResult('fact', { error: 'Keep n between -20 and 20 so the product stays readable.' });
    if (n <= 1) {
      showResult('fact', {
        expr: 'factorial ' + n,
        value: '1',
        type: 'Integer',
        note: 'The first guard is n <= 1, and it matches. otherwise is never tried. That includes 0 and negative inputs, so this factorial is not the mathematical one for those values.'
      });
      return;
    }
    var result = 1;
    for (var i = 2; i <= n; i++) result *= i;
    showResult('fact', {
      expr: 'factorial ' + n,
      value: String(result),
      type: 'Integer',
      note: 'Guards run from top to bottom. n <= 1 fails, so otherwise multiplies n by factorial (n - 1).'
    });
  }

  function paintFib() {
    var n = integerValue('fib-n');
    if (n === null || n < 0) return showResult('fib', { error: 'The equations cover 0, 1, and n greater than 1. Type a non-negative Int.' });
    if (n > 25) return showResult('fib', { error: 'This recursion repeats overlapping calls. Keep n at 25 or below in the demo.' });
    function fib(k) {
      if (k === 0) return 0;
      if (k === 1) return 1;
      return fib(k - 1) + fib(k - 2);
    }
    showResult('fib', {
      expr: 'fibonacci ' + n,
      value: String(fib(n)),
      type: 'Int',
      note: n < 2 ? 'This input hits a base equation directly.' : 'There is no loop. fibonacci ' + n + ' is fibonacci ' + (n - 1) + ' plus fibonacci ' + (n - 2) + ', and those calls repeat work a loop would not.'
    });
  }

  function paintInc() {
    var nums = parseInts(valueOf('inc-list'));
    if (!nums) return showResult('inc', { error: 'Type integers separated by spaces or commas.' });
    showResult('inc', {
      expr: 'incrementList ' + showList(nums),
      value: showList(nums.map(function (n) { return n + 1; })),
      type: '[Int]',
      note: 'The lambda (\\x -> x + 1) is an unnamed function passed straight to map. It does not need its own equation.'
    });
  }

  function paintQuad() {
    var a = numberValue('quad-a');
    var b = numberValue('quad-b');
    var c = numberValue('quad-c');
    if (a === null || b === null || c === null) return showResult('quad', { error: 'a, b, and c need to be numbers.' });
    if (a === 0) return showResult('quad', { error: 'a is 0, so the formula divides by zero. This where-clause is written for a quadratic.' });
    var discriminant = b * b - 4 * a * c;
    var root1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    var root2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    var note = 'discriminant = ' + trimNumber(discriminant) + '. root1 uses the plus sign and root2 uses the minus sign. Both names come from the where clause.';
    if (discriminant < 0) note += ' The square root of a negative Float is NaN. The equations do not switch to complex numbers.';
    showResult('quad', {
      expr: 'quadraticRoots ' + trimNumber(a) + ' ' + trimNumber(b) + ' ' + trimNumber(c),
      value: '(' + showFloat(root1) + ',' + showFloat(root2) + ')',
      type: '(Float, Float)',
      note: note
    });
  }

  function paintSort() {
    var nums = parseInts(valueOf('sort-list'));
    if (!nums) return showResult('sort', { error: 'Type integers separated by spaces or commas.' });
    var pivotNote = 'The empty list stays empty.';
    if (nums.length) {
      var pivot = nums[0];
      var smaller = nums.slice(1).filter(function (a) { return a <= pivot; });
      var larger = nums.slice(1).filter(function (a) { return a > pivot; });
      pivotNote = 'The first pivot is ' + pivot + '. Smaller or equal: ' + showList(smaller) + '. Larger: ' + showList(larger) + '. Each side is sorted by the same equation.';
    }
    showResult('sort', {
      expr: 'quicksort ' + showList(nums),
      value: showList(quicksort(nums)),
      type: '[Int]',
      note: pivotNote
    });
  }

  function paintComp() {
    var n = integerValue('comp-n');
    if (n === null) return showResult('comp', { error: 'Type an Int.' });
    var even = n % 2 === 0;
    var text = even ? 'This is an even Number' : 'This is an ODD number';
    showResult('comp', {
      expr: '(noto . eveno) ' + n,
      value: quote(text),
      type: 'String',
      note: 'eveno ' + n + ' is ' + (even ? 'True' : 'False') + ' because rem ' + n + ' 2 ' + (even ? '==' : '/=' ) + ' 0. noto turns that Bool into the string. The dot applies eveno first.'
    });
  }

  function paintAdd() {
    var x = integerValue('add-x');
    var y = integerValue('add-y');
    if (x === null || y === null) return showResult('add', { error: 'Both arguments need to be Integers.' });
    showResult('add', {
      io: true,
      value: 'The sum of the two numbers is:\n' + (x + y),
      note: 'add ' + x + ' ' + y + ' = ' + (x + y) + '. main has type IO () because putStrLn and print touch the screen. The addition itself is a pure equation.'
    });
  }

  function paintHello() {
    var message = valueOf('hello-msg');
    showResult('hello', {
      io: true,
      value: message,
      note: 'A complete program needs main :: IO (). putStrLn prints one line and adds the newline. Changing the string changes only the argument, not the type.'
    });
  }

  function quicksort(xs) {
    if (!xs.length) return [];
    var pivot = xs[0];
    var rest = xs.slice(1);
    return quicksort(rest.filter(function (a) { return a <= pivot; }))
      .concat([pivot], quicksort(rest.filter(function (a) { return a > pivot; })));
  }

  function parseInts(text) {
    if (text == null) return null;
    var trimmed = String(text).trim();
    if (!trimmed) return [];
    var parts = trimmed.split(/[\s,]+/);
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      if (!/^-?\d+$/.test(parts[i])) return null;
      nums.push(Number(parts[i]));
    }
    return nums;
  }

  function showList(nums) {
    return '[' + nums.join(',') + ']';
  }

  function integerValue(id) {
    var raw = valueOf(id);
    if (raw == null || String(raw).trim() === '' || !/^-?\d+$/.test(String(raw).trim())) return null;
    return Number(raw);
  }

  function numberValue(id) {
    var raw = valueOf(id);
    if (raw == null || String(raw).trim() === '') return null;
    var n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function valueOf(id) {
    var el = document.getElementById(id);
    return el ? el.value : null;
  }

  function showResult(id, result) {
    var note = document.getElementById(id + "-note");
    var out = document.getElementById(id + "-out");
    if (!out) return;
    if (result.error) {
      out.textContent = result.error;
      out.classList.add("is-error");
      if (note) note.textContent = result.error;
      return;
    }
    out.classList.remove("is-error");
    out.textContent = result.io ? result.value : ("ghci> " + result.expr + "\n" + result.value + "\nit :: " + result.type);
    if (note) note.textContent = result.note;
  }

  function setupSandbox() {
    var select = document.getElementById("preset");
    var source = document.getElementById("source");
    var run = document.getElementById("run");
    if (!select || !source || !run) return;
    Object.keys(presets).forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    document.getElementById("load-preset").addEventListener("click", function () {
      source.value = presets[select.value];
      runSandbox(run);
    });
    run.addEventListener("click", function () {
      runSandbox(run);
    });
    source.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runSandbox(run);
      }
    });
  }

  function runSandbox(button) {
    var source = document.getElementById("source");
    var out = document.getElementById("sandbox-out");
    var log = document.getElementById("sandbox-log");
    if (!out) return;
    if (!window.HaskellSandbox) {
      out.textContent = "The interpreter did not load. Reload the page.";
      out.classList.add("is-error");
      markRan(out, button);
      return;
    }
    try {
      paintSandbox(window.HaskellSandbox.run(source.value), out, log);
    } catch (err) {
      out.textContent = err && err.message ? err.message : String(err);
      out.classList.add("is-error");
      if (log) log.textContent = "";
    }
    markRan(out, button);
  }

  function markRan(out, button) {
    if (out) {
      out.classList.remove("just-ran");
      void out.offsetWidth;
      out.classList.add("just-ran");
      out.scrollIntoView({ block: "nearest" });
    }
    if (!button) return;
    var label = button.getAttribute("data-label") || button.textContent;
    button.setAttribute("data-label", label);
    button.textContent = "Ran";
    clearTimeout(button._ranTimer);
    button._ranTimer = setTimeout(function () {
      button.textContent = label;
    }, 900);
  }

  function paintSandbox(result, out, log) {
    if (!result.ok) {
      out.textContent = result.error;
      out.classList.add("is-error");
      if (log) log.textContent = "";
      return;
    }
    out.classList.remove("is-error");
    var lines = [result.value, "it :: " + result.type];
    if (result.functionResult) lines.push("", "That value is a function. Supply another argument and the body will run.");
    if (result.foldlThunks > 0) {
      lines.push("", "foldl built " + result.foldlThunks + " nested accumulator thunk" + (result.foldlThunks === 1 ? "" : "s") + " before the result was demanded. foldl' would have kept a number.");
    }
    if (!result.logCount) lines.push("", "None of your equations were demanded.");
    else lines.push("", "Demanded, in order: " + result.log.join(", ") + (result.logTruncated ? ", ..." : "") + ".");
    out.textContent = lines.join("\n");
    if (!log) return;
    log.textContent = "";
    result.log.forEach(function (name) {
      var chip = document.createElement("span");
      chip.textContent = name;
      log.appendChild(chip);
    });
  }


  function quote(text) {
    return '"' + String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function trimNumber(value) {
    return Math.round(value * 100) / 100;
  }

  function showFloat(value) {
    if (!Number.isFinite(value)) return String(value);
    var rounded = Math.round(value * 1000) / 1000;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return rounded.toFixed(1);
    return String(rounded);
  }
})();
