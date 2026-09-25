"""Characterize existing bootstrap failure windows; no production writes."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, Mock

import pytest
import typer
from sqlalchemy import event
from sqlmodel import select

from src.db.organizations import Organization, OrganizationCreate
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserCreate
from src.services.setup.setup import (
    install_create_organization, install_create_organization_user, install_default_elements,
)


async def test_successful_bootstrap_creates_superadmin_and_org_admin(db):
    await install_default_elements(db)
    org = await install_create_organization(OrganizationCreate(name="Fresh", slug="fresh", email=""), db)
    user = await install_create_organization_user(
        UserCreate(username="fresh", first_name="Fresh", last_name="Admin", email="fresh@example.com", password="test-only-bootstrap-value"),
        org.slug, db, is_superadmin=True,
    )
    assert (await db.get(User, user.id)).is_superadmin is True
    membership = (await db.execute(select(UserOrganization).where(UserOrganization.user_id == user.id))).scalars().one()
    assert membership.org_id == org.id and membership.role_id == 1


async def test_current_short_install_commits_org_before_missing_password_failure(db, monkeypatch):
    import cli

    @asynccontextmanager
    async def session_context(*args, **kwargs):
        yield db

    monkeypatch.setattr(cli, "create_engine", Mock())
    monkeypatch.setattr(cli.SQLModel.metadata, "create_all", Mock())
    monkeypatch.setattr(cli, "create_async_engine", Mock(return_value=Mock(dispose=AsyncMock())))
    monkeypatch.setattr(cli, "AsyncSession", session_context)
    monkeypatch.setenv("LEARNHOUSE_INITIAL_ORG_SLUG", "partial")
    monkeypatch.setenv("LEARNHOUSE_INITIAL_ADMIN_EMAIL", "initial@example.com")
    monkeypatch.delenv("LEARNHOUSE_INITIAL_ADMIN_PASSWORD", raising=False)
    with pytest.raises(typer.Exit):
        await cli._install_async(short=True)
    await db.rollback()
    assert (await db.execute(select(Organization).where(Organization.slug == "partial"))).scalars().one()
    assert (await db.execute(select(User))).scalars().all() == []
    assert (await db.execute(select(UserOrganization))).scalars().all() == []


async def test_current_membership_failure_leaves_committed_superadmin(db):
    await install_default_elements(db)
    org = await install_create_organization(OrganizationCreate(name="Partial", slug="partial", email=""), db)

    def fail_membership_insert(*args):
        raise RuntimeError("Simulated interrupted membership insert")

    event.listen(UserOrganization, "before_insert", fail_membership_insert)
    try:
        with pytest.raises(RuntimeError, match="Simulated interrupted"):
            await install_create_organization_user(
                UserCreate(username="partial", first_name="Partial", last_name="Admin", email="partial@example.com", password="test-only-bootstrap-value"),
                org.slug, db, is_superadmin=True,
            )
    finally:
        event.remove(UserOrganization, "before_insert", fail_membership_insert)
        await db.rollback()
    users = (await db.execute(select(User))).scalars().all()
    assert len(users) == 1 and users[0].is_superadmin is True
    assert (await db.execute(select(UserOrganization))).scalars().all() == []


async def test_auto_install_skips_existing_adminless_org(db, monkeypatch):
    from src.core.events import autoinstall

    db.add(Organization(name="Existing", slug="existing", email="", org_uuid="org_existing"))
    await db.commit()

    @asynccontextmanager
    async def session_context():
        yield db

    installer = AsyncMock()
    monkeypatch.setattr(autoinstall, "_async_session_factory", session_context)
    monkeypatch.setattr(autoinstall, "_install_async", installer)
    await autoinstall.auto_install()
    installer.assert_not_awaited()
    assert (await db.execute(select(UserOrganization))).scalars().all() == []
