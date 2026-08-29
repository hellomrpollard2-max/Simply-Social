const src = require("fs").readFileSync("public/app.js", "utf8");
const stack = [];
let line = 1, i = 0;
const push = (ch) => stack.push({ ch, line });
const pairs = { "}": "{", ")": "(", "]": "[" };
while (i < src.length) {
  const c = src[i];
  if (c === "\n") { line++; i++; continue; }
  if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
  if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
  if (c === '"' || c === "'") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; if (src[i] === "\n") line++; i++; } i++; continue; }
  if (c === "`") { i++; while (i < src.length) {
    const t = src[i];
    if (t === "\\") { i += 2; continue; }
    if (t === "\n") line++;
    if (t === "`") { i++; break; }
    if (t === "$" && src[i + 1] === "{") {
      i += 2; let d = 1;
      while (i < src.length) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { i++; break; } } if (src[i] === "\n") line++; i++; }
      continue;
    }
    i++;
  } continue; }
  if (c === "{" || c === "(" || c === "[") push(c);
  else if (c === "}" || c === ")" || c === "]") {
    const top = stack.pop();
    if (!top || pairs[c] !== top.ch) { console.log("MISMATCH at line", line, "char", c, "top", JSON.stringify(top)); process.exit(0); }
  }
  i++;
}
console.log("unclosed:", stack.map(s => s.ch + "@" + s.line));