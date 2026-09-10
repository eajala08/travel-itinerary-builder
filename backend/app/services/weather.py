import httpx

from app.models.schemas import WeatherDay

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes -> human-readable condition
_WEATHER_CODES: dict[int, str] = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
}


def _condition_for_code(code: int) -> str:
    return _WEATHER_CODES.get(code, "Unknown")


def _advice_for(condition: str, temp_c: float, precip_prob: float) -> str:
    if precip_prob >= 50 or "rain" in condition.lower() or "drizzle" in condition.lower():
        return "Bring an umbrella or rain jacket"
    if temp_c >= 28:
        return "Stay hydrated, wear sunscreen"
    if temp_c <= 10:
        return "Bring warm layers"
    return "Light layers should be comfortable"


async def get_forecast(lat: float, lng: float, start_date: str, end_date: str) -> list[WeatherDay]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            OPEN_METEO_URL,
            params={
                "latitude": lat,
                "longitude": lng,
                "daily": "weathercode,temperature_2m_max,precipitation_probability_max",
                "timezone": "auto",
                "start_date": start_date,
                "end_date": end_date,
            },
        )
    response.raise_for_status()
    daily = response.json().get("daily", {})
    dates = daily.get("time", [])
    codes = daily.get("weathercode", [])
    temps = daily.get("temperature_2m_max", [])
    precips = daily.get("precipitation_probability_max", [])

    days: list[WeatherDay] = []
    for i, date in enumerate(dates):
        code = codes[i] if i < len(codes) else 0
        temp = temps[i] if i < len(temps) else 20.0
        precip = precips[i] if i < len(precips) else 0.0
        condition = _condition_for_code(code)
        days.append(
            WeatherDay(
                date=date,
                condition=condition,
                temp_c=temp,
                precipitation_probability=precip,
                advice=_advice_for(condition, temp, precip),
            )
        )
    return days
