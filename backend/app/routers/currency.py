from fastapi import APIRouter, Response

from app.services import currency as currency_service


router = APIRouter(tags=["currency"])


@router.get(
    "/currency/rates",
    summary="Currency exchange rates and filter limits",
    description="Returns current exchange rates relative to USD, date, data source, and filter limits per currency.",
)
def get_currency_rates(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=3600"

    rates_info = currency_service.get_rates()
    filter_limits = currency_service.load_filter_limits_config()

    return {
        "rates": rates_info.get("rates", {}),
        "date": rates_info.get("date", ""),
        "source": rates_info.get("source", "unknown"),
        "filter_limits": filter_limits,
    }


@router.get(
    "/currency/status",
    summary="Currency service status",
    description="Returns runtime health and circuit breaker status of the currency service.",
)
def get_currency_status():
    return currency_service.get_rates_status()
