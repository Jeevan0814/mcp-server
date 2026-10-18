
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const EMAIL = "24f2003693@ds.study.iitm.ac.in";
const PROTOCOL_VERSION = "2025-03-26";

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message }
  };
}

app.post("/mcp", (req, res) => {
  const body = req.body;

  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return res.status(400).json(
      rpcError(body?.id, -32600, "Invalid JSON-RPC request")
    );
  }

  // Notifications do not receive a JSON-RPC response.
  if (body.id === undefined) {
    return res.status(202).end();
  }

  if (body.method === "initialize") {
    return res.json(
      rpcResult(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: "exam-challenge-server",
          version: "1.0.0"
        }
      })
    );
  }

  if (body.method === "ping") {
    return res.json(rpcResult(body.id, {}));
  }

  if (body.method === "tools/list") {
    return res.json(
      rpcResult(body.id, {
        tools: [
          {
            name: "solve_challenge",
            description:
              "Returns the SHA-256 challenge response using the exam email.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          }
        ]
      })
    );
  }

  if (body.method === "tools/call") {
    const name = body.params?.name;

    if (name !== "solve_challenge") {
      return res.json(rpcError(body.id, -32602, "Unknown tool"));
    }

    // Read the challenge from THIS HTTP request's headers.
    // Never use a challenge supplied in the JSON request body.
    const challenge = req.get("X-Exam-Challenge");

    if (!challenge || !/^[0-9a-f]{32}$/.test(challenge)) {
      return res.json(
        rpcResult(body.id, {
          content: [
            { type: "text", text: "Missing or invalid challenge header" }
          ],
          isError: true
        })
      );
    }

    const normalizedEmail = EMAIL.trim().toLowerCase();

    const answer = crypto
      .createHash("sha256")
      .update(`${challenge}:${normalizedEmail}`, "utf8")
      .digest("hex")
      .slice(0, 16);

    return res.json(
      rpcResult(body.id, {
        content: [{ type: "text", text: answer }]
      })
    );
  }

  if (body.method === "resources/list" ||
      body.method === "prompts/list") {
    return res.json(rpcError(body.id, -32601, "Method not found"));
  }

  return res.json(
    rpcError(body.id, -32601, "Method not found")
  );
});

// Optional endpoint for deployment health checks.
// This is not an additional MCP tool.
app.get("/", (_req, res) => {
  res.status(200).send("MCP challenge server is running");
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`MCP server listening on port ${port}`);
});
