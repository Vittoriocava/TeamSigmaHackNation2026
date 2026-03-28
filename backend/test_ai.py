import asyncio
from app.services.ai import get_client, _model

async def test_llm():
    print("Test connessione IA in corso...")
    try:
        client = get_client()
        response = client.chat.completions.create(
            model=_model(),
            max_tokens=50,
            messages=[{"role": "user", "content": "Rispondi solo con 'OK' se mi senti."}]
        )
        print("✅ Successo! Risposta dall'IA:")
        print(response.choices[0].message.content)
    except Exception as e:
        print("❌ Errore durante la chiamata all'API:")
        print(e)

if __name__ == "__main__":
    asyncio.run(test_llm())