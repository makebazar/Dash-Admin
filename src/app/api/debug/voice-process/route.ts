import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

const unlinkSafe = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[VoiceProcess] Failed to delete temp file: ${filePath}`, err);
  }
};

/** Extract first valid JSON object from LLM response (brace-counting, handles nesting). */
function extractJson(raw: string): any {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

interface WhisperSegment {
  offsets: { from: number; to: number }; // milliseconds
  text: string;
}

/**
 * Parse GigaAM JSON output and format segments with pause markers.
 * Gaps > PAUSE_THRESHOLD between segments are marked as [пауза Xs].
 */
function formatSegmentsForLLM(data: any): { formatted: string; plainText: string } {
  // GigaAM JSON schema: { transcription: [{ offsets: {from, to}, text }] }
  const segments: WhisperSegment[] = data.transcription ?? [];
  const PAUSE_THRESHOLD_MS = 1000; // 1 second

  const lines: string[] = [];
  const plainParts: string[] = [];
  let prevEndMs = 0;

  for (const seg of segments) {
    const startMs = seg.offsets?.from ?? 0;
    const endMs   = seg.offsets?.to   ?? startMs;
    const text = seg.text.trim();
    if (!text) continue;

    const gapMs = startMs - prevEndMs;
    if (lines.length > 0 && gapMs >= PAUSE_THRESHOLD_MS) {
      lines.push(`[пауза ${(gapMs / 1000).toFixed(1)}с]`);
    }

    lines.push(`[${(startMs / 1000).toFixed(1)}с] ${text}`);
    plainParts.push(text);
    prevEndMs = endMs;
  }

  return {
    formatted: lines.join("\n"),
    plainText: plainParts.join(" "),
  };
}

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const ollamaUrl    = process.env.OLLAMA_API_URL     || "http://127.0.0.1:11434";
    const ollamaModel  = process.env.OLLAMA_MODEL       || "qwen2.5:7b-instruct";

    let tempDir = os.tmpdir();
    if (process.platform === "win32") {
      tempDir = "C:\\temp";
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    }

    const ts       = Date.now();
    const inputExt = path.extname(audioFile.name) || ".webm";
    const inputPath  = path.join(tempDir, `vi_${ts}${inputExt}`);
    const wavPath    = path.join(tempDir, `vi_${ts}.wav`);
    tempFiles.push(inputPath, wavPath);

    fs.writeFileSync(inputPath, Buffer.from(await audioFile.arrayBuffer()));

    // ── Step 1: ffmpeg → 16kHz mono WAV ─────────────────────────────────────
    if (!ffmpegPath) throw new Error("ffmpeg-static binary not found");
    console.log("[VoiceProcess] Converting audio…");
    await execFileAsync(ffmpegPath, [
      "-y", "-i", inputPath,
      "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
      wavPath
    ]);

    // ── Step 2: Sber GigaAM ASR (Python ONNX script) ─────────────────────────
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const pythonBin = path.join(localAppData, "Programs", "Python", "Python312", "python.exe");
    const scriptPath = path.join(process.cwd(), "scripts", "gigaam_transcribe.py");
    const outJsonPath = path.join(tempDir, `vo_giga_${ts}.json`);
    tempFiles.push(outJsonPath);

    if (!fs.existsSync(pythonBin)) {
      throw new Error(`Python executable not found at: ${pythonBin}`);
    }
    console.log("[VoiceProcess] Running Sber GigaAM ASR via Python...");
    
    await execFileAsync(pythonBin, [scriptPath, wavPath, outJsonPath]);

    if (!fs.existsSync(outJsonPath)) {
      throw new Error("GigaAM transcription completed but output JSON was not created");
    }

    const jsonRaw = fs.readFileSync(outJsonPath, "utf-8");
    const jsonOutput = JSON.parse(jsonRaw);

    // dialogue is generated inside Python with original words word-for-word
    const originalDialogue = jsonOutput.dialogue ?? [];
    const timedTranscript = jsonOutput.timed_transcript ?? "";
    const transcription = originalDialogue.map((d: any) => d.text).join(" ");

    console.log(`[VoiceProcess] Timed Transcript:\n${timedTranscript}`);

    if (!transcription) {
      return NextResponse.json({
        transcription: "",
        analysis: {
          summary: "Диалог не содержит разборчивой речи или слишком тихий.",
          sentiment: "neutral",
          has_complaints: false,
          compliance: "Не применимо (нет речи)",
          dialogue: []
        }
      });
    }

    // ── Step 3: Cloud Multi-Agent Analysis (OpenRouter) ──────────────────────
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    if (!openRouterKey) {
      throw new Error("OPENROUTER_API_KEY is not configured in .env.local");
    }

    console.log(`[VoiceProcess] Running Cloud Multi-Agent Pipeline (${openRouterModel})…`);
    const analysisResult = await runAgentPipeline(timedTranscript, openRouterKey, openRouterModel);

    console.log("[VoiceProcess] Done:", JSON.stringify(analysisResult, null, 2));
    return NextResponse.json({ transcription, analysis: analysisResult });

  } catch (error: any) {
    console.error("[VoiceProcess] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    tempFiles.forEach(unlinkSafe);
  }
}

// ── Multi-Agent Pipeline Implementation ──────────────────────────────────────

async function runAgentPipeline(
  rawTranscript: string, 
  apiKey: string,
  baseModelName: string // Used as a fallback or configuration override if needed
): Promise<any> {
  
  // Model routing configuration
  const DIARIZER_MODEL = "google/gemini-2.5-flash";
  const AUDITOR_MODEL   = "google/gemini-2.5-flash";
  const COACH_MODEL     = "google/gemini-2.5-pro";

  // --- Agent 1: Diarizer & Editor Agent ---
  console.log(`[AgentPipeline] Running Agent 1 (Diarizer) using ${DIARIZER_MODEL}...`);
  const diarizerPrompt = `
  Ты — профессиональный ИИ-ассистент по диаризации и форматированию устной речи.
  Твоя задача — взять неотформатированную транскрипцию разговора с временными метками и разделить ее на диалог между двумя спикерами: «Администратор» (сотрудник клуба) и «Клиент» (посетитель).
  
  Ориентиры для спикеров:
  - Администратор здоровается, предлагает свободные зоны (стандарт, про, VIP, bootcamp), озвучивает цены и пакеты времени, ищет или создает аккаунты, предлагает акции (пополнение баланса, бонусы), предлагает напитки/еду (бар), принимает оплату и прощается.
  - Клиент спрашивает, что свободно, выбирает компьютеры/зоны, просит посадить на определенное время, диктует свои контакты (номер или ник), платит, соглашается или отказывается от доп. услуг.
  
  Пример работы:
  Входной текст:
  "[1.2с] здорово какие зоны свободны сейчас привет сейчас свободно стандарт и про давай про на три часа сколько стоит это будет стоить триста рублей ник какой у тебя ник nagibator"
  
  Выходной JSON:
  {
    "dialogue": [
      { "speaker": "Клиент", "text": "Здорово! Какие зоны свободны сейчас?" },
      { "speaker": "Администратор", "text": "Привет! Сейчас свободны стандарт и про." },
      { "speaker": "Клиент", "text": "Давай про на три часа. Сколько стоит?" },
      { "speaker": "Администратор", "text": "Это будет стоить триста рублей. Ник какой у тебя?" },
      { "speaker": "Клиент", "text": "Ник nagibator." }
    ]
  }
  
  Правила:
  - Расставь правильные знаки препинания (точки, запятые, знаки вопроса) и заглавные буквы.
  - Исправь опечатки русской речи.
  - Будь чрезвычайно внимателен к логике диалога: Клиент спрашивает -> Администратор отвечает. Администратор предлагает бар -> Клиент соглашается или отказывается. Не путай их реплики местами!
  
  Входной текст для обработки:
  """
  ${rawTranscript}
  """
  
  Верни строго валидный JSON по указанной схеме.
  `;

  const diagResponse = await callOpenRouter(diarizerPrompt, apiKey, DIARIZER_MODEL);
  const diagData = extractJson(diagResponse);
  if (!diagData || !diagData.dialogue) {
    throw new Error("Agent 1 (Diarizer) failed to produce a valid dialogue list.");
  }
  const cleanDialogue = diagData.dialogue;
  const dialogueString = cleanDialogue.map((d: any) => `${d.speaker}: ${d.text}`).join("\n");

  // --- Agent 2: QA Script Auditor Agent ---
  console.log(`[AgentPipeline] Running Agent 2 (Script Auditor) using ${AUDITOR_MODEL}...`);
  const auditorPrompt = `
  Ты — строгий ИИ-менеджер по качеству сервиса в компьютерном клубе.
  Твоя задача — проанализировать готовый диалог и оценить соблюдение регламента.
  
  Инструкции:
  1. Определи тип клиента (client_type):
     — "new" (Новый): если это первый визит клиента в клуб, у него нет аккаунта, или админ регистрирует его профиль.
     — "regular" (Постоянный): если у клиента уже есть профиль в клубе, он называет никнейм или номер телефона, или админ проверяет баланс.
     — "unknown" (Неизвестно): если по диалогу невозможно определить.
     
  2. Проверь выполнение чеклиста скрипта (script_check):
     — greeting (поздоровался с клиентом)
     — client_identification (уточнил «впервые у нас?» для нового ИЛИ спросил ник/телефон для постоянного)
     — checked_balance_or_account (создал/зарегистрировал профиль новому ИЛИ назвал баланс постоянному)
     — offered_zones_or_promos (предложил и объяснил разницу зон новому ИЛИ предложил актуальные акции/пакеты постояльцу)
     — named_price (четко назвал сумму к оплате)
     — took_payment (провел оплату)
     — farewell (пожелал хорошей игры / попрощался)
     
  3. Составь missed_steps (список конкретных шагов скрипта, которые админ пропустил).
  4. Напиши compliance (оценка тона общения и вежливости администратора).
  
  Диалог для анализа:
  """
  ${dialogueString}
  """
  
  Верни строго валидный JSON по следующей схеме:
  {
    "client_type": "new | regular | unknown",
    "summary": "краткое содержание разговора 1-2 предложения",
    "sentiment": "neutral | positive | conflict",
    "has_complaints": true | false,
    "compliance": "краткая оценка тона и вежливости",
    "script_check": {
      "greeting": true,
      "client_identification": true,
      "offered_zones_or_promos": false,
      "checked_balance_or_account": true,
      "named_price": true,
      "took_payment": true,
      "farewell": false
    },
    "missed_steps": ["список пропущенных действий"]
  }
  `;

  const auditResponse = await callOpenRouter(auditorPrompt, apiKey, AUDITOR_MODEL);
  const auditData = extractJson(auditResponse);
  if (!auditData) {
    throw new Error("Agent 2 (Script Auditor) failed to analyze the dialogue.");
  }

  // --- Agent 3: Sales Coach Agent ---
  console.log(`[AgentPipeline] Running Agent 3 (Sales Coach) using ${COACH_MODEL}...`);
  const coachPrompt = `
  Ты — ведущий Бизнес-Тренер по продажам в компьютерных клубах.
  Твоя задача — оценить коммерческую эффективность администратора: продает ли он услуги активно или просто пассивно отпускает время («кассир»).
  
  Инструкции:
  1. Оцени стиль обслуживания (sales_style):
     — "active_sales" (Активные продажи): администратор взял инициативу, предложил лучшую/дорогую зону, рассказал о выгоде пакетов времени или об акциях, предложил доп. услуги (напитки, еду).
     — "passive_service" (Пассивный кассир): администратор вежлив, но делает только то, о чем попросил клиент. Не предлагает альтернатив, не рассказывает про акции.
     — "poor_service" (Слабое обслуживание): грубит, игнорирует клиента, не соблюдает вежливость.
     
  2. Напиши подробный sales_analysis (разбор: почему присвоен этот стиль, насколько уверенно и грамотно вел беседу администратор).
  3. Составь lost_opportunities (конкретный список упущенной выгоды. Что именно мог предложить админ в этом разговоре, чтобы поднять средний чек? Например: «мог предложить пакет 5 часов вместо 3», «не предложил напитки/еду во время оплаты», «не рассказал про преимущества Bootcamp»).
  4. Поставь общую оценку работы администратора (admin_score) от 1 до 10 на основе сервиса и навыков продаж.
  
  Диалог:
  """
  ${dialogueString}
  """
  
  Аудит соблюдения скрипта:
  ${JSON.stringify(auditData.script_check)}
  Пропущенные шаги: ${JSON.stringify(auditData.missed_steps)}
  
  Верни строго валидный JSON по следующей схеме:
  {
    "sales_style": "active_sales | passive_service | poor_service",
    "sales_analysis": "подробный разбор техники продаж и инициативы",
    "lost_opportunities": ["упущенная возможность 1", "упущенная возможность 2"],
    "admin_score": 7
  }
  `;

  const coachResponse = await callOpenRouter(coachPrompt, apiKey, COACH_MODEL);
  const coachData = extractJson(coachResponse);
  if (!coachData) {
    throw new Error("Agent 3 (Sales Coach) failed to evaluate sales quality.");
  }

  // --- Assembly final response ---
  return {
    client_type: auditData.client_type,
    summary: auditData.summary,
    sentiment: auditData.sentiment,
    has_complaints: auditData.has_complaints,
    compliance: auditData.compliance,
    sales_style: coachData.sales_style,
    sales_analysis: coachData.sales_analysis,
    lost_opportunities: coachData.lost_opportunities,
    admin_score: coachData.admin_score,
    script_check: auditData.script_check,
    missed_steps: auditData.missed_steps,
    dialogue: cleanDialogue
  };
}

async function callOpenRouter(prompt: string, apiKey: string, modelName: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000); // 25s limit per agent call

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "DashAdmin Voice QA Pipeline"
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });

  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}
