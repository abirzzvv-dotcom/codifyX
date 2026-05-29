const ngrok = require("ngrok");

let currentUrl = null;
let connected = false;

async function startNgrok(port) {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.warn("[Ngrok] NGROK_AUTH_TOKEN not set, skipping ngrok");
    return null;
  }
  try {
    await ngrok.kill();
  } catch (_) {}
  try {
    currentUrl = await ngrok.connect({
      addr: port,
      proto: "http",
      authtoken: process.env.NGROK_AUTH_TOKEN,
    });
    connected = true;
    console.log(`[Ngrok] Public URL: ${currentUrl}`);
    ngrok.addListener("disconnect", () => {
      connected = false;
      console.warn("[Ngrok] Disconnected — reconnecting in 5s...");
      setTimeout(() => reconnect(port), 5000);
    });
    return currentUrl;
  } catch (err) {
    console.error("[Ngrok] Failed to start:", err.message);
    return null;
  }
}

async function reconnect(port) {
  try {
    await ngrok.disconnect();
    currentUrl = await ngrok.connect({
      addr: port,
      proto: "http",
      authtoken: process.env.NGROK_AUTH_TOKEN,
    });
    connected = true;
    console.log(`[Ngrok] Reconnected: ${currentUrl}`);
  } catch (err) {
    console.error("[Ngrok] Reconnect failed:", err.message);
    setTimeout(() => reconnect(port), 10000);
  }
}

function getNgrokUrl() {
  return { url: currentUrl, connected };
}

module.exports = { startNgrok, getNgrokUrl };
