import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  host,
  Button,
  Input,
  Textarea,
  ListRow,
  ToggleRow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SegmentedControl,
  Badge,
  useI18n,
  usePluginI18n,
} from "@hermes/plugin-sdk";
import type { PluginContext } from "@hermes/plugin-sdk";
import {
  bundles,
  errorKey,
  interpolate,
  type Key,
  type Translate,
} from "./i18n.ts";

type Config = {
  turnstileSiteKey: string;
  name: string;
  greeting: string;
  origins: string[];
  engine: string;
  language: string;
  rules: string;
  knowledge: string;
  maxSeconds: number;
  maxConcurrent: number;
  dailySeconds: number;
  dailyStarts: number;
  cooldownSeconds: number;
  enabled: boolean;
};
type Site = {
  id: string;
  draft: Config;
  revision: number;
  online: boolean;
  published: boolean;
  snippet: string;
};
type Status = {
  running: boolean;
  publicOrigin: string;
  port: number;
  subscription: boolean;
};
type Activity = {
  leads: { id: string; name: string; contact: string; message: string }[];
  sessions: {
    id: string;
    started: number;
    status: Key;
    reserved: number;
    used: number;
  }[];
};
const tabs = [
  "connection",
  "bot",
  "knowledge",
  "protection",
  "install",
  "activity",
] as const;
type Tab = (typeof tabs)[number];
const defaults = (t: Translate): Config => ({
  turnstileSiteKey: "",
  name: t("defaultName"),
  greeting: t("defaultGreeting"),
  origins: [],
  engine: "subscription",
  language: "auto",
  rules: t("defaultRules"),
  knowledge: "",
  maxSeconds: 180,
  maxConcurrent: 1,
  dailySeconds: 1800,
  dailyStarts: 3,
  cooldownSeconds: 60,
  enabled: true,
});
// Endonyms need no translation; "auto" follows the embedding page's <html lang>.
const languages = [
  ["en", "English"],
  ["ko", "한국어"],
  ["ja", "日本語"],
  ["zh", "中文"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
] as const;
const muted: React.CSSProperties = {
  color: "var(--ui-text-tertiary)",
  fontSize: "var(--conversation-caption-font-size)",
  lineHeight: "var(--conversation-caption-line-height)",
  margin: 0,
};
const divider = "1px solid var(--ui-stroke-secondary)";
const controlWidth = { width: "min(100%, 22rem)" };
function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} style={controlWidth}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default {
  id: "hermes-consult",
  name: "hermes-consult",
  version: "0.2.2",
  description: "Website voice consultations",
  defaultEnabled: false,
  register(ctx: PluginContext) {
    ctx.i18n.register(bundles);
    function Panel() {
      const profile = useSyncExternalStore(
        (fn) => host.state.profile.subscribe(fn),
        () => host.state.profile.get(),
      );
      const connection = useSyncExternalStore(
        (fn) => host.state.connectionId.subscribe(fn),
        () => host.state.connectionId.get(),
      );
      return <Settings key={`${connection}:${profile}`} />;
    }
    function Settings() {
      const { locale } = useI18n(),
        translate = usePluginI18n("hermes-consult");
      const t: Translate = (key, ...values) =>
        interpolate(translate(key), ...values);
      const scope = useRef([
        host.state.connectionId.get(),
        host.state.profile.get(),
      ]);
      const active = useRef(true),
        sequence = useRef(0);
      const rest = <T,>(
        path: string,
        options?: { method?: string; body?: unknown; timeoutMs?: number },
      ) => {
        if (
          !active.current ||
          scope.current[0] !== host.state.connectionId.get() ||
          scope.current[1] !== host.state.profile.get()
        )
          return Promise.reject<T>(Error("HC:errScope"));
        return ctx.rest<T>(path, options);
      };
      const [status, setStatus] = useState<Status>({
        running: false,
        publicOrigin: "",
        port: 4318,
        subscription: true,
      });
      const [sites, setSites] = useState<Site[]>([]),
        [site, setSite] = useState<Site | null>(null),
        [draft, setDraft] = useState<Config>(() => defaults(t));
      const [tab, setTab] = useState<Tab>("connection"),
        [notice, setNotice] = useState<Key | null>(null),
        [isError, setIsError] = useState(false),
        [busy, setBusy] = useState(false),
        [activity, setActivity] = useState<Activity | null>(null);
      const dirty = site
        ? JSON.stringify(draft) !==
          JSON.stringify({ ...defaults(t), ...site.draft })
        : true;
      const control = <T,>(
        path: string,
        body?: unknown,
        method = body ? "POST" : "GET",
      ) =>
        rest<T>("/control", {
          method: "POST",
          body: { path, method, body },
          timeoutMs: 30000,
        });
      const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setNotice(null);
        setIsError(false);
        try {
          await fn();
        } catch (e) {
          if (active.current) {
            setNotice(errorKey(e));
            setIsError(true);
          }
        } finally {
          if (active.current) setBusy(false);
        }
      };
      const choose = (s: Site) => {
        setSite(s);
        setDraft({ ...defaults(t), ...s.draft });
        setActivity(null);
      };
      const refresh = async () => {
        const list = await control<Site[]>("/api/sites");
        if (active.current) setSites(list);
        return list;
      };
      const refreshStatus = async () => {
        const value = await rest<Status>("/status");
        if (!active.current) return;
        setStatus(value);
        if (value.running) {
          const list = await refresh();
          if (!site && list[0]) choose(list[0]);
        }
      };
      useEffect(() => {
        active.current = true;
        const id = ++sequence.current;
        rest<Status>("/status")
          .then(async (value) => {
            if (!active.current || id !== sequence.current) return;
            setStatus(value);
            if (value.running) {
              const list = await control<Site[]>("/api/sites");
              if (active.current && id === sequence.current) {
                setSites(list);
                if (list[0]) choose(list[0]);
                setTab("bot");
              }
            }
          })
          .catch(() => {
            if (active.current) {
              setNotice("errBackend");
              setIsError(true);
            }
          });
        return () => {
          active.current = false;
          ++sequence.current;
        };
      }, []);
      const save = async (publish: boolean) => {
        const config = {
          ...draft,
          origins: draft.origins.map((s) => s.trim()).filter(Boolean),
        };
        let selected = site;
        if (selected) await control(`/api/sites/${selected.id}`, config, "PUT");
        else {
          selected = await control<Site>("/api/sites", config);
          if (active.current) setSite(selected);
        }
        if (publish) await control(`/api/sites/${selected!.id}/publish`, {});
        const list = await refresh();
        if (!active.current) return;
        choose(list.find((s) => s.id === selected!.id)!);
        setNotice(publish ? "published" : "saved");
      };
      const textRow = (
        key: "name" | "greeting" | "knowledge" | "rules" | "turnstileSiteKey",
        title: Key,
        description?: Key,
        rows = 0,
      ) => (
        <ListRow
          title={t(title)}
          description={description ? t(description) : undefined}
          wide={rows > 0}
          action={
            rows ? undefined : (
              <Input
                aria-label={t(title)}
                value={draft[key]}
                style={controlWidth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDraft({ ...draft, [key]: e.target.value })
                }
              />
            )
          }
          below={
            rows ? (
              <Textarea
                aria-label={t(title)}
                rows={rows}
                value={draft[key]}
                style={{ width: "100%", marginTop: 12, resize: "vertical" }}
                maxLength={
                  key === "knowledge" ? 40000 : key === "rules" ? 6000 : 500
                }
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDraft({ ...draft, [key]: e.target.value })
                }
              />
            ) : undefined
          }
        />
      );
      const footer =
        tab !== "connection" && tab !== "activity" && status.running;
      return (
        <section
          lang={locale}
          style={{
            maxWidth: 960,
            minWidth: 0,
            paddingBlock: 12,
            fontSize: "var(--conversation-text-font-size)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <p style={{ margin: 0 }}>{t("subtitle")}</p>
              <p style={muted}>{t("setupHelp")}</p>
            </div>
            <Badge variant={status.running ? "success" : "muted"}>
              {t(status.running ? "running" : "stopped")}
            </Badge>
          </div>
          <div
            style={{
              overflowX: "auto",
              paddingBottom: 12,
              borderBottom: divider,
            }}
          >
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={tabs.map((id) => ({ id, label: t(id) }))}
              disabled={busy}
            />
          </div>
          {status.running && tab !== "connection" && (
            <div
              role="group"
              aria-label={t("assistant")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                paddingBlock: 16,
                borderBottom: divider,
              }}
            >
              <Choice
                label={t("assistant")}
                value={site?.id ?? "new"}
                options={[
                  { id: "new", label: t("newAssistant") },
                  ...sites.map((s) => ({ id: s.id, label: s.draft.name })),
                ]}
                onChange={(id) => {
                  const s = sites.find((s) => s.id === id);
                  if (s) choose(s);
                  else {
                    setSite(null);
                    setDraft(defaults(t));
                    setActivity(null);
                  }
                }}
                disabled={busy}
              />
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSite(null);
                  setDraft(defaults(t));
                  setActivity(null);
                  setTab("bot");
                }}
              >
                {t("newAssistant")}
              </Button>
              <span style={muted}>
                {site ? t("revision", site.revision) : t("unsavedNew")}
              </span>
            </div>
          )}
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, minWidth: 0, margin: 0 }}
          >
            {tab === "connection" ? (
              <>
                <ListRow
                  title={t("publicOrigin")}
                  description={t("publicOriginHelp")}
                  action={
                    <Input
                      aria-label={t("publicOrigin")}
                      placeholder="https://consult.example.com"
                      style={controlWidth}
                      disabled={status.running}
                      value={status.publicOrigin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setStatus({
                          ...status,
                          publicOrigin: e.target.value.trim(),
                        })
                      }
                    />
                  }
                />
                <ListRow
                  title={t("port")}
                  description={t("portHelp")}
                  action={
                    <Input
                      aria-label={t("port")}
                      type="number"
                      min={1024}
                      max={65535}
                      style={{ width: 120 }}
                      disabled={status.running}
                      value={status.port}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setStatus({ ...status, port: Number(e.target.value) })
                      }
                    />
                  }
                />
                <ToggleRow
                  label={t("subscription")}
                  description={t("subscriptionHelp")}
                  disabled={status.running}
                  checked={status.subscription}
                  onChange={(subscription: boolean) =>
                    setStatus({ ...status, subscription })
                  }
                />
                <ListRow title={t("keys")} description={t("keysHelp")} />
                <ListRow
                  title={t(status.running ? "running" : "stopped")}
                  description={t("stopHelp")}
                  action={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        variant="outline"
                        onClick={() => void run(refreshStatus)}
                      >
                        {t("refreshStatus")}
                      </Button>
                      <Button
                        variant={status.running ? "destructive" : "default"}
                        onClick={() =>
                          void run(async () => {
                            const value = await rest<Status>(
                              status.running ? "/stop" : "/start",
                              {
                                method: "POST",
                                body: status.running ? {} : status,
                                timeoutMs: 60000,
                              },
                            );
                            if (!active.current) return;
                            setStatus(value);
                            if (value.running) {
                              const list = await refresh();
                              if (!site && list[0]) choose(list[0]);
                            }
                          })
                        }
                      >
                        {t(status.running ? "stopServer" : "startServer")}
                      </Button>
                    </div>
                  }
                />
              </>
            ) : !status.running ? (
              <ListRow
                title={t("serverRequired")}
                action={
                  <Button onClick={() => setTab("connection")}>
                    {t("openConnection")}
                  </Button>
                }
              />
            ) : (
              <>
                <div style={{ borderTop: divider }}>
                  {tab === "bot" && (
                    <>
                      {textRow("name", "name")}
                      {textRow("greeting", "greeting", undefined, 3)}
                      <ListRow
                        title={t("engine")}
                        description={t("engineHelp")}
                        action={
                          <Choice
                            label={t("engine")}
                            value={draft.engine}
                            options={[
                              {
                                id: "subscription",
                                label: t("subscriptionEngine"),
                              },
                              { id: "api", label: t("api") },
                            ]}
                            onChange={(engine) =>
                              setDraft({ ...draft, engine })
                            }
                          />
                        }
                      />
                      <ListRow
                        title={t("language")}
                        description={t("languageHelp")}
                        action={
                          <Choice
                            label={t("language")}
                            value={draft.language}
                            options={[
                              { id: "auto", label: t("languageAuto") },
                              ...languages.map(([id, label]) => ({ id, label })),
                            ]}
                            onChange={(language) =>
                              setDraft({ ...draft, language })
                            }
                          />
                        }
                      />
                      <Badge variant={site?.online ? "success" : "muted"}>
                        {t(site?.online ? "connected" : "offline")}
                      </Badge>
                    </>
                  )}
                  {tab === "knowledge" && (
                    <>
                      {textRow("knowledge", "source", "sourceHelp", 12)}
                      <Input
                        type="file"
                        aria-label={t("importFile")}
                        accept=".txt,.md,text/plain,text/markdown"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const f = e.target.files?.[0];
                          if (f)
                            void run(async () => {
                              if (f.size > 160000) throw Error("HC:errFile");
                              const text = await f.text();
                              if (text.length > 40000)
                                throw Error("HC:errFile");
                              if (active.current)
                                setDraft({ ...draft, knowledge: text });
                            });
                        }}
                      />
                      {textRow("rules", "rules", "rulesHelp", 6)}
                    </>
                  )}
                  {tab === "protection" && (
                    <>
                      <ToggleRow
                        label={t("enabled")}
                        description={t("enabledHelp")}
                        checked={draft.enabled}
                        onChange={(enabled: boolean) =>
                          setDraft({ ...draft, enabled })
                        }
                      />
                      {(
                        [
                          ["maxSeconds", 30, 600],
                          ["maxConcurrent", 1, 5],
                          ["dailySeconds", 60, 86400],
                          ["dailyStarts", 1, 100],
                          ["cooldownSeconds", 0, 3600],
                        ] as const
                      ).map(([key, min, max]) => (
                        <ListRow
                          key={key}
                          title={t(key)}
                          description={t(`${key}Help` as Key)}
                          action={
                            <Input
                              aria-label={t(key)}
                              type="number"
                              style={{ width: 120 }}
                              min={min}
                              max={max}
                              value={draft[key]}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                setDraft({
                                  ...draft,
                                  [key]: Number(e.target.value),
                                })
                              }
                            />
                          }
                        />
                      ))}
                      <p style={{ ...muted, paddingBlock: 12 }}>
                        {t("budgetHelp")}
                      </p>
                      {textRow(
                        "turnstileSiteKey",
                        "turnstile",
                        "turnstileHelp",
                      )}
                    </>
                  )}
                  {tab === "install" && (
                    <>
                      <ListRow
                        title={t("origins")}
                        description={t("originsHelp")}
                        wide
                        below={
                          <Textarea
                            aria-label={t("origins")}
                            rows={4}
                            style={{ width: "100%", marginTop: 12 }}
                            placeholder="https://example.com"
                            value={draft.origins.join("\n")}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) =>
                              setDraft({
                                ...draft,
                                origins: e.target.value.split("\n"),
                              })
                            }
                          />
                        }
                      />
                      <ListRow
                        title={t("snippet")}
                        description={t("snippetHelp")}
                        wide
                        action={
                          site?.published ? (
                            <Button
                              variant="outline"
                              onClick={() =>
                                void run(async () => {
                                  await navigator.clipboard.writeText(
                                    site.snippet,
                                  );
                                  setNotice("copied");
                                })
                              }
                            >
                              {t("copy")}
                            </Button>
                          ) : undefined
                        }
                        below={
                          site?.published ? (
                            <Textarea
                              aria-label={t("snippet")}
                              readOnly
                              rows={3}
                              value={site.snippet}
                              style={{
                                marginTop: 12,
                                width: "100%",
                                fontFamily: "var(--font-mono)",
                              }}
                            />
                          ) : (
                            <p style={{ ...muted, marginTop: 12 }}>
                              {t("unpublishedHelp")}
                            </p>
                          )
                        }
                      />
                    </>
                  )}
                  {tab === "activity" && (
                    <>
                      <ListRow
                        title={t("activity")}
                        description={t("privacy")}
                        action={
                          <Button
                            variant="outline"
                            disabled={!site}
                            onClick={() =>
                              void run(async () => {
                                const result = await control<Activity>(
                                  `/api/sites/${site!.id}/activity`,
                                );
                                if (active.current) setActivity(result);
                              })
                            }
                          >
                            {t("refresh")}
                          </Button>
                        }
                      />
                      {!site ? (
                        <p style={muted}>{t("selectFirst")}</p>
                      ) : (
                        activity && (
                          <>
                            <ListRow
                              title={t("inquiries")}
                              wide
                              below={
                                <div>
                                  {activity.leads.length ? (
                                    activity.leads.map((l) => (
                                      <ListRow
                                        key={l.id}
                                        title={l.name}
                                        description={l.contact}
                                        below={
                                          <p
                                            style={{
                                              whiteSpace: "pre-wrap",
                                              overflowWrap: "anywhere",
                                            }}
                                          >
                                            {l.message}
                                          </p>
                                        }
                                      />
                                    ))
                                  ) : (
                                    <p style={muted}>{t("noInquiries")}</p>
                                  )}
                                </div>
                              }
                            />
                            <ListRow
                              title={t("sessions")}
                              wide
                              below={
                                <div>
                                  {activity.sessions.length ? (
                                    activity.sessions.map((s) => (
                                      <p style={muted} key={s.id}>
                                        {t(
                                          "sessionSummary",
                                          new Date(s.started).toLocaleString(
                                            locale,
                                          ),
                                          t(s.status),
                                          s.reserved,
                                          s.used,
                                        )}
                                      </p>
                                    ))
                                  ) : (
                                    <p style={muted}>{t("noSessions")}</p>
                                  )}
                                </div>
                              }
                            />
                          </>
                        )
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {footer && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  paddingTop: 16,
                  marginTop: 16,
                  borderTop: divider,
                }}
              >
                <Button
                  variant="outline"
                  onClick={() => void run(() => save(false))}
                >
                  {t("save")}
                </Button>
                <Button onClick={() => void run(() => save(true))}>
                  {t("publish")}
                </Button>
                {dirty && <span style={muted}>{t("dirty")}</span>}
              </div>
            )}
          </fieldset>
          <div
            role={isError ? "alert" : "status"}
            aria-live="polite"
            style={{
              ...muted,
              minHeight: 24,
              paddingTop: 12,
              color: isError ? "var(--destructive)" : undefined,
            }}
          >
            {busy ? t("refreshing") : notice ? t(notice) : ""}
          </div>
        </section>
      );
    }
    const registerPage = () =>
      ctx.registerSettingsPage({
        id: "settings",
        title: "hermes-consult",
        icon: "comment-discussion",
        render: () => <Panel />,
      });
    let dispose = registerPage();
    ctx.i18n.onLocaleChange(() => {
      dispose();
      dispose = registerPage();
    });
    ctx.onDispose(() => dispose());
  },
};
