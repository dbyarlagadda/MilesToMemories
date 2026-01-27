# MilesToMemories Backend Server

Node.js + Express + PostgreSQL backend for the MilesToMemories travel diary app.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher)

## Installation

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15
```

**macOS (using Postgres.app):**
- Download from https://postgresapp.com/
- Install and start the app

**Or download from:**
- https://www.postgresql.org/download/macosx/

### 2. Install Node.js dependencies

```bash
cd server
npm install
```

### 3. Configure environment

Edit `.env` file with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=milestomemories
DB_USER=postgres
DB_PASSWORD=your_password
```

### 4. Initialize Database

```bash
npm run db:init
```

This will:
- Create the `milestomemories` database
- Create all required tables
- Insert demo data

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server runs at: http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Trips
- `GET /api/trips` - Get all trips
- `GET /api/trips/:id` - Get single trip
- `POST /api/trips` - Create trip (auth required)
- `PUT /api/trips/:id` - Update trip (auth required)
- `DELETE /api/trips/:id` - Delete trip (auth required)
- `POST /api/trips/:id/like` - Like trip
- `DELETE /api/trips/:id/like` - Unlike trip
- `POST /api/trips/:id/save` - Save trip
- `DELETE /api/trips/:id/save` - Unsave trip

### Users
- `PUT /api/users/profile` - Update profile
- `GET /api/users/social` - Get social connections
- `PUT /api/users/social` - Update social connections
- `GET /api/users/trips` - Get user's trips
- `GET /api/users/saved` - Get saved trips
- `GET /api/users/stats` - Get user stats

### Comments
- `GET /api/comments/trip/:tripId` - Get comments
- `POST /api/comments/trip/:tripId` - Add comment
- `DELETE /api/comments/:id` - Delete comment

## Database Schema

- **users** - User accounts
- **user_profiles** - Extended profile info
- **social_connections** - Instagram, Pinterest, YouTube links
- **trips** - Travel entries
- **trip_photos** - Multiple photos per trip
- **trip_likes** - Like tracking
- **trip_saves** - Bookmarks
- **comments** - Trip comments

## Demo Credentials

- Email: `demo@milestomemories.com`
- Password: `demo123`
