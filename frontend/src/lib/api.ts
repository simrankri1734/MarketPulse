import { auth } from "./firebase";

const API_BASE_URL = "https://marketpulse-7yrv.onrender.com/api";

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("User is not authenticated");
  }

  const idToken = await currentUser.getIdToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}