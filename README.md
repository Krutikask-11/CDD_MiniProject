# Hostel Complaint Tracker

Group 6 (C1 Batch), NIE Mysore - Collaborative Development and DevOps (1BCS303)

A web app where students report hostel problems, the warden assigns them to staff, and everyone can track the status (Open -> In Progress -> Resolved).

    frontend/   HTML, CSS, JavaScript (designed in Figma first)
    backend/    Node.js + Express API, Mongoose models, tests
    docker-compose.yml, .github/workflows/ci.yml   (DevOps: Docker + GitHub Actions)

How the parts connect:
Browser (frontend) -> `frontend/js/api.js` -> Express API (`/api/...`) -> MongoDB Atlas

## Windows quick start (VS Code)

1. Open the project folder in VS Code.
2. Open Terminal -> New Terminal and start the backend:

   ```powershell
   cd backend
   npm install
   npm start
   ```

3. Keep the backend terminal running. Confirm the API is healthy by opening `http://localhost:5000/api/health`; it should return `{"status":"ok"}`.
4. In VS Code Explorer, right-click `frontend/index.html` and choose **Open with Live Server**.
5. Use the URL opened by Live Server. If its origin is not `http://localhost:8080`, set `CLIENT_ORIGIN` in `backend/.env` to the exact frontend origin (scheme + host + port, with no page path). For example:

   ```env
   CLIENT_ORIGIN=http://127.0.0.1:5500
   ```

   Restart the backend after changing `backend/.env`. If Live Server uses another port, use that port instead.

Do not close the backend terminal while demonstrating the app. To stop the backend, press `Ctrl+C` in that terminal.

## 1. Create the database on MongoDB Atlas (one time)
1. Sign up at mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** -> Add Database User. Choose a username and password and save the password.
3. **Network Access** -> Add IP Address. For college demos use "Allow access from anywhere" (0.0.0.0/0).
4. **Database** -> Connect -> Drivers -> copy the connection string, for example:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hostel?retryWrites=true&w=majority`
   Put your real username and password in it, and keep `/hostel` before the `?` (that is the database name).
   If the password has special characters such as @ or #, URL-encode them.

## 2. Run the backend
    cd backend
    cp .env.example .env        # then edit .env: paste MONGODB_URI, set a long random JWT_SECRET
    npm install
    npm run seed                # creates the admin, 2 staff and 1 demo student in Atlas
    npm start                   # API on http://localhost:5000  (check /api/health)

The collections (users, complaints, counters) are created automatically the first time data is saved.
In Atlas: Database -> Browse Collections -> `hostel` to see them.

## 3. Run the frontend
    cd frontend
    python3 -m http.server 8080     # open http://localhost:8080

`frontend/js/api.js` is already set to `USE_MOCK: false` and `API_BASE: http://localhost:5000/api`.
(Set `USE_MOCK: true` to run the frontend alone with browser-only demo data.)

## 4. Log in (accounts created by the seed script)
| Role | Email | Password |
|---|---|---|
| Student | student@nie.ac.in | student123 |
| Administrator | admin@nie.ac.in | admin123 |
| Staff (water) | ravi@nie.ac.in | staff123 |
| Staff (electricity) | suma@nie.ac.in | staff123 |

Change these passwords before the final submission. New students can create their own account on the login page.

## 5. Docker (optional)
Create a `.env` file in this folder (next to docker-compose.yml) with `MONGODB_URI=...` and `JWT_SECRET=...`, then:

    docker compose up --build       # frontend http://localhost:8080, API http://localhost:5000

## 6. Tests
    cd backend && npm test
The tests need a MongoDB. Use a separate throwaway database and set `MONGODB_URI_TEST` (the tests wipe it). GitHub Actions runs them automatically on every push.

## 7. CI/CD secrets (GitHub -> Settings -> Secrets and variables -> Actions)
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (the pipeline builds and pushes images when code reaches `main`).

## Security notes
- Never commit `.env` (it is in `.gitignore`) and never share the Atlas password or JWT secret in chats or screenshots.
- Passwords are stored as bcrypt hashes; roles are checked on the server for every request.
<!-- Minor documentation update for project maintenance -->
