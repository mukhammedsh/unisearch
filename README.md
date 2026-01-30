# UniSearch — Alpha Version (Infomatrix 2026)

## Project description

**UniSearch** is a socially oriented web application designed to help school students and applicants choose suitable universities based on structured data and **AI-based Smart Ranking**.

The main goal of the project is to reduce inequality in access to educational information, eliminate the need for expensive educational consultants, and provide personalized recommendations based on the applicant's budget and academic profile.

The project is developed for participation in **Infomatrix 2026**.

---

## Social significance & AI Integration

UniSearch helps:
- **Personalize the search:** The "Smart Sort" algorithm ranks universities not just by popularity, but by how well they fit the specific user (Budget + Exams).
- **Visualize complex data:** Clear separation of Merit-based vs. Need-based aid helps students understand their real financial options.
- **Explainable logic:** Color-coded badges (Blue/Purple/Green) explain *why* a university matches or exceeds the budget.

---

## Latest Updates (v1.2)

### Database Improvements
- **Ranking:**
    - Added rank parameter, for ranking universities

---

## 🛠 Tech Stack

**Frontend:**
- **Modular Vanilla JavaScript (ES6+)**: Developed without heavy frameworks using ES modules. Logic is split into specialized files (`algo.js`, `components.js`, `pages.js`) for better maintainability.
- **CSS Variables**: Used for consistent theming and responsive design.

**Backend:**
- **FastAPI (Python)**: High-performance asynchronous framework for building APIs.
- **Pydantic**: Used for strict data validation and type safety.

**Data:**
- **JSON-based NoSQL approach**: A flexible schema designed to store complex hierarchical data (universities -> academics -> majors).

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

Edit backend/data/universities.json. The structure has been updated to support precise grant types and exam requirements.

**Example Entry:**

```json
{
   "id": "eth-zurich-ch-zurich",
   "name": "ETH Zurich",
   "rank": 7,
   "student_count": 26198,
   "location": { "country": "Switzerland", "city": "Zurich", "state": "" },
   "website": "https://ethz.ch/en.html",
   "academics": {
   "majors": ["Architecture", "Engineering", "Chemistry", "Physics", "Computer Science", "Mathematics"],
   "study_levels": ["Bachelor", "Master", "PhD"],
   "formats": ["On-campus"],
   "acceptance_rate_percent": 27
   },
   "finance": {
   "total_cost_year_usd": 28000,
   "application_fee_usd": 150,
   "financial_aid": { "merit_based": true, "need_based": true },
   "costs_breakdown_year_usd": {
      "Tuition": 1800,
      "Housing_Rent": 13000,
      "Food": 9000,
      "Insurance_Transport_Misc": 4200
   }
   },
   "student_life": { "size": "large" },
   "exams_avg": { "GPA": 90, "IELTS": 7.5 },
   "exams_min": { "GPA": 80, "IELTS": 7.0 }
}
```
### **2. Add Images**

To ensure the UI looks correct, add images matching the id from the JSON:

* **Logo:** frontend/images/logos/harvard-usa-cambridge.png (Transparent PNG recommended)  
* **Cover:** frontend/images/thumbnails/harvard-usa-cambridge.jpg (1280x720 or 16:9 JPG)

---

**Future development**

Planned features for Beta:

* **User Accounts:** Saving the User Profile (GPA/Budget) to the database instead of local testing variables. 
* **Cloud Database:** Migration from JSON to PostgreSQL/MongoDB.

---

**Infomatrix note**

This Alpha version demonstrates a fully functional **Full-Stack Application** with implemented logic for **Intelligent Decision Support**. It moves beyond a simple directory by analyzing user data to provide context-aware results.