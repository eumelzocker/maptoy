# Plan: maptoy-ff-ext

Detaillierte Ausarbeitung der Idee aus `idea.md` (unverändert), Ergebnis eines Klärungsdialogs.

## 1. Ziel

Private, lokal genutzte und serverunabhängige Firefox-Extension. Sie liest Responses mit, die zu konfigurierten Regeln passen (z.B. Map-Tiles), leitet sie 1:1 per POST an ein konfigurierbares HTTP-Ziel weiter — die Response an den Browser bleibt dabei komplett unverändert und wird nur **einmal** geladen (kein zweiter Request). maptoy ist der primäre Einsatzzweck und Namensgeber, aber keine Laufzeitabhängigkeit und kein fest codierter API-Vertrag.

## 2. Architektur / Ablauf

1. Der `webRequest.onBeforeRequest`-Listener wird synchron für `<all_urls>` und `blocking` registriert. Bei einem neuen Manifest-V3-Hintergrundkontext wartet seine Request-Promise auf Konfiguration und Session-Dedupe, bevor sie die auslösende URL gegen die Regeln prüft.
2. **Kein Match** → keine Interaktion, Request läuft normal.
3. **Genau ein Match** → `filterResponseData()` liest den kompletten Response-Body (StreamFilter `ondata`/`write()`), reicht ihn danach unverändert an den Browser weiter.
4. **Mehrere Matches** → Fehler (wird geloggt), die Response wird trotzdem unverändert an den Browser durchgereicht — Browsing wird nie blockiert oder beeinträchtigt.
5. Zielwerte aus den named groups + Lookup-Tables, Ziel-URL und Größenlimit werden vor der Filterregistrierung geprüft.
6. Response-Chunks werden unverändert sofort an den Browser geschrieben und nur bis zum konfigurierten Größenlimit für den POST gesammelt.
7. Nach vollständigem Body-Empfang: Statusprüfung und ggf. `fetch()`-POST. Nur erfolgreiche Zielantworten bleiben für die Sitzung dedupliziert; Fehler erlauben einen neuen Versuch, wenn der Browser dieselbe Quelle später erneut abruft.

Design-Invariante: Jeder Fehler in Regel-Auswertung, Lookup oder POST wird geloggt und bricht nur den POST-Vorgang ab. Die Weiterleitung der Original-Daten an den Browser (`write()`) ist davon nie betroffen.

## 3. Regel-Format

- Pro Regel: **Regex mit named groups** als Match-Pattern.
- Ziel-Template: String mit Platzhaltern (`${name}`), referenziert die named groups.
- **Lookup-Table pro named group** (optional): bildet den erfassten Rohwert auf einen anderen Wert ab (z.B. `mapname` → `mpi-id`). Groups ohne Lookup-Table werden 1:1 (Passthrough) ins Ziel-Template eingesetzt.
- Ist für eine group eine Lookup-Table definiert, der erfasste Wert aber nicht darin enthalten → Fehler (kein stiller Passthrough), POST wird verworfen.
- **Matchen mehrere Regeln dieselbe URL** → Fehler, kein POST, keine Priorisierung.

### Beispiel (Map-Tiles, aus idea.md)

```jsonc
{
  "id": "map-tiles",
  "enabled": true,
  "match": "^https://tiles\\.server\\.local/(?<mapname>[^/]+)/(?<z>\\d+)/(?<x>\\d+)/(?<y>\\d+)\\.(?<ext>\\w+)$",
  "target": "http://localhost:4004/api/map-sets/${mapname}/tiles/${z}/${x}/${y}",
  "lookups": {
    "mapname": { "World": "4711-0815-abc" }
  }
}
```

`z`, `x`, `y`, `ext` sind Passthrough (keine Lookup-Table), `mapname` wird über die Lookup-Table gemappt (`World` → `4711-0815-abc`), `ext` wird im Beispiel-Ziel-Template nicht verwendet.

## 4. Technische Basis (WebExtension API)

- `filterResponseData()` (StreamFilter), Ziel: **Manifest V3**.
  - Firefox unterstützt blockierendes `webRequest` + `filterResponseData()` weiterhin unter MV3 (Abweichung von Chrome).
  - Ab Firefox 110 zusätzlich nötig: Permission `"webRequestFilterResponse"`.
  - Weitere Permissions: `"webRequest"`, `"webRequestBlocking"`, Host-Permissions.
  - Fallback auf MV2 möglich, falls MV3 sich als nicht praktikabel erweist.
- Response wird nur einmal gelesen, nie modifiziert, immer 1:1 durchgereicht.

## 5. POST-Weiterleitung

- Body 1:1 (rohe Bytes), `Content-Type`-Header vom Original übernommen.
- Keine zusätzlichen Metadaten (keine Original-URL, kein Zeitstempel etc.) — Zielinformationen stecken bereits vollständig in der Ziel-URL.
- Erfolgreiche Quellantworten (`2xx`) werden standardmäßig weitergeleitet; pro Regel kann eine andere exakte Statusliste konfiguriert werden.
- Der Body einer Zielantwort wird nicht ausgewertet. Ihr HTTP-Erfolgsstatus entscheidet nur, ob die Ziel-URL dedupliziert bleibt.
- Bei Netzwerkfehler, nicht erreichbarem Ziel oder abgewiesenem POST: keine eigene Wiederholung und keine Queue. Ein späterer erneuter Browserabruf darf jedoch einen neuen POST auslösen.

## 6. Dedupe & Performance

- Erfolgreich gesendete Ziel-URLs werden für die laufende Browsersitzung in `browser.storage.session` gehalten und nach einem Suspendieren oder Neuerzeugen des Manifest-V3-Hintergrundskripts wieder geladen. Aktuell laufende Ziel-URLs bleiben zusätzlich nur im Arbeitsspeicher reserviert. Die History ist unabhängig vom Browser-Cache und wird beim Neustart von Firefox beziehungsweise Neuladen der Erweiterung zurückgesetzt.
- Ein globales, pro Regel überschreibbares `maxResponseBytes`-Limit begrenzt den gepufferten Body; `null` deaktiviert es ausdrücklich. Die Browserantwort wird auch bei Überschreitung vollständig weitergereicht.
- Rate-Limiting: **optional konfigurierbar**, nicht per Default erzwungen (z.B. später `maxConcurrent` in der Config ergänzbar).

## 7. Config-Page

- Konfigurationsspeicher: `browser.storage.local`; erfolgreiche Session-Dedupe-Einträge: `browser.storage.session`.
- Globaler Ein/Aus-Schalter für die gesamte Extension.
- Pro Regel: eigener Ein/Aus-Schalter, Name, Match-Regex, Ziel-Template, Lookup-Tables je named group.
- Import/Export der gesamten Konfiguration als JSON.

## 8. Permissions

- Statisch breite Host-Permission: `<all_urls>`.
- Deckt sowohl die zu filternden Quell-Domains als auch die POST-Ziel-Adresse(n) ab (kein `optional_permissions`-Dialog nötig).
- Sicherheitsannahme: Firefox und API-Server laufen im selben lokalen Netz, keine Authentifizierung/Verschlüsselung der API erforderlich.

## 9. Deployment

- Vorerst **Temporary Add-on** via `about:debugging` (kein Signieren nötig, muss bei jedem Firefox-Neustart neu geladen werden).
- Dauerhafte Installation (z.B. AMO unlisted signing) ist ein späterer, optionaler Schritt.

## 10. Tech-Stack

- Eigenständig versioniertes pnpm-Workspace-Paket `1.0.0`, das nicht in den maptoy-Docker-Build oder das Runtime-Image gelangt.
- TypeScript, kompiliert nur mit `tsc` (kein Bundler wie esbuild/vite — nicht nötig ohne npm-Runtime-Deps oder Multi-File-Bundling).
- Tests für die Matching-Logik: Regex-Matching, Lookup-Table-Anwendung (inkl. Fehlerfälle: unmapped value, mehrere Regel-Matches).
- Separate Build-, Typprüfungs-, `node:test`- und `web-ext lint`-Skripte.

## Vorgaben (aus idea.md, weiterhin gültig)

- Code auf Englisch: Bezeichner, Kommentare, Ausgaben etc.
- Planung und LLM-Assistenten-Chat auf Deutsch.
