# Deployment

The application runs the Go API (`studio-api`), the frontend and an nginx reverse
proxy. Service and image names stay unchanged so existing project volumes remain
usable. Node is used to build the frontend.

## Docker

From the repository root:

```bash
docker compose -f deployment/docker/docker-compose.yaml -f deployment/docker/docker-compose-build.yaml up --build -d
```

Open <http://localhost:8080>. The API image is built from `server/`, with FFmpeg
and cgo support. Containers use CPU stems by default; model and runtime downloads
are kept in the `stems-cache` volume. Set `STEMS_DEVICE=off` to skip preparation,
or `STEMS_OFFLINE=true` to require an already prepared cache. CUDA additionally
requires NVIDIA container GPU access.

## Oracle VM

```bash
./deployment/docker/build.sh             # all | api | frontend | proxy
./deployment/oracle-vm/deploy.sh          # all | api | frontend | sync | status | logs
```

The build script publishes images; the deploy script updates the remote VM.
Existing projects remain in the `studio-data` volume. Deployment removes orphaned
containers without deleting their volumes.

## Kubernetes

Manifests are in `deployment/k8s/`. The Go API uses `env-config` and the existing
`studio-data-pvc`. Stem assets are cached under `/app/projects/.stems-cache`.
CPU stem separation can use several GiB of RAM; adjust resource limits for the
workload, or set `STEMS_DEVICE=off` if it is not needed.
