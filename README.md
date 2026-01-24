# UniSearch — Alpha Version (Infomatrix 2026)

## Project description

**UniSearch** is a socially oriented web application designed to help school students and applicants choose suitable universities based on structured data and, in future versions, AI-based ranking.

The main goal of the project is to reduce inequality in access to educational information and eliminate the need for expensive educational consultants.

The project is developed for participation in **Infomatrix 2026**.

---

## Social significance

UniSearch helps:

- school students and applicants from different regions
- users without access to paid educational consultants
- users who want transparent and understandable university selection tools

The system is designed to support **Explainable AI** principles: future recommendations will be accompanied by clear explanations.

---

## Current stage (Alpha version)

The Alpha version demonstrates:

- a working FastAPI backend API
- a structured JSON-based dataset of universities
- a fully functional frontend connected to the backend
- university search, filtering, and pagination
- dynamic university detail pages loaded from the backend
- readiness for AI-based ranking logic

At this stage:

- no user authentication is implemented
- no cloud database is used
- university data is stored in a structured JSON file

---

## Project structure

```
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
│
├── index.html               # landing / main page
├── universities.html        # universities list page (filters + cards)
├── university.html          # university detail page
│
├── style.css                # global styles
├── universities.css         # universities page styles
├── university.css           # university detail styles
├── script.js                # frontend logic (API interaction)
│
└── images/
    └── logo.jpeg            # project logo
```

---

## How to run the backend

1. Go to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (one time):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:

   **Windows:**
   ```bash
   venv\Scripts\activate
   ```

   **macOS / Linux:**
   ```bash
   source venv/bin/activate
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

The backend will be available at:

- http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs

---

## How to run the frontend

> ⚠️ **Important:** Do NOT open HTML files using `file://`. A local HTTP server is required.

### Option A — VS Code Live Server (recommended)

1. Open the `frontend/` folder in VS Code
2. Install the **Live Server** extension
3. Right-click on `universities.html` → **Open with Live Server**
4. The site will open at:
   ```
   http://127.0.0.1:5500/universities.html
   ```

### Option B — Python HTTP server

From the `frontend/` directory:

```bash
python -m http.server 5500
```

Open in browser:

- http://127.0.0.1:5500/universities.html

---

## API endpoints (Alpha)

### GET /universities

Returns a list of universities with filtering, sorting, and pagination.

Supported query parameters include:

- `q` - search by university name (contains)
- `country`, `city`, `state`
- `major` (contains in `academics.majors`)
- `study_level` (exact match in `academics.study_levels`)
- `format` (exact match in `academics.formats`)
- `min_tuition`, `max_tuition` (USD)
- `min_acceptance`, `max_acceptance` (percent)
- `min_gpa`, `max_gpa`
- `min_ielts`, `max_ielts`
- `size` (exact match in `student_life.size`)
- `sort`, `page`, `limit`

Example:
```
GET http://127.0.0.1:8000/universities?q=Computer&country=USA
```

---

### GET /universities/{id}

Returns full information about a single university.

Example:
```
GET http://127.0.0.1:8000/universities/test-university-usa-nyc
```

---

### GET /

Health check endpoint.

Example:
```
GET http://127.0.0.1:8000/
```

## How to add a university

Universities are stored in:

```
backend/data/universities.json
```

The file is a JSON array of university objects.

Example entry:

```json
{
  "id": "test-university-usa-nyc",
  "name": "Test University",
  "location": {
    "country": "USA",
    "city": "New York",
    "state": "NY"
  },
  "academics": {
    "majors": ["Computer Science"],
    "study_levels": ["Bachelor"],
    "formats": ["On-campus"],
    "acceptance_rate_percent": 40
  },
  "finance": {
    "tuition_year_usd": 15000,
    "application_fee_usd": 60
  },
  "student_life": {
    "size": "medium"
  },
  "exams_avg": {
    "GPA": 75,
    "IELTS": 6.0
  }
}
```

Rules:

- `id` must be unique
- all prices must be in USD
- acceptance_rate_percent must be between 1 and 100
- the file must remain valid JSON

After editing the file, restart the backend server.

---

## Exam validation

Supported exams and score ranges are defined in:

```
backend/app/core/validation.py
```

This whitelist protects the system from invalid or unsupported exam data.

---

## Future development

Planned features:

- AI-based university ranking and scoring
- Explainable AI recommendation logic
- User accounts and authentication
- Cloud database integration
- Admission probability estimation

---

## Infomatrix note

This Alpha version focuses on demonstrating:

- a working full-stack architecture
- structured and extendable educational dataset
- real-time frontend–backend interaction
- readiness for AI-based logic

The project is designed to be realistic, scalable, and understandable for both users and judges.

