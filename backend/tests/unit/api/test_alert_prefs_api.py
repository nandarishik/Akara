from app.api.v1.notifications import PREF_KEYS, NotificationPreferencesPut


def test_put_model_requires_five_keys() -> None:
    row = {"email": True, "whatsapp": False, "in_app": True}
    body = NotificationPreferencesPut.model_validate(dict.fromkeys(PREF_KEYS, row))
    assert set(body.model_dump()) == set(PREF_KEYS)
