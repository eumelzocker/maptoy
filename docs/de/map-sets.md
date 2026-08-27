---
id: map-sets
title: Map Sets
language: de
---

# Map Sets

Ein Map Set verbindet eine XYZ-Rasterquelle mit *maptoy*s Renderer,
Startkartenausschnitt, technischen Fähigkeiten, Cache-Regeln und Download-Limits.
Es ist kein öffentlicher Provider vorkonfiguriert. Prüfe vor dem Anlegen einer
Quelle deren aktuelle Bedingungen, Attributionsregeln, Abruflimits und Vorgaben für
Proxy oder Speicherung. Die [Tile-Provider-Übersicht](docs/de/tile-providers) dient
als technische Orientierung.

## Ein Map Set anlegen

Öffne **Map Sets**, wähle **New Map Set** und fülle die wesentlichen Felder aus:

- **Name** ist der lokale Anzeigename.
- Das **XYZ URL template** muss eine HTTP- oder HTTPS-URL mit `{z}`, `{x}` und
  `{y}` sein. `{s}` ist optional und benötigt mindestens eine konfigurierte
  Subdomain.
- **Attribution** wird vom interaktiven Renderer angezeigt. Klartext und
  vertrauenswürdiges, Leaflet-kompatibles Link-Markup wie
  `<a href="https://…">…</a>` werden unterstützt. Das Markup wird unverändert
  gespeichert und dargestellt; deshalb sollte nur der Administrator Map Sets
  bearbeiten.
- **Provider terms URL**, **Terms last reviewed** und **Notes** halten deine Prüfung
  fest; daraus leitet *maptoy* keine rechtliche Freigabe ab.
- **Minimum**, **Maximum** und **Default zoom** müssen zum tatsächlichen Zoombereich
  der Quelle passen. Der Standardzoom muss innerhalb dieses Bereichs liegen.
- **Default longitude** und **Default latitude** bestimmen den ersten Ausschnitt.
- **Tile size** und **Format** müssen der Providerantwort entsprechen.

Zoomwerte beschreiben die `{z}`-Koordinate des Providers. Ein 512-Pixel-Tile mit
Provider-Zoom `z` wird bei Leaflet-Zoom `z + 1` dargestellt, da es die Details eines
256-Pixel-Tiles dieser Stufe enthält. *maptoy* wendet diesen Versatz automatisch an;
API und Cache verwenden weiterhin den Provider-Zoom.

Die erste Implementierung unterstützt ausschließlich den Quelltyp `xyz-raster` in
Web Mercator (`EPSG:3857`) und den Renderer `leaflet-xyz`.

Die Kartenansicht merkt sich einen gemeinsamen Mittelpunkt und Zoom im lokalen
Browserspeicher. Beim Neuladen wird dieser Ausschnitt wiederhergestellt; beim Wechsel
des Map Sets bleibt dasselbe Gebiet sichtbar, damit sich Quellen direkt vergleichen
lassen. Hat das neue Map Set engere Zoomgrenzen, begrenzt *maptoy* den gemeinsamen Zoom
auf die nächstgelegene erlaubte Stufe. Der konfigurierte Startausschnitt gilt, wenn
kein gültiger gespeicherter Wert vorhanden ist.

## Quelle nach dem ersten Cache-Eintrag

Sobald ein Map Set seine erste Tile-Revision im Cache enthält, sperrt *maptoy* die
Felder, welche die Quelle festlegen: Quelltyp, URL-Template, Request-Header,
Subdomains, Tile-Größe, Format und Quellprojektion. Metadaten, Startausschnitt,
Zoomgrenzen, Capabilities sowie Cache- und Download-Regeln bleiben editierbar.

Dupliziere das Map Set und bearbeite die Kopie, wenn sich ein gesperrtes Quellfeld
ändern soll. So bleibt jede gespeicherte Koordinate eindeutig einer verständlichen
Quelle zugeordnet, ohne eine zusätzliche Versionshistorie für Quellen zu führen.
Ändert sich nur der Wert einer referenzierten Environment-Variable, etwa bei der
Rotation eines API-Schlüssels, ändert das weder das gespeicherte Map Set noch seine
bereits gecachten Tiles.

Der Editor stellt gesperrte Quellenfelder deaktiviert dar und bietet **Duplicate to
change source** an. Für direkte API-Aufrufe erzwingt der Server dieselbe Regel.

## Secrets und Request-Header

Füge API-Schlüssel niemals direkt in ein Map Set ein. Lege sie in der
Serverumgebung ab und referenziere dort nur ihren Namen:

```text
https://tiles.example.test/{z}/{x}/{y}.png?key=${MAPTOY_EXAMPLE_API_KEY}
Authorization: Bearer ${MAPTOY_EXAMPLE_API_KEY}
```

Nur Namen mit `MAPTOY_*` sind zulässig. Die referenzierte Variable muss beim
Speichern des Map Sets vorhanden sein. SQLite speichert die Referenz und nicht den
aufgelösten Wert; API-Antworten, Diagnosen und Weboberfläche benötigen das Secret
daher nicht.

Request-Header werden zeilenweise als `Name: Wert` eingetragen. Hop-by-Hop-Header,
`Host`, `Cookie` und `Content-Length` sind nicht konfigurierbar. Leitet ein Provider
auf einen anderen Origin um, entfernt *maptoy* vor dem Folgeabruf alle konfigurierten
Header.

## Provider testen

Speichere das Map Set und wähle **Test tile**. *maptoy* ruft das Tile auf, das den
konfigurierten Standardmittelpunkt bei Standardzoom enthält, und zeigt:

- XYZ-Koordinate und HTTP-Status des Providers,
- normalisierten Content-Type,
- Antwortgröße und Dauer,
- verständliche Fehler für DNS, Timeout, Netzwerk, Größenlimit, Status oder einen
  nicht unterstützten Bildtyp.

Der Test akzeptiert PNG-, JPEG- und WebP-Rasterantworten. Er erteilt keine Erlaubnis
zur Providernutzung und aktiviert keine Fähigkeiten automatisch.

## Netzwerkschutz

Providerabrufe erlauben standardmäßig nur HTTPS. Localhost sowie private und
Link-Local-Adressen werden sowohl als direkte IP-Adresse als auch nach der
DNS-Auflösung abgewiesen. Redirect-Ziele werden erneut geprüft. Ein selbst
gehosteter privater Tile-Server benötigt die ausdrückliche Servereinstellung
`MAPTOY_ALLOW_PRIVATE_TILE_HOSTS=true`; diese erlaubt zugleich HTTP und sollte nur
in einem vertrauenswürdigen Netz aktiviert werden.

Providerantworten besitzen ein konfigurierbares Timeout und Größenlimit. Die
Standardwerte betragen 10 Sekunden und 10 MiB pro Tile. Sie lassen sich mit
`MAPTOY_PROVIDER_TIMEOUT_MS` und `MAPTOY_MAX_TILE_BYTES` ändern.

## Fähigkeiten und aktueller Umfang

Capability-Schalter beschreiben technische Funktionen und keine Erlaubnis des
Providers. *maptoy* verknüpft sie mit den Fähigkeiten des gewählten Renderers. Eine
deaktivierte interaktive Fähigkeit verhindert das Öffnen des Map Sets in der
Kartenansicht.

In Phase 2 lädt die Kartenansicht jedes Tile über den relativen *maptoy*-Endpunkt
`api/map-sets/:id/tiles/:z/:x/:y`; der Browser erhält weder die externe
Provider-URL noch aufgelöste Secrets. Dauerhafte Tile-Revisionen,
Aktualisierungsmodi, Snapshots und Vergleiche von Cache-Ständen beschreibt die
[Tile-Cache-Dokumentation](docs/de/tile-cache). Batch-Downloads folgen in einer
späteren Phase.
