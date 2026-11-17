const fs = require('fs');
const js = fs.readFileSync('scratch/site-bundle.js', 'utf8');
let idx = 0;
while ((idx = js.indexOf('.female-hologram', idx)) !== -1) {
  console.log('CSS in JS at', idx, ':\n', js.substring(Math.max(0, idx - 100), Math.min(js.length, idx + 400)));
  idx += '.female-hologram'.length;
}
