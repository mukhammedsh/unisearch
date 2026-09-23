from typing import Any, Dict, List, Optional, Set


US_ALIASES: Set[str] = {
    "US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA", "U.S.", "U.S.A.",
    "AMERICAN",
}
UK_ALIASES: Set[str] = {
    "UK", "GB", "GBR", "UNITED KINGDOM", "GREAT BRITAIN", "ENGLAND",
    "SCOTLAND", "WALES", "NORTHERN IRELAND", "BRITISH",
}
def normalize_country_token(value: Optional[str]) -> str:
    return str(value or "").strip().upper()


def resolve_citizenship_status(
    university_country: str,
    applicant_citizenships: List[str],
) -> Dict[str, Any]:
    """Summarize nationality overlap without inferring legal fee or aid eligibility.

    Tuition classification and financial aid eligibility can depend on residence,
    immigration status, course, and other criteria that this profile does not hold.
    """
    country = normalize_country_token(university_country)
    citizenships = [normalize_country_token(value) for value in applicant_citizenships if value]
    country_aliases = US_ALIASES if country in US_ALIASES else UK_ALIASES if country in UK_ALIASES else set()
    matches = bool(country_aliases.intersection(citizenships)) if citizenships else None

    return {
        "status": "unknown",
        "fee_category": "unknown",
        "label": "Nationality alone does not determine fee status",
        "financial_aid_policy": "unknown",
        "financial_aid_label": "Check official eligibility rules",
        "federal_aid_eligible": None,
        "student_finance_eligible": None,
        "citizenship_matches_country": matches if country_aliases else None,
        "notes": (
            "Nationality overlaps with the university country; residence and other criteria are needed to assess fee or aid eligibility."
            if matches
            else "Nationality alone cannot establish fee category or financial aid eligibility. Check the university and government rules for this course."
        ),
    }
