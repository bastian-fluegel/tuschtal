# CLAUDE.md – Tuschtal

Diese Datei liest jede Claude-Code-Sitzung beim Start. Sie hält fest, was entschieden ist.

## Arbeitsweise mit Bastian
- Sprache: Deutsch, Du-Form. Ton ruhig, warm, direkt.
- Antwort zuerst, Rückfragen selten und höchstens eine auf einmal.
- Bei Entscheidungen: abwägen, klare Tendenz nennen, eine hilfreiche Gegenfrage.
- Ehrlich sagen, was wackelt oder ungetestet ist. Nichts erfinden.
- Struktur hilft: Listen, Tabellen, kurze Abschnitte.
- „Ganz oder gar nicht“: Ein Feature wird vollständig gebaut, nicht als halber Platzhalter.

## Das Spiel
Tuschtal ist ein gemütliches Überlebensspiel in einer endlosen Landschaft im Stil von Tusche und Aquarell.
- Keine Monster, keine Würfelwelt. Bauen ist Nebensache, Überleben steht im Mittelpunkt.
- Vier Werte: Essen, Trinken, Energie, Wärme. Tag und Nacht (1 Spieltag = 16 Minuten).
- Das Häuschen mit Bett, Kamin, Werkbank und Brunnen ist der Anker. Tiere (Rehe, Hasen, Vögel, Insekten, Fische) fliehen, wenn man auf sie zuläuft.
- Läuft auf dem Handy (Touch, Joystick) und am Computer (WASD, Maus, Tasten auf den Knöpfen).

## Technik und Architektur
- Three.js r128 (UMD von cdnjs), reine ES-Module, **kein Build-Schritt**, keine Abhängigkeiten.
- Lokal testen: `python -m http.server 8000` → http://localhost:8000
- Gemeinsamer Zustand liegt in `js/state.js` (`G` für Flags, `pos`, `T` Zeit, `S` Werte, `INV` Vorrat, `MODS` Modifikatoren, `give()` für den Rucksack).
- Einstellbares (Name, Balancing, Items, Essen, Kategorien, FEATURES) liegt in `js/config.js`.
- **Kern plus abschaltbare Module.** Module liegen in `js/features/`, werden in `main.js` dynamisch geladen und in `config.js` über `FEATURES` ein- und ausgeschaltet.
- Module docken nur über die Hooks in `js/features.js` an (`init`, `update`, `chunk`, `override`, `fireActions`, `waterActions`, `pieceActions`, `newDay`, `reset`). Der Kern kennt keine Module.
- Module tragen ihre Daten selbst ein (ITEMS, FOODS, PIECES) und bringen eigenes CSS, eigene Fenster (`.sheet.feature`) und eigenen Hilfetext mit.
- Bauteile: Einträge in `PIECES` (`js/pieces.js`). `use: 'sleep' | 'drink' | 'fire' | 'craft' | 'store'`, `fine: true` für das halbe Raster, `sink: true` für Teile, die in den Hang sinken dürfen, `costItems` für Möbel aus dem Rucksack.
- Gerät: `DEVICE` und `QUALITY` in `config.js` (Handy, Tablet, Computer; erzwingen mit `?geraet=handy|tablet|pc`). `device.js` passt die Bildschärfe der Bildrate an, hält den Bildschirm an, bietet Vollbild und pausiert beim Verlassen. Am Computer wird die Maus gefangen (`input.js`), am Handy rennt man mit weit gezogenem Joystick.
- Spielstände liegen in localStorage (Schlüssel `aquarellwelt-*`, bewusst beibehalten, damit alte Spielstände weiter funktionieren).

## Regeln für Änderungen
- Neue Spielsysteme als Modul in `js/features/` bauen, nicht in den Kern schreiben. Wenn ein Modul einen neuen Andockpunkt braucht, den Hook in `features.js` ergänzen und dokumentieren.
- Jedes Modul muss mit `FEATURES.<name> = false` sauber wegfallen. Alle Kombinationen testen.
- Module dürfen sich nicht gegenseitig voraussetzen. Fehlt ein Item eines anderen Moduls, wird das Rezept bzw. Werkzeug ausgeblendet (siehe `needsItem` in crafting.js).
- Kreisimporte vermeiden, die auf oberster Ebene Werte nutzen. DOM-Verdrahtung gehört in `init`-Funktionen.
- Ton immer über `audio.js` (`burst`, `sfx`), das prüft selbst, ob der Ton läuft.
- Deutsche Kommentare und Texte, Satzanfang groß, keine Emojis in der Oberfläche.

## Stil
- **Lesbarkeit vor Kunst.** Kein Post-Processing (wurde ausprobiert: wirkte verschwommen und wurde entfernt).
- Der Aquarell-Look entsteht in den Shadern (`js/shaders.js`): Pigmentflecken, ausgesparte Papierstellen, kühle Schatten, zarte Schraffur, Tusche-Konturen (Inverted Hull), Nebel ins Papier.
- Stämme, dunkle Teile und Tiere bekommen kaum Farbflecken (`uBlotch`, Helligkeitsregel). Der Boden bleibt ruhiger als das, was darauf steht.
- Oberfläche: Papier #efe6d2, Tusche #2b2622, Indigo #3f5f8a, Ocker #efd29b, Schriften Caveat und Patrick Hand, handgezeichnet wirkende Ränder.

## Stand (November 2026)
- Fertig: Welt, Häuschen, Überleben, Tag/Nacht, Tiere, Geräusche, Titel, Menü, Tutorial, Rucksack (24 Plätze), Bauen mit Sockel gegen Schweben.
- Modul `cooking`: Pilze, Kräuter, Angeln, Wasser schöpfen, Kochstelle mit Spieß/Topf/Pfanne, 12 Rezepte, Rezeptbuch, Haltbarkeit.
- Modul `crafting`: Steine, Fasern, Lehm, Bretter, Seil, Werkbank, 6 Werkzeuge mit Effekten über `MODS`, 15 Möbel, Truhe.
- Modul `feel`: Sammeln mit Fortschritt (Hooks `intercept`, `fx`/`emit`, `rest`), Pigment-Partikel, schwebende Zahlen, Schritte, Wippen, Schlaf-Uhr, Vibration.
- Geräteanpassung Handy/PC (siehe Technik).

## Offene Roadmap (Vorschlag, Reihenfolge nach Wirkung)
1. ~~Spielgefühl~~ (erledigt, Modul `feel`). Offen: auf echten Geräten feinjustieren (Dauer, Wippen).
2. Ziel und Ausgangslage: ein Absatz Ausgangslage festlegen (warum allein im Tal, wem gehörte das Haus?), dann z. B. Erinnerungsstücke im Tal, die eine Geschichte erzählen und Dinge freischalten. Erst die Ausgangslage, dann die Story.
3. Besondere Orte: Steg, Ruine, Aussichtsfelsen, Mühle.
4. Bessere Modelle, zuerst Tiere und Bäume.
5. Bekannte Grenzen: Tiere laufen durch Bäume und Bauten, keine Kollision mit Pflanzen, Dächer nur als Satteldach.
