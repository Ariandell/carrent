import psycopg
from psycopg import sql

def create_database():
    print("Attempting to connect to PostgreSQL...")
    conn = None
    try:
        # Try with password 'postgres'
        conn = psycopg.connect("dbname=postgres user=postgres password=postgres host=localhost", autocommit=True)
    except Exception as e:
        print(f"Connection with password 'postgres' failed: {e}")
        try:
            # Try without password
            conn = psycopg.connect("dbname=postgres user=postgres host=localhost", autocommit=True)
        except Exception as e2:
             print(f"Connection without password failed: {e2}")
             print("Please check your PostgreSQL credentials and ensure the server is running.")
             return

    if conn:
        print("Connected!")
        cur = conn.cursor()
        
        # Check if db exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'fpv_racer'")
        if cur.fetchone():
            print("Database fpv_racer already exists.")
        else:
            print("Creating database fpv_racer...")
            cur.execute("CREATE DATABASE fpv_racer")
            print("Database created!")
        
        conn.close()

if __name__ == "__main__":
    create_database()
