import { createChromeBackend } from "./backend.mjs";
import { ExtensionConnections, connectionTargets } from "./connections.mjs";
async function main() {
  let connections,
    generation = 0;
  const instanceId =
    (await chrome.storage.local.get("instanceId")).instanceId ??
    crypto.randomUUID();
  await chrome.storage.local.set({ instanceId });
  const backend = createChromeBackend(chrome, (name, data) =>
    connections?.emit(name, data),
  );
  async function configure() {
    const current = ++generation;
    const {
      url = "ws://127.0.0.1:29651",
      token,
      profileName = "Chrome",
      autoDiscover = true,
    } = await chrome.storage.local.get([
      "url",
      "token",
      "profileName",
      "autoDiscover",
    ]);
    if (current !== generation) return;
    connections?.close();
    connections = undefined;
    if (!token) return;
    connections = new ExtensionConnections({
      backend,
      WebSocket,
      instanceId,
      profileName,
      token,
      targets: connectionTargets({ url, autoDiscover }),
    });
    connections.start();
  }
  chrome.storage.onChanged.addListener(() => configure().catch(console.error));
  chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
  chrome.alarms.create("reconnect", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener(() =>
    connections ? connections.scan() : configure().catch(console.error),
  );
  await configure();
}
main().catch((error) => console.error("Bridge startup failed", error));
