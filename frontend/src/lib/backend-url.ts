// Public API address, embedded by Next.js when the frontend is built.
export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    // This is Render's public service URL. The srv-... identifier is not a
    // public web address and returns 404, which appears in the browser as a
    // generic NetworkError during login or registration.
    ? "https://payvolution.onrender.com"
    : "http://127.0.0.1:8000")
).replace(/\/+$/, "");
