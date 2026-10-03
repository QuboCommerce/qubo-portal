#!/usr/bin/env node
// qd — Qubo dev runner. Zero dependencies (Node >= 20), Linux/macOS/Windows.
// Remote (Linux dev box): each service runs in a window of one screen session.
// Local (laptop/desktop): services run in the foreground with prefixed output.
// Run `qd help` for commands.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as dns } from "node:dns";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SELF = fileURLToPath(import.meta.url);
const RUN_SVC = join(ROOT, "scripts/dev/run-svc.sh");
const STATE_DIR = join(ROOT, ".private/dev");
const LOG_DIR = join(STATE_DIR, "logs");
const IS_WIN = process.platform === "win32";

const c = (code) => (s) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c(1), dim = c(2), red = c(31), green = c(32), yellow = c(33), cyan = c(36);
const OK = green("✓"), BAD = red("✗"), WARN = yellow("!");

class QdError extends Error {}
const fail = (msg) => { throw new QdError(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- config

function readJson(path, required) {
  if (!existsSync(path)) return required ? fail(`missing ${relative(ROOT, path)}`) : {};
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return fail(`${relative(ROOT, path)}: ${e.message}`); }
}

function detectMode() {
  if (process.platform !== "linux") return "local";
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY || !process.env.DISPLAY) return "remote";
  return "local";
}

function loadConfig() {
  const base = readJson(join(ROOT, "dev.config.json"), true);
  const local = readJson(join(ROOT, ".qubo/dev.local.json"), false);
  const mode = process.env.QD_MODE || local.mode || detectMode();
  if (!["remote", "local"].includes(mode)) fail(`mode must be "remote" or "local", got "${mode}"`);
  const devDigit = Number(local.devDigit ?? base.devDigit);
  if (!Number.isInteger(devDigit) || devDigit < 2 || devDigit > 6) fail(`devDigit must be 2..6 (ports 2010..6090), got ${devDigit}`);

  const services = {};
  for (const [name, svc] of Object.entries(base.services)) {
    const o = local.services?.[name] ?? {};
    const cwd = resolve(ROOT, o.cwd ?? svc.cwd);
    const rel = relative(ROOT, cwd);
    if (rel.startsWith("..") || isAbsolute(rel)) fail(`services.${name}.cwd escapes the repo root`);
    if (!existsSync(cwd)) fail(`services.${name}.cwd does not exist: ${rel}`);
    const port = Number(o.port ?? devDigit * 1000 + svc.portSlot * 10);
    const host = mode === "remote" ? (o.host ?? svc.host) : null;
    services[name] = { name, ...svc, ...o, cwd, rel, port, host };
  }
  const order = (local.order ?? base.order).filter((n) => services[n]);
  return {
    project: base.project, session: local.session ?? base.session, mode, devDigit, services, order,
    owner: local.owner ?? base.owner, bind: local.bind ?? "127.0.0.1", sitesBaseDomain: local.sitesBaseDomain ?? base.sitesBaseDomain, devSiteSlug: local.devSiteSlug ?? base.devSiteSlug ?? "hm-froid",
    dataPlane: { ...base.dataPlane, ...local.dataPlane },
  };
}

function readDotEnv() {
  const path = join(ROOT, ".env");
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}

function publicUrl(svc) {
  return svc.host ? `https://${svc.host}` : `http://localhost:${svc.port}`;
}

// Per-checkout secret shared by the admin/api (signer) and storefront (verifier) publish hook.
function revalidateSecret() {
  return checkoutSecret("revalidate");
}

function checkoutSecret(name) {
  const file = join(ROOT, ".qubo", `${name}.secret`);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(24).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(file, "utf8").trim();
}

// Env for one service. Process env beats .env files in both Next and Bun, so these win.
function serviceEnv(cfg, name) {
  const s = cfg.services;
  const url = (n) => (s[n] ? publicUrl(s[n]) : undefined);
  const hostOf = (n) => (s[n] ? s[n].host ?? `localhost:${s[n].port}` : undefined);
  const env = {
    PORT: String(s[name].port),
    HOST: cfg.bind,
    QUBO_DEV: "1",
    QUBO_DEV_MODE: cfg.mode,
    STOREFRONT_URL: url("web"),
    NEXT_PUBLIC_MARKETING_URL: url("web"),
    NEXT_PUBLIC_PANEL_URL: url("admin"),
    NEXT_PUBLIC_QUBO_API_URL: url("api"),
    // Server-to-server calls skip the proxy.
    QUBO_API_URL: s.api ? `http://127.0.0.1:${s.api.port}` : undefined,
    QUBO_TRUSTED_ORIGINS: [url("web"), url("admin")].filter(Boolean).join(","),
    QUBO_DEV_ORIGINS: [...Object.values(s).map((x) => x.host), cfg.mode === "remote" && cfg.sitesBaseDomain ? `*.${cfg.sitesBaseDomain}` : null].filter(Boolean).join(","),
    QUBO_ADMIN_HOSTS: hostOf("admin"),
    // Remote: sites are <slug>.<sitesBaseDomain>. Local: one site on localhost.
    PLATFORM_BASE_DOMAIN: cfg.mode === "remote" ? cfg.sitesBaseDomain : undefined,
    QUBO_DEV_SITE_HOSTS: s.web && !(cfg.mode === "remote" && cfg.sitesBaseDomain) ? `${hostOf("web")}=${cfg.devSiteSlug}` : undefined,
    QUBO_REVALIDATE_URL: s.web ? `http://localhost:${s.web.port}/api/revalidate` : undefined,
    QUBO_REVALIDATE_SECRET: s.web ? revalidateSecret() : undefined,
    BETTER_AUTH_URL: url(name),
    FORCE_COLOR: process.env.NO_COLOR ? undefined : process.env.FORCE_COLOR ?? "1",
  };
  // Per-service `env` in dev.config.json, so projects with other service names need no qd changes.
  // Templates: {url:svc} public URL, {internal:svc} loopback URL, {port:svc}, {host:svc}, {secret:name}.
  const tpl = (v) => String(v).replace(/\{(url|internal|port|host|secret):([A-Za-z0-9_-]+)\}/g, (_, kind, n) => {
    if (kind === "secret") return checkoutSecret(n);
    const t = s[n];
    if (!t) fail(`services.${name}.env references unknown service "${n}"`);
    return kind === "url" ? publicUrl(t) : kind === "internal" ? `http://127.0.0.1:${t.port}` : kind === "port" ? String(t.port) : t.host ?? `localhost:${t.port}`;
  });
  for (const [k, v] of Object.entries(s[name].env ?? {})) env[k] = v === null ? undefined : tpl(v);
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined));
}

// ---------------------------------------------------------------- probes

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: IS_WIN, ...opts });
  return { code: r.status ?? (r.error ? 127 : 1), out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const has = (cmd) => (IS_WIN ? run("where", [cmd]) : run("sh", ["-c", `command -v ${cmd}`])).code === 0;

function tcpOpen(port, host = "127.0.0.1", timeout = 800) {
  return new Promise((res) => {
    const sock = connect({ port, host });
    const done = (v) => { sock.destroy(); res(v); };
    sock.setTimeout(timeout, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

async function httpStatus(url, timeout = 3000) {
  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeout) });
    return r.status;
  } catch { return 0; }
}

// HTTPS through the local edge with the real SNI (hairpin NAT blocks the public IP from this box).
function edgeProbe(host, path = "/", timeout = 5000) {
  return new Promise((res) => {
    const req = httpsRequest({ host: "127.0.0.1", port: 443, servername: host, path, method: "GET", headers: { host }, timeout },
      (r) => { r.resume(); res({ status: r.statusCode, tls: true }); });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "timeout" })));
    req.on("error", (e) => res({ status: 0, tls: false, error: e.code || e.message }));
    req.end();
  });
}

function portHolder(port) {
  if (process.platform === "linux") {
    const r = run("ss", ["-Hltnp", `sport = :${port}`]);
    if (!r.out) return "";
    return r.out.match(/users:\(\("([^"]+)",pid=(\d+)/)?.slice(1).join(" pid ") ?? "another user's process";
  }
  if (process.platform === "darwin") return run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]).out.split("\n")[1] ?? "";
  return run("netstat", ["-ano"]).out.split("\n").find((l) => l.includes(`:${port} `) && /LISTEN/.test(l))?.trim() ?? "";
}

function gitBranch() {
  return run("git", ["-C", ROOT, "branch", "--show-current"]).out || "(detached)";
}

// ---------------------------------------------------------------- data plane

function containerState(name) {
  const r = run("docker", ["inspect", "-f", "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}", name]);
  if (r.code !== 0) return { exists: false };
  const [status, health] = r.out.split(" ");
  return { exists: true, status, health: health || null };
}

function dockerHint() {
  if (process.platform === "darwin") return "start Docker Desktop: open -a Docker";
  if (IS_WIN) return 'start Docker Desktop: Start-Process "Docker Desktop"';
  return "start the Docker daemon: sudo systemctl start docker";
}

async function ensureDataPlane(cfg, { fix = true } = {}) {
  const env = { ...readDotEnv(), ...process.env };
  const urlVar = cfg.dataPlane.databaseUrlEnv ?? "DATABASE_URL";
  let ok = true;

  if (!existsSync(join(ROOT, ".env"))) { console.log(`${BAD} .env missing at repo root — copy .env.example and fill it`); return false; }
  if (!has("docker")) { console.log(`${BAD} docker not installed`); return false; }
  if (run("docker", ["info", "--format", "{{.ServerVersion}}"]).code !== 0) { console.log(`${BAD} Docker is not running — ${dockerHint()}`); return false; }

  for (const name of cfg.dataPlane.containers ?? []) {
    let st = containerState(name);
    if (!st.exists) { console.log(`${BAD} container ${name} not found — ${cfg.dataPlane.localHint}`); ok = false; continue; }
    const healthy = () => st.status === "running" && (!st.health || st.health === "healthy");
    if (!healthy() && fix) {
      if (st.status !== "running") { console.log(`${WARN} ${name} is ${st.status} — starting`); run("docker", ["start", name]); }
      for (const deadline = Date.now() + 90_000; Date.now() < deadline && !healthy(); ) { await sleep(1500); st = containerState(name); }
    }
    console.log(`${healthy() ? OK : BAD} ${name} ${dim(`${st.status}${st.health ? `/${st.health}` : ""}`)}`);
    ok &&= healthy();
  }

  const dbUrl = env[urlVar];
  if (!dbUrl) { console.log(`${BAD} ${urlVar} not set in .env`); return false; }
  try {
    const u = new URL(dbUrl);
    const port = Number(u.port || 5432);
    const reach = await tcpOpen(port, u.hostname === "localhost" ? "127.0.0.1" : u.hostname, 2000);
    console.log(`${reach ? OK : BAD} database ${dim(`${u.hostname}:${port}${u.pathname}`)}`);
    ok &&= reach;
  } catch { console.log(`${BAD} ${urlVar} is not a valid URL`); ok = false; }
  return ok;
}

// ---------------------------------------------------------------- screen (remote)

function screenSessions(name) {
  const r = run("screen", ["-ls"], { timeout: 5000 });
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...`${r.out}\n${r.err}`.matchAll(new RegExp(`^\\s*(\\d+)\\.(${esc})\\s`, "gm"))].map((m) => `${m[1]}.${m[2]}`);
}

function screenTarget(cfg, { warn = true } = {}) {
  const s = screenSessions(cfg.session);
  if (s.length > 1 && warn) console.log(`${WARN} ${s.length} screen sessions named "${cfg.session}"; using ${s[0]}. Remove extras: screen -S <id> -X quit`);
  return s[0] ?? null;
}

// screen can block indefinitely when its socket is busy; never let that wedge qd or the hub.
const scr = (target, ...args) => run("screen", ["-S", target, ...args], { timeout: 5000 });
// `screen -Q` uses a temporary "<session>-queryA" socket, so two concurrent queries (e.g. the hub's
// status refresh and `qd up`) collide and one fails. One `-Q windows` per check, retried with jitter.
function windowTitles(target) {
  for (let i = 0; i < 8; i++) {
    const r = scr(target, "-Q", "windows");
    if (r.code === 0 && r.out && !r.out.includes("There is already a screen")) {
      return [...r.out.matchAll(/(\d+)\S*\s(.+?)(?=\s{2}\d+\S*\s|$)/g)].map((m) => m[2].trim());
    }
    spawnSync(process.execPath, ["-e", `setTimeout(()=>{},${100 + Math.floor(Math.random() * 300)})`]);
  }
  return fail(`could not query screen session ${target}; try again, or: screen -r ${target}`);
}
const hasWindow = (target, win) => windowTitles(target).includes(win);

function svcState(name) {
  const p = join(STATE_DIR, "state", name);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

const windowCmd = (name) => ["bash", "--noprofile", "--norc", RUN_SVC, name];

async function withLock(fn) {
  const lock = join(STATE_DIR, "qd.lock");
  mkdirSync(STATE_DIR, { recursive: true });
  for (let i = 0; ; i++) {
    try { mkdirSync(lock); break; }
    catch {
      try { if (Date.now() - statSync(lock).mtimeMs > 30_000) { rmSync(lock, { recursive: true, force: true }); continue; } } catch { continue; }
      if (i > 60) fail("another qd is running (lock .private/dev/qd.lock)");
      await sleep(500);
    }
  }
  try { return await fn(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

function ensureSession(cfg) {
  if (!has("screen")) fail("screen is not installed (sudo apt install screen) — or use local mode: QD_MODE=local");
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(join(STATE_DIR, "state"), { recursive: true });
  run("screen", ["-wipe"]);
  let target = screenTarget(cfg);
  if (target) return target;
  const r = run("screen", ["-dmS", cfg.session, "-t", "hub", ...windowCmd("hub")], { cwd: ROOT });
  if (r.code !== 0) fail(`could not start screen session: ${r.err || r.out}`);
  target = screenTarget(cfg);
  if (!target) fail("screen session did not come up");
  scr(target, "-X", "logfile", join(LOG_DIR, "%t.log"));
  scr(target, "-X", "logfile", "flush", "1");
  scr(target, "-X", "defscrollback", "20000");
  console.log(`${OK} screen session ${bold(cfg.session)} created ${dim(`(window 0 = hub)`)}`);
  return target;
}

function startWindow(cfg, target, name) {
  const idx = cfg.order.indexOf(name) + 1;
  if (hasWindow(target, name)) {
    const st = svcState(name);
    if (st.startsWith("exited")) {
      scr(target, "-p", name, "-X", "stuff", "r");
      return console.log(`${OK} ${name}: restarted in window ${idx} ${dim(`(was ${st})`)}`);
    }
    return console.log(`${OK} ${name}: already running in window ${idx}`);
  }
  const r = scr(target, "-X", "screen", "-t", name, String(idx), ...windowCmd(name));
  if (r.code !== 0) fail(`could not open window ${name}: ${r.err || r.out}`);
  scr(target, "-p", name, "-X", "log", "on");
  console.log(`${OK} ${name}: started in window ${idx} ${dim(`→ ${publicUrl(cfg.services[name])}`)}`);
}

async function waitPortFree(port, ms = 15_000) {
  for (const deadline = Date.now() + ms; Date.now() < deadline; ) {
    if (!(await tcpOpen(port))) return true;
    await sleep(300);
  }
  return false;
}

// ---------------------------------------------------------------- commands

function pickServices(cfg, names) {
  for (const n of names) if (!cfg.services[n]) fail(`unknown service "${n}" (have: ${cfg.order.join(", ")})`);
  return names.length ? cfg.order.filter((n) => names.includes(n)) : cfg.order;
}

async function cmdUp(cfg, names) {
  const list = pickServices(cfg, names);
  const branch = gitBranch();
  console.log(`${bold("qd up")} ${dim(`mode=${cfg.mode} branch=${branch}`)}`);
  if (["main", "staging"].includes(branch)) console.log(`${WARN} on ${branch} — day-to-day work belongs on ali/<type>-<slug> branches`);
  if (!existsSync(join(ROOT, "node_modules"))) fail("dependencies not installed — run: pnpm install");
  if (!(await ensureDataPlane(cfg))) fail("data plane not ready (see above) — qd doctor for details");
  if (cfg.mode === "local") return runLocal(cfg, list);
  await withLock(() => {
    const target = ensureSession(cfg);
    for (const n of list) startWindow(cfg, target, n);
  });
  console.log(dim(`\nattach: qd attach [${cfg.order.join("|")}]   or   screen -r ${cfg.session}`));
}

async function cmdAttach(cfg, name) {
  if (cfg.mode !== "remote") fail("attach is for remote mode (screen); in local mode services run in your terminal");
  if (name) pickServices(cfg, [name]);
  if (process.env.STY) fail(`already inside screen — use Ctrl-A " to switch windows`);
  const target = screenTarget(cfg);
  if (!target || (name && !hasWindow(target, name))) {
    console.log(dim(`${name ?? "session"} not running — starting it first`));
    await cmdUp(cfg, name ? [name] : []);
    return cmdAttach(cfg, name);
  }
  const r = spawnSync("screen", ["-x", target, ...(name ? ["-p", name] : [])], { stdio: "inherit" });
  process.exitCode = r.status ?? 0;
}

async function statusLines(cfg) {
  const target = cfg.mode === "remote" && has("screen") ? screenTarget(cfg, { warn: false }) : null;
  let titles = null;
  try { titles = target ? windowTitles(target) : null; } catch { /* shown as unknown */ }
  const branch = gitBranch();
  const branchOk = /^[a-z0-9]+\/(feat|fix|refactor|docs|chore|infra|experiment)-[a-z0-9]+(-[a-z0-9]+)*$/.test(branch);
  const lines = [`${bold(cfg.project)} ${dim(`mode=${cfg.mode} dev=${cfg.devDigit}`)}  branch ${branchOk ? green(branch) : yellow(branch)}` +
    (cfg.mode === "remote" ? `  session ${target ? green(target) : red("none")}` : "")];
  const rows = await Promise.all(cfg.order.map(async (n) => {
    const s = cfg.services[n];
    const listening = await tcpOpen(s.port);
    const code = listening ? await httpStatus(`http://127.0.0.1:${s.port}${s.health ?? "/"}`, 8000) : 0;
    const healthy = code > 0 && code < 500;
    const win = titles ? (titles.includes(n) ? svcState(n) || "window" : "no window") : "";
    let edge = "";
    if (s.host) {
      const p = await edgeProbe(s.host, s.health ?? "/");
      edge = p.tls && p.status ? `${p.status < 500 ? OK : BAD} https://${s.host} ${dim(p.status)}` : `${BAD} https://${s.host} ${dim(p.error ?? "no route")}`;
    }
    const state = listening ? (code ? `HTTP ${code}` : "compiling…") : "down";
    return `  ${healthy ? OK : listening ? WARN : BAD} ${n.padEnd(6)} :${s.port}  ${state.padEnd(11)} ${dim(win.padEnd(10))} ${edge}`;
  }));
  return [...lines, ...rows];
}

async function cmdStatus(cfg, watch) {
  if (!watch) return console.log((await statusLines(cfg)).join("\n"));
  for (;;) {
    const lines = await statusLines(cfg);
    process.stdout.write(`\x1b[H\x1b[2J${lines.join("\n")}\n\n${dim(`${new Date().toLocaleTimeString()} · Ctrl-A " windows · Ctrl-A <n> switch · Ctrl-A d detach`)}\n`);
    await sleep(3000);
  }
}

async function cmdRestart(cfg, names) {
  if (cfg.mode !== "remote") fail("restart is for remote mode; in local mode press Ctrl-C and run qd up again");
  if (!names.length) fail("usage: qd restart <svc…>");
  const list = pickServices(cfg, names);
  await withLock(async () => {
    const target = ensureSession(cfg);
    for (const n of list) {
      if (hasWindow(target, n)) {
        scr(target, "-p", n, "-X", "kill");
        if (!(await waitPortFree(cfg.services[n].port))) console.log(`${WARN} ${n}: port ${cfg.services[n].port} still held by ${portHolder(cfg.services[n].port)}`);
      }
      startWindow(cfg, target, n);
    }
  });
}

function cmdStop(cfg, names, all) {
  if (cfg.mode !== "remote") fail("stop is for remote mode; in local mode press Ctrl-C");
  const target = screenTarget(cfg);
  if (!target) return console.log(dim("no session running"));
  if (all) { scr(target, "-X", "quit"); return console.log(`${OK} session ${target} closed ${dim("(data plane untouched)")}`); }
  for (const n of pickServices(cfg, names)) {
    if (hasWindow(target, n)) { scr(target, "-p", n, "-X", "kill"); console.log(`${OK} ${n} stopped`); }
    else console.log(dim(`${n} was not running`));
  }
}

function cmdLogs(cfg, name, follow) {
  if (!name) fail("usage: qd logs <svc> [-f]");
  pickServices(cfg, [name]);
  const file = join(LOG_DIR, `${name}.log`);
  if (!existsSync(file)) fail(`no log yet: ${relative(ROOT, file)}`);
  if (IS_WIN) return void process.stdout.write(readFileSync(file, "utf8").split("\n").slice(-200).join("\n"));
  spawnSync("tail", ["-n", "200", ...(follow ? ["-f"] : []), file], { stdio: "inherit" });
}

async function cmdDoctor(cfg) {
  let bad = 0;
  const line = (ok, msg, fix) => { if (!ok) bad++; console.log(`${ok ? OK : BAD} ${msg}${!ok && fix ? `\n    ${dim("fix:")} ${fix}` : ""}`); };
  console.log(bold("toolchain"));
  const want = existsSync(join(ROOT, ".node-version")) ? readFileSync(join(ROOT, ".node-version"), "utf8").trim().replace(/^v/, "") : null;
  line(!want || Number(process.versions.node.split(".")[0]) >= Number(want.split(".")[0]),
    `node ${process.versions.node}${want ? dim(` (.node-version ${want})`) : ""}`, `install Node ${want}+ (fnm install ${want})`);
  for (const tool of ["pnpm", "bun", "git", "docker", ...(cfg.mode === "remote" ? ["screen"] : [])]) line(has(tool), tool, `install ${tool}`);
  line(existsSync(join(ROOT, "node_modules")), "dependencies installed", "pnpm install");

  console.log(bold("\ndata plane"));
  if (!(await ensureDataPlane(cfg, { fix: false }))) bad++;

  console.log(bold("\nports"));
  for (const n of cfg.order) {
    const s = cfg.services[n];
    const holder = portHolder(s.port);
    console.log(`${holder ? OK : dim("·")} ${n.padEnd(6)} :${s.port} ${dim(holder ? `in use by ${holder}` : "free")}  ${dim(`cwd ${s.rel}`)}`);
  }

  if (cfg.mode === "remote") {
    console.log(bold("\nedge"));
    for (const n of cfg.order) {
      const s = cfg.services[n];
      if (!s.host) continue;
      const ips = await dns.resolve4(s.host).catch(() => []);
      line(ips.length > 0, `DNS ${s.host} ${dim(ips.join(", ") || "no A record")}`, `add a record for ${s.host} at the DNS provider (see ~/infra/README.md)`);
      const p = await edgeProbe(s.host, s.health ?? "/");
      const certIssue = /CERT|SELF_SIGNED|ALTNAME/.test(p.error ?? "");
      line(p.tls && p.status > 0, `HTTPS ${s.host} via edge ${dim(p.status || p.error)}`,
        certIssue ? "certificate not issued yet: fix DNS first, then docker restart edge-traefik; docker logs edge-traefik"
          : "is the edge running? cd ~/infra/edge && docker compose -p edge up -d");
    }
  }
  console.log(bad ? `\n${BAD} ${bad} problem(s)` : `\n${OK} all good`);
  process.exitCode = bad ? 1 : 0;
}

// Runs one service in the foreground: inside a screen window (via run-svc.sh) or as a local-mode child.
async function cmdExec(cfg, name) {
  if (!name) fail("usage: qd exec <svc>");
  pickServices(cfg, [name]);
  const s = cfg.services[name];
  if (await tcpOpen(s.port)) fail(`port ${s.port} is already in use by ${portHolder(s.port) || "another process"} — stop it, or set services.${name}.port in .qubo/dev.local.json`);
  const env = { ...process.env, ...serviceEnv(cfg, name) };
  const [cmd, ...args] = s.cmd.map((a) => a.replaceAll("{port}", String(s.port)).replaceAll("{bind}", cfg.bind));
  console.log(dim(`${s.rel}$ ${[cmd, ...args].join(" ")}`));
  console.log(dim(`→ http://127.0.0.1:${s.port}${s.host ? `  ·  https://${s.host}` : ""}`));
  const child = spawn(cmd, args, { cwd: s.cwd, env, stdio: "inherit", shell: IS_WIN });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.exitCode === null && child.kill(sig));
  await new Promise((r) => {
    child.on("error", (e) => { console.error(`${BAD} ${cmd}: ${e.message}`); process.exitCode = 127; r(); });
    child.on("exit", (code, sig) => { process.exitCode = code ?? (sig ? 1 : 0); r(); });
  });
}

function runLocal(cfg, list) {
  const colors = [cyan, yellow, green, c(35), c(34)];
  let stopping = false;
  const width = Math.max(...list.map((n) => n.length));
  const children = list.map((n, i) => {
    const tag = colors[i % colors.length](n.padEnd(width));
    const child = spawn(process.execPath, [SELF, "exec", n], { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const pipe = (stream, out) => {
      let buf = "";
      stream.on("data", (d) => { buf += d; const parts = buf.split(/\r?\n/); buf = parts.pop(); for (const l of parts) out.write(`${tag} │ ${l}\n`); });
    };
    pipe(child.stdout, process.stdout); pipe(child.stderr, process.stderr);
    child.on("exit", (code) => console.log(`${tag} │ ${code && !stopping ? red(`exited ${code}`) : dim("stopped")}`));
    return child;
  });
  for (const n of list) console.log(`${OK} ${n} ${dim(`→ ${publicUrl(cfg.services[n])}`)}`);
  const stopAll = () => { stopping = true; for (const ch of children) if (ch.exitCode === null) ch.kill("SIGTERM"); };
  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);
  return Promise.all(children.map((ch) => new Promise((r) => ch.on("exit", r))));
}

const BRANCH_TYPES = ["feat", "fix", "refactor", "docs", "chore", "infra", "experiment"];

function gitOk(args, what) {
  const r = run("git", ["-C", ROOT, ...args]);
  if (r.code !== 0) fail(`${what}: ${r.err || r.out}`);
  return r.out;
}

const remoteHas = (branch) => run("git", ["-C", ROOT, "ls-remote", "--exit-code", "--heads", "origin", branch]).code === 0;

// <owner>/<type>-<slug> from a fresh origin/staging (origin/main until staging exists).
function cmdBranch(cfg, [sub, type, ...words]) {
  if (sub !== "new" || !type || !words.length) fail(`usage: qd branch new <${BRANCH_TYPES.join("|")}> <slug words…>`);
  if (!BRANCH_TYPES.includes(type)) fail(`type must be one of ${BRANCH_TYPES.join(", ")}`);
  const slug = words.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) fail("slug is empty");
  const owner = cfg.owner || fail('set "owner" in .qubo/dev.local.json (e.g. {"owner":"ali"})');
  if (gitOk(["status", "--porcelain"], "git status")) fail("working tree has changes — commit or stash first");
  const base = remoteHas("staging") ? "staging" : "main";
  if (base === "main") console.log(`${WARN} origin/staging does not exist yet — branching from main`);
  gitOk(["fetch", "origin", base], `fetch ${base}`);
  const name = `${owner}/${type}-${slug}`;
  gitOk(["switch", "-c", name, `origin/${base}`], `create ${name}`);
  console.log(`${OK} on ${bold(name)} ${dim(`(from origin/${base}; PR with: qd pr)`)}`);
}

// Push the current branch and open a PR into the base the governance check allows.
function cmdPr() {
  const branch = gitBranch();
  const base = branch.startsWith("hotfix/") ? "main" : branch === "staging" ? "main" : "staging";
  if (["main", "(detached)"].includes(branch)) fail(`cannot open a PR from ${branch} — qd branch new <type> <slug>`);
  const check = run("node", [join(ROOT, "scripts/check-branch-governance.mjs"), branch, base], { env: { ...process.env, SOLO_MODE: process.env.SOLO_MODE ?? "1" } });
  if (check.code !== 0) fail(check.err || check.out);
  if (!has("gh")) fail("GitHub CLI not installed (https://cli.github.com), or open the PR in the browser");
  gitOk(["push", "-u", "origin", branch], "push");
  const subject = gitOk(["log", "-1", "--format=%s"], "git log");
  const template = join(ROOT, ".github/pull_request_template.md");
  const args = ["pr", "create", "--base", base, "--head", branch, "--title", subject, ...(existsSync(template) ? ["--body-file", template] : ["--fill"])];
  const r = spawnSync("gh", args, { cwd: ROOT, stdio: "inherit", shell: IS_WIN });
  process.exitCode = r.status ?? 1;
}

function cmdEnv(cfg, name) {
  if (!name) fail("usage: qd env <svc>");
  pickServices(cfg, [name]);
  for (const [k, v] of Object.entries(serviceEnv(cfg, name))) console.log(`${k}=${v}`);
}

const HELP = `${bold("qd")} — Qubo dev runner

  qd up [svc…]          preflight (deps, Docker, database), then start services
                        remote: windows in screen session "qubo" (detached)
                        local:  foreground, prefixed output, Ctrl-C stops all
  qd attach [svc]       attach to a service window (no arg: whole session)
  qd status [--watch]   services, ports, health, public URLs, branch
  qd restart <svc…>     respawn service windows in place
  qd stop [svc…]        stop services; no arg = all (data plane untouched)
  qd down               close the whole screen session
  qd logs <svc> [-f]    service log (.private/dev/logs/<svc>.log)
  qd doctor             full checks with the fix for each problem
  qd env <svc>          print the environment qd injects
  qd branch new <type> <slug…>  <owner>/<type>-<slug> from fresh origin/staging
  qd pr                 push + open a PR (work → staging, hotfix/staging → main)

  config: dev.config.json · overrides: .qubo/dev.local.json · QD_MODE=local|remote`;

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith("-")));
  const args = rest.filter((a) => !a.startsWith("-"));
  if (["help", "-h", "--help"].includes(command)) return console.log(HELP);
  const cfg = loadConfig();
  switch (command) {
    case "up": return cmdUp(cfg, args);
    case "attach": return cmdAttach(cfg, args[0]);
    case "status": return cmdStatus(cfg, flags.has("--watch") || flags.has("-w"));
    case "restart": return cmdRestart(cfg, args);
    case "stop": return cmdStop(cfg, args, args.length === 0);
    case "down": return cmdStop(cfg, [], true);
    case "logs": return cmdLogs(cfg, args[0], flags.has("-f"));
    case "doctor": return cmdDoctor(cfg);
    case "exec": return cmdExec(cfg, args[0]);
    case "env": return cmdEnv(cfg, args[0]);
    case "branch": return cmdBranch(cfg, args);
    case "pr": return cmdPr();
    default: fail(`unknown command "${command}" — qd help`);
  }
}

main().catch((e) => {
  console.error(`${BAD} ${e instanceof QdError ? e.message : e.stack}`);
  process.exitCode = 1;
});
