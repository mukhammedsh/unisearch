from app.services.universities import _sanitize_public_source_urls


def test_sanitize_college_scorecard_api_key_in_public_source_urls():
    payload = {
        "source_url": (
            "https://api.data.gov/ed/collegescorecard/v1/schools?"
            "api_key=private-key&id=110404&fields=school.name"
        ),
        "sources": [
            {
                "url": (
                    "https://api.data.gov/ed/collegescorecard/v1/schools?"
                    "id=110404&api_key=another-private-key&fields=school.name"
                )
            },
            {"url": "https://example.edu/admissions?api_key=private-key"},
        ],
    }

    sanitized = _sanitize_public_source_urls(payload)

    assert "api_key=private-key" not in sanitized["source_url"]
    assert "api_key=DEMO_KEY" in sanitized["source_url"]
    assert "api_key=another-private-key" not in sanitized["sources"][0]["url"]
    assert "api_key=DEMO_KEY" in sanitized["sources"][0]["url"]
    assert sanitized["sources"][1]["url"] == "https://example.edu/admissions?api_key=private-key"


def test_sanitize_keeps_existing_public_demo_key_url_unchanged():
    url = (
        "https://api.data.gov/ed/collegescorecard/v1/schools?"
        "api_key=DEMO_KEY&id=110404&fields=school.name"
    )

    assert _sanitize_public_source_urls(url) == url
