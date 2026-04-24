const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', 'frontend', 'javascript');
const errors = [];

function findJsFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...findJsFiles(full));
        else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
}

function getExportsFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();

    // export function/class/const/let/var NAME
    const namedFnExports = content.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([a-zA-Z_$][\w$]*)/gm);
    for (const m of namedFnExports) exports.add(m[1]);

    // export { name1, name2 as alias2, ... }
    const reExports = content.matchAll(/export\s*\{([^}]+)\}/g);
    for (const match of reExports) {
        const rawItems = match[1].split(',');
        for (const rawItem of rawItems) {
            // Remove comments (both // and /* */)
            const cleanItem = rawItem.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim();
            if (!cleanItem) continue;

            const aliasMatch = cleanItem.match(/([a-zA-Z_$][\w$]*)\s+as\s+([a-zA-Z_$][\w$]*)/);
            const symbolMatch = cleanItem.match(/^([a-zA-Z_$][\w$]*)$/);
            if (aliasMatch) exports.add(aliasMatch[2]);
            else if (symbolMatch) exports.add(symbolMatch[1]);
        }
    }

    // export default
    if (/^export\s+default\s/m.test(content)) exports.add('default');

    return exports;
}

const files = findJsFiles(rootDir);
const exportCache = new Map();

// Pre-cache all exports
for (const f of files) exports; // warm up
for (const f of files) {
    exportCache.set(f, getExportsFromFile(f));
}

// Now check all imports
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Match all imports
    const importRegex = /import\s+(?:\{([^}]+)\}|(\w+)|(\w+)\s+as\s+(\w+))\s+from\s+['"](.+?)['"]/gs;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const namedPart = match[1];
        const defaultPart = match[2];
        const specifier = match[5];

        if (!specifier.startsWith('.')) continue;

        const dir = path.dirname(file);
        let resolved = path.resolve(dir, specifier);
        if (!path.extname(resolved)) resolved += '.js';
        if (!fs.existsSync(resolved)) continue;

        const exports = exportCache.get(resolved) || getExportsFromFile(resolved);
        exportCache.set(resolved, exports);

        if (namedPart) {
            const importedNames = namedPart.split(',').map(s => s.trim().replace(/\s+as\s+\w+/, '').trim()).filter(Boolean);
            for (const name of importedNames) {
                if (!exports.has(name)) {
                    errors.push({
                        file: path.relative(path.join(__dirname, '..'), file),
                        line: content.substring(0, match.index).split('\n').length,
                        name,
                        from: path.relative(path.join(__dirname, '..'), resolved),
                        available: [...exports].sort()
                    });
                }
            }
        }
    }
}

if (errors.length === 0) {
    console.log('✅ All named imports are valid!');
} else {
    console.log(`❌ Found ${errors.length} invalid named import(s):\n`);
    for (const e of errors) {
        console.log(`  [${e.file}:${e.line}] import { ${e.name} } from '...'`);
        console.log(`    Source: ${e.from}`);
        const similar = e.available.filter(n => n.toLowerCase().includes(e.name.toLowerCase().slice(0,4)));
        if (similar.length) console.log(`    Similar exports: ${similar.join(', ')}`);
        else console.log(`    Exports in source: ${e.available.slice(0,5).join(', ')}${e.available.length > 5 ? '...' : ''}`);
        console.log();
    }
}
