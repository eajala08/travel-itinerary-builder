from typing import Optional

from pydantic import BaseModel, Field


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
    destination: str
    start_date: str
    end_date: str
    budget: float
    travelers: int = 1
    interests: dict[str, int] = Field(default_factory=dict)  # e.g. {"food": 10, "culture": 8}
    preferences: Preferences = Field(default_factory=Preferences)
    notes: str = ""


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
    instruction: str
    target_day: Optional[int] = None
