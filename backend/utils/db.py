from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

load_dotenv('.env')

db_username = os.getenv("DB_USER")
db_password = os.getenv("PASSWORD")
db_host = os.getenv("HOST")
db_port = os.getenv("PORT")
db_name = os.getenv("DB_NAME")

database_url = f"postgresql+psycopg2://{db_username}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

# One engine for the whole app. NullPool: Supabase's pooler already pools, and serverless instances
# shouldn't each hold idle connections open.
engine = create_engine(database_url, poolclass=NullPool, connect_args={"options": "-c statement_timeout=30000"}, execution_options={"no_parameters": True})
