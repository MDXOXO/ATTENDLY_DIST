# Attendly Amizone Sync Extension

## Install
1. Start Attendly with `npm run dev`.
2. Open Chrome/Brave/Edge → Extensions.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select this `extension` folder.
6. If you already installed an older copy, click **Reload** on the extension after replacing/updating the files.

## Use
1. Log into Amizone normally at `https://s.amizone.net/`.
2. Keep an Amizone tab open.
3. Open Attendly at `http://localhost:5173/`.
4. Click **Sync Amizone**.
5. The extension asks the open Amizone tab to capture its currently visible timetable/attendance data and sends the snapshot to Attendly.

Attendly never asks for or stores the Amizone password.

## Troubleshooting
- If Attendly says **Extension not connected**, reload the extension and refresh the Attendly tab.
- If it says **No Amizone response**, keep an authenticated Amizone tab open and refresh that tab once, then click Sync again.
- The extension only reads data available in the authenticated Amizone page; it does not bypass Amizone authentication.
