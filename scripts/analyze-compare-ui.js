const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'javascript', 'pages', 'universities', 'compare-ui.js'), 'utf8');

// Find all uses of $
const uses = (content.match(/\$\s*\(/g) || []);
console.log('Dollar sign uses:', uses.length);

// Find all symbols imported from compare-engine.js
const engineImportMatch = content.match(/from\s+["']\.\/compare-engine\.js["']/);
if (engineImportMatch) {
    const start = content.lastIndexOf('import', content.indexOf(engineImportMatch[0]));
    const block = content.substring(start, content.indexOf('}', start) + 50);
    console.log('\nCompare-engine imports block:\n', block.substring(0, 500));
}

// Check which of the missing symbols are actually used
const missing = ['compareBestBadges', 'getTrackFundingType', 'trTrackDescription', 'aiName', 'chanceTone', 'trTrackLabel', '$', 'normalizeStudyModeForCost'];
for (const sym of missing) {
    const regex = new RegExp(`\\b${sym}\\b`);
    const count = (content.match(new RegExp(`\\b${sym}\\b`, 'g')) || []).length;
    console.log(`\n${sym}: used ${count} times`);
}
