const PRODUCTION_APP_URL = "https://tigerchat-hq.onrender.com";

/**
 * Email links must point to the hosted app, never the Android WebView's
 * local development origin (localhost:3000).
 */
export const getAuthRedirectUrl = (path = "/") =>
  new URL(path, PRODUCTION_APP_URL).toString();
