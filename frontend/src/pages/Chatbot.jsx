import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { Send } from "lucide-react";
import { api } from "../api/client";

export default function Chatbot() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    const userMessage = message;
    setChat((items) => [...items, { role: "user", text: userMessage }]);
    setMessage("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", { message: userMessage });
      setChat((items) => [...items, { role: "assistant", text: data.answer, sources: data.sources }]);
    } catch {
      setChat((items) => [...items, { role: "assistant", text: "I could not reach the medical info agent. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel flex h-[calc(100vh-150px)] flex-col overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-black">Medical Info RAG Agent</h2>
        <p className="text-sm text-slate-600">Answers are grounded in the configured medical knowledge base.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {chat.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`max-w-3xl rounded-md p-3 ${item.role === "user" ? "ml-auto bg-brand text-white" : "bg-slate-100 text-slate-800"}`}>
            <p className="text-sm leading-6">{item.text}</p>
            {item.sources && <p className="mt-2 text-xs text-slate-500">{item.sources.length} retrieved source chunks</p>}
          </div>
        ))}
        {loading && <p className="text-sm font-semibold text-slate-500">Generating response...</p>}
      </div>
      <div className="flex gap-3 border-t border-slate-200 p-4">
        <TextField fullWidth size="small" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about symptoms, care guidance, or red flags" />
        <Button variant="contained" onClick={send} startIcon={<Send size={16} />}>Send</Button>
      </div>
    </section>
  );
}
