import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type Props = {
  residentId: Id<"residents">;
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "logs", label: "Logs" },
  { key: "isp", label: "ISP" },
  { key: "documents", label: "Documents" },
];

export default function ResidentCase({ residentId }: Props) {
  const [tab, setTab] = useState("overview");
  const resident = useQuery(api.kiosk.getResident, { residentId });
  const logView = useMutation(api.kiosk.logResidentView);

  useEffect(() => {
    if (resident) {
      logView({ residentId, tab });
    }
    // eslint-disable-next-line
  }, [residentId, tab]);

  if (resident === undefined) {
    return <div>Loading...</div>;
  }
  if (!resident) {
    return <div className="text-red-600">Not authorized or resident not found.</div>;
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1 rounded ${tab === t.key ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === "overview" && <OverviewTab resident={resident} />}
        {tab === "logs" && <LogsTab residentId={residentId} />}
        {tab === "isp" && <ISPTab residentId={residentId} />}
        {tab === "documents" && <DocumentsTab residentId={residentId} />}
      </div>
    </div>
  );
}

function OverviewTab({ resident }: { resident: any }) {
  // Only show minimal PHI: name, location
  return (
    <div>
      <div><b>Name:</b> {resident.name}</div>
      <div><b>Location:</b> {resident.location}</div>
      {/* Do not show folder/isp refs here */}
    </div>
  );
}

function LogsTab({ residentId }: { residentId: Id<"residents"> }) {
  const logs = useQuery(api.kiosk.listResidentLogs, { residentId }) || [];
  const canLog = useQuery(api.kiosk.canLogForResident, { residentId });
  const acknowledgeIsp = useMutation(api.kiosk.acknowledgeIsp);
  const createLog = useMutation(api.kiosk.createResidentLog);
  const editLog = useMutation(api.kiosk.editResidentLog);
  const user = useQuery(api.auth.loggedInUser);

  const [form, setForm] = useState({ mood: "", notes: "" });
  const [editingLogId, setEditingLogId] = useState<Id<"resident_logs"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Find latest log (highest version)
  const latestLog = logs.length > 0 ? logs[0] : null;

  const handleAcknowledge = async () => {
    setError(null);
    try {
      await acknowledgeIsp({ residentId });
    } catch (e: any) {
      setError(e.message || "Failed to acknowledge ISP.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!canLog) {
        setError("You must acknowledge the current ISP before submitting a log.");
        setSubmitting(false);
        return;
      }
      await createLog({
        residentId,
        template: "Daily Note",
        fields: { ...form },
      });
      setForm({ mood: "", notes: "" });
    } catch (e: any) {
      setError(e.message || "Failed to submit log.");
    }
    setSubmitting(false);
  };

  const handleEdit = async (logId: Id<"resident_logs">) => {
    setError(null);
    setSubmitting(true);
    try {
      await editLog({
        logId,
        fields: { ...form },
      });
      setEditingLogId(null);
      setForm({ mood: "", notes: "" });
    } catch (e: any) {
      setError(e.message || "Failed to edit log.");
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="mb-2">
        <b>Daily Log Template:</b> Mood, Notes
      </div>
      {user && residentId && !canLog && (
        <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded">
          <div>
            <b>ISP must be acknowledged before submitting a log.</b>
          </div>
          <button
            className="button mt-2"
            onClick={handleAcknowledge}
            disabled={submitting}
          >
            Acknowledge ISP
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
        <input
          className="border rounded px-2 py-1"
          placeholder="Mood"
          value={form.mood}
          onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
          disabled={submitting || !canLog}
        />
        <textarea
          className="border rounded px-2 py-1"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          disabled={submitting || !canLog}
        />
        <button
          className="button"
          type="submit"
          disabled={submitting || !canLog}
        >
          Submit Log
        </button>
        {error && <div className="text-red-600">{error}</div>}
      </form>
      <div>
        <b>Log History (latest first):</b>
        <ul className="text-xs mt-2">
          {logs.map((log: any) => (
            <li key={log._id} className="border-b py-2">
              <div>
                <b>v{log.version}</b> | <b>Author:</b> {log.authorName} |{" "}
                <b>Created:</b> {new Date(log.createdAt).toLocaleString()}
                {log.editedAt && (
                  <>
                    {" "}
                    | <b>Edited:</b> {new Date(log.editedAt).toLocaleString()}
                  </>
                )}
              </div>
              <div>
                <b>Mood:</b> {log.fields.mood} <br />
                <b>Notes:</b> {log.fields.notes}
              </div>
              {user && user._id === log.authorId && (
                <button
                  className="button mt-1"
                  onClick={() => {
                    setEditingLogId(log._id as Id<"resident_logs">);
                    setForm({ ...log.fields });
                  }}
                  disabled={submitting}
                >
                  Edit (new version)
                </button>
              )}
              {editingLogId === log._id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEdit(log._id as Id<"resident_logs">);
                  }}
                  className="flex flex-col gap-1 mt-2"
                >
                  <input
                    className="border rounded px-2 py-1"
                    placeholder="Mood"
                    value={form.mood}
                    onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
                    disabled={submitting}
                  />
                  <textarea
                    className="border rounded px-2 py-1"
                    placeholder="Notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    disabled={submitting}
                  />
                  <button className="button" type="submit" disabled={submitting}>
                    Save New Version
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => setEditingLogId(null)}
                  >
                    Cancel
                  </button>
                  {error && <div className="text-red-600">{error}</div>}
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <AuditTrail residentId={residentId} />
      </div>
    </div>
  );
}

function ISPTab({ residentId }: { residentId: Id<"residents"> }) {
  const user = useQuery(api.auth.loggedInUser);
  const currentIsp = useQuery(api.kiosk.getCurrentIsp, { residentId });
  const allIsps = useQuery(api.kiosk.listResidentIsps, { residentId });
  const listAcks = useQuery(api.kiosk.listIspAcknowledgments, { residentId });
  const authorIsp = useMutation(api.kiosk.authorIsp);
  const publishIsp = useMutation(api.kiosk.publishIsp);

  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSupervisorOrAdmin = user && (user.role === "admin" || user.role === "supervisor");

  const handleAuthor = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await authorIsp({ residentId, content });
      setContent("");
    } catch (e: any) {
      setError(e.message || "Failed to author ISP.");
    }
    setSubmitting(false);
  };

  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await publishIsp({ residentId });
    } catch (e: any) {
      setError(e.message || "Failed to publish ISP.");
    }
    setSubmitting(false);
  };

  return (
    <div>
      <b>Current ISP:</b>
      {currentIsp ? (
        <div className="border p-2 rounded mb-2">
          <div><b>Content:</b> {currentIsp.content}</div>
          <div>
            <b>Published:</b> {currentIsp.published ? "Yes" : "No"} | <b>Due:</b>{" "}
            {currentIsp.dueAt ? new Date(currentIsp.dueAt).toLocaleDateString() : "N/A"}
          </div>
        </div>
      ) : (
        <div className="text-gray-400">No published ISP.</div>
      )}
      {isSupervisorOrAdmin && (
        <div className="mb-4">
          <textarea
            className="border rounded px-2 py-1 w-full"
            placeholder="Draft ISP content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
          />
          <button className="button mt-2" onClick={handleAuthor} disabled={submitting || !content}>
            Save Draft
          </button>
          <button className="button mt-2 ml-2" onClick={handlePublish} disabled={submitting}>
            Publish Latest Draft
          </button>
          {error && <div className="text-red-600">{error}</div>}
        </div>
      )}
      {isSupervisorOrAdmin && (
        <div>
          <b>Acknowledgment Status:</b>
          <ul className="text-xs mt-1">
            {listAcks && listAcks.length > 0 ? (
              listAcks.map((ack: any) => (
                <li key={ack.userId}>
                  User: {ack.userId} - {ack.acknowledged ? "Acknowledged" : "Not acknowledged"}
                  {ack.acknowledgedAt && (
                    <> at {new Date(ack.acknowledgedAt).toLocaleString()}</>
                  )}
                </li>
              ))
            ) : (
              <li>No staff or no acknowledgments yet.</li>
            )}
          </ul>
        </div>
      )}
      {allIsps && allIsps.length > 0 && (
        <div className="mt-4">
          <b>ISP History:</b>
          <ul className="text-xs mt-1">
            {allIsps.map((isp: any) => (
              <li key={isp._id}>
                v{isp.version} | {isp.published ? "Published" : "Draft"} |{" "}
                {new Date(isp.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ residentId }: { residentId: Id<"residents"> }) {
  const docs = useQuery(api.kiosk.listResidentDocuments, { residentId });
  const getUrl = useMutation(api.kiosk.getResidentDocumentUrl);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (fileId: string) => {
    setDownloading(fileId);
    try {
      const url = await getUrl({ fileId, residentId });
      if (url) window.open(url as string, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert("Download failed.");
    }
    setDownloading(null);
  };

  if (docs === undefined) return <div>Loading documents...</div>;
  if (!docs.length) return <div>No documents found.</div>;
  return (
    <ul>
      {docs.map((doc: any) => (
        <li key={doc._id} className="flex items-center gap-2">
          <span>{doc.description || doc.fileId}</span>
          <button
            className="button"
            onClick={() => handleDownload(doc.fileId)}
            disabled={downloading === doc.fileId}
          >
            {downloading === doc.fileId ? "Preparing..." : "Download"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Show audit trail for log actions
function AuditTrail({ residentId }: { residentId: Id<"residents"> }) {
  const logs = useQuery(api.kiosk.getResidentAuditTrail, { residentId }) || [];
  if (!logs.length) return null;
  return (
    <div>
      <b>Audit Trail:</b>
      <ul className="text-xs mt-1">
        {logs.map((log: any) => (
          <li key={log._id}>
            {new Date(log.timestamp).toLocaleString()} - {log.event}{" "}
            {log.details && <span>({log.details})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
