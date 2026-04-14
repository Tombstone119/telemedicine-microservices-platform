import React, { useMemo, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

type Message = { id: number; role: 'user' | 'ai'; text: string };

const quickSymptoms = ['Fever', 'Headache', 'Cough', 'Stomach pain', 'Rash', 'Dizziness'];

function generateResponse(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('fever') || lower.includes('cough')) return 'Based on these symptoms, it may be an infection or flu-like condition. Please monitor temperature and hydration.';
  if (lower.includes('headache') || lower.includes('dizziness')) return 'This could be related to fatigue, stress, dehydration, or blood pressure changes. Consider rest and hydration.';
  if (lower.includes('rash')) return 'A skin reaction or allergy is possible. Avoid new products and consult a dermatologist if it spreads.';
  if (lower.includes('stomach')) return 'This may be digestive irritation, food sensitivity, or infection. Stay hydrated and observe severity.';
  return 'Please share more symptoms, duration, and severity so I can give a better suggestion.';
}

export default function SymptomChecker() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'ai', text: 'Hello, I am your symptom assistant. Describe how you feel, and I will suggest possible next steps.' },
  ]);
  const [input, setInput] = useState('');
  const [severity, setSeverity] = useState(3);

  const suggestions = useMemo(() => quickSymptoms, []);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', text },
      { id: Date.now() + 1, role: 'ai', text: generateResponse(text) },
    ]);
    setInput('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="flex min-h-[70vh] flex-col">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-bold text-black">AI Symptom Checker</h2>
          <p className="mt-1 text-sm text-slate-600">This assistant is for guidance only and does not replace a doctor.</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={['flex', message.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}>
              <div className={['max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm', message.role === 'user' ? 'bg-[#107393] text-white' : 'bg-slate-100 text-slate-800'].join(' ')}>
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} type="button" onClick={() => sendMessage(item)} className="rounded-full bg-[#107393]/5 px-3 py-2 text-sm font-medium text-[#107393] transition-all duration-200 hover:bg-[#107393]/10">
                {item}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage(input)} placeholder="Describe your symptoms..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
            <Button onClick={() => sendMessage(input)}>Send</Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-bold text-black">Severity</h3>
          <p className="mt-1 text-sm text-slate-600">Rate how serious it feels right now.</p>
          <input type="range" min="1" max="5" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="mt-4 w-full accent-[#107393]" />
          <div className="mt-2 text-sm text-slate-600">Level {severity} of 5</div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-black">Suggested next steps</h3>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            <li>• Rest, hydrate, and track symptom changes.</li>
            <li>• If severe pain, shortness of breath, or chest pain occurs, seek urgent care.</li>
            <li>• Book the right specialty after symptom analysis.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

