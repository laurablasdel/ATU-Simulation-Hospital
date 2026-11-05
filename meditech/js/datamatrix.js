/*
 * Data Matrix (ECC 200) barcodes — the small square 2D code printed on unit-dose blister
 * packs and vials. Used by labels.html for small medication labels and wristbands.
 * Square symbols 10×10 to 26×26 (up to 44 codewords), ASCII encodation, Reed-Solomon
 * error correction, module placement per ISO/IEC 16022 Annex F.
 *
 *   DataMatrix.matrix('12345678')  →  array of rows of booleans (true = dark), no quiet zone
 *   DataMatrix.svg('12345678')     →  <svg> with a 1-module quiet zone; size it with CSS
 */
(function () {
  'use strict';
  // [symbol size, data codewords, error-correction codewords]
  const SIZES = [[10, 3, 5], [12, 5, 7], [14, 8, 10], [16, 12, 12], [18, 18, 14], [20, 22, 18], [22, 30, 20], [24, 36, 24], [26, 44, 28]];

  // GF(256) with the Data Matrix polynomial x^8 + x^5 + x^3 + x^2 + 1 (301).
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 301; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function encodeAscii(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i), n = text.charCodeAt(i + 1);
      if (c >= 48 && c <= 57 && n >= 48 && n <= 57) { out.push(130 + (c - 48) * 10 + (n - 48)); i++; }
      else if (c < 128) out.push(c + 1);
      else if (c < 256) out.push(235, c - 127);
      else throw new Error('Data Matrix: unsupported character');
    }
    return out;
  }

  function reedSolomon(data, n) {
    // Generator polynomial (x - a^1)(x - a^2)...(x - a^n), highest power first.
    let g = [1];
    for (let i = 1; i <= n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
      g = next;
    }
    const ecc = new Array(n).fill(0);
    data.forEach(d => {
      const k = d ^ ecc[0];
      for (let j = 0; j < n - 1; j++) ecc[j] = ecc[j + 1] ^ mul(g[j + 1], k);
      ecc[n - 1] = mul(g[n], k);
    });
    return ecc;
  }

  // ISO/IEC 16022 Annex F: where each bit of each codeword goes in the data region.
  function placement(nrow, ncol) {
    const a = new Array(nrow * ncol).fill(0);
    const module = (row, col, chr, bit) => {
      if (row < 0) { row += nrow; col += 4 - ((nrow + 4) % 8); }
      if (col < 0) { col += ncol; row += 4 - ((ncol + 4) % 8); }
      a[row * ncol + col] = 10 * chr + bit;
    };
    const utah = (r, c, chr) => {
      module(r - 2, c - 2, chr, 1); module(r - 2, c - 1, chr, 2); module(r - 1, c - 2, chr, 3); module(r - 1, c - 1, chr, 4);
      module(r - 1, c, chr, 5); module(r, c - 2, chr, 6); module(r, c - 1, chr, 7); module(r, c, chr, 8);
    };
    const corner = (cells, chr) => cells.forEach((rc, i) => module(rc[0], rc[1], chr, i + 1));
    let chr = 1, row = 4, col = 0;
    do {
      if (row === nrow && col === 0) corner([[nrow - 1, 0], [nrow - 1, 1], [nrow - 1, 2], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]], chr++);
      if (row === nrow - 2 && col === 0 && ncol % 4) corner([[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 4], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1]], chr++);
      if (row === nrow - 2 && col === 0 && ncol % 8 === 4) corner([[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]], chr++);
      if (row === nrow + 4 && col === 2 && !(ncol % 8)) corner([[nrow - 1, 0], [nrow - 1, ncol - 1], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 3], [1, ncol - 2], [1, ncol - 1]], chr++);
      do { if (row < nrow && col >= 0 && !a[row * ncol + col]) utah(row, col, chr++); row -= 2; col += 2; } while (row >= 0 && col < ncol);
      row += 1; col += 3;
      do { if (row >= 0 && col < ncol && !a[row * ncol + col]) utah(row, col, chr++); row += 2; col -= 2; } while (row < nrow && col >= 0);
      row += 3; col += 1;
    } while (row < nrow || col < ncol);
    if (!a[nrow * ncol - 1]) { a[nrow * ncol - 1] = 1; a[nrow * ncol - ncol - 2] = 1; }
    return a;
  }

  function matrix(text) {
    const data = encodeAscii(String(text));
    const spec = SIZES.find(s => s[1] >= data.length);
    if (!spec) throw new Error('Data Matrix: text too long');
    const size = spec[0], nd = spec[1], ne = spec[2];
    // Pad: 129, then pseudo-random pad codewords.
    for (let i = data.length; i < nd; i++) {
      if (i === data.length) { data.push(129); continue; }
      let v = 129 + ((149 * (i + 1)) % 253) + 1;
      if (v > 254) v -= 254;
      data.push(v);
    }
    const cw = data.concat(reedSolomon(data, ne));
    const n = size - 2;
    const map = placement(n, n);
    const rows = [];
    for (let r = 0; r < size; r++) {
      const line = [];
      for (let c = 0; c < size; c++) {
        let dark;
        if (c === 0 || r === size - 1) dark = true;                  // solid "L" finder
        else if (r === 0) dark = c % 2 === 0;                        // top timing row
        else if (c === size - 1) dark = r % 2 === 1;                 // right timing column
        else {
          const v = map[(r - 1) * n + (c - 1)];
          dark = v === 1 ? true : v < 10 ? false : !!((cw[Math.floor(v / 10) - 1] >> (8 - (v % 10))) & 1);
        }
        line.push(dark);
      }
      rows.push(line);
    }
    return rows;
  }

  function svg(text, cls) {
    const m = matrix(text), q = 1, s = m.length + 2 * q;
    let path = '';
    m.forEach((line, r) => line.forEach((d, c) => { if (d) path += `M${c + q} ${r + q}h1v1h-1z`; }));
    return `<svg class="${cls || 'dm'}" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Data Matrix ${String(text).replace(/[<&"]/g, '')}"><rect width="${s}" height="${s}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  window.DataMatrix = { matrix, svg };
})();
