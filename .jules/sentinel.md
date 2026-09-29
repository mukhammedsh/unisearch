## 2026-09-29 - Currency Rates API SSRF Prevention
**Vulnerability:** External HTTP requests in currency service (`fetch_rates`) did not validate whether the destination host resolved to an internal, loopback, or non-global IP address.
**Learning:** `urllib.request.urlopen` fetches URLs directly without validating destination IP addresses, making host configurations susceptible to SSRF targeting loopback services or cloud metadata endpoints.
**Prevention:** Always validate target schemes and verify that resolved IP addresses from `socket.getaddrinfo` satisfy `ipaddress.ip_address(ip).is_global` before dispatching HTTP requests.
