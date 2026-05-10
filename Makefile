.PHONY: up down restart build rebuild logs status open shell

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

rebuild:
	docker compose down && docker compose build --no-cache && docker compose up -d

logs:
	docker compose logs -f

status:
	docker compose ps

open:
	xdg-open http://localhost:8080 2>/dev/null || open http://localhost:8080 2>/dev/null || echo "Open http://localhost:8080 in your browser"

shell:
	docker exec -it bladmuziek-app sh
