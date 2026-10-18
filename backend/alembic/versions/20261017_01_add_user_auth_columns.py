
"""Add missing user authentication columns.

Revision ID: 20261017_01
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20261017_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Confirm the existing table has the expected baseline columns.
    conn = op.get_bind()
    columns = {
        column["name"]
        for column in sa.inspect(conn).get_columns("users")
    }

    required_existing = {
        "id",
        "username",
        "email",
        "hashed_password",
        "role",
        "created_at",
    }
    missing_existing = required_existing - columns

    if missing_existing:
        raise RuntimeError(
            f"Unexpected users schema; missing baseline columns: "
            f"{sorted(missing_existing)}"
        )

    # Add only columns that are currently missing.
    if "full_name" not in columns:
        op.add_column(
            "users",
            sa.Column("full_name", sa.String(length=120), nullable=True),
        )

    if "phone_e164" not in columns:
        op.add_column(
            "users",
            sa.Column("phone_e164", sa.String(length=20), nullable=True),
        )

    if "email_verified_at" not in columns:
        op.add_column(
            "users",
            sa.Column("email_verified_at", sa.DateTime(), nullable=True),
        )

    if "phone_verified_at" not in columns:
        op.add_column(
            "users",
            sa.Column("phone_verified_at", sa.DateTime(), nullable=True),
        )

    if "status" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'pending'"),
            ),
        )

    if "token_version" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "token_version",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )

    if "updated_at" not in columns:
        op.add_column(
            "users",
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # Refresh the schema after adding columns.
    indexes = {
        index["name"]
        for index in sa.inspect(conn).get_indexes("users")
    }

    if "ix_users_phone_e164" not in indexes:
        op.create_index(
            "ix_users_phone_e164",
            "users",
            ["phone_e164"],
            unique=True,
        )

    if "uq_users_email_lower" not in indexes:
        duplicates = conn.execute(
            text("""
                SELECT lower(email)
                FROM users
                GROUP BY lower(email)
                HAVING COUNT(*) > 1
                LIMIT 1
            """)
        ).first()

        if duplicates:
            raise RuntimeError(
                "Cannot create case-insensitive unique email index: "
                "duplicate email values were found."
            )

        op.create_index(
            "uq_users_email_lower",
            "users",
            [sa.text("lower(email)")],
            unique=True,
        )


def downgrade():
    # Remove only the indexes and columns introduced by this migration.
    op.drop_index(
        "uq_users_email_lower",
        table_name="users",
    )
    op.drop_index(
        "ix_users_phone_e164",
        table_name="users",
    )

    op.drop_column("users", "updated_at")
    op.drop_column("users", "token_version")
    op.drop_column("users", "status")
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "phone_e164")
    op.drop_column("users", "full_name")
