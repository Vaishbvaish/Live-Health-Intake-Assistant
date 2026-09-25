# NSOffice Live Health Intake Assistant

> **Network Science (NSOFFICE.AI) Internship Assignment**  
> **Project 5: Live Health Intake Assistant — Healthcare**

An end-to-end real-time AI voice intake companion built with the **Gemini API**. A patient describes their symptoms out loud before a consultation; the assistant listens attentively, asks natural follow-up questions to fill in clinical diagnostic gaps, and dynamically invokes **clinical tools mid-conversation** to produce an instant, structured SOAP summary note for the consulting physician.

---

## 🌟 Key Highlights

- **Real-Time Voice Dialogue**: Speak aloud or listen to natural vocal responses. Supports live continuous speech recognition, barge-in interruptions, and dynamic audio waveform visualizer.
- **Mid-Conversation Tool Calling (Core Showcase)**: Rather than acting as a static chatbot, the assistant calls structured Gemini tools in real-time as the patient speaks:
  - `record_symptom`: Extracts symptom name, anatomical region, severity rating (1–10), onset, duration, character, and radiation.
  - `flag_triage_red_flag`: Alarms critical emergency symptoms (e.g., crushing chest pain radiating to jaw, severe sudden headache, respiratory distress) with clinical rationale and STAT actions.
  - `record_patient_history`: Captures allergies, active medications, chronic conditions, and past surgeries.
  - `update_clinical_assessment`: Synthesizes provisional impressions and differential diagnoses.
  - `generate_doctor_handoff`: Compiles the finalized clinical SOAP note for physician consultation.
- **Live Clinical Extraction Dashboard**: Side-by-side real-time extractor featuring an **Interactive Anatomical Body Map**, dynamic triage urgency status (Routine / Urgent / Emergency), and severity rating bars.
- **Standardized Doctor Handoff (SOAP Note)**:
  - **S (Subjective)**: Chief Complaint, HPI narrative, symptom review.
  - **O (Objective)**: Observed and reported vitals, distress level, pain score.
  - **A (Assessment)**: Differential diagnoses with clinical probabilities.
  - **P (Plan)**: Suggested diagnostic lab orders (e.g. 12-lead ECG, Troponin, CT, CBC), physician examination checklist.
  - Export to Markdown (EHR format) or Print/PDF.
- **NSOffice Glass UI System**:
  - **Accent Color**: Electric Blue (`#0062FF`).
  - **Typography**: DM Sans throughout.
  - **Spacing**: Apple-style breathing room and liquid glass frosted panels (`backdrop-blur-xl`).
  - **Interaction Discipline**: One clear primary action per view.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Clone and Install
```bash
git clone https://github.com/<your-username>/nsoffice-health-intake.git
cd nsoffice-health-intake
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and add your Gemini API key:
```env
GEMINI_API_KEY="AIzaSy..."
APP_URL="http://localhost:3000"
```

> **Note**: `.env` is already included in `.gitignore` and will never be committed to source control.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete NSOffice Live Health Intake Assistant"
   git branch -M main
   git remote add origin https://github.com/<your-username>/nsoffice-health-intake.git
   git push -u origin main
   ```
2. Import the repository in [Vercel](https://vercel.com).
3. In **Settings > Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio.
4. Click **Deploy**. Vercel will build and host the live public application URL.

---

## 🩺 Preloaded Clinical Test Scenarios

To help reviewers and clients test immediately even without a microphone:
1. **Acute Crushing Chest Pain (Cardiovascular / ACS Rule-Out)**
2. **Severe Throbbing Migraine with Visual Aura (Neurological)**
3. **Acute Right Lower Quadrant Pain (Gastrointestinal / Appendicitis Rule-Out)**
4. **Acute Dyspnea & Bronchospasm (Respiratory / Asthma Flare)**
5. **Lumbar Strain with Sciatic Radiculopathy (Musculoskeletal)**

Click any scenario at the top of the conversation stream to simulate the patient's voice intake in one tap!

---

## 📂 Project Architecture

```
├── server.ts                   # Express server with Gemini 3.8 Flash tool calling & TTS
├── src/
│   ├── components/
│   │   ├── Header.tsx                 # NSOffice branded header & triage status
│   │   ├── DialogueStream.tsx         # Voice dialogue, tool call badges, & mic toggle
│   │   ├── ClinicalExtractionPanel.tsx # Live auto-updating clinical feed & vitals
│   │   ├── AnatomicalMap.tsx          # Interactive SVG anatomical symptom locator
│   │   ├── VoiceVisualizer.tsx        # Canvas audio waveform spectrum visualizer
│   │   └── DoctorHandoffView.tsx      # Standardized SOAP note & physician sign-off
│   ├── data/
│   │   └── clinicalScenarios.ts       # Clinical test cases & prompt presets
│   ├── types/
│   │   └── clinical.ts                # TypeScript clinical data models & schemas
│   ├── utils/
│   │   └── speech.ts                  # Web Speech API recognition & speech synthesis
│   ├── App.tsx                        # Main state orchestrator
│   ├── index.css                      # NSOffice glass UI tokens & DM Sans configuration
│   └── main.tsx                       # React application root
├── index.html                  # HTML entry point with DM Sans & SEO metadata
├── metadata.json               # AI Studio application metadata
└── package.json                # Project dependencies and full-stack scripts
```

---

## 🔒 Security & Privacy

- All Gemini API calls are executed strictly server-side in `server.ts`.
- The Gemini API key is never exposed to the client or browser bundle.
- Meets medical confidentiality standards with mock or local synthetic patient telemetry.
