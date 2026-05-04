# dgfipParser

Application de bureau **100 % hors-ligne** qui scanne des PDF a la recherche de
la mention **"TOTAL RESTE A PAYER"** suivie d'un montant strictement superieur a
**50 000,00 EUR**, et liste pour chaque fichier les pages concernees.

Aucun appel reseau n'est effectue : les PDF sont lus depuis le disque par le
processus natif Tauri puis analyses dans la webview avec PDF.js.

## Stack

- [Tauri 2](https://tauri.app/) (Rust) pour l'enveloppe native et le glisser-deposer
- [Vue 3](https://vuejs.org/) + Vite + TypeScript pour l'interface
- [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) pour l'extraction de texte
- Vitest pour les tests unitaires de la regle metier

## Prerequis

- Node.js 20+
- Rust stable (cf. [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/))

## Demarrage

```bash
npm install            # deps + copie worker PDF.js, polices standard PDF.js, icones
npm run tauri dev      # lance l'application en mode developpement
```

## Tests

```bash
npm test               # lance les tests Vitest (regex / parser de montants)
```

## Build

```bash
npm run tauri build    # produit un binaire signable dans src-tauri/target/release/bundle/
```

> Les icones generees automatiquement sont des placeholders. Pour produire un
> jeu d'icones complet (incluant `.icns` et `.ico`), utiliser :
> `npx @tauri-apps/cli icon chemin/vers/source.png`.

## Regle metier

- Phrase recherchee : `TOTAL RESTE A PAYER` (insensible aux espaces internes).
- Format de montant accepte : francais avec espace insecable et virgule decimale
  (ex. `50 000,00`, `1 234 567,89`, avec ou sans `EUR`).
- Seuil : montant **strictement superieur** a `50 000,00`.
- Sortie : pour chaque fichier, la liste des pages contenant un montant
  au-dessus du seuil avec la ligne complete et le montant formate.
- Export CSV optionnel des occurrences trouvees.

## Architecture

- `src/lib/pdfParser.ts` : extraction texte par page via PDF.js, regroupement
  des items par coordonnee Y pour reconstituer les lignes visuelles.
- `src/lib/amountParser.ts` : detection de la phrase et parsing des montants
  francais (espace, espace insecable, virgule decimale).
- `src/lib/fileLoader.ts` : pont vers les plugins Tauri `fs` et `dialog`,
  expansion recursive des dossiers vers la liste de PDFs.
- `src/components/DropZone.vue` : zone de glisser-deposer + dialogues fichier
  et dossier.
- `src/components/ResultsList.vue` + `FileResult.vue` : rendu des resultats par
  fichier, export CSV.
