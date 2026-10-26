// Real loopback HTTP integration: no external network, model download or privileged action.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createIntelligenceRuntime, createLocalAiRuntime } from "./runtime-adapter.mjs";

const MODEL = "ordax-fixture-gguf";
const event = (delta, finishReason = null) =>
  `data: ${JSON.stringify({ model: MODEL, choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;

async function loopback(t, handler) {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200);
      response.end("ok");
      return;
    }
    handler(request, response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function json(response, value) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

test("Native Intelligence public port completes a real loopback HTTP request without tools", async (t) => {
  const requests = [];
  const endpoint = await loopback(t, (request, response) => {
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.method, "POST");
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push(body);
      json(response, { model: MODEL, choices: [{ message: { role: "assistant", content: "Resposta local" }, finish_reason: "stop" }] });
    });
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
  await local.probe();
  assert.equal(local.getSnapshot().state, "ready");
  const intelligence = createIntelligenceRuntime({ inferencePort: local });
  const result = await intelligence.respond({ prompt: "Explique a maré" });
  assert.equal(result.text, "Resposta local");
  assert.equal(result.authority, "none");
  assert.equal(intelligence.getSnapshot().toolExecution, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].stream, false);
  assert.ok(requests[0].messages.every(({ role }) => role === "system" || role === "user"));
  intelligence.dispose();
  local.dispose();
});

test("real SSE loopback delivers ordered provisional deltas and verifies final termination", async (t) => {
  const endpoint = await loopback(t, (request, response) => {
    assert.equal(request.url, "/v1/chat/completions");
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(event({ role: "assistant", content: "bom " }));
    response.write(event({ content: "dia" }));
    response.write(event({}, "stop"));
    response.end("data: [DONE]\n\n");
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
  await local.probe();
  const deltas = [];
  const result = await local.generate({ prompt: "Diga bom dia" }, { onDelta: (part) => deltas.push(part) });
  assert.deepEqual(deltas, ["bom ", "dia"]);
  assert.equal(result.text, "bom dia");
  assert.equal(local.getSnapshot().state, "ready");
  local.dispose();
});

test("real streaming cancellation rejects partial output and leaves the health probe usable", async (t) => {
  const endpoint = await loopback(t, (request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(event({ role: "assistant", content: "provisório" }));
    // Intentionally never send finish_reason or [DONE]: cancellation must win.
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL, probeTimeoutMs: 1000 });
  await local.probe();
  const controller = new AbortController();
  const deltas = [];
  await assert.rejects(local.generate({ prompt: "Cancelar" }, {
    signal: controller.signal,
    onDelta(part) {
      deltas.push(part);
      controller.abort();
    },
  }), /cancelled/);
  assert.deepEqual(deltas, ["provisório"]);
  assert.equal(local.getSnapshot().state, "ready");
  local.dispose();
});

test("a real HTTP buffered response carrying tool calls is rejected, never promoted as text", async (t) => {
  const endpoint = await loopback(t, (request, response) => {
    json(response, {
      model: MODEL,
      choices: [{
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: "Vou executar esta ação",
          tool_calls: [{ id: "malicious", type: "function", function: { name: "execute", arguments: "{}" } }],
        },
      }],
    });
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
  await local.probe();
  await assert.rejects(local.generate({ prompt: "Pode responder sem executar?" }), /completion.*(invalid|tool|authority|unsupported)/i);
  assert.equal(local.getSnapshot().state, "ready");
  local.dispose();
});

test("without a discovered model the real loopback remains unavailable, with no inference POST", async (t) => {
  let completionPosts = 0;
  const endpoint = await loopback(t, (request, response) => {
    if (request.url === "/v1/models") return json(response, { data: [] });
    if (request.url === "/v1/chat/completions") completionPosts += 1;
    response.writeHead(503);
    response.end();
  });
  const local = createLocalAiRuntime({ endpoint, modelId: null });
  assert.equal((await local.probe()).state, "unavailable");
  await assert.rejects(local.generate({ prompt: "Sem modelo" }), /not ready/);
  assert.equal(completionPosts, 0);
  local.dispose();
});

test("a real HTTP response with finish_reason=length is not treated as complete", async (t) => {
  const endpoint = await loopback(t, (request, response) => {
    json(response, {
      model: MODEL,
      choices: [{ message: { role: "assistant", content: "resultado truncado" }, finish_reason: "length" }],
    });
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
  await local.probe();
  await assert.rejects(local.generate({ prompt: "Resultado completo" }), /completion.*(invalid|unsupported)/i);
  assert.equal(local.getSnapshot().state, "ready");
  local.dispose();
});

test("a legacy function_call field is not promoted as an authorized answer", async (t) => {
  const endpoint = await loopback(t, (request, response) => {
    json(response, {
      model: MODEL,
      choices: [{ message: {
        role: "assistant",
        content: "ação proposta",
        function_call: { name: "execute", arguments: "{}" },
      }, finish_reason: "stop" }],
    });
  });
  const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
  await local.probe();
  await assert.rejects(local.generate({ prompt: "Sem ações" }), /completion.*(invalid|unsupported)/i);
  local.dispose();
});

test("SSE loopback refuses hidden tool authority, refusal metadata and malformed assistant roles", async (t) => {
  const forbidden = [
    ["delta.tool_call_id", choice => { choice.delta.tool_call_id = "call-1"; }],
    ["delta.refusal", choice => { choice.delta.refusal = "refusal-marker"; }],
    ["choice.tool_calls", choice => { choice.tool_calls = [{ id: "call-1" }]; }],
    ["choice.function_call", choice => { choice.function_call = { name: "execute", arguments: "{}" }; }],
    ["choice.tool_call_id", choice => { choice.tool_call_id = "call-1"; }],
    ["choice.refusal", choice => { choice.refusal = "refusal-marker"; }],
    ["invalid role empty", choice => { choice.delta.role = ""; }],
    ["invalid role null", choice => { choice.delta.role = null; }],
  ];

  for (const [name, addField] of forbidden) {
    await t.test(name, async (subtest) => {
      const endpoint = await loopback(subtest, (request, response) => {
        const choice = { index: 0, delta: { role: "assistant", content: "texto não autorizado" }, finish_reason: "stop" };
        addField(choice);
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.end(`data: ${JSON.stringify({ model: MODEL, choices: [choice] })}\n\ndata: [DONE]\n\n`);
      });

      const local = createLocalAiRuntime({ endpoint, modelId: MODEL });
      try {
        await local.probe();
        const provisional = [];
        await assert.rejects(local.generate({ prompt: "Somente texto" }, {
          onDelta: (part) => provisional.push(part),
        }), /streaming accepts assistant text only/);
        assert.deepEqual(provisional, []);
      } finally {
        local.dispose();
      }
    });
  }
});
