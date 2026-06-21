const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadI18n(browserLanguage = "hr") {
  const storage = new Map();
  const document = {
    documentElement: { lang: "" },
    title: "",
    querySelectorAll() {
      return [];
    },
    dispatchEvent() {},
  };
  const context = {
    navigator: { language: browserLanguage },
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    document,
    CustomEvent: class CustomEvent {},
    window: {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "public", "i18n.js"), "utf8"),
    context
  );
  return context.window.TresetaI18n;
}

const i18n = loadI18n();
const html = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);
const client = fs.readFileSync(
  path.join(__dirname, "..", "public", "client.js"),
  "utf8"
);
const keys = new Set(
  [...html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)].map(
    (match) => match[1]
  )
);
[...client.matchAll(/(?:^|[^\w.])t\("([^"]+)"/gm)].forEach((match) =>
  keys.add(match[1])
);
[
  "seat.north",
  "seat.east",
  "seat.south",
  "seat.west",
  "seat.anchor",
  "suit.coins",
  "suit.cups",
  "suit.swords",
  "suit.clubs",
  "noun.player.one",
  "noun.player.few",
  "noun.player.many",
  "noun.card.one",
  "noun.card.few",
  "noun.card.many",
  "noun.point.one",
  "noun.point.few",
  "noun.point.many",
  "noun.match.one",
  "noun.match.few",
  "noun.match.many",
  "noun.rankedMatch.one",
  "noun.rankedMatch.few",
  "noun.rankedMatch.many",
].forEach((key) => keys.add(key));
["hr", "it", "en"].forEach((language) => {
  keys.forEach((key) => {
    assert.strictEqual(
      i18n.hasTranslation(key, language),
      true,
      `Missing ${language} translation for ${key}`
    );
  });
});

assert.strictEqual(
  i18n.t("rules.seresAkuza"),
  "Smijete odigrati bilo koju boju i blefirati pri prijavi akuže. Ispravan poziv Sereša donosi 11 kaznenih bodova igraču koji je blefirao, a pogrešan poziv igraču koji je pozvao Sereš. U oba slučaja ruka odmah završava."
);
assert.strictEqual(i18n.count("player", 4), "4 igrača");

i18n.setLanguage("it");
assert.strictEqual(i18n.t("rules.open"), "Come si gioca?");
assert.strictEqual(i18n.count("card", 1), "1 carta");
assert.strictEqual(
  i18n.translateServerText("Mare uzima štih."),
  "Mare prende la presa."
);
assert.strictEqual(
  i18n.translateError("Morate pratiti boju."),
  "Devi rispondere al seme."
);
assert.strictEqual(
  i18n.akuzaLabel({ id: "napolitana-coins", label: "A–2–3 denara" }),
  "A–2–3 denari"
);

i18n.setLanguage("en");
assert.strictEqual(i18n.t("rules.open"), "How to play");
assert.strictEqual(
  i18n.translateServerText(
    "Ana zove Sereš na igrača Boris! Boris imao je traženu boju i dobiva 11 bodova. Ruka je završena. Nova ruka je podijeljena; Cvita je na redu za akužu."
  ),
  "Ana calls Sereš on Boris! Boris had the led suit and receives 11 points. The hand is over. A new hand was dealt; Cvita is next to declare akuža."
);
assert.strictEqual(
  i18n.translateError("Za početak su potrebna 4 igrača."),
  "4 players are required."
);

console.log("✓ Croatian, Italian, and English translations are complete and switchable");
