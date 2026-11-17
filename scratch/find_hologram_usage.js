const fs = require('fs');
const html = fs.readFileSync('scratch/drmehmetunal.html', 'utf8');

// Find all occurrences of female-hologram
let pos = 0;
while ((pos = html.indexOf('female-hologram', pos)) !== -1) {
  console.log('--- Occurrence at', pos, '---');
  console.log(html.substring(Math.max(0, pos - 200), Math.min(html.length, pos + 300)));
  pos += 'female-hologram'.length;
}

// Find scripts or bundle files referenced in HTML
const scriptSrcs = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
console.log('\nScript URLs:', scriptSrcs);
