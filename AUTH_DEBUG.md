# Authentication Debugging Guide

## Quick Test

1. **Check if cookies are being sent:**
   ```bash
   curl -v https://gathersync.fly.dev/api/auth/debug \
     -H "Cookie: connect.sid=YOUR_SESSION_ID; app_session_token=YOUR_TOKEN" \
     -H "Origin: https://app.gathersync.app"
   ```

2. **In browser console, check authentication state:**
   ```javascript
   // Check tRPC debug endpoint
   const client = trpc.createClient({...});
   client.auth.debug.query().then(console.log);
   
   // Or use REST endpoint
   fetch('/api/auth/debug', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log);
   ```

## What to Check

### 1. Cookies Being Set
- After OAuth login, check browser DevTools → Application → Cookies
- Should see:
  - `connect.sid` (express-session cookie)
  - `app_session_token` (JWT cookie)

### 2. Cookies Being Sent
- Check Network tab → Request Headers → Cookie header
- Should include both cookies for tRPC requests

### 3. Server Receiving Cookies
- Check server logs for `[tRPC Context] Auth check for protected route:`
- Look for:
  - `hasCookieHeader: true`
  - `hasConnectSid: true` OR `hasCookieToken: true`
  - `hasSessionUser: true` (if session loaded)

### 4. Common Issues

**Issue: Cookies not being sent**
- Check CORS configuration
- Verify `credentials: 'include'` in fetch/tRPC client
- Check cookie `sameSite` and `secure` settings match environment

**Issue: Session not loading**
- MemoryStore loses data on restart - this is expected
- JWT cookie (`app_session_token`) should work as fallback
- Check if `cookieToken` is being read correctly

**Issue: Both cookies missing**
- User needs to log in again
- Check OAuth callback is setting both cookies
- Verify cookie options are correct

## Expected Flow

1. User logs in → OAuth callback sets both cookies
2. Browser stores cookies (HTTP-only, secure)
3. tRPC request → Browser sends cookies with `credentials: 'include'`
4. Server receives → Checks `req.session.user` first
5. If no session user → Falls back to `app_session_token` cookie
6. If authenticated → Returns user, restores session for next request
