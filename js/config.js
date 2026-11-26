
/* ============================================================
   KONFIG – hier stellst du das Spiel ein, ohne Code zu verstehen.
   ============================================================ */
export const GAME = { name: 'Tuschtal', tagline: 'Ein Leben im Skizzenbuch', version: '0.1' };
/* Balancing: Verlust pro Spielstunde (Werte gehen von 0 bis 100) */
export const BALANCE = {
  foodPerHour: 4.5, waterPerHour: 7, energyPerHour: 3.2, sprintFactor: 1.8,
  hungryEnergyPerHour: 8,   // zusätzlicher Energieverlust bei leerem Magen oder Durst
  coldEnergyPerHour: 5,     // zusätzlicher Energieverlust bei Kälte (Wärme < 15)
  warmUp: 16, warmUpFire: 45, coolDown: 12
};

/* Gerät erkennen: Handy, Tablet oder Computer. Danach richten sich Sichtweite und Bildschärfe.
   Zum Ausprobieren erzwingen: ?geraet=handy | tablet | pc an die Adresse hängen. */
const forced = { handy: 'phone', tablet: 'tablet', pc: 'desktop' }[new URLSearchParams(location.search).get('geraet')];
const touchFirst = matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer:fine)').matches);
export const DEVICE = { kind: forced || (touchFirst ? (Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet') : 'desktop') };
DEVICE.touch = DEVICE.kind !== 'desktop';
/* Qualität je Gerät. rad: Sichtweite in Chunks, fog: Nebel von/bis (muss den Rand verdecken),
   square: Chunks als Quadrat statt Kreis (keine Lücken an den Diagonalen bei kleiner Sichtweite),
   dpr*: Bildschärfe (passt sich im Spiel der Bildrate an), aa: Kantenglättung */
export const QUALITY = {
  phone: { rad: 2, square: true, fog: [28, 64], dprStart: 1.25, dprMin: .75, dprMax: 1.5, aa: false },
  tablet: { rad: 3, fog: [42, 92], dprStart: 1.25, dprMin: .75, dprMax: 1.5, aa: false },
  desktop: { rad: 3, fog: [42, 92], dprStart: 1.5, dprMin: 1, dprMax: 2, aa: true }
}[DEVICE.kind];
export const SEED = 1337, CS = 32, SEG = 24, RAD = QUALITY.rad, EYE = 1.65;
export const MOUSE_LOOK = .0024;                   // Umsehen mit gefangener Maus (Bogenmaß pro Pixel)
export const KEY = 'aquarellwelt-bau-v1', LKEY = 'aquarellwelt-leben-v1';
export const GAME_HOUR = 40;                       // Sekunden echte Zeit pro Spielstunde
export const PAPER = new THREE.Color('#efe6d2'), INK = new THREE.Color('#2b2622');
export const NIGHT = new THREE.Color(.33, .37, .58), DUSK = new THREE.Color(1, .76, .6), WHITE = new THREE.Color(1, 1, 1);
export const $ = s => document.querySelector(s);
export const loadMsg = t => { $('#loadMsg').textContent = t; };
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export const STATS = [['food', 'Essen', '#c98b3e'], ['water', 'Trinken', '#4f86b3'], ['energy', 'Energie', '#d9b23f'], ['warm', 'Wärme', '#c2553e']];
export const WARN = { food: 'Dein Magen knurrt. Zeit für Beeren oder Äpfel.', water: 'Du hast Durst. Geh zum Brunnen oder an einen See.', energy: 'Du bist müde. Dein Bett wartet im Häuschen.', warm: 'Dir ist kalt. Ab ins Haus, am besten an den Kamin.' };

/* Module ein- und ausschalten: false = Modul wird gar nicht erst geladen */
export const FEATURES = { cooking: true, crafting: true, feel: true };
/* Kategorien im Rucksack (Reihenfolge der Anzeige) */
export const CATS = { nahrung: 'Nahrung', gericht: 'Gerichte', zutat: 'Zutaten', material: 'Material', tool: 'Werkzeuge', moebel: 'Möbel und Deko' };

/* Gegenstände im Rucksack. Module tragen hier ihre eigenen ein.
   spoil: Anteil, der pro Spieltag verdirbt (0 = hält ewig) */
export const ITEMS = {
  berries: { name: 'Beeren', one: 'Beere', cat: 'nahrung', pick: 'Beeren pflücken', yield: [3, 5], spoil: 0 },
  apples: { name: 'Äpfel', one: 'Apfel', cat: 'nahrung', pick: 'Äpfel pflücken', yield: [2, 3], spoil: 0 },
  wood: { name: 'Holz', one: 'Holz', cat: 'material', spoil: 0 }
};
/* Essbares und was es bewirkt. Module ergänzen hier ihre Gerichte. */
export const FOODS = {
  berries: { food: 9, water: 3, msg: 'Ein paar Beeren, herrlich sauer.' },
  apples: { food: 22, water: 5, msg: 'Knackig und süß.' }
};
