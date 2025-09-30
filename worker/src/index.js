export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const { system, kidName, age, messages = [] } = await request.json();
        // quick safety filter
        const bad = ["address","phone","email","@","street","avenue","school","whatsapp","+","http","://"];
        for (const m of messages) {
          const t = (m.text || "").toLowerCase();
          if (bad.some(b => t.includes(b))) {
            return json({ reply: "Let us not share personal details. Tell me about toys, books, or fun experiences instead." });
          }
        }
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        const payload = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system || "You are a kind, funny, kid-safe Santa." },
            { role: "user", content: `Child: ${kidName || "Friend"}${age ? ` (age ${age})` : ""}.` },
            ...messages.map(m => ({ role: m.role === "santa" ? "assistant" : "user", content: m.text }))
          ],
          temperature: 0.6,
          max_tokens: 180
        };

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          return json({ reply: "Santa is tinkering with toys. Try again." });
        }
        const data = await resp.json();
        const reply = data.choices?.[0]?.message?.content || "Ho ho ho! Tell me more.";
        return json({ reply });
      } catch {
        return json({ reply: "Snow flurry error. Try again." });
      }
    }

    return new Response("OK", { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain" } });
  }
};

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
  });
}
