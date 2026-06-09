from pathlib import Path

from alembic.config import Config

from alembic import command

API_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_INI = API_DIR / "alembic.ini"


def upgrade_database(database_url: str, revision: str = "head") -> None:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(config, revision)

