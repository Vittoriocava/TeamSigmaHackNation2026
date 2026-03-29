from app.db import get_db, row_to_dict


def _ensure_coins_row(conn, user_id: str):
    conn.execute(
        "INSERT OR IGNORE INTO coins (user_id, balance, lifetime_earned) VALUES (?, 0, 0)",
        (user_id,),
    )


async def award_coins(user_id: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    """Add coins to user balance and record transaction."""
    with get_db() as conn:
        _ensure_coins_row(conn, user_id)
        row = conn.execute(
            "SELECT balance, lifetime_earned FROM coins WHERE user_id = ?", (user_id,)
        ).fetchone()
        new_balance = row["balance"] + amount
        new_lifetime = row["lifetime_earned"] + amount
        conn.execute(
            "UPDATE coins SET balance = ?, lifetime_earned = ? WHERE user_id = ?",
            (new_balance, new_lifetime, user_id),
        )
        conn.execute(
            "INSERT INTO coin_transactions (user_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)",
            (user_id, amount, reason, ref_id),
        )
    return new_balance


async def spend_coins(user_id: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    """Deduct coins from user balance. Raises ValueError if insufficient."""
    with get_db() as conn:
        _ensure_coins_row(conn, user_id)
        row = conn.execute(
            "SELECT balance FROM coins WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row["balance"] < amount:
            raise ValueError("Monete insufficienti")
        new_balance = row["balance"] - amount
        conn.execute(
            "UPDATE coins SET balance = ? WHERE user_id = ?", (new_balance, user_id)
        )
        conn.execute(
            "INSERT INTO coin_transactions (user_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)",
            (user_id, -amount, reason, ref_id),
        )
    return new_balance


async def get_balance(user_id: str) -> int:
    with get_db() as conn:
        _ensure_coins_row(conn, user_id)
        row = conn.execute(
            "SELECT balance FROM coins WHERE user_id = ?", (user_id,)
        ).fetchone()
        return row["balance"]
