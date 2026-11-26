/* ============================================================
   FEATURES – Andockpunkte für abschaltbare Module
   Ein Modul ist ein Objekt mit optionalen Hooks:
     init()                     einmal beim Start (nach dem Häuschen)
     update(dt, ts)             jedes Bild, solange das Spiel läuft
     chunk(ch, cx, cz)          neuer Landschafts-Chunk: eigene Dinge hineinlegen
     override()                 -> Aktion, die alle anderen ersetzt (z. B. beim Angeln)
     fireActions(piece)         -> Aktionen an einem brennenden Feuer
     waterActions(ctx)          -> Zusatzaktionen am Wasser { lake: bool }
     pieceActions(piece)        -> Aktionen an Bauteilen mit eigenem use (z. B. 'craft', 'store')
     newDay()                   ein neuer Spieltag beginnt
     reset()                    neues Spiel
     intercept(action)          -> true, wenn das Modul die Aktion selbst ausführt (z. B. mit
                                   Fortschritt). Aktionen dürfen dafür work (Sekunden), anim
                                   ('pick' | 'chop' | 'scoop' | 'stoke') und at {x, y, z} tragen.
                                   Ohne Modul laufen sie sofort.
     fx(kind, data)             etwas ist passiert, das man sehen oder hören darf. kind:
                                   'gain' { k, n, x?, y?, z? }   etwas landet im Rucksack
                                   'eat' { k }  'drink'  'fire' { x, y, z }  'done' (Kochen, Werkbank)
                                   'build' / 'erase' { x, y, z }
     rest(before)               -> Millisekunden, die das Schwarzbild (Schlaf, Ohnmacht) länger
                                   bleibt. before = { T, S } vor dem Zeitsprung.
   Ein- und ausschalten in config.js unter FEATURES.
   ============================================================ */
export const features = [];
export function register(f) { features.push(f); if (f.init) f.init(); }
export function hook(name, ...args) { for (const f of features) if (f[name]) f[name](...args); }
export function collect(name, ...args) { const out = []; for (const f of features) if (f[name]) { const r = f[name](...args); if (r) out.push(...[].concat(r)); } return out; }
/* emit: Ereignis für Rückmeldungen melden (Partikel, Geräusche). Ohne Modul passiert nichts. */
export function emit(kind, data = {}) { hook('fx', kind, data); }
