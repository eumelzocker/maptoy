---
id: tile-cache
title: Tile-Cache
language: de
---

# Tile-Cache

maptoy speichert erfolgreich geprüfte Raster-Tiles als unveränderliche Revisionen
unterhalb von `MAPTOY_DATA_DIR/tiles`. SQLite enthält Revisionshistorie und aktuelle
Zeiger; die Bilddateien bleiben direkt im Datenverzeichnis des Hosts zugänglich.

## Aktualisierungsmodi

Normale Kartenaufrufe verwenden `auto`: Eine aktuelle Revision wird ausgeliefert,
bis ihr konfiguriertes Höchstalter überschritten ist. Ein veraltetes oder fehlendes
Tile wird beim Provider angefragt. Wenn möglich, sendet maptoy `If-None-Match` oder
`If-Modified-Since`; eine `304`-Antwort aktualisiert ausschließlich die
Validierungszeitpunkte.

- `auto` verwendet eine frische Cache-Revision und validiert veraltete Inhalte.
- `force` kontaktiert den Provider unabhängig vom konfigurierten Höchstalter.
- `cache-only` kontaktiert den Provider nie und antwortet mit `404`, wenn das
  ausgewählte Tile fehlt.

Die API erhält den Modus als `?refresh=auto`, `?refresh=force` oder
`?refresh=cache-only`. Parallele Abrufe desselben noch nicht gespeicherten logischen
Tiles teilen sich einen Provider-Request.

## Unveränderliche Revisionen

Neue Bytes erzeugen eine über ihren SHA-256-Hash adressierte Revision. Frühere
Revisionen werden nicht überschrieben. Ändert sich der Providerinhalt von A zu B und
später zurück zu A, zeichnet maptoy drei zeitliche Revisionen auf, verwendet aber
die ursprüngliche A-Datei erneut.

Dateien verwenden dieses Layout:

```text
tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>
```

Temporäre Dateien werden im verwalteten Datenverzeichnis geschrieben und erst nach
Prüfung von Content-Type, Bildsignatur, Größe und Hash atomar verschoben.

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

## Statistik und Löschung

Die Verwaltungsansicht lädt DB-Summen und Zusammenfassungen je Zoomstufe, ohne das
Tile-Verzeichnis zu durchlaufen. Der Revision Explorer bleibt zunächst leer und
lädt erst auf Anforderung höchstens 50 Zeilen pro Seite, optional nach Zoomstufe und
aktuellem beziehungsweise historischem Zustand gefiltert. Dadurch bleibt die
initiale Seite auch bei großen Archiven begrenzt.

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
