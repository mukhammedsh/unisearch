const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', 'frontend', 'javascript');
const errors = [];
const warnings = [];

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

const files = findJsFiles(rootDir);

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match import statements
        const importMatch = line.match(/^\s*import\s+.*?\s+from\s+['"](.+?)['"]/);
        if (!importMatch) continue;

        const specifier = importMatch[1];

        // Skip node_modules / bare specifiers
        if (!specifier.startsWith('.')) continue;

        const dir = path.dirname(file);
        let resolved = path.resolve(dir, specifier);

        // If no extension, try .js
        if (!path.extname(resolved)) {
            resolved = resolved + '.js';
        }

        if (!fs.existsSync(resolved)) {
            errors.push({
                file: path.relative(path.join(__dirname, '..'), file),
                line: i + 1,
                specifier,
                resolved: path.relative(path.join(__dirname, '..'), resolved)
            });
        }
    }
}

if (errors.length === 0) {
    console.log('✅ All relative imports resolve correctly!');
} else {
    console.log(`❌ Found ${errors.length} broken import(s):\n`);
    for (const e of errors) {
        console.log(`  [${e.file}:${e.line}]`);
        console.log(`    import from '${e.specifier}'`);
        console.log(`    → Resolved: ${e.resolved}`);
        console.log();
    }
}
