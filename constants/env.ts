export const isProdWeb = typeof window !== 'undefined' && 
  (window.location.hostname.includes('fly.dev') || process.env.NODE_ENV === 'production');

if (typeof window !== 'undefined') {
  (window as any).isProdWeb = isProdWeb;
}
