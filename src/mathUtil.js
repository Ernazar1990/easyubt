// Word (OMML) → LaTeX түрлендіруден шыққан формулаларды KaTeX түсінетін түрге келтіру.
const SYM = {
  "≠": "\\neq", "≈": "\\approx", "≡": "\\equiv", "∑": "\\sum", "∫": "\\int",
  "→": "\\to", "⇌": "\\rightleftharpoons", "↔": "\\leftrightarrow", "↑": "\\uparrow", "↓": "\\downarrow",
  "−": "-", "+": "+", "=": "=", "(": "(", ")": ")", "[": "[", "]": "]", ",": ",", "∘": "\\circ", "⋅": "\\cdot", "×": "\\times",
};
export function fixTex(tex) {
  let t = String(tex);
  t = t.replace(/\\mspace\{(-?\d+)mu\}/g, "\\mkern$1mu ");
  // \text{X}, мұндағы X — жалғыз математикалық таңба: \text ішінде KaTeX қолдамайтын таңбалар үшін
  t = t.replace(/\\text\{([^{}\\])\}/g, (m, c) => (SYM[c] !== undefined ? SYM[c] + " " : m));
  return t;
}
export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}
