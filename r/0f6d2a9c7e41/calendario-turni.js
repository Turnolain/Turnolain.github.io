/*
 * Motore calendario comune ad Attilio Smart e Ruota Virtuale.
 *
 * Il modulo e' volutamente puro: non legge DOM, rete, localStorage, Android,
 * PIN o orologio globale. Riceve sempre data, deposito, posizione e
 * riferimento; per questo puo' essere provato anche su date storiche,
 * capodanno, ora legale e settimane precedenti al riferimento.
 */
(function (radice, crea) {
  var api = crea();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (radice) radice.CalendarioTurni = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LAVORO = 'lavoro';
  var RIPOSO = 'riposo';
  var SCOMPUTO = 'sco';
  var MATTO = 'matto';
  var SURROGA = 'surroga';
  var ASSENZA = 'assenza';
  var SCONOSCIUTO = 'sconosciuto';

  var SCHEMI = {
     1: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,LAVORO],
     2: [LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO],
     3: [LAVORO,LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO],
     4: [LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO,LAVORO],
     5: [LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO,LAVORO,LAVORO],
     6: SURROGA,
     7: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,SCOMPUTO,RIPOSO],
     8: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,SCOMPUTO],
     9: [LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO],
    10: [LAVORO,LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO],
    11: [LAVORO,LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO,LAVORO],
    12: [LAVORO,RIPOSO,LAVORO,LAVORO,LAVORO,LAVORO,LAVORO],
    13: SURROGA,
    14: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,RIPOSO],
    15: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,SCOMPUTO,RIPOSO],
    16: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,SCOMPUTO],
    17: [LAVORO,LAVORO,LAVORO,LAVORO,LAVORO,RIPOSO,RIPOSO]
  };

  function dataCivile(valore) {
    if (valore instanceof Date && !isNaN(valore.getTime()))
      return new Date(valore.getFullYear(), valore.getMonth(), valore.getDate());
    var testo = String(valore || '');
    var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(testo);
    if (iso) return nuovaData(+iso[1], +iso[2] - 1, +iso[3]);
    var ita = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(testo);
    if (ita) return nuovaData(+ita[3], +ita[2] - 1, +ita[1]);
    return null;
  }

  function nuovaData(anno, mese, giorno) {
    var d = new Date(anno, mese, giorno);
    return d.getFullYear() === anno && d.getMonth() === mese && d.getDate() === giorno ? d : null;
  }

  function lunediDi(valore) {
    var d = dataCivile(valore);
    if (!d) return null;
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function spostaGiorni(valore, quanti) {
    var d = dataCivile(valore);
    if (!d || !isFinite(quanti)) return null;
    d.setDate(d.getDate() + Number(quanti));
    return d;
  }

  function giornoUTC(valore) {
    var d = dataCivile(valore);
    return d ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) : NaN;
  }

  function settimaneTra(riferimento, valore) {
    var a = lunediDi(riferimento), b = lunediDi(valore);
    if (!a || !b) return null;
    return Math.round((giornoUTC(b) - giornoUTC(a)) / 604800000);
  }

  function siglaDeposito(deposito) {
    return String(deposito && deposito.sigla || deposito || '').toUpperCase();
  }

  function haRiposoMatto(deposito, posizione) {
    var sigla = siglaDeposito(deposito);
    return Number(posizione) % 100 === 14 && (sigla === 'PR' || sigla === 'GAL');
  }

  /* Restituisce i sette giorni della posizione. `stato` e' compatibile con
     la Ruota; `classe` e' la classificazione comune usata dai conteggi. */
  function settimanaPosizione(deposito, posizione) {
    posizione = Number(posizione);
    var finale = posizione % 100;
    var gruppo = Math.floor(posizione / 100);
    var schema = SCHEMI[finale];
    if (!schema || !gruppo) return null;
    var out = [];
    var i;
    if (schema === SURROGA) {
      out.push({ stato:RIPOSO, classe:RIPOSO, testo:'—', pos:null });
      for (i = 1; i <= 5; i++) {
        var coperta = gruppo * 100 + (finale - i);
        out.push({ stato:SURROGA, classe:LAVORO, testo:String(coperta), pos:coperta });
      }
      out.push({ stato:RIPOSO, classe:RIPOSO, testo:'—', pos:null });
      return out;
    }
    for (i = 0; i < 7; i++) {
      var stato = schema[i];
      /* Precotto/Gallaratese: il sabato delle finali 14 e' il riposo matto,
         ancora incerto finche' non verra' configurata la fase personale.
         Sesto/Bisceglie non alternano: 114 riposa e 214 lavora sempre. */
      if (i === 5 && haRiposoMatto(deposito, posizione)) stato = MATTO;
      if (i === 5 && (siglaDeposito(deposito) === 'SFS' || siglaDeposito(deposito) === 'BIS')) {
        if (posizione === 114) stato = RIPOSO;
        if (posizione === 214) stato = LAVORO;
      }
      out.push({
        stato: stato,
        classe: stato,
        testo: stato === RIPOSO ? '—' : (stato === SCOMPUTO ? 'SCO' : (stato === MATTO ? '?' : String(posizione))),
        pos: stato === LAVORO ? posizione : null
      });
    }
    return out;
  }

  function classificaPosizione(deposito, posizione, valore) {
    var d = dataCivile(valore);
    var settimana = settimanaPosizione(deposito, posizione);
    if (!d || !settimana) return { stato:SCONOSCIUTO, classe:SCONOSCIUTO, posizione:Number(posizione) || null };
    var indiceGiorno = (d.getDay() + 6) % 7;
    var voce = settimana[indiceGiorno];
    return {
      stato: voce.stato,
      classe: voce.classe,
      posizione: Number(posizione),
      posizioneCoperta: voce.pos,
      indiceGiorno: indiceGiorno
    };
  }

  function posizioneDaIndice(indice) {
    indice = Number(indice);
    if (!isFinite(indice) || indice < 0) return null;
    return (Math.floor(indice / 17) + 1) * 100 + (indice % 17) + 1;
  }

  function posizioneAllaData(posto, riferimento, valore) {
    if (!posto || !Number(posto.tot)) return null;
    var delta = settimaneTra(riferimento, valore);
    if (delta === null) return null;
    var totale = Number(posto.tot), base = Number(posto.base);
    var indice = ((base + delta) % totale + totale) % totale;
    return { indice:indice, posizione:posizioneDaIndice(indice), settimane:delta };
  }

  function isoData(valore) {
    var d = dataCivile(valore);
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* Identita' logica della regola personale. Non contiene la settimana di
     riferimento: se la Ruota viene traslata in modo coerente, la risposta
     dell'utente resta valida. La data ancora viene comunque ricontrollata
     contro la Ruota corrente prima di essere usata. */
  function identitaRiposoMatto(posto) {
    if (!posto || !Number(posto.tot)) return '';
    var sigla = siglaDeposito(posto.sigla);
    return 'm1:' + sigla + ':' + Number(posto.tot) + ':finale14';
  }

  function configurazioneRiposoMattoValida(config, posto, riferimento) {
    if (!config || !posto || !riferimento || Number(config.ruleVersion) !== 1) return false;
    var sigla = siglaDeposito(posto.sigla);
    if ((sigla !== 'PR' && sigla !== 'GAL') || siglaDeposito(config.depot) !== sigla) return false;
    if (config.anchorPhase !== 'work' && config.anchorPhase !== 'rest') return false;
    if (config.rotationIdentity && config.rotationIdentity !== identitaRiposoMatto(posto)) return false;
    var ancora = dataCivile(config.anchorDate);
    if (!ancora || ancora.getDay() !== 6) return false;
    return classificaDaRuota(posto, riferimento, ancora).classe === MATTO;
  }

  /* Ogni addetto PR/GAL incontra una finale 14 ogni 17 settimane. Il numero
     puo' essere negativo: il modulo normalizzato conserva l'alternanza anche
     per le occorrenze precedenti all'ancora. */
  function indiceRiposoMatto(config, posto, riferimento, valore) {
    if (!configurazioneRiposoMattoValida(config, posto, riferimento)) return null;
    var data = dataCivile(valore);
    if (!data || data.getDay() !== 6 || classificaDaRuota(posto, riferimento, data).classe !== MATTO) return null;
    var settimane = settimaneTra(config.anchorDate, data);
    if (settimane === null || settimane % 17 !== 0) return null;
    return settimane / 17;
  }

  function faseRiposoMatto(config, posto, riferimento, valore) {
    var indice = indiceRiposoMatto(config, posto, riferimento, valore);
    if (indice === null) return null;
    var pari = ((indice % 2) + 2) % 2 === 0;
    return pari ? config.anchorPhase : (config.anchorPhase === 'work' ? 'rest' : 'work');
  }

  function trovaRiposoMatto(posto, riferimento, valore, direzione, includiData) {
    var partenza = dataCivile(valore);
    if (!partenza || !posto || !riferimento) return null;
    direzione = Number(direzione) < 0 ? -1 : 1;
    var lunedi = lunediDi(partenza);
    for (var i = 0; i < 270; i++) {
      var sabato = spostaGiorni(lunedi, 5);
      var ammesso = includiData ? (direzione < 0 ? sabato <= partenza : sabato >= partenza)
                               : (direzione < 0 ? sabato < partenza : sabato > partenza);
      if (ammesso && classificaDaRuota(posto, riferimento, sabato).classe === MATTO) return sabato;
      lunedi = spostaGiorni(lunedi, direzione * 7);
    }
    return null;
  }

  function prossimiRiposiMatti(config, posto, riferimento, quanti, dopo) {
    if (!configurazioneRiposoMattoValida(config, posto, riferimento)) return [];
    var out = [], cursor = dataCivile(dopo || config.anchorDate);
    quanti = Math.max(0, Math.min(24, Number(quanti) || 0));
    while (out.length < quanti) {
      cursor = trovaRiposoMatto(posto, riferimento, cursor, 1, false);
      if (!cursor) break;
      out.push({ data:isoData(cursor), fase:faseRiposoMatto(config, posto, riferimento, cursor) });
    }
    return out;
  }

  function classificaDaRuota(posto, riferimento, valore, configMatto) {
    var p = posizioneAllaData(posto, riferimento, valore);
    if (!p) return { stato:SCONOSCIUTO, classe:SCONOSCIUTO, posizione:null };
    var risultato = classificaPosizione(posto.sigla, p.posizione, valore);
    risultato.indiceRuota = p.indice;
    risultato.settimane = p.settimane;
    if (risultato.classe === MATTO && configMatto) {
      var fase = faseRiposoMatto(configMatto, posto, riferimento, valore);
      if (fase) {
        risultato.matto = true;
        risultato.faseMatto = fase;
        risultato.stato = fase === 'work' ? LAVORO : RIPOSO;
        risultato.classe = risultato.stato;
      }
    }
    return risultato;
  }

  /* Modello composto predisposto per Ferie e Cambi. La previsione di Ruota
     resta sempre consultabile e separata dal dato ufficiale: un'assenza nota
     prevale nello stato operativo, ma non cancella la rotazione sottostante. */
  function classificaGiorno(dati) {
    dati = dati || {};
    var rotazione = dati.posto
      ? classificaDaRuota(dati.posto, dati.riferimento, dati.data, dati.riposoMatto)
      : classificaPosizione(dati.deposito, dati.posizione, dati.data);
    var assenza = dati.assenza || null;
    return {
      stato: assenza ? ASSENZA : rotazione.classe,
      previsione: rotazione.classe,
      dettaglioRotazione: rotazione.stato,
      posizione: rotazione.posizione,
      posizioneCoperta: rotazione.posizioneCoperta || null,
      assenza: assenza,
      ufficiale: dati.ufficiale || null
    };
  }

  function eLavoro(statoOClasse) {
    var v = typeof statoOClasse === 'object' && statoOClasse
      ? (statoOClasse.classe || statoOClasse.stato) : statoOClasse;
    return v === LAVORO || v === SURROGA;
  }

  return {
    STATI: { LAVORO:LAVORO, RIPOSO:RIPOSO, SCOMPUTO:SCOMPUTO, MATTO:MATTO,
             SURROGA:SURROGA, ASSENZA:ASSENZA, SCONOSCIUTO:SCONOSCIUTO },
    SCHEMI: SCHEMI,
    dataCivile: dataCivile,
    lunediDi: lunediDi,
    spostaGiorni: spostaGiorni,
    giornoUTC: giornoUTC,
    settimaneTra: settimaneTra,
    haRiposoMatto: haRiposoMatto,
    settimanaPosizione: settimanaPosizione,
    classificaPosizione: classificaPosizione,
    posizioneDaIndice: posizioneDaIndice,
    posizioneAllaData: posizioneAllaData,
    isoData: isoData,
    identitaRiposoMatto: identitaRiposoMatto,
    configurazioneRiposoMattoValida: configurazioneRiposoMattoValida,
    indiceRiposoMatto: indiceRiposoMatto,
    faseRiposoMatto: faseRiposoMatto,
    trovaRiposoMatto: trovaRiposoMatto,
    prossimiRiposiMatti: prossimiRiposiMatti,
    classificaDaRuota: classificaDaRuota,
    classificaGiorno: classificaGiorno,
    eLavoro: eLavoro
  };
});
