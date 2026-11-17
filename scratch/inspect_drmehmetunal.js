async function main() {
  try {
    const res = await fetch('https://www.drmehmetunal.com/en', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);

    // Save HTML to scratch for analysis
    require('fs').writeFileSync('scratch/drmehmetunal.html', html);

    // Search for female-hologram
    let idx = html.indexOf('female-hologram');
    if (idx !== -1) {
      console.log('Found female-hologram at index', idx);
      console.log('Context:\n', html.substring(Math.max(0, idx - 400), Math.min(html.length, idx + 500)));
    } else {
      console.log('female-hologram string not directly in HTML, searching for hologram, canvas, lottie, mesh, three...');
      for (const keyword of ['hologram', 'canvas', 'lottie', 'mesh', 'three', 'shader', 'banner', 'hero']) {
        const matches = [...html.matchAll(new RegExp(keyword, 'gi'))];
        console.log(`Keyword "${keyword}" count:`, matches.length);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
