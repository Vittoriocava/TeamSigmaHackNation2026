from app.db import supabase


async def award_coins(user_id: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    """Add coins to user balance and record transaction."""
    current = supabase.table("coins").select("balance, lifetime_earned").eq("user_id", user_id).single().execute()
    new_balance = current.data["balance"] + amount
    new_lifetime = current.data["lifetime_earned"] + amount
    supabase.table("coins").update({
        "balance": new_balance,
        "lifetime_earned": new_lifetime,
    }).eq("user_id", user_id).execute()

    supabase.table("coin_transactions").insert({
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "ref_id": ref_id,
    }).execute()

    return new_balance


async def spend_coins(user_id: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    """Deduct coins from user balance. Raises ValueError if insufficient."""
    current = supabase.table("coins").select("balance").eq("user_id", user_id).single().execute()
    if current.data["balance"] < amount:
        raise ValueError("Monete insufficienti")

    new_balance = current.data["balance"] - amount
    supabase.table("coins").update({"balance": new_balance}).eq("user_id", user_id).execute()

    supabase.table("coin_transactions").insert({
        "user_id": user_id,
        "amount": -amount,
        "reason": reason,
        "ref_id": ref_id,
    }).execute()

    return new_balance


async def get_balance(user_id: str) -> int:
    result = supabase.table("coins").select("balance").eq("user_id", user_id).single().execute()
    return result.data["balance"]
