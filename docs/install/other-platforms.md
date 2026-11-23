---
title: Other platforms
description: Run TWD Design on Fly.io, Railway, Kubernetes or any container platform, importing the .env from npm run setup
---

# Other platforms

TWD Design is one container with no database, no volume and, in Socket Mode, no inbound traffic. Any
platform that runs a container and keeps it on works. What changes between them is how the `.env` from
`npm run setup` gets there. Most of them import it in one go.

| | | |
|---|---|---|
| Image | `ghcr.io/brikev/twd-design:0.2.0` | linux/amd64 and linux/arm64 |
| Resources | 512 MB of memory, 0.5 vCPU | 1 GB if several threads iterate at once |
| Health check | `GET /healthz` on `PORT` (3000) | |
| Stop | `SIGTERM`, then up to 60 s for running turns | Give the platform a grace period of 70 s |

`GITHUB_PRIVATE_KEY` is a single line in the `.env` (the setup writes it that way): paste it as it is. The bot
restores the line breaks.

## Fly.io

```bash
fly launch --image ghcr.io/brikev/twd-design:0.2.0 --no-deploy --vm-memory 512
fly secrets import < .env
fly deploy
```

In Socket Mode the bot needs no public service: you can remove the `[http_service]` section that `fly launch`
generates. Keep one machine running (`fly scale count 1`) and don't let it auto-stop: the bot has to stay
connected to Slack.

## Railway

New project → **Deploy a Docker image** → `ghcr.io/brikev/twd-design:0.2.0`. In the service's
**Variables**, open the **Raw Editor** and paste your `.env`.

## Kubernetes

```bash
kubectl create secret generic twd-design --from-env-file=.env
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twd-design
spec:
  replicas: 1                       # one per Slack app
  selector: { matchLabels: { app: twd-design } }
  template:
    metadata: { labels: { app: twd-design } }
    spec:
      terminationGracePeriodSeconds: 70
      containers:
        - name: twd-design
          image: ghcr.io/brikev/twd-design:0.2.0
          envFrom: [{ secretRef: { name: twd-design } }]
          resources:
            requests: { memory: 512Mi, cpu: 500m }
            limits: { memory: 1Gi }
          readinessProbe: { httpGet: { path: /healthz, port: 3000 } }
          livenessProbe: { httpGet: { path: /healthz, port: 3000 }, periodSeconds: 30 }
```

## Anything else

ECS, Cloud Run (with min instances 1 and CPU always allocated), Nomad, a VM with Docker: use the image,
pass the variables from your `.env` as environment variables or secrets, and keep one instance running.
[Configuration](../reference/configuration.md) lists every variable.
