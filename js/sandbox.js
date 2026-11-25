/* Teaching interpreter for a Haskell subset.
   Evaluation is call-by-need: arguments and lets are shared thunks.
   This is not GHC. The studio section on the page shows full Haskell. */
(function (root) {
  "use strict";

  var MAX_STEPS = 250000;
  var MAX_CELLS = 100000;
  var CTX = null;

  function run(source) {
    CTX = { steps: 0, cells: 0, foldlThunks: 0, log: [] };
    try {
      var parts = splitProgram(source);
      if (!parts.expr.trim()) {
        throw new Error("Add an expression to evaluate as the last block, starting at column 0.");
      }
      var env = Object.create(baseEnv);
      defineDecls(parts.decls, env);
      var value = evalExpr(parseExpression(parts.expr), env);
      var shown = showValue(value, 0);
      var type = typeName(value);
      var log = CTX.log.slice(0, 48);
      return {
        ok: true,
        value: shown,
        type: type,
        log: log,
        logCount: CTX.log.length,
        logTruncated: CTX.log.length > log.length,
        foldlThunks: CTX.foldlThunks,
        functionResult: isFunction(forceVal(value))
      };
    } catch (err) {
      var message = err && err.message ? err.message : String(err);
      if (err && err.name === "RangeError") {
        message = "Recursion went too deep for this sandbox. Try a smaller input, or use foldl' for a long strict fold.";
      }
      if (err && err.line && message.indexOf("Line ") !== 0) {
        message = "Line " + err.line + ": " + message;
      }
      return { ok: false, error: message };
    }
  }

  function splitProgram(source) {
    var lines = String(source).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var decls = [];
    var expr = [];
    var i = 0;

    function meaningful(line) {
      var t = line.trim();
      return t !== "" && t.indexOf("--") !== 0;
    }

    while (i < lines.length) {
      if (!meaningful(lines[i])) {
        i++;
        continue;
      }
      var trim = lines[i].trim();
      if (/^(module|import)\b/.test(trim)) {
        i++;
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9_']*\s*::/.test(trim)) {
        i++;
        continue;
      }
      if (expr.length === 0 && isDeclStart(trim)) {
        var buf = trim;
        i++;
        while (i < lines.length) {
          if (!lines[i].trim() || lines[i].trim().indexOf("--") === 0) {
            i++;
            continue;
          }
          if (/^\s+\S/.test(lines[i])) {
            buf += "\n" + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        decls.push(buf);
        continue;
      }
      expr.push(lines[i]);
      i++;
    }

    return { decls: decls, expr: expr.join("\n") };
  }

  function isDeclStart(trim) {
    var match = /^([A-Za-z][A-Za-z0-9_']*)(\s+[A-Za-z][A-Za-z0-9_']*)*\s*=(?![=])/.exec(trim);
    if (!match) return false;
    var name = match[1];
    return !isKeyword(name) && !UNSUPPORTED[name];
  }

  function parseExpression(source) {
    var parser = new Parser(tokenize(source));
    var expr = parser.parseBin(0, {});
    parser.skipNoise();
    if (!parser.done()) {
      throw parser.error("I could not parse the rest of this expression");
    }
    return expr;
  }

  function parseDecl(source) {
    var parser = new Parser(tokenize(source));
    var nameTok = parser.peek();
    if (!nameTok || nameTok.type !== "ident") {
      throw parser.error("A declaration must start with a name");
    }
    if (isKeyword(nameTok.value)) {
      throw parser.error("`" + nameTok.value + "` cannot be a function name");
    }
    parser.eat();
    var params = [];
    while (parser.peek() && parser.peek().type === "ident" && !isKeyword(parser.peek().value)) {
      params.push(parser.eat().value);
    }
    if (!parser.match("punct", "=")) {
      throw parser.error("Expected = in a declaration");
    }
    var expr = parser.parseBin(0, {});
    parser.skipNoise();
    if (!parser.done()) {
      throw parser.error("Unexpected input after a declaration");
    }
    return { name: nameTok.value, params: params, expr: expr, line: nameTok.line };
  }

  function defineDecls(decls, env) {
    var parsed = decls.map(parseDecl);
    parsed.forEach(function (d) {
      if (d.params.length) {
        env[d.name] = {
          tag: "fn",
          name: d.name,
          params: d.params,
          body: d.expr,
          env: env
        };
      } else {
        env[d.name] = makeLazy(function () {
          return evalExpr(d.expr, env);
        }, d.line);
      }
    });
  }

  function tokenize(source) {
    var tokens = [];
    var i = 0;
    var line = 1;
    var col = 1;
    var src = String(source);

    function bump(n) {
      var chunk = src.slice(i, i + n);
      for (var k = 0; k < chunk.length; k++) {
        if (chunk.charAt(k) === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
      }
      i += n;
    }

    while (i < src.length) {
      var c = src.charAt(i);
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        bump(1);
        continue;
      }
      if (c === "-" && src.charAt(i + 1) === "-") {
        while (i < src.length && src.charAt(i) !== "\n") bump(1);
        continue;
      }
      if (c === "{" && src.charAt(i + 1) === "-") {
        var startLine = line;
        bump(2);
        while (i < src.length && !(src.charAt(i) === "-" && src.charAt(i + 1) === "}")) bump(1);
        if (i >= src.length) throw plain("Line " + startLine + ": Unclosed {- comment -}");
        bump(2);
        continue;
      }
      if (c === '"') {
        var sLine = line;
        var sCol = col;
        bump(1);
        var text = "";
        while (i < src.length && src.charAt(i) !== '"') {
          if (src.charAt(i) === "\\") {
            var e = src.charAt(i + 1);
            if (e === "n") text += "\n";
            else if (e === "t") text += "\t";
            else if (e === '"' || e === "\\" || e === "'") text += e;
            else throw plain("Line " + line + ": Unknown string escape");
            bump(2);
          } else if (src.charAt(i) === "\n") {
            throw plain("Line " + sLine + ": Unclosed string");
          } else {
            text += src.charAt(i);
            bump(1);
          }
        }
        if (src.charAt(i) !== '"') throw plain("Line " + sLine + ": Unclosed string");
        bump(1);
        tokens.push({ type: "string", value: text, line: sLine, col: sCol });
        continue;
      }
      if (c === "'") {
        var chLine = line;
        var chCol = col;
        bump(1);
        var ch;
        if (src.charAt(i) === "\\") {
          var esc = src.charAt(i + 1);
          if (esc === "n") ch = "\n";
          else if (esc === "'" || esc === "\\" || esc === '"') ch = esc;
          else throw plain("Line " + line + ": Unknown character escape");
          bump(2);
        } else {
          ch = src.charAt(i);
          if (!ch || ch === "\n") throw plain("Line " + chLine + ": Unclosed character literal");
          bump(1);
        }
        if (src.charAt(i) !== "'") throw plain("Line " + chLine + ": A character literal holds one character");
        bump(1);
        tokens.push({ type: "char", value: ch, line: chLine, col: chCol });
        continue;
      }
      if (c >= "0" && c <= "9") {
        var nLine = line;
        var nCol = col;
        var start = i;
        while (i < src.length && src.charAt(i) >= "0" && src.charAt(i) <= "9") bump(1);
        if (src.charAt(i) === "." && src.charAt(i + 1) >= "0" && src.charAt(i + 1) <= "9") {
          throw plain("Line " + nLine + ": Decimal numbers are not in this sandbox. Stay with Integers.");
        }
        tokens.push({ type: "number", value: Number(src.slice(start, i)), line: nLine, col: nCol });
        continue;
      }
      var three = src.slice(i, i + 3);
      var two = src.slice(i, i + 2);
      if (two === ".." || two === "->" || two === "==" || two === "/=" || two === "<=" || two === ">=" || two === "++" || two === "&&" || two === "||" || two === "::") {
        tokens.push({ type: two === "::" ? "punct" : "op", value: two, line: line, col: col });
        bump(2);
        continue;
      }
      if ("()[],\\=".indexOf(c) !== -1) {
        tokens.push({ type: "punct", value: c, line: line, col: col });
        bump(1);
        continue;
      }
      if ("+-*:<>./|`".indexOf(c) !== -1) {
        tokens.push({ type: "op", value: c, line: line, col: col });
        bump(1);
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var idLine = line;
        var idCol = col;
        var j = i;
        while (i < src.length && /[A-Za-z0-9_']/.test(src.charAt(i))) bump(1);
        tokens.push({ type: "ident", value: src.slice(j, i), line: idLine, col: idCol });
        continue;
      }
      throw plain("Line " + line + ": Unexpected character `" + c + "`");
    }
    return tokens;
  }

  function Parser(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  Parser.prototype.peek = function () {
    return this.tokens[this.i];
  };

  Parser.prototype.eat = function () {
    return this.tokens[this.i++];
  };

  Parser.prototype.done = function () {
    return this.i >= this.tokens.length;
  };

  Parser.prototype.match = function (type, value) {
    var t = this.peek();
    if (t && t.type === type && (value === undefined || t.value === value)) {
      this.i++;
      return true;
    }
    return false;
  };

  Parser.prototype.error = function (message) {
    var t = this.peek();
    var err = new Error(message);
    if (t) {
      err.line = t.line;
    } else if (this.tokens.length) {
      err.line = this.tokens[this.tokens.length - 1].line;
    }
    return err;
  };

  Parser.prototype.skipNoise = function () {};

  Parser.prototype.parseBin = function (min, stops) {
    var left = this.parseApp(stops);
    while (true) {
      var t = this.peek();
      if (!t || t.type !== "op" || !Object.prototype.hasOwnProperty.call(PREC, t.value) || PREC[t.value] < min) break;
      var prec = PREC[t.value];
      var op = t.value;
      this.eat();
      var nextMin = RIGHT[op] ? prec : prec + 1;
      var right = this.parseBin(nextMin, stops);
      left = { type: "bin", op: op, left: left, right: right, line: t.line, col: t.col };
      if (NONASSOC[op]) {
        var next = this.peek();
        if (next && next.type === "op" && NONASSOC[next.value]) {
          throw this.error("`" + next.value + "` does not chain. Use && between comparisons.");
        }
      }
    }
    return left;
  };

  Parser.prototype.parseApp = function (stops) {
    var left = this.parsePrimary(stops);
    while (this.canStartPrimary(stops)) {
      var arg = this.parsePrimary(stops);
      left = { type: "app", fn: left, arg: arg, line: left.line, col: left.col };
    }
    return left;
  };

  Parser.prototype.canStartPrimary = function (stops) {
    var t = this.peek();
    if (!t) return false;
    if (t.type === "ident") return !stops[t.value] && !isStopWord(t.value);
    if (t.type === "number" || t.type === "string" || t.type === "char") return true;
    if (t.type === "punct" && (t.value === "(" || t.value === "[" || t.value === "\\")) return true;
    return false;
  };

  Parser.prototype.parsePrimary = function (stops) {
    var t = this.peek();
    if (!t) throw this.error("Unexpected end of expression");
    if (t.type === "ident" && t.value === "if") return this.parseIf(stops);
    if (t.type === "ident" && t.value === "let") return this.parseLet(stops);
    if (t.type === "punct" && t.value === "\\") return this.parseLambda(stops);
    if (t.type === "op" && t.value === "-") {
      this.eat();
      var expr = this.parsePrimary(stops);
      return { type: "neg", expr: expr, line: t.line, col: t.col };
    }
    if (t.type === "number" || t.type === "string" || t.type === "char") {
      this.eat();
      return { type: t.type, value: t.value, line: t.line, col: t.col };
    }
    if (t.type === "punct" && t.value === "(") {
      this.eat();
      var inner = this.parseBin(0, {});
      if (!this.match("punct", ")")) throw this.error("Expected )");
      return inner;
    }
    if (t.type === "punct" && t.value === "[") return this.parseList();
    if (t.type === "ident") {
      if (stops[t.value] || isStopWord(t.value)) throw this.error("Unexpected `" + t.value + "`");
      if (UNSUPPORTED[t.value]) throw this.error(UNSUPPORTED[t.value]);
      this.eat();
      return { type: "var", name: t.value, line: t.line, col: t.col };
    }
    if (t.type === "op" && (t.value === "`" || t.value === "|")) {
      throw this.error(t.value === "`"
        ? "Backtick operators are not in the sandbox. Write mod n 3, not n `mod` 3."
        : "Guards are not in the sandbox. Write if/then/else. The studio keeps the guard spelling.");
    }
    if (t.type === "punct" && t.value === "::") {
      throw this.error("Type signatures are ignored only when a whole line is a signature. Move `::` onto its own line, or delete it here.");
    }
    throw this.error("Unexpected `" + t.value + "`");
  };

  Parser.prototype.parseIf = function (stops) {
    var t = this.eat();
    var condStops = extendStop(stops, "then");
    var cond = this.parseBin(0, condStops);
    if (!(this.peek() && this.peek().type === "ident" && this.peek().value === "then")) {
      throw this.error("Expected then");
    }
    this.eat();
    var thenStops = extendStop(stops, "else");
    var yes = this.parseBin(0, thenStops);
    if (!(this.peek() && this.peek().type === "ident" && this.peek().value === "else")) {
      throw this.error("Expected else");
    }
    this.eat();
    var no = this.parseBin(0, stops);
    return { type: "if", cond: cond, then: yes, else: no, line: t.line, col: t.col };
  };

  Parser.prototype.parseLet = function (stops) {
    var t = this.eat();
    var nameTok = this.peek();
    if (!nameTok || nameTok.type !== "ident" || isKeyword(nameTok.value)) {
      throw this.error("Expected a name after let");
    }
    this.eat();
    var params = [];
    while (this.peek() && this.peek().type === "ident" && !isKeyword(this.peek().value)) {
      params.push(this.eat().value);
    }
    if (!this.match("punct", "=")) throw this.error("Expected = after let");
    var rhsStops = extendStop(stops, "in");
    var rhs = this.parseBin(0, rhsStops);
    if (!(this.peek() && this.peek().type === "ident" && this.peek().value === "in")) {
      throw this.error("Expected in");
    }
    this.eat();
    var body = this.parseBin(0, stops);
    return {
      type: "let",
      name: nameTok.value,
      params: params,
      rhs: rhs,
      body: body,
      line: t.line,
      col: t.col
    };
  };

  Parser.prototype.parseLambda = function (stops) {
    var t = this.eat();
    var params = [];
    while (this.peek() && this.peek().type === "ident" && !isKeyword(this.peek().value)) {
      params.push(this.eat().value);
    }
    if (!params.length) throw this.error("A lambda needs a parameter");
    if (!this.match("op", "->")) throw this.error("Expected -> in a lambda");
    var body = this.parseBin(0, stops);
    return { type: "lam", params: params, body: body, line: t.line, col: t.col };
  };

  Parser.prototype.parseList = function () {
    var t = this.eat();
    if (this.match("punct", "]")) return { type: "list", items: [], line: t.line, col: t.col };
    var first = this.parseBin(0, {});
    if (this.match("op", "..")) {
      if (this.match("punct", "]")) {
        throw this.error("Write a finite range such as [1..20].");
      }
      var last = this.parseBin(0, {});
      if (!this.match("punct", "]")) throw this.error("Expected ]");
      return { type: "range", from: first, to: last, line: t.line, col: t.col };
    }
    var items = [first];
    while (this.match("punct", ",")) items.push(this.parseBin(0, {}));
    if (!this.match("punct", "]")) throw this.error("Expected ]");
    return { type: "list", items: items, line: t.line, col: t.col };
  };

  function extendStop(stops, word) {
    var next = Object.create(stops);
    next[word] = true;
    return next;
  }

  var PREC = {
    ".": 9,
    "*": 7,
    "+": 6,
    "-": 6,
    ":": 5,
    "++": 5,
    "==": 4,
    "/=": 4,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "&&": 3,
    "||": 2
  };

  var RIGHT = { ".": true, ":": true, "++": true, "&&": true, "||": true };
  var NONASSOC = { "==": true, "/=": true, "<": true, ">": true, "<=": true, ">=": true };

  var UNSUPPORTED = {
    where: "`where` is not in the sandbox. Use `let`.",
    case: "`case` is not in the sandbox.",
    do: "`do` is not in the sandbox.",
    data: "`data` declarations are not in the sandbox. Maybe, Just, and Nothing are already defined.",
    type: "`type` declarations are not in the sandbox.",
    newtype: "`newtype` is not in the sandbox.",
    class: "The sandbox cannot declare a type class.",
    instance: "The sandbox cannot declare instances.",
    module: "Start from the expression. Module headers are skipped only when they occupy a whole line.",
    import: "Imports are skipped only when they occupy a whole line.",
    of: "Unexpected `of`.",
    then: "Unexpected `then`.",
    else: "Unexpected `else`.",
    in: "Unexpected `in`."
  };

  function isKeyword(name) {
    return name === "if" || name === "then" || name === "else" || name === "let" || name === "in";
  }

  function isStopWord(name) {
    return name === "then" || name === "else" || name === "in";
  }

  function plain(message) {
    return new Error(message);
  }

  function makeLazy(compute, line) {
    var state = { done: false, running: false, value: null };
    return {
      tag: "lazy",
      line: line,
      force: function () {
        if (state.done) return state.value;
        if (state.running) {
          var loop = new Error("<<loop>>");
          loop.line = line;
          throw loop;
        }
        state.running = true;
        state.value = compute();
        state.done = true;
        state.running = false;
        return state.value;
      }
    };
  }

  function forceVal(v) {
    if (v && v.tag === "lazy") return v.force();
    return v;
  }

  function cell(getHead, getTail, line) {
    var hDone = false;
    var tDone = false;
    var h;
    var t;
    return {
      tag: "cell",
      line: line,
      head: function () {
        if (!hDone) {
          h = getHead();
          hDone = true;
        }
        return h;
      },
      tail: function () {
        if (!tDone) {
          t = getTail();
          tDone = true;
        }
        return t;
      }
    };
  }

  function delayList(build, line) {
    var box = makeLazy(build, line);
    box.tagList = true;
    return box;
  }

  function forceList(v) {
    var guard = 0;
    v = forceVal(v);
    while (v && v.tag === "lazy") {
      v = v.force();
      if (++guard > 1000) throw new Error("<<loop>>");
    }
    if (v == null || (v && v.tag === "cell")) {
      if (v && v.tag === "cell") {
        CTX.cells++;
        if (CTX.cells > MAX_CELLS) {
          throw new Error("Forced too many list cells. Take a shorter prefix.");
        }
      }
      return v;
    }
    throw new Error("Expected a list");
  }

  function evalExpr(ast, env) {
    CTX.steps++;
    if (CTX.steps > MAX_STEPS) {
      var err = new Error("Step limit reached. The expression may be infinite or too large for this sandbox.");
      err.line = ast && ast.line;
      throw err;
    }
    switch (ast.type) {
      case "number":
        return ast.value;
      case "string":
        return ast.value;
      case "char":
        return { tag: "char", value: ast.value };
      case "var":
        if (!Object.prototype.hasOwnProperty.call(env, ast.name) && !lookupHas(env, ast.name)) {
          var missing = new Error("Not in scope: `" + ast.name + "`");
          missing.line = ast.line;
          throw missing;
        }
        return forceVal(env[ast.name]);
      case "neg":
        return -expectInt(evalExpr(ast.expr, env), "negate", ast);
      case "list":
        return listFromItems(ast.items, env, ast.line);
      case "range": {
        var lo = expectInt(evalExpr(ast.from, env), "range", ast);
        var hi = expectInt(evalExpr(ast.to, env), "range", ast);
        return listRange(lo, hi, ast.line);
      }
      case "if": {
        var cond = expectBool(evalExpr(ast.cond, env), "if", ast);
        return evalExpr(cond ? ast.then : ast.else, env);
      }
      case "let": {
        var letEnv = Object.create(env);
        if (ast.params.length) {
          letEnv[ast.name] = { tag: "fn", name: ast.name, params: ast.params, body: ast.rhs, env: letEnv };
        } else {
          letEnv[ast.name] = makeLazy(function () { return evalExpr(ast.rhs, letEnv); }, ast.line);
        }
        return evalExpr(ast.body, letEnv);
      }
      case "lam":
        return { tag: "fn", name: "(\\" + ast.params.join(" ") + " -> ...)", params: ast.params.slice(), body: ast.body, env: env };
      case "app":
        return evalApp(ast, env);
      case "bin":
        return evalBin(ast, env);
      default:
        throw new Error("Unknown expression");
    }
  }

  function lookupHas(env, name) {
    var cursor = env;
    while (cursor) {
      if (Object.prototype.hasOwnProperty.call(cursor, name)) return true;
      cursor = Object.getPrototypeOf(cursor);
    }
    return false;
  }

  function evalApp(ast, env) {
    var fn = evalExpr(ast.fn, env);
    var arg = makeLazy(function () { return evalExpr(ast.arg, env); }, ast.arg.line);
    return apply(fn, arg, ast);
  }

  function apply(fn, argThunk, ast) {
    fn = forceVal(fn);
    if (fn && fn.tag === "fn" && fn.compose) return applyCompose(fn, argThunk, ast);
    if (fn && fn.tag === "fn") {
      var env = Object.create(fn.env);
      env[fn.params[0]] = argThunk;
      if (fn.params.length === 1) {
        CTX.log.push(fn.name);
        return evalExpr(fn.body, env);
      }
      return {
        tag: "fn",
        name: fn.name,
        params: fn.params.slice(1),
        body: fn.body,
        env: env
      };
    }
    if (fn && fn.tag === "builtin") {
      var got = fn.got.concat([argThunk]);
      if (got.length < fn.arity) {
        return { tag: "builtin", name: fn.name, arity: fn.arity, impl: fn.impl, got: got };
      }
      return fn.impl(got, ast);
    }
    var err = new Error("Tried to apply a value that is not a function");
    if (ast) err.line = ast.line;
    throw err;
  }

  function evalBin(ast, env) {
    var op = ast.op;
    if (op === "&&") {
      var leftAnd = expectBool(evalExpr(ast.left, env), "&&", ast);
      if (!leftAnd) return false;
      return expectBool(evalExpr(ast.right, env), "&&", ast);
    }
    if (op === "||") {
      var leftOr = expectBool(evalExpr(ast.left, env), "||", ast);
      if (leftOr) return true;
      return expectBool(evalExpr(ast.right, env), "||", ast);
    }
    if (op === ":") return evalCons(ast, env);
    if (op === ".") {
      var f = makeLazy(function () { return evalExpr(ast.left, env); }, ast.left.line);
      var g = makeLazy(function () { return evalExpr(ast.right, env); }, ast.right.line);
      return {
        tag: "fn",
        name: "(.)",
        params: ["x"],
        compose: true,
        f: f,
        g: g,
        env: null,
        body: null
      };
    }
    if (op === "++") return evalAppend(ast, env);
    var a = evalExpr(ast.left, env);
    var b = evalExpr(ast.right, env);
    if (op === "+") return expectInt(a, "+", ast) + expectInt(b, "+", ast);
    if (op === "-") return expectInt(a, "-", ast) - expectInt(b, "-", ast);
    if (op === "*") return expectInt(a, "*", ast) * expectInt(b, "*", ast);
    if (op === "/") {
      throw tagged("Use div for integer division. In Haskell, / is for fractional numbers.", ast);
    }
    if (op === "==") return compareEq(a, b, ast);
    if (op === "/=") return !compareEq(a, b, ast);
    if (op === "<" || op === ">" || op === "<=" || op === ">=") return compareOrd(op, a, b, ast);
    throw tagged("Unknown operator " + op, ast);
  }

  function evalCons(ast, env) {
    if (ast.right.type === "string") {
      var headChar = forceVal(evalExpr(ast.left, env));
      if (!headChar || headChar.tag !== "char") throw tagged("(:) needs a Char on the left of a String.", ast);
      return headChar.value + ast.right.value;
    }
    var leftAst = ast.left;
    var rightAst = ast.right;
    var leftEnv = env;
    return cell(
      function () { return forceVal(evalExpr(leftAst, leftEnv)); },
      function () {
        var right = forceVal(evalExpr(rightAst, leftEnv));
        var guard = 0;
        while (right && right.tag === "lazy") {
          right = right.force();
          if (++guard > 1000) throw new Error("<<loop>>");
        }
        if (typeof right === "string") {
          var ch = forceVal(evalExpr(leftAst, leftEnv));
          if (!ch || ch.tag !== "char") throw tagged("(:) needs a Char on the left of a String.", ast);
          throw tagged("Use ++ to build this String. (:) stays lazy for lists, and a lazy tail cannot turn the cons cell into a String after the fact. A string literal on the right is fine: 'a' : \"bc\".", ast);
        }
        if (right && right.tagList) return forceVal(right);
        if (right == null || (right && right.tag === "cell")) return right;
        throw tagged("(:) expected a list on the right", ast);
      },
      ast.line
    );
  }

  function evalAppend(ast, env) {
    var leftAst = ast.left;
    var rightAst = ast.right;
    var leftEnv = env;
    return delayList(function () {
      var left = forceVal(evalExpr(leftAst, leftEnv));
      if (typeof left === "string") {
        var right = forceVal(evalExpr(rightAst, leftEnv));
        if (typeof right !== "string") throw tagged("(++) can join two Strings or two lists.", ast);
        return left + right;
      }
      return appendLists(left, makeLazy(function () { return evalExpr(rightAst, leftEnv); }, ast.line), ast.line);
    }, ast.line);
  }

  function appendLists(left, rightThunk, line) {
    var ys = forceList(left);
    if (ys == null) return forceList(rightThunk);
    return cell(
      function () { return ys.head(); },
      function () { return appendLists(ys.tail(), rightThunk, line); },
      line
    );
  }

  function listFromItems(items, env, line) {
    function go(index) {
      if (index >= items.length) return null;
      var item = items[index];
      return cell(
        function () { return forceVal(evalExpr(item, env)); },
        function () { return go(index + 1); },
        line
      );
    }
    return go(0);
  }

  function listRange(lo, hi, line) {
    function go(n) {
      if (n > hi) return null;
      return cell(function () { return n; }, function () { return go(n + 1); }, line);
    }
    return delayList(function () { return go(lo); }, line);
  }

  function expectInt(v, what, ast) {
    v = forceVal(v);
    if (typeof v !== "number" || !isFinite(v) || Math.floor(v) !== v) {
      throw tagged(what + " expected an Integer", ast);
    }
    return v;
  }

  function expectBool(v, what, ast) {
    v = forceVal(v);
    if (typeof v !== "boolean") throw tagged(what + " expected a Bool", ast);
    return v;
  }

  function tagged(message, ast) {
    var err = new Error(message);
    if (ast && ast.line) err.line = ast.line;
    return err;
  }

  function compareEq(a, b, ast) {
    if (isFunction(forceVal(a)) || isFunction(forceVal(b))) {
      throw tagged("Eq is not defined for functions", ast);
    }
    return deepEqual(a, b);
  }

  function compareOrd(op, a, b, ast) {
    a = forceVal(a);
    b = forceVal(b);
    var ok = (typeof a === "number" && typeof b === "number") ||
      (typeof a === "string" && typeof b === "string") ||
      (a && b && a.tag === "char" && b.tag === "char");
    if (!ok) throw tagged(op + " expected two Integers, two Chars, or two Strings", ast);
    var x = a && a.tag === "char" ? a.value : a;
    var y = b && b.tag === "char" ? b.value : b;
    if (op === "<") return x < y;
    if (op === ">") return x > y;
    if (op === "<=") return x <= y;
    return x >= y;
  }

  function deepEqual(a, b) {
    a = forceVal(a);
    b = forceVal(b);
    if (typeof a === "number" || typeof a === "string" || typeof a === "boolean") return a === b;
    if (a && b && a.tag === "char" && b.tag === "char") return a.value === b.value;
    if (a && b && a.tag === "nothing" && b.tag === "nothing") return true;
    if (a && b && a.tag === "just" && b.tag === "just") return deepEqual(a.value, b.value);
    var aList = isListLike(a);
    var bList = isListLike(b);
    if (aList || bList) {
      if (!aList || !bList) return false;
      var as = forceList(a);
      var bs = forceList(b);
      if (as == null || bs == null) return as == null && bs == null;
      return deepEqual(as.head(), bs.head()) && deepEqual(as.tail(), bs.tail());
    }
    return false;
  }

  function isListLike(v) {
    return v == null || (v && (v.tag === "cell" || v.tagList));
  }

  function isFunction(v) {
    return v && (v.tag === "fn" || v.tag === "builtin");
  }

  function applyCompose(fn, argThunk, ast) {
    var g = forceVal(fn.g);
    var f = forceVal(fn.f);
    if (!isFunction(g) || !isFunction(f)) throw tagged("(.) expected two functions", ast);
    var mid = apply(g, argThunk, ast);
    return apply(f, makeLazy(function () { return mid; }), ast);
  }

  function builtin(name, arity, impl) {
    return { tag: "builtin", name: name, arity: arity, impl: impl, got: [] };
  }

  function walk(xsThunk, onCell) {
    var ys = forceList(xsThunk);
    var guard = 0;
    while (ys != null) {
      onCell(ys);
      ys = forceList(ys.tail());
      guard++;
      if (guard > MAX_CELLS) throw new Error("List is too long to walk in this sandbox.");
    }
  }

  var baseEnv = Object.create(null);

  function install(name, arity, impl) {
    baseEnv[name] = builtin(name, arity, impl);
  }

  install("map", 2, function (args) {
    var fnThunk = args[0];
    var xsThunk = args[1];
    function go(xs) {
      var ys = forceList(xs);
      if (ys == null) return null;
      return cell(
        function () { return apply(forceVal(fnThunk), makeLazy(function () { return ys.head(); })); },
        function () { return go(ys.tail()); }
      );
    }
    return delayList(function () { return go(xsThunk); });
  });

  install("filter", 2, function (args) {
    var pred = args[0];
    var xsThunk = args[1];
    function go(xs) {
      var ys = forceList(xs);
      if (ys == null) return null;
      var h = ys.head();
      var keep = expectBool(apply(forceVal(pred), makeLazy(function () { return h; })), "filter");
      if (keep) return cell(function () { return h; }, function () { return go(ys.tail()); });
      return go(ys.tail());
    }
    return delayList(function () { return go(xsThunk); });
  });

  install("take", 2, function (args, ast) {
    var n = expectInt(args[0], "take", ast);
    function go(k, xs) {
      if (k <= 0) return null;
      var ys = forceList(xs);
      if (ys == null) return null;
      return cell(
        function () { return ys.head(); },
        function () {
          if (k - 1 <= 0) return null;
          return go(k - 1, ys.tail());
        }
      );
    }
    return delayList(function () { return go(n, args[1]); });
  });

  install("drop", 2, function (args, ast) {
    var n = expectInt(args[0], "drop", ast);
    return delayList(function () {
      var ys = forceList(args[1]);
      var k = n < 0 ? 0 : n;
      while (k > 0 && ys != null) {
        ys = forceList(ys.tail());
        k--;
      }
      return ys;
    });
  });

  install("sum", 1, function (args, ast) {
    var total = 0;
    walk(args[0], function (ys) {
      total += expectInt(ys.head(), "sum", ast);
    });
    return total;
  });

  install("product", 1, function (args, ast) {
    var total = 1;
    walk(args[0], function (ys) {
      total *= expectInt(ys.head(), "product", ast);
    });
    return total;
  });

  install("length", 1, function (args) {
    var value = forceVal(args[0]);
    if (typeof value === "string") return value.length;
    var count = 0;
    walk(value, function () { count++; });
    return count;
  });

  install("reverse", 1, function (args) {
    var value = forceVal(args[0]);
    if (typeof value === "string") {
      return value.split("").reverse().join("");
    }
    var cells = [];
    walk(value, function (ys) { cells.push(ys); });
    function go(index) {
      if (index < 0) return null;
      return cell(function () { return cells[index].head(); }, function () { return go(index - 1); });
    }
    return go(cells.length - 1);
  });

  install("head", 1, function (args, ast) {
    var value = forceVal(args[0]);
    if (typeof value === "string") {
      if (!value.length) throw tagged("Prelude.head: empty list", ast);
      return { tag: "char", value: value.charAt(0) };
    }
    var ys = forceList(value);
    if (ys == null) throw tagged("Prelude.head: empty list", ast);
    return ys.head();
  });

  install("tail", 1, function (args, ast) {
    var value = forceVal(args[0]);
    if (typeof value === "string") {
      if (!value.length) throw tagged("Prelude.tail: empty list", ast);
      return value.slice(1);
    }
    var ys = forceList(value);
    if (ys == null) throw tagged("Prelude.tail: empty list", ast);
    return ys.tail();
  });

  install("null", 1, function (args, ast) {
    var ys = forceList(args[0]);
    if (ys == null) return true;
    if (ys.tag === "cell") return false;
    throw tagged("null expected a list", ast);
  });

  install("even", 1, function (args, ast) {
    return expectInt(args[0], "even", ast) % 2 === 0;
  });

  install("odd", 1, function (args, ast) {
    return expectInt(args[0], "odd", ast) % 2 !== 0;
  });

  install("abs", 1, function (args, ast) {
    var n = expectInt(args[0], "abs", ast);
    return n < 0 ? -n : n;
  });

  install("not", 1, function (args, ast) {
    return !expectBool(args[0], "not", ast);
  });

  install("show", 1, function (args) {
    return showRaw(forceVal(args[0]), 0);
  });

  install("words", 1, function (args, ast) {
    var text = forceVal(args[0]);
    if (typeof text !== "string") throw tagged("words expected a String", ast);
    var parts = text.trim() === "" ? [] : text.trim().split(/\s+/);
    return listFromValues(parts);
  });

  install("unwords", 1, function (args, ast) {
    var words = [];
    walk(args[0], function (ys) {
      var w = forceVal(ys.head());
      if (typeof w !== "string") throw tagged("unwords expected [String]", ast);
      words.push(w);
    });
    return words.join(" ");
  });

  install("maximum", 1, function (args, ast) {
    var best = null;
    walk(args[0], function (ys) {
      var n = expectInt(ys.head(), "maximum", ast);
      if (best === null || n > best) best = n;
    });
    if (best === null) throw tagged("Prelude.maximum: empty list", ast);
    return best;
  });

  install("minimum", 1, function (args, ast) {
    var best = null;
    walk(args[0], function (ys) {
      var n = expectInt(ys.head(), "minimum", ast);
      if (best === null || n < best) best = n;
    });
    if (best === null) throw tagged("Prelude.minimum: empty list", ast);
    return best;
  });

  install("replicate", 2, function (args, ast) {
    var n = expectInt(args[0], "replicate", ast);
    var count = n < 0 ? 0 : n;
    var shared = args[1];
    function go(index) {
      if (index >= count) return null;
      return cell(function () { return forceVal(shared); }, function () { return go(index + 1); });
    }
    return delayList(function () { return go(0); });
  });

  install("elem", 2, function (args) {
    var target = args[0];
    var found = false;
    walk(args[1], function (ys) {
      if (!found && deepEqual(target, ys.head())) found = true;
    });
    return found;
  });

  install("div", 2, function (args, ast) {
    var x = expectInt(args[0], "div", ast);
    var y = expectInt(args[1], "div", ast);
    if (y === 0) throw tagged("divide by zero", ast);
    return Math.floor(x / y);
  });

  install("mod", 2, function (args, ast) {
    var x = expectInt(args[0], "mod", ast);
    var y = expectInt(args[1], "mod", ast);
    if (y === 0) throw tagged("divide by zero", ast);
    return x - Math.floor(x / y) * y;
  });

  install("rem", 2, function (args, ast) {
    var x = expectInt(args[0], "rem", ast);
    var y = expectInt(args[1], "rem", ast);
    if (y === 0) throw tagged("divide by zero", ast);
    return x - Math.trunc(x / y) * y;
  });

  install("id", 1, function (args) { return forceVal(args[0]); });

  install("const", 2, function (args) { return forceVal(args[0]); });

  install("max", 2, function (args, ast) {
    var x = expectInt(args[0], "max", ast);
    var y = expectInt(args[1], "max", ast);
    return x > y ? x : y;
  });

  install("min", 2, function (args, ast) {
    var x = expectInt(args[0], "min", ast);
    var y = expectInt(args[1], "min", ast);
    return x < y ? x : y;
  });

  install("Just", 1, function (args) {
    return { tag: "just", value: args[0] };
  });

  install("maybe", 3, function (args) {
    var fallback = args[0];
    var fn = args[1];
    var m = forceVal(args[2]);
    if (m && m.tag === "nothing") return forceVal(fallback);
    if (m && m.tag === "just") return apply(forceVal(fn), m.value);
    throw new Error("maybe expected a Maybe");
  });

  install("fromMaybe", 2, function (args) {
    var fallback = args[0];
    var m = forceVal(args[1]);
    if (m && m.tag === "nothing") return forceVal(fallback);
    if (m && m.tag === "just") return forceVal(m.value);
    throw new Error("fromMaybe expected a Maybe");
  });

  install("isNothing", 1, function (args) {
    var m = forceVal(args[0]);
    if (m && m.tag === "nothing") return true;
    if (m && m.tag === "just") return false;
    throw new Error("isNothing expected a Maybe");
  });

  install("isJust", 1, function (args) {
    var m = forceVal(args[0]);
    if (m && m.tag === "just") return true;
    if (m && m.tag === "nothing") return false;
    throw new Error("isJust expected a Maybe");
  });

  install("foldr", 3, function (args) {
    var fThunk = args[0];
    var zThunk = args[1];
    function go(xs) {
      return makeLazy(function () {
        var ys = forceList(xs);
        if (ys == null) return forceVal(zThunk);
        var rest = go(ys.tail());
        return apply(apply(forceVal(fThunk), makeLazy(function () { return ys.head(); })), rest);
      });
    }
    return go(args[2]);
  });

  install("foldl", 3, function (args) {
    return foldLeft(false, args);
  });

  install("foldl'", 3, function (args) {
    return foldLeft(true, args);
  });

  function foldStep(fThunk, cellRef, accRef) {
    return makeLazy(function () {
      return apply(apply(forceVal(fThunk), accRef), makeLazy(function () { return cellRef.head(); }));
    });
  }

  function foldLeft(strict, args) {
    var fThunk = args[0];
    var acc = args[1];
    var ys = forceList(args[2]);
    while (ys != null) {
      var next = foldStep(fThunk, ys, acc);
      var tail = ys.tail();
      if (strict) {
        acc = (function (forced) {
          return makeLazy(function () { return forced; });
        })(forceVal(next));
      } else {
        CTX.foldlThunks++;
        acc = next;
      }
      ys = forceList(tail);
    }
    return acc;
  }

  function listFromValues(values) {
    function go(index) {
      if (index >= values.length) return null;
      return cell(function () { return values[index]; }, function () { return go(index + 1); });
    }
    return go(0);
  }

  baseEnv.True = true;
  baseEnv.False = false;
  baseEnv.Nothing = { tag: "nothing" };
  baseEnv.otherwise = true;

  function showValue(v, depth) {
    return showRaw(forceVal(v), depth);
  }

  function showRaw(v, depth) {
    if (depth > 40) return "...";
    var guard = 0;
    v = forceVal(v);
    while (v && v.tag === "lazy") {
      v = v.force();
      if (++guard > 1000) return "...";
    }
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "True" : "False";
    if (typeof v === "string") return '"' + escapeString(v) + '"';
    if (v && v.tag === "char") return "'" + escapeChar(v.value) + "'";
    if (v && v.tag === "nothing") return "Nothing";
    if (v && v.tag === "just") {
      var inner = showRaw(v.value, depth + 1);
      var wrap = needsParen(forceVal(v.value));
      return "Just " + (wrap ? "(" + inner + ")" : inner);
    }
    if (isFunction(v)) return "<function>";
    if (v == null || (v && (v.tag === "cell" || v.tagList))) return showList(v);
    return "<value>";
  }

  function needsParen(v) {
    v = forceVal(v);
    return v && (v.tag === "just" || v.tag === "fn" || v.tag === "builtin");
  }

  function showList(xs) {
    var items = [];
    var ys = forceList(xs);
    while (ys != null && items.length < 80) {
      items.push(showRaw(ys.head(), 0));
      ys = forceList(ys.tail());
    }
    return "[" + items.join(",") + (ys != null ? ",...]" : "]");
  }

  function escapeString(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }

  function escapeChar(s) {
    if (s === "'") return "\\'";
    if (s === "\\") return "\\\\";
    if (s === "\n") return "\\n";
    return s;
  }

  function typeName(v) {
    return typeOf(forceVal(v), 0);
  }

  function typeOf(v, depth) {
    if (depth > 8) return "a";
    v = forceVal(v);
    if (typeof v === "number") return "Integer";
    if (typeof v === "boolean") return "Bool";
    if (typeof v === "string") return "String";
    if (v && v.tag === "char") return "Char";
    if (v && v.tag === "nothing") return "Maybe a";
    if (v && v.tag === "just") return "Maybe " + typeOf(v.value, depth + 1);
    if (isFunction(v)) return "a -> b";
    if (v == null) return "[a]";
    if (v && (v.tag === "cell" || v.tagList)) {
      var ys = forceList(v);
      if (ys == null) return "[a]";
      var headType = typeOf(ys.head(), depth + 1);
      return "[" + headType + "]";
    }
    return "a";
  }

  root.HaskellSandbox = { run: run };
})(typeof window !== "undefined" ? window : globalThis);
