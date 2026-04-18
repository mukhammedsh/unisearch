# Deployment security notes

This document covers the deployment guardrails that matter most when UniSearch is hosted outside local development. The examples work as templates for VPS, Docker hosts, and other platforms that let you put a reverse proxy in front of the FastAPI backend.

## Baseline rules

- Keep Redis private. In Docker, Redis should stay on the internal compose network and should not publish a host port.
- Set a long random `OPS_ADMIN_TOKEN` before exposing the backend to the internet.
- Keep `/ops/*`, `/metrics`, and `/health?warmup=1` private. The backend also requires `OPS_ADMIN_TOKEN`, but the proxy should hide these paths unless you intentionally operate them through a private network or SSH tunnel.
- Prefer same-domain API routing with `UNISEARCH_API_BASE_URL=/api`. This avoids broad CORS rules and keeps browser deployment simpler.
- Keep `TRUST_X_FORWARDED_FOR=0` unless the backend only accepts traffic from a trusted reverse proxy. If you enable it, set `TRUSTED_PROXY_IPS` to the proxy IPs only.
- Keep request body limits aligned between the proxy and backend. The backend default is `REQUEST_BODY_MAX_BYTES=131072` (128 KiB).

Generate an ops token with a cross-platform command:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Hosted backend environment example:

```env
APP_VERSION=3.4.6
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_ORIGINS=https://example.com

METRICS_ENABLED=0
OPS_ADMIN_TOKEN=<generated-token>
OPS_ADMIN_HEADER=X-UniSearch-Ops-Token
REQUEST_BODY_MAX_BYTES=131072
RATE_LIMIT_ENABLED=1
GLOBAL_RATE_LIMIT_REQUESTS=600
GLOBAL_RATE_LIMIT_WINDOW_SEC=60
EXPENSIVE_RATE_LIMIT_REQUESTS=120
EXPENSIVE_RATE_LIMIT_WINDOW_SEC=60

# Enable only when the backend is reachable only through this proxy.
TRUST_X_FORWARDED_FOR=1
TRUSTED_PROXY_IPS=127.0.0.1,::1
```

Hosted frontend runtime config:

```env
UNISEARCH_API_BASE_URL=/api
```

## Caddy example

This example serves the static frontend from `/srv/unisearch/frontend` and proxies `/api/*` to a local backend on `127.0.0.1:8000`. The private operational endpoints are hidden at the proxy layer.

```caddyfile
example.com {
	root * /srv/unisearch/frontend
	encode zstd gzip

	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
	}

	@privateOps path /api/ops* /api/metrics
	respond @privateOps 404

	@warmup {
		path /api/health
		query warmup=*
	}
	respond @warmup 404

	handle_path /api/* {
		request_body {
			max_size 128KB
		}
		reverse_proxy 127.0.0.1:8000
	}

	file_server
}
```

If you need to call `/ops/*` for maintenance, do it through a private channel such as SSH port forwarding, or remove the `@privateOps` block only for an authenticated internal admin network.

## Nginx example

This example assumes TLS is configured for `example.com` and the backend listens on `127.0.0.1:8000`.

```nginx
upstream unisearch_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    root /srv/unisearch/frontend;
    index index.html;

    client_max_body_size 128k;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;

    location = /api/metrics {
        return 404;
    }

    location ^~ /api/ops {
        return 404;
    }

    location = /api/health {
        if ($arg_warmup != "") {
            return 404;
        }

        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://unisearch_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://unisearch_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

When Nginx and the backend run in separate Docker containers, `TRUSTED_PROXY_IPS=127.0.0.1,::1` is usually wrong because the backend sees the proxy container IP. Either keep `TRUST_X_FORWARDED_FOR=0`, or pin the proxy to a known Docker network/subnet and list only that trusted proxy address.

## Deployment checklist

Before publishing a hosted instance:

1. `OPS_ADMIN_TOKEN` is set and not committed.
2. `FRONTEND_ORIGINS` contains the real public frontend origin.
3. Redis has no public port.
4. `/ops/*`, `/metrics`, and `/health?warmup=1` are not reachable from the public internet unless intentionally protected by an internal admin network.
5. `UNISEARCH_API_BASE_URL=/api` is generated into `frontend/env.js` for same-domain hosting.
6. `docker compose config` succeeds.
