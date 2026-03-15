# Backend Deployment

## Prerequisites

- Docker or Podman
- Firebase service account JSON file
- PostgreSQL database

## Build

```sh
# from project root
docker build -f infra/Containerfile -t fin-goals-api .
# or
podman build -f infra/Containerfile -t fin-goals-api .
```

## Run

### Standalone (with existing database)

```sh
docker run --rm -p 3000:3000 \
  --env-file apps/api/.env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-credentials.json \
  -e DATABASE_URL=postgresql://user:pass@db-host:5432/fingoals \
  -v /path/to/firebase-credentials.json:/app/firebase-credentials.json:ro \
  fin-goals-api
```

Replace `/path/to/firebase-credentials.json` with the actual path to your Firebase service account JSON.

### With docker-compose (local Postgres)

If Postgres is running via the project's `docker-compose.yml`, join the compose network:

```sh
docker run --rm -p 3000:3000 \
  --env-file apps/api/.env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-credentials.json \
  -e DATABASE_URL=postgresql://fingoals:fingoals@postgres:5432/fingoals \
  -v /path/to/firebase-credentials.json:/app/firebase-credentials.json:ro \
  --network fin-goals_default \
  fin-goals-api
```

### Podman equivalent

Replace `docker` with `podman` in any of the above commands. For network access to a podman-compose stack, use `--network fin-goals_default` the same way.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (inside container) |
| `PORT` | Server port (default: 3000) |

See `apps/api/.env.example` for all available variables.

## Run Migrations

```sh
docker run --rm \
  -e DATABASE_URL=postgresql://fingoals:fingoals@postgres:5432/fingoals \
  --network fin-goals_default \
  fin-goals-api npx prisma migrate deploy
```
