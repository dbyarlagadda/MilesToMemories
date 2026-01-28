# MilesToMemories - System Design Document

## 1. Overview

**MilesToMemories** is a travel diary application that allows users to document their journeys with photos, locations, and memories. The app features an interactive world map showing trip locations and a timeline-based interface for browsing travel experiences.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Web Browser   │   iOS App       │   Mobile Web    │   Admin Dashboard     │
│   (HTML/CSS/JS) │   (WKWebView)   │   (Responsive)  │   (admin.html)        │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         └─────────────────┴─────────────────┴─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCER / DNS                                │
│                      milestomemories.mooo.com (FreeDNS)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│        NGINX (Port 80)        │   │     Node.js API (Port 3000)   │
│     Static File Server        │   │        Express.js             │
│   - index.html                │   │   - /api/auth/*               │
│   - login.html                │   │   - /api/trips/*              │
│   - add-trip.html             │   │   - /api/users/*              │
│   - profile.html              │   │   - /api/comments/*           │
│   - admin.html                │   │   - /api/admin/*              │
│   - api.js, CSS, images       │   │                               │
└───────────────────────────────┘   └───────────────┬───────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │      Amazon RDS (PostgreSQL)  │
                                    │   Aurora PostgreSQL Cluster   │
                                    │   - Primary (Read/Write)      │
                                    │   - Replica (Read Only)       │
                                    └───────────────────────────────┘
```

---

## 3. Component Details

### 3.1 Frontend (Client Layer)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web App | HTML5, CSS3, Vanilla JS | Main user interface |
| iOS Wrapper | Xcode/WKWebView | Native iOS app shell |
| Map | Leaflet.js + CartoDB tiles | Interactive world map |
| API Client | api.js | Centralized API communication |

**Key Files:**
- `index.html` - Main dashboard with map, stories, gallery
- `login.html` - Authentication (login/register)
- `add-trip.html` - Trip creation form
- `profile.html` - User profile management
- `admin.html` - Admin dashboard
- `api.js` - API client with auth handling

### 3.2 Backend (API Layer)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js v20 | JavaScript runtime |
| Framework | Express.js | REST API framework |
| Auth | JWT + bcryptjs | Token-based authentication |
| Process Manager | PM2 | Production process management |

**API Endpoints:**

```
Authentication:
POST   /api/auth/register     - Create new user
POST   /api/auth/login        - User login
GET    /api/auth/me           - Get current user

Trips:
GET    /api/trips             - List all trips
GET    /api/trips/:id         - Get single trip
POST   /api/trips             - Create trip (auth required)
PUT    /api/trips/:id         - Update trip (owner only)
DELETE /api/trips/:id         - Delete trip (owner only)
POST   /api/trips/:id/like    - Like a trip
DELETE /api/trips/:id/like    - Unlike a trip
POST   /api/trips/:id/save    - Save a trip
DELETE /api/trips/:id/save    - Unsave a trip

Users:
GET    /api/users/trips       - Get user's trips
GET    /api/users/saved       - Get saved trips
PUT    /api/users/profile     - Update profile
GET    /api/users/stats       - Get user statistics

Comments:
GET    /api/comments/trip/:id - Get trip comments
POST   /api/comments/trip/:id - Add comment
DELETE /api/comments/:id      - Delete comment

Admin:
GET    /api/admin/stats       - Dashboard statistics
GET    /api/admin/users       - List all users
GET    /api/admin/trips       - List all trips
DELETE /api/admin/users/:id   - Delete user
DELETE /api/admin/trips/:id   - Delete trip
```

### 3.3 Database Layer

**Amazon RDS Aurora PostgreSQL**

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trips Table
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    date TEXT,
    description TEXT,
    mood TEXT,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trip Photos Table
CREATE TABLE trip_photos (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id),
    photo_url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Trip Likes Table
CREATE TABLE trip_likes (
    trip_id INTEGER REFERENCES trips(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (trip_id, user_id)
);

-- Trip Saves Table
CREATE TABLE trip_saves (
    trip_id INTEGER REFERENCES trips(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (trip_id, user_id)
);

-- Comments Table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id),
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Profiles Table
CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    bio TEXT,
    location TEXT,
    website TEXT
);

-- Social Connections Table
CREATE TABLE social_connections (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    instagram TEXT,
    twitter TEXT,
    facebook TEXT
);
```

---

## 4. Infrastructure

### 4.1 AWS Services

| Service | Configuration | Purpose |
|---------|---------------|---------|
| EC2 | t2.micro (Free Tier) | Application server |
| RDS | Aurora PostgreSQL (Free Tier) | Database |
| VPC | Default VPC | Network isolation |
| Security Groups | Port 22, 80, 3000, 5432 | Firewall rules |

### 4.2 Server Configuration

**EC2 Instance:**
```
Instance ID: i-0b0ffce4a9c7e5958
Public IP: 3.82.20.152
OS: Amazon Linux 2
Region: us-east-1
```

**RDS Instance:**
```
Endpoint: milestomemories.cluster-c27qw0k4m23o.us-east-1.rds.amazonaws.com
Engine: Aurora PostgreSQL
Database: milestomemories
Port: 5432
```

### 4.3 Domain & DNS

```
Domain: milestomemories.mooo.com (FreeDNS)
Points to: 3.82.20.152
```

---

## 5. Data Flow

### 5.1 User Registration Flow

```
┌──────┐     ┌─────────┐     ┌─────────┐     ┌──────┐
│Client│────▶│ API     │────▶│ bcrypt  │────▶│ RDS  │
│      │     │/register│     │ hash    │     │      │
└──────┘     └─────────┘     └─────────┘     └──────┘
    ▲                                            │
    │            ┌─────────┐                     │
    └────────────│  JWT    │◀────────────────────┘
                 │  Token  │
                 └─────────┘
```

### 5.2 Trip Creation Flow

```
┌──────┐     ┌─────────┐     ┌─────────┐     ┌──────┐
│Client│────▶│ API     │────▶│ Auth    │────▶│ RDS  │
│      │     │/trips   │     │Middleware│    │      │
└──────┘     └─────────┘     └─────────┘     └──────┘
    │                                            │
    │  (JWT Token in Header)                     │
    │                                            ▼
    │                                    ┌──────────────┐
    └────────────────────────────────────│ Trip Created │
                                         └──────────────┘
```

### 5.3 Map Display Flow

```
┌──────┐     ┌─────────┐     ┌──────┐     ┌─────────┐
│Client│────▶│ API     │────▶│ RDS  │────▶│ Trips   │
│      │     │/users/  │     │      │     │ Data    │
│      │     │trips    │     │      │     │         │
└──────┘     └─────────┘     └──────┘     └─────────┘
    │                                          │
    ▼                                          ▼
┌──────────┐                           ┌──────────────┐
│ Leaflet  │◀──────────────────────────│ Coordinates  │
│ Map      │                           │ Lookup       │
└──────────┘                           └──────────────┘
```

---

## 6. Security

### 6.1 Authentication

- **Password Hashing:** bcryptjs with salt rounds = 10
- **Token:** JWT with 7-day expiration
- **Storage:** Token stored in localStorage

### 6.2 Authorization

- Trip edit/delete: Owner only
- Comment delete: Owner only
- Admin routes: No auth (should add admin auth)

### 6.3 Security Headers

```javascript
// CORS Configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
```

### 6.4 Recommendations for Production

- [ ] Add rate limiting
- [ ] Implement HTTPS (SSL/TLS)
- [ ] Add admin authentication
- [ ] Use environment-specific CORS
- [ ] Add input sanitization
- [ ] Implement CSRF protection
- [ ] Add request logging

---

## 7. Scalability Considerations

### 7.1 Current Architecture (Single Server)

```
Capacity: ~100-500 concurrent users
Bottleneck: Single EC2 instance
```

### 7.2 Scaled Architecture (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                      CloudFront CDN                          │
│              (Static assets, global distribution)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Application Load Balancer                     │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌──────────┐      ┌──────────┐      ┌──────────┐
      │   EC2    │      │   EC2    │      │   EC2    │
      │ (API 1)  │      │ (API 2)  │      │ (API 3)  │
      └──────────┘      └──────────┘      └──────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                    ┌─────────────────┐
                    │   Aurora RDS    │
                    │  (Multi-AZ)     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   ElastiCache   │
                    │   (Redis)       │
                    └─────────────────┘
```

### 7.3 Scaling Strategies

| Component | Strategy |
|-----------|----------|
| API Servers | Horizontal scaling with ALB |
| Database | Aurora read replicas |
| Static Files | CloudFront CDN |
| Sessions | Redis/ElastiCache |
| Images | S3 + CloudFront |

---

## 8. Performance Optimizations

### 8.1 Image Optimization

**WebP Format Conversion:**
```javascript
// Automatically converts Unsplash images to WebP with quality optimization
function optimizeImageUrl(url, width = 800) {
    if (url.includes('unsplash.com')) {
        const baseUrl = url.split('?')[0];
        return `${baseUrl}?w=${width}&q=75&fm=webp&fit=crop&auto=format`;
    }
    return url;
}
```

**Image Size Strategy:**
| Context | Width | Purpose |
|---------|-------|---------|
| Map markers | 88px | Tiny circular icons |
| Popup images | 250px | Small preview in map popup |
| Gallery/Timeline | 400px | Medium thumbnails |
| Story cards | 600px | Card images |
| Featured story | 1200px | Hero images |

### 8.2 Lazy Loading

**Native Lazy Loading:**
```html
<img src="..." loading="lazy" alt="...">
```

**Intersection Observer (Custom):**
```javascript
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '50px 0px' });
        lazyImages.forEach(img => imageObserver.observe(img));
    }
}
```

### 8.3 Resource Hints

**Preconnect (Early Connection):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="preconnect" href="https://unpkg.com">
```

**DNS Prefetch (CDN Tiles):**
```html
<link rel="dns-prefetch" href="https://a.basemaps.cartocdn.com">
<link rel="dns-prefetch" href="https://b.basemaps.cartocdn.com">
```

### 8.4 Script Loading

**Deferred JavaScript:**
```html
<!-- Non-critical scripts load after HTML parsing -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
```

### 8.5 Performance Metrics

| Optimization | Impact |
|--------------|--------|
| WebP images | ~30% smaller file size |
| Lazy loading | Faster initial page load |
| Preconnect | ~100-300ms faster resource fetch |
| Deferred scripts | Unblocked HTML parsing |

---

## 9. Monitoring & Logging

### 8.1 Current Setup

- PM2 logs: `pm2 logs milestomemories`
- Console logging for errors

### 8.2 Recommended Additions

- [ ] CloudWatch metrics
- [ ] Application logging (Winston)
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring (UptimeRobot)

---

## 10. Deployment

### 10.1 Current Deployment Process

```bash
# 1. Push to GitHub
git add . && git commit -m "message" && git push origin main

# 2. SSH to EC2 and pull
ssh -i key.pem ec2-user@3.82.20.152
cd /home/ec2-user/MilesToMemories
git pull origin main

# 3. Restart PM2
pm2 restart milestomemories --update-env
```

### 10.2 Recommended CI/CD Pipeline

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  GitHub  │────▶│  GitHub  │────▶│  Build   │────▶│  Deploy  │
│  Push    │     │  Actions │     │  & Test  │     │  to EC2  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 11. Cost Analysis (AWS Free Tier)

| Service | Free Tier Limit | Current Usage |
|---------|-----------------|---------------|
| EC2 | 750 hrs/month t2.micro | ~720 hrs |
| RDS | 750 hrs/month db.t2.micro | ~720 hrs |
| Data Transfer | 15 GB/month | < 1 GB |
| Storage | 30 GB EBS | < 10 GB |

**Estimated Monthly Cost After Free Tier:** ~$25-40/month

---

## 12. Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Maps | Leaflet.js, CartoDB Tiles |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Aurora) |
| Auth | JWT, bcryptjs |
| Hosting | AWS EC2, RDS |
| DNS | FreeDNS (mooo.com) |
| Process Manager | PM2 |
| Version Control | Git, GitHub |
| iOS | Xcode, WKWebView |

---

## 13. Future Enhancements

1. **Image Storage:** Migrate to S3 for scalable image hosting
2. **Search:** Add Elasticsearch for trip/location search
3. **Notifications:** Push notifications for likes/comments
4. **Social Features:** Follow users, activity feed
5. **Offline Mode:** Service worker for offline access
6. **Analytics:** User behavior tracking
7. **Multi-language:** i18n support
8. **API Versioning:** /api/v1/, /api/v2/

---

*Document Version: 1.1*
*Last Updated: January 28, 2026*
