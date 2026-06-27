const fs = require('fs');

let lines = fs.readFileSync('index.ts', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    // AGENT_PROMPTS is roughly from line 60 to 126. We skip those.
    if (i >= 60 && i <= 126) continue;

    // Replace escaped template literal syntax
    lines[i] = lines[i].replace(/\\`/g, '`');
    lines[i] = lines[i].replace(/\\\${/g, '${');
    lines[i] = lines[i].replace(/\\n/g, '\\n');
}

fs.writeFileSync('index.ts', lines.join('\n'), 'utf8');
console.log('Fixed index.ts successfully!');
