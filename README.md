# Bladmuziek Knipper

Een statische webapplicatie waarmee presentatoren van kerkdiensten bladmuziek-afbeeldingen automatisch kunnen opsplitsen in PowerPoint slides.

## Functionaliteit

- Afbeelding laden via drag-and-drop, bestandskeuze of Ctrl+V plakken
- Automatische notenbalk-detectie via Canvas beeldanalyse
- Automatische titelzone-herkenning (samengevoegd met slide 1)
- Instelbaar aantal regels per slide (standaard 4)
- Kopieer-knop per slide (Clipboard API) — direct plakken in bestaande PowerPoint met Ctrl+V
- PNG download per slide
- Export naar `.pptx` (PptxGenJS, client-side)
- Export naar `.zip` met losse PNG bestanden (JSZip, client-side)

Alle logica draait client-side in de browser. Er is geen backend, geen API en geen database.

## Opstarten

```bash
docker compose up -d
```

De app is bereikbaar op [http://localhost:8080](http://localhost:8080).

```bash
# Logs bekijken
docker compose logs -f

# Stoppen
docker compose down
```

## Gebruik

1. Sleep een bladmuziek-afbeelding naar de dropzone, kies een bestand, of plak met Ctrl+V
2. Pas indien nodig de instellingen aan (regels per slide, gap-gevoeligheid)
3. Klik **Verwerk afbeelding**
4. Klik per slide op **Kopieer**, schakel naar PowerPoint, maak een nieuwe slide aan en druk Ctrl+V

### Clipboard-compatibiliteit

| Browser | Kopieer-knop |
|---------|-------------|
| Chrome / Edge | Werkt volledig |
| Firefox | Niet beschikbaar (beperkte Clipboard API) |

> In productie vereist de Clipboard API een HTTPS-verbinding. Gebruik Nginx Proxy Manager of een andere reverse proxy met een geldig certificaat.

## Productie achter Nginx Proxy Manager

Pas `docker-compose.yml` aan zodat de container geen poort naar buiten publiceert maar bereikbaar is via een gedeeld Docker-netwerk:

```yaml
services:
  bladmuziek:
    build: .
    container_name: bladmuziek-app
    restart: unless-stopped
    volumes:
      - ./app:/usr/share/nginx/html:ro
    networks:
      - npm_network

networks:
  npm_network:
    external: true
    name: npm_network
```

Maak het netwerk eenmalig aan als het nog niet bestaat:

```bash
docker network create npm_network
```

Voeg daarna in Nginx Proxy Manager een Proxy Host toe:

- **Forward Hostname**: `bladmuziek-app`
- **Forward Port**: `80`
- **SSL**: Let's Encrypt certificaat met Force SSL

## Tech stack

| Onderdeel | Keuze |
|-----------|-------|
| Frontend | Vanilla HTML5 + CSS + JavaScript |
| Beeldanalyse | Browser Canvas API |
| PowerPoint export | PptxGenJS 3.12 (CDN) |
| ZIP export | JSZip 3.10 (CDN) |
| Iconen | Tabler Icons (CDN) |
| Deployment | Nginx in Docker via Docker Compose |

## Bestandsstructuur

```
├── app/
│   └── index.html        # Volledige applicatie (HTML + CSS + JS)
├── docker-compose.yml
├── Dockerfile
└── nginx.conf
```
