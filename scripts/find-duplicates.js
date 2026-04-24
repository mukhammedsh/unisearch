const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'frontend', 'javascript', 'pages', 'universities.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
const counts = {};

lines.forEach((line, i) => {
    const match = line.match(/^\s*(?:const|let|var|function)\s+(\w+)/);
    if (match) {
        const name = match[1];
        if (counts[name]) {
            console.log(`Potential duplicate declaration: "${name}" at lines ${counts[name].line} and ${i + 1}`);
        }
        counts[name] = { line: i + 1 };
    }
});
