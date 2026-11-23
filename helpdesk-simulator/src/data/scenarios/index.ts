/**
 * Chargement automatique de tous les scénarios du dossier :
 * pour ajouter un scénario, il suffit de créer un fichier `NN-mon-scenario.ts`
 * qui exporte par défaut `defineScenario({...})`.
 */
import type { ScenarioDef } from '../../tickets/types';

const modules = import.meta.glob<{ default?: ScenarioDef }>('./[0-9]*.ts', { eager: true });

export const SCENARIOS: ScenarioDef[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k].default)
  .filter((s): s is ScenarioDef => !!s && typeof s.inject === 'function');

export function getScenario(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
