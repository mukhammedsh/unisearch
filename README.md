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
- **Vanilla JavaScript (ES6+)**: Developed without heavy frameworks for maximum performance and deep understanding of DOM manipulation.
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
│
├── requirements.txt
└── venv/                    # Python virtual environment (not committed)

frontend/
├── cities.json              # contains all cities and countries for filter (JSON)
│
├── index.html               # landing / main page  
├── universities.html        # universities list page (Smart Search)  
├── university.html          # university detail page (Tabs view)  
│
├── style.css                # global styles  
├── universities.css         # universities list & card styles  
├── university.css           # university detail & tabs styles  
├── script.js                # frontend logic (AI sorting, API interaction)  
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
2. **Scoring:** Calculates a "Fit Score":  
   * **Academic Fit:** Points awarded for exceeding the exams_avg (GPA, IELTS, SAT).  
   * **Financial Fit:** Points deducted if Total Cost > User Budget.  
   * **Grant Mitigation:** If the budget is exceeded but financial_aid is available, the penalty is significantly reduced (Smart Recommendation).  
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
   "id": "stanford-university-usa-ca",
   "name": "Stanford University",
   "rank": 6,
   "location": { "country": "USA", "city": "Stanford", "state": "California" },
   "website": "https://www.stanford.edu/",
   "academics": {
      "majors": ["Computer Science", "Engineering", "Business", "Biology", "Psychology", "Earth Sciences"],
      "study_levels": ["Bachelor", "Master", "PhD"],
      "formats": ["On-campus", "Online"],
      "acceptance_rate_percent": 4
   },
   "finance": {
      "total_cost_year_usd": 82000,
      "application_fee_usd": 90,
      "financial_aid": { "merit_based": false, "need_based": true },
      "costs_breakdown_year_usd": {
         "Tuition": 62000,
         "Housing_Dorm": 12000,
         "Food": 7500,
         "Books_Transport_Misc": 500
      }
   },
   "student_life": { "size": "large" },
   "exams_avg": { "GPA": 99, "IELTS": 8.0, "SAT": 1560 },
   "exams_min": { "GPA": 97, "IELTS": 7.5, "SAT": 1500 }
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