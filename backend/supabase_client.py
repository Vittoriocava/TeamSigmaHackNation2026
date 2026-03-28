from supabase import create_client, Client
from config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError(
                "SUPABASE_URL e SUPABASE_SERVICE_KEY richiesti. "
                "Copia .env.example in .env e configura le chiavi."
            )
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


# Lazy property — modules import `supabase` but it's resolved at first use
class _LazySupabase:
    def __getattr__(self, name: str):
        return getattr(get_supabase(), name)


supabase: Client = _LazySupabase()  # type: ignore[assignment]
