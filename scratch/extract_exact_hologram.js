const fs = require('fs');
const js = fs.readFileSync('scratch/site-bundle.js', 'utf8');

// Find the start and end of the component
const start = js.lastIndexOf('function', 290375);
const end = js.indexOf('function Os', 290375);

console.log('Function start:', start, 'end:', end);
const code = js.substring(start, end);
fs.writeFileSync('scratch/extracted_hologram_component.js', code);
console.log('Extracted code length:', code.length);
console.log(code);
