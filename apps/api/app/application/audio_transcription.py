from __future__ import annotations

from app.application.model_routing import select_model_route
from app.application.ports.credentials import CredentialVault
from app.application.ports.ingestion import AudioTranscriber


class AudioTranscriptionService:
    def __init__(
        self,
        repo: object,
        credential_vault: CredentialVault,
        audio_transcriber: AudioTranscriber,
    ) -> None:
        self.repo = repo
        self.credential_vault = credential_vault
        self.audio_transcriber = audio_transcriber

    def transcript_for_upload(
        self,
        workspace_id: str,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> tuple[str | None, str | None]:
        if not content_type.startswith("audio/"):
            return None, None
        route = select_model_route(self.repo, workspace_id, ["transcription"])
        if route is None:
            return None, None
        try:
            credentials = self.credential_vault.unseal(route.encrypted_credentials)
            transcript = self.audio_transcriber.transcribe(
                provider=route.provider,
                config=route.config,
                credentials=credentials,
                filename=filename,
                content_type=content_type,
                content=content,
            )
        except Exception:
            return None, "Speech-to-text transcription failed; local deterministic fallback was used."
        if transcript:
            return transcript, None
        return None, "Configured provider did not return a usable transcript; local deterministic fallback was used."
