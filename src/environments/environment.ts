// One source of truth for the backend base URL.
// Your FastAPI runs on http://localhost:8000 in dev.
export const environment = {
  production: false,
  apiBase: 'http://localhost:8000',
};