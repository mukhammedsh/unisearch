import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const iconsFile = path.join(frontendDir, "javascript", "icons.js");
const heroiconsDir = path.join(rootDir, "node_modules", "@heroicons", "react", "24", "outline");

const SOURCE_ICON_PATTERNS = [
  /heroIcon\("([^"]+)"/g,
  /renderInlineIcon\("([^"]+)"/g,
  /renderUniPill\("([^"]+)"/g,
  /renderScholarshipLine\("([^"]+)"/g,
  /setHeroIcon\([^,]+,\s*"([^"]+)"/g,
  /data-heroicon="([^"]+)"/g,
];

const EXISTING_ICON_PATTERN = /^\s{2}"([^"]+)":/gm;

const MANUAL_ICON_NAMES = ["sun"];

function kebabToPascalCase(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function attrNameFromProp(prop) {
  if (prop === "className") return "class";
  if (prop === "viewBox") return "viewBox";
  if (prop === "xmlnsXlink") return "xmlns:xlink";
  if (prop === "xmlSpace") return "xml:space";
  if (prop.includes("-")) return prop;
  return prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function attrString(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, "&quot;")}"`)
    .join(" ");
}

function serializeNode(node) {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);

  const attrs = attrString(
    Object.fromEntries(
      Object.entries(node.props || {})
        .filter(([key, value]) => key !== "ref" && value !== null && value !== undefined && value !== false)
        .map(([key, value]) => [attrNameFromProp(key), value]),
    ),
  );
  const children = Array.isArray(node.children) ? node.children.map(serializeNode).join("") : "";
  if (!children) {
    return `<${node.type}${attrs ? ` ${attrs}` : ""} />`;
  }
  return `<${node.type}${attrs ? ` ${attrs}` : ""}>${children}</${node.type}>`;
}

function createReactStub() {
  return {
    createElement(type, props, ...children) {
      return {
        type,
        props: props || {},
        children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false),
      };
    },
    forwardRef(fn) {
      return fn;
    },
  };
}

async function evaluateHeroicon(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const React = createReactStub();
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    Object,
    require(specifier) {
      if (specifier === "react") return React;
      throw new Error(`Unsupported require in ${filePath}: ${specifier}`);
    },
  });

  new vm.Script(source, { filename: filePath }).runInContext(context);
  const component = module.exports;
  if (typeof component !== "function") {
    throw new Error(`Expected a component function from ${filePath}`);
  }

  const tree = component({}, null);
  if (!tree || tree.type !== "svg") {
    throw new Error(`Expected ${filePath} to render an SVG root`);
  }

  const attrs = Object.fromEntries(
    Object.entries(tree.props || {})
      .filter(([key, value]) => key !== "ref" && value !== null && value !== undefined && value !== false)
      .map(([key, value]) => [attrNameFromProp(key), value]),
  );
  const body = (tree.children || []).map(serializeNode).join("");

  return { attrs, body };
}

async function walkFiles(dirPath) {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const dirent of dirents) {
    const fullPath = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...await walkFiles(fullPath));
      continue;
    }
    if (/\.(html|js)$/i.test(dirent.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function collectIconNames() {
  const names = new Set(MANUAL_ICON_NAMES);
  const files = await walkFiles(frontendDir);

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!content) continue;
    for (const pattern of SOURCE_ICON_PATTERNS) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const iconName = String(match[1] || "").trim();
        if (iconName) names.add(iconName);
      }
      pattern.lastIndex = 0;
    }
  }

  const existingIconsContent = await fs.readFile(iconsFile, "utf8").catch(() => "");
  if (existingIconsContent) {
    let match;
    while ((match = EXISTING_ICON_PATTERN.exec(existingIconsContent)) !== null) {
      const iconName = String(match[1] || "").trim();
      if (iconName) names.add(iconName);
    }
    EXISTING_ICON_PATTERN.lastIndex = 0;
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function generatedFile(icons) {
  return `// Auto-generated from @heroicons/react 24/outline by scripts/sync-heroicons.mjs.
// Do not edit by hand; run \`npm run sync:heroicons\`.

const ICONS = ${JSON.stringify(icons, null, 2)};

function attrString(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => \`\${key}="\${String(value).replace(/"/g, "&quot;")}"\`)
    .join(" ");
}

export function heroIcon(name, className = "", attributes = {}) {
  const entry = ICONS[name];
  if (!entry) return "";

  const attrs = attrString({
    ...entry.attrs,
    class: className || null,
    ...attributes,
  });

  return \`<svg \${attrs}>\${entry.body}</svg>\`;
}

export function setHeroIcon(element, name, className = "", attributes = {}) {
  if (!element) return;
  element.innerHTML = heroIcon(name, className, attributes);
}

export function hydrateHeroIcons(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("[data-heroicon]").forEach((node) => {
    const name = String(node.getAttribute("data-heroicon") || "").trim();
    const size = String(node.getAttribute("data-icon-size") || "").trim();
    const extraClass = String(node.getAttribute("data-icon-class") || "").trim();
    const classes = ["ui-icon"];
    if (size) classes.push(\`ui-icon--\${size}\`);
    if (extraClass) classes.push(extraClass);
    node.innerHTML = heroIcon(name, classes.join(" "));
  });
}

export function stripLeadingDecorations(text) {
  return String(text || "")
    .replace(/^[^\\p{L}\\p{N}]+/u, "")
    .trim();
}
`;
}

async function main() {
  const iconNames = await collectIconNames();
  const icons = {};

  for (const iconName of iconNames) {
    const componentName = `${kebabToPascalCase(iconName)}Icon.js`;
    const componentPath = path.join(heroiconsDir, componentName);
    try {
      await fs.access(componentPath);
    } catch {
      throw new Error(`Missing Heroicon component for "${iconName}": ${componentName}`);
    }

    icons[iconName] = await evaluateHeroicon(componentPath);
  }

  await fs.writeFile(iconsFile, generatedFile(icons), "utf8");
  process.stdout.write(`Synced ${iconNames.length} Heroicons to ${path.relative(rootDir, iconsFile)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
