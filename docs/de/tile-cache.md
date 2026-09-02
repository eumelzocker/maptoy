---
id: tile-cache
title: Tile-Cache
language: de
---

# Tile-Cache

*maptoy* speichert erfolgreich geprüfte Raster-Tiles als unveränderliche Revisionen
unterhalb von `MAPTOY_STORAGE_DATA_DIR/tiles`. SQLite enthält Revisionshistorie und aktuelle
Zeiger; die Bilddateien bleiben direkt im Datenverzeichnis des Hosts zugänglich.

## Aktualisierungsmodi

Normale Kartenaufrufe verwenden `auto`: Eine aktuelle Revision wird ausgeliefert,
bis ihr konfiguriertes Höchstalter überschritten ist. Ein veraltetes oder fehlendes
Tile wird beim Provider angefragt. Wenn möglich, sendet *maptoy* `If-None-Match` oder
`If-Modified-Since`; eine `304`-Antwort aktualisiert ausschließlich die
Validierungszeitpunkte.

- `auto` verwendet eine frische Cache-Revision und validiert veraltete Inhalte.
- `force` kontaktiert den Provider unabhängig vom konfigurierten Höchstalter.
- `cache-only` kontaktiert den Provider nie. Fehlt das ausgewählte Tile, liefert
  *maptoy* ein diagonal schraffiertes `no_cache`-PNG in der konfigurierten Tile-Größe
  mit seinen `z`-, `x`- und `y`-Koordinaten sowie `X-Maptoy-Cache: miss` aus.

Die API erhält den Modus als `?refresh=auto`, `?refresh=force` oder
`?refresh=cache-only`. Parallele Abrufe desselben noch nicht gespeicherten logischen
Tiles teilen sich einen Provider-Request. Die Anzeigeoption **Cached Tiles Only**
der Kartenansicht verwendet `cache-only`; fehlende Tiles erscheinen deshalb als
schraffierte Flächen, ohne Provider-Traffic auszulösen. Die generierten Error-Tile-
Bytes werden im Arbeitsspeicher des Servers gecacht. Ihre HTTP-Antworten verwenden
`Cache-Control: no-store`, damit ein neu archiviertes Tile den Platzhalter sofort
ersetzen kann.

## Externes Tile-Seeding

Vertrauenswürdige API-Clients können ein logisches Tile einspielen, ohne dessen
konfigurierten Provider zu kontaktieren:

```sh
curl --request POST \
  --header 'Content-Type: image/png' \
  --data-binary '@tile.png' \
  "$MAPTOY_SERVER_URL/api/map-sets/$MAP_SET_ID/tiles/10/550/335"
```

Der Request-Body ist die unveränderte PNG-, JPEG- oder WebP-Datei; dieser Endpunkt
verwendet kein Multipart. Die Datei muss vollständig dekodierbar sein; Media-Type
und tatsächliches Bildformat müssen zum konfigurierten Tile-Format des Map Sets
passen und Breite sowie Höhe müssen der konfigurierten Tile-Größe entsprechen.
Koordinaten müssen innerhalb der Zoom- und
XYZ-Grenzen liegen, Tile-Archiv-Capability und Cache-Policy müssen aktiv sein und
sowohl `MAPTOY_TILES_MAX_BYTES` als auch das Speicherlimit des Map Sets gelten.

Eine neue unveränderliche Revision antwortet mit `201` und
`{ "revisionId": "...", "created": true }`. Entsprechen die Bytes der aktuellen
Revision, lautet die Antwort `200` mit `created: false`; nur die Sichtungszeitpunkte
werden aktualisiert und es wird kein zusätzlicher Speicher belegt. Hochgeladene
Revisionen tragen die Herkunft `upload`. Normale und `cache-only`-Abrufe liefern
anschließend exakt diese Bytes ohne Providerkontakt, solange die Revision frisch ist.

Für Uploadfehler gelten folgende Verträge:

- `415 TILE_MEDIA_TYPE_INVALID` bei fehlendem, nicht unterstütztem oder nicht zum
  Map Set passendem Content-Type.
- `400 TILE_CONTENT_INVALID`, wenn das Bild nicht dekodiert werden kann oder sein
  tatsächliches Format beziehungsweise seine Abmessungen nicht zum Map Set passen.
- `409 TILE_ARCHIVE_DISABLED`, wenn Archiv-Capability oder Cache-Policy deaktiviert
  ist.
- `413 TILE_BODY_TOO_LARGE` beim Überschreiten des routenspezifischen Limits
  `MAPTOY_TILES_MAX_BYTES`.
- `507 TILE_STORAGE_LIMIT`, wenn das Speicherlimit des Map Sets überschritten würde.

*maptoy* v1 besitzt keine Anwendungsauthentifizierung. Dieser schreibende Endpunkt ist
nur für vertrauenswürdige private Clients vorgesehen. Ist *maptoy* über ein nicht
vertrauenswürdiges Netz erreichbar, muss der Reverse Proxy den Zugriff authentifizieren
und autorisieren; veröffentliche die Uploadroute nicht ungeschützt. Der Betreiber ist
selbst dafür verantwortlich, dass die eingespielten Bytes zur konfigurierten Quelle
gehören und gespeichert werden dürfen.

## Unveränderliche Revisionen

Neue Bytes erzeugen eine über ihren SHA-256-Hash adressierte Revision. Frühere
Revisionen werden nicht überschrieben. Ändert sich der Providerinhalt von A zu B und
später zurück zu A, zeichnet *maptoy* drei zeitliche Revisionen auf, verwendet aber
die ursprüngliche A-Datei erneut.
Jede Revision hält außerdem fest, ob ihre erzeugenden Bytes vom `provider` oder aus
einem API-`upload` stammen.

Dateien verwenden dieses Layout:

```text
tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>
```

Temporäre Dateien werden im verwalteten Datenverzeichnis geschrieben und erst nach
Prüfung von Content-Type, tatsächlichem Bildformat, Abmessungen, Dekodierbarkeit,
Größe und Hash atomar verschoben.

## Cache-Stand auswählen

Die normale Tile-URL liefert die aktuelle Revision. Für historische, ausschließlich
lesende Auswahl steht genau einer dieser Query-Parameter zur Verfügung:

- `snapshot=<snapshot-id>` wählt die in einem unveränderlichen Snapshot erfasste
  Revision.
- `asOf=<ISO-8601-Zeitpunkt>` wählt die zu diesem Zeitpunkt bekannte Revision.
- `revision=<tile-revision-id>` wählt eine konkrete Revision.

Eine historische Auswahl löst niemals einen Providerabruf aus.

## Snapshots und Vergleich

Unter **Tile Cache** lässt sich ein benannter Snapshot aller aktuellen Revisionen
des Map Sets erstellen. Ein Snapshot kopiert keine Bilddateien, sondern speichert
explizite, geschützte Referenzen und ermöglicht so reproduzierbare Abrufe.

Dieselbe Ansicht vergleicht einen Snapshot mit dem aktuellen Stand anhand der
Inhaltshashes und meldet identische, geänderte, hinzugekommene und fehlende Tiles.
Beim Löschen eines Snapshots verschwinden nur diese Referenzen, nicht die
Tile-Revisionen. SQLite aggregiert die Vergleichszähler, ohne sämtliche Tile-Hashes
in den Arbeitsspeicher des Servers zu laden.

## Coverage-Karte

Unter **Coverage** lässt sich ein begrenzter Ausschnitt des Tile-Archivs auf einer
Karte untersuchen. Wähle Map Set, Quellzoom und entweder den aktuellen Stand, einen
unveränderlichen Snapshot oder einen ISO-8601-Zeitpunkt. Die Karte unterscheidet
frische, veraltete und fehlende Bereiche. Die Auswahl **Cache state** lässt sich
einklappen, wenn sie nicht benötigt wird.

Eine ausgewählte Zelle zeigt Revisionszahl, Byte-Größe sowie Validierungszeitpunkte.
Die Seitenleiste scrollt die Zellendetails in den sichtbaren Bereich. Der
Info-Tooltip am **Aggregation-Grid** zeigt, wie viele Quell-Tiles jede Rasterzelle
repräsentiert. Die Coverage-Legende enthält außerdem die dauerhaft gespeicherte
Option **Show grid**. Wenn sie deaktiviert ist, verschwinden die Rastergrenzen und
nur eingefärbte Zellen können ausgewählt werden.

Coverage-Requests sind auf den sichtbaren geografischen Ausschnitt begrenzt und
liefern nie mehr als 4.096 Zellen; die Oberfläche fordert standardmäßig höchstens
1.024 an. SQLite aggregiert die Revisionsmetadaten vor der Antwort, sodass der
Browser nicht sämtliche Tile-Zeilen eines großen Caches erhält. Fehlende Tiles
werden aus dem vollständigen XYZ-Koordinatenbereich innerhalb des Ausschnitts
berechnet. Eine Coverage-Abfrage kontaktiert daher keinen Provider und erzeugt keine
Cache-Einträge. Die Hintergrundkarte ist davon getrennt: Sie verwendet den normalen
Tile-Modus `auto` und kann Hintergrund-Tiles über den konfigurierten Provider laden,
validieren und cachen.

### Batch-Downloads in Coverage

Im einklappbaren Abschnitt **Download tiles** lässt sich ein Rechteck direkt auf
der Karte aufziehen, der vollständige sichtbare Kartenausschnitt übernehmen oder
eine genaue WGS84-Grenze eingeben. `Esc` bricht eine aktive Kartenauswahl ab.
`Strg`+Klick auf die Karte aktiviert die Auswahl ohne Umweg über den Button;
`Strg`+Ziehen wählt das Rechteck direkt. Anschließend wird ein Bereich von
Quellzoomstufen gewählt.
Standardmäßig werden nur fehlende Tiles geladen; optional werden zusätzlich
veraltete Tiles validiert. Die Schätzung weist Cachebestand, Providerrequests,
geschätzte Übertragungsgröße, Warnungen, Hartgrenzen und das verbleibende Tageslimit
aus, ohne den Provider zu kontaktieren.

Vor dem Start müssen die verlinkten Providerbedingungen und die Eigenverantwortung
ausdrücklich bestätigt werden. Fortschritt, aktuelles Tile, Pause, Fortsetzung,
Abbruch, erneuter Versuch und begrenzte Fehlerdetails bleiben in derselben
Coverage-Seitenleiste. Beendete Jobs werden in einer eigenen einklappbaren Historie
gruppiert. Die Gebietsauswahl bleibt auch bei eingeklapptem Download-Bereich
sichtbar; Auswahl und aktuell bearbeitetes Tile erscheinen als violette Overlays,
ohne die Coverage-Statusfarben zu verändern. Mit der Anzeigeoption **Selection**
lässt sich der ausgewählte Rahmen aus- und wieder einblenden. Die Aktion **Download
tiles** eines Map Sets öffnet denselben Workflow; eine eigene
Download-Hauptansicht gibt es nicht.

## Statistik und Löschung

Die Verwaltungsansicht lädt DB-Summen und Zusammenfassungen je Zoomstufe, ohne das
Tile-Verzeichnis zu durchlaufen. Der Revision Explorer bleibt zunächst leer und
lädt erst auf Anforderung höchstens 50 Zeilen pro Seite, optional nach Zoomstufe und
aktuellem beziehungsweise historischem Zustand gefiltert. Dadurch bleibt die
initiale Seite auch bei großen Archiven begrenzt. Der State-Chip zeigt bei Bedarf
genau die ausgewählte Revision an, ohne den Provider zu kontaktieren.

**Check consistency** scannt das verwaltete Verzeichnis ausdrücklich und meldet
tatsächlich belegte Bytes, fehlende referenzierte und unreferenzierte Dateien. Der
Scan gehört nicht zum normalen Seitenaufruf und kann bei einem großen Cache dauern.
Speicherlimits können neue Inhalte abweisen, löschen aber niemals automatisch die
Historie.

Nur eine ausdrückliche Aktion kann eine historische Tile-Revision löschen. Aktuelle
und von Snapshots referenzierte Revisionen sind geschützt. Eine Inhaltsdatei wird
erst entfernt, nachdem ihre letzte Revisionsreferenz gelöscht wurde.

**Repair** wird erst nach einem erfolgreichen Konsistenzcheck in der aktuellen
Browser-Sitzung verfügbar und erfordert eine ausdrückliche Bestätigung. Die
Funktion entfernt unreferenzierte Dateien aus
abgebrochenen Schreibvorgängen. Außerdem entfernt sie unbrauchbare
Tile-Revisionsdatensätze, deren Inhaltsdateien nicht mehr vorhanden sind, bereinigt
betroffene aktuelle Zeiger und Snapshot-Einträge und löscht leere logische Tiles.
Vorhandene Inhaltsdateien werden niemals entfernt, solange die Datenbank noch auf
sie verweist. Diese Aktion kann nicht rückgängig gemacht werden.
