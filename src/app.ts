import express from "express";
import { verifyChallenge } from "./challenge.ts";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Store, secret, hash, password, verify } from "./store.ts";

const originSchema = z
  .string()
  .max(250)
  .refine((s) => {
    try {
      const u = new URL(s);
      return (
        !u.username &&
        !u.password &&
        u.origin === s &&
        (u.protocol === "https:" ||
          (u.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(u.hostname)))
      );
    } catch {
      return false;
    }
  }, "HTTPS 홈페이지 주소를 경로 없이 입력하세요.");
const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  contact: z.string().trim().min(3).max(200),
  message: z.string().max(2000),
  consent: z.literal(true),
});
const configSchema = z.object({
  name: z.string().trim().min(1).max(80),
  origins: z.array(originSchema).min(1).max(10),
  engine: z.enum(["api", "subscription"]),
  greeting: z.string().max(500),
  rules: z.string().max(6000),
  knowledge: z.string().max(40000),
  maxSeconds: z.number().int().min(30).max(600),
  maxConcurrent: z.number().int().min(1).max(5),
  turnstileSiteKey: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9_-]*$/)
    .default(""),
  enabled: z.boolean().default(true),
  dailyStarts: z.number().int().min(1).max(100).default(3),
  cooldownSeconds: z.number().int().min(0).max(3600).default(60),
  dailySeconds: z.number().int().min(60).max(86400),
});
type Config = z.infer<typeof configSchema>;
type Job = {
  id: string;
  kind: string;
  sessionId: string;
  payload: any;
  deadline: number;
};
type Link = {
  site: string;
  token: string;
  seen: number;
  capabilities: Record<string, boolean>;
  queue: Job[];
  waiter?: () => void;
};
type Session = {
  id: string;
  site: string;
  token: string;
  config: Config;
  revision: number;
  started: number;
  expires: number;
  seen: number;
  voice: boolean;
  starting: boolean;
  busy: boolean;
  history: { role: string; text: string }[];
  replies: Map<string, { text: string; reply: string }>;
  requests: number;
};
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const bearer = (req: Request) =>
  req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : "";

export function createApp(options: {
  dbPath: string;
  origin: string;
  desktopToken?: string;
  turnstileSecret?: string;
}) {
  const store = new Store(options.dbPath),
    app = express(),
    origin = new URL(options.origin).origin;
  const pairs = new Map<string, { site: string; expires: number }>(),
    links = new Map<string, Link>(),
    sessions = new Map<string, Session>();
  const pending = new Map<
    string,
    {
      site: string;
      session: string;
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
      kind: string;
    }
  >();
  const limits = new Map<string, { count: number; until: number }>();
  const web = fileURLToPath(new URL("../web/", import.meta.url));
  app.disable("x-powered-by");
  app.use(express.json({ limit: "96kb" }));
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
    if (!req.path.startsWith("/frame/")) res.set("X-Frame-Options", "DENY");
    next();
  });
  function rate(key: string, max: number, ms: number) {
    const now = Date.now();
    let entry = limits.get(key);
    if (!entry || entry.until < now) {
      entry = { count: 0, until: now + ms };
      limits.set(key, entry);
    }
    if (++entry.count > max)
      fail(429, "요청이 많습니다. 잠시 후 다시 시도하세요.");
  }
  function desktop(req: Request) {
    return (
      !!options.desktopToken && hash(bearer(req)) === hash(options.desktopToken)
    );
  }
  if (options.desktopToken) {
    store.run(
      "INSERT OR IGNORE INTO providers VALUES (?,?,?)",
      "desktop",
      "desktop@local.invalid",
      password(secret()),
    );
    app.use("/api", (req, _res, next) => {
      if (!desktop(req))
        fail(403, "Desktop 설정 패널에서만 접근할 수 있습니다.");
      if (["/register", "/login", "/logout"].includes(req.path))
        fail(403, "Desktop 인증을 사용합니다.");
      next();
    });
  }
  function sameOrigin(req: Request) {
    if (desktop(req)) return;
    if (req.headers.origin !== origin) fail(403, "허용되지 않은 요청입니다.");
  }
  function owner(req: Request) {
    if (desktop(req)) return "desktop";
    const token = (req.headers.cookie ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("hc_admin="))
      ?.slice(9);
    const login =
      token &&
      store.get(
        "SELECT owner FROM logins WHERE token=? AND expires>?",
        hash(token),
        Date.now(),
      );
    if (!login) fail(401, "로그인이 필요합니다.");
    return login.owner as string;
  }
  function siteFor(req: Request) {
    const user = owner(req),
      site = store.get(
        "SELECT * FROM sites WHERE id=? AND owner=?",
        req.params.id,
        user,
      );
    if (!site) fail(404, "사이트를 찾을 수 없습니다.");
    return site;
  }
  function linkFor(req: Request) {
    const token = hash(bearer(req));
    const link = [...links.values()].find((l) => l.token === token);
    if (!link) fail(401, "연결 인증이 만료되었습니다. 다시 연결하세요.");
    link.seen = Date.now();
    return link;
  }
  function sessionFor(req: Request) {
    const s = sessions.get(hash(bearer(req)));
    if (!s || s.expires < Date.now())
      fail(401, "상담이 종료되었습니다. 다시 시작하세요.");
    s.seen = Date.now();
    return s;
  }
  function online(site: string) {
    const l = links.get(site);
    return !!l && l.seen > Date.now() - 35000;
  }
  function publicSite(row: any) {
    const c = JSON.parse(row.published) as Config;
    const link = links.get(row.id);
    return {
      id: row.id,
      name: c.name,
      greeting: c.greeting,
      engine: c.engine,
      maxSeconds: c.maxSeconds,
      turnstileSiteKey: c.turnstileSiteKey || "",
      online: online(row.id),
      voiceReady: online(row.id) && !!link?.capabilities[c.engine],
      demo: !!link?.capabilities.demo,
    };
  }
  function enqueue(
    site: string,
    kind: string,
    sessionId: string,
    payload: any,
    timeout = 90000,
  ) {
    const link = links.get(site);
    if (!link || !online(site))
      return Promise.reject(
        new HttpError(
          503,
          "상담 서버가 연결되지 않았습니다. 제공자에게 문의하세요.",
        ),
      );
    const id = randomUUID();
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        link.queue = link.queue.filter((j) => j.id !== id);
        reject(new HttpError(504, "상담 서버 응답 시간이 초과되었습니다."));
      }, timeout);
      timer.unref();
      pending.set(id, {
        site,
        session: sessionId,
        resolve,
        reject,
        timer,
        kind,
      });
      link.queue.push({
        id,
        kind,
        sessionId,
        payload,
        deadline: Date.now() + timeout,
      });
      link.waiter?.();
    });
  }
  function fireStop(s: Session) {
    void enqueue(s.site, "close", s.id, {}, 10000).catch(() => {});
  }
  function finish(s: Session, status = "ended") {
    if (!sessions.delete(s.token)) return;
    for (const [id, p] of pending) {
      if (p.session === s.id) {
        clearTimeout(p.timer);
        p.reject(new HttpError(410, "상담이 종료되었습니다."));
        pending.delete(id);
      }
    }
    const l = links.get(s.site);
    if (l) l.queue = l.queue.filter((j) => j.sessionId !== s.id);
    fireStop(s);
    const used = Math.min(
      s.config.maxSeconds,
      Math.ceil((Date.now() - s.started) / 1000),
    );
    store.run(
      "UPDATE consultations SET ended=?,status=?,used=? WHERE id=?",
      Date.now(),
      status,
      used,
      s.id,
    );
  }
  function cookie(res: Response, token: string) {
    res.setHeader(
      "Set-Cookie",
      `hc_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${origin.startsWith("https:") ? "; Secure" : ""}`,
    );
  }
  function login(res: Response, id: string) {
    const token = secret();
    store.run(
      "INSERT INTO logins VALUES (?,?,?)",
      hash(token),
      id,
      Date.now() + 43200000,
    );
    cookie(res, token);
  }
  app.post("/api/register", (req, res) => {
    sameOrigin(req);
    rate(`auth:${req.ip}`, 10, 600000);
    const b = z
      .object({
        email: z.email().max(200),
        password: z.string().min(12).max(200),
      })
      .parse(req.body);
    const id = randomUUID();
    try {
      store.run(
        "INSERT INTO providers VALUES (?,?,?)",
        id,
        b.email.toLowerCase(),
        password(b.password),
      );
    } catch {
      fail(409, "이미 등록된 이메일입니다.");
    }
    login(res, id);
    res.status(201).json({ email: b.email });
  });
  app.post("/api/login", (req, res) => {
    sameOrigin(req);
    rate(`auth:${req.ip}`, 10, 600000);
    const b = z
      .object({ email: z.email().max(200), password: z.string().max(200) })
      .parse(req.body);
    const p = store.get(
      "SELECT * FROM providers WHERE email=?",
      b.email.toLowerCase(),
    );
    if (!p || !verify(b.password, p.password))
      fail(401, "이메일 또는 비밀번호를 확인하세요.");
    login(res, p.id);
    res.json({ email: p.email });
  });
  app.post("/api/logout", (req, res) => {
    sameOrigin(req);
    owner(req);
    const token = (req.headers.cookie ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("hc_admin="))!
      .slice(9);
    store.run("DELETE FROM logins WHERE token=?", hash(token));
    res.setHeader(
      "Set-Cookie",
      "hc_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    res.json({ ok: true });
  });
  app.get("/api/me", (req, res) => {
    res.json({
      email: store.get("SELECT email FROM providers WHERE id=?", owner(req))
        .email,
    });
  });
  function adminSite(s: any) {
    return {
      id: s.id,
      draft: JSON.parse(s.draft),
      revision: s.revision,
      published: !!s.published,
      snippet: `<script src="${origin}/widget.js" data-site-id="${s.id}" async></script>`,
      online: online(s.id),
      capabilities: links.get(s.id)?.capabilities ?? {},
    };
  }
  app.get("/api/sites", (req, res) =>
    res.json(
      store.all("SELECT * FROM sites WHERE owner=?", owner(req)).map(adminSite),
    ),
  );
  app.post("/api/sites", (req, res) => {
    sameOrigin(req);
    const user = owner(req),
      config = configSchema.parse(req.body);
    if (
      store.get("SELECT count(*) AS n FROM sites WHERE owner=?", user).n >= 20
    )
      fail(409, "MVP는 계정당 20개 사이트까지 지원합니다.");
    const id = `site_${secret().slice(0, 16)}`;
    store.run(
      "INSERT INTO sites(id,owner,draft) VALUES (?,?,?)",
      id,
      user,
      JSON.stringify(config),
    );
    res
      .status(201)
      .json(adminSite(store.get("SELECT * FROM sites WHERE id=?", id)));
  });
  app.get("/api/sites/:id", (req, res) => res.json(adminSite(siteFor(req))));
  app.put("/api/sites/:id", (req, res) => {
    sameOrigin(req);
    const s = siteFor(req),
      c = configSchema.parse(req.body);
    store.run("UPDATE sites SET draft=? WHERE id=?", JSON.stringify(c), s.id);
    res.json({ ok: true });
  });
  app.post("/api/sites/:id/publish", (req, res) => {
    sameOrigin(req);
    const s = siteFor(req);
    configSchema.parse(JSON.parse(s.draft));
    store.run(
      "UPDATE sites SET published=draft,revision=revision+1 WHERE id=?",
      s.id,
    );
    if (!configSchema.parse(JSON.parse(s.draft)).enabled)
      for (const session of sessions.values())
        if (session.site === s.id) finish(session, "paused");
    res.json({ revision: s.revision + 1 });
  });
  app.post("/api/sites/:id/pair", (req, res) => {
    sameOrigin(req);
    const s = siteFor(req);
    for (const [key, p] of pairs) if (p.site === s.id) pairs.delete(key);
    const code = secret().slice(0, 16);
    pairs.set(hash(code), { site: s.id, expires: Date.now() + 300000 });
    res.json({ code, expiresIn: 300 });
  });
  app.post("/api/sites/:id/disconnect", (req, res) => {
    sameOrigin(req);
    const s = siteFor(req);
    for (const session of sessions.values())
      if (session.site === s.id) finish(session, "disconnected");
    links.get(s.id)?.waiter?.();
    links.delete(s.id);
    for (const [key, p] of pairs) if (p.site === s.id) pairs.delete(key);
    res.json({ ok: true });
  });
  app.get("/api/sites/:id/activity", (req, res) => {
    const s = siteFor(req);
    res.json({
      sessions: store.all(
        "SELECT * FROM consultations WHERE site=? ORDER BY started DESC LIMIT 50",
        s.id,
      ),
      leads: store.all(
        "SELECT name,contact,message,created FROM leads WHERE site=? ORDER BY created DESC LIMIT 50",
        s.id,
      ),
    });
  });
  app.post("/connector/pair", (req, res) => {
    rate(`pair:${req.ip}`, 15, 600000);
    const { code } = z.object({ code: z.string().max(100) }).parse(req.body);
    const key = hash(code),
      p = pairs.get(key);
    if (!p || p.expires < Date.now())
      fail(401, "연결 코드가 만료되었거나 이미 사용되었습니다.");
    pairs.delete(key);
    for (const s of sessions.values())
      if (s.site === p.site) finish(s, "reconnected");
    links.get(p.site)?.waiter?.();
    const token = secret();
    links.set(p.site, {
      site: p.site,
      token: hash(token),
      seen: Date.now(),
      capabilities: {},
      queue: [],
    });
    res.json({ token, siteId: p.site });
  });
  app.post("/connector/heartbeat", (req, res) => {
    const link = linkFor(req);
    const b = z
      .object({ capabilities: z.record(z.string(), z.boolean()) })
      .parse(req.body);
    link.capabilities = b.capabilities;
    res.json({ ok: true });
  });
  app.get("/connector/jobs", async (req, res) => {
    const link = linkFor(req);
    if (link.waiter) fail(409, "이미 작업을 기다리고 있습니다.");
    if (!link.queue.length)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 20000);
        function done() {
          clearTimeout(timer);
          link.waiter = undefined;
          resolve();
        }
        link.waiter = done;
        res.once("close", done);
      });
    if (res.destroyed) return;
    const job = link.queue.shift();
    res.json(job ?? { idle: true });
  });
  app.post("/connector/result", (req, res) => {
    const l = linkFor(req);
    const b = z
      .object({
        id: z.string(),
        ok: z.boolean(),
        data: z.unknown().optional(),
        error: z.string().max(500).optional(),
        errorCode: z
          .enum([
            "voice_quota",
            "voice_auth",
            "voice_unavailable",
            "connector_failed",
          ])
          .optional(),
      })
      .parse(req.body);
    const p = pending.get(b.id);
    if (!p) {
      res.json({ ignored: true });
      return;
    }
    if (p.site !== l.site) fail(403, "다른 연결의 작업입니다.");
    clearTimeout(p.timer);
    pending.delete(b.id);
    if (!b.ok) {
      const known: Record<string, [number, string]> = {
        voice_quota: [
          429,
          "선택한 음성 서비스의 잔액 또는 사용 한도가 부족합니다. 제공자에게 문의하세요.",
        ],
        voice_auth: [
          503,
          "선택한 음성 서비스의 인증 또는 접근 권한을 확인해야 합니다.",
        ],
        voice_unavailable: [
          503,
          "음성 서비스에 연결하지 못했습니다. 잠시 후 다시 시도하세요.",
        ],
      };
      const [status, message] = known[b.errorCode ?? ""] ?? [
        502,
        "연결된 상담 서버가 요청을 처리하지 못했습니다. 관리자에서 연결 상태를 확인하세요.",
      ];
      p.reject(new HttpError(status, message));
    } else {
      try {
        let data: any = { ok: true };
        if (p.kind === "ask")
          data = z.object({ text: z.string().max(12000) }).parse(b.data);
        if (p.kind === "start")
          data = z
            .object({
              answer: z.string().min(1).max(65536),
              engine: z.enum(["api", "subscription"]),
            })
            .parse(b.data);
        p.resolve(data);
      } catch {
        p.reject(
          new HttpError(502, "상담 서버 응답 형식이 올바르지 않습니다."),
        );
      }
    }
    res.json({ ok: true });
  });
  app.use("/public", (req, res, next) => {
    const o = req.headers.origin;
    if (o) {
      res.set("Access-Control-Allow-Origin", o);
      res.vary("Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.get("/public/sites/:id", (req, res) => {
    const row = store.get(
      "SELECT * FROM sites WHERE id=? AND published IS NOT NULL",
      req.params.id,
    );
    if (!row) fail(404, "게시된 상담원이 없습니다.");
    res.json(publicSite(row));
  });
  app.post("/public/sites/:id/leads", (req, res) => {
    const row = store.get(
      "SELECT published FROM sites WHERE id=? AND published IS NOT NULL",
      req.params.id,
    );
    if (!row) fail(404, "게시된 상담원이 없습니다.");
    if (!JSON.parse(row.published).origins.includes(req.headers.origin ?? ""))
      fail(403, "등록되지 않은 홈페이지입니다.");
    rate(`lead:${req.ip}:${req.params.id}`, 3, 600000);
    const b = leadSchema.parse(req.body),
      id = randomUUID();
    store.run(
      "INSERT INTO leads VALUES (?,?,?,?,?,?,?)",
      id,
      id,
      req.params.id,
      b.name,
      b.contact,
      b.message,
      Date.now(),
    );
    res.status(201).json({ ok: true });
  });
  app.post("/public/sites/:id/sessions", async (req, res) => {
    const row = store.get(
      "SELECT * FROM sites WHERE id=? AND published IS NOT NULL",
      req.params.id,
    );
    if (!row) fail(404, "게시된 상담원이 없습니다.");
    const config = configSchema.parse(JSON.parse(row.published));
    if (!config.enabled)
      fail(503, "상담이 일시 중지되었습니다. 문의를 남겨 주세요.");
    if (!config.origins.includes(req.headers.origin ?? ""))
      fail(403, "등록되지 않은 홈페이지입니다.");
    rate(`start:${req.ip}:${row.id}`, 12, 60000);
    if (config.turnstileSiteKey) {
      if (
        !(await verifyChallenge(
          options.turnstileSecret ?? "",
          req.body?.challengeToken,
          new URL(origin).hostname,
          row.id,
        ))
      )
        fail(403, "봇 검증을 완료한 뒤 다시 시도하세요.");
      if (
        store.get("SELECT revision FROM sites WHERE id=?", row.id)?.revision !==
        row.revision
      )
        fail(409, "상담 설정이 변경되었습니다. 다시 시작하세요.");
    }
    if (!online(row.id))
      fail(503, "상담 서버가 오프라인입니다. 잠시 후 다시 방문해 주세요.");
    if (
      [...sessions.values()].filter((s) => s.site === row.id).length >=
      config.maxConcurrent
    )
      fail(429, "다른 상담이 진행 중입니다. 잠시 후 다시 시도하세요.");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const usage = store.get(
      "SELECT coalesce(sum(reserved),0) AS total FROM consultations WHERE site=? AND started>=?",
      row.id,
      today.getTime(),
    ).total;
    if (usage + config.maxSeconds > config.dailySeconds)
      fail(429, "오늘의 상담 이용 한도에 도달했습니다.");
    const visitor =
      z.string().max(100).optional().parse(req.body?.visitorId) ?? "anonymous";
    // Both keys are enforced: clearing browser storage cannot bypass the network limit.
    const keys = [
      hash(`ip:${req.ip}:${row.id}`),
      hash(`visitor:${visitor}:${row.id}`),
    ];
    const now = Date.now();
    for (const key of keys) {
      const counter = store.get(
        "SELECT count(*) AS n,max(started) AS last FROM starts WHERE site=? AND identity=? AND started>=?",
        row.id,
        key,
        today.getTime(),
      );
      if (counter.n >= config.dailyStarts)
        fail(429, "오늘의 방문자 상담 횟수에 도달했습니다.");
      const last = store.get(
        "SELECT max(started) AS last FROM starts WHERE site=? AND identity=?",
        row.id,
        key,
      ).last;
      if (last && now - last < config.cooldownSeconds * 1000)
        fail(429, "반복 연결을 방지하기 위해 잠시 기다려 주세요.");
    }
    for (const key of keys)
      store.run("INSERT INTO starts VALUES (?,?,?)", row.id, key, now);
    const token = secret(),
      id = randomUUID();
    sessions.set(hash(token), {
      id,
      site: row.id,
      token: hash(token),
      config,
      revision: row.revision,
      started: now,
      seen: now,
      expires: now + config.maxSeconds * 1000,
      voice: false,
      starting: false,
      busy: false,
      history: [],
      replies: new Map(),
      requests: 0,
    });
    store.run(
      "INSERT INTO consultations(id,site,started,status,reserved,revision,engine) VALUES (?,?,?,?,?,?,?)",
      id,
      row.id,
      now,
      "active",
      config.maxSeconds,
      row.revision,
      config.engine,
    );
    res.status(201).json({
      ...publicSite(row),
      token,
      sessionId: id,
      expiresAt: now + config.maxSeconds * 1000,
    });
  });
  app.post("/public/session/heartbeat", (req, res) => {
    const s = sessionFor(req);
    if (s.voice)
      void enqueue(s.site, "heartbeat", s.id, {}, 8000).catch(() =>
        finish(s, "interrupted"),
      );
    res.json({ expiresAt: s.expires });
  });
  app.post("/public/session/start", async (req, res) => {
    const s = sessionFor(req);
    if (s.voice || s.starting) fail(409, "이미 음성 연결을 시작했습니다.");
    const { offer } = z
      .object({ offer: z.string().min(10).max(65536) })
      .parse(req.body);
    if (!links.get(s.site)?.capabilities[s.config.engine])
      fail(
        503,
        "선택한 음성 연결이 준비되지 않았습니다. 관리자 설정을 확인하세요.",
      );
    s.starting = true;
    try {
      const result = await enqueue(s.site, "start", s.id, {
        offer,
        config: s.config,
        expiresAt: s.expires,
      });
      if (!sessions.has(s.token)) {
        fireStop(s);
        fail(410, "상담이 종료되었습니다.");
      }
      s.voice = true;
      res.json(result);
    } catch (e) {
      fireStop(s);
      throw e;
    } finally {
      s.starting = false;
    }
  });
  app.post("/public/session/ask", async (req, res) => {
    const s = sessionFor(req);
    const b = z
      .object({
        text: z.string().trim().min(1).max(4000),
        requestId: z.string().min(1).max(100),
      })
      .parse(req.body);
    const old = s.replies.get(b.requestId);
    if (old) {
      if (old.text !== b.text) fail(409, "같은 요청 ID에 다른 내용입니다.");
      res.json({ text: old.reply });
      return;
    }
    if (s.busy) fail(409, "이전 질문을 처리하고 있습니다.");
    if (++s.requests > 30) fail(429, "이 상담의 질문 한도에 도달했습니다.");
    s.busy = true;
    try {
      const result = await enqueue(s.site, "ask", s.id, {
        text: b.text,
        history: s.history.slice(-12),
        config: s.config,
        expiresAt: s.expires,
      });
      if (!sessions.has(s.token)) fail(410, "상담이 종료되었습니다.");
      s.history.push(
        { role: "user", text: b.text },
        { role: "assistant", text: result.text },
      );
      s.replies.set(b.requestId, { text: b.text, reply: result.text });
      res.json({ text: result.text });
    } finally {
      s.busy = false;
    }
  });
  app.post("/public/session/lead", (req, res) => {
    const s = sessionFor(req);
    const b = leadSchema.parse(req.body);
    store.run(
      "INSERT OR IGNORE INTO leads VALUES (?,?,?,?,?,?,?)",
      randomUUID(),
      s.id,
      s.site,
      b.name,
      b.contact,
      b.message,
      Date.now(),
    );
    res.status(201).json({ ok: true });
  });
  app.post("/public/session/end", (req, res) => {
    const s = sessions.get(hash(bearer(req)));
    if (s) finish(s);
    res.json({ ok: true });
  });
  app.get("/frame/:id", (req, res) => {
    const row = store.get(
      "SELECT published FROM sites WHERE id=?",
      req.params.id,
    );
    if (!row?.published) fail(404, "게시된 상담원이 없습니다.");
    const c = JSON.parse(row.published);
    res.set(
      "Content-Security-Policy",
      `frame-ancestors ${c.origins.join(" ")}; object-src 'none'; base-uri 'none'`,
    );
    res.sendFile(web + "frame.html");
  });
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use((req, _res, next) => {
    if (
      options.desktopToken &&
      ["/", "/index.html", "/admin.js"].includes(req.path)
    )
      fail(404, "Desktop 설정 패널을 사용하세요.");
    next();
  });
  app.use(
    express.static(web, {
      index: "index.html",
      setHeaders: (res, path) => {
        if (path.endsWith("widget.js"))
          res.setHeader("Cache-Control", "public,max-age=300");
      },
    }),
  );
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 500;
    res.status(status).json({
      error:
        status === 500
          ? "요청을 처리하지 못했습니다."
          : error instanceof z.ZodError
            ? "입력값을 확인하세요."
            : error.message,
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const s of sessions.values())
      if (s.expires < now || s.seen < now - 45000) finish(s, "expired");
    for (const [key, p] of pairs) if (p.expires < now) pairs.delete(key);
    for (const [key, l] of limits) if (l.until < now) limits.delete(key);
    store.run("DELETE FROM starts WHERE started<?", now - 2 * 86400000);
    store.run("DELETE FROM logins WHERE expires<?", now);
    store.run("DELETE FROM leads WHERE created<?", now - 30 * 86400000);
    store.run("DELETE FROM consultations WHERE started<?", now - 30 * 86400000);
  }, 5000);
  timer.unref();
  return {
    app,
    close() {
      clearInterval(timer);
      for (const s of sessions.values()) finish(s, "interrupted");
      for (const l of links.values()) l.waiter?.();
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new HttpError(503, "서비스를 종료합니다."));
      }
      pending.clear();
      store.close();
    },
  };
}
