/* global chrome */
const STORE_KEY = "attendlyAmizoneSnapshot";

async function broadcastSnapshot(snapshot) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "AMIZONE_SNAPSHOT",
        payload: snapshot,
      });
    } catch {
      // Tab does not have the Attendly content script.
    }
  }
}

async function requestAmizoneCapture() {
  const tabs = await chrome.tabs.query({ url: "https://s.amizone.net/*" });
  let requested = 0;
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_AMIZONE_NOW" });
      requested += 1;
    } catch {
      // Amizone tab may not have loaded the content script yet.
    }
  }
  return requested;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AMIZONE_SNAPSHOT") {
    const snapshot = {
      ...message.payload,
      syncedAt: new Date().toISOString(),
      sourceUrl: sender.tab?.url || message.payload?.page || "https://s.amizone.net/",
    };
    chrome.storage.local.set({ [STORE_KEY]: snapshot }).then(async () => {
      await broadcastSnapshot(snapshot);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "GET_AMIZONE_SNAPSHOT") {
    chrome.storage.local.get(STORE_KEY).then(async (result) => {
      let snapshot = result[STORE_KEY] || null;
      if (message.capture) {
        const requested = await requestAmizoneCapture();
        sendResponse({ snapshot, requested, ok: true });
      } else {
        sendResponse({ snapshot, requested: 0, ok: true });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: "https://s.amizone.net/*" });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await requestAmizoneCapture();
  } else {
    await chrome.tabs.create({ url: "https://s.amizone.net/" });
  }
});
