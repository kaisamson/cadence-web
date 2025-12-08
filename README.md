# 🕒 Cadence — Own Your Time  
**AI-Powered Personal Time Optimization (iOS + Web Ecosystem)**  
Built by **Kai Samson**

Cadence is a life-optimization system that transforms your end-of-day voice recap into a structured timeline, productivity analytics, and personalized coaching recommendations.  

The goal: **help ambitious people understand how they spend their days, find inefficiencies, and operate at their highest potential.**

---

## ✨ Features

### 🎙️ **Voice → Timeline (On-Device Whisper) IOS**
Record a short recap of your day.  
Cadence uses on-device Whisper transcription to convert audio into structured natural language.

### 🧠 **AI-Powered Daily Breakdown**
A lightweight LLM interprets the transcript and generates:
- A chronological timeline of your day  
- Categorized activities (work, school, recovery, fitness, overhead, wasted time)  
- Productivity gaps + inefficiencies  
- Personalized optimization suggestions  

### 📅 **Daily Log Storage**
Your days sync across:
- The **iOS app**
- The **web dashboard** (Next.js)

Stored using:
- **Supabase Postgres** for logs
- **Secure user auth** on both platforms

### 📊 **Metrics & Insights**
Cadence gives you:
- Total focused hours  
- Time wasted  
- Deep work percentage  
- Sleep / recovery balance  
- Consistency tracking  
- Weekly improvement prompts  

### 🖥️ **Web Dashboard**
View timelines, trends, analytics, and AI reports from any device.

### 🍎 **iOS App**
Built in **SwiftUI**, using:
- On-device Whisper
- On-device or API-based LLM prompt pipelines
- Local caching + Cloud sync
- A premium, futuristic UX inspired by founder tools

---

## 🛠 Tech Stack

### **iOS**
- Swift / SwiftUI  
- Whisper (on-device transcription)  
- Local LLM / cloud LLM fallback  
- Supabase Auth  
- Postgres write-back  
- Offline-first caching  

### **Web**
- Next.js 15+  
- React Server Components  
- TailwindCSS  
- Supabase Postgres  
- Edge functions (optional)  
- Vercel deployment  

### **AI**
- Whisper → LLM → Structured JSON
- NOTE : Install whisper model first if on iOS
- Custom prompting for timeline + insights

---

## 📦 Installation (Web)

```bash
npm install
npm run dev
