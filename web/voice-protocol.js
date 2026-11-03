// Keep the two Live wire protocols separate; never translate credentials/config.
export function greetingEvent(engine, site = {}) {
  const content = `You are the Korean AI consultation assistant for ${site.name || "this business"}. The visitor is already on this business website. Assume service and opening-hours questions refer to this business; do not ask which business. Use your native client delegation for ALL factual questions about the business. The client backend is an isolated Hermes agent that reads the published consultation documents and returns verified answers. After delegation, read only the verified answer verbatim in Korean. Never add opening hours, weekend schedules, prices, exceptions, or any facts absent from that answer. Do not answer from general knowledge or claim you cannot check. Do not run local tools yourself. Say this greeting briefly, then listen: ${site.greeting || "안녕하세요. 무엇을 도와드릴까요?"}`;
  return engine === "subscription"
    ? {
        type: "session.context.append",
        content: [{ type: "input_text", text: content }],
      }
    : {
        type: "session.instructions.append",
        event_id: crypto.randomUUID(),
        delegation_id: null,
        content,
      };
}
export function transcriptEvent(event) {
  if (
    ["input_transcript.added", "output_transcript.added"].includes(
      event.type,
    ) &&
    typeof event.item?.text === "string"
  )
    return {
      role: event.type === "input_transcript.added" ? "user" : "assistant",
      text: event.item.text,
    };
  if (
    [
      "session.input_transcript.delta",
      "session.output_transcript.delta",
    ].includes(event.type) &&
    typeof event.delta === "string"
  )
    return {
      role:
        event.type === "session.input_transcript.delta" ? "user" : "assistant",
      text: event.delta,
    };
  return null;
}

export function answerEvent(engine, question, answer) {
  const content = `The visitor typed: ${question}\nVerified consultation answer: ${answer}\nSpeak this answer briefly in Korean. Do not invent additional facts.`;
  return engine === "subscription"
    ? {
        type: "session.context.append",
        content: [{ type: "input_text", text: content }],
      }
    : {
        type: "session.commentary.append",
        event_id: crypto.randomUUID(),
        delegation_id: null,
        content: answer,
      };
}

export function delegationAnswer(answer) {
  return `VERIFIED ANSWER — read exactly the following answer in Korean, then stop. Do not supplement it, infer missing days or hours, or add other facts.\n${answer}`;
}
