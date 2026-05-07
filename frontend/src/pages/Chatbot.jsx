import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { BotMessageSquare, Send, Sparkles } from "lucide-react";
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
      setChat((items) => [...items, { role: "assistant", text: data.reply || data.answer, sources: data.sources }]);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setChat((items) => [...items, { role: "assistant", text: detail || "I could not reach the medical info agent. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel flex h-[calc(100vh-150px)] flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-gradient-to-r from-white via-teal-50 to-purple-50 p-5">
        <div className="section-title">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-purple-600 text-white shadow-lg shadow-purple-900/20"><BotMessageSquare size={22} /></span>
          <div>
            <h2 className="text-xl font-black">Medical Info RAG Agent</h2>
            <p className="text-sm text-slate-600">Answers are grounded in the configured medical knowledge base.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {chat.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`max-w-3xl rounded-lg p-3 shadow-sm ${item.role === "user" ? "ml-auto bg-blue-600 text-white shadow-blue-900/10" : "bg-gradient-to-r from-teal-50 to-purple-50 text-slate-800 ring-1 ring-purple-100"}`}>
            <p className="text-sm leading-6">{item.text}</p>
            {item.sources && <p className="mt-2 text-xs text-slate-500">{item.sources.length} retrieved source chunks</p>}
          </div>
        ))}
        {loading && <p className="inline-flex items-center gap-2 text-sm font-bold text-purple-700"><Sparkles size={16} />Generating response...</p>}
      </div>
      <div className="flex gap-3 border-t border-slate-200 bg-white/90 p-4">
        <TextField fullWidth size="small" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about symptoms, care guidance, or red flags" />
        <Button variant="contained" onClick={send} startIcon={<Send size={16} />}>Send</Button>
      </div>
    </section>
  );
}
