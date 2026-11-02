# Google Sheets and Drive connection

This is a one-way, owner-triggered export. It does not upload biometric templates.
Files are created in the account selected during Google consent. The app requests
only `https://www.googleapis.com/auth/drive.file`, for files it creates.

1. Open https://console.cloud.google.com/ and choose or create your project.
2. Enable Google Drive API and Google Sheets API.
3. Configure Google Auth Platform branding, audience and consent. Add your account
   as a test user while the application is in testing.
4. Create an OAuth client of type Web application. Add the exact redirect URI:
   `http://127.0.0.1:5173/api/google/callback`. Production needs its own HTTPS URI.
5. Put the following in a local `.dev.vars` file (ignored by Git). Replace the values:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/google/callback
   GOOGLE_TOKEN_KEY=base64-encoded-32-byte-random-key
   ```

   Generate the encryption key with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   Save it as a server secret; changing it invalidates saved connections.
   For production set all four through your hosting provider's server secret system.
6. Restart `npm run dev`, sign in, and open Sites & settings. Click Connect Google
   account, complete consent, then click Sync now. Check both destination links.

Google tokens are encrypted with AES-GCM and workspace-bound authenticated data
before storage in the private D1 connection table. Only the workspace owner can
connect, export or disconnect. A short-lived HTTP-only nonce cookie and encrypted
state bind OAuth to the signed-in owner. Google may expire testing-mode grants;
use Reconnect when needed. Disconnect removes Hewers' stored connection; to revoke
the provider grant use https://myaccount.google.com/connections . Existing exports
remain in Google Drive.

The Attendance, Inventory and Movements tabs are export mirrors and are refreshed
on each sync. Use other tabs for your edits. Photo uploads are limited to ten new
photos per request; repeat Sync now if the page reports remaining photos. Exports
retain deleted-source records/photos until the next sheet sync or manual Drive
cleanup. No automatic background schedule is configured. A failed export may
leave a partial copy; retry to complete it. Verify real Google API access after
credentials are installed; automated tests alone do not establish a live connection.
