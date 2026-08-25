import { ReactNode } from "react";

// Layout and list primitives. These carry the responsive rules from
// ui-spec.md 13 so individual screens never re-invent a breakpoint:
//   Desktop >= 992px  ·  Tablet 768-991px  ·  Mobile < 768px

// --- Page and card ---------------------------------------------------------

export function Page({ children }: { children: ReactNode }) {
  return <div className="tt-page">{children}</div>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="tt-card">
      {title && <h2 className="tt-h2">{title}</h2>}
      {children}
    </section>
  );
}

// --- Responsive field grid -------------------------------------------------

// columns is the DESKTOP column count. Tablet collapses to two, mobile to one,
// which is handled entirely in CSS so it cannot drift per screen.
export function FieldGrid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return <div className={`tt-grid tt-grid--${columns}`}>{children}</div>;
}

// A field that keeps full width at every breakpoint — Summary and Description
// need the room (ui-spec.md 9.2).
export function FullWidth({ children }: { children: ReactNode }) {
  return <div className="tt-span-all">{children}</div>;
}

// --- Actions ---------------------------------------------------------------

// Primary right, secondary to its left on desktop; stacked full width with the
// primary on top on mobile (the CSS reverses the flex direction).
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="tt-actions">{children}</div>;
}

// --- Responsive list -------------------------------------------------------

// One data set, two presentations: a table at >= 992px and cards below 768px.
// Both are rendered and CSS decides which is visible, so there is no viewport
// measurement in JavaScript and no flash of the wrong layout on first paint.
export interface ResponsiveListProps<T> {
  items: T[];
  columns: string[];
  renderRow: (item: T) => ReactNode;
  renderCard: (item: T) => ReactNode;
  keyOf: (item: T) => string | number;
  caption?: string;
}

export function ResponsiveList<T>({
  items,
  columns,
  renderRow,
  renderCard,
  keyOf,
  caption,
}: ResponsiveListProps<T>) {
  return (
    <>
      <table className="tt-table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={keyOf(item)}>{renderRow(item)}</tr>
          ))}
        </tbody>
      </table>

      <div className="tt-cards">
        {items.map((item) => (
          <article className="tt-card-row" key={keyOf(item)}>
            {renderCard(item)}
          </article>
        ))}
      </div>
    </>
  );
}
