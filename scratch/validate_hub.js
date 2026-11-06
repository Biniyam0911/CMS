const fs = require('fs');
const content = fs.readFileSync('docs/interactive_dev_hub.html', 'utf8');

// Check JSON blocks
const docsJson = content.match(/<script id="docs-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
const codeFilesJson = content.match(/<script id="code-files-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
const errorsJson = content.match(/<script id="errors-data" type="application\/json">([\s\S]*?)<\/script>/)[1];

console.log('Docs JSON parsed count:', Object.keys(JSON.parse(docsJson)).length);
console.log('CodeFiles JSON parsed count:', JSON.parse(codeFilesJson).length);
console.log('Errors JSON parsed count:', JSON.parse(errorsJson).length);

// Check main script
const mainScript = content.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
try {
  new Function(mainScript);
  console.log('Main Script Syntax: 100% VALID & ERROR-FREE!');
} catch(e) {
  console.error('Main Script Syntax Error:', e);
  process.exit(1);
}
