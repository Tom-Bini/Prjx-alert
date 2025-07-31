import sqlite3
import requests
from datetime import datetime, timezone
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "wallets.db")

def fetch_stats(address):
    url = f"https://server.hybra.finance/api/points/user/{address}"
    try:
        response = requests.get(url, headers={"Accept": "*/*"})
        data = response.json()["data"]
        return data["totalPoints"], data["rank"]
    except Exception as e:
        print(f"❌ Erreur pour {address} : {e}")
        return None, None

def main():
    timestamp = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS wallet_stats (
            address TEXT,
            total_points REAL,
            rank INTEGER,
            timestamp TEXT,
            PRIMARY KEY (address, timestamp)
        )
    """)

    c.execute("SELECT address FROM wallets")
    addresses = [row[0] for row in c.fetchall()]

    for address in addresses:
        total_points, rank = fetch_stats(address)
        if total_points is not None and rank is not None:
            c.execute("""
                INSERT OR REPLACE INTO wallet_stats (address, total_points, rank, timestamp)
                VALUES (?, ?, ?, ?)
            """, (address, total_points, rank, timestamp))
            print(f"✅ {address} → {total_points} pts, rank {rank}")

    conn.commit()
    conn.close()
    

def fix_permissions():
    try:
        os.chown(DB_PATH, 33, 33)
        os.chmod(DB_PATH, 0o664)

        for ext in [".db-wal", ".db-shm"]:
            path = DB_PATH + ext
            if os.path.exists(path):
                os.chown(path, 33, 33)
                os.chmod(path, 0o664)

        print("🛠️ Permissions corrigées.")
    except Exception as e:
        print(f"⚠️ Impossible de changer les permissions : {e}")


if __name__ == "__main__":
    main()
    fix_permissions()