import sqlite3

conn = sqlite3.connect("wallets.db")
c = conn.cursor()

c.execute('''
    CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        created_at TEXT
    )
''')

conn.commit()
conn.close()
print("✅ Table `wallets` créée avec succès.")
