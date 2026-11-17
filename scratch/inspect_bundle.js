const fs = require('fs');

async function main() {
  const html = fs.readFileSync('scratch/drmehmetunal.html', 'utf8');
  
  // Find all links (css)
  const cssMatches = html.match(/href="[^"]+\.css"/g);
  console.log('CSS links:', cssMatches);

  // Fetch JS bundle
  const jsUrl = 'https://www.drmehmetunal.com/build/site-CYUEYaVf.js';
  console.log('Fetching JS bundle...');
  const res = await fetch(jsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  console.log('JS status:', res.status);
  const js = await res.text();
  console.log('JS length:', js.length);
  fs.writeFileSync('scratch/site-bundle.js', js);

  // Search in JS bundle for female-hologram
  let pos = 0;
  while ((pos = js.indexOf('female-hologram', pos)) !== -1) {
    console.log('--- JS occurrence at', pos, '---');
    console.log(js.substring(Math.max(0, pos - 300), Math.min(js.length, pos + 500)));
    pos += 'female-hologram'.length;
  }
}

main().catch(console.error);
