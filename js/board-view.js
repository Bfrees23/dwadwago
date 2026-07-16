/** DOM board renderer with FLIP-style transforms. */
export function createBoardView(boardEl) {
  let tileLayer = null;
  let size = 4;
  let tileEls = new Map();
  let metrics = { pad: 10, gap: 8, cell: 80 };

  function measure() {
    const n = size;
    const gap = n >= 7 ? 4 : n >= 6 ? 6 : 8;
    const pad = n >= 7 ? 8 : 10;
    const cell = (boardEl.clientWidth - pad * 2 - gap * (n - 1)) / n;
    metrics = { pad, gap, cell };
    return metrics;
  }

  function pos(r, c) {
    const { pad, gap, cell } = metrics;
    return {
      x: pad + c * (cell + gap),
      y: pad + r * (cell + gap),
      cell,
    };
  }

  function ensureScaffold(n) {
    size = n;
    boardEl.innerHTML = "";
    tileEls = new Map();
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${n}, 1fr)`;
    boardEl.style.gap = n >= 7 ? "4px" : n >= 6 ? "6px" : "8px";
    boardEl.style.padding = n >= 7 ? "8px" : "10px";
    boardEl.dataset.size = String(n);
    boardEl.setAttribute("aria-label", `Поле ${n} на ${n}`);
    boardEl.style.position = "relative";

    for (let i = 0; i < n * n; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (n >= 7) cell.classList.add("cell-tiny");
      cell.setAttribute("role", "gridcell");
      boardEl.appendChild(cell);
    }

    tileLayer = document.createElement("div");
    tileLayer.className = "tile-layer";
    tileLayer.style.position = "absolute";
    tileLayer.style.inset = "0";
    tileLayer.style.pointerEvents = "none";
    boardEl.appendChild(tileLayer);
    measure();
  }

  function styleTile(el, value, n) {
    el.className = "tile";
    el.dataset.v = String(Math.min(value, 65536));
    el.textContent = String(value);
    if (n >= 5) el.classList.add("tile-compact");
    if (n >= 6) el.classList.add("tile-tiny");
    if (n >= 8) el.classList.add("tile-micro");
  }

  function render(grid, { animate = true } = {}) {
    const n = grid.length;
    if (!tileLayer || size !== n || boardEl.dataset.size !== String(n)) {
      ensureScaffold(n);
    }
    measure();

    const seen = new Set();
    const { cell } = metrics;

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const tile = grid[r][c];
        if (!tile) continue;
        seen.add(tile.id);
        const { x, y } = pos(r, c);
        let el = tileEls.get(tile.id);

        if (!el) {
          el = document.createElement("div");
          styleTile(el, tile.value, n);
          el.style.width = `${cell}px`;
          el.style.height = `${cell}px`;
          el.style.transform = `translate(${x}px, ${y}px)`;
          tileLayer.appendChild(el);
          tileEls.set(tile.id, el);
          if (animate && tile.newborn) {
            el.classList.add("new");
          }
        } else {
          styleTile(el, tile.value, n);
          el.style.width = `${cell}px`;
          el.style.height = `${cell}px`;
          if (animate) {
            el.style.transition = "transform 120ms ease-in-out";
          } else {
            el.style.transition = "none";
          }
          el.style.transform = `translate(${x}px, ${y}px)`;
          if (tile.merged && animate) {
            el.classList.remove("merge");
            void el.offsetWidth;
            el.classList.add("merge");
          }
        }
      }
    }

    for (const [id, el] of tileEls) {
      if (seen.has(id)) continue;
      el.remove();
      tileEls.delete(id);
    }
  }

  function resize(grid) {
    measure();
    render(grid, { animate: false });
  }

  return { ensureScaffold, render, resize, measure };
}
