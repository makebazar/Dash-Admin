"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Mic, 
  Square, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Smile, 
  Meh, 
  Frown, 
  Sparkles, 
  Settings,
  Volume2,
  ShieldCheck,
  XCircle,
  Star,
  TrendingUp,
  Coins
} from "lucide-react";

interface DialogueMessage {
  speaker: "Администратор" | "Клиент";
  text: string;
}

interface ScriptCheck {
  greeting: boolean;
  client_identification: boolean;
  offered_zones_or_promos: boolean;
  checked_balance_or_account: boolean;
  named_price: boolean;
  took_payment: boolean;
  farewell: boolean;
}

interface AnalysisResult {
  summary: string;
  sentiment: "neutral" | "positive" | "conflict";
  has_complaints: boolean;
  compliance: string;
  client_type?: "new" | "regular" | "unknown";
  admin_score?: number;
  script_check?: ScriptCheck;
  missed_steps?: string[];
  sales_style?: "active_sales" | "passive_service" | "poor_service";
  sales_analysis?: string;
  lost_opportunities?: string[];
  dialogue?: DialogueMessage[];
}

export default function VoiceTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "transcribing" | "analyzing" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcription, setTranscription] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasMedia = !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setIsSupported(hasMedia);
      if (!hasMedia) {
        setErrorMessage("Запись звука не поддерживается в данном браузере или заблокирована из-за небезопасного контекста (нужен HTTPS).");
        setStatus("error");
      }
    }
  }, []);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio visualization refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Audio Visualizer Canvas Loop
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#090d1f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        // Use custom glowing indigo/violet gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#4f46e5");
        gradient.addColorStop(1, "#c084fc");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    draw();
  };

  // Start Audio Recording
  const startRecording = async () => {
    try {
      setErrorMessage("");
      setTranscription("");
      setAnalysis(null);
      audioChunksRef.current = [];

      // Audio Context must be initialized synchronously in click handler to satisfy Safari mobile security policy
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 64; // Small size for simple bars
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      // Set up media recorder with high-quality bitrate
      const options = { 
        mimeType: "audio/webm",
        audioBitsPerSecond: 128000 // 128 kbps
      };
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        // Fallback for browsers that don't support webm audio
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Slice every 250ms

      setIsRecording(true);
      setStatus("recording");

      // Start visualization drawing
      setTimeout(() => {
        drawVisualizer();
      }, 100);

    } catch (err: any) {
      console.error("Microphone access denied or error:", err);
      setErrorMessage("Доступ к микрофону отклонен или микрофон не подключен.");
      setStatus("error");
    }
  };

  // Stop Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Process recorded audio file on backend
  const processAudio = async (audioBlob: Blob) => {
    setStatus("uploading");
    
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "record.webm");

      setStatus("transcribing"); // Whisper process
      
      const response = await fetch("/api/debug/voice-process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = `HTTP error! Status: ${response.status}`;
        try {
          const errText = await response.text();
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errMsg;
          } catch {
            errMsg = errText || errMsg;
          }
        } catch {}
        throw new Error(errMsg);
      }

      setStatus("analyzing"); // Ollama process
      
      const data = await response.json();
      setTranscription(data.transcription);
      setAnalysis(data.analysis);
      setStatus("done");
      
    } catch (err: any) {
      console.error("Audio processing error:", err);
      setErrorMessage(err.message || "Ошибка во время распознавания аудио.");
      setStatus("error");
    }
  };

  // Helper formatting for timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#070a1e] text-slate-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs text-indigo-300 font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Лаборатория / Локальный Тест ИИ
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
            Интеллектуальная Запись Ресепшена
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Локальная транскрипция разговора администратора и гостя через <code className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded">Whisper.cpp</code> и умный анализ через <code className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded">Ollama</code> на процессоре.
          </p>
        </div>

        {/* Recording Panel */}
        <div className="bg-[#0b0f2a] border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          
          <div className="flex flex-col items-center space-y-2">
            <div className={`text-4xl font-mono tracking-widest ${isRecording ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
              {formatTime(recordingTime)}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              {isRecording ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" /> Идет запись звука...
                </>
              ) : (
                "Микрофон готов к работе"
              )}
            </div>
          </div>

          {/* Visualizer Canvas */}
          <div className="w-full h-20 bg-[#090d1f] rounded-lg border border-slate-800 overflow-hidden relative">
            {!isRecording && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600 gap-2">
                <Volume2 className="w-4 h-4" /> Начните говорить для отображения звука
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              className="w-full h-full" 
              width={600} 
              height={80}
            />
          </div>

          <div className="flex gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={!isSupported || status === "uploading" || status === "transcribing" || status === "analyzing"}
                className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium px-8 py-3.5 rounded-full shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
              >
                <Mic className="w-5 h-5 animate-pulse" /> Начать запись
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-medium px-8 py-3.5 rounded-full shadow-lg shadow-red-600/20 hover:shadow-red-500/40 transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
              >
                <Square className="w-5 h-5" /> Остановить и обработать
              </button>
            )}
          </div>
        </div>

        {/* Processing State Tracker */}
        {status !== "idle" && (
          <div className="bg-[#0b0f2a] border border-slate-800/80 rounded-xl p-5 flex flex-col md:flex-row justify-around gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status === "recording" ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
              <span className={status === "recording" ? "text-red-400" : "text-slate-400"}>1. Запись с микрофона</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status === "uploading" ? "bg-indigo-400 animate-pulse" : (["transcribing", "analyzing", "done"].includes(status) ? "bg-emerald-500" : "bg-slate-700")}`} />
              <span className={status === "uploading" ? "text-indigo-400 font-bold" : "text-slate-400"}>2. Конвертация (ffmpeg)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status === "transcribing" ? "bg-indigo-400 animate-pulse animate-duration-1000" : (["analyzing", "done"].includes(status) ? "bg-emerald-500" : "bg-slate-700")}`} />
              <span className={status === "transcribing" ? "text-indigo-400 font-bold" : "text-slate-400"}>3. Расшифровка (Whisper)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status === "analyzing" ? "bg-indigo-400 animate-pulse" : (status === "done" ? "bg-emerald-500" : "bg-slate-700")}`} />
              <span className={status === "analyzing" ? "text-indigo-400 font-bold" : "text-slate-400"}>4. ИИ-Анализ (Ollama)</span>
            </div>
          </div>
        )}

        {/* Errors display */}
        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <div>
              <div className="font-semibold">Что-то пошло не так:</div>
              <div className="mt-1 opacity-90">{errorMessage}</div>
              <div className="mt-3 text-xs opacity-75 leading-relaxed bg-black/20 p-2.5 rounded border border-red-500/10">
                Убедитесь, что в <code className="bg-slate-800 text-slate-100 px-1 py-0.5 rounded">.env.local</code> прописаны правильные пути к `whisper.exe` и модели, а служба Ollama запущена локально на порту 11434.
              </div>
            </div>
          </div>
        )}

        {/* Loader Overlay when analyzing */}
        {(status === "transcribing" || status === "analyzing") && (
          <div className="bg-[#0b0f2a]/90 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center space-y-4 shadow-xl">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <div className="text-center">
              <h3 className="font-semibold text-slate-200">
                {status === "transcribing" ? "Идет расшифровка разговора..." : "ИИ анализирует диалог..."}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Это выполняется локально на вашем процессоре (CPU) и может занять от 10 до 30 секунд в зависимости от длины записи.
              </p>
            </div>
          </div>
        )}

        {/* Done / Results Section */}
        {status === "done" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition duration-300 ease-in-out">
            
            {/* Transcription Box */}
            <div className="bg-[#0b0f2a] border border-slate-800 rounded-2xl p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">
                  {analysis?.dialogue && analysis.dialogue.length > 0 ? "Разбор диалога по ролям" : "Распознанный текст (ASR)"}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {analysis?.dialogue && analysis.dialogue.length > 0 ? (
                  analysis.dialogue.map((msg, index) => {
                    const isAdmin = msg.speaker === "Администратор";
                    return (
                      <div 
                        key={index}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="text-[10px] text-slate-500 mb-1 px-1 font-semibold uppercase tracking-wider">
                          {msg.speaker}
                        </div>
                        <div 
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-md leading-relaxed ${
                            isAdmin 
                              ? "bg-indigo-600 text-white rounded-tr-none" 
                              : "bg-[#141b43] text-slate-200 rounded-tl-none border border-slate-800"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                    {transcription || "Речь не была распознана."}
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Box */}
            <div className="bg-[#0b0f2a] border border-slate-800 rounded-2xl p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Локальный ИИ-Анализ</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                
                {/* Summary */}
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Саммари разговора:</div>
                  <p className="text-sm text-slate-200 bg-[#090d1f] p-3.5 rounded-xl border border-slate-800 leading-relaxed">
                    {analysis?.summary}
                  </p>
                </div>

                {/* Sentiment & Complaints Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Настроение:</div>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border font-medium justify-center ${
                      analysis?.sentiment === "positive" 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : analysis?.sentiment === "conflict"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-slate-500/10 border-slate-500/30 text-slate-300"
                    }`}>
                      {analysis?.sentiment === "positive" && <Smile className="w-4 h-4" />}
                      {analysis?.sentiment === "neutral" && <Meh className="w-4 h-4" />}
                      {analysis?.sentiment === "conflict" && <Frown className="w-4 h-4" />}
                      <span className="capitalize">{analysis?.sentiment === "positive" ? "Позитивное" : analysis?.sentiment === "conflict" ? "Конфликт" : "Нейтральное"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Жалобы клиента:</div>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border font-medium justify-center ${
                      analysis?.has_complaints 
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      {analysis?.has_complaints ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Обнаружены</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Нет жалоб</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compliance */}
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Общая вежливость и тон:</div>
                  <p className="text-sm text-slate-300 bg-[#090d1f] p-3.5 rounded-xl border border-slate-800 leading-relaxed font-sans">
                    {analysis?.compliance}
                  </p>
                </div>

              </div>
            </div>
            
          </div>
        )}

        {/* Admin Scorecard */}
        {status === "done" && analysis?.admin_score !== undefined && (
          <div className="bg-[#0b0f2a] border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-slate-800 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Оценка работы администратора</h3>
              </div>
              {analysis.client_type && (
                <div>
                  {analysis.client_type === "new" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
                      👤 Новый клиент
                    </span>
                  )}
                  {analysis.client_type === "regular" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
                      ⭐ Постоянный клиент
                    </span>
                  )}
                  {analysis.client_type === "unknown" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700/30 border border-slate-700/50 text-slate-400">
                      Неизвестный статус
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              {/* Score ring */}
              <div className={`relative flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-4 ${
                (analysis.admin_score ?? 0) >= 8 ? "border-emerald-500 bg-emerald-500/10" :
                (analysis.admin_score ?? 0) >= 5 ? "border-amber-500 bg-amber-500/10" :
                "border-red-500 bg-red-500/10"
              }`}>
                <div className="text-center">
                  <div className={`text-2xl font-black ${
                    (analysis.admin_score ?? 0) >= 8 ? "text-emerald-400" :
                    (analysis.admin_score ?? 0) >= 5 ? "text-amber-400" :
                    "text-red-400"
                  }`}>{analysis.admin_score}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">из 10</div>
                </div>
              </div>
 
              {/* Compliance text */}
              <div className="flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1.5">Комментарий:</div>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.compliance}</p>
              </div>
            </div>
 
            {/* Script checklist */}
            {analysis.script_check && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Чеклист скрипта:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {([
                    { key: "greeting",                   label: "Приветствие" },
                    { key: "client_identification",       label: "Идентификация" },
                    { key: "offered_zones_or_promos",     label: "Предложил зоны/акции" },
                    { key: "checked_balance_or_account",  label: "Баланс/Аккаунт" },
                    { key: "named_price",                 label: "Назвал цену" },
                    { key: "took_payment",                label: "Провёл оплату" },
                    { key: "farewell",                    label: "Попрощался" },
                  ] as { key: keyof ScriptCheck; label: string }[]).map(({ key, label }) => {
                    const done = analysis.script_check![key];
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
                          done
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}
                      >
                        {done
                          ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sales Style badge */}
            {analysis.sales_style && (
              <div className="flex items-center gap-3 border-t border-slate-800/50 pt-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Стиль обслуживания:</div>
                {analysis.sales_style === "active_sales" && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Активные продажи (Администратор ПРОДАЕТ)
                  </span>
                )}
                {analysis.sales_style === "passive_service" && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold">
                    <Meh className="w-3.5 h-3.5" />
                    Пассивное обслуживание (Администратор как КАССИР)
                  </span>
                )}
                {analysis.sales_style === "poor_service" && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-red-500/10 border-red-500/30 text-red-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Слабое обслуживание
                  </span>
                )}
              </div>
            )}

            {/* Sales Analysis text */}
            {analysis.sales_analysis && (
              <div className="space-y-1.5 border-t border-slate-800/50 pt-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Анализ навыков продаж:
                </div>
                <p className="text-sm text-slate-300 leading-relaxed bg-[#090d1f]/60 p-3 rounded-xl border border-slate-800/40">
                  {analysis.sales_analysis}
                </p>
              </div>
            )}

            {/* Lost Opportunities */}
            {analysis.lost_opportunities && analysis.lost_opportunities.length > 0 && (
              <div className="space-y-2 border-t border-slate-800/50 pt-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" /> Упущенная выручка (Как увеличить средний чек):
                </div>
                <ul className="space-y-2">
                  {analysis.lost_opportunities.map((opp, i) => (
                    <li key={i} className="text-xs text-amber-300 flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missed steps */}
            {analysis.missed_steps && analysis.missed_steps.length > 0 && (
              <div className="space-y-2 border-t border-slate-800/50 pt-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Что пропустил по скрипту:
                </div>
                <ul className="space-y-1 pl-1">
                  {analysis.missed_steps.map((step, i) => (
                    <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400/70 flex-shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Environment setup card */}
        <div className="bg-[#0b0f2a]/60 border border-slate-800/50 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Settings className="w-4 h-4" />
            <h4 className="font-bold text-xs uppercase tracking-wider">Инструкция по настройке окружения</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Для работы этого теста необходимо прописать настройки локальных путей в файле <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded font-mono">.env.local</code> в корне проекта. Пример заполнения:
          </p>
          <pre className="bg-[#090d1f] border border-slate-800 p-4 rounded-xl text-[11px] text-slate-300 overflow-x-auto font-mono leading-relaxed">
{`WHISPER_BIN_PATH="C:\\\\whisper\\\\whisper.exe"
WHISPER_MODEL_PATH="C:\\\\whisper\\\\models\\\\ggml-small-q5_1.bin"
OLLAMA_API_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5:3b-instruct"`}
          </pre>
          <div className="flex gap-2 text-[10px] text-slate-500 items-start">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80 flex-shrink-0 mt-0.5" />
            <span>
              Обратите внимание, что пути в Windows пишутся с двойными обратными слэшами (<code className="bg-slate-800 px-1 py-0.5 rounded">\\\\</code>) в конфигурационном файле, чтобы они корректно считывались в Node.js.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
