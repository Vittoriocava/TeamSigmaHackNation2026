from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserProfile(BaseModel):
    user_id: str = ""
    interests: list[str] = []
    age_range: str = ""
    cultural_level: str = "casual"
    language: str = "it"
    pace: str = "medium"


class POI(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    category: str = ""
    description: str = ""
    relevance_score: float = 0.0
    estimated_cost: str = "gratuito"
    estimated_duration: int = 30
    crowd_level: str = "medio"
    hidden_gem: bool = False
    why_for_you: str = ""
    wikipedia_url: str = ""
    wikidata_id: str = ""


class ItineraryStop(BaseModel):
    poi_id: str
    poi_name: str = ""
    arrival_time: str = ""
    duration_min: int = 30
    how_to_get_here: str = ""
    transport: str = "piedi"
    notes: str = ""


class ItineraryDay(BaseModel):
    day: int
    theme: str = ""
    stops: list[ItineraryStop] = []


class BoardStop(BaseModel):
    poi: POI
    type: str = "quiz"  # story, quiz, challenge, curiosity, connection, ar, geoguessr
    content: dict = {}
    completed: bool = False


class GameBoard(BaseModel):
    id: str = ""
    city: str
    city_slug: str = ""
    mode: str = "solo"
    stops: list[BoardStop] = []


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    difficulty: str = "medium"
    source: str = ""
    poi_id: str = ""
    explanation: str = ""


class Territory(BaseModel):
    id: str = ""
    poi_id: str
    user_id: str
    city_slug: str = ""
    conquered_at: Optional[datetime] = None
    last_defended_at: Optional[datetime] = None
    tier: int = 1
    weeks_held: int = 0
    active: bool = True


class NarrationRequest(BaseModel):
    poi_id: str
    poi_name: str
    city: str
    mode: str = "on_demand"  # on_demand, proximity, radar
    wikipedia_excerpt: str = ""
    wikidata_facts: str = ""
    user_profile: UserProfile = Field(default_factory=UserProfile)


class TimelineImage(BaseModel):
    poi_id: str
    era_label: str
    image_url: str
    dalle_prompt: str = ""


class SwipeRequest(BaseModel):
    poi_id: str
    liked: bool


class QuizAnswer(BaseModel):
    question_hash: str
    answer_index: int
    time_ms: int = 0


class CreateGameRequest(BaseModel):
    city: str
    mode: str = "solo"
    duration_days: int = 1
    budget: str = "medio"
    profile: UserProfile = Field(default_factory=UserProfile)


class ConquerRequest(BaseModel):
    poi_id: str
    city_slug: str
    lat: float
    lng: float


class ProfileInferRequest(BaseModel):
    quiz_answers: list[dict] = []
    swipe_batch: list[SwipeRequest] = []
