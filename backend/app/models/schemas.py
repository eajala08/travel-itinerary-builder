from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_TRIP_DAYS = 14


class Coordinates(BaseModel):
    lat: float
    lng: float


class GeocodeResult(BaseModel):
    lat: float
    lng: float
    display_name: str


class Preferences(BaseModel):
    pace: str = "moderate"  # relaxed | moderate | packed
    tourist_level: str = "mixed"  # touristy | mixed | local
    walking: str = "moderate"  # avoid | moderate | lots


class TripInput(BaseModel):
    destination: str = Field(max_length=200)
    start_date: str
    end_date: str
    budget: float = Field(gt=0)
    travelers: int = Field(default=1, ge=1, le=50)
    interests: dict[str, int] = Field(default_factory=dict)  # e.g. {"food": 10, "culture": 8}
    preferences: Preferences = Field(default_factory=Preferences)
    notes: str = Field(default="", max_length=2000)

    @field_validator("destination")
    @classmethod
    def _destination_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Destination is required")
        return value

    @field_validator("start_date", "end_date")
    @classmethod
    def _iso_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value

    @model_validator(mode="after")
    def _date_range(self) -> "TripInput":
        days = (date.fromisoformat(self.end_date) - date.fromisoformat(self.start_date)).days + 1
        if days < 1:
            raise ValueError("End date must be on or after the start date")
        if days > MAX_TRIP_DAYS:
            raise ValueError(f"Trips are limited to {MAX_TRIP_DAYS} days")
        return self

    @property
    def num_days(self) -> int:
        return (date.fromisoformat(self.end_date) - date.fromisoformat(self.start_date)).days + 1


class Candidate(BaseModel):
    id: str
    name: str
    type: str  # restaurant | temple | museum | market | shopping | park | other
    lat: float
    lng: float
    tags: dict[str, str] = Field(default_factory=dict)
    source: str = "overpass"
    score: Optional[float] = None
    cluster_day: Optional[int] = None


class WeatherDay(BaseModel):
    date: str
    condition: str
    temp_c: float
    precipitation_probability: float
    advice: str = ""


class Activity(BaseModel):
    time: str
    name: str
    type: str
    description: str
    address: str = ""
    lat: float
    lng: float
    duration: str = ""
    estimated_cost: float = 0


class Meal(BaseModel):
    time: str
    type: str  # breakfast | lunch | dinner
    name: str
    cuisine: str = ""
    address: str = ""
    lat: float
    lng: float
    budget: float = 0
    why: str = ""


class DailySpend(BaseModel):
    food: float = 0
    activities: float = 0
    transport: float = 0
    total: float = 0


class DayItinerary(BaseModel):
    day: int
    date: str
    theme: str
    activities: list[Activity] = Field(default_factory=list)
    meals: list[Meal] = Field(default_factory=list)
    weather: Optional[WeatherDay] = None
    daily_spend: DailySpend = Field(default_factory=DailySpend)
    travel_tips: str = ""


class BudgetBreakdown(BaseModel):
    food: float = 0
    activities: float = 0
    transport: float = 0
    shopping: float = 0
    buffer: float = 0


class ItineraryResponse(BaseModel):
    destination: str
    dates: list[str]
    duration_days: int
    total_budget: float
    estimated_spend: float
    budget_breakdown: BudgetBreakdown
    itinerary: list[DayItinerary]
    map_pins: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class EditRequest(BaseModel):
    itinerary: ItineraryResponse
    instruction: str = Field(min_length=1, max_length=1000)
    target_day: Optional[int] = None
