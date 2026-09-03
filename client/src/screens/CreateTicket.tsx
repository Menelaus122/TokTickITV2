import { useCallback, useEffect, useRef, useState } from "react";
import {
  AttachmentError,
  Category,
  MAX_ACTIVE_ATTACHMENTS,
  NewTicket,
  PERMITTED_EXTENSIONS,
  RelatedSystem,
  RequestedPriority,
  Ticket,
  TicketValidationError,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
  uploadAttachment,
} from "../api.js";
import { checkFileBeforeUpload } from "../components/AttachmentSection.js";
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
  WarningCallout,
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

export function CreateTicket({
  onCreated,
  onCancel,
}: {
  /** Opens the created ticket. Called from the success state, never automatically. */
  onCreated?: (ticket: Ticket) => void;
  onCancel?: () => void;
}) {
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

  // Files chosen before the ticket exists. They cannot be uploaded yet — an
  // attachment belongs to a ticket — so they are held here and sent once the
  // backend has created one (FR-15).
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<{ filename: string; message: string }[]>([]);
  const [uploadFailures, setUploadFailures] = useState<{ filename: string; message: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

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

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!chosen) return;

    // Validated on selection rather than on submit, so the Requester finds out
    // immediately instead of after filling the whole form. The server
    // re-validates on upload and remains the authority (BR-29).
    const problem = checkFileBeforeUpload(chosen);
    if (problem) {
      setFileErrors((current) => [
        ...current.filter((f) => f.filename !== chosen.name),
        { filename: chosen.name, message: problem },
      ]);
      return;
    }

    if (files.length >= MAX_ACTIVE_ATTACHMENTS) {
      setFileErrors((current) => [
        ...current.filter((f) => f.filename !== chosen.name),
        {
          filename: chosen.name,
          message: `A ticket may hold at most ${MAX_ACTIVE_ATTACHMENTS} attachments.`,
        },
      ]);
      return;
    }

    setFiles((current) => [...current, chosen]);
    setFileErrors((current) => current.filter((f) => f.filename !== chosen.name));
  }

  function removeChosenFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name));
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

      // Attachments are uploaded after the ticket exists, one request per file
      // so a partial failure can be reported per file (FR-31).
      const failures: { filename: string; message: string }[] = [];
      for (const file of files) {
        try {
          await uploadAttachment(requester.id, ticket.id, file);
        } catch (uploadError) {
          failures.push({
            filename: file.name,
            message:
              uploadError instanceof AttachmentError
                ? uploadError.message
                : "The file could not be attached.",
          });
        }
      }

      setCreated(ticket);
      setUploadFailures(failures);
      // BR-31 — the form is cleared only on success.
      setValues(EMPTY_FORM);
      setFiles([]);
      setFileErrors([]);

      // Deliberately does NOT navigate. The success state has to be seen: it
      // is where the official Ticket Number is confirmed and the next action
      // offered (labsheet 8.3). Routing straight to the detail screen would
      // skip past it, and would also hide which attachments failed (BR-42).
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

        {uploadFailures.length > 0 && (
          <WarningCallout>
            <p>
              The ticket was created, but {uploadFailures.length} attachment
              {uploadFailures.length === 1 ? "" : "s"} could not be uploaded. Add them again from
              the ticket.
            </p>
            <ul>
              {uploadFailures.map((failure) => (
                <li key={failure.filename}>
                  <strong>{failure.filename}</strong> — {failure.message}
                </li>
              ))}
            </ul>
          </WarningCallout>
        )}

        <ActionBar>
          <Button
            variant="secondary"
            onClick={() => {
              setUploadFailures([]);
              setCreated(null);
            }}
          >
            Create another
          </Button>
          {onCreated && (
            <Button variant="primary" onClick={() => onCreated(created)}>
              View ticket
            </Button>
          )}
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

        {/* Attachments sit below the main fields, as ui-spec.md 9 lays out. */}
        <fieldset className="tt-fieldset">
          <legend className="tt-field__label">Attachments</legend>

          <p className="tt-muted">
            {PERMITTED_EXTENSIONS.join(", ")} · max 5 MB each · up to {MAX_ACTIVE_ATTACHMENTS}
          </p>

          <Button
            variant="secondary"
            disabled={files.length >= MAX_ACTIVE_ATTACHMENTS}
            title={
              files.length >= MAX_ACTIVE_ATTACHMENTS
                ? `Maximum ${MAX_ACTIVE_ATTACHMENTS} attachments`
                : undefined
            }
            onClick={() => fileInput.current?.click()}
          >
            Choose file
          </Button>

          <input
            ref={fileInput}
            type="file"
            className="tt-visually-hidden"
            aria-label="Choose a file to attach"
            accept={PERMITTED_EXTENSIONS.join(",")}
            onChange={handleFileChosen}
          />

          <ul className="tt-attachments">
            {files.map((file) => (
              <li className="tt-attachment" key={file.name} data-state="selected">
                <span className="tt-attachment__name">{file.name}</span>
                <span className="tt-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                <span className="tt-attachment__actions">
                  <Button variant="tertiary" onClick={() => removeChosenFile(file.name)}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}

            {/* A rejected file stays visible with its reason and is never sent
                (AC-13). */}
            {fileErrors.map((rejection) => (
              <li
                className="tt-attachment tt-attachment--invalid"
                key={rejection.filename}
                role="alert"
                data-state="rejected"
              >
                <span>
                  <strong>{rejection.filename}</strong> — {rejection.message}
                </span>
                <span className="tt-attachment__actions">
                  <Button
                    variant="tertiary"
                    onClick={() =>
                      setFileErrors((current) =>
                        current.filter((f) => f.filename !== rejection.filename),
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </span>
              </li>
            ))}
          </ul>

          {files.length === 0 && fileErrors.length === 0 && (
            <p className="tt-muted" data-state="empty">
              No files chosen.
            </p>
          )}
        </fieldset>

        {formError && <ErrorState message={formError} />}

        <ActionBar>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
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
