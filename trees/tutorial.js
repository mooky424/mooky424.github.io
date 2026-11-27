(function () {
  const Lab = window.StorageLab;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG = "http://www.w3.org/2000/svg";

  function syncNextId(tree) {
    const max = Object.keys(tree.nodes).reduce(function (highest, id) {
      return Math.max(highest, Number(id));
    }, 0);
    if (tree.nextId <= max) tree.nextId = max + 1;
  }

  function shot(tree, message, rule, highlight) {
    return {
      nodes: Lab.clone(tree.nodes),
      rootId: tree.rootId,
      message: message,
      rule: rule,
      highlight: highlight || { ids: [], cells: [], via: null, kind: "path" }
    };
  }

  function animateRoom(tree) {
    const frames = [];
    frames.push(shot(tree, "Adding 6.", "Insert", { ids: [1], cells: [], via: null, kind: "path" }));
    frames.push(shot(tree, "6 is smaller than 10. Take the left child.", "Insert", { ids: [1], cells: [], via: 2, kind: "path" }));
    tree.nodes[2].keys = [4, 6, 8];
    frames.push(shot(tree, "The node has room. 6 goes in.", "Insert · room", { ids: [2], cells: [{ id: 2, index: 1 }], via: null, kind: "place" }));
    return frames;
  }

  function animateSplit(tree) {
    const frames = [];
    frames.push(shot(tree, "Adding 0.", "Insert", { ids: [1], cells: [], via: null, kind: "path" }));
    frames.push(shot(tree, "0 is smaller than 10. Take the left child.", "Insert", { ids: [1], cells: [], via: 2, kind: "path" }));
    tree.nodes[2].keys = [0, 1, 2, 3];
    frames.push(shot(tree, "The node is full. Add 0 anyway.", "Insert · over", { ids: [2], cells: [{ id: 2, index: 0 }], via: null, kind: "full" }));
    tree.nodes[2].keys = [0];
    tree.nodes[4] = { id: 4, keys: [2, 3], children: [] };
    tree.nodes[1].keys = [1, 10];
    tree.nodes[1].children = [2, 4, 3];
    frames.push(shot(tree, "Split around 1. 1 moves into the parent. 0 stays left. 2 and 3 go right.", "Insert · split", {
      ids: [1, 2, 4], cells: [{ id: 1, index: 0 }], via: null, kind: "split"
    }));
    syncNextId(tree);
    return frames;
  }

  function animateUp(tree) {
    const frames = [];
    frames.push(shot(tree, "Adding 0.", "Insert", { ids: [1], cells: [], via: null, kind: "path" }));
    frames.push(shot(tree, "0 is smaller than every key. Take the leftmost child.", "Insert", { ids: [1], cells: [], via: 2, kind: "path" }));
    tree.nodes[2].keys = [0, 1, 2, 3];
    frames.push(shot(tree, "The leaf is full. Add 0 anyway.", "Insert · over", { ids: [2], cells: [{ id: 2, index: 0 }], via: null, kind: "full" }));
    tree.nodes[2].keys = [0];
    tree.nodes[6] = { id: 6, keys: [2, 3], children: [] };
    tree.nodes[1].keys = [1, 10, 20, 30];
    tree.nodes[1].children = [2, 6, 3, 4, 5];
    frames.push(shot(tree, "Split around 1. The parent is full too, so 1 is added there.", "Insert · up", {
      ids: [1], cells: [{ id: 1, index: 0 }], via: null, kind: "full"
    }));
    tree.nodes[1].keys = [1];
    tree.nodes[1].children = [2, 6];
    tree.nodes[8] = { id: 8, keys: [20, 30], children: [3, 4, 5] };
    tree.nodes[7] = { id: 7, keys: [10], children: [1, 8] };
    tree.rootId = 7;
    frames.push(shot(tree, "Split the parent around 10. 10 moves up into a new top node, which has room.", "Insert · root split", {
      ids: [7, 1, 8], cells: [{ id: 7, index: 0 }], via: null, kind: "split"
    }));
    syncNextId(tree);
    return frames;
  }

  const branch = {
    keys: [10, 20],
    children: [{ keys: [4, 8] }, { keys: [12, 15] }, { keys: [25, 30] }]
  };

  const btreeScenes = [
    { group: "Search", title: "Found on the way down", op: "search", key: 10, spec: branch,
      blurb: "Looking for 10." },
    { group: "Search", title: "Found on the bottom", op: "search", key: 15, spec: branch,
      blurb: "Looking for 15." },
    { group: "Search", title: "Missing, between two keys", op: "search", key: 11, spec: branch,
      blurb: "Looking for 11." },
    { group: "Search", title: "Missing, off the end", op: "search", key: 40, spec: branch,
      blurb: "Looking for 40." },
    { group: "Insert", title: "(2a) The node has room", op: "insert", key: 6, spec: {
      keys: [10], children: [{ keys: [4, 8] }, { keys: [14] }]
    }, blurb: "Adding 6.", animate: animateRoom },
    { group: "Insert", title: "(2b) The node is full", op: "insert", key: 0, spec: {
      keys: [10], children: [{ keys: [1, 2, 3] }, { keys: [14] }]
    }, blurb: "Adding 0.", animate: animateSplit },
    { group: "Insert", title: "(2c) The parent is full too", op: "insert", key: 0, spec: {
      keys: [10, 20, 30],
      children: [{ keys: [1, 2, 3] }, { keys: [14, 16] }, { keys: [22, 24] }, { keys: [40] }]
    }, blurb: "Adding 0.", animate: animateUp },
    { group: "Delete", title: "(1) Room to lose a key", op: "delete", key: 6, spec: {
      keys: [10], children: [{ keys: [4, 6] }, { keys: [14, 16] }]
    }, blurb: "Removing 6." },
    { group: "Delete", title: "(2a) Swap with the left", op: "delete", key: 10, spec: {
      keys: [10, 20], children: [{ keys: [5, 8] }, { keys: [15] }, { keys: [25, 30] }]
    }, blurb: "Removing 10." },
    { group: "Delete", title: "(2b) Swap with the right", op: "delete", key: 20, spec: {
      keys: [10, 20], children: [{ keys: [5] }, { keys: [15] }, { keys: [25, 30] }]
    }, blurb: "Removing 20." },
    { group: "Delete", title: "(2c) Both children merge", op: "delete", key: 10, spec: {
      keys: [10, 20], children: [{ keys: [5] }, { keys: [15] }, { keys: [25, 30] }]
    }, blurb: "Removing 10." },
    { group: "Delete", title: "(3a) Borrow from the left", op: "delete", key: 12, spec: {
      keys: [10, 20], children: [{ keys: [2, 4] }, { keys: [12] }, { keys: [22, 24] }]
    }, blurb: "Removing 12." },
    { group: "Delete", title: "(3a) Borrow from the right", op: "delete", key: 2, spec: {
      keys: [10, 20], children: [{ keys: [2] }, { keys: [12, 14] }, { keys: [22] }]
    }, blurb: "Removing 2." },
    { group: "Delete", title: "(3b) Two nodes merge", op: "delete", key: 2, spec: {
      keys: [10, 20], children: [{ keys: [2] }, { keys: [12] }, { keys: [22] }]
    }, blurb: "Removing 2." },
    { group: "Delete", title: "(4) One level disappears", op: "delete", key: 2, spec: {
      keys: [10], children: [{ keys: [2] }, { keys: [12] }]
    }, blurb: "Removing 2." }
  ];

  const lsmScenes = [
    { group: "Memtable", title: "A new key", op: "insert", key: 6, spec: { mem: [2, 9], l1: [1, 4] },
      blurb: "Writing 6 into memory." },
    { group: "Memtable", title: "Replace the copy in memory", op: "insert", key: 9, spec: { mem: [2, 9], l1: [9, 15] },
      blurb: "Replacing 9." },
    { group: "Memtable", title: "Leave the old SSTable", op: "insert", key: 5, spec: { mem: [1], l1: [5, 8] },
      blurb: "Writing a newer 5. The old list stays." },
    { group: "Memtable", title: "\u00d7key in memory", op: "delete", key: 10, spec: { mem: [2], l1: [10, 18] },
      blurb: "Marking 10 deleted." },
    { group: "Flush", title: "The new key fills memory", op: "insert", key: 4, spec: { mem: [1, 2, 3] },
      blurb: "Adding 4 fills the table." },
    { group: "Flush", title: "Memory is already full", op: "insert", key: 5, spec: { mem: [1, 2, 3, 4], l1: [9] },
      blurb: "Memory is full, so it is saved first." },
    { group: "Compaction", title: "A third SSTable triggers the merge", op: "insert", key: 4, spec: {
      mem: [1, 2, 3],
      l0: [[{ key: 15, tomb: true }, 16], [20, 21]],
      l1: [5, 15, 30]
    }, blurb: "This flush makes one SSTable too many." }
  ];

  function el(name, attrs) {
    const node = document.createElementNS(SVG, name);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function layout(nodes, rootId, padTop) {
    const cell = 56;
    const nodeH = 46;
    const gapX = 28;
    const gapY = 96;
    const top = padTop || 28;
    const depthOf = {};
    (function walk(id, depth) {
      depthOf[id] = depth;
      const node = nodes[id];
      if (node && node.children.length) node.children.forEach(function (child) { walk(child, depth + 1); });
    })(rootId, 0);
    const box = {};
    function measure(id) {
      const node = nodes[id];
      const own = Math.max(node.keys.length, 1) * cell + 10;
      if (!node.children.length) {
        box[id] = { w: own, own: own, sum: own };
        return own;
      }
      let sum = 0;
      node.children.forEach(function (child, index) {
        sum += measure(child);
        if (index) sum += gapX;
      });
      box[id] = { w: Math.max(own, sum), own: own, sum: sum };
      return box[id].w;
    }
    const total = measure(rootId);
    const pos = {};
    function place(id, left) {
      const node = nodes[id];
      const item = box[id];
      pos[id] = { x: left + (item.w - item.own) / 2, y: top + depthOf[id] * gapY, w: item.own, h: nodeH };
      if (node.children.length) {
        let cursor = left + (item.w - item.sum) / 2;
        node.children.forEach(function (child) {
          place(child, cursor);
          cursor += box[child].w + gapX;
        });
      }
    }
    place(rootId, 24);
    const maxDepth = Math.max.apply(null, Object.keys(depthOf).map(function (id) { return depthOf[id]; }));
    return { pos: pos, width: Math.max(total + 56, 320), height: top + maxDepth * gapY + nodeH + 36, depthOf: depthOf };
  }

  function renderTree(svg, frame, orderM) {
    const nodes = frame.nodes;
    const rootId = frame.rootId;
    const highlight = frame.highlight || { ids: [], cells: [], via: null, kind: "path" };
    const placed = layout(nodes, rootId, orderM ? 102 : 0);
    svg.replaceChildren();
    svg.setAttribute("width", String(placed.width));
    svg.setAttribute("height", String(placed.height));
    svg.setAttribute("viewBox", "0 0 " + placed.width + " " + placed.height);

    if (orderM) {
      [
        ["Order", String(orderM)],
        ["Max children", String(orderM)],
        ["Max keys", String(orderM - 1)],
        ["Min children", String(orderM / 2)],
        ["Min keys", String(orderM / 2 - 1)]
      ].forEach(function (row, index) {
        const y = 18 + index * 16;
        const label = el("text", {
          x: 14, y: y,
          "font-family": "Segoe UI, Candara, Helvetica Neue, sans-serif",
          "font-size": "12",
          fill: "#9a3412"
        });
        label.textContent = row[0];
        const value = el("text", {
          x: 116, y: y,
          "font-family": "Cascadia Mono, Cascadia Code, Consolas, monospace",
          "font-size": "12",
          fill: "#221c16"
        });
        value.textContent = row[1];
        svg.appendChild(label);
        svg.appendChild(value);
      });
    }

    Object.keys(nodes).forEach(function (id) {
      const node = nodes[id];
      if (!node.children.length) return;
      node.children.forEach(function (childId, index) {
        const from = placed.pos[id];
        const to = placed.pos[childId];
        if (!from || !to) return;
        const hot = highlight.via === childId;
        svg.appendChild(el("line", {
          x1: from.x + ((index + 0.5) * from.w) / node.children.length,
          y1: from.y + from.h,
          x2: to.x + to.w / 2,
          y2: to.y,
          stroke: hot ? "#9a3412" : "#e0c2b4",
          "stroke-width": hot ? "2.5" : "1.5"
        }));
      });
    });

    Object.keys(nodes).forEach(function (id) {
      const node = nodes[id];
      const box = placed.pos[id];
      if (!box) return;
      const numeric = Number(id);
      const marked = highlight.ids && highlight.ids.indexOf(numeric) !== -1;
      const kind = marked ? highlight.kind : "";
      let fill = "#ffffff";
      let stroke = "#9a3412";
      if (kind === "found" || kind === "place" || kind === "split" || kind === "borrow" || kind === "merge") {
        fill = "#f6e2d4"; stroke = "#9a3412";
      } else if (kind === "path") {
        stroke = "#9a3412";
      } else if (kind === "miss") {
        fill = "#f8e4e1"; stroke = "#8d2b28";
      } else if (kind === "full" || kind === "under") {
        fill = "#f8efd8"; stroke = "#8a5a12";
      }
      const group = el("g", {});
      group.appendChild(el("rect", {
        x: box.x, y: box.y, width: box.w, height: box.h, rx: "10",
        fill: fill, stroke: stroke, "stroke-width": marked ? "2.4" : "1.5"
      }));
      const count = Math.max(node.keys.length, 1);
      const inner = box.w - 8;
      for (let i = 0; i < count; i += 1) {
        const hot = (highlight.cells || []).some(function (cell) { return cell.id === numeric && cell.index === i; });
        if (hot) {
          group.appendChild(el("rect", {
            x: box.x + 4 + (inner * i) / count,
            y: box.y + 5,
            width: inner / count,
            height: box.h - 10,
            rx: "6",
            fill: "#f8efd8"
          }));
        }
        if (i) {
          group.appendChild(el("line", {
            x1: box.x + 4 + (inner * i) / count,
            y1: box.y + 8,
            x2: box.x + 4 + (inner * i) / count,
            y2: box.y + box.h - 8,
            stroke: "#e3d7c4"
          }));
        }
        const text = el("text", {
          x: box.x + 4 + (inner * (i + 0.5)) / count,
          y: box.y + box.h / 2 + 1,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-family": "Cascadia Mono, Cascadia Code, Consolas, monospace",
          "font-size": node.keys.length ? "16" : "12",
          fill: node.keys.length ? "#221c16" : "#8a7d70"
        });
        text.textContent = node.keys.length ? String(node.keys[i]) : "empty";
        group.appendChild(text);
      }
      const tag = el("text", {
        x: box.x + box.w / 2,
        y: box.y - 8,
        "text-anchor": "middle",
        "font-family": "Segoe UI, Candara, Helvetica Neue, sans-serif",
        "font-size": "11",
        fill: "#5e564c"
      });
      tag.textContent = "";
      group.appendChild(tag);
      svg.appendChild(group);
    });
  }

  function renderLsm(svg, frame, limits) {
    const highlight = frame.highlight || { band: "mem", run: -1, index: -1, kind: "path" };
    const rows = [{
      place: "memory",
      name: "Memtable",
      tables: [{ band: "mem", run: -1, entries: frame.mem || [] }]
    }];
    const c1 = (frame.l0 || []).map(function (entries, index) {
      return { band: "l0", run: index, entries: entries };
    });
    rows.push({
      place: "disk",
      name: "C1",
      tables: c1.length ? c1 : [{ band: "l0", run: 0, entries: [] }]
    });
    rows.push({
      place: "disk",
      name: "C2",
      tables: [{ band: "l1", run: -1, entries: frame.l1 || [] }]
    });
    (frame.below || []).forEach(function (entries, index) {
      rows.push({
        place: "disk",
        name: "C" + (index + 3),
        tables: [{ band: "below", run: index, entries: entries }]
      });
    });

    const cell = 54;
    const nodeH = 44;
    const rowGap = 14;
    const tableGap = 12;
    const nameW = 82;
    const padX = 14;
    const padTop = 26;
    const padBot = 12;
    const bandGap = 14;
    function tableWidth(entries) {
      return entries.length ? entries.length * cell + 8 : 96;
    }
    let widest = 108;
    rows.forEach(function (row) {
      let span = 0;
      row.tables.forEach(function (table, index) {
        span += tableWidth(table.entries);
        if (index) span += tableGap;
      });
      widest = Math.max(widest, span);
    });
    const width = Math.max(padX * 2 + nameW + widest, 260);
    const diskCount = rows.length - 1;
    const memH = padTop + nodeH + padBot;
    const diskH = padTop + diskCount * nodeH + (diskCount - 1) * rowGap + padBot;
    const memCap = frame.memCap || (limits && limits.memCap) || Lab.MEM_CAP;
    const ratio = frame.ratio || (limits && limits.ratio) || Lab.L0_CAP;
    const lines = [
      ["Size ratio T", String(ratio)],
      ["Memtable keys", String(memCap)],
      ["C1 capacity", String(memCap * ratio)],
      ["C2 capacity", String(memCap * ratio * ratio)]
    ];
    (frame.below || []).forEach(function (entries, index) {
      const level = index + 3;
      lines.push(["C" + level + " capacity", String(memCap * Math.pow(ratio, level))]);
    });
    const top = 8 + lines.length * 16;
    const height = top + 8 + memH + bandGap + diskH + 8;
    svg.replaceChildren();
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    lines.forEach(function (row, index) {
      const y = 16 + index * 16;
      const label = el("text", {
        x: 14, y: y,
        "font-family": "Segoe UI, Candara, Helvetica Neue, sans-serif",
        "font-size": "12",
        fill: "#9a3412"
      });
      label.textContent = row[0];
      const value = el("text", {
        x: 148, y: y,
        "font-family": "Cascadia Mono, Cascadia Code, Consolas, monospace",
        "font-size": "12",
        fill: "#221c16"
      });
      value.textContent = row[1];
      svg.appendChild(label);
      svg.appendChild(value);
    });

    function paintPlace(title, y, h, fill) {
      svg.appendChild(el("rect", {
        x: 8, y: y, width: width - 16, height: h, rx: "16", fill: fill
      }));
      const tag = el("text", {
        x: width - 22, y: y + 16,
        "text-anchor": "end",
        "font-family": "Segoe UI, Candara, Helvetica Neue, sans-serif",
        "font-size": "12",
        fill: "#9a3412"
      });
      tag.textContent = title;
      svg.appendChild(tag);
    }
    paintPlace("Memory", top + 8, memH, "#f6e2d4");
    paintPlace("Disk", top + 8 + memH + bandGap, diskH, "#e5f2ef");

    let diskIndex = 0;
    rows.forEach(function (row) {
      const y = row.place === "memory"
        ? top + 8 + padTop
        : top + 8 + memH + bandGap + padTop + diskIndex * (nodeH + rowGap);
      if (row.place === "disk") diskIndex += 1;

      const name = el("text", {
        x: padX + 4, y: y + nodeH / 2 + 1,
        "dominant-baseline": "middle",
        "font-family": "Segoe UI, Candara, Helvetica Neue, sans-serif",
        "font-size": "13",
        fill: "#9a3412"
      });
      name.textContent = row.name;
      svg.appendChild(name);

      let boxX = padX + nameW;
      row.tables.forEach(function (table) {
        const entries = table.entries;
        const w = tableWidth(entries);
        const keyed = table.band === "l0" || table.band === "below";
        const active = highlight.band === table.band && (!keyed || highlight.run === table.run);
        const kind = active ? highlight.kind : "";
        let fill = "#ffffff";
        let stroke = entries.length ? "#9a3412" : "#e0c2b4";
        if (kind === "found" || kind === "place" || kind === "flush" || kind === "compact") {
          fill = "#f6e2d4"; stroke = "#9a3412";
        } else if (kind === "path") {
          stroke = "#9a3412";
        } else if (kind === "miss" || kind === "tomb") {
          fill = "#f8e4e1"; stroke = "#8d2b28";
        } else if (kind === "full") {
          fill = "#f8efd8"; stroke = "#8a5a12";
        }
        const group = el("g", {});
        group.appendChild(el("rect", {
          x: boxX, y: y, width: w, height: nodeH, rx: "10",
          fill: fill, stroke: stroke,
          "stroke-width": active ? "2.4" : "1.5",
          "stroke-dasharray": entries.length ? "0" : "5 4"
        }));
        if (!entries.length) {
          const empty = el("text", {
            x: boxX + w / 2, y: y + nodeH / 2 + 1,
            "text-anchor": "middle", "dominant-baseline": "middle",
            "font-family": "Cascadia Mono, Cascadia Code, Consolas, monospace",
            "font-size": "12", fill: "#8a7d70"
          });
          empty.textContent = "empty";
          group.appendChild(empty);
        } else {
          entries.forEach(function (entry, index) {
            const x = boxX + 4 + index * cell;
            const hot = active && highlight.index === index;
            if (entry.tomb || hot) {
              group.appendChild(el("rect", {
                x: x, y: y + 5, width: cell - 2, height: nodeH - 10, rx: "6",
                fill: entry.tomb ? "#f8e4e1" : "#f8efd8"
              }));
            }
            if (index) {
              group.appendChild(el("line", {
                x1: boxX + 4 + index * cell, y1: y + 8,
                x2: boxX + 4 + index * cell, y2: y + nodeH - 8,
                stroke: "#e3d7c4"
              }));
            }
            const text = el("text", {
              x: x + (cell - 2) / 2, y: y + nodeH / 2 + 1,
              "text-anchor": "middle", "dominant-baseline": "middle",
              "font-family": "Cascadia Mono, Cascadia Code, Consolas, monospace",
              "font-size": entry.tomb ? "14" : "16",
              fill: entry.tomb ? "#8d2b28" : "#221c16"
            });
            text.textContent = (entry.tomb ? "×" : "") + entry.key;
            group.appendChild(text);
          });
        }
        svg.appendChild(group);
        boxX += w + tableGap;
      });
    });
  }

  const spoken = {
    "Search": "Keep looking",
    "Search · found": "Found",
    "Search · missing": "Not here",
    "Search · memtable": "Found in memory",
    "Search · tombstone": "Deleted",
    "Search · miss": "Not in this one",
    "Search · run": "Found in a list",
    "Insert": "Walk down",
    "Insert · room": "It fits",
    "Insert · over": "Add it anyway",
    "Insert · split": "The node splits",
    "Insert · up": "The parent is full",
    "Insert · root split": "A new top node",
    "Insert · duplicate": "Already stored",
    "Delete": "Go down",
    "Delete · minimum child": "Only one key",
    "Delete · borrow left": "Borrow from the left",
    "Delete · borrow right": "Borrow from the right",
    "Delete · merge": "Merge",
    "Delete · predecessor": "Swap with the left",
    "Delete · successor": "Swap with the right",
    "Delete · leaf": "Remove it",
    "Delete · shorter tree": "One level shorter",
    "Delete · missing": "Not here",
    "Flush": "Flushed",
    "Compaction": "Merged",
    "Write · overwrite": "Replace it",
    "Write · tombstone": "Mark deleted",
    "Write · absent key": "Mark deleted anyway",
    "Write · newer copy": "A newer copy",
    "Write · memtable": "Into memory",
    "Write · memtable full": "Memory is full"
  };

  function speak(rule) {
    return spoken[rule] || rule || "";
  }

  function makePlayer(parts) {
    let frames = [];
    let index = 0;
    let timer = 0;
    function setPlaying(on) {
      parts.play.classList.toggle("is-playing", on);
      parts.play.setAttribute("aria-label", on ? "Pause" : "Play");
      parts.play.setAttribute("aria-pressed", on ? "true" : "false");
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = 0;
      setPlaying(false);
    }
    function show(i) {
      if (!frames.length) return;
      index = Math.max(0, Math.min(i, frames.length - 1));
      const frame = frames[index];
      parts.render(frame);
      if (parts.rule) parts.rule.textContent = speak(frame.rule);
      parts.text.textContent = frame.message || "";
      parts.count.textContent = "Frame " + (index + 1) + " of " + frames.length;
      parts.prev.disabled = index <= 0;
      parts.next.disabled = index >= frames.length - 1;
    }
    function play() {
      if (reduced || frames.length < 2) return;
      if (index >= frames.length - 1) show(0);
      setPlaying(true);
      timer = setInterval(function () {
        if (index >= frames.length - 1) { stop(); return; }
        show(index + 1);
      }, 1100);
    }
    parts.prev.addEventListener("click", function () { stop(); show(index - 1); });
    parts.next.addEventListener("click", function () { stop(); show(index + 1); });
    parts.play.addEventListener("click", function () {
      if (timer) { stop(); return; }
      if (reduced) { show(Math.min(frames.length - 1, index + 1)); return; }
      play();
    });
    return {
      load: function (next, autoplay) {
        stop();
        frames = next;
        show(0);
        if (autoplay && !reduced) play();
      },
      stop: stop
    };
  }

  function mountScenes(root, scenes, onPick) {
    let row = null;
    let lastGroup = "";
    const buttons = [];
    const single = scenes.length > 0 && scenes.every(function (scene) { return scene.group === scenes[0].group; });
    scenes.forEach(function (scene, index) {
      if (scene.group !== lastGroup) {
        row = document.createElement("div");
        row.className = "scene-row";
        if (!single) {
          const label = document.createElement("p");
          label.textContent = scene.group;
          row.appendChild(label);
        }
        root.appendChild(row);
        lastGroup = scene.group;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = scene.title;
      button.addEventListener("click", function () { onPick(scene, index); });
      row.appendChild(button);
      buttons.push(button);
    });
    return {
      mark: function (active) {
        buttons.forEach(function (button, index) {
          button.setAttribute("aria-pressed", index === active ? "true" : "false");
        });
      }
    };
  }

  function readKey(input, rule, text) {
    const raw = String(input.value).trim();
    if (!/^\d+$/.test(raw) || Number(raw) > 999) {
      text.textContent = "Use a whole number from 0 to 999.";
      if (rule) rule.textContent = "Key";
      return null;
    }
    return Number(raw);
  }

  function mountBtree(ids, scenes, op) {
    const svg = document.getElementById(ids.svg);
    const keyInput = ids.key ? document.getElementById(ids.key) : null;
    let tree = Lab.createTree();

    const player = makePlayer({
      prev: document.getElementById(ids.prev),
      next: document.getElementById(ids.next),
      play: document.getElementById(ids.play),
      rule: document.getElementById(ids.rule),
      text: document.getElementById(ids.text),
      count: document.getElementById(ids.count),
      render: function (frame) {
        renderTree(svg, frame, ids.orderM);
      }
    });

    function idle(message, rule) {
      return {
        nodes: Lab.clone(tree.nodes),
        rootId: tree.rootId,
        message: message,
        rule: rule || "Ready",
        highlight: { ids: [tree.rootId], cells: [], via: null, kind: "path" }
      };
    }

    const buttons = ids.scenes ? mountScenes(document.getElementById(ids.scenes), scenes, function (scene, index) {
      buttons.mark(index);
      tree = Lab.buildTree(scene.spec);
      if (scene.animate) {
        player.load(scene.animate(tree), false);
        return;
      }
      const intro = idle(scene.blurb, scene.title);
      const result = op === "search" ? Lab.searchKey(tree, scene.key)
        : op === "insert" ? Lab.insertKey(tree, scene.key)
        : Lab.deleteKey(tree, scene.key);
      player.load([intro].concat(result.frames), false);
    }) : null;

    function run(key) {
      if (buttons) buttons.mark(-1);
      if (op === "insert" && Lab.describe(tree).keys.length >= 18) {
        player.load([idle("Reset, or pick a case.")], false);
        return;
      }
      const result = op === "search" ? Lab.searchKey(tree, key)
        : op === "insert" ? Lab.insertKey(tree, key)
        : Lab.deleteKey(tree, key);
      player.load(result.frames, result.frames.length > 1);
    }

    if (ids.go) {
      document.getElementById(ids.go).addEventListener("click", function () {
        const key = readKey(keyInput, document.getElementById(ids.rule), document.getElementById(ids.text));
        if (key != null) run(key);
      });
    }
    if (ids.reset) {
      document.getElementById(ids.reset).addEventListener("click", function () {
        tree = Lab.createTree();
        if (buttons) buttons.mark(-1);
        player.load([idle("Empty. Pick a case, or add a key.")], false);
      });
    }
    if (keyInput) {
      keyInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          document.getElementById(ids.go).click();
        }
      });
    }
    document.getElementById(ids.stage).addEventListener("keydown", function (event) {
      if (event.target.matches("input, textarea")) return;
      if (event.key === "ArrowRight") document.getElementById(ids.next).click();
      if (event.key === "ArrowLeft") document.getElementById(ids.prev).click();
    });

    if (ids.example) {
      tree = Lab.buildTree(ids.example.spec);
      const intro = idle(ids.example.blurb, "Search");
      const result = Lab.searchKey(tree, ids.example.key);
      player.load([intro].concat(result.frames), false);
    } else if (scenes[0] && scenes[0].animate) {
      tree = Lab.buildTree(scenes[0].spec);
      if (buttons) buttons.mark(0);
      player.load(scenes[0].animate(tree), false);
    } else if (scenes[0]) {
      tree = Lab.buildTree(scenes[0].spec);
      if (buttons) buttons.mark(0);
      const intro = idle(scenes[0].blurb, scenes[0].title);
      const result = op === "search" ? Lab.searchKey(tree, scenes[0].key)
        : op === "insert" ? Lab.insertKey(tree, scenes[0].key)
        : Lab.deleteKey(tree, scenes[0].key);
      player.load([intro].concat(result.frames), false);
    } else {
      player.load([idle("Empty. Pick a case, or add a key.")], false);
    }
    return player;
  }

  function mountSandbox() {
    const svg = document.getElementById("box-tree");
    const addButton = document.getElementById("box-add");
    const keyInput = document.getElementById("box-key");
    const text = document.getElementById("box-text");
    let orderM = 4;
    let nextKey = 1;
    let tree = Lab.createTree(orderM);

    function paintAdd() {
      addButton.textContent = "Add " + nextKey;
    }

    function skipTaken() {
      const have = new Set(Lab.describe(tree).keys);
      while (have.has(nextKey)) nextKey += 1;
      paintAdd();
    }

    const player = makePlayer({
      prev: document.getElementById("box-prev"),
      next: document.getElementById("box-next"),
      play: document.getElementById("box-play"),
      text: text,
      count: document.getElementById("box-count"),
      render: function (frame) {
        renderTree(svg, frame, orderM);
      }
    });

    function idle(message) {
      return {
        nodes: Lab.clone(tree.nodes),
        rootId: tree.rootId,
        t: tree.t,
        message: message,
        rule: "Ready",
        highlight: { ids: [tree.rootId], cells: [], via: null, kind: "path" }
      };
    }

    function run(op, key) {
      const result = op === "search" ? Lab.searchKey(tree, key)
        : op === "insert" ? Lab.insertKey(tree, key)
        : Lab.deleteKey(tree, key);
      player.load(result.frames, result.frames.length > 1);
      if (op === "insert" && !result.error) skipTaken();
      return result;
    }

    function randomKey() {
      const have = new Set(Lab.describe(tree).keys);
      const limit = Math.max(40, have.size + 20);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const key = 1 + Math.floor(Math.random() * limit);
        if (!have.has(key) && key <= 999) return key;
      }
      let key = 1;
      while (have.has(key)) key += 1;
      return key;
    }

    function reset(message) {
      tree = Lab.createTree(orderM);
      nextKey = 1;
      paintAdd();
      player.load([idle(message || "Empty. Add a key.")], false);
    }

    addButton.addEventListener("click", function () {
      run("insert", nextKey);
    });
    document.getElementById("box-random").addEventListener("click", function () {
      run("insert", randomKey());
    });
    document.getElementById("box-insert").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("insert", key);
    });
    document.getElementById("box-search").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("search", key);
    });
    document.getElementById("box-delete").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("delete", key);
    });
    document.getElementById("box-reset").addEventListener("click", function () { reset(); });
    document.getElementById("box-m").addEventListener("change", function (event) {
      let m = Math.round(Number(event.target.value));
      if (!m || m % 2) m = m && m % 2 ? m + 1 : 4;
      if (m < 4) m = 4;
      if (m > 12) m = 12;
      event.target.value = String(m);
      if (m === orderM) return;
      orderM = m;
      reset("Order m is " + m + ". The tree is empty.");
    });
    keyInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("box-insert").click();
      }
    });
    document.getElementById("box-stage").addEventListener("keydown", function (event) {
      if (event.target.matches("input, textarea")) return;
      if (event.key === "ArrowRight") document.getElementById("box-next").click();
      if (event.key === "ArrowLeft") document.getElementById("box-prev").click();
    });

    paintAdd();
    player.load([idle("Empty. Add a key.")], false);
    return player;
  }

  function lsmAct(state, op, key) {
    if (op === "search") return Lab.lsmSearch(state, key);
    if (op === "insert") return Lab.lsmInsert(state, key);
    return Lab.lsmDelete(state, key);
  }

  function mountLsm(ids, scenes, op) {
    const svg = document.getElementById(ids.svg);
    let state = Lab.lsmCreate();

    const player = makePlayer({
      prev: document.getElementById(ids.prev),
      next: document.getElementById(ids.next),
      play: document.getElementById(ids.play),
      text: document.getElementById(ids.text),
      count: document.getElementById(ids.count),
      render: function (frame) { renderLsm(svg, frame); }
    });

    function idle(message, rule) {
      return {
        mem: Lab.clone(state.mem),
        l0: Lab.clone(state.l0),
        l1: Lab.clone(state.l1),
        below: Lab.clone(state.below || []),
        memCap: state.memCap,
        ratio: state.ratio,
        message: message,
        rule: rule || "Ready",
        highlight: { band: "mem", run: -1, index: -1, kind: "path" }
      };
    }

    function showScene(scene, index) {
      if (buttons) buttons.mark(index);
      state = Lab.lsmBuild(scene.spec);
      const intro = idle(scene.blurb, scene.title);
      const result = lsmAct(state, scene.op, scene.key);
      player.load([intro].concat(result.frames), false);
    }

    const buttons = ids.scenes ? mountScenes(document.getElementById(ids.scenes), scenes, function (scene, index) {
      showScene(scene, index);
    }) : null;

    document.getElementById(ids.stage).addEventListener("keydown", function (event) {
      if (event.target.matches("input, textarea")) return;
      if (event.key === "ArrowRight") document.getElementById(ids.next).click();
      if (event.key === "ArrowLeft") document.getElementById(ids.prev).click();
    });

    if (ids.example) {
      state = Lab.lsmBuild(ids.example.spec);
      const intro = idle(ids.example.blurb, "Search");
      const result = Lab.lsmSearch(state, ids.example.key);
      player.load([intro].concat(result.frames), false);
    } else if (scenes[0]) {
      showScene(scenes[0], 0);
    } else {
      player.load([idle("Empty. Add a key.")], false);
    }
    return player;
  }

  function mountLsmSandbox() {
    const svg = document.getElementById("lsm-box-tree");
    const addButton = document.getElementById("lsm-box-add");
    const keyInput = document.getElementById("lsm-box-key");
    const text = document.getElementById("lsm-box-text");
    const memInput = document.getElementById("lsm-box-mem");
    const runsInput = document.getElementById("lsm-box-runs");
    let nextKey = 1;
    let memCap = 4;
    let ratio = 2;
    let state = Lab.lsmCreate();

    function readLimit(input, min, max, fallback) {
      let n = Math.round(Number(input.value));
      if (!n) n = fallback;
      if (n < min) n = min;
      if (n > max) n = max;
      input.value = String(n);
      return n;
    }

    function settingsLine() {
      return "Memtable holds " + memCap + " keys. Size ratio T is " + ratio + ". C1 holds " + (memCap * ratio) + " keys, and C2 holds " + (memCap * ratio * ratio) + ".";
    }

    function paintAdd() {
      addButton.textContent = "Add " + nextKey;
    }

    function skipTaken() {
      const have = new Set(Lab.lsmDescribe(state).keys);
      while (have.has(nextKey)) nextKey += 1;
      paintAdd();
    }

    const player = makePlayer({
      prev: document.getElementById("lsm-box-prev"),
      next: document.getElementById("lsm-box-next"),
      play: document.getElementById("lsm-box-play"),
      text: text,
      count: document.getElementById("lsm-box-count"),
      render: function (frame) { renderLsm(svg, frame, { memCap: memCap, ratio: ratio }); }
    });

    function idle(message) {
      return {
        mem: Lab.clone(state.mem),
        l0: Lab.clone(state.l0),
        l1: Lab.clone(state.l1),
        below: Lab.clone(state.below || []),
        memCap: memCap,
        ratio: ratio,
        message: message,
        rule: "Ready",
        highlight: { band: "mem", run: -1, index: -1, kind: "path" }
      };
    }

    function run(op, key) {
      const result = lsmAct(state, op, key);
      player.load(result.frames, result.frames.length > 1);
      if (op === "insert") skipTaken();
      return result;
    }

    function randomKey() {
      const have = new Set(Lab.lsmDescribe(state).keys);
      const limit = Math.max(40, have.size + 20);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const key = 1 + Math.floor(Math.random() * limit);
        if (!have.has(key) && key <= 999) return key;
      }
      let key = 1;
      while (have.has(key)) key += 1;
      return key;
    }

    function reset(message) {
      state = Lab.lsmCreate({ memCap: memCap, ratio: ratio });
      nextKey = 1;
      paintAdd();
      player.load([idle(message || "Empty. Add a key.")], false);
    }

    function applySettings() {
      const nextMem = readLimit(memInput, 2, 8, 4);
      const nextRatio = readLimit(runsInput, 2, 4, 2);
      if (nextMem === memCap && nextRatio === ratio) return;
      memCap = nextMem;
      ratio = nextRatio;
      reset(settingsLine());
    }

    addButton.addEventListener("click", function () { run("insert", nextKey); });
    document.getElementById("lsm-box-random").addEventListener("click", function () { run("insert", randomKey()); });
    document.getElementById("lsm-box-insert").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("insert", key);
    });
    document.getElementById("lsm-box-search").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("search", key);
    });
    document.getElementById("lsm-box-delete").addEventListener("click", function () {
      const key = readKey(keyInput, null, text);
      if (key != null) run("delete", key);
    });
    document.getElementById("lsm-box-reset").addEventListener("click", function () { reset(); });
    memInput.addEventListener("change", applySettings);
    runsInput.addEventListener("change", applySettings);
    keyInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("lsm-box-insert").click();
      }
    });
    document.getElementById("lsm-box-stage").addEventListener("keydown", function (event) {
      if (event.target.matches("input, textarea")) return;
      if (event.key === "ArrowRight") document.getElementById("lsm-box-next").click();
      if (event.key === "ArrowLeft") document.getElementById("lsm-box-prev").click();
    });

    paintAdd();
    player.load([idle("Empty. Add a key.")], false);
    return player;
  }

  function memberUrl(href) {
    if (!href) return "../";
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.charAt(0) === "/" || href.charAt(0) === "#" || href.charAt(0) === ".") return href;
    return "https://" + href;
  }

  function applyMembers() {
    const config = window.SITE_CONFIG || {};
    const byline = document.getElementById("byline");
    if (byline) {
      const names = (config.members || []).map(function (member) { return member.name; }).filter(Boolean);
      byline.textContent = ["CSCI 201", "Trees"].concat(names).join(" · ");
    }
    const list = document.getElementById("member-list");
    if (!config.members || !list) return;
    list.textContent = "";
    config.members.forEach(function (member) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = memberUrl(member.href);
      if (member.here) {
        link.className = "here";
        link.setAttribute("aria-current", "page");
      }
      const name = document.createElement("strong");
      name.textContent = member.name || "";
      link.appendChild(name);
      const detail = [];
      if (member.role) detail.push(member.role);
      if (member.here) detail.push("this site");
      if (detail.length) link.appendChild(document.createTextNode(" " + detail.join(" · ")));
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function boot() {
    applyMembers();
    function scenesFor(group) {
      return btreeScenes.filter(function (scene) { return scene.group === group; });
    }
    const sandbox = mountSandbox();
    const btreePlayers = {
      search: mountBtree({
        svg: "tree",
        prev: "prev", next: "next", play: "play", rule: "rule", text: "text", count: "count",
        stage: "stage",
        orderM: 4,
        example: {
          key: 33,
          blurb: "Looking for 33.",
          spec: {
            keys: [20, 40, 60],
            children: [
              { keys: [10], children: [{ keys: [4, 8] }, { keys: [14, 16] }] },
              { keys: [30], children: [{ keys: [25, 28] }, { keys: [33, 35] }] },
              { keys: [50], children: [{ keys: [45, 48] }, { keys: [55, 58] }] },
              { keys: [80], children: [{ keys: [70, 75] }, { keys: [90, 95] }] }
            ]
          }
        }
      }, [], "search"),
      insert: mountBtree({
        svg: "ins-tree", scenes: "ins-scenes", orderM: 4,
        prev: "ins-prev", next: "ins-next", play: "ins-play", rule: "ins-rule", text: "ins-text", count: "ins-count",
        stage: "ins-stage"
      }, scenesFor("Insert"), "insert"),
      delete: mountBtree({
        svg: "del-tree", scenes: "del-scenes", orderM: 4,
        prev: "del-prev", next: "del-next", play: "del-play", rule: "del-rule", text: "del-text", count: "del-count",
        stage: "del-stage"
      }, scenesFor("Delete"), "delete")
    };
    function selectOp(name) {
      ["search", "insert", "delete", "sandbox"].forEach(function (op) {
        const on = op === name;
        document.getElementById("op-panel-" + op).hidden = !on;
        document.getElementById("op-tab-" + op).setAttribute("aria-selected", on ? "true" : "false");
        if (!on) {
          if (op === "sandbox") sandbox.stop();
          else btreePlayers[op].stop();
        }
      });
    }
    document.getElementById("op-tab-search").addEventListener("click", function () { selectOp("search"); });
    document.getElementById("op-tab-insert").addEventListener("click", function () { selectOp("insert"); });
    document.getElementById("op-tab-delete").addEventListener("click", function () { selectOp("delete"); });
    document.getElementById("op-tab-sandbox").addEventListener("click", function () { selectOp("sandbox"); });

    function lsmFor(group) {
      return lsmScenes.filter(function (scene) { return scene.group === group; });
    }
    const lsmSandbox = mountLsmSandbox();
    const lsmPlayers = {
      mem: mountLsm({
        svg: "lsm-tree", scenes: "lsm-mem-scenes",
        prev: "lsm-prev", next: "lsm-next", play: "lsm-play", text: "lsm-text", count: "lsm-count",
        stage: "lsm-stage"
      }, lsmFor("Memtable"), "insert"),
      flush: mountLsm({
        svg: "lsm-ins-tree", scenes: "lsm-flush-scenes",
        prev: "lsm-ins-prev", next: "lsm-ins-next", play: "lsm-ins-play", text: "lsm-ins-text", count: "lsm-ins-count",
        stage: "lsm-ins-stage"
      }, lsmFor("Flush"), "insert"),
      compact: mountLsm({
        svg: "lsm-del-tree", scenes: "lsm-compact-scenes",
        prev: "lsm-del-prev", next: "lsm-del-next", play: "lsm-del-play", text: "lsm-del-text", count: "lsm-del-count",
        stage: "lsm-del-stage"
      }, lsmFor("Compaction"), "insert")
    };
    function selectLsm(name) {
      ["mem", "flush", "compact", "sandbox"].forEach(function (op) {
        const on = op === name;
        document.getElementById("lsm-panel-" + op).hidden = !on;
        document.getElementById("lsm-tab-" + op).setAttribute("aria-selected", on ? "true" : "false");
        if (!on) {
          if (op === "sandbox") lsmSandbox.stop();
          else lsmPlayers[op].stop();
        }
      });
    }
    document.getElementById("lsm-tab-mem").addEventListener("click", function () { selectLsm("mem"); });
    document.getElementById("lsm-tab-flush").addEventListener("click", function () { selectLsm("flush"); });
    document.getElementById("lsm-tab-compact").addEventListener("click", function () { selectLsm("compact"); });
    document.getElementById("lsm-tab-sandbox").addEventListener("click", function () { selectLsm("sandbox"); });

    let openTab = "btree";
    let sectionOn = "intro";
    const links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
    function paintNav() {
      links.forEach(function (link) {
        const tab = link.getAttribute("data-tab");
        if (tab) link.classList.toggle("is-active", sectionOn === "trees" && tab === openTab);
        else if ((link.getAttribute("href") || "").charAt(0) === "#") link.classList.toggle("is-active", link.getAttribute("href") === "#" + sectionOn);
      });
    }
    function selectTab(name) {
      openTab = name === "lsm" ? "lsm" : "btree";
      const showBtree = openTab === "btree";
      document.getElementById("panel-btree").hidden = !showBtree;
      document.getElementById("panel-lsm").hidden = showBtree;
      document.getElementById("tab-btree").setAttribute("aria-selected", showBtree ? "true" : "false");
      document.getElementById("tab-lsm").setAttribute("aria-selected", showBtree ? "false" : "true");
      if (showBtree) {
        ["mem", "flush", "compact"].forEach(function (op) { lsmPlayers[op].stop(); });
        lsmSandbox.stop();
      }
      else {
        ["search", "insert", "delete"].forEach(function (op) { btreePlayers[op].stop(); });
        sandbox.stop();
      }
      paintNav();
    }
    document.getElementById("tab-btree").addEventListener("click", function () { selectTab("btree"); });
    document.getElementById("tab-lsm").addEventListener("click", function () { selectTab("lsm"); });
    links.forEach(function (link) {
      const tab = link.getAttribute("data-tab");
      if (!tab) return;
      link.addEventListener("click", function () { selectTab(tab); });
    });

    if ("IntersectionObserver" in window) {
      const watcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          sectionOn = entry.target.id;
          paintNav();
        });
      }, { rootMargin: "-40% 0px -50% 0px" });
      ["intro", "trees", "group"].forEach(function (id) {
        watcher.observe(document.getElementById(id));
      });
    }

  }

  boot();
})();
