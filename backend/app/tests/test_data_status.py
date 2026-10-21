from tests.helpers import API, GOOD_PW, bearer, login, make_user


def test_requires_login(client):
    assert client.get(f"{API}/data/status").status_code == 401


def test_reports_no_logs_when_the_table_is_empty(client):
    make_user("bob")
    token = login(client, "bob", GOOD_PW).json()["access_token"]
    r = client.get(f"{API}/data/status", headers=bearer(token))
    assert r.status_code == 200 and r.json() == {"has_logs": False}