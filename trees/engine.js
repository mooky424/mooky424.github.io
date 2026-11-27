/* Classical B-tree (minimum degree t = 2).
   Keys live in every node. A full node has 2t − 1 keys.
   The median moves up on a split. Delete repairs a minimum
   child before descending, which is the one-pass CLRS walk. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StorageLab = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const T = 2;
  const MIN_KEYS = T - 1;
  const MAX_KEYS = 2 * T - 1;

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isLeaf(node) {
    return !node.children.length;
  }

  function deg(state) {
    const t = state && state.t;
    return t >= 2 ? t : T;
  }

  function minKeys(state) {
    return deg(state) - 1;
  }

  function maxKeys(state) {
    return 2 * deg(state) - 1;
  }

  function createTree(order) {
    let t = T;
    if (order != null && order !== "") {
      let m = Math.round(Number(order));
      if (m % 2) m += 1;
      if (m < 4) m = 4;
      if (m > 16) m = 16;
      t = m / 2;
    }
    return {
      t: t,
      nextId: 2,
      rootId: 1,
      nodes: { 1: { id: 1, keys: [], children: [] } }
    };
  }

  function buildTree(spec) {
    const state = { t: T, nextId: 1, rootId: null, nodes: {} };
    function add(node) {
      const id = state.nextId++;
      const children = (node.children || []).map(add);
      state.nodes[id] = { id: id, keys: node.keys.slice(), children: children };
      return id;
    }
    state.rootId = add(spec);
    return state;
  }

  function snap(frames, state, message, rule, highlight) {
    frames.push({
      nodes: clone(state.nodes),
      rootId: state.rootId,
      t: state.t,
      message: message,
      rule: rule,
      highlight: highlight || { ids: [], cells: [], via: null, kind: "path" }
    });
  }

  function inorder(state, id, out) {
    const node = state.nodes[id];
    if (!node) return;
    if (isLeaf(node)) {
      node.keys.forEach(function (key) { out.push(key); });
      return;
    }
    node.keys.forEach(function (key, index) {
      inorder(state, node.children[index], out);
      out.push(key);
    });
    inorder(state, node.children[node.keys.length], out);
  }

  function describe(state) {
    const keys = [];
    inorder(state, state.rootId, keys);
    let height = 0;
    let id = state.rootId;
    while (state.nodes[id] && !isLeaf(state.nodes[id])) {
      height += 1;
      id = state.nodes[id].children[0];
    }
    return { keys: keys, height: height };
  }

  function audit(state) {
    const seen = new Set();
    const leafDepths = [];
    const least = minKeys(state);
    const most = maxKeys(state);
    function walk(id, depth, lo, hi, isRoot) {
      const node = state.nodes[id];
      if (!node) return "Missing node " + id;
      if (seen.has(id)) return "Node " + id + " is reachable twice";
      seen.add(id);
      const n = node.keys.length;
      if (n > most) return "Node " + id + " has " + n + " keys";
      if (!isRoot && n < least) return "Node " + id + " has " + n + " keys, under the minimum";
      for (let i = 0; i < n; i += 1) {
        if (!(node.keys[i] > lo && node.keys[i] < hi)) {
          return "Key " + node.keys[i] + " is outside (" + lo + ", " + hi + ")";
        }
        if (i && node.keys[i] <= node.keys[i - 1]) return "Keys out of order in node " + id;
      }
      if (isLeaf(node)) {
        if (node.children.length) return "Leaf " + id + " has children";
        leafDepths.push(depth);
        return null;
      }
      if (node.children.length !== n + 1) {
        return "Node " + id + " has " + n + " keys and " + node.children.length + " children";
      }
      for (let i = 0; i <= n; i += 1) {
        const childLo = i === 0 ? lo : node.keys[i - 1];
        const childHi = i === n ? hi : node.keys[i];
        const problem = walk(node.children[i], depth + 1, childLo, childHi, false);
        if (problem) return problem;
      }
      return null;
    }
    const problem = walk(state.rootId, 0, -Infinity, Infinity, true);
    if (problem) return { ok: false, reason: problem };
    if (new Set(leafDepths).size > 1) return { ok: false, reason: "Leaves sit at different depths" };
    const reachable = seen.size;
    const stored = Object.keys(state.nodes).length;
    if (reachable !== stored) return { ok: false, reason: "Orphan nodes left after a merge" };
    return { ok: true, reason: "" };
  }

  function contains(state, key) {
    let id = state.rootId;
    while (id != null) {
      const node = state.nodes[id];
      let i = 0;
      while (i < node.keys.length && key > node.keys[i]) i += 1;
      if (i < node.keys.length && key === node.keys[i]) return true;
      if (isLeaf(node)) return false;
      id = node.children[i];
    }
    return false;
  }

  function searchKey(state, key) {
    const frames = [];
    let id = state.rootId;
    while (true) {
      const node = state.nodes[id];
      let i = 0;
      const notes = [];
      while (i < node.keys.length && key > node.keys[i]) {
        notes.push(key + " > " + node.keys[i]);
        i += 1;
      }
      if (i < node.keys.length && node.keys[i] === key) {
        snap(frames, state,
          "Found " + key + ".",
          "Search · found",
          { ids: [id], cells: [{ id: id, index: i }], via: null, kind: "found" });
        return { found: true, frames: frames };
      }
      if (i < node.keys.length) notes.push(key + " < " + node.keys[i]);
      if (isLeaf(node)) {
        const shown = node.keys.length ? node.keys.join(", ") : "empty";
        snap(frames, state,
          key + " is not in [" + shown + "].",
          "Search · missing",
          { ids: [id], cells: [], via: null, kind: "miss" });
        return { found: false, frames: frames };
      }
      const place = i === 0 ? "the leftmost child" : i === node.keys.length ? "the rightmost child" : "the child between " + node.keys[i - 1] + " and " + node.keys[i];
      snap(frames, state,
        notes.join(". ") + ". Take " + place + ".",
        "Search",
        { ids: [id], cells: [], via: node.children[i], kind: "path" });
      id = node.children[i];
    }
  }

  function splitChild(state, parentId, index) {
    const t = deg(state);
    const parent = state.nodes[parentId];
    const left = state.nodes[parent.children[index]];
    const median = left.keys[t - 1];
    const rightId = state.nextId++;
    state.nodes[rightId] = {
      id: rightId,
      keys: left.keys.slice(t),
      children: left.children.slice(t)
    };
    left.keys = left.keys.slice(0, t - 1);
    left.children = left.children.slice(0, t);
    parent.keys.splice(index, 0, median);
    parent.children.splice(index + 1, 0, rightId);
    return { median: median, leftId: left.id, rightId: rightId };
  }

  function insertNonFull(state, id, key, frames) {
    const node = state.nodes[id];
    if (isLeaf(node)) {
      let at = 0;
      while (at < node.keys.length && key > node.keys[at]) at += 1;
      node.keys.splice(at, 0, key);
      snap(frames, state,
        key + " fits in the node.",
        "Insert · room",
        { ids: [id], cells: [{ id: id, index: at }], via: null, kind: "place" });
      return;
    }
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i += 1;
    const childId = node.children[i];
    if (state.nodes[childId].keys.length === maxKeys(state)) {
      snap(frames, state,
        "The next node is full. Split it. The middle key moves up.",
        "Insert · split",
        { ids: [childId], cells: [{ id: childId, index: deg(state) - 1 }], via: null, kind: "full" });
      const split = splitChild(state, id, i);
      snap(frames, state,
        split.median + " moved up. Smaller keys stayed left. Larger keys went right.",
        "Insert · split",
        { ids: [id, split.leftId, split.rightId], cells: [{ id: id, index: i }], via: null, kind: "split" });
      if (key > state.nodes[id].keys[i]) i += 1;
    }
    insertNonFull(state, state.nodes[id].children[i], key, frames);
  }

  function insertKey(state, key) {
    const frames = [];
    if (contains(state, key)) {
      const found = searchKey(state, key);
      found.frames[found.frames.length - 1].message = key + " is already in the tree.";
      found.frames[found.frames.length - 1].rule = "Insert · duplicate";
      return { error: "duplicate", frames: found.frames };
    }
    const root = state.nodes[state.rootId];
    if (root.keys.length === maxKeys(state)) {
      snap(frames, state,
        "The top node is full. Split it first. The tree grows upward.",
        "Insert · root split",
        { ids: [state.rootId], cells: [{ id: state.rootId, index: deg(state) - 1 }], via: null, kind: "full" });
      const oldRoot = state.rootId;
      const newRoot = state.nextId++;
      state.nodes[newRoot] = { id: newRoot, keys: [], children: [oldRoot] };
      state.rootId = newRoot;
      const split = splitChild(state, newRoot, 0);
      snap(frames, state,
        "New top node: " + split.median + ".",
        "Insert · root split",
        { ids: [newRoot, split.leftId, split.rightId], cells: [{ id: newRoot, index: 0 }], via: null, kind: "split" });
    }
    insertNonFull(state, state.rootId, key, frames);
    return { frames: frames };
  }

  function minKey(state, id) {
    let node = state.nodes[id];
    while (!isLeaf(node)) node = state.nodes[node.children[0]];
    return node.keys[0];
  }

  function maxKey(state, id) {
    let node = state.nodes[id];
    while (!isLeaf(node)) node = state.nodes[node.children[node.children.length - 1]];
    return node.keys[node.keys.length - 1];
  }

  function borrowFromLeft(state, parentId, index) {
    const parent = state.nodes[parentId];
    const child = state.nodes[parent.children[index]];
    const left = state.nodes[parent.children[index - 1]];
    child.keys.unshift(parent.keys[index - 1]);
    parent.keys[index - 1] = left.keys.pop();
    if (!isLeaf(left)) child.children.unshift(left.children.pop());
  }

  function borrowFromRight(state, parentId, index) {
    const parent = state.nodes[parentId];
    const child = state.nodes[parent.children[index]];
    const right = state.nodes[parent.children[index + 1]];
    child.keys.push(parent.keys[index]);
    parent.keys[index] = right.keys.shift();
    if (!isLeaf(right)) child.children.push(right.children.shift());
  }

  function mergeChildren(state, parentId, index) {
    const parent = state.nodes[parentId];
    const left = state.nodes[parent.children[index]];
    const right = state.nodes[parent.children[index + 1]];
    left.keys = left.keys.concat([parent.keys[index]], right.keys);
    left.children = left.children.concat(right.children);
    parent.keys.splice(index, 1);
    parent.children.splice(index + 1, 1);
    delete state.nodes[right.id];
    return left.id;
  }

  function ensureChild(state, parentId, index, frames) {
    const parent = state.nodes[parentId];
    const child = state.nodes[parent.children[index]];
    if (child.keys.length >= deg(state)) {
      snap(frames, state,
        "This node can spare a key. Go in.",
        "Delete",
        { ids: [parent.id], cells: [], via: child.id, kind: "path" });
      return index;
    }
    const left = index > 0 ? state.nodes[parent.children[index - 1]] : null;
    const right = index < parent.keys.length ? state.nodes[parent.children[index + 1]] : null;
    snap(frames, state,
      "This node has only one key. Fix that before going in.",
      "Delete · minimum child",
      { ids: [child.id], cells: [], via: child.id, kind: "under" });
    if (left && left.keys.length >= deg(state)) {
      const down = parent.keys[index - 1];
      const up = left.keys[left.keys.length - 1];
      borrowFromLeft(state, parentId, index);
      const fresh = state.nodes[parentId];
      snap(frames, state,
        up + " moved up. " + down + " moved down.",
        "Delete · borrow left",
        { ids: [parentId, fresh.children[index - 1], fresh.children[index]], cells: [{ id: parentId, index: index - 1 }, { id: fresh.children[index], index: 0 }], via: null, kind: "borrow" });
      return index;
    }
    if (right && right.keys.length >= deg(state)) {
      const down = parent.keys[index];
      const up = right.keys[0];
      borrowFromRight(state, parentId, index);
      const fresh = state.nodes[parentId];
      const childNow = state.nodes[fresh.children[index]];
      snap(frames, state,
        up + " moved up. " + down + " moved down.",
        "Delete · borrow right",
        { ids: [parentId, fresh.children[index], fresh.children[index + 1]], cells: [{ id: parentId, index: index }, { id: fresh.children[index], index: childNow.keys.length - 1 }], via: null, kind: "borrow" });
      return index;
    }
    if (left) {
      const merged = mergeChildren(state, parentId, index - 1);
      snap(frames, state,
        "Merged with the left node. The key between them came down.",
        "Delete · merge",
        { ids: [parentId, merged], cells: [], via: null, kind: "merge" });
      return index - 1;
    }
    const merged = mergeChildren(state, parentId, index);
    snap(frames, state,
      "Merged with the right node. The key between them came down.",
      "Delete · merge",
      { ids: [parentId, merged], cells: [], via: null, kind: "merge" });
    return index;
  }

  function deleteFrom(state, id, key, frames) {
    const node = state.nodes[id];
    let index = 0;
    while (index < node.keys.length && key > node.keys[index]) index += 1;
    const foundHere = index < node.keys.length && node.keys[index] === key;

    if (foundHere && isLeaf(node)) {
      const spare = node.keys.length > minKeys(state) || id === state.rootId;
      snap(frames, state,
        spare
          ? key + " can go. The node still has a key left."
          : "Remove " + key + ".",
        "Delete · leaf",
        { ids: [id], cells: [{ id: id, index: index }], via: null, kind: "path" });
      node.keys.splice(index, 1);
      snap(frames, state,
        key + " is gone.",
        "Delete · leaf",
        { ids: [id], cells: [], via: null, kind: "place" });
      return;
    }

    if (foundHere) {
      const leftId = node.children[index];
      const rightId = node.children[index + 1];
      const left = state.nodes[leftId];
      const right = state.nodes[rightId];
      if (left.keys.length >= deg(state)) {
        const predecessor = maxKey(state, leftId);
        snap(frames, state,
          "Swap " + key + " with " + predecessor + ", the greatest key to its left.",
          "Delete · predecessor",
          { ids: [id, leftId], cells: [{ id: id, index: index }], via: leftId, kind: "path" });
        node.keys[index] = predecessor;
        snap(frames, state,
          predecessor + " is in place. Remove the old copy below.",
          "Delete · predecessor",
          { ids: [id], cells: [{ id: id, index: index }], via: null, kind: "borrow" });
        deleteFrom(state, leftId, predecessor, frames);
        return;
      }
      if (right.keys.length >= deg(state)) {
        const successor = minKey(state, rightId);
        snap(frames, state,
          "The left side can't spare a key. Swap " + key + " with " + successor + ", the smallest key to its right.",
          "Delete · successor",
          { ids: [id, rightId], cells: [{ id: id, index: index }], via: rightId, kind: "path" });
        node.keys[index] = successor;
        snap(frames, state,
          successor + " is in place. Remove the old copy below.",
          "Delete · successor",
          { ids: [id], cells: [{ id: id, index: index }], via: null, kind: "borrow" });
        deleteFrom(state, rightId, successor, frames);
        return;
      }
      snap(frames, state,
        "Join the two nodes around " + key + ", then delete it from the joined node.",
        "Delete · merge",
        { ids: [id, leftId, rightId], cells: [{ id: id, index: index }], via: null, kind: "under" });
      const merged = mergeChildren(state, id, index);
      snap(frames, state,
        "One node now. " + key + " is still in it.",
        "Delete · merge",
        { ids: [id, merged], cells: [], via: null, kind: "merge" });
      deleteFrom(state, merged, key, frames);
      return;
    }

    if (isLeaf(node)) {
      snap(frames, state, key + " is not in the tree.", "Delete · missing", { ids: [id], cells: [], via: null, kind: "miss" });
      return;
    }
    const next = ensureChild(state, id, index, frames);
    deleteFrom(state, state.nodes[id].children[next], key, frames);
  }

  function deleteKey(state, key) {
    const frames = [];
    if (!contains(state, key)) {
      const found = searchKey(state, key);
      found.frames[found.frames.length - 1].rule = "Delete · missing";
      found.frames[found.frames.length - 1].message = key + " is not in the tree.";
      return { error: "missing", frames: found.frames };
    }
    deleteFrom(state, state.rootId, key, frames);
    const root = state.nodes[state.rootId];
    if (!isLeaf(root) && root.keys.length === 0) {
      const only = root.children[0];
      delete state.nodes[state.rootId];
      state.rootId = only;
      snap(frames, state,
        "The top node is empty. Drop it.",
        "Delete · shorter tree",
        { ids: [only], cells: [], via: null, kind: "split" });
    }
    return { frames: frames };
  }

  function heightBound(n, t) {
    const count = Math.max(0, Number(n) || 0);
    const degree = Math.max(2, Math.floor(Number(t) || 2));
    if (count === 0) return { maxHeight: 0, minKeysAtHeight: 1, degree: degree, count: 0 };
    const maxHeight = Math.floor(Math.log((count + 1) / 2) / Math.log(degree));
    const minKeys = 2 * Math.pow(degree, maxHeight) - 1;
    return { maxHeight: maxHeight, minKeysAtHeight: minKeys, degree: degree, count: count };
  }

  const MEM_CAP = 4;
  const L0_CAP = 2;

  function asEntry(value) {
    if (typeof value === "number") return { key: value, tomb: false };
    return { key: value.key, tomb: !!value.tomb };
  }

  function asRun(list) {
    const sorted = (list || []).map(asEntry).sort(function (a, b) { return a.key - b.key; });
    const out = [];
    sorted.forEach(function (entry) {
      if (out.length && out[out.length - 1].key === entry.key) out[out.length - 1] = entry;
      else out.push(entry);
    });
    return out;
  }

  function clampInt(value, fallback, min, max) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function lsmCreate(options) {
    const opts = options || {};
    const ratio = opts.ratio != null
      ? clampInt(opts.ratio, L0_CAP, 2, 4)
      : clampInt(opts.l0Cap, L0_CAP, 2, 4);
    return {
      memCap: clampInt(opts.memCap, MEM_CAP, 2, 8),
      ratio: ratio,
      l0Cap: ratio,
      mem: [],
      l0: [],
      l1: [],
      below: []
    };
  }

  function lsmBuild(spec) {
    const state = lsmCreate();
    state.mem = asRun(spec.mem);
    state.l0 = (spec.l0 || []).map(asRun);
    state.l1 = asRun(spec.l1);
    state.below = (spec.below || []).map(asRun);
    return state;
  }

  function findEntry(entries, key) {
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].key === key) return i;
    }
    return -1;
  }

  function lsmSnap(frames, state, message, rule, highlight) {
    frames.push({
      mem: clone(state.mem),
      l0: clone(state.l0),
      l1: clone(state.l1),
      below: clone(state.below || []),
      memCap: state.memCap,
      ratio: state.ratio,
      message: message,
      rule: rule,
      highlight: highlight || { band: "mem", run: -1, index: -1, kind: "path" }
    });
  }

  function runLabel(entries) {
    if (!entries.length) return "empty";
    return entries.map(function (entry) { return (entry.tomb ? "×" : "") + entry.key; }).join(", ");
  }

  function residesBelow(state, key) {
    for (let i = 0; i < state.l0.length; i += 1) {
      if (findEntry(state.l0[i], key) >= 0) return true;
    }
    if (findEntry(state.l1, key) >= 0) return true;
    const below = state.below || [];
    for (let i = 0; i < below.length; i += 1) {
      if (findEntry(below[i], key) >= 0) return true;
    }
    return false;
  }

  function levelCap(state, level) {
    return state.memCap * Math.pow(state.ratio, level);
  }

  function countRuns(runs) {
    let count = 0;
    runs.forEach(function (run) { count += run.length; });
    return count;
  }

  function mergeEntries(groups, dropTombs) {
    const winner = new Map();
    groups.forEach(function (entries) {
      (entries || []).forEach(function (entry) {
        if (!winner.has(entry.key)) winner.set(entry.key, { key: entry.key, tomb: !!entry.tomb });
      });
    });
    const merged = [];
    winner.forEach(function (entry) {
      if (dropTombs && entry.tomb) return;
      merged.push({ key: entry.key, tomb: !!entry.tomb });
    });
    merged.sort(function (a, b) { return a.key - b.key; });
    return merged;
  }

  function levelRun(state, level) {
    if (level === 2) return state.l1;
    return (state.below && state.below[level - 3]) || [];
  }

  function setLevel(state, level, run) {
    if (level === 2) {
      state.l1 = run;
      return;
    }
    const index = level - 3;
    if (!state.below) state.below = [];
    while (state.below.length <= index) state.below.push([]);
    state.below[index] = run;
    while (state.below.length && !state.below[state.below.length - 1].length) state.below.pop();
  }

  function olderThan(state, level) {
    if (level < 2 && state.l1.length) return true;
    const below = state.below || [];
    for (let i = Math.max(0, level - 2); i < below.length; i += 1) {
      if (below[i].length) return true;
    }
    return false;
  }

  function spill(state, frames, level) {
    while (level < 8) {
      const run = levelRun(state, level);
      const cap = levelCap(state, level);
      if (run.length <= cap) return;
      const held = run.length;
      const dest = level + 1;
      const merged = mergeEntries([run, levelRun(state, dest)], !olderThan(state, dest));
      setLevel(state, dest, merged);
      setLevel(state, level, []);
      const band = dest === 2 ? "l1" : "below";
      lsmSnap(frames, state,
        "C" + level + " holds " + held + " keys. Its capacity is " + cap + ", so it merges into C" + dest + ".",
        "Compaction",
        { band: band, run: dest === 2 ? -1 : dest - 3, index: -1, kind: "compact" });
      level = dest;
    }
  }

  function lsmCompact(state, frames) {
    const cap = levelCap(state, 1);
    const dropTombs = !olderThan(state, 2);
    state.l1 = mergeEntries(state.l0.concat([state.l1]), dropTombs);
    state.l0 = [];
    lsmSnap(frames, state,
      "C1 is past its capacity of " + cap + ". It merges into C2. The newest copy of each key wins, and deletes are dropped.",
      "Compaction",
      { band: "l1", run: -1, index: -1, kind: "compact" });
    spill(state, frames, 2);
  }

  function c1Over(state) {
    return state.l0.length > state.ratio || countRuns(state.l0) > levelCap(state, 1);
  }

  function lsmFlush(state, frames) {
    if (!state.mem.length) return;
    const flushed = runLabel(state.mem);
    state.l0.unshift(state.mem.map(function (entry) { return { key: entry.key, tomb: entry.tomb }; }));
    state.mem = [];
    lsmSnap(frames, state,
      "Flushed [" + flushed + "] to disk as an SSTable. Memory is clear.",
      "Flush",
      { band: "l0", run: 0, index: -1, kind: "flush" });
    if (c1Over(state)) lsmCompact(state, frames);
  }

  function lsmWrite(state, key, tomb) {
    const frames = [];
    const at = findEntry(state.mem, key);
    if (at >= 0) {
      const wasTomb = state.mem[at].tomb;
      const below = residesBelow(state, key);
      state.mem[at] = { key: key, tomb: tomb };
      let message;
      let rule;
      if (!tomb) {
        message = key + " is already in memory. Replace it.";
        rule = "Write · overwrite";
      } else if (wasTomb) {
        message = key + " is already marked deleted.";
        rule = "Write · tombstone";
      } else if (below) {
        message = "Mark " + key + " deleted. The older copy stays until a merge.";
        rule = "Write · tombstone";
      } else {
        message = key + " was only in memory. Mark it deleted.";
        rule = "Write · tombstone";
      }
      lsmSnap(frames, state, message, rule, { band: "mem", run: -1, index: at, kind: tomb ? "tomb" : "place" });
      return { frames: frames };
    }

    if (state.mem.length >= state.memCap) {
      lsmSnap(frames, state,
        "Memory is full. Save it before adding another key.",
        "Write · memtable full",
        { band: "mem", run: -1, index: -1, kind: "full" });
      lsmFlush(state, frames);
    }

    const below = residesBelow(state, key);
    state.mem.push({ key: key, tomb: tomb });
    state.mem = asRun(state.mem);
    const index = findEntry(state.mem, key);
    const filled = state.mem.length >= state.memCap;
    let message;
    let rule;
    if (tomb && below) {
      message = "×" + key + ". The old copy stays until a merge.";
      rule = "Write · tombstone";
    } else if (tomb) {
      message = key + " was never stored. Write ×" + key + " anyway.";
      rule = "Write · absent key";
    } else if (below) {
      message = "A newer " + key + " goes in memory. The old one stays until a merge.";
      rule = "Write · newer copy";
    } else {
      message = key + " goes in memory.";
      rule = "Write · memtable";
    }
    if (filled) message += " Memory is full, so it gets saved next.";
    lsmSnap(frames, state, message, rule, { band: "mem", run: -1, index: index, kind: tomb ? "tomb" : "place" });
    if (filled) lsmFlush(state, frames);
    return { frames: frames };
  }

  function lsmInsert(state, key) {
    return lsmWrite(state, key, false);
  }

  function lsmDelete(state, key) {
    return lsmWrite(state, key, true);
  }

  function lsmSearch(state, key) {
    const frames = [];
    const memAt = findEntry(state.mem, key);
    if (memAt >= 0) {
      const tomb = state.mem[memAt].tomb;
      lsmSnap(frames, state,
        tomb
          ? "×" + key + " is in memory. The key is gone."
          : key + " is in memory. Stop.",
        tomb ? "Search · tombstone" : "Search · memtable",
        { band: "mem", run: -1, index: memAt, kind: tomb ? "tomb" : "found" });
      return { found: !tomb, frames: frames };
    }

    const below = state.below || [];
    const hasRuns = state.l0.length > 0 || state.l1.length > 0 || below.some(function (run) { return run.length > 0; });
    if (!hasRuns) {
      lsmSnap(frames, state,
        key + " is not in memory.",
        "Search · missing",
        { band: "mem", run: -1, index: -1, kind: "miss" });
      return { found: false, frames: frames };
    }

    lsmSnap(frames, state,
      key + " is not in memory. Look at the SSTables.",
      "Search · miss",
      { band: "mem", run: -1, index: -1, kind: "miss" });

    for (let r = 0; r < state.l0.length; r += 1) {
      const at = findEntry(state.l0[r], key);
      const which = state.l0.length === 1 ? "this SSTable" : (r === 0 ? "the newest SSTable" : "an older SSTable");
      if (at >= 0) {
        const tomb = state.l0[r][at].tomb;
        lsmSnap(frames, state,
          tomb
            ? "×" + key + " is in " + which + ". The key is gone."
            : key + " is in " + which + ". Stop.",
          tomb ? "Search · tombstone" : "Search · run",
          { band: "l0", run: r, index: at, kind: tomb ? "tomb" : "found" });
        return { found: !tomb, frames: frames };
      }
      lsmSnap(frames, state,
        key + " is not in " + which + ".",
        "Search · miss",
        { band: "l0", run: r, index: -1, kind: "miss" });
    }

    const disk = [{ entries: state.l1, band: "l1", run: -1, name: "C2" }];
    below.forEach(function (entries, index) {
      disk.push({ entries: entries, band: "below", run: index, name: "C" + (index + 3) });
    });
    let looked = false;
    for (let i = 0; i < disk.length; i += 1) {
      const level = disk[i];
      if (!level.entries.length) continue;
      looked = true;
      const at = findEntry(level.entries, key);
      if (at >= 0) {
        const tomb = level.entries[at].tomb;
        lsmSnap(frames, state,
          tomb
            ? "×" + key + " is in " + level.name + ". The key is gone."
            : key + " is in " + level.name + ".",
          tomb ? "Search · tombstone" : "Search · found",
          { band: level.band, run: level.run, index: at, kind: tomb ? "tomb" : "found" });
        return { found: !tomb, frames: frames };
      }
      lsmSnap(frames, state,
        key + " is not in " + level.name + ".",
        "Search · miss",
        { band: level.band, run: level.run, index: -1, kind: "miss" });
    }
    if (!looked) {
      lsmSnap(frames, state,
        key + " is not here.",
        "Search · missing",
        { band: "l1", run: -1, index: -1, kind: "miss" });
    }
    return { found: false, frames: frames };
  }

  function lsmLiveKeys(state) {
    const keys = {};
    function mark(entries) {
      entries.forEach(function (entry) {
        if (!Object.prototype.hasOwnProperty.call(keys, entry.key)) keys[entry.key] = !entry.tomb;
      });
    }
    mark(state.mem);
    state.l0.forEach(mark);
    mark(state.l1);
    (state.below || []).forEach(mark);
    return Object.keys(keys).map(Number).filter(function (key) { return keys[key]; }).sort(function (a, b) { return a - b; });
  }

  function lsmDescribe(state) {
    return {
      keys: lsmLiveKeys(state),
      mem: state.mem.length,
      runs: state.l0.length,
      l1: state.l1.length
    };
  }

  function checkRun(entries, name) {
    for (let i = 0; i < entries.length; i += 1) {
      if (!entries[i] || typeof entries[i].key !== "number") return name + " has a bad record";
      if (i && entries[i].key <= entries[i - 1].key) return name + " is not strictly sorted";
    }
    return "";
  }

  function lsmAudit(state) {
    const memErr = checkRun(state.mem, "memtable");
    if (memErr) return { ok: false, reason: memErr };
    if (state.mem.length > state.memCap) return { ok: false, reason: "memtable holds more than " + state.memCap };
    for (let i = 0; i < state.l0.length; i += 1) {
      const err = checkRun(state.l0[i], "L0 run " + i);
      if (err) return { ok: false, reason: err };
    }
    const l1Err = checkRun(state.l1, "L1");
    if (l1Err) return { ok: false, reason: l1Err };
    const below = state.below || [];
    for (let i = 0; i < below.length; i += 1) {
      const err = checkRun(below[i], "C" + (i + 3));
      if (err) return { ok: false, reason: err };
    }
    return { ok: true, reason: "" };
  }

  function lsmSize(state) {
    let count = state.mem.length + state.l1.length;
    state.l0.forEach(function (run) { count += run.length; });
    (state.below || []).forEach(function (run) { count += run.length; });
    return count;
  }

  return {
    T: T,
    MIN_KEYS: MIN_KEYS,
    MAX_KEYS: MAX_KEYS,
    MEM_CAP: MEM_CAP,
    L0_CAP: L0_CAP,
    createTree: createTree,
    buildTree: buildTree,
    insertKey: insertKey,
    deleteKey: deleteKey,
    searchKey: searchKey,
    describe: describe,
    audit: audit,
    heightBound: heightBound,
    clone: clone,
    lsmCreate: lsmCreate,
    lsmBuild: lsmBuild,
    lsmInsert: lsmInsert,
    lsmDelete: lsmDelete,
    lsmSearch: lsmSearch,
    lsmDescribe: lsmDescribe,
    lsmAudit: lsmAudit,
    lsmSize: lsmSize
  };
});
