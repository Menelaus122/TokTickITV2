import { useCallback, useEffect, useState } from "react";
import {
  Category,
  NewTicket,
  RelatedSystem,
  RequestedPriority,
  Ticket,
  TicketValidationError,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";
import {
  ActionBar,
  Button,
  Card,
  ErrorState,
  FieldGrid,
  FullWidth,
  ReadOnlyField,
  SelectInput,
  SuccessCallout,
  TextArea,
  TextInput,
} from "../components/index.js";

// Create Ticket screen (ui-spec.md 9).
//
// The layout puts the system-generated values at the top as read-only fields,
// so it is visually obvious which values the Requester owns and which the
// backend does. Nothing here invents a ticket number or a date.

// Mirrors server/src/validation.ts. The server is still the authority (BR-29);
// this copy only exists to answer the Requester without a round trip.
export const SUMMARY_MIN = 5;
export const SUMMARY_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;

const PRIORITY_OPTIONS: { value: RequestedPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

interface FormValues {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  description: string;
  requestedPriority: string;
}

const EMPTY_FORM: FormValues = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  description: "",
  requestedPriority: "",
};

export function validateForm(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const summary = values.summary.trim();
  const description = values.description.trim();

  if (summary.length === 0) errors.summary = "Summary is required.";
  else if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX)
    errors.summary = `Summary must be between ${SUMMARY_MIN} and ${SUMMARY_MAX} characters.`;

  if (description.length === 0) errors.description = "Description is required.";
  else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    errors.description = `Description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`;

  if (!values.categoryId) errors.categoryId = "Category is required.";
  if (!values.relatedSystemId) errors.relatedSystemId = "Related System is required.";
  if (!values.requestedPriority) errors.requestedPriority = "Requested Priority is required.";

  return errors;
}

export function CreateTicket({ onCreated }: { onCreated?: (ticket: Ticket) => void }) {
  const { requester } = useRequester();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [referenceFailed, setReferenceFailed] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(true);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<Ticket | null>(null);

  const loadReferenceData = useCallback(async () => {
    setReferenceLoading(true);
    setReferenceFailed(false);
    try {
      // Options always come from the database, never from a literal array.
      const [loadedCategories, loadedSystems] = await Promise.all([
        fetchCategories(),
        fetchRelatedSystems(),
      ]);
      setCategories(loadedCategories);
      setSystems(loadedSystems);
    } catch {
      setReferenceFailed(true);
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // BR-30 — one in-flight submission at a time, so a double click cannot
    // create two tickets.
    if (submitting || !requester) return;

    setFormError(undefined);

    const clientErrors = validateForm(values);
    if (Object.keys(clientErrors).length > 0) {
      // No request is issued when the client already knows the form is invalid.
      setErrors(clientErrors);
      return;
    }
    setErrors({});

    const payload: NewTicket = {
      categoryId: Number(values.categoryId),
      relatedSystemId: Number(values.relatedSystemId),
      summary: values.summary.trim(),
      description: values.description.trim(),
      requestedPriority: values.requestedPriority as RequestedPriority,
    };

    setSubmitting(true);
    try {
      const ticket = await createTicket(requester.id, payload);
      setCreated(ticket);
      // BR-31 — the form is cleared only on success.
      setValues(EMPTY_FORM);
      onCreated?.(ticket);
    } catch (error) {
      if (error instanceof TicketValidationError) {
        setErrors(error.fields);
        setFormError("Some fields need attention before this ticket can be created.");
      } else {
        // Safe message only. Every value the Requester typed is still in state,
        // so nothing they wrote is lost (FR-17).
        setFormError(
          "Cannot reach the TokTickIT API. Your ticket has not been created, and nothing you entered has been lost — try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Card title="Ticket created">
        <SuccessCallout>
          Ticket <strong data-testid="created-ticket-number">{created.ticketNumber}</strong> created.
        </SuccessCallout>

        <dl>
          <dt>Ticket Date</dt>
          <dd>{new Date(created.ticketDate).toLocaleString()}</dd>
          <dt>Requester</dt>
          <dd>{created.requester.fullName}</dd>
          <dt>Summary</dt>
          <dd>{created.summary}</dd>
        </dl>

        <ActionBar>
          <Button variant="secondary" onClick={() => setCreated(null)}>
            Create another
          </Button>
        </ActionBar>
      </Card>
    );
  }

  return (
    <Card title="Create Ticket">
      <form onSubmit={handleSubmit} noValidate>
        {/* System-generated values, grouped at the top and visibly read-only
            so they cannot be confused with fields the Requester fills in. */}
        <FieldGrid columns={3}>
          <ReadOnlyField label="Ticket Number" value="Generated on submit" />
          <ReadOnlyField label="Ticket Date" value="Generated on submit" />
          <ReadOnlyField label="Requester" value={requester?.fullName ?? ""} />
        </FieldGrid>

        {referenceFailed && (
          <ErrorState
            message="Cannot load Categories and Related Systems. Make sure the TokTickIT API is running, then try again."
            onRetry={loadReferenceData}
          />
        )}

        <FieldGrid columns={3}>
          <SelectInput
            label="Category"
            required
            placeholder="Choose a category…"
            disabled={referenceLoading || referenceFailed}
            value={values.categoryId}
            error={errors.categoryId}
            onChange={(event) => update("categoryId", event.target.value)}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />

          <SelectInput
            label="Related System"
            required
            placeholder="Choose a system…"
            disabled={referenceLoading || referenceFailed}
            value={values.relatedSystemId}
            error={errors.relatedSystemId}
            onChange={(event) => update("relatedSystemId", event.target.value)}
            options={systems.map((system) => ({ value: system.id, label: system.name }))}
          />

          <SelectInput
            label="Requested Priority"
            required
            placeholder="Choose a priority…"
            value={values.requestedPriority}
            error={errors.requestedPriority}
            onChange={(event) => update("requestedPriority", event.target.value)}
            options={PRIORITY_OPTIONS}
          />
        </FieldGrid>

        <FullWidth>
          <TextInput
            label="Ticket Summary"
            required
            value={values.summary}
            error={errors.summary}
            help={`${SUMMARY_MIN}-${SUMMARY_MAX} characters.`}
            maxLength={SUMMARY_MAX}
            onChange={(event) => update("summary", event.target.value)}
          />

          <TextArea
            label="Description"
            required
            value={values.description}
            error={errors.description}
            help={`${values.description.trim().length} / ${DESCRIPTION_MAX}`}
            onChange={(event) => update("description", event.target.value)}
          />
        </FullWidth>

        {formError && <ErrorState message={formError} />}

        <ActionBar>
          <Button
            type="submit"
            variant="primary"
            busy={submitting}
            busyLabel="Submitting…"
            disabled={referenceFailed}
          >
            Submit Ticket
          </Button>
        </ActionBar>
      </form>
    </Card>
  );
}

export default CreateTicket;
