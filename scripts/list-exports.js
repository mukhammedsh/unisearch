const fs = require('fs');
const path = require('path');

function getExports(relPath) {
    const filePath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();
    for (const m of content.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm)) exports.add(m[1]);
    for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (const item of m[1].split(',').map(s => s.trim())) {
            const asMatch = item.match(/\w+\s+as\s+(\w+)/);
            const plain = item.match(/^(\w+)$/);
            if (asMatch) exports.add(asMatch[1]);
            else if (plain) exports.add(plain[1]);
        }
    }
    return [...exports].sort();
}

console.log('\n=== utils.js ===');
console.log(getExports('frontend/javascript/utils.js').join('\n'));

console.log('\n=== _shared.js ===');
console.log(getExports('frontend/javascript/pages/_shared.js').join('\n'));

console.log('\n=== university-translations.js ===');
console.log(getExports('frontend/javascript/university-translations.js').join('\n'));

console.log('\n=== compare-engine.js ===');
console.log(getExports('frontend/javascript/pages/universities/compare-engine.js').join('\n'));
