const fs = require('node:fs');

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN não foi definido.');

const request = async (path) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

const escapeXml = (value) => value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
const palette = ['#3572A5', '#f7df1e', '#f37726', '#e34c26', '#563d7c', '#89e051', '#b07219', '#7f52ff', '#6e4c13', '#00ADD8'];
const labels = { 'Jupyter Notebook': 'JUPYTER', JavaScript: 'JAVASCRIPT', Python: 'PYTHON' };
const glyphs = { Python: 'Py', JavaScript: 'JS', 'Jupyter Notebook': 'J', HTML: '5', CSS: '3', Shell: '$_', Java: '☕', Kotlin: 'K' };

(async () => {
  const user = await request('/user');
  const repos = await request('/user/repos?affiliation=owner&per_page=100&sort=updated');
  const totals = {};
  for (const repo of repos.filter((repo) => repo.name !== user.login)) {
    const languages = await request(`/repos/${user.login}/${repo.name}/languages`);
    for (const [language, bytes] of Object.entries(languages)) totals[language] = (totals[language] || 0) + bytes;
  }

  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const totalBytes = rows.reduce((sum, [, bytes]) => sum + bytes, 0);
  const height = 112 + rows.length * 47;
  const rowSvg = rows.map(([language, bytes], index) => {
    const y = 96 + index * 47;
    const color = palette[index % palette.length];
    const percentage = totalBytes ? (bytes / totalBytes) * 100 : 0;
    const width = Math.max(3, Math.round(356 * percentage / 100));
    return `<rect x="36" y="${y}" width="38" height="38" fill="#171b21" stroke="#f0f6fc" stroke-width="3"/><text x="55" y="${y + 26}" text-anchor="middle" fill="${color}" font-size="${glyphs[language]?.length > 2 ? 14 : 18}">${escapeXml(glyphs[language] || language.slice(0, 2).toUpperCase())}</text><text x="88" y="${y + 24}" fill="#f0f6fc">${escapeXml(labels[language] || language.toUpperCase())}</text><rect x="180" y="${y + 2}" width="360" height="30" fill="#010409" stroke="#f0f6fc" stroke-width="3"/><rect x="184" y="${y + 6}" width="${width}" height="22" fill="${color}"/><text x="650" y="${y + 24}" text-anchor="end" fill="#f0f6fc">${percentage.toFixed(1).replace('.', ',')}%</text>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 ${height}" role="img" aria-labelledby="title desc"><title id="title">Barras de linguagens usadas</title><desc id="desc">Distribuição de linguagens de repositórios públicos e privados.</desc><rect width="700" height="${height}" rx="12" fill="#0d1117"/><text x="36" y="46" fill="#f0f6fc" font-family="monospace" font-size="21" font-weight="700">LINGUAGENS UTILIZADAS</text><text x="36" y="71" fill="#8b949e" font-family="monospace" font-size="13">REPOSITÓRIOS PÚBLICOS + PRIVADOS</text><g font-family="monospace" font-size="15" font-weight="700">${rowSvg}</g></svg>\n`;
  fs.writeFileSync('assets/languages-pie.svg', svg);
})();
