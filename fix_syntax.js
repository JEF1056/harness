const fs = require('fs');
const files = ['index.ts', 'plan.ts', 'debug.ts'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Replace escaped backticks with actual backticks
  content = content.replace(/\\`/g, '`');
  // Replace escaped dollar-braces with actual dollar-braces
  content = content.replace(/\\\${/g, '${');
  fs.writeFileSync(file, content);
}
console.log('Fixed syntax errors');
