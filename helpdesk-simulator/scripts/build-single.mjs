/**
 * Construit une version « un seul fichier » du jeu (dist-single/helpdesk-simulator.html) :
 * JS et CSS sont intégrés dans le HTML. Pratique pour héberger le jeu n'importe où
 * ou le jouer sur tablette sans serveur Node.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build', { stdio: 'inherit' });
const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
for (const file of assets) {
  const content = readFileSync(join(dist, 'assets', file), 'utf8');
  if (file.endsWith('.js')) {
    const re = new RegExp(`<script type="module" crossorigin src="\\./assets/${file.replace('.', '\\.')}"></script>`);
    const safe = content.replace(/<\/script/gi, '<\\/script');
    html = html.replace(re, () => `<script type="module">${safe}</script>`);
  } else if (file.endsWith('.css')) {
    const re = new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${file.replace('.', '\\.')}">`);
    html = html.replace(re, () => `<style>${content}</style>`);
  }
}
if (/src="\.\/assets\//.test(html)) throw new Error('Un script n’a pas été intégré');
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/helpdesk-simulator.html', html);
console.log(`dist-single/helpdesk-simulator.html (${Math.round(html.length / 1024)} ko)`);
