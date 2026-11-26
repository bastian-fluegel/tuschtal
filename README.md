# Tuschtal

Ein gemütliches Überlebensspiel im Tusche- und Aquarell-Stil. Läuft im Browser (Three.js r128, ES-Module, kein Build-Schritt).

## Starten
Module brauchen einen Webserver (Doppelklick auf index.html reicht nicht):

    cd tuschtal
    python -m http.server 8000

Dann http://localhost:8000 öffnen.

## Module (js/)
| Datei | Aufgabe |
|---|---|
| config.js | Spielname, Balancing, Konstanten |
| state.js | gemeinsamer Zustand: G (Flags), pos, Zeit T, Werte S, Vorrat INV |
| noise.js / terrain.js | Rauschen, Landschaftshöhe und -farbe |
| shaders.js | Tusche-Aquarell-Look, Tag/Nacht, Lichter |
| geometry.js | Bausteine (Box, Kegel …) und merge() |
| nature.js | Bäume, Büsche, Felsen, Früchte |
| pieces.js | Bauteil-Katalog – neue Teile hier eintragen |
| engine.js | Renderer, Kamera, Himmel, Wasser, Vorschaubilder |
| world.js | Chunks laden/entladen, Pflanzen und Früchte |
| house.js | Starthäuschen mit Garten |
| building.js | Bauen, Abreißen, Rückgängig, Speichern |
| player.js | Bewegung und Kollision |
| survival.js | Werte, Zeit, Aktionen, Schlafen, Ohnmacht, Spielstand |
| daynight.js | Sonnenstand, Licht, Feuer, Rauch |
| fauna.js | Rehe, Hasen, Vögel, Schmetterlinge, Glühwürmchen, Fische |
| audio.js | synthetische Geräusche (Web Audio) |
| input.js | Touch, Maus, Tastatur |
| ui.js | HUD, Titel, Menü, Tutorial, Bau-Leiste |
| main.js | Start und Spielschleife |
| features.js | Andockpunkte (Hooks) für abschaltbare Module |

## Module (js/features/) – abschaltbar
In `config.js`: `FEATURES = { cooking: true, crafting: true }`. Auf `false` gesetzt, wird das Modul gar nicht geladen.

| Modul | Inhalt |
|---|---|
| cooking.js | Pilze, Kräuter, Angeln, Wasser schöpfen, Kochstelle mit Spieß/Topf/Pfanne, 12 Rezepte, Rezeptbuch, Haltbarkeit |
| crafting.js | Steine, Fasern, Lehm, Bretter, Seil, Werkbank, 6 Werkzeuge mit Effekten, 15 Möbel, Truhe, Rucksack-Plätze |

Ein neues Modul: Datei in `js/features/` anlegen, ein Objekt mit Hooks exportieren (siehe Kopf von features.js) und in main.js wie cooking registrieren.

## Erweitern
- Neues Rezept: Eintrag in `RECIPES` (features/cooking.js).
- Neues Möbelstück: Eintrag in `FURNITURE`, neues Werkzeug: Eintrag in `TOOLS` (features/crafting.js).
- Werkzeug-Effekte wirken über `MODS` (state.js) – jedes Modul darf sie lesen.
- Neues rohes Lebensmittel: `ITEMS` + `FOODS` in config.js.
- Neues Bauteil: Eintrag in `PIECES` (pieces.js). `use: 'sleep' | 'drink' | 'fire'` macht es benutzbar.
- Neuer Wert (z. B. Laune): in `STATS` (config.js) und `S` (state.js) ergänzen, Verlauf in `tickLife` (survival.js).
- Neues Tier: Geometrie in `GEO_A` (fauna.js), Verhalten in `updateAnimals`.
