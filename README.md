---
# 🤖 Multi-Format Autonomous AI System with Contextual Decisioning & Chained Actions

A multi-agent AI system that intelligently processes documents (Email, JSON, PDF), identifies their business intent, extracts relevant data, and triggers the right follow-up actions — all autonomously.

---

## 🚀 Objective

> Build an intelligent, multi-format processor that:
- Classifies input format and business intent.
- Extracts relevant structured data.
- Dynamically routes documents to specialized agents.
- Triggers contextual actions (e.g., escalate, log, flag).
- Maintains a traceable shared memory log for audit and explainability.

---

## 🧩 Core Architecture

### 1. 🔍 Classifier Agent
- Detects:
  - `format`: Email | JSON | PDF
  - `intent`: Complaint | Invoice | RFQ | Regulation | Fraud Risk
- Uses few-shot prompting + schema matching.
- Passes metadata to shared memory.

### 2. ✉️ Email Agent
- Extracts:
  - `sender`, `urgency`, `tone`, `issue summary`
- Decision logic:
  - High urgency + escalation tone → `POST /crm/escalate`
  - Else → `log_and_close`

### 3. 🔧 JSON Agent
- Parses webhook data.
- Validates against schema (Zod).
- Flags:
  - Missing fields, type mismatches
- If invalid → `POST /alert/memory_log`

### 4. 📄 PDF Agent
- Identifies document type: `Invoice` or `Policy`
- Invoice logic:
  - Extracts `lineItems`, `totalAmount`
  - Flags if total > 10,000
- Policy logic:
  - Flags if mentions: `GDPR`, `FDA`

### 5. 🧠 Shared Memory Store
Every agent reads/writes to a centralized memory:
```ts
{
  source: "Email",
  timestamp: "...",
  classification: { format, intent },
  extractedFields: { ... },
  action: "escalate_issue",
  trace: ["Classifier", "Email Agent", "Action Router"]
}
````

### 6. 🧭 Action Router Agent

* Makes final decision based on all agent outputs.
* Possible actions:

  * `log_and_close`
  * `create_ticket`
  * `escalate_issue`
  * `flag_compliance_risk`
* Simulates API call:

  ```ts
  POST /crm/create_ticket
  ```

---

## ⚙️ Tech Stack

* **Frontend:**

  * Next.js, React, TypeScript
  * Tailwind CSS 

* **Backend & AI Logic:**

  * Firebase Genkit + Google AI (Gemini via `@genkit-ai/googleai`)
  * Node.js (for Genkit and Next.js)
  * 

## 🛠️ Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set environment variables:**
   Create `.env` and add:

   ```env
   GOOGLE_API_KEY=your_google_api_key
   ```

3. **Start development servers:**

   * **Frontend (Next.js):**

     ```bash
     npm run dev
     ```

   * **Backend (Genkit):**

     ```bash
     npm run genkit:dev
     ```

   Visit: `http://localhost:9002`

---


## 💡 Inspiration

Inspired by real-world document automation needs — complaints, fraud detection, policy compliance, and more — processed intelligently using Google AI.
---

