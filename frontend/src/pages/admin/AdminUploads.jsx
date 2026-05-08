import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { api } from "../../api/client";

export default function AdminUploads() {
  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const load = () => api.get("/admin/rag-documents").then(({ data }) => setRows(data)).catch(() => setRows([]));

  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    if (!file) return;
    setStatus("Uploading and indexing document...");
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post("/admin/rag-documents", form, { headers: { "Content-Type": "multipart/form-data" } });
      setFile(null);
      setStatus("Document indexed for the RAG assistant.");
      load();
    } catch (error) {
      setStatus(error.response?.data?.detail || "Upload failed.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this uploaded document?")) return;
    await api.delete(`/admin/rag-documents/${id}`);
    load();
  };

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="mb-4 section-title">
          <span className="icon-badge-soft"><UploadCloud size={18} /></span>
          <h2 className="text-lg font-black">RAG Assistant Documents</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            <input className="hidden" type="file" accept=".pdf,.txt,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {file ? file.name : "Choose PDF, TXT, or DOCX"}
          </label>
          <Button variant="contained" startIcon={<UploadCloud size={17} />} onClick={upload} disabled={!file}>Upload</Button>
        </div>
        {status && <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p>}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">File</th>
                <th className="p-3">Type</th>
                <th className="p-3">Size</th>
                <th className="p-3">Chunks</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="p-3"><div className="flex items-center gap-2 font-bold"><FileText size={16} />{row.filename}</div></td>
                  <td className="p-3">{row.content_type || "-"}</td>
                  <td className="p-3">{Math.round((row.size_bytes || 0) / 1024)} KB</td>
                  <td className="p-3">{row.chunk_count}</td>
                  <td className="p-3">{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                  <td className="p-3"><Button size="small" color="error" variant="outlined" onClick={() => remove(row._id)}><Trash2 size={15} /></Button></td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-4 text-slate-500" colSpan="6">No uploaded documents yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
