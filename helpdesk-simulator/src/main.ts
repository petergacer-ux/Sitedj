/** Point d'entrée : crée le jeu dans #app. */
import './style.css';
import { Game } from './Game';

const container = document.getElementById('app');
if (!container) throw new Error('#app introuvable');

const game = new Game(container);
// Accès depuis la console du navigateur pour le débogage : window.game
(window as unknown as { game: Game }).game = game;
