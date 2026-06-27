const fs = require('fs');

function fixLine(file, lineNum, fixes) {
    let lines = fs.readFileSync(file, 'utf8').split('\n');
    let line = lines[lineNum - 1];
    for (const [bad, good] of fixes) {
        line = line.replace(bad, good);
    }
    lines[lineNum - 1] = line;
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

// index.ts
fixLine('index.ts', 59, [['\\`;', '`;']]);
fixLine('index.ts', 155, [['\\`\\${', '`${'], ['\\`;', '`;']]);
fixLine('index.ts', 191, [['\\`#', '`#'], ['\\`);', '`);'], [/\\\${/g, '${'], [/\\n/g, '\\n']]);
fixLine('index.ts', 192, [['\\`#', '`#'], ['\\`);', '`);'], [/\\\${/g, '${'], [/\\n/g, '\\n']]);
fixLine('index.ts', 208, [['return \\`', 'return `'], ['\\`;', '`;'], [/\\\${/g, '${']]);
fixLine('index.ts', 302, [['\\`\\n', '`\\n'], ['\\` :', '` :'], [/\\\${/g, '${']]);
fixLine('index.ts', 323, [['\\`;', '`;']]);
fixLine('index.ts', 338, [['overrideResponse: \\`Questionnaire', 'overrideResponse: `Questionnaire'], ['now...\\`,', 'now...`,']]);

// plan.ts
fixLine('plan.ts', 80, [['text: \\`\\${', 'text: `${'], ['\\`,', '`,']]);
fixLine('plan.ts', 80, [[/\\n/g, '\\n'], [/\\\${/g, '${']]); // second pass for ${}
fixLine('plan.ts', 64, [['\\`;', '`;']]);

// debug.ts
fixLine('debug.ts', 41, [['\\`;', '`;']]);
fixLine('debug.ts', 51, [['text: \\`\\${', 'text: `${'], ['\\`,', '`,']]);
fixLine('debug.ts', 51, [[/\\n/g, '\\n'], [/\\\${/g, '${']]); // second pass for ${}
fixLine('debug.ts', 78, [['return \\`[', 'return `['], ['\\`;', '`;'], [/\\\${/g, '${']]);
fixLine('debug.ts', 82, [['return \\`No', 'return `No'], ['\\`;', '`;'], [/\\\${/g, '${']]);

console.log("Lines precisely fixed.");
