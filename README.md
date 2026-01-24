UniSearch — Alpha Version (Infomatrix 2026)

Project description
-------------------
UniSearch is a socially oriented AI-based web application designed to help school students and applicants choose suitable universities based on their personal data.

The main goal of the project is to reduce inequality in access to educational information and eliminate the need for expensive educational consultants.

The project is developed for participation in Infomatrix 2026.


Social significance
-------------------
UniSearch helps:
- school students and applicants from different regions
- users without access to paid educational consultants
- users who want transparent and understandable university recommendations

The system explains why specific universities are recommended, following the principles of Explainable AI.


Current stage (Alpha version)
-----------------------------
The Alpha version demonstrates:
- a working backend API
- a structured dataset of universities
- automatic delivery of data to the frontend
- readiness for AI-based ranking logic

At this stage:
- no user authentication is used
- no cloud database is used
- university data is stored in a structured JSON file


Project structure
-----------------
backend/
  app/
    main.py              - FastAPI backend entry point
    core/
      validation.py      - whitelist of supported exams
  data/
    universities.json    - dataset of universities (JSON)
  venv/                  - Python virtual environment (not committed)
  requirements.txt


How to run the backend
----------------------

1. Go to the backend directory:
   cd backend

2. Create a virtual environment (one time):
   python -m venv venv

3. Activate the virtual environment:
   Windows:
   venv\Scripts\activate

   macOS / Linux:
   source venv/bin/activate

4. Install dependencies:
   pip install -r requirements.txt

5. Run the backend server:
   uvicorn app.main:app --reload

The backend will be available at:
- http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs


How to add a university
-----------------------

Universities are stored in the file:
backend/data/universities.json

This file is a JSON array of university objects.

Example university entry:

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

Rules:
- id must be unique
- all prices must be in USD
- acceptance_rate_percent must be between 1 and 100
- the file must remain valid JSON

After editing the file, restart the backend if needed.


API endpoints (Alpha)
---------------------

GET /universities
Returns a list of universities.

Optional query parameter:
- limit: maximum number of universities returned

Example:
GET http://127.0.0.1:8000/universities?limit=10


Exam validation
---------------

Supported exams and score ranges are defined in:
app/core/validation.py

This whitelist protects the system from invalid or non-existent exams.


Future development
------------------
Planned features:
- AI-based university ranking (scoring)
- Explainable AI explanations for recommendations
- Google authentication
- Cloud database (Firestore)
- Probability estimation of admission


Infomatrix note
---------------
This Alpha version focuses on demonstrating:
- working backend architecture
- structured educational dataset
- readiness for AI logic
- clear social orientation

The project is designed to be realistic, scalable, and understandable for both users and judges.

