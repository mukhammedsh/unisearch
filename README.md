# UniSearch — Beta v2.0.0 (Infomatrix 2026)

## Project description
 
**UniSearch** is a socially oriented web application designed to help students and applicants choose universities based on their preferences, structured data and **AI-based Smart Ranking**.

The main goal of the project UniSearch is to reduce inequality in access to educational information and eliminate the need for expensive consultants by providing personalized recommendations based on the applicant's **specific admission scenario** (SAT, UNT, IELTS, etc.).

---

## 🚀 Key Features (v2.0 Update)

### 1. Track-Based Admission Logic 🛤️
Universities often have multiple ways to enter (e.g., "Direct Entry via SAT" or "Foundation Year" or "National Exam Track").
* **Old version:** One generic "Avg GPA" for all scenarios.
* **New version:** Smart separation of requirements. The system calculates your chances for *each specific track* independently.

### 2. Dynamic Exam Configuration ⚙️
The system is no longer hardcoded. Supported exams (IELTS, SAT, UNT, etc.) are fetched from the backend (`/exams/config`). This allows administrators to add new national exams (like NUET or ENT) without changing the frontend code.

### 3. AI Smart Profile 🧠

* Users input their scores in a specialized modal.
* The **"Smart Sort"** algorithm ranks universities by a weighted "Fit Score" that combines:
    * **Academic Fit:** Do you meet the track requirements?
    * **Financial Fit:** ROI calculation (Salary / Tuition).
    * **Prestige Preference:** Adjustable slider (Budget vs. Prestige).

---

## 🛠 Tech Stack

**Frontend:**
- **Modular Vanilla JavaScript (ES6+)**: Logic split into `algo.js` (Math), `components.js` (UI), `pages.js` (Rendering).
- **Dynamic UI**: Dropdowns and inputs are generated based on API responses.

**Backend:**
- **FastAPI (Python)**: asynchronous API.
- **Endpoints**:
    - `GET /universities`: Search with smart filtering.
    - `GET /exams/config`: Source of truth for valid exams and ranges.
    - `POST /exams/validate`: Server-side validation of user scores.

---

## Smart Sorting Logic

1.  **Load Config:** Frontend fetches valid exams from Backend.
2.  **User Profile:** User saves scores (e.g., SAT: 1450, IELTS: 7.5).
3.  **Matching:**
    * The algorithm scans every **Admission Track** of a university.
    * If the user fits *any* track, the university is marked as "Qualified".
    * If the user fits a "Scholarship Track", a **Green Badge** is awarded.
    * If the user fits a "Direct Entry" track, a **Blue Badge** is awarded.

---

## Project structure

```text  
backend/
│
├── app/
│   ├── main.py              # FastAPI application entry point  
│   └── core/
│       └── validation.py    # whitelist of supported exams  
│
├── data/
│   └── universities.json    # dataset of universities (JSON)  
│   └── cities.json          # dataset of country:city (JSON)  
│
├── requirements.txt
└── venv/                    # Python virtual environment (not committed)

frontend/
│
├── index.html               # landing / main page  
├── universities.html        # universities list page (Smart Search)  
├── university.html          # university detail page (Tabs view)  
├── ranking.html             # NEW: Global Rankings Leaderboard
│
├── css/                     
│   ├── style.css            # global styles
│   ├── universities.css     
│   ├── university.css       
│   └── ranking.css          
│
├── javascript/              # NEW: Modular Logic (Refactored)
│   ├── main.js              # Entry point & Router
│   ├── algo.js              # AI Sorting & Math
│   ├── components.js        # Navbar, Profile Modal, Tabs
│   ├── pages.js             # Page rendering (Lists, Details)
│   └── utils.js             # Helpers & API fetchers
│
└── images/
    ├── logo.jpeg            # project logo  
    ├── logos/               # University logos (PNG, 1:1)  
    └── thumbnails/          # Campus covers (JPG, 16:9)
```

---

**How to run the backend**

1. Go to the backend directory:  
```bash
   cd backend
```

2. Create a virtual environment (one time):  
```bash
   python -m venv venv
```

3. Activate the virtual environment:  
   * **Windows:** venv\\Scripts\\activate  
   * **macOS / Linux:** source venv/bin/activate  
4. Install dependencies:  
```bash
   pip install -r requirements.txt
```
5. Run the backend server:  
```bash
   uvicorn app.main:app --reload --port 8000
```

The backend will be available at: http://127.0.0.1:8000

---

**How to run the frontend**

⚠️ **Important:** Do NOT open HTML files using file://. A local HTTP server is required.

### **Option A — VS Code Live Server (recommended)**

1. Open the frontend/ folder in VS Code.  
2. Install the **Live Server** extension.  
3. Right-click on universities.html → **Open with Live Server**.

### **Option B — Python HTTP server**

From the frontend/ directory:

```bash
python -m http.server 5500
```

Then open: http://127.0.0.1:5500/universities.html

---

**Smart Sorting & Ranking Logic**

The application uses a weighted algorithm to rank universities:

1. **Hard Filter:** Excludes universities where the user's score < exams_min.  
2. **Scoring & Weights:** Calculates a "Fit Score" based on user preference (Slider):
   * **Prestige Score:** Combines Global Rank (QS/THE) and Acceptance Rate.
   * **Budget Score:** Calculates affordability. If `Total Cost > User Budget`, a penalty is applied. However, if `financial_aid` is available, the penalty is mitigated.
   * **User Balance:** A slider allows the user to weigh **Prestige** vs. **Budget** (e.g., 80% Prestige priority / 20% Budget).
3. **Visualization:**  
   * 🔵 **Blue Badge:** "Budget exceeded, Grant available" (High recommendation).  
   * 🟣 **Purple Badge:** "Budget exceeded" (Warning).  
   * ✅ **Green Badge:** "Within Budget" or "Grant Available".

---

## ⚠️ Alpha Limitations
- **Currency:** All costs are displayed in USD for consistency, although local currencies (KZT, GBP, JPY) are used in respective countries.

---

**How to add a university**

### **1. Update JSON Data**

Edited backend/data/universities.json. The structure has been updated to support precise grant types and exam requirements.

**Example Entry:**

```json
{
   "id": "astana-it-university-kaz-astana",
   "name": "Astana IT University",
   "rank": 20,
   "student_count": 5426,
   "location": { "country": "Kazakhstan", "city": "Astana", "state": "" },
   "coordinates": { "lat": 51.0913, "lon": 71.4128 },
   "website": "https://astanait.edu.kz/",
   "academics": {
   "majors": ["Computer Science", "Software Engineering", "Big Data Analysis", "Cyber Security", "IT Management", "Smart Technologies"],
   "study_levels": ["Bachelor", "Master", "PhD"],
   "formats": ["On-campus"],
   "acceptance_rate_percent": 25
   },
   "finance": {
   "total_cost_year_usd": 7000,
   "application_fee_usd": 0,
   "financial_aid": { "merit_based": true, "need_based": true },
   "costs_breakdown_year_usd": {
      "Tuition": 5200,
      "Housing_Dorm": 1000,
      "Food": 500,
      "Books_Transport_Misc": 300
   }
   },
   "student_life": { "size": "medium" },
   "admission_tracks": [
   {
      "id": "aitu_unt",
      "label": "UNT Track (IT Major)",
      "study_mode": "On-campus",
      "requirements": {
         "UNT": 85,
         "GPA": 70
      },
      "stats_avg": {
         "UNT": 105,
         "GPA": 85
      },
      "scholarships": [
         {
         "name": "State Grant (Computer Science)",
         "type": "state",
         "requirements": { "UNT": 115, "GPA": 85 }
         },
         {
         "name": "Rector's Grant",
         "type": "merit",
         "requirements": { "UNT": 125 }
         }
      ]
   }
   ]
}
```
### **2. Add Images**

To ensure the UI looks correct, add images matching the id from the JSON:

* **Logo:** frontend/images/logos/harvard-usa-cambridge.png (Transparent PNG required)  
* **Cover:** frontend/images/thumbnails/harvard-usa-cambridge.jpg (1280x720 or 16:9 JPG)

---

**Future development**

Planned features for Beta:

* **User Accounts:** Saving the User Profile (GPA/Budget) to the database instead of local testing variables and add signing in by Google account.
* **Cloud Database:** Migration from JSON to PostgreSQL/MongoDB.

---

**Infomatrix Note**

This Beta version demonstrates a fully functional **Full-Stack Application** with implemented logic for **Intelligent Decision Support**. It moves beyond a simple directory by analyzing user data to provide context-aware results.
