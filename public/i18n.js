(function initializeI18n() {
  const dictionaries = {
    hr: {
      "meta.description": "Mrežna Trešeta za više igrača.",
      "language.label": "Jezik",
      "brand.eyebrow": "Jadranska kartaška soba",
      "brand.intro":
        "Četiri stolice. Dvije ekipe. Bez aduta — samo boja, pamćenje i dobar partner preko stola.",
      "common.close": "Zatvori",
      "common.or": "ili",
      "common.ranked": "Rangirano",
      "common.casual": "Ležerno",
      "common.akuza": "Akuža",
      "common.signals": "Signali",
      "common.spectator": "Gledatelj",
      "common.continue": "Nastavi",
      "fullscreen.enter": "Fullscreen",
      "fullscreen.exit": "Izađi iz fullscreen prikaza",
      "fullscreen.unavailable": "Fullscreen nije dostupan u ovom pregledniku.",
      "reaction.draw": "Nacrtaj reakciju",
      "reaction.title": "Vaša reakcija",
      "reaction.canvas": "Platno za crtanje reakcije",
      "reaction.clear": "Očisti",
      "reaction.save": "Spremi",
      "reaction.send": "Pošalji reakciju",
      "reaction.saved": "Reakcija je spremljena.",
      "account.loginRegister": "Prijava / registracija",
      "account.login": "Prijava",
      "account.yourAccount": "Vaš račun",
      "account.newAccount": "Novi račun",
      "account.username": "Korisničko ime",
      "account.password": "Lozinka",
      "account.passwordPlaceholder": "Najmanje 8 znakova",
      "account.signIn": "Prijavi se",
      "account.create": "Izradi račun",
      "account.logout": "Odjava",
      "account.footnote":
        "Rangirane partije i povijest partija vežu se uz ovaj račun.",
      "account.signedIn": "Prijavljeni ste.",
      "account.created": "Račun je izrađen.",
      "lobby.nickname": "Vaš nadimak",
      "lobby.nicknamePlaceholder": "npr. Meštar",
      "lobby.newTable": "Novi stol",
      "lobby.gameMode": "Način igre",
      "lobby.matchType": "Vrsta partije",
      "lobby.playerCount": "Broj igrača",
      "lobby.responseTime": "Vrijeme za Nastavi / Sereš",
      "lobby.createRoom": "Otvori sobu",
      "lobby.join": "Pridruži se",
      "lobby.roomCode": "Kod sobe",
      "lobby.joinSpectator": "Pridruži se kao gledatelj",
      "lobby.sitDown": "Sjedni za stol",
      "players.2": "2 igrača",
      "players.3": "3 igrača",
      "players.4": "4 igrača",
      "players.5": "5 igrača",
      "mode.classic": "Klasična Trešeta",
      "mode.seres": "Trešeta Sereš u Manje",
      "mode.classicDescription":
        "Klasična Trešeta za četiri igrača podijeljena u dvije ekipe.",
      "mode.seresDescription":
        "Varijanta za 3–5 igrača u kojoj svatko igra za sebe. Cilj je skupiti što manje bodova; prvi igrač koji dosegne 41 bod gubi. Dopušteno je odigrati bilo koju boju i blefirati pri prijavi akuže, ali uspješan poziv Sereša donosi 11 kaznenih bodova i završava ruku.",
      "mode.classicRankedNote":
        "Rangirana soba zahtijeva četiri prijavljena igrača. Akuža je uključena, a signali isključeni.",
      "mode.classicRankedFourOnly":
        "Rangirana klasična Trešeta trenutno je dostupna samo za 4 igrača.",
      "mode.seresRankedNote":
        "Rangirani Sereš u Manje koristi zaseban MMR i zahtijeva {players} prijavljenih igrača.",
      "lobby.akuzaDeclaration": "Prijava akuže",
      "lobby.akuzaSpecific": "Specifična",
      "lobby.akuzaValueOnly": "Samo vrijednost",
      "lobby.akuzaSpecificHelp":
        "Igrači moraju prijaviti koju akužu tvrde da imaju.",
      "lobby.akuzaValueOnlyHelp":
        "Igrači prijavljuju samo ukupno, npr. -3, -8 ili -12.",
      "lobby.seresDealStyle": "Stil dijeljenja za 3 igrača",
      "lobby.seresDeal13": "13 karata + 1 skriveni škart",
      "lobby.seresDeal12": "12 karata + makni sve četvorke",
      "lobby.seresDealHelp":
        "13 karata: jedna nepoznata karta se makne. 12 karata: maknu se sve četiri četvorke.",
      "game.room": "Soba",
      "game.copy": "Kopiraj",
      "game.copyInvite": "Kopiraj pozivnicu",
      "game.leave": "Izađi",
      "game.score": "Rezultat",
      "game.individualScore": "Pojedinačni rezultat",
      "game.capturedMaestral": "Štihovi ekipe Maestral",
      "game.capturedBura": "Štihovi ekipe Bura",
      "game.currentTrick": "Trenutni štih",
      "game.lobby": "Čekaonica",
      "game.waitingPlayers": "Čekamo igrače",
      "game.welcome": "Dobro došli za stol.",
      "game.waitingMore": "Čekamo još igrača…",
      "game.start": "Započni partiju",
      "game.akuzaInHand": "Akuža u ruci",
      "game.declareAkuza": "Prijavi akužu",
      "game.yourAkuzaTurn": "Vi ste na redu za akužu",
      "game.akuzaBluff": "Možete prijaviti stvarnu akužu ili blefirati.",
      "game.prepareAkuza": "Pripremite akužu",
      "game.prepareAkuzaHint":
        "Možete pripremiti odabir sada; potvrda se otvara kad dođe vaš red.",
      "game.waitAkuzaTurn": "Čekajte svoj red",
      "game.pass": "Nastavi / Preskoči",
      "game.openAkuza": "Otvorena akuža",
      "seresReveal.label": "Otkrivena ruka",
      "seresReveal.title": "{player} pokazuje ruku",
      "seresReveal.trickProof": "Osvijetljene karte pokazuju da je igrač imao traženu boju.",
      "seresReveal.trickNoProof": "U ruci nema karte tražene boje.",
      "seresReveal.akuzaProof": "Osvijetljene karte dokazuju prijavljenu akužu.",
      "seresReveal.akuzaNoProof": "Ruka ne može složiti prijavljenu akužu.",
      "game.kaputChoiceTitle": "Kaput! Odaberite nagradu",
      "game.kaputChoicePrompt":
        "Uzeli ste 10 ili više bodova. Odaberite nagradu.",
      "game.kaputWaiting": "Čekamo da {player} odabere Kaput nagradu.",
      "game.kaputRemove": "Skini mi 11 bodova",
      "game.kaputGiveOthers": "Daj svima ostalima 10 bodova",
      "game.signalBeforeLead": "Signal prije izlaza",
      "game.yourCards": "Vaše karte",
      "game.lowerIsBetter": "niže je bolje",
      "game.higherIsBetter": "više je bolje",
      "game.playerFallback": "Igrač",
      "game.ledSuit": "Tražena boja: {suit}",
      "game.publicView": "Gledate javni tijek partije",
      "game.akuzaTurn": "Faza akuže · na redu je {player}",
      "game.waitingChallenge": "Čekaju se odgovori Nastavi / Sereš",
      "game.decides": "{player} odlučuje: Nastavi ili Sereš",
      "game.waitingAnswer": "Čeka se odgovor",
      "game.trickResolving": "Štih se obračunava…",
      "game.autoFinalTrick": "Zadnji štih se igra automatski.",
      "game.yourTurn": "Vi ste na redu — odaberite osvijetljenu kartu",
      "game.playerTurn": "Na redu je {player}",
      "game.tableOccupied":
        "Za stolom je {occupied}/{target} igrača. Podijelite kod {code}.",
      "game.waitingReturn": "Stol je pun, ali čekamo povratak {count}.",
      "game.tableReady": "Stol je pun. Domaćin može podijeliti karte.",
      "game.handAkuza": "Ruka {hand} · faza akuže",
      "game.handKaput": "Ruka {hand} · Kaput",
      "game.handTrick": "Ruka {hand} · štih {trick}/{total}",
      "game.responseSeconds": "{seconds} s za odgovor",
      "game.akuzaOn": "Akuža uključena",
      "game.akuzaOff": "Bez akuže",
      "game.signalsOn": "Signali uključeni",
      "game.signalsOff": "Bez signala",
      "game.akuzaDeclaredTotal": "Ukupna prijava: {total}",
      "game.akuzaSelectHint": "Odaberite jednu ili više akuža.",
      "game.stockCount": "Kup: {count}",
      "game.dealNoFours": "bez četvorki",
      "game.akuzaValueOnly": "akuža: samo vrijednost",
      "game.akuzaSpecific": "akuža: specifična",
      "game.drawLog": "{player} vuče {card}.",
      "team.maestral": "Ekipa Maestral",
      "team.bura": "Ekipa Bura",
      "team.northSouth": "Sjever + Jug",
      "team.eastWest": "Istok + Zapad",
      "seat.north": "Sjever",
      "seat.east": "Istok",
      "seat.south": "Jug",
      "seat.west": "Zapad",
      "seat.anchor": "Sidro",
      "seat.free": "{seat} · slobodno",
      "seat.you": "vi",
      "seat.account": "račun",
      "seat.away": "odsutan",
      "seat.dealer": "Djelitelj",
      "suit.coins": "Denari",
      "suit.cups": "Kupe",
      "suit.swords": "Špade",
      "suit.clubs": "Baštuni",
      "signal.busso": "Tučem / Busso",
      "signal.striscio": "Strišo / Striscio",
      "signal.volo": "Volo",
      "score.handSummary": "Obračun ruke",
      "score.handEnded": "Ruka završena",
      "score.nextHand": "Podijeli novu ruku",
      "score.newMatch": "Nova partija",
      "score.loser": "{player} je dosegao 41 bod i gubi",
      "score.totalPoints": "Ukupni bodovi",
      "score.loserLabel": "GUBITNIK",
      "score.hostNewMatch": "Domaćin može pokrenuti novu partiju.",
      "score.teamWins": "Ekipa {team} osvaja partiju",
      "score.playerWins": "{player} osvaja partiju",
      "score.handNumberEnded": "Ruka {hand} je završena",
      "score.cards": "Karte",
      "score.lastTrick": "Posljednji štih",
      "score.totalInHand": "Ukupno u ruci",
      "score.waitingHost": "Čekamo domaćina da podijeli novu ruku.",
      "profile.playerProfile": "Igrački profil",
      "profile.privatePartnership": "Privatno za partnerstvo",
      "profile.duoExplanation": "Svaki partner ima zaseban zajednički rejting",
      "profile.last50": "Posljednjih 50",
      "profile.matchHistory": "Povijest partija",
      "profile.startingRating": "Početni rejting 1000",
      "profile.separateSeres": "Zaseban rejting za Sereš u Manje",
      "profile.winsPercent": "{percent}% pobjeda",
      "profile.rankedGames": "{count} rangiranih partija",
      "profile.games": "{count} partija",
      "profile.noDuos":
        "Još nemate rangiranih partija s ponovljenim partnerom.",
      "profile.loss": "Poraz",
      "profile.victory": "Pobjeda",
      "profile.modePlayers": "Trešeta Sereš u Manje · {players}",
      "profile.noMmr": "Bez MMR-a",
      "profile.withAgainst": "S igračem {partner} protiv {opponents}",
      "profile.noHistory": "Vaša povijest partija još je prazna.",
      "rules.open": "Kako se igra?",
      "rules.title": "Pravila",
      "rules.quickGuide": "Brzi vodič",
      "rules.heading": "Kako se igra Trešeta",
      "rules.goalTitle": "1. Cilj",
      "rules.goal":
        "Partneri sjede nasuprot. Prva ekipa koja dosegne 41 bod osvaja partiju.",
      "rules.cardsTitle": "2. Jačina karata",
      "rules.cards":
        "<b>3, 2, As, Re, Cavallo, Fante, 7, 6, 5, 4.</b> Nema aduta.",
      "rules.followTitle": "3. Praćenje boje",
      "rules.follow":
        "Morate pratiti boju prve odigrane karte ako je imate. Inače smijete odigrati bilo koju kartu.",
      "rules.pointsTitle": "4. Bodovi",
      "rules.points":
        "As vrijedi 1 bod; trica, dvojka i figure vrijede po ⅓ boda. Posljednji štih donosi još 1 bod.",
      "rules.akuzaTitle": "5. Akuža",
      "rules.akuza":
        "Prije nego što odigrate prvu kartu možete prijaviti tri ili četiri asa, dvojke ili trice, odnosno A–2–3 iste boje.",
      "rules.signalsTitle": "6. Signali",
      "rules.signals":
        "Ako su uključeni, Busso, Striscio i Volo dostupni su samo prije prve karte u štihu.",
      "rules.seres":
        "Varijanta za 3–5 igrača u kojoj svatko igra za sebe. Cilj je skupiti što manje bodova; prvi igrač koji dosegne 41 bod gubi.",
      "rules.seresAkuzaTitle": "Sereš i akuža",
      "rules.seresAkuza":
        "Smijete odigrati bilo koju boju i blefirati pri prijavi akuže. Ispravan poziv Sereša donosi 11 kaznenih bodova igraču koji je blefirao, a pogrešan poziv igraču koji je pozvao Sereš. U oba slučaja ruka odmah završava.",
      "toast.inviteCopied": "Pozivnica je kopirana.",
      "toast.roomCode": "Kod sobe: {code}",
      "toast.disconnected": "Veza je prekinuta. Pokušavam se ponovno spojiti…",
      "generic.requestFailed": "Zahtjev nije uspio.",
      "generic.somethingWrong": "Nešto je pošlo po zlu.",
      "challenge.akuza":
        "{player} je prijavio akužu {claim}. Odaberite Nastavi ili Sereš · {seconds} s",
      "challenge.offSuit":
        "{player} nije pratio traženu boju · {seconds} s za Nastavi ili Sereš",
      "server.tableFilling": "Čeka se da se stol popuni.",
      "server.firstAkuza": "{player} je prvi na redu za akužu.",
      "server.newHandAkuza":
        "Podijeljena je nova ruka; {player} je na redu za akužu.",
      "server.opensHand": "{player} otvara ruku.",
      "server.declaresPoints": "{player} prijavljuje akužu za {points} boda.",
      "server.declaresChallenge":
        "{player} prijavljuje akužu. Čekaju se odgovori: Nastavi ili Sereš.",
      "server.opensFirstTrick": "{player} otvara prvi štih.",
      "server.akuzaTurn": "{player} je na redu za akužu.",
      "server.akuzaAccepted":
        "Akuža igrača {player} prihvaćena je i oduzima {points} boda.",
      "server.waitingDecision": "Čeka se da {player} odabere Nastavi ili Sereš.",
      "server.offSuitDecision":
        "{player} igra drugu boju. {responder} odlučuje: Nastavi ili Sereš.",
      "server.playsCard": "{player} igra kartu.",
      "server.takesTrick": "{player} uzima štih.",
      "server.decides": "{player} odlučuje: Nastavi ili Sereš.",
      "server.turn": "{player} je na redu.",
      "server.handEnded": "Ruka {hand} je završena.",
      "server.teamWins": "Ekipa {team} osvaja partiju!",
      "server.opensNewTrick": "{player} otvara novi štih.",
      "server.reachedFromTrick":
        "{player} dosegao je 41 bod bodovima iz štiha.",
      "server.normalHand":
        "Ruka {hand} završila je uobičajeno. Bodovi su obračunani.",
      "server.noOneReached": "Nitko nije dosegao 41 bod.",
      "server.losesMatch": "{player} dosegao je 41 bod i gubi partiju.",
      "server.seresAkuzaCorrect":
        "{caller} zove Sereš na akužu igrača {accused}! {accused} nije imao tu akužu i dobiva {points} bodova. Ruka je završena.",
      "server.seresAkuzaWrong":
        "{caller} zove Sereš na akužu igrača {accused}! Poziv nije bio točan pa {caller} dobiva {points} bodova. Ruka je završena.",
      "server.seresPlayCorrect":
        "{caller} zove Sereš na igrača {accused}! {accused} imao je traženu boju i dobiva {points} bodova. Ruka je završena.",
      "server.seresPlayWrong":
        "{caller} zove Sereš na igrača {accused}! Poziv nije bio točan pa {caller} dobiva {points} bodova. Ruka je završena.",
      "server.kaputPending":
        "Kaput! {player} je uzeo 10 ili više bodova. Čeka se izbor nagrade.",
      "server.kaputRemove":
        "{player} je napravio Kaput i skinuo 11 bodova.",
      "server.kaputGive":
        "{player} je napravio Kaput i dao svima ostalima 10 bodova.",
      "noun.player.one": "{count} igrač",
      "noun.player.few": "{count} igrača",
      "noun.player.many": "{count} igrača",
      "noun.card.one": "{count} karta",
      "noun.card.few": "{count} karte",
      "noun.card.many": "{count} karata",
      "noun.point.one": "{count} bod",
      "noun.point.few": "{count} boda",
      "noun.point.many": "{count} bodova",
      "noun.match.one": "{count} partija",
      "noun.match.few": "{count} partije",
      "noun.match.many": "{count} partija",
      "noun.rankedMatch.one": "{count} rangirana partija",
      "noun.rankedMatch.few": "{count} rangirane partije",
      "noun.rankedMatch.many": "{count} rangiranih partija",
    },
    it: {
      "meta.description": "Trešeta multigiocatore online.",
      "language.label": "Lingua",
      "brand.eyebrow": "Sala da gioco adriatica",
      "brand.intro":
        "Quattro sedie. Due squadre. Niente briscole: solo seme, memoria e un buon compagno di fronte.",
      "common.close": "Chiudi",
      "common.or": "oppure",
      "common.ranked": "Classificata",
      "common.casual": "Amichevole",
      "common.akuza": "Akuža",
      "common.signals": "Segnali",
      "common.spectator": "Spettatore",
      "common.continue": "Continua",
      "fullscreen.enter": "Schermo intero",
      "fullscreen.exit": "Esci dallo schermo intero",
      "fullscreen.unavailable": "Schermo intero non disponibile in questo browser.",
      "reaction.draw": "Disegna reazione",
      "reaction.title": "La tua reazione",
      "reaction.canvas": "Tela per disegnare la reazione",
      "reaction.clear": "Pulisci",
      "reaction.save": "Salva",
      "reaction.send": "Invia reazione",
      "reaction.saved": "Reazione salvata.",
      "account.loginRegister": "Accedi / registrati",
      "account.login": "Accesso",
      "account.yourAccount": "Il tuo account",
      "account.newAccount": "Nuovo account",
      "account.username": "Nome utente",
      "account.password": "Password",
      "account.passwordPlaceholder": "Almeno 8 caratteri",
      "account.signIn": "Accedi",
      "account.create": "Crea account",
      "account.logout": "Esci",
      "account.footnote":
        "Le partite classificate e la cronologia sono associate a questo account.",
      "account.signedIn": "Accesso effettuato.",
      "account.created": "Account creato.",
      "lobby.nickname": "Il tuo soprannome",
      "lobby.nicknamePlaceholder": "es. Maestro",
      "lobby.newTable": "Nuovo tavolo",
      "lobby.gameMode": "Modalità di gioco",
      "lobby.matchType": "Tipo di partita",
      "lobby.playerCount": "Numero di giocatori",
      "lobby.responseTime": "Tempo per Continua / Sereš",
      "lobby.createRoom": "Crea stanza",
      "lobby.join": "Entra",
      "lobby.roomCode": "Codice stanza",
      "lobby.joinSpectator": "Entra come spettatore",
      "lobby.sitDown": "Siediti al tavolo",
      "players.2": "2 giocatori",
      "players.3": "3 giocatori",
      "players.4": "4 giocatori",
      "players.5": "5 giocatori",
      "mode.classic": "Trešeta classica",
      "mode.seres": "Trešeta Sereš u Manje",
      "mode.classicDescription":
        "Trešeta classica per quattro giocatori divisi in due squadre.",
      "mode.seresDescription":
        "Variante per 3–5 giocatori, tutti contro tutti. Vince chi raccoglie meno punti; il primo a raggiungere 41 perde. Si può giocare qualsiasi seme e bluffare l'akuža, ma una chiamata di Sereš riuscita assegna 11 punti di penalità e termina la mano.",
      "mode.classicRankedNote":
        "Una stanza classificata richiede quattro giocatori autenticati. L'akuža è attiva e i segnali sono disattivati.",
      "mode.classicRankedFourOnly":
        "La Trešeta classica classificata è disponibile solo per 4 giocatori.",
      "mode.seresRankedNote":
        "Sereš u Manje classificato usa un MMR separato e richiede {players} autenticati.",
      "lobby.akuzaDeclaration": "Dichiarazione akuža",
      "lobby.akuzaSpecific": "Specifica",
      "lobby.akuzaValueOnly": "Solo valore",
      "lobby.akuzaSpecificHelp":
        "I giocatori devono dichiarare quale akuža affermano di avere.",
      "lobby.akuzaValueOnlyHelp":
        "I giocatori dichiarano solo il totale, per esempio -3, -8 o -12.",
      "lobby.seresDealStyle": "Distribuzione per 3 giocatori",
      "lobby.seresDeal13": "13 carte + 1 scarto nascosto",
      "lobby.seresDeal12": "12 carte + togli tutti i 4",
      "lobby.seresDealHelp":
        "13 carte: si toglie una carta sconosciuta. 12 carte: si tolgono tutti e quattro i 4.",
      "game.room": "Stanza",
      "game.copy": "Copia",
      "game.copyInvite": "Copia invito",
      "game.leave": "Esci",
      "game.score": "Punteggio",
      "game.individualScore": "Punteggio individuale",
      "game.capturedMaestral": "Prese della squadra Maestral",
      "game.capturedBura": "Prese della squadra Bura",
      "game.currentTrick": "Presa in corso",
      "game.lobby": "Sala d'attesa",
      "game.waitingPlayers": "In attesa dei giocatori",
      "game.welcome": "Benvenuti al tavolo.",
      "game.waitingMore": "In attesa di altri giocatori…",
      "game.start": "Inizia partita",
      "game.akuzaInHand": "Akuža in mano",
      "game.declareAkuza": "Dichiara akuža",
      "game.yourAkuzaTurn": "È il tuo turno per l'akuža",
      "game.akuzaBluff": "Puoi dichiarare un'akuža reale oppure bluffare.",
      "game.prepareAkuza": "Prepara l'akuža",
      "game.prepareAkuzaHint":
        "Puoi preparare la scelta ora; la conferma si attiva al tuo turno.",
      "game.waitAkuzaTurn": "Attendi il tuo turno",
      "game.pass": "Continua / Passa",
      "game.openAkuza": "Akuža dichiarata",
      "seresReveal.label": "Mano rivelata",
      "seresReveal.title": "{player} mostra la mano",
      "seresReveal.trickProof": "Le carte evidenziate mostrano che il giocatore aveva il seme richiesto.",
      "seresReveal.trickNoProof": "Nella mano non ci sono carte del seme richiesto.",
      "seresReveal.akuzaProof": "Le carte evidenziate provano l'akuža dichiarata.",
      "seresReveal.akuzaNoProof": "La mano non può comporre l'akuža dichiarata.",
      "game.kaputChoiceTitle": "Kaput! Scegli la ricompensa",
      "game.kaputChoicePrompt":
        "Hai preso 10 o più punti. Scegli la ricompensa.",
      "game.kaputWaiting": "In attesa che {player} scelga la ricompensa Kaput.",
      "game.kaputRemove": "Toglimi 11 punti",
      "game.kaputGiveOthers": "Dai 10 punti a tutti gli altri",
      "game.signalBeforeLead": "Segnale prima dell'uscita",
      "game.yourCards": "Le tue carte",
      "game.lowerIsBetter": "meno è meglio",
      "game.higherIsBetter": "più è meglio",
      "game.playerFallback": "Giocatore",
      "game.ledSuit": "Seme d'uscita: {suit}",
      "game.publicView": "Stai seguendo lo svolgimento pubblico della partita",
      "game.akuzaTurn": "Fase akuža · tocca a {player}",
      "game.waitingChallenge": "In attesa delle risposte Continua / Sereš",
      "game.decides": "{player} decide: Continua o Sereš",
      "game.waitingAnswer": "In attesa della risposta",
      "game.trickResolving": "Calcolo della presa…",
      "game.autoFinalTrick": "L'ultima presa viene giocata automaticamente.",
      "game.yourTurn": "È il tuo turno: scegli una carta evidenziata",
      "game.playerTurn": "Tocca a {player}",
      "game.tableOccupied":
        "Al tavolo ci sono {occupied}/{target} giocatori. Condividi il codice {code}.",
      "game.waitingReturn":
        "Il tavolo è pieno, ma attendiamo il ritorno di {count}.",
      "game.tableReady": "Il tavolo è pieno. L'host può distribuire le carte.",
      "game.handAkuza": "Mano {hand} · fase akuža",
      "game.handKaput": "Mano {hand} · Kaput",
      "game.handTrick": "Mano {hand} · presa {trick}/{total}",
      "game.responseSeconds": "{seconds} s per rispondere",
      "game.akuzaOn": "Akuža attiva",
      "game.akuzaOff": "Senza akuža",
      "game.signalsOn": "Segnali attivi",
      "game.signalsOff": "Senza segnali",
      "game.akuzaDeclaredTotal": "Dichiarazione totale: {total}",
      "game.akuzaSelectHint": "Seleziona una o più akuže.",
      "game.stockCount": "Mazzo: {count}",
      "game.dealNoFours": "senza 4",
      "game.akuzaValueOnly": "akuža: solo valore",
      "game.akuzaSpecific": "akuža: specifica",
      "game.drawLog": "{player} pesca {card}.",
      "team.maestral": "Squadra Maestral",
      "team.bura": "Squadra Bura",
      "team.northSouth": "Nord + Sud",
      "team.eastWest": "Est + Ovest",
      "seat.north": "Nord",
      "seat.east": "Est",
      "seat.south": "Sud",
      "seat.west": "Ovest",
      "seat.anchor": "Ancora",
      "seat.free": "{seat} · libero",
      "seat.you": "tu",
      "seat.account": "account",
      "seat.away": "assente",
      "seat.dealer": "Mazziere",
      "suit.coins": "Denari",
      "suit.cups": "Coppe",
      "suit.swords": "Spade",
      "suit.clubs": "Bastoni",
      "signal.busso": "Busso",
      "signal.striscio": "Striscio",
      "signal.volo": "Volo",
      "score.handSummary": "Riepilogo della mano",
      "score.handEnded": "Mano conclusa",
      "score.nextHand": "Distribuisci una nuova mano",
      "score.newMatch": "Nuova partita",
      "score.loser": "{player} ha raggiunto 41 e perde",
      "score.totalPoints": "Punti totali",
      "score.loserLabel": "PERDENTE",
      "score.hostNewMatch": "L'host può iniziare una nuova partita.",
      "score.teamWins": "La squadra {team} vince la partita",
      "score.playerWins": "{player} vince la partita",
      "score.handNumberEnded": "La mano {hand} è conclusa",
      "score.cards": "Carte",
      "score.lastTrick": "Ultima presa",
      "score.totalInHand": "Totale della mano",
      "score.waitingHost": "In attesa che l'host distribuisca una nuova mano.",
      "profile.playerProfile": "Profilo giocatore",
      "profile.privatePartnership": "Privato per la coppia",
      "profile.duoExplanation": "Ogni compagno ha un rating di coppia separato",
      "profile.last50": "Ultime 50",
      "profile.matchHistory": "Cronologia partite",
      "profile.startingRating": "Rating iniziale 1000",
      "profile.separateSeres": "Classifica separata per Sereš u Manje",
      "profile.winsPercent": "{percent}% vittorie",
      "profile.rankedGames": "{count} partite classificate",
      "profile.games": "{count} partite",
      "profile.noDuos":
        "Non hai ancora partite classificate ripetute con lo stesso compagno.",
      "profile.loss": "Sconfitta",
      "profile.victory": "Vittoria",
      "profile.modePlayers": "Trešeta Sereš u Manje · {players}",
      "profile.noMmr": "Senza MMR",
      "profile.withAgainst": "Con {partner} contro {opponents}",
      "profile.noHistory": "La cronologia delle partite è ancora vuota.",
      "rules.open": "Come si gioca?",
      "rules.title": "Regole",
      "rules.quickGuide": "Guida rapida",
      "rules.heading": "Come si gioca a Trešeta",
      "rules.goalTitle": "1. Obiettivo",
      "rules.goal":
        "I compagni siedono uno di fronte all'altro. La prima squadra a raggiungere 41 punti vince.",
      "rules.cardsTitle": "2. Valore delle carte",
      "rules.cards":
        "<b>3, 2, Asso, Re, Cavallo, Fante, 7, 6, 5, 4.</b> Non ci sono briscole.",
      "rules.followTitle": "3. Rispondere al seme",
      "rules.follow":
        "Devi rispondere al seme della prima carta se ne possiedi una. Altrimenti puoi giocare qualsiasi carta.",
      "rules.pointsTitle": "4. Punti",
      "rules.points":
        "L'asso vale 1 punto; tre, due e figure valgono ⅓ di punto. L'ultima presa vale 1 punto aggiuntivo.",
      "rules.akuzaTitle": "5. Akuža",
      "rules.akuza":
        "Prima di giocare la tua prima carta puoi dichiarare tre o quattro assi, due o tre, oppure A–2–3 dello stesso seme.",
      "rules.signalsTitle": "6. Segnali",
      "rules.signals":
        "Se attivi, Busso, Striscio e Volo sono disponibili solo prima della prima carta della presa.",
      "rules.seres":
        "Variante per 3–5 giocatori, tutti contro tutti. L'obiettivo è raccogliere meno punti possibile; il primo a raggiungere 41 perde.",
      "rules.seresAkuzaTitle": "Sereš e akuža",
      "rules.seresAkuza":
        "Puoi giocare qualsiasi seme e bluffare quando dichiari un'akuža. Una chiamata corretta di Sereš assegna 11 punti di penalità a chi ha bluffato; una chiamata errata li assegna a chi ha chiamato. In entrambi i casi la mano termina immediatamente.",
      "toast.inviteCopied": "Invito copiato.",
      "toast.roomCode": "Codice stanza: {code}",
      "toast.disconnected": "Connessione interrotta. Tentativo di riconnessione…",
      "generic.requestFailed": "Richiesta non riuscita.",
      "generic.somethingWrong": "Qualcosa è andato storto.",
      "challenge.akuza":
        "{player} ha dichiarato {claim}. Continua o chiama Sereš · {seconds} s",
      "challenge.offSuit":
        "{player} non ha risposto al seme · {seconds} s per Continua o Sereš",
      "server.tableFilling": "In attesa che il tavolo si riempia.",
      "server.firstAkuza": "{player} è il primo a dichiarare l'akuža.",
      "server.newHandAkuza":
        "È stata distribuita una nuova mano; tocca a {player} per l'akuža.",
      "server.opensHand": "{player} apre la mano.",
      "server.declaresPoints": "{player} dichiara un'akuža da {points} punti.",
      "server.declaresChallenge":
        "{player} dichiara un'akuža. In attesa di Continua o Sereš.",
      "server.opensFirstTrick": "{player} apre la prima presa.",
      "server.akuzaTurn": "Tocca a {player} per l'akuža.",
      "server.akuzaAccepted":
        "L'akuža di {player} è stata accettata e sottrae {points} punti.",
      "server.waitingDecision": "In attesa che {player} scelga Continua o Sereš.",
      "server.offSuitDecision":
        "{player} gioca un altro seme. {responder} decide: Continua o Sereš.",
      "server.playsCard": "{player} gioca una carta.",
      "server.takesTrick": "{player} prende la presa.",
      "server.decides": "{player} decide: Continua o Sereš.",
      "server.turn": "Tocca a {player}.",
      "server.handEnded": "La mano {hand} è conclusa.",
      "server.teamWins": "La squadra {team} vince la partita!",
      "server.opensNewTrick": "{player} apre una nuova presa.",
      "server.reachedFromTrick":
        "{player} ha raggiunto 41 punti con i punti della presa.",
      "server.normalHand":
        "La mano {hand} è terminata normalmente. I punti sono stati conteggiati.",
      "server.noOneReached": "Nessuno ha raggiunto 41 punti.",
      "server.losesMatch": "{player} ha raggiunto 41 punti e perde la partita.",
      "server.seresAkuzaCorrect":
        "{caller} chiama Sereš sull'akuža di {accused}! {accused} non aveva quell'akuža e riceve {points} punti. La mano è finita.",
      "server.seresAkuzaWrong":
        "{caller} chiama Sereš sull'akuža di {accused}! La chiamata era errata e {caller} riceve {points} punti. La mano è finita.",
      "server.seresPlayCorrect":
        "{caller} chiama Sereš su {accused}! {accused} aveva il seme d'uscita e riceve {points} punti. La mano è finita.",
      "server.seresPlayWrong":
        "{caller} chiama Sereš su {accused}! La chiamata era errata e {caller} riceve {points} punti. La mano è finita.",
      "server.kaputPending":
        "Kaput! {player} ha preso 10 o più punti. In attesa della ricompensa.",
      "server.kaputRemove":
        "{player} ha fatto Kaput e ha tolto 11 punti.",
      "server.kaputGive":
        "{player} ha fatto Kaput e ha dato 10 punti a tutti gli altri.",
      "noun.player.one": "{count} giocatore",
      "noun.player.few": "{count} giocatori",
      "noun.player.many": "{count} giocatori",
      "noun.card.one": "{count} carta",
      "noun.card.few": "{count} carte",
      "noun.card.many": "{count} carte",
      "noun.point.one": "{count} punto",
      "noun.point.few": "{count} punti",
      "noun.point.many": "{count} punti",
      "noun.match.one": "{count} partita",
      "noun.match.few": "{count} partite",
      "noun.match.many": "{count} partite",
      "noun.rankedMatch.one": "{count} partita classificata",
      "noun.rankedMatch.few": "{count} partite classificate",
      "noun.rankedMatch.many": "{count} partite classificate",
    },
    en: {
      "meta.description": "Online multiplayer Trešeta.",
      "language.label": "Language",
      "brand.eyebrow": "Adriatic card room",
      "brand.intro":
        "Four seats. Two teams. No trumps—only suit, memory, and a good partner across the table.",
      "common.close": "Close",
      "common.or": "or",
      "common.ranked": "Ranked",
      "common.casual": "Casual",
      "common.akuza": "Akuža",
      "common.signals": "Signals",
      "common.spectator": "Spectator",
      "common.continue": "Continue",
      "fullscreen.enter": "Fullscreen",
      "fullscreen.exit": "Exit fullscreen",
      "fullscreen.unavailable": "Fullscreen is not available in this browser.",
      "reaction.draw": "Draw reaction",
      "reaction.title": "Your reaction",
      "reaction.canvas": "Canvas for drawing a reaction",
      "reaction.clear": "Clear",
      "reaction.save": "Save",
      "reaction.send": "Send reaction",
      "reaction.saved": "Reaction saved.",
      "account.loginRegister": "Sign in / register",
      "account.login": "Sign in",
      "account.yourAccount": "Your account",
      "account.newAccount": "New account",
      "account.username": "Username",
      "account.password": "Password",
      "account.passwordPlaceholder": "At least 8 characters",
      "account.signIn": "Sign in",
      "account.create": "Create account",
      "account.logout": "Sign out",
      "account.footnote":
        "Ranked games and match history are linked to this account.",
      "account.signedIn": "You are signed in.",
      "account.created": "Account created.",
      "lobby.nickname": "Your nickname",
      "lobby.nicknamePlaceholder": "e.g. Maestro",
      "lobby.newTable": "New table",
      "lobby.gameMode": "Game mode",
      "lobby.matchType": "Match type",
      "lobby.playerCount": "Number of players",
      "lobby.responseTime": "Time for Continue / Sereš",
      "lobby.createRoom": "Create room",
      "lobby.join": "Join",
      "lobby.roomCode": "Room code",
      "lobby.joinSpectator": "Join as spectator",
      "lobby.sitDown": "Take a seat",
      "players.2": "2 players",
      "players.3": "3 players",
      "players.4": "4 players",
      "players.5": "5 players",
      "mode.classic": "Classic Trešeta",
      "mode.seres": "Trešeta Sereš u Manje",
      "mode.classicDescription":
        "Classic Trešeta for four players split into two teams.",
      "mode.seresDescription":
        "A 3–5 player free-for-all. Collect as few points as possible; the first player to reach 41 loses. You may play any suit and bluff an akuža, but a successful Sereš call gives 11 penalty points and ends the hand.",
      "mode.classicRankedNote":
        "A ranked room requires four signed-in players. Akuža is enabled and signals are disabled.",
      "mode.classicRankedFourOnly":
        "Ranked Classic Trešeta is currently available only for 4 players.",
      "mode.seresRankedNote":
        "Ranked Sereš u Manje uses a separate MMR and requires {players} signed-in players.",
      "lobby.akuzaDeclaration": "Akuža declaration",
      "lobby.akuzaSpecific": "Specific",
      "lobby.akuzaValueOnly": "Value only",
      "lobby.akuzaSpecificHelp":
        "Players must declare which akuža they claim.",
      "lobby.akuzaValueOnlyHelp":
        "Players declare only the total, such as -3, -8, or -12.",
      "lobby.seresDealStyle": "3-player deal style",
      "lobby.seresDeal13": "13 cards + 1 hidden discard",
      "lobby.seresDeal12": "12 cards + remove all 4s",
      "lobby.seresDealHelp":
        "13 cards removes one unknown card. 12 cards removes all four 4s.",
      "game.room": "Room",
      "game.copy": "Copy",
      "game.copyInvite": "Copy invite",
      "game.leave": "Leave",
      "game.score": "Score",
      "game.individualScore": "Individual score",
      "game.capturedMaestral": "Tricks won by Team Maestral",
      "game.capturedBura": "Tricks won by Team Bura",
      "game.currentTrick": "Current trick",
      "game.lobby": "Lobby",
      "game.waitingPlayers": "Waiting for players",
      "game.welcome": "Welcome to the table.",
      "game.waitingMore": "Waiting for more players…",
      "game.start": "Start match",
      "game.akuzaInHand": "Akuža in hand",
      "game.declareAkuza": "Declare akuža",
      "game.yourAkuzaTurn": "Your akuža turn",
      "game.akuzaBluff": "You may declare a real akuža or bluff.",
      "game.prepareAkuza": "Prepare akuža",
      "game.prepareAkuzaHint":
        "You can prepare a selection now; confirm unlocks on your turn.",
      "game.waitAkuzaTurn": "Wait for your turn",
      "game.pass": "Continue / Pass",
      "game.openAkuza": "Declared akuža",
      "seresReveal.label": "Revealed hand",
      "seresReveal.title": "{player} shows their hand",
      "seresReveal.trickProof": "Highlighted cards show the player had the led suit.",
      "seresReveal.trickNoProof": "There are no led-suit cards in the hand.",
      "seresReveal.akuzaProof": "Highlighted cards prove the declared akuža.",
      "seresReveal.akuzaNoProof": "The hand cannot make the declared akuža.",
      "game.kaputChoiceTitle": "Kaput! Choose your reward",
      "game.kaputChoicePrompt":
        "You took 10 or more points. Choose your reward.",
      "game.kaputWaiting": "Waiting for {player} to choose a Kaput reward.",
      "game.kaputRemove": "Remove 11 from my score",
      "game.kaputGiveOthers": "Give everyone else 10 points",
      "game.signalBeforeLead": "Signal before leading",
      "game.yourCards": "Your cards",
      "game.lowerIsBetter": "lower is better",
      "game.higherIsBetter": "higher is better",
      "game.playerFallback": "Player",
      "game.ledSuit": "Led suit: {suit}",
      "game.publicView": "You are watching the public game state",
      "game.akuzaTurn": "Akuža phase · {player}'s turn",
      "game.waitingChallenge": "Waiting for Continue / Sereš responses",
      "game.decides": "{player} decides: Continue or Sereš",
      "game.waitingAnswer": "Waiting for a response",
      "game.trickResolving": "Resolving the trick…",
      "game.autoFinalTrick": "The final trick is played automatically.",
      "game.yourTurn": "Your turn—choose a highlighted card",
      "game.playerTurn": "{player}'s turn",
      "game.tableOccupied":
        "{occupied}/{target} players are seated. Share code {code}.",
      "game.waitingReturn":
        "The table is full, but we are waiting for {count} to return.",
      "game.tableReady": "The table is full. The host can deal the cards.",
      "game.handAkuza": "Hand {hand} · akuža phase",
      "game.handKaput": "Hand {hand} · Kaput",
      "game.handTrick": "Hand {hand} · trick {trick}/{total}",
      "game.responseSeconds": "{seconds}s to respond",
      "game.akuzaOn": "Akuža enabled",
      "game.akuzaOff": "No akuža",
      "game.signalsOn": "Signals enabled",
      "game.signalsOff": "No signals",
      "game.akuzaDeclaredTotal": "Declared total: {total}",
      "game.akuzaSelectHint": "Select one or more akužas.",
      "game.stockCount": "Stock: {count}",
      "game.dealNoFours": "no fours",
      "game.akuzaValueOnly": "akuža: value only",
      "game.akuzaSpecific": "akuža: specific",
      "game.drawLog": "{player} drew {card}.",
      "team.maestral": "Team Maestral",
      "team.bura": "Team Bura",
      "team.northSouth": "North + South",
      "team.eastWest": "East + West",
      "seat.north": "North",
      "seat.east": "East",
      "seat.south": "South",
      "seat.west": "West",
      "seat.anchor": "Anchor",
      "seat.free": "{seat} · free",
      "seat.you": "you",
      "seat.account": "account",
      "seat.away": "away",
      "seat.dealer": "Dealer",
      "suit.coins": "Coins",
      "suit.cups": "Cups",
      "suit.swords": "Swords",
      "suit.clubs": "Clubs",
      "signal.busso": "Busso",
      "signal.striscio": "Striscio",
      "signal.volo": "Volo",
      "score.handSummary": "Hand summary",
      "score.handEnded": "Hand ended",
      "score.nextHand": "Deal a new hand",
      "score.newMatch": "New match",
      "score.loser": "{player} reached 41 and loses",
      "score.totalPoints": "Total points",
      "score.loserLabel": "LOSER",
      "score.hostNewMatch": "The host can start a new match.",
      "score.teamWins": "Team {team} wins the match",
      "score.playerWins": "{player} wins the match",
      "score.handNumberEnded": "Hand {hand} ended",
      "score.cards": "Cards",
      "score.lastTrick": "Last trick",
      "score.totalInHand": "Hand total",
      "score.waitingHost": "Waiting for the host to deal a new hand.",
      "profile.playerProfile": "Player profile",
      "profile.privatePartnership": "Private partnership rating",
      "profile.duoExplanation": "Each partner has a separate shared rating",
      "profile.last50": "Last 50",
      "profile.matchHistory": "Match history",
      "profile.startingRating": "Starting rating 1000",
      "profile.separateSeres": "Separate Sereš u Manje ranking",
      "profile.winsPercent": "{percent}% wins",
      "profile.rankedGames": "{count} ranked matches",
      "profile.games": "{count} matches",
      "profile.noDuos":
        "You have no repeated ranked partnerships yet.",
      "profile.loss": "Loss",
      "profile.victory": "Win",
      "profile.modePlayers": "Trešeta Sereš u Manje · {players}",
      "profile.noMmr": "No MMR",
      "profile.withAgainst": "With {partner} against {opponents}",
      "profile.noHistory": "Your match history is empty.",
      "rules.open": "How to play",
      "rules.title": "Rules",
      "rules.quickGuide": "Quick guide",
      "rules.heading": "How to play Trešeta",
      "rules.goalTitle": "1. Goal",
      "rules.goal":
        "Partners sit opposite each other. The first team to reach 41 points wins.",
      "rules.cardsTitle": "2. Card strength",
      "rules.cards":
        "<b>3, 2, Ace, King, Horse, Jack, 7, 6, 5, 4.</b> There are no trumps.",
      "rules.followTitle": "3. Following suit",
      "rules.follow":
        "You must follow the suit of the first card if you can. Otherwise, you may play any card.",
      "rules.pointsTitle": "4. Points",
      "rules.points":
        "An ace is worth 1 point; threes, twos, and face cards are worth ⅓ point. The last trick adds 1 point.",
      "rules.akuzaTitle": "5. Akuža",
      "rules.akuza":
        "Before playing your first card, you may declare three or four aces, twos, or threes, or A–2–3 of one suit.",
      "rules.signalsTitle": "6. Signals",
      "rules.signals":
        "When enabled, Busso, Striscio, and Volo are available only before leading a trick.",
      "rules.seres":
        "A 3–5 player free-for-all. Collect as few points as possible; the first player to reach 41 loses.",
      "rules.seresAkuzaTitle": "Sereš and akuža",
      "rules.seresAkuza":
        "You may play any suit and bluff an akuža declaration. A correct Sereš call gives the bluffer 11 penalty points; an incorrect call gives the caller 11. In either case, the hand ends immediately.",
      "toast.inviteCopied": "Invite copied.",
      "toast.roomCode": "Room code: {code}",
      "toast.disconnected": "Connection lost. Trying to reconnect…",
      "generic.requestFailed": "Request failed.",
      "generic.somethingWrong": "Something went wrong.",
      "challenge.akuza":
        "{player} declared {claim}. Continue or call Sereš · {seconds}s",
      "challenge.offSuit":
        "{player} did not follow suit · {seconds}s to Continue or call Sereš",
      "server.tableFilling": "Waiting for the table to fill.",
      "server.firstAkuza": "{player} is first to declare akuža.",
      "server.newHandAkuza":
        "A new hand was dealt; {player} is next to declare akuža.",
      "server.opensHand": "{player} leads the hand.",
      "server.declaresPoints": "{player} declares an akuža worth {points} points.",
      "server.declaresChallenge":
        "{player} declares an akuža. Waiting for Continue or Sereš.",
      "server.opensFirstTrick": "{player} leads the first trick.",
      "server.akuzaTurn": "{player}'s turn to declare akuža.",
      "server.akuzaAccepted":
        "{player}'s akuža was accepted and subtracts {points} points.",
      "server.waitingDecision": "Waiting for {player} to choose Continue or Sereš.",
      "server.offSuitDecision":
        "{player} plays off suit. {responder} decides: Continue or Sereš.",
      "server.playsCard": "{player} plays a card.",
      "server.takesTrick": "{player} takes the trick.",
      "server.decides": "{player} decides: Continue or Sereš.",
      "server.turn": "{player}'s turn.",
      "server.handEnded": "Hand {hand} ended.",
      "server.teamWins": "Team {team} wins the match!",
      "server.opensNewTrick": "{player} leads a new trick.",
      "server.reachedFromTrick": "{player} reached 41 with trick points.",
      "server.normalHand": "Hand {hand} ended normally. Points were counted.",
      "server.noOneReached": "No player reached 41.",
      "server.losesMatch": "{player} reached 41 and loses the match.",
      "server.seresAkuzaCorrect":
        "{caller} calls Sereš on {accused}'s akuža! {accused} did not have it and receives {points} points. The hand is over.",
      "server.seresAkuzaWrong":
        "{caller} calls Sereš on {accused}'s akuža! The call was wrong, so {caller} receives {points} points. The hand is over.",
      "server.seresPlayCorrect":
        "{caller} calls Sereš on {accused}! {accused} had the led suit and receives {points} points. The hand is over.",
      "server.seresPlayWrong":
        "{caller} calls Sereš on {accused}! The call was wrong, so {caller} receives {points} points. The hand is over.",
      "server.kaputPending":
        "Kaput! {player} took 10 or more points. Waiting for the reward choice.",
      "server.kaputRemove":
        "{player} made Kaput and removed 11 points.",
      "server.kaputGive":
        "{player} made Kaput and gave everyone else 10 points.",
      "noun.player.one": "{count} player",
      "noun.player.few": "{count} players",
      "noun.player.many": "{count} players",
      "noun.card.one": "{count} card",
      "noun.card.few": "{count} cards",
      "noun.card.many": "{count} cards",
      "noun.point.one": "{count} point",
      "noun.point.few": "{count} points",
      "noun.point.many": "{count} points",
      "noun.match.one": "{count} match",
      "noun.match.few": "{count} matches",
      "noun.match.many": "{count} matches",
      "noun.rankedMatch.one": "{count} ranked match",
      "noun.rankedMatch.few": "{count} ranked matches",
      "noun.rankedMatch.many": "{count} ranked matches",
    },
  };

  const supported = ["hr", "it", "en"];
  const browserLanguage = String(navigator.language || "").slice(0, 2);
  let language =
    localStorage.getItem("tresetaLanguage") ||
    (supported.includes(browserLanguage) ? browserLanguage : "hr");

  function interpolate(template, params = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_match, key) =>
      params[key] === undefined ? `{${key}}` : String(params[key])
    );
  }

  function t(key, params = {}) {
    const value =
      dictionaries[language]?.[key] ??
      dictionaries.hr[key] ??
      key;
    return interpolate(value, params);
  }

  function pluralForm(count) {
    if (language !== "hr") return count === 1 ? "one" : "many";
    const last = Math.abs(count) % 10;
    const lastTwo = Math.abs(count) % 100;
    if (last === 1 && lastTwo !== 11) return "one";
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
      return "few";
    }
    return "many";
  }

  function count(noun, value) {
    return t(`noun.${noun}.${pluralForm(value)}`, { count: value });
  }

  function locale() {
    return { hr: "hr-HR", it: "it-IT", en: "en-GB" }[language];
  }

  function translateDocument() {
    document.documentElement.lang = language;
    document.title = "Trešeta Online";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml);
    });
    [
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-title", "title"],
      ["data-i18n-aria-label", "aria-label"],
      ["data-i18n-content", "content"],
    ].forEach(([dataAttribute, attribute]) => {
      document.querySelectorAll(`[${dataAttribute}]`).forEach((element) => {
        element.setAttribute(
          attribute,
          t(element.getAttribute(dataAttribute))
        );
      });
    });
    document.querySelectorAll(".language-select").forEach((select) => {
      select.value = language;
    });
  }

  function setLanguage(nextLanguage) {
    if (!supported.includes(nextLanguage) || nextLanguage === language) return;
    language = nextLanguage;
    localStorage.setItem("tresetaLanguage", language);
    translateDocument();
    document.dispatchEvent(
      new CustomEvent("treseta:languagechange", { detail: { language } })
    );
  }

  const exactErrors = {
    "Morate biti prijavljeni.": {
      it: "Devi aver effettuato l'accesso.",
      en: "You must be signed in.",
    },
    "Baza podataka nije dostupna.": {
      it: "Il database non è disponibile.",
      en: "The database is unavailable.",
    },
    "Upišite nadimak.": {
      it: "Inserisci un soprannome.",
      en: "Enter a nickname.",
    },
    "Najprije se pridružite sobi.": {
      it: "Entra prima in una stanza.",
      en: "Join a room first.",
    },
    "Soba više ne postoji.": {
      it: "La stanza non esiste più.",
      en: "The room no longer exists.",
    },
    "Reakcija je prevelika ili nije valjana.": {
      it: "La reazione è troppo grande o non valida.",
      en: "The reaction is too large or invalid.",
    },
    "Soba s tim kodom ne postoji.": {
      it: "Non esiste una stanza con questo codice.",
      en: "No room exists with that code.",
    },
    "Prijavite se na račun koji pripada ovom mjestu.": {
      it: "Accedi all'account associato a questo posto.",
      en: "Sign in to the account assigned to this seat.",
    },
    "Taj račun je već za stolom.": {
      it: "Questo account è già al tavolo.",
      en: "That account is already at the table.",
    },
    "Za rangiranu sobu morate biti prijavljeni.": {
      it: "Devi accedere per entrare in una stanza classificata.",
      en: "You must sign in for a ranked room.",
    },
    "Samo domaćin može to učiniti.": {
      it: "Solo l'host può farlo.",
      en: "Only the host can do that.",
    },
    "Niste igrač za ovim stolom.": {
      it: "Non sei un giocatore a questo tavolo.",
      en: "You are not a player at this table.",
    },
    "Nova ruka sada nije dostupna.": {
      it: "Non è possibile distribuire una nuova mano adesso.",
      en: "A new hand is not available right now.",
    },
    "Nova partija sada nije dostupna.": {
      it: "Non è possibile iniziare una nuova partita adesso.",
      en: "A new match is not available right now.",
    },
    "Svi igrači moraju biti spojeni.": {
      it: "Tutti i giocatori devono essere connessi.",
      en: "All players must be connected.",
    },
    "Svi igrači moraju biti povezani.": {
      it: "Tutti i giocatori devono essere connessi.",
      en: "All players must be connected.",
    },
    "Svi igrači u rangiranoj partiji moraju imati različite prijavljene račune.": {
      it: "Tutti i giocatori di una partita classificata devono usare account autenticati distinti.",
      en: "Every player in a ranked match must use a distinct signed-in account.",
    },
    "Akuža je isključena u ovoj sobi.": {
      it: "L'akuža è disattivata in questa stanza.",
      en: "Akuža is disabled in this room.",
    },
    "Ruka nije u tijeku.": {
      it: "La mano non è in corso.",
      en: "No hand is in progress.",
    },
    "Zadnji štih se igra automatski.": {
      it: "L'ultima presa viene giocata automaticamente.",
      en: "The final trick is played automatically.",
    },
    "Akužu morate prijaviti prije prve karte.": {
      it: "Devi dichiarare l'akuža prima della tua prima carta.",
      en: "You must declare akuža before your first card.",
    },
    "Akuža je već prijavljena.": {
      it: "L'akuža è già stata dichiarata.",
      en: "Akuža has already been declared.",
    },
    "Ova ruka nema valjanu akužu.": {
      it: "Questa mano non contiene un'akuža valida.",
      en: "This hand has no valid akuža.",
    },
    "Faza akuže nije u tijeku.": {
      it: "La fase akuža non è in corso.",
      en: "The akuža phase is not active.",
    },
    "Čeka se Nastavi ili Sereš za trenutnu akužu.": {
      it: "In attesa di Continua o Sereš per l'akuža attuale.",
      en: "Waiting for Continue or Sereš on the current akuža.",
    },
    "Prijave akuže su završene.": {
      it: "Le dichiarazioni di akuža sono terminate.",
      en: "Akuža declarations are finished.",
    },
    "Sereš na akužu nije dostupan tijekom prijava.": {
      it: "Sereš sull'akuža non è disponibile durante le dichiarazioni.",
      en: "Sereš on akuža is not available during declarations.",
    },
    "Niste na redu za akužu.": {
      it: "Non è il tuo turno per l'akuža.",
      en: "It is not your akuža turn.",
    },
    "Odaberite valjanu vrstu akuže.": {
      it: "Scegli un tipo di akuža valido.",
      en: "Choose a valid akuža type.",
    },
    "Nema akuže koja čeka odgovor.": {
      it: "Non c'è alcuna akuža in attesa di risposta.",
      en: "No akuža is awaiting a response.",
    },
    "Ne možete odgovoriti na vlastitu akužu.": {
      it: "Non puoi rispondere alla tua akuža.",
      en: "You cannot respond to your own akuža.",
    },
    "Drugi igrač je trenutno na redu za odgovor.": {
      it: "Tocca a un altro giocatore rispondere.",
      en: "Another player is currently responding.",
    },
    "Već ste odgovorili na ovu akužu.": {
      it: "Hai già risposto a questa akuža.",
      en: "You already responded to this akuža.",
    },
    "Nepoznat odgovor na akužu.": {
      it: "Risposta all'akuža sconosciuta.",
      en: "Unknown akuža response.",
    },
    "Nepoznat odgovor.": {
      it: "Risposta sconosciuta.",
      en: "Unknown response.",
    },
    "Signali su isključeni u ovoj sobi.": {
      it: "I segnali sono disattivati in questa stanza.",
      en: "Signals are disabled in this room.",
    },
    "Nepoznat signal.": {
      it: "Segnale sconosciuto.",
      en: "Unknown signal.",
    },
    "Signal je dopušten samo jednom, prije izlazne karte.": {
      it: "È consentito un solo segnale prima della carta d'uscita.",
      en: "Only one signal is allowed before leading.",
    },
    "Pričekajte završetak štiha.": {
      it: "Attendi la conclusione della presa.",
      en: "Wait for the trick to finish.",
    },
    "Niste na redu.": {
      it: "Non è il tuo turno.",
      en: "It is not your turn.",
    },
    "Ta karta nije u vašoj ruci.": {
      it: "Quella carta non è nella tua mano.",
      en: "That card is not in your hand.",
    },
    "Morate pratiti boju.": {
      it: "Devi rispondere al seme.",
      en: "You must follow suit.",
    },
    "Sereš sada nije dostupan.": {
      it: "Sereš non è disponibile adesso.",
      en: "Sereš is not available right now.",
    },
    "Nema valjane prilike za Sereš.": {
      it: "Non c'è una situazione valida per Sereš.",
      en: "There is no valid Sereš opportunity.",
    },
    "Ne možete zvati Sereš na sebe.": {
      it: "Non puoi chiamare Sereš su te stesso.",
      en: "You cannot call Sereš on yourself.",
    },
    "Ta akuža više nije otvorena za Sereš.": {
      it: "Quell'akuža non può più essere contestata con Sereš.",
      en: "That akuža is no longer open to a Sereš call.",
    },
    "Sereš se može zvati samo na posljednju odigranu kartu.": {
      it: "Sereš può essere chiamato solo sull'ultima carta giocata.",
      en: "Sereš can only be called on the most recently played card.",
    },
    "Kaput izbor sada nije dostupan.": {
      it: "La scelta Kaput non è disponibile adesso.",
      en: "The Kaput choice is not available right now.",
    },
    "Samo igrač koji je napravio Kaput može odabrati nagradu.": {
      it: "Solo il giocatore che ha fatto Kaput può scegliere la ricompensa.",
      en: "Only the player who made Kaput can choose the reward.",
    },
    "Odaberite valjanu Kaput nagradu.": {
      it: "Scegli una ricompensa Kaput valida.",
      en: "Choose a valid Kaput reward.",
    },
    "Rangirana partija zahtijeva prijavljene igrače.": {
      it: "Una partita classificata richiede giocatori autenticati.",
      en: "A ranked match requires signed-in players.",
    },
    "Rangirana partija zahtijeva četiri prijavljena igrača.": {
      it: "Una partita classificata richiede quattro giocatori autenticati.",
      en: "A ranked match requires four signed-in players.",
    },
    "Rezultat prethodne partije još se sprema.": {
      it: "Il risultato della partita precedente è ancora in salvataggio.",
      en: "The previous match result is still being saved.",
    },
    "Pogrešno korisničko ime ili lozinka.": {
      it: "Nome utente o password errati.",
      en: "Incorrect username or password.",
    },
    "To korisničko ime je već zauzeto.": {
      it: "Questo nome utente è già in uso.",
      en: "That username is already taken.",
    },
    "Korisničko ime mora imati 3–20 slova, brojeva, _ ili -.": {
      it: "Il nome utente deve contenere 3–20 lettere, numeri, _ o -.",
      en: "The username must contain 3–20 letters, numbers, _ or -.",
    },
    "Lozinka mora imati između 8 i 128 znakova.": {
      it: "La password deve contenere tra 8 e 128 caratteri.",
      en: "The password must be between 8 and 128 characters.",
    },
  };

  function translateError(message) {
    if (!message || language === "hr") return message;
    if (exactErrors[message]?.[language]) return exactErrors[message][language];
    let match = message.match(/^Za početak su potrebna (\d+) igrača\.$/);
    if (match) {
      return language === "it"
        ? `Servono ${match[1]} giocatori.`
        : `${match[1]} players are required.`;
    }
    match = message.match(/^Svih (\d+) igrača mora biti spojeno\.$/);
    if (match) {
      return language === "it"
        ? `Tutti e ${match[1]} i giocatori devono essere connessi.`
        : `All ${match[1]} players must be connected.`;
    }
    match = message.match(
      /^Rangirana partija zahtijeva (\d+) različitih prijavljenih računa\.$/
    );
    if (match) {
      return language === "it"
        ? `Una partita classificata richiede ${match[1]} account autenticati distinti.`
        : `A ranked match requires ${match[1]} distinct signed-in accounts.`;
    }
    return message;
  }

  const messagePatterns = [
    [/^Čeka se da se stol popuni\.$/, "server.tableFilling", []],
    [/^(.+) je prvi na redu za akužu\.$/, "server.firstAkuza", ["player"]],
    [
      /^Nova ruka je podijeljena; (.+) je na redu za akužu\.$/,
      "server.newHandAkuza",
      ["player"],
    ],
    [/^(.+) otvara ruku\.$/, "server.opensHand", ["player"]],
    [
      /^(.+) prijavljuje akužu za (\d+) boda\.$/,
      "server.declaresPoints",
      ["player", "points"],
    ],
    [
      /^(.+) prijavljuje akužu\. Čekaju se odgovori: Nastavi ili Sereš\.$/,
      "server.declaresChallenge",
      ["player"],
    ],
    [/^(.+) otvara prvi štih\.$/, "server.opensFirstTrick", ["player"]],
    [/^(.+) je na redu za akužu\.$/, "server.akuzaTurn", ["player"]],
    [
      /^Akuža igrača (.+) prihvaćena je i oduzima (\d+) boda\.$/,
      "server.akuzaAccepted",
      ["player", "points"],
    ],
    [
      /^Čeka se da (.+) odabere Nastavi ili Sereš\.$/,
      "server.waitingDecision",
      ["player"],
    ],
    [
      /^(.+) igra drugu boju\. (.+) odlučuje: Nastavi ili Sereš\.$/,
      "server.offSuitDecision",
      ["player", "responder"],
    ],
    [/^(.+) igra kartu\.$/, "server.playsCard", ["player"]],
    [/^(.+) uzima štih\.$/, "server.takesTrick", ["player"]],
    [/^(.+) odlučuje: Nastavi ili Sereš\.$/, "server.decides", ["player"]],
    [/^(.+) je na redu\.$/, "server.turn", ["player"]],
    [/^Ruka (\d+) je završena\.$/, "server.handEnded", ["hand"]],
    [/^Ekipa (\d+) osvaja partiju!$/, "server.teamWins", ["team"]],
    [/^(.+) otvara novi štih\.$/, "server.opensNewTrick", ["player"]],
    [
      /^(.+) dosegao je 41 bod bodovima iz štiha\.$/,
      "server.reachedFromTrick",
      ["player"],
    ],
    [
      /^Ruka (\d+) završila je uobičajeno\. Bodovi su obračunani\.$/,
      "server.normalHand",
      ["hand"],
    ],
    [/^Nitko nije dosegao 41 bod\.$/, "server.noOneReached", []],
    [
      /^(.+) dosegao je 41 bod i gubi partiju\.$/,
      "server.losesMatch",
      ["player"],
    ],
    [
      /^(.+) zove Sereš na akužu igrača (.+)! (.+) nije imao tu akužu i dobiva ([\d/ ]+) bodova\. Ruka je završena\.$/,
      "server.seresAkuzaCorrect",
      ["caller", "accused", "ignored", "points"],
    ],
    [
      /^(.+) zove Sereš na akužu igrača (.+)! Poziv nije bio točan pa (.+) dobiva ([\d/ ]+) bodova\. Ruka je završena\.$/,
      "server.seresAkuzaWrong",
      ["caller", "accused", "ignored", "points"],
    ],
    [
      /^(.+) zove Sereš na igrača (.+)! (.+) imao je traženu boju i dobiva ([\d/ ]+) bodova\. Ruka je završena\.$/,
      "server.seresPlayCorrect",
      ["caller", "accused", "ignored", "points"],
    ],
    [
      /^(.+) zove Sereš na igrača (.+)! Poziv nije bio točan pa (.+) dobiva ([\d/ ]+) bodova\. Ruka je završena\.$/,
      "server.seresPlayWrong",
      ["caller", "accused", "ignored", "points"],
    ],
    [
      /^Kaput! (.+) je uzeo 10 ili više bodova\. Čeka se izbor nagrade\.$/,
      "server.kaputPending",
      ["player"],
    ],
    [
      /^(.+) je napravio Kaput i skinuo 11 bodova\.$/,
      "server.kaputRemove",
      ["player"],
    ],
    [
      /^(.+) je napravio Kaput i dao svima ostalima 10 bodova\.$/,
      "server.kaputGive",
      ["player"],
    ],
  ];

  function translateServerText(message) {
    if (!message || language === "hr") return message;

    const compoundPatterns = [
      [
        /^(.+) zove Sereš na akužu igrača (.+)! (.+) nije imao tu akužu i dobiva ([\d/ ]+) bodova\. Ruka je završena\.\s*(.*)$/,
        "server.seresAkuzaCorrect",
        ["caller", "accused", "ignored", "points", "rest"],
      ],
      [
        /^(.+) zove Sereš na akužu igrača (.+)! Poziv nije bio točan pa (.+) dobiva ([\d/ ]+) bodova\. Ruka je završena\.\s*(.*)$/,
        "server.seresAkuzaWrong",
        ["caller", "accused", "ignored", "points", "rest"],
      ],
      [
        /^(.+) zove Sereš na igrača (.+)! (.+) imao je traženu boju i dobiva ([\d/ ]+) bodova\. Ruka je završena\.\s*(.*)$/,
        "server.seresPlayCorrect",
        ["caller", "accused", "ignored", "points", "rest"],
      ],
      [
        /^(.+) zove Sereš na igrača (.+)! Poziv nije bio točan pa (.+) dobiva ([\d/ ]+) bodova\. Ruka je završena\.\s*(.*)$/,
        "server.seresPlayWrong",
        ["caller", "accused", "ignored", "points", "rest"],
      ],
      [
        /^(.+) je napravio Kaput i skinuo 11 bodova\.\s*(.*)$/,
        "server.kaputRemove",
        ["player", "rest"],
      ],
      [
        /^(.+) je napravio Kaput i dao svima ostalima 10 bodova\.\s*(.*)$/,
        "server.kaputGive",
        ["player", "rest"],
      ],
      [
        /^Akuža igrača (.+) prihvaćena je i oduzima (\d+) boda\.\s*(.*)$/,
        "server.akuzaAccepted",
        ["player", "points", "rest"],
      ],
      [
        /^Ruka (\d+) završila je uobičajeno\. Bodovi su obračunani\.\s*(.*)$/,
        "server.normalHand",
        ["hand", "rest"],
      ],
    ];
    for (const [pattern, key, names] of compoundPatterns) {
      const match = message.match(pattern);
      if (!match) continue;
      const params = {};
      let rest = "";
      names.forEach((name, index) => {
        if (name === "rest") rest = match[index + 1];
        else if (name !== "ignored") params[name] = match[index + 1];
      });
      return `${t(key, params)}${
        rest ? ` ${translateServerText(rest)}` : ""
      }`;
    }

    for (const [pattern, key, names] of messagePatterns) {
      const match = message.match(pattern);
      if (!match) continue;
      const params = {};
      names.forEach((name, index) => {
        if (name !== "ignored") params[name] = match[index + 1];
      });
      return t(key, params);
    }

    const signalMatch = message.match(/^(.+): (Tučem \/ Busso|Strišo \/ Striscio|Volo)$/);
    if (signalMatch) {
      const signalKey = signalMatch[2].startsWith("Tučem")
        ? "signal.busso"
        : signalMatch[2].startsWith("Strišo")
        ? "signal.striscio"
        : "signal.volo";
      return `${signalMatch[1]}: ${t(signalKey)}`;
    }

    const segments = message.split(/(?<=\.)\s+/);
    if (segments.length > 1) {
      return segments.map(translateServerText).join(" ");
    }
    return message;
  }

  function akuzaLabel(item) {
    if (!item?.id) return item?.label || "";
    const parts = item.id.split("-");
    if (parts[0] === "rank") {
      const rank = parts[1];
      const amount = Number(parts[2] || item.cards?.length || 3);
      const names = {
        hr: { ace: "asa", "2": "dvojke", "3": "trice" },
        it: { ace: "assi", "2": "due", "3": "tre" },
        en: { ace: "aces", "2": "twos", "3": "threes" },
      };
      return `${amount} ${names[language][rank]}`;
    }
    if (parts[0] === "napolitana") {
      const suit = parts[1];
      return `A–2–3 ${t(`suit.${suit}`).toLocaleLowerCase(locale())}`;
    }
    return item.label || "";
  }

  function signalLabel(type, fallback = "") {
    return type ? t(`signal.${type}`) : fallback;
  }

  function isAuthenticationError(message) {
    return [
      "Morate biti prijavljeni.",
      "Za rangiranu sobu morate biti prijavljeni.",
    ].some((value) => message === value || message?.includes(value));
  }

  document.querySelectorAll(".language-select").forEach((select) => {
    select.addEventListener("change", () => setLanguage(select.value));
  });
  translateDocument();

  window.TresetaI18n = {
    t,
    count,
    locale,
    getLanguage: () => language,
    setLanguage,
    translateDocument,
    translateError,
    translateServerText,
    akuzaLabel,
    signalLabel,
    isAuthenticationError,
    hasTranslation: (key, targetLanguage = language) =>
      Object.prototype.hasOwnProperty.call(
        dictionaries[targetLanguage] || {},
        key
      ),
  };
})();
