const fs = require('fs');
const files = ['index.ts', 'plan.ts', 'debug.ts'];

for (const file of files) {
  let buf = fs.readFileSync(file);
  let content = buf.toString('utf8');
  
  // Replace escaped backticks with actual backticks
  content = content.replace(/\\`/g, '`');
  // Replace escaped dollar-braces with actual dollar-braces
  content = content.replace(/\\\${/g, '${');
  
  // Remove non-ascii characters (fixes corrupted emojis throwing TS1127)
  content = content.replace(/[^\x00-\x7F]/g, "");
  
  fs.writeFileSync(file, content, 'utf8');
}
console.log('Fixed syntax errors and removed corrupted emojis.');
