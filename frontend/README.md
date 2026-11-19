# Hostel Complaint Tracker – Frontend

Plain HTML, CSS and JavaScript (no build step).

## Run locally
    cd frontend
    python3 -m http.server 8080      # then open http://localhost:8080

Demo mode (default) stores data in the browser, so the whole UI works without a backend.

## Connect to the backend
In `js/api.js` set:

    const CONFIG = { USE_MOCK: false, API_BASE: 'http://localhost:5000/api' };

Endpoints the frontend expects are listed at the top of `js/api.js`.

## Docker
    docker build -t hostel-complaint-frontend ./frontend
    docker run -p 8080:80 hostel-complaint-frontend
