const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'frontend', 'javascript', 'pages', 'universities.js');
const content = fs.readFileSync(filePath, 'utf8');

let level = 0;
let stack = [];
let line = 1;
let inString = false;
let stringChar = '';
let inComment = false;
let inLineComment = false;

for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '\n') {
        line++;
        if (inLineComment) inLineComment = false;
        continue;
    }
    if (inLineComment) continue;
    if (inComment) {
        if (ch === '*' && next === '/') { inComment = false; i++; }
        continue;
    }
    if (inString) {
        if (ch === '\\') { i++; continue; }
        if (ch === stringChar) inString = false;
        continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; continue; }
    if (ch === '/' && next === '*') { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }

    if (ch === '{') { level++; stack.push(line); }
    if (ch === '}') { level--; if (stack.length) stack.pop(); }
}

console.log('Final level:', level);
if (level !== 0) {
    console.log('Unclosed braces from lines:', stack.slice(-5));
}
