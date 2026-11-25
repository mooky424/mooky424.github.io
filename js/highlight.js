(function (root) {
  "use strict";

  var KEYWORDS = {
    haskell: ["case", "of", "if", "then", "else", "let", "in", "where", "do", "module", "import", "data", "type", "newtype", "class", "instance", "deriving", "infix", "infixl", "infixr", "foreign", "qualified", "as", "hiding"],
    purescript: ["case", "of", "if", "then", "else", "let", "in", "where", "do", "module", "import", "data", "type", "newtype", "class", "instance", "deriving", "foreign", "forall", "ado"],
    idris: ["case", "of", "if", "then", "else", "let", "in", "where", "do", "module", "import", "data", "type", "interface", "implementation", "total", "covering", "mutual", "public", "export"],
    ocaml: ["let", "rec", "match", "with", "fun", "function", "if", "then", "else", "in", "begin", "end", "module", "struct", "open", "type", "of", "val", "and"],
    elm: ["if", "then", "else", "let", "in", "case", "of", "type", "alias", "module", "import", "exposing", "port"],
    javascript: ["const", "let", "var", "function", "return", "export", "import", "if", "else", "new", "from"]
  };

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlight(code, lang) {
    var words = KEYWORDS[lang] || KEYWORDS.haskell;
    var table = Object.create(null);
    words.forEach(function (word) { table[word] = true; });
    var src = String(code).replace(/\r\n/g, "\n");
    var out = "";
    var i = 0;

    while (i < src.length) {
      var c = src.charAt(i);
      var two = src.slice(i, i + 2);

      if ((lang === "ocaml" && two === "(*") ) {
        var close = src.indexOf("*)", i + 2);
        var end = close === -1 ? src.length : close + 2;
        out += '<span class="cm">' + escapeHtml(src.slice(i, end)) + "</span>";
        i = end;
        continue;
      }

      if (lang === "javascript" && two === "//") {
        var nl = src.indexOf("\n", i);
        var stop = nl === -1 ? src.length : nl;
        out += '<span class="cm">' + escapeHtml(src.slice(i, stop)) + "</span>";
        i = stop;
        continue;
      }

      if (lang !== "ocaml" && lang !== "javascript" && two === "--") {
        var lineEnd = src.indexOf("\n", i);
        var commentEnd = lineEnd === -1 ? src.length : lineEnd;
        out += '<span class="cm">' + escapeHtml(src.slice(i, commentEnd)) + "</span>";
        i = commentEnd;
        continue;
      }

      if (lang !== "ocaml" && lang !== "javascript" && two === "{-") {
        var block = src.indexOf("-}", i + 2);
        var blockEnd = block === -1 ? src.length : block + 2;
        out += '<span class="cm">' + escapeHtml(src.slice(i, blockEnd)) + "</span>";
        i = blockEnd;
        continue;
      }

      if (c === '"') {
        var j = i + 1;
        while (j < src.length && src.charAt(j) !== '"') {
          if (src.charAt(j) === "\\") j += 2;
          else j++;
        }
        if (j < src.length) j++;
        out += '<span class="st">' + escapeHtml(src.slice(i, j)) + "</span>";
        i = j;
        continue;
      }

      if (c === "'") {
        var k = i + 1;
        if (src.charAt(k) === "\\") k += 2;
        else k++;
        if (src.charAt(k) === "'") k++;
        out += '<span class="ch">' + escapeHtml(src.slice(i, k)) + "</span>";
        i = k;
        continue;
      }

      if (c >= "0" && c <= "9") {
        var n = i;
        while (n < src.length && /[0-9.]/.test(src.charAt(n))) n++;
        out += '<span class="nm">' + escapeHtml(src.slice(i, n)) + "</span>";
        i = n;
        continue;
      }

      if (/[A-Za-z_]/.test(c)) {
        var id = i;
        while (id < src.length && /[A-Za-z0-9_']/.test(src.charAt(id))) id++;
        var name = src.slice(i, id);
        var cls = table[name] ? "kw" : (/^[A-Z]/.test(name) ? "ty" : "");
        out += cls ? '<span class="' + cls + '">' + escapeHtml(name) + "</span>" : escapeHtml(name);
        i = id;
        continue;
      }

      if ("=+-/<>:!|&*.$\\".indexOf(c) !== -1) {
        var op = i;
        while (op < src.length && "=+-/<>:!|&*.$\\".indexOf(src.charAt(op)) !== -1) op++;
        out += '<span class="op">' + escapeHtml(src.slice(i, op)) + "</span>";
        i = op;
        continue;
      }

      out += escapeHtml(c);
      i++;
    }

    return out;
  }

  function paint(block) {
    var lang = block.getAttribute("data-lang") || "haskell";
    if (!block.dataset.source) {
      block.dataset.source = block.textContent.replace(/^\n/, "").replace(/\s+$/, "");
    }
    block.innerHTML = highlight(block.dataset.source, lang);
  }

  root.CodeHighlight = { highlight: highlight, paint: paint };
})(typeof window !== "undefined" ? window : globalThis);
