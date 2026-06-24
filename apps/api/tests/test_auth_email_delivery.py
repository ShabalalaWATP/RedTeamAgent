from __future__ import annotations

from email.message import EmailMessage

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.infrastructure.notifications import email as email_module
from app.infrastructure.notifications.email import NullEmailSender, SmtpEmailSender
from app.interfaces.api.dependencies import email_sender


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    def send(self, recipient: str, subject: str, body: str) -> None:
        self.sent.append({"recipient": recipient, "subject": subject, "body": body})


def test_production_auth_emails_hide_raw_tokens(client: TestClient) -> None:
    sender = FakeEmailSender()
    settings = Settings(app_env="production", public_app_url="https://redteamagent.example.test")
    client.app.dependency_overrides[get_settings] = lambda: settings
    client.app.dependency_overrides[email_sender] = lambda: sender

    registered = client.post(
        "/auth/register",
        json={"email": "prod-email@example.com", "password": "correct horse battery"},
    )
    assert registered.status_code == 200, registered.text
    assert registered.json()["verification_token"] is None
    assert sender.sent[0]["recipient"] == "prod-email@example.com"
    assert "verification_token=" in sender.sent[0]["body"]

    verification_token = _token_from_body(sender.sent[0]["body"], "verification_token")
    verified = client.post("/auth/verify-email", json={"token": verification_token})
    assert verified.status_code == 204, verified.text

    reset = client.post("/auth/password-reset/request", json={"email": "prod-email@example.com"})
    assert reset.status_code == 200, reset.text
    assert reset.json()["reset_token"] in {"", None}
    assert len(sender.sent) == 2
    assert "reset_token=" in sender.sent[1]["body"]

    reset_token = _token_from_body(sender.sent[1]["body"], "reset_token")
    confirmed = client.post(
        "/auth/password-reset/confirm",
        json={"token": reset_token, "password": "another correct phrase"},
    )
    assert confirmed.status_code == 204, confirmed.text

    client.app.dependency_overrides.clear()


def test_smtp_email_sender_uses_configured_transport(monkeypatch) -> None:
    calls: list[tuple[str, object]] = []

    class FakeSmtp:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            calls.append(("connect", (host, port, timeout)))

        def __enter__(self) -> FakeSmtp:
            return self

        def __exit__(self, *args: object) -> None:
            calls.append(("close", None))

        def starttls(self) -> None:
            calls.append(("starttls", None))

        def login(self, username: str, password: str) -> None:
            calls.append(("login", (username, password)))

        def send_message(self, message: EmailMessage) -> None:
            calls.append(("send", (message["To"], message["From"], message["Subject"])))

    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSmtp)
    settings = Settings(
        mail_from="RedTeamAgent <noreply@example.test>",
        smtp_host="smtp.example.test",
        smtp_port=2525,
        smtp_username="smtp-user",
        smtp_password="smtp-pass",  # noqa: S106 - deterministic fake SMTP password
        smtp_starttls=True,
    )
    SmtpEmailSender(settings).send("user@example.test", "Subject", "Body")
    NullEmailSender().send("ignored@example.test", "Ignored", "Ignored")

    assert ("connect", ("smtp.example.test", 2525, 10)) in calls
    assert ("starttls", None) in calls
    assert ("login", ("smtp-user", "smtp-pass")) in calls
    assert ("send", ("user@example.test", "RedTeamAgent <noreply@example.test>", "Subject")) in calls


def _token_from_body(body: str, key: str) -> str:
    return str(body.split(f"{key}=", 1)[1].strip())
