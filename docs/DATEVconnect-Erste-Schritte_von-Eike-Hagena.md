# 🟢 DATEVconnect – Dein erster Schritt in die API-Welt
### Ein Geschenk an Kolleginnen und Kollegen — von Eike Hagena, Steuerberater aus Ostfriesland

---

## 📌 Was ist das hier?

Diese Datei ist ein **Bauplan**. Du gibst sie in deine KI (Claude o.ä.), schreibst **ein einziges Wort** in den Chat:

> **Bau**

…und die KI erzeugt daraus eine **fertige, lauffähige HTML-Datei**. Du speicherst sie, öffnest sie im Browser auf einem Rechner, auf dem **DATEVconnect** läuft — und sie begrüßt dich mit deinem echten DATEV-Namen. Mit Konfetti. 🎉

Wenn etwas **nicht** auf Anhieb klappt (was bei DATEVconnect völlig normal ist), zeigt dir die HTML **selbst**, woran es liegt und wie du es löst. Kein Frust, sondern dein erster echter Lerneffekt an der DATEV-Schnittstelle.

**Es passiert nichts Gefährliches:** Die HTML liest **ausschließlich deinen eigenen Anmeldenamen** über die lokale DATEV-Schnittstelle. Keine Mandantendaten, kein Upload, keine Internetverbindung nötig, nichts wird gespeichert oder verschickt. Reiner Lese-Smoke-Test gegen `localhost`.

---

## 🛠️ ANWEISUNG AN DIE KI (das liest deine KI, nicht du)

> **Aufgabe:** Erzeuge **wortgetreu** die unten im Block `BAUPLAN-HTML` stehende HTML-Datei. Schreibe sie **1:1** als Datei `datev-erster-schritt.html` heraus — **nichts hinzufügen, nichts weglassen, nichts umformulieren**. Der HTML-Quelltext ist bereits vollständig und getestet. Gib die Datei danach zum Download/Speichern aus. Wenn der Anwender „Bau" schreibt, ist das deine einzige Aufgabe.

---

## 📋 So gehst du vor (für dich, den Menschen)

1. Diese ganze Datei in deine KI geben.
2. **„Bau"** schreiben.
3. Die erzeugte `datev-erster-schritt.html` speichern.
4. Doppelklick → öffnet im Browser.
5. Auf „Verbindung testen" klicken.

Läuft DATEVconnect korrekt → **dein Name + Konfetti.**
Läuft etwas noch nicht → **die HTML erklärt dir den Stolperstein.**

---

## ⚙️ Voraussetzungen (gut zu wissen, kein Muss zum Start)

- Ein Rechner, auf dem **DATEVconnect** installiert ist und der Dienst läuft.
- Du bist mit deinem **Windows-Konto** angemeldet (das ist deine Anmeldung — kein Passwort nötig, „Single Sign-On").
- Standardport ist **58454** (HTTP) bzw. **58452** (HTTPS). Falls bei euch ein anderer Port konfiguriert ist, kannst du ihn in der HTML oben eintragen.

---

```html
<!-- ====================== BAUPLAN-HTML ====================== -->
<!-- KI: Diese Datei exakt so als datev-erster-schritt.html herausschreiben. -->
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DATEVconnect – Dein erster Schritt | Eike Hagena</title>
<!-- Strikte CSP: keine externen Skripte, keine externen Fonts, kein eval. connect-src nur localhost (DATEVconnect). -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src http://localhost:58454 https://localhost:58452 http://127.0.0.1:58454 https://127.0.0.1:58452; base-uri 'none'; form-action 'none';">
<style>
  :root{
    /* An DATEV angelehnte Palette (KEINE offiziellen Markenfarben – eigene Anlehnung) */
    --gruen:#7AB51D;
    --gruen-dunkel:#5E8E16;
    --petrol:#1B6E7E;
    --petrol-dunkel:#0E5563;
    --anthrazit:#1f2a2e;
    --grau:#5a6b70;
    --hellgrau:#eef2f3;
    --weiss:#ffffff;
    --rot:#c0392b;
    --gelb:#e6a700;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--anthrazit);
    background:var(--hellgrau);
    line-height:1.55;
    min-height:100vh;
  }
  .wrap{max-width:760px;margin:0 auto;padding:0 16px 64px}
  header.hero{
    background:linear-gradient(135deg,var(--petrol),var(--petrol-dunkel));
    color:var(--weiss);
    padding:36px 16px 30px;
    text-align:center;
  }
  .logo{
    display:inline-flex;align-items:center;gap:10px;
    font-weight:700;letter-spacing:.5px;margin-bottom:14px;
  }
  .logo .sq{width:26px;height:26px;background:var(--gruen);border-radius:4px;display:inline-block}
  header.hero h1{margin:8px 0 6px;font-size:1.7rem;font-weight:800}
  header.hero p{margin:0;opacity:.92;font-size:1rem}
  .card{
    background:var(--weiss);border-radius:14px;padding:26px;margin:22px 0;
    box-shadow:0 6px 24px rgba(14,85,99,.10);
  }
  h2{font-size:1.2rem;margin:0 0 10px}
  .lead{color:var(--grau);margin:0 0 18px}
  .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  label.small{font-size:.85rem;color:var(--grau);display:block;margin-bottom:4px}
  input[type=text]{
    font:inherit;padding:9px 11px;border:1px solid #cdd7da;border-radius:8px;width:130px;
  }
  input[type=text]:focus{outline:3px solid rgba(27,110,126,.25);border-color:var(--petrol)}
  button.primary{
    font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:10px;
    padding:13px 22px;color:#fff;background:var(--gruen);
    transition:transform .05s ease, background .2s ease;
  }
  button.primary:hover{background:var(--gruen-dunkel)}
  button.primary:active{transform:translateY(1px)}
  button.primary:focus-visible{outline:3px solid rgba(122,181,29,.45);outline-offset:2px}
  .status{margin-top:20px}
  .ok h2{color:var(--gruen-dunkel)}
  .ok .big{font-size:1.55rem;font-weight:800;margin:6px 0 2px}
  .hint{font-size:.9rem;color:var(--grau)}
  /* Diagnose-Panel */
  .diag{border-left:5px solid var(--gelb);background:#fffaf0;border-radius:10px;padding:18px;margin-top:18px}
  .diag.err{border-left-color:var(--rot);background:#fdf3f2}
  .diag h3{margin:0 0 8px;font-size:1.05rem}
  .diag .case{font-weight:700;color:var(--petrol-dunkel)}
  .diag ol{margin:10px 0 0 18px;padding:0}
  .diag li{margin:5px 0}
  .copybox{
    margin-top:14px;background:var(--anthrazit);color:#dfe9eb;border-radius:8px;
    padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:.82rem;white-space:pre-wrap;word-break:break-word;
  }
  .copybtn{
    margin-top:8px;font:inherit;font-size:.85rem;cursor:pointer;border:1px solid var(--petrol);
    color:var(--petrol);background:#fff;border-radius:8px;padding:7px 12px;
  }
  .copybtn:hover{background:#eef6f8}
  footer.sig{
    text-align:center;color:var(--grau);font-size:.9rem;margin-top:30px;padding:0 8px;
  }
  footer.sig .name{color:var(--petrol-dunkel);font-weight:700}
  .review{
    display:inline-block;margin-top:10px;text-decoration:none;
    background:var(--gelb);color:#3a2c00;font-weight:700;border-radius:8px;padding:9px 16px;
  }
  .review:hover{filter:brightness(1.05)}
  /* Konfetti */
  #confetti{position:fixed;inset:0;pointer-events:none;display:none}
  .conf{position:absolute;width:9px;height:14px;will-change:transform,opacity}
  .muted{color:var(--grau);font-size:.82rem}
</style>
</head>
<body>
  <canvas id="confetti"></canvas>

  <header class="hero">
    <div class="logo"><span class="sq"></span> DATEVconnect · Erster Schritt</div>
    <h1>Hallo, schön dass du startest! 👋</h1>
    <p>Ein kleiner Funktionstest der DATEV-Schnittstelle — von Eike Hagena, Steuerberater aus Ostfriesland.</p>
  </header>

  <div class="wrap">
    <div class="card">
      <h2>Verbindung testen</h2>
      <p class="lead">Dieser Test liest <strong>nur deinen eigenen Anmeldenamen</strong> über die lokale DATEV-Schnittstelle.
      Keine Mandantendaten, kein Internet, nichts wird gespeichert. Klick einfach auf den Knopf.</p>

      <div class="row">
        <div>
          <label class="small" for="port">Port (falls abweichend)</label>
          <input id="port" type="text" value="58454" inputmode="numeric" aria-label="DATEVconnect Port">
        </div>
        <div style="align-self:flex-end">
          <button class="primary" id="go" type="button">▶ Verbindung testen</button>
        </div>
      </div>

      <div class="status" id="status" aria-live="polite"></div>
    </div>

    <footer class="sig">
      Mit kollegialen Grüßen aus Ostfriesland<br>
      <span class="name">Eike Hagena</span> · Steuerberater<br>
      <span class="muted">Diese Probe ist ein Geschenk an die Kollegenschaft. Viel Freude an der DATEV-API!</span>
    </footer>
  </div>

<script>
(function(){
  "use strict";

  var statusEl = document.getElementById('status');
  var goBtn    = document.getElementById('go');
  var portEl   = document.getElementById('port');

  // ---- kleine Helfer ----
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function buildBase(){
    var p = (portEl.value||'58454').replace(/[^0-9]/g,'') || '58454';
    return 'http://localhost:' + p;
  }

  // ---- Erfolg ----
  function showSuccess(name){
    var safe = esc(name || 'Kollege/Kollegin');
    statusEl.className = 'status ok';
    statusEl.innerHTML =
      '<div class="diag" style="border-left-color:var(--gruen);background:#f3fae9">'+
        '<h2>🎉 Das hat funktioniert!</h2>'+
        '<div class="big">Hallo '+safe+'!</div>'+
        '<p>Du hast soeben deine erste erfolgreiche Anfrage an die DATEV-Schnittstelle gestellt. '+
        'Genau so fängt jede API-Automatisierung an. Herzlichen Glückwunsch!</p>'+
        '<p class="hint">Grüße aus Ostfriesland, <strong>Eike Hagena</strong> 🙂</p>'+
        '<a class="review" href="https://g.page/r/CYJyaDXIrZxdEBM/review" target="_blank" rel="noopener noreferrer">⭐ Hat dich das gefreut? Über eine Bewertung freue ich mich!</a>'+
      '</div>';
    fireConfetti();
  }

  // ---- Diagnose / Fehlerfall ----
  function showDiagnosis(opts){
    // opts: {case, reason, steps[], raw}
    statusEl.className = 'status';
    var stepsHtml = (opts.steps||[]).map(function(s){return '<li>'+s+'</li>';}).join('');
    var raw = opts.raw || '';
    statusEl.innerHTML =
      '<div class="diag err">'+
        '<h3>🔍 Noch nicht ganz — aber kein Problem, das ist normal.</h3>'+
        '<p class="case">Wahrscheinliche Ursache: '+esc(opts.case)+'</p>'+
        '<p>'+esc(opts.reason)+'</p>'+
        '<strong>So löst du es:</strong>'+
        '<ol>'+stepsHtml+'</ol>'+
        '<p class="hint" style="margin-top:14px">Genau solche Stolpersteine bespreche ich in meinen DATEV-Workshops — '+
        'sie sind halb so wild, wenn man sie einmal verstanden hat. Eike Hagena, Ostfriesland 🙂</p>'+
        '<div class="copybox" id="raw">'+esc(raw)+'</div>'+
        '<button class="copybtn" id="copy" type="button">📋 Diagnose-Block kopieren</button>'+
        '<p class="muted" style="margin-top:8px">Du kannst mir diesen Block gern schicken — er enthält '+
        '<strong>keine Mandantendaten</strong>, nur Verbindungsstatus und Fehlerklasse.</p>'+
      '</div>';
    var cp = document.getElementById('copy');
    if(cp){ cp.addEventListener('click', function(){
      var t = document.getElementById('raw').textContent;
      navigator.clipboard && navigator.clipboard.writeText(t);
      cp.textContent = '✓ kopiert';
      setTimeout(function(){ cp.textContent='📋 Diagnose-Block kopieren'; }, 1800);
    });}
  }

  // ---- Diagnose-Block zusammenbauen (nur Struktur/Status, keine echten Daten) ----
  function diagBlock(extra){
    var d = {
      zeitpunkt: new Date().toISOString(),
      basis_url: buildBase(),
      browser: navigator.userAgent
    };
    for(var k in extra){ if(extra.hasOwnProperty(k)) d[k]=extra[k]; }
    var out = '— DATEV-Erste-Schritte Diagnose —\n';
    for(var key in d){ if(d.hasOwnProperty(key)) out += key+': '+d[key]+'\n'; }
    return out;
  }

  // ---- der eigentliche Test ----
  function runTest(){
    statusEl.className='status';
    statusEl.innerHTML='<p class="muted">⏳ Verbinde mit der lokalen DATEV-Schnittstelle …</p>';

    var base = buildBase();
    var url  = base + '/datev/api/iam/v1/Users/me';

    fetch(url, {
      method:'GET',
      credentials:'include',                 // ← aktiviert die Windows-SSO (kein Passwort, kein Token)
      headers:{ 'Accept':'application/json; charset=utf-8' }
    })
    .then(function(res){
      // 403 unterscheiden: leerer Body = http.sys/Kerberos/Verbot ; Body mit DCO10400 = fehlendes Recht
      return res.text().then(function(body){
        return { ok:res.ok, status:res.status, body:body, server:res.headers.get('server')||'' };
      });
    })
    .then(function(r){
      if(r.ok){
        var name = '';
        try{
          var j = JSON.parse(r.body);
          // Namen robust aus verschiedenen möglichen Feldern lesen
          name = (j.name && (j.name.given_name || j.name.givenName)) ||
                 j.display_name || j.displayName || j.userName || '';
          if(j.name && (j.name.given_name||j.name.givenName) && (j.name.family_name||j.name.familyName)){
            name = (j.name.given_name||j.name.givenName);
          }
        }catch(e){ name=''; }
        showSuccess(name);
        return;
      }

      // ---- Fehlerklassifikation ----
      if(r.status===403){
        var isHttpSys = (!r.body || r.body.trim()==='') ||
                        /Microsoft-HTTPAPI/i.test(r.server);
        var isDco     = /DCO10400/i.test(r.body);
        if(isDco){
          showDiagnosis({
            case:'Berechtigung fehlt (DCO10400)',
            reason:'Die Schnittstelle antwortet, aber deinem Benutzer fehlt das nötige Bestandsrecht. Der Windows-Handshake hat funktioniert — es ist „nur" ein Rechte-Thema.',
            steps:[
              'In der DATEV-Rechteverwaltung deinem Benutzer das Recht <strong>„DATEVconnect"</strong> und <strong>„EO comfort connect"</strong> erteilen.',
              'Tipp: am saubersten über eine eigene Gruppe <strong>„Schnittstellen"</strong>, die <em>nur</em> die benötigten Rechte enthält (Verbote in anderen Gruppen übersteuern sonst die Erlaubnis).',
              'Danach: DATEV-Arbeitsplatz unter deinem Login einmal starten, dann die Dienste <strong>Datev.Connect.Server</strong> und <strong>Datev.ApplicationHost.Server</strong> neu starten.'
            ],
            raw: diagBlock({ergebnis:'403 / DCO10400 (Recht fehlt)', http_status:403})
          });
        } else if(isHttpSys){
          showDiagnosis({
            case:'Windows-/Kerberos-Handshake (http.sys)',
            reason:'Die Antwort kommt von Windows selbst, noch vor dem DATEV-Programm (leerer Inhalt, „Negotiate"). Meist liegt ein Verbot in einer Gruppe vor, das die Erlaubnis übersteuert.',
            steps:[
              'Prüfen, ob dein Benutzer in einer Gruppe mit einem <strong>Verbot</strong> (z.B. „EO comfort"-Verbot) ist — bei DATEV gilt: <em>Verbot schlägt Erlaubnis</em>.',
              'Benutzer aus der verbietenden Gruppe nehmen oder das Verbot entfernen.',
              'Eigene Gruppe <strong>„Schnittstellen"</strong> nur mit benötigten Rechten anlegen, frei von Verboten.',
              'Danach Aktivierungssequenz: Arbeitsplatz unter deinem Login starten → <strong>Datev.Connect.Server</strong> und <strong>Datev.ApplicationHost.Server</strong> neu starten.'
            ],
            raw: diagBlock({ergebnis:'403 / leerer Body (http.sys/Kerberos)', http_status:403, server:r.server})
          });
        } else {
          showDiagnosis({
            case:'403 – unbestimmt',
            reason:'Zugriff verweigert, Ursache nicht eindeutig. Bitte Diagnose-Block kopieren.',
            steps:['Diagnose-Block kopieren und an Eike Hagena schicken.'],
            raw: diagBlock({ergebnis:'403 unbestimmt', http_status:403, server:r.server, body_kurz:(r.body||'').slice(0,120)})
          });
        }
      } else if(r.status===406){
        showDiagnosis({
          case:'Falscher Accept-Header (406)',
          reason:'Die Schnittstelle akzeptiert nur „application/json; charset=utf-8". (In dieser Probe ist das eigentlich gesetzt — falls du den Code angepasst hast, hier ansetzen.)',
          steps:['Sicherstellen, dass der Accept-Header exakt <code>application/json; charset=utf-8</code> lautet.'],
          raw: diagBlock({ergebnis:'406 (Accept-Header)', http_status:406})
        });
      } else if(r.status===404){
        showDiagnosis({
          case:'Endpunkt/Port nicht gefunden (404)',
          reason:'Der Dienst antwortet, aber unter diesem Pfad/Port nicht. Oft ist ein abweichender Port konfiguriert.',
          steps:['Oben einen anderen Port eintragen (Standard 58454 bzw. 58452 für HTTPS) und erneut testen.',
                 'Mit der DATEV-Administration den konfigurierten DATEVconnect-Port abklären.'],
          raw: diagBlock({ergebnis:'404 (Pfad/Port)', http_status:404})
        });
      } else {
        showDiagnosis({
          case:'Unerwarteter Status '+r.status,
          reason:'Die Schnittstelle hat geantwortet, aber mit einem unerwarteten Status.',
          steps:['Diagnose-Block kopieren und an Eike Hagena schicken.'],
          raw: diagBlock({ergebnis:'HTTP '+r.status, http_status:r.status})
        });
      }
    })
    .catch(function(err){
      // Netzwerk-/Verbindungsfehler: Dienst läuft nicht, Port falsch, oder Datei nicht lokal geöffnet
      showDiagnosis({
        case:'Keine Verbindung zur lokalen Schnittstelle',
        reason:'Der Browser erreicht die DATEV-Schnittstelle gar nicht. Das ist der häufigste erste Stolperstein — meist läuft der Dienst nicht, der Port weicht ab, oder die Datei wurde nicht auf einem DATEV-Arbeitsplatz geöffnet.',
        steps:[
          'Diese HTML auf einem Rechner öffnen, auf dem <strong>DATEVconnect installiert</strong> ist und der Dienst läuft.',
          'Prüfen, ob der Port stimmt (oben eintragen): Standard <strong>58454</strong> (HTTP) bzw. <strong>58452</strong> (HTTPS).',
          'In den DATEV-Diensten prüfen, ob <strong>Datev.Connect.Server</strong> läuft.',
          'Falls eine Firewall/Proxy dazwischenfunkt: localhost muss erreichbar sein.'
        ],
        raw: diagBlock({ergebnis:'Verbindungsfehler', meldung:String(err && err.message || err)})
      });
    });
  }

  goBtn.addEventListener('click', runTest);
  portEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ runTest(); }});

  // ---- Konfetti (vanilla, offline, keine Bibliothek) ----
  function fireConfetti(){
    var canvas = document.getElementById('confetti');
    var ctx = canvas.getContext('2d');
    canvas.style.display='block';
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var colors = ['#7AB51D','#1B6E7E','#e6a700','#5E8E16','#0E5563'];
    var parts = [];
    for(var i=0;i<160;i++){
      parts.push({
        x:Math.random()*W, y:-20-Math.random()*H*0.4,
        w:7+Math.random()*6, h:10+Math.random()*8,
        c:colors[i%colors.length],
        vy:2+Math.random()*3.5, vx:-1.5+Math.random()*3,
        rot:Math.random()*6.28, vr:-0.2+Math.random()*0.4
      });
    }
    var t0 = Date.now();
    function frame(){
      ctx.clearRect(0,0,W,H);
      var alive=false;
      for(var i=0;i<parts.length;i++){
        var p=parts[i];
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
        if(p.y < H+30) alive=true;
        ctx.save();
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.c;
        ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      }
      var elapsed = Date.now()-t0;
      if(alive && elapsed < 5000){ requestAnimationFrame(frame); }
      else { ctx.clearRect(0,0,W,H); canvas.style.display='none'; }
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function(){
    var c=document.getElementById('confetti');
    if(c.style.display==='block'){ c.width=window.innerWidth; c.height=window.innerHeight; }
  });
})();
</script>
</body>
</html>
<!-- ==================== ENDE BAUPLAN-HTML ==================== -->
```

---

## ❓ Häufige Fragen

**Ist das sicher?**
Ja. Die HTML hat eine strenge Content-Security-Policy, lädt nichts aus dem Internet, nutzt keine externen Bibliotheken und liest ausschließlich deinen eigenen Anmeldenamen über `localhost`. Kein Upload, keine Speicherung. Einzige bewusste Ausnahme: das Skript ist direkt in der Datei eingebettet (`script-src 'unsafe-inline'`), damit sie als eine einzige, offline lauffähige Datei funktioniert — externe Skriptquellen bleiben dabei vollständig gesperrt.

**Warum kein Passwort?**
DATEVconnect nutzt deine bestehende Windows-Anmeldung („Single Sign-On"). Du *bist* bereits angemeldet — die Schnittstelle erkennt dich daran.

**Es kommt eine Fehlermeldung — habe ich was kaputt gemacht?**
Nein. Lesende Tests können nichts beschädigen. Die HTML sagt dir genau, welcher der typischen Stolpersteine vorliegt und wie du ihn behebst.

**Was passiert mit dem Diagnose-Block?**
Der enthält nur Verbindungsstatus, Fehlerklasse und Zeitstempel — **keine** Mandanten- oder Personendaten. Du entscheidest, ob du ihn jemandem schickst.

---

*Erstellt mit kollegialen Grüßen von **Eike Hagena**, Steuerberater aus Ostfriesland.
Die verwendeten Farben sind an das DATEV-Erscheinungsbild **angelehnt** und keine offiziellen Markenfarben.
Wenn dir das geholfen hat, freue ich mich über deine [Google-Bewertung](https://g.page/r/CYJyaDXIrZxdEBM/review).* ⭐
