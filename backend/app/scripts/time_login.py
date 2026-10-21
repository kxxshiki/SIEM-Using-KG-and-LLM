"""Times the login request alone. Run from the backend folder:  python -m scripts.time_login"""
import getpass
import statistics
import time

import httpx

from app.config import settings


def main() -> None:
    username = input("Username: ")
    password = getpass.getpass("Password: ")
    url = settings.BACKEND_URL.rstrip("/") + "/api/v1/auth/login"
    times = []
    with httpx.Client(timeout=30) as client:
        for _ in range(5):
            start = time.perf_counter()
            resp = client.post(url, data={"username": username, "password": password})
            times.append((time.perf_counter() - start) * 1000)
            print(f"HTTP {resp.status_code}  {times[-1]:.0f} ms")
            if resp.status_code != 200:
                print("Stopping: a wrong password counts toward the login lockout.")
                break
    print(f"median {statistics.median(times):.0f} ms over {len(times)} request(s)")


if __name__ == "__main__":
    main()