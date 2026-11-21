# NEXUS HOME 2.0

Cloudflare Workers + Static Assets project for browsing public volunteer OpenVPN nodes.

## Important
This project uses the public VPN Gate volunteer network. It does **not** provide guaranteed residential/home broadband IPs. Nodes may be hosted by individuals, schools, or companies. Cloudflare Workers here serve the directory and configuration downloads; they do not relay OpenVPN TCP/UDP tunnels or manufacture residential IP addresses.

## Live deployment

The current public Worker deployment is available at: https://nexus-home.yxing8454.workers.dev

Health check: https://nexus-home.yxing8454.workers.dev/api/health

Node API: https://nexus-home.yxing8454.workers.dev/api/nodes

## Features
- Responsive dark web dashboard
- Fetch and parse public VPN Gate node directory
- Search by country, host name, or IP
- Sort by advertised speed or ping
- Download individual .ovpn profiles
- JSON health and node APIs
- Optional KV caching (bind a KV namespace as NODES)

## Deploy from a phone browser
1. Open Cloudflare Dashboard: https://dash.cloudflare.com/
2. Go to Workers & Pages and create a Worker from your GitHub repository.
3. Select repository yxing7249-cmd/bbg and branch main.
4. Configure the project using the checked-in wrangler.toml; build command is not required for this plain Worker project.
5. Deploy, then open the assigned workers.dev URL.

## API
- GET /api/health
- GET /api/nodes
- GET /api/nodes?country=US
- GET /api/nodes?q=tokyo&sort=ping
- GET /ovpn/1.2.3.4.ovpn

## Optional KV cache
Create a KV namespace named NODES in Cloudflare, then add its namespace ID under [[kv_namespaces]] in wrangler.toml:
```toml
[[kv_namespaces]]
binding = "NODES"
id = "YOUR_REAL_KV_NAMESPACE_ID"
```
Do not commit API tokens, passwords, or private subscription links.

## GitHub Actions
Add repository secrets CLOUDFLARE_API_TOKEN (Workers Scripts Edit permission) and CLOUDFLARE_ACCOUNT_ID before enabling the workflow.

## Local development
```bash
npm install
npm run dev
```
