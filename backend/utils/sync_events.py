from sqlalchemy import create_engine
from googlePlaces import sync_google_places
from ticketMaster import sync_ticketmaster_events
import os
import sys
from dotenv import load_dotenv

load_dotenv()
db_username = os.getenv("DB_USER")
db_password = os.getenv("PASSWORD")
db_host = os.getenv("HOST")
db_port = os.getenv("PORT")
db_name = os.getenv("DB_NAME")
database_url = f"postgresql+psycopg2://{db_username}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"
engine = create_engine(database_url, pool_pre_ping=True, connect_args={"options": "-c statement_timeout=30000"}, execution_options={"no_parameters": True}, pool_size=20, max_overflow=0)

# Places barely change and the Google API is billed, so only sync them when asked: python sync_events.py --places
if "--places" in sys.argv:
    sync_google_places(engine, college_key="ohio_state")
count = sync_ticketmaster_events(engine, college_key="ohio_state")
print(f"Synced {count} Ticketmaster events")
if count == 0:
    sys.exit("No Ticketmaster events synced - check the API key and DB settings")
