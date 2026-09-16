# Deployment security notes

This document covers the deployment guardrails that matter most when UniSearch is hosted outside local development. The examples work as templates for VPS, Docker hosts, and other platforms that let you put a reverse proxy in front of the FastAPI backend.

## Baseline rules

- Keep Redis private. In Docker, Redis should stay on the internal compose network and should not publish a host port.
- Never expose the backend port directly to the public internet when running behind a reverse proxy. Bind the backend port to localhost (e.g. `127.0.0.1:8000:8000` in Docker) or keep it on an internal network to prevent direct bypass of proxy protections.
- Set a long random `OPS_ADMIN_TOKEN` before exposing the backend to the internet.
- Keep `/ops/*`, `/metrics`, and `/health?warmup=1` private. The backend also requires `OPS_ADMIN_TOKEN`, but the proxy should hide these paths unless you intentionally operate them through a private network or SSH tunnel.
- Prefer same-domain API routing with `UNISEARCH_API_BASE_URL=/api`. This avoids broad CORS rules and keeps browser deployment simpler.
- Keep `TRUST_X_FORWARDED_FOR=0` unless the backend only accepts traffic from a trusted reverse proxy. If you enable it, set `TRUSTED_PROXY_IPS` to the minimal explicit proxy IPs (e.g. `127.0.0.1,::1` or specific container/subnet IP).
- Do not trust broad private networks (such as `10.0.0.0/8` or `172.16.0.0/12`) via `TRUST_PRIVATE_NETWORK_PROXIES` unless the entire subnet is provably isolated and contains only trusted proxies.
- Enable `TRUST_CF_CONNECTING_IP=1` only when Cloudflare is actively used and upstream proxies are configured to sanitize incoming headers from non-Cloudflare traffic.
- UniSearch traverses `X-Forwarded-For` right-to-left against `TRUSTED_PROXY_IPS` (and `_PRIVATE_NETWORKS` if `TRUST_PRIVATE_NETWORK_PROXIES=1`), selecting the first non-trusted hop as the verified client IP. Spoofed headers prepended by untrusted clients are automatically discarded.
- Keep request body limits aligned between the proxy and backend. The backend default is `REQUEST_BODY_MAX_BYTES=131072` (128 KiB).

Generate an ops token with a cross-platform command:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Hosted backend environment example:

```env
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

When Nginx and the backend run in separate Docker containers, `TRUSTED_PROXY_IPS=127.0.0.1,::1` is incorrect because the backend sees the internal proxy container IP on the Docker network (e.g. `172.18.0.2` or within `172.18.0.0/16`). Set `TRUSTED_PROXY_IPS` to the specific proxy container IP or pinned container subnet.

When Cloudflare sits in front of Nginx (which in turn proxies to UniSearch):
- The immediate peer connecting to UniSearch is Nginx.
- The peer connecting to Nginx is Cloudflare.
- For `X-Forwarded-For` chain traversal, list both Nginx and Cloudflare proxy IP ranges in `TRUSTED_PROXY_IPS`, and set `TRUST_X_FORWARDED_FOR=1`.
- If using `TRUST_CF_CONNECTING_IP=1`, ensure Nginx is trusted and forwards `CF-Connecting-IP` without allowing untrusted direct clients to inject it.

## Deployment checklist

Before publishing a hosted instance:

1. `OPS_ADMIN_TOKEN` is set and not committed.
2. `FRONTEND_ORIGINS` contains the real public frontend origin.
3. Redis has no public port.
4. If running behind a reverse proxy, the backend port is bound to `127.0.0.1` (or kept internal) to prevent public bypass of the proxy.
5. `TRUST_X_FORWARDED_FOR=1` and `TRUSTED_PROXY_IPS` are configured to match the actual upstream proxy IP/subnet.
6. `/ops/*`, `/metrics`, and `/health?warmup=1` are not reachable from the public internet unless intentionally protected by an internal admin network.
7. `UNISEARCH_API_BASE_URL=/api` is generated into `frontend/env.js` for same-domain hosting.
8. `docker compose config` succeeds.
