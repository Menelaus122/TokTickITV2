import { Card, EmptyState } from "../components/index.js";

// Lab 3, Issue 5 — the landing pages for IT Staff and Administrators, so both
// roles can sign in and see their navigation now. The Ticket Queue arrives in
// Issue 8 and User Management in Issue 10, and each replaces its page here.

export function RoleHome({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <h1>{title}</h1>
      <EmptyState title={title} body={body} icon="🛠" />
    </Card>
  );
}

export default RoleHome;
