const SOURCE = "https://www.vpngate.net/api/iphone/";
const CACHE_TTL = 1800;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

function parseCsvLine(line) {
  const out = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { out.push(value); value = ""; }
    else value += c;
  }
  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith("*HostName"));
  if (start < 0) return [];
  const headers = lines[start].slice(1).split(",");
  return lines.slice(start + 1).filter(line => line && !line.startsWith("*"))
    .map(line => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((key, i) => [key, cells[i] || ""]));
    });
}

async function getNodes(env) {
  const now = Date.now();
  if (env.NODES) {
    const cached = await env.NODES.get("nodes", "json");
    if (cached && now - cached.updatedAt < CACHE_TTL * 1000) return cached;
  }
  const response = await fetch(SOURCE, {
    headers: { "user-agent": "NEXUS-HOME/2.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("VPN Gate source returned " + response.status);
  const max = Math.max(1, Math.min(200, Number(env.MAX_NODES) || 80));
  const nodes = parseCsv(await response.text()).map(row => ({
    ip: row.IP || "",
    name: row.HostName || row.IP || "Unknown",
    country: row.CountryLong || "Unknown",
    countryCode: row.CountryShort || "XX",
    ping: Number(row.Ping) || null,
    speed: Number(row.Speed) || 0,
    sessions: Number(row.NumVpnSessions) || 0,
    config: row.OpenVPN_ConfigData_Base64 || ""
  })).filter(node => node.ip && node.config && node.speed > 0)
    .sort((a, b) => b.speed - a.speed)
    .slice(0, max);
  const result = { updatedAt: now, source: "VPN Gate public volunteer network", count: nodes.length, nodes };
  if (env.NODES) await env.NODES.put("nodes", JSON.stringify(result), { expirationTtl: CACHE_TTL * 2 });
  return result;
}

function publicNode(node) {
  const { config, ...safe } = node;
  return safe;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
      if (url.pathname === "/api/health") {
        return json({ ok: true, app: env.APP_NAME || "NEXUS HOME", version: "2.0.0" });
      }
      if (url.pathname === "/api/nodes") {
        const data = await getNodes(env);
        const country = (url.searchParams.get("country") || "").toUpperCase();
        const q = (url.searchParams.get("q") || "").toLowerCase().slice(0, 80);
        const sort = url.searchParams.get("sort") || "speed";
        let nodes = data.nodes.filter(n =>
          (!country || n.countryCode.toUpperCase() === country) &&
          (!q || [n.ip, n.name, n.country, n.countryCode].some(v => String(v).toLowerCase().includes(q)))
        );
        if (sort === "ping") nodes.sort((a, b) => (a.ping ?? 999999) - (b.ping ?? 999999));
        else nodes.sort((a, b) => b.speed - a.speed);
        return json({ ...data, count: nodes.length, nodes: nodes.map(publicNode) });
      }
      if (url.pathname.startsWith("/ovpn/")) {
        const ip = decodeURIComponent(url.pathname.slice(6).replace(/\.ovpn$/, ""));
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return new Response("Invalid IP", { status: 400 });
        const data = await getNodes(env);
        const node = data.nodes.find(n => n.ip === ip);
        if (!node) return new Response("Node not found", { status: 404 });
        const bytes = Uint8Array.from(atob(node.config), c => c.charCodeAt(0));
        return new Response(bytes, { headers: {
          "content-type": "application/x-openvpn-profile",
          "content-disposition": 'attachment; filename="nexus-' + ip + '.ovpn"',
          "cache-control": "no-store"
        }});
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, 502);
    }
  }
};
