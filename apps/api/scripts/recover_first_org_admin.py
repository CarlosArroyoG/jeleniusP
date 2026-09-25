"""Operator-only recovery. Run from apps/api with python -m scripts.recover_first_org_admin.

Default mode is read-only audit. Never creates users, memberships, or roles.
"""

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone

from sqlalchemy import func, or_, text, update
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.roles import Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_ROLE_ID


class RecoveryError(Exception):
    """A safe, operator-readable refusal (never include credentials)."""


async def audit(session, *, org_id=None, org_slug=None, email=None):
    if org_id is None and not org_slug:
        raise RecoveryError("Specify --org-id or --org-slug (prefer both).")
    query = select(Organization.id, Organization.slug, Organization.name, Organization.org_uuid)
    if org_id is not None:
        query = query.where(Organization.id == org_id)
    if org_slug:
        query = query.where(Organization.slug == org_slug)
    orgs = (await session.execute(query)).mappings().all()
    if len(orgs) != 1:
        raise RecoveryError("Organization not found or selector is ambiguous/mismatched.")
    org = dict(orgs[0])

    # Select only these fields: never fetch or serialize password/hash columns.
    members = (await session.execute(
        select(
            UserOrganization.id.label("membership_id"), UserOrganization.org_id,
            UserOrganization.user_id, User.email, User.is_superadmin,
            UserOrganization.role_id, Role.role_uuid,
            Role.name.label("role_name"), Role.role_type,
            User.id.label("existing_user_id"),
        )
        .select_from(UserOrganization)
        .outerjoin(User, User.id == UserOrganization.user_id)
        .outerjoin(Role, Role.id == UserOrganization.role_id)
        .where(UserOrganization.org_id == org["id"])
        .order_by(UserOrganization.id)
    )).mappings().all()

    roles = (await session.execute(
        select(Role.id, Role.role_uuid, Role.name, Role.role_type, Role.org_id)
        .where(or_(
            Role.role_uuid == "role_global_admin",
            (Role.name == "Admin") & (Role.role_type == RoleTypeEnum.TYPE_GLOBAL),
            Role.id == ADMIN_ROLE_ID,
        )).order_by(Role.id)
    )).mappings().all()
    candidates = []
    if email and email.strip():
        candidates = (await session.execute(
            select(User.id, User.email, User.is_superadmin)
            .where(func.lower(User.email) == email.strip().lower())
        )).mappings().all()
    valid_ids = {
        r["id"] for r in roles
        if r["role_uuid"] == "role_global_admin"
        and r["name"] == "Admin"
        and r["role_type"] == RoleTypeEnum.TYPE_GLOBAL and r["org_id"] is None
    }
    return {
        "organization": org,
        "members": [dict(m) for m in members],
        "admin_role_candidates": [dict(r) for r in roles],
        "initial_admin_email": email,
        "initial_admin_candidates": [dict(u) for u in candidates],
        "admin_count": len({m["user_id"] for m in members
                            if m["role_id"] in valid_ids and m["existing_user_id"] is not None}),
        "backend_guard_admin_memberships": sum(m["role_id"] == ADMIN_ROLE_ID for m in members),
        "backend_admin_role_id": ADMIN_ROLE_ID,
    }


def validate_role(state):
    roles = state["admin_role_candidates"]
    if len(roles) != 1:
        raise RecoveryError("Missing or ambiguous global Admin role; no changes made.")
    role = roles[0]
    if not (
        role["role_uuid"] == "role_global_admin" and role["name"] == "Admin"
        and role["role_type"] == RoleTypeEnum.TYPE_GLOBAL and role["org_id"] is None
        and role["id"] == ADMIN_ROLE_ID
    ):
        raise RecoveryError("Global Admin identity does not match backend RBAC constant; investigate seed/restore.")
    return role


def validate_target(state):
    role = validate_role(state)
    if state["admin_count"] or state["backend_guard_admin_memberships"]:
        raise RecoveryError("An admin already exists; no changes made. Use --mode verify.")
    users = state["initial_admin_candidates"]
    if len(users) != 1:
        raise RecoveryError("Initial admin email is missing, user does not exist, or email is ambiguous.")
    user = users[0]
    memberships = [m for m in state["members"] if m["user_id"] == user["id"]]
    if len(memberships) != 1:
        raise RecoveryError("User must already have exactly one membership in this organization.")
    member = memberships[0]
    if not member["role_uuid"]:
        raise RecoveryError("Membership has an invalid existing role; investigate before recovery.")
    return role, user, member


async def _lock_recovery_tables(session):
    if session.get_bind().dialect.name != "postgresql":
        raise RecoveryError("Apply requires PostgreSQL locking; unsupported database.")
    # A row lock on the org alone cannot serialize writers in existing services.
    # These brief table locks also block concurrent membership inserts/deletes
    # and role/user edits. Ordinary reads continue. Run in a maintenance window.
    await session.execute(text("SET LOCAL lock_timeout = '5s'"))
    await session.execute(text("SET LOCAL statement_timeout = '30s'"))
    await session.execute(text(
        'LOCK TABLE organization, "user", role, userorganization IN SHARE ROW EXCLUSIVE MODE'
    ))


async def recover(session, *, org_id=None, org_slug=None, email=None, mode="audit"):
    if mode not in {"audit", "dry-run", "apply", "verify"}:
        raise RecoveryError("Unknown mode.")
    selector = dict(org_id=org_id, org_slug=org_slug, email=email)
    async with session.begin():
        if mode == "apply":
            await _lock_recovery_tables(session)
        elif session.get_bind().dialect.name == "postgresql":
            await session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        before = await audit(session, **selector)
        if mode == "audit":
            return {"status": "audit_only", "changed": False, "state": before}
        if mode == "verify":
            role = validate_role(before)
            if before["admin_count"] < 1:
                raise RecoveryError("No valid organization Admin; verification failed.")
            if email:
                candidates = before["initial_admin_candidates"]
                if len(candidates) != 1 or not any(
                    m["user_id"] == candidates[0]["id"] and m["role_id"] == role["id"]
                    for m in before["members"]
                ):
                    raise RecoveryError("Requested initial user is not an organization Admin.")
            return {"status": "verified", "changed": False, "state": before}
        role, user, member = validate_target(before)
        if mode == "dry-run":
            return {"status": "ready", "changed": False, "state": before,
                    "planned_membership_id": member["membership_id"], "planned_role_id": role["id"]}
        result = await session.execute(
            update(UserOrganization)
            .where(UserOrganization.id == member["membership_id"],
                   UserOrganization.org_id == before["organization"]["id"],
                   UserOrganization.user_id == user["id"],
                   UserOrganization.role_id == member["role_id"])
            .values(role_id=role["id"], update_date=datetime.now(timezone.utc).isoformat())
        )
        if result.rowcount != 1:
            raise RecoveryError("Expected exactly one membership update; rolling back.")
        after = await audit(session, **selector)
        if after["admin_count"] != 1 or after["backend_guard_admin_memberships"] != 1:
            raise RecoveryError("Admin invariant failed; rolling back.")
    # Transaction has committed; read again, do not report only in-memory state.
    async with session.begin():
        committed = await audit(session, **selector)
    if committed["admin_count"] < 1:
        raise RecoveryError("Commit completed but post-commit admin verification failed; investigate immediately.")
    return {"status": "repaired", "changed": True, "before": before, "after": committed}


async def run(args):
    # Read the same runtime configuration as the API, without importing its
    # lifespan/bootstrap or running migrations/default-role refresh.
    from config.config import get_learnhouse_config

    config = get_learnhouse_config()
    url = str(config.database_config.sql_connection_string)
    for prefix in ("postgresql+psycopg2://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break
    if not url.startswith("postgresql+asyncpg://"):
        raise RecoveryError("Production recovery requires PostgreSQL.")
    engine = create_async_engine(
        url, echo=False, hide_parameters=True, poolclass=NullPool,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0,
                      "prepared_statement_name_func": lambda: ""},
    )
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            result = await recover(
                session, org_id=args.org_id, org_slug=args.org_slug,
                email=args.email or os.environ.get("LEARNHOUSE_INITIAL_ADMIN_EMAIL"), mode=args.mode,
            )
            if result["changed"]:
                # Only the recovered user's cached session, never FLUSHDB or
                # session-token deletion. Uses the API's shared Redis client.
                try:
                    from src.core.redis import get_redis_client
                    client = get_redis_client()
                    if client is None:
                        result["session_cache"] = "unavailable; allow 600s TTL before UI verification"
                    else:
                        user_id = result["after"]["initial_admin_candidates"][0]["id"]
                        client.delete(f"session:{user_id}")
                        result["session_cache"] = "invalidated"
                except Exception:
                    result["session_cache"] = "invalidation failed; allow 600s TTL before UI verification"
            return result
    finally:
        await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--org-id", type=int)
    parser.add_argument("--org-slug")
    parser.add_argument("--email", help="Defaults to LEARNHOUSE_INITIAL_ADMIN_EMAIL; never guesses an account.")
    parser.add_argument("--mode", choices=("audit", "dry-run", "apply", "verify"), default="audit")
    args = parser.parse_args()
    try:
        result = asyncio.run(run(args))
    except RecoveryError as exc:
        print(json.dumps({"status": "refused", "reason": str(exc)}))
        return 2
    except Exception as exc:
        # SQLAlchemy exceptions may contain SQL parameters or connection secrets.
        print(json.dumps({"status": "error", "error_type": type(exc).__name__,
                          "reason": "Recovery failed. Audit state before retrying; no raw exception printed."}))
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
