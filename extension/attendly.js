/* global chrome */
function deliver(payload) {
  window.postMessage({
    source: "ATTENDLY_AMIZONE_EXTENSION",
    type: "AMIZONE_SNAPSHOT",
    payload,
  }, "*");
}

function status(type, details = {}) {
  window.postMessage({
    source: "ATTENDLY_AMIZONE_EXTENSION",
    type,
    ...details,
  }, "*");
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "AMIZONE_SNAPSHOT") deliver(message.payload);
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "ATTENDLY_WEB") return;
  if (event.data?.type !== "REQUEST_AMIZONE_SYNC") return;

  status("AMIZONE_SYNC_STARTED");
  chrome.runtime.sendMessage({ type: "GET_AMIZONE_SNAPSHOT", capture: true }, (result) => {
    if (chrome.runtime.lastError) {
      status("AMIZONE_SYNC_ERROR", { message: chrome.runtime.lastError.message });
      return;
    }
    if (result?.snapshot) deliver(result.snapshot);
    if (!result?.requested) {
      status("AMIZONE_SYNC_ERROR", {
        message: "No logged-in Amizone tab was found. Open Amizone in another tab and try again.",
      });
    }
  });
});

status("ATTENDLY_EXTENSION_READY");
chrome.runtime.sendMessage({ type: "GET_AMIZONE_SNAPSHOT" }, (result) => {
  if (chrome.runtime.lastError) return;
  if (result?.snapshot) deliver(result.snapshot);
});
