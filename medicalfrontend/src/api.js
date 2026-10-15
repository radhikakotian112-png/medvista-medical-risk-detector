const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

function authHeaders(headers = {}) {
  const token = localStorage.getItem("accessToken");

  const nextHeaders = {
    ...headers,
    "ngrok-skip-browser-warning": "1",
  };

  return token
    ? { ...nextHeaders, Authorization: `Bearer ${token}` }
    : nextHeaders;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers: authHeaders(options.headers) });
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Check VITE_API_URL and the backend deployment.`);
  }
  if (response.status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("user");
  }
  return response;
}

export async function login(email, password) {
  const response = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Invalid email or password");
  return data;
}

export async function register(email, password) {
  const response = await request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Could not create account");
  return data;
}

export async function googleLogin(credential) {
  const response = await request("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Google sign-in failed");
  return data;
}

export async function getAdminOverview() {
  const response = await request("/api/admin/overview");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Could not load admin overview");
  return data;
}

export async function createPatient(patient) { const r = await request("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Could not save patient assessment"); return r.json(); }
export async function getPatients() { const r = await request("/api/patients"); if (!r.ok) throw new Error("Could not load patient assessments"); return r.json(); }
export async function getPatient(id) { const r = await request(`/api/patients/${id}`); if (!r.ok) throw new Error("Could not load patient assessment"); return r.json(); }
export async function updatePatient(id, patient) { const r = await request(`/api/patients/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Could not update patient assessment"); return r.json(); }
export async function deletePatient(id) { const r = await request(`/api/patients/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Could not delete patient assessment"); }
export async function getStatistics() { const r = await request("/api/statistics"); if (!r.ok) throw new Error("Could not load statistics"); return r.json(); }
export async function uploadDocument(file) { const formData = new FormData(); formData.append("file", file); const r = await request("/api/documents", { method: "POST", body: formData }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.detail || "Could not upload medical document"); return data; }
export async function predictRisk(patientData) { const r = await request("/api/predict-risk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patientData) }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.detail || "Could not generate prediction"); return data; }
export async function getModelStatus() { const r = await request("/api/model-status"); if (!r.ok) throw new Error("Could not check model status"); return r.json(); }
