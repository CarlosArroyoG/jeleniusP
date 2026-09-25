"""Recovery refusals, rollback, idempotence and real role-route behavior.

SQLite unit tests replace only PostgreSQL's table-lock acquisition. Production
apply never permits SQLite. No authorization/last-admin guards are patched.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update
from sqlmodel import select

from scripts import recover_first_org_admin as recovery
from src.db.organizations import Organization
from src.db.roles import Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.setup.setup import install_default_elements


@pytest.fixture
async def orphan(db, monkeypatch):
    await install_default_elements(db)
    org = Organization(id=71, name="Recovery fixture", slug="recovery", email="", org_uuid="org_recovery", is_demo=True)
    founder = User(id=81, username="founder", first_name="Founder", last_name="Test", email="founder@example.test", user_uuid="user_founder", is_superadmin=True, password="never-print-this-hash")
    learner = User(id=82, username="learner", first_name="Learner", last_name="Test", email="learner@example.test", user_uuid="user_learner")
    db.add_all([org, founder, learner])
    await db.flush()
    db.add_all([
        UserOrganization(id=91, org_id=org.id, user_id=founder.id, role_id=4, creation_date="before", update_date="before"),
        UserOrganization(id=92, org_id=org.id, user_id=learner.id, role_id=4, creation_date="before", update_date="before"),
    ])
    await db.commit()
    monkeypatch.setattr(recovery, "_lock_recovery_tables", AsyncMock())
    return dict(org_id=org.id, org_slug=org.slug, email=founder.email)


async def test_audit_and_dry_run_do_not_write_or_expose_secrets(db, orphan):
    result = await recovery.recover(db, **orphan)
    assert result["state"]["admin_count"] == 0
    assert result["state"]["backend_guard_admin_memberships"] == 0
    assert "password" not in str(result)
    assert "never-print-this-hash" not in str(result)
    ready = await recovery.recover(db, **orphan, mode="dry-run")
    assert ready["status"] == "ready" and ready["changed"] is False
    assert (await db.get(UserOrganization, 91)).role_id == 4


async def test_repair_only_updates_existing_membership_and_is_repeat_safe(db, orphan):
    result = await recovery.recover(db, **orphan, mode="apply")
    assert result["before"]["admin_count"] == 0
    assert result["after"]["admin_count"] == 1
    with pytest.raises(recovery.RecoveryError, match="already exists"):
        await recovery.recover(db, **orphan, mode="apply")
    assert (await recovery.recover(db, **orphan, mode="verify"))["changed"] is False
    assert (await db.get(UserOrganization, 91)).role_id == 1
    assert (await db.get(UserOrganization, 92)).role_id == 4
    assert len((await db.execute(select(UserOrganization))).scalars().all()) == 2
    assert len((await db.execute(select(Role))).scalars().all()) == 4
    assert len((await db.execute(select(User))).scalars().all()) == 2
    assert (await db.get(User, 81)).is_superadmin is True


@pytest.mark.parametrize("override,reason", [
    ({"org_id": 999}, "Organization not found"),
    ({"org_slug": "wrong"}, "Organization not found"),
    ({"email": "missing@example.test"}, "user does not exist"),
    ({"email": None}, "email is missing"),
])
async def test_missing_or_mismatched_identity_aborts(db, orphan, override, reason):
    with pytest.raises(recovery.RecoveryError, match=reason):
        await recovery.recover(db, **(orphan | override), mode="apply")
    assert (await db.get(UserOrganization, 91)).role_id == 4


async def test_missing_membership_does_not_create_one(db, orphan):
    await db.execute(delete(UserOrganization).where(UserOrganization.id == 91))
    await db.commit()
    with pytest.raises(recovery.RecoveryError, match="exactly one membership"):
        await recovery.recover(db, **orphan, mode="apply")
    assert len((await db.execute(select(UserOrganization))).scalars().all()) == 1


async def test_duplicate_membership_aborts(db, orphan):
    db.add(UserOrganization(org_id=71, user_id=81, role_id=4, creation_date="", update_date=""))
    await db.commit()
    with pytest.raises(recovery.RecoveryError, match="exactly one membership"):
        await recovery.recover(db, **orphan, mode="apply")


async def test_ambiguous_email_aborts(db, orphan):
    db.add(User(username="duplicate", first_name="Duplicate", last_name="Test", email="FOUNDER@example.test", user_uuid="user_duplicate"))
    await db.commit()
    with pytest.raises(recovery.RecoveryError, match="email is ambiguous"):
        await recovery.recover(db, **orphan, mode="apply")


async def test_ambiguous_admin_role_aborts_without_altering_roles(db, orphan):
    db.add(Role(id=55, name="Admin", role_uuid="role_global_admin", role_type=RoleTypeEnum.TYPE_GLOBAL))
    await db.commit()
    with pytest.raises(recovery.RecoveryError, match="ambiguous global Admin"):
        await recovery.recover(db, **orphan, mode="apply")
    assert (await db.get(UserOrganization, 91)).role_id == 4
    assert (await db.get(Role, 55)) is not None


@pytest.mark.parametrize("bad", [{"role_uuid": "wrong"}, {"org_id": 71}, {"role_type": RoleTypeEnum.TYPE_ORGANIZATION}])
async def test_noncanonical_admin_role_aborts(db, orphan, bad):
    await db.execute(update(Role).where(Role.id == 1).values(**bad))
    await db.commit()
    with pytest.raises(recovery.RecoveryError, match="identity does not match"):
        await recovery.recover(db, **orphan, mode="apply")


async def test_verify_requires_valid_admin(db, orphan):
    with pytest.raises(recovery.RecoveryError, match="No valid organization Admin"):
        await recovery.recover(db, **orphan, mode="verify")


async def test_failed_post_update_invariant_rolls_back(db, orphan, monkeypatch):
    original = recovery.audit
    calls = 0

    async def broken_check(*args, **kwargs):
        nonlocal calls
        calls += 1
        state = await original(*args, **kwargs)
        if calls == 2:
            state["admin_count"] = 0
        return state

    monkeypatch.setattr(recovery, "audit", broken_check)
    with pytest.raises(recovery.RecoveryError, match="rolling back"):
        await recovery.recover(db, **orphan, mode="apply")
    assert (await db.get(UserOrganization, 91)).role_id == 4


async def test_apply_rejects_non_postgresql(db):
    with pytest.raises(recovery.RecoveryError, match="requires PostgreSQL"):
        await recovery._lock_recovery_tables(db)


async def test_recovered_org_role_api_and_last_admin_guard(db, orphan, monkeypatch):
    from src.core.events.database import get_db_session
    from src.routers.orgs.orgs import router
    from src.security.auth import get_current_user
    from src.services.orgs import users as users_service

    # Only external delivery is suppressed. Keep the real role service, RBAC,
    # seat checks and both no-admin/last-admin protections.
    monkeypatch.setattr(users_service, "dispatch_webhooks", AsyncMock())
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/orgs")
    founder = PublicUser(id=81, username="founder", first_name="Founder", last_name="Test", email=orphan["email"], user_uuid="user_founder", is_superadmin=True)
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: founder

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        path = "/api/v1/orgs/71/users/82/role/"
        before = await client.put(path + "role_global_instructor")
        assert before.status_code == 400
        assert before.json()["detail"] == "There is no admin in the organization"
        await db.rollback()  # End the failed request's read transaction.
        await recovery.recover(db, **orphan, mode="apply")

        # The first admin must remain protected before another is promoted.
        blocked = await client.put("/api/v1/orgs/71/users/81/role/role_global_instructor")
        assert blocked.status_code == 400
        assert blocked.json()["detail"] == "Organization must have at least one admin"
        for role_uuid, role_id in [("role_global_instructor", 3), ("role_global_maintainer", 2), ("role_global_admin", 1)]:
            response = await client.put(path + role_uuid)
            assert response.status_code == 200, response.text
            assert (await db.get(UserOrganization, 92)).role_id == role_id
