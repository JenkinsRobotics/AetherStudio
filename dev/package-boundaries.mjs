import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

// A small lexical scanner, not a text search: examples in comments and string
// contents must not become dependency edges. Computed imports are not resolved.
function tokens(source) {
  const result = [];
  const pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g;
  for (const match of source.matchAll(pattern)) {
    const text = match[0];
    if (text.startsWith("//") || text.startsWith("/*")) continue;
    const quote = text[0];
    const literal = ['"', "'", "`"].includes(quote);
    result.push({ text: literal ? text.slice(1, -1) : text, literal,
      computed: quote === "`" && text.includes("${") });
  }
  return result;
}

export function dependencySpecifiers(source, extension = ".ts") {
  if (extension === ".css") {
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
    return [...clean.matchAll(/@import\s+["']([^"']+)["']|url\(\s*["']?([^\s'"\)]+)["']?\s*\)/g)].map(match => match[1] ?? match[2]);
  }
  const list = tokens(source), dependencies = [];
  const is = (i, text) => list[i]?.text === text && !list[i]?.literal;
  const add = i => {
    const token = list[i];
    if (token?.literal && !token.computed) dependencies.push(token.text);
  };
  for (let i = 0; i < list.length; i++) {
    if (is(i, "import") || is(i, "export")) {
      if (is(i + 1, "(")) add(i + 2);
      else if (list[i + 1]?.literal) add(i + 1);
      else if (!is(i + 1, ".")) {
        for (let j = i + 1; j < list.length; j++) {
          if (is(j, ";") || is(j, "import") || is(j, "export")) break;
          if (is(j, "from")) { add(j + 1); break; }
        }
      }
    }
    if (is(i, "require") && is(i + 1, "(")) add(i + 2);
    if (is(i, "new") && is(i + 1, "URL") && is(i + 2, "(") && is(i + 4, ",") && is(i + 5, "import") && is(i + 6, ".") && is(i + 7, "meta")) add(i + 3);
    if (is(i, "import") && is(i + 1, ".") && is(i + 2, "meta") && is(i + 3, ".") && (is(i + 4, "glob") || is(i + 4, "globEager"))) {
      let call = i + 5;
      if (is(call, "<")) {
        let depth = 0;
        do {
          if (is(call, "<")) depth++;
          if (is(call, ">")) depth--;
          call++;
        } while (call < list.length && depth > 0);
      }
      if (is(call, "(")) {
        if (is(call + 1, "[")) {
          for (let j = call + 2; j < list.length && !is(j, "]"); j++) add(j);
        } else add(call + 1);
      }
    }
  }
  return dependencies;
}

const slash = value => value.split(sep).join("/");
const within = (path, root) => path === root || path.startsWith(root + sep);
const excluded = new Set(["node_modules", "dist", "dist-lib", "coverage", ".git", "vendor", " REFERENCE CAD"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

export function scanBoundaries(root, packagePaths) {
  const roots = packagePaths.map(path => resolve(root, path)).sort((a, b) => b.length - a.length);
  const owner = path => roots.find(candidate => within(path, candidate));
  const findings = new Map();
  const visited = new Set();
  function scan(directory) {
    if (visited.has(directory)) return;
    visited.add(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) { if (!excluded.has(entry.name)) scan(path); continue; }
      if (!extensions.has(extname(path))) continue;
      for (const specifier of dependencySpecifiers(readFileSync(path, "utf8"), extname(path))) {
        const value = specifier.startsWith("!") ? specifier.slice(1) : specifier;
        if (!value.startsWith(".")) continue;
        const destination = resolve(dirname(path), value.split(/[?#]/, 1)[0]);
        const from = owner(path), to = owner(destination);
        if (from === to || !from) continue;
        const key = `${slash(relative(root, path))} → ${specifier}`;
        findings.set(key, (findings.get(key) ?? 0) + 1);
      }
    }
  }
  roots.forEach(scan);
  return Object.fromEntries([...findings.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function compareBoundaries(actual, baseline) {
  return {
    added: Object.keys(actual).filter(key => actual[key] > (baseline[key] ?? 0)),
    removed: Object.keys(baseline).filter(key => (actual[key] ?? 0) < baseline[key]),
  };
}
