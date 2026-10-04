import { Card, EmptyState } from "../components/index.js";

// Lab 3, Issue 5 — placeholder pages for screens a later issue builds, so each
// role can sign in and see its navigation now. The Ticket Queue replaced its
// page in Issue 8; the IT Staff Ticket Detail arrives in Issue 9 and User
// Management in Issue 10.

export function RoleHome({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <h1>{title}</h1>
      <EmptyState title={title} body={body} icon="🛠" />
    </Card>
  );
}

export default RoleHome;
