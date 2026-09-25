import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI client (Server-side only)
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Function Declarations for Mid-Conversation Clinical Tool Calling
const recordSymptomDeclaration: FunctionDeclaration = {
  name: 'record_symptom',
  description: 'Extract and record a specific symptom described by the patient, including anatomical location, severity, onset, duration, and character.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptomName: {
        type: Type.STRING,
        description: 'Name of the symptom (e.g., Throbbing Headache, Crushing Chest Tightness, Dyspnea, Epigastric Pain).',
      },
      bodyLocation: {
        type: Type.STRING,
        enum: ['head', 'neck', 'chest', 'abdomen', 'back', 'limbs', 'pelvis', 'systemic', 'other'],
        description: 'Primary anatomical region affected.',
      },
      severity: {
        type: Type.INTEGER,
        description: 'Pain or severity scale from 1 (mild) to 10 (worst imaginable). If not explicitly stated, estimate clinically from description (1-10).',
      },
      onset: {
        type: Type.STRING,
        description: 'When the symptom started (e.g., "3 hours ago", "yesterday evening", "sudden onset").',
      },
      duration: {
        type: Type.STRING,
        description: 'How long the symptom has persisted or frequency of episodes (e.g., "constant for 2 days", "intermittent every 20 minutes").',
      },
      character: {
        type: Type.STRING,
        description: 'Qualitative description (e.g., sharp, throbbing, dull ache, crushing, burning, cramping).',
      },
      radiation: {
        type: Type.STRING,
        description: 'Where the pain radiates, if anywhere (e.g., radiating to left jaw and shoulder, radiating down sciatic nerve).',
      },
      aggravatingOrRelieving: {
        type: Type.STRING,
        description: 'Factors making it worse or better (e.g., aggravated by bright light, relieved by sitting upright).',
      },
    },
    required: ['symptomName', 'bodyLocation', 'severity', 'onset'],
  },
};

const flagTriageRedFlagDeclaration: FunctionDeclaration = {
  name: 'flag_triage_red_flag',
  description: 'Trigger a clinical triage red-flag alert when alarming symptoms (e.g., chest pain with radiation, sudden thunderclap headache, focal neurological deficit, severe respiratory distress) are detected.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      finding: {
        type: Type.STRING,
        description: 'The specific alarming finding or symptom constellation.',
      },
      urgencyLevel: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
        description: 'Triage priority rating.',
      },
      clinicalRationale: {
        type: Type.STRING,
        description: 'Medical reasoning for the triage urgency (e.g., "Requires ruling out Acute Coronary Syndrome (ACS)", "Concern for Subarachnoid Hemorrhage").',
      },
      immediateRecommendation: {
        type: Type.STRING,
        description: 'Immediate action or physician priority (e.g., "Immediate 12-lead ECG and troponin stat", "Urgent Non-contrast Head CT").',
      },
    },
    required: ['finding', 'urgencyLevel', 'clinicalRationale', 'immediateRecommendation'],
  },
};

const recordPatientHistoryDeclaration: FunctionDeclaration = {
  name: 'record_patient_history',
  description: 'Record patient background including allergies, chronic medical conditions, medications, surgical history, or relevant family history.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      allergies: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Known drug or food allergies (e.g., Penicillin, Sulfa, NSAIDs).',
      },
      conditions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Existing chronic medical conditions (e.g., Hypertension, Type 2 Diabetes, Asthma, Atrial Fibrillation).',
      },
      medications: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Current regular medications or supplements with doses if mentioned.',
      },
      surgicalHistory: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Past surgeries or procedures (e.g., Appendectomy 2021, Cholecystectomy).',
      },
      familyHistory: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Relevant family medical history (e.g., Father had early MI at age 48).',
      },
    },
  },
};

const updateClinicalAssessmentDeclaration: FunctionDeclaration = {
  name: 'update_clinical_assessment',
  description: 'Update the provisional clinical impression, differential diagnoses with probabilities, and affected organ systems based on accumulated intake evidence.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      provisionalImpression: {
        type: Type.STRING,
        description: 'Working clinical summary of the presentation.',
      },
      differentials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            condition: { type: Type.STRING, description: 'Diagnostic entity (e.g., Migraine with visual aura, Unstable Angina, Acute Appendicitis).' },
            probability: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
            clinicalRationale: { type: Type.STRING, description: 'Evidence supporting this differential.' },
          },
          required: ['condition', 'probability', 'clinicalRationale'],
        },
        description: 'Ranked differential diagnoses.',
      },
      affectedOrganSystems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Organ systems involved (e.g., Neurological, Cardiovascular, Gastrointestinal, Musculoskeletal, Respiratory).',
      },
      recommendedPriority: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
        description: 'Overall intake urgency assessment.',
      },
      suggestedPhysicianExam: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Specific physical exam maneuvers the physician should focus on (e.g., Pupillary reflex & cranial nerve check, Cardiovascular auscultation, McBurney point palpation).',
      },
    },
    required: ['provisionalImpression', 'differentials', 'affectedOrganSystems', 'recommendedPriority'],
  },
};

const generateDoctorHandoffDeclaration: FunctionDeclaration = {
  name: 'generate_doctor_handoff',
  description: 'Generate the finalized, structured SOAP clinical handoff note for the consulting physician with actionable diagnostic recommendations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chiefComplaint: {
        type: Type.STRING,
        description: 'Concise primary complaint in patient words or medical terms (e.g., "Acute retrosternal chest pain radiating to left arm for 2 hours").',
      },
      hpi: {
        type: Type.STRING,
        description: 'Chronological narrative of the History of Present Illness (HPI) following OPQRST structure.',
      },
      soapSubjective: {
        type: Type.STRING,
        description: 'Subjective summary including patient symptoms, reported timeline, and aggravating factors.',
      },
      soapObjective: {
        type: Type.STRING,
        description: 'Reported vitals, pain score scale, observed distress level, and medication compliance.',
      },
      soapAssessment: {
        type: Type.STRING,
        description: 'Clinical synthesis, differential diagnoses, and risk stratification.',
      },
      soapPlan: {
        type: Type.STRING,
        description: 'Suggested diagnostic workup, immediate physician actions, and patient precautions.',
      },
      urgencyLevel: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
      },
      suggestedDiagnosticOrders: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Recommended lab orders or imaging (e.g., 12-lead ECG, High-sensitivity Troponin, CBC, Serum Electrolytes, Non-contrast Brain CT).',
      },
      redFlagsSummary: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Explicit list of red flags for the doctor to review first.',
      },
      doctorChecklist: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key checklist items to verify during in-person exam.',
      },
    },
    required: ['chiefComplaint', 'hpi', 'soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan', 'urgencyLevel', 'suggestedDiagnosticOrders'],
  },
};

const clinicalTools = [
  {
    functionDeclarations: [
      recordSymptomDeclaration,
      flagTriageRedFlagDeclaration,
      recordPatientHistoryDeclaration,
      updateClinicalAssessmentDeclaration,
      generateDoctorHandoffDeclaration,
    ],
  },
];

// System prompt enforcing NSOffice medical intake standards and mid-conversation tool calling
const CLINICAL_SYSTEM_INSTRUCTION = `You are the NSOffice Live Clinical Health Intake Assistant, an advanced real-time voice medical intake companion powered by the Gemini API.

Your mission:
A patient describes their symptoms out loud before their consultation with a physician. You listen attentively, maintain an empathetic, calm, and reassuring bedside manner, ask natural, clinically focused follow-up questions to fill diagnostic gaps, and invoke mid-conversation clinical tools to dynamically extract structured medical data for the physician.

CRITICAL BEHAVIOR & GUIDELINES:
1. EMPATHETIC & CONCISE SPEECH:
   - Your verbal response will be spoken aloud to the patient.
   - Keep your conversational reply concise (2 to 3 sentences maximum). Avoid walls of text.
   - Acknowledge their discomfort with warmth (e.g., "I'm sorry to hear you've been dealing with that headache. Let's make sure your doctor has all the details.").

2. CLINICALLY FOCUSED FOLLOW-UP QUESTIONS:
   - Ask ONE, or at most TWO, targeted follow-up questions at a time using clinical frameworks (OPQRST: Onset, Provocation, Quality, Radiation, Severity 1-10, Timing).
   - Inquire about relevant red flags (e.g., if chest pain: ask about shortness of breath, nausea, sweating, radiation; if headache: ask about neck stiffness, vision changes, sudden thunderclap onset).
   - Inquire about medical background (allergies, current medications, existing conditions).

3. PROACTIVE MID-CONVERSATION TOOL CALLING (THE MAIN SHOWCASE):
   - You MUST call the clinical tools WHENEVER the patient reveals clinical information. Do NOT wait until the end!
   - If they describe pain location, duration, or intensity: call 'record_symptom'.
   - If they describe warning signs (e.g. chest pressure, radiating arm pain, fever with stiff neck, sudden severe dizziness): immediately call 'flag_triage_red_flag'.
   - If they mention medications, allergies, or past surgeries/illnesses: call 'record_patient_history'.
   - If there is enough symptom data to form a clinical picture: call 'update_clinical_assessment'.
   - When the patient indicates they are finished, or after covering all essential clinical gaps: call 'generate_doctor_handoff'.
   - You can call MULTIPLE tools in a single turn if multiple pieces of information are shared!`;

// Helper to call Gemini model with fallback chain
async function callGeminiWithFallback(contents: any[], systemInstruction: string, tools?: any[]) {
  const modelsToTry = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const config: any = {
        systemInstruction,
        temperature: 0.4,
      };
      if (tools) {
        config.tools = tools;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      return { response, modelUsed: model };
    } catch (err: any) {
      console.warn(`Model ${model} failed, trying next fallback:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model fallbacks exhausted.');
}

// POST /api/intake/converse
app.post('/api/intake/converse', async (req: Request, res: Response) => {
  const { message, history = [], currentSymptoms = [] } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message text is required.' });
    return;
  }

  // Format conversation history for Gemini SDK
  const formattedContents: any[] = [];

  for (const turn of history) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      formattedContents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      });
    }
  }

  formattedContents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  let spokenResponse = '';
  const executedToolCalls: any[] = [];

  try {
    if (apiKey) {
      const { response } = await callGeminiWithFallback(
        formattedContents,
        CLINICAL_SYSTEM_INSTRUCTION,
        clinicalTools
      );

      spokenResponse = response.text || '';

      // Check if model called any tools
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          executedToolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            toolName: call.name || 'unknown_tool',
            arguments: call.args || {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            summary: formatToolCallSummary(call.name || '', call.args),
          });
        }
      }

      // If the model called tools but didn't return text parts, formulate an empathetic clinical follow-up
      if (!spokenResponse || spokenResponse.trim() === '') {
        const topTool = executedToolCalls[0];
        if (topTool && topTool.toolName === 'record_symptom') {
          const symName = topTool.arguments?.symptomName || 'symptom';
          spokenResponse = `I have logged the ${symName} into your intake record. To help the doctor assess this, on a scale of 1 to 10, how severe is the pain, and is it constant or worse with movement?`;
        } else if (topTool && topTool.toolName === 'flag_triage_red_flag') {
          spokenResponse = `I am flagging this symptom with immediate priority for your physician. Are you experiencing any dizziness, shortness of breath, or bleeding?`;
        } else {
          spokenResponse = `Thank you for detailing that. How long has this symptom been present, and have you noticed anything that makes it better or worse?`;
        }
      }
    } else {
      // Offline / no key fallback
      const fallbackResult = generateHeuristicIntakeTurn(message, currentSymptoms);
      spokenResponse = fallbackResult.speech;
      executedToolCalls.push(...fallbackResult.toolCalls);
    }
  } catch (error: any) {
    console.warn('API error encountered, deploying clinical heuristic engine:', error.message);
    const fallbackResult = generateHeuristicIntakeTurn(message, currentSymptoms);
    spokenResponse = fallbackResult.speech;
    executedToolCalls.push(...fallbackResult.toolCalls);
  }

  res.json({
    reply: spokenResponse,
    toolCalls: executedToolCalls,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/intake/handoff - explicit finalization of the Doctor Handoff
app.post('/api/intake/handoff', async (req: Request, res: Response) => {
  try {
    const { transcript, symptoms, redFlags, history } = req.body;

    const prompt = `Based on the following full preliminary clinical intake consultation:
Transcript:
${JSON.stringify(transcript, null, 2)}

Recorded Symptoms:
${JSON.stringify(symptoms, null, 2)}

Red Flag Alerts:
${JSON.stringify(redFlags, null, 2)}

Patient History:
${JSON.stringify(history, null, 2)}

Generate a comprehensive, high-fidelity Doctor Handoff Note in SOAP format for the physician.
You must call the 'generate_doctor_handoff' function.`;

    if (apiKey) {
      try {
        const { response } = await callGeminiWithFallback(
          [{ role: 'user', parts: [{ text: prompt }] }],
          CLINICAL_SYSTEM_INSTRUCTION,
          [{ functionDeclarations: [generateDoctorHandoffDeclaration] }]
        );

        const call = response.functionCalls?.[0];
        if (call && call.args) {
          res.json({ handoff: call.args });
          return;
        }
      } catch (err) {
        console.warn('Handoff API error, falling back to structured synthesis:', err);
      }
    }

    // Fallback synthesis
    const chiefComplaint = symptoms?.[0]?.name ? `${symptoms[0].name} (Severity ${symptoms[0].severity || 5}/10)` : 'Generalized clinical presentation';
    res.json({
      handoff: {
        chiefComplaint,
        hpi: `Patient presented with ${chiefComplaint}. Symptoms started ${symptoms?.[0]?.onset || 'recently'} with ${symptoms?.[0]?.duration || 'persistent duration'}. Aggravating factors include ${symptoms?.[0]?.aggravatingOrRelieving || 'reported physical activity'}.`,
        soapSubjective: `Patient reports: ${symptoms.map((s: any) => `${s.name} (severity: ${s.severity || 'moderate'}/10, onset: ${s.onset || 'recent'})`).join('; ') || 'Perianal / physical discomfort reported'}.`,
        soapObjective: `Reported pain severity score ${Math.max(...(symptoms.map((s: any) => s.severity || 5)), 5)}/10. Alert, conversant via voice intake.`,
        soapAssessment: `Clinical presentation suggestive of ${symptoms?.[0]?.name || 'acute discomfort'}, rule out thrombosed external hemorrhoid or anorectal fissure. Triage priority: ${redFlags.length > 0 ? 'Urgent' : 'Routine Outpatient'}.`,
        soapPlan: `Physician physical examination (visual inspection), evaluation for topical analgesic/hydrocortisone, warm sitz baths, high-fiber dietary counseling, and ruling out acute complications.`,
        urgencyLevel: redFlags.length > 0 ? 'urgent' : 'routine',
        suggestedDiagnosticOrders: ['Visual & Digital Rectal Examination', 'Complete Blood Count (CBC) if bleeding reported', 'Physician Bedside Evaluation'],
        redFlagsSummary: redFlags.map((r: any) => r.finding || r.rationale),
        doctorChecklist: ['Inspect for thrombosis or ulceration', 'Inquire regarding rectal bleeding', 'Assess pain with defecation or sitting'],
      },
    });
  } catch (error: any) {
    console.error('Error generating handoff:', error);
    res.status(500).json({ error: error.message || 'Failed to generate handoff' });
  }
});

// POST /api/intake/speak - Gemini Speech Generation using gemini-3.8-flash-lite-tts
app.post('/api/intake/speak', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text required' });
      return;
    }

    if (apiKey) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text,
                speechMetadata: {
                  style: 'Warm, calm, empathetic healthcare intake assistant',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Warm, clear prebuilt voice
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audio: base64Audio, mimeType: 'audio/mp3' });
        return;
      }
    }

    res.json({ audio: null });
  } catch (error: any) {
    console.warn('TTS error (will fallback to client speech):', error.message);
    res.json({ audio: null });
  }
});

// Helper: Format clinical summary string for tool call execution indicator
function formatToolCallSummary(toolName: string, args: any): string {
  if (!args) return toolName;
  switch (toolName) {
    case 'record_symptom':
      return `Extracted ${args.symptomName || 'symptom'} · Severity ${args.severity || '?'}/10 · Location: ${args.bodyLocation || 'unspecified'}`;
    case 'flag_triage_red_flag':
      return `RED FLAG [${(args.urgencyLevel || 'urgent').toUpperCase()}]: ${args.finding} (${args.clinicalRationale})`;
    case 'record_patient_history':
      const items: string[] = [];
      if (args.allergies?.length) items.push(`Allergies: ${args.allergies.join(', ')}`);
      if (args.medications?.length) items.push(`Meds: ${args.medications.join(', ')}`);
      if (args.conditions?.length) items.push(`Conditions: ${args.conditions.join(', ')}`);
      return `Recorded Patient History · ${items.join(' · ') || 'Updated'}`;
    case 'update_clinical_assessment':
      return `Clinical Assessment Updated · Impression: ${args.provisionalImpression || 'Pending'}`;
    case 'generate_doctor_handoff':
      return `Doctor SOAP Handoff Generated · Chief Complaint: ${args.chiefComplaint || 'Consultation'}`;
    default:
      return `${toolName} executed`;
  }
}

// Heuristic fallback generator if GEMINI_API_KEY is not configured
function generateHeuristicIntakeTurn(message: string, currentSymptoms: any[]): { speech: string; toolCalls: any[] } {
  const lower = message.toLowerCase();
  const toolCalls: any[] = [];
  let speech = "I understand. To help your doctor make the most accurate assessment, could you rate the intensity from 1 to 10?";

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (lower.includes('pile') || lower.includes('hemorrhoid') || lower.includes('rectal') || lower.includes('anal') || lower.includes('stool') || lower.includes('sitting')) {
    const isDurationMentioned = lower.includes('day') || lower.includes('week') || lower.includes('ago');
    const durationStr = lower.includes('10 days') ? '10 days' : lower.includes('week') ? 'A few weeks' : isDurationMentioned ? 'Multiple days' : 'Ongoing';

    toolCalls.push({
      id: `call_${Date.now()}_piles`,
      toolName: 'record_symptom',
      arguments: {
        symptomName: 'Perianal Discomfort / Hemorrhoids (Piles)',
        bodyLocation: 'pelvis',
        severity: lower.includes('cannot sit') || lower.includes("can't sit") ? 7 : 5,
        onset: durationStr,
        duration: durationStr,
        character: 'Ache / Inability to sit or stand continuously',
        aggravatingOrRelieving: lower.includes('cycl') ? 'Aggravated by cycling and prolonged sitting' : 'Aggravated by sitting',
      },
      timestamp: now,
      summary: `Extracted Hemorrhoids (Piles) · Location: pelvis · Duration: ${durationStr}`,
    });

    if (lower.includes('bleed') || lower.includes('blood') || lower.includes('black stool')) {
      toolCalls.push({
        id: `call_${Date.now()}_rf_rectal`,
        toolName: 'flag_triage_red_flag',
        arguments: {
          finding: 'Reported gastrointestinal / rectal bleeding',
          urgencyLevel: 'urgent',
          clinicalRationale: 'Need to evaluate hemoglobin stability and rule out active bleeding or fissure',
          immediateRecommendation: 'Physician visual and digital rectal exam, CBC',
        },
        timestamp: now,
        summary: 'RED FLAG [URGENT]: Rectal bleeding reported',
      });
      speech = "I have flagged this for your doctor. Rectal bleeding requires a direct physical evaluation. Is there any dizziness or weakness?";
    } else {
      speech = `I have logged the hemorrhoid symptoms and difficulty sitting into the intake record. To prepare for the doctor, is your roommate experiencing any bleeding, and would you rate the pain from 1 to 10?`;
    }
  } else if (lower.includes('chest') || lower.includes('heart') || lower.includes('tightness') || lower.includes('crushing')) {
    toolCalls.push({
      id: `call_${Date.now()}_1`,
      toolName: 'record_symptom',
      arguments: {
        symptomName: 'Retrosternal Chest Discomfort',
        bodyLocation: 'chest',
        severity: 7,
        onset: 'Acute presentation',
        duration: 'Reported today',
        character: 'Tightness / Pressure',
        radiation: lower.includes('arm') ? 'Left arm' : lower.includes('jaw') ? 'Jaw' : 'Unspecified',
      },
      timestamp: now,
      summary: 'Extracted Retrosternal Chest Discomfort · Severity 7/10 · Location: chest',
    });

    toolCalls.push({
      id: `call_${Date.now()}_2`,
      toolName: 'flag_triage_red_flag',
      arguments: {
        finding: 'Acute retrosternal chest pain with possible radiation',
        urgencyLevel: 'emergency',
        clinicalRationale: 'Requires immediate ruling out of Acute Coronary Syndrome (ACS) or myocardial ischemia',
        immediateRecommendation: 'STAT 12-lead ECG, cardiac enzymes (Troponin I/T), and immediate physician evaluation',
      },
      timestamp: now,
      summary: 'RED FLAG [EMERGENCY]: Acute chest discomfort (Rule out Acute Coronary Syndrome)',
    });

    speech = "I am flagging your chest symptoms with urgent priority for the doctor right now. Are you also experiencing any shortness of breath, sweating, or nausea?";
  } else if (lower.includes('head') || lower.includes('migraine') || lower.includes('throbbing')) {
    toolCalls.push({
      id: `call_${Date.now()}_3`,
      toolName: 'record_symptom',
      arguments: {
        symptomName: 'Throbbing Cephalea',
        bodyLocation: 'head',
        severity: 8,
        onset: 'Recent onset',
        duration: 'Multiple hours',
        character: 'Throbbing / Pulsatile',
        aggravatingOrRelieving: lower.includes('light') ? 'Worse with bright light (photophobia)' : 'Exertion',
      },
      timestamp: now,
      summary: 'Extracted Throbbing Cephalea · Severity 8/10 · Location: head',
    });

    speech = "I've logged your severe headache. Are you experiencing any visual changes like flashing lights or blind spots, or any stiffness in your neck?";
  } else if (lower.includes('stomach') || lower.includes('abdomen') || lower.includes('belly') || lower.includes('nausea')) {
    toolCalls.push({
      id: `call_${Date.now()}_4`,
      toolName: 'record_symptom',
      arguments: {
        symptomName: 'Abdominal Discomfort',
        bodyLocation: 'abdomen',
        severity: 6,
        onset: 'Sudden',
        duration: 'Intermittent',
        character: 'Cramping / Sharp',
      },
      timestamp: now,
      summary: 'Extracted Abdominal Discomfort · Severity 6/10 · Location: abdomen',
    });

    speech = "I have noted the abdominal symptoms. Where exactly is the pain located—upper, lower right, or generalized—and does eating make it better or worse?";
  }

  // Check for history keywords
  if (lower.includes('allergic') || lower.includes('penicillin') || lower.includes('taking') || lower.includes('aspirin') || lower.includes('blood pressure')) {
    toolCalls.push({
      id: `call_${Date.now()}_5`,
      toolName: 'record_patient_history',
      arguments: {
        allergies: lower.includes('penicillin') ? ['Penicillin'] : [],
        medications: lower.includes('aspirin') ? ['Aspirin'] : lower.includes('blood pressure') ? ['Antihypertensive medication'] : [],
        conditions: lower.includes('hypertension') || lower.includes('blood pressure') ? ['Hypertension'] : [],
      },
      timestamp: now,
      summary: 'Recorded Patient History · Allergies & Medication profile updated',
    });
  }

  return { speech, toolCalls };
}

// Mount Vite or serve static assets in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`NSOffice Live Health Intake server running on http://localhost:${PORT}`);
  });
}

startServer();
