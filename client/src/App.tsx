import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleCheck() {
    // Issue 2 — call the real backend and reflect its status in the UI.
    setState("loading");
    setErrorMessage("");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch {
      setErrorMessage(
        "Cannot reach the TokTickIT API. Make sure the backend is running on " +
          (import.meta.env.VITE_API_URL ?? "http://localhost:3000") +
          " and try again."
      );
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-4">
          <div className="alert alert-success d-flex align-items-center" role="status">
            <span className="badge bg-success me-2">Online</span>
            <span>Backend is reachable — TokTickIT API is healthy.</span>
          </div>

          <h2 className="h5 mt-4">Supported Request Categories</h2>
          {categories.length === 0 ? (
            <p className="text-muted mt-2">No categories found.</p>
          ) : (
            <ol className="list-group list-group-numbered mt-2">
              {categories.map((category) => (
                <li key={category.id} className="list-group-item">
                  {category.name}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4" role="alert">
          <span className="badge bg-danger me-2">Offline</span>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
