/**
 * Shared clinical brain for both runtimes.
 *
 * Local development runs an Express server (`server.ts`); production runs
 * Vercel serverless functions (`api/`). Both import the tool declarations,
 * system instruction and the two service calls from here, so the clinical
 * behaviour cannot drift between what you test locally and what ships.
 *
 * Nothing here touches HTTP — callers translate ServiceError into a response.
 */

import {
  GoogleGenAI,
  Modality,
  Type,
  StartSensitivity,
  EndSensitivity,
  FunctionDeclaration,
} from '@google/genai';

/**
 * The real-time voice conversation runs on the Live API model over a
 * WebSocket. The one turn-based step (final SOAP synthesis) uses the
 * general-purpose free-tier model. Both are overridable for testing.
 */
export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview';

/** Ephemeral auth tokens are served from v1alpha only. */
export const LIVE_API_VERSION = 'v1alpha';

/** How long a minted token may still be used to open a new session. */
export const TOKEN_USABLE_MS = 10 * 60 * 1000;

/**
 * Silence (ms) before the model decides the patient has finished speaking.
 *
 * This is the one knob that directly trades responsiveness against not
 * interrupting people. Lower feels snappier; too low and the assistant talks
 * over a patient who merely paused mid-sentence, which loses clinical detail.
 * 900ms is tuned for people describing symptoms while in discomfort.
 */
const VAD_SILENCE_MS = Number(process.env.GEMINI_VAD_SILENCE_MS || 900);

/** Carries an HTTP status so each runtime can answer appropriately. */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Read lazily rather than at import time: on Vercel the environment is
 * injected by the platform, and locally `dotenv/config` has to run first.
 */
export function geminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

const USER_AGENT = { 'User-Agent': 'aistudio-build' };

let textAi: GoogleGenAI | null = null;
let liveAuthAi: GoogleGenAI | null = null;

function textClient(): GoogleGenAI {
  if (!textAi) {
    textAi = new GoogleGenAI({ apiKey: geminiApiKey(), httpOptions: { headers: USER_AGENT } });
  }
  return textAi;
}

/** Separate client pinned to v1alpha, used only to mint Live API tokens. */
function liveAuthClient(): GoogleGenAI {
  if (!liveAuthAi) {
    liveAuthAi = new GoogleGenAI({
      apiKey: geminiApiKey(),
      httpOptions: { apiVersion: LIVE_API_VERSION, headers: USER_AGENT },
    });
  }
  return liveAuthAi;
}

// Function Declarations for Mid-Conversation Clinical Tool Calling
export const recordSymptomDeclaration: FunctionDeclaration = {
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

export const flagTriageRedFlagDeclaration: FunctionDeclaration = {
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

export const recordPatientHistoryDeclaration: FunctionDeclaration = {
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

export const updateClinicalAssessmentDeclaration: FunctionDeclaration = {
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

export const generateDoctorHandoffDeclaration: FunctionDeclaration = {
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

export const clinicalTools = [
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
export const CLINICAL_SYSTEM_INSTRUCTION = `You are the NSOffice Live Clinical Health Intake Assistant, an advanced real-time voice medical intake companion powered by the Gemini API.

Your mission:
A patient describes their symptoms out loud before their consultation with a physician. You listen attentively, maintain an empathetic, calm, and reassuring bedside manner, ask natural, clinically focused follow-up questions to fill diagnostic gaps, and invoke mid-conversation clinical tools to dynamically extract structured medical data for the physician.

CRITICAL BEHAVIOR & GUIDELINES:
1. EMPATHETIC & CONCISE SPEECH:
   - You are speaking out loud in a live voice call. Everything you say is heard, never read.
   - Keep your conversational reply concise (2 to 3 sentences maximum). Avoid walls of text.
   - Never speak markdown, bullet points, headings or field labels aloud — talk the way a nurse would.
   - The patient can interrupt you at any moment. If they talk over you, stop, listen, and respond to what they actually said rather than finishing your previous sentence.
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
/**
 * Mints a short-lived ephemeral token so the browser can open the Live API
 * WebSocket directly against Gemini.
 *
 * GEMINI_API_KEY never leaves the server. The token is single-use, expires in
 * minutes, and carries the model, system instruction, clinical tool
 * declarations and audio config locked in here — the browser cannot alter the
 * clinical behaviour, it can only speak to it.
 */
export async function createLiveToken() {
  if (!geminiApiKey()) {
    throw new ServiceError(
      503,
      'GEMINI_API_KEY is not configured on the server. Add it to your environment and redeploy before starting a live intake.'
    );
  }

  const now = Date.now();

  let token;
  try {
    token = await liveAuthClient().authTokens.create({
      config: {
        uses: 1,
        // Window to open the socket, then the hard cap on session length.
        // The client prewarms this token before the user clicks, so the
        // connect window has to outlive a bit of reading time on the page.
        newSessionExpireTime: new Date(now + TOKEN_USABLE_MS).toISOString(),
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            // Low, not zero: clinical extraction should be reproducible, but
            // the spoken bedside manner still needs some variation.
            temperature: 0.2,
            systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
            tools: clinicalTools,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            // Drives the on-screen dialogue transcript for both speakers.
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            // Turn-taking is the single biggest lever on perceived latency:
            // the model will not start answering until VAD declares the
            // patient has finished.
            realtimeInputConfig: {
              automaticActivityDetection: {
                // Start detection stays eager so the first syllable is not
                // clipped. End detection is deliberately conservative: at
                // 600ms the model began answering over the top of a patient
                // who was still describing their symptoms.
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 120,
                silenceDurationMs: VAD_SILENCE_MS,
              },
            },
            // Keeps a long intake from slowing down as context grows.
            contextWindowCompression: {
              triggerTokens: '16000',
              slidingWindow: { targetTokens: '8000' },
            },
          },
        },
      },
    });
  } catch (error: any) {
    throw new ServiceError(502, error?.message || 'Could not mint a Live API ephemeral token.');
  }

  if (!token.name) {
    throw new ServiceError(502, 'Gemini returned an auth token without a name.');
  }

  return {
    token: token.name,
    model: LIVE_MODEL,
    apiVersion: LIVE_API_VERSION,
    usableForMs: TOKEN_USABLE_MS,
  };
}

export interface HandoffRequest {
  transcript?: unknown;
  symptoms?: unknown;
  redFlags?: unknown;
  history?: unknown;
}

/**
 * Compiles the physician SOAP note. Turn-based, so it uses the
 * general-purpose free-tier text model rather than the Live API.
 */
export async function generateHandoff(body: HandoffRequest) {
  if (!geminiApiKey()) {
    throw new ServiceError(
      503,
      'GEMINI_API_KEY is not configured on the server, so no SOAP note can be generated.'
    );
  }

  const { transcript, symptoms, redFlags, history } = body;

  const prompt = [
    'Based on the following full preliminary clinical intake consultation:',
    'Transcript:',
    JSON.stringify(transcript, null, 2),
    '',
    'Recorded Symptoms:',
    JSON.stringify(symptoms, null, 2),
    '',
    'Red Flag Alerts:',
    JSON.stringify(redFlags, null, 2),
    '',
    'Patient History:',
    JSON.stringify(history, null, 2),
    '',
    'Generate a comprehensive, high-fidelity Doctor Handoff Note in SOAP format for the physician.',
    "You must call the 'generate_doctor_handoff' function.",
  ].join('\n');

  let response;
  try {
    response = await textClient().models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        tools: [{ functionDeclarations: [generateDoctorHandoffDeclaration] }],
      },
    });
  } catch (error: any) {
    throw new ServiceError(502, error?.message || 'Failed to generate handoff.');
  }

  const call = response.functionCalls?.[0];
  if (!call?.args) {
    // Better to show nothing than to invent clinical content for a physician.
    throw new ServiceError(
      502,
      'The model did not return a structured SOAP note. Please try again.'
    );
  }

  return call.args;
}
