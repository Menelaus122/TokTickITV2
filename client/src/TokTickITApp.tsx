import { useCallback, useEffect, useState } from "react";
import { fetchRequesters, Requester } from "./api.js";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelection, SelectionStatus } from "./screens/RequesterSelection.js";
import { CreateTicket } from "./screens/CreateTicket.js";
import { MyTickets } from "./screens/MyTickets.js";
import { AppShell } from "./components/AppShell.js";
import { Page, Card } from "./components/index.js";
import App from "./App.js";

// Lab 2 application root.
//
// Until a Development Requester is chosen there is nothing requester-scoped to
// render, so the Selection screen stands in front of the whole application
// (FR-05). Issue 8 replaces this gate with real routing and route guards; the
// behaviour it enforces is the same either way.

function RequesterGate({
  requesters,
  status,
  errorMessage,
  onRetry,
}: {
  requesters: Requester[];
  status: SelectionStatus;
  errorMessage?: string;
  onRetry: () => void;
}) {
  const { requester, selectRequester } = useRequester();
  // Bumped after a successful creation so My Tickets refetches and the new
  // ticket appears without a manual reload.
  const [listVersion, setListVersion] = useState(0);

  if (!requester) {
    return (
      <RequesterSelection
        status={status}
        requesters={requesters}
        errorMessage={errorMessage}
        onRetry={onRetry}
        onContinue={selectRequester}
      />
    );
  }

  return (
    <AppShell>
      <Page>
        <Card title="Signed in for testing as">
          <p>
            <strong>{requester.fullName}</strong>
            {requester.department ? ` — ${requester.department}` : ""}
          </p>
          <p className="tt-muted">{requester.email}</p>
          <p className="tt-muted">Ticket Detail arrives in Issue 7.</p>
        </Card>

        {/* Both screens are remounted whenever the requester changes, so no
            value typed and no row loaded for the previous requester survives
            the switch (BR-11). */}
        <CreateTicket key={`create-${requester.id}`} onCreated={() => setListVersion((v) => v + 1)} />

        <MyTickets key={`list-${requester.id}-${listVersion}`} />

        {/* The Lab 1 system check, kept as a panel inside the shell so the
            backend's health is still visible from the running application. */}
        <App />
      </Page>
    </AppShell>
  );
}

export function TokTickITApp() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [status, setStatus] = useState<SelectionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(undefined);
    try {
      setRequesters(await fetchRequesters());
      setStatus("ready");
    } catch {
      // Safe message only: no status codes, URLs, or stack traces (FR-33).
      setRequesters([]);
      setErrorMessage(
        "Cannot load Development Requesters. Make sure the TokTickIT API is running, then try again.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    // Pass undefined until the load settles, so a stored selection survives
    // the round trip instead of being discarded against an empty list.
    <RequesterProvider available={status === "ready" ? requesters : undefined}>
      <RequesterGate
        requesters={requesters}
        status={status}
        errorMessage={errorMessage}
        onRetry={load}
      />
    </RequesterProvider>
  );
}

export default TokTickITApp;
