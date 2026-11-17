const fs = require('fs');

async function main() {
  const cssUrl = 'https://www.drmehmetunal.com/build/main-CSgIbzFJ.css';
  console.log('Fetching CSS...');
  const res = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const css = await res.text();
  console.log('CSS length:', css.length);

  // Search for female-hologram
  let pos = 0;
  while ((pos = css.indexOf('female-hologram', pos)) !== -1) {
    console.log('--- CSS occurrence at', pos, '---');
    console.log(css.substring(Math.max(0, pos - 200), Math.min(css.length, pos + 400)));
    pos += 'female-hologram'.length;
  }
}

main().catch(console.error);
