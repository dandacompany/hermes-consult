import {
  greetingEvent,
  transcriptEvent,
  answerEvent,
  delegationAnswer,
} from "./voice-protocol.js";
import { applyI18n, pickLocale, relayError, t } from "./i18n.js";
const $ = (s) => document.querySelector(s),
  query = new URLSearchParams(location.search),
  site = location.pathname.split("/").pop(),
  parentOrigin = query.get("parent");
// Visitor UI language: the site's answer language when fixed, else the embedding page's.
let locale = pickLocale(query.get("lang") || navigator.language);
const T = (key, ...values) => t(locale, key, ...values);
applyI18n(locale);
let config,
  session = null,
  requesting = null,
  pc = null,
  channel = null,
  stream = null,
  audio = null,
  voice = false,
  muted = false,
  heartbeat,
  clock,
  starting = false,
  generation = 0;
let cancelChallenge = null;
const delegations = new Set();
let lastTranscript = null,
  greeted = false,
  voiceStats;
function status(text) {
  $("#status").textContent = text;
}
function error(text) {
  $("#error").textContent = text;
}
function add(role, text) {
  const box = document.createElement("div");
  box.className = "message " + role;
  const label = document.createElement("small");
  label.textContent = role === "user" ? T("you") : T("assistant");
  const body = document.createElement("span");
  body.textContent = text;
  box.append(label, body);
  $("#messages").append(box);
  $("main").scrollTop = $("main").scrollHeight;
  return body;
}
function sendParent(data) {
  parent.postMessage(data, parentOrigin);
}
async function rpc(path, body = {}) {
  if (!session) throw Error(T("restart"));
  const r = await fetch("/public/session/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.token,
    },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (!r.ok) throw relayError(locale, result);
  return result;
}
function parentRequest(type, body = {}) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => done(Error(T("parentTimeout"))),
      12000,
    );
    function done(err, data) {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      err ? reject(err) : resolve(data);
    }
    function receive(e) {
      if (
        e.source !== parent ||
        e.origin !== parentOrigin ||
        e.data?.requestId !== requestId
      )
        return;
      if (e.data.type === "hc:error")
        done(relayError(locale, { code: e.data.code, error: e.data.message }));
      else if (e.data.type === "hc:response") done(null, e.data.result);
    }
    window.addEventListener("message", receive);
    sendParent({ type, requestId, ...body });
  });
}
async function ensure() {
  if (session) return session;
  if (requesting) return requesting;
  const turn = generation;
  const promise = challenge().then(challengeToken => {
    if (turn !== generation) throw Error(T("cancelled"));
    return parentRequest("hc:request-session", {challengeToken});
  })
    .then((s) => {
      if (turn !== generation) {
        fetch("/public/session/end", {
          method: "POST",
          headers: { Authorization: "Bearer " + s.token },
          keepalive: true,
        }).catch(() => {});
        throw Error(T("cancelled"));
      }
      session = s;
      status(s.demo ? T("demoConnected") : T("connected"));
      heartbeat = setInterval(
        () =>
          rpc("heartbeat").catch((e) => {
            if (session === s) {
              end();
              error(e.message);
            }
          }),
        10000,
      );
      clock = setInterval(() => {
        if (!session) return;
        const left = Math.max(
          0,
          Math.ceil((session.expiresAt - Date.now()) / 1000),
        );
        $("#clock").textContent =
          `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        if (!left) {
          end();
          error(T("timeUp"));
        }
      }, 1000);
      return s;
    })
    .finally(() => {
      if (requesting === promise) requesting = null;
    });
  requesting = promise;
  return promise;
}
function end() {
  generation++;
  cancelChallenge?.();
  requesting = null;
  const old = session;
  session = null;
  clearInterval(heartbeat);
  clearInterval(clock);
  clearInterval(voiceStats);
  document.documentElement.dataset.voiceState = "closed";
  document.documentElement.dataset.microphone = "stopped";
  lastTranscript = null;
  greeted = false;
  voice = false;
  starting = false;
  delegations.clear();
  if (channel) {
    try {
      if (channel.readyState === "open" && old?.engine === "api")
        channel.send(
          JSON.stringify({
            type: "session.close",
            event_id: crypto.randomUUID(),
          }),
        );
      channel.close();
    } catch {}
    channel = null;
  }
  if (pc) {
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (audio) {
    audio.pause();
    audio.srcObject = null;
    audio = null;
  }
  if (old)
    fetch("/public/session/end", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + old.token,
        "Content-Type": "application/json",
      },
      body: "{}",
      keepalive: true,
    }).catch(() => {});
  sendParent({ type: "hc:end" });
  $("#controls").hidden = true;
  $("#welcome").hidden = false;
  $("#clock").textContent = "";
  $("#start").disabled = !config?.voiceReady;
  $("#start").textContent = T("startVoice");
  $("#mute").textContent = T("muteOff");
  muted = false;
  status(T("ended"));
}
window.addEventListener("message", (e) => {
  if (
    e.source === parent &&
    e.origin === parentOrigin &&
    e.data?.type === "hc:close"
  )
    end();
});
window.addEventListener("pagehide", end);
$("#close").onclick = () => {
  end();
  sendParent({ type: "hc:hide" });
};
$("#end").onclick = end;
$("#mute").onclick = () => {
  muted = !muted;
  stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  $("#mute").textContent = muted ? T("muteOn") : T("muteOff");
};
async function onEvent(event) {
  if (!session) return;
  const type = event.type;
  if (type === "session.closed" || type === "error") {
    end();
    error(T("voiceClosed"));
    return;
  }
  if (type === "session.started" && !greeted) {
    greeted = true;
    channel.send(JSON.stringify(greetingEvent(session.engine, session)));
  }
  if (type === "turn.done") lastTranscript = null;
  const transcript = transcriptEvent(event);
  if (transcript) {
    if (lastTranscript?.role === transcript.role)
      lastTranscript.node.textContent += transcript.text;
    else
      lastTranscript = {
        role: transcript.role,
        node: add(transcript.role, transcript.text),
      };
    $("main").scrollTop = $("main").scrollHeight;
  }
  if (type === "delegation.cancelled") {
    delegations.delete(event.delegation_item_id);
    return;
  }
  if (
    type === "delegation.created" &&
    session.engine === "subscription" &&
    event.item?.target === "client"
  ) {
    const id = event.item.id;
    if (delegations.has(id)) return;
    delegations.add(id);
    const text = (event.item.content ?? [])
      .filter((c) => c.type === "input_text")
      .map((c) => c.text)
      .join("\n");
    if (!text) return;
    const turn = generation;
    try {
      status(T("checkingDocs"));
      const result = await rpc("ask", {
        text: text.slice(0, 4000),
        requestId: id,
      });
      if (turn !== generation || !delegations.has(id)) return;
      if (channel?.readyState === "open")
        channel.send(
          JSON.stringify({
            type: "delegation.context.append",
            delegation_item_id: id,
            content: [{ type: "input_text", text: delegationAnswer(result.text) }],
          }),
        );
      status(T("inVoice"));
    } catch (e) {
      if (turn !== generation) return;
      error(e.message);
      if (channel?.readyState === "open")
        channel.send(
          JSON.stringify({
            type: "delegation.context.append",
            delegation_item_id: id,
            content: [
              {
                type: "input_text",
                // Model-facing: English; the voice model answers in the visitor's language.
                text: "The document lookup failed. Suggest that the visitor leave an inquiry.",
              },
            ],
          }),
        );
    }
  }
}
async function ice(connection) {
  if (connection.iceGatheringState === "complete") return;
  await new Promise((resolve) => {
    const timer = setTimeout(done, 3000);
    function done() {
      clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", change);
      resolve();
    }
    function change() {
      if (connection.iceGatheringState === "complete") done();
    }
    connection.addEventListener("icegatheringstatechange", change);
  });
}
$("#start").onclick = async () => {
  if (starting || voice) return;
  starting = true;
  const turn = ++generation;
  $("#start").disabled = true;
  error("");
  try {
    if (!config?.voiceReady)
      throw Error(T("voiceUnavailableText"));
    status(T("preparing"));
    $("#controls").hidden = false;
    $("#mute").hidden = true;
    $("#start").textContent = T("connecting");
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (turn !== generation) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = acquired;
    const s = await ensure();
    if (turn !== generation) return;
    if (!s.voiceReady) throw Error(T("voiceNotReady"));
    document.documentElement.dataset.microphone = "active";
    pc = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
    const connection = pc;
    voiceStats = setInterval(async () => {
      if (connection !== pc) return;
      document.documentElement.dataset.voiceState = connection.connectionState;
      const stats = await connection.getStats();
      let input = 0,
        output = 0;
      stats.forEach((r) => {
        if (r.type === "outbound-rtp" && r.kind === "audio")
          input += r.bytesSent ?? 0;
        if (r.type === "inbound-rtp" && r.kind === "audio")
          output += r.bytesReceived ?? 0;
      });
      document.documentElement.dataset.audioSent = String(input);
      document.documentElement.dataset.audioReceived = String(output);
    }, 1000);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    audio = new Audio();
    audio.autoplay = true;
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      audio
        .play()
        .catch(() => error(T("audioBlocked")));
    };
    channel = pc.createDataChannel("oai-events");
    channel.onmessage = (e) => {
      try {
        void onEvent(JSON.parse(e.data)).catch(() =>
          error(T("voiceEventFailed")),
        );
      } catch {}
    };
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error(T("voiceTimeout"))),
        60000,
      );
      channel.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed") {
          clearTimeout(timer);
          reject(Error(T("voiceFailed")));
          if (voice) {
            end();
            error(T("networkLost"));
          }
        }
      };
    });
    void ready.catch(() => {});
    await connection.setLocalDescription(await connection.createOffer());
    await ice(connection);
    if (turn !== generation) return;
    const answer = await rpc("start", {
      offer: connection.localDescription.sdp,
    });
    if (turn !== generation) return;
    await connection.setRemoteDescription({
      type: "answer",
      sdp: answer.answer,
    });
    await ready;
    if (turn !== generation) return;
    voice = true;
    $("#welcome").hidden = true;
    $("#controls").hidden = false;
    $("#mute").hidden = false;
    status(T("inVoice"));
  } catch (e) {
    if (turn === generation) {
      end();
      error(
        e.name === "NotAllowedError"
          ? T("micDenied")
          : e.message,
      );
    }
  } finally {
    if (turn === generation) starting = false;
    if (!voice) $("#start").disabled = !config?.voiceReady;
  }
};
$("#text-form").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("#text").value.trim();
  if (!text) return;
  const turn = generation;
  const button = e.target.querySelector("button");
  button.disabled = true;
  error("");
  try {
    await ensure();
    if (turn !== generation) return;
    $("#welcome").hidden = voice;
    $("#controls").hidden = false;
    $("#mute").hidden = !voice;
    add("user", text);
    $("#text").value = "";
    status(T("answering"));
    const r = await rpc("ask", { text, requestId: crypto.randomUUID() });
    if (turn !== generation) return;
    if (!voice) add("assistant", r.text);
    if (voice && channel?.readyState === "open")
      channel.send(JSON.stringify(answerEvent(session.engine, text, r.text)));
    status(
      voice
        ? T("inVoice")
        : session?.demo
          ? T("demoConnected")
          : T("connected"),
    );
  } catch (e) {
    error(e.message);
  } finally {
    button.disabled = false;
  }
};
$("#lead-toggle").onclick = () => {
  $("#lead-form").hidden = !$("#lead-form").hidden;
};
$("#lead-form").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("button");
  b.disabled = true;
  try {
    await parentRequest("hc:lead-request", {
      lead: {
        name: f.elements.name.value,
        contact: f.elements.contact.value,
        message: f.elements.message.value,
        consent: f.elements.consent.checked,
      },
    });
    f.hidden = true;
    add("assistant", T("leadDone"));
  } catch (e) {
    error(e.message);
  } finally {
    b.disabled = false;
  }
};
fetch("/public/sites/" + site)
  .then((r) => r.json())
  .then((c) => {
    if (c.error) throw relayError(locale, c);
    config = c;
    if (c.language && c.language !== "auto") {
      locale = pickLocale(c.language);
      applyI18n(locale);
    }
    $("#name").textContent = c.name;
    $("#greeting").textContent = c.greeting;
    $("#start").disabled = !c.voiceReady;
    status(
      c.online ? (c.demo ? T("demoReady") : T("available")) : T("offline"),
    );
    if (!c.voiceReady) $("#start").textContent = T("voicePreparing");
  })
  .catch((e) => error(e.message));

// Render only inside our own widget frame, never inside the Desktop renderer.
let turnstileLoading;
async function challenge() {
  if (!config?.turnstileSiteKey) return undefined;
  if (!window.turnstile) {
    turnstileLoading ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timer = setTimeout(() => reject(Error(T('challengeLoadFailed'))), 10000);
      script.onload = () => {clearTimeout(timer); resolve();};
      script.onerror = () => {clearTimeout(timer); reject(Error(T('challengeLoadFailed')));};
      document.head.append(script);
    }).catch(error => {turnstileLoading = null; throw error;});
    await turnstileLoading;
  }
  return new Promise((resolve, reject) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:white;z-index:10;display:grid;place-content:center;gap:16px';
    const label = document.createElement('p'); label.textContent = T('challengePrompt');
    const mount = document.createElement('div');
    const cancel = document.createElement('button');cancel.textContent = T('cancel');
    box.append(label,mount,cancel);document.body.append(box);
    let id;
    const timer = setTimeout(() => finish(Error(T('challengeTimeout'))), 60000);
    let finished = false;
    function finish(error, token) {if(finished)return;finished=true;cancelChallenge=null;clearTimeout(timer);if(id!==undefined)window.turnstile.remove(id);box.remove();error?reject(error):resolve(token);}
    cancelChallenge=()=>finish(Error(T('cancelled')));
    cancel.onclick=cancelChallenge;
    try {id=window.turnstile.render(mount, {sitekey:config.turnstileSiteKey,action:'consult',cData:site,callback:token=>finish(null,token),'error-callback':()=>finish(Error(T('challengeFailed'))),'expired-callback':()=>finish(Error(T('challengeExpired')))});}
    catch {finish(Error(T('challengeStartFailed')));}
  });
}
