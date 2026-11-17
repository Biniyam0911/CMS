const fs = require('fs');
const code = fs.readFileSync('scratch/extracted_hologram_component.js', 'utf8');

// Use prettier or simple formatter
try {
  // Simple beautify
  let indent = 0;
  let formatted = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{' || ch === ';') {
      formatted += ch + '\n' + '  '.repeat(indent + (ch === '{' ? 1 : 0));
      if (ch === '{') indent++;
    } else if (ch === '}') {
      indent = Math.max(0, indent - 1);
      formatted += '\n' + '  '.repeat(indent) + ch + '\n' + '  '.repeat(indent);
    } else {
      formatted += ch;
    }
  }
  fs.writeFileSync('scratch/beautified_hologram.js', formatted);
  console.log('Beautified length:', formatted.length);
} catch (e) {
  console.error(e);
}
