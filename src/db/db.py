from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os
from dotenv import load_dotenv


class DatabaseConnection:
    def __init__(self):
        load_dotenv(override=True)

        host = os.getenv("SQL_DB_HOST")
        port = os.getenv("SQL_DB_PORT")
        user = os.getenv("SQL_DB_USER")
        password = os.getenv("SQL_DB_PASSWORD")
        database = os.getenv("SQL_DB_NAME")

        connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"

        self.engine = create_engine(
            connection_string,
        )

        self.session_factory = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False,
        )

    @contextmanager
    def get_session(self):
        session = self.session_factory()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def dispose(self):
        self.engine.dispose()


db_connection: DatabaseConnection = DatabaseConnection()
